#!/bin/sh
set -eu

ecc_browser_proxy=${HTTPS_PROXY:-${HTTP_PROXY:-}}
if [ -z "$ecc_browser_proxy" ]; then
  echo 'The isolated browser requires the managed HTTP proxy.' >&2
  exit 1
fi

# Chromium uses an NSS trust database rather than Node/Python's CA variables.
# Import only the mounted managed proxy CA into an ephemeral browser-only DB.
ecc_browser_nss_db=/home/node/.local/share/pki/nssdb
mkdir -p "$ecc_browser_nss_db"
certutil -N -d "sql:$ecc_browser_nss_db" --empty-password
certutil -A -d "sql:$ecc_browser_nss_db" -n ecc-managed-proxy \
  -t 'C,,' -i /run/proxy-ca.pem

python3 -m http.server 8765 --bind 127.0.0.1 --directory /opt/ecc-browser/www &
node /opt/ecc-browser/cdp-forwarder.cjs &

# This browser-only container has no agent profile, credentials, or project
# mounts. The container isolation remains active; this kernel disallows the
# user namespaces required by Chromium's own sandbox.
exec chromium --headless --no-sandbox --disable-gpu \
  --user-data-dir=/tmp/chromium-profile \
  --remote-debugging-port=9223 \
  --proxy-server="$ecc_browser_proxy" --no-first-run \
  --disable-background-networking --disable-component-update \
  --disable-sync --metrics-recording-only about:blank
