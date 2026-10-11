"""Independent, fail-closed accounting of fresh results only; no historical PASS inheritance."""
import argparse
from collections import Counter
import copy
import json
import subprocess
from pathlib import Path
import zipfile
from baseline import ROOT, verify, save, canonical_override, CANONICAL_OVERRIDE_IDENTITY, canonical_fixture, CANONICAL_FIXTURE_IDENTITY


def specs(report):
    for suite in report.get("suites", []):
        yield from suite.get("specs", [])
        yield from specs(suite)


def execution_report_status(manifest, summary):
    """Account only for results authenticated by collect(), never process exit status.

    This describes the executed gate, not the frozen pre-execution inventory or
    owner approval of an official Release Candidate. Missing or inconsistent
    evidence cannot become PASS through a summary/header value.
    """
    required = {"canonical": 223, "supplemental": 38, "nativePostgres": 186}
    groups = {
        "canonical": [c for c in manifest["browserApi"]["cases"] if c["file"].startswith("tests/e2e/")],
        "supplemental": [c for c in manifest["browserApi"]["cases"] if not c["file"].startswith("tests/e2e/")],
        "nativePostgres": manifest["nativePostgres"]["cases"],
    }
    cases = [c for group in groups.values() for c in group]
    if any(not isinstance(c.get("execution", "NOT_EXECUTED"), str) for c in cases):
        return {"gateStatus": "INVALID_EVIDENCE", "releaseVerdict": "BLOCKED", "reportingIssues": ["INVALID_EXECUTION_STATUS"]}
    invalid, failed, incomplete = [], [], []
    counts = {name: dict(Counter(c.get("execution", "NOT_EXECUTED") for c in cases)) for name, cases in groups.items()}
    if any(len(groups[name]) != count for name, count in required.items()) or len({c["identity"] for c in cases}) != len(cases):
        invalid.append("INCONSISTENT_IDENTITY_INVENTORY")
    if counts != summary.get("counts") or counts != manifest.get("finalCounts"):
        invalid.append("INCONSISTENT_RECORDED_COUNTS")
    if any(c.get("execution", "NOT_EXECUTED") not in {"PASS", "FAILED", "SKIPPED", "NOT_EXECUTED"} for c in cases):
        invalid.append("INVALID_EXECUTION_STATUS")
    if any(c.get("execution", "NOT_EXECUTED") == "NOT_EXECUTED" for c in cases):
        incomplete.append("INCOMPLETE_EXECUTION")
    if any(c.get("execution") in {"FAILED", "SKIPPED"} for c in cases) or summary.get("firstFailures"):
        failed.append("FAILED_OR_SKIPPED_MANDATORY_IDENTITY")
    executed = [c for c in cases if c.get("execution") in {"PASS", "FAILED", "SKIPPED"}]
    if any(not isinstance(c.get("executionEvidence"), str) or not c["executionEvidence"] for c in executed):
        incomplete.append("MISSING_IDENTITY_EVIDENCE")
    if any(type(c.get("executedRetries")) is not int or c["executedRetries"] < 0 for c in executed):
        incomplete.append("MISSING_OR_INVALID_RETRY_EVIDENCE")
    retries = sum(c.get("executedRetries", 0) for c in cases if type(c.get("executedRetries", 0)) is int)
    if retries != summary.get("automaticRetries") or retries != manifest.get("automaticRetries"):
        invalid.append("INCONSISTENT_RETRY_COUNTS")
    if retries:
        invalid.append("UNAUTHORIZED_RETRIES")
    if summary.get("auditErrors"):
        invalid.append("RESULT_AUTHENTICATION_OR_FLAKY_ERRORS")
    if not isinstance(summary.get("firstFailures"), list) or not isinstance(summary.get("auditErrors"), list):
        incomplete.append("MISSING_FAILURE_AUDIT")
    if manifest.get("previousOutcomesInherited") is not False or manifest.get("diagnosticsAndTargetedRunsExcludedFromFinalIdentityCounts") is not True:
        invalid.append("FRESH_RESULT_SCOPE_NOT_PROVEN")

    quality = summary.get("quality")
    if quality is None:
        quality = {}
    elif not isinstance(quality, dict):
        invalid.append("INVALID_QUALITY_EVIDENCE")
        quality = {}
    labels = {"lint", "typecheck", "test", "build", "content-validation", "ops-validation"}
    if labels - quality.keys() or any(quality.get(label) == "NOT_EXECUTED" for label in labels):
        incomplete.append("MISSING_OR_INCOMPLETE_QUALITY_EVIDENCE")
    if quality.keys() - labels or any(status not in ("PASS", "FAILED", "NOT_EXECUTED") for status in quality.values()):
        invalid.append("INVALID_QUALITY_EVIDENCE")
    if "FAILED" in quality.values():
        failed.append("FAILED_QUALITY_GATE")
    unit = summary.get("unitIntegration")
    if unit is None:
        unit = {}
    elif not isinstance(unit, dict):
        invalid.append("INVALID_UNIT_EVIDENCE")
        unit = {}
    if unit.get("status") == "NOT_EXECUTED" or any(type(unit.get(key)) is not int for key in ["required", "total", "passed", "failed", "pending"]):
        incomplete.append("MISSING_UNIT_EVIDENCE")
    else:
        if unit["required"] != 1185 or unit["total"] != 1185 or any(unit[key] < 0 for key in ["passed", "failed", "pending"]) or unit["passed"] + unit["failed"] + unit["pending"] != unit["total"]:
            invalid.append("INCONSISTENT_UNIT_COUNTS")
        if unit["failed"] or unit["pending"] or unit.get("status") == "FAILED":
            failed.append("FAILED_OR_SKIPPED_UNIT_GATE")
        if unit.get("status") not in ("PASS", "FAILED") or unit.get("status") == "PASS" and (unit["passed"] != 1185 or unit["failed"] or unit["pending"]):
            invalid.append("INCONSISTENT_UNIT_STATUS")
    for key in ["canonicalOverrides", "canonicalFixtures"]:
        value = summary.get(key)
        if value is None or value == []:
            incomplete.append("MISSING_" + key.upper() + "_PROVENANCE")
        elif not isinstance(value, list) or len(value) != 1 or not isinstance(value[0], dict):
            invalid.append("INVALID_" + key.upper() + "_PROVENANCE")
        if manifest.get(key) != value:
            invalid.append("INCONSISTENT_" + key.upper() + "_PROVENANCE")

    gate = "INVALID_EVIDENCE" if invalid else "FAILED" if failed else "INCOMPLETE" if incomplete else "PASS"
    return {"gateStatus": gate, "releaseVerdict": "RELEASE_GATE_PASS" if gate == "PASS" else "BLOCKED",
            "reportingIssues": invalid + failed + incomplete}


def validate_execution_report(manifest, summary):
    """Reject stale/forged headers before exporting any Release Candidate evidence."""
    expected = execution_report_status(manifest, summary)
    for document in [manifest, summary]:
        assert all(document.get(key) == value for key, value in expected.items()), "Executed manifest/summary status contradicts audited results"
    assert summary.get("status") == ("PASS" if expected["gateStatus"] == "PASS" else "INCOMPLETE_OR_FAILED"), "Execution summary status contradicts audited results"


def collect():
    with zipfile.ZipFile(ROOT / "inputs/Quddam-Phase-5.0J-2-RG02-frozen-checkpoint.zip") as z:
        manifest = json.loads(z.read("Quddam-Phase-5.0J-2-Test-Manifest.json"))
    all_cases = manifest["browserApi"]["cases"] + manifest["nativePostgres"]["cases"]
    source = json.loads((ROOT / "Source-Manifest.json").read_text())
    override = canonical_override()
    fixture = canonical_fixture()
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
            reported_file = spec.get("file")
            assert isinstance(reported_file, str) and reported_file, "Browser result must disclose its executed source file"
            reported_path = Path(reported_file)
            if reported_path.is_absolute():
                executed_path = reported_path.resolve()
            elif reported_file.startswith("qalba-platform/"):
                executed_path = (ROOT / reported_path).resolve()
            elif reported_file.startswith(("src/", "tests/")):
                executed_path = (ROOT / "qalba-platform" / reported_path).resolve()
            else:
                report_root = report.get("config", {}).get("rootDir")
                assert isinstance(report_root, str) and Path(report_root).is_absolute(), "Relative browser source requires its absolute report root"
                executed_path = (Path(report_root) / reported_path).resolve()
            if case["identity"] == CANONICAL_OVERRIDE_IDENTITY:
                assert override is not None, "Canonical 066 cannot be counted without approved runtime oracle provenance"
                assert executed_path == (ROOT / override["output"]).resolve(), "Canonical 066 executed an unapproved source file"
                config_file = report.get("config", {}).get("configFile")
                assert isinstance(config_file, str) and Path(config_file).is_absolute() and Path(config_file).resolve() == (ROOT / override["config"]).resolve(), "Canonical 066 executed an unapproved configuration"
                case.update(runtimeSource=override["output"], runtimeSourceSha256=override["outputSha256"],
                            executedReportedFile=reported_file, approvedOverride={"identity": override["identity"], "authorization": override["authorization"], "config": override["config"], "configSha256": override["configSha256"]})
            elif case["identity"] == CANONICAL_FIXTURE_IDENTITY:
                assert fixture is not None, "Canonical 184 requires audited HTTPS fixture provenance"
                assert executed_path == (ROOT / fixture["output"]).resolve(), "Canonical 184 executed an unapproved fixture"
                config_file = report.get("config", {}).get("configFile")
                assert isinstance(config_file, str) and Path(config_file).is_absolute() and Path(config_file).resolve() == (ROOT / fixture["config"]).resolve(), "Canonical 184 executed an unapproved configuration"
                case.update(runtimeSource=fixture["output"], runtimeSourceSha256=fixture["outputSha256"],
                            executedReportedFile=reported_file, approvedFixture=fixture)
            else:
                assert executed_path.is_relative_to(ROOT / "qalba-platform"), "Browser source is outside the frozen application"
                assert not executed_path.is_relative_to(ROOT / "qalba-platform/src/generated"), "Generated canonical oracle cannot execute another identity"
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
    manifest.update(finalCounts=counts, automaticRetries=retries, previousOutcomesInherited=False, diagnosticsAndTargetedRunsExcludedFromFinalIdentityCounts=True,
                    canonicalOverrides=[override] if override else [], canonicalFixtures=[fixture] if fixture else [])
    summary = {"counts": counts, "quality": quality, "unitIntegration": unit, "automaticRetries": retries, "firstFailures": failures, "auditErrors": audit_errors,
               "canonicalOverrides": [override] if override else [],
               "canonicalFixtures": [fixture] if fixture else [],
               "status": "PASS" if counts == {"canonical": {"PASS": 223}, "supplemental": {"PASS": 38}, "nativePostgres": {"PASS": 186}} and set(quality.values()) == {"PASS"} and unit["status"] == "PASS" and not retries and not failures and not audit_errors and override is not None and fixture is not None else "INCOMPLETE_OR_FAILED"}
    reporting = execution_report_status(manifest, summary)
    manifest.update(reporting)
    summary.update(reporting)
    if reporting["gateStatus"] != "PASS":
        summary["status"] = "INCOMPLETE_OR_FAILED"
    validate_execution_report(manifest, summary)
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
