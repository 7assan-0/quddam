import { NextResponse, type NextRequest } from "next/server";
import { LightningError } from "@/lib/games/lightning/module";
import { assertLightningPageAccess } from "@/lib/games/lightning/service";
import { randomBytes } from "node:crypto";
import { candidateCsp, cspImageOrigins } from "@/lib/security/browser-headers";

// Header-only nonce forwarding. Existing Lightning bearer-page checks are unchanged.
export async function proxy(request: NextRequest) {
  const nonce = randomBytes(18).toString("base64");
  const policy = candidateCsp(nonce, { development: process.env.NODE_ENV === "development",
    developmentOrigin: request.nextUrl.origin, imageOrigins: cspImageOrigins(process.env.CSP_IMAGE_ORIGINS) });
  const headers = new Headers(request.headers);
  // Never accept client-provided framework nonce/CSP headers.
  headers.delete("content-security-policy-report-only");
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const next = () => {
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Content-Security-Policy-Report-Only", policy);
    if (request.nextUrl.pathname.startsWith("/night/invite/")) {
      // The invite token is a bearer secret in the path: never send it as a referrer.
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return response;
  };
  // Reject before layout streaming can turn a disabled page into an HTTP 200.
  const pathname = request.nextUrl.pathname;
  if (process.env.ENABLE_NIGHT_OF_QUDDAM !== "true" && (pathname === "/night" || pathname.startsWith("/night/"))) {
    return new NextResponse("الصفحة غير متاحة.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow", "Content-Security-Policy-Report-Only": policy } });
  }
  const match = /^\/lightning\/(buzzer|display)\/([^/]+)$/.exec(request.nextUrl.pathname);
  if (!match) return next();
  const tokens = request.nextUrl.searchParams.getAll("token");
  try {
    if (tokens.length !== 1) throw new LightningError("رابط غير صالح", 403);
    await assertLightningPageAccess(match[2], { kind: match[1] === "buzzer" ? "BUZZER" : "DISPLAY", token: tokens[0] });
    return next();
  } catch (error) {
    if (!(error instanceof LightningError) || ![403, 404, 410].includes(error.status)) throw error;
    return new NextResponse("رابط غير صالح أو منتهي.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Content-Security-Policy-Report-Only": policy } });
  }
}

// API/SSE bodies must bypass Proxy's body cloning/buffering (M04).
export const config = { matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|fonts/|brand/).*)"] };
