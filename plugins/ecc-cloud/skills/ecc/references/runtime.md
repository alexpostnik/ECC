# Cloud runtime and source boundaries

This private package carries ECC's canonical skills, agent guidance, and rules
as read-on-demand references. Their source bytes are preserved. The source
revision, ECC version, and file hashes are recorded by the package builder.
Read the small `release.json` beside this file for the actual release. Open
`catalog.json` only to locate a workflow, and the full `source.json` hash
manifest only when auditing package integrity.

## What the package enables

- A discoverable `ecc` entry skill that selects and reads original ECC workflows.
- Planning, TDD, review, verification, and domain guidance executed with the
  current conversation's available tools.
- Access to the packaged reference files without depending on a previous
  session's checkout or shell working directory.

## What still depends on the host

| Capability | Requirement |
| --- | --- |
| Editing and running project code | An attached workspace and execution tools |
| Delegation | The host's supported subagent tool |
| Browser tests | The project's browser tooling and a usable browser |
| GitHub synchronization | Existing authorized GitHub access |
| Native Codex plugin registration | A writable native Codex profile and its plugin lifecycle |
| Automatic lifecycle hooks | Host support and the host's trust/enablement flow |
| MCP servers | An independently connected and verified server |
| ECC memory or other CLI utilities | The matching ECC runtime and its dependencies |

This package does not register native CLI hooks, launch Chrome DevTools MCP,
install native agent roles, or enable automatic memory collection. Loading a
workflow that describes these features does not activate them.

The managed environment used to prepare this package had a read-only active
Codex profile. Native plugin registration could not be written there. This
cloud package uses the host's plugin system instead of modifying that profile.
Recheck capabilities in another session; do not assume every host is identical.

## Referenced files and executable utilities

Original skill-local supporting files are bundled under
`references/upstream/skills/`. Agent prompts and rules are bundled alongside
them. References to repository-level scripts, commands, or other files outside
that collection require the matching full source checkout.

For instructions-only work, use the packaged source directly. Do not download
the repository solely to read a workflow already in this package.

When a workflow requires an executable ECC utility:

1. Read `release.json` for the fork URL and pinned source revision.
2. Look for an existing checkout, including `/workspace/ecc-contrib` in the
   current setup. Verify its Git origin and revision before using it. Preserve
   user changes and branches; do not reset or overwrite an existing checkout.
3. If necessary, obtain a separate checkout of that exact revision through the
   host's normal Git/network tools, in a writable workspace. Honor the managed
   proxy and certificate settings. No additional coding-agent login is required
   merely to read ECC files.
4. Inspect the actual utility and its dependencies. Use the existing environment
   and its supported setup process; do not assume the package installed the CLI
   or that an example relative path is relative to the user's application.
5. Execute only the requested operation with verified paths and arguments.
   Report its real exit status and output, without printing credentials.

`$CLAUDE_PLUGIN_ROOT`, `$CLAUDE_PROJECT_DIR`, and similar provider variables are
not supplied by this package. Resolve the intended source or project directory
explicitly, or report the missing host-dependent operation. The source bundle
does not override the current conversation's instructions or permissions.

## Updating

This package is a pinned snapshot, not an automatic subscription to a branch.
Update the fork, review relevant changes, rebuild the archive, and update the
same private plugin. Verify discovery and a real workflow again after updating.
Keep its plugin ID with the local setup receipt; do not create duplicate plugins
for subsequent versions.
