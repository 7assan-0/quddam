"""Preparation checks only. Never execute or synthesize Quddam release PASS results."""
import ast
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import yaml
from baseline import ROOT, APP_SHA, verify, fingerprint, save, canonical_override, CANONICAL_OVERRIDE_IDENTITY
from evidence import redact_json, redact_text
from package import freeze, release, executable_files
from results import collect


class InfrastructureChecks(unittest.TestCase):
    def test_01_exact_frozen_source_and_harness(self):
        result = verify()
        self.assertEqual(result["authoredApplicationFiles"], 670)
        self.assertEqual(result["applicationFingerprint"], APP_SHA)
        self.assertEqual(result["harnessFingerprint"], "47704bed3bc1d25e1ce50f14d2a5b1eaad74c67d0598119d8d9ad73009a7ff52")

    def test_02_workflow_dependencies_and_manual_boundary(self):
        data = yaml.load((ROOT / ".github/workflows/quddam-rg03-release-verification.yml").read_text(), Loader=yaml.BaseLoader)
        self.assertEqual(data["on"], {"workflow_dispatch": ""})
        self.assertEqual(data["permissions"], {"contents": "read"})
        self.assertEqual(data["jobs"]["targeted-m05"]["needs"], "runtime-readiness")
        self.assertEqual(data["jobs"]["complete-final-gate"]["needs"], "targeted-m05")
        for job in data["jobs"].values():
            self.assertEqual(job["runs-on"], "ubuntu-24.04")
            self.assertEqual(job["services"]["postgres"]["image"], "postgres:16")
            self.assertIn("--health-cmd", job["services"]["postgres"]["options"])
            uploads = [x for x in job["steps"] if "actions/upload-artifact@" in x.get("uses", "")]
            self.assertEqual(len(uploads), 1)
            self.assertEqual(uploads[0]["if"], "${{ always() }}")
            self.assertEqual(uploads[0]["with"]["retention-days"], "14")
            self.assertEqual(uploads[0]["with"]["path"].strip().splitlines(), ["safe-artifacts/", "deliverables/"])
        forbidden = ["continue-on-error", "strategy:", "pull_request_target:", "contents: write", "deploy", "git push", "git commit"]
        for phrase in forbidden:
            self.assertNotIn(phrase, (ROOT / ".github/workflows/quddam-rg03-release-verification.yml").read_text().replace("# Manual verification only. No push/PR/deployment trigger, no repository write permission.", ""))

    def test_03_runtime_install_uses_exact_project_cli(self):
        action = yaml.load((ROOT / ".github/actions/rg03-runtime/action.yml").read_text(), Loader=yaml.BaseLoader)
        self.assertEqual(action["runs"]["using"], "composite")
        text = (ROOT / ".github/actions/rg03-runtime/action.yml").read_text()
        self.assertIn("node-version: '24.19.0'", text)
        self.assertIn("-- npm ci", text)
        self.assertNotIn("npm install", text)
        self.assertIn("node node_modules/playwright/cli.js install --with-deps chromium", text)
        self.assertNotIn("NODE_TLS_REJECT_UNAUTHORIZED", text)

    def test_04_syntax_only_python_node_bash(self):
        for p in (ROOT / "ci").glob("*.py"):
            ast.parse(p.read_text(), filename=str(p))
        for p in list((ROOT / "ci").glob("*.mjs")) + list((ROOT / "verification-tools").glob(".ci-*.mjs")):
            subprocess.run(["node", "--check", str(p)], check=True, capture_output=True)
        subprocess.run(["bash", "-n", str(ROOT / "ci/install-postgres.sh")], check=True)
        for p in (ROOT / ".github").rglob("*.yml"):
            obj = yaml.load(p.read_text(), Loader=yaml.BaseLoader)
            steps = obj.get("runs", {}).get("steps", []) + [s for j in obj.get("jobs", {}).values() for s in j["steps"]]
            for step in steps:
                if "run" in step:
                    subprocess.run(["bash", "-n"], input=step["run"], text=True, check=True, capture_output=True)

    def test_05_adapters_only_runtime_selection_stop_policy(self):
        audit = json.loads((ROOT / "receipts/CI-Adapter-Audit.json").read_text())
        self.assertEqual(len(audit["files"]), 6)
        self.assertTrue(audit["assertionsChanged"])
        self.assertFalse(audit["authoredAssertionsChanged"])
        self.assertFalse(audit["assertionTimeoutsChanged"])
        self.assertFalse(audit["mimeFunctionChanged"])
        override = canonical_override()
        self.assertEqual(override["identity"], CANONICAL_OVERRIDE_IDENTITY)
        self.assertEqual(override["canonicalNumber"], 66)
        old, replacement = override["edits"][0]
        source = (ROOT / override["input"]).read_text()
        self.assertEqual(old, source.splitlines()[42])
        self.assertIn('expect(r.map(r=>r.status()).sort()).toEqual([200,409]);', old)
        self.assertIn('expect(r[1].status()).toBe(409);', replacement)
        self.assertIn('expect(post.stateVersion).toBe(v.version+1);', replacement)
        self.assertIn('expect(post.state.outcomes).toEqual(pre.state.outcomes);', replacement)
        self.assertIn('expect(post.events).toBe(pre.events);', replacement)
        self.assertIn('expect(post.commands).toBe(pre.commands+1);', replacement)
        self.assertIn('expect(timeouts.rows[0].n).toBe(1);', replacement)
        self.assertTrue(replacement.endswith('expect((await read(page,id)).teams.map(t=>t.score)).toEqual(v.teams.map(t=>t.score));'))
        generated_config = (ROOT / override["config"]).read_text()
        self.assertIn("testDir:'.',testMatch:'rg03-forbidden-word.browser.ts'", generated_config)
        self.assertIn("timeout:60000,workers:1,retries:0,maxFailures:1", generated_config)
        self.assertIn("launchOptions:{slowMo:100", generated_config)
        frozen_files, _, _ = executable_files()
        self.assertEqual(frozen_files[override["output"]], override["outputSha256"])
        self.assertEqual(frozen_files[override["config"]], override["configSha256"])
        self.assertEqual(sum("--max-failures=1" in x["diff"] for x in audit["files"]), 5)
        for x in audit["files"]:
            subprocess.run(["node", "--check", str(ROOT / x["output"])], check=True, capture_output=True)
        text = (ROOT / "verification-tools/.ci-consolidated.mjs").read_text()
        self.assertIn('const override066=c.identity===', text)
        self.assertIn('executionFile=override066?join(root,approved066.output):c.file', text)
        self.assertIn("timeout:60000,workers:1,retries:0,maxFailures:1", text)
        self.assertIn("launchOptions:{slowMo:100", text)
        self.assertIn("--bail=1", (ROOT / "verification-tools/.ci-quality.mjs").read_text())
        self.assertIn("--retry=0", (ROOT / "verification-tools/.ci-quality.mjs").read_text())

    def test_06_authoritative_inventory_not_historical_results(self):
        manifest, summary = collect()
        self.assertEqual(summary["counts"], {"canonical": {"NOT_EXECUTED": 223}, "supplemental": {"NOT_EXECUTED": 38}, "nativePostgres": {"NOT_EXECUTED": 186}})
        self.assertEqual(set(summary["quality"].values()), {"NOT_EXECUTED"})
        self.assertEqual(summary["unitIntegration"]["status"], "NOT_EXECUTED")
        self.assertNotEqual(summary["status"], "PASS")
        self.assertFalse(manifest["previousOutcomesInherited"])
        self.assertEqual(manifest["nativePostgres"]["cases"][0]["identity"], "scripts/billing-settlement-postgres.ts::A/B concurrent paid")

    def test_07_m05_and_ten_related_identities(self):
        manifest = json.loads((ROOT / "Quddam-Phase-5.0J-2-Test-Manifest.json").read_text())
        wanted = "tests/e2e/public-ingress.spec.ts::M05 real reset mail flow is bounded, recovers and preserves one-use session invalidation"
        self.assertEqual(sum(x["identity"] == wanted for x in manifest["browserApi"]["cases"]), 1)
        related = [x for x in manifest["browserApi"]["cases"] if (x["file"] == "tests/e2e/public-ingress.spec.ts" and x["title"].startswith("M05 ") and x["identity"] != wanted) or x["file"] == "tests/e2e/host-auth-revocation.spec.ts"]
        self.assertEqual(len(related), 10)

    def test_08_freeze_refuses_absent_runtime_and_targeted_proof(self):
        self.assertFalse((ROOT / "receipts/Runtime-Readiness.json").exists())
        with self.assertRaises(FileNotFoundError):
            freeze()
        self.assertFalse((ROOT / "deliverables/Quddam-Phase-5.0J-2-RG03-frozen-checkpoint.zip").exists())

    def test_09_release_candidate_refuses_unexecuted_gate(self):
        with self.assertRaisesRegex(AssertionError, "Release Candidate forbidden"):
            release()
        self.assertFalse((ROOT / "deliverables/Quddam-Phase-5.0J-2-Release-Candidate.zip").exists())

    def test_10_redaction_preserves_required_integrity(self):
        data = {"applicationFingerprint": APP_SHA, "migrationFingerprints": {"prisma/migrations/test.sql": APP_SHA}, "run": {"sha": "a" * 40}, "password": "DO_NOT_EXPORT", "token": "DO_NOT_EXPORT", "cookies": [{"name": "qalba_session", "value": "DO_NOT_EXPORT"}]}
        safe = redact_json(data)
        self.assertEqual(safe["applicationFingerprint"], APP_SHA)
        self.assertEqual(safe["migrationFingerprints"]["prisma/migrations/test.sql"], APP_SHA)
        self.assertEqual(safe["run"]["sha"], "a" * 40)
        self.assertNotIn("DO_NOT_EXPORT", json.dumps(safe))
        for marker in ["Z" * 43, "b" * 64, "reset-new-password-123", "e2e-ingress-password-123"]:
            self.assertNotIn(marker, redact_text("Unexpected sensitive value: " + marker))
        self.assertNotIn("local-pass", redact_text("postgresql://test:local-pass@127.0.0.1/db"))

    def test_11_original_m13_capabilities_not_substituted(self):
        lifecycle = (ROOT / "verification-tools/lifecycle-runner.mjs").read_text()
        for needle in ["'pg_dump'", "'pg_restore'", "'initdb'", "'pg_ctl'", "'postgres'", "'verify-upgrade'", "'restore-check'"]:
            self.assertIn(needle, lifecycle)
        self.assertEqual(len([x for x in json.loads((ROOT / "Quddam-Phase-5.0J-2-Test-Manifest.json").read_text())["nativePostgres"]["cases"] if x["source"] == "scripts/database-lifecycle-postgres.ts"]), 23)

    def test_12_native_error_location_is_read_only(self):
        # This synthetic stack is ONLY a locator unit check, never release evidence.
        source = ROOT / "qalba-platform/scripts/billing-settlement-postgres.ts"
        line = next(i + 1 for i, x in enumerate(source.read_text().splitlines()) if "const f = await fixture(); const r = await race" in x)
        with tempfile.TemporaryDirectory(prefix="rg03-ci-locator-test-") as directory:
            log = Path(directory) / "synthetic-locator-only.log"
            log.write_text(f"Synthetic parser check; NOT_EXECUTED release identity\n    at async fixture ({source}:{line}:5)\n")
            result = subprocess.run(["node", str(ROOT / "ci/native-location.mjs"), "scripts/billing-settlement-postgres.ts", str(log)], capture_output=True, text=True, check=True)
            self.assertIn("originalStackLocations", json.loads(result.stdout))
        verify()


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(InfrastructureChecks)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    save(ROOT / "receipts/CI-Static-Validation.json", {"kind": "CI_INFRASTRUCTURE_PREPARATION_ONLY", "checksRun": result.testsRun, "failures": len(result.failures), "errors": len(result.errors), "skipped": len(result.skipped), "status": "PASS" if result.wasSuccessful() else "FAILED", "githubActionsExecuted": False, "mandatoryReleaseTestsExecuted": 0, "simulatedReleaseResults": False})
    raise SystemExit(0 if result.wasSuccessful() else 1)
