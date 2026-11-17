# ECC for Codex CLI

This supplements the root `AGENTS.md` with Codex-specific guidance.

For repo navigation, surface ownership, and PR diff packet guidance, read
`docs/CODEX-NAVIGATION-GUIDE.md` after this supplement.

## Model Recommendations

| Task Type | Recommended Model |
|-----------|------------------|
| Routine coding, tests, formatting | GPT-6.2 Sol medium |
| Complex features, architecture | GPT-6.2 Astra high |
| Debugging, refactoring | GPT-6.2 Sol high |
| Security review | GPT-6.2 Astra high or max |

Use the [Codex subagent guidance](https://learn.chatgpt.com/docs/agent-configuration/subagents) as the baseline. For a GPT-6.2 parent, start with the same model and effort unless scope and risk justify another pair. Compare time, quality and usage per accepted task, including retries. These profiles are starting points for this fork.

Before launching a child, check that the host supports the requested model and
effort; these recommendations do not guarantee availability. Preserve explicit
owner model choices and the inherited primary model. If a model is unavailable
before a child is created, retry at most once with an available model suited to
the role; do not retry an uncertain spawn blindly or bypass a permission denial.
Report requested model and effort separately from runtime observations: config
and self-reports alone do not prove which model or effort ran.

## Skills Discovery

Skills are auto-loaded from `.agents/skills/`. Each skill contains:
- `SKILL.md` — Detailed instructions and workflow
- `agents/openai.yaml` — Codex interface metadata

Available skills:
- tdd-workflow — Test-driven development with 80%+ coverage
- security-review — Comprehensive security checklist
- coding-standards — Universal coding standards
- frontend-patterns — React/Next.js patterns
- frontend-slides — Viewport-safe HTML presentations and PPTX-to-web conversion
- article-writing — Long-form writing from notes and voice references
- content-engine — Platform-native social content and repurposing
- market-research — Source-attributed market and competitor research
- investor-materials — Decks, memos, models, and one-pagers
- investor-outreach — Personalized investor outreach and follow-ups
- backend-patterns — API design, database, caching
- e2e-testing — Playwright E2E tests
- eval-harness — Eval-driven development
- strategic-compact — Context management
- api-design — REST API design patterns
- verification-loop — Build, test, lint, typecheck, security
- deep-research — Multi-source research with firecrawl and exa MCPs
- exa-search — Neural search via Exa MCP for web, code, and companies
- claude-api — Anthropic Claude API patterns and SDKs
- x-api — X/Twitter API integration for posting, threads, and analytics
- crosspost — Multi-platform content distribution
- fal-ai-media — AI image/video/audio generation via fal.ai
- dmux-workflows — Multi-agent orchestration with dmux

## MCP Servers

The native Codex plugin loads the repository-root `.mcp.json`, which currently
declares one default server: `chrome-devtools`. Other connectors are opt-in;
see `docs/MCP-CONNECTOR-POLICY.md` and `mcp-configs/mcp-servers.json`.

The project-local `.codex/config.toml` defines guidance, features, and agent
roles; it does not declare MCP servers. The separate
`.codex/user-config.example.toml` retains existing user-install registrations.
Review that reference before installing it; it is not the native plugin's
default connector set.

### Legacy managed sync

`scripts/sync-ecc-to-codex.sh` is a separate, deprecated compatibility path,
not native plugin installation. Its MCP merger currently manages
`chrome-devtools`, using the configured package manager.

The merger adds missing managed entries and warns about drift.
`--update-mcp` replaces the managed entry. Other user-defined servers are
preserved, except for the specific legacy Exa URL-only entry repaired by the
merger. `ECC_DISABLED_MCPS` filters generated entries and removes disabled
managed entries during sync.

## External Action Boundaries

Treat networked tools as read-only by default. Search, inspect, and draft freely within the user's requested scope, but require explicit user approval before posting, publishing, pushing, merging, opening paid jobs, dispatching remote agents, changing third-party resources, or modifying credentials.

When approval is ambiguous, produce a local plan or draft artifact instead of taking the external action. Preserve user config and private state unless the user specifically asks for a scoped change.

## Multi-Agent Support

Current Codex versions expose multi-agent tools through `[agents] enabled` (on by default). This fork also carries the older feature setting for clients that use it. Use `/subagents` in the current CLI to inspect child threads.

This fork registers each project role in `[agents.<name>]` with a `config_file` relative to the declaring configuration. For a new standalone role, put one TOML file in `.codex/agents/` for the project or `~/.codex/agents/` for the user. Specify `name`, `description`, and `developer_instructions`. Fixed model or effort fields override the corresponding resolved launch values. Define the pair only when the role requires it. Claude Code reads `CLAUDE.md` and stores project subagents in `.claude/agents/*.md` with YAML frontmatter and a Markdown instruction body. [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) · [Claude Code subagents](https://code.claude.com/docs/en/sub-agents).

Sample role configs in this repo:
- `.codex/agents/explorer.toml` — read-only evidence gathering
- `.codex/agents/reviewer.toml` — correctness/security review
- `.codex/agents/docs-researcher.toml` — API and release-note verification

## Key Differences from Claude Code

| Feature | Claude Code | Codex CLI |
|---------|------------|-----------|
| Hooks | 8+ event types | Reviewed native subset with explicit trust in `/hooks` |
| Context file | CLAUDE.md (can import shared guidance) | AGENTS.md or AGENTS.override.md by directory |
| Skills | Skills loaded via plugin | Native plugin skills and repo `.agents/skills/` |
| Commands | `/slash` commands | Instruction-based |
| Agents | Subagent Task tool | `/subagents`; standalone TOML or registered roles |
| Security | Hook profiles + sandbox | Trusted hook subset + instruction + sandbox |
| MCP | Full support | Supported via `config.toml` and `codex mcp add` |

## Security with Narrower Hooks

Codex supports a narrower native hook subset than Claude Code, with explicit trust in `/hooks`. Treat those reviewed hooks as one layer alongside instructions and the sandbox:
1. Always validate inputs at system boundaries
2. Never hardcode secrets — use environment variables
3. Run `npm audit` / `pip audit` before committing
4. Review `git diff` before every push
5. Use `sandbox_mode = "workspace-write"` in config
