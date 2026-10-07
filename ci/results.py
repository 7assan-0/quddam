"""Independent, fail-closed accounting of fresh results only; no historical PASS inheritance."""
import argparse
from collections import Counter
import copy
import json
import subprocess
from pathlib import Path
import zipfile
from baseline import ROOT, verify, save


def specs(report):
    for suite in report.get("suites", []):
        yield from suite.get("specs", [])
        yield from specs(suite)


def collect():
    with zipfile.ZipFile(ROOT / "inputs/Quddam-Phase-5.0J-2-RG02-frozen-checkpoint.zip") as z:
        manifest = json.loads(z.read("Quddam-Phase-5.0J-2-Test-Manifest.json"))
    all_cases = manifest["browserApi"]["cases"] + manifest["nativePostgres"]["cases"]
    source = json.loads((ROOT / "Source-Manifest.json").read_text())
    for case in all_cases:
        for k in list(case):
            if k.startswith("execution") or k.startswith("executed"):
                case.pop(k)
        case["execution"] = "NOT_EXECUTED"
        path = case.get("file", case.get("source"))
        assert case["sourceSha256"] == source["files"][path], f"Authoritative manifest source mismatch: {path}"
    audit_errors = []
    failures = []
    seen = set()

    def setcase(case, status, path, retries=0):
        assert case["identity"] not in seen, "Duplicate accounting of identity"
        seen.add(case["identity"])
        case.update(execution=status, executionEvidence=path.relative_to(ROOT).as_posix(), executedRetries=retries)
        if status in ["FAILED", "SKIPPED"]:
            failures.append({"identity": case["identity"], "status": status, "evidence": case["executionEvidence"]})

    def browser(path, canonical=False):
        if not path.exists():
            return
        report = json.loads(path.read_text())
        for spec in specs(report):
            tests = spec.get("tests", [])
            assert len(tests) == 1, "Browser project expansion not authorized"
            results = tests[0].get("results", [])
            if not results:  # --max-failures=1 remaining test never started
                continue
            assert len(results) == 1, "Automatic retry / repeated browser execution detected"
            result = results[0]
            if result.get("status") == "skipped" and not result.get("workerIndex", -1) >= 0:
                continue
            candidates = [c for c in manifest["browserApi"]["cases"] if c["title"] == spec["title"]]
            assert len(candidates) == 1, "Ambiguous browser identity"
            case = candidates[0]
            assert canonical == case["file"].startswith("tests/e2e/"), "Wrong browser inventory"
            status = "PASS" if result["status"] == "passed" and not result.get("retry", 0) and tests[0].get("status") == "expected" else "SKIPPED" if result["status"] == "skipped" else "FAILED"
            setcase(case, status, path, result.get("retry", 0))
        if report.get("errors"):
            audit_errors.append({"report": path.relative_to(ROOT).as_posix(), "originalErrors": report["errors"]})
        if report.get("stats", {}).get("flaky"):
            audit_errors.append({"report": path.relative_to(ROOT).as_posix(), "error": "Unresolved flaky result"})

    canonical = ROOT / "verification/canonical"
    for path in sorted(canonical.glob("[0-9][0-9][0-9]-native.json")):
        browser(path, canonical=True)
    for sub in ["lifecycle", "content-browser", "launch-low-browser"]:
        browser(ROOT / "verification" / sub / "browser-native.json")
    security = ROOT / "verification/security-headers/Browser-Results.json"
    if security.exists():
        for row in json.loads(security.read_text())["tests"]:
            if row["status"] == "skipped" and row.get("workerIndex", -1) < 0:
                continue
            case = next(c for c in manifest["browserApi"]["cases"] if c["file"] == "tests/security-headers/compatibility.browser.ts" and c["title"] == row["title"])
            status = "PASS" if row["status"] == "passed" and not row.get("retry") else "SKIPPED" if row["status"] == "skipped" else "FAILED"
            setcase(case, status, security, row.get("retry", 0))
    reports = {
        "billing-settlement": "B01.json", "billing-recovery": "M01-M02.json", "billing-refunds": "M03.json",
        "auth-abuse": "M05.json", "realtime": "M06-M07.json", "command-boundary": "M08-M09.json",
        "history-content": "M10-M11.json", "data-retention": "M12.json", "content": "content/content-native.json",
        "launch-low": "launch-low/launch-low-native.json",
    }
    for name, filename in reports.items():
        path = ROOT / "verification/native" / filename
        if not path.exists():
            continue
        report = json.loads(path.read_text())
        for row in report.get("cases", report.get("results", [])):
            case = next(c for c in manifest["nativePostgres"]["cases"] if c["source"] == "scripts/" + name + "-postgres.ts" and c["title"] == row["name"])
            status = "PASS" if row.get("passed", True) and row.get("status", "passed") == "passed" else "FAILED"
            setcase(case, status, path)
    for path in sorted((ROOT / "verification/lifecycle").glob("native-*.json")):
        stage = path.stem.removeprefix("native-")
        if stage not in ["fixture", "verify-upgrade", "continue-active", "prepare-offline", "verify-offline", "resume-jobs", "failure-mvcc", "restore-check"]:
            continue
        for row in json.loads(path.read_text()).get("cases", []):
            case = next(c for c in manifest["nativePostgres"]["cases"] if c["source"] == "scripts/database-lifecycle-postgres.ts" and c["stage"] == stage and c["title"] == row["name"])
            setcase(case, "PASS" if row.get("passed", False) else "FAILED", path)

    # Native scripts can abort before writing their JSON. Attribute from the
    # original callback stack/literal loop and actual PASS output without editing
    # or instrumenting any canonical test source or assertion.
    def native_failure(sourcefile, logpath):
        if not logpath.exists():
            return
        process = subprocess.run(["node", str(ROOT / "ci/native-location.mjs"), sourcefile, str(logpath)], capture_output=True, text=True)
        if process.returncode != 0:
            audit_errors.append({"source": sourcefile, "error": "Native failure attribution unresolved", "detail": process.stderr})
            return
        observed = json.loads(process.stdout)
        save(ROOT / "results" / ("First-Failure-" + Path(sourcefile).stem + ".json"), observed)
        for identity in observed["observedCompletedIdentities"]:
            case = next(c for c in manifest["nativePostgres"]["cases"] if c["identity"] == identity)
            if identity not in seen:
                setcase(case, "PASS", logpath)
        failure = observed.get("firstFailure")
        if failure:
            case = next(c for c in manifest["nativePostgres"]["cases"] if c["identity"] == failure["identity"])
            if case["identity"] not in seen:
                setcase(case, "FAILED", logpath)
        failures.append({"source": sourcefile, "status": "FAILED", "identity": failure["identity"] if failure else None,
                         "sourceLocation": failure, "originalErrorEvidence": logpath.relative_to(ROOT).as_posix(), "classification": "D — UNRESOLVED; no cause inferred"})

    native_completion = ROOT / "verification/native/Execution-Results.json"
    if native_completion.exists():
        for run in json.loads(native_completion.read_text())["runs"]:
            if run["status"] == "failed":
                name = Path(run["source"]).stem.removesuffix("-postgres")
                native_failure(run["source"], ROOT / "verification/native" / (name + ".log"))
    lifecycle_completion = ROOT / "verification/lifecycle/Run-Completion.json"
    if lifecycle_completion.exists() and json.loads(lifecycle_completion.read_text()).get("exitCode") != 0:
        for log in sorted((ROOT / "verification/lifecycle").glob("native-*.log"), key=lambda p: p.stat().st_mtime):
            if "scripts/database-lifecycle-postgres.ts:" in log.read_text(errors="replace"):
                native_failure("scripts/database-lifecycle-postgres.ts", log)
    counts = {
        "canonical": dict(Counter(c["execution"] for c in manifest["browserApi"]["cases"] if c["file"].startswith("tests/e2e/"))),
        "supplemental": dict(Counter(c["execution"] for c in manifest["browserApi"]["cases"] if not c["file"].startswith("tests/e2e/"))),
        "nativePostgres": dict(Counter(c["execution"] for c in manifest["nativePostgres"]["cases"])),
    }
    quality = {label: "NOT_EXECUTED" for label in ["lint", "typecheck", "test", "build", "content-validation", "ops-validation"]}
    q = ROOT / "Quality-Gates.json"
    if q.exists():
        for step in json.loads(q.read_text()).get("steps", []):
            if step["label"] in quality:
                quality[step["label"]] = "PASS" if step["status"] == "PASSED" else "FAILED" if step["status"] == "FAILED" else "NOT_EXECUTED"
    unit = {"status": "NOT_EXECUTED", "required": 1185}
    p = ROOT / "verification/quality-gates/unit-native.json"
    if p.exists():
        data = json.loads(p.read_text())
        unit = {"status": "PASS" if data.get("numTotalTests") == data.get("numPassedTests") == 1185 and not data.get("numFailedTests") and not data.get("numPendingTests") and data.get("success") else "FAILED",
                "required": 1185, "total": data.get("numTotalTests"), "passed": data.get("numPassedTests"), "failed": data.get("numFailedTests"), "pending": data.get("numPendingTests")}
    retries = sum(c.get("executedRetries", 0) for c in all_cases)
    manifest.update(finalCounts=counts, automaticRetries=retries, previousOutcomesInherited=False, diagnosticsAndTargetedRunsExcludedFromFinalIdentityCounts=True)
    summary = {"counts": counts, "quality": quality, "unitIntegration": unit, "automaticRetries": retries, "firstFailures": failures, "auditErrors": audit_errors,
               "status": "PASS" if counts == {"canonical": {"PASS": 223}, "supplemental": {"PASS": 38}, "nativePostgres": {"PASS": 186}} and set(quality.values()) == {"PASS"} and unit["status"] == "PASS" and not retries and not failures and not audit_errors else "INCOMPLETE_OR_FAILED"}
    save(ROOT / "results/Quddam-Phase-5.0J-2-Test-Manifest.json", manifest)
    save(ROOT / "results/Final-Execution-Summary.json", summary)
    return manifest, summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-complete", action="store_true")
    args = parser.parse_args()
    verify()
    _, summary = collect()
    print(json.dumps({"status": summary["status"], "counts": summary["counts"]}))
    if args.require_complete:
        assert summary["status"] == "PASS", "Release criteria incomplete; Release Candidate forbidden"
