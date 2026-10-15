#!/usr/bin/env bash
# Runs inside the native container; never logs in or changes hook/MCP settings.
set -euo pipefail
marketplaces=$(codex plugin marketplace list --json)
existing_root=$(printf '%s' "$marketplaces" | jq -r '.marketplaces[] | select(.name == "ecc") | .root')
if [[ -n "$existing_root" && "$existing_root" != /opt/ecc-source ]]; then
  echo 'The ecc marketplace already points elsewhere; review it before installing.' >&2
  exit 1
fi
if [[ -z "$existing_root" ]]; then
  codex plugin marketplace add /opt/ecc-source --json
fi
inventory=$(codex plugin list --marketplace ecc --json)
installed=$(printf '%s' "$inventory" | jq '[.installed[] | select(.pluginId == "ecc@ecc")] | length')
if [[ "$installed" == 0 ]]; then
  codex plugin add ecc@ecc --json
  inventory=$(codex plugin list --marketplace ecc --json)
fi
printf '%s' "$inventory" | jq -e '.installed[] | select(.pluginId == "ecc@ecc") |
  .version == "2.2.3" and .enabled == true and
  .source.source == "local" and .source.path == "/opt/ecc-source"' >/dev/null || {
    echo 'Existing ECC version, enablement or source differs; no automatic replacement.' >&2
    exit 1
  }
cache=/home/node/.codex/plugins/cache/ecc/ecc/2.2.3
for relative in skills agents rules hooks scripts .codex-plugin/plugin.json .mcp.json; do
  diff -qr "/opt/ecc-source/$relative" "$cache/$relative"
done
node /opt/ecc-source/scripts/codex/check-plugin-cache.js --plugin-dir "$cache"
echo 'Pinned ECC installation verified. Login, hook trust, MCP and memory are separate checks.'
