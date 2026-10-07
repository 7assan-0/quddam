# Phase 5.0C-2 — public ingress and signup controls

This phase addresses M04/M05 only. قدّام presentation, game engines, START/debit rules, payment settlement/recovery, Host SSE and participant authorization are unchanged.

## Streaming body bounds

`readBoundedText` consumes the Web Request stream, counts each `Uint8Array.byteLength` before decoding, and rejects the first chunk that would exceed the bound. It never calls `request.text()/json()/arrayBuffer()/blob()/formData()` first. Valid numeric Content-Length is only an early rejection optimization. A missing, understated or invalid length does not bypass streamed counting. Exactly the limit is accepted.

On rejection/error the reader is canceled and its lock is released. Cancellation is initiated but not awaited: a malicious producer must not delay a 413 by refusing cancellation. Runtime/socket/kernel buffers and the size of an already-delivered chunk are outside the application reader's control; no claim is made that application code replaces ingress protection.

One fatal streaming UTF-8 TextDecoder handles multibyte sequences across arbitrary chunk boundaries. Malformed/truncated UTF-8 becomes the existing safe invalid-input response, without logging body data. JSON/schema validation is otherwise unchanged. Billing callback malformed JSON retains its existing generic 503 behavior; body overflow is always 413 after the existing callback authorization.

| Class | Raw byte cap | Additional existing bounds |
| --- | ---: | --- |
| Shared gameplay/platform/admin JSON | 16,384 | Existing Zod command/content schemas |
| Billing callback | 16,384 | Existing token check and invoice ID schema |
| Admin question CSV import JSON wrapper | 550,000 | CSV string ≤500,000 JS characters; ≤250 rows; existing field validation |

The import cap preserves its existing Content-Length byte cap. Arabic character count is not a byte budget: valid CSV must satisfy both existing authored-field limits and the transport limit. No larger global allowance overrides the stricter classes. Only these three evidenced inbound buffering paths existed in authored source.

At deployment configure an independent hard ingress body cap (for example 1 MiB total, with 16 KiB JSON/callback and 550,000-byte import path overrides if supported). Reject oversized chunked bodies there too, apply request/header/time/concurrency bounds, and account for any proxy decompression. No hosting provider or infrastructure deployment is assumed by this phase.

## Layered authentication budgets

The original limiter is PostgreSQL-backed, not process-local. New public auth controls reuse `AuthAttempt` with a distinct HMAC namespace. A short transaction claims all layers in deterministic key order or rolls back all of them. Atomic upserts cannot exceed a cap or overflow the count. Rejected requests do not extend a window. These budgets apply before password hashing, account creation or reset issuance.

| Action | Account/identity layer | Client/network layer | Shared global layer |
| --- | --- | --- | --- |
| register | email: 8/hour | 12/minute, 60/hour | 60/minute, 600/hour, 3,000/day |
| login | email+client: 8/15 minutes, 30/hour | 60/minute, 300/hour | 120/minute, 3,000/hour |
| admin login (in addition to login) | email+client: 5/15 minutes, 10/hour | 20/minute, 100/hour | 60/minute, 600/hour |
| forgot password | email+client: 3/15 minutes, 10/hour | 20/minute, 100/hour | 60/minute, 600/hour |
| reset submission | token+client: 5/15 minutes, 10/hour | 20/minute, 100/hour | 60/minute, 600/hour |

Windows begin at the first admitted attempt, recover at `windowStart + duration`, and are not sliding lockouts. Login/forgot deliberately do not deny every client from an email-only victim counter. Exhausting a victim's email from client A does not exhaust their client B pair; shared-network/global budgets can still impose temporary limits. Password recovery retains the generic `{ok:true}` throttled response to avoid account enumeration. The existing unconfigured-SMTP 503 and one-use reset/session invalidation semantics remain.

There is no separate admin login endpoint. The existing login route checks the real account role and applies the stricter admin budget before password verification. No new admin cookie or identity contract is added.

Twelve registration admissions per minute and sixty/hour support small household bursts while bounding a single source. Large carrier NATs/schools may require staged onboarding; these controls are not an IP-only ban, verified human proof or botnet immunity. Global budgets apply even when attackers distribute across trusted networks. No CAPTCHA is introduced.

The legacy `consumeAuthAttempt` path without a Request stays unchanged for checkout and room/participant join call sites. This phase does not claim to repair unrelated participant-network extraction or SSE capacity policy.

## Trusted client identity

Default `AUTH_TRUST_PROXY=false` ignores forwarding/client-IP headers entirely and uses one conservative `unknown` bucket, plus global/email layers. Next's Web Request does not supply a trustworthy socket peer address, so the application does not invent one.

Only enable `AUTH_TRUST_PROXY=true` with `AUTH_CLIENT_IP_HEADER` set to a single-IP header that an owned/trusted ingress **unconditionally overwrites**. A dedicated header such as `x-quddam-client-ip` is recommended. Block direct access to the app and remove client-supplied copies at that ingress. Configuration is a trust contract, not automatic proof of the peer. Do not enable it merely because a browser sends X-Forwarded-For.

Missing/malformed/chain/comma/port/zone values fall back to `unknown`; no leftmost arbitrary forwarding value is selected. IPv4-mapped IPv6 shares its IPv4 identity. IPv6 temporary addresses share a canonical /64 bucket. IP values exist only while deriving HMAC keys and are not persisted/logged or included in analytics/UI. All instances must share the same stable ≥24-character `AUTH_RATE_LIMIT_SECRET`, PostgreSQL database, trust configuration and reasonably synchronized clocks. Rotating the secret resets budgets; plan that as a security configuration change.

## Welcome entitlement policy

`PUBLIC_WELCOME_CREDITS_ENABLED` accepts only `true` or `false`, and defaults to **false**. This is the explicit configurable public-beta gate requested when no existing invitation/email-verification flow can safely establish eligibility. Public signup remains allowed. Eligible means this operator gate is true **and** the existing `welcome-credits` FeatureFlag is enabled with valid configured count. The count is unchanged (the existing seed uses 3); no number is silently reduced.

When either gate is disabled the first entitlement marker has delta 0. Existing `welcome:<userId>` uniqueness, ledger/audit path and wallet transaction remain. Retries/parallel requests cannot grant twice. Zero entitlement markers are final under the existing disabled-flag policy: later enabling a gate does not retroactively grant these accounts; use the existing explicit admin-grant path if product/support deliberately authorizes one. Previously granted or purchased credits are untouched. START debit code is unchanged.

Before public signup decide whether to keep free entitlement disabled or explicitly enable it for a controlled beta. Enabling free grants for unverified public emails retains residual distributed farming risk within these budgets. This phase adds no invitation product, verification mail UI, refunds, negative-wallet policy or gameplay changes. Production/staging instances must use the same gate setting. Test fixtures needing legitimate welcome credits opt in explicitly; security tests also cover the default-off mode.

## Shared storage and retention

All budgets are shared across instances using the same PostgreSQL database. There is no Redis or in-memory authoritative counter. The existing table stores only 64-character secret-HMAC keys, count and window start; no raw IP, email, token or password.

One new forward migration adds only `AuthAttempt(windowStart)` for indexed age cleanup. Existing migrations and gameplay models are unchanged. Each public auth attempt prunes at most 500 keys older than 48 hours using `FOR UPDATE SKIP LOCKED`, independently of admission. This exceeds every active window (maximum 24 hours). During idle periods schedule:

```bash
node --import tsx scripts/auth-attempt-retention.ts
```

Run daily with the application database; each invocation deletes at most 10,000 eligible counters. Repeat a bounded invocation if a larger backlog exists. Physical removal during idle periods depends on scheduling this job; no scheduler/hosting deployment was performed here. The 48-hour retention policy remains unchanged. Both pruning paths preserve a future blockedUntil. Prefer the single bounded daily command in [data-retention.md](data-retention.md), which also implements M12 private/access cleanup; do not schedule both commands redundantly.

Each normal auth admission adds one bounded prune query plus six counter upserts in a short transaction; an admin login has the additional stricter six-layer transaction. No auth lookup or budget was added to SSE ticks. Shared global rows serialize small auth budgets; this deliberately bounds public work and is not a scale rewrite.
