import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { project, answerFolder, tempFolder, writeFiles, read, tree, snapshot, forma, sha256, repo, hasToolchain } from './helpers/forma.mjs';

// These scenarios cross decisions.md §rulings, §in-force to §forma-decide, door.md §gives, §forma-answer to §receipts,
// models.md §slot-answer to §freeze and account.md §items to §box. Every setup write uses the public
// answer/decision commands, except the brief edits and explicit corruption probes.
const MODEL = 'lifecycles-p';
const CLAIM = 'p/claims/sticks';
const SLOT = `models/${MODEL}/parts/p/claims/sticks`;
const BRIEF = 'design/brief/ticket.md';
const CITE = `${BRIEF}#ticket`;
const WITNESS = `${SLOT}/witness-return.md`;
const FAULT = `${SLOT}/fault-reset.md`;
const LIFE = 'design/parts/p/lifecycles/state/README.md';
const MECHANISM = 'Completion remains latched.';
const owner = ['--provider', 'contract', '--model', 'developer', '--session', 'brief-owner', '--by', 'Owner'];
const writer = ['--provider', 'contract', '--model', 'writer', '--session', 'brief-writer'];
const reader = ['--provider', 'contract', '--model', 'reader', '--session', 'brief-reader'];
const fields = rows => '| Field | Value |\n| --- | --- |\n' + rows.map(([k, v]) => `| ${k} | ${v} |\n`).join('');
const repairPage = mechanism => fields([['Mechanism', mechanism]]);
const absentWitness = fields([['Meaning', 'A completed ticket returns to idle.']])
  + '\n| Lifecycle | From | Action | To |\n| --- | --- | --- | --- |\n| state | done | finish | idle |\n';
const reachedWitness = fields([['Meaning', 'The completed ticket is reached.']])
  + '\n| Lifecycle | Phase |\n| --- | --- |\n| state | done |\n';

// project.md §commands, door.md §forma-answer and decisions.md §forma-show to §forma-decide fix status and JSON.
function success(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(result.json && typeof result.json === 'object');
  return result.json;
}
const command = (dir, args) => success(forma(dir, [...args, '--json']));
const missing = dir => command(dir, ['missing']).items;
const briefItem = state => `brief:${state.ruling}/${MODEL}`;
async function submit(dir, item, files, session = writer, json = true) {
  return forma(dir, ['answer', item, await answerFolder(files), ...session, ...(json ? ['--json'] : [])]);
}
async function accepted(dir, item, files, session = writer) {
  const result = success(await submit(dir, item, files, session));
  assert.equal(result.accepted, true); // door.md §forma-answer
  return result;
}
function decide(dir, kind, on, options = [], showOptions = []) {
  const shown = command(dir, ['show', kind, on, ...showOptions]);
  return command(dir, ['decide', kind, on, '--shown', shown.token, ...options, ...owner]);
}
const nameOf = path => path.split('/').at(-1).replace(/\.md$/, '');
const field = (bytes, name) => bytes.split('\n').find(line => line.startsWith(`| ${name} | `))?.slice(name.length + 5, -2);
const linesOfReceipt = async (dir, folder) => (await read(dir, `${folder}/receipt`)).trimEnd().split('\n').map(JSON.parse);

async function setup({ secondClaim = false, spareFault = false, citedSource = false, runs = 100 } = {}) {
  const pages = await snapshot(await project('account/lifecycle'));
  if (citedSource) {
    Object.assign(pages, await snapshot(await project('account/source')));
    const claim = 'design/parts/p/claims/sticks/README.md';
    pages[claim] = pages[claim].replace(CITE, `${CITE}, design/brief/sources/reference.md#completion`);
  }
  const dir = await project(null, Object.fromEntries(Object.entries(pages).filter(([path]) => path.startsWith('design/brief/'))));
  command(dir, ['decide', 'intake', '--situation', 'design new', '--words', 'Only ticket completion is examined.',
    '--answers', '100', '--runs', String(runs), '--lifecycle-seconds', '10',
    '--tlc-seconds', '10', '--tlc-megabytes', '512', '--alloy-seconds', '10', '--alloy-megabytes', '512', '--cadence', 'question', '--inbox-cap', '100', ...owner]);
  const design = Object.fromEntries(Object.entries(pages).filter(([p]) => p.startsWith('design/') && !p.startsWith('design/brief/')));
  if (secondClaim) design['design/parts/p/claims/other/README.md'] = design['design/parts/p/claims/sticks/README.md']
    .replace('# Completion sticks', '# Another completion claim').replace('A done ticket never becomes idle.', 'Completed work remains done.');
  await accepted(dir, `passage:${CITE}`, design);
  for (const unit of ['parts', 'p/lifecycles/state', 'p/journeys/complete', CLAIM]) decide(dir, 'confirm', unit);
  for (const [kind, path, text] of [
    ['encoding', `${SLOT}/encoding.md`, pages[`${SLOT}/encoding.md`]],
    ['fault', FAULT, pages[FAULT]], ['witness', WITNESS, absentWitness],
  ]) await accepted(dir, `slot:${MODEL}/parts/p/claims/sticks/${kind}`, { [path]: text });
  if (spareFault) await accepted(dir, `slot:${MODEL}/parts/p/claims/sticks/fault`, { [`${SLOT}/fault-spare.md`]: pages[FAULT] });
  decide(dir, 'carry', `bound:${MODEL}/p/sticks`, ['--choice', 'carry', '--words', 'Phase-level behavior may omit data-dependent failures.']);
  if (secondClaim) {
    decide(dir, 'confirm', 'p/claims/other');
    for (const [kind, path, text] of [
      ['encoding', 'encoding.md', pages[`${SLOT}/encoding.md`]],
      ['fault', 'fault-reset.md', pages[FAULT]], ['witness', 'witness-return.md', secondClaim === 'passing' ? reachedWitness : absentWitness],
    ]) await accepted(dir, `slot:${MODEL}/parts/p/claims/other/${kind}`, {
      [`models/${MODEL}/parts/p/claims/other/${path}`]: text,
    });
  }
  return { dir, pages };
}
async function explain(dir, name) {
  const surprise = JSON.parse(await read(dir, `models/${name}.json`));
  // evidence.md §basis, §explain: explain names the question and the canonical basis digest.
  await accepted(dir, `explain:${name}`, {
    'explain.md': fields([['Question', surprise.question], ['Basis', sha256(JSON.stringify(surprise.basis, null, 2) + '\n').slice(0, 12)],
      ['Verdict', 'real finding'], ['Level', 'specification'], ['Weaker', 'none']])
      + '\n## Trace\n\nThe requested return is unreachable.\n\n## Failure shape\n\nThe witness does not reach its target.\n\n## Mechanism\n\nCompletion must remain latched.\n',
  }, reader);
  return surprise;
}
async function ruled(options = {}) {
  const state = await setup(options);
  const ran = command(state.dir, ['run']);
  const name = ran.opened.find(n => n.startsWith(`${MODEL}/parts/p/claims/sticks/witness-return.`));
  assert.ok(name); // evidence.md §questions, §surprise-file: the deliberately unreachable witness surprises.
  const surprise = await explain(state.dir, name);
  const verdict = options.verdict ?? 'real finding';
  const result = decide(state.dir, 'rule', name, ['--verdict', verdict, '--level', 'specification',
    '--words', 'Keep completed tickets latched.', ...(verdict === 'real finding' ? ['--target', MODEL] : [])]);
  const ruling = nameOf(result.recorded[0]);
  return { ...state, ruling, rulingPath: result.recorded[0], surprise, name, item: `repair:${ruling}/${MODEL}` };
}
async function repair(state, { remove = false, mechanism = MECHANISM } = {}) {
  const fault = state.pages[FAULT].replace('Completion preserves the done phase.', mechanism);
  return accepted(state.dir, state.item, {
    'repair.md': repairPage(mechanism), [WITNESS]: reachedWitness,
    [remove ? `${SLOT}/fault-latch.md` : FAULT]: fault,
    ...(remove ? { 'removed.md': `${FAULT}\n` } : {}),
  });
}
function modelInBox(dir) {
  const claim = command(dir, ['box']).claims.find(row => row.ref === CLAIM);
  assert.ok(claim); // account.md §standing, §box: matching runs and carried bounds establish this claim.
  assert.equal(claim.standing, 'established');
  const model = claim.models.find(row => row.model === MODEL);
  assert.ok(model);
  return model;
}
function checkMechanisms(state, entries, text) {
  // account.md §basis-line to §box: the box and the established basis carry the same mechanisms.
  assert.deepEqual(modelInBox(state.dir).mechanisms, entries);
  const part = command(state.dir, ['account', 'p']).parts.find(row => row.ref === 'p');
  const claim = part.established.find(row => row.ref === CLAIM);
  assert.deepEqual(claim.models.find(row => row.model === MODEL).basis.mechanisms, entries);
  for (const args of [['box'], ['account', 'p']]) {
    const result = forma(state.dir, args);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    for (const entry of entries) {
      assert.ok(result.stdout.includes(entry.mechanism));
      assert.ok(result.stdout.includes(entry.ruling));
    }
    assert.ok(result.stdout.includes(text));
  }
}
function assertBriefDebt(state, why) {
  // account.md §items to §waits, §commands: the debt starts only after repair, is developer work
  // at carry or allow, and waits for nothing.
  const item = missing(state.dir).find(row => row.item === briefItem(state));
  assert.ok(item);
  assert.equal(item.why, why);
  assert.deepEqual(item.supply, [{ by: 'developer', decision: 'brief', checkpoint: 'carry or allow' }]);
  assert.deepEqual(item.waits ?? [], []);
}
async function refusedDecision(dir, args) {
  const before = await snapshot(dir, { skip: ['work', 'runs'] });
  const result = forma(dir, [...args, '--json']);
  // decisions.md §forma-show to §forma-decide: a refusal records nothing.
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.ok(result.json?.refused?.length);
  assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
}

describe('decisions.md §rulings brief decisions and account.md §box mechanisms', () => {
  test('decisions.md §rulings: brief is owed only for a met real-finding model repair', async () => {
    const state = await ruled();
    assert.ok(!missing(state.dir).some(row => row.item === briefItem(state)));
    await refusedDecision(state.dir, ['show', 'brief', `${state.ruling}/${MODEL}`]);
    await repair(state);
    assertBriefDebt(state, 'unstated');
    await refusedDecision(state.dir, ['show', 'brief', `${state.ruling}/another-model`]);
    const other = await ruled({ verdict: 'model wrong' });
    await repair(other);
    assert.ok(!missing(other.dir).some(row => row.item === briefItem(other)));
    await refusedDecision(other.dir, ['show', 'brief', `${other.ruling}/${MODEL}`]);
  });

  test('decisions.md §kinds, §rulings, §in-force: accepted and stated pins, filing, supersession and stating-passage lapse', async () => {
    const state = await ruled();
    const rulingBytes = await read(state.dir, state.rulingPath);
    await repair(state);
    command(state.dir, ['run']);
    const baseEntry = { mechanism: MECHANISM, ruling: state.ruling };
    checkMechanisms(state, [{ ...baseEntry, brief: 'not stated' }], 'not in the brief');
    const on = `${state.ruling}/${MODEL}`;
    const shown = command(state.dir, ['show', 'brief', on]);
    // presentation.md §showings, decisions.md §rulings, §forma-show: the showing gives ruling, finding, mechanism and citations.
    assert.equal(shown.kind, 'brief');
    assert.equal(shown.on, on);
    for (const value of [state.ruling, 'real finding', 'specification', MODEL, state.name,
      state.surprise.question, 'reached', 'not reached', MECHANISM, `Cites ${CITE}:`]) assert.ok(shown.shown.includes(value), value);
    const why = 'The owner accepts the added latch pending a brief revision.';
    const acceptedDecision = decide(state.dir, 'brief', on, ['--choice', 'accepted', '--words', why]);
    const acceptedPath = acceptedDecision.recorded[0];
    const acceptedBytes = await read(state.dir, acceptedPath);
    assert.equal(field(acceptedBytes, 'Pin'), sha256(`Mechanism: ${MECHANISM}`));
    assert.equal(field(acceptedBytes, 'Choice'), 'accepted');
    assert.equal(acceptedPath.slice(0, acceptedPath.lastIndexOf('/')), state.rulingPath.slice(0, state.rulingPath.lastIndexOf('/')));
    assert.ok(!missing(state.dir).some(row => row.item === briefItem(state)));
    checkMechanisms(state, [{ ...baseEntry, brief: 'accepted', words: why }], `not in the brief, accepted (${why})`);

    // design.md §passages: these two plain passages hash their heading and paragraph,
    // with a blank line between blocks and no final LF.
    const path = 'design/brief/latch.md';
    const paragraphs = ['# Latch\n\nCompletion remains latched.', '# Rationale\n\nCompleted work stays done.'];
    const addresses = [`${path}#latch`, `${path}#rationale`];
    await writeFiles(state.dir, { [path]: paragraphs.join('\n\n') + '\n' });
    const statedShow = command(state.dir, ['show', 'brief', on, '--words', addresses.join('\n')]);
    for (const address of addresses) assert.ok(statedShow.shown.includes(`Cites ${address}:`));
    const pin = sha256([`Mechanism: ${MECHANISM}`, ...addresses.map((address, i) => `Passage: ${address} ${sha256(paragraphs[i])}`)].join('\n'));
    const stated = decide(state.dir, 'brief', on, ['--choice', 'stated', '--words', addresses.join('\n')], ['--words', addresses.join('\n')]);
    const statedBytes = await read(state.dir, stated.recorded[0]);
    assert.equal(field(statedBytes, 'Pin'), pin);
    assert.equal(field(statedBytes, 'Choice'), 'stated');
    checkMechanisms(state, [{ ...baseEntry, brief: 'stated', passages: addresses }], `the brief states it (${addresses.join(', ')})`);
    assert.ok(!missing(state.dir).some(row => row.item === briefItem(state)));
    // decisions.md §in-force: the latest brief decision alone can be current; the older accepted
    // decision cannot silently reappear when the latest stated decision lapses.
    await writeFiles(state.dir, { [path]: paragraphs.join('\n\n').replace('Completed work stays done.', 'Completed work can restart.') + '\n' });
    assertBriefDebt(state, 'lapsed');
    checkMechanisms(state, [{ ...baseEntry, brief: 'not stated' }], 'not in the brief');
    assert.equal(await read(state.dir, acceptedPath), acceptedBytes);
    assert.equal(await read(state.dir, stated.recorded[0]), statedBytes);
    assert.equal(await read(state.dir, state.rulingPath), rulingBytes);
    await writeFiles(state.dir, { [path]: paragraphs.join('\n\n') + '\n' });
    assert.ok(!missing(state.dir).some(row => row.item === briefItem(state)));
    checkMechanisms(state, [{ ...baseEntry, brief: 'stated', passages: addresses }], `the brief states it (${addresses.join(', ')})`);
  });

  test('decisions.md §forma-show to §forma-decide: brief refuses nonpassages, duplicate addresses, absent words and a stale showing', async () => {
    const state = await ruled();
    await repair(state);
    const on = `${state.ruling}/${MODEL}`;
    const shown = command(state.dir, ['show', 'brief', on]);
    await refusedDecision(state.dir, ['decide', 'brief', on, '--shown', shown.token, '--words', 'The owner accepts the latch.', ...owner]);
    for (const choice of ['stated', 'accepted']) await refusedDecision(state.dir,
      ['decide', 'brief', on, '--shown', shown.token, '--choice', choice, ...owner]);
    for (const words of [`${BRIEF}#missing`, BRIEF, 'This is prose.']) {
      await refusedDecision(state.dir, ['show', 'brief', on, '--words', words]);
      await refusedDecision(state.dir, ['decide', 'brief', on, '--shown', shown.token, '--choice', 'stated', '--words', words, ...owner]);
    }
    const good = command(state.dir, ['show', 'brief', on, '--words', CITE]);
    await refusedDecision(state.dir, ['decide', 'brief', on, '--shown', good.token, '--choice', 'stated', '--words', `${CITE}\n${CITE}`, ...owner]);
    await writeFiles(state.dir, { [BRIEF]: state.pages[BRIEF] + '\nThe latch is now described differently.\n' });
    await refusedDecision(state.dir, ['decide', 'brief', on, '--shown', good.token, '--choice', 'stated', '--words', CITE, ...owner]);
  });

  test('door.md §receipts: every repair mechanism survives an ordinary rewrite and later repairs', async () => {
    const state = await ruled();
    await repair(state);
    const firstReceipt = (await linesOfReceipt(state.dir, SLOT)).find(row => row.file === 'witness-return.md');
    command(state.dir, ['run']);
    // door.md §receipts, §change: an ordinary answer replaces the slot and carries history.
    await writeFiles(state.dir, { [WITNESS]: 'an unaccepted edit\n' });
    await accepted(state.dir, `change:${WITNESS}`, { [WITNESS]: absentWitness.replace('A completed ticket returns to idle.', 'A completed ticket returns to idle after a retry.') });
    let receipt = (await linesOfReceipt(state.dir, SLOT)).find(row => row.file === 'witness-return.md');
    assert.deepEqual(receipt.mechanisms, [{ decision: state.ruling, mechanism: MECHANISM }]);
    assert.ok(!Object.hasOwn(receipt, 'mechanism'));
    const ran = command(state.dir, ['run']);
    const name = ran.opened.find(n => n.startsWith(`${MODEL}/parts/p/claims/sticks/witness-return.`));
    assert.ok(name);
    await explain(state.dir, name);
    const result = decide(state.dir, 'rule', name, ['--verdict', 'real finding', '--target', MODEL,
      '--level', 'specification', '--words', 'Preserve completion during retries.']);
    const secondRuling = nameOf(result.recorded[0]);
    const secondMechanism = 'Retries preserve completed tickets.';
    await repair({ ...state, item: `repair:${secondRuling}/${MODEL}` }, { mechanism: secondMechanism });
    receipt = (await linesOfReceipt(state.dir, SLOT)).find(row => row.file === 'witness-return.md');
    const mechanisms = [{ decision: state.ruling, mechanism: MECHANISM }, { decision: secondRuling, mechanism: secondMechanism }]
      .sort((a, b) => a.decision < b.decision ? -1 : 1);
    assert.deepEqual(receipt.mechanisms, mechanisms);
    assert.deepEqual(receipt.answers, mechanisms.map(row => row.decision));
    // door.md §receipts union merge: every line contributes history, including an
    // older version. A subsequent ordinary write joins both branches.
    const merged = (await linesOfReceipt(state.dir, SLOT)).filter(row => row.file !== receipt.file);
    merged.push(firstReceipt, { ...receipt, answers: [secondRuling], mechanisms: [{ decision: secondRuling, mechanism: secondMechanism }] });
    await writeFiles(state.dir, { [`${SLOT}/receipt`]: merged.map(row => JSON.stringify(row) + '\n').join(''), [WITNESS]: 'an unaccepted edit\n' });
    await accepted(state.dir, `change:${WITNESS}`, { [WITNESS]: reachedWitness.replace('The completed ticket is reached.', 'Completion is reached after the repairs.') });
    const joined = (await linesOfReceipt(state.dir, SLOT)).find(row => row.file === receipt.file);
    assert.deepEqual(joined.mechanisms, mechanisms);
    assert.deepEqual(joined.answers, mechanisms.map(row => row.decision));
    command(state.dir, ['run']);
    checkMechanisms(state, mechanisms.map(({ decision: ruling, mechanism }) => ({ mechanism, ruling, brief: 'not stated' })), 'not in the brief');
  });
});

// models.md §model-repair permits only filled slots of the same model and things served
// by slots in the answer; the property, a witness and a fault must survive.
describe('models.md §model-repair Repair removed.md', () => {
  test('models.md §model-repair: renaming a repaired fault removes its slot, receipt and evidence, preserving other questions', async () => {
    const state = await ruled();
    const oldFault = await read(state.dir, FAULT);
    const faultEvidence = `models/${MODEL}/parts/p/claims/sticks/fault-reset.json`;
    assert.notEqual(await read(state.dir, faultEvidence), null); // evidence.md §questions, §written-moved
    const basePath = `models/${MODEL}/parts/p/claims/sticks/base.json`;
    const baseBytes = await read(state.dir, basePath);
    const result = await repair(state, { remove: true });
    assert.ok(result.removed.includes(FAULT));
    assert.ok(result.removed.includes(faultEvidence));
    assert.equal(await read(state.dir, FAULT), null);
    assert.equal(await read(state.dir, faultEvidence), null);
    assert.equal(await read(state.dir, basePath), baseBytes); // evidence.md §removed
    assert.ok(!(await linesOfReceipt(state.dir, SLOT)).some(row => row.file === 'fault-reset.md'));
    // door.md §repair-answer to §receipts: lifecycle removals leave their decision, mechanism and
    // before hash on the part's README receipt, with its accepted hash unchanged.
    const line = (await linesOfReceipt(state.dir, 'design/parts/p')).find(row => row.file === 'README.md');
    assert.ok(line.answers.includes(state.ruling));
    assert.deepEqual(line.mechanisms, [{ decision: state.ruling, mechanism: MECHANISM }]);
    assert.deepEqual(line.removed, [{ file: `../../../${FAULT}`, before: sha256(oldFault) }]);
    assert.equal(line.sha256, sha256(await read(state.dir, 'design/parts/p/README.md')));
    assert.equal(await read(state.dir, 'removed.md'), null);
    assert.ok(!missing(state.dir).some(row => row.item.endsWith('/fault-reset'))); // models.md §owed
    assertBriefDebt(state, 'unstated');
    command(state.dir, ['run']);
    modelInBox(state.dir);
  });

  for (const invalid of ['duplicate', 'unfilled', 'also written', 'other model', 'last encoding', 'last fault', 'last witness', 'no matching thing', 'not a slot']) {
    test(`models.md §model-repair: removed.md refuses ${invalid}`, async () => {
      const state = await ruled({ verdict: 'model wrong', spareFault: invalid !== 'last fault' });
      const files = { 'repair.md': repairPage(MECHANISM), [WITNESS]: reachedWitness };
      let removal = FAULT;
      if (invalid === 'duplicate') removal = `${FAULT}\n${FAULT}`;
      if (invalid === 'unfilled') removal = `${SLOT}/fault-absent.md`;
      if (invalid === 'also written') removal = WITNESS;
      if (invalid === 'other model') removal = FAULT.replace(MODEL, 'another-model');
      if (invalid === 'last encoding') removal = `${SLOT}/encoding.md`;
      if (invalid === 'last witness') {
        delete files[WITNESS];
        files[FAULT] = state.pages[FAULT].replace('Completion preserves the done phase.', MECHANISM);
        files[LIFE] = state.pages[LIFE].replace('# Ticket state', '# Revised ticket state');
        removal = WITNESS;
      }
      if (invalid === 'no matching thing') {
        delete files[WITNESS];
        files[LIFE] = state.pages[LIFE].replace('# Ticket state', '# Revised ticket state');
      }
      if (invalid === 'not a slot') removal = LIFE;
      files['removed.md'] = `${removal}\n`;
      const before = await snapshot(state.dir, { skip: ['work', 'runs'] });
      const result = await submit(state.dir, state.item, files);
      // door.md §forma-answer: a refused counted answer writes nothing and gives check reasons.
      assert.equal(result.status, 1, result.stderr || result.stdout);
      assert.equal(result.json?.accepted, false);
      assert.ok(result.json.reasons.length);
      assert.deepEqual(result.json.written, []);
      assert.deepEqual(result.json.removed, []);
      assert.deepEqual(await snapshot(state.dir, { skip: ['work', 'runs'] }), before);
    });
  }

  test('models.md §model-repair to §freeze: removal cannot take a slot held by another open surprise', async () => {
    const state = await ruled({ secondClaim: true });
    const other = `models/${MODEL}/parts/p/claims/other`;
    const before = await snapshot(state.dir, { skip: ['work', 'runs'] });
    const result = await submit(state.dir, state.item, {
      'repair.md': repairPage(MECHANISM), [WITNESS]: reachedWitness,
      [FAULT]: state.pages[FAULT].replace('Completion preserves the done phase.', MECHANISM),
      [`${other}/fault-new.md`]: state.pages[FAULT], 'removed.md': `${other}/fault-reset.md\n`,
    });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.equal(result.json?.accepted, false);
    assert.deepEqual(await snapshot(state.dir, { skip: ['work', 'runs'] }), before);
    assert.ok(missing(state.dir).some(row => row.item.startsWith(`explain:${MODEL}/parts/p/claims/other/`)));
  });
});

// door.md §gives and presentation.md §showings, decisions.md §rulings: packet and showing contents are contract
// surfaces; no engine or account implementation is imported to derive them.
describe('door.md §gives complete Repair and Explain inputs', () => {
  test('door.md §gives: a model Repair receives every slot, including unaccepted slots of another claim', async () => {
    const state = await ruled({ secondClaim: 'passing' });
    const extra = `models/${MODEL}/parts/p/claims/other/witness-extra.md`;
    await writeFiles(state.dir, { [extra]: reachedWitness });
    const packet = await tempFolder('forma-full-repair-');
    command(state.dir, ['give', state.item, packet]);
    for (const path of [WITNESS, FAULT, `${SLOT}/encoding.md`, extra,
      `models/${MODEL}/parts/p/claims/other/encoding.md`, `models/${MODEL}/parts/p/claims/other/fault-reset.md`]) {
      assert.equal(await read(packet, path), await read(state.dir, path));
    }
  });
  test('decisions.md §rulings: a traceless witness showing includes its slot and labels changed or gone bytes', async () => {
    const state = await setup({ citedSource: true });
    const result = command(state.dir, ['run']);
    const name = result.opened.find(n => n.startsWith(`${MODEL}/parts/p/claims/sticks/witness-return.`));
    const packet = await tempFolder('forma-explain-brief-');
    command(state.dir, ['give', `explain:${name}`, packet]);
    assert.equal(await read(packet, BRIEF), state.pages[BRIEF]);
    assert.equal(await read(packet, 'design/brief/sources/reference.md'), state.pages['design/brief/sources/reference.md']);
    assert.equal(await read(packet, 'forma/design.md'), await read(repo, 'spec/design.md'));
    const surprise = await explain(state.dir, name);
    assert.ok(!surprise.trace); // engines.md §trace: an unreached witness has no trace.
    const shown = command(state.dir, ['show', 'rule', name]).shown;
    assert.ok(shown.includes(`Slot ${WITNESS}:\n${absentWitness.trimEnd().split('\n').map(line => `  ${line}`).join('\n')}`));
    await writeFiles(state.dir, { [WITNESS]: reachedWitness });
    assert.ok(command(state.dir, ['show', 'rule', name]).shown.includes(`Slot ${WITNESS}: (changed since the run)`));
    const files = await snapshot(state.dir);
    delete files[WITNESS];
    const gone = await project(null, files);
    assert.ok(command(gone, ['show', 'rule', name]).shown.includes(`Slot ${WITNESS}: (gone)`));
  });
  test('decisions.md §forma-decide: ruling text labels every removal', async () => {
    const state = await setup();
    const ran = command(state.dir, ['run']);
    const name = ran.opened.find(n => n.startsWith(`${MODEL}/parts/p/claims/sticks/witness-return.`));
    await explain(state.dir, name);
    const own = (await tree(state.dir)).filter(path => path.startsWith(`models/${name}.`));
    const shown = command(state.dir, ['show', 'rule', name]);
    const result = forma(state.dir, ['decide', 'rule', name, '--shown', shown.token,
      '--verdict', 'real finding', '--target', MODEL, '--level', 'specification', '--words', 'Repair the latch.', ...owner]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const lines = result.stdout.trimEnd().split('\n');
    for (const path of own) assert.ok(lines.includes(`removed ${path}`));
    assert.ok(!lines[0].startsWith('removed '));
  });
  test('door.md §forma-answer: Repair text distinguishes wrote and removed paths in byte order', async () => {
    const state = await ruled();
    const files = { 'repair.md': repairPage(MECHANISM), [WITNESS]: reachedWitness,
      [`${SLOT}/fault-latch.md`]: state.pages[FAULT].replace('Completion preserves the done phase.', MECHANISM), 'removed.md': `${FAULT}\n` };
    const result = await submit(state.dir, state.item, files, writer, false);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const lines = result.stdout.trimEnd().split('\n');
    assert.equal(lines[0], `accepted ${state.item}`);
    assert.ok(lines.includes(`wrote ${WITNESS}`));
    assert.ok(lines.includes(`wrote ${SLOT}/fault-latch.md`));
    assert.ok(lines.includes(`removed ${FAULT}`));
    const written = lines.filter(line => line.startsWith('wrote '));
    const removed = lines.filter(line => line.startsWith('removed '));
    assert.deepEqual(written, [...written].sort());
    assert.deepEqual(removed, [...removed].sort());
    assert.match(lines.at(-1), /^answers: \d+ spent of 100$/);
  });
});

// models.md §model-repair and evidence.md §removed: removing a slot retires all its questions,
// including historical bounds; surviving questions and other models keep theirs.
describe('models.md §model-repair native slot removal', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`models.md §model-repair: ${engine} removes a retired fault at every bounds digest and preserves model scope`,
      { skip: !hasToolchain && 'toolchain absent' }, async () => {
        const state = await setup();
        const native = await snapshot(await project(`account/${engine}`));
        const modelFiles = Object.fromEntries(Object.entries(native).filter(([path]) => path.split('/').length === 3));
        await accepted(state.dir, 'cover:p', modelFiles);
        const folder = 'models/core/parts/p/claims/sticks';
        const ext = engine === 'tlc' ? 'tla' : 'als';
        for (const [item, path] of [
          ['core/parts/p/claims/sticks/encoding', `${folder}/encoding.${ext}`],
          ['core/parts/p/claims/sticks/fault', `${folder}/fault-reset.md`],
          ['core/parts/p/claims/sticks/witness', `${folder}/witness-done.md`],
          ['core/parts/p/journeys/complete/schedule', 'models/core/parts/p/journeys/complete/schedule.md'],
        ]) await accepted(state.dir, `slot:${item}`, { [path]: native[path] });
        command(state.dir, ['run']);
        // Change bounds while this native model has no open surprise, then
        // run its original fault again so there are two genuine evidence files.
        const modelPath = 'models/core/model.md';
        modelFiles[modelPath] = modelFiles[modelPath].replace(
          engine === 'tlc' ? '| constant Tickets | {ticket} | One ticket. |' : '| steps | 3 | Three transition states. |',
          engine === 'tlc' ? '| constant Tickets | {ticket, another} | Two tickets. |' : '| steps | 4 | Four transition states. |');
        assert.notEqual(modelFiles[modelPath], native[modelPath]);
        await writeFiles(state.dir, { [modelPath]: 'an unaccepted edit\n' });
        await accepted(state.dir, `change:${modelPath}`, modelFiles);
        command(state.dir, ['run']);
        const faultPaths = (await tree(state.dir)).filter(path => path.startsWith(`${folder}/fault-reset.`) && path.endsWith('.json'));
        assert.equal(faultPaths.length, 2);
        const extra = `${folder}/witness-return.md`;
        const unreachable = fields([['Meaning', engine === 'tlc' ? 'The reset state is reached.' : 'No ticket exists.']])
          + (engine === 'tlc' ? '\n```tla\nTarget == state = 2\n```\n' : '\n```alloy\npred Target { no Ticket }\n```\n');
        await accepted(state.dir, 'slot:core/parts/p/claims/sticks/witness', { [extra]: unreachable });
        const ran = command(state.dir, ['run']);
        const name = ran.opened.find(name => name.startsWith('core/parts/p/claims/sticks/witness-return.'));
        assert.ok(name);
        await explain(state.dir, name);
        const ruling = nameOf(decide(state.dir, 'rule', name, ['--verdict', 'real finding', '--target', 'core',
          '--level', 'specification', '--words', 'Repair the completion mechanism.']).recorded[0]);
        const item = `repair:${ruling}/core`;
        // door.md §gives: a native model Repair also receives slots outside the
        // surprising claim, including the journey's complete schedule.
        const packet = await tempFolder('forma-native-repair-');
        command(state.dir, ['give', item, packet]);
        for (const path of [...Object.keys(native).filter(path => path.includes('/parts/')), extra]) {
          assert.equal(await read(packet, path), await read(state.dir, path));
        }
        const oldFault = `${folder}/fault-reset.md`;
        const replacement = {
          'repair.md': repairPage(MECHANISM), [extra]: native[`${folder}/witness-done.md`],
          // models.md §model-repair: the new fault names repair.md's mechanism, whatever the old fault's was.
          [`${folder}/fault-latch.md`]: native[oldFault].replace(/^\| Mechanism \| .* \|$/m, `| Mechanism | ${MECHANISM} |`),
        };
        // A filled slot of the same claim on the lifecycle model is outside
        // this Repair's target, independently of the last-slot checks.
        const before = await snapshot(state.dir, { skip: ['work', 'runs'] });
        const foreign = await submit(state.dir, item, { ...replacement, 'removed.md': `${FAULT}\n` });
        assert.equal(foreign.status, 1, foreign.stderr || foreign.stdout);
        assert.equal(foreign.json?.accepted, false);
        assert.deepEqual(await snapshot(state.dir, { skip: ['work', 'runs'] }), before);
        const otherEvidence = Object.entries(before).filter(([path]) => path.endsWith('.json') && !faultPaths.includes(path));
        const result = await accepted(state.dir, item, { ...replacement, 'removed.md': `${oldFault}\n` });
        for (const path of [oldFault, ...faultPaths]) {
          assert.ok(result.removed.includes(path));
          assert.equal(await read(state.dir, path), null);
        }
        for (const [path, bytes] of otherEvidence) assert.equal(await read(state.dir, path), bytes);
        assert.equal(await read(state.dir, FAULT), before[FAULT]);
        const receipt = (await linesOfReceipt(state.dir, 'models/core')).find(row => row.file === 'model.md');
        // door.md §repair-answer to §receipts: model removal history uses paths relative to its folder.
        assert.deepEqual(receipt.removed, [{ file: 'parts/p/claims/sticks/fault-reset.md', before: sha256(native[oldFault]) }]);
        assert.deepEqual(receipt.mechanisms, [{ decision: ruling, mechanism: MECHANISM }]);
      });
  }
});
