# Successor source verification — PR 1

## Approved history and current target

The official `v1.0.0-rc.1` release is approved at
`b69d8955ad5b33e570dd493e2eb5dfa9e603e72d`. GitHub Actions run
[38106508308](https://github.com/7assan-0/quddam/actions/runs/38106508308)
successfully verified that source. The earlier checked-in preparation and
blocked RG03 reports predate this successful run and do not invalidate it.

`approved-rc-provenance.json` is a new, read-only observation record: tag/run
identities, seven independently checked release digests, candidate/run-artifact
byte equality, archived machine-report counts, and approval limitations. It is
not a replacement approval manifest, a signed attestation, or a new release.
Historical archives, manifests, receipts, workflows and release assets remain
unchanged. The API asset/run identifiers allow an independent reviewer to
retrieve the original evidence. The native report audit distinguishes eleven
recovery rows corroborated by logs from rows with explicit pass fields.

The successor application target is **exactly**
`2d4e868ba43700414c19ece1394bf6815e7639cf`, not the commit delivering this PR.
Its inventory includes 739 tracked repository files, including 674 application
files. Relative to the approved RC there are 51 modified files and four
additions, all under `qalba-platform/`; no deletions. Exact paths and both
versions' SHA256 values are in `candidate-main-2d4e868.json`.

The additions are the Quddam chevrons SVG, Lalezar font and license, and
`src/components/team-marker.tsx`. Existing changes cover branding/fonts/styles,
team markers and associated UI expectations. Package manifests, lockfile,
schema and migrations are unchanged. These accepted changes are preserved.

## Separate source and tooling checkouts

The manual `quddam-successor-verification.yml` workflow uses two checkouts:

1. **Tooling:** the exact dispatched workflow commit, containing this new verifier.
2. **Candidate:** detached at the fixed successor SHA above.

Never substitute an ancestor check or verify the tooling checkout as the
application candidate. Verification reads literal Git objects with replacement
refs disabled, compares the complete inventory to the pinned commit, checks
working-copy bytes/modes, and rejects unexpected authored files even when
`.gitignore` hides them. Symlinks and submodules are rejected. Both full-source
and application fingerprints are reported, alongside the tooling commit and
actual tooling hashes. Before/after checks detect candidate or tooling changes.

The receipt deliberately separates the fixed application SHA from the verifier
revision. In GitHub Actions, the expected tooling identity is the full dispatched
`GITHUB_SHA`; locally it is the literal checkout HEAD. The verifier reads the
recursive `ci/successor` inventory and its own workflow from that commit, records
the tree and blob identities, and compares every working file's SHA256 and Git
executable mode against those objects. Missing, added, changed and unsupported
entries fail, including ignored files and files hidden by `assume-unchanged` or
`skip-worktree`. Git status and index flags are not integrity evidence. Inherited
Git repository/index/object overrides are removed and replacement refs disabled
for each read; commit, tree and blob bytes are also checked against their Git
object identities. Tooling types and integrity are checked before provenance
contents are read, so unsupported entries cannot block validation first.

Only literal committed tooling can produce PASS or the `committed` tooling label.
Dirty local tooling now fails too; commit changes before creating verification
evidence. Tooling has no generated exclusions: use `python3 -B` as shown below to
avoid adding bytecode files to the tooling inventory.

## Reproduce without touching the original candidate

Use the existing isolated workspace; do not create a Git worktree. For this
two-checkout verification contract only, create a disposable clone outside the
development checkout, or use the two checkout steps in the manual workflow:

```bash
git clone --no-hardlinks /workspace/quddam /tmp/quddam-successor-source
git -C /tmp/quddam-successor-source checkout --detach 2d4e868ba43700414c19ece1394bf6815e7639cf
python3 -B -m unittest discover -s ci/successor -p 'test_*.py' -v
python3 -B ci/successor/verify.py verify \
  --root /tmp/quddam-successor-source --output /tmp/quddam-successor-preflight-new
```

Every output directory must be new and outside both checkouts. Existing evidence
cannot be overwritten or silently reused. A wrong SHA or changed source exits
nonzero and creates a FAILED summary when the output directory can be created.
Malformed JSON or a manifest with the wrong object shape also exits nonzero and
finalizes FAILED before any committed-tooling claim. Unexpected validation
exceptions finalize FAILED with only their exception type, keeping arbitrary
exception payloads out of the public summary. Process interruptions such as
`KeyboardInterrupt` or termination retain INCOMPLETE, never PASS.

Optional fresh quality execution:

```bash
python3 -B ci/successor/verify.py quality \
  --root /tmp/quddam-successor-source --output /tmp/quddam-successor-quality-new
```

Quality requires a fresh candidate without generated files. It runs frozen
`npm ci`, Prisma generation, Next route type generation, lint, typecheck, Vitest
with one worker/no retries/stop-first and machine-readable assertion counts,
and a production build. Commands run serially; failures preserve the first
failure and leave subsequent checks NOT_EXECUTED. No database, provider,
infrastructure or deployment operation is performed. Only OS/network trust
settings are inherited; application credentials are replaced with synthetic
settings and an unreachable loopback database URL. Unit fixtures own their
request Origin, so `APP_URL` is omitted for unit execution, as in the approved
quality runner; the build retains the synthetic HTTPS origin. TLS/checksum verification
is retained.

Next's `next-env.d.ts` is a generated declaration. Only for `typegen` and build,
its original bytes are restored only after validating the exact known
`.next/dev/types/` to `.next/types/` substitution. Unexpected changes fail;
the transformation hashes are recorded. This matches the existing
supported type-generation procedure; generated route declarations are retained
under `.next`. No general reset or restoration of other source is permitted.
All other source changes fail verification.

Generated exclusions are explicitly listed in receipts and are not themselves
certified. They are limited to dependency/build/report outputs and
`src/generated/prisma`, not arbitrary `src/generated` code. Quality recreates
its dependency/client/build outputs; integrity preflight alone does not attest
to installed dependencies or preexisting generated output.

Only `summary.json` is uploaded. It is atomically checkpointed as INCOMPLETE
before validation and after each check, so interrupted runs cannot appear PASS.
Detailed logs, unit reports and npm cache stay
in a restricted private directory outside both checkouts. Do not export them
without a separate redaction review. Receipt hashes bind private logs without
publishing their contents.

## Evidence boundaries

A PASS means only the stated **source preflight** or **quality** scope passed.
Every receipt has `fullReleaseVerified: false`; canonical, supplemental, native
PostgreSQL, content/operations, merchant, staging, capacity and owner approval
remain explicitly NOT_EXECUTED. Historical RC counts are not counted as fresh
successor execution. No release, deployment, payment activation or approval is
generated by this workflow.

This PR establishes candidate identity and safe evidence separation. It does
not silently adapt the original RG03 harness to changed tests, reuse its frozen
manifest, or lower any release criterion. A complete successor gate must later
bind a freshly discovered test inventory, any explicitly approved fixture/oracle
adaptations, native/browser results and all release criteria to its own source.
Until that is implemented and executed, this candidate stays unapproved.

Future approved source changes, including the financial-integrity correction,
need their own candidate identity and inventory. Do not relabel this candidate
or overwrite the original RC to make a later source pass.
