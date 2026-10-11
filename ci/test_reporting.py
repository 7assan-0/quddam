"""R-EVIDENCE-01 reporter component checks, never Quddam release verification.

All executions below are synthetic inputs to a pure reporting function. These
checks do not execute browser, native PostgreSQL, application, or release tests,
and their fabricated PASS records must never be used as release evidence.
"""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock
import zipfile

import package
import evidence as evidence_module
import results as results_module
from baseline import CANONICAL_FIXTURE_IDENTITY, CANONICAL_OVERRIDE_IDENTITY
from results import execution_report_status, validate_execution_report


ROOT = Path(__file__).resolve().parent.parent
SYNTHETIC_EVIDENCE = "CI_REPORTING_COMPONENT_ONLY_NOT_RELEASE_EVIDENCE"


class ReportingChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Inventory is authoritative; execution values are deliberately fake.
        with zipfile.ZipFile(ROOT / "inputs/Quddam-Phase-5.0J-2-RG02-frozen-checkpoint.zip") as archive:
            cls.inventory = json.loads(archive.read("Quddam-Phase-5.0J-2-Test-Manifest.json"))

    def complete(self):
        manifest = copy.deepcopy(self.inventory)
        for index, case in enumerate(self.cases(manifest)):
            case.update(execution="PASS", executedRetries=0,
                        executionEvidence=f"{SYNTHETIC_EVIDENCE}/{index:03}.json")
        counts = {"canonical": {"PASS": 223}, "supplemental": {"PASS": 38},
                  "nativePostgres": {"PASS": 186}}
        # collect() authenticates real source/configuration before reporting.
        # These small provenance objects are synthetic reporter inputs only.
        override = {"identity": CANONICAL_OVERRIDE_IDENTITY, "canonicalNumber": 66,
                    "componentFixture": SYNTHETIC_EVIDENCE}
        fixture = {"identity": CANONICAL_FIXTURE_IDENTITY, "canonicalNumber": 184,
                   "componentFixture": SYNTHETIC_EVIDENCE}
        manifest.update(finalCounts=copy.deepcopy(counts), automaticRetries=0,
                        previousOutcomesInherited=False,
                        diagnosticsAndTargetedRunsExcludedFromFinalIdentityCounts=True,
                        canonicalOverrides=[copy.deepcopy(override)],
                        canonicalFixtures=[copy.deepcopy(fixture)])
        summary = {"counts": copy.deepcopy(counts),
                   "quality": {name: "PASS" for name in
                               ["lint", "typecheck", "test", "build", "content-validation", "ops-validation"]},
                   "unitIntegration": {"status": "PASS", "required": 1185, "total": 1185,
                                       "passed": 1185, "failed": 0, "pending": 0},
                   "automaticRetries": 0, "firstFailures": [], "auditErrors": [],
                   "canonicalOverrides": [copy.deepcopy(override)],
                   "canonicalFixtures": [copy.deepcopy(fixture)], "status": "PASS"}
        return manifest, summary

    @staticmethod
    def cases(manifest):
        return manifest["browserApi"]["cases"] + manifest["nativePostgres"]["cases"]

    @staticmethod
    def refresh_counts(manifest, summary):
        def count(cases):
            counts = {}
            for case in cases:
                value = case["execution"]
                counts[value] = counts.get(value, 0) + 1
            return counts
        browser = manifest["browserApi"]["cases"]
        counts = {"canonical": count([c for c in browser if c["file"].startswith("tests/e2e/")]),
                  "supplemental": count([c for c in browser if not c["file"].startswith("tests/e2e/")]),
                  "nativePostgres": count(manifest["nativePostgres"]["cases"])}
        manifest["finalCounts"] = copy.deepcopy(counts)
        summary["counts"] = copy.deepcopy(counts)
        summary["status"] = "INCOMPLETE_OR_FAILED"

    def assert_blocked(self, manifest, summary, expected=None):
        report = execution_report_status(manifest, summary)
        self.assertIn(report["gateStatus"], {"FAILED", "INCOMPLETE", "INVALID_EVIDENCE"})
        self.assertEqual(report["releaseVerdict"], "BLOCKED")
        self.assertIsInstance(report["reportingIssues"], list)
        if expected is not None:
            self.assertEqual(report["gateStatus"], expected)
        return report

    @staticmethod
    def seal(manifest, summary):
        report = execution_report_status(manifest, summary)
        manifest.update(copy.deepcopy(report))
        summary.update(copy.deepcopy(report))
        summary["status"] = "PASS" if report["gateStatus"] == "PASS" else "INCOMPLETE_OR_FAILED"
        return report

    def test_complete_fresh_accounting_derives_pass(self):
        manifest, summary = self.complete()
        report = self.seal(manifest, summary)
        self.assertEqual(report, {"gateStatus": "PASS", "releaseVerdict": "RELEASE_GATE_PASS",
                                  "reportingIssues": []})
        validate_execution_report(manifest, summary)

    def test_each_mandatory_inventory_failure_blocks(self):
        for inventory in ["canonical", "supplemental", "nativePostgres"]:
            with self.subTest(inventory=inventory):
                manifest, summary = self.complete()
                if inventory == "nativePostgres":
                    case = manifest["nativePostgres"]["cases"][0]
                else:
                    case = next(c for c in manifest["browserApi"]["cases"]
                                if c["file"].startswith("tests/e2e/") == (inventory == "canonical"))
                case["execution"] = "FAILED"
                summary["firstFailures"] = [{"identity": case["identity"], "status": "FAILED"}]
                self.refresh_counts(manifest, summary)
                self.assert_blocked(manifest, summary, "FAILED")

    def test_not_executed_inventory_cannot_inherit_pass(self):
        manifest, summary = self.complete()
        for case in self.cases(manifest):
            case["execution"] = "NOT_EXECUTED"
            case.pop("executionEvidence")
            case.pop("executedRetries")
        summary["quality"] = {key: "NOT_EXECUTED" for key in summary["quality"]}
        summary["unitIntegration"] = {"status": "NOT_EXECUTED", "required": 1185}
        self.refresh_counts(manifest, summary)
        self.assert_blocked(manifest, summary, "INCOMPLETE")

    def test_partial_execution_is_incomplete(self):
        manifest, summary = self.complete()
        case = manifest["browserApi"]["cases"][0]
        case["execution"] = "NOT_EXECUTED"
        case.pop("executionEvidence")
        case.pop("executedRetries")
        self.refresh_counts(manifest, summary)
        self.assert_blocked(manifest, summary, "INCOMPLETE")

    def test_pass_without_execution_receipt_cannot_be_accepted(self):
        manifest, summary = self.complete()
        manifest["browserApi"]["cases"][0].pop("executionEvidence")
        self.assert_blocked(manifest, summary)

    def test_count_disagreement_is_invalid_evidence(self):
        for target in ["manifest", "summary"]:
            with self.subTest(target=target):
                manifest, summary = self.complete()
                counts = manifest["finalCounts"] if target == "manifest" else summary["counts"]
                counts["canonical"]["PASS"] = 222
                self.assert_blocked(manifest, summary, "INVALID_EVIDENCE")

    def test_pass_overcount_is_never_pass(self):
        manifest, summary = self.complete()
        manifest["finalCounts"]["canonical"]["PASS"] = 224
        summary["counts"]["canonical"]["PASS"] = 224
        self.assert_blocked(manifest, summary, "INVALID_EVIDENCE")

    def test_unit_under_and_overcount_never_pass(self):
        for total in [1184, 1186]:
            with self.subTest(total=total):
                manifest, summary = self.complete()
                summary["unitIntegration"].update(total=total, passed=total)
                self.assert_blocked(manifest, summary)

    def test_unit_failure_or_pending_never_pass(self):
        for name in ["failed", "pending"]:
            with self.subTest(field=name):
                manifest, summary = self.complete()
                summary["unitIntegration"].update(status="FAILED", passed=1184)
                summary["unitIntegration"][name] = 1
                self.assert_blocked(manifest, summary)

    def test_missing_unit_evidence_never_pass(self):
        manifest, summary = self.complete()
        summary["unitIntegration"] = {"status": "NOT_EXECUTED", "required": 1185}
        self.assert_blocked(manifest, summary)

    def test_missing_or_failed_quality_gate_never_pass(self):
        for key in ["lint", "typecheck", "test", "build", "content-validation", "ops-validation"]:
            for mode in ["missing", "FAILED", "NOT_EXECUTED"]:
                with self.subTest(gate=key, mode=mode):
                    manifest, summary = self.complete()
                    if mode == "missing":
                        summary["quality"].pop(key)
                    else:
                        summary["quality"][key] = mode
                    self.assert_blocked(manifest, summary)

    def test_missing_runtime_profile_never_pass(self):
        for key in ["canonicalOverrides", "canonicalFixtures"]:
            with self.subTest(profile=key):
                manifest, summary = self.complete()
                manifest[key] = []
                summary[key] = []
                self.assert_blocked(manifest, summary)

    def test_profile_disagreement_never_pass(self):
        manifest, summary = self.complete()
        summary["canonicalFixtures"][0]["identity"] = "SYNTHETIC_WRONG_IDENTITY"
        self.assert_blocked(manifest, summary)

    def test_skip_retry_audit_error_and_flaky_error_never_pass(self):
        for mode in ["skip", "retry", "audit-error", "flaky"]:
            with self.subTest(mode=mode):
                manifest, summary = self.complete()
                case = manifest["browserApi"]["cases"][0]
                if mode == "skip":
                    case["execution"] = "SKIPPED"
                    self.refresh_counts(manifest, summary)
                elif mode == "retry":
                    case["executedRetries"] = 1
                    manifest["automaticRetries"] = summary["automaticRetries"] = 1
                else:
                    summary["auditErrors"] = [{"error": "Unresolved flaky result" if mode == "flaky" else "Synthetic audit error"}]
                self.assert_blocked(manifest, summary)

    def test_validator_rejects_stale_headers_in_either_output(self):
        for target in ["manifest", "summary"]:
            with self.subTest(target=target):
                manifest, summary = self.complete()
                self.seal(manifest, summary)
                document = manifest if target == "manifest" else summary
                document.update(gateStatus="NOT_STARTED", releaseVerdict="NOT_DETERMINED")
                with self.assertRaises(AssertionError):
                    validate_execution_report(manifest, summary)

    def test_validator_rejects_forged_pass_for_incomplete_evidence(self):
        manifest, summary = self.complete()
        case = manifest["browserApi"]["cases"][0]
        case["execution"] = "NOT_EXECUTED"
        case.pop("executionEvidence")
        self.refresh_counts(manifest, summary)
        forged = {"gateStatus": "PASS", "releaseVerdict": "RELEASE_GATE_PASS", "reportingIssues": []}
        manifest.update(copy.deepcopy(forged))
        summary.update(copy.deepcopy(forged), status="PASS")
        with self.assertRaises(AssertionError):
            validate_execution_report(manifest, summary)

    def test_validator_rejects_missing_header_or_wrong_summary_status(self):
        for mode in ["missing-header", "wrong-summary-status", "different-issues"]:
            with self.subTest(mode=mode):
                manifest, summary = self.complete()
                self.seal(manifest, summary)
                if mode == "missing-header":
                    manifest.pop("releaseVerdict")
                elif mode == "wrong-summary-status":
                    summary["status"] = "INCOMPLETE_OR_FAILED"
                else:
                    summary["reportingIssues"] = ["SYNTHETIC_UNRECONCILED_REPORT"]
                with self.assertRaises(AssertionError):
                    validate_execution_report(manifest, summary)

    def test_valid_nonpass_report_does_not_become_pass(self):
        manifest, summary = self.complete()
        manifest["browserApi"]["cases"][0]["execution"] = "FAILED"
        self.refresh_counts(manifest, summary)
        report = self.seal(manifest, summary)
        self.assertEqual(report["gateStatus"], "FAILED")
        self.assertEqual(summary["status"], "INCOMPLETE_OR_FAILED")
        validate_execution_report(manifest, summary)

    def test_packaging_rejects_stale_headers_before_export(self):
        manifest, summary = self.complete()
        self.seal(manifest, summary)
        manifest.update(gateStatus="NOT_STARTED", releaseVerdict="NOT_DETERMINED")
        # Every real I/O boundary is mocked or isolated. No release evidence or
        # candidate is created by this negative packaging component check.
        with tempfile.TemporaryDirectory(prefix="rg03-reporting-component-only-") as directory:
            with mock.patch.object(package, "ROOT", Path(directory)), \
                    mock.patch.object(package, "verify", return_value={"kind": SYNTHETIC_EVIDENCE}), \
                    mock.patch.object(package, "collect", return_value=(manifest, summary)), \
                    mock.patch.object(package, "export") as export, \
                    mock.patch.object(package, "archive") as archive, \
                    mock.patch.object(package, "bundle") as bundle:
                with self.assertRaises(AssertionError):
                    package.release()
                export.assert_not_called()
                archive.assert_not_called()
                bundle.assert_not_called()

    def test_packaging_rejects_changed_saved_manifest_before_export(self):
        manifest, summary = self.complete()
        self.seal(manifest, summary)
        changed = copy.deepcopy(manifest)
        changed["finalCounts"]["canonical"]["PASS"] = 222
        with tempfile.TemporaryDirectory(prefix="rg03-reporting-component-only-") as directory:
            root = Path(directory)
            saved = root / "results/Quddam-Phase-5.0J-2-Test-Manifest.json"
            saved.parent.mkdir()
            saved.write_text(json.dumps(changed))
            with mock.patch.object(package, "ROOT", root), \
                    mock.patch.object(package, "verify", return_value={"kind": SYNTHETIC_EVIDENCE}), \
                    mock.patch.object(package, "collect", return_value=(manifest, summary)), \
                    mock.patch.object(package, "export") as export, \
                    mock.patch.object(package, "archive") as archive, \
                    mock.patch.object(package, "bundle") as bundle:
                with self.assertRaisesRegex(AssertionError, "Packaged executed manifest differs"):
                    package.release()
                export.assert_not_called()
                archive.assert_not_called()
                bundle.assert_not_called()

    def test_collect_writes_incomplete_reports_without_changing_inventory(self):
        # Real collector wiring with no actual result artifacts. This is not a
        # release execution and fabricates no mandatory PASS evidence.
        with tempfile.TemporaryDirectory(prefix="rg03-reporting-unexecuted-only-") as directory:
            root = Path(directory)
            inputs = root / "inputs"
            inputs.mkdir()
            name = "Quddam-Phase-5.0J-2-RG02-frozen-checkpoint.zip"
            (inputs / name).write_bytes((ROOT / "inputs" / name).read_bytes())
            (root / "Source-Manifest.json").write_bytes((ROOT / "Source-Manifest.json").read_bytes())
            inventory = root / "Quddam-Phase-5.0J-2-Test-Manifest.json"
            inventory_bytes = (ROOT / inventory.name).read_bytes()
            inventory.write_bytes(inventory_bytes)
            with mock.patch.object(results_module, "ROOT", root), \
                    mock.patch.object(results_module, "canonical_override", return_value=None), \
                    mock.patch.object(results_module, "canonical_fixture", return_value=None):
                manifest, summary = results_module.collect()
            self.assertEqual(inventory.read_bytes(), inventory_bytes)
            saved_manifest = json.loads((root / "results/Quddam-Phase-5.0J-2-Test-Manifest.json").read_text())
            saved_summary = json.loads((root / "results/Final-Execution-Summary.json").read_text())
            self.assertEqual(saved_manifest, manifest)
            self.assertEqual(saved_summary, summary)
            self.assertEqual(summary["counts"], {"canonical": {"NOT_EXECUTED": 223},
                                               "supplemental": {"NOT_EXECUTED": 38},
                                               "nativePostgres": {"NOT_EXECUTED": 186}})
            self.assertEqual(summary["status"], "INCOMPLETE_OR_FAILED")
            for key in ["gateStatus", "releaseVerdict", "reportingIssues"]:
                self.assertEqual(manifest[key], summary[key])
            self.assertEqual(manifest["gateStatus"], "INCOMPLETE")
            self.assertEqual(manifest["releaseVerdict"], "BLOCKED")
            self.assertEqual({c["execution"] for c in self.cases(manifest)}, {"NOT_EXECUTED"})

    def test_bundle_keeps_inventory_and_scopes_synthetic_executed_reports(self):
        manifest, summary = self.complete()
        self.seal(manifest, summary)
        inventory_name = "Quddam-Phase-5.0J-2-Test-Manifest.json"
        inventory_bytes = (ROOT / inventory_name).read_bytes()
        manifest_path = "results/" + inventory_name
        summary_path = "results/Final-Execution-Summary.json"
        captured = {manifest_path: json.dumps(manifest).encode(),
                    summary_path: json.dumps(summary).encode()}
        with tempfile.TemporaryDirectory(prefix="rg03-reporting-bundle-component-only-") as directory:
            root = Path(directory)
            (root / inventory_name).write_bytes(inventory_bytes)
            # A reporter-component archive only, never a Release Candidate.
            output = root / "reporter-component.zip"
            with mock.patch.object(package, "ROOT", root):
                package.bundle(output, {}, [inventory_name], executed_reports=captured)
                with zipfile.ZipFile(output) as archive:
                    self.assertIsNone(archive.testzip())
                    self.assertEqual(len(archive.namelist()), len(set(archive.namelist())))
                    self.assertEqual(archive.read(inventory_name), inventory_bytes)
                    self.assertEqual(archive.read(manifest_path), captured[manifest_path])
                    self.assertEqual(archive.read(summary_path), captured[summary_path])
                    validate_execution_report(json.loads(archive.read(manifest_path)),
                                              json.loads(archive.read(summary_path)))
                with self.assertRaisesRegex(AssertionError, "cannot replace frozen inventory/source"):
                    package.bundle(root / "rejected-component.zip", {}, [inventory_name],
                                   executed_reports={inventory_name: captured[manifest_path]})
            self.assertEqual((root / inventory_name).read_bytes(), inventory_bytes)

    def test_null_quality_and_unit_evidence_are_incomplete(self):
        for key in ["quality", "unitIntegration"]:
            with self.subTest(field=key):
                manifest, summary = self.complete()
                summary[key] = None
                self.assert_blocked(manifest, summary, "INCOMPLETE")

    def test_malformed_quality_and_unit_containers_are_invalid(self):
        for key in ["quality", "unitIntegration"]:
            for value in [[], "SYNTHETIC_WRONG_TYPE", 1, False]:
                with self.subTest(field=key, value=value):
                    manifest, summary = self.complete()
                    summary[key] = value
                    self.assert_blocked(manifest, summary, "INVALID_EVIDENCE")

    def test_nonstring_execution_status_is_invalid_without_counter_error(self):
        for value in [None, [], {}, 1, False]:
            with self.subTest(value=value):
                manifest, summary = self.complete()
                manifest["browserApi"]["cases"][0]["execution"] = value
                self.assert_blocked(manifest, summary, "INVALID_EVIDENCE")

    def test_nonstring_quality_and_unit_status_are_invalid(self):
        for key in ["quality", "unitIntegration"]:
            for value in [None, [], {}, 1, False]:
                with self.subTest(field=key, value=value):
                    manifest, summary = self.complete()
                    summary[key]["lint" if key == "quality" else "status"] = value
                    self.assert_blocked(manifest, summary, "INVALID_EVIDENCE")

    def test_malformed_profile_shapes_are_invalid(self):
        for key in ["canonicalOverrides", "canonicalFixtures"]:
            for value in [{}, "SYNTHETIC_WRONG_TYPE", False, [None], [[]], [{}, {}]]:
                with self.subTest(profile=key, value=value):
                    manifest, summary = self.complete()
                    manifest[key] = copy.deepcopy(value)
                    summary[key] = copy.deepcopy(value)
                    self.assert_blocked(manifest, summary, "INVALID_EVIDENCE")

    @staticmethod
    def write_component_reports(root, manifest, summary):
        results = root / "results"
        results.mkdir()
        (results / "Quddam-Phase-5.0J-2-Test-Manifest.json").write_text(json.dumps(manifest))
        (results / "Final-Execution-Summary.json").write_text(json.dumps(summary))

    def test_actual_evidence_export_binds_reports_and_preserves_inventory(self):
        manifest, summary = self.complete()
        self.seal(manifest, summary)
        inventory_name = "Quddam-Phase-5.0J-2-Test-Manifest.json"
        inventory_bytes = (ROOT / inventory_name).read_bytes()
        with tempfile.TemporaryDirectory(prefix="rg03-reporter-export-component-only-") as directory:
            root = Path(directory)
            self.write_component_reports(root, manifest, summary)
            (root / inventory_name).write_bytes(inventory_bytes)
            with mock.patch.object(evidence_module, "ROOT", root):
                safe = evidence_module.export()
            exported_manifest = json.loads((safe / "results" / inventory_name).read_text())
            exported_summary = json.loads((safe / "results/Final-Execution-Summary.json").read_text())
            self.assertEqual(exported_manifest, evidence_module.redact_json(manifest))
            self.assertEqual(exported_summary, evidence_module.redact_json(summary))
            validate_execution_report(exported_manifest, exported_summary)
            for key in ["gateStatus", "releaseVerdict", "reportingIssues"]:
                self.assertEqual(exported_manifest[key], exported_summary[key])
            self.assertEqual((root / inventory_name).read_bytes(), inventory_bytes)

    def test_packaging_rejects_changed_or_missing_safe_reports_before_archiving(self):
        modes = ["evidence-path", "extra-summary-metadata", "missing-manifest", "missing-summary",
                 "stale-headers", "malformed-manifest", "malformed-summary"]
        for mode in modes:
            with self.subTest(mode=mode):
                manifest, summary = self.complete()
                self.seal(manifest, summary)
                with tempfile.TemporaryDirectory(prefix="rg03-reporter-binding-component-only-") as directory:
                    root = Path(directory)
                    self.write_component_reports(root, manifest, summary)
                    receipts = root / "receipts"
                    receipts.mkdir()
                    # Synthetic packaging control inputs only. No task, native
                    # command, browser, application or release gate is run.
                    (receipts / "Phase-full.json").write_text(json.dumps({
                        "kind": SYNTHETIC_EVIDENCE, "status": "PASS",
                        "tasks": [{"label": f"{SYNTHETIC_EVIDENCE}/{i}", "status": "PASS"}
                                  for i in range(9)]}))
                    (receipts / "Runtime-Readiness.json").write_text(json.dumps({
                        "kind": SYNTHETIC_EVIDENCE, "status": "PASS"}))
                    (receipts / "RG03-Freeze.json").write_text(json.dumps({
                        "kind": SYNTHETIC_EVIDENCE, "files": {},
                        "canonicalOverrides": manifest["canonicalOverrides"],
                        "canonicalFixtures": manifest["canonicalFixtures"]}))
                    inventory_name = "Quddam-Phase-5.0J-2-Test-Manifest.json"
                    inventory_bytes = (ROOT / inventory_name).read_bytes()
                    (root / inventory_name).write_bytes(inventory_bytes)

                    def changed_export():
                        safe = evidence_module.export()
                        mpath = safe / "results" / inventory_name
                        spath = safe / "results/Final-Execution-Summary.json"
                        if mode in ["evidence-path", "extra-summary-metadata", "stale-headers"]:
                            safe_manifest = json.loads(mpath.read_text())
                            safe_summary = json.loads(spath.read_text())
                            if mode == "evidence-path":
                                safe_manifest["browserApi"]["cases"][0]["executionEvidence"] = "SYNTHETIC_TAMPERED_EVIDENCE/000.json"
                            elif mode == "extra-summary-metadata":
                                safe_summary["unauditedMetadata"] = "SYNTHETIC_TAMPER"
                            else:
                                safe_manifest.update(gateStatus="NOT_STARTED", releaseVerdict="NOT_DETERMINED")
                            # These two corruptions retain internally consistent
                            # PASS headers/counts. Exact audited-content binding,
                            # beyond status validation, must reject them.
                            if mode in ["evidence-path", "extra-summary-metadata"]:
                                validate_execution_report(safe_manifest, safe_summary)
                            mpath.write_text(json.dumps(safe_manifest))
                            spath.write_text(json.dumps(safe_summary))
                        elif mode == "missing-manifest":
                            mpath.unlink()
                        elif mode == "missing-summary":
                            spath.unlink()
                        elif mode == "malformed-manifest":
                            mpath.write_text("{SYNTHETIC_NOT_JSON")
                        else:
                            spath.write_text("{SYNTHETIC_NOT_JSON")
                        return safe

                    with mock.patch.object(package, "ROOT", root), \
                            mock.patch.object(evidence_module, "ROOT", root), \
                            mock.patch.object(package, "verify", return_value={"kind": SYNTHETIC_EVIDENCE}), \
                            mock.patch.object(package, "collect", return_value=(manifest, summary)), \
                            mock.patch.object(package, "executable_files", return_value=({}, {}, {})), \
                            mock.patch.object(package, "canonical_override", return_value=manifest["canonicalOverrides"][0]), \
                            mock.patch.object(package, "canonical_fixture", return_value=manifest["canonicalFixtures"][0]), \
                            mock.patch.object(package, "export", side_effect=changed_export), \
                            mock.patch.object(package, "archive") as archive, \
                            mock.patch.object(package, "bundle") as bundle:
                        if mode in ["evidence-path", "extra-summary-metadata", "stale-headers"]:
                            with self.assertRaisesRegex(AssertionError, "Exported executed reports differ from audited results"):
                                package.release()
                        else:
                            with self.assertRaises((FileNotFoundError, json.JSONDecodeError)):
                                package.release()
                        archive.assert_not_called()
                        bundle.assert_not_called()
                    self.assertEqual((root / inventory_name).read_bytes(), inventory_bytes)


if __name__ == "__main__":
    unittest.main(verbosity=2)
