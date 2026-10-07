"""Allowlisted, redacted evidence export. Raw traces, DB backups, fixtures never uploaded."""
import argparse
import html
import json
import re
from pathlib import Path
import zipfile
from baseline import ROOT, sha, save

SENSITIVE_KEY = re.compile(r"password|secret|(^|_)token|token$|cookies?|authorization|credential|smtpuser|smtppass|privatekey|storageState", re.I)
HEX_SECRET = re.compile(r"\b[0-9a-fA-F]{32,}\b")
OPAQUE_TOKEN = re.compile(r"(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43,128}(?![A-Za-z0-9_-])")


def redact_text(value):
    value = re.sub(r"\x1b\[[0-9;]*[mK]", "", value)
    value = re.sub(r"(postgres(?:ql)?://)[^/@\s]+@", r"\1[CREDENTIALS_REDACTED]@", value, flags=re.I)
    value = re.sub(r"([?&](?:token|access_token|callback_token|key|secret|password)=)[^\s&\"'<>]+", r"\1[REDACTED]", value, flags=re.I)
    value = re.sub(r"((?:authorization|cookie|set-cookie|password|secret|token)\s*[=:]\s*)[^\n]+", r"\1[REDACTED]", value, flags=re.I)
    value = re.sub(r"\b(?:e2e-[^\s\"'<>]*password[^\s\"'<>]*|synthetic-(?:admin|user)-[\w-]+|reset-new-password-[\w-]+)\b", "[REDACTED_TEST_PASSWORD]", value)
    return OPAQUE_TOKEN.sub("[REDACTED_OPAQUE]", HEX_SECRET.sub("[REDACTED_HEX]", value))


def redact_json(value, key="", hash_context=False):
    if SENSITIVE_KEY.search(key) and not re.search(r"count|oneUse|invalidation|lifetime|behavior|hash|fingerprint|omitted|changed", key, re.I):
        return "[REDACTED]"
    hash_context = hash_context or bool(re.search(r"fingerprint|sha256|checksum|^files$|^sha$", key, re.I))
    if isinstance(value, dict):
        return {k: redact_json(v, k, hash_context) for k, v in value.items()}
    if isinstance(value, list):
        return [redact_json(x, key, hash_context) for x in value]
    if isinstance(value, str):
        if (hash_context or re.search(r"hash", key, re.I)) and re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", value):
            return value
        return redact_text(value)
    return value


def export():
    output = ROOT / "safe-artifacts"
    output.mkdir(exist_ok=True)
    index = []
    allowed = []
    for folder in [ROOT / "receipts", ROOT / "results"]:
        allowed.extend(p for p in folder.glob("*.json") if p.is_file())
    # Result / completion records only; never private fixture payloads.
    result_names = {"Execution-Results.json", "Run-Completion.json", "Browser-Results.json", "browser-native.json", "unit-native.json", "Content-Audit.json",
                    "B01.json", "M01-M02.json", "M03.json", "M05.json", "M06-M07.json", "M08-M09.json", "M10-M11.json", "M12.json", "content-native.json", "launch-low-native.json", "Process-Lifecycle.json", "Fake-Provider-Summary.json"}
    for p in (ROOT / "verification").rglob("*.json"):
        if "-artifacts" in p.as_posix() or "browser-results" in p.as_posix() or "browser-artifacts" in p.as_posix():
            continue
        if p.name in result_names or re.fullmatch(r"\d{3}-native\.json", p.name) or re.fullmatch(r"native-(fixture|verify-upgrade|continue-active|prepare-offline|verify-offline|resume-jobs|failure-mvcc|restore-check)\.json", p.name):
            allowed.append(p)
    for p in [ROOT / "Quality-Gates.json", ROOT / "Target-Build-Preparation.json", ROOT / "Build-Fingerprint.json"]:
        if p.exists():
            allowed.append(p)
    for path in sorted(set(allowed)):
        rel = path.relative_to(ROOT)
        target = output / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        data = redact_json(json.loads(path.read_text()))
        save(target, data)
        index.append({"source": rel.as_posix(), "originalSha256": sha(path.read_bytes()), "safeSha256": sha(target.read_bytes()), "mode": "recursive JSON redaction"})
    logs = list((ROOT / "receipts/private").glob("*.log")) + list((ROOT / "verification").rglob("*.log"))
    for path in sorted(set(logs)):
        rel = path.relative_to(ROOT)
        target = output / "redacted-logs" / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(redact_text(path.read_text(errors="replace")))
        index.append({"source": rel.as_posix(), "originalSha256": sha(path.read_bytes()), "safeSha256": sha(target.read_bytes()), "mode": "text redaction"})
    # A diagnostic first-failure trace, not a replayable archive: no request headers,
    # network bodies, DOM snapshots, screenshots, QR resources or raw input values.
    for path in (ROOT / "verification").rglob("trace.zip"):
        rel = path.relative_to(ROOT)
        target = output / "safe-traces" / rel.with_suffix(".diagnostic.jsonl")
        target.parent.mkdir(parents=True, exist_ok=True)
        events = []
        with zipfile.ZipFile(path) as z:
            for name in z.namelist():
                if not name.endswith(".trace"):
                    continue
                for line in z.read(name).decode(errors="replace").splitlines():
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if event.get("type") in ["before", "after", "error"]:
                        events.append(redact_json({k: event[k] for k in ["type", "callId", "apiName", "startTime", "endTime", "error", "stack"] if k in event}))
        target.write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in events))
        index.append({"source": rel.as_posix(), "originalSha256": sha(path.read_bytes()), "safeSha256": sha(target.read_bytes()), "mode": "diagnostic trace; all sensitive payloads/resources excluded"})
    for filename in ["Exact-CI-Adapter.diff"]:
        path = ROOT / "receipts" / filename
        if path.exists():
            target = output / filename
            target.write_bytes(path.read_bytes())  # Code only, no generated credentials.
            index.append({"source": "receipts/" + filename, "safeSha256": sha(target.read_bytes()), "mode": "CI code diff"})
    summary_file = output / "results/Final-Execution-Summary.json"
    summary = json.loads(summary_file.read_text()) if summary_file.exists() else {"releaseTests": "NOT_EXECUTED", "reason": "Readiness or targeted gate incomplete"}
    (output / "Safe-Results-Report.html").write_text("<!doctype html><meta charset='utf-8'><title>RG03 safe verification results</title><h1>RG03 verification — safe results</h1><p>Not a raw Playwright report. Credentials, cookies, request bodies, DOM snapshots and replay traces are excluded.</p><pre>" + html.escape(json.dumps(summary, ensure_ascii=False, indent=2)) + "</pre>")
    save(output / "Evidence-Manifest.json", {"files": index, "rawTraceUploads": False, "databaseBackupUploads": False, "privateFixtureUploads": False, "credentialsOmitted": True, "retentionDays": 14})
    return output


def archive(path, folder):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for file in sorted(folder.rglob("*")):
            if file.is_file():
                z.write(file, file.relative_to(folder))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["export"])
    parser.parse_args()
    output = export()
    print("Safe evidence exported; raw private data excluded.")
