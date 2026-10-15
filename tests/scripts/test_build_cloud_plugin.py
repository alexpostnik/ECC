#!/usr/bin/env python3
"""Behavioral tests for the portable ECC cloud plugin packager (stdlib only)."""

import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

BUILDER = Path(__file__).resolve().parents[2] / "scripts/codex/build-cloud-plugin.py"
STATIC_ROOT = Path("plugins/ecc-cloud")
REFERENCE_ROOT = "ecc-cloud/skills/ecc/references/"


class CloudPluginBuilderTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="ecc-cloud-test-")
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.source = self.base / "source"
        self.source.mkdir()
        self.output = self.base / "output/ecc-cloud.zip"
        self.git("init", "--quiet", "--initial-branch=main")
        self.git("config", "core.hooksPath", "/dev/null")
        self.write("package.json", json.dumps({"version": "2.2.3"}))
        self.write("LICENSE", "MIT license fixture\n")
        self.write("skills/sample/SKILL.md", "---\nname: sample\n---\nSample\n")
        self.write("skills/sample/helper.py", "print('reference only')\n")
        self.write("skills/sample/.gitignore", "cache/\n")
        (self.source / "skills/sample/helper.py").chmod(0o755)
        self.write("agents/reviewer.md", "Review the code.\n")
        self.write("rules/common/testing.md", "Test the behavior.\n")
        self.write(STATIC_ROOT / "plugin.json", json.dumps({
            "name": "ecc-cloud", "version": "0.1.0",
            "repository": "https://github.com/alexpostnik/ECC",
        }))
        self.write(STATIC_ROOT / "README.md", "Cloud adapter.\n")
        self.write(STATIC_ROOT / "assets/ecc-icon.svg", "<svg/>\n")
        self.write(STATIC_ROOT / "skills/ecc/SKILL.md", "---\nname: ecc\n---\nRoute.\n")
        self.write(STATIC_ROOT / "skills/ecc/references/runtime.md", "Skills only.\n")
        self.commit()

    def git(self, *arguments, input_text=None):
        environment = {
            **os.environ, "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_AUTHOR_DATE": "2026-01-01T00:00:00Z",
            "GIT_COMMITTER_DATE": "2026-01-01T00:00:00Z",
        }
        result = subprocess.run(
            ["git", "-C", str(self.source), *arguments], input=input_text,
            text=True, capture_output=True, env=environment, check=True,
        )
        return result.stdout.strip()

    def write(self, relative, content):
        target = self.source / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    def commit(self):
        self.git("add", "--all")
        self.git("-c", "user.name=ECC tests", "-c", "user.email=tests@example.invalid",
                 "commit", "--quiet", "-m", "Fixture")

    def run_builder(self, *, source=None, output=None):
        return subprocess.run(
            [sys.executable, str(BUILDER), "--source-root", str(source or self.source),
             "--output", str(output or self.output)],
            text=True, capture_output=True, check=False,
        )

    def build(self):
        result = self.run_builder()
        self.assertEqual(result.returncode, 0, result.stderr)
        return zipfile.ZipFile(self.output)

    def assert_rejected(self, expected_message):
        result = self.run_builder()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(expected_message, result.stderr.lower())
        self.assertFalse(self.output.exists())

    def snapshot(self):
        return {
            str(path.relative_to(self.source)): (
                path.lstat().st_mode,
                os.readlink(path) if path.is_symlink() else hashlib.sha256(path.read_bytes()).hexdigest(),
            )
            for path in self.source.rglob("*")
            if ".git" not in path.relative_to(self.source).parts
            and (path.is_file() or path.is_symlink())
        }

    def test_build_preserves_payload_and_reports_pinned_provenance(self):
        before = self.snapshot()
        with self.build() as archive:
            names = archive.namelist()
            self.assertEqual(names, sorted(names))
            self.assertTrue(all(name.startswith("ecc-cloud/") for name in names))
            self.assertEqual(len(names), 14)  # five static, six corpus, three generated
            for relative in ("LICENSE", "skills/sample/SKILL.md", "skills/sample/helper.py",
                             "skills/sample/.gitignore", "agents/reviewer.md", "rules/common/testing.md"):
                self.assertEqual(archive.read(REFERENCE_ROOT + "upstream/" + relative),
                                 (self.source / relative).read_bytes())
            source = json.loads(archive.read(REFERENCE_ROOT + "source.json"))
            self.assertEqual(source["git_head"], self.git("rev-parse", "HEAD"))
            self.assertEqual(source["fork_url"], "https://github.com/alexpostnik/ECC")
            self.assertEqual(source["upstream_version"], "2.2.3")
            self.assertEqual(source["static_sha256"], {
                name.removeprefix("ecc-cloud/"): hashlib.sha256(archive.read(name)).hexdigest()
                for name in names
                if not name.startswith(REFERENCE_ROOT + "upstream/")
                and name not in (REFERENCE_ROOT + "source.json", REFERENCE_ROOT + "catalog.json",
                                 REFERENCE_ROOT + "release.json")
            })
            self.assertEqual(source["corpus_sha256"], {
                name.removeprefix(REFERENCE_ROOT + "upstream/"):
                    hashlib.sha256(archive.read(name)).hexdigest()
                for name in names if name.startswith(REFERENCE_ROOT + "upstream/")
            })
            self.assertEqual(source["counts"], {
                "skills": 1, "skill_files": 3, "agent_files": 1,
                "rule_files": 1, "total_files": 6,
            })
            catalog = json.loads(archive.read(REFERENCE_ROOT + "catalog.json"))
            self.assertEqual(catalog, [{"name": "sample", "path": "upstream/skills/sample/SKILL.md"}])
            self.assertTrue(all(item.date_time == (1980, 1, 1, 0, 0, 0) for item in archive.infolist()))
            self.assertTrue(all(item.external_attr >> 16 == 0o100644 for item in archive.infolist()))
        self.assertEqual(self.snapshot(), before)

    def test_release_summary_is_small_and_agrees_with_integrity_manifest(self):
        for index in range(100):
            self.write(f"skills/extra-{index:03d}/SKILL.md", f"Skill fixture {index}\n")
        self.commit()
        with self.build() as archive:
            raw = archive.read(REFERENCE_ROOT + "release.json")
            release = json.loads(raw)
            source_raw = archive.read(REFERENCE_ROOT + release["integrity_manifest"])
            source = json.loads(source_raw)
            manifest = json.loads(archive.read("ecc-cloud/plugin.json"))
            self.assertLess(len(raw), 2048)
            self.assertGreater(len(source_raw), 10000)
            self.assertEqual(release, {
                "git_head": self.git("rev-parse", "HEAD"),
                "fork_url": manifest["repository"],
                "upstream_url": "https://github.com/affaan-m/ECC",
                "upstream_version": "2.2.3",
                "plugin_version": manifest["version"],
                "counts": source["counts"],
                "integrity_manifest": "source.json",
                "catalog": "catalog.json",
            })
            self.assertEqual(source["counts"]["skills"], 101)
            self.assertEqual(set(source), {
                "git_head", "fork_url", "upstream_version", "counts", "static_sha256", "corpus_sha256",
            })
            for field in ("git_head", "fork_url", "upstream_version"):
                self.assertEqual(release[field], source[field])
            catalog = json.loads(archive.read(REFERENCE_ROOT + release["catalog"]))
            self.assertEqual(len(catalog), release["counts"]["skills"])

    def test_rebuild_is_byte_identical_despite_file_times_and_output_location(self):
        with self.build():
            pass
        first = self.output.read_bytes()
        for path in self.source.rglob("*"):
            if path.is_file() and ".git" not in path.parts:
                os.utime(path, (1700000000, 1700000000))
        second_output = self.base / "different.zip"
        result = self.run_builder(output=second_output)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(first, second_output.read_bytes())

    def test_excludes_untracked_files_and_common_secret_cache_dependency_paths(self):
        excluded = ["skills/sample/.env", "skills/sample/.env.local", "skills/sample/private.key",
                    "skills/sample/credentials.json", "skills/sample/__pycache__/helper.pyc",
                    "skills/sample/node_modules/dependency.js", "skills/sample/.git/config"]
        for relative in excluded:
            self.write(relative, "must stay outside archive\n")
        # Git does not track a nested .git directory; the remaining files deliberately are tracked.
        self.git("add", "--force", "--", *excluded[:-1])
        self.git("-c", "user.name=ECC tests", "-c", "user.email=tests@example.invalid",
                 "commit", "--quiet", "-m", "Excluded fixtures")
        self.write("skills/sample/untracked.md", "Untracked private draft\n")
        self.write(STATIC_ROOT / ".env", "Untracked static secret\n")
        self.write(STATIC_ROOT / "unexpected.py", "Not part of the explicit template\n")
        with self.build() as archive:
            names = archive.namelist()
            self.assertEqual(len(names), 14)
            self.assertFalse(any("must stay outside" in archive.read(name).decode() for name in names))

    def test_explicit_static_template_can_be_untracked(self):
        self.git("rm", "--cached", "-r", "--", str(STATIC_ROOT))
        with self.build() as archive:
            self.assertIn("ecc-cloud/plugin.json", archive.namelist())

    def test_upstream_version_is_read_from_head_not_dirty_package_json(self):
        self.write("package.json", json.dumps({"version": "99.0.0"}))
        self.git("add", "--", "package.json")
        with self.build() as archive:
            source = json.loads(archive.read(REFERENCE_ROOT + "source.json"))
            self.assertEqual(source["upstream_version"], "2.2.3")

    def test_rejects_tracked_symlink(self):
        (self.source / "skills/sample/link.md").symlink_to(self.source / "LICENSE")
        self.commit()
        self.assert_rejected("symlink")

    def test_rejects_regular_tracked_file_replaced_with_symlink(self):
        path = self.source / "skills/sample/helper.py"
        path.unlink()
        path.symlink_to(self.source / "LICENSE")
        self.assert_rejected("symlink")

    def test_rejects_symlink_parent_directory(self):
        original = self.source / "skills/sample"
        outside = self.base / "outside"
        original.rename(outside)
        original.symlink_to(outside, target_is_directory=True)
        self.assert_rejected("symlink")

    def test_rejects_static_template_symlink(self):
        path = self.source / STATIC_ROOT / "README.md"
        path.unlink()
        path.symlink_to(self.source / "LICENSE")
        self.assert_rejected("symlink")

    def test_rejects_dirty_corpus_instead_of_misrepresenting_head(self):
        self.write("skills/sample/SKILL.md", "Modified working copy\n")
        self.assert_rejected("head")

    def test_rejects_staged_corpus_instead_of_misrepresenting_head(self):
        self.write("agents/reviewer.md", "Modified staged copy\n")
        self.git("add", "--", "agents/reviewer.md")
        self.assert_rejected("head")

    def test_rejects_unsafe_git_path(self):
        self.write("skills/sample\\outside.txt", "Ambiguous path\n")
        self.commit()
        self.assert_rejected("unsafe path")

    def test_rejects_merge_conflict_index(self):
        relative = "agents/reviewer.md"
        blob = self.git("rev-parse", "HEAD:" + relative)
        self.git("update-index", "--index-info", input_text=(
            f"0 {'0' * 40}\t{relative}\n100644 {blob} 1\t{relative}\n100644 {blob} 2\t{relative}\n"
        ))
        self.assert_rejected("unmerged")

    def test_rejects_manifest_name_that_escapes_plugin_root(self):
        self.write(STATIC_ROOT / "plugin.json", json.dumps({"name": "../escape", "repository": "x"}))
        self.assert_rejected("name")

    def test_requires_absolute_output_outside_source(self):
        relative = self.run_builder(output="relative.zip")
        self.assertNotEqual(relative.returncode, 0)
        self.assertIn("absolute", relative.stderr.lower())
        inside = self.run_builder(output=self.source / "overwrite.zip")
        self.assertNotEqual(inside.returncode, 0)
        self.assertIn("outside", inside.stderr.lower())
        self.assertFalse((self.source / "overwrite.zip").exists())

    def test_requires_source_root_to_be_git_repository_root(self):
        result = self.run_builder(source=self.source / "skills")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("repository root", result.stderr.lower())

    def test_rejects_output_alias_pointing_inside_source(self):
        alias = self.base / "source-alias"
        alias.symlink_to(self.source, target_is_directory=True)
        result = self.run_builder(output=alias / "overwrite.zip")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("outside", result.stderr.lower())
        self.assertFalse((self.source / "overwrite.zip").exists())

    def test_failed_build_preserves_preexisting_output(self):
        self.output.parent.mkdir()
        self.output.write_bytes(b"existing artifact")
        self.write("skills/sample/SKILL.md", "Uncommitted modification\n")
        result = self.run_builder()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.output.read_bytes(), b"existing artifact")


if __name__ == "__main__":
    unittest.main()
