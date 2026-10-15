# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3

# Managed builds supply these secrets; ordinary Docker uses its normal CA roots.
RUN --mount=type=secret,id=proxy_ca \
    --mount=type=secret,id=system_ca \
    if [ -f /run/secrets/system_ca ]; then \
      printf '%s\n' 'Acquire::https::CaInfo "/run/secrets/system_ca";' > /etc/apt/apt.conf.d/99-ecc-ca; \
    fi \
    && apt-get update \
    && apt-get install --yes --no-install-recommends \
      bash ca-certificates chromium diffutils git jq python3 python3-venv ripgrep \
    && rm -f /etc/apt/apt.conf.d/99-ecc-ca \
    && rm -rf /var/lib/apt/lists/*

RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi \
    && npm install --global --include=optional --ignore-scripts --strict-ssl=true \
      @openai/codex@0.159.2 ecc-universal@2.2.3 chrome-devtools-mcp@1.10.1 \
    && npm cache clean --force

RUN mkdir -p /workspace/project /opt/ecc-source \
    && chown node:node /workspace/project
WORKDIR /workspace/project
USER node
RUN codex --version && node --version && git --version && python3 --version \
    && chromium --version
CMD ["sleep", "infinity"]
