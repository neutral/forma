// project.md §explore, "Serving": the loopback door, its token, its three reads and the reading it holds.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { Sheet, Status, Thing } from '../../src/domain/reading.ts';
import { GENERATION } from '../../src/server/http.ts';
import { serve, type ServeOptions } from '../../src/server/serve.ts';
import {
  MARKER,
  STUB_SCRIPT,
  STUB_STYLE,
  builtPage,
  contents,
  gate,
  get,
  project,
  scratch,
  steered,
  thingId,
  until,
} from './fixtures.ts';

async function setting(t: TestContext) {
  const folder = await scratch(t);
  return {
    folder,
    root: await project(join(folder, 'project')),
    page: await builtPage(join(folder, 'page')),
    cacheRoot: join(folder, 'cache'),
  };
}

async function serving(t: TestContext, options: Omit<ServeOptions, 'project'> & { project?: string } = {}) {
  const at = await setting(t);
  const steer = steered();
  const app = await serve({ project: at.root, page: at.page, cacheRoot: at.cacheRoot, compute: steer.compute, everyMs: 3_600_000, ...options });
  t.after(() => app.close());
  return { ...at, app, steer };
}

const statusOf = async (app: { origin: string; token: string }) => Status.parse((await get(app, '/api/status')).json);

test('project.md §explore: serving binds loopback and gives a fresh fragment token as soon as it listens, before the first reading', async (t) => {
  const at = await setting(t);
  const steer = steered();
  const first = gate();
  steer.state.waiting = first.opened;
  const launches: string[] = [];
  const app = await serve({ project: at.root, page: at.page, cacheRoot: at.cacheRoot, compute: steer.compute, everyMs: 3_600_000, onListen: (url) => launches.push(url) });
  t.after(() => app.close());
  assert.deepEqual(launches, [app.url]);
  const url = new URL(app.url);
  assert.equal(url.hostname, '127.0.0.1');
  assert.ok(Number(url.port) > 0);
  assert.equal(url.search, '');
  assert.match(url.hash, /^#token=[A-Za-z0-9_-]{43}$/);
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('token'), app.token);
  assert.equal(url.origin, app.origin);

  const opening = await get(app, '/api/sheet?standing=recorded');
  assert.equal(opening.status, 202, 'a read before the first reading says one is pending');
  assert.deepEqual(opening.json, { pending: true });
  assert.equal((await get(app, '/api/thing?standing=here&id=x&generation=g')).status, 202);
  const computing = await until(async () => {
    const status = await statusOf(app);
    return status.refreshing && status;
  }, 'the first computation is under way');
  assert.deepEqual(computing, { generation: null, computedAt: null, refreshing: true, error: null });
  assert.equal((await get(app, '/api/sheet?standing=here')).status, 202);
  first.open();
  await app.ready;
  const status = await statusOf(app);
  assert.equal(status.generation, 'generation-1');
  assert.equal(status.refreshing, false);
  assert.equal(status.error, null);

  const second = await serve({ project: at.root, page: at.page, cacheRoot: at.cacheRoot, compute: steered().compute, everyMs: 3_600_000 });
  t.after(() => second.close());
  assert.notEqual(second.token, app.token);
});

test('project.md §explore: the page and its files hold no project data and are served as built, under a strict policy', async (t) => {
  const { app } = await serving(t);
  await app.ready;
  for (const path of ['/', '/index.html']) {
    const page = await get(app, path, { auth: false });
    assert.equal(page.status, 200);
    assert.match(String(page.headers['content-type']), /^text\/html/);
    assert.ok(page.text.includes('<div id="root"></div>'));
    assert.ok(!page.text.includes(MARKER) && !page.text.includes(app.token));
    const policy = String(page.headers['content-security-policy']);
    assert.match(policy, /frame-ancestors 'none'/);
    assert.match(policy, /default-src 'none'/);
    assert.match(policy, /script-src 'self'(;|$)/, 'no inline or evaluated script');
    assert.match(policy, /style-src 'self' 'unsafe-inline'/);
    assert.match(policy, /connect-src 'self'/);
    assert.equal(page.headers['referrer-policy'], 'no-referrer');
    assert.equal(page.headers['x-content-type-options'], 'nosniff');
    assert.equal(page.headers['cross-origin-resource-policy'], 'same-origin');
  }
  const script = await get(app, '/explorer.js', { auth: false });
  assert.equal(script.status, 200);
  assert.match(String(script.headers['content-type']), /^text\/javascript/);
  assert.equal(script.text, STUB_SCRIPT);
  const style = await get(app, '/explorer.css', { auth: false });
  assert.match(String(style.headers['content-type']), /^text\/css/);
  assert.equal(style.text, STUB_STYLE);
});

test('project.md §explore: reads need the launch token and the serving origin and host; only GET', async (t) => {
  const { app } = await serving(t);
  await app.ready;
  const credentials: Record<string, string>[] = [{}, { Authorization: 'Bearer incorrect' }, { Authorization: app.token }, { Authorization: `Basic ${app.token}` }];
  for (const path of ['/api/status', '/api/sheet?standing=recorded', `/api/thing?standing=here&id=${encodeURIComponent(thingId(MARKER))}&generation=g`, '/api/graph']) {
    for (const headers of credentials) {
      const refused = await get(app, path, { auth: false, headers });
      assert.equal(refused.status, 401, `${path} ${JSON.stringify(headers)}`);
      assert.ok(!refused.text.includes(MARKER));
    }
  }
  assert.equal((await get(app, '/api/status', { headers: { Origin: app.origin } })).status, 200);
  const elsewhere: Record<string, string>[] = [
    { Origin: 'https://elsewhere.invalid' },
    { Origin: 'null' },
    { Origin: app.origin.replace('127.0.0.1', 'localhost') },
    { Host: 'elsewhere.invalid' },
    { Host: `localhost:${new URL(app.origin).port}` },
    { 'Sec-Fetch-Site': 'cross-site' },
  ];
  for (const headers of elsewhere) {
    for (const path of ['/api/status', '/api/sheet?standing=here', '/']) {
      const response = await get(app, path, { headers });
      assert.equal(response.status, 403, `${path} ${JSON.stringify(headers)}`);
      assert.ok(!response.text.includes(MARKER));
    }
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
    const response = await get(app, '/api/status', { method });
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.allow, 'GET');
  }
  for (const path of ['/design/brief/ticket.md', '/unknown.js', '/api/status/', '/dist/client/explorer.js', '/../package.json'])
    assert.equal((await get(app, path, { auth: false })).status, path.startsWith('/api/') ? 401 : 404, path);
});

test('project.md §explore: the three reads, each with the generation it is from', async (t) => {
  const { app, root } = await serving(t);
  const before = await contents(root);
  await app.ready;
  const status = await get(app, '/api/status');
  assert.equal(status.status, 200);
  assert.deepEqual(Object.keys(status.json as object).sort(), ['computedAt', 'error', 'generation', 'refreshing']);
  const { generation } = Status.parse(status.json);
  assert.equal(generation, 'generation-1');
  for (const standing of ['recorded', 'here'] as const) {
    const sheet = await get(app, `/api/sheet?standing=${standing}`);
    assert.equal(sheet.status, 200);
    assert.equal(sheet.headers['cache-control'], 'no-store');
    assert.equal(sheet.headers[GENERATION.toLowerCase()], generation);
    const parsed = Sheet.parse(sheet.json);
    assert.equal(parsed.standing, standing);
    assert.equal(parsed.generation, generation);
    assert.ok(sheet.text.includes(MARKER), 'the sheet holds the brief as written');
    const thing = await get(app, `/api/thing?standing=${standing}&id=${encodeURIComponent(thingId(MARKER))}&generation=${generation}`);
    assert.equal(thing.status, 200);
    assert.equal(thing.headers[GENERATION.toLowerCase()], generation);
    const opened = Thing.parse(thing.json);
    assert.equal(opened.id, thingId(MARKER));
    assert.ok(opened.kind === 'actor' && opened.names === `${MARKER} as ${standing}`, 'each standing has its own things');
  }
  for (const path of ['/api/sheet', '/api/sheet?standing=neither', '/api/thing?id=x', '/api/thing?standing=here', '/api/thing?standing=here&id=', '/api/thing?standing=here&id=x'])
    assert.equal((await get(app, path)).status, 400, path);
  assert.equal((await get(app, `/api/thing?standing=here&id=no-such-thing&generation=${generation}`)).status, 404);
  assert.equal((await get(app, '/api/thing?standing=here&id=x&generation=no-longer-kept')).status, 409, 'a generation no longer kept is gone, never answered from another');
  for (const path of ['/api/graph', '/api/file?path=/etc/passwd', '/api/sql?sql=SELECT'])
    assert.equal((await get(app, path)).status, 404, `${path} is no read`);
  assert.deepEqual(await contents(root), before, 'serving writes nothing in the project');
});

test('project.md §explore: a reading is replaced only by a complete later one; a failure keeps it and is reported', async (t) => {
  const { app, steer } = await serving(t, { everyMs: 20 });
  await app.ready;
  const sheetOf = async () => Sheet.parse((await get(app, '/api/sheet?standing=recorded')).json);
  assert.equal((await sheetOf()).generation, 'generation-1');

  const later = gate();
  Object.assign(steer.state, { generation: 'generation-2', marker: 'a later clause', waiting: later.opened });
  await until(async () => (await statusOf(app)).refreshing, 'a changed fingerprint starts a computation');
  assert.equal((await sheetOf()).generation, 'generation-1', 'the reading held is served while the next is computed');
  assert.equal((await statusOf(app)).generation, 'generation-1');
  later.open();
  await until(async () => (await statusOf(app)).generation === 'generation-2', 'the complete later reading replaces it');
  const replaced = await get(app, '/api/sheet?standing=recorded');
  assert.ok(replaced.text.includes('a later clause'));
  assert.equal(replaced.headers[GENERATION.toLowerCase()], 'generation-2');

  steer.state.failure = 'models is not a folder';
  const failure = await until(async () => (await statusOf(app)).error, 'a computation that fails is reported');
  assert.equal(failure, 'models is not a folder');
  const kept = await get(app, '/api/sheet?standing=recorded');
  assert.equal(kept.status, 200);
  assert.equal(Sheet.parse(kept.json).generation, 'generation-2', 'the reading before the failure is kept');
  assert.equal((await statusOf(app)).generation, 'generation-2');

  steer.state.failure = null;
  await until(async () => (await statusOf(app)).error === null, 'a repaired input clears the failure');

  const computed = steer.runs.computed;
  steer.state.generation = 'generation-1';
  await until(async () => (await statusOf(app)).generation === 'generation-1', 'inputs back as they were serve their kept generation');
  assert.equal(steer.runs.computed, computed, 'a kept generation is not computed again');
});

test('project.md §explore: until a first reading exists, a read gives the failure; a later computation serves', async (t) => {
  const at = await setting(t);
  const steer = steered();
  steer.state.failure = 'The project changed during three reads.';
  const app = await serve({ project: at.root, page: at.page, cacheRoot: at.cacheRoot, compute: steer.compute, everyMs: 20 });
  t.after(() => app.close());
  await app.ready;
  for (const path of ['/api/sheet?standing=here', '/api/thing?standing=here&id=x&generation=g']) {
    const failed = await get(app, path);
    assert.equal(failed.status, 503);
    assert.deepEqual(failed.json, { error: 'The project changed during three reads.' });
  }
  assert.deepEqual(await statusOf(app), { generation: null, computedAt: null, refreshing: false, error: 'The project changed during three reads.' });
  steer.state.failure = null;
  await until(async () => (await get(app, '/api/sheet?standing=here')).status === 200, 'a repaired input does not stay hidden behind the first failure');
});

test('project.md §explore: an unavailable port and a missing build of the page refuse', async (t) => {
  const at = await setting(t);
  const occupied = createServer();
  await new Promise<void>((resolve) => occupied.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => occupied.close(resolve)));
  const port = (occupied.address() as AddressInfo).port;
  const steer = steered();
  await assert.rejects(
    serve({ project: at.root, page: at.page, cacheRoot: at.cacheRoot, compute: steer.compute, port }),
    /already in use; choose another port or omit --port/,
  );
  await assert.rejects(
    serve({ project: at.root, page: join(at.folder, 'not-built'), cacheRoot: at.cacheRoot, compute: steer.compute }),
    /not built.*build it with pnpm build/,
  );
  assert.deepEqual(steer.runs, { fingerprinted: 0, computed: 0 }, 'a refused start computes nothing');
});

test('project.md §explore: closing stops a computation in progress and the listener', async (t) => {
  const at = await setting(t);
  const steer = steered();
  steer.state.waiting = new Promise(() => {});
  const app = await serve({ project: at.root, page: at.page, cacheRoot: at.cacheRoot, compute: steer.compute });
  await until(async () => (await statusOf(app)).refreshing, 'the computation is under way');
  await app.close();
  await app.ready;
  await assert.rejects(get(app, '/'), /ECONNREFUSED|ECONNRESET|socket hang up/);
  await app.close();
});
