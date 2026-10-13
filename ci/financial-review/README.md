# Scoped synthetic financial review

The workflow checks the current pull request head with native PostgreSQL 16.
The official PostgreSQL 16.15 image is pinned by digest. A local result does
not establish a successful hosted Actions run; verify that run separately.
It installs the frozen lockfile, generates the Prisma client, creates two new
databases, applies forward migrations, seeds Board content only in P05, runs
the 56 reversal and 13 B01 scenarios, and runs every tracked unit test file.
It requires eleven reversal races with distinct waiting PostgreSQL backends,
both settlement winner orders, real Board START/refund contention, and exactly
86 assertions in the settlement/refund regression file. Unit retries
are disabled. A failed command, missing/partial result, skipped assertion or
tracked source change fails the job.

The B01 harness keeps its original 13 case identities, seven recorded races
and business assertions. Its synthetic observations now include a matching
paid payment and merchant metadata, or an explicit empty payment list for
ordinary no-credit terminal outcomes. These fixture updates follow the
owner's rule that missing terminal payment data requires review; B01 is not
an unchanged historical harness.

The 14-case rollback probe compiles current and immutable
`2d4e868ba43700414c19ece1394bf6815e7639cf` and
`b6c61cca11a87c69eec4372acb34a0fcb34f6cec` application modules in memory.
It checks held fixtures across all four settlement source values and three
reconciliation source values using a mock provider, then demonstrates that
the older main grants credits despite the retained review marker. It also
demonstrates that the earlier hold-aware PR3 source compensates a wrong historical
void despite the new grant's recorded payment identity. Its passing
result records the hazard: deployment rollback remains unsafe. It performs
no deployment, database or provider access and proves no concurrency. The
new workflow fetches history for this exact baseline; local checkouts must
also contain it. Probe source inventories and result hashes bind the summary
to all three revisions.

The runner binds the result to the clean checkout's commit, tree and SHA256
inventory of every tracked file before and after execution. It records tool
versions, step exit statuses, timings, case names and SHA256 hashes of private
raw outputs. `npm ci --include=dev` and `npm run db:generate` are required;
the native scripts do not load a dotenv file. CI pins Node 24.19.0; the package
supports Node `^20.19 || ^22.12 || >=24.0`.

For local reproduction, use the existing checkout; do not create a worktree.
Start a fresh disposable native PostgreSQL 16 service with bootstrap database
`postgres`, user `quddam_financial_test`, and loopback port `55465`. The user
must be able to create databases. Both `financial_p05` and `financial_b01`
must be absent. Inject `DATABASE_URL` securely through the process environment
from restricted local configuration, pointing to that bootstrap database;
do not put it in command arguments, a repository dotenv file, or logs. Set
`BILLING_TEST_DATABASE=1` and choose a new absolute `FINANCIAL_REVIEW_OUTPUT`
directory outside the checkout whose parent already exists. Then run from
the repository root:

```bash
node ci/financial-review/run.mjs
```

The output directory is created with mode 0700. Only its sanitized
`manifest.json` (mode 0600) is suitable for upload. Raw harness JSON and command
logs are retained privately under `/tmp/quddam-financial-review-private-*`;
they contain synthetic fixture identifiers and must not be published. Inspect
those private logs locally to diagnose a reported failed step. The public
summary omits URLs, credentials, environment values, fixture UUIDs and emails.

The runner refuses existing target databases and performs no reset, deletion,
fixture cleanup or destructive SQL. On failure, use a new disposable instance
for another complete run; preserve the first run's evidence. Stop only a
service you started after collecting its evidence. Do not delete financial
audit records or review markers to make a retry pass.

P05 overrides provider credentials with synthetic values, intercepts provider
GETs and rejects unknown HTTP destinations. Its callback uses the real provider
parser over that synthetic transport; native POLL and CRON cases exercise
reconciliation services. The unit regression also exercises the actual HTTP
handlers with mocked database/auth boundaries. These results do not verify
live provider access, deployment, historical RC assets or a successor release
gate. Typechecking and production build remain separate checks; they can
generate tracked Next environment declarations and require their own source
integrity handling.
