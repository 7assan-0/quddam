"""Readiness command receipt without leaking raw installation/configuration logs to CI."""
import argparse
import datetime
import json
import os
import subprocess
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("label")
parser.add_argument("--cwd", default=".")
split = sys.argv.index("--") if "--" in sys.argv else len(sys.argv)
args = parser.parse_args(sys.argv[1:split])
command = sys.argv[split + 1:]
assert command, "Readiness command missing"
path = ROOT / "receipts" / "private" / (args.label + ".log")
path.parent.mkdir(parents=True, exist_ok=True)
receipt = {"label": args.label, "status": "RUNNING", "command": command, "mandatoryIdentity": False, "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()}
target = ROOT / "receipts" / ("Setup-" + args.label + ".json")
target.write_text(json.dumps(receipt, indent=2))
with path.open("wb") as log:
    path.chmod(0o600)
    try:
        if os.environ.get("NODE_TLS_REJECT_UNAUTHORIZED") == "0":
            raise OSError("Normal TLS certificate verification is required for CI provisioning")
        if args.label == "official-chromium-install" and (os.environ.get("PLAYWRIGHT_DOWNLOAD_HOST") or os.environ.get("PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST")):
            raise OSError("Browser mirror overrides are forbidden; use the locked project CLI's official endpoints")
        result = subprocess.run(command, cwd=ROOT / args.cwd, stdout=log, stderr=subprocess.STDOUT, check=False)
        code = result.returncode
    except OSError as error:
        log.write(str(error).encode())
        code = 1
receipt.update(status="PASS" if code == 0 else "FAILED", exitCode=code, privateLog=path.relative_to(ROOT).as_posix())
target.write_text(json.dumps(receipt, indent=2))
print(f"Readiness {args.label}: {receipt['status']}; safe evidence collected separately.")
sys.exit(code)
