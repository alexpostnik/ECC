# ECC cloud plugin packaging: TDD evidence

## Intent and source plan

Journeys were derived from the user's request to use ECC in an existing managed
Codex cloud environment. No external plan file was executed. Native plugin state
could not be written into the active read-only profile, so this fork adds a
private portable skills package using the existing cloud plugin surface.

The package exposes one entry skill and preserves the original canonical ECC
skills, agent guidance, and rules as references. It does not enable native hooks,
MCP servers, or automatic memory collection.

## Journeys and guarantees

| Journey | Guarantee | Test evidence |
| --- | --- | --- |
| Build a portable package from the fork | One package root, expected files, original bytes and provenance | Payload/provenance test |
| Repeat the build | Byte-identical ZIP regardless of file times and output location | Deterministic rebuild test |
| Keep unrelated local data outside the package | Explicit template list, tracked corpus, exclusions for common secrets and dependencies | Exclusion test |
| Resolve paths safely | Symlink files/parents, unsafe archive paths, merge conflicts, and output aliases are rejected | Path and index tests |
| Report a trustworthy source revision | Corpus must match HEAD; version is read from committed package.json | Dirty/staged corpus and version tests |
| Preserve an earlier artifact on failure | Failed builds leave the existing output intact | Existing-output test |

## RED and GREEN checkpoints

- `fab6bfeb`: 16 tests executed, 15 expected failures before the builder existed.
  Fixtures and Git setup completed; the missing implementation was the RED signal.
- `78bbee41`: extended RED, 18 tests executed and 17 failures before implementation.
  Added committed-version provenance and output symlink-alias cases.
- `6207dc5f`: the payload test exposed missing `corpus_sha256` with a KeyError.
- `8a7449c0`: GREEN, all 18 tests pass with the builder and portable templates.

The same focused suite is reproducible with:

```bash
python3 -m unittest discover -s tests/scripts -p 'test_build_cloud_plugin.py' -v
```

## Coverage and review

Python's standard-library `trace` measured 146 of 154 executable statement lines
(94.8%). The measurement wrapped builder subprocesses with `trace.Trace` and
`runpy.run_path`, accumulated counts across the 18 tests, and counted covered
and missing statements in the generated `.cover` report. This is statement-line
coverage, not branch coverage. The raw trace report is retained with the local
setup receipt.

Markdown lint and `git diff --check` passed. Independent review identified one
ambiguity in catalog path resolution, fixed before publication. Further review
reported no concrete defects. Ruff was not installed in this environment; no
successful Ruff run is claimed.

## Artifact and host acceptance

The tested source revision is `8a7449c08694b57a31a0974fa390ec5c3c5b55f1`.
The ZIP contains 814 files: 807 original reference files, five adapter templates,
and two generated metadata files. All corpus hashes and router references were
checked. Archive SHA-256:

```text
85f561636f9003132a00010e56d5e79ae22d17bfddac23699a3074aca76efa87
```

The private plugin service accepted the package. Readback through the owner's API
confirmed byte equality for the entry skill, runtime, provenance, catalog,
coding-standards, and verification-loop. The host adds a compatibility manifest
and normalizes manifest owner/developer metadata.

After the user added the plugin, a verification agent with a refreshed context
discovered `ecc-cloud:ecc` through cloud skill discovery. Using the returned
package/resource, it read the entry skill, runtime, source, catalog, and canonical
code-reviewer, coding-standards, and verification-loop instructions. It then
applied verification-loop to the real builder task: all 18 focused tests passed.
This verifies discovery, resource reading, and practical workflow use separately
from the owner's API readback and the earlier manual use of ECC instructions.

During that turn, the already-running root context returned empty skill lists
and rejected reading the package as unavailable. After the user's next message,
the root context also discovered `ecc-cloud:ecc` and read its entry, source,
runtime, planner, and verification-loop through the skill reader. It applied
those workflows to the Codex documentation synchronization, with 20 focused
tests passing. No plugin recreation was required. Later in that same turn,
the final discovery check again returned an empty cloud skill list and reading
the package failed with `skill package is not available`. Successful workflow
use is established, but stable availability is not. The exact refresh mechanism
and cause of the repeated loss of access remain unknown; issue #2 stays open.
See the [current status](../CODEX-CLOUD-STATUS.md).
