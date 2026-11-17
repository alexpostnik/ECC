/**
 * Tests for scripts/astra-review.js (CLI)
 *
 * Run with: node tests/scripts/astra-review.test.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const cli = require('../../scripts/astra-review');
const { resolveCodexCommand } = require('../../scripts/lib/astra-review/codex');
const { RUBRIC } = require('../../scripts/lib/astra-review/prompt');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'astra-review.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }
}

function sink() {
  const chunks = [];
  return { write: (text) => chunks.push(String(text)), text: () => chunks.join('') };
}

const passingReview = { verdict: 'PASS', summary: 'fine', checks: [], findings: [] };
const failingReview = {
  verdict: 'FAIL', summary: 'bad', checks: [],
  findings: [{ severity: 'HIGH', file: 'a.js', line: 1, title: 'Bug', detail: '', suggestion: '' }],
};

function baseDeps(overrides = {}) {
  return {
    cwd: '/repo',
    collectChanges: () => ({ files: ['a.js'], diff: '+x', truncated: true, root: '/repo-root', recovery: 'git show sha:<path>' }),
    runCodexReview: () => passingReview,
    stdout: sink(),
    stderr: sink(),
    writeFile: () => {},
    ...overrides,
  };
}

console.log('=== Testing scripts/astra-review.js ===\n');

test('parseArgs defaults to uncommitted scope and gpt-6.2-astra', () => {
  const options = cli.parseArgs([], {});

  assert.strictEqual(options.scope.kind, 'uncommitted');
  assert.strictEqual(options.model, 'gpt-6.2-astra');
  assert.strictEqual(options.consent, false);
});

test('parseArgs honors ECC_ASTRA_MODEL and ECC_ASTRA_CONSENT', () => {
  const options = cli.parseArgs([], { ECC_ASTRA_MODEL: 'gpt-5.5', ECC_ASTRA_CONSENT: '1' });

  assert.strictEqual(options.model, 'gpt-5.5');
  assert.strictEqual(options.consent, true);
});

test('parseArgs collects multiple --files paths', () => {
  const options = cli.parseArgs(['--files', 'a.js', 'b.js', '--json'], {});

  assert.deepStrictEqual(options.scope, { kind: 'files', value: ['a.js', 'b.js'] });
  assert.strictEqual(options.json, true);
});

test('parseArgs accepts --files-from-commit for repair rounds', () => {
  const options = cli.parseArgs(['--files-from-commit', 'HEAD~1'], {});

  assert.deepStrictEqual(options.scope, { kind: 'files-from-commit', value: 'HEAD~1' });
});

test('parseArgs rejects unknown flags and bad timeouts', () => {
  assert.throws(() => cli.parseArgs(['--bogus'], {}), /unknown argument/);
  assert.throws(() => cli.parseArgs(['--timeout-seconds', '5'], {}), /timeout-seconds/);
  assert.throws(() => cli.parseArgs(['--model', 'bad slug!'], {}), /invalid model/);
});

test('parseArgs validates --reasoning-effort and limits it to review mode', () => {
  assert.strictEqual(cli.parseArgs(['--reasoning-effort', 'xhigh'], {}).reasoningEffort, 'xhigh');
  assert.throws(() => cli.parseArgs(['--reasoning-effort'], {}), /requires a value/);
  assert.throws(() => cli.parseArgs(['--reasoning-effort', 'unknown'], {}), /--reasoning-effort must be/);
  assert.throws(
    () => cli.parseArgs(['--fix-findings', 'findings.json', '--reasoning-effort', 'high'], {}),
    /--reasoning-effort.*--fix-findings/
  );
});

test('runCli prints "Nothing to review" and passes when there are no changes', () => {
  const deps = baseDeps({ collectChanges: () => ({ files: [], diff: '', truncated: false }) });

  const code = cli.runCli(cli.parseArgs(['--consent-to-openai'], {}), deps);

  assert.strictEqual(code, cli.EXIT_PASS);
  assert.ok(deps.stdout.text().includes('Nothing to review'));
});

test('runCli --dry-run prints the prompt and never calls Codex', () => {
  let called = false;
  const deps = baseDeps({ runCodexReview: () => { called = true; return passingReview; } });

  const code = cli.runCli(cli.parseArgs(['--dry-run'], {}), deps);

  assert.strictEqual(code, cli.EXIT_PASS);
  assert.strictEqual(called, false);
  assert.ok(deps.stdout.text().includes('--- BEGIN DIFF ---'));
});

test('runCli refuses to call Codex without consent', () => {
  let called = false;
  const deps = baseDeps({ runCodexReview: () => { called = true; return passingReview; } });

  const code = cli.runCli(cli.parseArgs([], {}), deps);

  assert.strictEqual(code, cli.EXIT_ERROR);
  assert.strictEqual(called, false);
  assert.ok(deps.stderr.text().includes('consent'));
});

test('runCli returns 0 and a markdown report on PASS', () => {
  const deps = baseDeps();

  const code = cli.runCli(cli.parseArgs(['--consent-to-openai'], {}), deps);

  assert.strictEqual(code, cli.EXIT_PASS);
  assert.ok(deps.stdout.text().includes('# Astra Review (gpt-6.2-astra)'));
  assert.ok(deps.stdout.text().includes('**PASS**'));
});

test('runCli returns 1 on FAIL and writes JSON to --output', () => {
  let written = null;
  const deps = baseDeps({
    runCodexReview: () => failingReview,
    writeFile: (file, content) => { written = { file, content }; },
  });

  const code = cli.runCli(cli.parseArgs(['--consent-to-openai', '--output', '/tmp/r.json', '--json'], {}), deps);

  assert.strictEqual(code, cli.EXIT_FAIL);
  assert.strictEqual(written.file, '/tmp/r.json');
  assert.strictEqual(JSON.parse(written.content).verdict, 'FAIL');
  assert.strictEqual(JSON.parse(deps.stdout.text()).review.findings.length, 1);
});

test('runCli passes model, reasoning effort, prompt, and timeout through to the reviewer', () => {
  let seen = null;
  const deps = baseDeps({ runCodexReview: (input) => { seen = input; return passingReview; } });

  cli.runCli(cli.parseArgs([
    '--consent-to-openai', '--model', 'gpt-5.5', '--reasoning-effort', 'medium', '--timeout-seconds', '60',
  ], {}), deps);

  assert.strictEqual(seen.model, 'gpt-5.5');
  assert.strictEqual(seen.reasoningEffort, 'medium');
  assert.strictEqual(seen.timeoutMs, 60_000);
  assert.strictEqual(seen.cwd, '/repo-root');
  assert.ok(seen.prompt.includes('+x'));
  assert.ok(seen.prompt.includes('git show sha:<path>'));
});

const savedVerdict = JSON.stringify({ model: 'gpt-6.2-astra', verdict: 'FAIL', review: failingReview });
const fixResult = { summary: 'fixed', fixed: [{ title: 'Bug', file: 'a.js', change: 'guard' }], skipped: [] };

function fixDeps(overrides = {}) {
  return baseDeps({
    readFile: () => savedVerdict,
    resolveRepoRoot: () => '/repo-root',
    runCodexFix: () => fixResult,
    ...overrides,
  });
}

test('parseArgs accepts --fix-findings and refuses to combine it with a scope flag', () => {
  const options = cli.parseArgs(['--fix-findings', '/tmp/v.json'], {});

  assert.strictEqual(options.fixFindings, '/tmp/v.json');
  assert.throws(() => cli.parseArgs(['--fix-findings', '/tmp/v.json', '--base', 'main'], {}), /--fix-findings/);
});

test('runCli fix mode --dry-run prints the fix prompt and never calls Codex', () => {
  let called = false;
  const deps = fixDeps({ runCodexFix: () => { called = true; return fixResult; } });

  const code = cli.runCli(cli.parseArgs(['--fix-findings', '/tmp/v.json', '--dry-run'], {}), deps);

  assert.strictEqual(code, cli.EXIT_PASS);
  assert.strictEqual(called, false);
  assert.ok(deps.stdout.text().includes('[HIGH] a.js:1 — Bug'));
});

test('runCli fix mode refuses to call Codex without consent', () => {
  let called = false;
  const deps = fixDeps({ runCodexFix: () => { called = true; return fixResult; } });

  const code = cli.runCli(cli.parseArgs(['--fix-findings', '/tmp/v.json'], {}), deps);

  assert.strictEqual(code, cli.EXIT_ERROR);
  assert.strictEqual(called, false);
});

test('runCli fix mode sends the findings to Astra at the repo root and prints the fix report', () => {
  let seen = null;
  let readPath = null;
  const deps = fixDeps({
    readFile: (file) => { readPath = file; return savedVerdict; },
    runCodexFix: (input) => { seen = input; return fixResult; },
  });

  const code = cli.runCli(cli.parseArgs(['--fix-findings', '/tmp/v.json', '--consent-to-openai', '--instructions', 'keep API'], {}), deps);

  assert.strictEqual(code, cli.EXIT_PASS);
  assert.strictEqual(readPath, '/tmp/v.json');
  assert.strictEqual(seen.cwd, '/repo-root');
  assert.strictEqual(seen.model, 'gpt-6.2-astra');
  assert.ok(seen.prompt.includes('keep API'));
  assert.ok(deps.stdout.text().includes('# Astra Fix (gpt-6.2-astra)'));
});

test('runCli fix mode --json prints the fix payload', () => {
  const deps = fixDeps();

  cli.runCli(cli.parseArgs(['--fix-findings', '/tmp/v.json', '--consent-to-openai', '--json'], {}), deps);

  const payload = JSON.parse(deps.stdout.text());
  assert.strictEqual(payload.mode, 'fix');
  assert.strictEqual(payload.fix.fixed.length, 1);
});

function fakeReportIo({ renameFails = false, writeFails = false } = {}) {
  const events = [];
  return {
    events,
    openSync: (file, flags, mode) => { events.push(['open', file, flags, mode]); return 7; },
    writeFileSync: (fd, content) => {
      events.push(['write', fd, content]);
      if (writeFails) throw Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' });
    },
    writeSync: () => { throw new Error('writeSync can return short; use writeFileSync on the descriptor'); },
    closeSync: (fd) => { events.push(['close', fd]); },
    renameSync: (from, to) => {
      events.push(['rename', from, to]);
      if (renameFails) throw new Error('EXDEV');
    },
    unlinkSync: (file) => { events.push(['unlink', file]); },
  };
}

const OUT_DIR = path.resolve('/out');
const REPORT = path.join(OUT_DIR, 'report.json');

test('writeReport creates a private temp file exclusively and renames it over the destination', () => {
  const io = fakeReportIo();

  cli.writeReport(REPORT, '{}', io);

  const open = io.events.find((event) => event[0] === 'open');
  assert.ok(open[1].startsWith(path.join(OUT_DIR, '.report.json.')) && open[1].endsWith('.tmp'), `temp file in same dir: ${open[1]}`);
  assert.strictEqual(open[2], 'wx');
  assert.strictEqual(open[3], 0o600);
  const rename = io.events.find((event) => event[0] === 'rename');
  assert.strictEqual(rename[1], open[1]);
  assert.strictEqual(rename[2], REPORT);
  assert.ok(io.events.findIndex((event) => event[0] === 'close') < io.events.indexOf(rename), 'closed before rename');
});

test('writeReport removes the temp file when the rename fails', () => {
  const io = fakeReportIo({ renameFails: true });

  assert.throws(() => cli.writeReport(REPORT, '{}', io), /EXDEV/);
  assert.ok(io.events.some((event) => event[0] === 'unlink' && event[1].endsWith('.tmp')));
});

test('writeReport writes the whole content via the descriptor and cleans up when the write fails', () => {
  const ok = fakeReportIo();
  cli.writeReport(REPORT, '{"full":true}', ok);
  assert.deepStrictEqual(ok.events.find((event) => event[0] === 'write').slice(1), [7, '{"full":true}']);

  const io = fakeReportIo({ writeFails: true });
  assert.throws(() => cli.writeReport(REPORT, '{}', io), /ENOSPC/);
  assert.ok(io.events.some((event) => event[0] === 'close'), 'descriptor closed after failure');
  assert.ok(io.events.some((event) => event[0] === 'unlink' && event[1].endsWith('.tmp')), 'temp file removed');
  assert.ok(!io.events.some((event) => event[0] === 'rename'), 'nothing published');
});

test('writeReport replaces a symlink and a world-readable file with a private regular file (real fs)', () => {
  const posix = process.platform !== 'win32';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-report-'));
  try {
    const victim = path.join(dir, 'victim.txt');
    fs.writeFileSync(victim, 'keep me');
    const linked = path.join(dir, 'linked.json');
    let canSymlink = true;
    try {
      fs.symlinkSync(victim, linked);
    } catch {
      canSymlink = false; // Windows without symlink privilege: replacement is still checked below
    }
    const shared = path.join(dir, 'shared.json');
    fs.writeFileSync(shared, 'old', { mode: 0o644 });

    if (canSymlink) cli.writeReport(linked, '{"a":1}');
    cli.writeReport(shared, '{"b":2}');

    if (canSymlink) {
      assert.strictEqual(fs.readFileSync(victim, 'utf8'), 'keep me', 'symlink target untouched');
      const fd = fs.openSync(linked, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      try {
        assert.strictEqual(fs.fstatSync(fd).isFile(), true, 'published report is regular');
        assert.strictEqual(fs.readFileSync(fd, 'utf8'), '{"a":1}');
      } finally { fs.closeSync(fd); }
    }
    assert.strictEqual(fs.readFileSync(shared, 'utf8'), '{"b":2}');
    if (posix) assert.strictEqual((fs.statSync(shared).mode & 0o777), 0o600, 'existing 0644 file becomes 0600');
    assert.deepStrictEqual(fs.readdirSync(dir).filter((name) => name.endsWith('.tmp')), [], 'no temp files left');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CLI exits 2 with usage on a bad argument', () => {
  const result = spawnSync('node', [SCRIPT, '--nope'], { encoding: 'utf8' });

  assert.strictEqual(result.status, 2);
  assert.ok(result.stderr.includes('unknown argument'));
  assert.ok(result.stderr.includes('Usage'));
});

test('CLI --help exits 0 and prints usage', () => {
  const result = spawnSync('node', [SCRIPT, '--help'], { encoding: 'utf8' });

  assert.strictEqual(result.status, 0);
  assert.ok(result.stdout.includes('--consent-to-openai'));
  assert.ok(result.stdout.includes('--reasoning-effort'));
});

function findGit(searchPath) {
  const gitName = process.platform === 'win32' ? 'git.exe' : 'git';
  for (const directory of searchPath.split(path.delimiter)) {
    if (!path.isAbsolute(directory)) continue;
    const file = path.join(directory, gitName);
    try {
      fs.accessSync(file, fs.constants.X_OK);
      if (fs.statSync(file).isFile()) return file;
    } catch { /* check the next PATH entry */ }
  }
  throw new Error('Git executable not found in an absolute PATH entry');
}

test('CLI sends the default and explicit review effort to an isolated Codex fixture', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-cli-'));
  try {
    const windows = process.platform === 'win32';
    const bin = path.join(dir, 'bin');
    const foreignBin = path.join(dir, 'foreign-bin');
    const foreignCodex = path.join(foreignBin, 'codex.exe');
    fs.mkdirSync(foreignBin);
    fs.writeFileSync(foreignCodex, 'A foreign executable must never reach spawn');

    // With the foreign directory later on PATH, Windows would prefer its
    // native executable to the fixture's earlier npm shim. Probe only resolution.
    const windowsBin = path.win32.normalize(bin);
    const windowsEntry = path.win32.join(windowsBin, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    const windowsFiles = new Set([path.win32.join(windowsBin, 'codex.cmd'), windowsEntry, path.win32.normalize(foreignCodex)]);
    const resolveWindowsCodex = (searchPath) => resolveCodexCommand({
      platform: 'win32', env: { PATH: searchPath }, existsSync: (file) => windowsFiles.has(file),
    });
    const foreign = resolveWindowsCodex([windowsBin, path.win32.normalize(foreignBin)].join(';'));
    assert.strictEqual(foreign.command, path.win32.normalize(foreignCodex));
    assert.deepStrictEqual(resolveWindowsCodex(windowsBin), { command: process.execPath, prefixArgs: [windowsEntry] });

    const git = findGit(process.env.PATH || process.env.Path || process.env.path || '');
    const env = {
      PATH: bin,
      CODEX_HOME: path.join(dir, 'codex-home'),
      SystemRoot: process.env.SystemRoot,
      TMPDIR: process.env.TMPDIR,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: path.join(dir, 'gitconfig'),
    };
    // Some systems install Git as a shell wrapper. Only Git gets a path for
    // its own directory and the basic system tools, never the Codex fixture.
    const gitPath = windows ? path.dirname(git) : [path.dirname(git), '/usr/bin', '/bin'].join(path.delimiter);
    const gitEnv = { ...env, PATH: gitPath };
    const init = spawnSync(git, ['init', '--quiet'], { cwd: dir, env: gitEnv, encoding: 'utf8' });
    assert.strictEqual(init.status, 0, init.stderr);
    fs.writeFileSync(path.join(dir, 'sample.js'), 'module.exports = 42;\n');

    const entry = windows
      ? path.join(bin, 'node_modules', '@openai', 'codex', 'bin', 'codex.js')
      : path.join(bin, 'codex');
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    if (windows) fs.writeFileSync(path.join(bin, 'codex.cmd'), '');
    const stubReview = {
      ...passingReview,
      checks: RUBRIC.map(([criterion]) => ({ criterion, result: 'PASS', detail: 'ok' })),
    };
    fs.writeFileSync(entry, `const fs = require('fs');
const args = process.argv.slice(2);
if (args[0] === 'mcp') {
  process.stdout.write('[]');
} else {
  const verdict = { ...${JSON.stringify(stubReview)}, summary: JSON.stringify({ args, path: process.env.PATH }) };
  fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], JSON.stringify(verdict));
}
`);

    // Preserve actual CLI parsing and Git calls. Bind Git and the stub to
    // absolute executables and refuse all other subprocesses before spawning.
    const preload = path.join(dir, 'preload.cjs');
    fs.writeFileSync(preload, `
const cp = require('node:child_process');
const spawn = cp.spawnSync;
cp.spawnSync = (command, args, options) => {
  if (command === 'git') return spawn(${JSON.stringify(git)}, args, { ...options, env: ${JSON.stringify(gitEnv)} });
  const entry = ${JSON.stringify(entry)};
  if (options.env?.PATH === ${JSON.stringify(bin)}) {
    if (process.platform === 'win32' && command === process.execPath && args[0] === entry) {
      return spawn(process.execPath, args, options);
    }
    if (process.platform !== 'win32' && command === 'codex') {
      return spawn(process.execPath, [entry, ...args], options);
    }
  }
  throw new Error('Unexpected subprocess in Astra CLI fixture');
};
`);
    const cases = [
      { flags: [], model: 'gpt-6.2-astra', effort: 'high' },
      { flags: ['--reasoning-effort', 'low'], model: 'gpt-6.2-astra', effort: 'low' },
      { flags: ['--model', 'gpt-6.2-sol'], model: 'gpt-6.2-sol' },
      { flags: [], model: 'gpt-6.2-sol', envModel: 'gpt-6.2-sol' },
    ];
    for (const { flags, model, effort, envModel = '' } of cases) {
      const result = spawnSync(process.execPath, [
        '--require', preload, SCRIPT, '--files', 'sample.js', '--consent-to-openai', '--json', ...flags,
      ], { cwd: dir, encoding: 'utf8', env: { ...env, ECC_ASTRA_MODEL: envModel }, timeout: 10_000 });
      assert.strictEqual(result.status, 0, result.stderr || result.error?.message);
      const { review } = JSON.parse(result.stdout);
      const { args, path: observedPath } = JSON.parse(review.summary);
      assert.strictEqual(observedPath, bin);
      assert.strictEqual(args[args.indexOf('-m') + 1], model);
      assert.strictEqual(args[args.indexOf('--sandbox') + 1], 'read-only');
      assert.ok(args.includes('--ignore-user-config'));
      const effortArgs = args.filter((arg) => arg.startsWith('model_reasoning_effort='));
      assert.deepStrictEqual(effortArgs, effort ? [`model_reasoning_effort="${effort}"`] : []);
      if (effort) assert.strictEqual(args[args.indexOf(effortArgs[0]) - 1], '--config');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
