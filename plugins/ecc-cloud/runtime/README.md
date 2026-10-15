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

For an agent's noninteractive task, pass the ordinary Codex arguments:

```bash
bash ecc-native.sh managed run exec \
  'Use the ECC verification-loop skill to inspect this project and report the relevant checks.'
```

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
