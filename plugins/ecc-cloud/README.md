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
Read back the stored manifest before updating and preserve its owner metadata
and presentation, including every default prompt. The host can normalize these
fields on creation without normalizing them on update. Record any owner metadata
overlay separately from the reproducible source ZIP and verify the saved result.

## Use

Select **ECC Cloud** in the conversation and state the project and task:

- "Use ECC to inspect this project and plan the requested change."
- "Use ECC's TDD workflow to implement this change."
- "Use ECC to review and verify the current diff."

The router selects the appropriate original files and uses the conversation's
existing tools. Before implementation, refactoring, or code review, it reads
applicable common and language rules; this guides the agent without installing
automatic enforcement. A project workspace is required for code execution.
If a skill needs an unavailable integration, the agent reports the affected step.

## Provenance and verification

Version 0.1.1 starts from `skills/ecc/references/release.json`: a short summary
of the plugin version, pinned source revision, URLs, and included file counts.
The existing `source.json` contract retains the full provenance and file hashes
for integrity audits; `catalog.json` is read only when locating a workflow.
Original ECC content remains under its MIT license and includes the upstream
copyright notice. Included references do not make every workflow executable
without its required host tools and dependencies.

Run the focused packaging checks with:

```bash
python3 -m unittest discover -s tests/scripts -p 'test_build_cloud_plugin.py' -v
```

For a native Codex App/CLI profile that is writable, use ECC's documented native
plugin lifecycle instead. This cloud adaptation is not an upstream-supported
replacement for every native integration.
