"""Separate successor integrity/quality evidence; never rewrites RG03 artifacts."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import secrets
import shutil
import stat
import subprocess
import sys

APPROVED_SHA = "b69d8955ad5b33e570dd493e2eb5dfa9e603e72d"
CANDIDATE_SHA = "2d4e868ba43700414c19ece1394bf6815e7639cf"
TOOLING = Path(__file__).resolve().parents[2]
TOOLING_PATHS = ("ci/successor", ".github/workflows/quddam-successor-verification.yml")
GENERATED = ("qalba-platform/node_modules", "qalba-platform/.next",
             "qalba-platform/src/generated/prisma", "qalba-platform/tsconfig.tsbuildinfo",
             "qalba-platform/test-results", "qalba-platform/playwright-report")
RELEASE_GROUPS = ("content-validation", "ops-validation", "canonical-browser-api",
                  "supplemental-browser-api", "native-postgresql", "merchant-lifecycle",
                  "staging-infrastructure", "capacity", "owner-approval")


class VerificationError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise VerificationError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fingerprint(files):
    return digest("".join(f"{path}\0{sha}\n" for path, sha in sorted(files.items())).encode())


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, "Duplicate JSON key")
        value[key] = item
    return value


def load(path):
    path = Path(path)
    require(path.is_file() and not path.is_symlink(), "JSON input must be a regular file")
    value = json.loads(path.read_text(), object_pairs_hook=unique_object)
    require(isinstance(value, dict), "JSON document must be an object")
    return value


def git(root, *args, input=None):
    # Repository/index/object/config overrides must not redirect a local read.
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    env["GIT_NO_REPLACE_OBJECTS"] = "1"
    result = subprocess.run(["git", "-c", "core.fsmonitor=false", "-C", str(root), *args],
                            input=input, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    require(result.returncode == 0, "Git operation failed: " + args[0])
    return result.stdout


def read_git_objects(root, identities, kind):
    identities = sorted(set(identities))
    payload = git(root, "cat-file", "--batch", input="".join(oid + "\n" for oid in identities).encode())
    offset, objects = 0, {}
    for oid in identities:
        end = payload.index(b"\n", offset)
        header = payload[offset:end].decode().split()
        require(len(header) == 3 and header[:2] == [oid, kind], "Unexpected Git object")
        size = int(header[2])
        data = payload[end + 1:end + 1 + size]
        require(size >= 0 and len(data) == size
                and payload[end + 1 + size:end + 2 + size] == b"\n", "Truncated Git object")
        require(hashlib.sha1(kind.encode() + b" " + str(size).encode() + b"\0" + data,
                             usedforsecurity=False).hexdigest() == oid, "Git " + kind + " identity mismatch")
        objects[oid] = data
        offset = end + 2 + size
    require(offset == len(payload), "Unexpected Git object bytes")
    return objects


def validate_literal_commit(root, sha):
    # Git normally trusts object filenames. Recompute commit/tree identities too,
    # so corrupt object storage cannot silently rebind the expected file list.
    commit = read_git_objects(root, [sha], "commit")[sha]
    header = commit.split(b"\n", 1)[0].split()
    require(len(header) == 2 and header[0] == b"tree" and len(header[1]) == 40
            and all(character in b"0123456789abcdef" for character in header[1]), "Invalid Git commit tree")
    trees = [header[1].decode()]
    for row in git(root, "ls-tree", "-rtz", sha).split(b"\0"):
        if row:
            fields, _ = row.split(b"\t", 1)
            _, kind, oid = fields.decode().split()
            if kind == "tree":
                trees.append(oid)
    read_git_objects(root, trees, "tree")
    return trees[0]


def committed_objects(root, sha, paths=()):
    """Read literal commit objects, without checkout filters or replacement refs."""
    validate_literal_commit(root, sha)
    entries = []
    arguments = ["ls-tree", "-rz", sha]
    if paths:
        arguments.extend(("--", *paths))
    for row in git(root, *arguments).split(b"\0"):
        if not row:
            continue
        fields, path = row.split(b"\t", 1)
        mode, kind, oid = fields.decode().split()
        require(kind == "blob" and mode in ("100644", "100755"), "Unsupported Git entry")
        entries.append((path.decode(), mode, oid))
    blobs = read_git_objects(root, [oid for _, _, oid in entries], "blob")
    return {path: {"sha256": digest(blobs[oid]), "mode": mode, "objectId": oid}
            for path, mode, oid in entries}


def commit_inventory(root, sha):
    objects = committed_objects(root, sha)
    return ({path: entry["sha256"] for path, entry in objects.items()},
            {path: entry["mode"] for path, entry in objects.items()})


def verify(root, manifest_path, expected_sha=CANDIDATE_SHA, approved_sha=APPROVED_SHA):
    root = Path(root).resolve()
    manifest = load(manifest_path)
    require(type(manifest.get("schemaVersion")) is int and manifest["schemaVersion"] == 1,
            "Unsupported manifest schema")
    require(manifest.get("candidateSha") == expected_sha, "Candidate SHA differs from pinned target")
    require(manifest.get("approvedRcSha") == approved_sha, "Approved RC identity changed")
    require(git(root, "rev-parse", "--show-toplevel").decode().strip() == str(root), "Source root must be the Git root")
    require(git(root, "rev-parse", "HEAD").decode().strip() == expected_sha, "Checkout HEAD is not the exact candidate SHA")
    files = manifest.get("files")
    require(isinstance(files, dict) and files, "Source inventory is missing")
    for path, sha in files.items():
        p = PurePosixPath(path)
        require(not p.is_absolute() and p.as_posix() == path and ".." not in p.parts
                and ".git" not in p.parts, "Unsafe inventory path")
        require(isinstance(sha, str) and len(sha) == 64 and all(c in "0123456789abcdef" for c in sha), "Invalid source hash")
    require(type(manifest.get("fileCount")) is int and manifest["fileCount"] == len(files), "Inventory count mismatch")
    require(manifest.get("sourceFingerprint") == fingerprint(files), "Inventory fingerprint mismatch")
    committed, modes = commit_inventory(root, expected_sha)
    require(files == committed, "Manifest differs from pinned Git source")
    approved, _ = commit_inventory(root, approved_sha)
    changes = [{"path": p, "change": "added" if p not in approved else "deleted" if p not in files else "modified",
                "approvedSha256": approved.get(p), "candidateSha256": files.get(p)}
               for p in sorted(files.keys() | approved.keys()) if files.get(p) != approved.get(p)]
    require(manifest.get("sourceChangesFromApproved") == changes, "Approved-to-successor diff mismatch")
    application = {p.removeprefix("qalba-platform/"): h for p, h in files.items() if p.startswith("qalba-platform/")}
    require(type(manifest.get("applicationFileCount")) is int
            and manifest["applicationFileCount"] == len(application)
            and manifest.get("applicationFingerprint") == fingerprint(application), "Application inventory mismatch")
    for path, sha in files.items():
        file = root / path
        require(not any(parent.is_symlink() for parent in [file, *file.parents] if parent != root.parent), "Symlink source is forbidden")
        require(file.is_file() and digest(file.read_bytes()) == sha, "Source byte mismatch: " + path)
        require(bool(file.stat().st_mode & 0o111) == (modes[path] == "100755"), "Source mode mismatch: " + path)
    # Do not trust .gitignore: ignored authored files can affect execution too.
    def walk(directory):
        for item in directory.iterdir():
            relative = item.relative_to(root).as_posix()
            if relative == ".git":
                continue
            require(not item.is_symlink(), "Untracked symlink is forbidden: " + relative)
            if relative in GENERATED:
                continue
            if item.is_dir():
                walk(item)
            else:
                require(relative in files, "Unexpected source file: " + relative)
    walk(root)
    return {"candidateSha": expected_sha, "sourceFingerprint": fingerprint(files), "fileCount": len(files),
            "applicationFingerprint": fingerprint(application),
            "generatedArtifactsVerified": False, "generatedExclusions": list(GENERATED)}


def verify_provenance(manifest_path):
    path = TOOLING / "ci/successor/approved-rc-provenance.json"
    require(load(manifest_path).get("approvedProvenanceSha256") == digest(path.read_bytes()), "Approved provenance hash mismatch")
    provenance = load(path)
    require(provenance["approvedSha"] == APPROVED_SHA == provenance["resolvedTagSha"]
            == provenance["run"]["head_sha"] == provenance["approvalSnapshot"]["approvedCommit"], "Approved release/run identity mismatch")
    require(provenance["release"]["tag_name"] == "v1.0.0-rc.1" and provenance["run"]["id"] == 38106508308
            and provenance["run"]["conclusion"] == "success" and not provenance["release"]["draft"], "Approved release/run status mismatch")


def tooling_binding():
    root = TOOLING.resolve()
    require(git(root, "rev-parse", "--show-toplevel").decode().strip() == str(root),
            "Tooling root must be the Git root")
    checkout_sha = git(root, "rev-parse", "--verify", "HEAD^{commit}").decode().strip()
    expected_sha = os.environ.get("GITHUB_SHA") if os.environ.get("GITHUB_ACTIONS") == "true" else checkout_sha
    require(isinstance(expected_sha, str) and len(expected_sha) == 40
            and all(character in "0123456789abcdef" for character in expected_sha),
            "CI requires a full hexadecimal dispatched tooling SHA")
    require(checkout_sha == expected_sha, "CI tooling SHA differs from dispatched SHA")
    objects = committed_objects(root, expected_sha, TOOLING_PATHS)
    require(objects and "ci/successor/verify.py" in objects
            and TOOLING_PATHS[1] in objects, "Committed tooling inventory is missing")
    committed = {path: entry["sha256"] for path, entry in objects.items()}
    paths = []

    def collect(path):
        require(not any(parent.is_symlink() for parent in (path, *path.parents)
                        if parent.is_relative_to(root)), "Symlink tooling is forbidden")
        mode = path.stat().st_mode
        if stat.S_ISDIR(mode):
            for child in sorted(path.iterdir()):
                collect(child)
        else:
            require(stat.S_ISREG(mode), "Unsupported working-tree tooling entry")
            paths.append(path)

    for relative in TOOLING_PATHS:
        collect(root / relative)
    files = {path.relative_to(root).as_posix(): digest(path.read_bytes()) for path in paths}
    modes = {path.relative_to(root).as_posix(): "100755" if path.stat().st_mode & 0o111 else "100644"
             for path in paths}
    require(files.keys() == committed.keys(), "Tooling inventory differs from committed objects")
    require(files == committed, "Tooling bytes differ from committed objects")
    require(modes == {path: entry["mode"] for path, entry in objects.items()},
            "Tooling modes differ from committed objects")
    return {"expectedSha": expected_sha, "checkoutSha": checkout_sha,
            "treeObjectId": git(root, "rev-parse", "--verify", expected_sha + "^{tree}").decode().strip(),
            "fingerprint": fingerprint(files), "files": files, "modes": modes,
            "committedFingerprint": fingerprint(committed), "committedFiles": committed,
            "committedObjects": objects, "workingTreeModified": False}


def write_summary(output, report):
    temporary = output / "summary.json.tmp"
    temporary.write_text(json.dumps(report, indent=2) + "\n")
    temporary.replace(output / "summary.json")


def restore_next_declaration(path, original, row):
    require(path.is_file() and not path.is_symlink(), "Unexpected Next declaration file type")
    generated = path.read_bytes()
    expected = original.replace(b'"./.next/dev/types/', b'"./.next/types/')
    require(generated in (original, expected), "Unexpected Next declaration transformation")
    path.write_bytes(original)
    row["nextDeclaration"] = {"originalSha256": digest(original), "generatedSha256": digest(generated),
                              "restoredSha256": digest(path.read_bytes()),
                              "allowedTransformation": ".next/dev/types/ to .next/types/ only"}


def check_environment(environment, label):
    result = {**environment, "NODE_ENV": "production" if label == "build" else "development"}
    # Same contract as the approved quality runner: unit fixtures own their Origin.
    if label == "unit":
        result.pop("APP_URL", None)
    return result


def record(root, manifest_path, quality, output):
    output = Path(output).resolve()
    require(not output.is_relative_to(Path(root).resolve()) and not output.is_relative_to(TOOLING), "Evidence must be outside both checkouts")
    output.mkdir(parents=True, exist_ok=False)  # No stale receipts or overwritten first failure.
    report = {"schemaVersion": 1, "scope": "successor-quality" if quality else "successor-source-preflight",
              "status": "INCOMPLETE", "fullReleaseVerified": False, "previousOutcomesInherited": False,
              "automaticRetries": 0, "releaseGroups": {name: "NOT_EXECUTED" for name in RELEASE_GROUPS},
              "qualityChecks": {name: "NOT_EXECUTED" for name in ("npm-ci", "prisma-generate", "route-types", "lint", "typecheck", "unit", "build")},
              "checks": [], "startedAtUTC": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    report["requestedCandidateSha"] = CANDIDATE_SHA
    write_summary(output, report)
    try:
        # Reject unsupported tooling types before reading provenance bytes.
        report["tooling"] = tooling_binding()
        if os.environ.get("GITHUB_ACTIONS") == "true":
            require(not report["tooling"]["workingTreeModified"], "CI requires clean committed tooling")
            require(report["tooling"]["checkoutSha"] == os.environ.get("GITHUB_SHA"), "CI tooling SHA differs from dispatched SHA")
        verify_provenance(manifest_path)
        report["observedCheckoutSha"] = git(Path(root).resolve(), "rev-parse", "HEAD").decode().strip()
        report["source"] = verify(root, manifest_path)
        report["toolingEvidence"] = "committed"
        report["manifestSha256"] = digest(Path(manifest_path).read_bytes())
        write_summary(output, report)
        if quality:
            run_quality(Path(root).resolve(), manifest_path, output, report)
        require(report["tooling"] == tooling_binding(), "Verifier tooling changed during execution")
        require(report["source"] == verify(root, manifest_path), "Candidate changed during execution")
        report["status"] = "PASS"
    except VerificationError as error:
        report["status"] = "FAILED"
        report["failure"] = str(error)
    except Exception as error:
        # Validation failures are terminal; do not publish arbitrary exception
        # payloads. BaseException interruptions retain the INCOMPLETE checkpoint.
        report["status"] = "FAILED"
        report["failure"] = "Verification failed (" + type(error).__name__ + ")"
    finally:
        report["finishedAtUTC"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        write_summary(output, report)
    return report


def run_quality(root, manifest_path, output, report):
    app = root / "qalba-platform"
    for path in GENERATED:
        require(not (root / path).exists(), "Quality requires a fresh checkout without generated artifacts: " + path)
    # Keep only OS/network trust settings. Never inherit application or merchant bindings.
    allowed = ("PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY",
               "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS")
    env = {k: os.environ[k] for k in allowed if k in os.environ}
    env.update(CI="true", NEXT_TELEMETRY_DISABLED="1", CHECKPOINT_DISABLE="1",
               DATABASE_URL="postgresql://successor_test:test-only@127.0.0.1:1/successor_unavailable",
               APP_URL="https://successor.invalid", AUTH_RATE_LIMIT_SECRET=secrets.token_hex(32),
               PUBLIC_WELCOME_CREDITS_ENABLED="false", npm_config_cache=str(output / "private/npm-cache"))
    private = output / "private"
    private.mkdir(mode=0o700)
    unit = private / "unit.json"
    commands = [("npm-ci", ["npm", "ci"]), ("prisma-generate", ["npm", "run", "db:generate"]),
                ("route-types", ["node", "node_modules/next/dist/bin/next", "typegen"]),
                ("lint", ["npm", "run", "lint"]), ("typecheck", ["npm", "run", "typecheck"]),
                ("unit", ["npm", "run", "test", "--", "--maxWorkers=1", "--retry=0", "--bail=1", "--reporter=json", "--outputFile=" + str(unit)]),
                ("build", ["npm", "run", "build"])]
    for label, command in commands:
        verify(root, manifest_path)
        require(report["tooling"] == tooling_binding(), "Verifier tooling changed during execution")
        row = {"id": label, "status": "FAILED"}
        report["checks"].append(row)
        report["qualityChecks"][label] = "FAILED"
        write_summary(output, report)
        log = private / (label + ".log")
        # Only Next's documented generated declaration is restored, never arbitrary source.
        declaration = app / "next-env.d.ts"
        original = declaration.read_bytes()
        with log.open("xb") as stream:
            log.chmod(0o600)
            try:
                result = subprocess.run(command, cwd=app, env=check_environment(env, label),
                                        stdout=stream, stderr=subprocess.STDOUT, timeout=1200)
                row["exitCode"] = result.returncode
            finally:
                if label in ("route-types", "build"):
                    restore_next_declaration(declaration, original, row)
        if label == "route-types" and result.returncode == 0:
            target = app / ".next/dev/types"
            target.mkdir(parents=True, exist_ok=True)
            for name in ("routes.d.ts", "root-params.d.ts"):
                shutil.copyfile(app / ".next/types" / name, target / name)
        verify(root, manifest_path)
        row["privateLogSha256"] = digest(log.read_bytes())
        require(result.returncode == 0, "Stopped at failed check: " + label)
        if label == "unit":
            data = load(unit)
            assertions = [a for file in data.get("testResults", []) for a in file.get("assertionResults", [])]
            require(assertions and all(a.get("status") == "passed" for a in assertions), "Unit assertions incomplete or failed")
            require(data.get("success") is True and data.get("numTotalTests") == len(assertions)
                    and data.get("numPassedTests") == len(assertions)
                    and data.get("numFailedTests") == 0 and data.get("numPendingTests") == 0
                    and data.get("numTodoTests", 0) == 0, "Unit result totals invalid")
            row["passedAssertions"] = len(assertions)
        row["status"] = "PASS"
        report["qualityChecks"][label] = "PASS"
        write_summary(output, report)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["verify", "quality"])
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, default=TOOLING / "ci/successor/candidate-main-2d4e868.json")
    parser.add_argument("--output", type=Path, required=True, help="New directory outside both checkouts")
    args = parser.parse_args()
    try:
        report = record(args.root, args.manifest, args.mode == "quality", args.output)
    except (VerificationError, OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1
    print(json.dumps({"status": report["status"], "scope": report["scope"], "fullReleaseVerified": False,
                      "summary": str(args.output / "summary.json")}))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
