import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerFolder, forma, hasToolchain, project, read, sha256, snapshot, writeFiles,
} from './helpers/forma.mjs';

const WRITER = { provider: 'engine-fixture', model: 'writer', session: 'answerer' };
const OWNER = { provider: 'engine-owner', model: 'reviewer', session: 'decider' };
const args = (who) => ['--provider', who.provider, '--model', who.model, '--session', who.session];
const native = { skip: !hasToolchain && 'toolchain absent' };
const CLAIM = 'alpha/claims/safe';
const CHOICE = 'alpha/choices/policy';
const CITE = 'design/brief/system.md#workflow';

function success(result) {
  // project.md §commands: successful --json commands return one object and status 0.
  assert.equal(result.status, 0, `Forma should succeed:\n${result.stderr}\n${result.stdout}`);
  assert.ok(result.json && typeof result.json === 'object' && !Array.isArray(result.json));
  return result.json;
}

async function decide(dir, kind, on, options = []) {
  const shown = success(forma(dir, ['show', kind, on, '--json']));
  return success(forma(dir, ['decide', kind, on, '--shown', shown.token,
    ...options, '--by', 'Owner', ...args(OWNER), '--json']));
}

async function answer(dir, item, files) {
  return forma(dir, ['answer', item, await answerFolder(files), ...args(WRITER), '--json']);
}

async function acceptAnswer(dir, item, files) {
  // door.md §forma-answer: accepted answer result, rather than an uncounted command refusal.
  const result = success(await answer(dir, item, files));
  assert.equal(result.accepted, true);
  return result;
}

async function setup() {
  const fixture = await project('decisions/two-engines');
  const files = await snapshot(fixture);
  const pages = Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith('design/')));
  const dir = await project(null, pages);
  // door.md §receipts: handwritten accepted pages, with exact JSON.stringify receipt lines.
  const folders = new Map();
  for (const [path, bytes] of Object.entries(pages)) {
    if (path.startsWith('design/brief/')) continue;
    const folder = path.slice(0, path.lastIndexOf('/'));
    const rows = folders.get(folder) ?? [];
    rows.push({ file: path.slice(path.lastIndexOf('/') + 1), sha256: sha256(bytes),
      at: '2025-01-01T00:00:00.000Z', session: WRITER, authors: [WRITER] });
    folders.set(folder, rows);
  }
  for (const [folder, rows] of folders) {
    rows.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
    await writeFiles(dir, { [`${folder}/receipt`]: `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` });
  }
  // door.md §copies: tracked support file's prescribed bytes.
  await writeFiles(dir, { 'design/.gitattributes': '* -text -ident -filter -working-tree-encoding\nreceipt merge=union\nbrief/** !text !ident !filter !working-tree-encoding !merge\n' });
  success(forma(dir, ['decide', 'intake', '--situation', 'design new', '--words', 'Only request processing is examined.',
    '--answers', '30', '--runs', '30', '--tlc-seconds', '10', '--tlc-megabytes', '512',
    '--alloy-seconds', '10', '--alloy-megabytes', '512', '--by', 'Owner', ...args(OWNER), '--json']));
  await decide(dir, 'confirm', 'parts');
  await decide(dir, 'confirm', CLAIM);
  await acceptAnswer(dir, 'cover:alpha+beta', Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith('models/'))));
  const candidate = Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith('candidate/')).map(([path, bytes]) => [path.slice('candidate/'.length), bytes]));
  return { dir, files, candidate };
}

const missing = (dir) => success(forma(dir, ['missing', '--json'])).items;
// evidence.md §bounds to §question-names: no bounds means the digest of zero bound lines;
// question names omit models/ and .json, while evidence paths include both.
const enabled = (action) => `whole/actions/alpha/${action}.${sha256('').slice(0, 12)}`;
const reasonEncoding = '| Field | Value |\n| --- | --- |\n| Cannot express | This finite model does not express the request identity relation. |\n';

async function cannotExpress(dir) {
  // account.md §items: slot item names omit their extension; models.md §slots permits
  // encoding.md to give a reason on either native engine.
  const item = missing(dir).find(({ item }) => item.startsWith('slot:') && item.endsWith('whole/parts/alpha/claims/safe/encoding'))?.item;
  assert.ok(item);
  await acceptAnswer(dir, item, {
    'models/whole/parts/alpha/claims/safe/encoding.md': reasonEncoding,
  });
  assert.ok(missing(dir).some(({ item }) => item === `express:${CLAIM}`));
}

describe('decisions.md §pick — picks change enabled obligations', () => {
  test('decisions.md §pick an action exclusive to the unpicked alternative owes no enabled question', native, async () => {
    const { dir } = await setup();
    // evidence.md §questions; account.md §journey-rules: before a pick, every action is owed.
    assert.ok(missing(dir).some(({ item }) => item === `run:${enabled('wait')}`));
    await decide(dir, 'pick', CHOICE, ['--choice', 'a']);
    const items = missing(dir).map(({ item }) => item);
    assert.ok(!items.includes(`run:${enabled('wait')}`));
    assert.ok(items.includes(`run:${enabled('advance')}`));
    // forms.md §choices, design.md §code-journeys: the alternatives have different step counts, so no
    // generated must-not journey introduces another use of wait.
    const model = success(forma(dir, ['account', '--json'])).models.find(({ model }) => model === 'whole');
    assert.ok(model);
    assert.ok(!model.fails.some((failure) => failure.rule === 'enabled' && JSON.stringify(failure).includes('alpha/wait')));
  });

  test('decisions.md §pick another journey keeps an unpicked action owed', native, async () => {
    const { dir } = await setup();
    // forms.md §journeys; door.md §receipts: a written journey is sufficient to make the
    // action nonexclusive; evidence.md §questions does not require that journey confirmed.
    const path = 'design/parts/alpha/journeys/idle/README.md';
    const page = '# Idle\n\n| Field | Value |\n| --- | --- |\n| Polarity | should happen |\n| Expected end | Waiting completes. |\n| Refused step | - |\n| Origin | added |\n| Cites | ' + CITE + ' |\n\n| Step | Actor | Action | Arguments | Entity | Case |\n| --- | --- | --- | --- | --- | --- |\n| 1 | Worker | wait | - | - | - |\n';
    await writeFiles(dir, { [path]: page, 'design/parts/alpha/journeys/idle/receipt': JSON.stringify({ file: 'README.md', sha256: sha256(page), at: '2025-01-01T00:00:00.000Z', session: WRITER, authors: [WRITER] }) + '\n' });
    await decide(dir, 'pick', CHOICE, ['--choice', 'a']);
    assert.ok(missing(dir).some(({ item }) => item === `run:${enabled('wait')}`));
  });

  test('decisions.md §pick changing the pick exchanges the exclusive enabled obligations', native, async () => {
    const { dir } = await setup();
    await decide(dir, 'pick', CHOICE, ['--choice', 'a']);
    await decide(dir, 'pick', CHOICE, ['--choice', 'b']);
    // evidence.md §questions and decisions.md §in-force: only the pick in force selects grain.
    const items = missing(dir).map(({ item }) => item);
    assert.ok(items.includes(`run:${enabled('wait')}`));
    assert.ok(!items.includes(`run:${enabled('advance')}`));
  });

  test('decisions.md §pick TLC evidence contains duration and only TLC measures', native, async () => {
    const { dir } = await setup();
    success(forma(dir, ['run', '--json']));
    const evidence = JSON.parse(await read(dir, `models/${enabled('advance')}.json`));
    // evidence.md §measures: exactly duration/states/depth, null if unreported;
    // no timing value, state count or execution order is prescribed here.
    assert.deepEqual(Object.keys(evidence.measures).sort(), ['depth', 'duration', 'states']);
    for (const value of Object.values(evidence.measures)) assert.ok(value === null || typeof value === 'number');
  });
});

describe('decisions.md §accept — another engine before accepting risk', () => {
  test('decisions.md §accept an unexpressible claim allows a smaller model on another engine', native, async () => {
    const { dir, candidate } = await setup();
    await cannotExpress(dir);
    // models.md §one-model-first to §owed: no unanswered evidence is needed for this exception.
    assert.ok(!missing(dir).some(({ item }) => item.startsWith('unanswered:')));
    await acceptAnswer(dir, `express:${CLAIM}`, candidate);
    const models = success(forma(dir, ['account', '--json'])).models;
    assert.ok(models.some((model) => model.model === 'small' && model.engine === 'alloy' && model.parts.includes('alpha')));
    success(forma(dir, ['run', '--json']));
    // evidence.md §bounds, §question-names, §measures: one explicit scope, with omitted steps and int
    // left to Alloy's defaults and therefore recorded as null.
    const digest = sha256('scope = 1\n').slice(0, 12);
    const evidence = JSON.parse(await read(dir, `models/small/facts.${digest}.json`));
    assert.deepEqual(Object.keys(evidence.measures).sort(), ['bitwidth', 'duration', 'scope', 'steps']);
    assert.ok(evidence.measures.duration === null || typeof evidence.measures.duration === 'number');
    assert.ok(evidence.measures.scope === null || evidence.measures.scope === 1);
    assert.equal(evidence.measures.steps, null);
    assert.equal(evidence.measures.bitwidth, null);
  });

  test('decisions.md §accept an unexpressible claim does not allow a smaller model on the same engine', native, async () => {
    const { dir, files } = await setup();
    await cannotExpress(dir);
    const smaller = {
      'models/small/model.md': files['models/whole/model.md'].replace('| Parts | alpha, beta |', '| Parts | alpha |').replace('| Entry | Whole.tla |', '| Entry | Small.tla |'),
      'models/small/Small.tla': files['models/whole/Whole.tla'].replace('MODULE Whole', 'MODULE Small'),
    };
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    const result = await answer(dir, `express:${CLAIM}`, smaller);
    // models.md §one-model-first and door.md §forma-answer: same-engine split has neither exception,
    // and a counted refusal preserves tracked bytes.
    assert.equal(result.status, 1);
    assert.ok(result.json, result.stderr);
    assert.equal(result.json.accepted, false);
    assert.ok(result.json.reasons.length > 0);
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
  });
});
