---
name: ecc
description: "Use ECC when the user requests ECC or Everything Claude Code workflows in a cloud conversation: planning, test-driven implementation, code review, verification, or a named ECC skill. Routes to the original, pinned ECC skills and agent guidance shipped with this package."
license: MIT
---

# ECC in the current cloud conversation

Use the original ECC workflow appropriate to the user's task with the tools
already available in this conversation. This package is a private adaptation
from the user's fork. It provides one discoverable entry skill and a collection
of original ECC files as supporting references.

## Start with the task and the actual environment

1. Identify the project and requested outcome. Inspect the current repository
   and its instructions before selecting commands or changing files. Keep an
   existing cloud environment as the execution environment unless the user
   requests another one.
2. Read [release.json](references/release.json) for the short release summary
   and [runtime.md](references/runtime.md) for the cloud capability boundaries.
   Read the full `source.json` hash manifest only for an integrity audit.
3. Before implementing, refactoring, or reviewing code, select and read the
   applicable rules as described below.
4. Select the smallest useful set of ECC workflows. Read the complete selected
   source before applying it. Mention which workflow is being used.
5. Use the user's language. Preserve their existing authorization and choices.
   Higher-priority host instructions and the user's request govern execution.

## Select applicable rules

For code implementation, refactoring, and review, this step is required before
using the task-specific workflow. Read the [rules layering guide](references/upstream/rules/README.md),
then load the relevant files:

- Start with common [coding style](references/upstream/rules/common/coding-style.md),
  [testing](references/upstream/rules/common/testing.md), and
  [security](references/upstream/rules/common/security.md).
- Before implementation or refactoring, also read the
  [development workflow](references/upstream/rules/common/development-workflow.md),
  including its post-change review step. Read other common rules when the task
  needs them, such as agent orchestration for delegation or Git workflow for a PR.
- Identify the languages and frameworks from the actual project. Read their
  matching rule files for the selected topics under `references/upstream/rules/`
  (for example, `golang/testing.md` for Go or `python/coding-style.md` for Python).
  Language-specific rules override common defaults where they differ; project,
  user, and host instructions retain their governing priority.

Briefly name the selected rule sets and carry their applicable checks into the
work and verification. Apply each rule to the requested phase: reviewing a diff
does not authorize implementing, installing, or publishing. If no dedicated
language rule set exists, use the common rules and a relevant domain skill.
For other tasks, load rules only when relevant. Do not load the entire rules
tree or skill catalog by default. Reading rules guides the work; it does not
install automatic enforcement or hooks.

## Route to original ECC instructions

Paths below are relative to this skill. Open them through the same skill reader
that loaded this file, resolving the complete resource identifier within this
package. If the host exposes a local skill directory, read the files there.
Do not treat a `skill://` identifier as a shell path.

| User's task | Read first |
| --- | --- |
| Plan a feature or refactor | [planner](references/upstream/agents/planner.md) |
| Implement or fix code with tests | [tdd-workflow](references/upstream/skills/tdd-workflow/SKILL.md) and [coding-standards](references/upstream/skills/coding-standards/SKILL.md) |
| Review a change | [code-reviewer](references/upstream/agents/code-reviewer.md) |
| Verify completed work | [verification-loop](references/upstream/skills/verification-loop/SKILL.md) |
| Choose a domain-specific workflow | [catalog.json](references/catalog.json), then the matching original `SKILL.md` |
| Apply shared or language rules | The relevant files under `references/upstream/rules/` |

Paths inside `catalog.json` are relative to its containing `references/`
directory, not to the skill root. Resolve them against that directory to locate
the bundled originals. Agent files are role guidance for an available
delegation tool, not proof of registered native agent roles.
Keep the current model unless the user or governing instructions require a
different one. Delegate only useful, bounded work.

## Execute the selected workflow

- Apply the source instructions to the real project. Detect its language,
  package manager, test runner, and existing checks. Example commands in an ECC
  document are examples; do not run an unrelated npm, Python, or browser check.
- For implementation, use the TDD workflow's RED/GREEN evidence and checkpoint
  rules when applicable. A failure must exercise the intended missing behavior.
- For review, use the code reviewer's confidence and evidence requirements.
  Report concrete findings; a clean review is a valid outcome.
- For verification, report measured results and explicit skips. Do not turn a
  syntax check into a claim that the application ran, or infer coverage without
  measuring it.
- Keep scope focused. Do not provision another development environment,
  install another agent, or publish to upstream just because an example does.

## Resolve host differences explicitly

Canonical ECC instructions can mention Claude tools, slash commands, plugin
paths, local scripts, lifecycle hooks, or external services. Read
[runtime.md](references/runtime.md) before using such a dependency.

Use the host's available file, shell, search, and delegation tools for equivalent
steps. A slash command can be a named workflow to perform, rather than a command
to send to a nonexistent CLI. Never execute unresolved provider variables.
Do not change protected agent configuration or substitute `HOME` or `CODEX_HOME`.

If a needed capability is unavailable, identify the affected step and continue
independent work. Do not silently replace a missing integration with a simulated
result. Installation, discovery, reading a skill, and successfully executing a
workflow are distinct states.

## Finish with evidence

Report the outcome, which ECC workflow was applied, what actually ran, and any
remaining limitation. Link changed files or saved artifacts. The useful result
is the user's completed task; reading this router alone is not a completed run.
