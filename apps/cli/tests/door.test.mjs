import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerFolder, forma, hasToolchain, project, read, repo, sha256,
  snapshot, tempFolder, tree, writeFiles,
} from './helpers/forma.mjs';

const PAST = '2024-01-01T00:00:00.000Z';
const WRITER = { provider: 'agent-provider', model: 'agent-model', session: 'writer' };
const DEVELOPER = { provider: 'owner-provider', model: 'owner-model', session: 'owner' };
const ITEM = 'passage:design/brief/overview.md#gate';
const ROOT = 'design/README.md';
const PART = 'design/parts/gate/README.md';
// door.md §copies fixes these auxiliary bytes; door.md §clock
// fixes receipt time spelling; door.md §receipts fixes hashes and session order.
const DESIGN_ATTRIBUTES = '* -text -ident -filter -working-tree-encoding\nreceipt merge=union\nbrief/** !text !ident !filter !working-tree-encoding !merge\n';
const MODEL_ATTRIBUTES = '* -text -ident -filter -working-tree-encoding\n*.json -merge\nreceipt merge=union\n';
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HASH = /^[0-9a-f]{64}$/;
const byteOrder = (values) => [...values].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
const sessionOrder = (values) => [...values].sort((a, b) => {
  for (const key of ['provider', 'model', 'session']) {
    const n = Buffer.compare(Buffer.from(a[key]), Buffer.from(b[key]));
    if (n) return n;
  }
  return 0;
});
const expectKeys = (object, keys) => {
  assert.ok(object && typeof object === 'object' && !Array.isArray(object));
  assert.deepEqual(Object.keys(object).sort(), [...keys].sort());
};
const readJSON = async (dir, path) => JSON.parse(await read(dir, path));
const fixtureFiles = async (name) => snapshot(await project(`door/${name}`));

// decisions.md §decision-file, §kinds:
// hash the hand-written decision's bytes for its name;
// intake/allow pins hash the Shown fence's contents including its final LF.
function decision({ kind, on = kind, pin, rows = [], words, shown,
  session = DEVELOPER, at = '2024-01-01T00:00:01.000Z' }) {
  shown ??= `${kind} ${on}${rows.length ? '\n' + rows.map(([key, value]) => `  ${key}: ${value}`).join('\n') : ''}`;
  const content = `${shown}\n`;
  const fields = [
    ['Kind', kind], ['On', on], ['Pin', pin ?? sha256(content)], ...rows,
    ['Provider', session.provider], ['Model', session.model], ['Session', session.session],
    ['By', 'Fixture owner'], ['At', at],
  ];
  // All fixture prose has no backticks, so decisions.md §decision-file requires three.
  const bytes = `# ${kind} ${on}\n\n| Field | Value |\n| --- | --- |\n${fields.map(([k, v]) => `| ${k} | ${v} |\n`).join('')}`
    + (words === undefined ? '' : `\n## Words\n\n\`\`\`text\n${words}\n\`\`\`\n`)
    + `\n## Shown\n\n\`\`\`text\n${content}\`\`\`\n`;
  const stamp = at.slice(0, 19).replace(/[-:]/g, '') + 'Z';
  const name = `${stamp}-${kind}-${sha256(bytes).slice(0, 12)}`;
  return { name, path: `design/decisions/${name}.md`, bytes };
}

// door.md §receipts: digest exact bytes,
// keep the prescribed key order, and emit JSONL including the final LF.
function makeReceipt(file, bytes, extra = {}) {
  return { file, sha256: sha256(bytes), at: PAST, session: WRITER, authors: [WRITER], ...extra };
}
const receiptText = (lines) => byteOrder(lines.map((line) => JSON.stringify(line))).join('\n') + '\n';
async function acceptedFiles(files, session = WRITER, at = PAST) {
  const result = { ...files };
  const receipts = new Map();
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.startsWith('design/') || path.startsWith('design/brief/') || path.includes('/decisions/')
      || path.endsWith('/receipt') || path.endsWith('/.gitattributes')) continue;
    const slash = path.lastIndexOf('/');
    const receipt = `${path.slice(0, slash)}/receipt`;
    const lines = receipts.get(receipt) ?? [];
    lines.push(makeReceipt(path.slice(slash + 1), bytes, { at, session, authors: [session] }));
    receipts.set(receipt, lines);
  }
  for (const [path, lines] of receipts) result[path] = receiptText(lines);
  return result;
}
async function seeded(files = {}, { answers = 30, runs = 30 } = {}) {
  // decisions.md §intake fixes this valid intake, allowance and settings.
  const intake = decision({ kind: 'intake', at: '2023-12-31T23:59:59.000Z', words: 'Only the gate is in scope.', rows: [
    ['Situation', 'design new'], ['Answers', answers], ['Runs', runs],
    ['TLC seconds', 10], ['TLC megabytes', 256], ['Alloy seconds', 10],
    ['Alloy megabytes', 256], ['Lifecycle seconds', 10], ['Cadence', 'span'], ['Inbox cap', 7],
  ] });
  return project(null, {
    ...await fixtureFiles('brief'), 'design/.gitattributes': DESIGN_ATTRIBUTES,
    'work/.gitignore': '*\n', [intake.path]: intake.bytes, ...files,
  });
}
async function restated(options = {}) {
  return seeded(await acceptedFiles(await fixtureFiles('restate')), options);
}
function missing(dir) {
  // project.md §commands and account.md §commands:
  // success is status 0 and missing JSON has exactly here and items.
  const result = forma(dir, ['missing', '--json']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  expectKeys(result.json, ['here', 'items']);
  assert.ok(Array.isArray(result.json.items));
  return result.json;
}
function reasons(value) {
  // door.md §forma-answer fixes each reason's keys and their meanings.
  assert.ok(Array.isArray(value) && value.length > 0);
  for (const reason of value) {
    expectKeys(reason, ['check', 'file', 'entry', 'field', 'says']);
    assert.match(reason.check, /^[A-Za-z-]+\.md §[a-z][a-z0-9-]*(?:\b|$)/);
    for (const field of ['file', 'entry', 'field']) {
      assert.ok(reason[field] === null || typeof reason[field] === 'string');
    }
    assert.equal(typeof reason.says, 'string');
    assert.ok(reason.says.trim().length > 0);
  }
}
function expectEarlyRefusal(result) {
  // project.md §commands; door.md §forma-give,
  // door.md §forma-answer; decisions.md §forma-decide: refusal envelopes.
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.ok(result.json, result.stderr || result.stdout);
  expectKeys(result.json, ['refused']);
  reasons(result.json.refused);
  return result.json;
}
function answerResult(result, item) {
  // door.md §forma-answer fixes this envelope and path order;
  // door.md §receipts fixes a SHA-256's 64 lowercase hexadecimal digits.
  assert.ok(result.json, result.stderr || result.stdout);
  expectKeys(result.json, ['item', 'kind', 'accepted', 'written', 'removed', 'reasons', 'answers']);
  assert.equal(result.json.item, item);
  expectKeys(result.json.answers, ['spent', 'allowed']);
  assert.deepEqual(result.json.written.map((f) => f.path), byteOrder(result.json.written.map((f) => f.path)));
  assert.deepEqual(result.json.removed, byteOrder(result.json.removed));
  for (const file of result.json.written) {
    expectKeys(file, ['path', 'sha256']);
    assert.match(file.sha256, HASH);
  }
  return result.json;
}
function expectAccepted(result, item) {
  // project.md §commands; door.md §forma-answer.
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const json = answerResult(result, item);
  assert.equal(json.accepted, true);
  assert.deepEqual(json.reasons, []);
  return json;
}
function expectCountedRefusal(result, item) {
  // project.md §commands; door.md §forma-answer:
  // refused answers change no record file and return every reason.
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const json = answerResult(result, item);
  assert.equal(json.accepted, false);
  assert.deepEqual(json.written, []);
  assert.deepEqual(json.removed, []);
  reasons(json.reasons);
  return json;
}
async function send(dir, item, filesOrFolder, session = WRITER) {
  const folder = typeof filesOrFolder === 'string' ? filesOrFolder : await answerFolder(filesOrFolder);
  return forma(dir, ['answer', item, folder, '--provider', session.provider,
    '--model', session.model, '--session', session.session, '--json']);
}
// door.md §scratch: refusal filename is the first twelve hex digits of the item hash.
const refusalPath = (item) => `work/refused/${sha256(item).slice(0, 12)}.json`;
const record = (dir) => snapshot(dir, { skip: ['work', 'runs'] });
const changes = (json) => json.items.filter((item) => item.item.startsWith('change:'));

async function givePacket(dir, item, folder = undefined) {
  // door.md §forma-give fixes the packet paths, absolute folder and hashes;
  // door.md §gives fixes item.json. All callers pass absolute temp paths.
  folder ??= `${await tempFolder('forma-packet-parent-')}/packet`;
  const result = forma(dir, ['give', item, folder, '--json']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  expectKeys(result.json, ['item', 'folder', 'files', 'differ']);
  assert.equal(result.json.item, item);
  assert.equal(result.json.folder, folder);
  const paths = await tree(folder);
  assert.deepEqual(result.json.files.map((file) => file.path), paths);
  for (const file of result.json.files) {
    expectKeys(file, ['path', 'sha256']);
    assert.equal(file.sha256, sha256(await read(folder, file.path)));
  }
  return { folder, result: result.json, files: await snapshot(folder), item: await readJSON(folder, 'item.json') };
}

describe('door.md §door — the door', () => {
  // Trace: door.md §door; design.md §brief, §coverage; account.md §items.
  test('door.md §door: directly written brief documents need no receipt and become work', async () => {
    const dir = await seeded();
    const items = missing(dir).items;
    assert.ok(items.some((item) => item.item === ITEM));
    assert.ok(!changes({ items }).some((item) => item.item.startsWith('change:design/brief/')));
    assert.equal(await read(dir, 'design/brief/receipt'), null);
  });
  // Trace: door.md §door, §gives, §forma-answer; design.md §coverage.
  test('door.md §door: an agent can follow missing, give and answer into the record', async () => {
    const dir = await seeded();
    const item = missing(dir).items.find((entry) => entry.item === ITEM);
    assert.ok(item);
    const packet = await givePacket(dir, item.item);
    assert.deepEqual(packet.item.item, item);
    expectAccepted(await send(dir, ITEM, await fixtureFiles('restate')), ITEM);
    assert.ok(!missing(dir).items.some((entry) => entry.item === ITEM));
    assert.ok(await read(dir, 'design/receipt'));
  });
});

describe('door.md §forma-give — forma give', () => {
  for (const destination of ['absent', 'empty']) {
    // Trace: door.md §forma-give; door.md §gives limits differ to Explain; door.md §spent.
    test(`door.md §forma-give: give creates an exact packet in an ${destination} external folder`, async () => {
      const dir = await seeded();
      const folder = destination === 'empty' ? await tempFolder() : `${await tempFolder()}/new-packet`;
      const before = await snapshot(dir, { skip: ['work/.gitignore'] });
      const packet = await givePacket(dir, ITEM, folder);
      assert.deepEqual(packet.result.differ, []);
      assert.deepEqual(await snapshot(dir, { skip: ['work/.gitignore'] }), before);
      assert.equal(await read(dir, 'work/spent.json'), null);
    });
  }
  // Trace: door.md §forma-give fixes the complete default output and byte order.
  test('door.md §forma-give: default give output lists packet paths in byte order', async () => {
    const dir = await seeded();
    const folder = await tempFolder();
    const result = forma(dir, ['give', ITEM, folder]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trimEnd().split('\n'), [`gave ${ITEM} into ${folder}`, ...await tree(folder)]);
  });
  for (const which of ['missing item', 'missing folder', 'not missing', 'developer item', 'project', 'inside', 'file', 'nonempty']) {
    // Trace: door.md §forma-give fixes all these refusals, no project or packet writes.
    test(`door.md §forma-give: give refuses ${which} without writing`, async () => {
      const dir = await seeded();
      let folder = await tempFolder();
      let args = ['give', ITEM, folder, '--json'];
      if (which === 'missing item') args = ['give', '--json'];
      if (which === 'missing folder') args = ['give', ITEM, '--json'];
      if (which === 'not missing') args[1] = 'passage:design/brief/absent.md#absent';
      if (which === 'developer item') {
        const empty = await project();
        const before = await snapshot(empty);
        expectEarlyRefusal(forma(empty, ['give', 'intake', folder, '--json']));
        assert.deepEqual(await snapshot(empty), before);
        assert.deepEqual(await tree(folder), []);
        return;
      }
      if (which === 'project') folder = dir;
      if (which === 'inside') folder = `${dir}/packet`;
      if (which === 'file') {
        await writeFiles(folder, { occupied: 'keep\n' });
        folder += '/occupied';
      }
      if (which === 'nonempty') await writeFiles(folder, { keep: 'keep\n' });
      if (!which.startsWith('missing')) args[2] = folder;
      const before = await snapshot(dir);
      const external = which === 'nonempty' ? await snapshot(folder) : null;
      expectEarlyRefusal(forma(dir, args));
      assert.deepEqual(await snapshot(dir), before);
      if (external) assert.deepEqual(await snapshot(folder), external);
    });
  }
});

describe('door.md §gives — packet contents', () => {
  // Trace: door.md §gives; models.md §parts-change opens model work after an action is added.
  test('door.md §gives: an existing model packet includes only span things wholly within its covered parts',
    { skip: !hasToolchain && 'toolchain absent' }, async () => {
      const dir = await engineProject();
      expectAccepted(await send(dir, 'cover:door', await fixtureFiles('engine-tlc')), 'cover:door');
      const root = (await read(dir, ROOT)).replace('\n\n1. [Door]',
        '\n| observer | Observes the door. | design/brief/overview.md#door |\n\n1. [Door]');
      const actionPath = 'design/parts/door/actions.md';
      const action = (await read(dir, actionPath))
        + '| open | operator | Opens the door. | none | none | stated | design/brief/overview.md#door |\n';
      const local = 'design/spans/local/claims/open/README.md';
      const shared = 'design/spans/shared/claims/open/README.md';
      const updates = await acceptedFiles({
        [ROOT]: root, 'design/parts/observer/README.md': '# Observer\n', [actionPath]: action,
        'design/spans/local/README.md': '# Local\n\nReads the door claim.\n',
        'design/spans/shared/README.md': '# Shared\n\nReads a claim of both parts.\n',
        [local]: await read(dir, ENGINE_CLAIM),
        [shared]: (await read(dir, ENGINE_CLAIM)).replace('| Parts | door |', '| Parts | door, observer |'),
      });
      updates['design/parts/door/receipt'] = receiptText([
        ...engineReceipt(await read(dir, 'design/parts/door/receipt')).filter((line) => line.file !== 'actions.md'),
        makeReceipt('actions.md', action),
      ]);
      await writeFiles(dir, updates);
      assert.ok(missing(dir).items.some((entry) => entry.item === 'model:door-model'));
      const packet = await givePacket(dir, 'model:door-model');
      assert.equal(packet.files[local], await read(dir, local));
      assert.equal(packet.files[shared], undefined);
      assert.equal(packet.files['design/parts/observer/README.md'], undefined);
      for (const path of ['models/door-model/model.md', 'models/door-model/Door.tla', ROOT, actionPath]) {
        assert.equal(packet.files[path], await read(dir, path));
      }
    });
  // Trace: door.md §gives fixes picks presence and decision exclusion; decisions.md §forma-decide.
  test('door.md §gives: a slot packet includes picks for choices posed by its lifecycle and excludes decision files', async () => {
    const dir = await engineProject();
    const choiceFiles = await fixtureFiles('choice');
    const posed = (await read(dir, ENGINE_LIFE)).replace('| open | closed |', '| open | choice:close-rule |');
    await writeFiles(dir, await acceptedFiles({ ...choiceFiles, [ENGINE_LIFE]: posed }));
    const on = 'door/choices/close-rule';
    const shown = forma(dir, ['show', 'pick', on, '--json']);
    assert.equal(shown.status, 0, shown.stderr || shown.stdout);
    const picked = forma(dir, ['decide', 'pick', on, '--choice', 'a', '--shown', shown.json.token,
      '--by', 'Fixture owner', '--provider', DEVELOPER.provider, '--model', DEVELOPER.model,
      '--session', DEVELOPER.session, '--json']);
    assert.equal(picked.status, 0, picked.stderr || picked.stdout);
    const life = forma(dir, ['show', 'confirm', 'door/lifecycles/state', '--json']);
    assert.equal(life.status, 0, life.stderr || life.stdout);
    const confirmed = forma(dir, ['decide', 'confirm', 'door/lifecycles/state', '--shown', life.json.token,
      '--by', 'Fixture owner', '--provider', DEVELOPER.provider, '--model', DEVELOPER.model,
      '--session', DEVELOPER.session, '--json']);
    assert.equal(confirmed.status, 0, confirmed.stderr || confirmed.stdout);
    const packet = await givePacket(dir, ENGINE_ITEM);
    // door.md §gives fixes these values, but leaves picks' nested shape open.
    const picks = JSON.stringify(packet.item.picks);
    for (const value of ['close-rule', 'close-rule-a', 'open', 'close', 'closed']) assert.ok(picks.includes(value), value);
    assert.equal(packet.files[ENGINE_LIFE], posed);
    assert.equal(packet.files['design/parts/door/choices/close-rule/README.md'], undefined);
    assert.ok(!Object.keys(packet.files).some((path) => path.includes('/decisions/')));
  });
  // Trace: door.md §gives; design.md §code-journeys; decisions.md §kept-journeys.
  test('door.md §gives: a slot for a code-added journey supplies journey metadata without inventing a page',
    { skip: !hasToolchain && 'toolchain absent' }, async () => {
      const state = await engineRuling();
      expectAccepted(await send(state.dir, 'cover:door', await fixtureFiles('engine-tlc')), 'cover:door');
      // decisions.md §kept-journeys: a kept journey uses the surprise basis's twelve
      // hexadecimal digits; engineSurprise independently computes that digest.
      const key = `kept-${state.surprise.slice(-12)}`;
      const item = `slot:door-model/parts/door/journeys/${key}/schedule`;
      assert.ok(missing(state.dir).items.some((entry) => entry.item === item));
      const packet = await givePacket(state.dir, item);
      assert.ok(Object.hasOwn(packet.item, 'journey'));
      assert.equal(packet.files[`design/parts/door/journeys/${key}/README.md`], undefined);
      for (const path of [ENGINE_LIFE, 'design/parts/door/actions.md', 'design/parts/door/boundary.md',
        'models/door-model/model.md', 'models/door-model/Door.tla']) assert.equal(packet.files[path], await read(state.dir, path));
    });
  // Trace: door.md §gives supplies both input sets and their contracts; account.md §items.
  test('door.md §gives: a two-kind span item receives the union of Restate and Model inputs', async () => {
    const pages = await fixtureFiles('span');
    const dir = await seeded(await acceptedFiles(pages));
    const item = 'span:gate+observer';
    assert.ok(missing(dir).items.some((entry) => entry.item === item));
    const packet = await givePacket(dir, item);
    for (const [path, bytes] of Object.entries({ ...await fixtureFiles('brief'), ...pages })) {
      assert.equal(packet.files[path], bytes);
    }
    assert.deepEqual(Object.keys(packet.files).filter((path) => path.startsWith('forma/')),
      ['forma/account.md', 'forma/design.md', 'forma/door.md', 'forma/engines.md', 'forma/evidence.md', 'forma/forms.md', 'forma/lifecycle-tool.md', 'forma/models.md', 'forma/presentation.md']);
  });
  // Trace: door.md §gives fixes copied bytes, exclusions, contracts and metadata keys.
  test('door.md §gives: Restate copies brief provenance and pages, excludes private record and scratch files', async () => {
    const dir = await restated();
    await writeFiles(dir, {
      'design/brief/new.md': '# New\n\nAnother requirement.\n',
      'work/evaluation.json': '{"private":"evaluation"}',
      'work/sessions.json': JSON.stringify([DEVELOPER]),
      'runs/private.txt': 'run not requested\n',
      'runs/.gitignore': '*\n',
    });
    const packet = await givePacket(dir, 'passage:design/brief/new.md#new');
    for (const [path, bytes] of Object.entries({ ...await fixtureFiles('brief'), ...await fixtureFiles('restate'),
      'design/brief/new.md': '# New\n\nAnother requirement.\n' })) assert.equal(packet.files[path], bytes);
    const paths = Object.keys(packet.files);
    assert.deepEqual(paths.filter((path) => path.startsWith('forma/')), ['forma/account.md', 'forma/design.md', 'forma/door.md', 'forma/forms.md', 'forma/lifecycle-tool.md', 'forma/presentation.md']);
    for (const name of ['account', 'design', 'door']) assert.equal(packet.files[`forma/${name}.md`], await read(repo, `spec/${name}.md`));
    assert.ok(paths.every((path) => path !== 'receipt' && !path.endsWith('/receipt')
      && !path.includes('/decisions/') && !path.startsWith('work/') && !path.startsWith('runs/')));
    assert.ok(paths.every((path) => path === 'item.json' || path.startsWith('base/') || path.startsWith('forma/')
      || path.startsWith('design/brief/') || path === ROOT || path === PART));
    expectKeys(packet.item, ['item', 'confirmed', 'picks', 'struck', 'refused']);
    assert.deepEqual(packet.item.item, missing(dir).items.find((entry) => entry.item === 'passage:design/brief/new.md#new'));
    assert.deepEqual(packet.item.refused, []);
  });
  // Trace: door.md §gives, §scratch fixes refusal order and excludes scratch files.
  test('door.md §gives: every locally kept refusal is given oldest first', async () => {
    const dir = await seeded();
    const first = expectCountedRefusal(await send(dir, ITEM, { [ROOT]: 'broken first\n' }), ITEM);
    const second = expectCountedRefusal(await send(dir, ITEM, { [PART]: 'broken second\n' }), ITEM);
    const packet = await givePacket(dir, ITEM);
    assert.deepEqual(packet.item.refused, [first.reasons, second.reasons]);
    assert.ok(!Object.keys(packet.files).some((path) => path.startsWith('work/')));
    // door.md §scratch and presentation.md §reading, account.md §commands: account also reads this machine's
    // refusal history; a brief passage's item is read under the project.
    const reading = forma(dir, ['account', '--json']);
    assert.equal(reading.status, 0, reading.stderr || reading.stdout);
    const item = reading.json.project.items.find((entry) => entry.item === ITEM);
    assert.ok(item);
    assert.deepEqual(item.refused, [first.reasons, second.reasons]);
  });
});

describe('door.md §answer-holds — answer folders', () => {
  // Trace: door.md §answer-holds; models.md §parts-change; door.md §forma-answer preserves record.
  test('door.md §answer-holds: a Model answer cannot drop the part an unruled surprise rests on',
    { skip: !hasToolchain && 'toolchain absent' }, async () => {
      const state = await engineTlcBaseSurprise();
      const root = (await read(state.dir, ROOT)).replace('\n\n1. [Door]',
        '\n| observer | Observes the door. | design/brief/overview.md#door |\n\n1. [Door]');
      await writeFiles(state.dir, await acceptedFiles({ [ROOT]: root,
        'design/parts/observer/README.md': '# Observer\n' }));
      const item = 'cover:observer';
      assert.ok(missing(state.dir).items.some((entry) => entry.item === item));
      const model = { ...state.model };
      model['models/door-model/model.md'] = model['models/door-model/model.md']
        .replace('| Parts | door |', '| Parts | observer |')
        .replace('| door/close | Close | none |\n', '')
        .replace('| door/state | d \\in {1} | Phase(d) |\n', '');
      const before = await record(state.dir);
      expectCountedRefusal(await send(state.dir, item, model), item);
      assert.deepEqual(await record(state.dir), before);
      assert.ok(await read(state.dir, `models/${state.surprise}.json`));
    });
  // Trace: door.md §answer-holds; design.md §restate-holds; door.md §forma-answer.
  test('door.md §answer-holds: an empty removed.md beside valid pages removes nothing', async () => {
    const dir = await seeded();
    const pages = await fixtureFiles('restate');
    const result = expectAccepted(await send(dir, ITEM, { ...pages, 'removed.md': '' }), ITEM);
    assert.deepEqual(result.removed, []);
    for (const [path, bytes] of Object.entries(pages)) assert.equal(await read(dir, path), bytes);
  });
  // Trace: door.md §answer-holds, §forma-answer: mixed paths fail only door checks.
  test('door.md §answer-holds: a two-kind span answer refuses mixed Restate and Model paths', async () => {
    const pages = await fixtureFiles('span');
    const dir = await seeded(await acceptedFiles(pages));
    const item = 'span:gate+observer';
    assert.ok(missing(dir).items.some((entry) => entry.item === item));
    const before = await record(dir);
    const result = expectCountedRefusal(await send(dir, item,
      { [PART]: pages[PART], 'models/mixed/model.md': 'Not a model.\n' }), item);
    assert.ok(result.reasons.every((reason) => reason.check.startsWith('door.md §')));
    assert.deepEqual(await record(dir), before);
  });
  // Trace: door.md §answer-holds; forms.md §claims, design.md §filing; account.md §items.
  test('door.md §answer-holds: a two-kind span item accepts the kind selected by its Restate paths', async () => {
    const dir = await seeded(await acceptedFiles(await fixtureFiles('span')));
    const item = 'span:gate+observer';
    const path = 'design/parts/gate/claims/observed/README.md';
    const page = '# The opening is observed\n\n| Field | Value |\n| --- | --- |\n'
      + '| Sentence | The observer sees the gate opening. |\n| Kind | safety |\n'
      + '| Stake | The observer could report the wrong gate state. |\n| Rests on | none |\n'
      + '| Parts | gate, observer |\n| Origin | stated |\n| Cites | design/brief/overview.md#gate |\n';
    const result = expectAccepted(await send(dir, item, { [path]: page }), item);
    assert.equal(result.kind, 'restate');
    assert.equal(await read(dir, path), page);
  });
  for (const path of [
    'design/brief/overwrite.md', 'design/decisions/forged.md', 'design/receipt',
    'models/gate/facts.000000000000.json', 'item.json', 'work/spent.json', 'other.md',
  ]) {
    // Trace: door.md §answer-holds, §forma-answer; design.md §restate-holds.
    test(`door.md §answer-holds: a Restate answer refuses the forbidden path ${path}`, async () => {
      const dir = await seeded();
      const before = await record(dir);
      const result = expectCountedRefusal(await send(dir, ITEM, { ...await fixtureFiles('restate'), [path]: '{}' }), ITEM);
      assert.ok(result.reasons.some((reason) => reason.file === path));
      assert.deepEqual(await record(dir), before);
    });
  }
  // Trace: door.md §answer-holds, §forma-answer refuses links and retains no answer file.
  test('door.md §answer-holds: a symbolic link in the answer is refused', async () => {
    const dir = await seeded();
    const folder = await project('door/invalid-link');
    const result = expectCountedRefusal(await send(dir, ITEM, folder), ITEM);
    assert.ok(result.reasons.some((reason) => reason.file === ROOT));
    assert.equal(await read(dir, ROOT), null);
  });
  // Trace: door.md §answer-holds refuses empty folders; door.md §forma-answer preserves tracked bytes.
  test('door.md §answer-holds: a nested empty directory refuses an otherwise regular answer', async () => {
    const dir = await seeded();
    const folder = await answerFolder(await fixtureFiles('restate'));
    // Harness folders live directly in tmpdir; this prefix creates an empty
    // child there without importing filesystem APIs outside the harness.
    await tempFolder(`${folder.split('/').at(-1)}/empty-`);
    const before = await record(dir);
    expectCountedRefusal(await send(dir, ITEM, folder), ITEM);
    assert.deepEqual(await record(dir), before);
  });
  // Trace: door.md §answer-holds; forms.md §page-rules; door.md §forma-answer.
  test('door.md §answer-holds: an empty page is checked as written and does not remove an existing page', async () => {
    const dir = await restated();
    await writeFiles(dir, { 'design/brief/new.md': '# New\n\nNew work.\n' });
    const before = await record(dir);
    expectCountedRefusal(await send(dir, 'passage:design/brief/new.md#new', { [PART]: '' }), 'passage:design/brief/new.md#new');
    assert.deepEqual(await record(dir), before);
  });
  // Trace: door.md §answer-holds requires the changed path; door.md §forma-answer leaves it unchanged.
  test('door.md §answer-holds: change answers must actually hold the changed path', async () => {
    const dir = await restated();
    await writeFiles(dir, { [PART]: '# Hand edit\n' });
    const item = `change:${PART}`;
    assert.ok(missing(dir).items.some((entry) => entry.item === item));
    expectCountedRefusal(await send(dir, item, { [ROOT]: (await fixtureFiles('restate'))[ROOT] }), item);
    assert.equal(await read(dir, PART), '# Hand edit\n');
  });
});

describe('door.md §forma-answer — answer intake', () => {
  // Trace: door.md §forma-answer; door.md §scratch; door.md §lock.
  test('door.md §forma-answer: an answer needs no prior give, writes exact bytes and reports sorted hashes', async () => {
    const dir = await seeded();
    const files = await fixtureFiles('restate');
    const json = expectAccepted(await send(dir, ITEM, files), ITEM);
    assert.equal(json.kind, 'restate');
    assert.deepEqual(json.answers, { spent: 1, allowed: 30 });
    assert.deepEqual(json.removed, []);
    for (const [path, bytes] of Object.entries(files)) {
      assert.equal(await read(dir, path), bytes);
      assert.ok(json.written.some((file) => file.path === path && file.sha256 === sha256(bytes)));
    }
    assert.deepEqual(await readJSON(dir, 'work/spent.json'), { answers: 1, runs: 0 });
    assert.deepEqual(await readJSON(dir, 'work/sessions.json'), [WRITER]);
    assert.deepEqual((await tree(dir)).filter((path) => path.startsWith('work/tmp/')), []);
    assert.equal(await read(dir, 'work/lock'), null);
  });
  for (const field of ['item', 'folder', 'provider', 'model', 'session']) {
    for (const mode of ['missing', 'empty']) {
      // Trace: door.md §forma-answer refuses missing/empty inputs before every write.
      test(`door.md §forma-answer: ${mode} ${field} refuses before counting or writing`, async () => {
        const dir = await seeded();
        const folder = await answerFolder(await fixtureFiles('restate'));
        const args = ['answer', ITEM, folder, '--provider', WRITER.provider, '--model', WRITER.model, '--session', WRITER.session];
        const index = field === 'item' ? 1 : field === 'folder' ? 2 : args.indexOf(`--${field}`);
        if (mode === 'empty') args[field === 'item' || field === 'folder' ? index : index + 1] = '';
        else if (field === 'item') args.splice(1, 2);
        else args.splice(index, field === 'folder' ? 1 : 2);
        args.push('--json');
        const before = await snapshot(dir);
        expectEarlyRefusal(forma(dir, args));
        assert.deepEqual(await snapshot(dir), before);
      });
    }
  }
  for (const which of ['absent', 'regular file']) {
    // Trace: door.md §forma-answer refuses non-folder paths before counting or writing.
    test(`door.md §forma-answer: a ${which} answer folder refuses before counting`, async () => {
      const dir = await seeded();
      const parent = await answerFolder(which === 'regular file' ? { target: 'not a folder' } : {});
      const before = await snapshot(dir);
      expectEarlyRefusal(await send(dir, ITEM, `${parent}/target`));
      assert.deepEqual(await snapshot(dir), before);
    });
  }
  for (const location of ['project', 'inside']) {
    // Trace: door.md §forma-answer, §answer-holds: boundary failures count, tracked files stay.
    test(`door.md §forma-answer: a folder ${location} the project is a counted door refusal`, async () => {
      const dir = await seeded();
      const before = await record(dir);
      const result = expectCountedRefusal(await send(dir, ITEM, location === 'project' ? dir : `${dir}/design/brief`), ITEM);
      assert.deepEqual(result.answers, { spent: 1, allowed: 30 });
      assert.deepEqual(await record(dir), before);
    });
  }
  // Trace: door.md §forma-answer gives every independent door failure, skips kind checks, keeps refusals only while missing.
  test('door.md §forma-answer: all independent door failures are returned without running kind checks', async () => {
    const dir = await restated();
    const result = expectCountedRefusal(await send(dir, ITEM, { [ROOT]: 'not a page', 'receipt': 'not allowed' }, DEVELOPER), ITEM);
    // Item no longer missing, forbidden path, and deciding session each fail.
    assert.ok(result.reasons.length >= 3);
    assert.ok(result.reasons.every((reason) => reason.check.startsWith('door.md §')));
    assert.deepEqual(result.answers, { spent: 1, allowed: 30 });
    assert.equal(await read(dir, refusalPath(ITEM)), null);
  });
  // Trace: door.md §forma-answer, §scratch; forms.md §page-rules, design.md §restate-applied.
  test('door.md §forma-answer: every failing kind check is reported and no record byte changes', async () => {
    const dir = await seeded();
    const before = await record(dir);
    const result = expectCountedRefusal(await send(dir, ITEM, { [ROOT]: 'bad root\n', [PART]: 'bad part\n' }), ITEM);
    for (const path of [ROOT, PART]) assert.ok(result.reasons.some((reason) => reason.file === path));
    assert.deepEqual(await record(dir), before);
    assert.deepEqual(await readJSON(dir, refusalPath(ITEM)), { item: ITEM, refusals: [result.reasons] });
  });
  // Trace: door.md §forma-answer, §scratch: both submissions count, accepted retry clears reasons.
  test('door.md §forma-answer: a successful retry removes kept refusals and counts both submissions', async () => {
    const dir = await seeded();
    expectCountedRefusal(await send(dir, ITEM, { [ROOT]: 'bad\n' }), ITEM);
    const result = expectAccepted(await send(dir, ITEM, await fixtureFiles('restate')), ITEM);
    assert.deepEqual(result.answers, { spent: 2, allowed: 30 });
    assert.equal(await read(dir, refusalPath(ITEM)), null);
  });
  // Trace: door.md §forma-answer fixes accepted text, written paths and allowance line.
  test('door.md §forma-answer: text output includes acceptance, written paths and the allowance line', async () => {
    const dir = await seeded();
    const files = await fixtureFiles('restate');
    const folder = await answerFolder(files);
    const result = forma(dir, ['answer', ITEM, folder, '--provider', WRITER.provider, '--model', WRITER.model, '--session', WRITER.session]);
    assert.equal(result.status, 0, result.stderr);
    const lines = result.stdout.trimEnd().split('\n');
    assert.equal(lines[0], `accepted ${ITEM}`);
    assert.equal(lines.at(-1), 'answers: 1 spent of 30');
    for (const path of Object.keys(files)) assert.ok(lines.includes(`wrote ${path}`));
  });
  // Trace: door.md §forma-answer fixes the text rendering of each kept reason; door.md §scratch.
  test('door.md §forma-answer: text refusal prints every structured reason with null fields omitted', async () => {
    const dir = await seeded();
    const folder = await answerFolder({ [ROOT]: 'bad root\n', [PART]: 'bad part\n' });
    const result = forma(dir, ['answer', ITEM, folder, '--provider', WRITER.provider, '--model', WRITER.model, '--session', WRITER.session]);
    assert.equal(result.status, 1);
    const kept = await readJSON(dir, refusalPath(ITEM));
    assert.ok(kept, result.stderr || result.stdout);
    reasons(kept.refusals[0]);
    const lines = result.stdout.trimEnd().split('\n');
    assert.equal(lines[0], `refused ${ITEM}`);
    assert.equal(lines.at(-1), 'answers: 1 spent of 30');
    for (const reason of kept.refusals[0]) {
      const prefix = [reason.file, reason.entry, reason.field].filter((value) => value !== null).join(' ');
      assert.ok(lines.includes(`${prefix}: ${reason.says} (${reason.check})`));
    }
  });
});

describe('door.md §receipts — receipts', () => {
  // Trace: design.md §removal; models.md §parts-change; door.md §receipts; models.md §slot-currency.
  test('door.md §receipts: re-filing keeps slot bytes and authors while rewriting the entry name in its receipt', async () => {
    const dir = await engineProject({ encoding: true });
    const frontPath = 'design/parts/door/README.md';
    const front = await read(dir, frontPath);
    const unresolved = front + '\n4. [Missing](claims/absent/)\n';
    await writeFiles(dir, { [frontPath]: unresolved,
      'design/parts/door/receipt': receiptText([
        ...engineReceipt(await read(dir, 'design/parts/door/receipt')).filter((line) => line.file !== 'README.md'),
        makeReceipt('README.md', unresolved),
      ]),
    });
    const item = 'restate:door';
    assert.ok(missing(dir).items.some((entry) => entry.item === item));
    const slotBytes = await read(dir, ENGINE_SLOT);
    const original = engineReceipt(await read(dir, ENGINE_RECEIPT))[0];
    expectAccepted(await send(dir, item, {
      [frontPath]: front.replace('3. [Stays open](claims/open/)\n', ''),
      'removed.md': 'design/parts/door/claims/open\n',
      'design/spans/archive/README.md': '# Archive\n\nKeeps the door claim in the reading.\n\n1. [Open](claims/open/)\n',
      'design/spans/archive/claims/open/README.md': await read(dir, ENGINE_CLAIM),
    }), item);
    const moved = 'models/lifecycles-door/spans/archive/claims/open';
    assert.equal(await read(dir, `${moved}/encoding.md`), slotBytes);
    assert.equal(await read(dir, ENGINE_SLOT), null);
    assert.equal(await read(dir, ENGINE_RECEIPT), null);
    const line = engineReceipt(await read(dir, `${moved}/receipt`))[0];
    assert.equal(line.sha256, original.sha256);
    assert.deepEqual(line.authors, original.authors);
    assert.deepEqual(line.pins, [{ entry: 'archive/claims/open', pin: engineClaimPin() },
      { entry: 'door/lifecycles/state', pin: engineLifePin }]);
    assert.ok(!missing(dir).items.some((entry) => entry.item === 'slot:lifecycles-door/spans/archive/claims/open/encoding'));
  });
  // Trace: door.md §receipts fixes compact ordered lines, authors, session and hashes; door.md §clock.
  test('door.md §receipts: accepted files have exact JSON.stringify lines in byte order in their own folders', async () => {
    const dir = await seeded();
    const files = { ...await fixtureFiles('restate'),
      'design/parts/gate/actions.md': '# Actions\n\n| Action | Actor | Sentence | Cases | Guard | Origin | Cites |\n| --- | --- | --- | --- | --- | --- | --- |\n',
      'design/parts/gate/boundary.md': '# Boundary\n',
      'design/parts/gate/omissions.md': '# Omissions\n\n| Passage | Reason |\n| --- | --- |\n',
    };
    expectAccepted(await send(dir, ITEM, files), ITEM);
    for (const folder of ['design', 'design/parts/gate']) {
      const bytes = await read(dir, `${folder}/receipt`);
      assert.ok(bytes.endsWith('\n'));
      const lines = bytes.slice(0, -1).split('\n');
      assert.deepEqual(lines, byteOrder(lines));
      const expectedNames = Object.keys(files).filter((path) => path.slice(0, path.lastIndexOf('/')) === folder)
        .map((path) => path.slice(path.lastIndexOf('/') + 1)).sort();
      assert.deepEqual(lines.map((line) => JSON.parse(line).file).sort(), expectedNames);
      for (const text of lines) {
        // door.md §receipts fixes the exact JSON.stringify serialization, including escapes.
        const line = JSON.parse(text);
        assert.equal(text, JSON.stringify(line));
        assert.deepEqual(Object.keys(line), ['file', 'sha256', 'at', 'session', 'authors']);
        assert.equal(line.sha256, sha256(files[`${folder}/${line.file}`]));
        assert.match(line.at, TIME);
        assert.deepEqual(line.session, WRITER);
        assert.deepEqual(Object.keys(line.session), ['provider', 'model', 'session']);
        assert.deepEqual(line.authors, [WRITER]);
      }
    }
    assert.equal(await read(dir, 'design/decisions/receipt'), null);
    assert.equal(await read(dir, 'design/brief/receipt'), null);
  });
  // Trace: door.md §receipts reads receipt lines as a set and selects by matching bytes.
  test('door.md §receipts: receipt line order and duplicate identical lines do not change the reading', async () => {
    const dir = await restated();
    const ordinary = missing(dir);
    const bytes = await read(dir, ROOT);
    const line = makeReceipt('README.md', bytes);
    const older = makeReceipt('README.md', '# Earlier project\n', { at: '2023-12-31T23:59:59.500Z' });
    await writeFiles(dir, { 'design/receipt': receiptText([older, line, line]).split('\n').filter(Boolean).reverse().join('\n') + '\n' });
    assert.deepEqual(missing(dir), ordinary);
  });
  // Trace: door.md §receipts unions authors of every prior line, including nonmatching versions.
  test('door.md §receipts: a rewrite unions every prior author, including nonmatching merged lines', async () => {
    const dir = await restated();
    const second = { provider: 'B', model: 'a', session: 'second' };
    const third = { provider: 'a', model: 'B', session: 'third' };
    const bytes = await read(dir, ROOT);
    await writeFiles(dir, {
      'design/receipt': receiptText([makeReceipt('README.md', bytes), makeReceipt('README.md', '# Another version\n', { session: second, authors: [second] })]),
      [ROOT]: '# Unreceipted merge\n',
    });
    const item = `change:${ROOT}`;
    expectAccepted(await send(dir, item, { [ROOT]: bytes }, third), item);
    const lines = (await read(dir, 'design/receipt')).trimEnd().split('\n').map(JSON.parse);
    assert.equal(lines.length, 1);
    assert.deepEqual(lines[0].authors, sessionOrder([WRITER, second, third]));
    assert.deepEqual(lines[0].session, third);
  });
  // Trace: door.md §receipts ignores, reports and later drops malformed lines; door.md §change.
  test('door.md §receipts: malformed receipt lines are ignored, reported and dropped on the next write', async () => {
    const dir = await restated();
    const bytes = await read(dir, 'design/receipt');
    await writeFiles(dir, { 'design/receipt': bytes + '{broken line\n' });
    let current = missing(dir);
    assert.ok(current.items.some((item) => item.item === 'change:design/receipt'));
    assert.ok(!current.items.some((item) => item.item === `change:${ROOT}`));
    await writeFiles(dir, { [ROOT]: '# edited\n' });
    expectAccepted(await send(dir, `change:${ROOT}`, { [ROOT]: (await fixtureFiles('restate'))[ROOT] }), `change:${ROOT}`);
    current = missing(dir);
    assert.ok(!changes(current).some((item) => item.item === 'change:design/receipt'));
    assert.ok(!(await read(dir, 'design/receipt')).includes('{broken line'));
  });
  // Trace: door.md §repair-answer to §receipts carry repair mechanisms, removals and authors forward; before is specific to a Repair write.
  test('door.md §receipts: repair history and removed hashes survive later ordinary versions', async () => {
    const { dir, decline, item } = await declinedParts();
    const beforePart = await read(dir, PART);
    const emptyRoot = '# Empty\n\n| Part | Purpose | Cites |\n| --- | --- | --- |\n';
    expectAccepted(await send(dir, item, { [ROOT]: emptyRoot, 'removed.md': 'design/parts/gate\n', ...await fixtureFiles('repair') }), item);
    await writeFiles(dir, { [ROOT]: '# unreceipted edit\n' });
    const session = { ...WRITER, session: 'later-author' };
    expectAccepted(await send(dir, `change:${ROOT}`, { [ROOT]: emptyRoot.replace('# Empty', '# Still empty') }, session), `change:${ROOT}`);
    const line = JSON.parse((await read(dir, 'design/receipt')).trim());
    assert.deepEqual(line.answers, [decline.name]);
    assert.ok(line.removed.some((file) => file.file === 'parts/gate/README.md' && file.before === sha256(beforePart)));
    assert.deepEqual(line.authors, sessionOrder([WRITER, session]));
    assert.deepEqual(line.mechanisms, [{ decision: decline.name, mechanism: 'Records that the gate also closes when requested.' }]);
    assert.ok(!Object.hasOwn(line, 'mechanism'));
    assert.ok(!Object.hasOwn(line, 'before'));
  });
});

describe('door.md §sessions — sessions', () => {
  // Trace: door.md §sessions, §forma-answer, §scratch fixes identity, counts and sorted deduplication.
  test('door.md §sessions: all three declared session fields define identity and the seen set is sorted', async () => {
    const dir = await seeded();
    const sessions = [WRITER, { ...WRITER, provider: 'A' }, { ...WRITER, model: 'A' },
      { ...WRITER, session: 'A' }, WRITER];
    for (const session of sessions) expectCountedRefusal(await send(dir, ITEM, { [ROOT]: 'broken\n' }, session), ITEM);
    assert.deepEqual(await readJSON(dir, 'work/sessions.json'), sessionOrder(sessions.slice(0, -1)));
    assert.equal((await readJSON(dir, 'work/spent.json')).answers, 5);
  });
  // Trace: door.md §sessions; door.md §forma-answer; door.md §scratch: deciding sessions refuse but join the seen set.
  test('door.md §sessions: an answer from the session of any decision is refused', async () => {
    const dir = await seeded();
    const before = await record(dir);
    const result = expectCountedRefusal(await send(dir, ITEM, await fixtureFiles('restate'), DEVELOPER), ITEM);
    assert.ok(result.reasons.some((reason) => /^door\.md §(?:sessions|forma-answer)\b/.test(reason.check)));
    assert.deepEqual(await record(dir), before);
    assert.deepEqual(await readJSON(dir, 'work/sessions.json'), [DEVELOPER]);
  });
  for (const source of ['session', 'authors', 'seen']) {
    // Trace: door.md §sessions; decisions.md §who-decides, §forma-decide forbids every listed answer-session source.
    test(`door.md §sessions: a decision cannot use an answer session known through ${source}`, async () => {
      const dir = await restated();
      if (source === 'authors') {
        const current = { ...WRITER, session: 'replacement' };
        for (const [path, receipt] of [[ROOT, 'design/receipt'], [PART, 'design/parts/gate/receipt']]) {
          await writeFiles(dir, { [receipt]: receiptText([makeReceipt('README.md', await read(dir, path),
            { session: current, authors: sessionOrder([WRITER, current]) })]) });
        }
      }
      if (source === 'seen') {
        const other = { ...WRITER, session: 'refused-only' };
        await writeFiles(dir, { 'work/sessions.json': JSON.stringify([other]) });
      }
      const session = source === 'seen' ? { ...WRITER, session: 'refused-only' } : WRITER;
      const before = await record(dir);
      const result = forma(dir, ['decide', 'allow', '--answers', '1', '--by', 'Fixture owner',
        '--provider', session.provider, '--model', session.model, '--session', session.session, '--json']);
      expectEarlyRefusal(result);
      assert.deepEqual(await record(dir), before);
    });
  }
  // Trace: door.md §sessions discounts the answer, never the decision; decisions.md §intake sums allowances.
  test('door.md §sessions: after a merge the answer is discounted and the conflicting decision stands', async () => {
    const dir = await restated();
    const allowance = decision({ kind: 'allow', session: WRITER, rows: [
      ['Answers', 7], ['Runs', 0], ['TLC seconds', 0], ['TLC megabytes', 0],
      ['Alloy seconds', 0], ['Alloy megabytes', 0], ['Lifecycle seconds', 0],
    ] });
    await writeFiles(dir, { [allowance.path]: allowance.bytes });
    const current = missing(dir);
    assert.equal(current.here.answers.allowed, 37);
    for (const path of [ROOT, PART]) assert.ok(current.items.some((entry) => entry.item === `change:${path}`));
    assert.ok(!current.items.some((entry) => entry.item === `change:${allowance.path}`));
    assert.equal(await read(dir, allowance.path), allowance.bytes);
  });
  // Trace: door.md §sessions, §spent; decisions.md §intake, §forma-decide.
  test('door.md §sessions: a refused-only session is unknown to a clone without that machine scratch', async () => {
    const dir = await seeded();
    expectCountedRefusal(await send(dir, ITEM, { [ROOT]: 'broken\n' }), ITEM);
    const clone = await project(null, await record(dir));
    const result = forma(clone, ['decide', 'allow', '--answers', '1', '--by', 'Fixture owner',
      '--provider', WRITER.provider, '--model', WRITER.model, '--session', WRITER.session, '--json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(missing(clone).here.answers.allowed, 31);
  });
});

describe('door.md §spent — allowance spent', () => {
  // Trace: door.md §forma-answer, §spent; account.md §what-it-is, §items puts allow under here and no item waits for it.
  test('door.md §spent: the last allowed answer is counted and the next counts and records nothing', async () => {
    const dir = await seeded({}, { answers: 1 });
    const first = expectCountedRefusal(await send(dir, ITEM, { [ROOT]: 'broken\n' }), ITEM);
    assert.deepEqual(first.answers, { spent: 1, allowed: 1 });
    const before = await snapshot(dir, { skip: ['work/.gitignore'] });
    expectEarlyRefusal(await send(dir, ITEM, await fixtureFiles('restate'), { ...WRITER, session: 'not-seen' }));
    assert.deepEqual(await snapshot(dir, { skip: ['work/.gitignore'] }), before);
    const current = missing(dir);
    assert.equal(current.here.allow.why, 'answers');
    assert.ok(!current.items.some((entry) => entry.item === 'allow'));
    assert.ok(!current.items.find((entry) => entry.item === ITEM).waits?.includes('allow'));
  });
  // Trace: door.md §spent; decisions.md §intake sums intake and allow; door.md §forma-answer.
  test('door.md §spent: an allowance sums with the intake and permits another answer', async () => {
    const dir = await seeded({}, { answers: 0 });
    const allow = decision({ kind: 'allow', rows: [['Answers', 2], ['Runs', 0], ['TLC seconds', 0],
      ['TLC megabytes', 0], ['Alloy seconds', 0], ['Alloy megabytes', 0], ['Lifecycle seconds', 0]] });
    await writeFiles(dir, { [allow.path]: allow.bytes });
    const result = expectAccepted(await send(dir, ITEM, await fixtureFiles('restate')), ITEM);
    assert.deepEqual(result.answers, { spent: 1, allowed: 2 });
  });
  // Trace: door.md §spent, §read-checks; design.md §coverage preserves accepted coverage across clones.
  test('door.md §spent: a clone starts unspent and does not charge accepted files again', async () => {
    const dir = await seeded();
    expectAccepted(await send(dir, ITEM, await fixtureFiles('restate')), ITEM);
    const clone = await project(null, await record(dir));
    const current = missing(clone);
    assert.equal(current.here.answers.spent, 0);
    assert.equal(current.here.runs.spent, 0);
    assert.ok(!current.items.some((entry) => entry.item === ITEM));
    assert.deepEqual(changes(current), []);
  });
});

describe('door.md §scratch — scratch files', () => {
  for (const path of ['work/spent.json', 'work/sessions.json', refusalPath(ITEM), 'work/lock']) {
    // Trace: door.md §scratch reads malformed scratch as absent and replaces it; door.md §forma-answer, §lock.
    test(`door.md §scratch: malformed ${path} is absent and replaced when next written`, async () => {
      const dir = await seeded({ [path]: '{not JSON\n' });
      const result = expectCountedRefusal(await send(dir, ITEM, { [ROOT]: 'bad\n' }), ITEM);
      assert.deepEqual(await readJSON(dir, 'work/spent.json'), { answers: 1, runs: 0 });
      assert.deepEqual(await readJSON(dir, 'work/sessions.json'), [WRITER]);
      assert.deepEqual(await readJSON(dir, refusalPath(ITEM)), { item: ITEM, refusals: [result.reasons] });
      assert.equal(await read(dir, 'work/lock'), null);
    });
  }
  // Trace: door.md §scratch replaces a refusal file holding another item; door.md §forma-answer.
  test('door.md §scratch: a refusal hash path occupied by another item is replaced', async () => {
    const dir = await seeded({ [refusalPath(ITEM)]: JSON.stringify({ item: 'another:item', refusals: [] }) });
    const result = expectCountedRefusal(await send(dir, ITEM, { [ROOT]: 'bad\n' }), ITEM);
    assert.deepEqual(await readJSON(dir, refusalPath(ITEM)), { item: ITEM, refusals: [result.reasons] });
  });
  // Trace: door.md §scratch; account.md §what-it-is, presentation.md §reading preserves record/models/coverage, resets local scratch.
  test('door.md §scratch: dropping scratch preserves the record while resetting seen, spent and refused', async () => {
    const dir = await restated();
    const uncovered = 'passage:design/brief/sources/reference.md#background';
    expectCountedRefusal(await send(dir, uncovered, { [PART]: 'bad\n' }), uncovered);
    const before = forma(dir, ['account', '--json']);
    assert.equal(before.status, 0, before.stderr);
    const clean = await project(null, await record(dir));
    const after = forma(clean, ['account', '--json']);
    assert.equal(after.status, 0, after.stderr);
    assert.deepEqual(after.json.models, before.json.models);
    assert.deepEqual(after.json.project.coverage, before.json.project.coverage);
    assert.equal(after.json.here.answers.spent, 0);
    assert.equal(await read(clean, 'work/sessions.json'), null);
    assert.equal(await read(clean, refusalPath(uncovered)), null);
    assert.deepEqual(await record(clean), await record(dir));
  });
});

describe('door.md §lock — writer locking', () => {
  // Trace: door.md §lock requires waiting for the live lock; timeout is the harness ending the blocked call.
  test('door.md §lock: an answer waits while a live process retains the writer lock', async () => {
    const lock = JSON.stringify({ pid: process.pid, at: new Date().toISOString() });
    const dir = await seeded({ 'work/lock': lock });
    const folder = await answerFolder(await fixtureFiles('restate'));
    const before = await record(dir);
    // The process named by the lock remains alive for the entire call. The
    // harness terminates this deliberately blocked writer, not the lock owner.
    const result = forma(dir, ['answer', ITEM, folder, '--provider', WRITER.provider,
      '--model', WRITER.model, '--session', WRITER.session, '--json'], { timeout: 1000 });
    assert.equal(result.status, null, result.stderr || result.stdout
      || 'a live lock cannot be stolen or treated as a refusal');
    assert.deepEqual(await record(dir), before);
    assert.equal(await read(dir, 'work/lock'), lock);
    assert.equal(await read(dir, 'work/spent.json'), null);
    assert.equal(await read(dir, 'work/sessions.json'), null);
  });
  // Trace: door.md §lock: a command that only reads takes no lock and writes nothing in the project.
  test('door.md §lock: a read does not wait for a live writer lock and writes nothing', async () => {
    const lock = JSON.stringify({ pid: process.pid, at: new Date().toISOString() });
    const dir = await seeded({ 'work/lock': lock });
    await writeFiles(dir, { 'work/.gitignore': 'outdated\n' });
    const before = await snapshot(dir);
    const result = forma(dir, ['missing', '--json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(Array.isArray(result.json?.items));
    assert.deepEqual(await snapshot(dir), before);
  });
  // Trace: door.md §lock; door.md §forma-answer; door.md §scratch: second answer is counted, no longer missing, not kept.
  test('door.md §lock: two sequential answers are checked against the preceding accepted state', async () => {
    const dir = await seeded();
    const files = await fixtureFiles('restate');
    expectAccepted(await send(dir, ITEM, files), ITEM);
    const before = await record(dir);
    const refused = expectCountedRefusal(await send(dir, ITEM, files, { ...WRITER, session: 'second' }), ITEM);
    assert.deepEqual(refused.answers, { spent: 2, allowed: 30 });
    assert.deepEqual(await record(dir), before);
    assert.equal(await read(dir, refusalPath(ITEM)), null);
    assert.equal(await read(dir, 'work/lock'), null);
  });
  // Trace: door.md §lock permits independent clones; door.md §spent, §scratch counts locally.
  test('door.md §lock: separate clones can each accept the same missing item', async () => {
    const first = await seeded();
    const second = await project(null, await snapshot(first));
    for (const dir of [first, second]) {
      expectAccepted(await send(dir, ITEM, await fixtureFiles('restate')), ITEM);
      assert.deepEqual(await readJSON(dir, 'work/spent.json'), { answers: 1, runs: 0 });
    }
  });
});

describe('door.md §read-checks — checking each read', () => {
  // Trace: door.md §read-checks; design.md §at-read; account.md §commands fixes found presence.
  test('door.md §read-checks: a matching receipt does not excuse an invalid page form', async () => {
    const files = await fixtureFiles('restate');
    files[PART] = 'This page has no heading.\n';
    const dir = await seeded(await acceptedFiles(files));
    const current = missing(dir);
    const item = current.items.find((entry) => entry.item === `change:${PART}`);
    assert.ok(item);
    // account.md §commands fixes this key, but not the enclosing shape of found.
    assert.ok(Object.hasOwn(item, 'found'));
    assert.ok(!current.items.some((entry) => entry.item === `change:${ROOT}`));
  });
  // Trace: door.md §read-checks; design.md §at-read; account.md §items: unresolved citations owe passage.
  test('door.md §read-checks: an unresolved citation owes a passage rather than changing the citing page', async () => {
    const dir = await restated();
    await writeFiles(dir, { 'design/brief/overview.md': '# Renamed\n\nThe gate opens when requested.\n' });
    const current = missing(dir);
    assert.ok(current.items.some((entry) => entry.item === ITEM && entry.why === 'unresolved'));
    assert.ok(!current.items.some((entry) => entry.item === `change:${ROOT}`));
  });
  // Trace: door.md §read-checks, §receipts: every read checks the bytes as they are.
  test('door.md §read-checks: edited page bytes are checked again at the next read', async () => {
    const dir = await restated();
    assert.deepEqual(changes(missing(dir)), []);
    await writeFiles(dir, { [PART]: '# Direct edit\n' });
    assert.ok(missing(dir).items.some((entry) => entry.item === `change:${PART}`));
  });
  // Trace: door.md §read-checks; design.md §brief; account.md §what-it-is ignores unrelated scratch/run/brief files.
  test('door.md §read-checks: files outside the record and brief non-documents are not read', async () => {
    const dir = await restated();
    const before = missing(dir);
    await writeFiles(dir, { 'arbitrary.json': '{bad JSON', 'src/unrelated.mjs': 'broken',
      'design/brief/attachment.bin': 'arbitrary', 'runs/unrelated': 'arbitrary', 'runs/.gitignore': '*\n' });
    assert.deepEqual(missing(dir), before);
  });
  // Trace: door.md §read-checks leaves no deleted-file change; account.md §items describes changes only for checked files.
  test('door.md §read-checks: deleted files leave no change item of their own', async () => {
    const dir = await restated();
    const files = await snapshot(dir);
    delete files[PART];
    const deleted = await project(null, files);
    const current = missing(deleted);
    assert.ok(!current.items.some((entry) => entry.item === `change:${PART}`));
    assert.equal(await read(deleted, PART), null);
  });
  // Trace: door.md §read-checks, §spent accepts clone records without charging or applying local allowance.
  test('door.md §read-checks: accepted files on another clone are read without charging its exhausted allowance', async () => {
    const dir = await restated({ answers: 0 });
    const before = await record(dir);
    const current = missing(dir);
    assert.deepEqual(changes(current), []);
    assert.equal(current.here.answers.spent, 0);
    assert.deepEqual(await record(dir), before);
  });
});

describe('door.md §change — changes that count for nothing', () => {
  // Trace: door.md §change, §sessions, §receipts: another current session repairs discount, old authors remain.
  test('door.md §change: a new answering session clears a session-discounted page while retaining author history', async () => {
    const dir = await restated();
    const allowance = decision({ kind: 'allow', session: WRITER, rows: [
      ['Answers', 1], ['Runs', 0], ['TLC seconds', 0], ['TLC megabytes', 0],
      ['Alloy seconds', 0], ['Alloy megabytes', 0], ['Lifecycle seconds', 0],
    ] });
    await writeFiles(dir, { [allowance.path]: allowance.bytes });
    const item = `change:${ROOT}`;
    assert.ok(missing(dir).items.some((entry) => entry.item === item));
    const replacement = { ...WRITER, session: 'independent-writer' };
    expectAccepted(await send(dir, item, await fixtureFiles('restate'), replacement), item);
    assert.ok(!changes(missing(dir)).some((entry) => [item, `change:${PART}`].includes(entry.item)));
    for (const path of ['design/receipt', 'design/parts/gate/receipt']) {
      const line = JSON.parse((await read(dir, path)).trim());
      assert.deepEqual(line.session, replacement);
      assert.deepEqual(line.authors, sessionOrder([WRITER, replacement]));
    }
    assert.equal(await read(dir, allowance.path), allowance.bytes);
  });
  for (const path of [ROOT, PART, 'design/decisions/not-a-decision.md', 'design/receipt',
    'design/.gitattributes', 'models/.gitattributes',
    'design/unknown.txt', 'models/unknown.txt']) {
    // Trace: door.md §change, §read-checks; account.md §commands fixes on and found; account.md §commands limits read writes.
    test(`door.md §change: ${path} with unaccepted or invalid bytes is a change with reasons`, async () => {
      const dir = await restated();
      await writeFiles(dir, { [path]: 'not accepted\n' });
      const before = await record(dir);
      const item = missing(dir).items.find((entry) => entry.item === `change:${path}`);
      assert.ok(item, `missing change:${path}`);
      assert.equal(item.on, path);
      assert.ok(Object.hasOwn(item, 'found'));
      assert.deepEqual(await record(dir), before);
    });
  }
  // Trace: door.md §change clears the change by restoring bytes; door.md §receipts reuses the matching receipt.
  test('door.md §change: restoring the old bytes clears a page change without a new receipt', async () => {
    const dir = await restated();
    const old = await read(dir, PART);
    const receipt = await read(dir, 'design/parts/gate/receipt');
    await writeFiles(dir, { [PART]: '# Edited\n' });
    assert.ok(missing(dir).items.some((entry) => entry.item === `change:${PART}`));
    await writeFiles(dir, { [PART]: old });
    assert.ok(!missing(dir).items.some((entry) => entry.item === `change:${PART}`));
    assert.equal(await read(dir, 'design/parts/gate/receipt'), receipt);
  });
  // Trace: door.md §change, §forma-answer permits a Restate repair and records its exact digest.
  test('door.md §change: a Restate answer for change repairs a page with a new receipt', async () => {
    const dir = await restated();
    await writeFiles(dir, { [PART]: '# Edited\n' });
    const item = `change:${PART}`;
    const result = expectAccepted(await send(dir, item, { [PART]: '# A deliberate new title\n' }), item);
    assert.equal(result.kind, 'restate');
    assert.ok(!missing(dir).items.some((entry) => entry.item === item));
    assert.equal(JSON.parse((await read(dir, 'design/parts/gate/receipt')).trim()).sha256, sha256('# A deliberate new title\n'));
  });
  // Trace: door.md §change and design.md §at-read makes dependent pages wait without changes or restate work.
  test('door.md §change: invalid dependencies do not turn dependent front pages into changes', async () => {
    const dir = await restated();
    await writeFiles(dir, { [PART]: '# Edited\n' });
    const current = missing(dir);
    assert.ok(current.items.some((entry) => entry.item === `change:${PART}`));
    assert.ok(!current.items.some((entry) => entry.item === `change:${ROOT}`));
    assert.ok(!current.items.some((entry) => entry.item === 'restate:parts'));
  });
  for (const path of ['design/decisions/not-a-decision.md', 'design/unknown.txt', 'models/unknown.txt']) {
    // Trace: door.md §change; door.md §forma-give refuses give for files no answer kind supplies.
    test(`door.md §change: removing ${path} clears its change and no answer can supply it`, async () => {
      const dir = await restated();
      await writeFiles(dir, { [path]: 'not Forma\n' });
      const item = `change:${path}`;
      assert.ok(missing(dir).items.some((entry) => entry.item === item));
      expectEarlyRefusal(forma(dir, ['give', item, await tempFolder(), '--json']));
      const files = await snapshot(dir);
      delete files[path];
      const restored = await project(null, files);
      assert.ok(!missing(restored).items.some((entry) => entry.item === item));
    });
  }
});

describe('door.md §copies — copies and git files', () => {
  for (const mode of ['absent', 'wrong']) {
    // Trace: door.md §copies fixes auxiliary bytes and rewrites them on a write; door.md §change clears their changes.
    test(`door.md §copies: ${mode} design and work git files are rewritten on a write`, async () => {
      const dir = await seeded();
      const files = await snapshot(dir);
      for (const path of ['design/.gitattributes', 'work/.gitignore']) {
        if (mode === 'absent') delete files[path]; else files[path] = 'wrong\n';
      }
      const target = await project(null, files);
      expectAccepted(await send(target, ITEM, await fixtureFiles('restate')), ITEM);
      assert.equal(await read(target, 'design/.gitattributes'), DESIGN_ATTRIBUTES);
      assert.equal(await read(target, 'work/.gitignore'), '*\n');
      assert.ok(!changes(missing(target)).some((entry) => ['change:design/.gitattributes', 'change:work/.gitignore'].includes(entry.item)));
    });
  }
  // Trace: door.md §copies forbids changing git metadata or the project gitignore during answer intake.
  test('door.md §copies: answer intake leaves the project gitignore and git files untouched', async () => {
    const dir = await seeded({ '.gitignore': 'custom\n', '.git/HEAD': 'ref: refs/heads/test\n',
      '.git/config': '[core]\n\trepositoryformatversion = 0\n', '.git/refs/heads/test': '0'.repeat(40) + '\n' });
    const before = await snapshot(`${dir}/.git`);
    expectAccepted(await send(dir, ITEM, await fixtureFiles('restate')), ITEM);
    assert.deepEqual(await snapshot(`${dir}/.git`), before);
    assert.equal(await read(dir, '.gitignore'), 'custom\n');
  });
  // Trace: door.md §copies, §receipts accepts one whole side through union lines, rejects unmatched merged text.
  test('door.md §copies: union receipts accept either whole side but reject line-merged page bytes', async () => {
    const files = await fixtureFiles('restate');
    const a = files[ROOT];
    const b = a.replace('# Gate project', '# The gate').replace('Opens the gate when requested.', 'Opens the gate on request.');
    const union = receiptText([makeReceipt('README.md', a), makeReceipt('README.md', b)]);
    for (const bytes of [a, b]) {
      const dir = await restated();
      await writeFiles(dir, { [ROOT]: bytes, 'design/receipt': union });
      assert.ok(!missing(dir).items.some((entry) => entry.item === `change:${ROOT}`));
    }
    const merged = await restated();
    await writeFiles(merged, { [ROOT]: a.replace('# Gate project', '# The gate'), 'design/receipt': union });
    assert.ok(missing(merged).items.some((entry) => entry.item === `change:${ROOT}`));
  });
  // Trace: door.md §copies keeps both decisions; decisions.md §intake sums every allowance.
  test('door.md §copies: distinct decisions from two copies both survive and add their allowances', async () => {
    const dir = await seeded();
    for (const answers of [2, 3]) {
      const allow = decision({ kind: 'allow', rows: [['Answers', answers], ['Runs', 0], ['TLC seconds', 0],
        ['TLC megabytes', 0], ['Alloy seconds', 0], ['Alloy megabytes', 0], ['Lifecycle seconds', 0]] });
      await writeFiles(dir, { [allow.path]: allow.bytes });
    }
    assert.equal(missing(dir).here.answers.allowed, 35);
    assert.equal((await tree(dir)).filter((path) => path.includes('-allow-')).length, 2);
  });
});

describe('door.md §clock — the clock', () => {
  // Trace: door.md §clock uses the latest tracked time, names its file and time, and writes nothing.
  test('door.md §clock: the latest of multiple tracked times is named when a write is held', async () => {
    const dir = await restated();
    const latest = '2099-01-01T00:00:00.000Z';
    await writeFiles(dir, {
      'design/receipt': receiptText([makeReceipt('README.md', await read(dir, ROOT), { at: '2098-01-01T00:00:00.000Z' })]),
      'design/parts/gate/receipt': receiptText([makeReceipt('README.md', await read(dir, PART), { at: latest })]),
    });
    const before = await snapshot(dir);
    const result = expectEarlyRefusal(await send(dir, ITEM, await fixtureFiles('restate')));
    assert.ok(result.refused.some((reason) => reason.file === 'design/parts/gate/receipt' && reason.says.includes(latest)));
    assert.deepEqual(await snapshot(dir), before);
  });
  for (const source of ['receipt', 'decision']) {
    // Trace: door.md §clock tracks both receipt and decision times and refuses before every record/scratch write.
    test(`door.md §clock: a future ${source} refuses a write before any scratch or record changes`, async () => {
      const future = '2099-01-01T00:00:00.000Z';
      const dir = await restated();
      let path;
      if (source === 'receipt') {
        path = 'design/receipt';
        await writeFiles(dir, { [path]: receiptText([makeReceipt('README.md', await read(dir, ROOT), { at: future })]) });
      } else {
        const allow = decision({ kind: 'allow', at: future, rows: [['Answers', 1], ['Runs', 0], ['TLC seconds', 0],
          ['TLC megabytes', 0], ['Alloy seconds', 0], ['Alloy megabytes', 0], ['Lifecycle seconds', 0]] });
        path = allow.path;
        await writeFiles(dir, { [path]: allow.bytes });
      }
      const before = await snapshot(dir);
      const result = expectEarlyRefusal(await send(dir, 'passage:design/brief/sources/reference.md#background', await fixtureFiles('restate')));
      assert.ok(result.refused.some((reason) => reason.file === path && reason.says.includes(future)));
      assert.deepEqual(await snapshot(dir), before);
    });
  }
  // Trace: door.md §clock: a read still reads and says which time is ahead.
  test('door.md §clock: a read still succeeds, names the future time and writes nothing', async () => {
    const future = '2099-01-01T00:00:00.000Z';
    const dir = await restated();
    await writeFiles(dir, { 'design/receipt': receiptText([makeReceipt('README.md', await read(dir, ROOT), { at: future })]) });
    const before = await snapshot(dir);
    const result = forma(dir, ['missing']);
    assert.equal(result.status, 0, result.stderr);
    assert.ok((result.stdout + result.stderr).includes(future));
    assert.deepEqual(await snapshot(dir), before);
  });
  // Trace: door.md §clock counts only parsing receipts and correctly named decisions; door.md §forma-answer accepts the valid answer.
  test('door.md §clock: malformed receipt and misnamed decision future times do not hold a writer', async () => {
    const dir = await seeded();
    const allow = decision({ kind: 'allow', at: '2099-01-01T00:00:00.000Z', rows: [['Answers', 1], ['Runs', 0],
      ['TLC seconds', 0], ['TLC megabytes', 0], ['Alloy seconds', 0], ['Alloy megabytes', 0], ['Lifecycle seconds', 0]] });
    await writeFiles(dir, { 'design/receipt': '{"at":"2099-01-01T00:00:00.000Z"}\n',
      'design/decisions/wrong-name.md': allow.bytes });
    expectAccepted(await send(dir, ITEM, await fixtureFiles('restate')), ITEM);
  });
  // Trace: door.md §clock permits a time under sixty seconds ahead and writes the current machine UTC millisecond time.
  test('door.md §clock: a tracked time less than a minute ahead permits writing at the machine clock', async () => {
    const dir = await seeded();
    const future = new Date(Date.now() + 30_000).toISOString();
    // A parsing receipt line is a tracked time even if its old file is absent.
    await writeFiles(dir, { 'design/receipt': receiptText([makeReceipt('README.md', '# prior\n', { at: future })]) });
    const start = Date.now();
    expectAccepted(await send(dir, ITEM, await fixtureFiles('restate')), ITEM);
    const end = Date.now();
    const at = JSON.parse((await read(dir, 'design/receipt')).trim()).at;
    assert.match(at, TIME);
    assert.ok(Date.parse(at) >= start && Date.parse(at) <= end);
  });
});

describe('door.md §forma-answer, §read-checks, §change — clarified page checks', () => {
  for (const kind of ['reserved phase action key', 'duplicate lifecycle action column']) {
    const invalidPage = async (dir) => {
      const path = kind === 'reserved phase action key' ? 'design/parts/door/actions.md' : ENGINE_LIFE;
      const original = await read(dir, path);
      const bytes = kind === 'reserved phase action key'
        ? original.replace('| close | operator |', '| phase | operator |')
        : original.replace('| Phase | close |\n| --- | --- |\n| open | closed |\n| closed | None. |',
          '| Phase | close | close |\n| --- | --- | --- |\n| open | closed | closed |\n| closed | None. | None. |');
      return { path, bytes };
    };
    // forms.md §page-rules forbids phase as an action key and repeated lifecycle
    // action columns; design.md §restate-checks check 2 refuses these name failures at answer.
    test(`door.md §forma-answer: a ${kind} refuses a Restate answer`, async () => {
      const dir = await engineProject();
      const { path, bytes } = await invalidPage(dir);
      const before = await record(dir);
      const item = 'passage:design/brief/sources/reference.md#background';
      const result = expectCountedRefusal(await send(dir, item, { [path]: bytes }), item);
      assert.ok(result.reasons.some((reason) => reason.file === path));
      assert.deepEqual(await record(dir), before);
    });
    // forms.md §page-rules, design.md §at-read assign both failures to name resolution, which
    // account.md §items owes by restate rather than door.md §change own-form change.
    test(`door.md §read-checks: a ${kind} owes restatement without discounting its page`, async () => {
      const dir = await engineProject();
      const { path, bytes } = await invalidPage(dir);
      const updates = await acceptedFiles({ [path]: bytes });
      if (path.endsWith('/actions.md')) {
        updates['design/parts/door/receipt'] = receiptText([
          ...engineReceipt(await read(dir, 'design/parts/door/receipt')).filter((line) => line.file !== 'actions.md'),
          makeReceipt('actions.md', bytes),
        ]);
      }
      await writeFiles(dir, updates);
      const current = missing(dir);
      assert.ok(current.items.some((entry) => entry.item === 'restate:door' && entry.why === 'unresolved'));
      assert.ok(!current.items.some((entry) => entry.item === `change:${path}`));
    });
  }
  for (const kind of ['should-happen refused step', 'identical choice alternatives']) {
    const invalidPages = async (dir) => {
      if (kind === 'should-happen refused step') {
        const path = 'design/parts/door/journeys/close/README.md';
        return { path, pages: { [path]: (await read(dir, path)).replace('| Refused step | - |', '| Refused step | 1 |') } };
      }
      const path = 'design/parts/door/choices/close-rule/README.md';
      const pages = await fixtureFiles('choice');
      const [head, alternatives] = pages[path].split('\n## a\n');
      const first = alternatives.split('\n## b\n')[0];
      pages[path] = `${head}\n## a\n${first}\n## b\n${first}`;
      pages[ENGINE_LIFE] = (await read(dir, ENGINE_LIFE)).replace('| open | closed |', '| open | choice:close-rule |');
      return { path, pages };
    };
    // forms.md §journeys, §choices, design.md §at-read make these own-form failures: a
    // should-happen journey has Refused step -, and alternatives must differ.
    test(`door.md §forma-answer: own-form validation refuses ${kind}`, async () => {
      const dir = await engineProject();
      const { path, pages } = await invalidPages(dir);
      const before = await record(dir);
      const item = 'passage:design/brief/sources/reference.md#background';
      const result = expectCountedRefusal(await send(dir, item, pages), item);
      assert.ok(result.reasons.some((reason) => reason.file === path));
      assert.deepEqual(await record(dir), before);
    });
    // design.md §at-read and door.md §read-checks to §change discount an own-form failure
    // despite matching receipt bytes, rather than leaving it as a resolution item.
    test(`door.md §read-checks: matching receipts do not excuse ${kind}`, async () => {
      const dir = await engineProject();
      const { path, pages } = await invalidPages(dir);
      await writeFiles(dir, await acceptedFiles(pages));
      assert.ok(missing(dir).items.some((entry) => entry.item === `change:${path}`));
    });
  }
  // design.md §restate-applied leaves a pre-existing resolution failure in an unheld
  // page to its own item; door.md §forma-answer accepts an answer that passes its checks.
  test('door.md §forma-answer: Restate accepts unrelated work while another part has a pre-existing resolution failure', async () => {
    const pages = await fixtureFiles('span');
    const observer = 'design/parts/observer/README.md';
    pages[observer] += '\n1. [Missing claim](claims/absent/)\n';
    const dir = await seeded(await acceptedFiles(pages));
    assert.ok(missing(dir).items.some((entry) => entry.item === 'restate:observer'));
    const item = 'passage:design/brief/sources/reference.md#background';
    // forms.md §part-readme, §reading-order: a part with no things has only its heading.
    const gate = '# Gate\n';
    expectAccepted(await send(dir, item, { [PART]: gate }), item);
    assert.equal(await read(dir, PART), gate);
    assert.equal(await read(dir, observer), pages[observer]);
    assert.ok(missing(dir).items.some((entry) => entry.item === 'restate:observer'));
  });
  // design.md §restate-applied still refuses an existing resolution failure in a page
  // held by the answer; design.md §restate-checks check 2 requires its front-page links to resolve.
  test('door.md §forma-answer: Restate refuses a pre-existing resolution failure in a page it holds', async () => {
    const pages = await fixtureFiles('span');
    const observer = 'design/parts/observer/README.md';
    pages[observer] += '\n1. [Missing claim](claims/absent/)\n';
    const dir = await seeded(await acceptedFiles(pages));
    const before = await record(dir);
    const item = 'passage:design/brief/sources/reference.md#background';
    const result = expectCountedRefusal(await send(dir, item, { [PART]: '# Revised gate\n', [observer]: pages[observer] }), item);
    assert.ok(result.reasons.some((reason) => reason.file === observer));
    assert.deepEqual(await record(dir), before);
  });
  // design.md §restate-applied refuses newly caused failures in pages absent from the
  // answer; design.md §restate-checks check 2 requires the part list to match the remaining parts.
  test('door.md §forma-answer: Restate refuses a newly caused resolution failure in an unheld page', async () => {
    const dir = await seeded(await acceptedFiles(await fixtureFiles('span')));
    const before = await record(dir);
    const item = 'passage:design/brief/sources/reference.md#background';
    const result = expectCountedRefusal(await send(dir, item, {
      'removed.md': 'design/parts/observer\n',
    }), item);
    assert.ok(result.reasons.some((reason) => reason.file === ROOT));
    assert.deepEqual(await record(dir), before);
  });
  const premisePath = 'design/parts/door/premises/operator/README.md';
  const premise = '# Reliable controller\n\n| Field | Value |\n| --- | --- |\n'
    + '| Statement | The controller sends valid requests. |\n| Class | world |\n'
    + '| Why not examined | not verifiable here |\n| Falsifier | An invalid request arrives. |\n'
    + '| Provider | The operator. |\n| Origin | stated |\n| Cites | design/brief/overview.md#door |\n';

  // forms.md §page-rules, design.md §restate-checks: premises and
  // boundary rows share keys; design.md §restate-applied preserves tracked bytes.
  test('door.md §forma-answer: a premise cannot reuse a boundary row key in the same part', async () => {
    const dir = await engineProject();
    const before = await record(dir);
    const item = 'passage:design/brief/sources/reference.md#background';
    expectCountedRefusal(await send(dir, item, { [premisePath]: premise }), item);
    assert.deepEqual(await record(dir), before);
  });
  // forms.md §page-rules, §premises, design.md §restate-checks:
  // a distinct premise key satisfies the shared namespace and page checks.
  test('door.md §forma-answer: a premise with a distinct boundary-space key is accepted', async () => {
    const dir = await engineProject();
    const path = premisePath.replace('/operator/', '/reliable-operator/');
    const item = 'passage:design/brief/sources/reference.md#background';
    expectAccepted(await send(dir, item, { [path]: premise }), item);
    assert.equal(await read(dir, path), premise);
  });
  // design.md §at-read: duplicate keys owe restatement rather than
  // discounting either page's own form; account.md §items names the item.
  test('door.md §read-checks: a merged premise and boundary key collision owes restatement without changes', async () => {
    const dir = await engineProject();
    await writeFiles(dir, await acceptedFiles({ [premisePath]: premise }));
    const current = missing(dir);
    assert.ok(current.items.some((item) => item.item === 'restate:door' && item.why === 'unresolved'));
    for (const path of [premisePath, 'design/parts/door/boundary.md']) {
      assert.ok(!current.items.some((item) => item.item === `change:${path}`));
    }
  });
  for (const [label, path, before, after] of [
    ['part purpose', ROOT, '| Controls a door. |', '|  |'],
    ['action sentence', 'design/parts/door/actions.md', '| Closes the door. |', '|  |'],
    ['lifecycle field', 'design/parts/door/lifecycles/state/README.md', '| Entity | door |', '| Entity |  |'],
    ['lifecycle phase', 'design/parts/door/lifecycles/state/README.md', '| open | closed |', '|  | closed |'],
  ]) {
    // forms.md §page-rules, design.md §restate-checks: only matrix action
    // cells may be empty; design.md §restate-applied preserves tracked files on refusal.
    test(`door.md §forma-answer: an empty ${label} cell refuses the answer without tracked changes`, async () => {
      const dir = await engineProject();
      const bytes = (await read(dir, path)).replace(before, after);
      const tracked = await record(dir);
      const item = 'passage:design/brief/sources/reference.md#background';
      expectCountedRefusal(await send(dir, item, { [path]: bytes }), item);
      assert.deepEqual(await record(dir), tracked);
    });
    // design.md §at-read: an empty cell is an own-form failure at
    // read despite the matching receipt entry of door.md §receipts.
    test(`door.md §read-checks: an empty ${label} cell with matching receipt is a change`, async () => {
      const pages = await fixtureFiles('engine-lifecycle');
      pages[path] = pages[path].replace(before, after);
      const dir = await seeded(await acceptedFiles(pages));
      assert.ok(missing(dir).items.some((item) => item.item === `change:${path}`));
    });
  }
  // forms.md §page-rules, §lifecycles, design.md §restate-checks:
  // empty action cells are valid; lifecycle findings do not refuse intake.
  test('door.md §forma-answer: an empty lifecycle action cell is accepted and remains a page', async () => {
    const dir = await engineProject();
    const bytes = (await read(dir, ENGINE_LIFE)).replace('| open | closed |', '| open |  |');
    const item = 'passage:design/brief/sources/reference.md#background';
    expectAccepted(await send(dir, item, { [ENGINE_LIFE]: bytes }), item);
    assert.equal(await read(dir, ENGINE_LIFE), bytes);
    assert.ok(!missing(dir).items.some((entry) => entry.item === `change:${ENGINE_LIFE}`));
  });
  // forms.md §page-rules, §lifecycles allow Phase anywhere;
  // door.md §forma-answer preserves the submitted bytes.
  test('door.md §forma-answer: lifecycle action columns may precede the Phase column', async () => {
    const dir = await engineProject();
    const bytes = (await read(dir, ENGINE_LIFE)).replace(
      '| Phase | close |\n| --- | --- |\n| open | closed |\n| closed | None. |',
      '| close | Phase |\n| --- | --- |\n| closed | open |\n| None. | closed |');
    const item = 'passage:design/brief/sources/reference.md#background';
    expectAccepted(await send(dir, item, { [ENGINE_LIFE]: bytes }), item);
    assert.equal(await read(dir, ENGINE_LIFE), bytes);
    assert.ok(!missing(dir).items.some((entry) => entry.item === `change:${ENGINE_LIFE}`));
  });
  for (const [label, before, after] of [
    ['unknown phase', '| open | closed |', '| open | absent |'],
    ['unknown action column', '| Phase | close |', '| Phase | absent |'],
    ['duplicate phase key', '| closed | None. |', '| open | None. |'],
    ['malformed phase key', '| closed | None. |', '| Bad-Key | None. |'],
  ]) {
    // design.md §at-read assigns every name check to resolution or
    // placement; door.md §read-checks opens restate, not change.
    test(`door.md §read-checks: a lifecycle ${label} owes restatement and is not an own-form change`, async () => {
      const pages = await fixtureFiles('engine-lifecycle');
      pages[ENGINE_LIFE] = pages[ENGINE_LIFE].replace(before, after);
      const dir = await seeded(await acceptedFiles(pages));
      const current = missing(dir);
      assert.ok(current.items.some((item) => item.item === 'restate:door' && item.why === 'unresolved'));
      assert.ok(!current.items.some((item) => item.item === `change:${ENGINE_LIFE}`));
    });
  }
  // design.md §at-read distinguishes closed-list form from names;
  // forms.md §claims permits only safety, liveness or structure as Kind.
  test('door.md §read-checks: an unknown claim Kind is an own-form change despite its receipt', async () => {
    const pages = await fixtureFiles('engine-lifecycle');
    pages[ENGINE_CLAIM] = pages[ENGINE_CLAIM].replace('| Kind | safety |', '| Kind | impossible |');
    const dir = await seeded(await acceptedFiles(pages));
    assert.ok(missing(dir).items.some((item) => item.item === `change:${ENGINE_CLAIM}`));
  });
  // design.md §at-read: pages lacking their part README owe the
  // part's restatement; door.md §read-checks leaves no deleted-file change.
  test('door.md §read-checks: a part page left without its front page owes its part restatement', async () => {
    const pages = await fixtureFiles('engine-lifecycle');
    delete pages['design/parts/door/README.md'];
    const dir = await seeded(await acceptedFiles(pages));
    const current = missing(dir);
    assert.ok(current.items.some((item) => item.item === 'restate:door' && item.why === 'unresolved'));
    for (const path of ['design/parts/door/README.md', ENGINE_LIFE]) {
      assert.ok(!current.items.some((item) => item.item === `change:${path}`));
    }
  });
  for (const field of ['title', 'author', 'date', 'origin']) {
    // design.md §brief makes whitespace-only provenance uncitable;
    // design.md §at-read and account.md §items, §commands owe uncovered and unresolved in table order.
    test(`door.md §read-checks: whitespace-only source ${field} leaves its citation unresolved`, async () => {
      const pages = await fixtureFiles('restate');
      const address = 'design/brief/sources/reference.md#background';
      pages[ROOT] = pages[ROOT].replace('design/brief/overview.md#gate', address);
      const dir = await seeded(await acceptedFiles(pages));
      const source = await read(dir, 'design/brief/sources/reference.md');
      await writeFiles(dir, { 'design/brief/sources/reference.md':
        source.replace(new RegExp(`^${field}:.*$`, 'm'), `${field}: '   '`),
      });
      const current = missing(dir);
      assert.ok(current.items.some((item) => item.item === `passage:${address}` && item.why === 'uncovered, unresolved'));
      assert.ok(!current.items.some((item) => item.item === `change:${ROOT}`));
    });
  }
});

describe('door.md §receipts, §sessions, §read-checks, §change — clarified record reads', () => {
  // door.md §forma-answer accepts nonempty declared session values; door.md §receipts to §sessions preserve those
  // values with exactly JSON.stringify's escaping and Unicode spelling.
  test('door.md §receipts: receipt session strings use JSON.stringify escaping exactly', async () => {
    const dir = await seeded();
    const session = { provider: 'agent/é', model: 'model"\\\t', session: 'line\nsession' };
    expectAccepted(await send(dir, ITEM, await fixtureFiles('restate'), session), ITEM);
    const text = (await read(dir, 'design/receipt')).slice(0, -1);
    const line = JSON.parse(text);
    assert.deepEqual(line.session, session);
    assert.equal(text, JSON.stringify(line));
  });
  for (const variant of ['extra JSON whitespace', 'noncanonical string escape']) {
    // door.md §receipts requires exactly JSON.stringify's text; a line outside that
    // form is ignored and makes its receipt a change, leaving its file unaccepted.
    test(`door.md §receipts: a receipt line with ${variant} is ignored despite equivalent JSON`, async () => {
      const dir = await restated();
      const canonical = await read(dir, 'design/receipt');
      const altered = variant === 'extra JSON whitespace'
        ? canonical.replace('{', '{ ')
        : canonical.replace('README.md', 'README\\u002emd');
      assert.deepEqual(JSON.parse(altered), JSON.parse(canonical));
      await writeFiles(dir, { 'design/receipt': altered });
      const current = missing(dir);
      for (const path of ['design/receipt', ROOT]) {
        assert.ok(current.items.some((entry) => entry.item === `change:${path}`));
      }
    });
  }
  for (const path of ['work/.gitignore', 'runs/.gitignore']) {
    for (const mode of ['absent', 'altered']) {
      // door.md §change item 7 excludes both scratch ignores from changes even
      // while their folder holds files; account.md §commands permits the work ignore
      // to be rewritten by a read, without changing the account.
      test(`door.md §change: ${mode} ${path} never opens a change item`, async () => {
        const dir = await restated();
        await writeFiles(dir, { 'work/spent.json': '{"answers":0,"runs":0}\n',
          'runs/local-output.txt': 'Scratch run output.\n', 'runs/.gitignore': '*\n' });
        const expected = missing(dir);
        const files = await snapshot(dir);
        if (mode === 'absent') delete files[path];
        else files[path] = 'outdated\n';
        const target = await project(null, files);
        const current = missing(target);
        assert.ok(!current.items.some((entry) => entry.item === `change:${path}`));
        assert.deepEqual(current, expected);
      });
    }
  }
  // door.md §read-checks to §change exclude folders from the nonregular filesystem objects
  // that count for nothing. An empty folder alone is therefore no change item.
  test('door.md §change: an empty folder under design is not a foreign-file change', async () => {
    const dir = await restated();
    const folder = await tempFolder(`${dir.split('/').at(-1)}/design/empty-`);
    const path = folder.slice(dir.length + 1);
    assert.ok(!missing(dir).items.some((entry) => entry.item === `change:${path}`));
  });
  // door.md §receipts: an unterminated final line is ignored,
  // reporting both its receipt and its now-unaccepted page.
  test('door.md §receipts: a final receipt line without line feed does not accept its page', async () => {
    const dir = await restated();
    const bytes = await read(dir, 'design/receipt');
    await writeFiles(dir, { 'design/receipt': bytes.slice(0, -1) });
    const current = missing(dir);
    for (const path of ['design/receipt', ROOT]) assert.ok(current.items.some((item) => item.item === `change:${path}`));
    await writeFiles(dir, { 'design/receipt': bytes });
    const restored = missing(dir);
    for (const path of ['design/receipt', ROOT]) assert.ok(!restored.items.some((item) => item.item === `change:${path}`));
  });
  // door.md §receipts ignores only the malformed last line, not
  // earlier complete lines; door.md §change still reports the bad receipt.
  test('door.md §receipts: complete receipt lines survive an unterminated final line', async () => {
    const dir = await restated();
    await writeFiles(dir, { 'design/receipt': (await read(dir, 'design/receipt'))
      + JSON.stringify(makeReceipt('older.md', '# Earlier\n')) });
    const current = missing(dir);
    assert.ok(current.items.some((item) => item.item === 'change:design/receipt'));
    assert.ok(!current.items.some((item) => item.item === `change:${ROOT}`));
  });
  // door.md §sessions discounts only the selected entry's session;
  // door.md §receipts still retains every historical author.
  test('door.md §sessions: a deciding historical author does not discount an independent latest session', async () => {
    const dir = await restated();
    const currentWriter = { ...WRITER, session: 'independent-latest' };
    for (const [path, receipt] of [[ROOT, 'design/receipt'], [PART, 'design/parts/gate/receipt']]) {
      await writeFiles(dir, { [receipt]: receiptText([makeReceipt('README.md', await read(dir, path), {
        session: currentWriter, authors: sessionOrder([WRITER, currentWriter]),
      })]) });
    }
    const allow = decision({ kind: 'allow', session: WRITER, rows: [
      ['Answers', 7], ['Runs', 0], ['TLC seconds', 0], ['TLC megabytes', 0],
      ['Alloy seconds', 0], ['Alloy megabytes', 0], ['Lifecycle seconds', 0],
    ] });
    await writeFiles(dir, { [allow.path]: allow.bytes });
    const current = missing(dir);
    assert.equal(current.here.answers.allowed, 37);
    for (const path of [ROOT, PART]) assert.ok(!current.items.some((item) => item.item === `change:${path}`));
  });
  for (const kind of ['intake', 'allow']) {
    // decisions.md §kinds, §decision-file: even a correctly
    // hash-named file is no decision when its Shown pin is wrong.
    test(`door.md §read-checks: a hash-named ${kind} with a mismatched Shown pin is a change`, async () => {
      const bad = decision({ kind, pin: '0'.repeat(64),
        ...(kind === 'intake' ? { words: 'Nothing else is in scope.' } : {}),
        rows: [
          ...(kind === 'intake' ? [['Situation', 'design new']] : []),
          ['Answers', 9], ['Runs', 0], ['TLC seconds', 0], ['TLC megabytes', 0],
          ['Alloy seconds', 0], ['Alloy megabytes', 0], ['Lifecycle seconds', 0],
          ...(kind === 'intake' ? [['Cadence', 'span'], ['Inbox cap', 7]] : []),
        ],
      });
      const dir = kind === 'intake'
        ? await project(null, { ...await fixtureFiles('brief'), 'design/.gitattributes': DESIGN_ATTRIBUTES, [bad.path]: bad.bytes })
        : await seeded({ [bad.path]: bad.bytes });
      const current = missing(dir);
      assert.ok(current.items.some((item) => item.item === `change:${bad.path}`));
      if (kind === 'intake') assert.ok(current.items.some((item) => item.item === 'intake'));
      else assert.equal(current.here.answers.allowed, 30);
    });
  }
  // door.md §read-checks, §change discounts a symlink even
  // when the receipt digest matches the bytes of its target.
  test('door.md §change: a symlink at an accepted page path still counts for nothing', async () => {
    const dir = await project('door/invalid-link');
    const pages = await fixtureFiles('restate');
    await writeFiles(dir, { ...await snapshot(await seeded()),
      'design/target.txt': pages[ROOT], [PART]: pages[PART],
      'design/receipt': receiptText([makeReceipt('README.md', pages[ROOT])]),
      'design/parts/gate/receipt': receiptText([makeReceipt('README.md', pages[PART])]),
    });
    assert.ok(missing(dir).items.some((item) => item.item === `change:${ROOT}`));
  });
  for (const path of ['design/.gitattributes', 'models/.gitattributes']) {
    // door.md §change item 7 defines the attributes' existence conditions;
    // door.md §clock: the read still reads while a tracked time is ahead.
    test(`door.md §change: missing ${path} is reported under its folder existence condition`, async () => {
      const files = await snapshot(await restated());
      files['design/receipt'] = receiptText([makeReceipt('README.md', files[ROOT], { at: '2099-01-01T00:00:00.000Z' })]);
      if (path.startsWith('models/')) files['models/unknown.txt'] = 'A file exists here.\n';
      delete files[path];
      const target = await project(null, files);
      assert.ok(missing(target).items.some((item) => item.item === `change:${path}`));
      assert.equal(await read(target, path), null);
    });
  }
  // door.md §change requires design files outside the brief;
  // absent model and run folders need no auxiliary files.
  test('door.md §change: a brief alone does not require design or model attributes or a runs ignore', async () => {
    const dir = await project('door/brief');
    const current = missing(dir);
    for (const path of ['design/.gitattributes', 'models/.gitattributes', 'runs/.gitignore']) {
      assert.ok(!current.items.some((item) => item.item === `change:${path}`));
      assert.equal(await read(dir, path), null);
    }
  });
});

// design.md §passages, §pins: one heading block,
// one paragraph block; the parts unit
// has Purpose and Cites only, with the passage replaced by its canonical hash.
const partsPin = (purpose = 'Opens the gate when requested.') => sha256(`Purpose: ${purpose}\nCites: ${sha256('# Gate\n\nThe gate opens when requested.')}`);
async function declinedParts() {
  const decline = decision({ kind: 'decline', on: 'parts', pin: partsPin(), words: 'The gate must also close.' });
  const dir = await restated();
  await writeFiles(dir, { [decline.path]: decline.bytes });
  return { dir, decline, item: `repair:${decline.name}` };
}
async function repairedPages() {
  const pages = await fixtureFiles('restate');
  return { [ROOT]: pages[ROOT].replace('Opens the gate when requested.', 'Opens and closes the gate when requested.') };
}

describe('door.md §repair-answer — Repair answers', () => {
  // models.md §model-repair to §freeze and account.md §items distinguish the shared model files
  // from another claim's encoding. door.md §forma-answer fixes acceptance and refusal.
  for (const target of ['model', 'encoding']) {
    test(target === 'model'
      ? 'door.md §repair-answer: a Repair changing held bytes waits for every other open surprise on the model'
      : 'door.md §repair-answer: a claim encoding repair proceeds while another claim surprise holds the model', async () => {
      const state = await engineSurprise();
      const secondClaim = 'design/parts/door/claims/second/README.md';
      const secondFolder = 'models/lifecycles-door/parts/door/claims/second';
      const slotBytes = await read(state.dir, ENGINE_SLOT);
      await writeFiles(state.dir, {
        ...await acceptedFiles({ [secondClaim]: await read(state.dir, ENGINE_CLAIM) }),
        [`${secondFolder}/encoding.md`]: slotBytes,
        [`${secondFolder}/receipt`]: receiptText([makeReceipt('encoding.md', slotBytes, {
          session: SLOT_WRITER, authors: [SLOT_WRITER], pins: [
            { entry: 'door/claims/second', pin: engineClaimPin() },
            { entry: 'door/lifecycles/state', pin: engineLifePin },
          ],
        })]),
      });
      const ran = engineRun(state.dir);
      const question = 'lifecycles-door/parts/door/claims/second/base';
      const evidence = await readJSON(state.dir, `models/${question}.json`);
      // evidence.md §stems, §basis determine its name.
      const second = `${question}.surprise-${sha256(`${JSON.stringify(evidence.basis, null, 2)}\n`).slice(0, 12)}`;
      assert.deepEqual(ran.opened, [second]);
      const ruled = await engineRuling(target === 'model' ? 'model wrong' : 'property wrong', state);
      const repair = missing(state.dir).items.find((entry) => entry.item === ruled.repairItem);
      assert.ok(repair);
      if (target === 'encoding') {
        assert.ok(!(repair.waits ?? []).includes(`rule:${second}`));
        const lifeBefore = await read(state.dir, ENGINE_LIFE);
        const encoding = slotBytes.replace('| state | closed |', '| state | open |');
        expectAccepted(await send(state.dir, ruled.repairItem, {
          [ENGINE_SLOT]: encoding,
          'repair.md': '| Field | Value |\n| --- | --- |\n| Mechanism | Corrects this claim\'s forbidden phase. |\n',
        }), ruled.repairItem);
        assert.equal(await read(state.dir, ENGINE_SLOT), encoding);
        assert.equal(await read(state.dir, ENGINE_LIFE), lifeBefore);
        assert.ok(missing(state.dir).items.some((entry) => entry.item === `rule:${second}`));
        assert.ok(!missing(state.dir).items.some((entry) => entry.item === ruled.repairItem));
        return;
      }
      assert.ok(repair.waits.includes(`rule:${second}`));
      const before = await record(state.dir);
      expectCountedRefusal(await send(state.dir, ruled.repairItem, {
        [ENGINE_LIFE]: (await read(state.dir, ENGINE_LIFE)).replace('# Door phase', '# Corrected door'),
        'repair.md': '| Field | Value |\n| --- | --- |\n| Mechanism | Clarifies the door lifecycle. |\n',
      }), ruled.repairItem);
      assert.deepEqual(await record(state.dir), before);
    });
  }
  // door.md §repair-answer; door.md §receipts; design.md §removal; decisions.md
  // decisions.md §expects.
  test('door.md §repair-answer: a repair by removal alone keeps the surviving README hash and records the removed bytes', async () => {
    const pages = { ...await fixtureFiles('restate'), ...await fixtureFiles('removal') };
    const path = 'design/parts/gate/claims/open/README.md';
    // design.md §units, §pins: the claim is its own unit; Parts resolves to
    // the Purpose, and its citation resolves to the passage's canonical hash.
    const pin = sha256('Sentence: The gate stays open.\nKind: safety\nStake: A person cannot pass a closed gate.\n'
      + `Rests on: \nParts: Opens the gate when requested.\nCites: ${sha256('# Gate\n\nThe gate opens when requested.')}`);
    const decline = decision({ kind: 'decline', on: 'gate/claims/open', pin, words: 'Remove the additional restriction.' });
    const decisionPath = `design/parts/gate/claims/open/decisions/${decline.name}.md`;
    const dir = await seeded({ ...await acceptedFiles(pages), [decisionPath]: decline.bytes });
    const item = `repair:${decline.name}`;
    assert.ok(missing(dir).items.some((entry) => entry.item === item));
    const before = await read(dir, PART);
    expectAccepted(await send(dir, item, { 'removed.md': 'design/parts/gate/claims/open\n',
      'repair.md': '| Field | Value |\n| --- | --- |\n| Mechanism | Removes the additional restriction. |\n' }), item);
    assert.equal(await read(dir, PART), before);
    assert.equal(await read(dir, path), null);
    assert.equal(await read(dir, 'design/parts/gate/claims/open/receipt'), null);
    assert.equal(await read(dir, decisionPath), decline.bytes);
    const line = JSON.parse((await read(dir, 'design/parts/gate/receipt')).trim());
    assert.equal(line.sha256, sha256(before));
    assert.deepEqual(line.answers, [decline.name]);
    assert.ok(line.removed.some((file) => file.file === 'claims/open/README.md' && file.before === sha256(pages[path])));
  });
  // door.md §repair-answer; door.md §receipts; decisions.md §decision-file; decisions.md §expects.
  test('door.md §repair-answer: a restatement repair changes the declined unit and records mechanism and before hash', async () => {
    const { dir, decline, item } = await declinedParts();
    assert.ok(missing(dir).items.some((entry) => entry.item === item));
    const before = await read(dir, ROOT);
    const files = { ...await repairedPages(), ...await fixtureFiles('repair') };
    const result = expectAccepted(await send(dir, item, files), item);
    assert.equal(result.kind, 'repair');
    assert.equal(await read(dir, 'repair.md'), null);
    assert.equal(await read(dir, decline.path), decline.bytes);
    const line = JSON.parse((await read(dir, 'design/receipt')).trim());
    assert.deepEqual(Object.keys(line), ['file', 'sha256', 'at', 'session', 'authors', 'answers', 'mechanisms', 'before']);
    assert.deepEqual(line.answers, [decline.name]);
    assert.deepEqual(line.mechanisms, [{ decision: decline.name, mechanism: 'Records that the gate also closes when requested.' }]);
    assert.equal(line.before, sha256(before));
    assert.equal(line.sha256, sha256(files[ROOT]));
    assert.ok(!missing(dir).items.some((entry) => entry.item === item));
  });
  for (const [name, mechanism] of [
    ['absent', null], ['empty', ''], ['missing row', '| Field | Value |\n| --- | --- |\n'],
    ['extra row', '| Field | Value |\n| --- | --- |\n| Mechanism | Changes the gate. |\n| Other | No. |\n'],
    ['duplicate row', '| Field | Value |\n| --- | --- |\n| Mechanism | First. |\n| Mechanism | Second. |\n'],
    ['extra block', '| Field | Value |\n| --- | --- |\n| Mechanism | Changes the gate. |\n\nExtra prose.\n'],
    ['empty cell', '| Field | Value |\n| --- | --- |\n| Mechanism | |\n'],
  ]) {
    // door.md §repair-answer; forms.md §page-rules; door.md §forma-answer.
    test(`door.md §repair-answer: repair.md with ${name} is refused`, async () => {
      const { dir, item } = await declinedParts();
      const before = await record(dir);
      expectCountedRefusal(await send(dir, item, { ...await repairedPages(), 'repair.md': mechanism }), item);
      assert.deepEqual(await record(dir), before);
    });
  }
  for (const mode of ['unchanged bytes', 'heading only']) {
    // door.md §repair-answer; decisions.md §expects; design.md §pins and
    // door.md §forma-answer.
    test(`door.md §repair-answer: a repair changing ${mode} does not meet its decline`, async () => {
      const { dir, item } = await declinedParts();
      let page = await read(dir, ROOT);
      if (mode === 'heading only') page = page.replace('# Gate project', '# A new title');
      const before = await record(dir);
      expectCountedRefusal(await send(dir, item, { [ROOT]: page, ...await fixtureFiles('repair') }), item);
      assert.deepEqual(await record(dir), before);
    });
  }
  // door.md §repair-answer; door.md §receipts; decisions.md §expects.
  test('door.md §repair-answer: another item may meet a repair without a mechanism', async () => {
    const { dir, decline, item } = await declinedParts();
    await writeFiles(dir, { 'design/brief/extra.md': '# Extra\n\nA new passage.\n' });
    const other = 'passage:design/brief/extra.md#extra';
    const before = await read(dir, ROOT);
    const page = (await repairedPages())[ROOT].replace('design/brief/overview.md#gate', 'design/brief/overview.md#gate, design/brief/extra.md#extra');
    expectAccepted(await send(dir, other, { [ROOT]: page }), other);
    const line = JSON.parse((await read(dir, 'design/receipt')).trim());
    assert.deepEqual(line.answers, [decline.name]);
    assert.equal(line.before, sha256(before));
    assert.ok(!Object.hasOwn(line, 'mechanisms'));
    assert.ok(!missing(dir).items.some((entry) => entry.item === item));
  });
  // door.md §repair-answer; door.md §receipts; design.md §removal; decisions.md §decision-file,
  //.
  test('door.md §repair-answer: removal records hashes on a surviving README and preserves decisions', async () => {
    const { dir, decline, item } = await declinedParts();
    const removedBytes = await read(dir, PART);
    const keep = decision({ kind: 'decline', on: 'gate/stated', pin: sha256('historical unit'), words: 'Historical reason.' });
    const keepPath = `design/parts/gate/decisions/${keep.name}.md`;
    await writeFiles(dir, { [keepPath]: keep.bytes });
    const files = { [ROOT]: '# Empty project\n\n| Part | Purpose | Cites |\n| --- | --- | --- |\n',
      'removed.md': 'design/parts/gate\n', ...await fixtureFiles('repair') };
    const result = expectAccepted(await send(dir, item, files), item);
    assert.ok(result.removed.includes(PART));
    assert.equal(await read(dir, PART), null);
    assert.equal(await read(dir, 'design/parts/gate/receipt'), null);
    assert.equal(await read(dir, keepPath), keep.bytes);
    const line = JSON.parse((await read(dir, 'design/receipt')).trim());
    assert.deepEqual(line.answers, [decline.name]);
    assert.ok(line.removed.some((file) => file.file === 'parts/gate/README.md' && file.before === sha256(removedBytes)));
  });
  // door.md §gives; door.md §repair-answer; decisions.md §who-decides.
  test('door.md §repair-answer: Repair packets disclose direction without the developer identity or decision file', async () => {
    const { dir, item } = await declinedParts();
    const packet = await givePacket(dir, item);
    assert.ok(Object.hasOwn(packet.item, 'decision'));
    const encoded = JSON.stringify(packet.item.decision);
    for (const secret of [...Object.values(DEVELOPER), 'Fixture owner']) assert.ok(!encoded.includes(secret));
    for (const value of ['decline', 'parts', partsPin(), 'The gate must also close.', '2024-01-01T00:00:01.000Z']) assert.ok(encoded.includes(value));
    assert.ok(!Object.keys(packet.files).some((path) => path.includes('/decisions/')));
    // door.md §gives: repairs include their target's contracts and decisions.md.
    assert.deepEqual(Object.keys(packet.files).filter((path) => path.startsWith('forma/')), ['forma/account.md', 'forma/decisions.md', 'forma/design.md', 'forma/door.md', 'forma/forms.md', 'forma/lifecycle-tool.md', 'forma/presentation.md']);
  });
});

// decisions.md §rulings, §forma-show, §forma-decide: one command may rule several waiting decisions.
// decisions.md §decision-file: derive its name independently from its bytes and recorded At.
async function ruleTogether(dir, surprises, verdict) {
  const on = surprises.join(',');
  const shown = forma(dir, ['show', 'rule', on, '--json']);
  assert.equal(shown.status, 0, shown.stderr || shown.stdout);
  const result = forma(dir, ['decide', 'rule', on, '--shown', shown.json.token,
    '--verdict', verdict, '--level', 'specification', '--words', 'Revise the door restriction.',
    '--by', 'Fixture owner', '--provider', DEVELOPER.provider, '--model', DEVELOPER.model,
    '--session', DEVELOPER.session, '--json']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.json.recorded.length, 1);
  const path = result.json.recorded[0];
  const bytes = await read(dir, path);
  const at = bytes.split('\n').filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    .find(([field]) => field === 'At')?.[1];
  assert.match(at, TIME);
  const name = `${at.slice(0, 19).replace(/[-:]/g, '')}Z-rule-${sha256(bytes).slice(0, 12)}`;
  assert.equal(path.split('/').at(-1), `${name}.md`);
  return { path, bytes, name };
}

// presentation.md §reading fixes lifecycle.journeys entries' ref, without fixing the
// representation of the moves each entry lights.
function lifecycleJourneyRefs(dir) {
  const result = forma(dir, ['account', '--json']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.json.parts.flatMap((part) => part.lifecycles.flatMap((life) =>
    life.journeys.map((journey) => journey.ref)));
}

describe('door.md §repair-answer, §read-checks — kept lifecycle journeys and merged rulings', () => {
  // decisions.md §expects: declining a kept journey is met immediately; the
  // journey stays, declined, and its ruling stays. evidence.md §questions asks only
  // confirmed journeys, so a declined kept journey has no run.
  test('door.md §repair-answer: declining a kept journey keeps its subject and ruling without repair work', async () => {
    const state = await engineRuling();
    const ref = `door/journeys/kept-${state.surprise.slice(-12)}`;
    const rulingPath = (await tree(state.dir)).find((path) => path.endsWith(`/${state.decisionName}.md`));
    const rulingBytes = await read(state.dir, rulingPath);
    const shown = forma(state.dir, ['show', 'decline', ref, '--json']);
    assert.equal(shown.status, 0, shown.stderr || shown.stdout);
    const result = forma(state.dir, ['decide', 'decline', ref, '--shown', shown.json.token,
      '--words', 'This trace is not a requirement.', '--by', 'Fixture owner',
      '--provider', DEVELOPER.provider, '--model', DEVELOPER.model,
      '--session', DEVELOPER.session, '--json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    // decisions.md §decision-file, §forma-decide: a decline records one decision; the response path
    // gives its immutable name (the surrounding fixture checks ruling names).
    assert.equal(result.json.recorded.length, 1);
    const name = result.json.recorded[0].split('/').at(-1).slice(0, -3);
    assert.ok(!missing(state.dir).items.some((item) => item.item === `repair:${name}`));
    assert.ok(!engineRun(state.dir).ran.some((run) => run.name.startsWith(`lifecycles-door/parts/${ref}/`)));
    // decisions.md §forma-show refuses subjects that do not stand: a fresh showing
    // remains available because decisions.md §expects keeps the journey instead of removing it.
    const stillThere = forma(state.dir, ['show', 'decline', ref, '--json']);
    assert.equal(stillThere.status, 0, stillThere.stderr || stillThere.stdout);
    assert.equal(await read(state.dir, rulingPath), rulingBytes);
  });

  // decisions.md §kept-journeys: a lifecycle trace uses its part's action names, keeps
  // its last step as refused, and is confirmed by its model-wrong ruling.
  // design.md §pins supplies this independently computed journey pin.
  test('door.md §repair-answer: a model-wrong ruling keeps a lifecycle trace as a confirmed must-not journey', async () => {
    const state = await engineRuling();
    const ref = `door/journeys/kept-${state.surprise.slice(-12)}`;
    const files = await snapshot(state.dir);
    const [[path, bytes]] = Object.entries(files).filter(([path]) => path.endsWith(`/${state.decisionName}.md`));
    const kept = bytes.split(`### ${state.surprise}\n`).at(-1);
    const pin = sha256(['Polarity: must not', 'Expected end: -', 'Refused step: 1',
      `Cites: ${enginePassage}`, 'Step 1: Door controller | Closes the door. | - | - | -'].join('\n'));
    const rows = kept.split('\n').filter((line) => line.startsWith('|'))
      .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
    for (const row of [['Journey', ref], ['Pin', pin], ['Polarity', 'must not'],
      ['Refused step', '1'], ['Expected end', '-'], ['Origin', 'added'],
      ['Cites', 'design/brief/overview.md#door'], ['1', 'Door controller', 'close', '-', '-', '-']]) {
      assert.ok(rows.some((actual) => JSON.stringify(actual) === JSON.stringify(row)), `the kept tables include ${row}`);
    }
    assert.ok(lifecycleJourneyRefs(state.dir).includes(ref));
    assert.ok(!missing(state.dir).items.some((item) => item.item === `confirm:${ref}`));
    // design.md §code-journeys and door.md §read-checks: code reads this journey from the ruling,
    // never a page, and the ruling remains a valid decision on every read.
    assert.equal(await read(state.dir, `design/parts/${ref}/README.md`), null);
    assert.ok(!changes(missing(state.dir)).some((item) => item.item === `change:${path}`));
  });

  // decisions.md §rulings, §kept-journeys, §in-force: a merged later ruling supersedes an earlier one
  // only for the surprises it names; each kept journey follows its own surprise.
  test('door.md §read-checks: a later ruling of one surprise removes only that surprise\'s kept journey', async () => {
    const state = await engineSurprise();
    const secondClaim = 'design/parts/door/claims/second/README.md';
    const folder = 'models/lifecycles-door/parts/door/claims/second';
    const encoding = await read(state.dir, ENGINE_SLOT);
    await writeFiles(state.dir, {
      ...await acceptedFiles({ [secondClaim]: await read(state.dir, ENGINE_CLAIM) }),
      [`${folder}/encoding.md`]: encoding,
      [`${folder}/receipt`]: receiptText([makeReceipt('encoding.md', encoding, {
        session: SLOT_WRITER, authors: [SLOT_WRITER], pins: [
          { entry: 'door/claims/second', pin: engineClaimPin() },
          { entry: 'door/lifecycles/state', pin: engineLifePin },
        ],
      })]),
    });
    engineRun(state.dir);
    const question = 'lifecycles-door/parts/door/claims/second/base';
    const evidence = await readJSON(state.dir, `models/${question}.json`);
    // evidence.md §stems, §basis: the surprise's suffix hashes the canonical basis.
    const second = `${question}.surprise-${sha256(`${JSON.stringify(evidence.basis, null, 2)}\n`).slice(0, 12)}`;
    for (const [surprise, questionName] of [[state.surprise, ENGINE_BASE], [second, question]]) {
      const explanation = engineExplanation(surprise);
      explanation['explain.md'] = explanation['explain.md'].replace(ENGINE_BASE, questionName);
      expectAccepted(await send(state.dir, `explain:${surprise}`, explanation, EXPLAINER), `explain:${surprise}`);
    }
    const earlierClone = await snapshot(state.dir);
    const original = await ruleTogether(state.dir, [state.surprise, second], 'model wrong');
    const firstRef = `door/journeys/kept-${state.surprise.slice(-12)}`;
    const secondRef = `door/journeys/kept-${second.slice(-12)}`;
    assert.ok(lifecycleJourneyRefs(state.dir).includes(firstRef));
    assert.ok(lifecycleJourneyRefs(state.dir).includes(secondRef));
    const clone = await project(null, earlierClone);
    const later = await ruleTogether(clone, [state.surprise], 'property wrong');
    await writeFiles(state.dir, { [later.path]: later.bytes });
    const refs = lifecycleJourneyRefs(state.dir);
    assert.ok(!refs.includes(firstRef));
    assert.ok(refs.includes(secondRef));
    // door.md §read-checks, §copies: a whole decision from a clone is read without a
    // receipt; decisions.md §decision-file keeps both historical decision files intact.
    assert.equal(await read(state.dir, original.path), original.bytes);
    assert.equal(await read(state.dir, later.path), later.bytes);
    assert.ok(!changes(missing(state.dir)).some((item) =>
      item.item === `change:${original.path}` || item.item === `change:${later.path}`));
  });
});

// The engine fixtures are hand-written. These pins follow design.md §passages
// and design.md §pins: block hashes for the sole cited
// passage, then the entry's canonical
// fields, resolved references, and sorted lifecycle cells, with no final LF.
const ENGINE_CLAIM = 'design/parts/door/claims/open/README.md';
const ENGINE_LIFE = 'design/parts/door/lifecycles/state/README.md';
const ENGINE_SLOT = 'models/lifecycles-door/parts/door/claims/open/encoding.md';
const ENGINE_RECEIPT = 'models/lifecycles-door/parts/door/claims/open/receipt';
const ENGINE_ITEM = 'slot:lifecycles-door/parts/door/claims/open/encoding';
const ENGINE_BASE = 'lifecycles-door/parts/door/claims/open/base';
const ENGINE_PATH = 'lifecycles-door/parts/door/journeys/close/lifecycle-path';
const SLOT_WRITER = { provider: 'slot-provider', model: 'slot-model', session: 'slot-writer' };
const EXPLAINER = { provider: 'reader-provider', model: 'reader-model', session: 'reader' };
const enginePassage = sha256('# Door\n\nAn operator closes an open door. A closed door cannot close again. The door should stay open.');
const enginePartsPin = sha256(`Purpose: Controls a door.\nCites: ${enginePassage}`);
const engineClaimPin = (sentence = 'The door stays open.') => sha256([
  `Sentence: ${sentence}`, 'Kind: safety', 'Stake: A person cannot pass through a closed door.',
  'Rests on: ', 'Parts: Controls a door.', `Cites: ${enginePassage}`,
].join('\n'));
const engineLifePin = sha256([
  'Entity: Door (entity, machine, -, -)', 'Initial: open', 'Ends: closed', 'Unaffected: ',
  `Cites: ${enginePassage}`, 'Cell: closed | Closes the door. | None.',
  'Cell: open | Closes the door. | closed',
].join('\n'));
const engineJourneyPin = sha256([
  'Polarity: should happen', 'Expected end: The door is closed.', 'Refused step: -',
  `Cites: ${enginePassage}`, 'Step 1: Door controller | Closes the door. | none | - | -',
].join('\n'));
const enginePins = (claim = engineClaimPin()) => [
  { entry: 'door/claims/open', pin: claim }, { entry: 'door/lifecycles/state', pin: engineLifePin },
];

async function engineProject({ encoding = false, witness = false, runs = 30,
  slotSession = SLOT_WRITER, claimSentence = 'The door stays open.' } = {}) {
  const pages = await fixtureFiles('engine-lifecycle');
  pages[ENGINE_CLAIM] = pages[ENGINE_CLAIM].replace('The door stays open.', claimSentence);
  const files = await acceptedFiles(pages);
  const confirmations = [
    ['parts', enginePartsPin, 'design'],
    ['door/lifecycles/state', engineLifePin, 'design/parts/door/lifecycles/state'],
    ['door/journeys/close', engineJourneyPin, 'design/parts/door/journeys/close'],
  ];
  for (const [index, [on, pin, folder]] of confirmations.entries()) {
    const confirmed = decision({ kind: 'confirm', on, pin, at: `2024-01-01T00:00:0${index + 1}.000Z` });
    files[`${folder}/decisions/${confirmed.name}.md`] = confirmed.bytes;
  }
  const slots = {
    ...(encoding ? await fixtureFiles('engine-encoding') : {}),
    ...(witness ? await fixtureFiles('engine-witness') : {}),
  };
  if (Object.keys(slots).length) {
    Object.assign(files, slots, { 'models/.gitattributes': MODEL_ATTRIBUTES });
    files[ENGINE_RECEIPT] = receiptText(Object.entries(slots).map(([path, bytes]) =>
      makeReceipt(path.split('/').at(-1), bytes, {
        session: slotSession, authors: [slotSession], pins: enginePins(),
      })));
  }
  return seeded(files, { runs });
}

// evidence.md §forma-run: run JSON keys and successful exit status.
function engineRun(dir) {
  const result = forma(dir, ['run', '--json']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  expectKeys(result.json, ['ran', 'opened', 'removed', 'skipped', 'runs']);
  return result.json;
}
async function engineSurprise(options = {}) {
  const dir = await engineProject({ encoding: true, ...options });
  const ran = engineRun(dir);
  assert.ok(ran.ran.some((run) => run.name === ENGINE_PATH));
  assert.ok(ran.ran.some((run) => run.name === ENGINE_BASE));
  // evidence.md §questions; evidence.md §surprise-file: this journey
  // admits close; only the claim's forbidden closed phase opens a surprise.
  // evidence.md §stems, §basis:
  // the surprise suffix is a digest of the canonical
  // basis, not a name copied from Forma's opened list.
  const base = await readJSON(dir, `models/${ENGINE_BASE}.json`);
  const basisDigest = sha256(`${JSON.stringify(base.basis, null, 2)}\n`);
  const surprise = `${ENGINE_BASE}.surprise-${basisDigest.slice(0, 12)}`;
  assert.deepEqual(ran.opened, [surprise]);
  const evidence = await readJSON(dir, `models/${surprise}.json`);
  assert.equal(evidence.name, surprise);
  return { dir, surprise, evidence, item: `explain:${surprise}` };
}
function engineExplanation(surprise) {
  return { 'explain.md': '| Field | Value |\n| --- | --- |\n'
    + `| Question | ${ENGINE_BASE} |\n| Basis | ${surprise.slice(-12)} |\n`
    + '| Verdict | model wrong |\n| Level | specification |\n| Weaker | none |\n'
    + '\n## Trace\n\nThe operator closes the door.\n'
    + '\n## Failure shape\n\nA person cannot pass through the closed door.\n'
    + '\n## Mechanism\n\nThe lifecycle admits closing from the open phase.\n' };
}
// door.md §receipts: an accepted file has its receipt.
function engineReceipt(bytes) {
  assert.ok(bytes);
  return bytes.trimEnd().split('\n').map((line) => JSON.parse(line));
}
// evidence.md §own-check: recompute the digest of deliberate evidence edits,
// with digest empty, two-space JSON and a final LF; no implementation hash is
// used as the expected value for a hand-written or edited fixture.
function engineEvidenceBytes(evidence) {
  const value = { ...evidence, digest: '' };
  value.digest = sha256(`${JSON.stringify(value, null, 2)}\n`);
  return `${JSON.stringify(value, null, 2)}\n`;
}
async function engineRuling(verdict = 'model wrong', initialState) {
  // decisions.md §forma-show, §forma-decide: showing token,
  // one ruling file, and successful decision; decisions.md §decision-file: its name/time.
  const state = initialState ?? await engineSurprise();
  expectAccepted(await send(state.dir, state.item, engineExplanation(state.surprise), EXPLAINER), state.item);
  const shown = forma(state.dir, ['show', 'rule', state.surprise, '--json']);
  assert.equal(shown.status, 0, shown.stderr || shown.stdout);
  assert.equal(typeof shown.json?.token, 'string');
  const before = new Set(await tree(state.dir));
  const args = ['decide', 'rule', state.surprise, '--shown', shown.json.token,
    '--verdict', verdict, '--level', 'specification', '--words', 'Correct the door model.',
    '--by', 'Fixture owner', '--provider', DEVELOPER.provider, '--model', DEVELOPER.model,
    '--session', DEVELOPER.session, '--json'];
  if (verdict === 'real finding') args.push('--target', 'lifecycles-door');
  const ruled = forma(state.dir, args);
  assert.equal(ruled.status, 0, ruled.stderr || ruled.stdout);
  const paths = (await tree(state.dir)).filter((path) => !before.has(path) && path.includes('/decisions/') && path.endsWith('.md'));
  assert.equal(paths.length, 1);
  // decisions.md §decision-file: independently derive the name from At, kind and
  // exact bytes before using it as the expected repair identity.
  const bytes = await read(state.dir, paths[0]);
  const at = bytes.match(/^\| At \| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \|$/m)?.[1];
  assert.ok(at);
  const name = `${at.slice(0, 19).replace(/[-:]/g, '')}Z-rule-${sha256(bytes).slice(0, 12)}`;
  assert.equal(paths[0].split('/').at(-1), `${name}.md`);
  const repair = missing(state.dir).items.filter((item) => item.item.startsWith(`repair:${name}`));
  // account.md §items: even a one-model repair has its model suffix.
  assert.deepEqual(repair.map((item) => item.item), [`repair:${name}/lifecycles-door`]);
  return { ...state, decisionName: name, repairItem: `repair:${name}/lifecycles-door` };
}

const ENGINE_MENU = ['drop', 'duplicate', 'delay', 'reorder', 'fail-forever', 'fail-then-succeed', 'crash', 'go-silent'];
// decisions.md §carry: a strike's pin, independent of execution.
const engineStrikePin = (item) => sha256(`Strike: ${item} at Door controller`);
async function engineStruckProject() {
  const original = await engineProject();
  const files = await snapshot(original);
  const boundary = 'design/parts/door/boundary.md';
  files[boundary] = files[boundary].replace('| service | machine | - |', '| service | world | request-response |');
  const strikes = ENGINE_MENU.map((item) => `strike:door/operator/${item}`);
  for (const [index, item] of ENGINE_MENU.entries()) {
    const carry = decision({ kind: 'carry', on: strikes[index], pin: engineStrikePin(item),
      rows: [['Choice', 'carry'], ['Basis', '-']], words: `An observed ${item} at Door controller.`,
      at: `2024-01-01T00:00:${String(10 + index).padStart(2, '0')}.000Z`,
    });
    files[`design/parts/door/decisions/${carry.name}.md`] = carry.bytes;
  }
  return { dir: await project(null, await acceptedFiles(files)), strikes: byteOrder(strikes) };
}
async function engineWithdrawStrike(dir, item = 'drop') {
  const withdrawal = decision({ kind: 'carry', on: `strike:door/operator/${item}`, pin: engineStrikePin(item),
    rows: [['Choice', 'withdraw'], ['Basis', '-']], at: '2024-01-01T00:00:20.000Z',
  });
  await writeFiles(dir, { [`design/parts/door/decisions/${withdrawal.name}.md`]: withdrawal.bytes });
}

describe('door.md §gives — model, slot and Explain packets', () => {
  // door.md §gives; decisions.md §in-force.
  test('door.md §gives: a not-yet-written model receives every page of its named parts', async () => {
    const dir = await engineProject();
    const packet = await givePacket(dir, 'cover:door');
    const pages = await fixtureFiles('engine-lifecycle');
    const wanted = Object.keys(pages).filter((path) => !path.startsWith('design/brief/'));
    assert.deepEqual(Object.keys(packet.files).filter((path) => path.startsWith('design/')), byteOrder(wanted));
    for (const path of wanted) assert.equal(packet.files[path], pages[path]);
    assert.deepEqual(Object.keys(packet.files).filter((path) => path.startsWith('forma/')),
      ['forma/account.md', 'forma/design.md', 'forma/door.md', 'forma/engines.md', 'forma/evidence.md', 'forma/forms.md', 'forma/models.md', 'forma/presentation.md']);
    assert.ok(!Object.keys(packet.files).some((path) => path.includes('/decisions/') || path.endsWith('/receipt')));
    // door.md §gives fixes names and pins, without fixing the container
    // representation of confirmed. Check those values without choosing one.
    const confirmed = JSON.stringify(packet.item.confirmed);
    for (const value of ['parts', enginePartsPin, 'door/lifecycles/state', engineLifePin,
      'door/journeys/close', engineJourneyPin]) assert.ok(confirmed.includes(value));
  });
  // door.md §gives; models.md §lifecycle-model.
  test('door.md §gives: a lifecycle slot receives its claim, actions, boundary and lifecycles', async () => {
    const dir = await engineProject();
    const packet = await givePacket(dir, ENGINE_ITEM);
    const wanted = byteOrder([ENGINE_CLAIM, ENGINE_LIFE, 'design/parts/door/actions.md', 'design/parts/door/boundary.md']);
    assert.deepEqual(Object.keys(packet.files).filter((path) => path.startsWith('design/')), wanted);
    for (const path of wanted) assert.equal(packet.files[path], await read(dir, path));
    assert.ok(!Object.keys(packet.files).some((path) => path.startsWith('models/')));
    assert.deepEqual(Object.keys(packet.files).filter((path) => path.startsWith('forma/')),
      ['forma/account.md', 'forma/design.md', 'forma/door.md', 'forma/engines.md', 'forma/evidence.md', 'forma/forms.md', 'forma/models.md', 'forma/presentation.md']);
    expectKeys(packet.item, ['item', 'confirmed', 'picks', 'struck', 'refused']);
    assert.deepEqual(packet.item.item, missing(dir).items.find((item) => item.item === ENGINE_ITEM));
  });
  // door.md §gives; models.md §slot-currency; account.md §items.
  test('door.md §gives: a slot packet includes other accepted slots and its own owed-again bytes', async () => {
    const dir = await engineProject({ encoding: true, witness: true, claimSentence: 'The door always stays open.' });
    const packet = await givePacket(dir, ENGINE_ITEM);
    for (const [path, bytes] of Object.entries({ ...await fixtureFiles('engine-encoding'), ...await fixtureFiles('engine-witness') })) {
      assert.equal(packet.files[path], bytes);
    }
    assert.equal(packet.files[ENGINE_RECEIPT], undefined);
    assert.equal(packet.item.item.why, 'owed-again');
  });
  // door.md §gives; evidence.md §runs.
  test('door.md §gives: an Explain packet contains the surprise, basis inputs and run output but no private record', async () => {
    const { dir, item, surprise, evidence } = await engineSurprise();
    const packet = await givePacket(dir, item);
    assert.equal(packet.files[`models/${surprise}.json`], await read(dir, `models/${surprise}.json`));
    for (const input of evidence.basis.files.filter((file) => Object.hasOwn(file, 'path'))) {
      assert.equal(packet.files[input.path], await read(dir, input.path));
    }
    // door.md §gives: entries' cited brief documents accompany Explain inputs.
    assert.equal(packet.files['design/brief/overview.md'], await read(dir, 'design/brief/overview.md'));
    const runFiles = (await tree(dir)).filter((path) => path.startsWith(`runs/${ENGINE_BASE}/`));
    assert.ok(runFiles.length > 0);
    for (const path of runFiles) assert.equal(packet.files[path], await read(dir, path));
    assert.deepEqual(Object.keys(packet.files).filter((path) => path.startsWith('forma/')),
      ['forma/account.md', 'forma/decisions.md', 'forma/design.md', 'forma/door.md', 'forma/engines.md', 'forma/evidence.md', 'forma/forms.md', 'forma/lifecycle-tool.md', 'forma/models.md', 'forma/presentation.md']);
    assert.ok(Object.keys(packet.files).every((path) => !path.startsWith('work/')
      && !path.includes('/decisions/') && !path.endsWith('/receipt')));
    expectKeys(packet.item, ['item', 'confirmed', 'picks', 'struck', 'refused', 'differ']);
    assert.deepEqual(packet.item.differ, []);
    assert.deepEqual(packet.result.differ, []);
  });
  // door.md §gives; door.md §spent; evidence.md §rerun.
  test('door.md §gives: an Explain give regenerates absent runs without spending or changing tracked files', async () => {
    const original = await engineSurprise();
    const files = await snapshot(original.dir, { skip: ['runs'] });
    files['work/spent.json'] = JSON.stringify({ answers: 30, runs: 30 });
    const dir = await project(null, files);
    const before = await record(dir);
    const spent = await read(dir, 'work/spent.json');
    const packet = await givePacket(dir, original.item);
    assert.ok((await tree(dir)).some((path) => path.startsWith(`runs/${ENGINE_BASE}/`)));
    assert.ok(Object.keys(packet.files).some((path) => path.startsWith(`runs/${ENGINE_BASE}/`)));
    assert.deepEqual(await record(dir), before);
    assert.equal(await read(dir, 'work/spent.json'), spent);
    assert.deepEqual(packet.result.differ, []);
  });
  // door.md §gives; forms.md §menu; decisions.md §carry.
  test('door.md §gives: an existing model packet includes model files and the current strikes', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const { dir, strikes } = await engineStruckProject();
    const model = await fixtureFiles('engine-tlc');
    expectAccepted(await send(dir, 'cover:door', model), 'cover:door');
    await engineWithdrawStrike(dir);
    const packet = await givePacket(dir, 'model:door-model');
    for (const [path, bytes] of Object.entries(model)) assert.equal(packet.files[path], bytes);
    const renderedStrikes = JSON.stringify(packet.item.struck);
    for (const name of strikes.filter((strike) => !strike.endsWith('/drop'))) assert.ok(renderedStrikes.includes(name));
    assert.ok(!renderedStrikes.includes('strike:door/operator/drop'));
    assert.equal(packet.files['models/door-model/receipt'], undefined);
  });
  // door.md §gives; door.md §repair-answer.
  test('door.md §gives: a model Repair packet includes accepted slots of the ruled claim', async () => {
    const { dir, repairItem } = await engineRuling();
    const packet = await givePacket(dir, repairItem);
    assert.equal(packet.files[ENGINE_SLOT], await read(dir, ENGINE_SLOT));
    assert.equal(packet.files[ENGINE_LIFE], await read(dir, ENGINE_LIFE));
    assert.deepEqual(Object.keys(packet.files).filter((path) => path.startsWith('forma/')),
      ['forma/account.md', 'forma/decisions.md', 'forma/design.md', 'forma/door.md', 'forma/engines.md', 'forma/evidence.md', 'forma/forms.md', 'forma/models.md', 'forma/presentation.md']);
    assert.ok(Object.hasOwn(packet.item, 'decision'));
    const direction = JSON.stringify(packet.item.decision);
    assert.ok(direction.includes('Correct the door model.'));
    for (const secret of [...Object.values(DEVELOPER), 'Fixture owner']) assert.ok(!direction.includes(secret));
    assert.ok(!Object.keys(packet.files).some((path) => path.endsWith('/receipt') || path.includes('/decisions/')));
  });
});

describe('door.md §answer-holds — engine answer forms', () => {
  // door.md §answer-holds; door.md §forma-answer.
  test('door.md §answer-holds: a slot answer contains exactly one slot file', async () => {
    const dir = await engineProject();
    const before = await record(dir);
    const files = { ...await fixtureFiles('engine-encoding'), ...await fixtureFiles('engine-witness') };
    expectCountedRefusal(await send(dir, ENGINE_ITEM, files, SLOT_WRITER), ENGINE_ITEM);
    assert.deepEqual(await record(dir), before);
  });
  // door.md §answer-holds; door.md §forma-answer; evidence.md §explain;
  // evidence.md §surprise-file.
  test('door.md §answer-holds: a lifecycle Explain answer is relocated beside its surprise', async () => {
    const { dir, surprise, item } = await engineSurprise();
    const files = engineExplanation(surprise);
    const answer = expectAccepted(await send(dir, item, files, EXPLAINER), item);
    assert.equal(answer.kind, 'explain');
    const path = `models/${surprise}.explained.md`;
    assert.equal(await read(dir, path), files['explain.md']);
    assert.equal(await read(dir, 'explain.md'), null);
    assert.ok(answer.written.some((written) => written.path === path && written.sha256 === sha256(files['explain.md'])));
    assert.ok(!missing(dir).items.some((entry) => entry.item === item));
  });
  // door.md §answer-holds; door.md §forma-answer; door.md §receipts.
  test('door.md §answer-holds: a Model answer removes engine files it omits', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const dir = await engineProject();
    const files = await fixtureFiles('engine-tlc');
    expectAccepted(await send(dir, 'cover:door', { ...files,
      'models/door-model/Unused.tla': '---- MODULE Unused ----\nUnusedValue == TRUE\n====\n' }), 'cover:door');
    await writeFiles(dir, { 'models/door-model/model.md': `${files['models/door-model/model.md']}\nHand edit\n` });
    const item = 'change:models/door-model/model.md';
    const result = expectAccepted(await send(dir, item, files), item);
    assert.ok(result.removed.includes('models/door-model/Unused.tla'));
    assert.equal(await read(dir, 'models/door-model/Unused.tla'), null);
    assert.deepEqual(engineReceipt(await read(dir, 'models/door-model/receipt')).map((line) => line.file), ['Door.tla', 'model.md']);
  });
});

describe('door.md §repair-answer — repairs of lifecycle models', () => {
  // door.md §repair-answer; door.md §receipts; models.md §model-repair; design.md
  // design.md §repairs-redirects.
  test('door.md §repair-answer: a lifecycle model repair routes a lifecycle page through Restate checks', async () => {
    const { dir, repairItem, decisionName } = await engineRuling();
    const before = await read(dir, ENGINE_LIFE);
    const page = before.replace('# Door phase', '# Door lifecycle');
    const mechanism = 'Names the door lifecycle clearly.';
    expectAccepted(await send(dir, repairItem, {
      [ENGINE_LIFE]: page, 'repair.md': `| Field | Value |\n| --- | --- |\n| Mechanism | ${mechanism} |\n`,
    }), repairItem);
    const line = engineReceipt(await read(dir, 'design/parts/door/lifecycles/state/receipt'))[0];
    assert.deepEqual(line.answers, [decisionName]);
    assert.equal(line.before, sha256(before));
    assert.deepEqual(line.mechanisms, [{ decision: decisionName, mechanism: mechanism }]);
    assert.equal(await read(dir, 'repair.md'), null);
  });
  // models.md §model-repair; door.md §forma-answer.
  test('door.md §repair-answer: a model-wrong lifecycle repair cannot rewrite the ruled claim encoding', async () => {
    const { dir, repairItem } = await engineRuling();
    const before = await record(dir);
    expectCountedRefusal(await send(dir, repairItem, {
      [ENGINE_SLOT]: '| Lifecycle | Phase |\n| --- | --- |\n| state | open |\n',
      'repair.md': '| Field | Value |\n| --- | --- |\n| Mechanism | Reverses the forbidden phase. |\n',
    }), repairItem);
    assert.deepEqual(await record(dir), before);
  });
  // door.md §repair-answer; door.md §receipts; models.md §model-repair; models.md §slot-currency.
  test('door.md §repair-answer: a real-finding lifecycle repair changes a read lifecycle and adds its matching planted fault', async () => {
    const { dir, repairItem, decisionName } = await engineRuling('real finding');
    const fault = await fixtureFiles('engine-fault');
    const mechanism = 'Refusing a second close on a closed door.';
    expectAccepted(await send(dir, repairItem, { ...fault,
      [ENGINE_LIFE]: (await read(dir, ENGINE_LIFE)).replace('# Door phase', '# Revised door phase'),
      'repair.md': `| Field | Value |\n| --- | --- |\n| Mechanism | ${mechanism} |\n`,
    }), repairItem);
    const line = engineReceipt(await read(dir, ENGINE_RECEIPT)).find((entry) => entry.file === 'fault-close.md');
    assert.ok(line);
    assert.equal(line.before, null);
    assert.deepEqual(line.answers, [decisionName]);
    assert.deepEqual(line.mechanisms, [{ decision: decisionName, mechanism: mechanism }]);
    assert.deepEqual(line.pins, enginePins());
  });
  // models.md §model-repair; door.md §forma-answer.
  test('door.md §repair-answer: a real-finding lifecycle repair refuses a fault naming another mechanism', async () => {
    const { dir, repairItem } = await engineRuling('real finding');
    const before = await record(dir);
    expectCountedRefusal(await send(dir, repairItem, { ...await fixtureFiles('engine-fault'),
      [ENGINE_LIFE]: (await read(dir, ENGINE_LIFE)).replace('# Door phase', '# Revised door phase'),
      'repair.md': '| Field | Value |\n| --- | --- |\n| Mechanism | A different mechanism. |\n',
    }), repairItem);
    assert.deepEqual(await record(dir), before);
  });
});

describe('door.md §receipts — slot pins and model authors', () => {
  // door.md §receipts; door.md §clock; models.md §lifecycle-model; models.md §slot-currency,
  //.
  test('door.md §receipts: slot receipts record exact claim and lifecycle pins in entry order', async () => {
    const dir = await engineProject();
    const files = await fixtureFiles('engine-encoding');
    expectAccepted(await send(dir, ENGINE_ITEM, files, SLOT_WRITER), ENGINE_ITEM);
    const bytes = await read(dir, ENGINE_RECEIPT);
    const [line] = engineReceipt(bytes);
    assert.deepEqual(Object.keys(line), ['file', 'sha256', 'at', 'session', 'authors', 'pins']);
    assert.equal(line.file, 'encoding.md');
    assert.equal(line.sha256, sha256(files[ENGINE_SLOT]));
    assert.match(line.at, TIME);
    assert.deepEqual(line.session, SLOT_WRITER);
    assert.deepEqual(line.authors, [SLOT_WRITER]);
    assert.deepEqual(line.pins, enginePins());
    assert.equal(bytes, `${JSON.stringify(line)}\n`);
    assert.equal(await read(dir, 'models/lifecycles-door/receipt'), null);
  });
  // door.md §receipts; models.md §slot-currency; door.md §read-checks;
  // account.md §items.
  test('door.md §receipts: changed entry pins owe an unchanged slot again and the same answer refreshes pins', async () => {
    const sentence = 'The door always stays open.';
    const dir = await engineProject({ encoding: true, claimSentence: sentence });
    const item = missing(dir).items.find((entry) => entry.item === ENGINE_ITEM);
    assert.equal(item?.why, 'owed-again');
    assert.ok(!changes(missing(dir)).some((entry) => entry.item === `change:${ENGINE_SLOT}`));
    const before = await read(dir, ENGINE_SLOT);
    expectAccepted(await send(dir, ENGINE_ITEM, { [ENGINE_SLOT]: before }, SLOT_WRITER), ENGINE_ITEM);
    assert.equal(await read(dir, ENGINE_SLOT), before);
    const [line] = engineReceipt(await read(dir, ENGINE_RECEIPT));
    assert.deepEqual(line.pins, enginePins(engineClaimPin(sentence)));
    assert.ok(!missing(dir).items.some((entry) => entry.item === ENGINE_ITEM));
  });
  // door.md §forma-answer; door.md §receipts.
  test('door.md §receipts: a lifecycle author cannot explain its surprise', async () => {
    const { dir, surprise, item } = await engineSurprise();
    const before = await record(dir);
    expectCountedRefusal(await send(dir, item, engineExplanation(surprise), WRITER), item);
    assert.deepEqual(await record(dir), before);
  });
  // door.md §receipts; evidence.md §explain.
  test('door.md §receipts: a session that wrote only slots may explain the model surprise', async () => {
    const { dir, surprise, item } = await engineSurprise();
    expectAccepted(await send(dir, item, engineExplanation(surprise), SLOT_WRITER), item);
    const lines = engineReceipt(await read(dir, ENGINE_RECEIPT));
    const explained = lines.find((line) => line.file === `${surprise.split('/').at(-1)}.explained.md`);
    assert.deepEqual(explained?.session, SLOT_WRITER);
    assert.deepEqual(explained.authors, [SLOT_WRITER]);
  });
  // door.md §receipts; forms.md §menu.
  test('door.md §receipts: a TLC model receipt records model authors and the empty strike set', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const dir = await engineProject();
    const files = await fixtureFiles('engine-tlc');
    expectAccepted(await send(dir, 'cover:door', files, SLOT_WRITER), 'cover:door');
    const lines = engineReceipt(await read(dir, 'models/door-model/receipt'));
    assert.deepEqual(lines.map((line) => line.file), ['Door.tla', 'model.md']);
    for (const line of lines) {
      assert.equal(line.sha256, sha256(files[`models/door-model/${line.file}`]));
      assert.deepEqual(line.session, SLOT_WRITER);
      assert.deepEqual(line.authors, [SLOT_WRITER]);
    }
    assert.deepEqual(lines.find((line) => line.file === 'model.md').strikes, []);
    assert.ok(!Object.hasOwn(lines.find((line) => line.file === 'Door.tla'), 'strikes'));
  });
  // door.md §receipts; forms.md §menu; decisions.md §carry.
  test('door.md §receipts: a model records every strike in force in byte order', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const { dir, strikes } = await engineStruckProject();
    expectAccepted(await send(dir, 'cover:door', await fixtureFiles('engine-tlc')), 'cover:door');
    const line = engineReceipt(await read(dir, 'models/door-model/receipt')).find((entry) => entry.file === 'model.md');
    assert.deepEqual(line.strikes, strikes);
  });
  // forms.md §menu; models.md §parts-change; door.md §read-checks.
  test('door.md §receipts: withdrawing a strike recorded on a TLC model owes a new Model answer', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const { dir } = await engineStruckProject();
    expectAccepted(await send(dir, 'cover:door', await fixtureFiles('engine-tlc')), 'cover:door');
    const before = await read(dir, 'models/door-model/model.md');
    await engineWithdrawStrike(dir);
    const items = missing(dir).items;
    assert.ok(items.some((item) => item.item === 'model:door-model'));
    assert.ok(!items.some((item) => item.item === 'change:models/door-model/model.md'));
    assert.equal(await read(dir, 'models/door-model/model.md'), before);
  });
});

describe('door.md §spent — engine runs and machine allowance', () => {
  // door.md §spent; door.md §scratch; evidence.md §questions; evidence.md §forma-run;
  // account.md §items.
  test('door.md §spent: each lifecycle run spends once and stops when the run allowance is exhausted', async () => {
    const dir = await engineProject({ encoding: true, runs: 1 });
    const result = engineRun(dir);
    assert.deepEqual(result.ran.map((run) => run.name), [ENGINE_PATH]);
    assert.equal(result.ran[0].spent, true);
    assert.deepEqual(result.runs, { spent: 1, left: 0 });
    assert.deepEqual(await readJSON(dir, 'work/spent.json'), { answers: 0, runs: 1 });
    const current = missing(dir);
    const items = current.items;
    const base = items.find((item) => item.item === `run:${ENGINE_BASE}`);
    assert.ok(base);
    // account.md §what-it-is, §items: allowance is this machine's and holds back no item.
    assert.ok(!base.waits?.includes('allow'));
    assert.equal(current.here.allow.why, 'runs');
    assert.ok(!items.some((item) => item.item === 'allow'));
    const second = engineRun(dir);
    assert.deepEqual(second.ran, []);
    assert.deepEqual(second.runs, { spent: 1, left: 0 });
  });
  // door.md §spent; door.md §scratch; evidence.md §versions; evidence.md §forma-run.
  test('door.md §spent: a version-only rerun starts with no allowance and spends nothing', async () => {
    const original = await engineProject({ runs: 1 });
    engineRun(original);
    const files = await snapshot(original, { skip: ['runs'] });
    const path = `models/${ENGINE_PATH}.json`;
    const evidence = JSON.parse(files[path]);
    evidence.basis = { ...evidence.basis, runtime: { ...evidence.basis.runtime, version: 'v0.0.0' } };
    files[path] = engineEvidenceBytes(evidence);
    const dir = await project(null, files);
    const result = engineRun(dir);
    assert.deepEqual(result.ran.map((run) => run.name), [ENGINE_PATH]);
    assert.equal(result.ran[0].spent, false);
    assert.deepEqual(result.runs, { spent: 1, left: 0 });
    assert.deepEqual(await readJSON(dir, 'work/spent.json'), { answers: 0, runs: 1 });
  });
  // door.md §spent; door.md §read-checks; door.md §scratch; models.md §slot-currency.
  test('door.md §spent: importing accepted slots from a clone spends no local answer allowance', async () => {
    const dir = await engineProject({ encoding: true });
    await writeFiles(dir, { 'work/spent.json': '{"answers":30,"runs":30}' });
    const before = await read(dir, 'work/spent.json');
    const items = missing(dir).items;
    assert.ok(!items.some((item) => item.item === ENGINE_ITEM || item.item === `change:${ENGINE_SLOT}`));
    assert.equal(await read(dir, 'work/spent.json'), before);
    assert.equal(await read(dir, 'work/sessions.json'), null);
  });
});

describe('door.md §read-checks — engine checks on every read', () => {
  // models.md §freeze; design.md §pins; door.md §read-checks; design.md §units-and-pins,
  //.
  test('door.md §read-checks: freeze checks exact bytes even when a heading change preserves the pin', async () => {
    const state = await engineSurprise();
    const files = await snapshot(state.dir);
    const old = files[ENGINE_LIFE];
    const edited = old.replace('# Door phase', '# Same meaning');
    files[ENGINE_LIFE] = edited;
    const receipt = 'design/parts/door/lifecycles/state/receipt';
    files[receipt] = receiptText([makeReceipt('README.md', old), makeReceipt('README.md', edited)]);
    const dir = await project(null, files);
    const items = missing(dir).items;
    assert.ok(items.some((item) => item.item === `change:${ENGINE_LIFE}`));
    assert.ok(!items.some((item) => item.item === `change:${ENGINE_SLOT}`));
    await writeFiles(dir, { [ENGINE_LIFE]: old });
    assert.ok(!missing(dir).items.some((item) => item.item === `change:${ENGINE_LIFE}`));
  });
  // door.md §receipts; door.md §read-checks; door.md §change; evidence.md §surprise-file.
  test('door.md §read-checks: a merge making the explainer a model author discounts the explanation', async () => {
    const { dir: original, surprise, item } = await engineSurprise();
    expectAccepted(await send(original, item, engineExplanation(surprise), EXPLAINER), item);
    const files = await snapshot(original);
    const receipt = 'design/parts/door/lifecycles/state/receipt';
    const old = engineReceipt(files[receipt])[0];
    files[receipt] = receiptText([old, { ...old, session: EXPLAINER, authors: [EXPLAINER] }]);
    const dir = await project(null, files);
    const items = missing(dir).items;
    assert.ok(items.some((entry) => entry.item === `change:models/${surprise}.explained.md`));
    assert.ok(items.some((entry) => entry.item === item));
    assert.ok(!items.some((entry) => entry.item === `change:${ENGINE_LIFE}`));
  });
  // engines.md §slot-forms; forms.md §page-rules; door.md §read-checks to §change; models.md §owed.
  test('door.md §read-checks: an accepted but malformed lifecycle slot fails its own form at read', async () => {
    const dir = await engineProject();
    const bytes = '| Lifecycle | Phase | Extra |\n| --- | --- | --- |\n| state | closed | no |\n';
    await writeFiles(dir, { [ENGINE_SLOT]: bytes, 'models/.gitattributes': MODEL_ATTRIBUTES,
      [ENGINE_RECEIPT]: receiptText([makeReceipt('encoding.md', bytes, { pins: enginePins() })]),
    });
    const items = missing(dir).items;
    assert.ok(items.some((item) => item.item === `change:${ENGINE_SLOT}`));
    assert.ok(items.some((item) => item.item === ENGINE_ITEM));
  });
});

describe('door.md §change — engine changes and restoration', () => {
  for (const corruption of ['digest', 'question']) {
    // door.md §change; evidence.md §own-check; evidence.md §written; evidence.md §forma-run,
    //.
    test(`door.md §change: evidence with a wrong ${corruption} is a change and is replaced by its next run`, async () => {
      const original = await engineProject();
      engineRun(original);
      const files = await snapshot(original);
      const path = `models/${ENGINE_PATH}.json`;
      const evidence = JSON.parse(files[path]);
      if (corruption === 'digest') evidence.digest = '0'.repeat(64);
      else evidence.name = 'lifecycles-door/parts/door/journeys/other/lifecycle-path';
      files[path] = corruption === 'digest' ? `${JSON.stringify(evidence, null, 2)}\n` : engineEvidenceBytes(evidence);
      const dir = await project(null, files);
      const items = missing(dir).items;
      assert.ok(items.some((item) => item.item === `change:${path}`));
      assert.ok(items.some((item) => item.item === `run:${ENGINE_PATH}`));
      engineRun(dir);
      assert.ok(!missing(dir).items.some((item) => item.item === `change:${path}`));
      assert.equal((await readJSON(dir, path)).name, ENGINE_PATH);
    });
  }
  // door.md §change; door.md §answer-holds; door.md §forma-answer.
  test('door.md §change: a changed slot is repaired through its change item', async () => {
    const dir = await engineProject({ encoding: true });
    const original = await read(dir, ENGINE_SLOT);
    await writeFiles(dir, { [ENGINE_SLOT]: `${original}\nUnaccepted edit.\n` });
    const item = `change:${ENGINE_SLOT}`;
    assert.ok(missing(dir).items.some((entry) => entry.item === item));
    const result = expectAccepted(await send(dir, item, { [ENGINE_SLOT]: original }, SLOT_WRITER), item);
    assert.equal(result.kind, 'slot');
    assert.equal(await read(dir, ENGINE_SLOT), original);
    assert.ok(!missing(dir).items.some((entry) => entry.item === item));
  });
});

describe('door.md §copies — engine files in two copies', () => {
  // door.md §copies; door.md §receipts; evidence.md §writers.
  test('door.md §copies: writing a slot repairs models attributes and uses no receipt for evidence', async () => {
    const dir = await engineProject();
    await writeFiles(dir, { 'models/.gitattributes': 'wrong\n' });
    expectAccepted(await send(dir, ENGINE_ITEM, await fixtureFiles('engine-encoding'), SLOT_WRITER), ENGINE_ITEM);
    assert.equal(await read(dir, 'models/.gitattributes'), MODEL_ATTRIBUTES);
    engineRun(dir);
    assert.equal(await read(dir, 'runs/.gitignore'), '*\n');
    const lines = engineReceipt(await read(dir, ENGINE_RECEIPT));
    assert.deepEqual(lines.map((line) => line.file), ['encoding.md']);
    assert.equal(await read(dir, 'models/lifecycles-door/parts/door/journeys/close/receipt'), null);
  });
  // door.md §receipts; door.md §copies; models.md §slot-currency.
  test('door.md §copies: a union of slot receipts recognizes the whole file taken from either side', async () => {
    const original = await engineProject({ encoding: true });
    const files = await snapshot(original);
    const first = files[ENGINE_SLOT];
    const second = first.replace('| state | closed |', '| state | open |');
    const earlier = makeReceipt('encoding.md', first, { session: SLOT_WRITER, authors: [SLOT_WRITER], pins: enginePins() });
    const later = makeReceipt('encoding.md', second, { session: EXPLAINER, authors: [EXPLAINER], pins: enginePins() });
    for (const bytes of [first, second]) {
      const dir = await project(null, { ...files, [ENGINE_SLOT]: bytes, [ENGINE_RECEIPT]: receiptText([later, earlier, earlier]) });
      const items = missing(dir).items;
      assert.ok(!items.some((item) => item.item === `change:${ENGINE_SLOT}` || item.item === ENGINE_ITEM));
    }
  });
});

describe('door.md §clock — tracked evidence times', () => {
  for (const command of ['answer', 'run']) {
    // door.md §clock; door.md §forma-answer; evidence.md §keys; evidence.md §own-check,
    //.
    test(`door.md §clock: digest-valid future evidence prevents ${command} without any write`, async () => {
      const original = await engineProject();
      engineRun(original);
      const files = await snapshot(original);
      const path = `models/${ENGINE_PATH}.json`;
      const evidence = JSON.parse(files[path]);
      const future = '2099-01-01T00:00:00.000Z';
      evidence.established = future;
      files[path] = engineEvidenceBytes(evidence);
      const dir = await project(null, files);
      const before = await snapshot(dir);
      const result = command === 'answer'
        ? await send(dir, ENGINE_ITEM, await fixtureFiles('engine-encoding'), SLOT_WRITER)
        : forma(dir, ['run', '--json']);
      const refused = expectEarlyRefusal(result);
      assert.ok(refused.refused.some((reason) => reason.file === path && reason.says.includes(future)));
      assert.deepEqual(await snapshot(dir), before);
    });
  }
  // door.md §clock; door.md §gives; door.md §forma-give; evidence.md §rerun.
  test('door.md §clock: a future surprise prevents the run its Explain packet would need', async () => {
    const state = await engineSurprise();
    const files = await snapshot(state.dir, { skip: ['runs'] });
    const path = `models/${state.surprise}.json`;
    const evidence = JSON.parse(files[path]);
    evidence.established = '2099-01-01T00:00:00.000Z';
    files[path] = engineEvidenceBytes(evidence);
    const dir = await project(null, files);
    const folder = await tempFolder();
    const before = await snapshot(dir);
    const refused = expectEarlyRefusal(forma(dir, ['give', state.item, folder, '--json']));
    assert.ok(refused.refused.some((reason) => reason.file === path));
    assert.deepEqual(await snapshot(dir), before);
    assert.deepEqual(await tree(folder), []);
  });
  // door.md §clock; door.md §change; evidence.md §own-check.
  test('door.md §clock: a future time in evidence whose digest fails does not hold a writer', async () => {
    const dir = await engineProject();
    engineRun(dir);
    const path = `models/${ENGINE_PATH}.json`;
    const evidence = await readJSON(dir, path);
    // Deliberately preserve the old digest after changing its time.
    evidence.established = '2099-01-01T00:00:00.000Z';
    await writeFiles(dir, { [path]: `${JSON.stringify(evidence, null, 2)}\n` });
    expectAccepted(await send(dir, ENGINE_ITEM, await fixtureFiles('engine-encoding'), SLOT_WRITER), ENGINE_ITEM);
    assert.ok(missing(dir).items.some((item) => item.item === `change:${path}`));
  });
});

describe('door.md §answer-holds — an open surprise protects what it rests on', () => {
  for (const operation of ['change lifecycle', 'hold identical lifecycle', 'remove lifecycle', 're-file claim']) {
    // door.md §answer-holds; models.md §freeze; design.md §restate-checks;
    // design.md §removal; door.md §forma-answer.
    test(`door.md §answer-holds: an unruled surprise refuses an answer that would ${operation}`, async () => {
      const { dir } = await engineSurprise();
      const address = 'design/brief/adjustment.md#adjustment';
      await writeFiles(dir, { 'design/brief/adjustment.md': '# Adjustment\n\nDescribe the door more clearly.\n' });
      const item = `passage:${address}`;
      const files = { 'design/README.md': (await read(dir, 'design/README.md'))
        .replace('design/brief/overview.md#door', `design/brief/overview.md#door, ${address}`) };
      if (operation === 'change lifecycle') {
        files[ENGINE_LIFE] = (await read(dir, ENGINE_LIFE)).replace('# Door phase', '# Changed title');
      } else if (operation === 'hold identical lifecycle') {
        // models.md §freeze and design.md §restate-checks check 5 refuse holding a
        // frozen page even when its bytes are unchanged. The root page alone
        // would validly cover this new passage under design.md §restate-applied.
        files[ENGINE_LIFE] = await read(dir, ENGINE_LIFE);
      } else if (operation === 'remove lifecycle') {
        files['removed.md'] = 'design/parts/door/lifecycles/state\n';
        files['design/parts/door/README.md'] = (await read(dir, 'design/parts/door/README.md'))
          .replace('1. [Door phase](lifecycles/state/)\n', '');
      } else {
        files['removed.md'] = 'design/parts/door/claims/open\n';
        files['design/parts/door/README.md'] = (await read(dir, 'design/parts/door/README.md'))
          .replace('3. [Stays open](claims/open/)\n', '');
        files['design/spans/door-reading/README.md'] = '# Door reading\n\nKeeps the door claim together.\n\n1. [Stays open](claims/open/)\n';
        files['design/spans/door-reading/claims/open/README.md'] = await read(dir, ENGINE_CLAIM);
      }
      const before = await record(dir);
      expectCountedRefusal(await send(dir, item, files), item);
      assert.deepEqual(await record(dir), before);
    });
  }
});

describe('door.md §forma-answer — further slots without a missing item', () => {
  for (const kind of ['witness', 'fault']) {
    // door.md §forma-answer; models.md §owed; door.md §forma-answer.
    test(`door.md §forma-answer: a further ${kind} is accepted under a fresh key although its generic item is not missing`, async () => {
      const dir = await engineProject({ encoding: true });
      const item = `slot:lifecycles-door/parts/door/claims/open/${kind}`;
      const files = await fixtureFiles(`engine-${kind}`);
      expectAccepted(await send(dir, item, files, SLOT_WRITER), item);
      assert.ok(!missing(dir).items.some((entry) => entry.item === item));
      const [[path, bytes]] = Object.entries(files);
      const next = path.replace(`${kind}-${kind === 'witness' ? 'open' : 'close'}.md`, `${kind}-another.md`);
      const result = expectAccepted(await send(dir, item, { [next]: bytes }, SLOT_WRITER), item);
      assert.equal(result.answers.spent, 2);
      assert.equal(await read(dir, path), bytes);
      assert.equal(await read(dir, next), bytes);
    });
  }
  // models.md §owed; door.md §forma-answer.
  test('door.md §forma-answer: the further-slot exception does not permit reusing a witness key', async () => {
    const dir = await engineProject({ encoding: true, witness: true });
    const item = 'slot:lifecycles-door/parts/door/claims/open/witness';
    assert.ok(!missing(dir).items.some((entry) => entry.item === item));
    const before = await record(dir);
    expectCountedRefusal(await send(dir, item, await fixtureFiles('engine-witness'), SLOT_WRITER), item);
    assert.deepEqual(await record(dir), before);
  });
});

describe('door.md §repair-answer — model targets delimit Repair files', () => {
  for (const foreign of ['claim page', 'other model slot', 'other model files']) {
    // door.md §repair-answer; models.md §model-repair; door.md §forma-answer.
    test(`door.md §repair-answer: a lifecycle-model Repair refuses a ${foreign} outside its target`, async () => {
      const { dir, repairItem } = await engineRuling();
      const files = { 'repair.md': '| Field | Value |\n| --- | --- |\n| Mechanism | Corrects the lifecycle. |\n' };
      if (foreign === 'claim page') files[ENGINE_CLAIM] = await read(dir, ENGINE_CLAIM);
      else if (foreign === 'other model slot') {
        files['models/lifecycles-other/parts/door/claims/open/encoding.md'] = await read(dir, ENGINE_SLOT);
      } else Object.assign(files, await fixtureFiles('engine-tlc'));
      const before = await record(dir);
      expectCountedRefusal(await send(dir, repairItem, files), repairItem);
      assert.deepEqual(await record(dir), before);
    });
  }
});

describe('door.md §receipts — selecting a merged entry and redirect receipts', () => {
  for (const [caseName, currentAt, staleAt, currentProvider, staleProvider, owed] of [
    ['latest current line', '2024-01-01T00:00:02.000Z', '2024-01-01T00:00:01.000Z', 'a', 'z', false],
    ['latest stale line', '2024-01-01T00:00:01.000Z', '2024-01-01T00:00:02.000Z', 'z', 'a', true],
    ['byte-first current tie', PAST, PAST, 'a', 'z', false],
    ['byte-first stale tie', PAST, PAST, 'z', 'a', true],
  ]) {
    // door.md §receipts; models.md §slot-currency; account.md §items.
    test(`door.md §receipts: the ${caseName} supplies a slot's pins`, async () => {
      const original = await engineProject({ encoding: true });
      const files = await snapshot(original);
      const bytes = files[ENGINE_SLOT];
      const currentSession = { ...SLOT_WRITER, provider: currentProvider };
      const staleSession = { ...SLOT_WRITER, provider: staleProvider };
      const current = makeReceipt('encoding.md', bytes, { at: currentAt, session: currentSession,
        authors: [currentSession], pins: enginePins() });
      const stale = makeReceipt('encoding.md', bytes, { at: staleAt, session: staleSession,
        authors: [staleSession], pins: enginePins('0'.repeat(64)) });
      // Deliberately reverse physical order: the set of lines, At, then byte
      // order choose the entry; the last physical line must not choose it.
      files[ENGINE_RECEIPT] = `${JSON.stringify(stale)}\n${JSON.stringify(current)}\n`;
      const dir = await project(null, files);
      const items = missing(dir).items;
      assert.ok(!items.some((item) => item.item === `change:${ENGINE_SLOT}`));
      const slot = items.find((item) => item.item === ENGINE_ITEM);
      if (owed) assert.equal(slot?.why, 'owed-again');
      else assert.equal(slot, undefined);
    });
  }
  // door.md §receipts; decisions.md §forma-show; decisions.md §forma-decide;
  // decisions.md §decision-file; door.md §change.
  test('door.md §receipts: a redirect writes decision instead of session and preserves former authors', async () => {
    const dir = await engineProject();
    const on = 'door/claims/open';
    const words = 'The door stays open until the operator closes it.';
    const shown = forma(dir, ['show', 'redirect', on, '--words', words, '--json']);
    assert.equal(shown.status, 0, shown.stderr || shown.stdout);
    assert.equal(typeof shown.json?.token, 'string');
    const before = new Set(await tree(dir));
    const result = forma(dir, ['decide', 'redirect', on, '--words', words, '--shown', shown.json.token,
      '--by', 'Fixture owner', '--provider', DEVELOPER.provider, '--model', DEVELOPER.model,
      '--session', DEVELOPER.session, '--json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const paths = (await tree(dir)).filter((path) => !before.has(path) && path.includes('/decisions/') && path.endsWith('.md'));
    assert.equal(paths.length, 1);
    const decisionBytes = await read(dir, paths[0]);
    const at = decisionBytes.match(/^\| At \| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \|$/m)?.[1];
    assert.ok(at);
    // decisions.md §decision-file supplies the independent expected decision name.
    const name = `${at.slice(0, 19).replace(/[-:]/g, '')}Z-redirect-${sha256(decisionBytes).slice(0, 12)}`;
    assert.equal(paths[0].split('/').at(-1), `${name}.md`);
    const [line] = engineReceipt(await read(dir, 'design/parts/door/claims/open/receipt'));
    assert.deepEqual(Object.keys(line), ['file', 'sha256', 'at', 'decision', 'authors']);
    assert.equal(line.file, 'README.md');
    assert.equal(line.decision, name);
    assert.deepEqual(line.authors, [WRITER]);
    assert.equal(line.sha256, sha256(await read(dir, ENGINE_CLAIM)));
    assert.ok(!missing(dir).items.some((item) => item.item === `change:${ENGINE_CLAIM}`));
  });
});

async function engineTlcTargetRuling() {
  // decisions.md §forma-show; decisions.md §forma-decide; decisions.md §decision-file:
  // showing token, a single ruling file, success, and the file's computed name.
  const state = await engineSurprise();
  const model = await fixtureFiles('engine-tlc');
  expectAccepted(await send(state.dir, 'cover:door', model), 'cover:door');
  const slot = 'models/door-model/parts/door/claims/open/encoding.tla';
  const item = 'slot:door-model/parts/door/claims/open/encoding';
  expectAccepted(await send(state.dir, item, { [slot]: 'Invariant == phase = "open"\n' }, SLOT_WRITER), item);
  expectAccepted(await send(state.dir, state.item, engineExplanation(state.surprise), EXPLAINER), state.item);
  const shown = forma(state.dir, ['show', 'rule', state.surprise, '--json']);
  assert.equal(shown.status, 0, shown.stderr || shown.stdout);
  assert.equal(typeof shown.json?.token, 'string');
  const before = new Set(await tree(state.dir));
  const ruled = forma(state.dir, ['decide', 'rule', state.surprise, '--shown', shown.json.token,
    '--verdict', 'real finding', '--level', 'specification', '--target', 'door-model',
    '--words', 'Repair the explicit door model.', '--by', 'Fixture owner',
    '--provider', DEVELOPER.provider, '--model', DEVELOPER.model, '--session', DEVELOPER.session, '--json']);
  assert.equal(ruled.status, 0, ruled.stderr || ruled.stdout);
  const paths = (await tree(state.dir)).filter((path) => !before.has(path) && path.includes('/decisions/') && path.endsWith('.md'));
  assert.equal(paths.length, 1);
  const bytes = await read(state.dir, paths[0]);
  const at = bytes.match(/^\| At \| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \|$/m)?.[1];
  assert.ok(at);
  // decisions.md §decision-file fixes the name independently of the filename.
  const name = `${at.slice(0, 19).replace(/[-:]/g, '')}Z-rule-${sha256(bytes).slice(0, 12)}`;
  assert.equal(paths[0].split('/').at(-1), `${name}.md`);
  const repair = missing(state.dir).items.filter((entry) => entry.item.startsWith(`repair:${name}`));
  // account.md §items: a real finding on one model also has the suffix.
  assert.deepEqual(repair.map((entry) => entry.item), [`repair:${name}/door-model`]);
  return { ...state, model, slot, decisionName: name, repairItem: `repair:${name}/door-model` };
}

describe('door.md §repair-answer — TLC model Repair packets and scope', () => {
  // door.md §gives; door.md §repair-answer.
  test('door.md §repair-answer: a TLC model Repair packet includes the target model and accepted claim slots', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const { dir, model, slot, repairItem } = await engineTlcTargetRuling();
    const packet = await givePacket(dir, repairItem);
    for (const [path, bytes] of Object.entries(model)) assert.equal(packet.files[path], bytes);
    assert.equal(packet.files[slot], await read(dir, slot));
    assert.deepEqual(Object.keys(packet.files).filter((path) => path.startsWith('forma/')),
      ['forma/account.md', 'forma/decisions.md', 'forma/design.md', 'forma/door.md', 'forma/engines.md', 'forma/evidence.md', 'forma/forms.md', 'forma/models.md', 'forma/presentation.md']);
    assert.ok(Object.hasOwn(packet.item, 'decision'));
    assert.ok(JSON.stringify(packet.item.decision).includes('Repair the explicit door model.'));
    assert.ok(!Object.keys(packet.files).some((path) => path.endsWith('/receipt') || path.includes('/decisions/')));
  });
  for (const foreign of ['lifecycle page', 'other model']) {
    // door.md §repair-answer; models.md §model-repair; door.md §forma-answer.
    test(`door.md §repair-answer: a TLC-model Repair refuses a ${foreign} outside its target`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      const { dir, model, repairItem } = await engineTlcTargetRuling();
      const files = { ...model, 'repair.md': '| Field | Value |\n| --- | --- |\n| Mechanism | Corrects the explicit model. |\n' };
      files['models/door-model/model.md'] = files['models/door-model/model.md'].replace('# Door phase', '# Revised door phase');
      if (foreign === 'lifecycle page') files[ENGINE_LIFE] = await read(dir, ENGINE_LIFE);
      else {
        for (const [path, bytes] of Object.entries(model)) files[path.replace('door-model/', 'other-model/')] = bytes;
      }
      const before = await record(dir);
      expectCountedRefusal(await send(dir, repairItem, files), repairItem);
      assert.deepEqual(await record(dir), before);
    });
  }
});

// evidence.md §bounds, hashes normalized bounds with final LF. An
// unbounded TLC model hashes the empty text; the count fixture has one row.
const ENGINE_COUNT_DIGEST = sha256('constant Count = 1\n').slice(0, 12);
const ENGINE_EMPTY_BOUNDS = sha256('').slice(0, 12);
const ENGINE_TLC_BASE = `door-model/parts/door/claims/open/base.${ENGINE_COUNT_DIGEST}`;
const ENGINE_TLC_SCHEDULE = 'models/door-model/parts/door/journeys/close/schedule.md';
async function engineTlcBaseSurprise() {
  // evidence.md §questions; evidence.md §surprise-file; evidence.md §stems,
  //; evidence.md §basis: only base fails after conformance,
  // and the surprise name is derived independently from its basis digest.
  const dir = await engineProject();
  const model = await fixtureFiles('engine-tlc-count');
  expectAccepted(await send(dir, 'cover:door', model), 'cover:door');
  const slots = await fixtureFiles('engine-tlc-slots');
  for (const [path, bytes] of Object.entries(slots)) {
    const item = `slot:${path.slice('models/'.length).replace(/\.[^.]+$/, '')}`;
    expectAccepted(await send(dir, item, { [path]: bytes }, SLOT_WRITER), item);
  }
  const ran = engineRun(dir);
  const base = await readJSON(dir, `models/${ENGINE_TLC_BASE}.json`);
  assert.ok(base);
  // evidence.md §stems; evidence.md §basis: derive the surprise ID.
  const digest = sha256(`${JSON.stringify(base.basis, null, 2)}\n`);
  const surprise = `${ENGINE_TLC_BASE}.surprise-${digest.slice(0, 12)}`;
  assert.deepEqual(ran.opened, [surprise]);
  return { dir, ran, model, surprise, question: ENGINE_TLC_BASE, item: `explain:${surprise}` };
}
function engineTlcExplanation(state) {
  return { 'explain.md': '| Field | Value |\n| --- | --- |\n'
    + `| Question | ${state.question} |\n| Basis | ${state.surprise.slice(-12)} |\n`
    + '| Verdict | model wrong |\n| Level | specification |\n| Weaker | broad |\n'
    + '\n## Trace\n\nThe operator closes the open door.\n'
    + '\n## Failure shape\n\nA person cannot pass through the closed door.\n'
    + '\n## Mechanism\n\nClose permits the forbidden closed phase.\n',
    'weaker/broad.tla': 'Invariant == TRUE\n' };
}
async function engineTlcPathSurprise() {
  // evidence.md §questions; evidence.md §surprise-file; evidence.md §stems,
  // and evidence.md §basis: the reachable start has a refused path only.
  const original = await engineProject();
  const files = await snapshot(original);
  const start = await fixtureFiles('engine-tlc-start');
  for (const [path, bytes] of Object.entries(start)) if (path.startsWith('design/')) files[path] = bytes;
  // design.md §pins: this lifecycle admits repeated close; its journey
  // starts at the reachable closed phase. The explicit model will refuse it.
  const lifePin = sha256([
    'Entity: Door (entity, machine, -, -)', 'Initial: open', 'Ends: closed', 'Unaffected: ',
    `Cites: ${enginePassage}`, 'Cell: closed | Closes the door. | closed',
    'Cell: open | Closes the door. | closed',
  ].join('\n'));
  const journeyPin = sha256([
    'Polarity: should happen', 'Expected end: The door stays closed.', 'Refused step: -',
    `Cites: ${enginePassage}`, 'Start: Door | closed-door | closed',
    'Step 1: Door controller | Closes the door. | none | - | -',
  ].join('\n'));
  for (const [index, [on, pin, folder]] of [
    ['door/lifecycles/state', lifePin, 'design/parts/door/lifecycles/state'],
    ['door/journeys/close', journeyPin, 'design/parts/door/journeys/close'],
  ].entries()) {
    const confirmation = decision({ kind: 'confirm', on, pin, at: `2024-01-01T00:00:1${index}.000Z` });
    files[`${folder}/decisions/${confirmation.name}.md`] = confirmation.bytes;
  }
  const dir = await project(null, await acceptedFiles(files));
  expectAccepted(await send(dir, 'cover:door', await fixtureFiles('engine-tlc')), 'cover:door');
  const item = 'slot:door-model/parts/door/journeys/close/schedule';
  expectAccepted(await send(dir, item, { [ENGINE_TLC_SCHEDULE]: start[ENGINE_TLC_SCHEDULE] }, SLOT_WRITER), item);
  const ran = engineRun(dir);
  const question = `door-model/parts/door/journeys/close/path.${ENGINE_EMPTY_BOUNDS}`;
  const evidence = await readJSON(dir, `models/${question}.json`);
  const digest = sha256(`${JSON.stringify(evidence.basis, null, 2)}\n`);
  const surprise = `${question}.surprise-${digest.slice(0, 12)}`;
  assert.deepEqual(ran.opened, [surprise]);
  return { dir, surprise, question, item: `explain:${surprise}` };
}
async function engineTlcModelWrong() {
  // decisions.md §forma-show; decisions.md §forma-decide; decisions.md §decision-file:
  // the showing token, one ruling file, success, and its computed name.
  const state = await engineTlcBaseSurprise();
  expectAccepted(await send(state.dir, state.item, engineTlcExplanation(state), EXPLAINER), state.item);
  engineRun(state.dir);
  const shown = forma(state.dir, ['show', 'rule', state.surprise, '--json']);
  assert.equal(shown.status, 0, shown.stderr || shown.stdout);
  assert.equal(typeof shown.json?.token, 'string');
  const before = new Set(await tree(state.dir));
  const result = forma(state.dir, ['decide', 'rule', state.surprise, '--shown', shown.json.token,
    '--verdict', 'model wrong', '--level', 'specification', '--words', 'Correct the finite door model.',
    '--by', 'Fixture owner', '--provider', DEVELOPER.provider, '--model', DEVELOPER.model,
    '--session', DEVELOPER.session, '--json']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const paths = (await tree(state.dir)).filter((path) => !before.has(path) && path.includes('/decisions/') && path.endsWith('.md'));
  assert.equal(paths.length, 1);
  const bytes = await read(state.dir, paths[0]);
  const at = bytes.match(/^\| At \| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \|$/m)?.[1];
  assert.ok(at);
  // decisions.md §decision-file computes names from At, kind and exact bytes.
  const name = `${at.slice(0, 19).replace(/[-:]/g, '')}Z-rule-${sha256(bytes).slice(0, 12)}`;
  assert.equal(paths[0].split('/').at(-1), `${name}.md`);
  return { ...state, decisionName: name, repairItem: `repair:${name}/door-model` };
}

describe('door.md §gives — additional Explain inputs', () => {
  // door.md §gives; evidence.md §stems; evidence.md §runs; evidence.md §reductions,
  //; evidence.md §weaker.
  test('door.md §gives: an Explain packet gives reductions and weaker evidence with their surprise', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const state = await engineTlcBaseSurprise();
    expectAccepted(await send(state.dir, state.item, engineTlcExplanation(state), EXPLAINER), state.item);
    engineRun(state.dir);
    const files = await snapshot(state.dir);
    const explanation = `models/${state.surprise}.explained.md`;
    delete files[explanation];
    const receipt = 'models/door-model/parts/door/claims/open/receipt';
    files[receipt] = receiptText(engineReceipt(files[receipt]).filter((line) => line.file !== explanation.split('/').at(-1)));
    const dir = await project(null, files);
    const packet = await givePacket(dir, state.item);
    for (const suffix of ['.json', '.reduction-1.json', '.weaker-broad.json']) {
      const path = `models/${state.surprise}${suffix}`;
      assert.ok(await read(dir, path));
      assert.equal(packet.files[path], await read(dir, path));
    }
    const reductionRun = `runs/${state.surprise}.reduction-1/`;
    const runFiles = (await tree(dir)).filter((path) => path.startsWith(reductionRun));
    assert.ok(runFiles.length > 0);
    for (const path of runFiles) assert.equal(packet.files[path], await read(dir, path));
    assert.equal(packet.files[receipt], undefined);
    assert.equal(packet.files[explanation], undefined);
  });
  // door.md §gives; evidence.md §questions; evidence.md §sent-back.
  test('door.md §gives: a path Explain packet includes the journey start question evidence', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const state = await engineTlcPathSurprise();
    const packet = await givePacket(state.dir, state.item);
    const path = `models/door-model/parts/door/journeys/close/start.${ENGINE_EMPTY_BOUNDS}.json`;
    assert.equal((await readJSON(state.dir, path)).found.outcome, 'reached');
    assert.equal(packet.files[path], await read(state.dir, path));
    for (const page of [ENGINE_LIFE, 'design/parts/door/journeys/close/README.md']) {
      assert.equal(packet.files[page], await read(state.dir, page));
    }
  });
  // door.md §gives; evidence.md §rerun; evidence.md §basis.
  test('door.md §gives: Explain names the regenerated input whose historical digest differs', async () => {
    const state = await engineSurprise();
    const files = await snapshot(state.dir, { skip: ['runs'] });
    const oldPath = `models/${state.surprise}.json`;
    const surprise = JSON.parse(files[oldPath]);
    const questionPath = `models/${ENGINE_BASE}.json`;
    const evidence = JSON.parse(files[questionPath]);
    // This hand-written historical input represents a different composition
    // on the other machine. Its SHA follows evidence.md §basis; no old run is
    // present locally, so engines.md §composition must regenerate it and compare the exact hash.
    const historicalHash = sha256('{"historical":true}\n');
    for (const value of [surprise, evidence]) {
      const generated = value.basis.files.find((file) => file.generated === 'lifecycles.json');
      assert.ok(generated);
      generated.sha256 = historicalHash;
      // evidence.md §basis: this historical one-file Forma build had other
      // source bytes, making a different composition consistent with engines.md §composition.
      value.basis.forma.source = sha256('// historical composition source\n').slice(0, 12);
    }
    const digest = sha256(`${JSON.stringify(surprise.basis, null, 2)}\n`);
    const name = `${ENGINE_BASE}.surprise-${digest.slice(0, 12)}`;
    surprise.name = name;
    delete files[oldPath];
    files[`models/${name}.json`] = engineEvidenceBytes(surprise);
    files[questionPath] = engineEvidenceBytes(evidence);
    const dir = await project(null, files);
    const before = await record(dir);
    const packet = await givePacket(dir, `explain:${name}`);
    assert.equal(packet.result.differ.length, 1);
    assert.ok(packet.result.differ[0] === 'lifecycles.json' || packet.result.differ[0].endsWith('/lifecycles.json'));
    assert.deepEqual(packet.item.differ, packet.result.differ);
    const actual = await read(dir, `runs/${ENGINE_BASE}/inputs/lifecycles.json`);
    assert.ok(actual);
    assert.notEqual(sha256(actual), historicalHash);
    assert.deepEqual(await record(dir), before);
  });
});

describe('door.md §spent — reductions and weaker forms spend runs', () => {
  // door.md §spent; door.md §scratch; evidence.md §reductions; evidence.md §written; evidence.md §keys.
  test('door.md §spent: a reduction spends one run when it starts', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const state = await engineTlcBaseSurprise();
    const reductions = state.ran.ran.filter((run) => run.name.startsWith(`${state.surprise}.reduction-`));
    assert.deepEqual(reductions.map((run) => run.name), [`${state.surprise}.reduction-1`]);
    assert.equal(reductions[0].spent, true);
    assert.deepEqual((await readJSON(state.dir, `models/${state.surprise}.reduction-1.json`)).bounds, { 'constant Count': '0' });
    assert.equal(state.ran.runs.spent, state.ran.ran.filter((run) => run.spent).length);
    assert.equal((await readJSON(state.dir, 'work/spent.json')).runs, state.ran.runs.spent);
    assert.deepEqual(engineRun(state.dir).ran, []);
  });
  // door.md §spent; door.md §scratch; evidence.md §weaker; evidence.md §keys; evidence.md §written.
  test('door.md §spent: an accepted weaker form spends exactly one further run', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const state = await engineTlcBaseSurprise();
    const before = (await readJSON(state.dir, 'work/spent.json')).runs;
    expectAccepted(await send(state.dir, state.item, engineTlcExplanation(state), EXPLAINER), state.item);
    engineRun(state.dir);
    const path = `models/${state.surprise}.weaker-broad.json`;
    const weaker = await readJSON(state.dir, path);
    assert.equal(weaker.kind, 'weaker');
    assert.equal(weaker.weakens, state.surprise);
    assert.equal((await readJSON(state.dir, 'work/spent.json')).runs, before + 1);
    const bytes = await read(state.dir, path);
    assert.deepEqual(engineRun(state.dir).ran, []);
    assert.equal(await read(state.dir, path), bytes);
    assert.equal((await readJSON(state.dir, 'work/spent.json')).runs, before + 1);
  });
});

describe('door.md §repair-answer — successful TLC Repair shapes', () => {
  // door.md §repair-answer; door.md §receipts; models.md §model-repair.
  test('door.md §repair-answer: a model-wrong TLC Repair accepts model files without slots', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const state = await engineTlcModelWrong();
    const before = await read(state.dir, 'models/door-model/model.md');
    const files = { ...state.model, 'repair.md': '| Field | Value |\n| --- | --- |\n| Mechanism | Clarifies the finite door model. |\n' };
    files['models/door-model/model.md'] = before.replace('# Door phase with a reducible count', '# Revised finite door model');
    expectAccepted(await send(state.dir, state.repairItem, files), state.repairItem);
    const line = engineReceipt(await read(state.dir, 'models/door-model/receipt')).find((entry) => entry.file === 'model.md');
    assert.deepEqual(line.answers, [state.decisionName]);
    assert.equal(line.before, sha256(before));
    assert.deepEqual(line.mechanisms, [{ decision: state.decisionName, mechanism: 'Clarifies the finite door model.' }]);
  });
  for (const shape of ['slots only', 'model files and slots']) {
    // door.md §repair-answer; door.md §receipts; models.md §model-repair.
    test(`door.md §repair-answer: a real-finding TLC Repair accepts ${shape} with the matching fault`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      const state = await engineTlcTargetRuling();
      const mechanism = 'Requiring an open door before closing.';
      const files = { ...await fixtureFiles('engine-tlc-fault'),
        'repair.md': `| Field | Value |\n| --- | --- |\n| Mechanism | ${mechanism} |\n`,
      };
      if (shape === 'slots only') files[state.slot] = 'Invariant == TRUE\n';
      if (shape === 'model files and slots') {
        Object.assign(files, state.model);
        files['models/door-model/model.md'] = files['models/door-model/model.md'].replace('# Door phase', '# Revised door model');
      }
      expectAccepted(await send(state.dir, state.repairItem, files), state.repairItem);
      const fault = 'models/door-model/parts/door/claims/open/fault-close.md';
      assert.equal(await read(state.dir, fault), files[fault]);
      const line = engineReceipt(await read(state.dir, 'models/door-model/parts/door/claims/open/receipt'))
        .find((entry) => entry.file === 'fault-close.md');
      assert.equal(line.before, null);
      assert.deepEqual(line.mechanisms, [{ decision: state.decisionName, mechanism: mechanism }]);
      assert.ok(line.answers.length > 0);
      assert.equal(await read(state.dir, 'repair.md'), null);
    });
  }
  // models.md §model-repair; door.md §forma-answer.
  test('door.md §repair-answer: a real-finding TLC Repair refuses model files without its required fault', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const state = await engineTlcTargetRuling();
    const files = { ...state.model,
      'repair.md': '| Field | Value |\n| --- | --- |\n| Mechanism | Requiring an open door before closing. |\n',
    };
    files['models/door-model/model.md'] = files['models/door-model/model.md'].replace('# Door phase', '# Revised door model');
    const before = await record(state.dir);
    expectCountedRefusal(await send(state.dir, state.repairItem, files), state.repairItem);
    assert.deepEqual(await record(state.dir), before);
  });
});

describe('door.md §answer-holds — the freeze records all model and claim-slot files', () => {
  for (const kind of ['witness', 'fault']) {
    // models.md §freeze; account.md §items; door.md §forma-answer: every claim slot waits
    // for its surprise's ruling, and no new claim slot may enter meanwhile.
    test(`door.md §answer-holds: an open surprise refuses a new ${kind} slot and makes it wait for the ruling`, async () => {
      const { dir, surprise, evidence } = await engineSurprise();
      const files = await fixtureFiles(`engine-${kind}`);
      const [[path]] = Object.entries(files);
      assert.ok(!evidence.held.some((file) => file.path === path));
      const item = `slot:lifecycles-door/parts/door/claims/open/${kind}`;
      const owed = missing(dir).items.find((entry) => entry.item === item);
      assert.ok(owed);
      assert.ok(owed.waits.includes(`rule:${surprise}`));
      const before = await record(dir);
      expectCountedRefusal(await send(dir, item, files, SLOT_WRITER), item);
      assert.deepEqual(await record(dir), before);
    });
  }

  // models.md §freeze; evidence.md §surprise-file: held contains all the claim's slots,
  // including a witness the base question did not read, sorted by path.
  test('door.md §read-checks: a surprise records held hashes for model files and every existing claim slot', async () => {
    const { dir, evidence } = await engineSurprise({ witness: true });
    const witness = 'models/lifecycles-door/parts/door/claims/open/witness-open.md';
    assert.ok(!evidence.basis.files.some((file) => file.path === witness));
    const held = [];
    for (const path of byteOrder([ENGINE_LIFE, ENGINE_SLOT, witness])) {
      held.push({ path, sha256: sha256(await read(dir, path)) });
    }
    assert.deepEqual(evidence.held, held);
    const keys = Object.keys(evidence);
    assert.equal(keys[keys.indexOf('basis') + 1], 'held');
  });

  for (const operation of ['changed', 'removed', 'new']) {
    // models.md §freeze; door.md §read-checks to §change: changed, missing and newly merged
    // slots count for nothing even when a receipt recognizes their bytes.
    test(`door.md §read-checks: a ${operation} claim slot is discounted while its surprise is open`, async () => {
      const state = await engineSurprise({ witness: operation !== 'new' });
      const files = await snapshot(state.dir);
      const path = 'models/lifecycles-door/parts/door/claims/open/witness-open.md';
      const original = (await fixtureFiles('engine-witness'))[path];
      if (operation === 'removed') delete files[path];
      else {
        files[path] = operation === 'changed' ? original.replace('| state | open |', '| state | closed |') : original;
        const lines = engineReceipt(files[ENGINE_RECEIPT]);
        files[ENGINE_RECEIPT] = receiptText([...lines, makeReceipt('witness-open.md', files[path], {
          session: SLOT_WRITER, authors: [SLOT_WRITER], pins: enginePins(),
        })]);
      }
      const dir = await project(null, files);
      assert.ok(changes(missing(dir)).some((entry) => entry.item === `change:${path}`));
      if (operation !== 'new') {
        await writeFiles(dir, { [path]: original });
        assert.ok(!changes(missing(dir)).some((entry) => entry.item === `change:${path}`));
      }
    });
  }
});

describe('door.md §receipts — confirmed lifecycle pages contribute authors', () => {
  // door.md §receipts; models.md §lifecycle-model: only confirmed lifecycle pages contribute
  // model authors; account.md §items identifies the added page as unconfirmed.
  test('door.md §receipts: a session that wrote only an unconfirmed lifecycle may explain the model surprise', async () => {
    const { dir, item, surprise } = await engineSurprise();
    const path = 'design/parts/door/lifecycles/unconfirmed/README.md';
    const page = (await read(dir, ENGINE_LIFE)).replaceAll('open', 'idle').replaceAll('closed', 'done');
    await writeFiles(dir, await acceptedFiles({ [path]: page }, EXPLAINER));
    assert.ok(missing(dir).items.some((entry) => entry.item === 'confirm:door/lifecycles/unconfirmed'));
    expectAccepted(await send(dir, item, engineExplanation(surprise), EXPLAINER), item);
    assert.equal(await read(dir, `models/${surprise}.explained.md`), engineExplanation(surprise)['explain.md']);
  });

  // door.md §receipts, §read-checks: every receipt line's
  // authors contribute, including a historical line that does not match bytes.
  // evidence.md §surprise-file: its Explain item is owed again.
  test('door.md §read-checks: a nonmatching historical model receipt author discounts an explanation', async () => {
    const { dir, item, surprise } = await engineSurprise();
    expectAccepted(await send(dir, item, engineExplanation(surprise), EXPLAINER), item);
    const receipt = 'design/parts/door/lifecycles/state/receipt';
    const prior = engineReceipt(await read(dir, receipt));
    const historical = (await read(dir, ENGINE_LIFE)).replace('# Door phase', '# Historical door');
    await writeFiles(dir, { [receipt]: receiptText([...prior,
      makeReceipt('README.md', historical, { session: EXPLAINER, authors: [EXPLAINER] }),
    ]) });
    const items = missing(dir).items;
    assert.ok(items.some((entry) => entry.item === `change:models/${surprise}.explained.md`));
    assert.ok(items.some((entry) => entry.item === item));
    assert.ok(!items.some((entry) => entry.item === `change:${ENGINE_LIFE}`));
  });
});

describe('door.md §read-checks — evidence measures belong to their engine', () => {
  // evidence.md §measures fixes exactly duration and combinations for lifecycle
  // evidence; evidence.md §runs fixes the run metadata. evidence.md §forma-run owes no rerun of a current answer.
  test('door.md §read-checks: lifecycle evidence contains exactly its engine measures and an answered question owes no retry', async () => {
    const dir = await engineProject();
    engineRun(dir);
    const evidence = await readJSON(dir, `models/${ENGINE_PATH}.json`);
    expectKeys(evidence.measures, ['duration', 'combinations']);
    for (const value of Object.values(evidence.measures)) {
      assert.ok(value === null || (typeof value === 'number' && value >= 0));
    }
    const run = await readJSON(dir, `runs/${ENGINE_PATH}/basis.json`);
    expectKeys(run, ['name', 'basis', 'finished']);
    assert.equal(run.name, ENGINE_PATH);
    assert.deepEqual(run.basis, evidence.basis);
    assert.ok(!missing(dir).items.some((entry) => entry.item === `run:${ENGINE_PATH}`));
    assert.deepEqual(engineRun(dir).ran, []);
  });
  // evidence.md §measures: TLC evidence has its own measures, and no others.
  test('door.md §read-checks: TLC evidence contains exactly duration states and depth', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const state = await engineTlcBaseSurprise();
    const evidence = await readJSON(state.dir, `models/${state.question}.json`);
    expectKeys(evidence.measures, ['duration', 'states', 'depth']);
    for (const value of Object.values(evidence.measures)) {
      assert.ok(value === null || (typeof value === 'number' && value >= 0));
    }
  });
});

describe('door.md §repair-answer — a real finding without a claim surprise', () => {
  // models.md §model-repair: a non-claim real finding needs changed model
  // bytes and no planted claim fault. account.md §items fixes the item;
  // door.md §repair-answer, §receipts fix receipt bookkeeping.
  // decisions.md §forma-show; decisions.md §forma-decide; decisions.md §decision-file
  // fix the showing token, success, one ruling, and its name from exact bytes.
  test('door.md §repair-answer: a real-finding path repair accepts changed model files without a fault', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const state = await engineTlcPathSurprise();
    const explanation = engineExplanation(state.surprise);
    explanation['explain.md'] = explanation['explain.md'].replace(ENGINE_BASE, state.question);
    expectAccepted(await send(state.dir, state.item, explanation, EXPLAINER), state.item);
    const shown = forma(state.dir, ['show', 'rule', state.surprise, '--json']);
    assert.equal(shown.status, 0, shown.stderr || shown.stdout);
    assert.equal(typeof shown.json?.token, 'string');
    const before = new Set(await tree(state.dir));
    const ruled = forma(state.dir, ['decide', 'rule', state.surprise, '--shown', shown.json.token,
      '--verdict', 'real finding', '--level', 'specification', '--target', 'door-model',
      '--words', 'Admit a repeated close.', '--by', 'Fixture owner',
      '--provider', DEVELOPER.provider, '--model', DEVELOPER.model, '--session', DEVELOPER.session, '--json']);
    assert.equal(ruled.status, 0, ruled.stderr || ruled.stdout);
    const paths = (await tree(state.dir)).filter((path) => !before.has(path) && path.includes('/decisions/') && path.endsWith('.md'));
    assert.equal(paths.length, 1);
    const bytes = await read(state.dir, paths[0]);
    const at = bytes.match(/^\| At \| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \|$/m)?.[1];
    assert.ok(at);
    const name = `${at.slice(0, 19).replace(/[-:]/g, '')}Z-rule-${sha256(bytes).slice(0, 12)}`;
    assert.equal(paths[0].split('/').at(-1), `${name}.md`);
    const item = `repair:${name}/door-model`;
    assert.ok(missing(state.dir).items.some((entry) => entry.item === item));
    const model = await fixtureFiles('engine-tlc');
    const oldModel = model['models/door-model/Door.tla'];
    model['models/door-model/Door.tla'] = oldModel.replace('Close == /\\ phase = "open"', 'Close == /\\ phase \\in {"open", "closed"}');
    const mechanism = 'Allows closing a door that is already closed.';
    expectAccepted(await send(state.dir, item, { ...model,
      'repair.md': `| Field | Value |\n| --- | --- |\n| Mechanism | ${mechanism} |\n`,
    }), item);
    assert.equal(await read(state.dir, 'models/door-model/Door.tla'), model['models/door-model/Door.tla']);
    const line = engineReceipt(await read(state.dir, 'models/door-model/receipt')).find((entry) => entry.file === 'Door.tla');
    assert.deepEqual(line.answers, [name]);
    assert.equal(line.before, sha256(oldModel));
    assert.deepEqual(line.mechanisms, [{ decision: name, mechanism: mechanism }]);
    assert.ok(!missing(state.dir).items.some((entry) => entry.item === item));
  });
});

describe('door.md §read-checks — explanation and ruling read checks', () => {
  // evidence.md §weaker, §explain: a lifecycle
  // explanation cannot have weaker forms. door.md §forma-answer: no
  // tracked file changes when its answer is refused.
  test('door.md §answer-holds: a lifecycle Explain answer refuses weaker forms', async () => {
    const { dir, item, surprise } = await engineSurprise();
    const files = engineExplanation(surprise);
    files['explain.md'] = files['explain.md'].replace('| Weaker | none |', '| Weaker | broad |');
    files['weaker/broad.md'] = (await fixtureFiles('engine-encoding'))[ENGINE_SLOT];
    const before = await record(dir);
    expectCountedRefusal(await send(dir, item, files, EXPLAINER), item);
    assert.deepEqual(await record(dir), before);
  });

  // door.md §change, and evidence.md §explain: a
  // receipt-matching explanation with the wrong Basis is a change at read;
  // evidence.md §surprise-file owes the explanation again.
  test('door.md §read-checks: an accepted explanation naming the wrong basis is a change at read', async () => {
    const { dir, item, surprise } = await engineSurprise();
    expectAccepted(await send(dir, item, engineExplanation(surprise), EXPLAINER), item);
    const path = `models/${surprise}.explained.md`;
    const wrong = (await read(dir, path)).replace(`| Basis | ${surprise.slice(-12)} |`, '| Basis | 000000000000 |');
    const lines = engineReceipt(await read(dir, ENGINE_RECEIPT)).map((line) =>
      line.file === path.split('/').at(-1) ? { ...line, sha256: sha256(wrong) } : line);
    await writeFiles(dir, { [path]: wrong, [ENGINE_RECEIPT]: receiptText(lines) });
    const items = missing(dir).items;
    assert.ok(items.some((entry) => entry.item === `change:${path}`));
    assert.ok(items.some((entry) => entry.item === item));
  });

  // door.md §change, and evidence.md §explain:
  // receipt matching does not replace the weaker form's encoding checks.
  test('door.md §read-checks: an accepted weaker form that fails its encoding checks is a change at read', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const state = await engineTlcBaseSurprise();
    expectAccepted(await send(state.dir, state.item, engineTlcExplanation(state), EXPLAINER), state.item);
    const path = `models/${state.surprise}.weaker-broad.tla`;
    const wrong = 'Invariant == MissingName\n';
    const receipt = 'models/door-model/parts/door/claims/open/receipt';
    const lines = engineReceipt(await read(state.dir, receipt)).map((line) =>
      line.file === path.split('/').at(-1) ? { ...line, sha256: sha256(wrong) } : line);
    await writeFiles(state.dir, { [path]: wrong, [receipt]: receiptText(lines) });
    assert.ok(changes(missing(state.dir)).some((entry) => entry.item === `change:${path}`));
  });

  // decisions.md §kinds: a rule with a Pin unlike the Shown
  // fence's SHA-256 is no decision; decisions.md §decision-file, and door.md §change,
  //: a correctly named invalid decision still becomes change.
  test('door.md §read-checks: a correctly named ruling with the wrong Shown pin is a change', async () => {
    const state = await engineRuling();
    const files = await snapshot(state.dir);
    const path = Object.keys(files).find((file) => file.endsWith(`/${state.decisionName}.md`));
    const bytes = files[path].replace(/^\| Pin \| [0-9a-f]{64} \|$/m, `| Pin | ${'0'.repeat(64)} |`);
    const filename = `${state.decisionName.slice(0, -12)}${sha256(bytes).slice(0, 12)}.md`;
    const invalidPath = `${path.slice(0, path.lastIndexOf('/') + 1)}${filename}`;
    delete files[path];
    files[invalidPath] = bytes;
    const dir = await project(null, files);
    assert.ok(changes(missing(dir)).some((entry) => entry.item === `change:${invalidPath}`));
  });
});

// These regressions exercise the door's read/answer checks through the public
// commands; presentation.md §reading fixes the JSON fields inspected below.
describe('door.md §read-checks — clarified lifecycle and account reads', () => {
  for (const cell of ['empty', 'posed']) {
    test(`door.md §read-checks: stepping into ${cell === 'empty' ? 'an empty' : 'a posed'} lifecycle cell reports unchecked and stops`, async () => {
      // forms.md §page-rules permits empty action cells; forms.md §lifecycles permits posed cells; lifecycle-tool.md §stepping ends stepping at either.
      // lifecycle-tool.md §findings reports unchecked, not step-refused, and findings
      // never refuse a Restate answer. door.md §forma-answer accepts it.
      const pages = await fixtureFiles('engine-lifecycle');
      const brief = pages['design/brief/overview.md'];
      delete pages['design/brief/overview.md'];
      pages[ENGINE_LIFE] = pages[ENGINE_LIFE].replace('| open | closed |',
        `| open | ${cell === 'empty' ? '' : 'choice:close-rule'} |`);
      // The second close would be refused at closed if stepping incorrectly
      // treated the unknown first outcome as an admitted move to closed.
      const journey = 'design/parts/door/journeys/close/README.md';
      pages[journey] += '| 2 | Door controller | close | none | - | - |\n';
      if (cell === 'posed') Object.assign(pages, await fixtureFiles('choice'));
      const dir = await seeded({ 'design/brief/overview.md': brief });
      const item = 'passage:design/brief/overview.md#door';
      expectAccepted(await send(dir, item, pages), item);
      const finding = missing(dir).items.find((entry) => entry.item === 'findings:door');
      // account.md §items and lifecycle-tool.md §findings make this
      // blocking journey finding an item. account.md §commands gives
      // found but fixes no nested schema. Match the mandated finding code and
      // cell content (lifecycle-tool.md §stepping; lifecycle-tool.md §findings), using
      // design.md §pins's entry name, without assuming an object shape.
      assert.ok(finding);
      const found = JSON.stringify(finding.found);
      assert.ok(found.includes('unchecked'));
      assert.ok(found.includes('door/journeys/close'));
      assert.ok(found.includes('open') && found.includes('close'));
      assert.ok(!found.includes('step-refused'));
      // door.md §read-checks and design.md §at-read:
      // valid page forms do not become change items because of these findings.
      assert.ok(!changes(missing(dir)).some((entry) =>
        entry.item === `change:${ENGINE_LIFE}` || entry.item === `change:${journey}`));
    });
  }

  test('door.md §read-checks: an accepted claim appears only under Accepted and returns to Open after withdrawal', async () => {
    // decisions.md §kinds, §in-force: an acceptance pins the
    // claim and stands until withdrawn. account.md §standing names
    // accepted standing; account.md §basis-line, presentation.md §reading fix
    // its heading and acceptance metadata.
    const dir = await engineProject();
    engineRun(dir);
    const accepted = decision({ kind: 'accept', on: 'door/claims/open', pin: engineClaimPin(),
      rows: [['Choice', 'accept']], words: 'The risk is acceptable for this exercise.',
      at: '2024-01-01T00:01:00.000Z' });
    const folder = 'design/parts/door/claims/open/decisions';
    await writeFiles(dir, { [`${folder}/${accepted.name}.md`]: accepted.bytes });
    // project.md §commands; presentation.md §reading.
    const result = forma(dir, ['account', 'door', '--json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const part = result.json.parts.find((entry) => entry.ref === 'door');
    assert.ok(part);
    assert.ok(!part.open.some((entry) => entry.ref === 'door/claims/open'));
    assert.ok(!part.established.some((entry) => entry.ref === 'door/claims/open'));
    const claim = part.accepted.find((entry) => entry.ref === 'door/claims/open');
    assert.ok(claim);
    assert.equal(claim.standing, 'accepted');
    assert.deepEqual(Object.keys(claim.acceptance).sort(), ['at', 'by', 'decision', 'words']);
    assert.equal(claim.acceptance.decision, accepted.name);
    assert.equal(claim.acceptance.by, 'Fixture owner');
    assert.equal(claim.acceptance.at, '2024-01-01T00:01:00.000Z');
    // account.md §basis-line, presentation.md §reading preserve the words, but do
    // not fix whether the decision fence's framing LF (account.md §standing of
    // decisions.md) is retained in the JSON string. Check the words without
    // imposing that representation choice; preserve all other whitespace.
    assert.equal(claim.acceptance.words.replace(/\n$/, ''), 'The risk is acceptable for this exercise.');
    // presentation.md §reading: the distinct Accepted heading follows Open and precedes Established.
    const text = forma(dir, ['account', 'door']);
    assert.equal(text.status, 0, text.stderr || text.stdout);
    const headings = [...text.stdout.matchAll(/^### (Open|Accepted|Established)$/gm)].map((match) => match[1]);
    assert.deepEqual(headings, ['Open', 'Accepted', 'Established']);
    const withdrawn = decision({ kind: 'accept', on: 'door/claims/open', pin: engineClaimPin(),
      rows: [['Choice', 'withdraw']], at: '2024-01-01T00:02:00.000Z' });
    await writeFiles(dir, { [`${folder}/${withdrawn.name}.md`]: withdrawn.bytes });
    const next = forma(dir, ['account', 'door', '--json']);
    assert.equal(next.status, 0, next.stderr || next.stdout);
    const after = next.json.parts.find((entry) => entry.ref === 'door');
    assert.ok(after.open.some((entry) => entry.ref === 'door/claims/open'));
    assert.ok(!after.established.some((entry) => entry.ref === 'door/claims/open'));
    assert.ok(!after.accepted.some((entry) => entry.ref === 'door/claims/open'));
  });

  test('door.md §read-checks: offered journey keys remain stable when another offered journey is confirmed', async () => {
    // design.md §code-journeys and decisions.md §confirm:
    // keys are reach-<lifecycle>--<phase>, independent of confirmations.
    const pages = await fixtureFiles('engine-lifecycle');
    delete pages['design/parts/door/journeys/close/README.md'];
    pages['design/parts/door/README.md'] = '# Door\n\n1. [Door phase](lifecycles/state/)\n2. [Stays open](claims/open/)\n';
    pages[ENGINE_LIFE] = pages[ENGINE_LIFE].replace('| open | closed |', '| open | latched |\n| latched | closed |');
    // design.md §pins: sorted canonical cells and no final LF.
    const lifePin = sha256([
      'Entity: Door (entity, machine, -, -)', 'Initial: open', 'Ends: closed',
      'Unaffected: ', `Cites: ${enginePassage}`,
      'Cell: closed | Closes the door. | None.',
      'Cell: latched | Closes the door. | closed',
      'Cell: open | Closes the door. | latched',
    ].join('\n'));
    const files = await acceptedFiles(pages);
    for (const [on, pin, folder] of [
      ['parts', enginePartsPin, 'design'],
      ['door/lifecycles/state', lifePin, 'design/parts/door/lifecycles/state'],
    ]) {
      const confirmed = decision({ kind: 'confirm', on, pin });
      files[`${folder}/decisions/${confirmed.name}.md`] = confirmed.bytes;
    }
    const dir = await seeded(files);
    const latched = 'door/journeys/reach-state--latched';
    const closed = 'door/journeys/reach-state--closed';
    const items = missing(dir).items.map((entry) => entry.item);
    // account.md §items gives confirm:<unit>; design.md §code-journeys offers both.
    assert.ok(items.includes(`confirm:${latched}`));
    assert.ok(items.includes(`confirm:${closed}`));
    // decisions.md §forma-show fixes on and token; decisions.md §forma-decide
    // records the confirmation with exit status 0.
    const shown = forma(dir, ['show', 'confirm', latched, '--json']);
    assert.equal(shown.status, 0, shown.stderr || shown.stdout);
    assert.equal(shown.json.on, latched);
    const before = new Set(await tree(dir));
    const decided = forma(dir, ['decide', 'confirm', latched, '--shown', shown.json.token,
      '--by', 'Fixture owner', '--provider', DEVELOPER.provider, '--model', DEVELOPER.model,
      '--session', DEVELOPER.session, '--json']);
    assert.equal(decided.status, 0, decided.stderr || decided.stdout);
    // decisions.md §filing files added journeys' decisions in the
    // part; decisions.md §confirm fixes On and the ## Journey heading.
    const paths = (await tree(dir)).filter((path) => !before.has(path)
      && path.startsWith('design/parts/door/decisions/') && path.endsWith('.md'));
    assert.equal(paths.length, 1);
    const bytes = await read(dir, paths[0]);
    assert.ok(bytes.includes(`| On | ${latched} |`));
    assert.ok(bytes.includes(`### ${latched}`));
    const next = missing(dir).items.map((entry) => entry.item);
    assert.ok(!next.includes(`confirm:${latched}`));
    assert.ok(next.includes(`confirm:${closed}`));
    // presentation.md §reading and design.md §code-journeys:
    // the confirmed offered journey remains readable under its unchanged key.
    const account = forma(dir, ['account', latched, '--json']);
    assert.equal(account.status, 0, account.stderr || account.stdout);
    assert.equal(account.json.scope, latched);
  });
});

describe('door.md §forma-give — optional claim-slot packets', () => {
  for (const kind of ['witness', 'fault']) {
    // door.md §forma-give to §gives; models.md §owed: the generic item remains usable by give
    // after its first slot is filled; its packet still includes the accepted slots.
    test(`door.md §forma-give: give accepts an already filled generic ${kind} item`, async () => {
      const dir = await engineProject({ encoding: true });
      const item = `slot:lifecycles-door/parts/door/claims/open/${kind}`;
      const files = await fixtureFiles(`engine-${kind}`);
      expectAccepted(await send(dir, item, files, SLOT_WRITER), item);
      assert.ok(!missing(dir).items.some((entry) => entry.item === item));
      const before = await record(dir);
      const packet = await givePacket(dir, item);
      for (const [path, bytes] of Object.entries(files)) assert.equal(packet.files[path], bytes);
      assert.equal(packet.files[ENGINE_CLAIM], await read(dir, ENGINE_CLAIM));
      assert.deepEqual(await record(dir), before);
    });
  }
});

describe('door.md §repair-answer — property-wrong repair alternatives', () => {
  // door.md §gives, §repair-answer; decisions.md §rulings, §expects: the same repair can be
  // answered by restating the claim or refilling its encoding on its model.
  test('door.md §gives: a property-wrong repair packet combines Restate and model inputs and contracts', async () => {
    const { dir, repairItem } = await engineRuling('property wrong');
    const packet = await givePacket(dir, repairItem);
    for (const path of ['design/brief/overview.md', 'design/README.md', ENGINE_CLAIM, ENGINE_LIFE, ENGINE_SLOT]) {
      assert.equal(packet.files[path], await read(dir, path));
    }
    assert.deepEqual(Object.keys(packet.files).filter((path) => path.startsWith('forma/')),
      ['forma/account.md', 'forma/decisions.md', 'forma/design.md', 'forma/door.md', 'forma/engines.md', 'forma/evidence.md', 'forma/forms.md', 'forma/lifecycle-tool.md', 'forma/models.md', 'forma/presentation.md']);
  });

  for (const kind of ['claim page', 'encoding']) {
    // door.md §repair-answer to §receipts; decisions.md §rulings, §expects; models.md §model-repair: either kind
    // meets the repair, recording the ruling and the changed file's old hash.
    test(`door.md §repair-answer: a property-wrong repair can change only the ${kind}`, async () => {
      const { dir, repairItem, decisionName } = await engineRuling('property wrong');
      const path = kind === 'claim page' ? ENGINE_CLAIM : ENGINE_SLOT;
      const before = await read(dir, path);
      const life = await read(dir, ENGINE_LIFE);
      const bytes = kind === 'claim page'
        ? before.replace('The door stays open.', 'The door can be closed by the operator.')
        : before.replace('| state | closed |', '| state | open |');
      const mechanism = 'Corrects the stated forbidden condition.';
      expectAccepted(await send(dir, repairItem, { [path]: bytes,
        'repair.md': `| Field | Value |\n| --- | --- |\n| Mechanism | ${mechanism} |\n`,
      }), repairItem);
      assert.equal(await read(dir, path), bytes);
      assert.equal(await read(dir, ENGINE_LIFE), life);
      const receipt = kind === 'claim page' ? 'design/parts/door/claims/open/receipt' : ENGINE_RECEIPT;
      const line = engineReceipt(await read(dir, receipt)).find((entry) => entry.file === path.split('/').at(-1));
      assert.deepEqual(line.answers, [decisionName]);
      assert.equal(line.before, sha256(before));
      assert.deepEqual(line.mechanisms, [{ decision: decisionName, mechanism: mechanism }]);
      assert.ok(!missing(dir).items.some((entry) => entry.item === repairItem));
    });
  }

  // models.md §model-repair; door.md §forma-answer to §repair-answer: a model-side property repair changes the
  // ruled encoding and none of the model's own lifecycle pages.
  test('door.md §repair-answer: a property-wrong encoding repair refuses a changed model lifecycle', async () => {
    const { dir, repairItem } = await engineRuling('property wrong');
    const before = await record(dir);
    expectCountedRefusal(await send(dir, repairItem, {
      [ENGINE_SLOT]: (await read(dir, ENGINE_SLOT)).replace('| state | closed |', '| state | open |'),
      [ENGINE_LIFE]: (await read(dir, ENGINE_LIFE)).replace('# Door phase', '# Revised door phase'),
      'repair.md': '| Field | Value |\n| --- | --- |\n| Mechanism | Changes both the claim and its model. |\n',
    }), repairItem);
    assert.deepEqual(await record(dir), before);
  });

  // models.md §model-repair; door.md §forma-answer to §repair-answer: adding a fault alone changes no input of
  // the ruled base question, even though the verdict requires such a fault.
  test('door.md §repair-answer: a real-finding repair refuses a matching fault without a changed question input', async () => {
    const { dir, repairItem } = await engineRuling('real finding');
    const before = await record(dir);
    expectCountedRefusal(await send(dir, repairItem, { ...await fixtureFiles('engine-fault'),
      'repair.md': '| Field | Value |\n| --- | --- |\n| Mechanism | Refusing a second close on a closed door. |\n',
    }), repairItem);
    assert.deepEqual(await record(dir), before);
  });
});

describe('door.md §gives — an Explain item carries why it was sent back', () => {
  // evidence.md §sent-back; account.md §commands; door.md §gives: the guarded step is
  // named in found, and exactly that item is copied into the packet.
  test('door.md §gives: a guarded lifecycle surprise carries its sent-back reason in found', async () => {
    const dir = await engineProject({ encoding: true });
    const path = 'design/parts/door/actions.md';
    const bytes = (await read(dir, path)).replace('| none | none | stated |', '| none | The operator has permission. | stated |');
    const receipt = 'design/parts/door/receipt';
    const lines = engineReceipt(await read(dir, receipt)).filter((line) => line.file !== 'actions.md');
    await writeFiles(dir, { [path]: bytes, [receipt]: receiptText([...lines, makeReceipt('actions.md', bytes)]) });
    // design.md §pins to §confirmation-pins: adding the guard changes both referencing pins.
    engineDecide(dir, 'confirm', 'door/lifecycles/state');
    engineDecide(dir, 'confirm', 'door/journeys/close');
    expectAccepted(await send(dir, ENGINE_ITEM, { [ENGINE_SLOT]: await read(dir, ENGINE_SLOT) }, SLOT_WRITER), ENGINE_ITEM);
    const ran = engineRun(dir);
    const base = await readJSON(dir, `models/${ENGINE_BASE}.json`);
    const digest = sha256(`${JSON.stringify(base.basis, null, 2)}\n`);
    const surprise = `${ENGINE_BASE}.surprise-${digest.slice(0, 12)}`;
    assert.ok(ran.opened.includes(surprise));
    const item = missing(dir).items.find((entry) => entry.item === `explain:${surprise}`);
    assert.ok(item && Object.hasOwn(item, 'found'));
    assert.ok(item.found !== null && JSON.stringify(item.found).length > 2);
    const packet = await givePacket(dir, item.item);
    assert.deepEqual(packet.item.item, item);
  });
});

// decisions.md §forma-show to §forma-decide: public showing tokens bind each fixture decision.
function engineDecide(dir, kind, on, options = []) {
  const shown = forma(dir, ['show', kind, on, '--json']);
  assert.equal(shown.status, 0, shown.stderr || shown.stdout);
  assert.equal(typeof shown.json?.token, 'string');
  const result = forma(dir, ['decide', kind, on, '--shown', shown.json.token, ...options,
    '--by', 'Fixture owner', '--provider', DEVELOPER.provider, '--model', DEVELOPER.model,
    '--session', DEVELOPER.session, '--json']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.json;
}

// engines.md §model-phases: a model has no Phases row when the design has no lifecycle.
// These hand-written variants keep the existing confirmed one-action journey.
async function engineWithoutLifecycle(extra = {}) {
  const original = await engineProject();
  const files = await snapshot(original);
  delete files[ENGINE_LIFE];
  delete files['design/parts/door/lifecycles/state/receipt'];
  for (const path of Object.keys(files)) {
    if (path.startsWith('design/parts/door/lifecycles/state/decisions/')) delete files[path];
  }
  files['design/parts/door/README.md'] = files['design/parts/door/README.md']
    .replace('1. [Door phase](lifecycles/state/)\n', '');
  Object.assign(files, extra);
  return project(null, await acceptedFiles(files));
}
function engineNoPhases(model) {
  return Object.fromEntries(Object.entries(model).map(([path, bytes]) => [path,
    path.endsWith('/model.md') ? bytes.replace('| door/state | d \\in {1} | Phase(d) |\n', '') : bytes]));
}

describe('door.md §read-checks — questions of unpicked action alternatives', () => {
  for (const elsewhere of [false, true]) {
    // evidence.md §questions; account.md §journey-rules; engines.md §model-actions: the action stays in
    // the model table, but only an unpicked alternative owes no enabled question.
    test(`door.md §read-checks: an unpicked-only action ${elsewhere ? 'still owes enabled when another journey uses it' : 'owes no enabled question'}`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      const pages = await fixtureFiles('engine-lifecycle');
      const actions = 'design/parts/door/actions.md';
      const choicePath = 'design/parts/door/choices/close-rule/README.md';
      let choice = (await fixtureFiles('choice'))[choicePath];
      choice = choice.replace(/\n\| Lifecycle \| Phase \| Action \| Outcome \|\n\| --- \| --- \| --- \| --- \|\n\| state \| open \| close \| (?:closed|open) \|\n/g, '\n');
      const split = choice.indexOf('## b');
      choice = choice.slice(0, split) + choice.slice(split)
        .replace('| 1 | Door controller | close | none | - | - |',
          '| 1 | Door controller | wait | none | - | - |\n| 2 | Door controller | wait | none | - | - |');
      const extra = {
        [actions]: pages[actions] + '| wait | operator | Waits for the operator. | none | none | stated | design/brief/overview.md#door |\n',
        [choicePath]: choice,
      };
      if (elsewhere) extra['design/parts/door/journeys/wait/README.md'] = pages['design/parts/door/journeys/close/README.md']
        .replace('# Closing a door', '# Waiting').replace('The door is closed.', 'The door stays open.')
        .replace('| close |', '| wait |');
      const dir = await engineWithoutLifecycle(extra);
      engineDecide(dir, 'pick', 'door/choices/close-rule', ['--choice', 'a']);
      const model = engineNoPhases(await fixtureFiles('engine-tlc'));
      model['models/door-model/model.md'] = model['models/door-model/model.md']
        .replace('| door/close | Close | none |', '| door/close | Close | none |\n| door/wait | Wait | none |');
      model['models/door-model/Door.tla'] = model['models/door-model/Door.tla'].replace('====', 'Wait == UNCHANGED phase\n====');
      expectAccepted(await send(dir, 'cover:door', model), 'cover:door');
      const items = missing(dir).items;
      const question = `door-model/actions/door/wait.${ENGINE_EMPTY_BOUNDS}`;
      assert.equal(items.some((entry) => entry.item === `run:${question}`), elsewhere);
      assert.ok(items.some((entry) => entry.item === `run:door-model/actions/door/close.${ENGINE_EMPTY_BOUNDS}`));
    });
  }
});

async function engineTypeInvariantSurprise() {
  const pages = await fixtureFiles('engine-lifecycle');
  const actions = 'design/parts/door/actions.md';
  const dir = await engineWithoutLifecycle({
    [actions]: pages[actions] + '| break | operator | Breaks the door. | none | none | stated | design/brief/overview.md#door |\n',
  });
  const model = engineNoPhases(await fixtureFiles('engine-tlc'));
  model['models/door-model/model.md'] = model['models/door-model/model.md']
    .replace('| door/close | Close | none |', '| door/close | Close | none |\n| door/break | Break | none |');
  model['models/door-model/Door.tla'] = model['models/door-model/Door.tla']
    .replace('====', 'Break == /\\ phase = "closed"\n         /\\ phase\' = "broken"\n====');
  expectAccepted(await send(dir, 'cover:door', model), 'cover:door');
  for (const [path, bytes] of Object.entries(await fixtureFiles('engine-tlc-slots'))) {
    const item = `slot:${path.slice(7).replace(/\.[^.]+$/, '')}`;
    expectAccepted(await send(dir, item, { [path]: path.endsWith('encoding.tla') ? 'Invariant == TRUE\n' : bytes }, SLOT_WRITER), item);
  }
  engineRun(dir);
  const question = `door-model/parts/door/claims/open/base.${ENGINE_EMPTY_BOUNDS}`;
  const base = await readJSON(dir, `models/${question}.json`);
  // engines.md §tlc, evidence.md §outcomes: type checking precedes the encoding's TRUE.
  assert.equal(base.found.outcome, 'violation');
  assert.equal(base.found.property, 'TypeOK');
  const digest = sha256(`${JSON.stringify(base.basis, null, 2)}\n`);
  const surprise = `${question}.surprise-${digest.slice(0, 12)}`;
  return { dir, question, surprise, item: `explain:${surprise}` };
}

describe('door.md §answer-holds — weaker forms concern only the encoded property', () => {
  // evidence.md §weaker, §explain; door.md §answer-holds to §forma-answer: a violation of the encoding's
  // own property requires at least one weaker form.
  test('door.md §answer-holds: a TLC property-violation explanation refuses missing weaker forms', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const state = await engineTlcBaseSurprise();
    const files = engineTlcExplanation(state);
    files['explain.md'] = files['explain.md'].replace('| Weaker | broad |', '| Weaker | none |');
    delete files['weaker/broad.tla'];
    const before = await record(state.dir);
    expectCountedRefusal(await send(state.dir, state.item, files, EXPLAINER), state.item);
    assert.deepEqual(await record(state.dir), before);
  });
  for (const weaker of [false, true]) {
    // evidence.md §explain check 3: a base surprise of the type invariant takes
    // no weaker forms, because changing the property cannot change that failure.
    test(`door.md §answer-holds: a TLC type-invariant explanation ${weaker ? 'refuses weaker forms' : 'accepts no weaker forms'}`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      const state = await engineTypeInvariantSurprise();
      const files = engineTlcExplanation(state);
      if (!weaker) {
        files['explain.md'] = files['explain.md'].replace('| Weaker | broad |', '| Weaker | none |');
        delete files['weaker/broad.tla'];
      }
      const before = await record(state.dir);
      const result = await send(state.dir, state.item, files, EXPLAINER);
      if (weaker) {
        expectCountedRefusal(result, state.item);
        assert.deepEqual(await record(state.dir), before);
      } else expectAccepted(result, state.item);
    });
  }
});

// models.md §one-model-first to §owed: the original TLC model covers two parts. Only door's
// claim is inexpressible, so a new model covering door alone is a split.
async function engineSplitProject() {
  const original = await engineWithoutLifecycle();
  const files = await snapshot(original);
  files['design/README.md'] = files['design/README.md']
    .replace('| door | Controls a door. | design/brief/overview.md#door |',
      '| door | Controls a door. | design/brief/overview.md#door |\n| observer | Observes the door. | design/brief/overview.md#door |')
    + '2. [Observer](parts/observer/)\n';
  files['design/parts/observer/README.md'] = '# Observer\n';
  files['design/parts/observer/actions.md'] = '# Actions\n\n| Action | Actor | Sentence | Cases | Guard | Origin | Cites |\n| --- | --- | --- | --- | --- | --- | --- |\n';
  files['design/parts/observer/boundary.md'] = '# Boundary\n\n## Boundary\n\n| Row | Names | Kind | Side | Seam | Isolation | Reads | Writes | Origin | Cites |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
  const dir = await project(null, await acceptedFiles(files));
  engineDecide(dir, 'confirm', 'parts');
  const model = engineNoPhases(await fixtureFiles('engine-tlc'));
  model['models/door-model/model.md'] = model['models/door-model/model.md'].replace('| Parts | door |', '| Parts | door, observer |');
  const cover = missing(dir).items.find((entry) => entry.item.startsWith('cover:'));
  assert.ok(cover);
  expectAccepted(await send(dir, cover.item, model), cover.item);
  const item = 'slot:door-model/parts/door/claims/open/encoding';
  expectAccepted(await send(dir, item, {
    'models/door-model/parts/door/claims/open/encoding.md': '| Field | Value |\n| --- | --- |\n| Cannot express | This engine cannot express the required condition. |\n',
  }, SLOT_WRITER), item);
  assert.ok(missing(dir).items.some((entry) => entry.item === 'express:door/claims/open'));
  return dir;
}

describe('door.md §answer-holds — a split that supplies an inexpressible claim', () => {
  for (const engine of ['alloy', 'tlc']) {
    // models.md §model-answer check 6, models.md §one-model-first, §owed; door.md §answer-holds to §forma-answer: without unanswered
    // evidence, an inexpressible claim permits a split only to another engine.
    test(`door.md §answer-holds: an inexpressible claim ${engine === 'alloy' ? 'permits an Alloy split from TLC' : 'does not permit another TLC split'}`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      const dir = await engineSplitProject();
      let files;
      if (engine === 'alloy') files = await fixtureFiles('engine-alloy-split');
      else files = Object.fromEntries(Object.entries(engineNoPhases(await fixtureFiles('engine-tlc')))
        .map(([path, bytes]) => [path.replace('/door-model/', '/small-door/'), bytes]));
      const before = await record(dir);
      const item = 'express:door/claims/open';
      const result = await send(dir, item, files);
      if (engine === 'alloy') {
        expectAccepted(result, item);
        for (const [path, bytes] of Object.entries(files)) assert.equal(await read(dir, path), bytes);
      } else {
        expectCountedRefusal(result, item);
        assert.deepEqual(await record(dir), before);
      }
    });
  }

  // evidence.md §measures: absent optional command bounds stay null, and the
  // engine owns exactly duration, scope, steps and bitwidth as its measures.
  test('door.md §read-checks: Alloy evidence contains exactly its measures with null omitted command bounds', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const dir = await engineSplitProject();
    expectAccepted(await send(dir, 'express:door/claims/open', await fixtureFiles('engine-alloy-split')), 'express:door/claims/open');
    const result = engineRun(dir);
    const run = result.ran.find((entry) => entry.name.startsWith('small-door/facts.'));
    assert.ok(run);
    const evidence = await readJSON(dir, `models/${run.name}.json`);
    expectKeys(evidence.measures, ['duration', 'scope', 'steps', 'bitwidth']);
    assert.equal(evidence.measures.scope, 2);
    assert.equal(evidence.measures.steps, null);
    assert.equal(evidence.measures.bitwidth, null);
  });
});


describe('door.md §read-checks — a frozen model rejects new engine files', () => {
  // models.md §freeze; door.md §read-checks to §change: held snapshots the existing engine files,
  // and a newly merged engine file is discounted even with an accepted receipt.
  test('door.md §read-checks: an engine file absent from held counts for nothing while a surprise is open', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const state = await engineTlcBaseSurprise();
    const path = 'models/door-model/Extra.tla';
    const bytes = '---- MODULE Extra ----\nValue == TRUE\n====\n';
    const receipt = 'models/door-model/receipt';
    const evidence = await readJSON(state.dir, `models/${state.surprise}.json`);
    assert.ok(!evidence.held.some((file) => file.path === path));
    const lines = engineReceipt(await read(state.dir, receipt));
    await writeFiles(state.dir, { [path]: bytes,
      [receipt]: receiptText([...lines, makeReceipt('Extra.tla', bytes)]),
    });
    assert.ok(changes(missing(state.dir)).some((entry) => entry.item === `change:${path}`));
  });
});
