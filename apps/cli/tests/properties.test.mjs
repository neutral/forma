import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerFolder, forma, hasToolchain, project, read, sha256, snapshot, tree, writeFiles,
} from './helpers/forma.mjs';

const CLAIM = 'p/claims/sticks';
const JOURNEY = 'p/journeys/complete';
const CLAIM_SLOTS = 'core/parts/p/claims/sticks';
const JOURNEY_SLOTS = 'core/parts/p/journeys/complete';
const ENCODING = `models/${CLAIM_SLOTS}/encoding.tla`;
// evidence.md §bounds to §question-names: the fixture has exactly one bound.
const BOUNDS = sha256('constant Tickets = {ticket}\n').slice(0, 12);
const BASE = `${CLAIM_SLOTS}/base.${BOUNDS}`;
const WITNESS = `${CLAIM_SLOTS}/witness-done.${BOUNDS}`;
const FAULT = `${CLAIM_SLOTS}/fault-reset.${BOUNDS}`;
const PATH = `${JOURNEY_SLOTS}/path.${BOUNDS}`;
const writer = ['--provider', 'fixture', '--model', 'writer', '--session', 'properties-author'];
const owner = ['--provider', 'fixture', '--model', 'developer', '--session', 'properties-owner'];
const jsonText = value => `${JSON.stringify(value, null, 2)}\n`;

function command(dir, args) {
  const result = forma(dir, [...args, '--json']);
  assert.equal(result.status, 0, `${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.json && typeof result.json === 'object' && !Array.isArray(result.json),
    'a successful CLI command must return one JSON object');
  return result.json;
}

function decide(dir, kind, on, options = []) {
  const shown = command(dir, ['show', kind, on]);
  assert.equal(typeof shown.token, 'string');
  return command(dir, ['decide', kind, on, '--shown', shown.token, ...options,
    '--by', 'Fixture developer', ...owner]);
}

async function answer(dir, item, files) {
  const accepted = command(dir, ['answer', item, await answerFolder(files), ...writer]);
  assert.equal(accepted.accepted, true, `${item} must be accepted`);
}

const missing = dir => command(dir, ['missing']).items;
function entry(dir, ref) {
  const reading = command(dir, ['account']);
  const found = reading.parts.flatMap(part => [...part.open, ...part.accepted, ...part.established])
    .find(entry => entry.ref === ref);
  assert.ok(found, `${ref} must remain in the account`);
  return found;
}

function coreStanding(dir, standing) {
  const value = entry(dir, CLAIM);
  assert.equal(value.standing, standing);
  const model = value.models.find(model => model.model === 'core');
  assert.ok(model, 'the claim must have a standing on the TLC model');
  assert.equal(model.standing, standing);
  return model;
}

async function evidence(dir, question) {
  const raw = await read(dir, `models/${question}.json`);
  assert.notEqual(raw, null, `forma run must write evidence for ${question}`);
  const value = JSON.parse(raw);
  assert.equal(value.name, question);
  assert.equal(raw, jsonText(value));
  assert.equal(value.digest, sha256(jsonText({ ...value, digest: '' })));
  return value;
}

// Only the machine-local allowance is omitted. Keep every other field and its
// order; compare serialized bytes, without sorting or dropping evidence/times.
function readings(dir) {
  return Object.fromEntries(['account', 'box', 'missing'].map(name => {
    const value = command(dir, [name]);
    delete value.here;
    return [name, jsonText(value)];
  }));
}

async function tracked(dir) {
  return {
    design: await snapshot(`${dir}/design`),
    models: await snapshot(`${dir}/models`),
  };
}

async function establishedProject() {
  // account.test.mjs's native fixture supplies a passing TLC property, a
  // reached witness, a caught fault, and a one-step journey with its schedule.
  // Accept through the CLI so receipts, slot pins and decisions are real.
  const pages = await snapshot(await project('account/lifecycle'));
  const native = await snapshot(await project('account/tlc'));
  const brief = 'design/brief/ticket.md';
  const dir = await project(null, { [brief]: pages[brief] });
  command(dir, ['decide', 'intake', '--situation', 'design new',
    '--words', 'Only ticket completion is examined; delivery is outside this example.',
    '--answers', '100', '--runs', '100', '--tlc-seconds', '30', '--tlc-megabytes', '512',
    '--alloy-seconds', '30', '--alloy-megabytes', '512', '--lifecycle-seconds', '30',
    '--cadence', 'question', '--inbox-cap', '100', '--by', 'Fixture developer', ...owner]);
  await answer(dir, `passage:${brief}#ticket`, Object.fromEntries(Object.entries(pages)
    .filter(([path]) => path.startsWith('design/') && !path.startsWith('design/brief/'))));
  for (const unit of ['parts', 'p/lifecycles/state', JOURNEY, CLAIM]) decide(dir, 'confirm', unit);
  await answer(dir, 'cover:p', {
    'models/core/model.md': native['models/core/model.md'],
    'models/core/Ticket.tla': native['models/core/Ticket.tla'],
  });
  for (const [slot, path] of [
    [`${CLAIM_SLOTS}/encoding`, ENCODING],
    [`${CLAIM_SLOTS}/witness`, `models/${CLAIM_SLOTS}/witness-done.md`],
    [`${CLAIM_SLOTS}/fault`, `models/${CLAIM_SLOTS}/fault-reset.md`],
    [`${JOURNEY_SLOTS}/schedule`, `models/${JOURNEY_SLOTS}/schedule.md`],
  ]) await answer(dir, `slot:${slot}`, { [path]: native[path] });
  decide(dir, 'carry', 'bound:core/p/sticks', ['--choice', 'carry', '--basis', '-',
    '--words', 'Another ticket or trace length changes the result.']);

  // Leave the lifecycle claim slots absent: only TLC can establish this claim,
  // so the hand-edit test cannot be masked by another establishing model.
  const run = command(dir, ['run']);
  assert.deepEqual(run.opened, [], 'the passing fixture must open no surprises');
  assert.deepEqual(run.skipped, [], 'the allowance and toolchain must permit every owed run');
  for (const [question, outcome] of [
    [BASE, 'no violation'], [WITNESS, 'reached'], [FAULT, 'violation'], [PATH, 'reached'],
  ]) {
    assert.ok(run.ran.some(row => row.name === question), `${question} must actually run`);
    const value = await evidence(dir, question);
    assert.equal(value.found.outcome, outcome);
    assert.equal(value.matches, true);
  }
  coreStanding(dir, 'established');
  assert.ok(command(dir, ['box']).claims.some(entry => entry.ref === CLAIM));
  const journey = entry(dir, JOURNEY);
  assert.equal(journey.models.find(model => model.model === 'core')?.conforms, true);
  const items = missing(dir);
  assert.ok(items.every(row => !/^(change:|run:|unanswered:)/.test(row.item)),
    'the first run must finish all owed runs with intact, answered evidence');
  for (const item of ['intake', `confirm:${JOURNEY}`, `slot:${JOURNEY_SLOTS}/schedule`,
    ...['encoding', 'witness', 'fault'].map(kind => `slot:${CLAIM_SLOTS}/${kind}`)]) {
    assert.ok(items.every(row => row.item !== item), `${item} must already be supplied`);
  }
  return dir;
}

describe('Properties of the whole project', () => {
  test('project.md §tree / account.md §what-it-is / evidence.md §runs / door.md §scratch: scratch is scratch',
    { skip: !hasToolchain }, async () => {
      const dir = await establishedProject();
      const before = readings(dir);
      const files = await tree(dir);
      assert.ok(files.some(path => path.startsWith('work/') && !path.endsWith('/.gitignore')));
      assert.ok(files.some(path => path.startsWith('runs/') && !path.endsWith('/.gitignore')));

      // The harness has no removal helper. As in evidence.test.mjs's
      // copyWithout, reconstruct the same project with both scratch trees
      // deleted from its snapshot; do not regenerate any tracked record.
      const clean = await project(null, await snapshot(dir, { skip: ['work', 'runs'] }));
      assert.ok((await tree(clean)).every(path => !/^(work|runs)\//.test(path)));
      const bytes = await tracked(dir);
      assert.deepEqual(await tracked(clean), bytes);
      const after = readings(clean);
      for (const name of Object.keys(before)) assert.equal(after[name], before[name], name);
      assert.deepEqual(await tracked(clean), bytes, 'reading after scratch loss changes no tracked byte');
    });

  test('project.md §tree / evidence.md §written: a rerun changes no tracked byte',
    { skip: !hasToolchain }, async () => {
      const dir = await establishedProject();
      const before = await tracked(dir);
      const rerun = command(dir, ['run']);
      assert.deepEqual(rerun.ran, [], 'nothing remains owed after the first run');
      assert.deepEqual(rerun.opened, []);
      assert.deepEqual(rerun.removed, []);
      assert.deepEqual(rerun.skipped, []);
      assert.deepEqual(await tracked(dir), before, 'every design/ and models/ file keeps its bytes');
    });

  test('door.md §read-checks to §change / account.md §what-it-is, §items: a hand edit is reported and blocks what rests on it',
    { skip: !hasToolchain }, async () => {
      const dir = await establishedProject();
      const before = readings(dir);
      const bytes = await tracked(dir);
      const original = await read(dir, ENCODING);
      const base = await read(dir, `models/${BASE}.json`);
      // Even a valid TLA+ comment invalidates the exact accepted bytes. Leave
      // the receipt and the previously passing evidence untouched.
      await writeFiles(dir, { [ENCODING]: `${original}\n\\* Unaccepted hand edit.\n` });
      const items = missing(dir);
      assert.ok(items.some(row => row.item === `change:${ENCODING}`));
      assert.ok(items.some(row => row.item === `slot:${CLAIM_SLOTS}/encoding` && row.why === 'unfilled'));
      const model = coreStanding(dir, 'not established');
      assert.ok(model.fails.some(failure => failure.condition === 'examined'));
      assert.ok(command(dir, ['box']).claims.every(entry => entry.ref !== CLAIM));
      const current = command(dir, ['account', CLAIM]).thing.evidence.find(row => row.question === BASE);
      assert.ok(current, 'the old evidence remains visible');
      assert.equal(current.current, false, 'an unaccepted encoding cannot use the old passing evidence');
      assert.equal(await read(dir, `models/${BASE}.json`), base);

      await writeFiles(dir, { [ENCODING]: original });
      assert.ok(missing(dir).every(row => row.item !== `change:${ENCODING}`
        && row.item !== `slot:${CLAIM_SLOTS}/encoding`));
      coreStanding(dir, 'established');
      assert.deepEqual(readings(dir), before, 'restoring accepted bytes restores the account without a run');
      assert.deepEqual(await tracked(dir), bytes);
    });

  test('evidence.md §own-check / door.md §change item 5: evidence mixed from two answers counts for nothing',
    { skip: !hasToolchain }, async () => {
      const dir = await establishedProject();
      const before = readings(dir);
      const path = `models/${BASE}.json`;
      const original = await read(dir, path);
      const base = await evidence(dir, BASE);
      const fault = await evidence(dir, FAULT);
      assert.notDeepEqual(base.found, fault.found, 'the two real engine runs answered differently');
      // Keep the base path, identity and digest while mixing in the fault
      // run's answer. Also exercise a digest-only corruption independently.
      for (const damaged of [
        { ...base, found: fault.found, measures: fault.measures },
        { ...base, digest: `${base.digest[0] === '0' ? '1' : '0'}${base.digest.slice(1)}` },
      ]) {
        assert.notEqual(damaged.digest, sha256(jsonText({ ...damaged, digest: '' })));
        await writeFiles(dir, { [path]: jsonText(damaged) });
        const items = missing(dir);
        assert.ok(items.some(row => row.item === `change:${path}`));
        const owed = items.find(row => row.item === `run:${BASE}`);
        assert.ok(owed, 'discarded evidence must owe the same question again');
        assert.equal(owed.why, 'none', 'corrupt evidence is absent, not merely stale');
        const model = coreStanding(dir, 'not established');
        assert.ok(model.fails.some(failure => failure.condition === 'examined'));
        assert.ok(command(dir, ['box']).claims.every(entry => entry.ref !== CLAIM));

        await writeFiles(dir, { [path]: original });
        assert.ok(missing(dir).every(row => row.item !== `change:${path}` && row.item !== `run:${BASE}`));
        coreStanding(dir, 'established');
        assert.deepEqual(readings(dir), before, 'restoring intact evidence needs no new run');
      }
    });
});
