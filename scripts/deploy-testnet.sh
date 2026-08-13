#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
private_key=$(sed -n 's/^PRIVATE_KEY=//p' "$project_root/.env.aleo-deploy")

if [ -z "$private_key" ]; then
  echo "PRIVATE_KEY is empty in .env.aleo-deploy" >&2
  exit 1
fi

"$project_root/scripts/leo-testnet.sh" deploy \
  --base-fees 8710748 \
  --priority-fees 100000 \
  --broadcast \
  --yes 2>&1 | sed -E \
    -e "s|$private_key|[redacted-private-key]|g" \
    -e 's/APrivateKey[1-9A-HJ-NP-Za-km-z]+/[redacted-private-key]/g'
