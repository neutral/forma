// project.md §explore, "The read index": where it lives, what it holds, and when it is in memory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { APPLICATION_ID, SCHEMA_VERSION, openStore } from '../../src/server/store.ts';
import { cacheBase, indexFile, openReadIndex } from '../../src/server/cache.ts';
import { serve } from '../../src/server/serve.ts';
import { Sheet, type Status } from '../../src/domain/reading.ts';
import {
  builtPage,
  clockAheadRecord,
  contents,
  get,
  project,
  scratch,
  snapshotFor,
  steered,
  thingId,
  writeFiles,
} from './fixtures.ts';

const count = (db: DatabaseSync, table: string) => Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n);

test('the read index: strict tables with foreign keys, its application and its schema version', async (t) => {
  const path = join(await scratch(t), 'reading.sqlite');
  const store = openStore(path);
  t.after(() => store.close());
  store.put(snapshotFor('g1', 'first'));
  const db = new DatabaseSync(path);
  t.after(() => db.close());
  assert.equal(db.prepare('PRAGMA application_id').get()?.application_id, APPLICATION_ID);
  assert.equal(db.prepare('PRAGMA user_version').get()?.user_version, SCHEMA_VERSION);
  const tables = db.prepare('PRAGMA table_list').all();
  for (const name of ['generations', 'readings', 'things'])
    assert.equal(tables.find((table) => table.name === name)?.strict, 1, `${name} is strict`);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_list(readings)').all().map((key) => key.table), ['generations']);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_list(things)').all().map((key) => key.table), ['readings', 'readings']);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.throws(() => db.prepare("UPDATE readings SET standing = 'old'").run(), /CHECK/);
  assert.equal(count(db, 'readings'), 2);
  assert.deepEqual(
    db.prepare('SELECT standing, id FROM things ORDER BY standing').all().map((row) => ({ ...row })),
    ['here', 'recorded'].map((standing) => ({ standing, id: thingId('first') })),
  );
});

test('the read index: a generation is stored whole and read back as written', async (t) => {
  const store = openStore(':memory:');
  t.after(() => store.close());
  const snapshot = snapshotFor('g1', 'first');
  store.put(snapshot);
  store.put(snapshot);
  assert.deepEqual(store.generations(), ['g1'], 'a kept generation is not stored twice');
  assert.equal(store.computedAt('g1'), snapshot.computedAt);
  for (const standing of ['recorded', 'here'] as const) {
    assert.deepEqual(JSON.parse(store.sheet('g1', standing) ?? 'null'), snapshot.readings[standing].sheet);
    assert.deepEqual(JSON.parse(store.thing('g1', standing, thingId('first')) ?? 'null'), snapshot.readings[standing].things[thingId('first')]);
  }
  assert.equal(store.sheet('g2', 'here'), undefined);
  assert.equal(store.thing('g1', 'here', 'no such thing'), undefined);
});

test('the read index: a generation that cannot be stored whole leaves nothing of it', async (t) => {
  const store = openStore(':memory:');
  t.after(() => store.close());
  store.put(snapshotFor('g1', 'first'));
  const broken = snapshotFor('g2', 'second');
  // A value JSON cannot hold fails the write of that thing, after the other standing's reading was stored.
  Object.assign(broken.readings.here.things[thingId('second')] ?? {}, { title: 1n });
  assert.throws(() => store.put(broken), /BigInt/);
  assert.deepEqual(store.generations(), ['g1']);
  assert.equal(store.sheet('g2', 'recorded'), undefined, 'the reading stored before the failing thing is rolled back');
});

test('the read index: the latest two generations are kept', async (t) => {
  const path = join(await scratch(t), 'reading.sqlite');
  const store = openStore(path);
  t.after(() => store.close());
  for (const generation of ['g1', 'g2', 'g3']) store.put(snapshotFor(generation, generation));
  assert.deepEqual(store.generations(), ['g3', 'g2']);
  assert.equal(store.sheet('g1', 'here'), undefined);
  const db = new DatabaseSync(path, { readOnly: true });
  t.after(() => db.close());
  assert.equal(count(db, 'readings'), 4);
  assert.equal(count(db, 'things'), 4, 'the things of a dropped generation go with it');
});

test('the read index: a file of another schema version, another application or no database is rebuilt, never read', async (t) => {
  const folder = await scratch(t);
  const kept = (path: string) => {
    const store = openStore(path);
    store.put(snapshotFor('old', 'old'));
    store.close();
  };
  const versioned = join(folder, 'version.sqlite');
  kept(versioned);
  const db = new DatabaseSync(versioned);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}; CREATE TABLE later (value TEXT) STRICT; INSERT INTO later VALUES ('later');`);
  db.close();
  const alien = join(folder, 'alien.sqlite');
  const other = new DatabaseSync(alien);
  other.exec('PRAGMA application_id = 12345; CREATE TABLE generations (id TEXT);');
  other.close();
  const garbage = join(folder, 'garbage.sqlite');
  await writeFile(garbage, 'This is no database.\n');
  for (const path of [versioned, alien, garbage]) {
    const store = openStore(path);
    assert.deepEqual(store.generations(), [], `${path} is read as empty`);
    store.put(snapshotFor('fresh', 'fresh'));
    assert.deepEqual(store.generations(), ['fresh']);
    store.close();
    const check = new DatabaseSync(path, { readOnly: true });
    assert.equal(check.prepare('PRAGMA user_version').get()?.user_version, SCHEMA_VERSION);
    assert.equal(check.prepare('PRAGMA application_id').get()?.application_id, APPLICATION_ID);
    assert.equal(check.prepare("SELECT name FROM sqlite_schema WHERE name = 'later'").get(), undefined);
    check.close();
  }
});

test('the read index: the operating system\'s cache folder, and the file named by the canonical project path', () => {
  assert.equal(cacheBase('darwin', {}, '/home/u'), '/home/u/Library/Caches');
  assert.equal(cacheBase('win32', { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' }, 'C:\\Users\\u'), 'C:\\Users\\u\\AppData\\Local');
  assert.equal(cacheBase('linux', { XDG_CACHE_HOME: '/xdg' }, '/home/u'), '/xdg');
  assert.equal(cacheBase('linux', { XDG_CACHE_HOME: 'relative' }, '/home/u'), '/home/u/.cache');
  assert.equal(cacheBase('linux', {}, '/home/u'), '/home/u/.cache');
  const sha = createHash('sha256').update('/work/ticket').digest('hex');
  assert.equal(indexFile('/work/ticket', '/cache'), `/cache/forma/explorer/${sha}/reading.sqlite`);
});

test('the read index: kept in the cache folder, and in memory while the clock rule holds, the cache cannot be written, or it would be inside the project', async (t) => {
  const folder = await scratch(t);
  const root = await project(join(folder, 'project'));
  const cache = join(folder, 'cache');
  const index = await openReadIndex(root, cache);
  t.after(() => index.close());
  assert.equal(index.file, indexFile(root, cache));
  assert.ok(existsSync(indexFile(root, cache)));

  const held = await project(join(folder, 'held'));
  await writeFiles(held, clockAheadRecord());
  const heldCache = join(folder, 'held-cache');
  const memory = await openReadIndex(held, heldCache);
  t.after(() => memory.close());
  assert.equal(memory.file, null);
  assert.ok(!existsSync(heldCache), 'nothing is written under the cache while the clock rule holds');

  const blocked = join(folder, 'blocked');
  await writeFile(blocked, 'A file where the cache folder would be.\n');
  const unwritable = await openReadIndex(root, blocked);
  t.after(() => unwritable.close());
  assert.equal(unwritable.file, null);

  if (process.platform !== 'win32' && process.getuid?.() !== 0) {
    const locked = join(folder, 'locked');
    await mkdir(locked, { mode: 0o500 });
    const denied = await openReadIndex(root, locked);
    await chmod(locked, 0o700);
    t.after(() => denied.close());
    assert.equal(denied.file, null);
  }

  const before = await contents(root);
  const within = await openReadIndex(root, join(root, '.cache'));
  t.after(() => within.close());
  assert.equal(within.file, null);
  assert.deepEqual(await contents(root), before, 'the index is never inside the project');
});

test('the read index: once the clock rule holds, a later generation is kept in memory and the file is not written', async (t) => {
  const folder = await scratch(t);
  const root = await project(join(folder, 'project'));
  const index = await openReadIndex(root, join(folder, 'cache'));
  t.after(() => index.close());
  await index.put(snapshotFor('g1', 'first'));
  await writeFiles(root, clockAheadRecord());
  await index.put(snapshotFor('g2', 'second'));
  assert.equal(index.file, null);
  assert.deepEqual(index.generations(), ['g2']);
  assert.ok(index.sheet('g2', 'here'));
  const file = new DatabaseSync(indexFile(root, join(folder, 'cache')), { readOnly: true });
  t.after(() => file.close());
  assert.deepEqual(file.prepare('SELECT id FROM generations').all().map((row) => row.id), ['g1']);
});

test('the read index: a second start on unchanged inputs serves the stored reading without computing', async (t) => {
  const folder = await scratch(t);
  const root = await project(join(folder, 'project'));
  const page = await builtPage(join(folder, 'page'));
  const cacheRoot = join(folder, 'cache');
  const first = steered('g1', 'first');
  const one = await serve({ project: root, page, cacheRoot, compute: first.compute, everyMs: 3_600_000 });
  await one.ready;
  const computedAt = ((await get(one, '/api/status')).json as Status).computedAt;
  await one.close();
  assert.deepEqual(first.runs, { fingerprinted: 1, computed: 1 });

  const second = steered('g1', 'first');
  const two = await serve({ project: root, page, cacheRoot, compute: second.compute, everyMs: 3_600_000 });
  t.after(() => two.close());
  await two.ready;
  assert.deepEqual(second.runs, { fingerprinted: 1, computed: 0 }, 'the fingerprint is checked and nothing is computed');
  const status = (await get(two, '/api/status')).json as Status;
  assert.equal(status.generation, 'g1');
  assert.equal(status.computedAt, computedAt);
  const sheet = await get(two, '/api/sheet?standing=here');
  assert.equal(sheet.status, 200);
  assert.equal(Sheet.parse(sheet.json).generation, 'g1');
});
