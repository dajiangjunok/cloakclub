#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
secrets_file="$project_root/.env.aleo-deploy"
patched_leo="$project_root/.tools/leo-lang-4.2.0-basefee/target/release/leo"

if [ ! -f "$secrets_file" ]; then
  echo "Missing $secrets_file" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$secrets_file"
set +a

command_name=${1:-}
if [ "$command_name" != "build" ] && [ -z "${PRIVATE_KEY:-}" ]; then
  echo "PRIVATE_KEY is empty in .env.aleo-deploy" >&2
  exit 1
fi

NETWORK=${NETWORK:-testnet}
ENDPOINT=${ENDPOINT:-https://api.explorer.provable.com/v1}

cd "$project_root/contracts/cloakclub"
# Leo 4.2 prints every loaded environment variable unless quiet mode is set.
# Keep quiet mode mandatory so PRIVATE_KEY never enters terminal or CI logs.
if [ -x "$patched_leo" ]; then
  exec "$patched_leo" -q "$@" --network "$NETWORK" --endpoint "$ENDPOINT"
fi
exec leo -q "$@" --network "$NETWORK" --endpoint "$ENDPOINT"
