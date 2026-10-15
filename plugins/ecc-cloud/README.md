# ECC Cloud

A private skills-only adaptation for managed cloud conversations whose native
Codex profile cannot accept plugin installation. It uses the existing cloud
workspace and the user's ECC fork.

The package exposes one `ecc` entry skill. It routes requests to the original
canonical ECC skills, agent guidance, and rules shipped as supporting files.
Native CLI hooks, local MCP servers, automatic memory collection, and native
agent-role registration are separate host features and are not activated here.

## Build and save

From the ECC repository root, with Python 3 and Git available:

```bash
python3 scripts/codex/build-cloud-plugin.py --output /tmp/ecc-cloud.zip
```

The builder includes tracked upstream source files, records their revision and
hashes, and creates one portable Agent Plugins package. Generated copies belong
in the archive, not in this directory. Keep the output outside the source tree.

Save the verified archive through the host's private plugin creation workflow.
After creation or enablement, verify that the `ecc` skill is discoverable and
readable. Creation alone is not proof of installation or workflow execution.
For later releases, update the same plugin using its recorded plugin ID.

## Use

Select **ECC Cloud** in the conversation and state the project and task:

- "Use ECC to inspect this project and plan the requested change."
- "Use ECC's TDD workflow to implement this change."
- "Use ECC to review and verify the current diff."

The router selects the appropriate original files and uses the conversation's
existing tools. A project workspace is required for code execution. If a skill
needs an unavailable integration, the agent reports the affected step.

## Provenance and verification

The archive's `skills/ecc/references/source.json` records its source revision;
`catalog.json` locates the included skills. Original ECC content remains under
its MIT license and includes the upstream copyright notice.

Run the focused packaging checks with:

```bash
python3 -m unittest discover -s tests/scripts -p 'test_build_cloud_plugin.py' -v
```

For a native Codex App/CLI profile that is writable, use ECC's documented native
plugin lifecycle instead. This cloud adaptation is not an upstream-supported
replacement for every native integration.
