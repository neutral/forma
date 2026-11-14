// project.md §explore: the computation in its worker, on a real project: the fingerprint first, the
// graph and both readings only for a generation that is not kept, every failure said.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fingerprint } from '@forma/cli/graph';
import { Sheet, Snapshot, Status } from '../../src/domain/reading.ts';
import { compute } from '../../src/server/compute.ts';
import { exportReading } from '../../src/server/export.ts';
import { serve } from '../../src/server/serve.ts';
import { MARKER, builtPage, contents, get, project, scratch, until } from './fixtures.ts';


/** A project, with an empty toolchain so that no engine is found and the fingerprint stays small. */
async function setting(t: TestContext) {
  const folder = await scratch(t);
  const tools = join(folder, 'toolchain');
  await mkdir(tools);
  const previous = process.env.FORMA_TOOLCHAIN;
  process.env.FORMA_TOOLCHAIN = tools;
  t.after(() => {
    if (previous === undefined) delete process.env.FORMA_TOOLCHAIN;
    else process.env.FORMA_TOOLCHAIN = previous;
  });
  return { folder, root: await project(join(folder, 'project')) };
}

test('project.md §explore: a computation gives both readings of the generation its fingerprint names, and only the fingerprint for a kept one', async (t) => {
  const { root } = await setting(t);
  const before = await contents(root);
  let computing = 0;
  const found = await compute(root, [], { onComputing: () => (computing += 1) });
  assert.equal(found.kind, 'computed');
  assert.equal(computing, 1);
  if (found.kind !== 'computed') return;
  const snapshot = Snapshot.parse(found.snapshot);
  assert.equal(snapshot.generation, (await fingerprint(root)).hash);
  for (const standing of ['recorded', 'here'] as const) {
    assert.equal(snapshot.readings[standing].sheet.standing, standing);
    assert.equal(snapshot.readings[standing].sheet.generation, snapshot.generation);
    assert.ok(JSON.stringify(snapshot.readings[standing].sheet).includes(MARKER), 'the sheet holds the brief as written');
  }
  const kept = await compute(root, ['another', snapshot.generation], { onComputing: () => (computing += 1) });
  assert.deepEqual(kept, { kind: 'kept', generation: snapshot.generation });
  assert.equal(computing, 1, 'a kept generation is not computed');
  assert.deepEqual(await contents(root), before, 'computing writes nothing in the project');
});

test('project.md §explore: a computation that fails says why, and an aborted one stops its worker', async (t) => {
  const { root } = await setting(t);
  await writeFile(join(root, 'models'), 'This path is not a folder.\n');
  await assert.rejects(compute(root, [], {}), (error: Error) => error.message.length > 0);
  await rm(join(root, 'models'));
  const stopping = new AbortController();
  const running = compute(root, [], { signal: stopping.signal });
  stopping.abort(new Error('stopped'));
  await assert.rejects(running, /stopped/);
  await assert.rejects(compute(root, [], { signal: stopping.signal }), /stopped/);
});

test('project.md §explore: serving a real project reads its sheets, and a changed input gives a later generation', async (t) => {
  const { folder, root } = await setting(t);
  const app = await serve({ project: root, page: await builtPage(join(folder, 'page')), cacheRoot: join(folder, 'cache'), everyMs: 100 });
  t.after(() => app.close());
  await app.ready;
  const status = Status.parse((await get(app, '/api/status')).json);
  assert.equal(status.error, null);
  assert.equal(status.generation, (await fingerprint(root)).hash);
  const sheet = Sheet.parse((await get(app, '/api/sheet?standing=here')).json);
  assert.equal(sheet.generation, status.generation);
  await writeFile(join(root, 'design/brief/later.md'), '# Later\n\nA clause added while the explorer runs.\n');
  await until(async () => Status.parse((await get(app, '/api/status')).json).generation !== status.generation, 'a changed input gives a later generation', 30000);
  assert.ok((await get(app, '/api/sheet?standing=recorded')).text.includes('A clause added while the explorer runs'));
});

test('project.md §explore: exporting a real project', async (t) => {
  const { folder, root } = await setting(t);
  const path = await exportReading({ project: root, destination: join(folder, 'export'), page: await builtPage(join(folder, 'page')) });
  const html = await readFile(path, 'utf8');
  const json = /<script id="forma-snapshot" type="application\/json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
  const snapshot = Snapshot.parse(JSON.parse(json));
  assert.equal(snapshot.generation, (await fingerprint(root)).hash);
  assert.ok(!html.includes(root) && !html.includes(folder), 'no machine path is in it');
});
