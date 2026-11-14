import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  forma,
  project,
  read,
  sha256,
  snapshot,
  tempFolder,
  tree,
  writeFiles,
} from './helpers/forma.mjs';

const keys = (value) => Object.keys(value).sort();

function objectOutput(result) {
  // project.md §commands: --json prints exactly one JSON object.
  assert.ok(result.json !== null && typeof result.json === 'object' && !Array.isArray(result.json),
    `expected exactly one JSON object on stdout; got ${JSON.stringify(result.stdout)}`);
  return result.json;
}

function succeeded(result) {
  // project.md §commands: doing what was asked exits with status 0.
  assert.equal(result.status, 0, `Forma should succeed: ${result.stderr || result.stdout}`);
  return objectOutput(result);
}

// A successful control is essential for refusal tests: node's missing-cli error
// also exits 1 and leaves the project alone, but is not a contract refusal.
function readableProject(dir) {
  const value = succeeded(forma(dir, ['show', 'intake', '--json']));
  // decisions.md §forma-show, §kinds: intake may be shown,
  // and its JSON kind is intake, even before the intake has been recorded.
  assert.equal(value.kind, 'intake');
}

function reasonShape(reason) {
  // project.md §commands delegates check failures to door.md §forma-answer:
  // exactly these fields; check names a contract and section,
  // file/entry/field are names or null, and says is a sentence saying what failed.
  assert.deepEqual(keys(reason), ['check', 'entry', 'field', 'file', 'says']);
  assert.equal(typeof reason.check, 'string');
  assert.match(reason.check, /\.md §\S/);
  for (const key of ['file', 'entry', 'field']) {
    assert.ok(reason[key] === null || typeof reason[key] === 'string', `${key} is a string or null`);
  }
  assert.equal(typeof reason.says, 'string');
  assert.ok(reason.says.trim().length > 0);
}

// Early refusal envelopes: door.md §forma-give (give); door.md §forma-answer
// (answer); decisions.md §forma-show (show), decisions.md §forma-decide (decide);
// evidence.md §forma-run (run). account.md §commands and
// project.md §commands give no generic/account refusal keys.
const fixedRefusalCommands = new Set(['give', 'answer', 'show', 'decide', 'run']);

async function refusesWithoutWriting(dir, args, { observed = [dir] } = {}) {
  readableProject(dir);
  const before = await Promise.all(observed.map((folder) => snapshot(folder)));
  const result = forma(dir, args);
  // project.md §commands: each malformed invocation below
  // refuses, prints why, and writes nothing, including in the packet/answer.
  assert.equal(result.status, 1, 'a refusal has exit status 1');
  assert.ok(`${result.stdout}${result.stderr}`.trim().length > 0, 'a refusal prints why');
  if (args.includes('--json')) {
    const value = objectOutput(result);
    assert.ok(keys(value).length > 0 || result.stderr.trim().length > 0,
      'a refusal must explain why, without inventing an unspecified JSON envelope');
    if (fixedRefusalCommands.has(args[0])) {
      // The command-specific refusal schemas cited above fix this envelope;
      // project.md §commands requires at least one reason here.
      assert.deepEqual(keys(value), ['refused']);
      assert.ok(Array.isArray(value.refused) && value.refused.length > 0);
      value.refused.forEach(reasonShape);
    }
  }
  const after = await Promise.all(observed.map((folder) => snapshot(folder)));
  // project.md §commands: syntax refusals write nothing at all.
  assert.deepEqual(after, before, 'a syntax refusal writes nothing, including scratch files');
  return result;
}

const intakeArgs = [
  'decide', 'intake',
  '--situation', 'design new',
  '--words', 'Deployment is out of scope because another system manages it.',
  '--by', 'Developer',
  '--provider', 'local', '--model', 'manual', '--session', 'developer-session',
];

async function commandCase(name, dir) {
  if (name === 'give' || name === 'answer') {
    // design.md §passages fixes the passage's address; account.md §items
    // makes an uncovered passage an item supplied by a Restate answer.
    // decisions.md §intake sets the explicit answer allowance.
    await writeFiles(dir, { 'design/brief/brief.md': '# Purpose\n\nThe system stores a note.\n' });
    succeeded(forma(dir, [...intakeArgs, '--answers', '10', '--json']));
    const item = 'passage:design/brief/brief.md#purpose';
    const missing = succeeded(forma(dir, ['missing', '--json']));
    // account.md §items, §commands: this uncovered
    // passage must occur by name in missing.items before testing its parser.
    assert.ok(missing.items.some((entry) => entry.item === item), 'the parser test uses a genuinely missing item');
    const folder = await tempFolder(`forma-command-${name}-`);
    if (name === 'answer') {
      await writeFiles(folder, {
        'design/README.md': '# Notes project\n\n| Part | Purpose | Cites |\n| --- | --- | --- |\n'
          + '| notes | Stores a note. | design/brief/brief.md#purpose |\n\n1. [Notes](parts/notes/)\n',
        'design/parts/notes/README.md': '# Notes\n',
      });
    }
    return { args: [name, item, folder, ...(name === 'answer'
      ? ['--provider', 'local', '--model', 'writer', '--session', 'agent-session'] : [])], outside: [folder] };
  }
  if (name === 'diff') {
    const earlier = await project();
    return { args: ['diff', earlier], outside: [earlier] };
  }
  return { args: name === 'show' ? ['show', 'intake'] : name === 'decide' ? intakeArgs : [name] };
}

describe('project.md §commands: project selection, output and success', () => {
  test('project.md §commands: --project selects the folder and paths in its output are relative to it', async () => {
    const parent = await project(null, { 'project with spaces/sentinel.txt': 'leave this alone\n' });
    const dir = `${parent}/project with spaces`;
    const value = succeeded(forma(dir, [...intakeArgs, '--json']));
    // decisions.md §forma-decide: this intake records one decision, with
    // no redirect's page writes or ruling's removals, in this exact envelope.
    assert.deepEqual(keys(value), ['recorded', 'removed', 'written']);
    assert.equal(value.recorded.length, 1);
    assert.deepEqual(value.written, []);
    assert.deepEqual(value.removed, []);
    // decisions.md §filing files an intake in design/decisions/;
    // decisions.md §decision-file gives a .md filename. project.md §commands
    // makes these paths relative to the selected project, including with spaces.
    assert.match(value.recorded[0], /^design\/decisions\/[^/]+\.md$/);
    assert.ok(await read(dir, value.recorded[0]), 'the reported relative path exists in the selected project');
    // project.md §commands and decisions.md §forma-decide:
    // the command writes only its declared paths in the selected project.
    assert.equal(await read(dir, 'sentinel.txt'), 'leave this alone\n');
    assert.ok((await tree(parent)).every((path) => path.startsWith('project with spaces/')));
  });

  const outputs = [
    // account.md §commands: here/items and level-2 text headings.
    { name: 'missing', expected: ['here', 'items'], text: /^## /m },
    // presentation.md §reading: project reading keys and a level-1 heading.
    { name: 'account', expected: ['cannotKnow', 'here', 'models', 'parts', 'project', 'scope'], text: /^# /m },
    // account.md §box: this heading and claims/premises/cannotKnow.
    { name: 'box', expected: ['cannotKnow', 'claims', 'premises'], text: /^# What the software may be said to guarantee\r?\n/ },
    // decisions.md §forma-show: these keys, with no intake token.
    { name: 'show', expected: ['kind', 'on', 'pins', 'shown', 'takes'], text: /This decision takes:/ },
    // evidence.md §forma-run: the final run line and exact JSON keys.
    { name: 'run', expected: ['opened', 'ran', 'removed', 'runs', 'skipped'], text: /runs: 0 spent here, 0 left\s*$/ },
    // account.md §diff: five level-2 lists and the JSON keys.
    { name: 'diff', expected: ['cannotKnow', 'changedOutcome', 'closed', 'from', 'opened', 'stale', 'waiting'], text: /^## /m },
  ];

  for (const example of outputs) {
    test(`project.md §commands: ${example.name} succeeds with default text and exactly one --json object`, async () => {
      const dir = await project();
      const earlier = example.name === 'diff' ? await project() : null;
      const args = example.name === 'show' ? ['show', 'intake']
        : example.name === 'diff' ? ['diff', earlier] : [example.name];
      const value = succeeded(forma(dir, [...args, '--json']));
      // Each output schema is cited at its case above; the empty project has
      // no models, parts, claims or premises to list (presentation.md §reading to account.md §box).
      assert.deepEqual(keys(value), example.expected);
      if (example.name === 'show') {
        // decisions.md §kinds, §forma-show: kind/on are intake.
        assert.equal(value.kind, 'intake');
        assert.equal(value.on, 'intake');
      } else if (example.name === 'account') {
        assert.equal(value.scope, 'project');
        assert.deepEqual(value.models, []);
        assert.deepEqual(value.parts, []);
      } else if (example.name === 'box') {
        assert.deepEqual(value.claims, []);
        assert.deepEqual(value.premises, []);
      } else if (example.name === 'run') {
        // evidence.md §forma-run: before intake no
        // run is allowed; this empty project has nothing to run, open or remove.
        // That section also fixes its output counters and lists.
        assert.deepEqual(value, { ran: [], opened: [], removed: [], skipped: [], runs: { spent: 0, left: 0 } });
      }
      const text = forma(dir, args);
      // project.md §commands: default text and success status;
      // each case above cites the command-specific non-JSON text form.
      assert.equal(text.status, 0, text.stderr || text.stdout);
      assert.equal(text.json, null, 'text is the default output mode');
      assert.match(text.stdout, example.text);
    });
  }
});

describe('project.md §commands: malformed invocations refuse without writes', () => {
  // All cases in this section instantiate project.md §commands:
  // unknown command/option, duplicate/missing option value, or absent project
  // folder. refusesWithoutWriting cites the status, output and no-write rules.
  for (const json of [false, true]) {
    test(`project.md §commands: an unknown command refuses${json ? ' with --json' : ' as text'}`, async () => {
      const dir = await project();
      await refusesWithoutWriting(dir, ['not-a-forma-command', ...(json ? ['--json'] : [])]);
    });
  }

  for (const name of ['give', 'answer', 'run', 'show', 'decide', 'missing', 'account', 'box', 'diff']) {
    test(`project.md §commands: ${name} rejects an unknown option and writes nothing`, async () => {
      const dir = await project();
      const example = await commandCase(name, dir);
      await refusesWithoutWriting(dir, [...example.args, '--unknown-forma-option', '--json'],
        { observed: [dir, ...(example.outside ?? [])] });
    });

    test(`project.md §commands: ${name} rejects --json given twice and writes nothing`, async () => {
      const dir = await project();
      const example = await commandCase(name, dir);
      await refusesWithoutWriting(dir, [...example.args, '--json', '--json'],
        { observed: [dir, ...(example.outside ?? [])] });
    });
  }

  test('project.md §commands: an unknown option before the command refuses', async () => {
    const dir = await project();
    await refusesWithoutWriting(dir, ['--unknown-forma-option', 'missing', '--json']);
  });

  test('project.md §commands: --project given twice refuses even with the same folder', async () => {
    const dir = await project();
    // The harness supplies the first --project, before these arguments.
    await refusesWithoutWriting(dir, ['--project', dir, 'missing', '--json']);
  });

  for (const kind of ['absent', 'file']) {
    test(`project.md §commands: --project naming ${kind === 'absent' ? 'no existing folder' : 'a file'} refuses without writes`, async () => {
      const parent = await project(null, { 'ordinary-file.txt': 'not a folder\n' });
      readableProject(parent);
      const before = await snapshot(parent);
      const target = `${parent}/${kind === 'absent' ? 'absent-folder' : 'ordinary-file.txt'}`;
      const result = forma(target, ['show', 'intake', '--json']);
      // project.md §commands: a non-folder project refuses and
      // writes nothing. decisions.md §forma-show fixes show's envelope.
      assert.equal(result.status, 1);
      const value = objectOutput(result);
      assert.deepEqual(keys(value), ['refused']);
      assert.ok(Array.isArray(value.refused) && value.refused.length > 0);
      value.refused.forEach(reasonShape);
      assert.deepEqual(await snapshot(parent), before);
    });
  }

  const valuedOptions = [
    { command: 'answer', option: '--provider', value: 'local' },
    { command: 'answer', option: '--model', value: 'writer' },
    { command: 'answer', option: '--session', value: 'agent-session' },
    { command: 'decide', option: '--by', value: 'Developer' },
    { command: 'decide', option: '--situation', value: 'design new' },
  ];

  for (const example of valuedOptions) {
    for (const malformed of ['missing', 'duplicate']) {
      test(`project.md §commands: ${example.command} refuses ${example.option} ${malformed === 'missing' ? 'without its value' : 'given twice'}`, async () => {
        const dir = await project();
        const scenario = await commandCase(example.command, dir);
        let args;
        if (example.command === 'answer') {
          args = scenario.args.filter((token, index, all) => token !== example.option && all[index - 1] !== example.option);
        } else {
          args = intakeArgs.filter((token, index, all) => token !== example.option && all[index - 1] !== example.option);
        }
        args.push('--json');
        const value = example.value;
        args.push(example.option, ...(malformed === 'duplicate' ? [value, example.option, value] : []));
        await refusesWithoutWriting(dir, args, { observed: [dir, ...(scenario.outside ?? [])] });
      });
    }
  }

  test('project.md §commands: every independent parser failure is printed in the check reason form', async () => {
    const dir = await project();
    const result = await refusesWithoutWriting(dir,
      ['show', 'intake', '--json', '--json', '--unknown-forma-option']);
    // project.md §commands requires every reason; door.md §forma-answer
    // gives each failure's form. These are two parser failures.
    assert.ok(result.json.refused.length >= 2, 'duplicate and unknown options are both reported');
    result.json.refused.forEach(reasonShape);
  });
});

describe('project.md §commands: read commands obey the shared clock rule', () => {
  for (const name of ['missing', 'account', 'show', 'box', 'diff']) {
    test(`project.md §commands: ${name} still reads with a future tracked time and writes nothing`, async () => {
      const at = new Date(Date.now() + 3_600_000).toISOString();
      const session = { provider: 'local', model: 'writer', session: 'earlier-answer' };
      // door.md §receipts fixes receipt keys/order and the final LF;
      // door.md §clock counts the time in every receipt line that parses,
      // even when its named file has since been deleted.
      const receipt = `${JSON.stringify({ file: 'README.md', sha256: sha256('old page\n'), at,
        session, authors: [session] })}\n`;
      const dir = await project(null, { 'design/receipt': receipt });
      const earlier = await project();
      const before = await snapshot(dir);
      const args = name === 'show' ? ['show', 'intake'] : name === 'diff' ? ['diff', earlier] : [name];
      const result = forma(dir, [...args, '--json']);
      succeeded(result);
      // door.md §clock: reads still succeed and name the future time, without any write.
      assert.ok(`${result.stdout}${result.stderr}`.includes(at), 'the command says which tracked time is ahead');
      assert.deepEqual(await snapshot(dir), before, 'a read writes nothing');
    });
  }
});

describe('account.md §commands: read commands write nothing in the project', () => {
  for (const name of ['missing', 'account', 'box', 'diff']) {
    for (const mode of ['absent work folder', 'existing invalid work ignore file']) {
      test(`account.md §commands: ${name} writes nothing with ${mode}`, async () => {
        // The unreceipted front page supplies a real read check (door.md §read-checks).
        const dir = await project(null, {
          'design/README.md': '# Unreceipted project\n',
          ...(mode === 'existing invalid work ignore file' ? { 'work/.gitignore': 'wrong\n' } : {}),
        });
        const earlier = name === 'diff' ? await project() : null;
        const before = await snapshot(dir);
        const args = name === 'diff' ? ['diff', earlier] : [name];
        succeeded(forma(dir, [...args, '--json']));
        // account.md §commands, door.md §lock: a read writes nothing, so a missing or altered
        // work/.gitignore stays as it is until the next write there (door.md §copies).
        assert.deepEqual(await snapshot(dir), before);
      });
    }
  }
});

describe('decisions.md §forma-decide: required words must contain more than whitespace', () => {
  for (const example of [
    { name: 'spaces', words: '   ' },
    { name: 'tabs', words: '\t\t' },
    { name: 'line breaks', words: '\n\r\n' },
    { name: 'mixed whitespace', words: ' \t\r\n ' },
  ]) {
    test(`decisions.md §forma-decide: intake refuses required words containing only ${example.name}`, async () => {
      const dir = await project();
      readableProject(dir);
      const before = await snapshot(dir, { skip: ['work'] });
      const args = intakeArgs.map((token, index, all) => all[index - 1] === '--words' ? example.words : token);
      const result = forma(dir, [...args, '--json']);

      // decisions.md §kinds requires intake words; decisions.md §forma-decide
      // refuses words holding only whitespace with status 1 and this envelope.
      assert.equal(result.status, 1);
      const value = objectOutput(result);
      assert.deepEqual(keys(value), ['refused']);
      assert.ok(Array.isArray(value.refused) && value.refused.length > 0);
      value.refused.forEach(reasonShape);

      // decisions.md §forma-decide says recording nothing, not the
      // syntax rule's stronger writing nothing. This checks the record and
      // other non-work files, leaving work/ to the writer's lock.
      assert.deepEqual(await snapshot(dir, { skip: ['work'] }), before);
    });
  }
});
