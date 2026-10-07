type Environment = Record<string, string | undefined>;

/** Only optional authored-image origins; no browser payment/analytics integration exists. */
export function cspImageOrigins(value = ""): string[] {
  if (!value.trim()) return [];
  if (value.length > 2048) throw new Error("Invalid CSP_IMAGE_ORIGINS");
  const entries = value.split(",").map(v => v.trim());
  if (entries.length > 8) throw new Error("Invalid CSP_IMAGE_ORIGINS");
  const origins = entries.map(entry => {
    let url: URL;
    try { url = new URL(entry); } catch { throw new Error("Invalid CSP_IMAGE_ORIGINS"); }
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      /[\s*;]/.test(entry) || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Invalid CSP_IMAGE_ORIGINS");
    return url.origin;
  });
  return [...new Set(origins)].sort();
}

export function candidateCsp(nonce: string, options: { development: boolean; imageOrigins?: string[]; developmentOrigin?: string }) {
  if (!/^[A-Za-z0-9+/]{24,64}={0,2}$/.test(nonce)) throw new Error("Invalid CSP nonce");
  const images = cspImageOrigins((options.imageOrigins ?? []).join(","));
  let developmentSocket = "";
  if (options.development && options.developmentOrigin) {
    const url = new URL(options.developmentOrigin);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid development origin");
    developmentSocket = ` ${url.protocol === "https:" ? "wss" : "ws"}://${url.host}`;
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.development ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    `style-src 'self' ${options.development ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    `style-src-elem 'self' ${options.development ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // SSR team colors, progress values and Next/React boundary styles are attributes.
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data:${images.length ? " " + images.join(" ") : ""}`,
    "font-src 'self'",
    `connect-src 'self'${developmentSocket}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "media-src 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
  ].join("; ") + ";";
}

export function browserSecurityHeaders(env: Environment) {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ];
  let https = false;
  try { https = new URL(env.APP_URL ?? "").protocol === "https:"; } catch { /* Operations validation supplies the error. */ }
  if (env.NODE_ENV === "production" && https) headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
  return headers;
}
