# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3

# Managed environments can supply their HTTPS proxy CA as a BuildKit secret.
# Ordinary Codespaces and local builds do not need this optional mount.
RUN --mount=type=secret,id=proxy_ca \
    set -eu; \
    set --; \
    if [ -s /run/secrets/proxy_ca ]; then \
      set -- -o Acquire::https::CaInfo=/run/secrets/proxy_ca; \
    fi; \
    apt-get "$@" update; \
    apt-get "$@" install --yes --no-install-recommends \
      bash ca-certificates git jq ripgrep python3 python3-venv; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /workspaces/ECC
RUN chown node:node /workspaces/ECC
USER node
