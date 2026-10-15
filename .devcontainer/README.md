# ECC contribution workspace

This development container provides Node.js 22, npm, Git, jq, ripgrep with PCRE2,
and Python 3 for work on ECC. Node 22 matches one of the repository's CI lanes.
The base image uses the same digest as the existing plugin setup test image.

## Open the workspace

1. Create a fork of `affaan-m/ECC` on GitHub.
2. Open a branch containing this configuration in GitHub Codespaces, or clone
   that branch on your Mac and select **Dev Containers: Reopen in Container**
   in VS Code with a working Docker installation.
3. Wait for `postCreateCommand` to finish installing dependencies with the
   repository's pinned Yarn version and immutable lockfile.
4. Run the checks relevant to your change. The standard JavaScript checks are:

   ```bash
   npm test
   npm run lint
   ```

The full test suite can take several minutes. A Linux container does not verify
macOS-specific behavior; run those checks on the Mac as well.

The container uses Corepack to select Yarn from `package.json`, and disables
dependency build scripts during installation. To repeat the setup manually:

```bash
corepack yarn install --immutable --mode=skip-build
```

For Python development, install the separate development dependencies:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/python -m pytest tests/test_*.py -m "not integration"
```

Rust development under `ecc2/` requires an additional Rust toolchain.

## Fork workflow

Keep `origin` pointed at your fork and `upstream` at `affaan-m/ECC`. Check existing
remotes with `git remote -v` before adding or changing them. Keep your fork's
`main` close to upstream and use a separate branch for each contribution.

Commit and push a branch before continuing it from another machine. Each
application that uses ECC keeps its own repository and dependency setup.
Private project configuration and credentials belong outside the public fork.

## Agent installation

This container prepares the ECC source and tests. It does not install a coding
agent, register ECC as a plugin, or authorize hooks. Configure the chosen agent
separately and follow the native plugin instructions for the source you intend
to test. ECC's guided setup currently expects the official repository.

An installed plugin can be a cached copy: editing the checkout does not by itself
refresh that copy. Record the tested source commit and refresh the native plugin
before checking a changed skill or hook in an application repository.

## Managed HTTPS proxies

For a manual image build behind a managed HTTPS proxy, pass its CA certificate
as the optional BuildKit secret `proxy_ca`. The certificate is not stored in
image layers. Runtime HTTPS clients may also need the environment's read-only
CA mount and their normal trust settings. Keep TLS verification enabled.

If your environment provides `HTTP_PROXY` and `HTTPS_PROXY`, Yarn may also need
its `YARN_HTTP_PROXY` and `YARN_HTTPS_PROXY` settings mapped to those values.
Keep these settings in the environment rather than committing proxy addresses
or certificates to the repository.
