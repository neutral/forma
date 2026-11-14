import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerFolder, forma, project, read, sha256, snapshot, tempFolder, tree, writeFiles,
} from './helpers/forma.mjs';

const CITE = 'design/brief/system.md#workflow';
const LIFE = 'alpha/lifecycles/request';
const LIFE_PATH = `design/parts/${LIFE}/README.md`;
const JOURNEY = 'alpha/journeys/complete';
const JOURNEY_PATH = `design/parts/${JOURNEY}/README.md`;
const CLAIM = 'alpha/claims/safe';
const CLAIM_PATH = `design/parts/${CLAIM}/README.md`;
const SLOT_FOLDER = 'models/lifecycles-alpha/parts/alpha/claims/safe';
const ENCODING = `${SLOT_FOLDER}/encoding.md`;
const AUTHOR = { provider: 'fixture', model: 'writer', session: 'original-author' };
const DECIDER = { provider: 'owner', model: 'reviewer', session: 'developer' };
const EXPLAINER = { provider: 'independent', model: 'reviewer', session: 'explainer' };
const AT = '2025-01-01T00:00:00.000Z';
const session = (who) => ['--provider', who.provider, '--model', who.model, '--session', who.session];
const fields = (rows) => `| Field | Value |\n| --- | --- |\n${rows.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n`;
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const transition = '| Lifecycle | From | Action | To |\n| --- | --- | --- | --- |\n| request | done | wait | ready |\n';
const forbiddenDone = '| Lifecycle | Phase |\n| --- | --- |\n| request | done |\n';

// forms.md §page-rules permits reordered columns, optional outer pipes and code-span
// cells. Read the public generated table by its named columns, not its layout.
function tableRows(markdown, column) {
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '')
    .split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/^`(.*)`$/, '$1'));
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => cells(line).some((cell) => cell.toLowerCase() === column));
  assert.ok(start >= 0, `The public table must contain ${column}`);
  const headers = cells(lines[start]).map((cell) => cell.toLowerCase());
  const rows = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.includes('|')) break;
    const values = cells(line);
    assert.equal(values.length, headers.length);
    rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index]])));
  }
  return rows;
}

function success(result) {
  // project.md §commands: a successful --json command exits 0 with one object.
  assert.equal(result.status, 0, `Forma should succeed:\n${result.stderr}\n${result.stdout}`);
  assert.ok(result.json && typeof result.json === 'object' && !Array.isArray(result.json));
  return result.json;
}

function refuseShow(dir, kind, on) {
  const result = forma(dir, ['show', kind, on, '--json']);
  // decisions.md §forma-show: show refusals use status 1 and {refused:[...]}.
  assert.equal(result.status, 1);
  assert.ok(result.json, `Expected a refusal, not a missing CLI:\n${result.stderr}`);
  assert.deepEqual(Object.keys(result.json), ['refused']);
  assert.ok(Array.isArray(result.json.refused) && result.json.refused.length > 0);
  return result.json.refused;
}

// door.md §receipts: handwritten fixture receipts hash exact bytes,
// end every JSON line with LF, and keep one accepted entry per file here.
async function accepted(dir, files, who = AUTHOR) {
  await writeFiles(dir, files);
  const receipts = new Map();
  for (const [path, content] of Object.entries(files)) {
    const at = path.lastIndexOf('/');
    const folder = path.slice(0, at);
    const file = path.slice(at + 1);
    if (!receipts.has(folder)) {
      const old = await read(dir, `${folder}/receipt`);
      receipts.set(folder, old ? old.trim().split('\n').map(JSON.parse) : []);
    }
    const rows = receipts.get(folder).filter((row) => row.file !== file);
    rows.push({ file, sha256: sha256(content), at: AT, session: who, authors: [who] });
    receipts.set(folder, rows);
  }
  for (const [folder, rows] of receipts) {
    rows.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
    await writeFiles(dir, { [`${folder}/receipt`]: `${rows.map(JSON.stringify).join('\n')}\n` });
  }
}

async function decide(dir, kind, on, args = []) {
  const shown = success(forma(dir, ['show', kind, on, '--json']));
  return success(forma(dir, ['decide', kind, on, '--shown', shown.token,
    ...args, '--by', 'Project owner', ...session(DECIDER), '--json']));
}

async function base() {
  const dir = await project('decisions/request');
  const pages = await snapshot(dir);
  await accepted(dir, Object.fromEntries(Object.entries(pages).filter(([path]) => !path.startsWith('design/brief/'))));
  // door.md §copies: valid tracked fixture folders have their git attributes.
  await writeFiles(dir, { 'design/.gitattributes': '* -text -ident -filter -working-tree-encoding\nreceipt merge=union\nbrief/** !text !ident !filter !working-tree-encoding !merge\n' });
  success(forma(dir, ['decide', 'intake', '--situation', 'design new', '--words', 'Examine completion.',
    '--answers', '100', '--runs', '100', '--lifecycle-seconds', '10', '--by', 'Project owner', ...session(DECIDER), '--json']));
  await decide(dir, 'confirm', 'parts');
  return dir;
}

const missing = (dir) => success(forma(dir, ['missing', '--json'])).items;
const itemNames = (dir) => missing(dir).map((entry) => entry.item);

function claimSlotItem(dir, leaf) {
  // account.md §items: the item identifies the claim slot without its extension.
  // Use the public item's name rather than choosing a meaning of "under models/".
  const item = missing(dir).find((entry) => entry.item.startsWith('slot:')
    && entry.item.endsWith(`/alpha/claims/safe/${leaf}`));
  assert.ok(item, `missing must offer the safe claim's ${leaf} slot`);
  return item;
}

async function answer(dir, item, files, who = AUTHOR) {
  const folder = await answerFolder(files);
  return forma(dir, ['answer', item, folder, ...session(who), '--json']);
}

async function acceptedAnswer(dir, item, files, who = AUTHOR) {
  const result = success(await answer(dir, item, files, who));
  // door.md §forma-answer: accepted answers report accepted:true.
  assert.equal(result.accepted, true);
  return result;
}

async function refusedAnswer(dir, item, files, who = AUTHOR) {
  const result = await answer(dir, item, files, who);
  // door.md §forma-answer: counted refusals are answer-result objects.
  assert.equal(result.status, 1);
  assert.ok(result.json, `Expected answer refusal JSON:\n${result.stderr}`);
  assert.equal(result.json.accepted, false);
  assert.ok(Array.isArray(result.json.reasons) && result.json.reasons.length > 0);
  return result.json;
}

function findingText(dir) {
  // account.md §commands: findings: items expose their found information;
  // lifecycle-tool.md §findings fixes codes, not their JSON nesting.
  return JSON.stringify(missing(dir).find((entry) => entry.item === 'findings:alpha')?.found) ?? '';
}

// forms.md §choices: a choice poses exactly this cell, with distinct alternatives.
function policyPage() {
  const alternative = fields([['Polarity', 'should happen'], ['Expected end', 'The request completes.'], ['Refused step', '-']])
    + '\n| Step | Actor | Action | Arguments | Entity | Case |\n| --- | --- | --- | --- | --- | --- |\n| 1 | Worker | advance | - | - | - |\n'
    + '\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| request | ready | advance | done |\n';
  return '# Completion policy\n\n'
    + fields([['Question', 'Should completion proceed?'], ['Recommendation', 'a: complete promptly'], ['Cites', CITE]])
    + `\n## a\n\n${alternative}\n## b\n\n${alternative.replace('The request completes.', 'The worker observes completion.')}`;
}

// engines.md §slot-forms: lifecycle witness combination and fault overlay forms.
const witnessPage = fields([['Meaning', 'A request completes.']]) + '\n' + forbiddenDone;
const faultPage = fields([['Action', '-'], ['Mechanism', 'Completion bypasses its protection.']])
  + '\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| request | ready | advance | done |\n';

// Fixtures model a merge with valid receipt authentication. Keep slot pins and
// all prior fields, changing only its exact bytes and hash (door.md §receipts).
async function mergedBytes(dir, path, content) {
  const at = path.lastIndexOf('/');
  const receipt = `${path.slice(0, at)}/receipt`;
  const file = path.slice(at + 1);
  const rows = (await read(dir, receipt)).trim().split('\n').map(JSON.parse);
  for (const row of rows) if (row.file === file) row.sha256 = sha256(content);
  await writeFiles(dir, { [path]: content, [receipt]: `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` });
}

// Harness-only clone of a merged/deleted-file scenario, preserving every other
// byte and its receipt. No production implementation is imported.
async function withoutFiles(dir, paths) {
  return project(null, Object.fromEntries(Object.entries(await snapshot(dir))
    .filter(([path]) => !paths.includes(path))));
}

async function examined({ violation = false, encoding = true, prepare, fill } = {}) {
  const dir = await base();
  if (prepare) await prepare(dir);
  await decide(dir, 'confirm', LIFE);
  await decide(dir, 'confirm', JOURNEY);
  await decide(dir, 'confirm', CLAIM);
  if (encoding) await acceptedAnswer(dir, claimSlotItem(dir, 'encoding').item, { [ENCODING]: violation ? forbiddenDone : transition });
  if (fill) await fill(dir);
  const result = success(forma(dir, ['run', '--json']));
  return { dir, result };
}

async function surprise(dir) {
  const records = [];
  // evidence.md §stems fixes the surprise file suffix.
  for (const path of (await tree(dir)).filter((path) => /\.surprise-[a-f0-9]{12}\.json$/.test(path))) {
    records.push({ path, data: JSON.parse(await read(dir, path)) });
  }
  // evidence.md §questions, §surprise-file: forbidden done is reachable,
  // so its base violation opens a surprise.
  const found = records.find(({ data }) => data.kind === 'base');
  assert.ok(found, 'the reachable forbidden phase must open a base surprise');
  return found;
}

function explanation(data, weaker = 'none') {
  // evidence.md §basis: basis digest and Explain form.
  return fields([['Question', data.question], ['Basis', sha256(json(data.basis)).slice(0, 12)],
    ['Verdict', 'model wrong'], ['Level', 'specification'], ['Weaker', weaker]])
    + '\n## Trace\n\nThe worker completes the request.\n\n## Failure shape\n\nCompletion reaches a forbidden phase.\n\n## Mechanism\n\nThe completion transition has no protection.\n';
}

describe('decisions.md §confirm, §forma-show — clarified page checks before confirmation', () => {
  test('decisions.md §confirm shared premise and boundary keys are resolution failures, not malformed pages', async () => {
    const dir = await base();
    const path = 'design/parts/alpha/premises/request/README.md';
    const page = '# Request reliability\n\n' + fields([['Statement', 'Requests persist.'], ['Class', 'world'],
      ['Why not examined', 'not verifiable here: Persistence is outside the lifecycle.'], ['Falsifier', 'A request disappears.'],
      ['Provider', 'The infrastructure operator'], ['Origin', 'added'], ['Cites', CITE]]);
    await accepted(dir, { [path]: page });
    const names = itemNames(dir);
    // forms.md §page-rules; design.md §at-read: one key space,
    // duplicate names owe Restate while both well-formed pages continue to count.
    assert.ok(names.includes('restate:alpha'));
    assert.ok(!names.includes(`change:${path}`));
    assert.ok(!names.includes('change:design/parts/alpha/boundary.md'));
    const refused = await refusedAnswer(dir, 'restate:alpha', { [path]: page });
    // design.md §restate-checks check 2; door.md §forma-answer.
    assert.ok(refused.reasons.length > 0);
    await acceptedAnswer(dir, 'restate:alpha', { 'removed.md': 'design/parts/alpha/premises/request\n' });
    // design.md §removal: removing the duplicate clears that resolution debt.
    assert.ok(!itemNames(dir).includes('restate:alpha'));
    success(forma(dir, ['show', 'confirm', LIFE, '--json']));
  });

  test('decisions.md §confirm an empty lifecycle action cell counts as a page and blocks confirmation as empty-cell', async () => {
    const dir = await base();
    const page = (await read(dir, LIFE_PATH)).replace('| ready | done | ready |', '| ready | done |  |');
    await accepted(dir, { [LIFE_PATH]: page });
    // forms.md §page-rules; forms.md §lifecycles: only action cells may be empty.
    assert.ok(!itemNames(dir).includes(`change:${LIFE_PATH}`));
    // lifecycle-tool.md §findings; decisions.md §confirm.
    assert.match(findingText(dir), /empty-cell/);
    refuseShow(dir, 'confirm', LIFE);
    success(forma(dir, ['show', 'decline', LIFE, '--json']));
    // design.md §restate-checks check 4: findings do not refuse a Restate answer.
    await acceptedAnswer(dir, 'findings:alpha', { [LIFE_PATH]: page });
  });

  for (const [label, path, before, after, on] of [
    ['Phase', LIFE_PATH, '| ready | done | ready |', '|  | done | ready |', LIFE],
    ['Initial', LIFE_PATH, '| Initial | ready |', '| Initial |  |', LIFE],
    ['journey Arguments', JOURNEY_PATH, '| 1 | Worker | advance | - | - | - |', '| 1 | Worker | advance |  | - | - |', JOURNEY],
    ['claim Sentence', CLAIM_PATH, '| Sentence | A request completes safely. |', '| Sentence |  |', CLAIM],
  ]) {
    test(`decisions.md §confirm an empty ${label} cell is a form failure rather than an allowed lifecycle gap`, async () => {
      const dir = await base();
      await accepted(dir, { [path]: (await read(dir, path)).replace(before, after) });
      // forms.md §page-rules; design.md §at-read: empty nonaction
      // cells fail the page's own form, even when the cell would contain a key.
      assert.ok(itemNames(dir).includes(`change:${path}`));
      refuseShow(dir, 'confirm', on);
    });
  }

  test('decisions.md §confirm lifecycle matrix columns may place Phase between actions without lapsing confirmation', async () => {
    const dir = await base();
    await decide(dir, 'confirm', LIFE);
    const page = (await read(dir, LIFE_PATH)).replace(
      '| Phase | advance | wait |\n| --- | --- | --- |\n| ready | done | ready |\n| done | None. | done |',
      '| wait | Phase | advance |\n| --- | --- | --- |\n| ready | ready | done |\n| done | done | None. |');
    await accepted(dir, { [LIFE_PATH]: page });
    const names = itemNames(dir);
    // forms.md §page-rules; forms.md §lifecycles: every column may move.
    assert.ok(!names.includes(`change:${LIFE_PATH}`));
    assert.ok(!names.includes('restate:alpha'));
    // design.md §pins sorts canonical matrix cells;
    // decisions.md §in-force and account.md §items:
    // unchanged pin retains confirmation and owes no new confirmation.
    assert.ok(!names.includes(`confirm:${LIFE}`));
    success(forma(dir, ['show', 'confirm', LIFE, '--json']));
  });

  for (const posed of [false, true]) {
    test(`decisions.md §confirm a journey stops at an ${posed ? 'unpicked posed' : 'empty'} cell with unchecked`, async () => {
      const dir = await base();
      const value = posed ? 'choice:policy' : '';
      const page = (await read(dir, LIFE_PATH)).replace('| ready | done | ready |', `| ready | ${value} | ready |`);
      const files = { [LIFE_PATH]: page };
      if (posed) {
        const alternative = fields([['Polarity', 'should happen'], ['Expected end', 'The request completes.'], ['Refused step', '-']])
          + '\n| Step | Actor | Action | Arguments | Entity | Case |\n| --- | --- | --- | --- | --- | --- |\n| 1 | Worker | advance | - | - | - |\n'
          + '\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| request | ready | advance | done |\n';
        files['design/parts/alpha/choices/policy/README.md'] = '# Completion policy\n\n'
          + fields([['Question', 'Should completion proceed?'], ['Recommendation', 'a: complete promptly'], ['Cites', CITE]])
          + `\n## a\n\n${alternative}\n## b\n\n${alternative.replace('The request completes.', 'The worker observes completion.')}`;
      }
      await accepted(dir, files);
      // lifecycle-tool.md §stepping; lifecycle-tool.md §findings: the journey is
      // unchecked at this cell, not admitted or refused there.
      assert.match(findingText(dir), /unchecked/);
      refuseShow(dir, 'confirm', JOURNEY);
      success(forma(dir, ['show', 'decline', JOURNEY, '--json']));
      if (posed) {
        // lifecycle-tool.md §findings: a posed cell itself blocks
        // no lifecycle confirmation, even though the journey is unchecked.
        success(forma(dir, ['show', 'confirm', LIFE, '--json']));
        await decide(dir, 'pick', 'alpha/choices/policy', ['--choice', 'a']);
        // decisions.md §pick: the pick fills the posed cell.
        success(forma(dir, ['show', 'confirm', JOURNEY, '--json']));
      }
    });
  }

  test('decisions.md §confirm an empty action-case outcome leaves the page valid and the journey unchecked', async () => {
    const dir = await base();
    await accepted(dir, {
      'design/parts/alpha/actions.md': (await read(dir, 'design/parts/alpha/actions.md'))
        .replace('| Complete the request. | none |', '| Complete the request. | fast, slow |'),
      [LIFE_PATH]: (await read(dir, LIFE_PATH))
        .replace('| ready | done | ready |', '| ready | fast: done<br>slow: | ready |')
        .replace('| done | None. | done |', '| done | fast: None.<br>slow: None. | done |'),
      [JOURNEY_PATH]: (await read(dir, JOURNEY_PATH))
        .replace('| 1 | Worker | advance | - | - | - |', '| 1 | Worker | advance | - | - | slow |'),
    });
    // forms.md §lifecycles: a case outcome may be empty;
    // design.md §at-read: that allowance leaves the page in its own form.
    assert.ok(!itemNames(dir).includes(`change:${LIFE_PATH}`));
    // lifecycle-tool.md §stepping; lifecycle-tool.md §findings:
    // the empty outcome is empty-cell on the lifecycle and unchecked on the journey.
    assert.match(findingText(dir), /empty-cell/);
    assert.match(findingText(dir), /unchecked/);
    refuseShow(dir, 'confirm', JOURNEY);
  });
});

describe('decisions.md §who-decides, §intake — refused answers preserve the tracked record', () => {
  test('decisions.md §intake a refused Restate changes no tracked file but spends and remembers its refusal', async () => {
    const dir = await base();
    const original = await read(dir, LIFE_PATH);
    await accepted(dir, { [LIFE_PATH]: original.replace('| Initial | ready |', '| Initial |  |') });
    const item = `change:${LIFE_PATH}`;
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    const refusal = await refusedAnswer(dir, item, { [LIFE_PATH]: original.replace('| Ends | done |', '| Ends |  |') });
    // design.md §restate-applied; door.md §copies: the
    // no-change promise applies to design/ and models/, not local scratch.
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    // door.md §forma-answer; door.md §scratch.
    const persisted = JSON.parse(await read(dir, `work/refused/${sha256(item).slice(0, 12)}.json`));
    assert.deepEqual(persisted, { item, refusals: [refusal.reasons] });
    assert.equal(JSON.parse(await read(dir, 'work/spent.json')).answers, 1);
    assert.ok(JSON.parse(await read(dir, 'work/sessions.json')).some((who) =>
      who.provider === AUTHOR.provider && who.model === AUTHOR.model && who.session === AUTHOR.session));
    // account.md §commands: the same missing item shows its local refusal.
    assert.deepEqual(missing(dir).find((entry) => entry.item === item).refused, [refusal.reasons]);
    // presentation.md §reading; account.md §commands:
    // a thing's account reads local refusals and includes every item about it.
    const account = success(forma(dir, ['account', LIFE, '--json']));
    assert.deepEqual(account.thing.items.find((entry) => entry.item === item).refused, [refusal.reasons]);
  });

  test('decisions.md §confirm an unterminated receipt line does not authenticate a page for confirmation', async () => {
    const dir = await base();
    const receipt = 'design/parts/alpha/claims/safe/receipt';
    await writeFiles(dir, { [receipt]: (await read(dir, receipt)).slice(0, -1) });
    const names = itemNames(dir);
    // door.md §receipts: the last line needs LF and
    // an unparseable line does not provide an accepted entry for its page.
    assert.ok(names.includes(`change:${receipt}`));
    assert.ok(names.includes(`change:${CLAIM_PATH}`));
    refuseShow(dir, 'confirm', CLAIM);
  });
});

describe('decisions.md §rulings, §forma-show — a surprise holds the model and all claim slots', () => {
  test('decisions.md §rulings held follows basis and pins all claim slots including ones the question did not read', async () => {
    const witness = `${SLOT_FOLDER}/witness-completion.md`;
    const fault = `${SLOT_FOLDER}/fault-completion.md`;
    const { dir } = await examined({ violation: true, fill: async (at) => {
      await acceptedAnswer(at, claimSlotItem(at, 'witness').item, { [witness]: witnessPage });
      await acceptedAnswer(at, claimSlotItem(at, 'fault').item, { [fault]: faultPage });
    } });
    const open = await surprise(dir);
    // evidence.md §surprise-file fixes held's position, byte ordering, row keys and hashes;
    // models.md §freeze holds all claim slots, not only the question's inputs.
    const keys = Object.keys(open.data);
    assert.equal(keys[keys.indexOf('basis') + 1], 'held');
    const paths = [LIFE_PATH, ENCODING, fault, witness].sort();
    assert.deepEqual(open.data.held, await Promise.all(paths.map(async (path) => ({
      path, sha256: sha256(await read(dir, path)),
    }))));
    assert.ok(!open.data.basis.files.some((entry) => entry.path === witness));
    assert.ok(!open.data.basis.files.some((entry) => entry.path === fault));
  });

  test('decisions.md §rulings a Restate answer holding identical frozen lifecycle bytes is refused', async () => {
    const { dir } = await examined({ violation: true });
    const open = await surprise(dir);
    // design.md §at-read: an unrelated unresolved reference supplies a real Restate
    // item, so rejection cannot merely be "item not missing".
    const other = 'design/parts/alpha/claims/other/README.md';
    await accepted(dir, { [other]: (await read(dir, CLAIM_PATH)).replace('| Rests on | none |', '| Rests on | unknown |') });
    assert.ok(itemNames(dir).includes('restate:alpha'));
    const original = await read(dir, LIFE_PATH);
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    await refusedAnswer(dir, 'restate:alpha', { [LIFE_PATH]: original });
    // models.md §freeze refuses holding the file whatever its bytes; door.md §forma-answer
    // identifies each check and preserves every tracked file on refusal.
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    assert.ok(await read(dir, open.path));
  });

  test('decisions.md §rulings a held witness changed by a merge is discounted until its bytes are restored', async () => {
    const path = `${SLOT_FOLDER}/witness-completion.md`;
    const { dir } = await examined({ violation: true, fill: async (at) => {
      await acceptedAnswer(at, claimSlotItem(at, 'witness').item, { [path]: witnessPage });
    } });
    const open = await surprise(dir);
    const held = json(open.data.held);
    // models.md §freeze: an unread slot is still held and a receipt-authenticated
    // change counts for nothing. A new receipt cannot bypass its held SHA-256.
    assert.ok(!open.data.basis.files.some((file) => file.path === path));
    await mergedBytes(dir, path, witnessPage.replace('A request completes.', 'Completion is observed.'));
    assert.ok(itemNames(dir).includes(`change:${path}`));
    // An answer cannot even restore the held bytes while the surprise is open.
    await refusedAnswer(dir, `change:${path}`, { [path]: witnessPage });
    await mergedBytes(dir, path, witnessPage);
    assert.ok(!itemNames(dir).includes(`change:${path}`));
    assert.equal(json(JSON.parse(await read(dir, open.path)).held), held);
  });

  test('decisions.md §rulings a removed held encoding stays owed and waits for its ruling', async () => {
    const original = await examined({ violation: true });
    const open = await surprise(original.dir);
    const dir = await withoutFiles(original.dir, [ENCODING]);
    // models.md §freeze, §owed; account.md §items: deleting held input does not clear
    // its freeze or permit the missing slot to be answered.
    const owed = claimSlotItem(dir, 'encoding');
    assert.ok(owed.waits.includes(`rule:${open.data.name}`));
    await refusedAnswer(dir, owed.item, { [ENCODING]: forbiddenDone });
    assert.equal(await read(dir, ENCODING), null);
    assert.deepEqual(JSON.parse(await read(dir, open.path)).held, open.data.held);
  });

  test('decisions.md §rulings a receipt-authenticated new witness merged into an open surprise counts for nothing', async () => {
    const path = `${SLOT_FOLDER}/witness-merged.md`;
    const receipt = `${SLOT_FOLDER}/receipt`;
    let merged;
    const { dir } = await examined({ violation: true, fill: async (at) => {
      // Make a legitimate independent pre-surprise branch through the door.
      const branch = await project(null, await snapshot(at));
      await acceptedAnswer(branch, claimSlotItem(branch, 'witness').item, { [path]: witnessPage });
      merged = { [path]: await read(branch, path), [receipt]: await read(branch, receipt) };
    } });
    const open = await surprise(dir);
    await writeFiles(dir, merged);
    // models.md §freeze applies to new slots at read, regardless of which branch
    // accepted them or their valid receipt and pins.
    assert.ok(!open.data.held.some((file) => file.path === path));
    assert.ok(itemNames(dir).includes(`change:${path}`));
    await refusedAnswer(dir, `change:${path}`, { [path]: witnessPage });
    const restored = await withoutFiles(dir, [path]);
    assert.ok(!itemNames(restored).includes(`change:${path}`));
    assert.deepEqual(JSON.parse(await read(restored, open.path)).held, open.data.held);
  });

  for (const kind of ['witness', 'fault']) {
    test(`decisions.md §rulings an open base surprise refuses a new ${kind} slot absent from held`, async () => {
      const { dir } = await examined({ violation: true });
      const open = await surprise(dir);
      const path = `${SLOT_FOLDER}/${kind}-later.md`;
      const content = kind === 'witness' ? fields([['Meaning', 'A request completes.']]) + '\n' + forbiddenDone
        : fields([['Action', '-'], ['Mechanism', 'Completion bypasses its protection.']])
          + '\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| request | ready | advance | done |\n';
      // models.md §freeze and evidence.md §surprise-file: new claim slots are frozen too.
      assert.ok(!open.data.held.some((file) => file.path === path));
      // account.md §items: every slot of this claim on this model waits for its rule.
      const owed = claimSlotItem(dir, kind);
      assert.ok(owed.waits.includes(`rule:${open.data.name}`));
      const before = await snapshot(dir, { skip: ['work', 'runs'] });
      await refusedAnswer(dir, owed.item, { [path]: content });
      // models.md §freeze; door.md §forma-answer: refusing the new slot leaves the record intact.
      assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
      assert.equal(await read(dir, path), null);
      assert.ok(await read(dir, open.path));
    });
  }

  test('decisions.md §forma-show a held lifecycle stays frozen after changed bytes make it count for nothing', async () => {
    const { dir } = await examined({ violation: true });
    const open = await surprise(dir);
    const original = await read(dir, LIFE_PATH);
    // models.md §freeze; evidence.md §surprise-file: held pins the confirmed lifecycle's bytes.
    assert.ok(open.data.held.some((file) => file.path === LIFE_PATH && file.sha256 === sha256(original)));
    const changed = original.replace('# Request lifecycle', '# Request lifecycle after a merge');
    await accepted(dir, { [LIFE_PATH]: changed });
    // models.md §freeze: discounted pages do not redefine held; even a heading-only
    // byte change is frozen.
    assert.ok(itemNames(dir).includes(`change:${LIFE_PATH}`));
    refuseShow(dir, 'confirm', LIFE);
    refuseShow(dir, 'decline', LIFE);
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    await refusedAnswer(dir, `change:${LIFE_PATH}`, { [LIFE_PATH]: changed });
    // models.md §freeze; design.md §restate-applied.
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    await accepted(dir, { [LIFE_PATH]: original });
    // models.md §freeze: restoring exact bytes ends that change;
    // models.md §freeze: the still-open surprise continues to prohibit decisions.
    assert.ok(!itemNames(dir).includes(`change:${LIFE_PATH}`));
    refuseShow(dir, 'confirm', LIFE);
  });

  test('decisions.md §rulings historical receipt authors cannot explain the lifecycle model they authored', async () => {
    const { dir } = await examined({ violation: true });
    const open = await surprise(dir);
    const path = 'design/parts/alpha/lifecycles/request/receipt';
    const current = JSON.parse((await read(dir, path)).trim());
    const past = { ...current, at: '2024-01-01T00:00:00.000Z', session: EXPLAINER, authors: [EXPLAINER] };
    await writeFiles(dir, { [path]: `${JSON.stringify(past)}\n${JSON.stringify(current)}\n` });
    // door.md §receipts: authors are the union across receipt lines,
    // including the older line that is not the file's selected entry.
    await refusedAnswer(dir, `explain:${open.data.name}`, { 'explain.md': explanation(open.data) }, EXPLAINER);
    // decisions.md §rulings: an unaccepted explanation leaves the ruling waiting.
    refuseShow(dir, 'rule', open.data.name);
  });

  test('decisions.md §rulings an author of only an unconfirmed lifecycle page may explain that part model', async () => {
    const { dir } = await examined({ violation: true, prepare: async (at) => {
      const path = 'design/parts/alpha/lifecycles/other/README.md';
      // design.md §pins and decisions.md §in-force: distinct content keeps this
      // lifecycle's pin separate, so confirming request leaves other unconfirmed.
      await accepted(at, { [path]: (await read(at, LIFE_PATH))
        .replace('# Request lifecycle', '# Other lifecycle')
        .replace('| done | None. | done |', '| done | done | done |') }, EXPLAINER);
    } });
    const open = await surprise(dir);
    // door.md §receipts: only confirmed lifecycle pages supply the model's authors.
    // evidence.md §explain and decisions.md §rulings: this independent explanation readies the rule.
    await acceptedAnswer(dir, `explain:${open.data.name}`, { 'explain.md': explanation(open.data) }, EXPLAINER);
    success(forma(dir, ['show', 'rule', open.data.name, '--json']));
  });

  test('decisions.md §rulings a lifecycle explanation refuses weaker forms and accepts none', async () => {
    const { dir } = await examined({ violation: true });
    const open = await surprise(dir);
    // evidence.md §questions; evidence.md §weaker; evidence.md §explain check 3,
    // evidence.md §explain check 3: weaker forms exist only for TLC and Alloy base surprises.
    await refusedAnswer(dir, `explain:${open.data.name}`, {
      'explain.md': explanation(open.data, 'softer'), 'weaker/softer.md': transition,
    }, EXPLAINER);
    await acceptedAnswer(dir, `explain:${open.data.name}`, { 'explain.md': explanation(open.data) }, EXPLAINER);
    // decisions.md §rulings: no lifecycle reductions or weaker runs
    // remain; the independent explanation makes the ruling available.
    success(forma(dir, ['show', 'rule', open.data.name, '--json']));
  });
});

describe('decisions.md §intake — evidence records only its engine measures', () => {
  test('decisions.md §intake a lifecycle run records exactly duration and combinations', async () => {
    const { dir, result } = await examined({ encoding: false });
    // evidence.md §questions, §forma-run: the sole confirmed journey is the only question.
    assert.equal(result.ran.length, 1);
    const run = result.ran[0];
    const scratch = JSON.parse(await read(dir, `runs/${run.name}/basis.json`));
    // evidence.md §runs fixes the scratch record's keys, but not their order.
    assert.deepEqual(Object.keys(scratch).sort(), ['basis', 'finished', 'name']);
    const evidence = JSON.parse(await read(dir, `models/${run.name}.json`));
    // evidence.md §measures: duration and this engine's combinations, each once and no other.
    assert.deepEqual(Object.keys(evidence.measures).sort(), ['combinations', 'duration']);
    for (const value of Object.values(evidence.measures)) {
      assert.ok(value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0));
    }
  });

  test('decisions.md §intake answered current evidence owes no second run at unchanged limits', async () => {
    const { dir, result } = await examined({ encoding: false });
    const name = result.ran[0].name;
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    // evidence.md §written, §forma-run; account.md §items: there is no standalone alone reason.
    assert.ok(!missing(dir).some((entry) => entry.item === `run:${name}`));
    const again = success(forma(dir, ['run', '--json']));
    assert.ok(!again.ran.some((run) => run.name === name));
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
  });
});

describe('decisions.md §confirm — revised lifecycle stepping before confirmation', () => {
  test('decisions.md §pick a posed lifecycle engine flag owes pick without a flagged Restate item', async () => {
    const { dir, result } = await examined({ prepare: async (at) => {
      await accepted(at, {
        [LIFE_PATH]: (await read(at, LIFE_PATH)).replace('| ready | done | ready |', '| ready | done | choice:policy |'),
        'design/parts/alpha/choices/policy/README.md': policyPage().replaceAll('advance', 'wait'),
      });
    } });
    const evidence = await Promise.all(result.ran.map(async (run) => JSON.parse(await read(dir, `models/${run.name}.json`))));
    // evidence.md §flags: the reached posed cell remains an engine open-pair flag.
    const baseEvidence = evidence.find((entry) => entry.kind === 'base');
    assert.ok(baseEvidence);
    assert.ok(baseEvidence.flags.some((flag) => flag.startsWith('open-pair ')));
    // account.md §items: that posed flag belongs to pick:, not restate: flagged.
    assert.ok(itemNames(dir).includes('pick:alpha/choices/policy'));
    assert.ok(!missing(dir).some((entry) => entry.item === 'restate:alpha' && entry.why === 'flagged'));
  });

  test('decisions.md §pick a confirmed journey meeting an unpicked cell keeps evidence but owes no lifecycle question', async () => {
    const { dir, result } = await examined({ encoding: false });
    const path = `models/${result.ran[0].name}.json`;
    const original = await read(dir, path);
    await accepted(dir, {
      [LIFE_PATH]: (await read(dir, LIFE_PATH)).replace('| ready | done | ready |', '| ready | choice:policy | ready |'),
      'design/parts/alpha/choices/policy/README.md': policyPage(),
    });
    // lifecycle-tool.md §findings permits confirming a posed lifecycle; the journey's
    // unknown step does not make its lifecycle confirmation contradictory.
    await decide(dir, 'confirm', LIFE);
    // evidence.md §lifecycle-journeys, §currency: unchecked stepping has no question; it keeps its
    // previous evidence, not current, and the pick is owed first.
    assert.ok(itemNames(dir).includes('pick:alpha/choices/policy'));
    assert.ok(!itemNames(dir).includes(`run:${result.ran[0].name}`));
    const account = success(forma(dir, ['account', JOURNEY, '--json']));
    assert.equal(account.thing.evidence.find((entry) => entry.question === result.ran[0].name).current, false);
    const again = success(forma(dir, ['run', '--json']));
    assert.ok(!again.ran.some((run) => run.name === result.ran[0].name));
    assert.equal(await read(dir, path), original);
  });

  for (const posed of [false, true]) {
    test(`decisions.md §confirm a lifecycle refusal takes precedence over another lifecycle's ${posed ? 'posed' : 'empty'} cell`, async () => {
      const dir = await base();
      const files = {
        [LIFE_PATH]: (await read(dir, LIFE_PATH)).replace('| ready | done | ready |', `| ready | ${posed ? 'choice:policy' : ''} | ready |`),
        'design/parts/alpha/lifecycles/gate/README.md': '# Gate lifecycle\n\n'
          + fields([['Entity', 'request'], ['Initial', 'closed'], ['Ends', 'none'], ['Unaffected', 'none'], ['Origin', 'added'], ['Cites', CITE]])
          + '\n| Phase | advance | wait |\n| --- | --- | --- |\n| closed | None. | closed |\n',
      };
      if (posed) files['design/parts/alpha/choices/policy/README.md'] = policyPage();
      await accepted(dir, files);
      // lifecycle-tool.md §stepping, §findings: refusal wins before unknown cells are considered.
      const found = findingText(dir);
      assert.match(found, /step-refused/);
      refuseShow(dir, 'confirm', JOURNEY);
      success(forma(dir, ['show', 'decline', JOURNEY, '--json']));
    });
  }

  test('decisions.md §confirm a citation-only failure owes passage and does not report unchecked', async () => {
    const dir = await base();
    const absent = 'design/brief/system.md#renamed-workflow';
    await accepted(dir, { [LIFE_PATH]: (await read(dir, LIFE_PATH)).replace(CITE, absent) });
    // lifecycle-tool.md §findings, design.md §at-read: citation resolution alone belongs to passage:;
    // it is not unchecked and the well-formed page is not a change:.
    assert.ok(itemNames(dir).includes(`passage:${absent}`));
    assert.ok(!itemNames(dir).includes(`change:${LIFE_PATH}`));
    assert.doesNotMatch(findingText(dir), /unchecked/);
  });

  for (const explicitStart of [false, true]) {
    test(`decisions.md §confirm an entered entity ${explicitStart ? 'listed in the start is already present' : 'refuses another action before entry'}`, async () => {
      const dir = await base();
      const overlay = await project('decisions/request-entered');
      const files = await snapshot(overlay);
      files[JOURNEY_PATH] = (await read(dir, JOURNEY_PATH));
      if (explicitStart) files[JOURNEY_PATH] = files[JOURNEY_PATH].replace(
        '| Step | Actor | Action | Arguments | Entity | Case |',
        '| Lifecycle | Entity | Phase |\n| --- | --- | --- |\n| request | named-request | ready |\n\n| Step | Actor | Action | Arguments | Entity | Case |');
      await accepted(dir, files);
      // lifecycle-tool.md §stepping: a start row makes the entity present; otherwise it is
      // absent until create, so advance is refused even though ready admits it.
      if (explicitStart) {
        assert.doesNotMatch(findingText(dir), /step-refused/);
        success(forma(dir, ['show', 'confirm', JOURNEY, '--json']));
      } else {
        assert.match(findingText(dir), /step-refused/);
        refuseShow(dir, 'confirm', JOURNEY);
      }
    });
  }

  test('decisions.md §confirm shortest offered journeys enter absent entities before taking other actions', async () => {
    const dir = await base();
    await accepted(dir, await snapshot(await project('decisions/request-entered')));
    await decide(dir, 'confirm', LIFE);
    const offered = 'alpha/journeys/reach-request--done';
    assert.ok(itemNames(dir).includes(`confirm:${offered}`));
    const result = await decide(dir, 'confirm', offered);
    // lifecycle-tool.md §shortest, design.md §code-journeys; decisions.md §confirm: the confirmed offer stores its
    // shortest journey, beginning with entry. Inspect the specified Markdown
    // table rather than inventing a JSON shape for account.thing.page.
    const page = await read(dir, result.recorded[0]);
    const journey = page.split('\n## Journey\n')[1].split('\n## ')[0];
    const rows = tableRows(journey, 'step');
    assert.deepEqual(rows.map((row) => [row.step, row.action]), [['1', 'create'], ['2', 'advance']]);
  });

  test('decisions.md §confirm the lifecycle tool reports unchecked at its 250000-combination bound', async () => {
    const dir = await base();
    // lifecycle-tool.md §shortest: a single linear chain needs more than 250000 distinct
    // combinations to reach its last phase, independent of exploration order.
    // A Cartesian product would not prove the cap: the tool could find all
    // shortest journeys without exploring every possible combination.
    const phases = 250002;
    const page = '# Long lifecycle\n\n'
      + fields([['Entity', 'request'], ['Initial', 'p0'], ['Ends', `p${phases - 1}`], ['Unaffected', 'wait'], ['Origin', 'added'], ['Cites', CITE]])
      + '\n| Phase | advance |\n| --- | --- |\n'
      + Array.from({ length: phases }, (_, n) => `| p${n} | ${n + 1 < phases ? `p${n + 1}` : 'None.'} |`).join('\n') + '\n';
    await accepted(dir, {
      'design/parts/alpha/lifecycles/long/README.md': page,
      [LIFE_PATH]: (await read(dir, LIFE_PATH)).replace('| ready | done | ready |', '| ready | ready | ready |'),
    });
    // The cap applies per part and reports unchecked on each lifecycle. The
    // contract gives no facts nesting or exact prose, so inspect code, subject
    // references and the named limit without selecting an invented structure.
    const found = findingText(dir);
    assert.match(found, /unchecked/);
    assert.match(found, /250,?000/);
    assert.match(found, /alpha\/lifecycles\/request/);
    assert.match(found, /alpha\/lifecycles\/long/);
    refuseShow(dir, 'confirm', LIFE);
    refuseShow(dir, 'confirm', 'alpha/lifecycles/long');
  });

  test('decisions.md §confirm phase is a reserved action key and repeated matrix action keys owe Restate', async () => {
    const dir = await base();
    const actions = 'design/parts/alpha/actions.md';
    // forms.md §page-rules reserves phase as an action key. design.md §at-read classifies every
    // name failure as resolution/placement, so the action page still counts.
    await accepted(dir, {
      [actions]: (await read(dir, actions))
        + `| phase | worker | Observe the phase. | none | none | added | ${CITE} |\n`,
      [LIFE_PATH]: (await read(dir, LIFE_PATH)).replace('| Unaffected | none |', '| Unaffected | phase |'),
    });
    assert.ok(itemNames(dir).includes('restate:alpha'));
    assert.ok(!itemNames(dir).includes(`change:${actions}`));
    const refusal = await refusedAnswer(dir, 'restate:alpha', { [actions]: await read(dir, actions) });
    assert.ok(refusal.reasons.length > 0);

    const second = await base();
    const page = (await read(second, LIFE_PATH))
      .replace('| Phase | advance | wait |', '| Phase | advance | advance | wait |')
      .replace('| --- | --- | --- |', '| --- | --- | --- | --- |')
      .replace('| ready | done | ready |', '| ready | done | done | ready |')
      .replace('| done | None. | done |', '| done | None. | None. | done |');
    await accepted(second, { [LIFE_PATH]: page });
    // forms.md §page-rules, design.md §at-read: repeated lifecycle action columns are check 2's
    // uniqueness failure, distinct from a repeated nonaction form column.
    assert.ok(itemNames(second).includes('restate:alpha'));
    assert.ok(!itemNames(second).includes(`change:${LIFE_PATH}`));
    refuseShow(second, 'confirm', LIFE);
  });
});

describe('decisions.md §confirm, §redirect, §expects — Restate validation is local to what an answer holds or breaks', () => {
  for (const check of ['resolution', 'placement']) {
    test(`decisions.md §confirm an existing ${check} failure outside held pages does not refuse a Restate answer`, async () => {
      const dir = await base();
      const path = check === 'resolution' ? CLAIM_PATH : LIFE_PATH;
      const other = check === 'resolution' ? LIFE_PATH : CLAIM_PATH;
      const broken = check === 'resolution'
        ? (await read(dir, path)).replace('| Rests on | none |', '| Rests on | unknown |')
        : (await read(dir, path)).replace('| Unaffected | none |', '| Unaffected | advance |');
      await accepted(dir, { [path]: broken });
      assert.ok(itemNames(dir).includes('restate:alpha'));
      // design.md §restate-applied: a pre-existing check 2/3 failure in a page the answer
      // does not hold is left to its own item, even in the same part.
      await acceptedAnswer(dir, 'restate:alpha', { [other]: await read(dir, other) });
      assert.equal(await read(dir, path), broken);
      assert.ok(itemNames(dir).includes('restate:alpha'));
      // The same existing failure must still refuse when its own page is held.
      const refusal = await refusedAnswer(dir, 'restate:alpha', { [path]: broken });
      assert.ok(refusal.reasons.some((reason) => reason.file === path));
    });

    test(`decisions.md §confirm a Restate answer newly causing ${check} failure in another page is refused`, async () => {
      const dir = await base();
      // An unrelated prior failure supplies the Restate item, so its presence
      // does not itself account for refusal of the proposed answer.
      await accepted(dir, { [CLAIM_PATH]: (await read(dir, CLAIM_PATH)).replace('| Rests on | none |', '| Rests on | unknown |') });
      const path = check === 'resolution' ? 'design/parts/alpha/boundary.md' : 'design/parts/alpha/actions.md';
      const changed = check === 'resolution'
        ? (await read(dir, path)).replace('| request | Request | entity |', '| renamed | Request | entity |')
        : (await read(dir, path)) + `| observe | worker | Observe the request. | none | none | added | ${CITE} |\n`;
      const before = await snapshot(dir, { skip: ['work', 'runs'] });
      const refusal = await refusedAnswer(dir, 'restate:alpha', { [path]: changed });
      // design.md §restate-applied: the held boundary newly breaks the lifecycle's Entity,
      // or the added action newly lacks a lifecycle column/Unaffected entry.
      assert.ok(refusal.reasons.some((reason) => reason.file === LIFE_PATH));
      assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    });
  }
});

describe('decisions.md §intake, §accept — revised account and scratch contracts', () => {
  for (const state of ['absent', 'altered']) {
    test(`decisions.md §intake ${state} scratch gitignores are never change items`, async () => {
      const original = await examined({ encoding: false });
      const dir = state === 'absent'
        ? await withoutFiles(original.dir, ['work/.gitignore', 'runs/.gitignore'])
        : original.dir;
      if (state === 'altered') await writeFiles(dir, { 'work/.gitignore': 'not-the-ignore\n', 'runs/.gitignore': 'not-the-ignore\n' });
      const before = await snapshot(dir);
      const items = missing(dir);
      // door.md §change item 7: these scratch files never become change: items.
      assert.ok(!items.some((entry) => ['change:work/.gitignore', 'change:runs/.gitignore'].includes(entry.item)));
      success(forma(dir, ['account', '--json']));
      success(forma(dir, ['box', '--json']));
      // door.md §lock, account.md §commands: a read writes nothing, so it repairs neither ignore file.
      assert.deepEqual(await snapshot(dir), before);
    });
  }

  test('decisions.md §intake ordinary record folders are not foreign files', async () => {
    const { dir } = await examined();
    // door.md §read-checks, §change item 8: a folder is permitted, as is a regular file at
    // its contract-owned path. Only other kinds and unowned files are foreign.
    const names = itemNames(dir);
    for (const folder of ['design/parts', 'design/parts/alpha', 'design/parts/alpha/claims', SLOT_FOLDER]) {
      assert.ok(!names.includes(`change:${folder}`));
    }
  });

  test('decisions.md §accept accepted claims have their own Accepted heading and accepted JSON list', async () => {
    const { dir } = await examined({ encoding: false });
    const other = 'alpha/claims/other';
    await accepted(dir, { [`design/parts/${other}/README.md`]: (await read(dir, CLAIM_PATH)).replace('A request completes safely.', 'A request remains available.') });
    const words = 'Accept the unexamined completion risk.';
    const decision = await decide(dir, 'accept', CLAIM, ['--choice', 'accept', '--words', words]);
    const account = success(forma(dir, ['account', 'alpha', '--json']));
    const part = account.parts.find((entry) => entry.ref === 'alpha');
    // presentation.md §reading: accepted is a separate list, with the fixed claim entry
    // and acceptance fields. The unexamined claim remains unestablished.
    assert.deepEqual(Object.keys(part).sort(), ['accepted', 'assumed', 'decided', 'established', 'leftOut', 'lifecycles', 'name', 'open', 'ref', 'span']);
    const claim = part.accepted.find((entry) => entry.ref === CLAIM);
    assert.ok(claim);
    assert.equal(claim.standing, 'accepted');
    assert.ok(!part.open.some((entry) => entry.ref === CLAIM));
    assert.ok(!part.established.some((entry) => entry.ref === CLAIM));
    assert.ok(part.open.some((entry) => entry.ref === other));
    assert.ok(part.established.some((entry) => entry.ref === JOURNEY));
    assert.deepEqual(Object.keys(claim.acceptance).sort(), ['at', 'by', 'decision', 'words']);
    assert.equal(claim.acceptance.words, words);
    assert.equal(claim.acceptance.by, 'Project owner');
    assert.equal(claim.acceptance.decision, decision.recorded[0].split('/').at(-1).replace(/\.md$/, ''));
    assert.match(claim.acceptance.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(claim.models.some((model) => model.model === 'lifecycles-alpha' && model.fails.length > 0));
    const text = forma(dir, ['account', 'alpha']);
    assert.equal(text.status, 0, text.stderr);
    // presentation.md §reading fixes heading spelling and order; all three have entries.
    const headings = ['### Open', '### Accepted', '### Established'].map((heading) => text.stdout.indexOf(`${heading}\n`));
    assert.ok(headings[0] >= 0 && headings[0] < headings[1] && headings[1] < headings[2]);
  });

  test('decisions.md §confirm parseable receipt text differing from JSON.stringify does not authenticate its page', async () => {
    const dir = await base();
    const path = 'design/parts/alpha/claims/safe/receipt';
    const line = (await read(dir, path)).trimEnd();
    await writeFiles(dir, { [path]: ` ${line}\n` });
    // door.md §receipts fixes the exact JSON.stringify line, not merely JSON syntax.
    const names = itemNames(dir);
    assert.ok(names.includes(`change:${path}`));
    assert.ok(names.includes(`change:${CLAIM_PATH}`));
    refuseShow(dir, 'confirm', CLAIM);
  });
});

describe('decisions.md §rulings — sent-back explanations retain their public reason', () => {
  test('decisions.md §rulings a guarded lifecycle surprise exposes found in its Explain item and packet', async () => {
    const { dir } = await examined({ violation: true, prepare: async (at) => {
      const path = 'design/parts/alpha/actions.md';
      await accepted(at, { [path]: (await read(at, path))
        .replace('| Complete the request. | none | none |', '| Complete the request. | none | Completion is authorized. |') });
    } });
    const open = await surprise(dir);
    const item = missing(dir).find((entry) => entry.item === `explain:${open.data.name}`);
    // evidence.md §sent-back; account.md §commands: found gives the sent-back reason and
    // names its step. The contract leaves found's nesting and prose open.
    assert.ok(Object.hasOwn(item, 'found'));
    assert.ok(item.found);
    const folder = await tempFolder('forma-cross2-explain-');
    success(forma(dir, ['give', item.item, folder, '--json']));
    // door.md §gives: item.json includes the same account item, found included.
    assert.deepEqual(JSON.parse(await read(folder, 'item.json')).item, item);
    refuseShow(dir, 'rule', open.data.name);
    await acceptedAnswer(dir, item.item, { 'explain.md': explanation(open.data) }, EXPLAINER);
    success(forma(dir, ['show', 'rule', open.data.name, '--json']));
  });

  test('decisions.md §rulings an accepted explanation remains valid at read before and after its ruling', async () => {
    const { dir } = await examined({ violation: true });
    const open = await surprise(dir);
    await acceptedAnswer(dir, `explain:${open.data.name}`, { 'explain.md': explanation(open.data) }, EXPLAINER);
    const path = open.path.replace(/\.json$/, '.explained.md');
    // evidence.md §stems puts explained.md at the surprise's stem (without .json).
    assert.ok(await read(dir, path));
    const before = await read(dir, path);
    // door.md §change item 3: read-time Explain check 2 requires only this stem's
    // Question/Basis, not that the surprise still lacks an accepted explanation.
    assert.ok(!itemNames(dir).includes(`change:${path}`));
    assert.ok(!itemNames(dir).includes(`explain:${open.data.name}`));
    success(forma(dir, ['show', 'rule', open.data.name, '--json']));
    assert.equal(await read(dir, path), before);
    const receipt = `${SLOT_FOLDER}/receipt`;
    const prior = { [path]: before, [open.path]: await read(dir, open.path), [receipt]: await read(dir, receipt) };
    await decide(dir, 'rule', open.data.name, ['--verdict', 'property wrong', '--level', 'specification', '--words', 'Revise the completion property.']);
    // evidence.md §at-ruling: a merge may bring a closed surprise and its explanation
    // back. door.md §change item 3 does not require that surprise to remain open.
    await writeFiles(dir, prior);
    assert.ok(!itemNames(dir).includes(`change:${path}`));
    assert.ok(!itemNames(dir).includes(`explain:${open.data.name}`));
    // evidence.md §at-ruling, §forma-run: run removes these closed stems, keeping the ruling.
    success(forma(dir, ['run', '--json']));
    assert.equal(await read(dir, path), null);
    assert.equal(await read(dir, open.path), null);
  });
});
