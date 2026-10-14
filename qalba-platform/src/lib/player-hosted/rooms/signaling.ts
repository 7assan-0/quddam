import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const ROOM_TTL = 30 * 60_000;
export const LEASE = 45_000;
export const MAX_RETRIES = 3;
export const MAX_ROOMS = 16;
export const BODY_LIMIT = 100_000;
const codeSchema = z.string().regex(/^[A-F0-9]{32}$/);
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const peerSchema = z.number().int().min(1).max(3);
const description = z.object({ type: z.enum(["offer", "answer"]),
  sdp: z.string().min(20).max(95_000).startsWith("v=0\r\n") }).strict();
const auth = { code: codeSchema, token: tokenSchema, epoch: z.number().int().min(0).max(4) };
const inputSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create") }).strict(),
  z.object({ op: z.literal("join"), code: codeSchema }).strict(),
  z.object({ op: z.literal("poll"), ...auth }).strict(),
  z.object({ op: z.literal("leave"), ...auth }).strict(),
  z.object({ op: z.literal("retry"), ...auth }).strict(),
  z.object({ op: z.literal("resume"), ...auth }).strict(),
  z.object({ op: z.literal("signal"), ...auth, peer: peerSchema,
    generation: z.number().int().min(1).max(4), description }).strict(),
  z.object({ op: z.literal("connected"), ...auth, peer: peerSchema,
    generation: z.number().int().min(1).max(4) }).strict(),
]);
export type SignalInput = z.infer<typeof inputSchema>;
export type Credentials = { code: string; token: string; role: "host" | "guest"; slot: number; expires: number; epoch: number };
export type SignalPeer = { slot: number; active: boolean; generation: number;
  description?: { type: "offer" | "answer"; sdp: string } };
export type SignalReply = { credentials?: Credentials; peers?: SignalPeer[] };
type Guest = { token: string; slot: number; generation: number; seen: number; active: boolean;
  offer?: SignalPeer["description"]; answer?: SignalPeer["description"]; connected: boolean };
type Room = { code: string; token: string; expires: number; seen: number; guests: Guest[] };
export class SignalError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
function fail(status: number, message: string): never { throw new SignalError(status, message); }
function equal(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Bounded, single-process, ephemeral rendezvous. Never handles game actions or scores. */
export class SignalingStore {
  private rooms = new Map<string, Room>();
  private rates = new Map<string, { start: number; count: number }>();
  constructor(private now: () => number = Date.now) {}
  private sweep() {
    const now = this.now();
    for (const [code, room] of this.rooms) {
      if (now >= room.expires || now - room.seen > LEASE) this.rooms.delete(code);
      else for (const guest of room.guests) if (now - guest.seen > LEASE) {
        guest.active = false; guest.offer = guest.answer = undefined;
      }
    }
    for (const [key, rate] of this.rates) if (now - rate.start >= 60_000) this.rates.delete(key);
  }
  private limit(key: string, max: number) {
    let rate = this.rates.get(key);
    if (!rate) {
      if (this.rates.size >= 256) fail(429, "الخدمة مشغولة؛ حاول لاحقًا.");
      rate = { start: this.now(), count: 0 }; this.rates.set(key, rate);
    }
    if (++rate.count > max) fail(429, "طلبات كثيرة؛ انتظر دقيقة ثم أعد المحاولة.");
  }
  expire() { this.sweep(); }
  execute(raw: unknown): SignalReply {
    this.sweep(); this.limit("all", 900);
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success) fail(400, "طلب غير صالح.");
    const input = parsed.data, now = this.now();
    if (input.op === "create") {
      this.limit("create", 12);
      if (this.rooms.size >= MAX_ROOMS) fail(429, "بلغ المختبر الحد الأقصى للغرف.");
      const room: Room = { code: randomBytes(16).toString("hex").toUpperCase(),
        token: randomBytes(32).toString("base64url"), expires: now + ROOM_TTL, seen: now, guests: [] };
      this.rooms.set(room.code, room);
      return { credentials: { code: room.code, token: room.token, role: "host", slot: 0, expires: room.expires, epoch: 0 } };
    }
    if (input.op === "join") this.limit("join", 60);
    const room = this.rooms.get(input.code);
    if (!room) fail(410, "الغرفة غير متاحة أو انتهت. اطلب رابطًا جديدًا من الهوست.");
    if (input.op === "join") {
      if (room.guests.length >= 3) fail(409, "الغرفة مكتملة: هوست وثلاثة ضيوف كحد أقصى.");
      const guest: Guest = { token: randomBytes(32).toString("base64url"), slot: room.guests.length + 1,
        generation: 1, seen: now, active: true, connected: false };
      room.guests.push(guest);
      return { credentials: { code: room.code, token: guest.token, role: "guest", slot: guest.slot, expires: room.expires, epoch: guest.generation } };
    }
    const host = equal(input.token, room.token);
    const guest = host ? undefined : room.guests.find(g => equal(input.token, g.token));
    if (!host && !guest) fail(403, "غير مصرح لهذه الجلسة.");
    if (input.epoch !== (host ? 0 : guest!.generation)) fail(409, "جلسة اتصال قديمة؛ لا يمكنها التأثير في المحاولة الجديدة.");
    this.limit(`${room.code}:${host ? 0 : guest!.slot}`, 180);
    if (input.op === "leave") {
      if (host) this.rooms.delete(room.code);
      else { guest!.active = false; guest!.offer = guest!.answer = undefined; }
      return {};
    }
    if (input.op === "retry" || input.op === "resume") {
      if (host) fail(403, "إعادة الربط مخصصة للضيف؛ لا انتقال لصلاحيات الهوست.");
      if (guest!.generation >= MAX_RETRIES + 1) fail(409, "انتهت محاولات الربط. اطلب غرفة جديدة.");
      guest!.generation++; guest!.seen = now; guest!.active = true;
      guest!.connected = false; guest!.offer = guest!.answer = undefined;
      return { credentials: { code: room.code, token: guest!.token, role: "guest", slot: guest!.slot, expires: room.expires, epoch: guest!.generation } };
    }
    if (host) room.seen = now;
    else if (guest!.active) guest!.seen = now;
    else fail(409, "انقطع الاتصال؛ اختر إعادة الاتصال.");
    if (input.op === "poll") {
      return { peers: host ? room.guests.map(g => ({ slot: g.slot, active: g.active,
        generation: g.generation, ...(g.answer ? { description: g.answer } : {}) })) :
        [{ slot: guest!.slot, active: guest!.active, generation: guest!.generation,
          ...(guest!.offer ? { description: guest!.offer } : {}) }] };
    }
    this.limit(`${room.code}:${host ? 0 : guest!.slot}:signal`, 24);
    const target = host ? room.guests.find(g => g.slot === input.peer) : guest;
    if (!target || (!host && input.peer !== guest!.slot)) fail(403, "وجهة غير مصرح بها.");
    if (!target.active || target.generation !== input.generation) fail(409, "محاولة اتصال قديمة.");
    if (input.op === "connected") {
      if (!host) fail(403, "لا يثبت الربط إلا الهوست.");
      target.connected = true; target.offer = target.answer = undefined; return {};
    }
    if (target.connected) fail(409, "انتهى تبادل رسائل الربط لهذه المحاولة.");
    const expected = host ? "offer" : "answer";
    if (input.description.type !== expected || (!host && !target.offer)) fail(403, "اتجاه رسالة غير مصرح به.");
    const previous = host ? target.offer : target.answer;
    if (previous && previous.sdp !== input.description.sdp) fail(409, "لا يمكن استبدال رسالة المحاولة الحالية.");
    if (host) target.offer = input.description; else target.answer = input.description;
    return {};
  }
}

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
/** No CORS, cookies, query credentials, public listener, or persistent room storage. */
export async function signalingRequest(request: Request, store: SignalingStore, configuredOrigin?: string) {
  const reply = (status: number, body: unknown) => Response.json(body, { status, headers });
  if (!configuredOrigin) return reply(404, { error: "غير متاح." });
  // The Phase 2 server is deliberately loopback-only, even if a flag is set on a deployed site.
  let origin: URL;
  try { origin = new URL(configuredOrigin); } catch { return reply(404, { error: "غير متاح." }); }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) || origin.protocol !== "http:")
    return reply(404, { error: "المختبر محلي فقط." });
  if (request.method !== "POST" || request.headers.get("origin") !== origin.origin ||
    new URL(request.url).origin !== origin.origin || request.headers.get("host") !== origin.host ||
    request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
    return reply(403, { error: "مصدر طلب غير مصرح به." });
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > BODY_LIMIT)) return reply(413, { error: "طلب كبير جدًا." });
  const reader = request.body?.getReader();
  if (!reader) return reply(400, { error: "طلب مفقود." });
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT) { await reader.cancel(); return reply(413, { error: "طلب كبير جدًا." }); }
      chunks.push(value);
    }
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return reply(200, store.execute(raw));
  } catch (error) {
    if (error instanceof SignalError) return reply(error.status, { error: error.message });
    return reply(400, { error: "طلب غير صالح." });
  } finally { reader.releaseLock(); }
}
