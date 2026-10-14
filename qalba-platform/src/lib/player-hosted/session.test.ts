import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { awardPoint, buzz, initialLabState, openRound } from "./lab";
import { CHANNEL_LABEL, LabSession, type LabRole, type SessionView } from "./session";

// Lifecycle regression doubles. These do not establish or claim a real WebRTC connection.
class Channel {
  label = CHANNEL_LABEL;
  ordered = true;
  maxRetransmits = null;
  maxPacketLifeTime = null;
  readyState = "connecting";
  bufferedAmount = 0;
  failSend = false;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  send(raw: string) { if (this.failSend) throw new Error("send failed"); this.sent.push(raw); }
  close() { this.readyState = "closed"; this.onclose?.(); }
  open() { this.readyState = "open"; this.onopen?.(); }
  message(data: unknown) { this.onmessage?.({ data }); }
  asRTC() { return this as unknown as RTCDataChannel; }
}
const signal = (type: "offer" | "answer") => JSON.stringify({ type, sdp: "v=0\r\n" + "x".repeat(30) });
class Peer extends EventTarget {
  connectionState = "new";
  iceGatheringState = "complete";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  channel = new Channel();
  rejectRemote = false;
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((event: { channel: RTCDataChannel }) => void) | null = null;
  createOffer = vi.fn(async () => JSON.parse(signal("offer")) as RTCSessionDescriptionInit);
  createAnswer = vi.fn(async () => JSON.parse(signal("answer")) as RTCSessionDescriptionInit);
  createDataChannel = vi.fn(() => this.channel.asRTC());
  setLocalDescription = vi.fn(async (value: RTCSessionDescriptionInit) => { this.localDescription = value; });
  setRemoteDescription = vi.fn(async (value: RTCSessionDescriptionInit) => {
    if (this.rejectRemote) throw new Error("bad SDP");
    this.remoteDescription = value;
  });
  close() { this.connectionState = "closed"; this.dispatchEvent(new Event("connectionstatechange")); this.onconnectionstatechange?.(); }
  connect() { this.connectionState = "connected"; this.onconnectionstatechange?.(); this.channel.open(); }
  disconnect() { this.connectionState = "disconnected"; this.onconnectionstatechange?.(); }
  incoming(channel = this.channel) { this.ondatachannel?.({ channel: channel.asRTC() }); }
  asRTC() { return this as unknown as RTCPeerConnection; }
}
const sessions: LabSession[] = [];
function setup(role: LabRole, peer = new Peer()) {
  const updates: SessionView[] = [];
  const session = new LabSession(role, value => updates.push(value), () => peer.asRTC());
  sessions.push(session);
  return { session, peer, updates, view: () => updates.at(-1)! };
}
async function connectedHost() {
  const fixture = setup("host"); await fixture.session.startHost(); fixture.peer.connect(); return fixture;
}
async function connectedGuest() {
  const fixture = setup("guest"); await fixture.session.acceptOffer(signal("offer"));
  fixture.peer.incoming(); fixture.peer.connect(); return fixture;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { for (const session of sessions.splice(0)) session.dispose(); vi.useRealTimers(); });

describe("player-hosted session lifecycle and wire authority", () => {
  it("cancels pending ICE and prevents an old session publishing after reset", async () => {
    const old = setup("host"); old.peer.iceGatheringState = "gathering";
    const pending = old.session.startHost(); await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    const before = old.updates.length; old.session.dispose();
    const fresh = await connectedHost();
    old.peer.iceGatheringState = "complete";
    old.peer.dispatchEvent(new Event("icegatheringstatechange"));
    await pending;
    expect(old.updates).toHaveLength(before);
    expect(old.peer.connectionState).toBe("closed");
    expect(old.peer.channel.readyState).toBe("closed");
    expect(old.peer.onconnectionstatechange).toBeNull();
    expect(old.peer.channel.onmessage).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(fresh.view()).toMatchObject({ connected: true, localSignal: "", state: initialLabState() });
  });

  it("ends an ICE timeout without leaving live peers or timers", async () => {
    const fixture = setup("host"); fixture.peer.iceGatheringState = "gathering";
    const pending = fixture.session.startHost(); await vi.advanceTimersByTimeAsync(15_000); await pending;
    expect(fixture.view()).toMatchObject({ ended: true, working: false, connected: false, localSignal: "" });
    expect(fixture.peer.connectionState).toBe("closed"); expect(vi.getTimerCount()).toBe(0);
  });

  it("allows correcting malformed JSON before creating a peer, and disposes rejected SDP", async () => {
    const fixture = setup("guest"); await fixture.session.acceptOffer("{");
    expect(fixture.peer.setRemoteDescription).not.toHaveBeenCalled();
    expect(fixture.view()).toMatchObject({ working: false, ended: false });
    fixture.peer.rejectRemote = true; await fixture.session.acceptOffer(signal("offer"));
    expect(fixture.view()).toMatchObject({ ended: true, connected: false, localSignal: "" });
    expect(fixture.peer.connectionState).toBe("closed");
    const fresh = await connectedGuest(); expect(fresh.view().connected).toBe(true);
  });

  it("ignores concurrent setup and duplicate answer application", async () => {
    const fixture = setup("host");
    await Promise.all([fixture.session.startHost(), fixture.session.startHost()]);
    expect(fixture.peer.createOffer).toHaveBeenCalledTimes(1);
    await Promise.all([fixture.session.acceptAnswer(signal("answer")), fixture.session.acceptAnswer(signal("answer"))]);
    await fixture.session.acceptAnswer(signal("answer"));
    expect(fixture.peer.setRemoteDescription).toHaveBeenCalledTimes(1);
  });

  it("closes a pairing that never opens its DataChannel", async () => {
    const fixture = setup("host"); await fixture.session.startHost();
    await fixture.session.acceptAnswer(signal("answer")); await vi.advanceTimersByTimeAsync(15_000);
    expect(fixture.view().ended).toBe(false); // manual exchange is not limited to fifteen seconds
    await vi.advanceTimersByTimeAsync(105_000);
    expect(fixture.view()).toMatchObject({ ended: true, connected: false, working: false });
    expect(fixture.peer.channel.readyState).toBe("closed"); expect(vi.getTimerCount()).toBe(0);
  });

  it("accepts one buzz winner and one host award; a new round rejects previous intents", async () => {
    const { session, peer, view } = await connectedHost(); session.hostAction("open");
    for (const data of ["{", new ArrayBuffer(4), "x".repeat(129), JSON.stringify({ type: "OPEN_ROUND", round: 1 }),
      JSON.stringify({ type: "SCORE", round: 1 }), JSON.stringify({ type: "BUZZ", round: 1, scores: [99, 0] })]) peer.channel.message(data);
    expect(view().state).toMatchObject({ phase: "open", scores: [0, 0] });
    peer.channel.message(JSON.stringify({ type: "BUZZ", round: 1 })); session.hostAction("buzz");
    peer.channel.message(JSON.stringify({ type: "BUZZ", round: 1 }));
    expect(view().state).toMatchObject({ phase: "locked", winner: 1, version: 2 });
    session.hostAction("award"); session.hostAction("award");
    expect(view().state).toMatchObject({ scores: [0, 1], version: 3 });
    session.hostAction("open"); peer.channel.message(JSON.stringify({ type: "BUZZ", round: 1 }));
    expect(view().state).toMatchObject({ round: 2, phase: "open", winner: null, scores: [0, 1] });
    session.hostAction("buzz"); session.hostAction("award");
    expect(view().state).toMatchObject({ round: 2, phase: "result", scores: [1, 1], version: 6 });
  });

  it("does not allow guest controller host actions or a second local buzz for a round", async () => {
    const { session, peer, view } = await connectedGuest();
    session.hostAction("open"); session.hostAction("award"); expect(peer.channel.sent).toEqual([]);
    peer.channel.message(JSON.stringify(openRound(initialLabState())));
    session.guestBuzz(); session.guestBuzz();
    expect(peer.channel.sent).toEqual([JSON.stringify({ type: "BUZZ", round: 1 })]);
    expect(view().state.scores).toEqual([0, 0]);
  });

  it("ignores equal-version replacement, older snapshots, malformed state and score rollback", async () => {
    const { peer, view } = await connectedGuest();
    const result = awardPoint(buzz(openRound(initialLabState()), 0, 1));
    peer.channel.message(JSON.stringify(initialLabState())); peer.channel.message(JSON.stringify(result));
    peer.channel.message(JSON.stringify({ ...result, scores: [0, 1] }));
    peer.channel.message(JSON.stringify(openRound(initialLabState())));
    peer.channel.message(JSON.stringify({ ...result, phase: ["result"] }));
    expect(view().state).toEqual(result);
    const round2 = openRound(result); peer.channel.message(JSON.stringify(round2));
    const rollback = awardPoint(buzz(openRound(awardPoint(buzz(openRound(initialLabState()), 1, 1))), 1, 2));
    peer.channel.message(JSON.stringify(rollback)); expect(view().state).toEqual(round2);
  });

  it("rejects additional/incorrect/unordered channels", async () => {
    const host = await connectedHost(); const extra = new Channel(); host.peer.incoming(extra);
    expect(extra.readyState).toBe("closed");
    const guest = setup("guest"); await guest.session.acceptOffer(signal("offer"));
    const bad = new Channel(); bad.ordered = false; guest.peer.incoming(bad); expect(bad.readyState).toBe("closed");
    guest.peer.incoming(); const duplicate = new Channel(); guest.peer.incoming(duplicate);
    expect(duplicate.readyState).toBe("closed");
  });

  it("ends disconnected sessions and ignores saved late callbacks and host actions", async () => {
    const { session, peer, view } = await connectedHost(); session.hostAction("open");
    const late = peer.channel.onmessage!; peer.disconnect();
    late({ data: JSON.stringify({ type: "BUZZ", round: 1 }) }); session.hostAction("buzz"); session.hostAction("award");
    expect(view()).toMatchObject({ ended: true, connected: false, state: { phase: "open", winner: null, scores: [0, 0] } });
    expect(peer.channel.readyState).toBe("closed"); expect(peer.channel.onmessage).toBeNull();
  });

  it("contains send failures and clears connection metadata on close", async () => {
    const { session, peer, view } = await connectedHost(); peer.channel.failSend = true;
    expect(() => session.hostAction("open")).not.toThrow();
    expect(view()).toMatchObject({ ended: true, connected: false, working: false, localSignal: "" });
    expect(peer.connectionState).toBe("closed"); expect(vi.getTimerCount()).toBe(0);
  });
});
