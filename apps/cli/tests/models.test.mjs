import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerFolder, fixtures, forma, hasToolchain, project, read, repo, sha256,
  snapshot, tempFolder, tree, writeFiles,
} from './helpers/forma.mjs';

const writer = { provider: 'contract', model: 'writer', session: 'models-writer' };
const developer = ['--by', 'Contract developer', '--provider', 'contract',
  '--model', 'developer', '--session', 'models-developer'];
const engineOnly = { skip: !hasToolchain && 'toolchain absent' };
const claimFolder = 'models/lifecycles-p/parts/p/claims/safe';
// engines.md §slot-forms: handwritten lifecycle slot forms.
const forbidden = '| Lifecycle | From | Action | To |\n| --- | --- | --- | --- |\n| life | done | step | idle |\n';
const combination = '| Lifecycle | Phase |\n| --- | --- |\n| life | done |\n';
const reason = '| Field | Value |\n| --- | --- |\n| Cannot express | This engine cannot express the claim. |\n';
const witness = '| Field | Value |\n| --- | --- |\n| Meaning | A completed thing is reached. |\n\n' + combination;
const fault = '| Field | Value |\n| --- | --- |\n| Action | - |\n| Mechanism | Completion stability |\n\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| life | done | step | idle |\n';

function sorted(values) { return [...values].sort(); }
// Callers cite the contract that supplies each exact JSON key list.
function keys(value, expected) { assert.deepEqual(sorted(Object.keys(value)), sorted(expected)); }
// project.md §commands: --json returns one object; success exits 0.
function ok(result) {
  assert.equal(result.status, 0, `Forma failed: ${result.stderr || result.stdout}`);
  assert.ok(result.json && typeof result.json === 'object', 'Forma returns a JSON object');
  return result.json;
}

// door.md §receipts: hand-built accepted records hash the handwritten bytes, never
// bytes or metadata copied from an implementation. extras supplies slot pins.
async function seedFiles(dir, files, extras = {}) {
  await writeFiles(dir, files);
  const folders = new Map();
  for (const [path, bytes] of Object.entries(files)) {
    if (bytes === null || path.startsWith('design/brief/') || path.includes('/decisions/') ||
        !/^(design|models)\//.test(path) || path.endsWith('/receipt') || path.endsWith('.json') || path.endsWith('/.gitattributes')) continue;
    const slash = path.lastIndexOf('/');
    const folder = path.slice(0, slash);
    if (!folders.has(folder)) folders.set(folder, await receiptLines(dir, folder));
    const file = path.slice(slash + 1);
    const line = { file, sha256: sha256(bytes), at: '2020-01-01T00:00:00.000Z',
      session: writer, authors: [writer], ...(file === 'model.md' ? { strikes: [] } : {}),
      ...(extras[path] ?? {}) };
    folders.set(folder, [...folders.get(folder).filter((old) => old.file !== file), line]);
  }
  for (const [folder, lines] of folders) {
    lines.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
    await writeFiles(dir, { [`${folder}/receipt`]: lines.map((line) => JSON.stringify(line) + '\n').join('') });
  }
  // door.md §change to §copies: accepted-record fixtures include
  // the git attributes required whenever their tracked tree holds files.
  const attributes = {};
  if (Object.keys(files).some((path) => path.startsWith('design/') && !path.startsWith('design/brief/'))) {
    attributes['design/.gitattributes'] = '* -text -ident -filter -working-tree-encoding\nreceipt merge=union\nbrief/** !text !ident !filter !working-tree-encoding !merge\n';
  }
  if (Object.keys(files).some((path) => path.startsWith('models/'))) {
    attributes['models/.gitattributes'] = '* -text -ident -filter -working-tree-encoding\n*.json -merge\nreceipt merge=union\n';
  }
  await writeFiles(dir, attributes);
}

async function receiptLines(dir, folder) {
  const text = await read(dir, `${folder}/receipt`);
  return text === null ? [] : text.trimEnd().split('\n').map((line) => JSON.parse(line));
}
async function loadCase(name) { return snapshot(`${fixtures}/models/${name}`); }

// design.md §passages, §pins: canonical strings from base/;
// reference expansion, lifecycle cells/journey steps, sorting and final-LF
// omission determine every pin assertion using these helpers.
const passagePin = sha256('# System\n\nThe service advances a thing from idle to done. A completed thing stays done.');
function claimPin() {
  return sha256(['Sentence: A completed thing never returns to idle.', 'Kind: safety',
    'Stake: Completed work would be lost.', 'Rests on: ', 'Parts: Advances a thing to completion.',
    `Cites: ${passagePin}`].join('\n'));
}
function actionPin() {
  return sha256(['Actor: The service (service, machine, -, -)', 'Sentence: Advance the thing.',
    'Cases: ', 'Guard: none', `Cites: ${passagePin}`].join('\n'));
}
function lifecyclePin() {
  return sha256(['Entity: The thing (entity, machine, -, -)', 'Initial: idle', 'Ends: done',
    'Unaffected: ', `Cites: ${passagePin}`, 'Cell: done | Advance the thing. | done',
    'Cell: idle | Advance the thing. | done'].join('\n'));
}
function journeyPin() {
  return sha256(['Polarity: should happen', 'Expected end: The thing is done.', 'Refused step: -',
    `Cites: ${passagePin}`, 'Step 1: The service | Advance the thing. | - | - | -'].join('\n'));
}

async function decide(dir, kind, on, options = []) {
  const subject = on === undefined || on === null ? [] : [on];
  const args = ['decide', kind, ...subject];
  if (kind !== 'intake' && kind !== 'allow') {
    const shown = ok(forma(dir, ['show', kind, ...subject, '--json']));
    // presentation.md §showings: the showing token is a SHA-256.
    assert.match(shown.token, /^[a-f0-9]{64}$/);
    args.push('--shown', shown.token);
  }
  const result = forma(dir, [...args, ...options, ...developer, '--json']);
  ok(result);
  return result;
}

async function baseProject({ files = {}, confirmLifecycle = true, confirmJourney = true } = {}) {
  const dir = await project('models/base', files);
  await seedFiles(dir, await snapshot(dir));
  await decide(dir, 'intake', undefined, ['--situation', 'design new', '--words', 'Only the small processor is in scope.',
    '--answers', '1000', '--runs', '1000', '--tlc-seconds', '10', '--tlc-megabytes', '256',
    '--alloy-seconds', '10', '--alloy-megabytes', '256', '--lifecycle-seconds', '10']);
  await decide(dir, 'confirm', 'parts');
  if (confirmLifecycle) await decide(dir, 'confirm', 'p/lifecycles/life');
  if (confirmJourney) await decide(dir, 'confirm', 'p/journeys/finish');
  return dir;
}

async function answer(dir, item, files) {
  const folder = await answerFolder(files);
  return forma(dir, ['answer', item, folder, '--provider', writer.provider, '--model', writer.model,
    '--session', writer.session, '--json']);
}

// door.md §forma-answer fixes the reason and answer JSON shapes and path order;
// door.md §spent fixes whole-number answer accounting.
function answerShape(result) {
  assert.ok(result.json, `Expected an answer JSON object: ${result.stderr || result.stdout}`);
  keys(result.json, ['item', 'kind', 'accepted', 'written', 'removed', 'reasons', 'answers']);
  assert.equal(typeof result.json.item, 'string');
  assert.equal(typeof result.json.kind, 'string');
  assert.equal(typeof result.json.accepted, 'boolean');
  assert.ok(Array.isArray(result.json.written));
  assert.ok(Array.isArray(result.json.removed));
  assert.ok(Array.isArray(result.json.reasons));
  keys(result.json.answers, ['spent', 'allowed']);
  assert.ok(Number.isInteger(result.json.answers.spent));
  assert.ok(Number.isInteger(result.json.answers.allowed));
  for (const row of result.json.written) {
    keys(row, ['path', 'sha256']);
    assert.equal(typeof row.path, 'string');
    assert.match(row.sha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(result.json.written.map((row) => row.path), sorted(result.json.written.map((row) => row.path)));
  assert.deepEqual(result.json.removed, sorted(result.json.removed));
  for (const why of result.json.reasons) {
    keys(why, ['check', 'file', 'entry', 'field', 'says']);
    assert.equal(typeof why.check, 'string');
    for (const field of ['file', 'entry', 'field']) assert.ok(why[field] === null || typeof why[field] === 'string');
    assert.equal(typeof why.says, 'string');
    assert.ok(why.says.length > 0);
  }
  return result.json;
}
// project.md §commands; door.md §forma-answer.
function expectAccepted(result, kind = 'slot') {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const json = answerShape(result);
  assert.equal(json.kind, kind);
  assert.equal(json.accepted, true);
  assert.deepEqual(json.reasons, []);
  return json;
}
// project.md §commands; door.md §forma-answer: refused writes no
// tracked files and reports every failed check, naming the defining section.
function expectRefused(result) {
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const json = answerShape(result);
  assert.equal(json.accepted, false);
  assert.deepEqual(json.written, []);
  assert.deepEqual(json.removed, []);
  assert.ok(json.reasons.length > 0);
  // The contract does not select a preferred citation when several sections
  // state the same check. Each test cites its oracle, without narrowing that choice.
  return json;
}
// account.md §commands fixes {here, items}.
function missing(dir) {
  const json = ok(forma(dir, ['missing', '--json']));
  keys(json, ['here', 'items']);
  assert.ok(Array.isArray(json.items));
  return json.items;
}
async function modelFiles(engine = 'tlc', key = 'core') {
  const files = await loadCase(engine);
  return Object.fromEntries(Object.entries(files).map(([path, text]) => [path.replace('models/core/', `models/${key}/`), text]));
}
async function addModel(dir, engine = 'tlc', key = 'core', item = 'cover:p') {
  const files = await modelFiles(engine, key);
  expectAccepted(await answer(dir, item, files), 'model');
  return files;
}
async function addSlot(dir, path, text, item = `slot:${path.slice('models/'.length).replace(/\.[^.]+$/, '')}`) {
  expectAccepted(await answer(dir, item, { [path]: text }));
}

describe('models.md §slots One encoding per model', () => {
  for (const engine of ['tlc', 'alloy']) {
    // models.md §slots, §slot-currency: extension replacement keeps dependent slots; their original pins restore currency.
    test(`models.md §slots: ${engine} encoding extension replacement keeps dependent slots and restores them when their pins return`, engineOnly, async () => {
      const dir = await baseProject();
      await addModel(dir, engine);
      const ext = engine === 'tlc' ? 'tla' : 'als';
      const folder = 'models/core/parts/p/claims/safe';
      const native = engine === 'tlc' ? 'Invariant == TypeOK\n' : 'assert Claim { always Thing.phase in idle + done }\n';
      await addSlot(dir, `${folder}/encoding.${ext}`, native);
      const target = mtWitness(engine, engine === 'tlc' ? 'Target == phase = "done"' : 'pred Target { Thing.phase = done }');
      const defect = mtFault(engine, engine === 'tlc' ? 'Fault == phase\' = "idle"' : 'pred Fault { Thing.phase\' = idle }');
      await addSlot(dir, `${folder}/witness-done.md`, target, 'slot:core/parts/p/claims/safe/witness');
      await addSlot(dir, `${folder}/fault-back.md`, defect, 'slot:core/parts/p/claims/safe/fault');
      const originalClaim = await read(dir, 'design/parts/p/claims/safe/README.md');
      const oldLines = (await receiptLines(dir, folder)).filter((row) => row.file !== `encoding.${ext}`);
      await seedFiles(dir, { 'design/parts/p/claims/safe/README.md': originalClaim.replace('Completed work would be lost.', 'Completed work could be lost.') });
      const encodedReason = expectAccepted(await answer(dir, 'slot:core/parts/p/claims/safe/encoding', {
        [`${folder}/encoding.md`]: reason,
      }));
      assert.ok(encodedReason.removed.includes(`${folder}/encoding.${ext}`));
      assert.equal(await read(dir, `${folder}/encoding.${ext}`), null);
      for (const slot of ['witness', 'fault', 'witness-done', 'fault-back']) {
        assert.ok(!missing(dir).some((row) => row.item === `slot:core/parts/p/claims/safe/${slot}`));
      }
      await seedFiles(dir, { 'design/parts/p/claims/safe/README.md': originalClaim });
      const encodedNative = expectAccepted(await answer(dir, 'slot:core/parts/p/claims/safe/encoding', {
        [`${folder}/encoding.${ext}`]: native,
      }));
      assert.ok(encodedNative.removed.includes(`${folder}/encoding.md`));
      assert.equal(await read(dir, `${folder}/encoding.md`), null);
      const lines = await receiptLines(dir, folder);
      for (const old of oldLines) assert.deepEqual(lines.find((row) => row.file === old.file), old);
      for (const slot of ['encoding', 'witness', 'fault', 'witness-done', 'fault-back']) {
        assert.ok(!missing(dir).some((row) => row.item === `slot:core/parts/p/claims/safe/${slot}`));
      }
    });
  }
});

describe('models.md §slot-currency Native slot pins', () => {
  for (const engine of ['tlc', 'alloy']) {
    // models.md §slot-currency; door.md §receipts; design.md §pins: exact entries, byte order, and pins.
    test(`models.md §slot-currency: ${engine} encoding and witness pin the claim, fault also pins its action, and schedule pins its journey and action`, engineOnly, async () => {
      const { dir } = await mtSetup(engine);
      const ext = engine === 'tlc' ? 'tla' : 'als';
      await addSlot(dir, `${mtClaim}/encoding.${ext}`, mtProperty[engine]);
      await addSlot(dir, `${mtClaim}/witness-done.md`, mtWitness(engine,
        engine === 'tlc' ? 'Target == phase = "done"' : 'pred Target { Thing.phase = done }'), 'slot:core/parts/p/claims/safe/witness');
      await addSlot(dir, `${mtClaim}/fault-back.md`, mtFault(engine,
        engine === 'tlc' ? 'Fault == phase\' = "idle"' : 'pred Fault { Thing.phase\' = idle }'), 'slot:core/parts/p/claims/safe/fault');
      const lines = await receiptLines(dir, mtClaim);
      for (const file of [`encoding.${ext}`, 'witness-done.md']) {
        assert.deepEqual(lines.find((row) => row.file === file).pins, [{ entry: 'p/claims/safe', pin: claimPin() }]);
      }
      assert.deepEqual(lines.find((row) => row.file === 'fault-back.md').pins, [
        { entry: 'p/actions/step', pin: actionPin() }, { entry: 'p/claims/safe', pin: claimPin() },
      ]);
      await addSlot(dir, mtSchedulePath, mtSchedule(engine));
      assert.deepEqual((await receiptLines(dir, 'models/core/parts/p/journeys/finish'))[0].pins, [
        { entry: 'p/actions/step', pin: actionPin() }, { entry: 'p/journeys/finish', pin: journeyPin() },
      ]);
    });

    // models.md §slot-currency; door.md §receipts; design.md §pins: world-row pin.
    test(`models.md §slot-currency: a ${engine} misbehaviour witness pins its world row`, engineOnly, async () => {
      const { dir } = await mtSetup(engine, (files) => mtWorldModel(files, engine), await mtWorldOptions());
      const ext = engine === 'tlc' ? 'tla' : 'als';
      await addSlot(dir, `models/core/world/p/outside/drop.${ext}`,
        engine === 'tlc' ? 'Target == phase = "idle"\n' : 'pred Target { Thing.phase = idle }\n');
      // design.md §pins: canonical fields of mtWorldOptions' service world row.
      const pin = sha256(['Names: The outside service', 'Kind: service', 'Side: world',
        'Seam: request-response', 'Isolation: -', 'Reads: -', 'Writes: -', `Cites: ${passagePin}`].join('\n'));
      assert.deepEqual((await receiptLines(dir, 'models/core/world/p/outside'))[0].pins,
        [{ entry: 'p/boundary/outside', pin }]);
    });
  }
});

describe('forms.md §menu Menu names in developer-facing records', () => {
  for (const [item, displayed] of [
    ['drop', 'drop'], ['duplicate', 'duplicate'], ['delay', 'delay'], ['reorder', 'reorder'],
    ['fail-forever', 'fail forever'], ['fail-then-succeed', 'fail then succeed'],
    ['crash', 'crash'], ['go-silent', 'go silent mid-step'],
  ]) {
    // forms.md §menu; decisions.md §decision-file, §carry, §forma-show: menu labels, strike falsifier, and decision form.
    test(`forms.md §menu: ${item} is shown and recorded as ${displayed}`, async () => {
      const dir = await baseProject(await mtWorldOptions());
      const on = `strike:p/outside/${item}`;
      const shown = ok(forma(dir, ['show', 'carry', on, '--json']));
      keys(shown, ['kind', 'on', 'shown', 'takes', 'pins', 'token']);
      assert.equal(shown.kind, 'carry');
      assert.equal(shown.on, on);
      assert.ok(shown.shown.includes(displayed));
      await decide(dir, 'carry', on, ['--choice', 'carry']);
      const paths = (await tree(dir)).filter((path) => path.startsWith('design/parts/p/decisions/') && /-carry-[a-f0-9]{12}\.md$/.test(path));
      assert.equal(paths.length, 1);
      const text = await read(dir, paths[0]);
      assert.ok(text.includes(`| On | ${on} |`));
      assert.ok(text.includes(`an observed ${displayed} at The outside service`));
      // forms.md §premise-says; presentation.md §reading to account.md §box: code-added strike premises have
      // this statement, class, falsifier and provider in both readings.
      const statement = `The outside service never does ${displayed}.`;
      const assumed = ok(forma(dir, ['account', 'p', '--json'])).parts
        .find((part) => part.ref === 'p').assumed.find((entry) => entry.premise === on);
      assert.equal(assumed.statement, statement);
      assert.equal(assumed.class, 'world');
      assert.equal(assumed.falsifier, `an observed ${displayed} at The outside service`);
      for (const command of [['account', 'p'], ['box']]) {
        const reading = forma(dir, command);
        assert.equal(reading.status, 0, reading.stderr || reading.stdout);
        const words = reading.stdout.replace(/\s+/gu, ' ');
        assert.ok(words.includes(statement));
        assert.ok(words.includes("the developer's strike"));
      }
    });
  }
});

describe('models.md §model-answer Evidence after model changes', () => {
  for (const engine of ['tlc', 'alloy']) {
    // models.md §model-answer; evidence.md §basis, §currency, §forma-run: changed basis reruns existing questions.
    test(`models.md §model-answer: changing ${engine} engine bytes reruns every existing question on the model`, engineOnly, async () => {
      const { dir, files } = await mtSetup(engine);
      const ext = engine === 'tlc' ? 'tla' : 'als';
      await addSlot(dir, `${mtClaim}/encoding.${ext}`, mtProperty[engine]);
      await addSlot(dir, mtSchedulePath, mtSchedule(engine));
      ok(forma(dir, ['run', '--json']));
      const paths = (await tree(dir)).filter((path) => path.startsWith('models/core/') && path.endsWith('.json'));
      assert.ok(paths.some((path) => /\/base\.[a-f0-9]{12}\.json$/.test(path)));
      const old = new Map();
      for (const path of paths) old.set(path, await read(dir, path));
      const enginePath = engine === 'tlc' ? mtTlaPath : mtAlloyPath;
      const changed = engine === 'tlc' ? '\\* A changed engine-file byte.\n' + files[enginePath]
        : '// A changed engine-file byte.\n' + files[enginePath];
      await seedFiles(dir, { [enginePath]: changed });
      for (const [path, bytes] of old) assert.equal(await read(dir, path), bytes);
      const rerun = ok(forma(dir, ['run', '--json']));
      for (const path of paths) {
        const prior = JSON.parse(old.get(path));
        assert.ok(rerun.ran.some((row) => row.name === prior.name));
        const evidence = JSON.parse(await read(dir, path));
        assert.equal(evidence.basis.files.find((row) => row.path === enginePath).sha256, sha256(changed));
      }
    });

    // models.md §model-answer; evidence.md §bounds to §question-names, §written: new bounds name new evidence and retain old evidence.
    test(`models.md §model-answer: changed ${engine} bounds name new questions and preserve old evidence`, engineOnly, async () => {
      const { dir, files } = await mtSetup(engine);
      const ext = engine === 'tlc' ? 'tla' : 'als';
      await addSlot(dir, `${mtClaim}/encoding.${ext}`, mtProperty[engine]);
      await addSlot(dir, mtSchedulePath, mtSchedule(engine));
      ok(forma(dir, ['run', '--json']));
      const oldPaths = (await tree(dir)).filter((path) => /^models\/core\/parts\/p\/claims\/safe\/base\.[a-f0-9]{12}\.json$/.test(path));
      assert.equal(oldPaths.length, 1);
      const oldText = await read(dir, oldPaths[0]);
      const changed = engine === 'tlc'
        ? files[mtModelPath].replace('| {thing} |', '| {thing, other} |')
        : files[mtModelPath].replace('3 but exactly 1 Thing', '4 but exactly 1 Thing');
      await seedFiles(dir, { [mtModelPath]: changed });
      ok(forma(dir, ['run', '--json']));
      // evidence.md §bounds: sorted normalized bound lines, each with its LF.
      const bound = engine === 'tlc' ? 'constant Things = {thing, other}\n' : 'scope = 4 but exactly 1 Thing\n';
      const digest = sha256(bound).slice(0, 12);
      const newPath = `${mtClaim}/base.${digest}.json`;
      assert.notEqual(newPath, oldPaths[0]);
      assert.notEqual(await read(dir, newPath), null);
      assert.equal(await read(dir, oldPaths[0]), oldText);
    });
  }
});

describe('models.md §lifecycle-model Lifecycle authors', () => {
  for (const source of ['an unconfirmed lifecycle page', 'a nonmatching merged receipt line']) {
    // models.md §lifecycle-model; door.md §receipts: only confirmed lifecycle pages contribute model
    // authors, but every merged receipt line of each such page contributes.
    // door.md §forma-answer and evidence.md §explain govern the independent Explain answer.
    test(`models.md §lifecycle-model: an author from ${source} ${source === 'an unconfirmed lifecycle page' ? 'may' : 'cannot'} explain a lifecycle model surprise`, async () => {
      const dir = await baseProject();
      const author = { provider: 'contract', model: 'earlier', session: 'earlier-lifecycle-author' };
      if (source === 'an unconfirmed lifecycle page') {
        const page = 'design/parts/p/lifecycles/other/README.md';
        const boundary = await read(dir, 'design/parts/p/boundary.md');
        await seedFiles(dir, {
          'design/parts/p/boundary.md': boundary + '| other | Another thing | entity | machine | - | - | actor | actor | stated | design/brief/system.md#system |\n',
          [page]: (await read(dir, 'design/parts/p/lifecycles/life/README.md')).replace('| Entity | thing |', '| Entity | other |'),
        }, { [page]: { session: author, authors: [author] } });
      } else {
        const folder = 'design/parts/p/lifecycles/life';
        const lines = await receiptLines(dir, folder);
        const historical = { ...lines[0], sha256: sha256('Earlier accepted lifecycle bytes.'),
          at: '2019-01-01T00:00:00.000Z', session: author, authors: [author] };
        await writeFiles(dir, { [`${folder}/receipt`]: [...lines, historical].map((line) => JSON.stringify(line) + '\n').join('') });
      }
      await addSlot(dir, `${claimFolder}/encoding.md`, stateIdle);
      const names = await stateRunSurprises(dir);
      const surprise = JSON.parse(await read(dir, `models/${names[0]}.json`));
      // evidence.md §basis, §own-check, §explain: the
      // explanation addresses this public surprise with its defined basis digest.
      const basis = sha256(JSON.stringify(surprise.basis, null, 2) + '\n').slice(0, 12);
      const explanation = '| Field | Value |\n| --- | --- |\n' +
        `| Question | ${surprise.question} |\n| Basis | ${basis} |\n` +
        '| Verdict | model wrong |\n| Level | implementation |\n| Weaker | none |\n\n' +
        '## Trace\n\nThe thing starts idle.\n\n## Failure shape\n\nThe starting phase is forbidden.\n\n' +
        '## Mechanism\n\nThe initial lifecycle phase permits this combination.\n';
      const folder = await answerFolder({ 'explain.md': explanation });
      const result = forma(dir, ['answer', `explain:${names[0]}`, folder, '--provider', author.provider,
        '--model', author.model, '--session', author.session, '--json']);
      if (source === 'an unconfirmed lifecycle page') {
        expectAccepted(result, 'explain');
        assert.equal(await read(dir, `models/${names[0]}.explained.md`), explanation);
      } else {
        expectRefused(result);
        assert.equal(await read(dir, `models/${names[0]}.explained.md`), null);
      }
    });
  }

  // models.md §lifecycle-model; door.md §forma-answer, §receipts; evidence.md §explain: model authors cannot explain.
  test('models.md §lifecycle-model: the session that wrote a lifecycle page cannot explain its model surprise', async () => {
    const dir = await baseProject();
    await addSlot(dir, `${claimFolder}/encoding.md`, stateIdle);
    const names = await stateRunSurprises(dir);
    assert.equal(names.length, 1);
    const surprise = JSON.parse(await read(dir, `models/${names[0]}.json`));
    // evidence.md §basis, §own-check: digest the basis JSON with its prescribed LF.
    const basis = sha256(JSON.stringify(surprise.basis, null, 2) + '\n').slice(0, 12);
    const explanation = '| Field | Value |\n| --- | --- |\n' +
      `| Question | ${surprise.question} |\n| Basis | ${basis} |\n` +
      '| Verdict | model wrong |\n| Level | implementation |\n| Weaker | none |\n\n' +
      '## Trace\n\nThe thing starts idle.\n\n## Failure shape\n\nThe starting phase is forbidden.\n\n' +
      '## Mechanism\n\nThe initial lifecycle phase permits this combination.\n';
    const result = expectRefused(await answer(dir, `explain:${names[0]}`, { 'explain.md': explanation }));
    assert.equal(await read(dir, `models/${names[0]}.explained.md`), null);
  });
});

describe('models.md §parts-change Frozen native models cannot drop a part', () => {
  for (const engine of ['tlc', 'alloy']) {
    // models.md §freeze, §parts-change; evidence.md §questions; door.md §forma-answer: an open phases surprise blocks dropping its part.
    test(`models.md §parts-change: an open ${engine} phases surprise prevents dropping the part it reads`, engineOnly, async () => {
      const dir = await baseProject({ files: await stateTwoPartFiles() });
      const files = await modelFiles(engine);
      files['models/core/model.md'] = files['models/core/model.md'].replace('| Parts | p |', '| Parts | p, q |');
      if (engine === 'tlc') files['models/core/Core.tla'] = files['models/core/Core.tla']
        .replace('Phase(e) == phase', 'Phase(e) == "outside"');
      else files['models/core/model.md'] = files['models/core/model.md'].replace('| e.phase |', '| none |');
      expectAccepted(await answer(dir, 'cover:p+q', files), 'model');
      const ran = ok(forma(dir, ['run', '--json']));
      assert.ok(ran.opened.some((name) => name.startsWith('core/phases.')));
      const reduced = { ...files };
      reduced['models/core/model.md'] = files['models/core/model.md'].replace('| Parts | p, q |', '| Parts | q |')
        .replace('| p/step | Step | none |\n', '')
        .split('\n').filter((line) => !line.startsWith('| p/life |')).join('\n');
      // A direct edit creates a change item; its matching answer must still
      // satisfy the freeze of the earlier accepted bytes (door.md §change).
      await writeFiles(dir, { 'models/core/model.md': reduced['models/core/model.md'] });
      const before = await snapshot(dir, { skip: ['work', 'runs'] });
      const rejected = expectRefused(await answer(dir, 'change:models/core/model.md', reduced));
      assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    });
  }
});

describe('models.md with the contracts it reads', () => {
  // engines.md §slot-forms; account.md §standing, §basis-line to presentation.md §reading: an accepted unexamined claim appears
  // under Accepted, between Open and Established, with its acceptance metadata.
  test('engines.md §slot-forms / presentation.md §reading: an accepted inexpressible claim is listed only under Accepted', async () => {
    const base = await loadCase('base');
    const dir = await baseProject({ files: {
      'design/parts/p/claims/other/README.md': base['design/parts/p/claims/safe/README.md']
        .replace('# Completion is stable', '# Other open claim')
        .replace('A completed thing never returns to idle.', 'Every thing can be completed.'),
      'design/parts/p/README.md': base['design/parts/p/README.md'] + '4. [Other open claim](claims/other/)\n',
    } });
    await addSlot(dir, `${claimFolder}/encoding.md`, reason);
    const words = 'The completion risk is acceptable for this prototype.';
    await decide(dir, 'accept', 'p/claims/safe', ['--choice', 'accept', '--words', words]);
    // presentation.md §reading omits empty headings: the conforming finish journey makes
    // Established nonempty, while the other unexamined claim fills Open.
    ok(forma(dir, ['run', '--json']));
    const account = ok(forma(dir, ['account', 'p', '--json']));
    const part = account.parts.find((entry) => entry.ref === 'p');
    assert.ok(part);
    assert.equal(part.open.some((entry) => entry.ref === 'p/claims/safe'), false);
    assert.equal(part.established.some((entry) => entry.ref === 'p/claims/safe'), false);
    const accepted = part.accepted.filter((entry) => entry.ref === 'p/claims/safe');
    assert.equal(accepted.length, 1);
    assert.equal(accepted[0].standing, 'accepted');
    assert.equal(accepted[0].acceptance.words, words);
    keys(accepted[0].acceptance, ['decision', 'words', 'by', 'at']);
    assert.equal(accepted[0].acceptance.by, 'Contract developer');
    const reading = forma(dir, ['account', 'p']);
    assert.equal(reading.status, 0, reading.stderr || reading.stdout);
    const headings = [...reading.stdout.matchAll(/^ {0,3}###[ \t]+(Open|Accepted|Established)(?:[ \t]+#+)?[ \t]*$/gm)]
      .map((match) => match[1]);
    assert.deepEqual(headings, ['Open', 'Accepted', 'Established']);
  });

  for (const kind of ['intake', 'accept', 'decline']) {
    // decisions.md §kinds, §forma-decide: required words containing
    // only whitespace are refused, recording no decision; project.md §commands.
    test(`models.md §lifecycle-model / decisions.md §forma-decide: ${kind} refuses whitespace-only required words`, async () => {
      const dir = kind === 'intake' ? await project('models/base') : await baseProject();
      if (kind === 'intake') {
        await seedFiles(dir, await snapshot(dir));
        // decisions.md §forma-show: intake can be shown before it exists.
        // Establish CLI availability before asserting a refusal's JSON shape.
        ok(forma(dir, ['show', 'intake', '--json']));
      }
      const on = kind === 'accept' ? 'p/claims/safe' : 'p/lifecycles/life';
      const args = ['decide', kind];
      if (kind === 'intake') args.push('--situation', 'design new');
      else {
        const showing = ok(forma(dir, ['show', kind, on, '--json']));
        args.push(on, '--shown', showing.token);
        if (kind === 'accept') args.push('--choice', 'accept');
      }
      const before = await snapshot(dir, { skip: ['work', 'runs'] });
      const result = forma(dir, [...args, '--words', ' \t\n ', ...developer, '--json']);
      assert.equal(result.status, 1, result.stderr || result.stdout);
      keys(result.json, ['refused']);
      assert.ok(result.json.refused.length > 0);
      assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    });
  }

  // models.md §slot-answer check 2 and engines.md §slot-forms; door.md §forma-answer, §spent to §scratch,
  // refusal preserves tracked files, spends one answer,
  // and stores the reasons under the item's SHA-256 prefix on this machine.
  test('models.md §slot-answer / door.md §forma-answer: a refused slot preserves tracked files and records its local refusal', async () => {
    const dir = await baseProject();
    const item = 'slot:lifecycles-p/parts/p/claims/safe/encoding';
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    const spentBefore = JSON.parse(await read(dir, 'work/spent.json') ?? '{"answers":0}').answers;
    const refused = expectRefused(await answer(dir, item, {
      [`${claimFolder}/encoding.md`]: reason + '\nUnexpected extra block.\n',
    }));
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    assert.equal(refused.answers.spent, spentBefore + 1);
    const local = JSON.parse(await read(dir, `work/refused/${sha256(item).slice(0, 12)}.json`));
    assert.equal(local.item, item);
    assert.deepEqual(local.refusals, [refused.reasons]);
  });

  for (const command of ['missing', 'account', 'box', 'diff']) {
    // account.md §commands; door.md §lock: a read writes nothing in the project.
    test(`models.md §lifecycle-model / account.md §commands: ${command} writes nothing`, async () => {
      const source = await baseProject();
      const tracked = await snapshot(source, { skip: ['work', 'runs'] });
      const dir = await project(null, tracked);
      const previous = command === 'diff' ? await project(null, tracked) : null;
      const result = forma(dir, [command, ...(previous ? [previous] : []), '--json']);
      ok(result);
      assert.deepEqual(await snapshot(dir), tracked);
    });
  }

  // door.md §receipts; door.md §change;
  // models.md §slot-currency: a receipt's last line must end in LF.
  test('models.md §slot-currency / door.md §receipts: a slot receipt without its final line feed is a change', async () => {
    const dir = await baseProject();
    await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
    const path = `${claimFolder}/receipt`;
    const original = await read(dir, path);
    assert.ok(original.endsWith('\n'));
    await writeFiles(dir, { [path]: original.slice(0, -1) });
    assert.ok(missing(dir).some((entry) => entry.item === `change:${path}`));
  });

  for (const state of ['missing', 'altered']) {
    // door.md §lock, §change item 7; account.md §commands: scratch ignore files are
    // written again at the next write there, are never change items, and a read writes nothing.
    test(`models.md §lifecycle-model / door.md §change: ${state} scratch gitignores never create change items`, async () => {
      const source = await baseProject();
      const files = await snapshot(source, { skip: ['work/.gitignore', 'runs/.gitignore'] });
      // The harness cannot delete files; a copy lacking the ignore files
      // supplies exactly that read-time state, with both scratch folders present.
      files['runs/.probe'] = 'untracked scratch bytes\n';
      if (state === 'altered') {
        files['work/.gitignore'] = 'different\n';
        files['runs/.gitignore'] = 'different\n';
      }
      const dir = await project(null, files);
      const items = missing(dir);
      for (const path of ['work/.gitignore', 'runs/.gitignore']) {
        assert.ok(!items.some((item) => item.item === `change:${path}`));
      }
      // door.md §change item 8: ordinary project folders are not foreign objects.
      for (const path of ['design', 'design/parts', 'design/parts/p', 'design/parts/p/lifecycles/life']) {
        assert.ok(!items.some((item) => item.item === `change:${path}`));
      }
      await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
      assert.equal(await read(dir, 'work/.gitignore'), '*\n');
      ok(forma(dir, ['run', '--json']));
      assert.equal(await read(dir, 'runs/.gitignore'), '*\n');
    });
  }

  // door.md §receipts specifies JSON.stringify, including escaping and literal
  // Unicode, rather than merely whitespace-free JSON; door.md §sessions allows these names.
  test('models.md §slot-currency / door.md §receipts: receipt bytes use JSON.stringify for Unicode and escaped session names', async () => {
    const dir = await baseProject();
    const author = { provider: 'contract/é', model: 'writer "quoted"', session: 'receipt-\\-雪' };
    const folder = await answerFolder({ [`${claimFolder}/encoding.md`]: forbidden });
    expectAccepted(forma(dir, ['answer', 'slot:lifecycles-p/parts/p/claims/safe/encoding', folder,
      '--provider', author.provider, '--model', author.model, '--session', author.session, '--json']));
    const bytes = await read(dir, `${claimFolder}/receipt`);
    const lines = bytes.trimEnd().split('\n');
    assert.equal(lines.length, 1);
    const row = JSON.parse(lines[0]);
    assert.deepEqual(row.session, author);
    assert.deepEqual(row.authors, [author]);
    assert.equal(bytes, JSON.stringify(row) + '\n');
  });

  // models.md §lifecycle-model; evidence.md §sent-back; account.md §commands; door.md §gives: a guarded
  // lifecycle counterexample is sent back with found, and the packet copies it.
  test('models.md §lifecycle-model / evidence.md §sent-back: a guarded lifecycle surprise carries found into its Explain packet', async () => {
    const files = await loadCase('base');
    files['design/parts/p/actions.md'] = files['design/parts/p/actions.md']
      .replace('| none | none | stated |', '| none | Work is available. | stated |');
    const dir = await baseProject({ files });
    await addSlot(dir, `${claimFolder}/encoding.md`, combination);
    const names = await stateRunSurprises(dir);
    const name = names.find((value) => value.startsWith('lifecycles-p/parts/p/claims/safe/base.'));
    assert.ok(name);
    const item = missing(dir).find((entry) => entry.item === `explain:${name}`);
    assert.ok(item);
    assert.ok(Object.hasOwn(item, 'found'));
    const packet = await tempFolder();
    ok(forma(dir, ['give', item.item, packet, '--json']));
    assert.deepEqual(JSON.parse(await read(packet, 'item.json')).item.found, item.found);
    for (const contract of ['door', 'account', 'evidence', 'models', 'decisions']) {
      assert.equal(await read(packet, `forma/${contract}.md`), await read(repo, `spec/${contract}.md`));
    }
  });

  // door.md §sessions now discounts only a decision-making entry.session,
  // not a historical author; models.md §slot-currency keeps an accepted slot current.
  test('models.md §slot-currency / door.md §sessions: a decision session in historical authors alone does not discount a slot', async () => {
    const dir = await baseProject();
    await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
    const lines = await receiptLines(dir, claimFolder);
    const row = lines.find((entry) => entry.file === 'encoding.md');
    const decisionSession = { provider: 'contract', model: 'developer', session: 'models-developer' };
    row.authors = [decisionSession, writer];
    await writeFiles(dir, { [`${claimFolder}/receipt`]: lines.map((line) => JSON.stringify(line) + '\n').join('') });
    const items = missing(dir);
    assert.equal(items.some((entry) => entry.item === `change:${claimFolder}/encoding.md`), false);
    assert.equal(items.some((entry) => entry.item === 'slot:lifecycles-p/parts/p/claims/safe/encoding'), false);
  });
});

// Engine fixtures/probes: engines.md §engine-text to forms.md §menu and models.md §model-answer to §slot-answer.
// All interaction with SANY/Alloy still goes through Forma's public CLI.
const mtModelPath = 'models/core/model.md';
const mtTlaPath = 'models/core/Core.tla';
const mtAlloyPath = 'models/core/core.als';
const mtClaim = 'models/core/parts/p/claims/safe';
const mtSchedulePath = 'models/core/parts/p/journeys/finish/schedule.md';
const mtMenu = ['drop', 'duplicate', 'delay', 'reorder', 'fail-forever', 'fail-then-succeed', 'crash', 'go-silent'];
// engines.md §slot-forms: the expected end is the done phase, after the last step.
function mtSchedule(engine = 'tlc') {
  return '| Entity | Value |\n| --- | --- |\n\n| Step | Bindings |\n| --- | --- |\n| 1 | none |\n'
    + '\n| Field | Value |\n| --- | --- |\n| Meaning | The thing is done. |\n\n'
    + (engine === 'tlc' ? '```tla\nEnd == phase = "done"\n```\n'
      : '```alloy\npred End { Thing.phase = done }\n```\n');
}
const mtProperty = {
  tlc: 'Invariant == phase \\in {"idle", "done"}\n',
  alloy: 'assert Claim { always Thing.phase in idle + done }\n',
};
function mtReplace(files, path, oldText, newText) {
  // Fixture sanity only: the caller's cited form is mutated at its handwritten
  // source text, so a missing replacement cannot silently test another case.
  assert.ok(files[path]?.includes(oldText), `Handwritten fixture lacks ${JSON.stringify(oldText)} in ${path}`);
  files[path] = files[path].replace(oldText, newText);
}
function mtDefinition(files, engine, text) {
  if (engine === 'tlc') mtReplace(files, mtTlaPath, '=============================================================================', text + '\n=============================================================================');
  else files[mtAlloyPath] += '\n' + text + '\n';
}
function mtRow(files, section, text) {
  const start = files[mtModelPath].indexOf(`## ${section}\n`);
  // engines.md §model-md: these named table sections exist in the fixture.
  assert.ok(start >= 0);
  const end = files[mtModelPath].indexOf('\n## ', start + 1);
  const at = end < 0 ? files[mtModelPath].length : end;
  files[mtModelPath] = files[mtModelPath].slice(0, at).trimEnd() + '\n' + text + '\n' + files[mtModelPath].slice(at);
}
async function mtTryModel(engine, mutate = () => {}, options = {}) {
  const dir = await baseProject(options);
  const files = await modelFiles(engine);
  await mutate(files);
  return { dir, files, result: await answer(dir, 'cover:p', files) };
}
// door.md §forma-answer requires the defining contract section, but does not
// prescribe one preferred citation among repeated/cross-referenced rules.
function mtRefused(result, slot = false) {
  return expectRefused(result);
}
async function mtSetup(engine, mutate = () => {}, options = {}) {
  const setup = await mtTryModel(engine, mutate, options);
  expectAccepted(setup.result, 'model');
  return setup;
}
async function mtNative(engine, kind, text, mutate = () => {}, options = {}) {
  const { dir } = await mtSetup(engine, mutate, options);
  const extension = engine === 'tlc' ? 'tla' : 'als';
  if (kind !== 'encoding') await addSlot(dir, `${mtClaim}/encoding.${extension}`, mtProperty[engine]);
  const path = `${mtClaim}/${kind === 'encoding' ? `encoding.${extension}` : `${kind}-one.md`}`;
  const item = `slot:core/parts/p/claims/safe/${kind}`;
  return { dir, path, result: await answer(dir, item, { [path]: text }) };
}
function mtWitness(engine, native) {
  return '| Field | Value |\n| --- | --- |\n| Meaning | Completion is reached. |\n\n```' +
    (engine === 'tlc' ? 'tla' : 'alloy') + '\n' + native + '\n```\n';
}
function mtFault(engine, native, action = 'p/step') {
  return `| Field | Value |\n| --- | --- |\n| Action | ${action} |\n| Mechanism | Completion stability |\n\n\`\`\`${engine === 'tlc' ? 'tla' : 'alloy'}\n${native}\n\`\`\`\n`;
}
// forms.md §claims, §premises: liveness rests on a fairness premise.
async function mtLiveOptions() {
  const path = 'design/parts/p/claims/safe/README.md';
  return { files: {
    [path]: (await loadCase('base'))[path].replace('| Kind | safety |', '| Kind | liveness |').replace('| Rests on | none |', '| Rests on | progress |'),
    'design/parts/p/premises/progress/README.md': '# Progress\n\n| Field | Value |\n| --- | --- |\n' +
      '| Statement | An enabled service step is eventually taken. |\n| Class | fairness |\n| Why not examined | not verifiable here |\n' +
      '| Falsifier | A service step stays enabled forever without being taken. |\n| Provider | The service scheduler |\n' +
      '| Origin | added |\n| Cites | design/brief/system.md#system |\n',
  } };
}
// engines.md §model-actions: parameter names and native domains.
function mtParameters(files, engine, parameters, names) {
  mtReplace(files, mtModelPath, '| p/step | Step | none |', `| p/step | Step | ${parameters} |`);
  if (engine === 'tlc') mtReplace(files, mtTlaPath, 'Step ==', `Step(${names.join(', ')}) ==`);
  else mtReplace(files, mtAlloyPath, 'pred Step {', `pred Step[${names.map((name) => `${name}: Thing`).join(', ')}] {`);
  // The Alloy fact must call the newly parameterized predicate too.
  if (engine === 'alloy') mtReplace(files, mtAlloyPath, '(Step or', `(Step[${names.map(() => 'Thing').join(', ')}] or`);
}
// forms.md §boundary; forms.md §menu: a service seam and its menu.
async function mtWorldOptions(kind = 'service', seam = 'request-response') {
  const path = 'design/parts/p/boundary.md';
  const base = (await loadCase('base'))[path];
  return { files: { [path]: base + `| outside | The outside service | ${kind} | world | ${seam} | - | - | - | stated | design/brief/system.md#system |\n` } };
}
function mtWorldModel(files, engine, omit = []) {
  for (const [index, item] of mtMenu.entries()) {
    if (omit.includes(item)) continue;
    mtRow(files, 'Misbehaviours', `| p/outside | ${item} | World${index} | none |`);
    mtDefinition(files, engine, engine === 'tlc' ? `World${index} == UNCHANGED vars` : `pred World${index} { Thing.phase' = Thing.phase }`);
  }
}

describe('engines.md §engine-text engine text uses native parsers and source ranges', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`engines.md §engine-text: ${engine} ignores apparent definitions inside native comments${engine === 'tlc' ? ' and strings' : ''}`, engineOnly, async () => {
      // engines.md §engine-text (native parser); engines.md §model-fields (reserved definitions).
      const { result } = await mtTryModel(engine, (files) => mtDefinition(files, engine, engine === 'tlc'
        ? '(* FormaReserved == TRUE; Invariant == FALSE *)\nLiteral == "Fault == TRUE"'
        : '/* pred Claim {} fact { no Thing } open absent */\npred TextIsNotCode { some Thing }'));
      expectAccepted(result, 'model');
    });
    test(`engines.md §engine-text: ${engine} parses an engine file the entry never reaches`, engineOnly, async () => {
      // models.md §model-answer: every engine file is parsed, including unreachable files.
      const { result } = await mtTryModel(engine, (files) => {
        files[`models/core/${engine === 'tlc' ? 'Unused.tla' : 'unused.als'}`] = engine === 'tlc'
          ? '---- MODULE Unused ----\nBroken == MissingName\n====\n'
          : 'module unused\npred Broken { some MissingName }\n';
      });
      mtRefused(result);
    });
  }
  for (const [label, newline] of [['LF', '\n'], ['CRLF', '\r\n'], ['CR', '\r']]) {
    test(`engines.md §engine-text: Alloy counts ${label} lines for a valid multiline model`, engineOnly, async () => {
      // engines.md §engine-text: source ranges count LF, CRLF and CR as line endings.
      const { result } = await mtTryModel('alloy', (files) => { files[mtAlloyPath] = files[mtAlloyPath].replaceAll('\n', newline); });
      expectAccepted(result, 'model');
    });
    test(`engines.md §engine-text: Alloy checks a multiline slot's whole range with ${label}`, engineOnly, async () => {
      // engines.md §engine-text; models.md §slot-answer: one definition covers the native text.
      const text = '\nassert Claim {\n  always (Thing.phase in idle + done)\n}\n'.replaceAll('\n', newline);
      expectAccepted((await mtNative('alloy', 'encoding', text)).result);
    });
  }
});

describe('engines.md §model-md model.md has exactly its specified Markdown form', () => {
  test('engines.md §model-md: four sections may be in any order and table columns are matched case-insensitively', engineOnly, async () => {
    // engines.md §model-md; forms.md §page-rules: sections and table columns may be reordered, column names ignore case.
    const { result } = await mtTryModel('tlc', (files) => {
      const [prefix, ...sections] = files[mtModelPath].split('## ');
      files[mtModelPath] = prefix + sections.reverse().map((section) => '## ' + section).join('\n');
      mtReplace(files, mtModelPath, '| Action | Operator | Parameters |\n| --- | --- | --- |\n| p/step | Step | none |',
        '| parameters | ACTION | operator |\n| --- | --- | --- |\n| none | p/step | Step |');
    });
    expectAccepted(result, 'model');
  });
  const invalid = [
    ['missing level-one heading', (text) => text.replace(/^# .*\n/, '')],
    ['second heading', (text) => text + '\n# Another model\n'],
    ['extra prose', (text) => text + '\nUnspecified explanation.\n'],
    ['missing section', (text) => text.replace(/\n## Misbehaviours\n[\s\S]*?(?=\n## Phases)/, '')],
    ['duplicate section', (text) => text + '\n## Bounds\n\n| Bound | Value | Meaning |\n| --- | --- | --- |\n'],
    ['extra section', (text) => text + '\n## Notes\n\nNotes.\n'],
    ['missing field', (text) => text.replace('| Type invariant | TypeOK |\n', '')],
    ['duplicate field', (text) => text.replace('| Engine | tlc |', '| Engine | tlc |\n| engine | tlc |')],
    ['extra field', (text) => text.replace('| Engine | tlc |', '| Engine | tlc |\n| Version | 1 |')],
    ['extra column', (text) => text.replace('| p/step | Step | none |', '| p/step | Step | none | extra |')],
    ['empty required cell', (text) => text.replace('| p/step | Step | none |', '| p/step | Step | |')],
    ['duplicate column', (text) => text.replace('| Action | Operator | Parameters |', '| Action | Operator | Operator |')],
  ];
  for (const [label, change] of invalid) test(`engines.md §model-md: refuses ${label}`, engineOnly, async () => {
    // engines.md §model-md; engines.md §model-fields; forms.md §page-rules: exact blocks, fields, columns and nonempty cells.
    mtRefused((await mtTryModel('tlc', (files) => { files[mtModelPath] = change(files[mtModelPath]); })).result);
  });
});

describe('engines.md §model-fields fields, entry definitions and reserved names', () => {
  for (const [label, oldText, newText] of [
    ['unknown engine', '| Engine | tlc |', '| Engine | other |'],
    ['repeated part', '| Parts | p |', '| Parts | p, p |'],
    ['nonexistent part', '| Parts | p |', '| Parts | absent |'],
    ['entry not supplied', '| Entry | Core.tla |', '| Entry | Missing.tla |'],
    ['entry given by a path', '| Entry | Core.tla |', '| Entry | child/Core.tla |'],
    ['wrong entry extension', '| Entry | Core.tla |', '| Entry | Core.als |'],
    ['missing type invariant', '| Type invariant | TypeOK |', '| Type invariant | Absent |'],
  ]) test(`engines.md §model-fields: refuses ${label}`, engineOnly, async () => {
    // engines.md §model-fields; models.md §model-answer: engine, unique existing parts, entry and type invariant.
    mtRefused((await mtTryModel('tlc', (files) => mtReplace(files, mtModelPath, oldText, newText))).result);
  });
  test('engines.md §model-fields: Alloy type invariant is exactly the inapplicable marker', engineOnly, async () => {
    // engines.md §model-fields: Alloy uses exactly the inapplicable marker.
    mtRefused((await mtTryModel('alloy', (files) => mtReplace(files, mtModelPath, '| Type invariant | - |', '| Type invariant | TypeOK |'))).result);
  });
  for (const engine of ['tlc', 'alloy']) {
    for (const prefix of ['Forma', 'forma']) test(`engines.md §model-fields: ${engine} reserves filenames beginning ${prefix}`, engineOnly, async () => {
      // engines.md §model-fields: neither generated-name prefix may name an engine file.
      const { result } = await mtTryModel(engine, (files) => {
        files[`models/core/${prefix}Private.${engine === 'tlc' ? 'tla' : 'als'}`] = engine === 'tlc'
          ? `---- MODULE ${prefix}Private ----\nValue == TRUE\n====\n` : `module ${prefix}Private\npred Value {}\n`;
      });
      mtRefused(result);
    });
    for (const name of (engine === 'tlc' ? ['FormaLocal', 'formaLocal', 'Invariant', 'Property', 'Fairness', 'Target', 'Fault', 'End'] : ['FormaLocal', 'formaLocal', 'Claim', 'Target', 'Fault', 'End'])) {
      test(`engines.md §model-fields: ${engine} reserves definition ${name}`, engineOnly, async () => {
        // engines.md §model-fields: generated prefixes and the listed slot names are reserved.
        mtRefused((await mtTryModel(engine, (files) => mtDefinition(files, engine,
          engine === 'tlc' ? `${name} == TRUE` : `pred ${name} { some Thing }`))).result);
      });
    }
    for (const field of ['Parameters', 'Over']) test(`engines.md §model-fields: ${engine} reserves generated-name prefixes in ${field}`, engineOnly, async () => {
      // engines.md §model-fields: a Parameters or Over binding cannot use either reserved prefix.
      mtRefused((await mtTryModel(engine, (files) => {
        if (field === 'Parameters') mtParameters(files, engine, engine === 'tlc' ? 'FormaArg \\in Things' : 'FormaArg: Thing', ['FormaArg']);
        else mtReplace(files, mtModelPath, engine === 'tlc' ? '| e \\in Things | Phase(e) |' : '| e: Thing | e.phase |',
          engine === 'tlc' ? '| formaEntity \\in Things | Phase(formaEntity) |' : '| formaEntity: Thing | formaEntity.phase |');
      })).result);
    });
  }
  for (const [kind, definition] of [
    ['signature', 'sig Claim {}'], ['field', 'sig Holder { Target: set Thing }'],
    ['function', 'fun Fault: set Thing { Thing }'], ['assertion', 'assert Target { some Thing }'],
    ['command', 'Claim: run {} for 3'],
  ]) test(`engines.md §model-fields: Alloy reserves slot names on a ${kind} listed by its language server`, engineOnly, async () => {
    // engines.md §engine-text; engines.md §model-fields: every language-server-listed definition obeys slot-name reservations.
    mtRefused((await mtTryModel('alloy', (files) => mtDefinition(files, 'alloy', definition))).result);
  });
  for (const [label, oldText, newText] of [
    ['absent Init', 'Init == phase = "idle"', 'Initial == phase = "idle"'],
    ['action-level Init', 'Init == phase = "idle"', 'Init == phase\' = "idle"'],
    ['temporal type invariant', 'TypeOK == phase \\in {"idle", "done"}', 'TypeOK == <> (phase = "done")'],
    ['vars omitting a variable', 'vars == <<phase>>', 'vars == <<>>'],
    ['vars repeating a variable', 'vars == <<phase>>', 'vars == <<phase, phase>>'],
    ['vars naming a nonvariable', 'vars == <<phase>>', 'vars == <<phase, Things>>'],
  ]) test(`engines.md §model-fields: TLC refuses ${label}`, engineOnly, async () => {
    // engines.md §model-fields; models.md §model-answer: Init/type invariant are state predicates and vars lists every variable exactly once.
    mtRefused((await mtTryModel('tlc', (files) => mtReplace(files, mtTlaPath, oldText, newText))).result);
  });
  test('engines.md §model-fields: TLC permits its own Next but composes from the action table', engineOnly, async () => {
    // engines.md §model-fields; engines.md §tlc: generated row transitions, not Next, reach the scheduled step.
      // evidence.md §bounds, §question-names, §keys: one path evidence file and its found.outcome.
    const { dir, result } = await mtTryModel('tlc', (files) => mtDefinition(files, 'tlc', 'Next == FALSE'));
    expectAccepted(result, 'model');
    await addSlot(dir, mtSchedulePath, mtSchedule());
    ok(forma(dir, ['run', '--json']));
    const paths = (await tree(dir)).filter((path) => /^models\/core\/parts\/p\/journeys\/finish\/path\.[a-f0-9]{12}\.json$/.test(path));
    assert.equal(paths.length, 1);
    assert.equal(JSON.parse(await read(dir, paths[0])).found.outcome, 'reached');
  });
});

describe('engines.md §bounds bounds use the fixed small forms and record trades', () => {
  // evidence.md §bounds and design.md §passages: Unicode White_Space outside strings
  // normalizes before the sorted LF-terminated bound lines are hashed.
  test('engines.md §bounds / evidence.md §bounds: Unicode bound whitespace gives the canonical question digest', engineOnly, async () => {
    const { dir } = await mtSetup('tlc', (files) =>
      mtReplace(files, mtModelPath, '| {thing} |', '| {\u00a0thing,\u2003other\u3000} |'));
    await addSlot(dir, mtSchedulePath, mtSchedule());
    ok(forma(dir, ['run', '--json']));
    const digest = sha256('constant Things = {thing, other}\n').slice(0, 12);
    const path = `models/core/parts/p/journeys/finish/path.${digest}.json`;
    assert.notEqual(await read(dir, path), null);
  });

  for (const value of ['0', '-2', '"two people"', 'TRUE', 'FALSE', '-1..2', '{person_1, person2}', '{1, 2}', '{"a", "b"}', '{TRUE, FALSE}', '{}']) {
    test(`engines.md §bounds: TLC accepts constant value ${value}`, engineOnly, async () => {
      // engines.md §bounds: the listed integer, string, Boolean, range and set forms are admitted.
      const { result } = await mtTryModel('tlc', (files) => {
        mtReplace(files, mtTlaPath, 'CONSTANT Things', 'CONSTANT Things, Sample');
        mtRow(files, 'Bounds', `| constant Sample | ${value} | a sample domain bound |`);
      });
      expectAccepted(result, 'model');
    });
  }
  for (const value of ['1 + 1', 'Things', '1..3 \\ {2}', 'TRUE\\nINVARIANT Other', '{p1} UNION {p2}', '1.5']) {
    test(`engines.md §bounds: TLC refuses native or configuration text as constant value ${value}`, engineOnly, async () => {
      // engines.md §bounds: constant values use the small bound grammar, never arbitrary native/configuration text.
      mtRefused((await mtTryModel('tlc', (files) => mtReplace(files, mtModelPath, '| {thing} |', `| ${value} |`))).result);
    });
  }
  for (const [label, mutate] of [
    ['missing constant row', (files) => mtReplace(files, mtModelPath, '| constant Things | {thing} | one thing |\n', '')],
    ['duplicate constant row', (files) => mtRow(files, 'Bounds', '| constant Things | {other} | another bound |')],
    ['undeclared constant row', (files) => mtRow(files, 'Bounds', '| constant Missing | 1 | an undeclared constant |')],
    ['choose for undefined operator', (files) => mtRow(files, 'Bounds', '| choose Missing | - | unexamined options |')],
    ['non-marker choose value', (files) => { mtDefinition(files, 'tlc', 'Pick == CHOOSE e \\in Things : TRUE'); mtRow(files, 'Bounds', '| choose Pick | 1 | other choices are not explored |'); }],
    ['duplicate constraint', (files) => { mtRow(files, 'Bounds', '| constraint | TypeOK | bounded states |'); mtRow(files, 'Bounds', '| constraint | TypeOK | bounded states twice |'); }],
    ['action-level constraint', (files) => mtRow(files, 'Bounds', '| constraint | phase\' = "done" | primed text is not a state bound |')],
    ['undefined constraint name', (files) => mtRow(files, 'Bounds', '| constraint | Missing | nonexistent state bound |')],
  ]) test(`engines.md §bounds: refuses ${label}`, engineOnly, async () => {
    // engines.md §bounds; models.md §model-answer: constants are exact, choose names exist and use -, and at most one state constraint parses.
    mtRefused((await mtTryModel('tlc', mutate)).result); });
  test('engines.md §bounds: imported constants need rows and CHOOSE trades name defined operators', engineOnly, async () => {
    // engines.md §bounds; models.md §model-answer: imported constants and defined CHOOSE operators have these bounds.
    const { result } = await mtTryModel('tlc', (files) => {
      mtReplace(files, mtTlaPath, 'EXTENDS Integers', 'EXTENDS Integers, Extra');
      files['models/core/Extra.tla'] = '---- MODULE Extra ----\nCONSTANT Other\nPick == CHOOSE e \\in Other : TRUE\n====\n';
      mtRow(files, 'Bounds', '| constant Other | {other} | one other thing |');
      mtRow(files, 'Bounds', '| choose Pick | - | other selections are not explored |');
    });
    expectAccepted(result, 'model');
  });
  test('engines.md §bounds: a constant declared by an imported TLC module cannot lack its bound', engineOnly, async () => {
    // engines.md §bounds; models.md §model-answer: every imported constant needs its bound.
    mtRefused((await mtTryModel('tlc', (files) => {
      mtReplace(files, mtTlaPath, 'EXTENDS Integers', 'EXTENDS Integers, Extra');
      files['models/core/Extra.tla'] = '---- MODULE Extra ----\nCONSTANT Other\n====\n';
    })).result);
  });
  test('engines.md §bounds: an omitted CHOOSE trade is explicitly outside the automatic checks', engineOnly, async () => {
    // engines.md §bounds: completeness of recorded CHOOSE trades is explicitly not checked.
    expectAccepted((await mtTryModel('tlc', (files) => mtDefinition(files, 'tlc', 'Pick == CHOOSE e \\in Things : TRUE'))).result, 'model');
  });
  for (const scope of ['3', '3 but exactly 1 Thing', 'exactly 1 Thing', '3 but 1 Thing, exactly 1 idle']) {
    test(`engines.md §bounds: Alloy accepts scope ${scope}`, engineOnly, async () => {
      // engines.md §bounds: default scope and signature-bound forms are accepted.
      expectAccepted((await mtTryModel('alloy', (files) => mtReplace(files, mtModelPath, '3 but exactly 1 Thing', scope))).result, 'model');
    });
  }
  for (const [bound, value] of [['steps', '2'], ['steps', '1..3'], ['int', '1'], ['int', '4']]) {
    test(`engines.md §bounds: Alloy accepts ${bound} in its own row as ${value}`, engineOnly, async () => {
      // engines.md §bounds: steps is a number or range; int is an integer of at least one, each in its own row.
      expectAccepted((await mtTryModel('alloy', (files) => mtRow(files, 'Bounds', `| ${bound} | ${value} | a finite examination bound |`))).result, 'model');
    });
  }
  test('engines.md §bounds: Alloy scope signature names may be qualified by imported module names', engineOnly, async () => {
    // engines.md §bounds: slash-qualified signature names are part of the scope grammar.
    expectAccepted((await mtTryModel('alloy', (files) => {
      files['models/core/extra.als'] = 'module extra\nsig Extra {}\n';
      mtReplace(files, mtAlloyPath, 'module core', 'module core\nopen extra');
      mtReplace(files, mtModelPath, '3 but exactly 1 Thing', '3 but exactly 1 Thing, 1 extra/Extra');
    })).result, 'model');
  });
  for (const [label, mutate] of [
    ['scope missing', (files) => mtReplace(files, mtModelPath, '| scope | 3 but exactly 1 Thing | one thing and its two phases |\n', '')],
    ['scope repeated', (files) => mtRow(files, 'Bounds', '| scope | 3 | a second scope |')],
    ['steps repeated', (files) => { mtRow(files, 'Bounds', '| steps | 2 | two steps |'); mtRow(files, 'Bounds', '| steps | 3 | three steps |'); }],
    ['int repeated', (files) => { mtRow(files, 'Bounds', '| int | 2 | two bits |'); mtRow(files, 'Bounds', '| int | 3 | three bits |'); }],
    ['zero bitwidth', (files) => mtRow(files, 'Bounds', '| int | 0 | no bits |')],
    ['non-numeric steps', (files) => mtRow(files, 'Bounds', '| steps | several | no numerical bound |')],
    ['steps embedded in scope', (files) => mtReplace(files, mtModelPath, '3 but exactly 1 Thing', '3 but 2 steps')],
    ['bitwidth embedded in scope', (files) => mtReplace(files, mtModelPath, '3 but exactly 1 Thing', '3 but 4 Int')],
    ['native text in scope', (files) => mtReplace(files, mtModelPath, '3 but exactly 1 Thing', '3 expect 1')],
    ['unknown scope signature', (files) => mtReplace(files, mtModelPath, '3 but exactly 1 Thing', '3 but exactly 1 Missing')],
  ]) test(`engines.md §bounds: Alloy refuses ${label}`, engineOnly, async () => {
    // engines.md §bounds; models.md §model-answer: exact bound rows, separate steps/int and parser-resolved signatures.
    mtRefused((await mtTryModel('alloy', mutate)).result); });
  for (const liveness of [false, true]) test(`engines.md §bounds: a constraint ${liveness ? 'does not bound liveness' : 'bounds safety'} questions`, engineOnly, async () => {
    // engines.md §bounds; evidence.md §bounds: safety includes the constraint, liveness omits it.
    // evidence.md §question-names, §keys fix one base path and its bounds object; no configuration spelling is asserted.
    const options = liveness ? await mtLiveOptions() : {};
    const { dir } = await mtSetup('tlc', (files) => mtRow(files, 'Bounds', '| constraint | TypeOK | only the two named phases |'), options);
    await addSlot(dir, `${mtClaim}/encoding.tla`, liveness ? 'Property == <> (phase = "done")\nFairness == WF_vars(Step)\n' : mtProperty.tlc);
    await addSlot(dir, mtSchedulePath, mtSchedule());
    ok(forma(dir, ['run', '--json']));
    const paths = (await tree(dir)).filter((path) => /^models\/core\/parts\/p\/claims\/safe\/base\.[a-f0-9]{12}\.json$/.test(path));
    assert.equal(paths.length, 1);
    const evidence = JSON.parse(await read(dir, paths[0]));
    assert.deepEqual(evidence.bounds, liveness ? { 'constant Things': '{thing}' } : { 'constant Things': '{thing}', constraint: 'TypeOK' });
  });
});

describe('engines.md §model-actions action rows and parameter domains', () => {
  for (const engine of ['tlc', 'alloy']) {
    for (const [label, replacement] of [
      ['absent action', ''], ['duplicate action', '| p/step | Step | none |\n| p/step | Step | none |'],
      ['unknown action', '| p/absent | Step | none |'], ['unqualified action', '| step | Step | none |'],
      ['missing operator', '| p/step | Missing | none |'], ['empty parameters', '| p/step | Step | |'],
    ]) test(`engines.md §model-actions: ${engine} refuses ${label}`, engineOnly, async () => {
      // engines.md §model-actions; models.md §model-answer: exactly one qualified row for each action, an existing operator and nonempty Parameters.
      mtRefused((await mtTryModel(engine, (files) => mtReplace(files, mtModelPath, '| p/step | Step | none |', replacement))).result);
    });
    test(`engines.md §model-actions: ${engine} parses domains using preceding parameters`, engineOnly, async () => {
      // engines.md §model-actions; models.md §model-answer: native domains are parsed with earlier row parameters in scope.
      const { result } = await mtTryModel(engine, (files) => mtParameters(files, engine,
        engine === 'tlc' ? 'a \\in Things, b \\in {a}' : 'a: Thing, b: a', ['a', 'b']));
      expectAccepted(result, 'model');
    });
    test(`engines.md §model-actions: ${engine} rejects an incorrect argument count`, engineOnly, async () => {
      // models.md §model-answer: native row application must parse at the declared arity.
      mtRefused((await mtTryModel(engine, (files) => mtReplace(files, mtModelPath, '| p/step | Step | none |',
        `| p/step | Step | ${engine === 'tlc' ? 'a \\in Things' : 'a: Thing'} |`))).result);
    });
    test(`engines.md §model-actions: ${engine} refuses repeated parameter names`, engineOnly, async () => {
      // engines.md §model-actions: each row names a parameter once.
      mtRefused((await mtTryModel(engine, (files) => {
        mtParameters(files, engine, engine === 'tlc' ? 'a \\in Things, a \\in Things' : 'a: Thing, a: Thing', ['a', 'b']);
      })).result);
    });
    test(`engines.md §model-actions: ${engine} refuses punctuation in a parameter name`, engineOnly, async () => {
      // engines.md §model-actions: parameter names contain letters, digits and underscores.
      mtRefused((await mtTryModel(engine, (files) => mtParameters(files, engine,
        engine === 'tlc' ? 'bad-name \\in Things' : 'bad-name: Thing', ['a']))).result);
    });
  }
  test('engines.md §model-actions: TLC keeps commas in nested domains and strings inside one parameter', engineOnly, async () => {
    // engines.md §model-actions: only commas outside brackets and strings separate parameters.
    expectAccepted((await mtTryModel('tlc', (files) => mtParameters(files, 'tlc',
      'a \\in Things, pair \\in {<<1, 2>>}, label \\in {"first,second"}', ['a', 'pair', 'label']))).result, 'model');
  });
  test('engines.md §model-actions: TLC action operator cannot be temporal', engineOnly, async () => {
    // engines.md §model-actions; models.md §model-answer: an action row must name an action, not a temporal formula.
    mtRefused((await mtTryModel('tlc', (files) => mtReplace(files, mtTlaPath, 'Step == phase\' = "done"', 'Step == <> (phase = "done")'))).result);
  });
  test('engines.md §model-actions: Alloy examines a row over a compatible narrower domain without claiming domain equality', engineOnly, async () => {
    // models.md §model-answer: Alloy accepts a compatible domain and does not check exact equality with the predicate domain.
    expectAccepted((await mtTryModel('alloy', (files) => mtParameters(files, 'alloy', 'a: Thing & Thing', ['a']))).result, 'model');
  });
  test('engines.md §model-actions: Alloy does not split the comma inside a domain function application', engineOnly, async () => {
    // engines.md §model-actions: a bracketed function application remains one native domain.
    expectAccepted((await mtTryModel('alloy', (files) => {
      mtDefinition(files, 'alloy', 'fun eligible[a, b: Thing]: set Thing { a + b }');
      mtParameters(files, 'alloy', 'a: eligible[Thing, Thing]', ['a']);
    })).result, 'model');
  });
  for (const domain of ['set Thing', 'lone Thing', 'Thing -> Thing', 'Thing } fact { no Thing']) {
    test(`engines.md §model-actions: Alloy refuses parameter domain ${domain}`, engineOnly, async () => {
      // engines.md §model-actions; models.md §model-answer: one atom-set expression, without multiplicity, arrow or appended definition.
      mtRefused((await mtTryModel('alloy', (files) => mtParameters(files, 'alloy', `a: ${domain}`, ['a']))).result);
    });
  }
  test('engines.md §model-actions: Alloy predicate names are unqualified', engineOnly, async () => {
    // engines.md §model-actions: the row names one unqualified predicate.
    mtRefused((await mtTryModel('alloy', (files) => mtReplace(files, mtModelPath, '| p/step | Step | none |', '| p/step | core/Step | none |'))).result);
  });
  test('engines.md §model-actions: Alloy rejects two predicates of the row name even in different modules', engineOnly, async () => {
    // engines.md §model-actions; models.md §model-answer: exactly one such predicate exists across all model files.
    mtRefused((await mtTryModel('alloy', (files) => { files['models/core/other.als'] = 'module other\npred Step {}\n'; })).result);
  });
});

describe('engines.md §model-misbehaviours misbehaviour rows are complete and unambiguous', () => {
  for (const engine of ['tlc', 'alloy']) {
    for (const [label, change] of [
      ['missing unstruck item', (files) => mtReplace(files, mtModelPath, '| p/outside | drop | World0 | none |\n', '')],
      ['duplicate item', (files) => mtRow(files, 'Misbehaviours', '| p/outside | drop | World0 | none |')],
      ['nonexistent row', (files) => mtReplace(files, mtModelPath, '| p/outside | drop |', '| p/absent | drop |')],
      ['item outside menu', (files) => mtReplace(files, mtModelPath, '| p/outside | drop |', '| p/outside | invent |')],
      ['display spelling in Item', (files) => mtReplace(files, mtModelPath, '| fail-forever |', '| fail forever |')],
      ['operator shared with Actions', (files) => mtReplace(files, mtModelPath, '| p/outside | drop | World0 | none |', '| p/outside | drop | Step | none |')],
      ['operator shared by two misbehaviours', (files) => mtReplace(files, mtModelPath, '| duplicate | World1 |', '| duplicate | World0 |')],
    ]) test(`engines.md §model-misbehaviours: ${engine} refuses ${label}`, engineOnly, async () => {
      // engines.md §model-misbehaviours; engines.md §model-actions; forms.md §menu; models.md §model-answer: exact menu rows and unique operators across both tables.
      mtRefused((await mtTryModel(engine, (files) => { mtWorldModel(files, engine); change(files); }, await mtWorldOptions())).result);
    });
  }
});

describe('engines.md §model-phases each lifecycle has a native phase projection', () => {
  for (const engine of ['tlc', 'alloy']) {
    const row = engine === 'tlc' ? '| p/life | e \\in Things | Phase(e) |' : '| p/life | e: Thing | e.phase |';
    for (const [label, newRow] of [['missing row', ''], ['duplicate row', row + '\n' + row], ['unknown lifecycle', row.replace('p/life', 'p/absent')], ['unqualified lifecycle', row.replace('p/life', 'life')]]) {
      test(`engines.md §model-phases: ${engine} refuses ${label}`, engineOnly, async () => {
        // engines.md §model-phases; engines.md §model-md; models.md §model-answer: exactly one qualified row per lifecycle.
        mtRefused((await mtTryModel(engine, (files) => mtReplace(files, mtModelPath, row, newRow))).result);
      });
    }
    test(`engines.md §model-phases: ${engine} rejects an undefined phase expression`, engineOnly, async () => {
      // models.md §model-answer: every phase expression is resolved by the engine parser.
      mtRefused((await mtTryModel(engine, (files) => mtReplace(files, mtModelPath, row, row.replace(engine === 'tlc' ? 'Phase(e)' : 'e.phase', engine === 'tlc' ? 'Missing(e)' : 'Missing')))).result);
    });
    test(`engines.md §model-phases: ${engine} Over binds exactly one parameter`, engineOnly, async () => {
      // engines.md §model-phases: Over names exactly one native parameter.
      mtRefused((await mtTryModel(engine, (files) => mtReplace(files, mtModelPath,
        engine === 'tlc' ? '| e \\in Things |' : '| e: Thing |',
        engine === 'tlc' ? '| e \\in Things, other \\in Things |' : '| e: Thing, other: Thing |'))).result);
    });
  }
  test('engines.md §model-phases: TLC refuses an action-level phase expression', engineOnly, async () => {
    // engines.md §model-phases; models.md §model-answer: the projection is a state function.
    mtRefused((await mtTryModel('tlc', (files) => mtReplace(files, mtModelPath, '| Phase(e) |', '| phase\' |'))).result);
  });
  for (const [label, change] of [
    ['missing phase signature', (files) => { files[mtAlloyPath] = files[mtAlloyPath].replaceAll('done', 'complete'); }],
    ['duplicate phase signature in another module', (files) => { files['models/core/other.als'] = 'module other\nsig done {}\n'; }],
    ['non-atomic Over expression', (files) => mtReplace(files, mtModelPath, '| e: Thing |', '| e: Thing -> Thing |')],
    ['non-atomic phase expression', (files) => mtReplace(files, mtModelPath, '| e.phase |', '| e.phase -> e.phase |')],
    ['definition appended to Over', (files) => mtReplace(files, mtModelPath, '| e: Thing |', '| e: Thing } fact { no Thing |')],
    ['fact appended to Expression', (files) => mtReplace(files, mtModelPath, '| e.phase |', '| e.phase } fact { no Thing |')],
  ]) test(`engines.md §model-phases: Alloy refuses ${label}`, engineOnly, async () => {
    // engines.md §model-phases; models.md §model-answer: unique phase signatures and whole atom-set domain/expression cells.
    mtRefused((await mtTryModel('alloy', change)).result); });
  test('engines.md §model-phases: Alloy maps hyphenated phase names to underscored signatures', engineOnly, async () => {
    // engines.md §model-phases: phase hyphens map to signature underscores.
    const base = await loadCase('base');
    const life = 'design/parts/p/lifecycles/life/README.md';
    const { result } = await mtTryModel('alloy', (files) => { files[mtAlloyPath] = files[mtAlloyPath].replaceAll('idle', 'not_done'); },
      { files: { [life]: base[life].replaceAll('idle', 'not-done') } });
    expectAccepted(result, 'model');
  });
  for (const engine of ['tlc', 'alloy']) test(`engines.md §model-phases: ${engine} phase membership is examined as a question`, engineOnly, async () => {
    // engines.md §model-phases; evidence.md §questions: an unknown TLC phase or multiply classified Alloy atom violates phase membership.
    // evidence.md §bounds, §question-names, §keys fix the single phases evidence path and found.outcome.
    const { dir } = await mtSetup(engine, (files) => {
      if (engine === 'tlc') mtReplace(files, mtTlaPath, 'Phase(e) == phase', 'Phase(e) == IF phase = "idle" THEN "not-a-phase" ELSE phase');
      else {
        mtReplace(files, mtAlloyPath, 'abstract sig Phase {}', 'one sig Phase {}');
        mtReplace(files, mtAlloyPath, 'one sig idle, done extends Phase {}', 'one sig idle, done in Phase {}');
      }
    });
    ok(forma(dir, ['run', '--json']));
    const paths = (await tree(dir)).filter((path) => /^models\/core\/phases\.[a-f0-9]{12}\.json$/.test(path));
    assert.equal(paths.length, 1);
    assert.equal(JSON.parse(await read(dir, paths[0])).found.outcome, 'violation');
  });
});

describe('forms.md §menu the entire misbehaviour menu applies and strikes alter obligations', () => {
  for (const kind of ['actor', 'service', 'queue', 'clock']) {
    for (const seam of ['request-response', 'webhook', 'queue', 'clock', 'person']) {
      test(`forms.md §menu: ${kind} with ${seam} owes all eight canonical misbehaviour paths`, engineOnly, async () => {
        // forms.md §menu; models.md §slots; models.md §owed: every seam on each listed world kind owes all eight witness slots.
        // account.md §items names each slot item slot:<path>.
        const { dir } = await mtSetup('tlc', (files) => mtWorldModel(files, 'tlc'), await mtWorldOptions(kind, seam));
        const names = missing(dir).map((item) => item.item);
        for (const item of mtMenu) assert.ok(names.includes(`slot:core/world/p/outside/${item}`), `${item} is owed`);
      });
    }
  }
  for (const engine of ['tlc', 'alloy']) {
    test(`forms.md §menu: ${engine} permits omission of a struck item and owes no witness`, engineOnly, async () => {
      // forms.md §menu; models.md §slots; door.md §receipts: a struck item may have no row/witness, and model.md receipts record its strike.
      const dir = await baseProject(await mtWorldOptions());
      await decide(dir, 'carry', 'strike:p/outside/drop', ['--choice', 'carry']);
      const files = await modelFiles(engine); mtWorldModel(files, engine, ['drop']);
      expectAccepted(await answer(dir, 'cover:p', files), 'model');
      assert.ok(!missing(dir).some((item) => item.item === 'slot:core/world/p/outside/drop'));
      const modelLine = (await receiptLines(dir, 'models/core')).find((line) => line.file === 'model.md');
      assert.deepEqual(modelLine.strikes, ['strike:p/outside/drop']);
    });
    test(`forms.md §menu: ${engine} ${engine === 'tlc' ? 'does not check' : 'still checks'} a struck row's operator`, engineOnly, async () => {
      // forms.md §menu; models.md §model-answer: only TLC skips the struck operator check.
      const dir = await baseProject(await mtWorldOptions());
      await decide(dir, 'carry', 'strike:p/outside/drop', ['--choice', 'carry']);
      const files = await modelFiles(engine); mtWorldModel(files, engine);
      mtReplace(files, mtModelPath, '| drop | World0 |', '| drop | Missing |');
      const result = await answer(dir, 'cover:p', files);
      if (engine === 'tlc') expectAccepted(result, 'model'); else mtRefused(result);
    });
    test(`forms.md §menu: striking an item after ${engine} model acceptance leaves its row allowed`, engineOnly, async () => {
      // forms.md §menu: a new strike leaves the row allowed and owes neither a Model answer nor that witness.
      const { dir } = await mtSetup(engine, (files) => mtWorldModel(files, engine), await mtWorldOptions());
      await decide(dir, 'carry', 'strike:p/outside/drop', ['--choice', 'carry']);
      assert.ok(!missing(dir).some((item) => item.item === 'model:core'));
      assert.ok(!missing(dir).some((item) => item.item === 'slot:core/world/p/outside/drop'));
    });
    test(`forms.md §menu: withdrawing a recorded strike ${engine === 'tlc' ? 'owes a TLC Model answer' : 'keeps a complete Alloy table usable'}`, engineOnly, async () => {
      // forms.md §menu; models.md §parts-change: TLC needs a Model answer after a recorded strike ends; a complete Alloy table remains usable.
      const dir = await baseProject(await mtWorldOptions());
      await decide(dir, 'carry', 'strike:p/outside/drop', ['--choice', 'carry']);
      const files = await modelFiles(engine); mtWorldModel(files, engine);
      expectAccepted(await answer(dir, 'cover:p', files), 'model');
      await decide(dir, 'carry', 'strike:p/outside/drop', ['--choice', 'withdraw']);
      assert.equal(missing(dir).some((item) => item.item === 'model:core'), engine === 'tlc');
    });
    test(`forms.md §menu: ${engine} questions exclude a struck transition and never ask whether it is enabled`, engineOnly, async () => {
      // forms.md §menu; evidence.md §questions: questions exclude the struck transition and ask no enabled/misbehaviour question for it.
      // evidence.md §bounds, §question-names, §keys fix the paths and no-violation phase outcome.
      const dir = await baseProject(await mtWorldOptions());
      await decide(dir, 'carry', 'strike:p/outside/drop', ['--choice', 'carry']);
      const files = await modelFiles(engine); mtWorldModel(files, engine);
      if (engine === 'tlc') mtReplace(files, mtTlaPath, 'World0 == UNCHANGED vars', 'World0 == phase\' = "broken"');
      else {
        mtDefinition(files, 'alloy', 'one sig broken extends Phase {}');
        mtReplace(files, mtAlloyPath, "pred World0 { Thing.phase' = Thing.phase }", "pred World0 { Thing.phase' = broken }");
        mtReplace(files, mtAlloyPath, '(Step or', '(Step or World0 or');
      }
      expectAccepted(await answer(dir, 'cover:p', files), 'model');
      ok(forma(dir, ['run', '--json']));
      const paths = await tree(dir);
      assert.ok(!paths.some((path) => /^models\/core\/world\/p\/outside\/drop(?:\.enabled)?\.[a-f0-9]{12}\.json$/.test(path)));
      const phases = paths.filter((path) => /^models\/core\/phases\.[a-f0-9]{12}\.json$/.test(path));
      assert.equal(phases.length, 1);
      assert.equal(JSON.parse(await read(dir, phases[0])).found.outcome, 'no violation');
    });
  }
});

describe('models.md §model-answer a Model answer is whole and checked atomically', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`models.md §model-answer: accepts and receipts every file of a complete ${engine} model`, engineOnly, async () => {
      // models.md §model-answer; door.md §forma-answer, §receipts: submitted bytes, written hashes and author receipts.
      const { dir, files, result } = await mtTryModel(engine);
      const json = expectAccepted(result, 'model');
      for (const [path, bytes] of Object.entries(files)) {
        assert.ok(json.written.some((row) => row.path === path && row.sha256 === sha256(bytes)));
        assert.equal(await read(dir, path), bytes);
      }
      const lines = await receiptLines(dir, 'models/core');
      for (const [path, bytes] of Object.entries(files)) {
        const line = lines.find((item) => item.file === path.split('/').at(-1));
        assert.equal(line.sha256, sha256(bytes));
        assert.deepEqual(line.authors, [writer]);
      }
    });
    test(`models.md §model-answer: ${engine} refusal leaves all tracked bytes alone and lists independent failed checks`, engineOnly, async () => {
      // models.md §model-answer; door.md §forma-answer: report each failed form/parser check and change no record bytes.
      // project.md §tree: design/models are tracked; work/runs are scratch and excluded from the byte snapshot.
      const dir = await baseProject(); const before = await snapshot(dir, { skip: ['work', 'runs'] });
      const files = await modelFiles(engine);
      mtReplace(files, mtModelPath, '| Parts | p |', '| Parts | absent |');
      mtReplace(files, mtModelPath, '| p/step | Step | none |', '| p/step | Missing | none |');
      const result = mtRefused(await answer(dir, 'cover:p', files));
      assert.ok(result.reasons.length >= 2, 'form/reference and parser failures are both reported');
      assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    });
    test(`models.md §model-answer: replacing a whole ${engine} model removes an omitted engine file and retains authors`, engineOnly, async () => {
      // models.md §model-answer; models.md §parts-change: an added action owes a Model answer; replacement removes omitted engine files.
      // door.md §forma-answer, §receipts fix removed paths, merged authors and removal of their receipt lines.
      const oldPath = `models/core/${engine === 'tlc' ? 'Unused.tla' : 'unused.als'}`;
      const { dir } = await mtSetup(engine, (files) => { files[oldPath] = engine === 'tlc' ? '---- MODULE Unused ----\nUnusedValue == TRUE\n====\n' : 'module unused\npred UnusedValue {}\n'; });
      const base = await loadCase('base');
      const actions = 'design/parts/p/actions.md'; const life = 'design/parts/p/lifecycles/life/README.md';
      await seedFiles(dir, {
        [actions]: base[actions] + '| again | actor | Try again. | none | none | stated | design/brief/system.md#system |\n',
        [life]: base[life].replace('| Unaffected | none |', '| Unaffected | again |'),
      });
      assert.ok(missing(dir).some((item) => item.item === 'model:core'));
      const replacement = await modelFiles(engine);
      mtRow(replacement, 'Actions', '| p/again | Again | none |');
      mtDefinition(replacement, engine, engine === 'tlc' ? 'Again == UNCHANGED vars' : "pred Again { Thing.phase' = Thing.phase }");
      const folder = await answerFolder(replacement);
      const result = forma(dir, ['answer', 'model:core', folder, '--provider', writer.provider, '--model', writer.model, '--session', 'second-model-writer', '--json']);
      const json = expectAccepted(result, 'model');
      assert.ok(json.removed.includes(oldPath));
      assert.equal(await read(dir, oldPath), null);
      const lines = await receiptLines(dir, 'models/core');
      assert.ok(!lines.some((line) => line.file === oldPath.split('/').at(-1)));
      assert.deepEqual(lines.find((line) => line.file === 'model.md').authors, [writer, { ...writer, session: 'second-model-writer' }]);
    });
  }
});

describe('models.md §slot-answer native slots are exact, typed definitions', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`models.md §slot-answer: ${engine} accepts a property, state witness and action fault`, engineOnly, async () => {
      // engines.md §slot-forms; models.md §slot-answer: native encoding, parameterless state Target and action Fault are valid.
      const { dir } = await mtSetup(engine);
      await addSlot(dir, `${mtClaim}/encoding.${engine === 'tlc' ? 'tla' : 'als'}`, mtProperty[engine]);
      await addSlot(dir, `${mtClaim}/witness-done.md`, mtWitness(engine, engine === 'tlc' ? 'Target == phase = "done"' : 'pred Target { Thing.phase = done }'), 'slot:core/parts/p/claims/safe/witness');
      await addSlot(dir, `${mtClaim}/fault-back.md`, mtFault(engine, engine === 'tlc' ? 'Fault == phase\' = "idle"' : "pred Fault { Thing.phase' = idle }"), 'slot:core/parts/p/claims/safe/fault');
    });
    test(`models.md §slot-answer: ${engine} accepts exactly Target as a misbehaviour witness`, engineOnly, async () => {
      // engines.md §slot-forms; models.md §slot-answer: a misbehaviour witness contains only its Target definition.
      const { dir } = await mtSetup(engine, (files) => mtWorldModel(files, engine), await mtWorldOptions());
      await addSlot(dir, `models/core/world/p/outside/drop.${engine === 'tlc' ? 'tla' : 'als'}`, engine === 'tlc' ? 'Target == phase = "idle"\n' : 'pred Target { Thing.phase = idle }\n');
    });
    test(`models.md §slot-answer: ${engine} refuses a fault referring to an action absent from its table`, engineOnly, async () => {
      // engines.md §slot-forms; models.md §slot-answer: Fault Action must resolve to the Actions table.
      mtRefused((await mtNative(engine, 'fault', mtFault(engine, engine === 'tlc' ? 'Fault == phase\' = "idle"' : "pred Fault { Thing.phase' = idle }", 'p/missing'))).result, true);
    });
    test(`models.md §slot-answer: ${engine} rejects a fault with too many parameters`, engineOnly, async () => {
      // models.md §slot-answer: Fault has exactly its action operator’s parameter count.
      mtRefused((await mtNative(engine, 'fault', mtFault(engine, engine === 'tlc' ? 'Fault(x) == phase\' = "idle"' : "pred Fault[x: Thing] { Thing.phase' = idle }"))).result, true);
    });
    test(`models.md §slot-answer: ${engine} accepts a parameterized fault by arity without requiring the action's parameter names`, engineOnly, async () => {
      // models.md §slot-answer: arity and typed application are checked, not equality of parameter names.
      const { result } = await mtNative(engine, 'fault', mtFault(engine,
        engine === 'tlc' ? 'Fault(replacement) == phase\' = "idle"' : "pred Fault[replacement: Thing] { replacement.phase' = idle }"),
      (files) => mtParameters(files, engine, engine === 'tlc' ? 'a \\in Things' : 'a: Thing', ['a']));
      expectAccepted(result);
    });
    test(`models.md §slot-answer: ${engine} rejects a fault with too few parameters`, engineOnly, async () => {
      // models.md §slot-answer: Fault has exactly its action operator’s parameter count.
      const { result } = await mtNative(engine, 'fault', mtFault(engine,
        engine === 'tlc' ? 'Fault == phase\' = "idle"' : "pred Fault { Thing.phase' = idle }"),
      (files) => mtParameters(files, engine, engine === 'tlc' ? 'a \\in Things' : 'a: Thing', ['a']));
      mtRefused(result, true);
    });
    test(`models.md §slot-answer: ${engine} rejects a witness taking parameters`, engineOnly, async () => {
      // engines.md §slot-forms; models.md §slot-answer: Target takes no parameters.
      mtRefused((await mtNative(engine, 'witness', mtWitness(engine, engine === 'tlc' ? 'Target(x) == phase = "done"' : 'pred Target[x: Thing] { x.phase = done }'))).result, true);
    });
    test(`models.md §slot-answer: ${engine} refuses an extra definition alongside a misbehaviour Target`, engineOnly, async () => {
      // engines.md §slot-forms; models.md §slot-answer: no definition may stand beside Target.
      const { dir } = await mtSetup(engine, (files) => mtWorldModel(files, engine), await mtWorldOptions());
      const path = `models/core/world/p/outside/drop.${engine === 'tlc' ? 'tla' : 'als'}`;
      mtRefused(await answer(dir, 'slot:core/world/p/outside/drop', { [path]: engine === 'tlc' ? 'Target == TRUE\nExtra == TRUE\n' : 'pred Target {}\npred Extra {}\n' }), true);
    });
  }
  for (const [label, text] of [
    ['both property definitions', 'Invariant == TypeOK\nProperty == []TypeOK\n'],
    ['neither property definition', 'Other == TypeOK\n'],
    ['extra helper definition', 'Invariant == TypeOK\nHelper == TRUE\n'],
    ['declared constant', 'CONSTANT Extra\nInvariant == TypeOK\n'],
    ['declared variable', 'VARIABLE extra\nInvariant == TypeOK\n'],
    ['module brought in', 'EXTENDS Naturals\nInvariant == TypeOK\n'],
    ['action-level Invariant', 'Invariant == phase\' = "done"\n'],
    ['Fairness on a safety encoding', 'Invariant == TypeOK\nFairness == WF_vars(Step)\n'],
    ['unresolved name', 'Invariant == Missing\n'],
  ]) test(`models.md §slot-answer: TLC refuses ${label}`, engineOnly, async () => {
    // engines.md §slot-forms; models.md §slot-answer: exact property name/form and level; no extra definitions, declarations, modules or unresolved names.
    mtRefused((await mtNative('tlc', 'encoding', text)).result, true); });
  test('models.md §slot-answer: TLC permits a temporal Property as its sole safety encoding', engineOnly, async () => {
    // engines.md §slot-forms; models.md §slot-answer: a safety encoding may use Property without Fairness.
    expectAccepted((await mtNative('tlc', 'encoding', 'Property == []TypeOK\n')).result);
  });
  test('models.md §slot-answer: TLC rejects an action-level witness Target', engineOnly, async () => {
    // engines.md §slot-forms; models.md §slot-answer: TLC Target is a state predicate.
    mtRefused((await mtNative('tlc', 'witness', mtWitness('tlc', 'Target == phase\' = "done"'))).result, true);
  });
  test('models.md §slot-answer: TLC rejects a temporal Fault', engineOnly, async () => {
    // engines.md §slot-forms; models.md §slot-answer: TLC Fault is an action.
    mtRefused((await mtNative('tlc', 'fault', mtFault('tlc', 'Fault == <> (phase = "idle")'))).result, true);
  });
  for (const [label, text] of [
    ['wrong assertion name', 'assert Other { some Thing }'],
    ['predicate instead of assertion', 'pred Claim { some Thing }'],
    ['second assertion', 'assert Claim { some Thing }\nassert Other { some Thing }'],
    ['appended fact', 'assert Claim { some Thing }\nfact { no Thing }'],
    ['module open beside assertion', 'open util/ordering[Thing]\nassert Claim { some Thing }'],
    ['private modifier', 'private assert Claim { some Thing }'],
    ['signature beside assertion', 'assert Claim { some Thing }\nsig Extra {}'],
    ['run command beside assertion', 'assert Claim { some Thing }\nrun {} for 3'],
  ]) test(`models.md §slot-answer: Alloy refuses ${label}`, engineOnly, async () => {
    // engines.md §slot-forms; models.md §slot-answer: exactly assert Claim, its source range covers the text, and no modifier/extra definition/fact/open/command is allowed.
    mtRefused((await mtNative('alloy', 'encoding', text)).result, true); });
  test('models.md §slot-answer: Alloy does not invent a state/action level check its parser cannot perform', engineOnly, async () => {
    // models.md §slot-answer: Alloy performs no state/action-level check its parser cannot make.
    expectAccepted((await mtNative('alloy', 'witness', mtWitness('alloy', "pred Target { Thing.phase' = done }"))).result);
  });
  test('models.md §slot-answer: Alloy rejects a private modifier outside the Target definition range', engineOnly, async () => {
    // models.md §slot-answer: private precedes the definition’s range and is forbidden.
    mtRefused((await mtNative('alloy', 'witness', mtWitness('alloy', 'private pred Target { some Thing }'))).result, true);
  });
  test('models.md §slot-answer: Alloy checks a fault in its defining module as well as the entry probe', engineOnly, async () => {
    // models.md §slot-answer: a fault must resolve both in the entry probe and its action’s defining module.
    const { result } = await mtNative('alloy', 'fault', mtFault('alloy', 'pred Fault { some RootOnly }'), (files) => {
      const text = files[mtAlloyPath];
      const definitions = text.slice(text.indexOf('abstract sig'), text.indexOf('fact Behavior'));
      files['models/core/worker.als'] = 'module worker\n' + definitions;
      files[mtAlloyPath] = 'module core\nopen worker\nfun RootOnly: set Thing { Thing }\n' + text.slice(text.indexOf('fact Behavior'));
    });
    mtRefused(result, true);
  });
});

describe('models.md §slot-answer fairness is restricted to the action rows and their domains', () => {
  for (const [label, text] of [
    ['Invariant without Property', 'Invariant == TypeOK\nFairness == WF_vars(Step)\n'],
    ['Invariant without Property or Fairness', 'Invariant == TypeOK\n'],
    ['Invariant beside Property and Fairness', 'Invariant == TypeOK\nProperty == <> (phase = "done")\nFairness == WF_vars(Step)\n'],
  ]) test(`models.md §slot-answer: liveness refuses ${label}`, engineOnly, async () => {
    // engines.md §slot-forms (changed): liveness requires Property and Fairness, so every listed use of Invariant is refused; models.md §slot-answer checks exactly those definitions.
    mtRefused((await mtNative('tlc', 'encoding', text, () => {}, await mtLiveOptions())).result, true);
  });
  for (const fairness of ['WF_vars(Step)', 'SF_vars(Step)', 'WF_vars(Step) /\\ SF_vars(Step)']) {
    test(`models.md §slot-answer: parameterless liveness accepts ${fairness}`, engineOnly, async () => {
      // engines.md §slot-forms; models.md §slot-answer: parameterless WF/SF terms and their conjunction use the Actions operator and vars.
      expectAccepted((await mtNative('tlc', 'encoding', `Property == <> (phase = "done")\nFairness == ${fairness}\n`, () => {}, await mtLiveOptions())).result);
    });
  }
  for (const fairness of [
    '\\A a \\in Things : WF_vars(Step(a))',
    '\\A a \\in Things : SF_vars((a = a) /\\ Step(a))',
    'WF_vars(\\E a \\in Things : Step(a))',
    'SF_vars(\\E a \\in Things : (a = a) /\\ Step(a))',
  ]) test(`models.md §slot-answer: accepts row-bound fairness ${fairness}`, engineOnly, async () => {
    // engines.md §slot-forms; models.md §slot-answer: bind each row parameter once with its row domain, universally outside or existentially inside fairness.
    expectAccepted((await mtNative('tlc', 'encoding', `Property == <> (phase = "done")\nFairness == ${fairness}\n`,
      (files) => mtParameters(files, 'tlc', 'a \\in Things', ['a']), await mtLiveOptions())).result);
  });
  test('models.md §slot-answer: state-dependent domains bind existentially inside fairness', engineOnly, async () => {
    // models.md §slot-answer: a nonconstant domain uses the inner existential binding.
    expectAccepted((await mtNative('tlc', 'encoding', 'Property == <> (phase = "done")\nFairness == WF_vars(\\E a \\in EnabledThings : Step(a))\n', (files) => {
      mtDefinition(files, 'tlc', 'EnabledThings == IF phase = "idle" THEN Things ELSE {}');
      mtParameters(files, 'tlc', 'a \\in EnabledThings', ['a']);
    }, await mtLiveOptions())).result);
  });
  test('models.md §slot-answer: fairness may conjoin a named constant-level condition on the bound parameters', engineOnly, async () => {
    // engines.md §slot-forms; models.md §slot-answer: named constant-level parameter conditions may be conjoined.
    expectAccepted((await mtNative('tlc', 'encoding', 'Property == <> (phase = "done")\nFairness == \\A a \\in Things : WF_vars(Allowed(a) /\\ Step(a))\n', (files) => {
      mtDefinition(files, 'tlc', 'Allowed(a) == a = a');
      mtParameters(files, 'tlc', 'a \\in Things', ['a']);
    }, await mtLiveOptions())).result);
  });
  const invalid = [
    ['missing Fairness', ''],
    ['arbitrary temporal formula', 'Fairness == []<>(phase = "done")\n'],
    ['operator outside the Actions table', 'Fairness == WF_vars(Other)\n'],
    ['tuple instead of the reserved vars name', 'Fairness == WF_<<phase>>(Step)\n'],
    ['state-level condition', 'Fairness == WF_vars((phase = "idle") /\\ Step)\n'],
    ['state definition beside fairness', 'Fairness == TypeOK /\\ WF_vars(Step)\n'],
  ];
  for (const [label, fairness] of invalid) test(`models.md §slot-answer: refuses ${label} in liveness`, engineOnly, async () => {
    // engines.md §slot-forms; models.md §slot-answer: Fairness is required and uses only WF/SF, Actions operators, vars and constant-level conditions/definitions.
    mtRefused((await mtNative('tlc', 'encoding', 'Property == <> (phase = "done")\n' + fairness,
      (files) => mtDefinition(files, 'tlc', "Other == phase' = phase"), await mtLiveOptions())).result, true);
  });
  for (const [label, fairness] of [
    ['different quantifier domain', '\\A a \\in {} : WF_vars(Step(a))'],
    ['unbound parameter', 'WF_vars(Step(a))'],
    ['argument not the row parameter', '\\A a \\in Things : WF_vars(Step(CHOOSE b \\in Things : TRUE))'],
    ['repeated binding', '\\A a \\in Things : WF_vars(\\E a \\in Things : Step(a))'],
  ]) test(`models.md §slot-answer: refuses fairness with ${label}`, engineOnly, async () => {
    // engines.md §slot-forms; models.md §slot-answer: exact row domains, parameter names/order and exactly-once binding.
    mtRefused((await mtNative('tlc', 'encoding', `Property == <> (phase = "done")\nFairness == ${fairness}\n`,
      (files) => mtParameters(files, 'tlc', 'a \\in Things', ['a']), await mtLiveOptions())).result, true);
  });
  test('models.md §slot-answer: fairness applies row parameters in the row order', engineOnly, async () => {
    // engines.md §slot-forms: the operator’s arguments are the row parameters in row order.
    mtRefused((await mtNative('tlc', 'encoding', 'Property == <> (phase = "done")\nFairness == \\A a \\in Things, b \\in Things : WF_vars(Step(b, a))\n',
      (files) => mtParameters(files, 'tlc', 'a \\in Things, b \\in Things', ['a', 'b']), await mtLiveOptions())).result, true);
  });
  test('models.md §slot-answer: state-dependent domains cannot be universally quantified outside fairness', engineOnly, async () => {
    // models.md §slot-answer: universal fairness quantification requires a constant domain.
    mtRefused((await mtNative('tlc', 'encoding', 'Property == <> (phase = "done")\nFairness == \\A a \\in EnabledThings : WF_vars(Step(a))\n', (files) => {
      mtDefinition(files, 'tlc', 'EnabledThings == IF phase = "idle" THEN Things ELSE {}');
      mtParameters(files, 'tlc', 'a \\in EnabledThings', ['a']);
    }, await mtLiveOptions())).result, true);
  });
});

describe('models.md §slot-answer schedules match the journey and parse each native cell', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`models.md §slot-answer: ${engine} accepts empty Entity table and none bindings when the journey needs neither`, engineOnly, async () => {
      // engines.md §slot-forms; models.md §slot-answer: no entity rows are required here and a parameterless step binds none.
      const { dir } = await mtSetup(engine); await addSlot(dir, mtSchedulePath, mtSchedule(engine));
    });
    for (const [label, change] of [
      ['missing step', (text) => text.replace('| 1 | none |\n', '')],
      ['extra step', (text) => text.replace('| 1 | none |\n', '| 1 | none |\n| 2 | none |\n')],
      ['duplicate step', (text) => text.replace('| 1 | none |\n', '| 1 | none |\n| 1 | none |\n')],
      ['wrong step number', (text) => text.replace('| 1 | none |', '| 2 | none |')],
      ['empty bindings', (text) => text.replace('| 1 | none |', '| 1 | |')],
      ['unknown parameter', (text) => text.replace('| 1 | none |', '| 1 | unknown = 1 |')],
      ['unexpected start', (text) => text + '\n| Start |\n| --- |\n| TRUE |\n'],
      ['duplicate Steps table', (text) => text + '\n| Step | Bindings |\n| --- | --- |\n| 1 | none |\n'],
    ]) test(`models.md §slot-answer: ${engine} schedule refuses ${label}`, engineOnly, async () => {
      // engines.md §slot-forms; models.md §slot-answer; forms.md §page-rules: tables occur once, steps/bindings match exactly and Start exists only for a journey start.
      const { dir } = await mtSetup(engine);
      mtRefused(await answer(dir, 'slot:core/parts/p/journeys/finish/schedule', { [mtSchedulePath]: change(mtSchedule(engine)) }), true);
    });
    test(`models.md §slot-answer: ${engine} schedule binds each action parameter`, engineOnly, async () => {
      // engines.md §slot-forms; models.md §slot-answer: each action parameter receives a parsable native binding.
      const { dir } = await mtSetup(engine, (files) => mtParameters(files, engine, engine === 'tlc' ? 'a \\in Things' : 'a: Thing', ['a']));
      await addSlot(dir, mtSchedulePath, mtSchedule(engine).replace('| 1 | none |', `| 1 | a = ${engine === 'tlc' ? 'CHOOSE e \\in Things : TRUE' : 'Thing'} |`));
    });
    for (const binding of ['none', 'a = Missing', 'a = 1; a = 1', 'a = 1; extra = 1']) {
      test(`models.md §slot-answer: ${engine} parameterized schedule refuses binding ${binding}`, engineOnly, async () => {
        // engines.md §slot-forms; models.md §slot-answer: bind exactly the parameters once; every supplied binding parses.
        const { dir } = await mtSetup(engine, (files) => mtParameters(files, engine, engine === 'tlc' ? 'a \\in Things' : 'a: Thing', ['a']));
        mtRefused(await answer(dir, 'slot:core/parts/p/journeys/finish/schedule', { [mtSchedulePath]: mtSchedule(engine).replace('| 1 | none |', `| 1 | ${binding} |`) }), true);
      });
    }
    for (const failure of [null, 'missing entity', 'repeated entity', 'missing start', 'two start rows', 'undefined start']) {
      test(`models.md §slot-answer: ${engine} named-entity start schedule ${failure ? `refuses ${failure}` : 'accepts exact values and start'}`, engineOnly, async () => {
        // engines.md §slot-forms; models.md §slot-answer: every named entity once, exactly one Start row when required, and native resolution.
        const base = await loadCase('base'); const path = 'design/parts/p/journeys/finish/README.md';
        const startTable = '| Lifecycle | Entity | Phase |\n| --- | --- | --- |\n| life | sample | done |\n\n';
        const { dir } = await mtSetup(engine, () => {}, { files: { [path]: base[path].replace('| Step | Actor |', startTable + '| Step | Actor |') } });
        const value = engine === 'tlc' ? 'CHOOSE e \\in Things : TRUE' : 'Thing';
        const start = engine === 'tlc' ? 'phase = "done"' : 'Thing.phase = done';
        let schedule = mtSchedule(engine).replace('| Entity | Value |\n| --- | --- |', `| Entity | Value |\n| --- | --- |\n| sample | ${value} |`)
          .replace('| Step | Bindings |', `| Start |\n| --- |\n| ${start} |\n\n| Step | Bindings |`);
        if (failure === 'missing entity') schedule = schedule.replace(`| sample | ${value} |\n`, '');
        if (failure === 'repeated entity') schedule = schedule.replace(`| sample | ${value} |`, `| sample | ${value} |\n| sample | ${value} |`);
        if (failure === 'missing start') schedule = schedule.replace(`| Start |\n| --- |\n| ${start} |\n\n`, '');
        if (failure === 'two start rows') schedule = schedule.replace(`| ${start} |\n`, `| ${start} |\n| ${start} |\n`);
        if (failure === 'undefined start') schedule = schedule.replace(`| ${start} |`, '| Missing |');
        const result = await answer(dir, 'slot:core/parts/p/journeys/finish/schedule', { [mtSchedulePath]: schedule });
        if (failure) mtRefused(result, true); else expectAccepted(result);
      });
    }
  }
  test('models.md §slot-answer: TLC schedule parser does not split a semicolon inside a string', engineOnly, async () => {
    // engines.md §slot-forms: semicolons inside strings do not separate native bindings.
    const { dir } = await mtSetup('tlc', (files) => mtParameters(files, 'tlc', 'a \\in {"a; b"}, b \\in {<<1, 2>>}', ['a', 'b']));
    await addSlot(dir, mtSchedulePath, mtSchedule().replace('| 1 | none |', '| 1 | a = "a; b"; b = <<1, 2>> |'));
  });
  test('models.md §slot-answer: TLC schedule entity values must be constant-level', engineOnly, async () => {
    // engines.md §slot-forms; models.md §slot-answer: TLC entity values are constant-level expressions.
    const base = await loadCase('base'); const path = 'design/parts/p/journeys/finish/README.md';
    const { dir } = await mtSetup('tlc', () => {}, { files: { [path]: base[path].replace('| Step | Actor |', '| Lifecycle | Entity | Phase |\n| --- | --- | --- |\n| life | sample | done |\n\n| Step | Actor |') } });
    const schedule = mtSchedule().replace('| Entity | Value |\n| --- | --- |', '| Entity | Value |\n| --- | --- |\n| sample | phase |')
      .replace('| Step | Bindings |', '| Start |\n| --- |\n| phase = "done" |\n\n| Step | Bindings |');
    mtRefused(await answer(dir, 'slot:core/parts/p/journeys/finish/schedule', { [mtSchedulePath]: schedule }), true);
  });
  for (const cell of ['entity', 'start', 'binding']) test(`models.md §slot-answer: Alloy rejects an extra fact injected through a schedule ${cell}`, engineOnly, async () => {
    // models.md §slot-answer: entity/start/binding cells each fill one whole native definition with no appended fact.
    const base = await loadCase('base'); const path = 'design/parts/p/journeys/finish/README.md';
    const { dir } = await mtSetup('alloy', (files) => mtParameters(files, 'alloy', 'a: Thing', ['a']), {
      files: { [path]: base[path].replace('| Step | Actor |', '| Lifecycle | Entity | Phase |\n| --- | --- | --- |\n| life | sample | done |\n\n| Step | Actor |') },
    });
    const entity = cell === 'entity' ? 'Thing } fact { no Thing' : 'Thing';
    const start = cell === 'start' ? 'some Thing } fact { no Thing' : 'Thing.phase = done';
    const binding = cell === 'binding' ? 'Thing } fact { no Thing' : 'Thing';
    const schedule = mtSchedule('alloy').replace('| Entity | Value |\n| --- | --- |', `| Entity | Value |\n| --- | --- |\n| sample | ${entity} |`).replace('| 1 | none |', `| 1 | a = ${binding} |`)
      .replace('| Step | Bindings |', `| Start |\n| --- |\n| ${start} |\n\n| Step | Bindings |`);
    mtRefused(await answer(dir, 'slot:core/parts/p/journeys/finish/schedule', { [mtSchedulePath]: schedule }), true);
  });
  for (const engine of ['tlc', 'alloy']) {
    test(`models.md §slot-answer: ${engine} schedule step rows follow journey order`, engineOnly, async () => {
      // engines.md §slot-forms: schedule rows use journey step order.
      const base = await loadCase('base'); const path = 'design/parts/p/journeys/finish/README.md';
      const { dir } = await mtSetup(engine, () => {}, { files: { [path]: base[path] + '| 2 | The service | step | - | - | - |\n' } });
      const result = await answer(dir, 'slot:core/parts/p/journeys/finish/schedule', {
        [mtSchedulePath]: mtSchedule(engine).replace('| 1 | none |', '| 2 | none |\n| 1 | none |'),
      });
      mtRefused(result, true);
    });
    test(`models.md §slot-answer: ${engine} a case step requires the implicitly named lifecycle entity`, engineOnly, async () => {
      // engines.md §slot-forms; models.md §slot-answer; lifecycle-tool.md §stepping: a case needs the entity of each lifecycle it moves.
      const { dir } = await mtSetup(engine, () => {}, await mtCaseOptions());
      mtRefused(await answer(dir, 'slot:core/parts/p/journeys/finish/schedule', { [mtSchedulePath]: mtSchedule(engine) }), true);
    });
  }
});

// forms.md §actions, §lifecycles, §journeys:
// the handwritten case fixture adds case names, each case outcome and a case step.
async function mtCaseOptions() {
  const base = await loadCase('base');
  const actions = 'design/parts/p/actions.md'; const life = 'design/parts/p/lifecycles/life/README.md';
  const journey = 'design/parts/p/journeys/finish/README.md';
  return { files: {
    [actions]: base[actions].replace('| Advance the thing. | none | none |', '| Advance the thing. | ok, retry | none |'),
    [life]: base[life].replace('| idle | done |', '| idle | ok: done<br>retry: idle |').replace('| done | done |', '| done | ok: done<br>retry: done |'),
    [journey]: base[journey].replace('| 1 | The service | step | - | - | - |', '| 1 | The service | step | - | - | ok |'),
  } };
}

describe('models.md §slot-currency engine slot receipts record exactly the entries they serve', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`models.md §slot-currency: ${engine} fault records the claim and its action pins`, engineOnly, async () => {
      // models.md §slot-currency; door.md §receipts: fault pins exactly the claim and its Action, sorted by entry; design.md §pins fixes their hashes.
      const { dir, result } = await mtNative(engine, 'fault', mtFault(engine, engine === 'tlc' ? 'Fault == phase\' = "idle"' : "pred Fault { Thing.phase' = idle }"));
      expectAccepted(result);
      const line = (await receiptLines(dir, mtClaim)).find((entry) => entry.file === 'fault-one.md');
      assert.deepEqual(line.pins, [{ entry: 'p/actions/step', pin: actionPin() }, { entry: 'p/claims/safe', pin: claimPin() }]);
    });
    test(`models.md §slot-currency: ${engine} misbehaviour witness records its world row pin`, engineOnly, async () => {
      // models.md §slot-currency; door.md §receipts: a misbehaviour witness pins its world row; design.md §pins fixes its canonical hash.
      const { dir } = await mtSetup(engine, (files) => mtWorldModel(files, engine), await mtWorldOptions());
      const extension = engine === 'tlc' ? 'tla' : 'als';
      await addSlot(dir, `models/core/world/p/outside/drop.${extension}`, engine === 'tlc' ? 'Target == phase = "idle"\n' : 'pred Target { Thing.phase = idle }\n');
      // forms.md §boundary; design.md §pins: fields in boundary order, Row and Origin omitted.
      const pin = sha256(['Names: The outside service', 'Kind: service', 'Side: world', 'Seam: request-response',
        'Isolation: -', 'Reads: -', 'Writes: -', `Cites: ${passagePin}`].join('\n'));
      const line = (await receiptLines(dir, 'models/core/world/p/outside')).find((entry) => entry.file === `drop.${extension}`);
      assert.deepEqual(line.pins, [{ entry: 'p/boundary/outside', pin }]);
    });
    test(`models.md §slot-currency: ${engine} case schedule records journey, action and case lifecycle pins`, engineOnly, async () => {
      // models.md §slot-currency; door.md §receipts: schedule pins the journey, step actions and case lifecycles, in entry order.
      // forms.md §page-rules, §lifecycles (changed) permit Phase after the action column; design.md §pins fixes order-independent pins.
      const options = await mtCaseOptions();
      const lifePath = 'design/parts/p/lifecycles/life/README.md';
      options.files[lifePath] = options.files[lifePath]
        .replace('| Phase | step |', '| step | Phase |')
        .replace('| idle | ok: done<br>retry: idle |', '| ok: done<br>retry: idle | idle |')
        .replace('| done | ok: done<br>retry: done |', '| ok: done<br>retry: done | done |');
      const { dir } = await mtSetup(engine, () => {}, options);
      const value = engine === 'tlc' ? 'CHOOSE e \\in Things : TRUE' : 'Thing';
      await addSlot(dir, mtSchedulePath, mtSchedule(engine).replace('| Entity | Value |\n| --- | --- |', `| Entity | Value |\n| --- | --- |\n| life | ${value} |`));
      // design.md §pins: referenced actions include their case names; lifecycle
      // cells are sorted, and case outcomes are sorted within each cell.
      const action = sha256(['Actor: The service (service, machine, -, -)', 'Sentence: Advance the thing.',
        'Cases: ok, retry', 'Guard: none', `Cites: ${passagePin}`].join('\n'));
      const journey = sha256(['Polarity: should happen', 'Expected end: The thing is done.', 'Refused step: -',
        `Cites: ${passagePin}`, 'Step 1: The service | Advance the thing. (cases ok, retry) | - | - | ok'].join('\n'));
      const lifecycle = sha256(['Entity: The thing (entity, machine, -, -)', 'Initial: idle', 'Ends: done',
        'Unaffected: ', `Cites: ${passagePin}`, 'Cell: done | Advance the thing. (cases ok, retry) | ok: done; retry: done',
        'Cell: idle | Advance the thing. (cases ok, retry) | ok: done; retry: idle'].join('\n'));
      const line = (await receiptLines(dir, 'models/core/parts/p/journeys/finish')).find((entry) => entry.file === 'schedule.md');
      assert.deepEqual(line.pins, [{ entry: 'p/actions/step', pin: action }, { entry: 'p/journeys/finish', pin: journey }, { entry: 'p/lifecycles/life', pin: lifecycle }]);
    });
  }
});

describe('models.md §parts-change removal of a world row cleans its model slots', () => {
  for (const engine of ['tlc', 'alloy']) test(`models.md §parts-change: removing a world row removes all its ${engine} witnesses and receipts`, engineOnly, async () => {
    // models.md §parts-change; door.md §receipts: removing a world row removes every witness and its receipt, including the receipt’s final line.
    const { dir } = await mtSetup(engine, (files) => mtWorldModel(files, engine), await mtWorldOptions());
    const extension = engine === 'tlc' ? 'tla' : 'als';
    for (const item of mtMenu) await addSlot(dir, `models/core/world/p/outside/${item}.${extension}`, engine === 'tlc' ? 'Target == phase = "idle"\n' : 'pred Target { Thing.phase = idle }\n');
    const base = await loadCase('base'); const boundary = 'design/parts/p/boundary.md';
    expectAccepted(await stateRestate(dir, { [boundary]: base[boundary] }), 'restate');
    assert.ok(!(await tree(dir)).some((path) => path.startsWith('models/core/world/p/outside/')));
  });
});

// door.md §forma-answer: a reason cites the section defining its check;
// several sections can legitimately define the same slot restriction.
function slotRefusal(result) {
  return expectRefused(result);
}
async function rejectLifecycleSlot(path, text, item, options = {}) {
  const dir = await baseProject(options);
  if (!path.endsWith('/encoding.md')) await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
  const before = await snapshot(dir, { skip: ['work', 'runs'] });
  const result = await answer(dir, item, { [path]: text });
  slotRefusal(result);
  // door.md §forma-answer; door.md §copies: refusal changes no record file.
  assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
}

describe('models.md §paths Paths', () => {
  test('models.md §paths: accepting a slot creates its mirrored folder and matching receipt', async () => {
    // models.md §paths: mirrored slot path, accepted bytes and receipt.
    // door.md §forma-answer; door.md §receipts: written hash and receipt serialization.
    // door.md §clock: UTC milliseconds; models.md §slot-currency: claim and lifecycle pins.
    const dir = await baseProject();
    assert.equal(await read(dir, `${claimFolder}/encoding.md`), null);
    const result = expectAccepted(await answer(dir, 'slot:lifecycles-p/parts/p/claims/safe/encoding', {
      [`${claimFolder}/encoding.md`]: forbidden,
    }));
    assert.ok(result.written.some((row) => row.path === `${claimFolder}/encoding.md` && row.sha256 === sha256(forbidden)));
    assert.equal(await read(dir, `${claimFolder}/encoding.md`), forbidden);
    const lines = await receiptLines(dir, claimFolder);
    assert.equal(lines.length, 1);
    assert.deepEqual(Object.keys(lines[0]), ['file', 'sha256', 'at', 'session', 'authors', 'pins']);
    assert.equal(lines[0].file, 'encoding.md');
    assert.equal(lines[0].sha256, sha256(forbidden));
    assert.match(lines[0].at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.deepEqual(lines[0].session, writer);
    assert.deepEqual(lines[0].authors, [writer]);
    assert.deepEqual(lines[0].pins, [
      { entry: 'p/claims/safe', pin: claimPin() },
      { entry: 'p/lifecycles/life', pin: lifecyclePin() },
    ]);
    assert.equal(await read(dir, `${claimFolder}/receipt`), JSON.stringify(lines[0]) + '\n');
  });

  test('models.md §paths: an unreceipted slot and a direct edit count for nothing', async () => {
    // models.md §paths; door.md §receipts; door.md §change: unaccepted bytes count as absent and a slot answer restores them.
    // evidence.md §questions: no base question without a current property encoding.
    const dir = await baseProject();
    const path = `${claimFolder}/encoding.md`;
    await writeFiles(dir, { [path]: forbidden });
    assert.ok(missing(dir).some((item) => item.item === `change:${path}`));
    assert.ok(!missing(dir).some((item) => item.item === 'run:lifecycles-p/parts/p/claims/safe/base'));
    expectAccepted(await answer(dir, `change:${path}`, { [path]: forbidden }));
    await writeFiles(dir, { [path]: forbidden + '\n' });
    assert.ok(missing(dir).some((item) => item.item === `change:${path}`));
    assert.ok(!missing(dir).some((item) => item.item === 'run:lifecycles-p/parts/p/claims/safe/base'));
  });
});

describe('models.md §slots Slots', () => {
  test('models.md §slots: filling one keyed slot preserves its sibling bytes and receipt entries', async () => {
    // models.md §slots: filling one slot never rewrites another; door.md §receipts: only its receipt line is replaced.
    const dir = await baseProject();
    await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
    await addSlot(dir, `${claimFolder}/witness-first.md`, witness, 'slot:lifecycles-p/parts/p/claims/safe/witness');
    const before = await receiptLines(dir, claimFolder);
    await addSlot(dir, `${claimFolder}/fault-first.md`, fault, 'slot:lifecycles-p/parts/p/claims/safe/fault');
    assert.equal(await read(dir, `${claimFolder}/encoding.md`), forbidden);
    assert.equal(await read(dir, `${claimFolder}/witness-first.md`), witness);
    const after = await receiptLines(dir, claimFolder);
    for (const line of before) assert.deepEqual(after.find((row) => row.file === line.file), line);
  });

  test('models.md §slots: a reason encoding owes neither witness nor fault and has no base question', async () => {
    // models.md §slots; models.md §owed: reason encoding owes no witness or fault.
    // evidence.md §questions: base needs a property encoding.
    const dir = await baseProject();
    await addSlot(dir, `${claimFolder}/encoding.md`, reason);
    const items = missing(dir).map((item) => item.item);
    for (const suffix of ['encoding', 'witness', 'fault']) {
      assert.ok(!items.includes(`slot:lifecycles-p/parts/p/claims/safe/${suffix}`));
    }
    assert.ok(!items.includes('run:lifecycles-p/parts/p/claims/safe/base'));
  });

  for (const [kind, text] of [['witness', witness], ['fault', fault]]) {
    for (const key of ['first', 'a1', 'a-2-b']) {
      test(`models.md §slots: ${kind} accepts agent-chosen key ${key}`, async () => {
        // models.md §slots; forms.md §page-rules: agent keys follow the key grammar.
        // door.md §forma-answer: acceptance writes the submitted file.
        const dir = await baseProject();
        await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
        await addSlot(dir, `${claimFolder}/${kind}-${key}.md`, text, `slot:lifecycles-p/parts/p/claims/safe/${kind}`);
        assert.equal(await read(dir, `${claimFolder}/${kind}-${key}.md`), text);
      });
    }
    for (const key of ['Upper', '1first', 'a--b', 'last-']) {
      test(`models.md §slots: ${kind} refuses invalid key ${key}`, async () => {
        // models.md §slots; forms.md §page-rules: invalid agent keys are refused.
        // door.md §forma-answer; door.md §copies: refusal changes no tracked file.
        const dir = await baseProject();
        await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
        const before = await snapshot(dir, { skip: ['work', 'runs'] });
        expectRefused(await answer(dir, `slot:lifecycles-p/parts/p/claims/safe/${kind}`, {
          [`${claimFolder}/${kind}-${key}.md`]: text,
        }));
        assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
      });
    }
  }
});

describe('engines.md §slot-forms What each slot holds', () => {
  for (const kind of ['safety', 'structure']) {
    for (const [form, text] of [['combination', combination], ['transition', forbidden], ['reason', reason]]) {
      test(`engines.md §slot-forms: a lifecycle ${kind} encoding accepts its ${form} form`, async () => {
        // engines.md §slot-forms: safety and structure accept either forbidden table or a reason.
        // door.md §forma-answer: acceptance writes its text.
        const files = await loadCase('base');
        const path = 'design/parts/p/claims/safe/README.md';
        files[path] = files[path].replace('| Kind | safety |', `| Kind | ${kind} |`);
        const dir = await baseProject({ files });
        await addSlot(dir, `${claimFolder}/encoding.md`, text);
        assert.equal(await read(dir, `${claimFolder}/encoding.md`), text);
      });
    }
  }

  for (const [label, text] of [
    ['combination', witness],
    ['transition', witness.slice(0, witness.indexOf('| Lifecycle |')) + forbidden],
  ]) {
    test(`engines.md §slot-forms: a lifecycle witness accepts a ${label} target with Meaning`, async () => {
      // engines.md §slot-forms: Meaning precedes one combination or transition target.
      // door.md §forma-answer: acceptance writes its text.
      const dir = await baseProject();
      await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
      await addSlot(dir, `${claimFolder}/witness-target.md`, text, 'slot:lifecycles-p/parts/p/claims/safe/witness');
      assert.equal(await read(dir, `${claimFolder}/witness-target.md`), text);
    });
  }

  for (const [label, text] of [
    ['column order and case', '| phase | LIFECYCLE |\n| --- | --- |\n| `done` | `life` |\n'],
    ['field-name case and code-span cells', '| VALUE | field |\n| --- | --- |\n| `The property is not expressible here.` | cannot express |\n'],
  ]) {
    test(`engines.md §slot-forms: shared cell rules accept ${label}`, async () => {
      // engines.md §slot-forms; forms.md §page-rules: code spans, column order and case-insensitive field names.
      // door.md §forma-answer: accepted bytes remain as submitted.
      const dir = await baseProject();
      await addSlot(dir, `${claimFolder}/encoding.md`, text);
      assert.equal(await read(dir, `${claimFolder}/encoding.md`), text);
    });
  }

  for (const [label, text] of [
    ['empty combination', '| Lifecycle | Phase |\n| --- | --- |\n'],
    ['repeated lifecycle', combination + '| life | idle |\n'],
    ['two transition rows', forbidden + '| life | idle | step | done |\n'],
    ['missing column', '| Lifecycle |\n| --- |\n| life |\n'],
    ['extra column', '| Lifecycle | Phase | Extra |\n| --- | --- | --- |\n| life | done | x |\n'],
    ['repeated column', '| Lifecycle | Phase | Phase |\n| --- | --- | --- |\n| life | done | idle |\n'],
    ['empty required cell', combination.replace('| life | done |', '| life | |')],
    ['additional prose', combination + '\nExtra prose.\n'],
    ['additional heading', '# Encoding\n\n' + combination],
    ['unknown lifecycle', combination.replace('| life |', '| missing |')],
    ['qualified lifecycle instead of local key', combination.replace('| life |', '| p/life |')],
    ['unknown combination phase', combination.replace('| done |', '| missing |')],
    ['unknown transition source', forbidden.replace('| done |', '| missing |')],
    ['unknown transition target', forbidden.replace('| idle |', '| missing |')],
    ['unknown transition action', forbidden.replace('| step |', '| missing |')],
    ['duplicate Cannot express field', reason + '| Cannot express | A second reason. |\n'],
    ['empty Cannot express field', reason.replace('This engine cannot express the claim.', '')],
    ['extra reason field', reason + '| Extra | Text |\n'],
    ['reason plus property', reason + '\n' + combination],
  ]) {
    test(`engines.md §slot-forms: an encoding refuses ${label}`, async () => {
      // engines.md §slot-forms; models.md §slot-answer: exact encoding form and local references.
      // forms.md §page-rules: local references, nonempty cells and exact table columns.
      await rejectLifecycleSlot(`${claimFolder}/encoding.md`, text, 'slot:lifecycles-p/parts/p/claims/safe/encoding');
    });
  }

  for (const [label, text] of [
    ['missing Meaning', combination],
    ['empty Meaning', witness.replace('A completed thing is reached.', '')],
    ['extra field', witness.replace('\n\n', '\n| Extra | Text |\n\n')],
    ['duplicate Meaning', witness.replace('\n\n', '\n| Meaning | Again |\n\n')],
    ['two targets', witness + '\n' + forbidden],
  ]) {
    test(`engines.md §slot-forms: a witness refuses ${label}`, async () => {
      // engines.md §slot-forms: exactly Meaning and one target; forms.md §page-rules: required cells and fields.
      await rejectLifecycleSlot(`${claimFolder}/witness-bad.md`, text, 'slot:lifecycles-p/parts/p/claims/safe/witness');
    });
  }

  for (const [label, text] of [
    ['one cell', fault],
    ['two distinct cells', fault + '| life | idle | step | idle |\n'],
    ['empty outcome', fault.replace('| step | idle |', '| step | |')],
    ['refused outcome', fault.replace('| step | idle |', '| step | None. |')],
    ['escaped pipe in Mechanism', fault.replace('Completion stability', 'Completion \\| stability')],
  ]) {
    test(`engines.md §slot-forms: a lifecycle fault accepts ${label}`, async () => {
      // engines.md §slot-forms: dash Action, Mechanism and distinct overlay cells; Outcome may explicitly be empty.
      // forms.md §page-rules; forms.md §lifecycles: escaped pipes and None. outcome; door.md §forma-answer: writes accepted text.
      const dir = await baseProject();
      await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
      await addSlot(dir, `${claimFolder}/fault-overlay.md`, text, 'slot:lifecycles-p/parts/p/claims/safe/fault');
      assert.equal(await read(dir, `${claimFolder}/fault-overlay.md`), text);
    });
  }

  for (const [label, text] of [
    ['non-dash Action', fault.replace('| Action | - |', '| Action | p/step |')],
    ['missing Mechanism', fault.replace('| Mechanism | Completion stability |\n', '')],
    ['empty Mechanism', fault.replace('Completion stability', '')],
    ['extra field', fault.replace('\n\n', '\n| Extra | Text |\n\n')],
    ['zero overlay rows', fault.replace('| life | done | step | idle |\n', '')],
    ['duplicate overlay cell', fault + '| life | done | step | done |\n'],
    ['unknown lifecycle', fault.replace('| life |', '| missing |')],
    ['unknown phase', fault.replace('| done |', '| missing |')],
    ['unknown action', fault.replace('| step |', '| missing |')],
    ['unknown outcome phase', fault.replace('| step | idle |', '| step | missing |')],
    ['extra prose', fault + '\nExplanation outside the form.\n'],
  ]) {
    test(`engines.md §slot-forms: a lifecycle fault refuses ${label}`, async () => {
      // engines.md §slot-forms; models.md §slot-answer: exact fields, overlay rows and resolvable references.
      // forms.md §page-rules; forms.md §lifecycles: required cells and valid outcomes.
      await rejectLifecycleSlot(`${claimFolder}/fault-bad.md`, text, 'slot:lifecycles-p/parts/p/claims/safe/fault');
    });
  }
});

describe('models.md §lifecycle-model The lifecycle model', () => {
  test('models.md §lifecycle-model: lifecycle confirmation creates only its one-part model and encoding obligation', async () => {
    // models.md §lifecycle-model: confirmed one-part model, no model or engine file, schedule or world slot.
    // models.md §slots; models.md §owed: encoding and native whole-system cover remain owed.
    const dir = await baseProject({ confirmLifecycle: false });
    assert.ok(!missing(dir).some((item) => item.item.startsWith('slot:lifecycles-p/')));
    await decide(dir, 'confirm', 'p/lifecycles/life');
    const items = missing(dir);
    assert.ok(items.some((item) => item.item === 'slot:lifecycles-p/parts/p/claims/safe/encoding'));
    assert.ok(items.some((item) => item.item === 'cover:p'));
    assert.ok(!items.some((item) => item.item === 'model:lifecycles-p'));
    assert.ok(!items.some((item) => item.item.startsWith('slot:lifecycles-p/') &&
      (item.item.endsWith('/schedule') || item.item.includes('/world/'))));
    assert.equal(await read(dir, 'models/lifecycles-p/model.md'), null);
    assert.ok(!(await tree(dir)).some((path) => /^models\/lifecycles-p\/[^/]+\.(tla|als)$/.test(path)));
  });

  test('models.md §lifecycle-model: a lifecycle model does not cover a claim involving another part', async () => {
    // models.md §lifecycle-model: only its one part; models.md §owed: the first native model covers both parts.
    const files = await loadCase('base');
    files['design/README.md'] = files['design/README.md']
      .replace('\n\n1.', '\n| q | Receives completed work. | design/brief/system.md#system |\n\n1.');
    files['design/parts/q/README.md'] = '# Receiver\n';
    files['design/parts/p/claims/safe/README.md'] = files['design/parts/p/claims/safe/README.md'].replace('| Parts | p |', '| Parts | p, q |');
    const dir = await baseProject({ files });
    const items = missing(dir).map((row) => row.item);
    assert.ok(!items.includes('slot:lifecycles-p/parts/p/claims/safe/encoding'));
    assert.ok(items.includes('cover:p+q'));
  });

  for (const [label, text, accepts] of [['reason', reason, true], ['forbidden form', forbidden, false]]) {
    test(`models.md §lifecycle-model: a lifecycle liveness encoding ${accepts ? 'accepts' : 'refuses'} a ${label}`, async () => {
      // engines.md §slot-forms; design.md §restate-checks: lifecycle liveness needs a reason and a fairness premise.
      const files = await loadCase('base');
      files['design/parts/p/claims/safe/README.md'] = files['design/parts/p/claims/safe/README.md']
        .replace('| Kind | safety |', '| Kind | liveness |').replace('| Rests on | none |', '| Rests on | progress |');
      files['design/parts/p/premises/progress/README.md'] = '# Progress\n\n| Field | Value |\n| --- | --- |\n' +
        '| Statement | The service eventually steps. |\n| Class | fairness |\n| Why not examined | not verifiable here |\n' +
        '| Falsifier | The service never steps. |\n| Provider | The operator |\n| Origin | stated |\n| Cites | design/brief/system.md#system |\n';
      const dir = await baseProject({ files });
      const result = await answer(dir, 'slot:lifecycles-p/parts/p/claims/safe/encoding', { [`${claimFolder}/encoding.md`]: text });
      if (accepts) expectAccepted(result); else slotRefusal(result);
    });
  }
});

describe('models.md §slot-answer Accepting a Fill-a-slot answer', () => {
  test('models.md §slot-answer: a Fill-a-slot answer refuses two slot files and writes neither', async () => {
    // models.md §slot-answer: exactly one slot file; door.md §forma-answer: refusal leaves the record unchanged.
    const dir = await baseProject();
    await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    expectRefused(await answer(dir, 'slot:lifecycles-p/parts/p/claims/safe/witness', {
      [`${claimFolder}/witness-one.md`]: witness,
      [`${claimFolder}/witness-two.md`]: witness,
    }));
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
  });

  test('models.md §slot-answer: a reason cannot be submitted with a native engine extension on a lifecycle model', async () => {
    // models.md §slots; models.md §slot-answer: lifecycle and reason encodings use .md.
    // door.md §forma-answer: refusal changes no tracked record file.
    const dir = await baseProject();
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    expectRefused(await answer(dir, 'slot:lifecycles-p/parts/p/claims/safe/encoding', {
      [`${claimFolder}/encoding.tla`]: reason,
    }));
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
  });

  test('models.md §slot-answer: every independently broken reference is reported', async () => {
    // models.md §slot-answer; door.md §forma-answer: each unresolved reference is a failure and is reported.
    const dir = await baseProject();
    const text = '| Lifecycle | Phase |\n| --- | --- |\n| missing-a | idle |\n| missing-b | done |\n';
    const json = slotRefusal(await answer(dir, 'slot:lifecycles-p/parts/p/claims/safe/encoding', {
      [`${claimFolder}/encoding.md`]: text,
    }));
    assert.ok(json.reasons.length >= 2, 'door.md §forma-answer gives one reason for each failed reference');
  });
});

describe('models.md §owed What is owed — keyed witnesses and faults', () => {
  for (const [kind, text] of [['witness', witness], ['fault', fault]]) {
    test(`models.md §owed: the first ${kind} is missing, further unused keys remain answerable`, async () => {
      // models.md §owed: first witness/fault owed and further unused keys accepted; models.md §slots: sibling preserved.
      // account.md §items: unfilled; door.md §forma-answer: used current keys are not answerable.
      const dir = await baseProject();
      await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
      const item = `slot:lifecycles-p/parts/p/claims/safe/${kind}`;
      assert.ok(missing(dir).some((row) => row.item === item && row.why === 'unfilled'));
      await addSlot(dir, `${claimFolder}/${kind}-first.md`, text, item);
      assert.ok(!missing(dir).some((row) => row.item === item));
      // door.md §forma-give to §gives: the generic witness/fault item remains give-able after
      // its first keyed slot, with the claim and its existing accepted slots.
      const packet = await tempFolder();
      const given = ok(forma(dir, ['give', item, packet, '--json']));
      assert.equal(given.item, item);
      assert.equal(await read(packet, `${claimFolder}/${kind}-first.md`), text);
      assert.equal(await read(packet, 'design/parts/p/claims/safe/README.md'),
        await read(dir, 'design/parts/p/claims/safe/README.md'));
      await addSlot(dir, `${claimFolder}/${kind}-second.md`, text, item);
      assert.equal(await read(dir, `${claimFolder}/${kind}-first.md`), text);
      assert.equal(await read(dir, `${claimFolder}/${kind}-second.md`), text);
      expectRefused(await answer(dir, item, { [`${claimFolder}/${kind}-first.md`]: text }));
    });
  }
});

describe('engines.md §slot-forms Lifecycle forms naming more than one lifecycle', () => {
  test('engines.md §slot-forms: a named lifecycle may await confirmation, and no question composes until it is confirmed', async () => {
    // engines.md §slot-forms; evidence.md §questions: accept references before confirmation, compose afterward.
    // models.md §slot-currency; door.md §receipts: every lifecycle pin in entry order; models.md §owed: filled encoding no longer missing.
    const files = await loadCase('base');
    files['design/parts/p/boundary.md'] += '| other | The other thing | entity | machine | - | - | actor | actor | stated | design/brief/system.md#system |\n';
    files['design/parts/p/lifecycles/other/README.md'] = files['design/parts/p/lifecycles/life/README.md']
      .replace('# Thing state', '# Other state').replace('| Entity | thing |', '| Entity | other |');
    const dir = await baseProject({ files });
    const text = combination + '| other | done |\n';
    await addSlot(dir, `${claimFolder}/encoding.md`, text);
    ok(forma(dir, ['run', '--json']));
    assert.equal(await read(dir, `${claimFolder}/base.json`), null);
    assert.ok(!missing(dir).some((row) => row.item === 'run:lifecycles-p/parts/p/claims/safe/base'));
    await decide(dir, 'confirm', 'p/lifecycles/other');
    ok(forma(dir, ['run', '--json']));
    assert.notEqual(await read(dir, `${claimFolder}/base.json`), null);
    assert.ok(!missing(dir).some((row) => row.item === 'slot:lifecycles-p/parts/p/claims/safe/encoding'));
    const line = (await receiptLines(dir, claimFolder)).find((row) => row.file === 'encoding.md');
    assert.deepEqual(line.pins.map((row) => row.entry), ['p/claims/safe', 'p/lifecycles/life', 'p/lifecycles/other']);
  });
});

describe('models.md §lifecycle-model Lifecycle model boundaries', () => {
  test('models.md §lifecycle-model: even a world row with a seam creates no lifecycle misbehaviour witness', async () => {
    // models.md §lifecycle-model: lifecycle models never have misbehaviour witness slots.
    const files = await loadCase('base');
    files['design/parts/p/boundary.md'] += '| sender | External sender | actor | world | person | - | - | - | stated | design/brief/system.md#system |\n';
    const dir = await baseProject({ files });
    assert.ok(!missing(dir).some((row) => row.item.startsWith('slot:lifecycles-p/world/')));
  });

  test('models.md §lifecycle-model: lifecycle results carry phase level and need no model or engine file', async () => {
    // models.md §lifecycle-model: phase bound and no model/engine file; evidence.md §questions: base expected no violation.
    // evidence.md §keys; evidence.md §basis: evidence bounds, outcomes and lifecycle engine name.
    // lifecycle-tool.md §stepping: both step cells end at done, so the forbidden done-to-idle transition never occurs.
    const dir = await baseProject();
    await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
    ok(forma(dir, ['run', '--json']));
    const text = await read(dir, `${claimFolder}/base.json`);
    assert.notEqual(text, null);
    const evidence = JSON.parse(text);
    assert.equal(evidence.bounds, 'phase level');
    assert.equal(evidence.basis.engine.name, 'lifecycle');
    assert.deepEqual(evidence.expected, { outcome: 'no violation' });
    assert.deepEqual(evidence.found, { outcome: 'no violation' });
    assert.equal(await read(dir, 'models/lifecycles-p/model.md'), null);
    assert.ok(!(await tree(dir)).some((path) => /^models\/lifecycles-p\/[^/]+\.(tla|als)$/.test(path)));
  });
});

describe('models.md §parts-change Journeys that go with a choice', () => {
  for (const move of [false, true]) {
    test(`models.md §parts-change: ${move ? 'refiling' : 'removing'} a choice ${move ? 'moves' : 'removes'} its picked journey schedule and receipt`, engineOnly, async () => {
      // models.md §parts-change; design.md §removal: picked journey folders follow a moved or removed choice.
      // door.md §receipts; models.md §parts-change: moved receipt preserves hash/pins except the entry name and no slot is owed.
      const files = { ...await loadCase('base'), ...await loadCase('choice') };
      files['design/README.md'] = files['design/README.md'].replace('\n\n1.',
        '\n| q | Receives completed work. | design/brief/system.md#system |\n\n1.');
      files['design/parts/q/README.md'] = '# Receiver\n';
      const dir = await baseProject({ files });
      await decide(dir, 'pick', 'p/choices/pick', ['--choice', 'a']);
      const model = await modelFiles();
      model['models/core/model.md'] = model['models/core/model.md'].replace('| Parts | p |', '| Parts | p, q |');
      expectAccepted(await answer(dir, 'cover:p+q', model), 'model');
      const schedule = mtSchedule();
      const oldFolder = 'models/core/parts/p/journeys/pick-a';
      await addSlot(dir, `${oldFolder}/schedule.md`, schedule);
      const oldLine = (await receiptLines(dir, oldFolder))[0];
      const front = '# Processor after the choice\n';
      await writeFiles(dir, { 'design/parts/p/README.md': front });
      const restate = {
        'design/parts/p/README.md': front,
        'removed.md': 'design/parts/p/choices/pick\n',
      };
      if (move) restate['design/parts/q/choices/pick/README.md'] = files['design/parts/p/choices/pick/README.md']
        .replaceAll('| The service | step |', '| The service | p/step |');
      expectAccepted(await answer(dir, 'change:design/parts/p/README.md', restate), 'restate');
      assert.equal(await read(dir, `${oldFolder}/schedule.md`), null);
      assert.equal(await read(dir, `${oldFolder}/receipt`), null);
      if (move) {
        const newFolder = 'models/core/parts/q/journeys/pick-a';
        assert.equal(await read(dir, `${newFolder}/schedule.md`), schedule);
        const newLine = (await receiptLines(dir, newFolder))[0];
        assert.equal(newLine.sha256, oldLine.sha256);
        assert.deepEqual(newLine.pins, oldLine.pins.map((row) => ({ ...row,
          entry: row.entry === 'p/journeys/pick-a' ? 'q/journeys/pick-a' : row.entry,
        })).sort((a, b) => a.entry < b.entry ? -1 : a.entry > b.entry ? 1 : 0));
        assert.ok(!missing(dir).some((row) => row.item === 'slot:core/parts/q/journeys/pick-a/schedule'));
      }
    });
  }
});


// design.md §restate-applied; door.md §change: a direct
// front-page edit supplies an owed change item; the answer restores that page.
async function restateLifecycle(dir, files) {
  const path = 'design/parts/p/README.md';
  const front = await read(dir, path);
  await writeFiles(dir, { [path]: front + '\n' });
  return answer(dir, `change:${path}`, { [path]: front, ...files });
}

// forms.md §premises: a handwritten, complete premise page.
const operatingPremise = '# Operating assumption\n\n| Field | Value |\n| --- | --- |\n' +
  '| Statement | The operator maintains the environment. |\n| Class | world |\n' +
  '| Why not examined | not verifiable here |\n| Falsifier | The environment is not maintained. |\n' +
  '| Provider | The operator |\n| Origin | stated |\n| Cites | design/brief/system.md#system |\n';

// forms.md §lifecycles to §journeys, lifecycle-tool.md §stepping: handwritten creation action and journey variants.
async function enteredLifecycleFiles(start) {
  const files = await loadCase('base');
  const life = 'design/parts/p/lifecycles/life/README.md';
  const journey = 'design/parts/p/journeys/finish/README.md';
  files['design/parts/p/actions.md'] += '| create | actor | Create the thing. | none | none | stated | design/brief/system.md#system |\n';
  files[life] = files[life].replace('| Initial | idle |', '| Initial | idle, entered by create |')
    .replace('| Phase | step |\n| --- | --- |\n| idle | done |\n| done | done |',
      '| Phase | create | step |\n| --- | --- | --- |\n| idle | None. | done |\n| done | None. | done |');
  if (start === 'listed') {
    files[journey] = files[journey].replace('| Step | Actor | Action | Arguments | Entity | Case |',
      '| Lifecycle | Entity | Phase |\n| --- | --- | --- |\n| life | thing-one | idle |\n\n' +
      '| Step | Actor | Action | Arguments | Entity | Case |');
  } else if (start === 'created') {
    files[journey] = files[journey].replace('| 1 | The service | step | - | - | - |',
      '| 1 | The service | create | - | - | - |\n| 2 | The service | step | - | - | - |');
  }
  return files;
}

// presentation.md §reading to account.md §box fixes the shown content, while forms.md §premise-says supplies
// these premise words. It does not fix the prose layout or a JSON provider key.
function premiseWords(dir, command, words) {
  const shown = forma(dir, [command]);
  assert.equal(shown.status, 0, shown.stderr || shown.stdout);
  const prose = shown.stdout.replace(/\s+/g, ' ').trim();
  for (const word of words) assert.ok(prose.includes(word), `${command} shows ${word}`);
}

// forms.md §page-rules allows any table-column order and a code span around a cell.
// These generated journey values contain no pipe, so splitting their visible
// table is enough; it asserts content without fixing Markdown column layout.
function tableRowsOf(text, columns) {
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
    .map((cell) => cell.trim().replace(/^(`+)(.*?)\1$/, '$2').trim());
  const lines = text.split('\n');
  const index = lines.findIndex((line) => {
    const names = cells(line).map((cell) => cell.toLowerCase());
    return names.length === columns.length && columns.every((column) => names.includes(column));
  });
  if (index < 0) return null;
  const names = cells(lines[index]).map((cell) => cell.toLowerCase());
  const rows = [];
  for (const line of lines.slice(index + 2)) {
    if (!line.trim() || !line.includes('|')) break;
    const values = cells(line);
    rows.push(Object.fromEntries(names.map((name, offset) => [name, values[offset]])));
  }
  return rows;
}

describe('models.md §lifecycle-model Design rules that govern lifecycle models', () => {
  for (const key of ['thing', 'environment']) {
    test(`models.md §lifecycle-model / forms.md §page-rules: a premise key ${key === 'thing' ? 'shared with a boundary row is refused' : 'distinct from boundary rows is accepted'}`, async () => {
      // forms.md §page-rules; design.md §restate-checks: premises and
      // boundary rows share one key space; design.md §restate-applied: refusal is atomic.
      const dir = await baseProject();
      const path = `design/parts/p/premises/${key}/README.md`;
      const frontPath = 'design/parts/p/README.md';
      const front = await read(dir, frontPath);
      await writeFiles(dir, { [frontPath]: front + '\n' });
      const before = await snapshot(dir, { skip: ['work', 'runs'] });
      const result = await answer(dir, `change:${frontPath}`, {
        [frontPath]: front, [path]: operatingPremise,
      });
      if (key === 'thing') {
        expectRefused(result);
        assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
      } else {
        expectAccepted(result, 'restate');
        // door.md §forma-answer: accepted page bytes are written.
        assert.equal(await read(dir, path), operatingPremise);
      }
    });
  }

  test('models.md §lifecycle-model / forms.md §lifecycles: the lifecycle Phase column may follow an action column', async () => {
    // forms.md §page-rules; forms.md §lifecycles: columns may be in any
    // order; design.md §pins: column order changes no meaning-carrying pin.
    const dir = await baseProject();
    const path = 'design/parts/p/lifecycles/life/README.md';
    const text = (await read(dir, path)).replace(
      '| Phase | step |\n| --- | --- |\n| idle | done |\n| done | done |',
      '| step | Phase |\n| --- | --- |\n| done | idle |\n| done | done |');
    expectAccepted(await restateLifecycle(dir, { [path]: text }), 'restate');
    // models.md §lifecycle-model; models.md §slot-currency: confirmation remains
    // in force, the lifecycle model accepts a slot and records the same pin.
    await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
    const line = (await receiptLines(dir, claimFolder)).find((entry) => entry.file === 'encoding.md');
    assert.deepEqual(line.pins, [
      { entry: 'p/claims/safe', pin: claimPin() },
      { entry: 'p/lifecycles/life', pin: lifecyclePin() },
    ]);
    assert.equal(await read(dir, path), text);
  });

  test('models.md §lifecycle-model / forms.md §page-rules: an empty lifecycle Phase cell is a refused form error', async () => {
    // forms.md §page-rules: only matrix action columns permit empty
    // cells; design.md §restate-checks: a page form error refuses the Restate answer.
    const dir = await baseProject();
    const path = 'design/parts/p/lifecycles/life/README.md';
    const text = (await read(dir, path)).replace('| idle | done |', '| | done |');
    expectRefused(await restateLifecycle(dir, { [path]: text }));
  });

  for (const variant of ['empty cell', 'empty case outcome', 'posed cell', 'posed case outcome']) {
    test(`models.md §lifecycle-model / lifecycle-tool.md §stepping: stepping into ${variant.startsWith('empty') ? 'an' : 'a'} ${variant} reports unchecked`, async () => {
      // forms.md §lifecycles; forms.md §choices: empty and posed
      // outcomes are valid forms, and choice effects fill exactly the posed cell.
      // design.md §restate-checks: findings do not refuse their Restate answer.
      const files = await loadCase('base');
      const life = 'design/parts/p/lifecycles/life/README.md';
      const action = 'design/parts/p/actions.md';
      const journey = 'design/parts/p/journeys/finish/README.md';
      const choice = 'design/parts/p/choices/pick/README.md';
      const isCase = variant.includes('case');
      const isPosed = variant.startsWith('posed');
      const value = isPosed ? 'choice:pick' : '';
      files[life] = files[life].replace('| idle | done |', `| idle | ${isCase ? `go: ${value}<br>stay: done` : value} |`);
      if (isCase) {
        files[action] = files[action].replace('| none | none |', '| go, stay | none |');
        files[life] = files[life].replace('| done | done |', '| done | go: done<br>stay: done |');
        files[journey] = files[journey].replace('| - | - |\n', '| - | go |\n');
      }
      if (isPosed) {
        let text = (await loadCase('choice'))[choice];
        if (isCase) text = text.replaceAll('| - | - |\n', '| - | go |\n');
        const effects = '| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n' +
          `| life | idle | step | ${isCase ? 'go: done' : 'done'} |\n`;
        files[choice] = text.replace('\n## b\n', `\n${effects}\n## b\n`) + `\n${effects}`;
      }
      // Begin with valid, unconfirmed pages, then submit the altered pages.
      const dir = await baseProject({ confirmLifecycle: false, confirmJourney: false });
      const edits = { [life]: files[life], [action]: files[action], [journey]: files[journey] };
      if (isPosed) edits[choice] = files[choice];
      expectAccepted(await restateLifecycle(dir, edits), 'restate');
      // lifecycle-tool.md §stepping; lifecycle-tool.md §findings: unknown steps
      // report unchecked, not step-refused. account.md §commands exposes
      // findings in found but fixes no nested representation, so inspect only
      // the required code and names. design.md §pins names entries
      // in records; lifecycle-tool.md §stepping requires the unchecked journey's cell.
      const found = missing(dir).find((item) => item.item === 'findings:p');
      assert.ok(found, 'the unchecked journey blocks confirmation');
      const reported = JSON.stringify(found.found);
      assert.match(reported, /\bunchecked\b/);
      assert.match(reported, /p\/journeys\/finish/);
      assert.match(reported, /\bidle\b/);
      assert.match(reported, /\bstep\b/);
      assert.doesNotMatch(reported, /\bstep-refused\b/);
      // decisions.md §forma-show: a finding blocks the journey's confirmation.
      const shown = forma(dir, ['show', 'confirm', 'p/journeys/finish', '--json']);
      assert.equal(shown.status, 1);
      assert.ok(Array.isArray(shown.json?.refused) && shown.json.refused.length > 0);
      if (isPosed) {
        // lifecycle-tool.md §findings: posed cells do not block the
        // lifecycle; models.md §lifecycle-model: its confirmation enables the model.
        await decide(dir, 'confirm', 'p/lifecycles/life');
        assert.ok(missing(dir).some((item) => item.item === 'slot:lifecycles-p/parts/p/claims/safe/encoding'));
      }
    });
  }

  for (const outcome of ['empty', 'posed']) {
    test(`models.md §lifecycle-model / evidence.md §lifecycle-journeys: ${outcome === 'empty' ? 'an' : 'a'} ${outcome} cell withholds the journey question and keeps its old evidence not current`, async () => {
      // evidence.md §lifecycle-journeys, §written-moved to §currency: an unchecked journey has no lifecycle question;
      // evidence already written stays, not current, and no run rewrites it.
      const dir = await baseProject();
      const question = 'lifecycles-p/parts/p/journeys/finish/lifecycle-path';
      const path = `models/${question}.json`;
      ok(forma(dir, ['run', '--json']));
      const before = await read(dir, path);
      assert.notEqual(before, null);
      const life = 'design/parts/p/lifecycles/life/README.md';
      const files = { [life]: (await read(dir, life)).replace('| idle | done |', `| idle | ${outcome === 'posed' ? 'choice:pick' : ''} |`) };
      if (outcome === 'posed') {
        const choice = 'design/parts/p/choices/pick/README.md';
        const effects = '| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| life | idle | step | done |\n';
        files[choice] = (await loadCase('choice'))[choice].replace('\n## b\n', `\n${effects}\n## b\n`) + `\n${effects}`;
      }
      expectAccepted(await restateLifecycle(dir, files), 'restate');
      // lifecycle-tool.md §findings: a posed lifecycle can be reconfirmed while its
      // journey is unchecked. An empty lifecycle itself cannot be confirmed.
      if (outcome === 'posed') await decide(dir, 'confirm', 'p/lifecycles/life');
      assert.ok(!missing(dir).some((item) => item.item === `run:${question}`));
      const account = ok(forma(dir, ['account', 'p/journeys/finish', '--json']));
      const old = account.thing.evidence.find((row) => row.question === question);
      assert.ok(old);
      assert.equal(old.current, false);
      ok(forma(dir, ['run', '--json']));
      assert.equal(await read(dir, path), before);
    });
  }

  test('models.md §lifecycle-model / account.md §items: a posed-cell engine flag owes the pick without flagged Restate work', async () => {
    // engines.md §lifecycle-engine, evidence.md §flags: base exploration flags an unpicked cell as an
    // open-pair; account.md §items assigns a posed cell's flag to its pick alone.
    const files = await loadCase('base');
    const life = 'design/parts/p/lifecycles/life/README.md';
    const choice = 'design/parts/p/choices/pick/README.md';
    files['design/parts/p/actions.md'] += '| skip | actor | Complete by the alternate route. | none | none | stated | design/brief/system.md#system |\n';
    files[life] = files[life].replace('| Phase | step |\n| --- | --- |\n| idle | done |\n| done | done |',
      '| Phase | step | skip |\n| --- | --- | --- |\n| idle | choice:pick | done |\n| done | done | done |');
    files['design/parts/p/journeys/finish/README.md'] = files['design/parts/p/journeys/finish/README.md'].replace('| step |', '| skip |');
    const effects = '| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| life | idle | step | done |\n';
    files[choice] = (await loadCase('choice'))[choice].replace('\n## b\n', `\n${effects}\n## b\n`) + `\n${effects}`;
    const dir = await baseProject({ files });
    await addSlot(dir, `${claimFolder}/encoding.md`, forbidden);
    ok(forma(dir, ['run', '--json']));
    const evidence = JSON.parse(await read(dir, `${claimFolder}/base.json`));
    assert.ok(evidence.flags.some((flag) => flag.startsWith('open-pair ')));
    const items = missing(dir);
    assert.ok(items.some((item) => item.item === 'pick:p/choices/pick'));
    assert.ok(!items.some((item) => item.item === 'restate:p' && item.why === 'flagged'));
  });

  for (const unknown of ['empty cell', 'posed cell', 'empty case outcome', 'posed case outcome']) {
    for (const refusing of ['life', 'other']) {
      test(`models.md §lifecycle-model / lifecycle-tool.md §stepping: ${refusing} refusing takes precedence over ${unknown.startsWith('empty') ? 'an' : 'a'} ${unknown}`, async () => {
        // lifecycle-tool.md §stepping: refusal ends stepping before an empty or unpicked
        // cell can make it unchecked, independently of lifecycle key order.
        const files = await loadCase('base');
        const life = 'design/parts/p/lifecycles/life/README.md';
        const other = 'design/parts/p/lifecycles/other/README.md';
        const isCase = unknown.includes('case');
        const isPosed = unknown.startsWith('posed');
        const outcome = isPosed ? 'choice:pick' : '';
        const column = (value) => isCase ? `go: ${value}<br>stay: done` : value;
        files['design/parts/p/boundary.md'] += '| second | The second thing | entity | machine | - | - | actor | actor | stated | design/brief/system.md#system |\n';
        files[other] = files[life].replace('# Thing state', '# Second thing state').replace('| Entity | thing |', '| Entity | second |');
        for (const [key, path] of [['life', life], ['other', other]]) {
          files[path] = files[path].replace('| idle | done |', `| idle | ${column(key === refusing ? 'None.' : outcome)} |`);
          if (isCase) files[path] = files[path].replace('| done | done |', '| done | go: done<br>stay: done |');
        }
        if (isCase) {
          files['design/parts/p/actions.md'] = files['design/parts/p/actions.md'].replace('| none | none |', '| go, stay | none |');
          files['design/parts/p/journeys/finish/README.md'] = files['design/parts/p/journeys/finish/README.md']
            .replace('| - | - |\n', '| - | go |\n');
        }
        if (isPosed) {
          const choice = 'design/parts/p/choices/pick/README.md';
          let page = (await loadCase('choice'))[choice];
          if (isCase) page = page.replaceAll('| - | - |\n', '| - | go |\n');
          const effects = '| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n' +
            `| ${refusing === 'life' ? 'other' : 'life'} | idle | step | ${column('done').split('<br>')[0]} |\n`;
          files[choice] = page.replace('\n## b\n', `\n${effects}\n## b\n`) + `\n${effects}`;
        }
        const dir = await baseProject({ files, confirmLifecycle: false, confirmJourney: false });
        // account.md §commands leaves found's nesting open; assert only the code,
        // journey and refusing lifecycle that lifecycle-tool.md §findings requires it to name.
        const findings = missing(dir).find((item) => item.item === 'findings:p');
        assert.ok(findings);
        const reported = JSON.stringify(findings.found);
        assert.match(reported, /\bstep-refused\b/);
        assert.ok(reported.includes('p/journeys/finish'));
        assert.ok(reported.includes(`p/lifecycles/${refusing}`));
        assert.doesNotMatch(reported, /\bunchecked\b/);
      });
    }
  }

  for (const start of ['absent', 'listed', 'created']) {
    test(`models.md §lifecycle-model / lifecycle-tool.md §stepping: an entered-by entity ${start === 'absent' ? 'refuses another action before creation' : start === 'listed' ? 'starts present when the journey lists it' : 'admits other actions after its creating step'}`, async () => {
      // lifecycle-tool.md §stepping: a start row holds an entity from the start; otherwise
      // an entered-by lifecycle is absent until its entering action is taken.
      const dir = await baseProject({ files: await enteredLifecycleFiles(start),
        confirmLifecycle: false, confirmJourney: false });
      const findings = missing(dir).find((item) => item.item === 'findings:p');
      const reported = JSON.stringify(findings?.found ?? []);
      if (start === 'absent') {
        assert.match(reported, /\bstep-refused\b/);
        assert.ok(reported.includes('p/journeys/finish'));
        assert.ok(reported.includes('p/lifecycles/life'));
        assert.doesNotMatch(reported, /\bunchecked\b/);
      } else {
        assert.equal(findings, undefined);
        // decisions.md §confirm: these journeys have no finding blocking confirmation.
        await decide(dir, 'confirm', 'p/journeys/finish');
      }
    });
  }

  test('models.md §lifecycle-model / lifecycle-tool.md §shortest: the shortest offered journey creates an absent entity before moving it', async () => {
    // lifecycle-tool.md §shortest, design.md §code-journeys: shortest search starts entered-by entities absent;
    // decisions.md §decision-file, §filing, §confirm records the confirmed offer's precise journey tables.
    const files = await enteredLifecycleFiles('created');
    files['design/parts/p/journeys/finish/README.md'] = files['design/parts/p/journeys/finish/README.md']
      .replace('The thing is done.', 'The thing is idle.').replace('| 2 | The service | step | - | - | - |\n', '');
    const dir = await baseProject({ files, confirmJourney: false });
    const on = 'p/journeys/reach-life--done';
    await decide(dir, 'confirm', on);
    const paths = (await tree(dir)).filter((path) => path.startsWith('design/parts/p/decisions/') && /-confirm-[a-f0-9]{12}\.md$/.test(path));
    assert.equal(paths.length, 1);
    const text = await read(dir, paths[0]);
    const journey = text.slice(text.indexOf('\n## Journey\n'));
    assert.ok(journey.includes(`### ${on}\n`));
    assert.deepEqual(tableRowsOf(journey, ['step', 'actor', 'action', 'arguments', 'entity', 'case']), [
      { step: '1', actor: 'The service', action: 'create', arguments: '-', entity: '-', case: '-' },
      { step: '2', actor: 'The service', action: 'step', arguments: '-', entity: '-', case: '-' },
    ]);
    assert.equal(tableRowsOf(journey, ['lifecycle', 'entity', 'phase']), null);
  });

  test('models.md §lifecycle-model / lifecycle-tool.md §shortest: passing 250000 phase combinations reports unchecked on every lifecycle', async () => {
    // lifecycle-tool.md §stepping to §shortest: these 19 bits form a forced binary counter. An
    // increment flips its zero bit and resets every lower one bit; a lower
    // zero or an already-one target refuses it. Exactly one increment is
    // admitted at each number. Bit 18 first reaches one after 262144 steps,
    // so shortest search cannot find all targets before the part's limit.
    const dir = await baseProject({ confirmLifecycle: false, confirmJourney: false });
    const base = await loadCase('base');
    // Retain life as bit 0 so the existing front-page reference stays valid.
    const lifecycleKeys = ['life', ...Array.from({ length: 18 }, (_, index) => `b${index + 1}`)];
    const actions = Array.from({ length: 19 }, (_, index) => `inc${index}`);
    const files = {
      'design/parts/p/actions.md': '# Counter actions\n\n| Action | Actor | Sentence | Cases | Guard | Origin | Cites |\n| --- | --- | --- | --- | --- | --- | --- |\n' +
        actions.map((action, index) => `| ${action} | actor | Increment binary position ${index}. | none | none | stated | design/brief/system.md#system |\n`).join(''),
      'design/parts/p/boundary.md': '# Counter boundary\n\n## Boundary\n\n| Row | Names | Kind | Side | Seam | Isolation | Reads | Writes | Origin | Cites |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n' +
        '| actor | The service | service | machine | - | - | - | - | stated | design/brief/system.md#system |\n' +
        lifecycleKeys.map((_, index) => `| bit${index} | Bit ${index} | entity | machine | - | - | actor | actor | stated | design/brief/system.md#system |\n`).join(''),
      'design/parts/p/journeys/finish/README.md': base['design/parts/p/journeys/finish/README.md']
        .replace('The thing is done.', 'The lowest bit is one.').replace('| step |', '| inc0 |'),
    };
    for (const [index, key] of lifecycleKeys.entries()) {
      const columns = actions.slice(index);
      const unaffected = actions.slice(0, index).join(', ') || 'none';
      const row = (phase) => '| ' + [phase, ...columns.map((_, offset) =>
        offset === 0 ? (phase === 'zero' ? 'one' : 'None.') : (phase === 'one' ? 'zero' : 'None.'))].join(' | ') + ' |\n';
      files[`design/parts/p/lifecycles/${key}/README.md`] = `# Bit ${index} state\n\n| Field | Value |\n| --- | --- |\n` +
        `| Entity | bit${index} |\n| Initial | zero |\n| Ends | ${index === 18 ? 'one' : 'none'} |\n` +
        `| Unaffected | ${unaffected} |\n| Origin | stated |\n| Cites | design/brief/system.md#system |\n\n` +
        '| Phase | ' + columns.join(' | ') + ' |\n| --- | ' + columns.map(() => '---').join(' | ') + ' |\n' +
        row('zero') + row('one');
    }
    await seedFiles(dir, files);
    const findings = missing(dir).find((item) => item.item === 'findings:p');
    assert.ok(findings);
    const reported = JSON.stringify(findings.found);
    assert.match(reported, /\bunchecked\b/);
    assert.match(reported, /250,?000/);
    for (const key of lifecycleKeys) assert.ok(reported.includes(`p/lifecycles/${key}`));
  });

  test('models.md §lifecycle-model / lifecycle-tool.md §findings: a citation-only failure owes its passage without unchecked', async () => {
    // lifecycle-tool.md §findings, design.md §at-read; account.md §items: an unresolved citation is passage
    // work, and alone is neither unchecked nor unresolved Restate work.
    const dir = await baseProject({ confirmLifecycle: false, confirmJourney: false });
    const path = 'design/parts/p/lifecycles/life/README.md';
    await seedFiles(dir, { [path]: (await read(dir, path)).replace('system.md#system', 'system.md#renamed') });
    const items = missing(dir);
    assert.ok(items.some((item) => item.item === 'passage:design/brief/system.md#renamed' && item.why === 'unresolved'));
    assert.ok(!items.some((item) => item.item === 'restate:p'));
    assert.ok(!items.some((item) => item.item === 'findings:p'));
  });

  test('models.md §lifecycle-model / design.md §code-journeys: offered journey keys stay stable as other journeys are confirmed', async () => {
    // design.md §code-journeys: keys are reach-<lifecycle>--<phase> and
    // never depend on which journeys are confirmed. A written journey reaching
    // working suppresses only working's offer once confirmed.
    const files = await loadCase('base');
    const life = 'design/parts/p/lifecycles/life/README.md';
    files[life] = files[life].replace('| idle | done |', '| idle | working |\n| working | done |');
    const dir = await baseProject({ files, confirmJourney: false });
    const working = 'confirm:p/journeys/reach-life--working';
    const done = 'confirm:p/journeys/reach-life--done';
    assert.ok(missing(dir).some((item) => item.item === working));
    assert.ok(missing(dir).some((item) => item.item === done));
    await decide(dir, 'confirm', 'p/journeys/finish');
    assert.ok(!missing(dir).some((item) => item.item === working));
    assert.ok(missing(dir).some((item) => item.item === done));
    await decide(dir, 'confirm', 'p/journeys/reach-life--done');
    // decisions.md §confirm; design.md §code-journeys: the
    // confirmed offer retains its key; evidence.md §lifecycle-journeys, §question-names,
    //: lifecycle evidence is filed under that same reserved key.
    ok(forma(dir, ['run', '--json']));
    const path = 'models/lifecycles-p/parts/p/journeys/reach-life--done/lifecycle-path.json';
    const text = await read(dir, path);
    assert.notEqual(text, null);
    const evidence = JSON.parse(text);
    assert.equal(evidence.name, path.slice('models/'.length, -'.json'.length));
    assert.deepEqual(evidence.found, { outcome: 'admitted' });
  });

  for (const [label, path, edit, classification] of [
    ['empty phase cell', 'lifecycles/life/README.md', (text) => text.replace('| idle | done |', '| | done |'), 'change'],
    ['invalid Origin value', 'lifecycles/life/README.md', (text) => text.replace('| Origin | stated |', '| Origin | invented |'), 'change'],
    ['duplicate field', 'lifecycles/life/README.md', (text) => text.replace('| Ends | done |', '| Ends | done |\n| Ends | done |'), 'change'],
    ['journey numbering gap', 'journeys/finish/README.md', (text) => text.replace('| 1 |', '| 2 |'), 'change'],
    ['should-happen refused step', 'journeys/finish/README.md', (text) => text.replace('| Refused step | - |', '| Refused step | 1 |'), 'change'],
    ['unknown initial phase', 'lifecycles/life/README.md', (text) => text.replace('| Initial | idle |', '| Initial | absent |'), 'restate'],
    ['repeated phase key', 'lifecycles/life/README.md', (text) => text + '| done | done |\n', 'restate'],
    ['malformed phase key', 'lifecycles/life/README.md', (text) => text.replaceAll('idle', 'Idle'), 'restate'],
    ['unknown outcome phase', 'lifecycles/life/README.md', (text) => text.replace('| idle | done |', '| idle | absent |'), 'restate'],
    ['unknown action column', 'lifecycles/life/README.md', (text) => text.replace('| Phase | step |', '| Phase | absent |'), 'restate'],
    ['repeated action column', 'lifecycles/life/README.md', (text) => text.replace('| Phase | step |\n| --- | --- |\n| idle | done |\n| done | done |', '| Phase | step | step |\n| --- | --- | --- |\n| idle | done | done |\n| done | done | done |'), 'restate'],
  ]) {
    test(`models.md §lifecycle-model / design.md §at-read: reading ${label} creates ${classification} work`, async () => {
      // design.md §at-read: malformed forms count for nothing and
      // create change:path; all name rules, including local key uniqueness and
      // existence, instead create restate:part while the page remains readable.
      // forms.md §page-rules; forms.md §lifecycles; forms.md §journeys fix these forms/names.
      const dir = await baseProject();
      const fullPath = `design/parts/p/${path}`;
      await seedFiles(dir, { [fullPath]: edit(await read(dir, fullPath)) });
      const items = missing(dir).map((item) => item.item);
      assert.equal(items.includes(`change:${fullPath}`), classification === 'change');
      assert.equal(items.includes('restate:p'), classification === 'restate');
    });
  }

  test('models.md §lifecycle-model / forms.md §page-rules: the reserved action key phase is a resolution failure', async () => {
    // forms.md §page-rules, design.md §restate-checks check 2,14.5: phase is forbidden as an action key;
    // key restrictions are resolution rules, so reading it owes Restate.
    const dir = await baseProject();
    const action = 'design/parts/p/actions.md';
    const life = 'design/parts/p/lifecycles/life/README.md';
    const files = {
      [action]: (await read(dir, action)) + '| phase | actor | Observe the thing. | none | none | stated | design/brief/system.md#system |\n',
      [life]: (await read(dir, life)).replace('| Unaffected | none |', '| Unaffected | phase |'),
    };
    expectRefused(await restateLifecycle(dir, files));
    await seedFiles(dir, files);
    const items = missing(dir).map((item) => item.item);
    assert.ok(items.includes('restate:p'));
    assert.ok(!items.includes(`change:${action}`));
    assert.ok(!items.includes(`change:${life}`));
  });

  test('models.md §lifecycle-model / design.md §at-read: identical choice alternatives are a local form error', async () => {
    // forms.md §choices, design.md §at-read: alternatives must differ; this is a page's own
    // form check at read, so the receipted page counts for nothing as a change.
    const dir = await baseProject();
    const path = 'design/parts/p/choices/pick/README.md';
    const page = (await loadCase('choice'))[path].replace('An explicit completion request', '-');
    await seedFiles(dir, { [path]: page });
    assert.ok(missing(dir).some((item) => item.item === `change:${path}`));
  });

  for (const failure of ['resolution', 'placement']) {
    for (const holdsFailure of [false, true]) {
      test(`models.md §lifecycle-model / design.md §restate-applied: a pre-existing ${failure} failure ${holdsFailure ? 'in a held page refuses' : 'outside the answer does not refuse'} Restate`, async () => {
        // design.md §restate-applied scopes checks 2 and 3: existing failures in untouched
        // pages remain their own work, but every failure in a held page refuses.
        const dir = await baseProject();
        const base = await loadCase('base');
        const action = 'design/parts/q/actions.md';
        const life = 'design/parts/q/lifecycles/life/README.md';
        const files = {
          'design/README.md': base['design/README.md'].replace('\n\n1.', '\n| q | Observes completed work. | design/brief/system.md#system |\n\n1.'),
          'design/parts/q/README.md': '# Other processor\n',
          'design/parts/q/boundary.md': base['design/parts/p/boundary.md'],
          [action]: base['design/parts/p/actions.md'],
          [life]: base['design/parts/p/lifecycles/life/README.md'],
        };
        if (failure === 'resolution') files[action] = files[action].replace('| step | actor |', '| step | missing |');
        else files[action] += '| extra | actor | Observe the thing. | none | none | stated | design/brief/system.md#system |\n';
        await seedFiles(dir, files);
        assert.ok(missing(dir).some((item) => item.item === 'restate:q'));
        const heldPath = failure === 'resolution' ? action : life;
        const page = 'design/parts/p/premises/environment/README.md';
        const edits = { [page]: operatingPremise, ...(holdsFailure ? { [heldPath]: files[heldPath] } : {}) };
        const result = await restateLifecycle(dir, edits);
        if (holdsFailure) {
          const refused = expectRefused(result);
          assert.ok(refused.reasons.some((reason) => reason.file === heldPath));
          assert.equal(await read(dir, page), null);
        } else {
          expectAccepted(result, 'restate');
          assert.equal(await read(dir, page), operatingPremise);
          assert.ok(missing(dir).some((item) => item.item === 'restate:q'));
        }
      });
    }
  }

  for (const failure of ['resolution', 'placement']) {
    test(`models.md §lifecycle-model / design.md §restate-applied: a newly caused ${failure} failure outside the held pages refuses Restate`, async () => {
      // design.md §restate-applied: a new failure elsewhere is checked even when that
      // failing page was not submitted. design.md §restate-checks check 2 resolves claim premises;
      // check 3 requires a newly added action's placement in every lifecycle.
      const dir = await baseProject();
      const action = 'design/parts/p/actions.md';
      const claim = 'design/parts/p/claims/safe/README.md';
      const life = 'design/parts/p/lifecycles/life/README.md';
      let edits;
      if (failure === 'resolution') {
        await seedFiles(dir, {
          'design/parts/p/premises/environment/README.md': operatingPremise,
          [claim]: (await read(dir, claim)).replace('| Rests on | none |', '| Rests on | environment |'),
        });
        edits = { 'removed.md': 'design/parts/p/premises/environment\n' };
      } else {
        edits = { [action]: (await read(dir, action)) + '| extra | actor | Observe the thing. | none | none | stated | design/brief/system.md#system |\n' };
      }
      const refused = expectRefused(await restateLifecycle(dir, edits));
      assert.ok(refused.reasons.some((reason) => reason.file === (failure === 'resolution' ? claim : life)));
    });
  }

  test('models.md §lifecycle-model / decisions.md §expects: declining an offered journey owes a repair of its lifecycle part', async () => {
    // decisions.md §confirm, §expects: an offered journey's decline is not met at once;
    // its repair must change the lifecycle's pin or end the decline's force.
    const files = await loadCase('base');
    const life = 'design/parts/p/lifecycles/life/README.md';
    files[life] = files[life].replace('| idle | done |', '| idle | working |\n| working | done |');
    const dir = await baseProject({ files, confirmJourney: false });
    const on = 'p/journeys/reach-life--done';
    await decide(dir, 'decline', on, ['--words', 'Completion needs another phase.']);
    const paths = (await tree(dir)).filter((path) => path.startsWith('design/parts/p/decisions/') && /-decline-[a-f0-9]{12}\.md$/.test(path));
    assert.equal(paths.length, 1);
    const name = paths[0].split('/').at(-1).slice(0, -3);
    const item = `repair:${name}`;
    assert.ok(missing(dir).some((row) => row.item === item));
    const repair = '| Field | Value |\n| --- | --- |\n| Mechanism | Add the phase before completion. |\n';
    // door.md §repair-answer: changing a file is insufficient when the decline remains unmet.
    expectRefused(await answer(dir, item, { 'repair.md': repair,
      'design/parts/p/README.md': '# Processor after review\n' }));
    const changed = files[life].replace('| idle | working |', '| idle | waiting |\n| waiting | working |');
    expectAccepted(await answer(dir, item, { 'repair.md': repair, [life]: changed }), 'repair');
    assert.ok(!missing(dir).some((row) => row.item === item));
    // design.md §code-journeys: after reconfirming the changed lifecycle its changed
    // shortest journey is offered afresh, under the same reserved key.
    await decide(dir, 'confirm', 'p/lifecycles/life');
    assert.ok(missing(dir).some((row) => row.item === `confirm:${on}`));
  });

  test('models.md §lifecycle-model / forms.md §premise-says: choice premises show their class statement falsifier and provider before and after a pick', async () => {
    // forms.md §choice-premises, §premise-says fixes both statements; decisions.md §pick carries a
    // picked choice; presentation.md §reading to account.md §box shows it in the reading and then the box.
    const dir = await baseProject({ files: await loadCase('choice') });
    const words = ['choice:p/pick', 'choice', 'a pick of the other alternative', "the developer's pick"];
    premiseWords(dir, 'account', [...words, 'Which request wording should completion use? Not yet picked.']);
    await decide(dir, 'pick', 'p/choices/pick', ['--choice', 'a']);
    const statement = 'Which request wording should completion use? Picked a. The thing is done.';
    premiseWords(dir, 'account', [...words, statement]);
    premiseWords(dir, 'box', [...words, statement]);
  });

  test('models.md §lifecycle-model / forms.md §premise-says: lifecycle bound premises show their class statement falsifier and provider', async () => {
    // forms.md §premise-says gives lifecycle bounds their phase-level statement and
    // '-' falsifier before carry; decisions.md §carry replaces it with the words.
    const dir = await baseProject();
    const words = ['bound:lifecycles-p/p/safe', 'bound',
      'Beyond phase level on lifecycles-p: A completed thing never returns to idle.', "the developer's carry"];
    premiseWords(dir, 'account', words);
    const premise = ok(forma(dir, ['account', '--json'])).parts.find((part) => part.ref === 'p').assumed
      .find((row) => row.premise === 'bound:lifecycles-p/p/safe');
    assert.equal(premise.class, 'bound');
    assert.equal(premise.falsifier, '-');
    await decide(dir, 'carry', 'bound:lifecycles-p/p/safe', ['--choice', 'carry', '--basis', '-', '--words', 'A data-level execution violates the claim.']);
    for (const command of ['account', 'box']) premiseWords(dir, command, [...words, 'A data-level execution violates the claim.']);
  });

  for (const [isolation, anomalies] of [['serializable', 'no anomaly'], ['read committed', 'read skew, lost update, write skew, phantom']]) {
    test(`models.md §lifecycle-model / forms.md §premise-says: ${isolation} store premises show their class statement falsifier and provider`, async () => {
      // forms.md §store-premises, §premise-says fixes the anomaly order and the four premise
      // fields; decisions.md §carry permits carrying the generated store premise.
      const files = await loadCase('base');
      files['design/parts/p/boundary.md'] += `| db | The database | store | machine | - | ${isolation} | actor | actor | stated | design/brief/system.md#system |\n`;
      const dir = await baseProject({ files });
      const words = ['store:p/db', 'store phenomena', `The database permits exactly ${anomalies} and prevents the rest.`,
        'an observed prevented anomaly', "the store's documented and measured isolation"];
      premiseWords(dir, 'account', words);
      await decide(dir, 'carry', 'store:p/db', ['--choice', 'carry', '--basis', '-', '--words', 'an observed prevented anomaly']);
      premiseWords(dir, 'box', words);
    });
  }

  test('models.md §lifecycle-model / forms.md §premise-says: span premises show their class statement falsifier and provider', async () => {
    // forms.md §surface, §premise-says: p and q share r/shared; referencing a third part
    // keeps both surface names identical without choosing an alias display.
    const dir = await baseProject();
    const list = await read(dir, 'design/README.md');
    const boundary = await read(dir, 'design/parts/p/boundary.md');
    await seedFiles(dir, {
      'design/README.md': list.replace('\n\n1.', '\n| q | Observes completed work. | design/brief/system.md#system |\n| r | Holds shared work. | design/brief/system.md#system |\n\n1.'),
      'design/parts/p/boundary.md': boundary + '\n## Surface\n\n| Direction | Name | Cites |\n| --- | --- | --- |\n| reads | r/shared | design/brief/system.md#system |\n',
      'design/parts/q/README.md': '# Observer\n',
      'design/parts/q/boundary.md': '# Boundary\n\n## Surface\n\n| Direction | Name | Cites |\n| --- | --- | --- |\n| writes | r/shared | design/brief/system.md#system |\n',
      'design/parts/r/README.md': '# Shared work\n',
      'design/parts/r/boundary.md': '# Boundary\n\n## Boundary\n\n| Row | Names | Kind | Side | Seam | Isolation | Reads | Writes | Origin | Cites |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| shared | Shared work | entity | machine | - | - | none | none | stated | design/brief/system.md#system |\n',
    });
    const words = ['span:p+q', 'span', "the developer's carry",
      'Advances a thing to completion. and Observes completed work. hold together over what they share:',
      'reads r/shared', 'writes r/shared'];
    premiseWords(dir, 'account', words);
    // presentation.md §reading does not assign a span premise a nested JSON location;
    // assert its fixed words without inventing that location.
    await decide(dir, 'carry', 'span:p+q', ['--choice', 'carry', '--basis', '-', '--words', 'Their shared-work assumptions conflict.']);
    for (const command of ['account', 'box']) premiseWords(dir, command, [...words, 'Their shared-work assumptions conflict.']);
  });

  test('models.md §lifecycle-model / design.md §at-read: a receipted premise sharing a boundary key owes Restate without becoming a change', async () => {
    // forms.md §page-rules; design.md §at-read: shared-key uniqueness
    // is resolution, even when both names are available locally.
    const dir = await baseProject();
    const path = 'design/parts/p/premises/thing/README.md';
    await seedFiles(dir, { [path]: operatingPremise });
    const items = missing(dir).map((item) => item.item);
    assert.ok(items.includes('restate:p'));
    assert.ok(!items.includes(`change:${path}`));
    assert.ok(!items.includes('change:design/parts/p/boundary.md'));
  });

  test('models.md §lifecycle-model / design.md §at-read: a receipted page in a folder with no front page owes that folder a Restate', async () => {
    // design.md §at-read: an orphan folder owes its own restate:key;
    // the otherwise valid page is not itself a change.
    const dir = await baseProject();
    const path = 'design/parts/orphan/premises/environment/README.md';
    await seedFiles(dir, { [path]: operatingPremise });
    const items = missing(dir).map((item) => item.item);
    assert.ok(items.includes('restate:orphan'));
    assert.ok(!items.includes(`change:${path}`));
  });
});

// Stateful fixtures below are constructed from the contracts, never captured
// from an implementation. Actual lifecycle runs supply their own surprises.
const stateLifePath = 'design/parts/p/lifecycles/life/README.md';
const stateClaimPath = 'design/parts/p/claims/safe/README.md';
const stateFrontPath = 'design/parts/p/README.md';
const stateIdle = '| Lifecycle | Phase |\n| --- | --- |\n| life | idle |\n';
const stateRepair = '| Field | Value |\n| --- | --- |\n| Mechanism | Completion stability |\n';

async function stateSlots(dir, encoding = forbidden) {
  // models.md §slots, §owed: one encoding and separately keyed
  // first witness/fault answers, each accepted through the public door.
  await addSlot(dir, claimFolder + '/encoding.md', encoding);
  await addSlot(dir, claimFolder + '/witness-done.md', witness,
    'slot:lifecycles-p/parts/p/claims/safe/witness');
  await addSlot(dir, claimFolder + '/fault-return.md', fault,
    'slot:lifecycles-p/parts/p/claims/safe/fault');
}
async function stateRestate(dir, files, removed = []) {
  // door.md §change: an unreceipted page is a change item
  // supplied by its answer kind; design.md §removal: removals.
  // An unreceipted edit to the front page creates an explicit change item.
  // The submitted answer restores the whole page and supplies the desired edit.
  const front = files[stateFrontPath] ?? await read(dir, stateFrontPath);
  await writeFiles(dir, { [stateFrontPath]: front + '\n\n' });
  return answer(dir, 'change:' + stateFrontPath, {
    [stateFrontPath]: front, ...files,
    ...(removed.length ? { 'removed.md': removed.join('\n') + '\n' } : {}),
  });
}
async function stateRunSurprises(dir) {
  // evidence.md §surprise-file, §forma-run: mismatches open named surprises.
  const ran = ok(forma(dir, ['run', '--json']));
  assert.ok(Array.isArray(ran.opened));
  assert.ok(ran.opened.length > 0, 'the deliberately mismatching question opens a surprise');
  return ran.opened;
}
async function stateExplain(dir, name, verdict = 'model wrong') {
  // evidence.md §explain: these lifecycle, witness and phases
  // explanations have no weaker forms and use a session that authored no model.
  const surprise = JSON.parse(await read(dir, 'models/' + name + '.json'));
  // evidence.md §stems, §basis, §own-check: surprise names
  // use a basis digest that hashes its canonical JSON plus LF.
  const basis = sha256(JSON.stringify(surprise.basis, null, 2) + '\n').slice(0, 12);
  assert.equal(name, surprise.question + '.surprise-' + basis);
  const isWitness = surprise.kind === 'witness';
  const isPhases = surprise.kind === 'phases';
  const files = {
    'explain.md': '| Field | Value |\n| --- | --- |\n' +
      '| Question | ' + surprise.question + ' |\n| Basis | ' + basis + ' |\n' +
      '| Verdict | ' + verdict + ' |\n| Level | implementation |\n| Weaker | none |\n\n' +
      '## Trace\n\n' + (isWitness ? 'No execution reaches the requested state.' :
        isPhases ? 'The phase observation does not name a lifecycle phase.' : 'The thing begins idle.') + '\n\n' +
      '## Failure shape\n\n' + (isWitness ? 'The target is unreachable.' :
        isPhases ? 'The observation fails before work starts.' : 'A reachable phase combination is forbidden by the encoding.') + '\n\n' +
      '## Mechanism\n\n' + (isWitness ? 'The target predicate is false in every reachable state.' :
        isPhases ? 'The phase observation does not map the model state to the stated lifecycle.' :
        'The lifecycle permits the forbidden combination.') + '\n',
  };
  const folder = await answerFolder(files);
  expectAccepted(forma(dir, ['answer', 'explain:' + name, folder,
    '--provider', 'contract', '--model', 'explainer', '--session', 'models-explainer', '--json']), 'explain');
}
async function stateRule(dir, name, verdict = 'model wrong', model = name.split('/')[0]) {
  // decisions.md §rulings and account.md §items: one ungrouped surprise has one ruling;
  // door.md §gives permits the property-wrong item either repair target kind.
  await stateExplain(dir, name, verdict);
  const options = ['--verdict', verdict, '--level', 'implementation',
    '--words', 'Restore completion stability.'];
  if (verdict === 'real finding') options.push('--target', model);
  await decide(dir, 'rule', name, options);
  const repairs = missing(dir).filter((item) => item.item.startsWith('repair:') &&
    item.supply.some((s) => s.by === 'agent' && s.answer === 'repair'));
  assert.equal(repairs.length, 1);
  if (verdict !== 'property wrong') assert.ok(repairs[0].item.endsWith('/' + model));
  return repairs[0].item;
}
async function stateRuled(verdict = 'model wrong') {
  // evidence.md §questions, §surprise-file: with only an initial-phase
  // forbidden encoding, exactly its base question mismatches.
  const dir = await baseProject();
  await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
  const names = await stateRunSurprises(dir);
  assert.equal(names.length, 1);
  return { dir, item: await stateRule(dir, names[0], verdict) };
}
function stateItem(dir, name) { return missing(dir).find((item) => item.item === name); }
function stateNoItem(dir, name) { assert.equal(stateItem(dir, name), undefined); }
function stateSlotItem(name) { return 'slot:lifecycles-p/parts/p/claims/safe/' + name; }

describe('models.md §model-repair A Repair on a model', () => {
  // models.md §model-repair; door.md §repair-answer.
  test('models.md §model-repair: a model repair must hold at least one target file besides repair.md', async () => {
    const { dir, item } = await stateRuled();
    expectRefused(await answer(dir, item, { 'repair.md': stateRepair }));
  });

  // models.md §model-repair; door.md §repair-answer.
  test('models.md §model-repair: a lifecycle repair cannot write a claim page instead of a lifecycle page or slot', async () => {
    const { dir, item } = await stateRuled();
    expectRefused(await answer(dir, item, {
      'repair.md': stateRepair,
      [stateClaimPath]: (await read(dir, stateClaimPath)).replace('# Completion is stable', '# Revised claim'),
    }));
  });

  // models.md §model-repair; door.md §repair-answer.
  test('models.md §model-repair: a model repair cannot include a slot of another model', async () => {
    const { dir, item } = await stateRuled();
    expectRefused(await answer(dir, item, {
      'repair.md': stateRepair,
      [stateLifePath]: (await read(dir, stateLifePath)).replace('# Thing state', '# Revised lifecycle'),
      'models/another/parts/p/claims/safe/encoding.md': reason,
    }));
  });

  // models.md §model-repair; door.md §forma-answer to §receipts; decisions.md §expects.
  test('models.md §model-repair: a lifecycle repair accepts a changed lifecycle page and records its mechanism', async () => {
    const { dir, item } = await stateRuled();
    const before = await read(dir, stateLifePath);
    const after = before.replace('# Thing state', '# Stable thing state');
    const result = expectAccepted(await answer(dir, item,
      { 'repair.md': stateRepair, [stateLifePath]: after }), 'repair');
    assert.ok(result.written.some((row) => row.path === stateLifePath));
    assert.equal(await read(dir, stateLifePath), after);
    assert.equal(await read(dir, 'repair.md'), null);
    const line = (await receiptLines(dir, 'design/parts/p/lifecycles/life'))[0];
    assert.deepEqual(line.mechanisms, [{ decision: item.slice('repair:'.length).split('/')[0], mechanism: 'Completion stability' }]);
    assert.equal(line.before, sha256(before));
    assert.equal(line.sha256, sha256(after));
    assert.ok(line.answers.some((name) => item === 'repair:' + name + '/lifecycles-p'));
    stateNoItem(dir, item);
  });

  // models.md §model-repair: a new slot alone changes no file a ruled question read.
  test('models.md §model-repair: a lifecycle repair cannot be met by a new slot the ruled question did not read', async () => {
    const { dir, item } = await stateRuled();
    const path = claimFolder + '/witness-new.md';
    expectRefused(await answer(dir, item, { 'repair.md': stateRepair, [path]: witness }));
    assert.equal(await read(dir, path), null);
    assert.ok(stateItem(dir, item));
  });

  test('models.md §model-repair: a lifecycle repair may change only the fault read by its ruled question', async () => {
    // models.md §model-repair allows slots without model files, but requires a basis-read
    // change; evidence.md §questions asks whether the planted fault is caught.
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', forbidden);
    const path = claimFolder + '/fault-return.md';
    await addSlot(dir, path, fault.replace('| life | done | step | idle |', '| life | done | step | done |'),
      stateSlotItem('fault'));
    const [name] = await stateRunSurprises(dir);
    const surprise = JSON.parse(await read(dir, 'models/' + name + '.json'));
    assert.equal(surprise.kind, 'fault');
    assert.ok(surprise.basis.files.some((file) => file.path === path));
    const item = await stateRule(dir, name);
    const life = await read(dir, stateLifePath);
    expectAccepted(await answer(dir, item, { 'repair.md': stateRepair, [path]: fault }), 'repair');
    assert.equal(await read(dir, path), fault);
    assert.equal(await read(dir, stateLifePath), life);
    stateNoItem(dir, item);
  });

  test('models.md §model-repair / decisions.md §expects: property wrong can refill only its encoding and meet its repair', async () => {
    // decisions.md §rulings, §expects and models.md §model-repair: encoding repair is an alternative
    // to restating the claim; its receipt records the ruling and changed bytes.
    const { dir, item } = await stateRuled('property wrong');
    const path = claimFolder + '/encoding.md';
    const claim = await read(dir, stateClaimPath);
    const life = await read(dir, stateLifePath);
    expectAccepted(await answer(dir, item, { 'repair.md': stateRepair, [path]: forbidden }), 'repair');
    assert.equal(await read(dir, path), forbidden);
    assert.equal(await read(dir, stateClaimPath), claim);
    assert.equal(await read(dir, stateLifePath), life);
    const entry = (await receiptLines(dir, claimFolder)).find((line) => line.file === 'encoding.md');
    assert.equal(entry.before, sha256(stateIdle));
    assert.equal(entry.sha256, sha256(forbidden));
    assert.ok(entry.answers.length > 0);
    stateNoItem(dir, item);
  });

  test('models.md §model-repair / decisions.md §expects: a property-wrong repair item also accepts a restated claim', async () => {
    // decisions.md §rulings, §expects and door.md §gives, §repair-answer permit the same property-wrong
    // item a restatement repair, met when its claim no longer has the ruled pin.
    const { dir, item } = await stateRuled('property wrong');
    const changed = (await read(dir, stateClaimPath)).replace(
      'A completed thing never returns to idle.', 'A completed thing remains done until explicitly reset.');
    const life = await read(dir, stateLifePath);
    expectAccepted(await answer(dir, item, { 'repair.md': stateRepair, [stateClaimPath]: changed }), 'repair');
    assert.equal(await read(dir, stateClaimPath), changed);
    assert.equal(await read(dir, stateLifePath), life);
    assert.equal(await read(dir, claimFolder + '/encoding.md'), stateIdle);
    stateNoItem(dir, item);
  });

  test('models.md §model-repair: property wrong refuses an encoding refill that also changes a lifecycle model page', async () => {
    // models.md §model-repair: a property-wrong repair on a model changes no model file.
    const { dir, item } = await stateRuled('property wrong');
    expectRefused(await answer(dir, item, {
      'repair.md': stateRepair,
      [claimFolder + '/encoding.md']: forbidden,
      [stateLifePath]: (await read(dir, stateLifePath)).replace('# Thing state', '# Repaired thing state'),
    }));
    assert.equal(await read(dir, claimFolder + '/encoding.md'), stateIdle);
    assert.ok(stateItem(dir, item));
  });

  test('models.md §model-repair: property wrong refuses a repair that leaves its ruled encoding unchanged', async () => {
    // models.md §model-repair: changing the claim's encoding is required for this verdict.
    const { dir, item } = await stateRuled('property wrong');
    expectRefused(await answer(dir, item, {
      'repair.md': stateRepair, [claimFolder + '/encoding.md']: stateIdle,
      [claimFolder + '/witness-new.md']: witness,
    }));
    assert.ok(stateItem(dir, item));
  });

  test('models.md §model-repair / door.md §gives, §repair-answer: a property-wrong packet combines restatement and model repair inputs', async () => {
    const { dir, item } = await stateRuled('property wrong');
    const folder = await tempFolder('forma-property-repair-');
    ok(forma(dir, ['give', item, folder, '--json']));
    // door.md §gives: both possible answer kinds' inputs and repair contracts are
    // supplied together; the accepted encoding belongs to the model target.
    for (const path of ['design/brief/system.md', stateClaimPath, stateLifePath,
      claimFolder + '/encoding.md', 'forma/door.md', 'forma/account.md',
      'forma/design.md', 'forma/models.md', 'forma/evidence.md', 'forma/decisions.md']) {
      assert.notEqual(await read(folder, path), null, path);
    }
    const packet = JSON.parse(await read(folder, 'item.json'));
    assert.equal(packet.item.item, item);
    assert.ok(Object.hasOwn(packet, 'decision'));
    // door.md §gives gives a decision's content rather than its private file.
    assert.ok(!(await tree(folder)).some((path) => path.includes('/decisions/')));
  });

  // models.md §model-repair; door.md §forma-answer.
  test('models.md §model-repair: a repair that changes no file a ruled question read is refused', async () => {
    const { dir, item } = await stateRuled();
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    expectRefused(await answer(dir, item, {
      'repair.md': stateRepair, [stateLifePath]: await read(dir, stateLifePath),
    }), '9');
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    assert.ok(stateItem(dir, item));
  });

  // models.md §model-repair; door.md §forma-answer.
  test('models.md §model-repair: model wrong refuses an encoding change for its ruled claim', async () => {
    const { dir, item } = await stateRuled();
    expectRefused(await answer(dir, item,
      { 'repair.md': stateRepair, [claimFolder + '/encoding.md']: forbidden }), '9');
    assert.equal(await read(dir, claimFolder + '/encoding.md'), stateIdle);
  });

  // models.md §model-repair; door.md §receipts; decisions.md §expects.
  test('models.md §model-repair: a real finding on a model requires the named mechanism as a fault on a ruled claim', async () => {
    const { dir, item } = await stateRuled('real finding');
    const path = claimFolder + '/fault-repair.md';
    // models.md §model-repair requires both a basis-read change and the matching fault.
    const life = (await read(dir, stateLifePath)).replace('# Thing state', '# Repaired thing state');
    expectAccepted(await answer(dir, item, {
      'repair.md': stateRepair, [stateLifePath]: life, [path]: fault,
    }), 'repair');
    const line = (await receiptLines(dir, claimFolder)).find((row) => row.file === 'fault-repair.md');
    assert.deepEqual(line.mechanisms, [{ decision: item.slice('repair:'.length).split('/')[0], mechanism: 'Completion stability' }]);
    assert.equal(line.before, null);
    stateNoItem(dir, item);
  });

  // models.md §model-repair.
  test('models.md §model-repair: a real finding refuses a repair without the required planted fault', async () => {
    const { dir, item } = await stateRuled('real finding');
    expectRefused(await answer(dir, item, {
      'repair.md': stateRepair,
      [stateLifePath]: (await read(dir, stateLifePath)).replace('# Thing state', '# Revised state'),
    }), '9');
  });

  // models.md §model-repair.
  test('models.md §model-repair: a real finding refuses a fault whose Mechanism differs from repair.md', async () => {
    const { dir, item } = await stateRuled('real finding');
    expectRefused(await answer(dir, item, {
      'repair.md': stateRepair,
      [stateLifePath]: (await read(dir, stateLifePath)).replace('# Thing state', '# Repaired thing state'),
      [claimFolder + '/fault-repair.md']: fault.replace('Completion stability', 'Another mechanism'),
    }), '9');
  });

  // models.md §model-repair.
  test('models.md §model-repair: a real finding refuses a matching fault on a claim absent from its ruled surprises', async () => {
    const { dir, item } = await stateRuled('real finding');
    await seedFiles(dir, {
      'design/parts/p/claims/other/README.md': (await read(dir, stateClaimPath))
        .replace('A completed thing never returns to idle.', 'A thing is not lost during completion.'),
      'models/lifecycles-p/parts/p/claims/other/encoding.md': forbidden,
    }, {
      // design.md §pins: only the Sentence line differs.
      'models/lifecycles-p/parts/p/claims/other/encoding.md': { pins: [
        { entry: 'p/claims/other', pin: sha256(['Sentence: A thing is not lost during completion.',
          'Kind: safety', 'Stake: Completed work would be lost.', 'Rests on: ',
          'Parts: Advances a thing to completion.', 'Cites: ' + passagePin].join('\n')) },
        { entry: 'p/lifecycles/life', pin: lifecyclePin() },
      ] },
    });
    expectRefused(await answer(dir, item, {
      'repair.md': stateRepair,
      [stateLifePath]: (await read(dir, stateLifePath)).replace('# Thing state', '# Repaired thing state'),
      'models/lifecycles-p/parts/p/claims/other/fault-repair.md': fault,
    }), '9');
  });

  // models.md §model-repair; door.md §forma-answer.
  test('models.md §model-repair: a lifecycle repair may write a lifecycle page and a slot together', async () => {
    const { dir, item } = await stateRuled('real finding');
    const life = (await read(dir, stateLifePath)).replace('# Thing state', '# Repaired thing state');
    const overlay = fault;
    expectAccepted(await answer(dir, item, {
      'repair.md': stateRepair, [stateLifePath]: life,
      [claimFolder + '/fault-repair.md']: overlay,
    }), 'repair');
    assert.equal(await read(dir, claimFolder + '/fault-repair.md'), overlay);
  });
});

describe('models.md §freeze The freeze', () => {
  test('models.md §freeze / evidence.md §surprise-file: held follows basis and snapshots every confirmed lifecycle page and claim slot in path order', async () => {
    const dir = await baseProject();
    // models.md §lifecycle-model, §freeze: an unconfirmed lifecycle is not a model file held by
    // the freeze, although lifecycle slots record its pin under models.md §slot-currency.
    await seedFiles(dir, {
      'design/parts/p/boundary.md': (await read(dir, 'design/parts/p/boundary.md')) +
        '| other | Another thing | entity | machine | - | - | actor | actor | stated | design/brief/system.md#system |\n',
      'design/parts/p/lifecycles/other/README.md': (await read(dir, stateLifePath))
        .replace('| Entity | thing |', '| Entity | other |'),
    });
    await stateSlots(dir, stateIdle);
    const expected = [];
    for (const path of sorted([stateLifePath, claimFolder + '/encoding.md',
      claimFolder + '/fault-return.md', claimFolder + '/witness-done.md'])) {
      expected.push({ path, sha256: sha256(await read(dir, path)) });
    }
    const names = await stateRunSurprises(dir);
    const name = names.find((value) => value.startsWith('lifecycles-p/parts/p/claims/safe/base.'));
    assert.ok(name);
    const surprise = JSON.parse(await read(dir, 'models/' + name + '.json'));
    // evidence.md §own-check, §surprise-file fix JSON order; models.md §freeze fixes the held set.
    const fields = Object.keys(surprise);
    assert.equal(fields[fields.indexOf('basis') + 1], 'held');
    assert.deepEqual(surprise.held, expected);
    for (const held of surprise.held) assert.deepEqual(Object.keys(held), ['path', 'sha256']);
    assert.ok(!surprise.basis.files.some((file) => file.path === claimFolder + '/witness-done.md'));
    // Evidence does not gain the surprise-only held field (evidence.md §keys).
    const evidence = JSON.parse(await read(dir, 'models/' + surprise.question + '.json'));
    assert.ok(!Object.hasOwn(evidence, 'held'));
  });

  test('models.md §freeze: a disappeared held lifecycle page remains a change until its bytes return', async () => {
    // models.md §freeze: held records the opening bytes, and a gone held file
    // counts for nothing and is a change until it is restored or ruled.
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    const [name] = await stateRunSurprises(dir);
    const files = await snapshot(dir);
    const original = files[stateLifePath];
    delete files[stateLifePath];
    // A new project copy represents a deletion/merge without using internals.
    const copy = await project(null, files);
    assert.ok(stateItem(copy, 'change:' + stateLifePath));
    assert.equal(await read(copy, 'models/' + name + '.json'), files['models/' + name + '.json']);
    await writeFiles(copy, { [stateLifePath]: original });
    stateNoItem(copy, 'change:' + stateLifePath);
  });

  test('models.md §freeze: a receipted new claim slot counts for nothing until the surprise is ruled', async () => {
    // models.md §freeze: a slot outside held is new and discounted while open;
    // closing that surprise lifts its freeze without deleting the new slot.
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    const [name] = await stateRunSurprises(dir);
    const original = await read(dir, 'models/' + name + '.json');
    const path = claimFolder + '/witness-merged.md';
    const encoding = (await receiptLines(dir, claimFolder)).find((line) => line.file === 'encoding.md');
    // door.md §receipts and models.md §slot-currency: these valid pins isolate the freeze as the
    // reason a merged, otherwise accepted witness is absent from the record.
    await seedFiles(dir, { [path]: witness }, { [path]: { pins: encoding.pins } });
    assert.ok(stateItem(dir, 'change:' + path));
    assert.ok(stateItem(dir, stateSlotItem('witness')));
    assert.equal(await read(dir, 'models/' + name + '.json'), original);
    await stateRule(dir, name);
    stateNoItem(dir, 'change:' + path);
    stateNoItem(dir, stateSlotItem('witness'));
  });

  test('models.md §freeze: a held witness the base never read is discounted after a receipted byte change', async () => {
    // models.md §freeze: held, rather than basis.files, controls read-time byte
    // checks, including an independent witness slot of the frozen claim.
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    const path = claimFolder + '/witness-done.md';
    await addSlot(dir, path, witness, stateSlotItem('witness'));
    const [name] = await stateRunSurprises(dir);
    const surprise = JSON.parse(await read(dir, 'models/' + name + '.json'));
    assert.ok(!surprise.basis.files.some((file) => file.path === path));
    const receipt = await read(dir, claimFolder + '/receipt');
    const entry = (await receiptLines(dir, claimFolder)).find((line) => line.file === 'witness-done.md');
    await seedFiles(dir, { [path]: witness.replace('A completed thing is reached.', 'Completion is reached.') },
      { [path]: { pins: entry.pins } });
    assert.ok(stateItem(dir, 'change:' + path));
    await writeFiles(dir, { [path]: witness, [claimFolder + '/receipt']: receipt });
    stateNoItem(dir, 'change:' + path);
  });

  // models.md §freeze; decisions.md §forma-show.
  test('models.md §freeze: an open lifecycle surprise blocks picking a choice whose cells the model poses', async () => {
    const base = await loadCase('base');
    const files = await loadCase('choice');
    const path = 'design/parts/p/choices/pick/README.md';
    const effects = '\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| life | idle | step | done |\n';
    files[path] = files[path].replace('\n## b\n', effects + '\n## b\n') + effects;
    files[stateLifePath] = base[stateLifePath].replace('| idle | done |', '| idle | choice:pick |');
    const dir = await baseProject({ files, confirmLifecycle: false, confirmJourney: false });
    await decide(dir, 'pick', 'p/choices/pick', ['--choice', 'a']);
    await decide(dir, 'confirm', 'p/lifecycles/life');
    await decide(dir, 'confirm', 'p/journeys/finish');
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    await stateRunSurprises(dir);
    const result = forma(dir, ['show', 'pick', 'p/choices/pick', '--json']);
    assert.equal(result.status, 1);
    assert.ok(result.json.refused.length > 0);
  });

  // models.md §freeze; design.md §pins, §restate-checks; door.md §forma-answer.
  test('models.md §freeze: an open claim surprise freezes lifecycle-page bytes even when its pin is unchanged', async () => {
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    await stateRunSurprises(dir);
    const life = await read(dir, stateLifePath);
    const result = await stateRestate(dir, {
      [stateLifePath]: life.replace('# Thing state', '# Another heading with the same meaning'),
    });
    expectRefused(result);
    assert.equal(await read(dir, stateLifePath), life);
  });

  test('models.md §freeze / design.md §restate-checks: a Restate answer holding an unchanged frozen lifecycle page is refused', async () => {
    // models.md §freeze and design.md §restate-checks check 5 reject an answer holding a
    // held page whatever its bytes, even a byte-identical Restate submission.
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    await stateRunSurprises(dir);
    const life = await read(dir, stateLifePath);
    expectRefused(await stateRestate(dir, { [stateLifePath]: life }));
    assert.equal(await read(dir, stateLifePath), life);
  });

  test('models.md §freeze: an owed-again encoding of a frozen claim waits for its surprise ruling', async () => {
    // models.md §freeze to §slot-currency and account.md §items: every slot of the frozen claim
    // waits for the ruling, including an encoding owed again after a pin change.
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    const names = await stateRunSurprises(dir);
    await seedFiles(dir, { [stateClaimPath]: (await read(dir, stateClaimPath))
      .replace('Completed work would be lost.', 'Completion could be duplicated.') });
    const owed = stateItem(dir, stateSlotItem('encoding'));
    assert.ok(owed);
    assert.equal(owed.why, 'owed-again');
    assert.ok(owed.waits.includes('rule:' + names[0]));
  });

  test('models.md §freeze: a new witness absent from an open claim surprise held list waits and is refused', async () => {
    // models.md §freeze and account.md §items: a new slot of a frozen claim is refused,
    // and its slot item waits even though the opening snapshot cannot name it.
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    const [name] = await stateRunSurprises(dir);
    const path = claimFolder + '/witness-new.md';
    const surprise = JSON.parse(await read(dir, 'models/' + name + '.json'));
    assert.ok(!surprise.held.some((file) => file.path === path));
    const owed = stateItem(dir, stateSlotItem('witness'));
    assert.ok(owed);
    assert.ok(owed.waits.includes('rule:' + name));
    expectRefused(await answer(dir, stateSlotItem('witness'), { [path]: witness }));
    assert.equal(await read(dir, path), null);
    assert.notEqual(await read(dir, 'models/' + name + '.json'), null);
  });

  test('models.md §freeze: a filled witness absent from a base surprise basis is held and cannot be refilled', async () => {
    // evidence.md §questions and models.md §freeze: the base does not read its independent
    // witness, but held snapshots every existing slot of that claim.
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    const path = claimFolder + '/witness-done.md';
    await addSlot(dir, path, witness, stateSlotItem('witness'));
    const names = await stateRunSurprises(dir);
    const name = names.find((value) => value.startsWith('lifecycles-p/parts/p/claims/safe/base.'));
    assert.ok(name);
    const surprise = JSON.parse(await read(dir, 'models/' + name + '.json'));
    assert.ok(!surprise.basis.files.some((file) => file.path === path));
    assert.deepEqual(surprise.held.find((file) => file.path === path), { path, sha256: sha256(witness) });
    await seedFiles(dir, { [stateClaimPath]: (await read(dir, stateClaimPath))
      .replace('Completed work would be lost.', 'Completion could be duplicated.') });
    const owed = stateItem(dir, stateSlotItem('witness-done'));
    assert.equal(owed.why, 'owed-again');
    assert.ok(owed.waits.includes('rule:' + name));
    const changed = witness.replace('A completed thing is reached.', 'Completion can be reached.');
    expectRefused(await answer(dir, stateSlotItem('witness-done'), { [path]: changed }));
    assert.equal(await read(dir, path), witness);
  });

  test('models.md §freeze: a frozen owed-again encoding refuses both byte-identical renewal and changed bytes', async () => {
    // models.md §freeze and account.md §items: an answer holding a frozen file is
    // refused whatever its bytes; no identical-renewal exception exists.
    const dir = await baseProject();
    const path = claimFolder + '/encoding.md';
    await addSlot(dir, path, stateIdle);
    const [name] = await stateRunSurprises(dir);
    const surprise = JSON.parse(await read(dir, 'models/' + name + '.json'));
    assert.equal(surprise.basis.files.find((file) => file.path === path).sha256, sha256(stateIdle));
    await seedFiles(dir, { [stateClaimPath]: (await read(dir, stateClaimPath))
      .replace('Completed work would be lost.', 'Completion could be duplicated.') });
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    expectRefused(await answer(dir, stateSlotItem('encoding'), { [path]: forbidden }));
    // door.md §forma-answer: a refused answer changes no record file.
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    expectRefused(await answer(dir, stateSlotItem('encoding'), { [path]: stateIdle }));
    assert.equal(await read(dir, path), stateIdle);
    assert.ok(stateItem(dir, stateSlotItem('encoding')));
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    assert.notEqual(await read(dir, 'models/' + name + '.json'), null);
  });

  for (const kind of ['confirm', 'decline']) {
    // models.md §freeze; decisions.md §forma-show.
    test('models.md §freeze: an open lifecycle surprise blocks a lifecycle ' + kind + ' decision', async () => {
      const dir = await baseProject();
      await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
      await stateRunSurprises(dir);
      const result = forma(dir, ['show', kind, 'p/lifecycles/life', '--json']);
      assert.equal(result.status, 1);
      assert.ok(Array.isArray(result.json.refused) && result.json.refused.length);
    });
  }

  // models.md §freeze; door.md §change; account.md §commands.
  test('models.md §freeze: at every read a receipted changed frozen page counts for nothing until its original bytes return', async () => {
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    await stateRunSurprises(dir);
    const original = await read(dir, stateLifePath);
    const originalReceipt = await read(dir, 'design/parts/p/lifecycles/life/receipt');
    // A merged accepted version has a valid matching receipt, yet cannot evade
    // the open surprise's byte-based freeze (models.md §freeze).
    await seedFiles(dir, { [stateLifePath]: original.replace('# Thing state', '# Merged heading') });
    const changed = stateItem(dir, 'change:' + stateLifePath);
    assert.ok(changed);
    assert.ok(Object.hasOwn(changed, 'found'));
    await writeFiles(dir, { [stateLifePath]: original,
      'design/parts/p/lifecycles/life/receipt': originalReceipt });
    stateNoItem(dir, 'change:' + stateLifePath);
  });

  // models.md §freeze; design.md §restate-checks; door.md §forma-answer.
  test('models.md §freeze: an open surprise prevents removing the claim it rests on', async () => {
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    await stateRunSurprises(dir);
    const front = (await read(dir, stateFrontPath)).replace('3. [Completion is stable](claims/safe/)\n', '');
    expectRefused(await stateRestate(dir, { [stateFrontPath]: front }, ['design/parts/p/claims/safe']));
    assert.equal(await read(dir, claimFolder + '/encoding.md'), stateIdle);
    assert.notEqual(await read(dir, stateClaimPath), null);
  });

  // models.md §model-repair to §freeze; decisions.md §rulings.
  test('models.md §freeze: a repair changing shared lifecycle bytes waits for every surprise holding them', async () => {
    const base = await loadCase('base');
    const otherClaim = base[stateClaimPath].replace('# Completion is stable', '# Another stable claim')
      .replace('A completed thing never returns to idle.', 'An idle thing must not already exist.');
    const dir = await baseProject({ files: {
      'design/parts/p/claims/other/README.md': otherClaim,
      [stateFrontPath]: base[stateFrontPath] + '4. [Other claim](claims/other/)\n',
    } });
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    await addSlot(dir, 'models/lifecycles-p/parts/p/claims/other/encoding.md', stateIdle);
    const names = await stateRunSurprises(dir);
    assert.equal(names.length, 2);
    const item = await stateRule(dir, names[0]);
    const life = await read(dir, stateLifePath);
    expectRefused(await answer(dir, item,
      { 'repair.md': stateRepair, [stateLifePath]: life.replace('# Thing state', '# Repaired state') }), '10');
    await stateExplain(dir, names[1]);
    await decide(dir, 'rule', names[1], ['--verdict', 'model wrong', '--level', 'implementation',
      '--words', 'Restore completion stability.']);
    expectAccepted(await answer(dir, item,
      { 'repair.md': stateRepair, [stateLifePath]: life.replace('# Thing state', '# Repaired state') }), 'repair');
  });

  test('models.md §freeze: a property repair may change its ruled claim encoding while another claim still freezes model pages', async () => {
    // models.md §model-repair to §freeze and decisions.md §expects: the other claim freezes the model
    // pages and its own slots, not this ruled claim's encoding.
    const base = await loadCase('base');
    const otherClaim = base[stateClaimPath].replace('# Completion is stable', '# Another stable claim')
      .replace('A completed thing never returns to idle.', 'An idle thing must not already exist.');
    const dir = await baseProject({ files: {
      'design/parts/p/claims/other/README.md': otherClaim,
      [stateFrontPath]: base[stateFrontPath] + '4. [Other claim](claims/other/)\n',
    } });
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    await addSlot(dir, 'models/lifecycles-p/parts/p/claims/other/encoding.md', stateIdle);
    const names = await stateRunSurprises(dir);
    assert.equal(names.length, 2);
    const name = names.find((value) => value.startsWith('lifecycles-p/parts/p/claims/safe/'));
    assert.ok(name);
    const other = names.find((value) => value !== name);
    const item = await stateRule(dir, name, 'property wrong');
    const path = claimFolder + '/encoding.md';
    expectAccepted(await answer(dir, item, { 'repair.md': stateRepair, [path]: forbidden }), 'repair');
    assert.equal(await read(dir, path), forbidden);
    assert.notEqual(await read(dir, 'models/' + other + '.json'), null);
    // decisions.md §expects: the encoding's changed receipt meets the property repair.
    stateNoItem(dir, item);
  });
});


describe('models.md §lifecycle-model / decisions.md §kept-journeys, §in-force Lifecycle traces and rulings', () => {
  test('models.md §lifecycle-model / decisions.md §kept-journeys: a kept lifecycle trace may enter an absent entity before reaching the forbidden phase', async () => {
    // decisions.md §kept-journeys permits absent entities entered by a step and exempts
    // their entering action from matching a cell at a nonexistent prior phase.
    // forms.md §lifecycles to §journeys, lifecycle-tool.md §stepping: either creation case enters at idle, even though
    // both cases refuse when an entity already exists; the written journey picks new.
    const files = await enteredLifecycleFiles('created');
    files['design/parts/p/actions.md'] = files['design/parts/p/actions.md'].replace(
      '| create | actor | Create the thing. | none |', '| create | actor | Create the thing. | new, retry |');
    files[stateLifePath] = files[stateLifePath].replaceAll('| None. |', '| new: None.<br>retry: None. |');
    files['design/parts/p/journeys/finish/README.md'] = files['design/parts/p/journeys/finish/README.md'].replace(
      '| 1 | The service | create | - | - | - |', '| 1 | The service | create | - | - | new |');
    const dir = await baseProject({ files });
    await addSlot(dir, claimFolder + '/encoding.md', combination);
    const names = await stateRunSurprises(dir);
    const name = names.find((value) => value.startsWith('lifecycles-p/parts/p/claims/safe/base.'));
    assert.ok(name);
    const surprise = JSON.parse(await read(dir, 'models/' + name + '.json'));
    const key = 'kept-' + sha256(JSON.stringify(surprise.basis, null, 2) + '\n').slice(0, 12);
    await stateExplain(dir, name);
    const ruled = await decide(dir, 'rule', name, ['--verdict', 'model wrong', '--level', 'implementation',
      '--words', 'The model must refuse completion after creation.']);
    const text = await read(dir, ruled.json.recorded[0]);
    const kept = text.split('## Kept\n')[1]?.split('### ' + name + '\n')[1]?.split('\n### ')[0];
    assert.ok(kept);
    // decisions.md §kept-journeys fixes these fields and forbids a start row for an
    // entity absent from the first state; table formatting and case tie-breaking
    // remain open, so neither is an oracle here.
    const fields = new Map(kept.split(/\n\s*\n/).flatMap((block) =>
      tableRowsOf(block, ['field', 'value']) ?? []).map((row) => [row.field, row.value]));
    assert.equal(fields.get('Journey'), 'p/journeys/' + key);
    assert.equal(fields.get('Polarity'), 'must not');
    assert.equal(fields.get('Refused step'), '2');
    assert.ok(!fields.has('Not kept'));
    assert.equal((tableRowsOf(kept, ['lifecycle', 'entity', 'phase']) ?? []).length, 0);
  });

  test('models.md §lifecycle-model / decisions.md §kept-journeys: a lifecycle base trace is kept as a confirmed must-not journey', async () => {
    const dir = await baseProject();
    // The forbidden done combination is reached only after the first step,
    // giving the one-step, non-liveness trace decisions.md §kept-journeys can keep.
    await addSlot(dir, claimFolder + '/encoding.md', combination);
    const [name] = await stateRunSurprises(dir);
    const surprise = JSON.parse(await read(dir, 'models/' + name + '.json'));
    const key = 'kept-' + sha256(JSON.stringify(surprise.basis, null, 2) + '\n').slice(0, 12);
    await stateExplain(dir, name);
    const ruled = await decide(dir, 'rule', name, ['--verdict', 'model wrong', '--level', 'implementation',
      '--words', 'The model must refuse the final step.']);
    const text = await read(dir, ruled.json.recorded[0]);
    assert.ok(text.includes('## Kept\n'));
    assert.ok(text.includes('### ' + name + '\n'));
    // Shared table syntax permits spacing; assert field values, not rendering.
    const rows = text.split('\n').filter((line) => line.startsWith('|')).map((line) =>
      line.split('|').slice(1, -1).map((cell) => cell.trim()));
    assert.ok(rows.some(([field, value]) => field === 'Journey' && value === 'p/journeys/' + key));
    assert.ok(rows.some(([field, value]) => field === 'Polarity' && value === 'must not'));
    assert.ok(rows.some(([field, value]) => field === 'Refused step' && value === '1'));
    assert.equal(await read(dir, 'design/parts/p/journeys/' + key + '/README.md'), null);
    // decisions.md §kept-journeys confirms it through its ruling; evidence.md §questions then
    // asks its lifecycle question without a separate journey confirmation.
    stateNoItem(dir, 'confirm:p/journeys/' + key);
    assert.ok(missing(dir).some((item) => item.item.startsWith('run:lifecycles-p/parts/p/journeys/' + key + '/')));
  });

  test('models.md §lifecycle-model / decisions.md §in-force: superseding one surprise keeps the other surprise journey confirmed', async () => {
    const base = await loadCase('base');
    const dir = await baseProject({ files: {
      'design/parts/p/claims/other/README.md': base[stateClaimPath]
        .replace('# Completion is stable', '# Another completion claim')
        .replace('A completed thing never returns to idle.', 'A thing cannot complete this way.'),
      [stateFrontPath]: base[stateFrontPath] + '4. [Other claim](claims/other/)\n',
    } });
    await addSlot(dir, claimFolder + '/encoding.md', combination);
    await addSlot(dir, 'models/lifecycles-p/parts/p/claims/other/encoding.md', combination);
    const names = await stateRunSurprises(dir);
    assert.equal(names.length, 2);
    const keysByName = {};
    for (const name of names) {
      const surprise = JSON.parse(await read(dir, 'models/' + name + '.json'));
      keysByName[name] = 'kept-' + sha256(JSON.stringify(surprise.basis, null, 2) + '\n').slice(0, 12);
      await stateExplain(dir, name);
    }
    // Two clones may rule the same surprise differently; merge only the later
    // decision so the first ruling stays in force for its other surprise.
    const branch = await project(null, await snapshot(dir));
    await decide(dir, 'rule', names.join(','), ['--verdict', 'model wrong', '--level', 'implementation',
      '--words', 'Both model traces must be refused.']);
    // decisions.md §decision-file: an unrelated tracked decision makes the branch's next
    // ruling strictly later, without relying on elapsed wall-clock time.
    const allowance = await decide(dir, 'allow', undefined, ['--runs', '1']);
    for (const path of allowance.json.recorded) await writeFiles(branch, { [path]: await read(dir, path) });
    const later = await decide(branch, 'rule', names[0], ['--verdict', 'real finding', '--level', 'implementation',
      '--target', 'lifecycles-p', '--words', 'This first trace reveals a real finding.']);
    for (const path of later.json.recorded) await writeFiles(dir, { [path]: await read(branch, path) });
    // evidence.md §questions only asks confirmed journeys; decisions.md §kept-journeys, §in-force make
    // each kept journey follow the ruling in force for its own surprise.
    const items = missing(dir).map((item) => item.item);
    assert.ok(items.some((item) => item.startsWith('run:lifecycles-p/parts/p/journeys/' + keysByName[names[1]] + '/')));
    assert.ok(!items.some((item) => item.startsWith('run:lifecycles-p/parts/p/journeys/' + keysByName[names[0]] + '/')));
  });

  test('models.md §freeze / door.md §change: a merged closed surprise explanation passes the read-time identity check', async () => {
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', stateIdle);
    const [name] = await stateRunSurprises(dir);
    await stateExplain(dir, name);
    const stem = 'models/' + name;
    const explained = stem + '.explained.md';
    const merged = {
      [stem + '.json']: await read(dir, stem + '.json'),
      [explained]: await read(dir, explained),
      [claimFolder + '/receipt']: await read(dir, claimFolder + '/receipt'),
    };
    await decide(dir, 'rule', name, ['--verdict', 'model wrong', '--level', 'implementation',
      '--words', 'Repair the model.']);
    assert.equal(await read(dir, explained), null);
    await writeFiles(dir, merged);
    // door.md §change item 3: on read, Explain check 2 only requires Question and
    // Basis to identify its stem's surprise, which may already be closed.
    stateNoItem(dir, 'change:' + explained);
    stateNoItem(dir, 'explain:' + name);
    // evidence.md §at-ruling, §forma-run remove the closed merged stem at the next run.
    ok(forma(dir, ['run', '--json']));
    assert.equal(await read(dir, explained), null);
    assert.equal(await read(dir, stem + '.json'), null);
  });
});

describe('models.md §slot-currency When a slot is current, owed again or kept', () => {
  // models.md §slot-currency; door.md §receipts.
  test('models.md §slot-currency: lifecycle encoding, witness and fault receipts pin the claim and every lifecycle of the part', async () => {
    const base = await loadCase('base');
    const second = base[stateLifePath].replace('# Thing state', '# Other thing state');
    const dir = await baseProject({ files: {
      'design/parts/p/lifecycles/other/README.md': second,
      [stateFrontPath]: base[stateFrontPath] + '4. [Other state](lifecycles/other/)\n',
    } });
    await decide(dir, 'confirm', 'p/lifecycles/other');
    await stateSlots(dir);
    const expected = [
      { entry: 'p/claims/safe', pin: claimPin() },
      { entry: 'p/lifecycles/life', pin: lifecyclePin() },
      { entry: 'p/lifecycles/other', pin: lifecyclePin() },
    ];
    const lines = await receiptLines(dir, claimFolder);
    for (const file of ['encoding.md', 'fault-return.md', 'witness-done.md']) {
      assert.deepEqual(lines.find((line) => line.file === file).pins, expected);
    }
    for (const slot of ['encoding', 'fault-return', 'witness-done']) stateNoItem(dir, stateSlotItem(slot));
  });

  // models.md §slot-currency; account.md §items.
  test('models.md §slot-currency: a changed claim pin owes each filled lifecycle slot again while retaining its bytes', async () => {
    const dir = await baseProject();
    await stateSlots(dir);
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    await seedFiles(dir, { [stateClaimPath]: (await read(dir, stateClaimPath))
      .replace('Completed work would be lost.', 'Completion could be duplicated.') });
    for (const slot of ['encoding', 'fault-return', 'witness-done']) {
      assert.equal(stateItem(dir, stateSlotItem(slot)).why, 'owed-again');
      assert.equal(await read(dir, claimFolder + '/' + slot + '.md'), before[claimFolder + '/' + slot + '.md']);
    }
    stateNoItem(dir, 'change:' + claimFolder + '/encoding.md');
  });

  // models.md §slot-currency; design.md §pins; door.md §receipts.
  test('models.md §slot-currency: an owed-again slot may return the identical bytes and record the claim pin now', async () => {
    const dir = await baseProject();
    await stateSlots(dir);
    const changed = (await read(dir, stateClaimPath))
      .replace('Completed work would be lost.', 'Completion could be duplicated.');
    await seedFiles(dir, { [stateClaimPath]: changed });
    await addSlot(dir, claimFolder + '/encoding.md', forbidden);
    // design.md §pins: only the Stake line changed.
    const expectedPin = sha256(['Sentence: A completed thing never returns to idle.', 'Kind: safety',
      'Stake: Completion could be duplicated.', 'Rests on: ', 'Parts: Advances a thing to completion.',
      'Cites: ' + passagePin].join('\n'));
    const line = (await receiptLines(dir, claimFolder)).find((row) => row.file === 'encoding.md');
    assert.deepEqual(line.pins, [
      { entry: 'p/claims/safe', pin: expectedPin },
      { entry: 'p/lifecycles/life', pin: lifecyclePin() },
    ]);
    stateNoItem(dir, stateSlotItem('encoding'));
    assert.equal(stateItem(dir, stateSlotItem('witness-done')).why, 'owed-again');
  });

  // models.md §slot-currency; door.md §forma-give to §gives.
  test('models.md §slot-currency: an owed-again packet gives the old slot and the changed entry', async () => {
    const dir = await baseProject();
    await stateSlots(dir);
    const changed = (await read(dir, stateClaimPath)).replace('Completed work would be lost.', 'Completion could be duplicated.');
    await seedFiles(dir, { [stateClaimPath]: changed });
    const folder = await tempFolder();
    const given = ok(forma(dir, ['give', stateSlotItem('encoding'), folder, '--json']));
    assert.equal(await read(folder, claimFolder + '/encoding.md'), forbidden);
    assert.equal(await read(folder, stateClaimPath), changed);
    const item = JSON.parse(await read(folder, 'item.json'));
    assert.equal(item.item.why, 'owed-again');
    assert.ok(given.files.some((file) => file.path === claimFolder + '/encoding.md'));
  });

  // models.md §slot-currency; design.md §confirmation-pins; decisions.md §in-force.
  test('models.md §slot-currency: a changed lifecycle keeps its slots while unconfirmed and owes them again after confirmation', async () => {
    const dir = await baseProject();
    await stateSlots(dir);
    const bytes = await read(dir, claimFolder + '/receipt');
    await seedFiles(dir, { [stateLifePath]: (await read(dir, stateLifePath)).replace('| Ends | done |', '| Ends | none |') });
    for (const slot of ['encoding', 'witness-done', 'fault-return']) stateNoItem(dir, stateSlotItem(slot));
    assert.equal(await read(dir, claimFolder + '/receipt'), bytes);
    await decide(dir, 'confirm', 'p/lifecycles/life');
    for (const slot of ['encoding', 'witness-done', 'fault-return']) {
      assert.equal(stateItem(dir, stateSlotItem(slot)).why, 'owed-again');
    }
  });

  // models.md §lifecycle-model, §slot-currency; evidence.md §currency.
  test('models.md §slot-currency: declining the last lifecycle keeps all slots and confirming the same pin restores them without an answer', async () => {
    const dir = await baseProject();
    await stateSlots(dir);
    ok(forma(dir, ['run', '--json']));
    const files = await snapshot(dir, { skip: ['work', 'runs'] });
    await decide(dir, 'decline', 'p/lifecycles/life', ['--words', 'Reconsider these phases.']);
    for (const slot of ['encoding', 'witness-done', 'fault-return']) stateNoItem(dir, stateSlotItem(slot));
    await decide(dir, 'confirm', 'p/lifecycles/life');
    for (const slot of ['encoding', 'witness-done', 'fault-return']) stateNoItem(dir, stateSlotItem(slot));
    for (const path of Object.keys(files).filter((p) => p.startsWith(claimFolder + '/'))) {
      assert.equal(await read(dir, path), files[path]);
    }
    stateNoItem(dir, 'run:lifecycles-p/parts/p/claims/safe/base');
  });

  // models.md §slot-currency; models.md §slots.
  test('models.md §slot-currency: replacing a property with a reason keeps witnesses and faults without owing them', async () => {
    const dir = await baseProject();
    await stateSlots(dir);
    const receipt = await read(dir, claimFolder + '/receipt');
    const pins = [{ entry: 'p/claims/safe', pin: claimPin() },
      { entry: 'p/lifecycles/life', pin: lifecyclePin() }];
    await seedFiles(dir, { [claimFolder + '/encoding.md']: reason },
      { [claimFolder + '/encoding.md']: { pins } });
    for (const slot of ['witness', 'fault', 'witness-done', 'fault-return']) stateNoItem(dir, stateSlotItem(slot));
    assert.equal(await read(dir, claimFolder + '/witness-done.md'), witness);
    assert.equal(await read(dir, claimFolder + '/fault-return.md'), fault);
    await writeFiles(dir, { [claimFolder + '/encoding.md']: forbidden, [claimFolder + '/receipt']: receipt });
    for (const slot of ['encoding', 'witness-done', 'fault-return']) stateNoItem(dir, stateSlotItem(slot));
  });

  // models.md §slot-currency; door.md §receipts, §change; account.md §items.
  test('models.md §slot-currency: a slot whose bytes have no matching receipt is unfilled', async () => {
    const dir = await baseProject();
    await stateSlots(dir);
    await writeFiles(dir, { [claimFolder + '/encoding.md']: forbidden + '\n' });
    assert.equal(stateItem(dir, stateSlotItem('encoding')).why, 'unfilled');
    assert.ok(stateItem(dir, 'change:' + claimFolder + '/encoding.md'));
    stateNoItem(dir, 'run:lifecycles-p/parts/p/claims/safe/base');
  });

  // models.md §slot-currency; models.md §slot-answer.
  test('models.md §slot-currency: unchanged native text that fails against a revised model is owed again', engineOnly, async () => {
    const dir = await baseProject();
    const model = await addModel(dir);
    model['models/core/Core.tla'] = model['models/core/Core.tla'].replace('Phase(e) == phase',
      'Phase(e) == phase\nStable == phase # "missing"');
    await seedFiles(dir, model);
    const path = 'models/core/parts/p/claims/safe/encoding.tla';
    await addSlot(dir, path, 'Invariant == Stable\n');
    await seedFiles(dir, { 'models/core/Core.tla': model['models/core/Core.tla'].replace('\nStable == phase # "missing"', '') });
    assert.equal(stateItem(dir, 'slot:core/parts/p/claims/safe/encoding').why, 'owed-again');
    assert.equal(await read(dir, path), 'Invariant == Stable\n');
  });
});


async function stateTwoPartFiles() {
  return {
    'design/README.md': '# Two parts\n\n| Part | Purpose | Cites |\n| --- | --- | --- |\n' +
      '| p | Advances a thing to completion. | design/brief/system.md#system |\n' +
      '| q | Records auxiliary work. | design/brief/system.md#system |\n\n' +
      '1. [Processor](parts/p/)\n2. [Auxiliary](parts/q/)\n',
    'design/parts/q/README.md': '# Auxiliary\n',
    'design/parts/q/actions.md': '# Actions\n\n| Action | Actor | Sentence | Cases | Guard | Origin | Cites |\n' +
      '| --- | --- | --- | --- | --- | --- | --- |\n',
    'design/parts/q/boundary.md': '# Boundary\n',
  };
}
async function stateFullModel(key = 'core') {
  const files = await modelFiles('tlc', key);
  const path = 'models/' + key + '/model.md';
  files[path] = files[path].replace('| Parts | p |', '| Parts | p, q |');
  return files;
}
async function stateRefileClaim(dir) {
  const oldFront = await read(dir, stateFrontPath);
  const claim = await read(dir, stateClaimPath);
  return stateRestate(dir, {
    [stateFrontPath]: oldFront.replace('3. [Completion is stable](claims/safe/)\n', ''),
    'design/parts/q/README.md': '# Auxiliary\n\n1. [Completion is stable](claims/safe/)\n',
    'design/parts/q/claims/safe/README.md': claim,
  }, ['design/parts/p/claims/safe']);
}

describe('models.md §parts-change A model whose parts change, and things removed or moved', () => {
  // models.md §slot-currency to §parts-change; evidence.md §questions.
  test('models.md §parts-change: adding an action owes a Model answer and keeps its slots until the model is valid again', engineOnly, async () => {
    const dir = await baseProject();
    await addModel(dir);
    const path = 'models/core/parts/p/claims/safe/encoding.tla';
    await addSlot(dir, path, 'Invariant == phase # "missing"\n');
    const originalActions = await read(dir, 'design/parts/p/actions.md');
    const originalLife = await read(dir, stateLifePath);
    await seedFiles(dir, {
      'design/parts/p/actions.md': originalActions +
        '| extra | actor | Observe the thing. | none | none | stated | design/brief/system.md#system |\n',
      [stateLifePath]: originalLife.replace('| Unaffected | none |', '| Unaffected | extra |'),
    });
    assert.ok(stateItem(dir, 'model:core'));
    stateNoItem(dir, 'slot:core/parts/p/claims/safe/encoding');
    assert.equal(await read(dir, path), 'Invariant == phase # "missing"\n');
    assert.ok(!missing(dir).some((item) => item.item.startsWith('run:core/')));
    await seedFiles(dir, { 'design/parts/p/actions.md': originalActions, [stateLifePath]: originalLife });
    stateNoItem(dir, 'model:core');
    stateNoItem(dir, 'slot:core/parts/p/claims/safe/encoding');
  });

  // models.md §parts-change.
  test('models.md §parts-change: a receipted engine file that fails parsing owes a Model answer at every read', engineOnly, async () => {
    const dir = await baseProject();
    await addModel(dir);
    await seedFiles(dir, { 'models/core/Core.tla': 'This is not a TLA+ module.\n' });
    assert.ok(stateItem(dir, 'model:core'));
  });

  // models.md §parts-change.
  test('models.md §parts-change: removing and adding the same claim with the same pin in one answer preserves all its slots', async () => {
    const dir = await baseProject();
    await stateSlots(dir);
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    expectAccepted(await stateRestate(dir, { [stateClaimPath]: await read(dir, stateClaimPath) },
      ['design/parts/p/claims/safe']), 'restate');
    for (const path of Object.keys(before).filter((p) => p.startsWith(claimFolder + '/'))) {
      assert.equal(await read(dir, path), before[path]);
    }
  });

  // models.md §parts-change; account.md §items; door.md §forma-answer.
  test('models.md §parts-change: removing a claim removes its slots and receipt, and later re-addition owes a fresh encoding', async () => {
    const dir = await baseProject();
    await stateSlots(dir);
    const claim = await read(dir, stateClaimPath);
    const front = await read(dir, stateFrontPath);
    const removed = expectAccepted(await stateRestate(dir, {
      [stateFrontPath]: front.replace('3. [Completion is stable](claims/safe/)\n', ''),
    }, ['design/parts/p/claims/safe']), 'restate');
    for (const name of ['encoding.md', 'witness-done.md', 'fault-return.md', 'receipt']) {
      assert.equal(await read(dir, claimFolder + '/' + name), null);
    }
    const restored = expectAccepted(await stateRestate(dir, {
      [stateFrontPath]: front, [stateClaimPath]: claim,
    }), 'restate');
    assert.equal(restored.answers.spent, removed.answers.spent + 1);
    assert.equal(stateItem(dir, stateSlotItem('encoding')).why, 'unfilled');
    assert.equal(await read(dir, claimFolder + '/receipt'), null);
  });

  // models.md §parts-change; account.md §items.
  test('models.md §parts-change: adding a removed claim under another key owes its slots under the new key', async () => {
    const dir = await baseProject();
    await stateSlots(dir);
    const claim = await read(dir, stateClaimPath);
    const front = (await read(dir, stateFrontPath)).replace('(claims/safe/)', '(claims/new-safe/)');
    expectAccepted(await stateRestate(dir, {
      [stateFrontPath]: front, 'design/parts/p/claims/new-safe/README.md': claim,
    }, ['design/parts/p/claims/safe']), 'restate');
    assert.equal(await read(dir, claimFolder + '/encoding.md'), null);
    assert.equal(stateItem(dir, 'slot:lifecycles-p/parts/p/claims/new-safe/encoding').why, 'unfilled');
  });

  // models.md §parts-change; door.md §receipts.
  test('models.md §parts-change: re-filing a claim moves slots and rewrites receipt entry names without changing their pins or hashes', async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    await stateSlots(dir);
    const oldLines = await receiptLines(dir, claimFolder);
    expectAccepted(await stateRefileClaim(dir), 'restate');
    const target = 'models/lifecycles-p/parts/q/claims/safe';
    assert.equal(await read(dir, claimFolder + '/receipt'), null);
    const moved = await receiptLines(dir, target);
    assert.equal(moved.length, oldLines.length);
    for (const line of moved) {
      const old = oldLines.find((prior) => prior.file === line.file);
      assert.equal(line.sha256, old.sha256);
      assert.deepEqual(line.pins, old.pins.map((pin) =>
        pin.entry === 'p/claims/safe' ? { entry: 'q/claims/safe', pin: pin.pin } : pin)
        .sort((a, b) => a.entry < b.entry ? -1 : a.entry > b.entry ? 1 : 0));
      assert.equal(await read(dir, target + '/' + line.file),
        line.file === 'encoding.md' ? forbidden : line.file === 'witness-done.md' ? witness : fault);
    }
    assert.ok(!missing(dir).some((item) => item.item.startsWith('slot:lifecycles-p/parts/q/claims/safe/')));
  });

  // models.md §parts-change.
  test('models.md §parts-change: removing a part removes the slots of a claim filed there even when its parts are elsewhere', async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    await stateSlots(dir);
    expectAccepted(await stateRefileClaim(dir), 'restate');
    const base = await loadCase('base');
    expectAccepted(await stateRestate(dir, { 'design/README.md': base['design/README.md'] },
      ['design/parts/q']), 'restate');
    for (const file of ['encoding.md', 'witness-done.md', 'fault-return.md', 'receipt']) {
      assert.equal(await read(dir, 'models/lifecycles-p/parts/q/claims/safe/' + file), null);
    }
  });

  // models.md §parts-change.
  test('models.md §parts-change: removing a span removes the slots and receipt of every claim it held', engineOnly, async () => {
    const files = await stateTwoPartFiles();
    const base = await loadCase('base');
    files['design/README.md'] += '3. [Shared properties](spans/shared/)\n';
    files['design/spans/shared/README.md'] = '# Shared properties\n\nCompletion crosses both components.\n\n' +
      '1. [Cross-part stability](claims/cross/)\n';
    files['design/spans/shared/claims/cross/README.md'] =
      base[stateClaimPath].replace('| Parts | p |', '| Parts | p, q |');
    const dir = await baseProject({ files });
    expectAccepted(await answer(dir, 'cover:p+q', await stateFullModel()), 'model');
    const folder = 'models/core/spans/shared/claims/cross';
    await addSlot(dir, folder + '/encoding.tla', 'Invariant == phase # "missing"\n');
    const root = (await read(dir, 'design/README.md')).replace('3. [Shared properties](spans/shared/)\n', '');
    expectAccepted(await stateRestate(dir, { 'design/README.md': root }, ['design/spans/shared']), 'restate');
    assert.equal(await read(dir, folder + '/encoding.tla'), null);
    assert.equal(await read(dir, folder + '/receipt'), null);
  });

  // models.md §parts-change.
  test('models.md §parts-change: a model whose named part was removed is owed a Model answer', engineOnly, async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    expectAccepted(await answer(dir, 'cover:p+q', await stateFullModel()), 'model');
    const base = await loadCase('base');
    expectAccepted(await stateRestate(dir, { 'design/README.md': base['design/README.md'] },
      ['design/parts/q']), 'restate');
    assert.ok(stateItem(dir, 'model:core'));
  });
});


async function stateUnansweredModel(dir) {
  const files = await stateFullModel();
  // A phases invariant over an unbounded increasing natural number never
  // exhausts its state space. evidence.md §limits to §outcomes,
  // makes reaching a finite time or memory limit unanswered; no timeout
  // duration or engine wording is assumed. account.md §items: its item.
  files['models/core/Core.tla'] =
    '------------------------------ MODULE Core ------------------------------\n' +
    'EXTENDS Naturals\nCONSTANT Things\nVARIABLE x\n\nvars == <<x>>\n' +
    'Init == x = 0\nTypeOK == x \\in Nat\nStep == x\' = x + 1\n' +
    'Phase(e) == IF x = 0 THEN "idle" ELSE "done"\n' +
    '=============================================================================\n';
  expectAccepted(await answer(dir, 'cover:p+q', files), 'model');
  const ran = ok(forma(dir, ['run', '--json']));
  const phases = ran.ran.find((run) => run.name.startsWith('core/phases.'));
  assert.ok(phases);
  assert.equal(phases.found.outcome, 'unanswered');
  // evidence.md §measures: evidence has only duration and this engine's measures.
  evidenceWithMeasures(await read(dir, 'models/' + phases.name + '.json'), ['states', 'depth']);
  assert.ok(stateItem(dir, 'unanswered:' + phases.name));
  return { files, question: phases.name };
}
async function stateNewModel(dir, files, key) {
  const path = 'models/' + key + '/model.md';
  // door.md §change: a new unreceipted model file is a change item.
  await writeFiles(dir, { [path]: files[path] });
  return answer(dir, 'change:' + path, files);
}

// evidence.md §measures: inspect the JSON's measure members before parsing too,
// because JSON.parse would hide a duplicate key that the contract prohibits.
function evidenceWithMeasures(text, own) {
  const raw = /"measures"\s*:\s*\{([^{}]*)\}/.exec(text);
  assert.ok(raw);
  const names = [...raw[1].matchAll(/"([^"]+)"\s*:/g)].map((match) => match[1]);
  assert.deepEqual(sorted(names), sorted(['duration', ...own]));
  const evidence = JSON.parse(text);
  keys(evidence.measures, ['duration', ...own]);
  return evidence;
}

describe('models.md §lifecycle-model / evidence.md §measures Engine measures', () => {
  for (const engine of ['lifecycle', 'tlc', 'alloy']) {
    test(`models.md §lifecycle-model / evidence.md §measures: ${engine} evidence holds exactly its own measures and duration`,
      engine === 'lifecycle' ? {} : engineOnly, async () => {
        // evidence.md §questions, §question-names, §measures: these questions are asked without claim slots;
        // their measure keys exclude all other engines' keys and withdrawn keys.
        const dir = await baseProject();
        if (engine !== 'lifecycle') await addModel(dir, engine);
        const ran = ok(forma(dir, ['run', '--json']));
        const name = engine === 'lifecycle'
          ? 'lifecycles-p/parts/p/journeys/finish/lifecycle-path'
          : ran.ran.find((row) => row.name.startsWith('core/phases.'))?.name;
        assert.ok(name);
        const own = engine === 'lifecycle' ? ['combinations']
          : engine === 'tlc' ? ['states', 'depth'] : ['scope', 'steps', 'bitwidth'];
        const evidence = evidenceWithMeasures(await read(dir, 'models/' + name + '.json'), own);
        assert.equal(typeof evidence.measures.duration, 'number');
        assert.ok(evidence.measures.duration >= 0);
        if (engine === 'alloy') {
          // evidence.md §measures: omitted command bounds are null, even when Alloy
          // supplies defaults internally; this fixture specifies only scope.
          assert.equal(evidence.measures.scope, 3);
          assert.equal(evidence.measures.steps, null);
          assert.equal(evidence.measures.bitwidth, null);
        } else {
          for (const measure of own) {
            assert.ok(evidence.measures[measure] === null ||
              (Number.isInteger(evidence.measures[measure]) && evidence.measures[measure] >= 0));
          }
        }
      });
  }

  // engines.md §bounds; engines.md §alloy, evidence.md §measures: explicit command bounds supply
  // Alloy's measures, with a steps range represented as [least, most].
  test('engines.md §bounds / evidence.md §measures: explicit Alloy steps and bitwidth are reported in its measures', engineOnly, async () => {
    const dir = await baseProject();
    const files = await modelFiles('alloy');
    files['models/core/model.md'] = files['models/core/model.md'].replace(
      '| scope | 3 but exactly 1 Thing | one thing and its two phases |',
      '| scope | 3 but exactly 1 Thing | one thing and its two phases |\n' +
      '| steps | 1..3 | at most three observations |\n| int | 4 | four-bit integers |');
    expectAccepted(await answer(dir, 'cover:p', files), 'model');
    const ran = ok(forma(dir, ['run', '--json']));
    const phases = ran.ran.find((row) => row.name.startsWith('core/phases.'));
    assert.ok(phases);
    const evidence = evidenceWithMeasures(await read(dir, 'models/' + phases.name + '.json'), ['scope', 'steps', 'bitwidth']);
    assert.equal(evidence.measures.scope, 3);
    assert.deepEqual(evidence.measures.steps, [1, 3]);
    assert.equal(evidence.measures.bitwidth, 4);
  });
});

describe('models.md §one-model-first One model first, and a smaller model', () => {
  // models.md §one-model-first; models.md §parts-change.
  test('models.md §one-model-first: updating an already smaller model without dropping a part requires no new unanswered evidence', engineOnly, async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    const small = await modelFiles('tlc', 'small');
    await seedFiles(dir, { ...await stateFullModel(), ...small });
    await seedFiles(dir, {
      'design/parts/p/actions.md': (await read(dir, 'design/parts/p/actions.md')) +
        '| extra | actor | Observe the thing. | none | none | stated | design/brief/system.md#system |\n',
      [stateLifePath]: (await read(dir, stateLifePath)).replace('| Unaffected | none |', '| Unaffected | extra |'),
    });
    assert.ok(stateItem(dir, 'model:small'));
    small['models/small/model.md'] = small['models/small/model.md'].replace('| p/step | Step | none |',
      '| p/step | Step | none |\n| p/extra | Extra | none |');
    small['models/small/Core.tla'] = small['models/small/Core.tla'].replace('Phase(e) == phase',
      "Phase(e) == phase\nExtra == phase' = phase");
    expectAccepted(await answer(dir, 'model:small', small), 'model');
    stateNoItem(dir, 'model:small');
  });

  // models.md §one-model-first.
  test('models.md §one-model-first: lifecycle coverage never permits the first native model to omit another part', engineOnly, async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    expectRefused(await answer(dir, 'cover:p+q', await modelFiles()), '13');
  });

  // models.md §one-model-first; models.md §model-answer.
  test('models.md §one-model-first: the first native model is accepted when it covers the whole part list', engineOnly, async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    expectAccepted(await answer(dir, 'cover:p+q', await stateFullModel()), 'model');
  });

  // models.md §one-model-first: neither its unanswered-evidence nor another-engine exception holds.
  test('models.md §one-model-first: a new smaller model is refused when neither unanswered evidence nor another-engine debt permits a split', engineOnly, async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    expectAccepted(await answer(dir, 'cover:p+q', await stateFullModel()), 'model');
    expectRefused(await stateNewModel(dir, await modelFiles('tlc', 'small'), 'small'), '13');
  });

  // models.md §one-model-first.
  test('models.md §one-model-first: another model of the same size does not split and needs no unanswered evidence', engineOnly, async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    expectAccepted(await answer(dir, 'cover:p+q', await stateFullModel()), 'model');
    expectAccepted(await stateNewModel(dir, await stateFullModel('peer'), 'peer'), 'model');
  });

  // models.md §one-model-first.
  test('models.md §one-model-first: current unanswered evidence permits a new model with fewer parts', engineOnly, async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    await stateUnansweredModel(dir);
    expectAccepted(await stateNewModel(dir, await modelFiles('tlc', 'small'), 'small'), 'model');
  });

  // models.md §one-model-first; evidence.md §outcomes, §forma-run.
  test('models.md §one-model-first: unanswered evidence that becomes answered before submission no longer permits the split', engineOnly, async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    const { question } = await stateUnansweredModel(dir);
    expectAccepted(await answer(dir, 'unanswered:' + question, await stateFullModel()), 'model');
    const ran = ok(forma(dir, ['run', '--json']));
    const phases = ran.ran.find((run) => run.name === question);
    assert.ok(phases);
    assert.equal(phases.found.outcome, 'no violation');
    expectRefused(await stateNewModel(dir, await modelFiles('tlc', 'small'), 'small'), '13');
  });

  // models.md §one-model-first.
  test('models.md §one-model-first: model-size rules are not retroactively checked when an already accepted smaller model is read', engineOnly, async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    await seedFiles(dir, { ...await stateFullModel(), ...await modelFiles('tlc', 'small') });
    stateNoItem(dir, 'model:core');
    stateNoItem(dir, 'model:small');
    stateNoItem(dir, 'change:models/small/model.md');
  });

  for (const sameEngine of [false, true]) {
    // models.md §one-model-first to §owed: an inexpressible claim permits a smaller model only
    // on an engine different from every model it splits from. Lifecycle
    // coverage participates in the express debt, but not in split sizes.
    test(`models.md §one-model-first: an inexpressible claim ${sameEngine ? 'does not permit a smaller model on the same engine' : 'permits a smaller model on another engine'}`, engineOnly, async () => {
      const dir = await baseProject({ files: await stateTwoPartFiles() });
      expectAccepted(await answer(dir, 'cover:p+q', await stateFullModel()), 'model');
      await addSlot(dir, claimFolder + '/encoding.md', reason);
      await addSlot(dir, 'models/core/parts/p/claims/safe/encoding.md', reason);
      assert.ok(stateItem(dir, 'express:p/claims/safe'));
      const result = await stateNewModel(dir,
        await modelFiles(sameEngine ? 'tlc' : 'alloy', 'small'), 'small');
      if (sameEngine) expectRefused(result);
      else expectAccepted(result, 'model');
    });
  }

  // models.md §one-model-first: the alternate engine must differ from every larger source,
  // including a larger model on that engine alongside the original one.
  test('models.md §one-model-first: an inexpressible claim refuses a smaller model sharing any larger source model engine', engineOnly, async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    expectAccepted(await answer(dir, 'cover:p+q', await stateFullModel()), 'model');
    const peer = await modelFiles('alloy', 'peer');
    peer['models/peer/model.md'] = peer['models/peer/model.md'].replace('| Parts | p |', '| Parts | p, q |');
    expectAccepted(await stateNewModel(dir, peer, 'peer'), 'model');
    for (const folder of [claimFolder, 'models/core/parts/p/claims/safe', 'models/peer/parts/p/claims/safe']) {
      await addSlot(dir, folder + '/encoding.md', reason);
    }
    assert.ok(stateItem(dir, 'express:p/claims/safe'));
    expectRefused(await stateNewModel(dir, await modelFiles('alloy', 'small'), 'small'));
  });

  for (const coveredBy of ['a property on a covering lifecycle model', 'an accepted risk']) {
    // models.md §one-model-first to §owed; account.md §items: the alternate-engine split exception
    // needs an express debt now, which either a property or risk acceptance removes.
    test(`models.md §one-model-first: a smaller model on another engine is refused when ${coveredBy} removes the express debt`, engineOnly, async () => {
      const dir = await baseProject({ files: await stateTwoPartFiles() });
      expectAccepted(await answer(dir, 'cover:p+q', await stateFullModel()), 'model');
      await addSlot(dir, claimFolder + '/encoding.md', coveredBy === 'an accepted risk' ? reason : forbidden);
      await addSlot(dir, 'models/core/parts/p/claims/safe/encoding.md', reason);
      if (coveredBy === 'an accepted risk') {
        assert.ok(stateItem(dir, 'express:p/claims/safe'));
        await decide(dir, 'accept', 'p/claims/safe',
          ['--choice', 'accept', '--words', 'Accept the unexpressed stability risk.']);
      }
      stateNoItem(dir, 'express:p/claims/safe');
      expectRefused(await stateNewModel(dir, await modelFiles('alloy', 'small'), 'small'));
    });
  }

});

describe('models.md §parts-change Removing a dropped part’s slots', () => {
  // models.md §parts-change; models.md §one-model-first.
  test('models.md §parts-change: an authorized part drop removes that part’s slots and their receipt lines', engineOnly, async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    const { files, question } = await stateUnansweredModel(dir);
    const path = 'models/core/parts/p/claims/safe/encoding.md';
    await addSlot(dir, path, reason);
    const retained = { ...files };
    retained['models/core/model.md'] = retained['models/core/model.md']
      .replace('| Parts | p, q |', '| Parts | q |')
      .replace('| p/step | Step | none |\n', '')
      .replace('| p/life | e \\in Things | Phase(e) |\n', '');
    expectAccepted(await answer(dir, 'unanswered:' + question, retained), 'model');
    assert.equal(await read(dir, path), null);
    assert.equal(await read(dir, 'models/core/parts/p/claims/safe/receipt'), null);
    assert.notEqual(await read(dir, stateClaimPath), null);
  });
});

describe('models.md §owed What is owed', () => {
  // models.md §owed; account.md §items, §commands.
  test('models.md §owed: before a native model exists the cover item names every part despite lifecycle coverage', async () => {
    const dir = await baseProject({ files: await stateTwoPartFiles() });
    const items = missing(dir).filter((item) => item.item.startsWith('cover:'));
    assert.deepEqual(items.map((item) => item.item), ['cover:p+q']);
    assert.deepEqual(items[0].supply, [{ by: 'agent', answer: 'model' }]);
  });

  // models.md §owed; account.md §items, §commands; decisions.md §accept.
  test('models.md §owed: a reason on every covering model owes another engine until the developer accepts the claim risk', async () => {
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', reason);
    const item = stateItem(dir, 'express:p/claims/safe');
    assert.ok(item);
    assert.deepEqual(item.supply, [
      { by: 'agent', answer: 'model' },
      { by: 'developer', decision: 'accept', checkpoint: 'carry or allow' },
    ]);
    await decide(dir, 'accept', 'p/claims/safe',
      ['--choice', 'accept', '--words', 'Accept the unexpressed stability risk.']);
    stateNoItem(dir, 'express:p/claims/safe');
    await decide(dir, 'accept', 'p/claims/safe', ['--choice', 'withdraw']);
    assert.ok(stateItem(dir, 'express:p/claims/safe'));
  });

  // models.md §owed; account.md §items.
  test('models.md §owed: one property on a covering model prevents an another-engine debt', engineOnly, async () => {
    const dir = await baseProject();
    await addSlot(dir, claimFolder + '/encoding.md', reason);
    await addModel(dir, 'tlc', 'core', 'express:p/claims/safe');
    await addSlot(dir, 'models/core/parts/p/claims/safe/encoding.tla', 'Invariant == phase # "missing"\n');
    stateNoItem(dir, 'express:p/claims/safe');
  });
});

// evidence.md §questions, engines.md §tlc, evidence.md §outcomes: with no lifecycle there is no phases question.
// Enabled succeeds initially and the one-step path reaches done; only a base
// search continues to the state outside TypeOK, so journey gating is satisfied.
async function evidenceBaseSurprise(engine, typeViolation = false) {
  const dir = await baseProject();
  const files = await modelFiles(engine);
  if (typeViolation) {
    expectAccepted(await stateRestate(dir, {
      [stateFrontPath]: (await read(dir, stateFrontPath)).replace('1. [Thing state](lifecycles/life/)\n', ''),
    }, ['design/parts/p/lifecycles/life']), 'restate');
    files['models/core/model.md'] = files['models/core/model.md'].replace('| p/life | e \\in Things | Phase(e) |\n', '');
    files['models/core/Core.tla'] = files['models/core/Core.tla'].replace(
      'Step == phase\' = "done"', 'Step == phase\' = IF phase = "idle" THEN "done" ELSE "outside"');
  }
  expectAccepted(await answer(dir, 'cover:p', files), 'model');
  await addSlot(dir, 'models/core/parts/p/journeys/finish/schedule.md', mtSchedule(engine));
  await addSlot(dir, 'models/core/parts/p/claims/safe/encoding.' + (engine === 'tlc' ? 'tla' : 'als'),
    engine === 'tlc' ? (typeViolation ? 'Invariant == TRUE\n' : 'Invariant == phase # "idle"\n')
      : 'assert Claim { always Thing.phase = done }\n');
  const names = await stateRunSurprises(dir);
  const name = names.find((value) => value.startsWith('core/parts/p/claims/safe/base.'));
  assert.ok(name);
  const surprise = JSON.parse(await read(dir, 'models/' + name + '.json'));
  assert.deepEqual(surprise.found, { outcome: 'violation', property: typeViolation ? 'TypeOK' : engine === 'tlc' ? 'Invariant' : 'Claim' });
  return { dir, name };
}

async function evidenceExplainBase(dir, name, engine, weaker) {
  // evidence.md §basis, §own-check, §explain; door.md §forma-answer: the basis digest is canonical JSON
  // plus LF, and this session authored none of the model or lifecycle pages.
  const surprise = JSON.parse(await read(dir, 'models/' + name + '.json'));
  const basis = sha256(JSON.stringify(surprise.basis, null, 2) + '\n').slice(0, 12);
  const files = {
    'explain.md': '| Field | Value |\n| --- | --- |\n| Question | ' + surprise.question + ' |\n' +
      '| Basis | ' + basis + ' |\n| Verdict | model wrong |\n| Level | implementation |\n' +
      '| Weaker | ' + (weaker ? 'relaxed' : 'none') + ' |\n\n' +
      '## Trace\n\nThe thing does not remain within the permitted completion states.\n\n' +
      '## Failure shape\n\nCompletion stability does not hold throughout the execution.\n\n' +
      '## Mechanism\n\nThe model admits a state that the stated invariant excludes.\n',
  };
  if (weaker) files['weaker/relaxed.' + (engine === 'tlc' ? 'tla' : 'als')] =
    engine === 'tlc' ? 'Invariant == TRUE\n' : 'assert Claim { always Thing.phase in Phase }\n';
  const folder = await answerFolder(files);
  return forma(dir, ['answer', 'explain:' + name, folder,
    '--provider', 'contract', '--model', 'explainer', '--session', 'models-evidence-explainer', '--json']);
}

describe('engines.md §slot-forms / evidence.md §explain Weaker forms follow the property violated', () => {
  for (const weaker of [false, true]) {
    // evidence.md §weaker, §explain check 3: a type invariant is not the encoding's
    // property, so an explanation is accepted with no weaker forms and refused
    // if it gives any. models.md §slot-answer fixes the valid weaker encoding text.
    test(`engines.md §slot-forms / evidence.md §explain: a TLC type-invariant base surprise ${weaker ? 'refuses weaker forms' : 'accepts an explanation without weaker forms'}`, engineOnly, async () => {
      const { dir, name } = await evidenceBaseSurprise('tlc', true);
      const result = await evidenceExplainBase(dir, name, 'tlc', weaker);
      if (weaker) expectRefused(result);
      else expectAccepted(result, 'explain');
    });
  }

  for (const engine of ['tlc', 'alloy']) {
    for (const weaker of [false, true]) {
      // evidence.md §weaker, §explain check 3: an encoding-property base violation
      // requires at least one valid weaker form, even though a type violation does not.
      test(`engines.md §slot-forms / evidence.md §explain: a ${engine} encoding-property base surprise ${weaker ? 'accepts a weaker form' : 'refuses an explanation without weaker forms'}`, engineOnly, async () => {
        const { dir, name } = await evidenceBaseSurprise(engine);
        const result = await evidenceExplainBase(dir, name, engine, weaker);
        if (weaker) expectAccepted(result, 'explain');
        else expectRefused(result);
      });
    }
  }
});

async function evidenceChoiceModel(engine, use) {
  // forms.md §lifecycles to §journeys, §choices, design.md §code-journeys: the unpicked alternative adds an extra first
  // step, so these alternatives do not differ at one step and add no contrary
  // journey. Extra is unaffected by the lifecycle and needs no posed cells.
  const base = await loadCase('base');
  const choice = (await loadCase('choice'))['design/parts/p/choices/pick/README.md'];
  const alternative = '| 1 | The service | extra | - | - | - |\n' +
    '| 2 | The service | step | - | - | - |';
  const files = {
    'design/parts/p/actions.md': base['design/parts/p/actions.md'] +
      '| extra | actor | Request completion in two stages. | none | none | stated | design/brief/system.md#system |\n',
    [stateLifePath]: base[stateLifePath].replace('| Unaffected | none |', '| Unaffected | extra |'),
    [stateFrontPath]: base[stateFrontPath] + '4. [Request choice](choices/pick/)\n',
    'design/parts/p/choices/pick/README.md': choice.replace(
      '| 1 | The service | step | An explicit completion request | - | - |', alternative),
  };
  if (use === 'another journey') {
    files['design/parts/p/journeys/extra/README.md'] = base['design/parts/p/journeys/finish/README.md']
      .replace('# Completion', '# Two-stage completion').replace('| 1 | The service | step | - | - | - |', alternative);
    files[stateFrontPath] += '5. [Two-stage completion](journeys/extra/)\n';
  }
  if (use === 'another alternative') {
    files['design/parts/p/choices/other/README.md'] = files['design/parts/p/choices/pick/README.md']
      .replace('Which request wording should completion use?', 'Should another request use two stages?');
    files[stateFrontPath] += '5. [Other choice](choices/other/)\n';
  }
  const dir = await baseProject({ files });
  if (use !== 'no pick') await decide(dir, 'pick', 'p/choices/pick', ['--choice', use === 'picked alternative' ? 'b' : 'a']);
  if (use === 'another journey') await decide(dir, 'confirm', 'p/journeys/extra');
  const model = await modelFiles(engine);
  model['models/core/model.md'] = model['models/core/model.md'].replace('| p/step | Step | none |',
    '| p/step | Step | none |\n| p/extra | Extra | none |');
  if (engine === 'tlc') model['models/core/Core.tla'] = model['models/core/Core.tla'].replace(
    'Phase(e) == phase', 'Phase(e) == phase\nExtra == phase\' = phase');
  else model['models/core/core.als'] += '\npred Extra { Thing.phase\' = Thing.phase }\n';
  expectAccepted(await answer(dir, 'cover:p', model), 'model');
  return dir;
}

describe('engines.md §model-actions / evidence.md §questions Enabled questions for alternatives', () => {
  for (const engine of ['tlc', 'alloy']) {
    for (const use of ['only the unpicked alternative', 'no pick', 'picked alternative', 'another journey', 'another alternative']) {
      // evidence.md §questions, account.md §journey-rules to §items: only an exclusively unpicked
      // alternative exempts its action; actions used elsewhere remain owed.
      // evidence.md §bounds to §question-names gives the action question's exact name.
      test(`engines.md §model-actions / evidence.md §questions: ${engine} ${use === 'only the unpicked alternative' ? 'owes no enabled question for an action used by only the unpicked alternative' : 'owes the enabled question with ' + use}`, engineOnly, async () => {
        const dir = await evidenceChoiceModel(engine, use);
        const bound = engine === 'tlc' ? 'constant Things = {thing}\n' : 'scope = 3 but exactly 1 Thing\n';
        const digest = sha256(bound).slice(0, 12);
        const items = missing(dir).map((item) => item.item);
        assert.ok(items.includes('run:core/actions/p/step.' + digest));
        assert.equal(items.includes('run:core/actions/p/extra.' + digest), use !== 'only the unpicked alternative');
      });
    }
  }
});

describe('engines.md §bounds / forms.md §premise-says Native bound premises', () => {
  for (const engine of ['tlc', 'alloy']) {
    // forms.md §premise-says; presentation.md §reading to account.md §box: native bounds have these fields
    // in the reading and box; the carry supplies their falsifier.
    test(`engines.md §bounds / forms.md §premise-says: ${engine} bound premises show their class statement falsifier and provider`, engineOnly, async () => {
      const dir = await baseProject();
      await addModel(dir, engine);
      await addSlot(dir, 'models/core/parts/p/claims/safe/encoding.' + (engine === 'tlc' ? 'tla' : 'als'),
        engine === 'tlc' ? 'Invariant == TRUE\n' : 'assert Claim { always Thing.phase in Phase }\n');
      const premiseName = 'bound:core/p/safe';
      const bounds = engine === 'tlc' ? 'constant Things = {thing}' : 'scope = 3 but exactly 1 Thing';
      const statement = 'Beyond its bounds on core (' + bounds + '): A completed thing never returns to idle.';
      const premise = ok(forma(dir, ['account', 'p', '--json'])).parts
        .find((part) => part.ref === 'p').assumed.find((row) => row.premise === premiseName);
      assert.ok(premise);
      assert.equal(premise.statement, statement);
      assert.equal(premise.class, 'bound');
      assert.equal(premise.falsifier, '-');
      const before = forma(dir, ['account', 'p']);
      assert.equal(before.status, 0, before.stderr || before.stdout);
      const beforeText = before.stdout.replace(/\s+/g, ' ');
      assert.ok(beforeText.includes(statement));
      assert.ok(beforeText.includes("the developer's carry"));
      const falsifier = 'A larger population loses completed work.';
      await decide(dir, 'carry', premiseName, ['--choice', 'carry', '--basis', '-', '--words', falsifier]);
      // The contracts fix these words, but do not give a JSON provider field.
      for (const command of [['account', 'p'], ['box']]) {
        const reading = forma(dir, command);
        assert.equal(reading.status, 0, reading.stderr || reading.stdout);
        const text = reading.stdout.replace(/\s+/g, ' ');
        for (const words of [premiseName, 'bound', statement, falsifier, "the developer's carry"]) {
          assert.ok(text.includes(words));
        }
      }
    });
  }
});

describe('models.md §model-repair Native model repairs', () => {
for (const engine of ['tlc', 'alloy']) {
  test('models.md §freeze: a ' + engine + ' surprise holds all model files and discounts a new receipted engine file',
    engineOnly, async () => {
      // models.md §freeze and evidence.md §surprise-file: held includes all native model
      // files and this claim's slots, independent of what the question read.
      const dir = await baseProject();
      const files = await addModel(dir, engine);
      const folder = 'models/core/parts/p/claims/safe';
      const ext = engine === 'tlc' ? 'tla' : 'als';
      const encodingPath = folder + '/encoding.' + ext;
      await addSlot(dir, encodingPath, engine === 'tlc'
        ? 'Invariant == TRUE\n' : 'assert Claim { always Thing.phase in Phase }\n');
      const witnessPath = folder + '/witness-never.md';
      await addSlot(dir, witnessPath,
        '| Field | Value |\n| --- | --- |\n| Meaning | The impossible state is reached. |\n\n' +
        '~~~' + (engine === 'tlc' ? 'tla' : 'alloy') + '\n' +
        (engine === 'tlc' ? 'Target == FALSE\n' : 'pred Target { no Thing }\n') + '~~~\n',
        'slot:core/parts/p/claims/safe/witness');
      // evidence.md §questions asks native claim questions only after the model
      // conforms, which includes the confirmed journey's scheduled path.
      await addSlot(dir, 'models/core/parts/p/journeys/finish/schedule.md',
        mtSchedule(engine));
      const names = await stateRunSurprises(dir);
      const name = names.find((value) => value.startsWith('core/parts/p/claims/safe/witness-never.'));
      assert.ok(name);
      const raw = await read(dir, 'models/' + name + '.json');
      const surprise = JSON.parse(raw);
      const expected = [];
      for (const path of sorted([...Object.keys(files), encodingPath, witnessPath])) {
        expected.push({ path, sha256: sha256(await read(dir, path)) });
      }
      assert.deepEqual(surprise.held, expected);
      const extraPath = 'models/core/' + (engine === 'tlc' ? 'Extra.tla' : 'extra.als');
      const extra = engine === 'tlc'
        ? '---- MODULE Extra ----\nMarker == TRUE\n====\n'
        : 'module extra\npred Marker {}\n';
      await seedFiles(dir, { [extraPath]: extra });
      assert.ok(stateItem(dir, 'change:' + extraPath));
      assert.equal(await read(dir, 'models/' + name + '.json'), raw);
      // The entire Model answer is refused even when every held byte agrees.
      expectRefused(await answer(dir, 'change:' + extraPath, { ...files, [extraPath]: extra }));
      await stateRule(dir, name);
      stateNoItem(dir, 'change:' + extraPath);
    });

  test('models.md §model-repair: a real finding on a ' + engine + ' phases question accepts a repair without a claim fault',
    engineOnly, async () => {
      // models.md §model-repair: when no ruled surprise is on a claim,
      // no fault is required and asking the surprising question again tests it.
      // evidence.md §questions; decisions.md §rulings: phases is a
      // nonclaim question, and a real finding may target that model.
      const dir = await baseProject();
      const files = await modelFiles(engine);
      const changed = { ...files };
      if (engine === 'tlc') changed['models/core/Core.tla'] = changed['models/core/Core.tla']
        .replace('Phase(e) == phase', 'Phase(e) == "outside"');
      else changed['models/core/model.md'] = changed['models/core/model.md'].replace('| e.phase |', '| none |');
      expectAccepted(await answer(dir, 'cover:p', changed), 'model');
      const names = await stateRunSurprises(dir);
      const name = names.find((value) => value.startsWith('core/phases.'));
      assert.ok(name);
      const question = JSON.parse(await read(dir, 'models/' + name + '.json')).question;
      const item = await stateRule(dir, name, 'real finding');
      expectAccepted(await answer(dir, item, { 'repair.md': stateRepair, ...files }), 'repair');
      stateNoItem(dir, item);
      assert.ok(!(await tree(dir)).some((path) => path.startsWith('models/core/') && /\/fault-[^/]+\.md$/.test(path)));
      // evidence.md §currency, §forma-run: repaired model bytes owe
      // the same phases question again; its original bounds and expected stay.
      assert.ok(stateItem(dir, 'run:' + question));
      const rerun = ok(forma(dir, ['run', '--json']));
      assert.equal(rerun.ran.find((row) => row.name === question).found.outcome, 'no violation');
    });

  // models.md §model-repair; models.md §parts-change; door.md §forma-answer.
  test('models.md §model-repair: a ' + engine + ' repair checks its slots against its new model even when the old model is unusable',
    engineOnly, async () => {
      const dir = await baseProject();
      const files = await addModel(dir, engine);
      const ext = engine === 'tlc' ? 'tla' : 'als';
      const modelPath = engine === 'tlc' ? 'models/core/Core.tla' : 'models/core/core.als';
      const folder = 'models/core/parts/p/claims/safe';
      await addSlot(dir, folder + '/encoding.' + ext,
        engine === 'tlc' ? 'Invariant == TRUE\n' : 'assert Claim { always Thing.phase in Phase }\n');
      await addSlot(dir, folder + '/witness-never.md',
        '| Field | Value |\n| --- | --- |\n| Meaning | The impossible state is reached. |\n\n' +
        '~~~' + (engine === 'tlc' ? 'tla' : 'alloy') + '\n' +
        (engine === 'tlc' ? 'Target == FALSE\n' : 'pred Target { no Thing }\n') + '~~~\n',
        'slot:core/parts/p/claims/safe/witness');
      await addSlot(dir, 'models/core/parts/p/journeys/finish/schedule.md',
        mtSchedule(engine));
      const names = await stateRunSurprises(dir);
      const name = names.find((name) => name.startsWith('core/parts/p/claims/safe/witness-never.'));
      assert.ok(name);
      const item = await stateRule(dir, name);
      await seedFiles(dir, { [modelPath]: 'Broken accepted module after a merge.\n' });
      assert.ok(stateItem(dir, 'model:core'));
      files[modelPath] = engine === 'tlc'
        ? files[modelPath].replace('Phase(e) == phase', 'Phase(e) == phase\nMarker == TRUE')
        : files[modelPath] + '\npred Marker { some Thing }\n';
      const newWitness = '| Field | Value |\n| --- | --- |\n| Meaning | A marked state is reached. |\n\n' +
        '~~~' + (engine === 'tlc' ? 'tla' : 'alloy') + '\n' +
        (engine === 'tlc' ? 'Target == Marker\n' : 'pred Target { Marker }\n') + '~~~\n';
      expectAccepted(await answer(dir, item, {
        'repair.md': stateRepair, ...files, [folder + '/witness-never.md']: newWitness,
      }), 'repair');
      assert.equal(await read(dir, folder + '/witness-never.md'), newWitness);
      stateNoItem(dir, 'model:core');
    });
}
});


// engines.md §slot-forms, models.md §slot-answer checks 2,3,5: End belongs exactly to a positive
// schedule, has a Meaning, and is one closed native state-predicate definition.
describe('models.md §slot-answer schedule End checks', () => {
  for (const engine of ['tlc', 'alloy']) {
    const native = engine === 'tlc' ? 'End == phase = "done"' : 'pred End { Thing.phase = done }';
    const changes = [
      ['missing end', text => text.slice(0, text.indexOf('\n| Field |'))],
      ['missing Meaning', text => text.replace('| Meaning | The thing is done. |\n', '')],
      ['empty Meaning', text => text.replace('The thing is done.', '')],
      ['extra field', text => text.replace('| Meaning | The thing is done. |', '| Meaning | The thing is done. |\n| Other | Extra field. |')],
      ['missing definition', text => text.replace(native, '')],
      ['wrong definition name', text => text.replace(native, native.replace('End', 'Target'))],
      ['second definition', text => text.replace(native, native + (engine === 'tlc' ? '\nExtra == TRUE' : '\npred Extra {}'))],
      ['unknown name', text => text.replace(native, engine === 'tlc' ? 'End == Missing' : 'pred End { some Missing }')],
      ['import', text => text.replace(native, (engine === 'tlc' ? 'EXTENDS Naturals\n' : 'open util/boolean\n') + native)],
      ['parameter', text => text.replace(native, engine === 'tlc' ? 'End(e) == phase = "done"' : 'pred End[e: Thing] { e.phase = done }')],
    ];
    for (const [label, change] of changes) {
      test(`models.md §slot-answer: ${engine} refuses a schedule with ${label}`, engineOnly, async () => {
        const { dir } = await mtSetup(engine);
        const before = await snapshot(dir, { skip: ['work', 'runs'] });
        expectRefused(await answer(dir, 'slot:core/parts/p/journeys/finish/schedule', {
          [mtSchedulePath]: change(mtSchedule(engine)),
        }));
        // door.md §forma-answer: refusal takes in no part of an invalid slot.
        assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
      });
    }
    for (const withEnd of [false, true]) {
      test(`models.md §slot-answer: ${engine} must-not schedule ${withEnd ? 'refuses End' : 'accepts no End'}`, engineOnly, async () => {
        const pages = await loadCase('base');
        const path = 'design/parts/p/journeys/finish/README.md';
        const negative = pages[path].replace('| Polarity | should happen |', '| Polarity | must not |')
          .replace('| Expected end | The thing is done. |', '| Expected end | - |')
          .replace('| Refused step | - |', '| Refused step | 1 |');
        const { dir } = await mtSetup(engine, () => {}, { files: { [path]: negative } });
        const text = mtSchedule(engine);
        const result = await answer(dir, 'slot:core/parts/p/journeys/finish/schedule', {
          [mtSchedulePath]: withEnd ? text : text.slice(0, text.indexOf('\n| Field |')),
        });
        if (withEnd) expectRefused(result); else expectAccepted(result);
      });
    }
  }
  for (const [label, definition] of [
    ['action-level', 'End == phase\' = "done"'],
    ['temporal', 'End == <> (phase = "done")'],
    ['declared variable', 'VARIABLE extra\nEnd == extra = phase'],
    ['declared constant', 'CONSTANT extra\nEnd == phase = extra'],
  ]) {
    test(`models.md §slot-answer: TLC refuses ${label} End`, engineOnly, async () => {
      const { dir } = await mtSetup('tlc');
      expectRefused(await answer(dir, 'slot:core/parts/p/journeys/finish/schedule', {
        [mtSchedulePath]: mtSchedule().replace('End == phase = "done"', definition),
      }));
    });
  }
  test('models.md §slot-answer: TLC accepts a constant-level End predicate', engineOnly, async () => {
    const pages = await loadCase('base');
    const journey = 'design/parts/p/journeys/finish/README.md';
    const { dir } = await mtSetup('tlc', () => {}, { files: {
      [journey]: pages[journey].replace('The thing is done.', 'An impossible condition holds.'),
    } });
    // Check 5 accepts level zero as well as level one, independently of reachability.
    await addSlot(dir, mtSchedulePath, mtSchedule().replace('The thing is done.', 'An impossible condition holds.')
      .replace('End == phase = "done"', 'End == FALSE'));
  });
});
