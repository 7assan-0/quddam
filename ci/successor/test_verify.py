"""Meaningful mutation/rejection tests; fixtures are disposable Git repositories."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zlib

import verify


class SourceFixture:
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
        environment = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        return subprocess.check_output(["git", "-C", str(self.root), *args], stderr=subprocess.PIPE,
                                       env=environment).decode()

    def save(self):
        self.path.write_text(json.dumps(self.manifest))

    def check(self):
        return verify.verify(self.root, self.path, self.sha, self.approved)

    def reject(self, text):
        with self.assertRaisesRegex(verify.VerificationError, text):
            self.check()


class SourceGuardTests(SourceFixture, unittest.TestCase):
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
        with patch.object(verify, "verify_provenance"), patch.object(verify, "verify", side_effect=verify.VerificationError("mutation")) as source, \
                patch.object(verify, "tooling_binding", return_value={"workingTreeModified": False}):
            report = verify.record(self.root, self.path, False, output)
        source.assert_called_once()
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
        with patch.object(verify, "verify_provenance", side_effect=interrupted) as provenance, \
                patch.object(verify, "tooling_binding", return_value={"workingTreeModified": False}):
            report = verify.record(self.root, self.path, False, output)
        provenance.assert_called_once()
        self.assertEqual(report["status"], "FAILED")

    def test_unit_fixtures_own_their_origin_without_changing_build_config(self):
        original = {"APP_URL": "https://successor.invalid", "DATABASE_URL": "synthetic"}
        self.assertNotIn("APP_URL", verify.check_environment(original, "unit"))
        self.assertEqual(verify.check_environment(original, "build")["APP_URL"], original["APP_URL"])
        self.assertEqual(verify.check_environment(original, "build")["NODE_ENV"], "production")
        self.assertEqual(original["APP_URL"], "https://successor.invalid")


class ToolingIntegrityTests(SourceFixture, unittest.TestCase):
    """Use real Git objects and index flags; never mock the tooling binding."""

    def setUp(self):
        super().setUp()
        self.source_verifier = verify.verify
        self.tooling = Path(self.temp.name) / "tooling"
        self.tooling.mkdir()
        self.tool_git("init", "-q")
        self.tool_git("config", "user.email", "successor-test@example.invalid")
        self.tool_git("config", "user.name", "Successor tooling test")
        directory = self.tooling / "ci/successor"
        shutil.copytree(verify.TOOLING / "ci/successor", directory,
                        ignore=shutil.ignore_patterns("__pycache__"))
        workflow = ".github/workflows/quddam-successor-verification.yml"
        (self.tooling / workflow).parent.mkdir(parents=True)
        shutil.copyfile(verify.TOOLING / workflow, self.tooling / workflow)
        self.tool_git("add", ".")
        self.tool_git("commit", "-qm", "literal tooling fixture")
        self.tooling_sha = self.tool_git("rev-parse", "HEAD").strip()
        self.literal_files = {
            p.relative_to(self.tooling).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in self.tooling.rglob("*") if p.is_file() and ".git" not in p.relative_to(self.tooling).parts
        }
        self.literal_objects = {}
        for path, sha in self.literal_files.items():
            row = self.tool_git("ls-tree", "HEAD", "--", path).split()
            self.literal_objects[path] = {"mode": row[0], "objectId": row[2], "sha256": sha}
        self.manifest["approvedProvenanceSha256"] = verify.digest(
            (directory / "approved-rc-provenance.json").read_bytes())
        self.save()

    def tool_git(self, *args):
        return self.tool_git_bytes(*args).decode()

    def tool_git_bytes(self, *args, input=None):
        environment = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        return subprocess.check_output(["git", "-C", str(self.tooling), *args], stderr=subprocess.PIPE,
                                       input=input, env=environment)

    def corrupt_loose_object(self, oid, kind, data):
        """Place well-formed content under a different literal object identity."""
        payload = kind.encode() + b" " + str(len(data)).encode() + b"\0" + data
        self.assertNotEqual(hashlib.sha1(payload).hexdigest(), oid)
        storage = self.tooling / ".git/objects" / oid[:2] / oid[2:]
        storage.chmod(0o600)
        storage.write_bytes(zlib.compress(payload))
        # Git itself will serve the bytes, but an independent integrity check
        # confirms their stored object name no longer matches their contents.
        self.assertEqual(self.tool_git_bytes("cat-file", kind, oid), data)
        result = subprocess.run(["git", "-C", str(self.tooling), "fsck", "--no-reflogs"],
                                capture_output=True, text=True, timeout=3)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("hash-path mismatch", result.stdout + result.stderr)

    def binding(self):
        with patch.object(verify, "TOOLING", self.tooling):
            return verify.tooling_binding()

    def record_fixture(self, name="out", ci=True, dispatched_sha=None):
        environment = {"GITHUB_ACTIONS": "true" if ci else "false",
                       "GITHUB_SHA": self.tooling_sha if dispatched_sha is None else dispatched_sha}
        output = Path(self.temp.name) / name
        # Source verification still reads the real candidate objects and bytes;
        # only its production pins are replaced by these disposable commit IDs.
        def fixture_source(root, manifest):
            return self.source_verifier(root, manifest, self.sha, self.approved)
        with patch.dict(os.environ, environment), patch.object(verify, "TOOLING", self.tooling), \
                patch.object(verify, "verify", side_effect=fixture_source):
            report = verify.record(self.root, self.path, False, output)
        self.assertEqual(json.loads((output / "summary.json").read_text()), report)
        return report

    def assert_rejected_receipt(self, **kwargs):
        report = self.record_fixture(**kwargs)
        self.assertEqual(report["status"], "FAILED")
        self.assertFalse(report["fullReleaseVerified"])
        self.assertNotEqual(report.get("toolingEvidence"), "committed")
        self.assertIn("finishedAtUTC", report)
        return report

    def test_clean_tooling_is_bound_to_literal_commit_objects(self):
        with patch.dict(os.environ, {"GITHUB_ACTIONS": "true", "GITHUB_SHA": self.tooling_sha}):
            binding = self.binding()
        self.assertEqual(binding["expectedSha"], self.tooling_sha)
        self.assertEqual(binding["checkoutSha"], self.tooling_sha)
        self.assertFalse(binding["workingTreeModified"])
        self.assertEqual(binding["files"], self.literal_files)
        self.assertEqual(binding["committedFiles"], self.literal_files)
        self.assertEqual(binding["committedObjects"], self.literal_objects)
        self.assertEqual(binding["modes"], {p: entry["mode"] for p, entry in self.literal_objects.items()})
        self.assertEqual(binding["fingerprint"], verify.fingerprint(self.literal_files))
        self.assertEqual(binding["committedFingerprint"], binding["fingerprint"])
        self.assertEqual(binding["treeObjectId"], self.tool_git("rev-parse", "HEAD^{tree}").strip())
        report = self.record_fixture()
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["toolingEvidence"], "committed")

    def test_local_binding_uses_literal_head_and_rejects_dirty_tooling(self):
        with patch.dict(os.environ, {"GITHUB_SHA": "f" * 40}):
            self.assertEqual(self.binding()["expectedSha"], self.tooling_sha)
        path = self.tooling / "ci/successor/verify.py"
        path.write_bytes(path.read_bytes() + b"\n# local modification\n")
        self.assert_rejected_receipt(ci=False)

    def test_binding_ignores_inherited_git_repository_and_index_overrides(self):
        foreign_index = self.root / ".git/index"
        with patch.dict(os.environ, {"GIT_DIR": str(self.root / ".git"),
                                     "GIT_WORK_TREE": str(self.root),
                                     "GIT_INDEX_FILE": str(foreign_index)}):
            binding = self.binding()
        self.assertEqual(binding["expectedSha"], self.tooling_sha)
        self.assertEqual(binding["committedObjects"], self.literal_objects)

    def test_ci_rejects_changed_verifier_hidden_by_index_flags(self):
        path = "ci/successor/verify.py"
        original = (self.tooling / path).read_bytes()
        for flag in ("assume-unchanged", "skip-worktree"):
            with self.subTest(flag=flag):
                self.tool_git("update-index", "--" + flag, path)
                try:
                    (self.tooling / path).write_bytes(original + b"\n# hidden mutation\n")
                    self.assertEqual(self.tool_git("status", "--porcelain"), "")
                    self.assert_rejected_receipt(name="hidden-" + flag)
                finally:
                    (self.tooling / path).write_bytes(original)
                    self.tool_git("update-index", "--no-" + flag, path)

    def test_ci_rejects_wrong_dispatched_sha_before_committed_evidence(self):
        self.tool_git("commit", "--allow-empty", "-qm", "identical tooling, different commit identity")
        report = self.assert_rejected_receipt(dispatched_sha=self.tooling_sha)
        self.assertIn("dispatched SHA", report["failure"])

    def test_ci_requires_a_full_hex_dispatched_sha(self):
        for sha in ("", "HEAD", self.tooling_sha[:12], "g" * 40):
            with self.subTest(sha=sha):
                self.assert_rejected_receipt(name="dispatch-" + sha[:12], dispatched_sha=sha)

    def test_ci_binding_rejects_missing_dispatched_sha(self):
        with patch.dict(os.environ, {"GITHUB_ACTIONS": "true"}):
            os.environ.pop("GITHUB_SHA", None)
            with self.assertRaises(verify.VerificationError):
                self.binding()

    def test_ci_rejects_executable_mode_hidden_by_git_configuration(self):
        self.tool_git("config", "core.filemode", "false")
        (self.tooling / "ci/successor/verify.py").chmod(0o755)
        self.assertEqual(self.tool_git("status", "--porcelain"), "")
        self.assert_rejected_receipt()

    def test_ci_rejects_missing_tooling_hidden_by_skip_worktree(self):
        path = "ci/successor/README.md"
        self.tool_git("update-index", "--skip-worktree", path)
        (self.tooling / path).unlink()
        self.assertEqual(self.tool_git("status", "--porcelain"), "")
        self.assert_rejected_receipt()

    def test_ci_rejects_ignored_extra_tooling_files(self):
        (self.tooling / ".git/info/exclude").write_text("ci/successor/extra.py\nci/successor/nested/\n")
        for relative in ("ci/successor/extra.py", "ci/successor/nested/extra.py"):
            with self.subTest(path=relative):
                path = self.tooling / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("unexpected authored tooling\n")
                try:
                    self.assertEqual(self.tool_git("status", "--porcelain"), "")
                    self.assert_rejected_receipt(name="extra-" + path.parent.name)
                finally:
                    path.unlink()

    def test_ci_rejects_ignored_directory_symlink_tooling(self):
        target = Path(self.temp.name) / "outside-tooling"
        target.mkdir()
        (target / "injected.py").write_text("unexpected tooling\n")
        (self.tooling / ".git/info/exclude").write_text("ci/successor/alias\n")
        (self.tooling / "ci/successor/alias").symlink_to(target, target_is_directory=True)
        self.assertEqual(self.tool_git("status", "--porcelain"), "")
        self.assert_rejected_receipt()

    def test_binding_rejects_committed_gitlink_in_tooling_inventory(self):
        self.tool_git("update-index", "--add", "--cacheinfo", "160000," + self.tooling_sha + ",ci/successor/dependency")
        self.tool_git("commit", "-qm", "unsupported tooling gitlink")
        with self.assertRaises(verify.VerificationError):
            self.binding()

    def test_corrupt_tooling_tree_cannot_rebind_changed_readme_bytes(self):
        path = self.tooling / "ci/successor/README.md"
        path.write_bytes(path.read_bytes() + b"\nAltered tree object fixture\n")
        new_blob = self.tool_git_bytes("hash-object", "-w", "--stdin", input=path.read_bytes()).decode().strip()
        tree_oid = self.tool_git("rev-parse", self.tooling_sha + ":ci/successor").strip()
        tree = self.tool_git_bytes("cat-file", "tree", tree_oid)
        old_blob = self.literal_objects["ci/successor/README.md"]["objectId"]
        old_entry = b"100644 README.md\0" + bytes.fromhex(old_blob)
        self.assertEqual(tree.count(old_entry), 1)
        changed = tree.replace(old_entry, b"100644 README.md\0" + bytes.fromhex(new_blob))
        self.corrupt_loose_object(tree_oid, "tree", changed)
        report = self.assert_rejected_receipt()
        self.assertRegex(report["failure"], r"Git.*(?:identity|hash).*mismatch")

    def test_corrupt_tooling_commit_cannot_keep_the_dispatched_identity(self):
        commit = self.tool_git_bytes("cat-file", "commit", self.tooling_sha)
        changed = commit + b"\nAltered commit metadata fixture\n"
        self.corrupt_loose_object(self.tooling_sha, "commit", changed)
        report = self.assert_rejected_receipt()
        self.assertTrue(report["failure"])
        self.assertNotIn("Altered commit metadata fixture", report["failure"])
        self.assertNotIn(str(self.tooling), report["failure"])

    def test_fifo_provenance_is_rejected_before_reading_or_blocking(self):
        provenance = self.tooling / "ci/successor/approved-rc-provenance.json"
        provenance.unlink()
        os.mkfifo(provenance)
        output = Path(self.temp.name) / "fifo-out"
        try:
            result = subprocess.run([sys.executable, "-B", str(self.tooling / "ci/successor/verify.py"), "verify",
                                     "--root", str(self.root), "--manifest", str(self.path), "--output", str(output)],
                                    capture_output=True, text=True, timeout=3,
                                    env={**os.environ, "GITHUB_ACTIONS": "true", "GITHUB_SHA": self.tooling_sha})
        except subprocess.TimeoutExpired:
            self.fail("FIFO provenance blocked validation before tooling type rejection")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("Traceback", result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "FAILED")
        report = json.loads((output / "summary.json").read_text())
        self.assertEqual(report["status"], "FAILED")
        self.assertIn("Unsupported working-tree tooling entry", report["failure"])
        self.assertFalse(report["fullReleaseVerified"])
        self.assertNotEqual(report.get("toolingEvidence"), "committed")
        self.assertIn("finishedAtUTC", report)

    def test_replace_refs_cannot_rebind_changed_tooling_bytes(self):
        path = self.tooling / "ci/successor/verify.py"
        path.write_bytes(path.read_bytes() + b"\n# replacement bytes\n")
        self.tool_git("add", ".")
        self.tool_git("commit", "-qm", "alternate tooling objects")
        alternate = self.tool_git("rev-parse", "HEAD").strip()
        self.tool_git("replace", self.tooling_sha, alternate)
        self.tool_git("update-ref", "HEAD", self.tooling_sha)
        # Default Git now regards the replacement bytes as clean. The verifier
        # must instead read the literal objects named by the dispatched commit.
        self.assertEqual(self.tool_git("status", "--porcelain"), "")
        with self.assertRaises(verify.VerificationError):
            self.binding()

    def test_replace_refs_leave_clean_literal_tooling_bound_to_original_objects(self):
        path = self.tooling / "ci/successor/verify.py"
        original = path.read_bytes()
        path.write_bytes(original + b"\n# replacement bytes\n")
        self.tool_git("add", ".")
        self.tool_git("commit", "-qm", "alternate tooling objects")
        alternate = self.tool_git("rev-parse", "HEAD").strip()
        self.tool_git("replace", self.tooling_sha, alternate)
        self.tool_git("update-ref", "HEAD", self.tooling_sha)
        path.write_bytes(original)
        binding = self.binding()
        self.assertEqual(binding["committedFiles"], self.literal_files)
        self.assertEqual(binding["committedObjects"], self.literal_objects)
        self.assertEqual(binding["expectedSha"], self.tooling_sha)

    def test_wrong_manifest_shapes_finalize_failed_receipts(self):
        for index, malformed in enumerate(([], None, 17, True, "manifest", {})):
            with self.subTest(manifest=malformed):
                self.path.write_text(json.dumps(malformed))
                self.assert_rejected_receipt(name="shape-" + str(index))

    def test_malformed_inventory_shapes_reach_source_validation_and_finalize_failed(self):
        for index, malformed in enumerate((None, [], 17, True, "files", ["qalba-platform/src/app.ts"])):
            with self.subTest(files=malformed):
                manifest = {**self.manifest, "files": malformed}
                self.path.write_text(json.dumps(manifest))
                report = self.assert_rejected_receipt(name="inventory-shape-" + str(index))
                self.assertIn("Source inventory", report["failure"])

    def test_manifest_schema_requires_an_integer_version(self):
        for index, malformed in enumerate((True, 1.0, "1", None)):
            with self.subTest(schemaVersion=malformed):
                manifest = {**self.manifest, "schemaVersion": malformed}
                self.path.write_text(json.dumps(manifest))
                report = self.assert_rejected_receipt(name="schema-shape-" + str(index))
                self.assertIn("manifest schema", report["failure"])

    def test_manifest_application_count_requires_an_integer(self):
        manifest = {**self.manifest, "applicationFileCount": float(self.manifest["applicationFileCount"])}
        self.path.write_text(json.dumps(manifest))
        report = self.assert_rejected_receipt()
        self.assertIn("Application inventory", report["failure"])

    def test_source_verification_rejects_nonobject_manifests(self):
        for malformed in ([], None, 17, True, "manifest"):
            with self.subTest(manifest=malformed):
                self.path.write_text(json.dumps(malformed))
                with self.assertRaises(verify.VerificationError):
                    self.check()

    def test_unexpected_validation_exception_is_sanitized_and_finalized(self):
        private_marker = "SYNTHETIC_PRIVATE_EXCEPTION_PAYLOAD"
        with patch.object(verify, "verify_provenance", side_effect=RuntimeError(private_marker)):
            report = self.assert_rejected_receipt()
        self.assertIn("RuntimeError", report["failure"])
        self.assertNotIn(private_marker, json.dumps(report))

    def test_interruption_base_exceptions_preserve_incomplete_receipt(self):
        for interruption in (KeyboardInterrupt(), SystemExit(7)):
            with self.subTest(interruption=type(interruption).__name__):
                name = "interrupted-" + type(interruption).__name__
                with patch.object(verify, "verify_provenance", side_effect=interruption):
                    with self.assertRaises(type(interruption)):
                        self.record_fixture(name=name)
                report = json.loads((Path(self.temp.name) / name / "summary.json").read_text())
                self.assertEqual(report["status"], "INCOMPLETE")
                self.assertFalse(report["fullReleaseVerified"])
                self.assertNotEqual(report.get("toolingEvidence"), "committed")

    def test_cli_malformed_manifest_returns_nonzero_with_finalized_failed_receipt(self):
        malformed_documents = (b"[]\n", b"{", b'{"schemaVersion":1,"schemaVersion":1}', b"\xff")
        for index, malformed in enumerate(malformed_documents):
            with self.subTest(document=malformed):
                self.path.write_bytes(malformed)
                output = Path(self.temp.name) / ("cli-out-" + str(index))
                result = subprocess.run([sys.executable, str(self.tooling / "ci/successor/verify.py"), "verify",
                                         "--root", str(self.root), "--manifest", str(self.path), "--output", str(output)],
                                        capture_output=True, text=True,
                                        env={**os.environ, "GITHUB_ACTIONS": "false"})
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("Traceback", result.stderr)
                self.assertEqual(json.loads(result.stdout)["status"], "FAILED")
                report = json.loads((output / "summary.json").read_text())
                self.assertEqual(report["status"], "FAILED")
                self.assertFalse(report["fullReleaseVerified"])
                self.assertNotEqual(report.get("toolingEvidence"), "committed")
                self.assertIn("finishedAtUTC", report)


if __name__ == "__main__":
    unittest.main()
