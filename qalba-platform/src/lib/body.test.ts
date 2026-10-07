import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { BODY_LIMITS, BodyTooLargeError, readBoundedText } from "./body";
import { errorResponse, parseJson } from "./http";

const encode = (text: string) => new TextEncoder().encode(text);
function streamed(chunks: Uint8Array[], headers: HeadersInit = {}) {
  let pulled = 0;
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { if (pulled < chunks.length) controller.enqueue(chunks[pulled++]); else controller.close(); }, cancel,
  }, { highWaterMark: 0 });
  const request = new NextRequest("http://localhost/api/test", { method: "POST", body, headers, duplex: "half" });
  return { request, cancel, pulled: () => pulled };
}

describe("streaming application body bounds", () => {
  it("accepts small valid JSON through the existing schema", async () => {
    const { request } = streamed([encode('{"name":"قدّام"}')]);
    await expect(parseJson(request, z.object({ name: z.string() }))).resolves.toEqual({ name: "قدّام" });
  });
  it("accepts exactly the byte boundary with split Arabic UTF-8", async () => {
    const json = JSON.stringify({ name: "أ".repeat(8000) });
    const raw = encode(json + " ".repeat(BODY_LIMITS.json - encode(json).length));
    expect(raw.byteLength).toBe(16_384);
    const { request } = streamed([raw.slice(0, 10), raw.slice(10, 11), raw.slice(11)]);
    await expect(parseJson(request, z.object({ name: z.string() }))).resolves.toEqual({ name: "أ".repeat(8000) });
    expect(request.body!.locked).toBe(false);
  });
  it("rejects declared oversize without pulling any body", async () => {
    const f = streamed([encode("not read")], { "content-length": "16385" });
    await expect(readBoundedText(f.request, BODY_LIMITS.json)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(f.pulled()).toBe(0); expect(f.cancel).toHaveBeenCalledTimes(1);
  });
  it("stops at the first over-limit chunk without Content-Length", async () => {
    const f = streamed([new Uint8Array(16_384), new Uint8Array(1), new Uint8Array(100_000)]);
    await expect(readBoundedText(f.request, BODY_LIMITS.json)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(f.pulled()).toBe(2); expect(f.cancel).toHaveBeenCalledTimes(1); expect(f.request.body!.locked).toBe(false);
  });
  it.each(["1", "not-a-length", "-1"])("counts streamed bytes with an understated/invalid length %s", async declared => {
    const f = streamed([new Uint8Array(16_385)], { "content-length": declared });
    await expect(readBoundedText(f.request, BODY_LIMITS.json)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(f.cancel).toHaveBeenCalledTimes(1);
  });
  it("counts Arabic as bytes even when decoded characters fit", async () => {
    const raw = JSON.stringify({ name: "ق".repeat(9000) });
    expect(raw.length).toBeLessThan(16_384); expect(encode(raw).length).toBeGreaterThan(16_384);
    const f = streamed([encode(raw)]);
    await expect(parseJson(f.request, z.object({ name: z.string() }))).rejects.toBeInstanceOf(BodyTooLargeError);
  });
  it.each([{ bytes: [0xc3, 0x28] }, { bytes: [0xe2, 0x82] }])("rejects malformed/truncated UTF-8 safely: $bytes", async ({ bytes }) => {
    const f = streamed([new Uint8Array(bytes)]);
    const error = await readBoundedText(f.request, 100).catch(e => e);
    expect(error).toBeInstanceOf(SyntaxError); expect(errorResponse(error).status).toBe(400);
    expect(f.request.body!.locked).toBe(false);
  });
  it("preserves invalid JSON and schema 400s while oversize is deterministic 413", async () => {
    const invalid = streamed([encode('{"name":')]);
    const error = await parseJson(invalid.request, z.object({ name: z.string() })).catch(e => e);
    expect(errorResponse(error).status).toBe(400);
    const schema = streamed([encode('{"name":1}')]);
    expect(errorResponse(await parseJson(schema.request, z.object({ name: z.string() })).catch(e => e)).status).toBe(400);
    expect(errorResponse(new BodyTooLargeError()).status).toBe(413);
  });
  it("does not wait for an uncooperative cancel promise", async () => {
    const body = new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(new Uint8Array(2)); }, cancel() { return new Promise(() => {}); } }, { highWaterMark: 0 });
    const request = new Request("http://localhost", { method: "POST", body, duplex: "half" } as RequestInit);
    await expect(readBoundedText(request, 1)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(request.body!.locked).toBe(false);
  });
});
