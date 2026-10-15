#!/usr/bin/env python3
"""Build a deterministic, skills-only cloud adapter from the ECC checkout.

Only the explicit adapter templates and clean, tracked reference files are read.
Canonical helpers are shipped as reference bytes, never run by this builder.
"""

import argparse
import hashlib
import json
import os
import stat
import subprocess
import tempfile
import zipfile
from pathlib import Path, PurePosixPath


PLUGIN_NAME = "ecc-cloud"
STATIC_ROOT = "plugins/ecc-cloud"
STATIC_FILES = (
    "plugin.json",
    "README.md",
    "assets/ecc-icon.svg",
    "skills/ecc/SKILL.md",
    "skills/ecc/references/runtime.md",
)
CORPUS_ROOTS = ("skills", "agents", "rules", "LICENSE")
REFERENCES = "skills/ecc/references/"
EXCLUDED_DIRECTORIES = frozenset({".git", ".aws", ".ssh", "node_modules", "__pycache__"})
EXCLUDED_FILENAMES = frozenset({"credentials.json", "secrets.json", ".npmrc", ".pypirc"})
EXCLUDED_SUFFIXES = frozenset({".pem", ".key", ".p12", ".pfx", ".keystore", ".pyc"})


def git(root, *arguments):
    result = subprocess.run(
        ["git", "-C", str(root), *arguments], capture_output=True, check=False,
    )
    if result.returncode:
        raise ValueError("Git could not read the source repository: " +
                         result.stderr.decode("utf-8", errors="replace").strip())
    return result.stdout


def safe_path(relative):
    """Reject names that change meaning across ZIP consumers or platforms."""
    parts = relative.split("/")
    if (not relative or "\\" in relative or ":" in relative
            or any(part in ("", ".", "..") for part in parts)
            or any(ord(character) < 32 for character in relative)):
        raise ValueError(f"Unsafe path in source: {relative!r}")
    return PurePosixPath(relative)


def read_regular_file(root, relative):
    path = root
    for component in safe_path(relative).parts:
        path = path / component
        mode = path.lstat().st_mode
        if stat.S_ISLNK(mode):
            raise ValueError(f"Symlink is not allowed in source: {relative}")
    if not stat.S_ISREG(mode):
        raise ValueError(f"Source is not a regular file: {relative}")
    return path.read_bytes()


def excluded(relative):
    path = safe_path(relative)
    return (any(part.lower() in EXCLUDED_DIRECTORIES for part in path.parts)
            or path.name.lower() in EXCLUDED_FILENAMES
            or path.name.lower() == ".env" or path.name.lower().startswith(".env.")
            or path.suffix.lower() in EXCLUDED_SUFFIXES)


def collect_corpus(root):
    entries = git(root, "ls-files", "--stage", "-z", "--", *CORPUS_ROOTS)
    files = {}
    for entry in entries.split(b"\0"):
        if not entry:
            continue
        header, raw_path = entry.split(b"\t", 1)
        mode, object_id, stage = header.decode("ascii").split()
        relative = raw_path.decode("utf-8")
        safe_path(relative)
        if stage != "0":
            raise ValueError(f"Unmerged index entry: {relative}")
        if mode == "120000":
            raise ValueError(f"Tracked symlink is not allowed: {relative}")
        if mode not in ("100644", "100755"):
            raise ValueError(f"Tracked source is not a regular file: {relative}")
        if excluded(relative):
            continue
        content = read_regular_file(root, relative)
        # Compare raw bytes as well as Git's diff, which may apply line-ending filters.
        algorithm = "sha1" if len(object_id) == 40 else "sha256"
        blob = b"blob " + str(len(content)).encode("ascii") + b"\0" + content
        if hashlib.new(algorithm, blob).hexdigest() != object_id:
            raise ValueError(f"Corpus must match HEAD; modified file: {relative}")
        files[relative] = content
    if git(root, "diff", "--no-ext-diff", "--name-only", "-z", "HEAD", "--", *CORPUS_ROOTS):
        raise ValueError("Corpus must match HEAD; commit or restore tracked reference changes first")
    if "LICENSE" not in files:
        raise ValueError("The tracked LICENSE is required")
    return files


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def assemble_files(root):
    files = {
        relative: read_regular_file(root, f"{STATIC_ROOT}/{relative}")
        for relative in STATIC_FILES
    }
    manifest = json.loads(files["plugin.json"])
    if manifest.get("name") != PLUGIN_NAME:
        raise ValueError(f"Plugin manifest name must be {PLUGIN_NAME!r}")
    fork_url = manifest.get("repository")
    if not isinstance(fork_url, str) or not fork_url.startswith("https://"):
        raise ValueError("Plugin repository must be an HTTPS URL")
    static_hashes = {relative: hashlib.sha256(content).hexdigest() for relative, content in files.items()}
    corpus = collect_corpus(root)
    catalog = [
        {"name": relative[len("skills/"):-len("/SKILL.md")], "path": "upstream/" + relative}
        for relative in sorted(corpus)
        if relative.startswith("skills/") and relative.endswith("/SKILL.md")
    ]
    head = git(root, "rev-parse", "HEAD").decode("ascii").strip()
    package = json.loads(git(root, "show", "HEAD:package.json"))
    version = package.get("version")
    if not isinstance(version, str) or not version:
        raise ValueError("Committed package.json must contain a version")
    source = {
        "git_head": head,
        "fork_url": fork_url,
        "upstream_version": version,
        "static_sha256": static_hashes,
        "corpus_sha256": {path: hashlib.sha256(content).hexdigest() for path, content in corpus.items()},
        "counts": {
            "skills": len(catalog),
            "skill_files": sum(path.startswith("skills/") for path in corpus),
            "agent_files": sum(path.startswith("agents/") for path in corpus),
            "rule_files": sum(path.startswith("rules/") for path in corpus),
            "total_files": len(corpus),
        },
    }
    return {
        **files,
        **{REFERENCES + "upstream/" + path: content for path, content in corpus.items()},
        REFERENCES + "source.json": json_bytes(source),
        REFERENCES + "catalog.json": json_bytes(catalog),
    }


def build(source_root, output):
    root = source_root.resolve()
    if Path(git(root, "rev-parse", "--show-toplevel").decode("utf-8").strip()).resolve() != root:
        raise ValueError("Source root must be the Git repository root")
    if not output.is_absolute():
        raise ValueError("Output path must be absolute")
    destination = output.resolve()
    if destination == root or root in destination.parents:
        raise ValueError("Output must be outside the source repository")
    files = assemble_files(root)
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=".ecc-cloud-", suffix=".zip", dir=destination.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream, zipfile.ZipFile(stream, "w") as archive:
            for relative, content in sorted(files.items()):
                safe_path(relative)
                info = zipfile.ZipInfo(f"{PLUGIN_NAME}/{relative}", date_time=(1980, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, content, compresslevel=9)
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return len(files)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path, help="Absolute ZIP path outside the checkout")
    parser.add_argument("--source-root", type=Path, default=Path(__file__).resolve().parents[2])
    arguments = parser.parse_args()
    try:
        count = build(arguments.source_root, arguments.output)
    except (OSError, ValueError) as error:
        parser.exit(1, f"error: {error}\n")
    print(f"Built {PLUGIN_NAME}: {count} files -> {arguments.output}")


if __name__ == "__main__":
    main()
