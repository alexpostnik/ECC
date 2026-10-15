#!/usr/bin/env bash
set -euo pipefail
recipe_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
source_pin=d50cf128d5ee8bf8e67241910d2dfc20779ba5e0
usage() {
  echo 'Usage: ecc-native.sh managed|docker config|build|up|install|status|login|run [Codex arguments]'
  echo 'Set ECC_SOURCE_DIR (clean pinned checkout) and ECC_PROJECT_DIR (existing project).'
  echo 'Optional: ECC_NATIVE_NAME=ecc-native, ECC_NATIVE_HOME_VOLUME=ecc-native-home.'
}
fail() { echo "$*" >&2; exit 1; }
if [[ $# -lt 2 ]]; then usage; exit 2; fi
mode=$1; action=$2; shift 2
case "$mode" in managed|docker) ;; *) usage; exit 2 ;; esac
case "$action" in config|build|up|install|status|login|run) ;; *) usage; exit 2 ;; esac
[[ "$action" == run || $# == 0 ]] || { usage; exit 2; }
[[ "$action" != run || $# -gt 0 ]] || { echo 'Use run exec <prompt>; interactive sessions need a terminal.' >&2; exit 2; }
: "${ECC_SOURCE_DIR:?Set ECC_SOURCE_DIR to a clean checkout of the pinned revision}"
: "${ECC_PROJECT_DIR:?Set ECC_PROJECT_DIR to your existing project}"
[[ -d "$ECC_SOURCE_DIR" && -d "$ECC_PROJECT_DIR" ]] || fail 'Source and project directories must already exist.'
export ECC_SOURCE_DIR=$(cd -- "$ECC_SOURCE_DIR" && pwd -P)
export ECC_PROJECT_DIR=$(cd -- "$ECC_PROJECT_DIR" && pwd -P)
export ECC_NATIVE_NAME=${ECC_NATIVE_NAME:-ecc-native}
export ECC_NATIVE_HOME_VOLUME=${ECC_NATIVE_HOME_VOLUME:-ecc-native-home}
[[ "$ECC_NATIVE_NAME" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || fail 'Invalid ECC_NATIVE_NAME.'
[[ "$ECC_NATIVE_HOME_VOLUME" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || fail 'Invalid ECC_NATIVE_HOME_VOLUME.'
[[ "$(git -C "$ECC_SOURCE_DIR" rev-parse HEAD)" == "$source_pin" ]] || fail "Source must be pinned to $source_pin; existing checkouts are never reset."
[[ -z "$(git -C "$ECC_SOURCE_DIR" status --porcelain --untracked-files=all)" ]] || fail 'Source checkout must be clean, including untracked files.'
[[ "$ECC_PROJECT_DIR" != "$ECC_SOURCE_DIR" && "$ECC_PROJECT_DIR" != "$ECC_SOURCE_DIR/"* && "$ECC_SOURCE_DIR" != "$ECC_PROJECT_DIR/"* ]] || fail 'Source and project directories must not contain each other.'
docker_cmd=(docker)
compose_files=(-f "$recipe_dir/compose.yaml")
if [[ "$mode" == managed ]]; then
  : "${CODEX_PROXY_CERT:?Managed proxy certificate path is required}"
  [[ -r "$CODEX_PROXY_CERT" && -r /etc/ssl/certs/ca-certificates.crt ]] || fail 'Managed CA files are not readable.'
  docker_cmd=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
  compose_files+=(-f "$recipe_dir/compose.managed.yaml")
fi
compose() { "${docker_cmd[@]}" compose "${compose_files[@]}" "$@"; }
# Inspect only mounts, never dump container environment or authentication.
check_existing_container() {
  "${docker_cmd[@]}" info --format '{{.ServerVersion}}' >/dev/null
  local found mounts
  found=$("${docker_cmd[@]}" ps -a --filter "name=^/${ECC_NATIVE_NAME}$" --format '{{.Names}}')
  [[ -n "$found" ]] || return 0
  mounts=$("${docker_cmd[@]}" inspect --format '{{json .Mounts}}' "$ECC_NATIVE_NAME")
  python3 - "$mounts" "$ECC_SOURCE_DIR" "$ECC_PROJECT_DIR" "$ECC_NATIVE_HOME_VOLUME" "$mode" "${CODEX_PROXY_CERT:-}" <<'PY'
import json
import sys
mounts = {item['Destination']: item for item in json.loads(sys.argv[1])}
expected = [('/opt/ecc-source', 'bind', sys.argv[2], False),
            ('/workspace/project', 'bind', sys.argv[3], True),
            ('/home/node', 'volume', sys.argv[4], True)]
if sys.argv[5] == 'managed':
    expected += [('/run/proxy-ca.pem', 'bind', sys.argv[6], False),
                 ('/run/system-ca.pem', 'bind', '/etc/ssl/certs/ca-certificates.crt', False)]
actual_persistent = {path for path, item in mounts.items() if item.get('Type') != 'tmpfs'}
if actual_persistent != {item[0] for item in expected}:
    sys.exit('Existing container has different mount destinations; refusing to change it.')
for target, kind, source, writable in expected:
    actual = mounts.get(target, {})
    source_key = 'Name' if kind == 'volume' else 'Source'
    if (actual.get('Type'), actual.get(source_key), actual.get('RW')) != (kind, source, writable):
        sys.exit('Existing container mounts differ; refusing to start/recreate it. Review the project and volume names.')
PY
}
case "$action" in
  config) compose config --quiet ;;
  build)
    # Only Buildx metadata moves; DOCKER_CONFIG and native profiles stay intact.
    if [[ "$mode" == managed ]]; then
      : "${ECC_BUILDX_DIR:?Set ECC_BUILDX_DIR to a writable build-cache directory}"
      mkdir -p -- "$ECC_BUILDX_DIR"
      BUILDX_CONFIG="$ECC_BUILDX_DIR" compose build native
    else compose build native; fi ;;
  up) check_existing_container; compose up -d --no-build --no-recreate native ;;
  install) check_existing_container; compose exec -T native bash -s < "$recipe_dir/bootstrap.sh" ;;
  status)
    check_existing_container
    compose ps
    compose exec -T native codex --version
    compose exec -T native codex plugin list --marketplace ecc --json
    if compose exec -T native codex login status >/dev/null 2>&1; then
      echo 'Native login is present; a real model turn still verifies authorization.'
    else echo 'Native login is absent or invalid; inspect the login error before reauthentication.'; fi ;;
  login)
    check_existing_container
    if compose exec -T native codex login status >/dev/null 2>&1; then
      echo 'Native login already exists; preserving it.'
    else compose exec -T native codex login --device-auth; fi ;;
  run) check_existing_container; compose exec -T native codex "$@" ;;
esac
