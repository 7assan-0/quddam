# I-1 production compatibility harness

`tests/security/browser-headers.test.ts` is included in `npm run test`. `compatibility.browser.ts` is a separate targeted suite, never the consolidated regression.

Prerequisites: native PostgreSQL16 `initdb/postgres/createdb/pg_ctl`, OpenSSL, installed project dependencies/generated Prisma client and compatible Chromium. Set `PG_BIN` to the binaries and `CHROMIUM_PATH` to the browser executable. Non-root execution is normal. The evidence environment additionally uses a test-only identity preload for its isolated container; this is not product code or a deployment requirement.

From project root:

```
node scripts/browser-security-runner.mjs gates
# Save the phase checkpoint, then:
node scripts/browser-security-runner.mjs final
```

The harness initializes a **new disposable synthetic database** on127.0.0.1:55453, runs forward deploy and explicit test seed, and destroys only its own temp directory afterward. It never resets an existing database. It runs ops validation, source+DB content validation and lint/typecheck/unit/build in gates mode. Final mode serves that actual production build through the H-1 `npm run start` wrapper, with a local self-signed TLS streaming ingress onlocalhost:3443. It uses real Secure cookies and canonical HTTPS Origin validation. Production HTTPS certificate/ingress/HSTS protection is not proven by this fixture.

The optional `I1_SOURCE_MANIFEST` identifies a source manifest (`files` path/SHA256 map); final verification guards it before and after. `I1_OUTPUT` selects a test output directory. Browser workers1, retries0. A test-only provider adapter redirects server Moyasar fetches to a local deterministic HTTP contract fixture. Hosted responses retain the provider hostname required by existing invoice validation; Playwright intercepts that exact browser hostname and fulfills every request through the local TLS fixture, including return/cancel redirects. No real provider credentials, network payment call or charge occurs. It does not replace settlement logic.

Do not publish `fixture-private.json`, private browser artifacts, cert/key or raw database directories. Delivered evidence contains sanitized observations/headers, test identities, gate logs and aggregate invariant results only. Tests intentionally avoid session-private screenshots and full violation URLs/samples.
