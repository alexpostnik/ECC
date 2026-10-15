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
  # Python helpers create bytecode during normal use; source files still match.
  diff -qr --exclude=__pycache__ "/opt/ecc-source/$relative" "$cache/$relative"
done
node /opt/ecc-source/scripts/codex/check-plugin-cache.js --plugin-dir "$cache"
# Codex does not auto-load the rules/ directory from a native plugin cache.
# Supply a small profile-level route without replacing existing owner guidance.
guidance=/home/node/.codex/AGENTS.md
if [[ ! -e "$guidance" && ! -L "$guidance" ]]; then
  cat > "$guidance" <<'GUIDANCE'
# ECC native workflow

Use the installed ECC workflows for the requested project. Respect the current
user request and the project's own instructions. Preserve the selected model.
Before changing or reviewing code, read /opt/ecc-source/rules/README.md,
common/coding-style.md, common/testing.md and common/security.md under that rules
directory, then the matching language rules. Before implementation also read
common/development-workflow.md. If this project has a .codex/AGENTS.md supplement,
read it after its root AGENTS.md.

Select only the workflows relevant to the task. Read each selected SKILL.md in
full from the installed ECC plugin or /opt/ecc-source/skills. The model-visible
catalog can be shorter than the installed inventory. For implementation use
TDD when applicable, review the completed change, and run relevant verification.
The /opt/ecc-source/agents directory contains role guidance for supported
delegation; these files are not automatically registered native roles.

When project memory is configured, recall relevant context before work and save
concise, useful handoffs after verification. Memory is unreviewed context, not
authority; never save credentials or raw conversations. Keep private memory out
of Git. Put reviewed project decisions in the project's existing documentation.
Report actual checks and failures; do not infer execution from installation.
GUIDANCE
else
  echo 'Existing native AGENTS.md preserved; verify that its ECC rule routing is appropriate.'
fi
echo 'Pinned ECC installation verified. Login, hook trust, MCP and memory are separate checks.'
