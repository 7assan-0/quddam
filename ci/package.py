"""Freeze after real targeted PASS; Release Candidate only after independent fresh full PASS."""
import argparse
import json
import os
import shutil
from pathlib import Path
import zipfile
from baseline import ROOT, fingerprint, save, sha, verify, canonical_override
from evidence import export, archive, redact_text
from results import collect

FROZEN = "Quddam-Phase-5.0J-2-RG03-frozen-checkpoint.zip"


def executable_files():
    source = json.loads((ROOT / "Source-Manifest.json").read_text())
    harness = json.loads((ROOT / "Authorized-Harness-Fingerprints.json").read_text())
    files = {"qalba-platform/" + p: h for p, h in source["files"].items()} | harness["harnessFiles"]
    ci = {}
    for folder in [ROOT / "ci", ROOT / ".github"]:
        for path in folder.rglob("*"):
            if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
                ci[path.relative_to(ROOT).as_posix()] = sha(path.read_bytes())
    adapters = {p.relative_to(ROOT).as_posix(): sha(p.read_bytes()) for p in (ROOT / "verification-tools").glob(".ci-*.mjs")}
    for name in [".gitignore", "CI-Source-Manifest.json"]:
        if (ROOT / name).exists():
            ci[name] = sha((ROOT / name).read_bytes())
    assert len(adapters) == 6, "All six CI orchestration adapters required"
    override = canonical_override()
    assert override is not None, "Approved identity 066 runtime oracle provenance required before freezing executable source"
    files.update({override["output"]: override["outputSha256"], override["config"]: override["configSha256"],
                  "receipts/CI-Adapter-Audit.json": sha((ROOT / "receipts/CI-Adapter-Audit.json").read_bytes())})
    return files | ci | adapters, ci, adapters


def bundle(path, files, extras):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, expected in sorted(files.items()):
            assert sha((ROOT / name).read_bytes()) == expected
            z.write(ROOT / name, name)
        for name in extras:
            z.write(ROOT / name, name)
        z.writestr("Frozen-File-Manifest.json", json.dumps(files, indent=2))
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None


def freeze():
    integrity = verify()
    ready = json.loads((ROOT / "receipts/Runtime-Readiness.json").read_text())
    assert ready["status"] == "PASS" and ready["readyForMandatoryTests"]
    for phase, required in [("m05", 1), ("related", 10)]:
        receipt = json.loads((ROOT / "receipts" / ("Phase-" + phase + ".json")).read_text())
        assert receipt["status"] == "PASS" and receipt["passed"] == required and receipt["skipped"] == receipt["failed"] == receipt["automaticRetries"] == 0
    files, ci, adapters = executable_files()
    receipt = {**integrity, "status": "FROZEN", "run": ready["run"], "ciFingerprint": fingerprint(ci), "ciAdapterFingerprint": fingerprint(adapters),
               "combinedVerificationSourceFingerprint": fingerprint(files), "combinedFileCount": len(files), "files": files, "canonicalM05AssertionsAndTimeoutUnchanged": True,
               "canonicalOverrides": [canonical_override()], "finalGateResults": "NOT_EXECUTED; targeted results cannot substitute for fresh final gate"}
    save(ROOT / "receipts/RG03-Freeze.json", receipt)
    path = ROOT / "deliverables" / FROZEN
    path.parent.mkdir(exist_ok=True)
    bundle(path, files, ["Source-Manifest.json", "Migration-Integrity.json", "Authorized-Harness-Fingerprints.json", "Authorized-RG03-Mail-Harness-Patch.diff",
                         "Quddam-Phase-5.0J-2-Test-Manifest.json", "receipts/RG03-Freeze.json", "receipts/Source-Integrity.json", "receipts/Runtime-Readiness.json", "receipts/Phase-m05.json", "receipts/Phase-related.json", "receipts/Exact-CI-Adapter.diff",
                         "inputs/Quddam-Phase-5.0J-2-RG02-frozen-checkpoint.zip", "inputs/Quddam-Phase-5.0J-2-RG03-Evidence.zip"])
    print("Fresh targeted PASS verified; RG03 checkpoint frozen. Full gate still required.")


def verify_freeze():
    verify()
    paths = list((ROOT / "incoming").rglob(FROZEN))
    assert len(paths) == 1, "One checkpoint from this workflow's targeted job is required"
    with zipfile.ZipFile(paths[0]) as z:
        assert z.testzip() is None
        receipt = json.loads(z.read("receipts/RG03-Freeze.json"))
        assert receipt["run"]["id"] == os.environ.get("GITHUB_RUN_ID") and receipt["run"]["sha"] == os.environ.get("GITHUB_SHA") and receipt["run"]["attempt"] == "1"
        assert receipt["run"]["repository"] == os.environ.get("GITHUB_REPOSITORY")
        files, ci, adapters = executable_files()
        assert receipt["canonicalOverrides"] == [canonical_override()], "Frozen canonical oracle provenance differs from current approved override"
        assert files == json.loads(z.read("Frozen-File-Manifest.json")) == receipt["files"], "Current executable source differs from freshly frozen RG03"
        assert fingerprint(files) == receipt["combinedVerificationSourceFingerprint"]
        for name, expected in files.items():
            assert sha(z.read(name)) == expected, name
        save(ROOT / "receipts/RG03-Freeze.json", receipt)
    (ROOT / "deliverables").mkdir(exist_ok=True)
    shutil.copyfile(paths[0], ROOT / "deliverables" / FROZEN)
    print("Same-run frozen RG03 source verified; no historical PASS counts imported.")


def release():
    integrity = verify()
    _, summary = collect()
    assert summary["status"] == "PASS", "Incomplete/failed fresh gate: Release Candidate forbidden"
    phase = json.loads((ROOT / "receipts/Phase-full.json").read_text())
    assert phase["status"] == "PASS" and len(phase["tasks"]) == 9 and all(t["status"] == "PASS" for t in phase["tasks"])
    ready = json.loads((ROOT / "receipts/Runtime-Readiness.json").read_text())
    frozen = json.loads((ROOT / "receipts/RG03-Freeze.json").read_text())
    files, _, _ = executable_files()
    assert files == frozen["files"] and ready["status"] == "PASS"
    override = canonical_override()
    assert frozen["canonicalOverrides"] == summary["canonicalOverrides"] == [override], "Release oracle provenance differs from frozen/fresh audited execution"
    output = ROOT / "deliverables"; output.mkdir(exist_ok=True)
    safe = export()
    archive(output / "Quddam-Phase-5.0J-2-Final-Evidence.zip", safe)
    bundle(output / "Quddam-Phase-5.0J-2-Release-Candidate.zip", files, ["Source-Manifest.json", "Migration-Integrity.json", "Authorized-Harness-Fingerprints.json", "Authorized-RG03-Mail-Harness-Patch.diff", "Quddam-Phase-5.0J-2-Test-Manifest.json", "receipts/RG03-Freeze.json", "receipts/Exact-CI-Adapter.diff", "receipts/Runtime-Readiness.json", "inputs/Quddam-Phase-5.0J-2-RG02-frozen-checkpoint.zip", "inputs/Quddam-Phase-5.0J-2-RG03-Evidence.zip"])
    (output / "Quddam-Phase-5.0J-2-Test-Manifest.json").write_bytes((ROOT / "results/Quddam-Phase-5.0J-2-Test-Manifest.json").read_bytes())
    run = ready["run"]
    report = f"""# PHASE 5.0J-2 — Final Report

READY FOR RELEASE VERIFICATION

GitHub Actions run: https://github.com/{run['repository']}/actions/runs/{run['id']}
Commit: `{run['sha']}`; attempt: {run['attempt']}.

Application fingerprint: `{integrity['applicationFingerprint']}` (670/670 byte-identical to RG02).
Authorized harness fingerprint: `{integrity['harnessFingerprint']}`.
Combined verification-source fingerprint: `{frozen['combinedVerificationSourceFingerprint']}`.
Authored application / authored canonical test / schema / migration / dependency diff: EMPTY.
Executed canonical oracle exception: identity 066 only, owner-approved concurrent-expiry oracle correction; authored test bytes and timeouts remain unchanged.
Override input: `{override['input']}` (`{override['inputSha256']}`). Executed source: `{override['output']}` (`{override['outputSha256']}`); configuration: `{override['config']}` (`{override['configSha256']}`).
Exact oracle authorization, edit and diff: receipts/CI-Adapter-Audit.json; generated source/configuration are included in the frozen executable manifest.
Exact authorized MIME diff: Authorized-RG03-Mail-Harness-Patch.diff.
Exact CI orchestration diff: receipts/Exact-CI-Adapter.diff; complete CI source hashes: RG03-Freeze.json.

PostgreSQL: {ready['conditions']['servicePostgres']['version']}; native binary versions in runtime receipt.
Playwright: {ready['conditions']['chromium']['playwright']}; Chromium: {ready['conditions']['chromium']['actualVersion']}; revision {ready['conditions']['chromium']['revision']}.

| Required inventory | Fresh PASS |
| --- | ---: |
| Canonical browser/API | 223/223 |
| Supplemental browser/API | 38/38 |
| Native PostgreSQL | 186/186 |
| Unit/integration | 1185/1185 |

All ten games PASS: Category Board, Social/Out-of-the-Loop, Letter Network, Survey Battle, Forbidden Word, Bluff, Ranked Lists, Lightning Quiz, Ordering Challenge, Court.
Complete required lifecycle/rematch/privacy/hidden-content/reconnect coverage PASS.
Billing exactly-once / invoice recovery / reconciliation / refunds PASS.
Auth / security / abuse / M05 Password Reset / session invalidation / privacy PASS.
SSE / command-round boundaries / history-content / retention PASS.
M13 populated upgrade / application restart / native PostgreSQL outage-recovery / backup-restore PASS.
Responsive/mobile and Lightning buzzer geometry PASS.
CSP compatibility PASS: Content-Security-Policy-Report-Only; no enforcement change.
Content validation / operations / lint / typecheck / production build PASS.

0 failed; 0 skipped; 0 unresolved flaky; 0 automatic mandatory retries.
Targeted verification and historical results are excluded from these counts.

Non-blocking limitations: this manifest uses Chromium only, not Firefox/WebKit. GitHub-hosted Ubuntu patch image, official PostgreSQL 16 patch image and signed Ubuntu PostgreSQL 16 package patch versions can advance; exact runtime versions are recorded. Shared trace evidence is deliberately sanitized diagnostic data, not a replayable raw browser/session trace. No deployment or production behavior was exercised.
"""
    (output / "Quddam-Phase-5.0J-2-Final-Report.md").write_text(report)
    (output / "Quddam-Phase-5.0J-2-Release-Checklist.md").write_text("# Release verification checklist\n\n" + "\n".join("- [x] " + x for x in ["670 frozen application files unchanged", "223 canonical + 38 supplemental + 186 native PASS from identity 001", "1185 required unit/integration PASS", "All ten games and required release areas PASS", "Native M13 populated lifecycle/restart/restore PASS", "Content, operations, lint, typecheck and build PASS", "CSP remains Report-Only", "Zero failures/skips/retries/unresolved flaky", "No production deployment, real charge, commit or push"]) + "\n")
    print("All independently audited fresh release criteria PASS. Release Candidate created.")


def blocked():
    output = ROOT / "deliverables"; output.mkdir(exist_ok=True)
    # Keep the targeted job's same-run checkpoint even if final-job provisioning
    # fails before the final source adapters can be generated.
    for path in (ROOT / "incoming").rglob(FROZEN):
        with zipfile.ZipFile(path) as z:
            receipt = json.loads(z.read("receipts/RG03-Freeze.json"))
            assert z.testzip() is None and receipt["status"] == "FROZEN"
            assert receipt["run"]["id"] == os.environ.get("GITHUB_RUN_ID") and receipt["run"]["sha"] == os.environ.get("GITHUB_SHA")
        shutil.copyfile(path, output / FROZEN)
    _, summary = collect()
    failed = []
    for path in sorted((ROOT / "receipts").glob("*.json")):
        value = json.loads(path.read_text())
        if value.get("status") == "FAILED":
            failed.append({"receipt": path.name, "error": value.get("originalError", value.get("originalOrchestrationError")), "label": value.get("label", value.get("stoppedAt"))})
    targeted = {}
    for name, count in [("m05", 1), ("related", 10)]:
        target = ROOT / "verification" / name / "Execution-Results.json"
        rows = json.loads(target.read_text())["runs"] if target.exists() else []
        targeted[name] = {"PASS": sum(r["status"] == "passed" for r in rows), "FAILED": sum(r["status"] == "failed" for r in rows), "NOT_EXECUTED": count - len(rows)}
    report = "# PHASE 5.0J-2-RG03 — GitHub Actions BLOCKED\n\nNo Release Candidate. Stop at the first failed prerequisite or mandatory identity.\n\nClassification: D — UNRESOLVED pending evidence-based diagnosis; runtime command errors/receipts may establish C. No product cause is inferred.\n\nLatest safe checkpoint: RG03 only if this run's targeted job froze it successfully; otherwise supplied RG02.\n\nFresh execution counts (PASS / FAILED / NOT_EXECUTED):\n\n```json\n" + json.dumps(summary["counts"], indent=2) + "\n```\n\nTargeted execution (excluded from final gate counts):\n\n```json\n" + json.dumps(targeted, indent=2) + "\n```\n\nFirst failure receipts (secret-bearing details redacted in exported evidence):\n\n```json\n" + redact_text(json.dumps(failed, indent=2)) + "\n```\n\nNo automatic mandatory retries. No continuation of mandatory identities after the first failure. Source and exact CI/MIME diffs are preserved.\n"
    (output / "Quddam-Phase-5.0J-2-GHA-BLOCKED-Report.md").write_text(report)
    archive(output / "Quddam-Phase-5.0J-2-GHA-Evidence.zip", export())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["freeze", "verify-freeze", "release", "blocked"])
    command = parser.parse_args().command
    {"freeze": freeze, "verify-freeze": verify_freeze, "release": release, "blocked": blocked}[command]()
