/** Application transport bounds. Ingress must independently cap request bodies. */
export const BODY_LIMITS = { json: 16_384, billingCallback: 16_384, questionImport: 550_000 } as const;

export class BodyTooLargeError extends Error {
  constructor() { super("BODY_TOO_LARGE"); }
}

/** Count raw bytes before decoding; a chunk may split an Arabic UTF-8 sequence. */
export async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("Invalid body limit");
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared.trim()) && Number(declared) > maxBytes) {
    void request.body?.cancel().catch(() => {});
    throw new BodyTooLargeError();
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const decode = (chunk?: Uint8Array, stream = false) => {
    try { return decoder.decode(chunk, { stream }); }
    catch { throw new SyntaxError("Invalid request encoding"); }
  };
  let bytes = 0, text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new BodyTooLargeError();
      text += decode(value, true);
    }
    return text + decode();
  } catch (error) {
    // Do not await an uncooperative producer's cancellation before returning 413.
    void reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}
