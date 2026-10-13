"""Bind the complete working source to an explicit current Git commit."""
import argparse
import importlib.util
import json
from pathlib import Path, PurePosixPath
import stat
import sys


# Reuse literal object validation, without reading successor manifests or outcomes.
sys.dont_write_bytecode = True
_helper_path = Path(__file__).resolve().parents[1] / "successor/verify.py"
_spec = importlib.util.spec_from_file_location("financial_review_literal_objects", _helper_path)
literal = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(literal)


def bind_source(root, expected_sha):
    literal.require(isinstance(expected_sha, str) and len(expected_sha) == 40
                    and all(character in "0123456789abcdef" for character in expected_sha),
                    "Expected source SHA must be a full lowercase hexadecimal commit identity")
    root = Path(root).resolve()
    literal.require(literal.git(root, "rev-parse", "--show-toplevel").decode().strip() == str(root),
                    "Source root must be the Git root")
    literal.require(literal.git(root, "rev-parse", "--verify", "HEAD^{commit}").decode().strip() == expected_sha,
                    "Checkout HEAD is not the exact expected source SHA")
    objects = literal.committed_objects(root, expected_sha)
    literal.require(bool(objects), "Committed source inventory is missing")
    files = {path: entry["sha256"] for path, entry in sorted(objects.items())}
    modes = {path: entry["mode"] for path, entry in sorted(objects.items())}

    for relative, sha in files.items():
        path = PurePosixPath(relative)
        literal.require(not path.is_absolute() and path.as_posix() == relative
                        and ".." not in path.parts and ".git" not in path.parts,
                        "Unsafe committed source path")
        file = root / relative
        for parent in file.parents:
            if parent == root:
                break
            literal.require(stat.S_ISDIR(parent.lstat().st_mode),
                            "Source parent must be a regular directory: " + relative)
        mode = file.lstat().st_mode
        literal.require(stat.S_ISREG(mode), "Source entry must be a regular file: " + relative)
        literal.require(literal.digest(file.read_bytes()) == sha, "Source byte mismatch: " + relative)
        literal.require(bool(mode & 0o111) == (modes[relative] == "100755"),
                        "Source mode mismatch: " + relative)

    # Index flags and .gitignore cannot conceal additional authored source.
    def walk(directory):
        for item in sorted(directory.iterdir()):
            relative = item.relative_to(root).as_posix()
            if relative == ".git":
                continue
            mode = item.lstat().st_mode
            literal.require(stat.S_ISREG(mode) or stat.S_ISDIR(mode),
                            "Unsupported working-tree entry: " + relative)
            if relative in literal.GENERATED:
                continue
            if stat.S_ISDIR(mode):
                walk(item)
            else:
                literal.require(relative in files, "Unexpected source file: " + relative)

    walk(root)
    literal.require(literal.git(root, "rev-parse", "--verify", "HEAD^{commit}").decode().strip() == expected_sha,
                    "Checkout HEAD changed during source binding")
    tree = literal.validate_literal_commit(root, expected_sha)
    canonical_objects = json.dumps(objects, sort_keys=True, separators=(",", ":")).encode()
    return {"commit": expected_sha, "tree": tree, "trackedSha256": files, "gitModes": modes,
            "fileCount": len(files), "sourceFingerprint": literal.fingerprint(files),
            "objectInventorySha256": literal.digest(canonical_objects),
            "generatedArtifactsVerified": False, "generatedExclusions": list(literal.GENERATED)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("expected_sha")
    args = parser.parse_args()
    try:
        result = bind_source(args.root, args.expected_sha)
    except literal.VerificationError as error:
        print(str(error), file=sys.stderr)
        return 1
    except (OSError, ValueError) as error:
        print("Source binding failed (" + type(error).__name__ + ")", file=sys.stderr)
        return 1
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
