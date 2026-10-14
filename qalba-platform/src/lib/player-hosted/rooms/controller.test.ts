import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomController, type RoomView } from "./controller";
import { ApiError, readGuest, rememberGuest, type SignalingClient } from "./client";
import { SignalingStore, type Credentials, type SignalReply } from "./signaling";
import { acceptBuzz, CHANNEL, hostAction, initialState } from "./protocol";

// Lifecycle doubles only. Native Chrome acceptance is recorded separately.
class Channel {
  label = CHANNEL; ordered = true; maxRetransmits = null; maxPacketLifeTime = null;
  readyState = "connecting"; bufferedAmount = 0; sent: string[] = [];
  onopen: (() => void) | null = null; onclose: (() => void) | null = null;
  onerror: (() => void) | null = null; onmessage: ((event: { data: unknown }) => void) | null = null;
  send(raw: string) { this.sent.push(raw); }
  close() { this.readyState = "closed"; this.onclose?.(); }
  open() { this.readyState = "open"; this.onopen?.(); }
  message(data: unknown) { this.onmessage?.({ data }); }
  rtc() { return this as unknown as RTCDataChannel; }
}
class Peer extends EventTarget {
  connectionState = "new"; iceGatheringState = "complete";
  localDescription: RTCSessionDescriptionInit | null = null;
  channel = new Channel(); reject = false;
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((event: { channel: RTCDataChannel }) => void) | null = null;
  createOffer = vi.fn(async () => ({ type: "offer" as const, sdp: "v=0\r\n" + "a".repeat(30) }));
  createAnswer = vi.fn(async () => ({ type: "answer" as const, sdp: "v=0\r\n" + "b".repeat(30) }));
  createDataChannel = vi.fn(() => this.channel.rtc());
  setLocalDescription = vi.fn(async (value: RTCSessionDescriptionInit) => { this.localDescription = value; });
  setRemoteDescription = vi.fn(async (value: RTCSessionDescriptionInit) => { if (this.reject || !value.sdp) throw new Error("bad SDP"); });
  close() { this.connectionState = "closed"; this.dispatchEvent(new Event("connectionstatechange")); this.onconnectionstatechange?.(); }
  connect() { this.connectionState = "connected"; this.channel.open(); }
  disconnect() { this.connectionState = "disconnected"; this.onconnectionstatechange?.(); }
  incoming(channel = this.channel) { this.ondatachannel?.({ channel: channel.rtc() }); }
  rtc() { return this as unknown as RTCPeerConnection; }
}
const sessions: RoomController[] = [];
function setup(api?: SignalingClient, firstPeer?: Peer) {
  const store = new SignalingStore(), peers: Peer[] = [], views: RoomView[] = [];
  const client: SignalingClient = api ?? (async input => store.execute(input));
  const controller = new RoomController(view => views.push(view), client, () => {
    const peer = peers.length === 0 && firstPeer ? firstPeer : new Peer(); peers.push(peer); return peer.rtc();
  });
  sessions.push(controller);
  return { store, controller, peers, views, view: () => views.at(-1)! };
}
const auth = (credentials: Credentials) => ({ code: credentials.code, token: credentials.token, epoch: credentials.epoch });
async function hostFixture(count = 2) {
  const f = setup(), host = (await f.controller.start("host"))!;
  const guests = Array.from({ length: count }, () => f.store.execute({ op: "join", code: host.code }).credentials!);
  await vi.advanceTimersByTimeAsync(1_000);
  for (const peer of f.peers) peer.connect();
  await vi.advanceTimersByTimeAsync(0);
  return { ...f, host, guests };
}
async function guestFixture() {
  const f = setup(), host = f.store.execute({ op: "create" }).credentials!;
  const guest = (await f.controller.start("guest", host.code))!;
  f.store.execute({ op: "signal", ...auth(host), peer: 1, generation: 1,
    description: { type: "offer", sdp: "v=0\r\n" + "a".repeat(30) } });
  await vi.advanceTimersByTimeAsync(1_000); f.peers[0].incoming(); f.peers[0].connect();
  return { ...f, host, guest, peer: f.peers[0] };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { for (const controller of sessions.splice(0)) controller.dispose(); vi.useRealTimers(); });

describe("automatic room lifecycle, authority and multi-guest isolation", () => {
  it("automatically offers to multiple guests and binds buzz identity to its channel", async () => {
    const f = await hostFixture();
    expect(f.peers).toHaveLength(2); expect(f.view().players.filter(p => p.connected)).toHaveLength(2);
    f.controller.action("open");
    f.peers[1].channel.message(JSON.stringify({ type: "BUZZ", round: 1 }));
    f.peers[0].channel.message(JSON.stringify({ type: "BUZZ", round: 1 })); f.controller.action("buzz");
    expect(f.view().state.winner).toBe(2);
    f.controller.action("award"); f.controller.action("award");
    expect(f.view().state.scores).toEqual([0, 0, 1, 0]);
    expect(JSON.parse(f.peers[0].channel.sent.at(-1)!).scores).toEqual([0, 0, 1, 0]);
    f.controller.action("open"); f.peers[0].channel.message(JSON.stringify({ type: "BUZZ", round: 1 }));
    expect(f.view().state).toMatchObject({ round: 2, phase: "open", winner: null, version: 4 });
  });
  it("rejects score/host/identity injection and isolates one disconnected guest", async () => {
    const f = await hostFixture(); f.controller.action("open");
    for (const raw of [{ type: "AWARD" }, { type: "OPEN" }, { type: "BUZZ", round: 1, slot: 0 }, { scores: [9, 9, 9, 9] }])
      f.peers[0].channel.message(JSON.stringify(raw));
    expect(f.view().state.phase).toBe("open");
    const late = f.peers[0].channel.onmessage!; f.peers[0].disconnect();
    late({ data: JSON.stringify({ type: "BUZZ", round: 1 }) });
    expect(f.view().phase).toBe("connected"); expect(f.peers[1].connectionState).toBe("connected");
    f.peers[1].channel.message(JSON.stringify({ type: "BUZZ", round: 1 })); expect(f.view().state.winner).toBe(2);
  });
  it("never lets guest APIs execute host actions; deduplicates buzz and state versions", async () => {
    const f = await guestFixture();
    f.controller.action("open"); f.controller.action("award"); expect(f.peer.channel.sent).toEqual([]);
    const open = hostAction(initialState(), "open");
    f.peer.channel.message(JSON.stringify(open)); f.controller.buzz(); f.controller.buzz();
    expect(f.peer.channel.sent).toEqual([JSON.stringify({ type: "BUZZ", round: 1 })]);
    const result = hostAction(acceptBuzz(open, 2, 1), "award"); f.peer.channel.message(JSON.stringify(result));
    f.peer.channel.message(JSON.stringify({ ...result, scores: [1, 0, 0, 0] }));
    f.peer.channel.message(JSON.stringify(open)); expect(f.view().state).toEqual(result);
  });
  it("activates once when channel-open arrives before peer-connected", async () => {
    const f = setup(), host = (await f.controller.start("host"))!;
    f.store.execute({ op: "join", code: host.code }); await vi.advanceTimersByTimeAsync(1_000);
    const peer = f.peers[0]; peer.channel.open(); expect(f.view().phase).toBe("connecting");
    peer.connectionState = "connected"; peer.onconnectionstatechange?.();
    expect(f.view().phase).toBe("connected"); expect(peer.channel.sent).toHaveLength(1);
    peer.onconnectionstatechange?.(); expect(peer.channel.sent).toHaveLength(1);
  });
  it("allows a bounded explicit guest retry with a new generation and no host promotion", async () => {
    const f = await guestFixture(); f.peer.disconnect(); expect(f.view().phase).toBe("failed");
    await f.controller.retry();
    const next = f.store.execute({ op: "poll", ...auth(f.host) }).peers![0];
    expect(next.generation).toBe(2); expect(f.view().role).toBe("guest"); expect(f.view().retries).toBe(1);
    f.store.execute({ op: "signal", ...auth(f.host), peer: 1, generation: 2,
      description: { type: "offer", sdp: "v=0\r\n" + "c".repeat(30) } });
    await vi.advanceTimersByTimeAsync(1_000); expect(f.peers).toHaveLength(2);
    f.peers[1].incoming(); f.peers[1].connect(); expect(f.view().phase).toBe("connected");
    expect(f.peer.channel.onmessage).toBeNull(); expect(f.peer.connectionState).toBe("closed");
  });
  it("resumes as a guest with the server retry budget and accepts a pre-connected snapshot", async () => {
    const f = await guestFixture(); f.controller.close();
    const g = setup(async input => f.store.execute(input));
    await g.controller.start("guest", f.host.code, f.guest);
    expect(g.view()).toMatchObject({ role: "guest", slot: 1, retries: 1 });
    f.store.execute({ op: "signal", ...auth(f.host), peer: 1, generation: 2,
      description: { type: "offer", sdp: "v=0\r\n" + "c".repeat(30) } });
    await vi.advanceTimersByTimeAsync(1_000);
    const peer = g.peers[0]; peer.incoming(); peer.channel.open();
    peer.channel.message(JSON.stringify(hostAction(initialState(), "open")));
    expect(g.view()).toMatchObject({ phase: "connecting", state: { round: 1, phase: "open" } });
    peer.connectionState = "connected"; peer.onconnectionstatechange?.();
    expect(g.view()).toMatchObject({ phase: "connected", state: { round: 1, phase: "open" } });
  });
  it("closes on host departure, disposes timers/handlers and ignores late messages", async () => {
    const f = await guestFixture(), late = f.peer.channel.onmessage!;
    f.store.execute({ op: "leave", ...auth(f.host) });
    // HTTP client converts store errors to typed transport failures.
    await vi.advanceTimersByTimeAsync(6_000);
    expect(f.view().phase).toBe("closed");
    const count = f.views.length; late({ data: JSON.stringify(hostAction(initialState(), "open")) });
    expect(f.views).toHaveLength(count); expect(f.peer.connectionState).toBe("closed"); expect(vi.getTimerCount()).toBe(0);
  });
  it("cleans up ICE waits on reset and cleans a late-created server room", async () => {
    const peer = new Peer(); peer.iceGatheringState = "gathering";
    const f = setup(undefined, peer), host = (await f.controller.start("host"))!;
    f.store.execute({ op: "join", code: host.code }); await vi.advanceTimersByTimeAsync(1_000);
    f.controller.dispose(); const count = f.views.length;
    peer.iceGatheringState = "complete"; peer.dispatchEvent(new Event("icegatheringstatechange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.views).toHaveLength(count); expect(peer.connectionState).toBe("closed"); expect(vi.getTimerCount()).toBe(0);
    let resolve!: (value: SignalReply) => void;
    const calls: string[] = [], credentials = host;
    const delayed: SignalingClient = input => {
      calls.push(input.op); return input.op === "create" ? new Promise(done => { resolve = done; }) : Promise.resolve({});
    };
    const g = setup(delayed); const pending = g.controller.start("host"); g.controller.dispose();
    resolve({ credentials }); await pending; expect(calls).toEqual(["create", "leave"]);
  });
  it("terminates after three signaling errors without an unbounded retry loop", async () => {
    let polls = 0;
    const store = new SignalingStore();
    const f = setup(async input => {
      if (input.op === "poll") { polls++; throw new ApiError(503, "Unavailable"); }
      return store.execute(input);
    });
    await f.controller.start("host"); await vi.advanceTimersByTimeAsync(10_000);
    expect(polls).toBe(3); expect(f.view().phase).toBe("closed"); expect(vi.getTimerCount()).toBe(0);
  });
  it("fails ICE timeouts, rejects extra channels and closes flooding/backpressured guests", async () => {
    const f = await hostFixture();
    const extra = new Channel(); f.peers[0].incoming(extra); expect(extra.readyState).toBe("closed");
    f.peers[0].channel.bufferedAmount = 65_537; f.controller.action("open");
    expect(f.peers[0].connectionState).toBe("closed"); expect(f.peers[1].connectionState).toBe("connected");
    for (let i = 0; i < 31; i++) f.peers[1].channel.message("{}");
    expect(f.peers[1].connectionState).toBe("closed");
    const slow = new Peer(); slow.iceGatheringState = "gathering";
    const g = setup(undefined, slow), host = (await g.controller.start("host"))!;
    g.store.execute({ op: "join", code: host.code }); await vi.advanceTimersByTimeAsync(17_000);
    expect(slow.connectionState).toBe("closed");
  });
  it("persists only guest capabilities and refuses injected host credentials on refresh", async () => {
    const f = await guestFixture(), entries = new Map<string, string>();
    const storage = { getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); } };
    rememberGuest(storage, f.host); expect(entries.size).toBe(0);
    rememberGuest(storage, f.guest); expect(readGuest(storage, f.guest.code)).toEqual(f.guest);
    entries.set([...entries.keys()][0], JSON.stringify(f.host)); expect(readGuest(storage, f.host.code)).toBeUndefined();
  });
});
