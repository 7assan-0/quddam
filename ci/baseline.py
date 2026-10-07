"""Verify/materialize only the two supplied archives; never import old PASS counts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
APP_SHA = "bbb44ee4250b85a9baeba7d441676d2fdfe10e38b32e8d55ee301d4598db72df"
ARCHIVES = {
    "Quddam-Phase-5.0J-2-RG02-frozen-checkpoint.zip": "55f544c7b8a3b2276adeaab00f7f64d79f8aec34ca29be68287542778333af34",
    "Quddam-Phase-5.0J-2-RG03-Evidence.zip": "9d5e6aca903f092ab1d9e4eec3e9f6c38be015fb00a7800e9c8cd9cb0fa42017",
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def fingerprint(files):
    return sha("".join(f"{p}\0{h}\n" for p, h in sorted(files.items())).encode())


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def load_inputs():
    opened = []
    for name, expected in ARCHIVES.items():
        path = ROOT / "inputs" / name
        assert sha(path.read_bytes()) == expected, f"Archive SHA256 mismatch: {name}"
        archive = zipfile.ZipFile(path)
        assert archive.testzip() is None, f"Archive CRC mismatch: {name}"
        assert len(archive.namelist()) == len(set(archive.namelist())), "Duplicate ZIP member"
        for entry in archive.infolist():
            p = Path(entry.filename)
            assert not p.is_absolute() and ".." not in p.parts, "Unsafe ZIP member"
            assert (entry.external_attr >> 16) & 0o170000 != 0o120000, "ZIP symlink prohibited"
        opened.append(archive)
    baseline, evidence = opened
    source = json.loads(baseline.read("Source-Manifest.json"))
    assert source["sourceFingerprint"] == APP_SHA and source["fileCount"] == 670
    assert len(source["files"]) == 670 and fingerprint(source["files"]) == APP_SHA
    actual = {p: sha(baseline.read("qalba-platform/" + p)) for p in source["files"]}
    assert actual == source["files"], "RG02 application bytes do not match source manifest"
    assert set(n.removeprefix("qalba-platform/") for n in baseline.namelist()
               if n.startswith("qalba-platform/") and not n.endswith("/")) == set(actual)
    migration = json.loads(baseline.read("Migration-Integrity.json"))
    assert actual["package-lock.json"] == migration["packageLockSha256"]
    assert actual["prisma/schema.prisma"] == migration["schemaSha256"]
    assert len(migration["migrationFiles"]) == 25
    assert {p: actual[p] for p in actual if p.startswith("prisma/migrations/")} == migration["migrationFiles"]
    harness = json.loads(evidence.read("RG03-Harness-Source-Fingerprints.json"))
    payload = {}
    for p, h in harness["harnessFiles"].items():
        data = evidence.read(p) if p in evidence.namelist() else baseline.read(p)
        assert sha(data) == h, f"Authorized harness mismatch: {p}"
        payload[p] = data
    assert len(payload) == 22 and fingerprint(harness["harnessFiles"]) == harness["harnessFingerprint"]
    combined = {"qalba-platform/" + p: h for p, h in actual.items()} | harness["harnessFiles"]
    assert fingerprint(combined) == harness["combinedAppAndHarnessFingerprint"]
    return baseline, evidence, source, migration, harness, payload


def materialize():
    baseline, evidence, source, migration, harness, payload = load_inputs()
    for p in source["files"]:
        path = ROOT / "qalba-platform" / p
        data = baseline.read("qalba-platform/" + p)
        if path.exists():
            assert path.read_bytes() == data, f"Refuse to overwrite changed application: {p}"
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    for p, data in payload.items():
        path = ROOT / p
        if path.exists():
            assert path.read_bytes() == data, f"Refuse to overwrite changed harness: {p}"
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    for name in ["Source-Manifest.json", "Migration-Integrity.json"]:
        (ROOT / name).write_bytes(baseline.read(name))
    (ROOT / "Authorized-RG03-Mail-Harness-Patch.diff").write_bytes(evidence.read("Authorized-RG03-Mail-Harness-Patch.diff"))
    save(ROOT / "Authorized-Harness-Fingerprints.json", harness)
    manifest = json.loads(baseline.read("Quddam-Phase-5.0J-2-Test-Manifest.json"))
    for group in ["browserApi", "nativePostgres"]:
        for case in manifest[group]["cases"]:
            for key in list(case):
                if key.startswith("execution") or key.startswith("executed"):
                    case.pop(key)
            case["execution"] = "NOT_EXECUTED"
    manifest.pop("finalCounts", None)
    manifest.update(previousOutcomesInherited=False, automaticRetries=0)
    save(ROOT / "Quddam-Phase-5.0J-2-Test-Manifest.json", manifest)
    verify()


def verify():
    _, _, source, migration, harness, _ = load_inputs()
    for p, h in source["files"].items():
        assert sha((ROOT / "qalba-platform" / p).read_bytes()) == h, f"Frozen application mismatch: {p}"
    for p, h in harness["harnessFiles"].items():
        assert sha((ROOT / p).read_bytes()) == h, f"Frozen authorized harness mismatch: {p}"
    # Extra generated runtime files are not authored application changes.
    allowed_generated = {"node_modules", ".next", "src/generated", "test-results", "playwright-report"}
    extras = []
    for p in (ROOT / "qalba-platform").rglob("*"):
        rel = p.relative_to(ROOT / "qalba-platform").as_posix()
        if any(rel == x or rel.startswith(x + "/") for x in allowed_generated):
            continue
        if p.is_file() and rel not in source["files"] and rel not in {"tsconfig.tsbuildinfo"}:
            extras.append(rel)
    assert not extras, f"Unexpected authored application files: {extras}"
    result = {
        "status": "PASS", "authoredApplicationFiles": 670, "applicationFingerprint": APP_SHA,
        "harnessFingerprint": harness["harnessFingerprint"],
        "combinedApplicationHarnessFingerprint": harness["combinedAppAndHarnessFingerprint"],
        "packageLockFingerprint": migration["packageLockSha256"],
        "prismaSchemaFingerprint": migration["schemaSha256"],
        "migrationFingerprints": migration["migrationFiles"], "archiveFingerprints": ARCHIVES,
        "productDiff": [], "canonicalAssertionDiff": [], "schemaDiff": [], "migrationDiff": [],
        "dependencyDiff": [], "rg03MimePatchByteIdenticalToEvidence": True,
        "historicalResultsCounted": False,
    }
    ci_manifest = ROOT / "CI-Source-Manifest.json"
    if ci_manifest.exists():
        ci = json.loads(ci_manifest.read_text())
        assert fingerprint(ci["files"]) == ci["ciFingerprint"], "CI source manifest fingerprint mismatch"
        for p, h in ci["files"].items():
            assert sha((ROOT / p).read_bytes()) == h, f"Prepared CI source modified: {p}"
        result["preparedCiFingerprint"] = ci["ciFingerprint"]
    else:
        assert os.environ.get("GITHUB_ACTIONS") != "true", "Prepared CI source manifest missing in GitHub Actions"
    save(ROOT / "receipts" / "Source-Integrity.json", result)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["materialize", "verify"])
    args = parser.parse_args()
    if args.command == "materialize":
        materialize()
    else:
        verify()
    print("Frozen application / authorized RG03 harness integrity PASS; no tests executed.")
