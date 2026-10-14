import type { Credentials, SignalInput, SignalReply } from "./signaling";
import { MAX_GUESTS } from "./protocol";

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export type SignalingClient = (input: SignalInput, signal?: AbortSignal, keepalive?: boolean) => Promise<SignalReply>;
export const requestSignal: SignalingClient = async (input, signal, keepalive = false) => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 8_000);
  try {
    const response = await fetch("/api/labs/player-hosted-rooms", {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
      body: JSON.stringify(input), signal: controller.signal, keepalive,
    });
    const body = await response.json();
    if (!response.ok) throw new ApiError(response.status,
      typeof body.error === "string" && body.error.length < 200 ? body.error : "تعذر الاتصال بالغرفة.");
    return body as SignalReply;
  } finally { clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
};

const STORAGE_PREFIX = "quddam-guest-room-v3:";
// Never persist host credentials. A shared link and a refreshed guest cannot acquire host authority.
export function readGuest(storage: Pick<Storage, "getItem">, code: string): Credentials | undefined {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_PREFIX + code) ?? "null");
    if (value?.role === "guest" && value.code === code && typeof value.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(value.token) &&
      Number.isInteger(value.slot) && value.slot >= 1 && value.slot <= MAX_GUESTS && Number.isInteger(value.epoch) && value.epoch >= 1 && value.epoch <= 4 && value.expires > Date.now()) return value;
  } catch { /* Storage may be disabled. Joining still works without persistence. */ }
}
export function rememberGuest(storage: Pick<Storage, "setItem">, credentials: Credentials) {
  if (credentials.role !== "guest") return;
  try { storage.setItem(STORAGE_PREFIX + credentials.code, JSON.stringify(credentials)); } catch { /* optional */ }
}
export function forgetGuest(storage: Pick<Storage, "removeItem">, code: string) {
  try { storage.removeItem(STORAGE_PREFIX + code); } catch { /* optional */ }
}
