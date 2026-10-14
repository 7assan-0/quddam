import { describe, expect, it } from "vitest";
import { BODY_LIMIT, LEASE, ROOM_TTL, SignalingStore, signalingRequest, type Credentials } from "./signaling";
import { MAX_GUESTS } from "./protocol";
const offer = { type: "offer" as const, sdp: "v=0\r\n" + "a".repeat(30) };
const answer = { ...offer, type: "answer" as const };
const auth = (c: Credentials) => ({ code: c.code, token: c.token, epoch: c.epoch });
function setup() {
  let now = 1_000;
  const store = new SignalingStore(() => now);
  const host = store.execute({ op: "create" }).credentials!;
  const guest = store.execute({ op: "join", code: host.code }).credentials!;
  return { store, host, guest, tick: (ms: number) => { now += ms; } };
}
describe("ephemeral room signaling authorization and limits", () => {
  it("uses 128-bit invites, separate 256-bit capabilities and a fixed eight-guest bound", () => {
    const { store, host, guest } = setup();
    expect(host.code).toMatch(/^[A-F0-9]{32}$/); expect(host.token).toHaveLength(43);
    expect(guest.token).not.toBe(host.token); expect(guest).toMatchObject({ role: "guest", slot: 1 });
    const additional = Array.from({ length: MAX_GUESTS - 1 },
      () => store.execute({ op: "join", code: host.code }).credentials!);
    expect(additional.map(g => g.slot)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(new Set([guest.token, ...additional.map(g => g.token)]).size).toBe(MAX_GUESTS);
    expect(() => store.execute({ op: "join", code: host.code })).toThrow("مكتملة");
    const last = additional.at(-1)!;
    expect(store.execute({ op: "poll", ...auth(last) }).peers![0].slot).toBe(8);
    expect(() => store.execute({ op: "signal", ...auth(guest), peer: 8, generation: 1, description: answer })).toThrow("مصرح");
    expect(() => store.execute({ op: "poll", code: host.code, token: "x".repeat(43), epoch: 1 })).toThrow("مصرح");
  });
  it("routes only host offers to the intended guest and guest answers to the host", () => {
    const { store, host, guest } = setup();
    const other = store.execute({ op: "join", code: host.code }).credentials!;
    store.execute({ op: "signal", ...auth(host), peer: 1, generation: 1, description: offer });
    expect(store.execute({ op: "poll", ...auth(guest) }).peers![0].description).toEqual(offer);
    expect(store.execute({ op: "poll", ...auth(other) }).peers![0].description).toBeUndefined();
    expect(() => store.execute({ op: "signal", ...auth(guest), peer: 2, generation: 1, description: answer })).toThrow("مصرح");
    expect(() => store.execute({ op: "signal", ...auth(guest), peer: 1, generation: 1, description: offer })).toThrow("اتجاه");
    expect(() => store.execute({ op: "signal", ...auth(host), peer: 1, generation: 1, description: answer })).toThrow("اتجاه");
    store.execute({ op: "signal", ...auth(guest), peer: 1, generation: 1, description: answer });
    expect(store.execute({ op: "poll", ...auth(host) }).peers![0].description).toEqual(answer);
    expect(JSON.stringify(store.execute({ op: "poll", ...auth(host) }))).not.toContain(guest.token);
    store.execute({ op: "connected", ...auth(host), peer: 1, generation: 1 });
    expect(store.execute({ op: "poll", ...auth(guest) }).peers![0].description).toBeUndefined();
    expect(store.execute({ op: "poll", ...auth(host) }).peers![0].description).toBeUndefined();
  });
  it("is idempotent for identical SDP, rejects replacement, replay and stale generations", () => {
    const { store, host, guest } = setup();
    const send = { op: "signal", ...auth(host), peer: 1, generation: 1, description: offer };
    store.execute(send); expect(() => store.execute(send)).not.toThrow();
    expect(() => store.execute({ ...send, description: { ...offer, sdp: offer.sdp + "z" } })).toThrow("استبدال");
    store.execute({ op: "retry", ...auth(guest) });
    expect(() => store.execute(send)).toThrow("قديمة");
    expect(store.execute({ op: "poll", ...auth(guest), epoch: 2 }).peers![0]).toMatchObject({ generation: 2 });
  });
  it("refresh/resume retains guest identity, scores slot and guest-only authority", () => {
    const { store, host, guest } = setup();
    store.execute({ op: "leave", ...auth(guest) });
    expect(store.execute({ op: "poll", ...auth(host) }).peers![0].active).toBe(false);
    const resumed = store.execute({ op: "resume", ...auth(guest) }).credentials!;
    expect(resumed).toEqual({ ...guest, epoch: 2 });
    // A delayed pagehide/keepalive from the old document cannot disconnect a resumed guest.
    expect(() => store.execute({ op: "leave", ...auth(guest) })).toThrow("قديمة");
    expect(() => store.execute({ op: "resume", ...auth(guest) })).toThrow("قديمة");
    expect(store.execute({ op: "poll", ...auth(resumed) }).peers![0].active).toBe(true);
    expect(() => store.execute({ op: "resume", ...auth(host) })).toThrow("للضيف");
    expect(() => store.execute({ op: "connected", ...auth(resumed), peer: 1, generation: 2 })).toThrow("الهوست");
    store.execute({ op: "leave", ...auth(resumed) });
    expect(() => store.execute({ op: "poll", ...auth(host) })).not.toThrow();
    store.execute({ op: "leave", ...auth(host) });
    expect(() => store.execute({ op: "poll", ...auth(guest) })).toThrow("انتهت");
  });
  it("expires abandoned hosts, guests and absolute sessions; never migrates ownership", () => {
    const a = setup(); a.tick(LEASE + 1);
    expect(() => a.store.execute({ op: "poll", ...auth(a.guest) })).toThrow("انتهت");
    const b = setup(); b.tick(30_000); b.store.execute({ op: "poll", ...auth(b.host) }); b.tick(20_000);
    expect(b.store.execute({ op: "poll", ...auth(b.host) }).peers![0].active).toBe(false);
    const c = setup(); c.tick(ROOM_TTL);
    expect(ROOM_TTL).toBe(60 * 60_000);
    expect(() => c.store.execute({ op: "poll", ...auth(c.host) })).toThrow("انتهت");
    const d = setup();
    // Keep the host lease alive without extending the absolute one-hour deadline.
    for (let minute = 0; minute < 119; minute++) {
      d.tick(30_000);
      d.store.execute({ op: "poll", ...auth(d.host) });
    }
    d.tick(29_999);
    expect(() => d.store.execute({ op: "poll", ...auth(d.host) })).not.toThrow();
    d.tick(1);
    expect(() => d.store.execute({ op: "poll", ...auth(d.host) })).toThrow("انتهت");
  });
  it("bounds retry attempts and rejects malformed, extraneous and oversized fields", () => {
    const { store, host, guest } = setup();
    let current = guest;
    for (let i = 0; i < 3; i++) current = store.execute({ op: "retry", ...auth(current) }).credentials!;
    expect(() => store.execute({ op: "retry", ...auth(current) })).toThrow("محاولات");
    for (const input of [{ op: "create", role: "host" }, { op: "join", code: "123456" },
      { op: "signal", ...auth(host), peer: 1, generation: 4, description: { ...offer, sdp: "x".repeat(95_001) } },
      { op: "AWARD", ...auth(guest) }]) expect(() => store.execute(input)).toThrow("صالح");
  });
  it("rate limits creation, per-capability polling and signaling", () => {
    const a = setup();
    for (let i = 0; i < 180; i++) a.store.execute({ op: "poll", ...auth(a.guest) });
    expect(() => a.store.execute({ op: "poll", ...auth(a.guest) })).toThrow("كثيرة");
    a.tick(60_000); // The host lease also expires, so old credentials cannot extend the room.
    expect(() => a.store.execute({ op: "poll", ...auth(a.guest) })).toThrow("انتهت");
    const b = setup();
    for (let i = 0; i < 11; i++) b.store.execute({ op: "create" });
    expect(() => b.store.execute({ op: "create" })).toThrow("كثيرة");
    const c = setup(), send = { op: "signal", ...auth(c.host), peer: 1, generation: 1, description: offer };
    for (let i = 0; i < 96; i++) c.store.execute(send);
    expect(() => c.store.execute(send)).toThrow("كثيرة");
  });
  it("allows bounded host offers/acks for eight guests, including allowed reconnect generations", () => {
    const { store, host, guest } = setup();
    const peers = [guest, ...Array.from({ length: MAX_GUESTS - 1 },
      () => store.execute({ op: "join", code: host.code }).credentials!)];
    for (let generation = 1; generation <= 4; generation++) {
      for (let index = 0; index < peers.length; index++) {
        const current = peers[index];
        const peer = current.slot;
        store.execute({ op: "signal", ...auth(host), peer, generation, description: offer });
        store.execute({ op: "signal", ...auth(current), peer, generation, description: answer });
        store.execute({ op: "connected", ...auth(host), peer, generation });
        if (generation !== 4) peers[index] = store.execute({ op: "retry", ...auth(current) }).credentials!;
      }
    }
    expect(store.execute({ op: "poll", ...auth(host) }).peers).toHaveLength(MAX_GUESTS);
  });
  it("bounds retained rooms and periodically clears expired capabilities and SDP", () => {
    let now = 0;
    const store = new SignalingStore(() => now), hosts: Credentials[] = [];
    for (let i = 0; i < 12; i++) hosts.push(store.execute({ op: "create" }).credentials!);
    for (let step = 0; step < 2; step++) {
      now += 30_000;
      for (const host of hosts) store.execute({ op: "poll", ...auth(host) });
    }
    for (let i = 0; i < 4; i++) hosts.push(store.execute({ op: "create" }).credentials!);
    expect(() => store.execute({ op: "create" })).toThrow("الأقصى للغرف");
    now += LEASE + 1; store.expire();
    expect(() => store.execute({ op: "poll", ...auth(hosts[0]) })).toThrow("انتهت");
  });
});

const origin = "http://localhost:3000";
function request(body: unknown, changes: Record<string, string> = {}) {
  return new Request(origin + "/api/labs/player-hosted-rooms", { method: "POST",
    headers: { origin, host: "localhost:3000", "content-type": "application/json", ...changes }, body: JSON.stringify(body) });
}
describe("HTTP signaling boundary", () => {
  it("is disabled by default, rejects external deployment origins and enforces exact same origin", async () => {
    const store = new SignalingStore();
    expect((await signalingRequest(request({ op: "create" }), store)).status).toBe(404);
    expect((await signalingRequest(request({ op: "create" }), store, "https://example.com")).status).toBe(404);
    const variants: Record<string, string>[] = [{ origin: "https://evil.test" }, { origin: "" }, { host: "evil.test" }, { "content-type": "text/plain" }];
    for (const changes of variants)
      expect((await signalingRequest(request({ op: "create" }, changes), store, origin)).status).toBe(403);
    const response = await signalingRequest(request({ op: "create" }), store, origin);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
  });
  it("enforces actual streamed bytes as well as declared length, JSON and strict body schemas", async () => {
    const store = new SignalingStore();
    expect((await signalingRequest(request({ op: "create" }, { "content-length": String(BODY_LIMIT + 1) }), store, origin)).status).toBe(413);
    expect((await signalingRequest(request("x".repeat(BODY_LIMIT)), store, origin)).status).toBe(413);
    expect((await signalingRequest(request({ op: "create", token: "no" }), store, origin)).status).toBe(400);
    const bad = new Request(origin + "/api/labs/player-hosted-rooms", { method: "POST",
      headers: { origin, host: "localhost:3000", "content-type": "application/json" }, body: "{" });
    expect((await signalingRequest(bad, store, origin)).status).toBe(400);
  });
});
