"""Current-source wrapper contracts, using independent disposable Git objects."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zlib


SCRIPT = Path(__file__).with_name("source-binding.py")
SPEC = importlib.util.spec_from_file_location("financial_review_source_binding", SCRIPT)
binding = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(binding)


class CurrentSourceBindingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "source"
        self.root.mkdir()
        self.git("init", "-q")
        self.git("config", "user.email", "binding-test@example.invalid")
        self.git("config", "user.name", "Source binding test")
        self.authored = {
            ".gitignore": b"hidden.ts\nci/financial-review/hidden/\nqalba-platform/src/generated/\n",
            "qalba-platform/src/app.ts": b"export const value = 1;\n",
            "ci/financial-review/nested/tool.py": b"print('fixture')\n",
            "tools/check.sh": b"#!/bin/sh\nexit 0\n",
        }
        for relative, contents in self.authored.items():
            file = self.root / relative
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(contents)
        (self.root / "tools/check.sh").chmod(0o755)
        self.git("add", ".")
        self.git("commit", "-qm", "current source fixture")
        self.sha = self.git("rev-parse", "HEAD").strip()

    def git(self, *args):
        environment = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        return subprocess.check_output(["git", "-C", str(self.root), *args],
                                       stderr=subprocess.PIPE, env=environment).decode()

    def check(self):
        return binding.bind_source(self.root, self.sha)

    def reject(self, message):
        with self.assertRaisesRegex(binding.literal.VerificationError, message):
            self.check()

    def test_exact_head_binds_every_file_and_mode_without_historical_manifests(self):
        with patch.object(binding.literal, "load", side_effect=AssertionError("No manifest reads")), \
                patch.object(binding.literal, "verify_provenance", side_effect=AssertionError("No approvals")):
            result = self.check()
        hashes = {file: hashlib.sha256(contents).hexdigest() for file, contents in self.authored.items()}
        self.assertEqual(result["commit"], self.sha)
        self.assertEqual(result["tree"], self.git("rev-parse", "HEAD^{tree}").strip())
        self.assertEqual(result["trackedSha256"], hashes)
        self.assertEqual(result["fileCount"], len(self.authored))
        self.assertEqual(result["gitModes"]["tools/check.sh"], "100755")
        self.assertEqual(result["gitModes"]["ci/financial-review/nested/tool.py"], "100644")
        self.assertEqual(result["sourceFingerprint"], binding.literal.fingerprint(hashes))
        self.assertRegex(result["objectInventorySha256"], r"^[0-9a-f]{64}$")
        self.assertFalse(result["generatedArtifactsVerified"])
        self.assertEqual(result["generatedExclusions"], list(binding.literal.GENERATED))

    def test_expected_sha_requires_literal_full_hex(self):
        for malformed in ("HEAD", self.sha[:12], "f" * 39, "G" * 40, self.sha + ":tools/check.sh"):
            with self.subTest(sha=malformed), self.assertRaisesRegex(binding.literal.VerificationError, "full lowercase"):
                binding.bind_source(self.root, malformed)

    def test_identical_bytes_at_a_different_head_do_not_pass(self):
        self.git("commit", "--allow-empty", "-qm", "different identity, unchanged source")
        self.reject("exact expected source SHA")

    def test_subdirectory_cannot_substitute_for_the_source_root(self):
        with self.assertRaisesRegex(binding.literal.VerificationError, "Git root"):
            binding.bind_source(self.root / "qalba-platform", self.sha)

    def test_index_flags_do_not_hide_changed_tracked_bytes(self):
        relative = "qalba-platform/src/app.ts"
        for flag in ("assume-unchanged", "skip-worktree"):
            with self.subTest(flag=flag):
                self.git("update-index", "--" + flag, relative)
                try:
                    (self.root / relative).write_bytes(b"changed source\n")
                    self.assertEqual(self.git("status", "--porcelain"), "")
                    self.reject("Source byte mismatch")
                finally:
                    (self.root / relative).write_bytes(self.authored[relative])
                    self.git("update-index", "--no-" + flag, relative)

    def test_git_configuration_cannot_hide_executable_mode_changes(self):
        self.git("config", "core.filemode", "false")
        (self.root / "qalba-platform/src/app.ts").chmod(0o755)
        self.assertEqual(self.git("status", "--porcelain"), "")
        self.reject("Source mode mismatch")

    def test_missing_file_hidden_by_skip_worktree_fails(self):
        relative = "ci/financial-review/nested/tool.py"
        self.git("update-index", "--skip-worktree", relative)
        (self.root / relative).unlink()
        self.assertEqual(self.git("status", "--porcelain"), "")
        with self.assertRaises(FileNotFoundError):
            self.check()

    def test_same_byte_symlink_hidden_by_index_flag_fails(self):
        relative = "qalba-platform/src/app.ts"
        target = Path(self.temp.name) / "same-bytes.ts"
        target.write_bytes(self.authored[relative])
        self.git("update-index", "--assume-unchanged", relative)
        (self.root / relative).unlink()
        (self.root / relative).symlink_to(target)
        self.assertEqual(self.git("status", "--porcelain"), "")
        self.reject("regular file")

    def test_symlink_parent_fails_before_reading_source(self):
        source = self.root / "qalba-platform/src"
        target = Path(self.temp.name) / "original-src"
        source.rename(target)
        source.symlink_to(target, target_is_directory=True)
        self.reject("regular directory")

    def test_ignored_nested_tooling_and_generated_authored_files_fail(self):
        for relative in ("ci/financial-review/hidden/nested/tool.py", "qalba-platform/src/generated/authored.ts"):
            with self.subTest(path=relative):
                file = self.root / relative
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text("unexpected authored source\n")
                try:
                    self.assertEqual(self.git("status", "--porcelain"), "")
                    self.reject("Unexpected source file")
                finally:
                    file.unlink()

    def test_only_known_generated_directory_is_excluded_and_unverified(self):
        generated = self.root / "qalba-platform/src/generated/prisma"
        generated.mkdir(parents=True)
        (generated / "client.ts").write_text("generated client\n")
        result = self.check()
        self.assertFalse(result["generatedArtifactsVerified"])
        self.assertEqual(result["fileCount"], len(self.authored))
        self.assertNotIn("qalba-platform/src/generated/client.ts", result["generatedExclusions"])

    def test_generated_directory_symlink_is_not_excluded(self):
        directory = self.root / "qalba-platform/src/generated"
        directory.mkdir(parents=True)
        (directory / "prisma").symlink_to(Path(self.temp.name), target_is_directory=True)
        self.reject("Unsupported working-tree entry")

    def test_repository_and_index_overrides_are_not_inherited(self):
        absent = str(Path(self.temp.name) / "absent")
        with patch.dict(os.environ, {"GIT_DIR": absent, "GIT_WORK_TREE": absent, "GIT_INDEX_FILE": absent}):
            self.assertEqual(self.check()["commit"], self.sha)

    def test_replacement_refs_cannot_rebind_changed_source(self):
        relative = "qalba-platform/src/app.ts"
        (self.root / relative).write_bytes(b"alternate source\n")
        self.git("add", ".")
        self.git("commit", "-qm", "replacement objects")
        alternate = self.git("rev-parse", "HEAD").strip()
        self.git("replace", self.sha, alternate)
        self.git("update-ref", "HEAD", self.sha)
        self.assertEqual(self.git("status", "--porcelain"), "")
        self.reject("Source byte mismatch")
        (self.root / relative).write_bytes(self.authored[relative])
        self.assertEqual(self.check()["commit"], self.sha)

    def test_corrupt_blob_cannot_keep_the_literal_object_identity(self):
        relative = "qalba-platform/src/app.ts"
        oid = self.git("rev-parse", self.sha + ":" + relative).strip()
        changed = b"changed source\n"
        payload = b"blob " + str(len(changed)).encode() + b"\0" + changed
        storage = self.root / ".git/objects" / oid[:2] / oid[2:]
        storage.chmod(0o600)
        storage.write_bytes(zlib.compress(payload))
        (self.root / relative).write_bytes(changed)
        self.reject("Git blob identity mismatch")

    def test_cli_outputs_only_a_complete_source_receipt(self):
        result = subprocess.run([sys.executable, "-B", str(SCRIPT), str(self.root), self.sha],
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, "")
        self.assertEqual(json.loads(result.stdout), self.check())
        self.assertNotIn("approvedRcSha", result.stdout)

    def test_cli_rejects_tracked_fifo_without_blocking_or_partial_receipt(self):
        file = self.root / "qalba-platform/src/app.ts"
        file.unlink()
        os.mkfifo(file)
        result = subprocess.run([sys.executable, "-B", str(SCRIPT), str(self.root), self.sha],
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")
        self.assertIn("regular file", result.stderr)


if __name__ == "__main__":
    unittest.main()
