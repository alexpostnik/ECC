# Persistent native Codex host for ECC Cloud

This recipe gives ECC Cloud an optional native Codex runtime inside the existing
managed cloud environment. It also supports ordinary Docker, including Docker
Desktop, as a Linux container. The cloud conversation and the CLI session remain
distinct: selecting ECC Cloud does not automatically start a CLI session.

The image pins Codex `0.159.2`, `ecc-universal` `2.2.3`, and
`chrome-devtools-mcp` `1.10.1`. Native ECC is installed from the complete clean
fork checkout at [`d50cf128d5ee8bf8e67241910d2dfc20779ba5e0`](https://github.com/alexpostnik/ECC/tree/d50cf128d5ee8bf8e67241910d2dfc20779ba5e0).
The base image is digest-pinned; Debian packages, including Chromium, resolve
from Debian repositories at build time. There is no automatic upgrade.

## Prepare once

Prerequisites on the Docker host: Bash, Git, Python 3, Docker Engine/Desktop and
Docker Compose v2 with BuildKit. Use an existing writable project. Its files must
be accessible to container UID 1000; the launcher does not recursively change
ownership. A Docker Desktop bind mount still runs Linux, not native macOS.

Keep a separate pinned checkout so later work on the fork cannot silently change
the marketplace source. From an existing clone containing the commit:

```bash
git worktree add --detach /workspace/ecc-native-source \
  d50cf128d5ee8bf8e67241910d2dfc20779ba5e0
export ECC_SOURCE_DIR=/workspace/ecc-native-source
export ECC_PROJECT_DIR=/absolute/path/to/your/existing-project
export ECC_NATIVE_NAME=ecc-native
export ECC_NATIVE_HOME_VOLUME=ecc-native-home
```

Run the commands below from this recipe directory. Use real paths for your host;
do not run `git reset` on a working checkout. The pinned source must have no
tracked changes or untracked files. Source and project may not contain each other.

In managed cloud, first read the environment's cloud runtime instructions and
current network policy. The launcher uses the managed local Docker socket,
preserves Docker proxy/registry configuration, and mounts its CA certificates.
`BUILDX_CONFIG` only relocates Buildx metadata; `DOCKER_CONFIG`, `HOME`, and
`CODEX_HOME` are never replaced.

```bash
export ECC_BUILDX_DIR=/workspace/ecc-native-buildx
bash ecc-native.sh managed config
bash ecc-native.sh managed build
bash ecc-native.sh managed up
bash ecc-native.sh managed install
bash ecc-native.sh managed status
```

Outside managed cloud, replace `managed` with `docker` and omit `ECC_BUILDX_DIR`.
That mode respects the normal Docker context and default certificate roots.
Corporate proxies require their normal trusted Docker/CA setup; do not disable
TLS verification. Neither mode bypasses a network policy denial.

## Authentication and everyday work

Only if this native profile lacks its own working login, run:

```bash
bash ecc-native.sh managed login
```

This uses the official `codex login --device-auth` flow. The owner completes the
browser step. An existing login is preserved, never overwritten automatically.
A successful `login status` only confirms local credential presence; a real
model request verifies remote authorization. Diagnose a 401 before explicitly
replacing credentials. Do not copy managed host credentials or commit a profile.

The official device flow requires device code login to be enabled in the account's
web settings. Open `https://chatgpt.com` in a browser, then Settings → Security
and login; the native Mac application's settings can differ. For a managed
workspace, an administrator controls the relevant workspace permission. The
device page is `https://auth.openai.com/codex/device`; enter the newly issued
code there, not in a chat. Codes expire after 15 minutes.

For an agent's noninteractive task, pass the ordinary Codex arguments:

```bash
bash ecc-native.sh managed run exec \
  'Use the ECC verification-loop skill to inspect this project and report the relevant checks.'
```

On the verified managed host, nested user namespaces are unavailable: ordinary
shell commands initially fail with `bwrap: No permissions to create a new
namespace`. Headless `exec` defaults to approval policy `never`. Where authorized
for the particular task, Codex 0.159.2 provides a supported one-run alternative:

```bash
bash ecc-native.sh managed run exec --approve-for-me \
  'Use ECC to verify the current diff and run its focused tests.'
```

`--approve-for-me` uses `workspace-write`, approval policy `on-request`, and
reviewer `auto_review`; individual escalation requests are reviewed. It does not
write those settings to the profile or fix nested user namespaces. Do not combine
this option with `--sandbox`, disable container isolation, or change host sysctls.
Permanent approval settings require the owner's separate authorization. The
deployment's attempt to save permanent defaults was rejected by automatic review;
the profile remains unchanged. No launcher default silently enables this mode.

For an interactive terminal, use the matching Docker context/socket:

```bash
docker exec -it -w /workspace/project ecc-native codex
```

The normal `node` user's `/home/node` resides in `ecc-native-home`. It holds the
native profile, installed plugin cache and owner login. Project files live in the
explicit host bind mount. Restarting or recreating the container preserves both
when the same volume and project are retained. The launcher never deletes a
volume, logs out, edits host profiles, or automatically updates plugins.

## Agent cold start in a new cloud task

1. Read the selected ECC Cloud entry skill, applicable rules, and the task's
   current project instructions. Inspect the current managed environment.
2. Locate this recipe and the existing source/project paths. Run `config` then
   `status`. Do not assume that a prior task's Docker daemon or volume survived.
3. If the container is absent/stopped, use `build` only when the pinned image is
   absent, then `up` and `install`. Installation uses native marketplace/plugin
   commands and checks the installed cache against the pinned source. Existing
   matching registration and settings are preserved; conflicts cause an error.
4. If already running and verified, reuse it. Do not start another login merely
   because this cloud conversation has different authorization. Run the requested
   project task through `run exec ...`, or work with the cloud conversation's
   tools when the task does not need native capabilities.
5. Treat native registration, skill discovery, model execution, trusted hooks,
   browser MCP, and memory as separate acceptance checks. Report actual results.

`up` refuses a container whose source/project/home/CA mounts differ. It uses
`--no-recreate` to preserve a matching active host. To use another project, choose
an explicit new container name; choose a different home volume too if you want a
separate profile. Do not run two active Codex hosts against one home volume.
If managed proxy addresses change, review and deliberately recreate the exact
container with the current overlay, retaining the same home volume. Automatic
recreation is intentionally excluded from the launcher.

## Features and acceptance limits

The native lifecycle is documented in the pinned
[Codex plugin guide](https://github.com/alexpostnik/ECC/blob/d50cf128d5ee8bf8e67241910d2dfc20779ba5e0/.codex-plugin/README.md).
The commands used are `codex plugin marketplace add /opt/ecc-source`,
`codex plugin add ecc@ecc`, and `codex plugin list --marketplace ecc --json`.
This local fork registration does not weaken the separate guided installer's
official-source provenance checks.

- The package includes 311 canonical skills, 71 agent guidance files and 122
  rules. Guidance files do not become autonomous registered agents automatically.
  Bootstrap creates a concise native-profile `AGENTS.md` rule/workflow route only
  when that file is absent; existing owner guidance is preserved. Verify the
  resulting instruction chain with `codex debug prompt-input` in a new process.
  Codex 0.159.2 may truncate its model-visible skill catalog under this load.
  Select needed skills explicitly from the full `skills/list` inventory (native
  picker or app-server `UserInput::Skill`), using the returned name/path, then
  have the agent read the complete selected `SKILL.md`. Installed inventory,
  prompt visibility, and a complete workflow read are distinct checks.
- Native hooks require Codex's supported trust/enablement flow; the pinned
  manifest provides `SessionStart`. Do not fabricate trust hashes or claim full
  Claude lifecycle parity.
- Chrome MCP needs a working headless browser configuration and a real tool
  call. Installing Chromium and MCP packages alone does not enable it.
- ECC memory needs project initialization and write/read/search verification;
  its MCP connection is separate. This launcher does not overwrite MCP or memory
  settings. See the [deployment audit](../../../docs/CODEX-DEPLOYMENT-AUDIT.md)
  for the current acceptance evidence and outstanding steps.

The original deployment verified real native installation, all 311 canonical
skills through `skills/list`, cache contents and persistence across a restart.
This portable recipe is validated with Compose configuration and guard checks;
it is not a claim that every Docker host or a fresh build has completed all
model, hooks, browser and memory checks.

Named volumes survive container recreation on the same Docker daemon. A new or
replaced cloud VM may have neither that volume nor the project. Arrange an
owner-approved encrypted backup/restore separately if cross-VM persistence is
required; the recipe makes no automatic backup or cross-task survival promise.
Never commit `auth.json`, profile archives, device codes, or private receipts.

## Managed browser and memory

The verified managed deployment keeps Chromium in a separate container without
the agent profile or project mounts. Its debugger is reachable only on the
private Compose network; there are no published host ports. The browser runs
as `node` with a read-only root filesystem, all capabilities dropped, and
`no-new-privileges`. This host disallows Chromium's user-namespace sandbox, so
`--no-sandbox` is confined to that browser-only container. The Docker isolation
and managed network controls remain in force. Do not attach credentials or
project files to it, add privileged capabilities, or expose its debugger.

After building the image and starting native, start the separate browser:

```bash
bash ecc-native.sh managed browser
```

This overlay requires the managed proxy and CA. The browser imports that CA into
an ephemeral NSS database; it does not disable TLS verification. The browser
overlay is verified for this managed host, not for every Docker Desktop setup.
Run these supported configuration commands inside the native container once:

```bash
codex mcp add chrome-devtools -- \
  /usr/local/bin/chrome-devtools-mcp --browserUrl=http://browser:9222 \
  --no-usage-statistics --no-performance-crux

ecc memory init --scope project
codex mcp add ecc-memory-vault \
  --env ECC_MEMORY_HARNESS=codex \
  --env ECC_MEMORY_PROJECT_ROOT=/workspace/project/.ecc/memory \
  -- /usr/local/bin/ecc-memory-mcp
```

Inspect existing MCP registrations first; retain equivalent entries. The
`chrome-devtools` user override uses the already installed pinned binary and
leaves the plugin cache unchanged. `ECC_MEMORY_PROJECT_ROOT` is the vault base,
not the repository root. Keep `.ecc/memory/project` private as initialized by ECC.
Verify browser navigation, snapshot and page content, then memory save, search,
read and doctor through the real native MCP tools in a new session.

For hooks, review the installed `hooks/codex-hooks.json` and its referenced
runtime, then trust the selected SessionStart handler in `/hooks`. An app-server
client can use the same supported flow as the pinned TUI: obtain `key` and
`currentHash` from `hooks/list`, write that selected key's `trusted_hash` and
`enabled=true` under `hooks.state` with `config/batchWrite`, and recheck
`trustStatus=trusted`. Do not synthesize hashes or trust unrelated hooks. Observe
`hook/started` and `hook/completed` on the first actual turn; `thread/start`
alone does not run the handler. Re-review changed hooks after any upgrade.
