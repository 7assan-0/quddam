# Browser security headers and CSP

I-1 introduces a **candidate report-only CSP**, not enforcement or production deployment. The installed Next16.3.6 CSP documentation and source were inspected. Pages already render dynamically. Proxy supplies a fresh cryptographic18-byte nonce to the trusted request CSP header so Next nonces its framework/bootstrap scripts and styles; the browser receives only `Content-Security-Policy-Report-Only`. Inbound CSP/nonces are overwritten. No user/auth/game state is included in the nonce.

## Candidate production policy

`N` is a different base64 nonce per document response:

```
default-src 'self'; script-src 'self' 'nonce-N' 'strict-dynamic'; script-src-attr 'none'; style-src 'self' 'nonce-N'; style-src-elem 'self' 'nonce-N'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'; media-src 'none'; worker-src 'none'; manifest-src 'self';
```

| Directive | Actual requirement / decision |
|---|---|
| default-src | Same-origin fallback; no wildcard. |
| script-src / script-src-attr | Next local bundles and framework inline bootstrap use nonce/strict-dynamic. No authored inline scripts/event attributes, external scripts, analytics SDK or production eval requirement was found. |
| style-src / style-src-elem | Local compiled CSS; Next-generated style elements use the nonce. |
| style-src-attr | Explicit `unsafe-inline` for existing SSR/React team colors, progress widths, CSS variables and boundary styles. This allowance does not authorize inline scripts. Removing it would require a separate presentation migration; styles are not rewritten in I-1. |
| img-src | Self for brand/icons/Next image/local questions; data for server-generated QR images. No blob requirement was found. Optional audited external question images require exact HTTPS origins via CSP_IMAGE_ORIGINS. |
| font-src | Bundled Noto Sans Arabic Regular/Bold under /fonts; no external font origin. |
| connect-src | All browser fetch, billing status, admin and EventSource traffic is same-origin. No browser Moyasar API call, WebSocket or external telemetry was found. |
| frame-src / frame-ancestors | No embedded-provider or product embedding requirement. None; existing X-Frame-Options DENY remains enforced even while CSP is report-only. |
| form-action / base-uri | Same-origin forms and base. Provider checkout uses top-level window.location navigation, not external form submission. |
| object-src / media-src / worker-src | No plugins, audio/video or workers/service worker currently required. None. |
| manifest-src | Same-origin; no existing installable manifest was found. |

No third-party origin is enabled by default. Moyasar API access is server-side and its hosted checkout is a top-level navigation, neither requiring connect/frame/script permission. Optional `CSP_IMAGE_ORIGINS` is a comma-separated list of at most8 exact HTTPS origins (no paths, credentials, query, fragments, wildcard or local development origins). Invalid configuration fails build/start/ops validation with field names only. Disabled optional integrations create no mandatory origin/secret requirement. Existing authored external image URLs remain data; an operator must inventory and explicitly approve their origins before enforcement. I-1 does not change content.

## Header matrix / scope

| Header | Value / scope |
|---|---|
| CSP-Report-Only | Dynamic browser documents, including error/not-found and RSC navigation. No enforcement header is emitted. Static assets and API/SSE do not need document CSP. |
| X-Content-Type-Options | nosniff, global. |
| Referrer-Policy | no-referrer, global, prevents credential-query URLs propagating as referrers. Same-origin Origin/CSRF checks are unchanged. |
| X-Frame-Options | DENY, global compatibility control. |
| Permissions-Policy | camera=(), microphone=(), geolocation=(); no present feature needs these. |
| Cross-Origin-Opener-Policy | same-origin; no opener/popup-dependent payment integration exists. |
| Cross-Origin-Resource-Policy | same-origin; product assets/private APIs are not cross-site embeds. |
| Strict-Transport-Security | max-age=31536000 only when NODE_ENV=production and canonical APP_URL is HTTPS. No includeSubDomains/preload: ownership/readiness is not established. |
| Cross-Origin-Embedder-Policy | Deliberately absent: cross-origin isolation is not a product requirement. |
| Cache-Control | Existing private page/token/SSE behavior preserved; API responses explicitly private,no-store. Static assets retain their existing cache policy. |

Nonce Proxy deliberately excludes API/SSE to preserve M04: Next Proxy otherwise clones/buffers request bodies. It does not read bodies or change SSE lifetime/markers/cleanup. API/SSE still receive the static security-header baseline. Proxy retains the prior Lightning bearer-page checks without changing credential semantics. No schema or migration is involved.

## Development and HTTPS assumptions

Development alone permits script unsafe-eval, style elements unsafe-inline and an HMR ws/wss origin derived from that request's origin. These are absent in production. Production compatibility must use build + start, not dev. Local HTTP or self-signed browser tests do not prove HSTS protection; production requires trusted HTTPS termination, canonical origin and protected direct ingress. One-year HSTS makes HTTPS rollback consequential; review domain/TLS readiness before deployment.

## Reporting, privacy and investigation

There is no existing trusted report collector. I-1 does not introduce a telemetry platform or third-party report destination. Browser tests capture `securitypolicyviolation` events locally without report-uri/report-to; browsers still expose report-only violations. A synthetic parser-inserted unnonced script in a test-only response fixture proves observation and, as expected, runs in report-only mode. Tests persist only directive/disposition/resource origin class/status, sanitized console categories and aggregate counts. No report-sample, raw URLs with query credentials, cookie, token, payment secret, private word/answer/vote is retained.

Before production, wire an approved same-origin or trusted first-party report collector with bounded ingress, authentication-independent admission limits, payload redaction/aggregation and retention. Browsers may include full document/blocked URLs and source samples by default: never forward raw reports to analytics or untrusted third parties. Review token-query pages specifically. Adding a collector is a separately reviewed operation, not accomplished by this phase.

Investigate a violation by directive, resource origin, environment and nonce attachment. Reproduce against the production build; distinguish expected synthetic probes, genuine app violations, old warnings and runtime failures. Compare generated response CSP and document nonces without retaining credentials. Do not add wildcards or unsafe script allowances to silence failures. For an external authored image, verify publication and origin necessity; configure one exact approved origin or use existing local assets. Re-test navigation, refresh and EventSource reconnect.

## Enforcement decision

Remain report-only for controlled rollout. Passing deterministic compatibility smoke demonstrates this tested build and fixture, not every production content image, browser or optional integration. Before enforcement: verify deployed TLS/ingress, real approved first-party reporting/redaction, zero unexplained application violations over representative journeys/browsers, all production-auth/payment resources, document/prefetch nonce handling, inline-style allowance acceptance and rollback procedure. Stage enforced policy in a separate release gate and retain X-Frame-Options. No final consolidated regression or deployment is performed by I-1.

Primary references: installed Next16.3.6 `docs/01-app/02-guides/content-security-policy.md` and `app-render.js` nonce extraction; [Next CSP guide](https://nextjs.org/docs/app/guides/content-security-policy); [MDN report-only](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only); [MDN HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security); [MDN COOP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy).
