# قدّام — Arabic party games

Arabic-first, RTL Quddam includes exactly ten official launch experiences: لوحة التحدي، خارج الجو، شبكة الحروف، قالوا الناس، الكلمة الممنوعة، صدّقني، توب100، البرق، رتّبها، المحكمة. Dedicated server-authoritative engines, immutable gameplay snapshots, scoped phone/TV access, PostgreSQL command receipts and provider-verified credits preserve saved gameplay/history. Legacy sessions remain readable; no new legacy creation.

## Local development

Use supported Node20.19/22.12 or newer and native PostgreSQL. Copy `.env.example` into a restricted local `.env`; set database, origin and a random abuse secret. Run `npm ci`, `npm run db:generate`, `npm run db:migrate`. Synthetic development accounts require explicit SEED_ADMIN and SEED_USER email/password pairs (12+ characters), then `npm run db:seed`. Existing passwords are preserved. `npm run dev` supports HTTP localhost; `npm run start` is the validated HTTPS production path.

## Production

Follow [the operator runbook](docs/production-runbook.md) and [M13 recovery](docs/database-lifecycle.md). There are24 forward migrations; H-1 adds none. NEVER run `prisma migrate reset` against production. Startup does not migrate, seed, bootstrap accounts or clean data.

Run `npm run ops:validate`, deploy migrations, generate client, explicitly `npm run ops:bootstrap-admin` if needed, and bootstrap missing content with `NODE_ENV=production npm run db:seed:content`. No demo credentials are required. Existing admin/users/passwords/wallets/purchases/refunds/settings/archive flags/games/snapshots remain intact. Production ordinary seed fails before writes. Do not routinely reseed or ship sample database passwords.

Payments stay disabled until merchant credentials, HTTPS origin and callback/cron configuration are verified. Callbacks are hints; authoritative provider lookup and B01 settlement grant credits. Refunds preserve original PAID grants and use separate compensation/support records. Deterministic tests do not imply live-provider verification.

## Verification and operations

Run `npm run content:validate`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` and scoped native/browser verification. Final consolidated gameplay regression is a separate release gate; H-1 does not run it.

- [Content quality/capacity](docs/content-quality.md)
- [Metrics/history semantics](docs/metrics-history.md)
- [History/category eligibility](docs/history-content-eligibility.md)
- [Retention rollout/dry run](docs/data-retention.md)
- [Payment/refund policy](docs/PAYMENT_REFUNDS.md)
- [Ingress/signup controls](docs/PUBLIC_INGRESS_SIGNUP.md)
- [Database upgrade/restart/recovery](docs/database-lifecycle.md)

Earlier phase documents remain historical evidence. Internal Qalba identifiers/cookies/migrations intentionally retain compatibility; customer branding is قدّام.
