"""Meaningful mutation/rejection tests; fixtures are disposable Git repositories."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import verify


class SourceGuardTests(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(os.environ, {"GITHUB_ACTIONS": "false"})
        environment.start()
        self.addCleanup(environment.stop)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "candidate"
        self.root.mkdir()
        self.git("init", "-q")
        self.git("config", "user.email", "successor-test@example.invalid")
        self.git("config", "user.name", "Successor verifier test")
        (self.root / "qalba-platform/src").mkdir(parents=True)
        (self.root / "qalba-platform/src/app.ts").write_text("export const value = 1;\n")
        (self.root / "qalba-platform/package-lock.json").write_text("{}\n")
        (self.root / ".gitignore").write_text("hidden.ts\nqalba-platform/src/generated/\n")
        self.git("add", ".")
        self.git("commit", "-qm", "approved fixture")
        self.approved = self.git("rev-parse", "HEAD").strip()
        (self.root / "qalba-platform/src/app.ts").write_text("export const value = 2;\n")
        self.git("add", ".")
        self.git("commit", "-qm", "successor fixture")
        self.sha = self.git("rev-parse", "HEAD").strip()
        files, _ = verify.commit_inventory(self.root, self.sha)
        approved, _ = verify.commit_inventory(self.root, self.approved)
        application = {p.removeprefix("qalba-platform/"): h for p, h in files.items() if p.startswith("qalba-platform/")}
        self.manifest = {"schemaVersion": 1, "candidateSha": self.sha, "approvedRcSha": self.approved,
                         "fileCount": len(files), "sourceFingerprint": verify.fingerprint(files), "files": files,
                         "applicationFileCount": len(application), "applicationFingerprint": verify.fingerprint(application),
                         "sourceChangesFromApproved": [{"path": p, "change": "modified", "approvedSha256": approved[p], "candidateSha256": files[p]}
                                                      for p in sorted(files) if files[p] != approved[p]]}
        self.path = Path(self.temp.name) / "manifest.json"
        self.save()

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.root), *args], stderr=subprocess.PIPE).decode()

    def save(self):
        self.path.write_text(json.dumps(self.manifest))

    def check(self):
        return verify.verify(self.root, self.path, self.sha, self.approved)

    def reject(self, text):
        with self.assertRaisesRegex(verify.VerificationError, text):
            self.check()

    def test_exact_source_passes_and_reports_no_generated_verification(self):
        result = self.check()
        self.assertEqual(result["candidateSha"], self.sha)
        self.assertFalse(result["generatedArtifactsVerified"])

    def test_modified_source_fails(self):
        (self.root / "qalba-platform/src/app.ts").write_text("modified\n")
        self.reject("Source byte mismatch")

    def test_modified_lockfile_fails(self):
        (self.root / "qalba-platform/package-lock.json").write_text("modified\n")
        self.reject("Source byte mismatch")

    def test_deleted_source_fails(self):
        (self.root / "qalba-platform/src/app.ts").unlink()
        self.reject("Source byte mismatch")

    def test_untracked_authored_file_fails(self):
        (self.root / "qalba-platform/src/new.ts").write_text("unexpected\n")
        self.reject("Unexpected source file")

    def test_ignored_authored_file_fails(self):
        (self.root / "qalba-platform/src/hidden.ts").write_text("unexpected\n")
        self.reject("Unexpected source file")

    def test_generated_directory_cannot_hide_extra_authored_code(self):
        directory = self.root / "qalba-platform/src/generated"
        directory.mkdir()
        (directory / "hidden.ts").write_text("unexpected\n")
        self.reject("Unexpected source file")

    def test_known_generated_prisma_output_is_explicitly_excluded(self):
        directory = self.root / "qalba-platform/src/generated/prisma"
        directory.mkdir(parents=True)
        (directory / "client.ts").write_text("generated\n")
        self.assertFalse(self.check()["generatedArtifactsVerified"])

    def test_same_byte_symlink_fails(self):
        source = self.root / "qalba-platform/src/app.ts"
        target = Path(self.temp.name) / "same.ts"
        target.write_bytes(source.read_bytes())
        source.unlink()
        source.symlink_to(target)
        self.reject("Symlink source")

    def test_symlink_parent_fails(self):
        source = self.root / "qalba-platform/src"
        target = Path(self.temp.name) / "same-directory"
        source.rename(target)
        source.symlink_to(target, target_is_directory=True)
        self.reject("Symlink source")

    def test_generated_symlink_fails(self):
        (self.root / "qalba-platform/node_modules").symlink_to(Path(self.temp.name), target_is_directory=True)
        self.reject("Untracked symlink")

    def test_same_bytes_different_head_fails(self):
        self.git("commit", "--allow-empty", "-qm", "identical source, wrong identity")
        self.reject("HEAD is not the exact")

    def test_candidate_sha_tamper_fails(self):
        self.manifest["candidateSha"] = "0" * 40
        self.save()
        self.reject("pinned target")

    def test_manifest_bytes_cannot_rebind_source(self):
        path = "qalba-platform/src/app.ts"
        changed = b"different\n"
        (self.root / path).write_bytes(changed)
        self.manifest["files"][path] = verify.digest(changed)
        self.manifest["sourceFingerprint"] = verify.fingerprint(self.manifest["files"])
        self.save()
        self.reject("pinned Git source")

    def test_manifest_cannot_omit_a_file(self):
        del self.manifest["files"]["qalba-platform/package-lock.json"]
        self.manifest["fileCount"] -= 1
        self.manifest["sourceFingerprint"] = verify.fingerprint(self.manifest["files"])
        self.save()
        self.reject("pinned Git source")

    def test_wrong_count_fails(self):
        self.manifest["fileCount"] += 1
        self.save()
        self.reject("count mismatch")

    def test_wrong_fingerprint_fails(self):
        self.manifest["sourceFingerprint"] = "0" * 64
        self.save()
        self.reject("fingerprint mismatch")

    def test_wrong_application_inventory_fails(self):
        self.manifest["applicationFileCount"] += 1
        self.save()
        self.reject("Application inventory")

    def test_diff_tamper_fails(self):
        self.manifest["sourceChangesFromApproved"] = []
        self.save()
        self.reject("diff mismatch")

    def test_traversal_fails(self):
        self.manifest["files"]["../outside"] = "0" * 64
        self.save()
        self.reject("Unsafe inventory path")

    def test_duplicate_keys_fail(self):
        self.path.write_text('{"schemaVersion":1,"schemaVersion":1}')
        self.reject("Duplicate JSON key")

    def test_executable_mode_change_fails(self):
        (self.root / "qalba-platform/src/app.ts").chmod(0o755)
        self.reject("Source mode mismatch")

    def test_replace_refs_do_not_rebind_the_pinned_commit(self):
        self.git("replace", self.sha, self.approved)
        self.assertEqual(self.check()["candidateSha"], self.sha)

    def test_submodule_inventory_fails(self):
        self.git("update-index", "--add", "--cacheinfo", "160000," + self.sha + ",dependency")
        self.git("commit", "-qm", "unsupported gitlink")
        with self.assertRaisesRegex(verify.VerificationError, "Unsupported Git entry"):
            verify.commit_inventory(self.root, self.git("rev-parse", "HEAD").strip())

    def test_quality_rejects_preexisting_generated_code(self):
        generated = self.root / "qalba-platform/src/generated/prisma"
        generated.mkdir(parents=True)
        output = Path(self.temp.name) / "out"
        output.mkdir()
        with self.assertRaisesRegex(verify.VerificationError, "fresh checkout"):
            verify.run_quality(self.root, self.path, output, {"checks": []})

    def test_failed_preflight_writes_failed_receipt(self):
        output = Path(self.temp.name) / "out"
        with patch.object(verify, "verify_provenance"), patch.object(verify, "verify", side_effect=verify.VerificationError("mutation")):
            report = verify.record(self.root, self.path, False, output)
        self.assertEqual(report["status"], "FAILED")
        self.assertFalse(report["fullReleaseVerified"])
        self.assertEqual(json.loads((output / "summary.json").read_text())["status"], "FAILED")

    def test_successful_preflight_never_claims_full_release_pass(self):
        output = Path(self.temp.name) / "out"
        binding = {"sourceFingerprint": "fixture"}
        with patch.object(verify, "verify_provenance"), patch.object(verify, "verify", return_value=binding), patch.object(verify, "tooling_binding", return_value={"fingerprint": "tooling", "workingTreeModified": False}):
            report = verify.record(self.root, self.path, False, output)
        self.assertEqual(report["status"], "PASS")
        self.assertFalse(report["fullReleaseVerified"])
        self.assertEqual(set(report["releaseGroups"].values()), {"NOT_EXECUTED"})

    def test_tooling_change_during_run_fails(self):
        with patch.object(verify, "verify_provenance"), patch.object(verify, "verify", return_value={}), patch.object(verify, "tooling_binding", side_effect=[{"fingerprint": "before", "workingTreeModified": False}, {"fingerprint": "after", "workingTreeModified": False}]):
            report = verify.record(self.root, self.path, False, Path(self.temp.name) / "out")
        self.assertEqual(report["status"], "FAILED")

    def test_source_change_after_run_fails(self):
        with patch.object(verify, "verify_provenance"), patch.object(verify, "verify", side_effect=[{"source": "before"}, {"source": "after"}]), patch.object(verify, "tooling_binding", return_value={"workingTreeModified": False}):
            report = verify.record(self.root, self.path, False, Path(self.temp.name) / "out")
        self.assertEqual(report["status"], "FAILED")

    def test_receipt_directory_cannot_be_reused(self):
        output = Path(self.temp.name) / "out"
        output.mkdir()
        with self.assertRaises(FileExistsError):
            verify.record(self.root, self.path, False, output)

    def test_receipt_cannot_overwrite_candidate_files(self):
        with self.assertRaisesRegex(verify.VerificationError, "outside both checkouts"):
            verify.record(self.root, self.path, False, self.root / "receipts")

    def test_next_declaration_only_restores_known_transform(self):
        path = Path(self.temp.name) / "next-env.d.ts"
        original = b'import "./.next/dev/types/routes.d.ts";\n'
        path.write_bytes(original.replace(b"dev/types", b"types"))
        row = {}
        verify.restore_next_declaration(path, original, row)
        self.assertEqual(path.read_bytes(), original)
        self.assertEqual(row["nextDeclaration"]["restoredSha256"], verify.digest(original))

    def test_unexpected_next_declaration_change_is_not_hidden(self):
        path = Path(self.temp.name) / "next-env.d.ts"
        path.write_bytes(b"unexpected modified source")
        with self.assertRaisesRegex(verify.VerificationError, "Unexpected Next declaration transformation"):
            verify.restore_next_declaration(path, b"original", {})
        self.assertEqual(path.read_bytes(), b"unexpected modified source")

    def test_declaration_symlink_does_not_overwrite_its_target(self):
        target = Path(self.temp.name) / "target"
        target.write_bytes(b"unchanged")
        path = Path(self.temp.name) / "next-env.d.ts"
        path.symlink_to(target)
        with self.assertRaisesRegex(verify.VerificationError, "file type"):
            verify.restore_next_declaration(path, b"original", {})
        self.assertEqual(target.read_bytes(), b"unchanged")

    def test_ci_rejects_dirty_tooling(self):
        with patch.dict(os.environ, {"GITHUB_ACTIONS": "true"}), patch.object(verify, "verify_provenance"), patch.object(verify, "verify", return_value={}), patch.object(verify, "tooling_binding", return_value={"workingTreeModified": True}):
            report = verify.record(self.root, self.path, False, Path(self.temp.name) / "out")
        self.assertEqual(report["status"], "FAILED")
        self.assertIn("clean committed tooling", report["failure"])

    def test_ci_rejects_wrong_tooling_sha(self):
        with patch.dict(os.environ, {"GITHUB_ACTIONS": "true", "GITHUB_SHA": "dispatched"}), patch.object(verify, "verify_provenance"), patch.object(verify, "verify", return_value={}), patch.object(verify, "tooling_binding", return_value={"workingTreeModified": False, "checkoutSha": "other"}):
            report = verify.record(self.root, self.path, False, Path(self.temp.name) / "out")
        self.assertEqual(report["status"], "FAILED")
        self.assertIn("dispatched SHA", report["failure"])

    def test_receipt_is_incomplete_before_validation_finishes(self):
        output = Path(self.temp.name) / "out"
        def interrupted(_):
            self.assertEqual(json.loads((output / "summary.json").read_text())["status"], "INCOMPLETE")
            raise verify.VerificationError("interrupted")
        with patch.object(verify, "verify_provenance", side_effect=interrupted):
            report = verify.record(self.root, self.path, False, output)
        self.assertEqual(report["status"], "FAILED")

    def test_unit_fixtures_own_their_origin_without_changing_build_config(self):
        original = {"APP_URL": "https://successor.invalid", "DATABASE_URL": "synthetic"}
        self.assertNotIn("APP_URL", verify.check_environment(original, "unit"))
        self.assertEqual(verify.check_environment(original, "build")["APP_URL"], original["APP_URL"])
        self.assertEqual(verify.check_environment(original, "build")["NODE_ENV"], "production")
        self.assertEqual(original["APP_URL"], "https://successor.invalid")


if __name__ == "__main__":
    unittest.main()
