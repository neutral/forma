// project.md §explore, "Export": one self-contained index.html outside the project, and its refusals.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, readdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { Snapshot } from '../../src/domain/reading.ts';
import type { Compute } from '../../src/server/compute.ts';
import { exportReading } from '../../src/server/export.ts';
import {
  MARKER,
  STUB_SCRIPT,
  STUB_STYLE,
  builtPage,
  clockAheadRecord,
  contents,
  project,
  scratch,
  steered,
  writeFiles,
} from './fixtures.ts';

const UNTRUSTED = '</script><script id="untrusted">bad()</script> <!--    end';

async function setting(t: TestContext, marker = `${MARKER} ${UNTRUSTED}`) {
  const folder = await scratch(t);
  const steer = steered('generation-1', marker);
  return {
    folder,
    root: await project(join(folder, 'project')),
    page: await builtPage(join(folder, 'page')),
    steer,
    exporting: (destination: string, compute: Compute = steer.compute) =>
      exportReading({ project: join(folder, 'project'), destination, page: join(folder, 'page'), compute }),
  };
}

const between = (html: string, open: RegExp, close: string) => {
  const start = open.exec(html);
  assert.ok(start, `${open} is in the export`);
  const from = start.index + start[0].length;
  return html.slice(from, html.indexOf(close, from));
};

test('project.md §explore: export holds both readings with their stamp, the page\'s script and style, and nothing it would load', async (t) => {
  const at = await setting(t);
  const before = await contents(at.root);
  for (const name of ['new', 'existing-empty', 'new/nested']) {
    const destination = join(at.folder, 'out', name);
    if (name === 'existing-empty') await mkdir(destination, { recursive: true });
    const path = await at.exporting(destination);
    assert.equal(path, join(destination, 'index.html'));
    assert.deepEqual((await readdir(destination)).filter((entry) => entry !== 'nested'), ['index.html']);
    const html = await readFile(path, 'utf8');

    assert.ok(html.includes('<div id="root"></div>'), 'it is the built page');
    assert.ok(!/<script\b[^>]*\bsrc=|<link\b[^>]*\bhref=|<img\b/i.test(html), 'it loads nothing from elsewhere');
    assert.equal(between(html, /<style>/, '</style>'), STUB_STYLE);
    const script = between(html, /<script type="module">/, '</script>');
    assert.ok(!/<\/script|<!--/i.test(script), 'the script ends only at its own closing tag');
    const meaning = (code: string) => runInNewContext(`${code}; JSON.stringify(said)`) as string;
    assert.equal(meaning(script), meaning(STUB_SCRIPT), 'the script means what it meant');
    const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html)?.[1] ?? '';
    assert.match(policy, /default-src 'none'/);
    assert.ok(policy.includes(`script-src 'sha256-${createHash('sha256').update(script).digest('base64')}'`), 'only the page\'s own script may run');

    assert.ok(!html.includes('<script id="untrusted">'), 'source text is held, never run');
    assert.ok(!html.includes(' ') && !html.includes(' '));
    assert.ok(!html.includes(at.root) && !html.includes(at.folder), 'no machine path is in it');
    assert.ok(!/token=[A-Za-z0-9_-]{16,}/.test(html), 'no credential is in it');
    const snapshot = Snapshot.parse(JSON.parse(between(html, /<script id="forma-snapshot" type="application\/json">/, '</script>')));
    assert.equal(snapshot.generation, 'generation-1');
    assert.match(snapshot.computedAt, /^\d{4}-\d\d-\d\dT/);
    assert.deepEqual(Object.keys(snapshot.readings).sort(), ['here', 'recorded']);
    for (const standing of ['recorded', 'here'] as const) {
      assert.equal(snapshot.readings[standing].sheet.standing, standing);
      assert.ok(snapshot.readings[standing].sheet.documents[0]?.sections[0]?.html.includes(`${MARKER} ${UNTRUSTED}`), 'source text survives as written');
    }
    assert.ok(snapshot.inputs.length > 0 && snapshot.inputs.every((input) => !input.path.startsWith('/') && /^[0-9a-f]{64}$/.test(input.sha256)));
    assert.deepEqual(snapshot.versions, { forma: { version: '0.1.0' }, graph: 1 });
  }
  assert.deepEqual(await contents(at.root), before, 'export writes nothing in the project');
});

test('project.md §explore: export refuses the project and every alias into it, before computing', async (t) => {
  const at = await setting(t);
  const alias = join(at.folder, 'alias');
  await symlink(at.root, alias, 'dir');
  const destinations = [at.root, join(at.root, 'export'), join(at.root, '..export'), join(alias, 'nested', 'export'), alias];
  if (process.platform !== 'win32') destinations.push(join(at.root, '..\\export'));
  for (const destination of destinations) {
    const before = await contents(at.root);
    await assert.rejects(at.exporting(destination), /outside the project/, destination);
    assert.deepEqual(await contents(at.root), before);
  }
  assert.equal(at.steer.runs.fingerprinted, 0, 'nothing is computed for a refused destination');
});

test('project.md §explore: export never overwrites, follows an alias outside the project, and refuses what it cannot write', async (t) => {
  const at = await setting(t);
  const nonempty = await writeFiles(join(at.folder, 'nonempty'), { 'index.html': 'Keep this page.\n' });
  const file = join(at.folder, 'file');
  await writeFile(file, 'Keep this file.\n');
  for (const destination of [nonempty, file, join(file, 'below')])
    await assert.rejects(at.exporting(destination), /new or empty|no file is overwritten|Cannot write|ENOTDIR/, destination);
  assert.equal(await readFile(join(nonempty, 'index.html'), 'utf8'), 'Keep this page.\n');
  assert.equal(await readFile(file, 'utf8'), 'Keep this file.\n');

  const actual = join(at.folder, 'actual');
  const alias = join(at.folder, 'outside-alias');
  await mkdir(actual);
  await symlink(actual, alias, 'dir');
  assert.equal(await at.exporting(alias), join(actual, 'index.html'));
  assert.deepEqual(await readdir(actual), ['index.html']);

  const broken = join(at.folder, 'broken-alias');
  await symlink(join(at.root, 'missing'), broken, 'dir');
  await assert.rejects(at.exporting(broken), /symbolic link to a path that does not exist/);
  assert.deepEqual(Object.keys(await contents(at.root)), ['design/brief/ticket.md'], 'nothing is written through the broken link');

  if (process.platform !== 'win32' && process.getuid?.() !== 0) {
    const locked = join(at.folder, 'locked');
    await mkdir(locked);
    await chmod(locked, 0o500);
    try {
      const runs = at.steer.runs.fingerprinted;
      await assert.rejects(at.exporting(join(locked, 'export')), /Cannot write the export/);
      assert.equal(at.steer.runs.fingerprinted, runs, 'an unwritable folder is refused before computing');
    } finally {
      await chmod(locked, 0o700);
    }
  }
});

test('project.md §explore: the clock rule is checked before and after computing, and nothing is created', async (t) => {
  const at = await setting(t);
  await writeFiles(at.root, clockAheadRecord());
  const destination = join(at.folder, 'export');
  await assert.rejects(at.exporting(destination), /clock rule.*2099/);
  assert.deepEqual(await contents(destination), {});
  assert.equal(at.steer.runs.fingerprinted, 0);

  const later = await setting(t);
  const aheadWhileComputing: Compute = async (project, kept, options) => {
    const found = await later.steer.compute(project, kept, options);
    await writeFiles(project, clockAheadRecord());
    return found;
  };
  const after = join(later.folder, 'export');
  await assert.rejects(later.exporting(after, aheadWhileComputing), /clock rule.*2099/);
  assert.deepEqual(await contents(after), {});
});

test('project.md §explore: export refuses a missing build of the page, a failed computation and a machine path in the reading', async (t) => {
  const at = await setting(t);
  await assert.rejects(
    exportReading({ project: at.root, destination: join(at.folder, 'a'), page: join(at.folder, 'not-built'), compute: at.steer.compute }),
    /not built.*build it with pnpm build/,
  );
  at.steer.state.failure = 'The project changed during three reads.';
  await assert.rejects(at.exporting(join(at.folder, 'b')), /three reads/);
  const leaking = await setting(t);
  leaking.steer.state.marker = `written under ${leaking.root}`;
  await assert.rejects(leaking.exporting(join(leaking.folder, 'c')), /machine path/);
  for (const name of ['a', 'b']) assert.deepEqual(await contents(join(at.folder, name)), {});
  assert.deepEqual(await contents(join(leaking.folder, 'c')), {});
});
