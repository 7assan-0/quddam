#!/usr/bin/env bash
set -euo pipefail
# Ubuntu official signed packages only. Never disable signature checks or APT sandboxing.
if [[ ! -x /usr/lib/postgresql/16/bin/postgres || ! -x /usr/lib/postgresql/16/bin/pg_restore ]]; then
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends postgresql-16 postgresql-client-16 libpq5 openssl
fi
for executable in postgres initdb pg_ctl psql createdb pg_dump pg_restore; do
  /usr/lib/postgresql/16/bin/"$executable" --version
done
