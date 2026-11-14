import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { answerFolder, forma, project, read, sha256, tempFolder, writeFiles } from './helpers/forma.mjs';

const CITE = 'design/brief/overview.md#door';
const PART = 'design/parts/door';
const WRITER = { provider: 'agent', model: 'fixture', session: 'writer' };
const OWNER = ['--by', 'Fixture developer', '--provider', 'owner', '--model', 'manual', '--session', 'developer'];
const fieldTable = (rows) => '| Field | Value |\n| --- | --- |\n'
  + rows.map(([key, value]) => `| ${key} | ${value} |\n`).join('');
const table = (columns, rows) => `| ${columns.join(' | ')} |\n| ${columns.map(() => '---').join(' | ')} |\n`
  + rows.map((row) => `| ${row.join(' | ')} |\n`).join('');

// project.md §commands and account.md §commands: success is zero and --json gives
// one object. The status check makes an absent CLI the first failing assertion.
function success(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(result.json && typeof result.json === 'object' && !Array.isArray(result.json));
  return result.json;
}
const missing = (dir) => success(forma(dir, ['missing', '--json'])).items;
const account = (dir) => success(forma(dir, ['account', '--json']));
const contains = (value, text) => (JSON.stringify(value) ?? '').includes(text);

// forms.md §lifecycles fixes this page's fields and matrix, including entered-by.
function lifecycle(entity, actions, rows, { initial = 'open', ends = 'closed', unaffected = 'none' } = {}) {
  return `# ${entity} lifecycle\n\n` + fieldTable([
    ['Entity', entity], ['Initial', initial], ['Ends', ends], ['Unaffected', unaffected],
    ['Origin', 'stated'], ['Cites', CITE],
  ]) + '\n' + table(['Phase', ...actions], rows);
}

// forms.md §journeys fixes fields, optional start rows and numbered steps.
function journey(actions, { polarity = 'should happen', refused = '-', start = null } = {}) {
  return '# Door journey\n\n' + fieldTable([
    ['Polarity', polarity], ['Expected end', polarity === 'must not' ? '-' : 'The journey completes.'],
    ['Refused step', refused], ['Origin', 'stated'], ['Cites', CITE],
  ]) + (start ? '\n' + table(['Lifecycle', 'Entity', 'Phase'], start) : '')
    + '\n' + table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'],
      actions.map((action, index) => [index + 1, 'Door controller', action, '-', '-', '-']));
}

// forms.md §front-pages to §thing-pages: independently written minimal pages, with every action in
// every lifecycle's matrix or Unaffected and every listed page present.
function pages({ actions = ['close'], lifecycles = {}, journeys = {}, extra = {}, boundary = [] } = {}) {
  const entities = [...new Set(Object.values(lifecycles).map((page) => page.match(/^\| Entity \| ([^|]+) \|$/m)[1]))];
  const things = [
    ...Object.entries(lifecycles).map(([key, text]) => [`lifecycles/${key}`, text]),
    ...Object.entries(journeys).map(([key, text]) => [`journeys/${key}`, text]),
  ];
  return {
    'design/brief/overview.md': '# Door\n\nThe controller enters, closes and observes doors. A store uses serializable isolation.\n',
    'design/README.md': '# Door project\n\n' + table(['Part', 'Purpose', 'Cites'], [['door', 'Controls doors.', CITE]])
      + '\n1. [Door](parts/door/)\n',
    [`${PART}/README.md`]: '# Door\n\n' + things.map(([key], index) => `${index + 1}. [${key}](${key}/)\n`).join(''),
    [`${PART}/actions.md`]: '# Actions\n\n' + table(['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'],
      actions.map((action) => [action, 'operator', `Performs ${action}.`, 'none', 'none', 'stated', CITE])),
    [`${PART}/boundary.md`]: '# Boundary\n\n## Boundary\n\n'
      + table(['Row', 'Names', 'Kind', 'Side', 'Seam', 'Isolation', 'Reads', 'Writes', 'Origin', 'Cites'], [
        ['operator', 'Door controller', 'service', 'machine', '-', '-', '-', '-', 'stated', CITE],
        ...entities.map((entity) => [entity, `${entity} entity`, 'entity', 'machine', '-', '-', 'none', 'operator', 'stated', CITE]),
        ...boundary,
      ]),
    ...Object.fromEntries(things.map(([key, text]) => [`${PART}/${key}/README.md`, text])),
    ...extra,
  };
}

// door.md §receipts: each accepted design page has an exact-byte SHA-256 receipt in
// its own folder, with JSON.stringify's one-line form and a final LF. The
// fixtures model an already accepted record; no implementation pins are copied.
async function prepared(files, { intake = false } = {}) {
  const receipts = new Map();
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.startsWith('design/') || path.startsWith('design/brief/')) continue;
    const slash = path.lastIndexOf('/');
    const receipt = `${path.slice(0, slash)}/receipt`;
    const lines = receipts.get(receipt) ?? [];
    lines.push(JSON.stringify({ file: path.slice(slash + 1), sha256: sha256(bytes),
      at: '2024-01-01T00:00:00.000Z', session: WRITER, authors: [WRITER] }));
    receipts.set(receipt, lines);
  }
  const dir = await project(null, { ...files,
    ...Object.fromEntries([...receipts].map(([path, lines]) => [path, `${lines.sort().join('\n')}\n`])),
    // door.md §copies fixes the project record's attribute bytes.
    'design/.gitattributes': '* -text -ident -filter -working-tree-encoding\nreceipt merge=union\nbrief/** !text !ident !filter !working-tree-encoding !merge\n',
  });
  if (intake) {
    // decisions.md §intake, §forma-decide: explicit allowances permit these answers and runs.
    success(forma(dir, ['decide', 'intake', '--situation', 'design new', '--words', 'Only door behaviour is in scope.',
      '--answers', '50', '--runs', '50', '--lifecycle-seconds', '30', ...OWNER, '--json']));
  }
  return dir;
}

// decisions.md §forma-show to §forma-decide: show supplies the token, and decide returns recorded
// project-relative paths. The developer session is distinct from the writer's.
function decide(dir, kind, on, options = []) {
  const shown = success(forma(dir, ['show', kind, on, '--json']));
  return success(forma(dir, ['decide', kind, on, '--shown', shown.token, ...options, ...OWNER, '--json']));
}
async function answer(dir, item, files) {
  const folder = await answerFolder(files);
  const result = success(forma(dir, ['answer', item, folder, '--provider', WRITER.provider,
    '--model', WRITER.model, '--session', WRITER.session, '--json']));
  // door.md §forma-answer fixes successful acceptance and its reasons.
  assert.equal(result.accepted, true);
  assert.deepEqual(result.reasons, []);
  return result;
}
function findings(dir) {
  // account.md §items, §commands fixes found's content, but no nested representation.
  return missing(dir).find((entry) => entry.item === 'findings:door')?.found;
}

function posedChoice(life = 'state', phase = 'open', action = 'close', outcomes = ['closed', 'open']) {
  return '# Closing choice\n\n' + fieldTable([
    ['Question', 'What does closing do?'], ['Recommendation', 'a: Move to the next phase.'], ['Cites', CITE],
  ]) + ['a', 'b'].map((key, index) => `\n## ${key}\n\n` + fieldTable([
    ['Polarity', 'should happen'], ['Expected end', `The entity reaches ${outcomes[index]}.`], ['Refused step', '-'],
  ]) + '\n' + table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'],
    [[1, 'Door controller', action, '-', '-', '-']])
    + '\n' + table(['Lifecycle', 'Phase', 'Action', 'Outcome'], [[life, phase, action, outcomes[index]]])).join('');
}

function claim(sentence = 'The door stays open.') {
  // forms.md §claims: this safety claim has no unstated premise or extra parts.
  return '# Door safety\n\n' + fieldTable([
    ['Sentence', sentence], ['Kind', 'safety'], ['Stake', 'Door behaviour must match the design.'],
    ['Rests on', 'none'], ['Parts', 'door'], ['Origin', 'stated'], ['Cites', CITE],
  ]);
}

async function confirmModel(dir, journeyKey) {
  // decisions.md §confirm, §forma-show: confirm parts before units; models.md §lifecycle-model: a confirmed
  // lifecycle creates the lifecycle model without a model file or toolchain.
  decide(dir, 'confirm', 'parts');
  decide(dir, 'confirm', 'door/lifecycles/state');
  if (journeyKey) decide(dir, 'confirm', `door/journeys/${journeyKey}`);
}

describe('door.md §read-checks: the lifecycle tool reads the current design', () => {
  for (const unknown of ['empty', 'posed']) {
    test(`lifecycle-tool.md §stepping: refusal takes precedence over another lifecycle's ${unknown} cell`, async () => {
      const files = pages({ lifecycles: {
        'a-unknown': lifecycle('uncertain', ['close'], [['open', unknown === 'empty' ? '' : 'choice:close-rule'], ['closed', 'None.']]),
        'z-refuser': lifecycle('blocker', ['close'], [['open', 'None.']], { ends: 'open' }),
      }, journeys: { close: journey(['close']) }, extra: unknown === 'posed'
        ? { [`${PART}/choices/close-rule/README.md`]: posedChoice('a-unknown') } : {} });
      // account.md §items: findings are listed only after the intake.
      const dir = await prepared(files, { intake: true });
      const found = findings(dir);
      // lifecycle-tool.md §stepping, §findings: a refusal ends the step before unknown cells
      // can cause unchecked; the empty/posed lifecycle may have its own finding.
      assert.ok(contains(found, 'step-refused'));
      assert.ok(!contains(found, 'unchecked'));
    });
  }

  for (const scenario of ['absent', 'entered', 'start row']) {
    test(`lifecycle-tool.md §stepping: an entered-by entity is ${scenario === 'start row' ? 'present from a start row' : scenario} when another action is attempted`, async () => {
      // account.md §items: findings are listed only after the intake.
      const dir = await prepared(pages({ actions: ['enter', 'close'], lifecycles: {
        state: lifecycle('door', ['enter', 'close'], [['open', 'None.', 'closed'], ['closed', 'None.', 'None.']],
          { initial: 'open, entered by enter' }),
      }, journeys: { close: journey(scenario === 'entered' ? ['enter', 'close'] : ['close'],
        scenario === 'start row' ? { start: [['state', 'the-door', 'open']] } : {}) } }), { intake: true });
      const found = findings(dir);
      // lifecycle-tool.md §stepping, §findings: without entry or a start row, close refuses;
      // either explicit entry or a listed starting entity makes close admitted.
      if (scenario === 'absent') {
        assert.ok(contains(found, 'step-refused'));
      } else {
        assert.equal(found, undefined);
      }
    });
  }

  test('lifecycle-tool.md §findings: entering an entity already held reports creates-existing-entity', async () => {
    // account.md §items: findings are listed only after the intake.
    const dir = await prepared(pages({ actions: ['enter', 'close'], lifecycles: {
      state: lifecycle('door', ['enter', 'close'], [['open', 'None.', 'closed'], ['closed', 'None.', 'None.']],
        { initial: 'open, entered by enter' }),
    }, journeys: { twice: journey(['enter', 'enter']) } }), { intake: true });
    const found = findings(dir);
    // lifecycle-tool.md §stepping, §findings: re-entering is the tool's explicit journey finding.
    assert.ok(contains(found, 'creates-existing-entity'));
  });

  test('lifecycle-tool.md §shortest: a shortest offered journey enters an initially absent entity before moving it', async () => {
    const dir = await prepared(pages({ actions: ['enter', 'close'], lifecycles: {
      state: lifecycle('door', ['enter', 'close'], [['open', 'None.', 'closed'], ['closed', 'None.', 'None.']],
        { initial: 'open, entered by enter' }),
    } }), { intake: true });
    decide(dir, 'confirm', 'parts');
    decide(dir, 'confirm', 'door/lifecycles/state');
    const offered = 'door/journeys/reach-state--closed';
    // design.md §code-journeys and account.md §items: the reachable noninitial phase is offered.
    assert.ok(missing(dir).some((entry) => entry.item === `confirm:${offered}`));
    const recorded = decide(dir, 'confirm', offered);
    const bytes = await read(dir, recorded.recorded[0]);
    // decisions.md §confirm fixes a journey page in ## Journey. Read the mandated
    // table's cells without imposing Markdown spacing or other open formatting.
    const rows = bytes.split('\n').filter((line) => /^\|\s*\d+\s*\|/.test(line))
      .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
    assert.deepEqual(rows.map((row) => row[2]), ['enter', 'close']);
    assert.deepEqual(rows.map((row) => row[0]), ['1', '2']);
  });

  for (const width of [500, 501]) {
    test(`lifecycle-tool.md §shortest: ${500 * width} reachable phase combinations ${width === 500 ? 'fit' : 'exceed'} the 250000 limit`, async () => {
      // lifecycle-tool.md §shortest: reaching every phase of this linear chain requires
      // exactly count combinations, including the start. The right self-loop
      // adds none, so the search cannot stop before the last left phase.
      const count = 500 * width;
      const dir = await prepared(pages({ actions: ['left', 'right'], lifecycles: {
        left: lifecycle('left', ['left'],
          Array.from({ length: count }, (_, index) => [`p${index}`, index + 1 < count ? `p${index + 1}` : 'None.']),
          { initial: 'p0', ends: `p${count - 1}`, unaffected: 'right' }),
        right: lifecycle('right', ['right'], [['p0', 'p0']],
          { initial: 'p0', ends: 'none', unaffected: 'left' }),
      } }));
      const part = account(dir).parts.find((entry) => entry.ref === 'door');
      // lifecycle-tool.md §shortest to §findings and presentation.md §reading: exactly the boundary fits;
      // beyond it every lifecycle has unchecked facts naming the limit.
      for (const key of ['left', 'right']) {
        const life = part.lifecycles.find((entry) => entry.ref === `door/lifecycles/${key}`);
        assert.ok(life);
        assert.equal(contains(life.facts, 'unchecked'), width === 501);
        if (width === 501) assert.match(JSON.stringify(life.facts), /250,?000/);
      }
    });
  }

  test('lifecycle-tool.md §findings: an unresolved citation alone owes passage work without unchecked', async () => {
    const original = pages({ lifecycles: { state: lifecycle('door', ['close'], [['open', 'closed'], ['closed', 'None.']]) },
      journeys: { close: journey(['close']) } });
    // account.md §items: passage work is listed only after the intake.
    const dir = await prepared(original, { intake: true });
    // design.md §passages, §at-read: a heading rename leaves parseable pages and resolves
    // no old address, while the lifecycle's action/entity references still hold.
    await writeFiles(dir, { 'design/brief/overview.md': original['design/brief/overview.md'].replace('# Door', '# Renamed door') });
    const items = missing(dir);
    assert.ok(items.some((entry) => entry.item === `passage:${CITE}`));
    assert.ok(!items.some((entry) => entry.item.startsWith('change:')));
    assert.ok(!contains(items.find((entry) => entry.item === 'findings:door')?.found, 'unchecked'));
    const part = account(dir).parts.find((entry) => entry.ref === 'door');
    assert.ok(part.lifecycles.every((life) => !contains(life.facts, 'unchecked')));
  });
});

describe('door.md §read-checks: lifecycle evidence feeds the account', () => {
  test('account.md §items: a posed-cell engine flag owes its pick and no flagged restatement', async () => {
    const life = lifecycle('door', ['close', 'wait'], [['open', 'choice:close-rule', 'open'], ['closed', 'None.', 'closed']]);
    const dir = await prepared(pages({ actions: ['close', 'wait'], lifecycles: { state: life },
      journeys: { wait: journey(['wait']) }, extra: {
        [`${PART}/choices/close-rule/README.md`]: posedChoice(),
        [`${PART}/claims/safe/README.md`]: claim(),
      } }), { intake: true });
    await confirmModel(dir, 'wait');
    const slot = 'models/lifecycles-door/parts/door/claims/safe/encoding.md';
    await answer(dir, 'slot:lifecycles-door/parts/door/claims/safe/encoding', {
      // models.md §slots: closed has no close move, so this forbidden transition
      // is absent even though the posed cell may reach either phase.
      [slot]: table(['Lifecycle', 'From', 'Action', 'To'], [['state', 'closed', 'close', 'open']]),
    });
    success(forma(dir, ['run', '--json']));
    const evidence = JSON.parse(await read(dir, 'models/lifecycles-door/parts/door/claims/safe/base.json'));
    // engines.md §lifecycle-engine, evidence.md §flags: the abstraction visits the posed cell and flags it.
    assert.equal(evidence.found.outcome, 'no violation');
    assert.ok(evidence.flags.includes('open-pair state/open/close'));
    const items = missing(dir);
    assert.ok(items.some((entry) => entry.item === 'pick:door/choices/close-rule'));
    assert.ok(!items.some((entry) => entry.item === 'restate:door'));
  });

  test('engines.md §lifecycle-engine: an entered-by action cannot reset an already present entity', async () => {
    const dir = await prepared(pages({ actions: ['enter', 'close'], lifecycles: {
      state: lifecycle('door', ['enter', 'close'], [['open', 'open', 'closed'], ['closed', 'open', 'closed']],
        { initial: 'open, entered by enter', ends: 'none' }),
    }, journeys: { close: journey(['enter', 'close']) }, extra: {
      [`${PART}/claims/safe/README.md`]: claim('Entering never resets a present door.'),
    } }), { intake: true });
    await confirmModel(dir, 'close');
    await answer(dir, 'slot:lifecycles-door/parts/door/claims/safe/encoding', {
      'models/lifecycles-door/parts/door/claims/safe/encoding.md':
        table(['Lifecycle', 'From', 'Action', 'To'], [['state', 'closed', 'enter', 'open']]),
    });
    success(forma(dir, ['run', '--json']));
    const evidence = JSON.parse(await read(dir, 'models/lifecycles-door/parts/door/claims/safe/base.json'));
    // evidence.md §questions, engines.md §lifecycle-engine, evidence.md §keys: the explicit enter cell cannot override the
    // engine's refusal while present, so the forbidden reset never occurs.
    assert.equal(evidence.found.outcome, 'no violation');
    assert.equal(evidence.matches, true);
  });
});

describe('forms.md §premise-says: code-added premises retain their meaning in the reading and box', () => {
  for (const kind of ['store', 'choice', 'strike', 'span', 'bound']) {
    test(`forms.md §premise-says: a ${kind} premise shows its class, statement, falsifier and provider`, async () => {
      let files;
      let premise;
      let expected;
      const falsifier = 'An observed behaviour contradicts this premise.';
      if (kind === 'store') {
        files = pages({ boundary: [['archive', 'Door archive', 'store', 'machine', '-', 'serializable', 'operator', 'operator', 'stated', CITE]] });
        premise = 'store:door/archive';
        // forms.md §store-premises, §premise-says fix these four values even after a carry.
        expected = ['store phenomena', 'Door archive permits exactly no anomaly and prevents the rest.',
          'an observed prevented anomaly', "the store's documented and measured isolation"];
      } else if (kind === 'choice') {
        files = pages({ lifecycles: { state: lifecycle('door', ['close'], [['open', 'choice:close-rule'], ['closed', 'None.']]) },
          extra: { [`${PART}/choices/close-rule/README.md`]: posedChoice() } });
        premise = 'choice:door/close-rule';
        expected = ['choice', 'What does closing do? Picked a. The entity reaches closed.',
          'a pick of the other alternative', "the developer's pick"];
      } else if (kind === 'strike') {
        files = pages({ boundary: [['remote', 'Remote controller', 'service', 'world', 'request-response', '-', '-', '-', 'stated', CITE]] });
        premise = 'strike:door/remote/drop';
        expected = ['world', 'Remote controller never does drop.', falsifier, "the developer's strike"];
      } else if (kind === 'span') {
        files = pages();
        files['design/README.md'] = '# Door project\n\n' + table(['Part', 'Purpose', 'Cites'],
          [['door', 'Controls doors.', CITE], ['observer', 'Observes doors.', CITE]])
          + '\n1. [Door](parts/door/)\n2. [Observer](parts/observer/)\n';
        files[`${PART}/boundary.md`] += '\n## Surface\n\n' + table(['Direction', 'Name', 'Cites'], [['emits', 'opened', CITE]]);
        files['design/parts/observer/README.md'] = '# Observer\n';
        files['design/parts/observer/boundary.md'] = '# Observer boundary\n\n## Surface\n\n'
          + table(['Direction', 'Name', 'Cites'], [['consumes', 'door/opened', CITE]]);
        premise = 'span:door+observer';
        // forms.md §premise-says fixes purpose order; it leaves the surface-row enumeration's
        // order open, so check each mandated row without imposing that order.
        expected = ['span', 'Controls doors. and Observes doors. hold together over what they share:',
          'emits opened', 'consumes door/opened', falsifier, "the developer's carry"];
      } else {
        files = pages({ lifecycles: { state: lifecycle('door', ['close'], [['open', 'closed'], ['closed', 'None.']]) },
          extra: { [`${PART}/claims/safe/README.md`]: claim() } });
        premise = 'bound:lifecycles-door/door/safe';
        expected = ['bound', 'Beyond phase level on lifecycles-door: The door stays open.',
          falsifier, "the developer's carry"];
      }
      const dir = await prepared(files, { intake: true });
      if (kind === 'bound') {
        await confirmModel(dir);
        await answer(dir, 'slot:lifecycles-door/parts/door/claims/safe/encoding', {
          'models/lifecycles-door/parts/door/claims/safe/encoding.md': table(['Lifecycle', 'Phase'], [['state', 'closed']]),
        });
      }
      if (kind === 'choice') {
        // Before a pick forms.md §premise-says specifies a different statement, still with
        // class, falsifier and provider in the reading.
        const before = forma(dir, ['account']);
        assert.equal(before.status, 0, before.stderr || before.stdout);
        for (const text of [premise, 'What does closing do? Not yet picked.',
          'a pick of the other alternative', "the developer's pick"]) assert.ok(before.stdout.includes(text));
        decide(dir, 'pick', 'door/choices/close-rule', ['--choice', 'a']);
      } else {
        // decisions.md §carry: carries make these premises eligible for the box.
        decide(dir, 'carry', premise, ['--choice', 'carry', '--basis', '-', '--words', falsifier]);
      }
      for (const command of ['account', 'box']) {
        const result = forma(dir, [command]);
        assert.equal(result.status, 0, result.stderr || result.stdout);
        // forms.md §premise-says and presentation.md §reading to account.md §box require these contents. The
        // JSON entry tables omit provider/class in places, so assert public
        // text content without inventing extra JSON fields or exact layout.
        for (const text of [premise, ...expected]) assert.ok(result.stdout.includes(text), `${command} must include ${text}`);
      }
      if (kind !== 'span') {
        // presentation.md §reading explicitly names class in its premise entry. This
        // separately checks the class even when its word also occurs in the
        // premise's name (choice or bound). Span premise placement is not fixed.
        const assumed = account(dir).parts.flatMap((part) => part.assumed);
        const entry = assumed.find((value) => value.premise === premise);
        assert.ok(entry);
        assert.equal(entry.class, expected[0]);
      }
    });
  }
});

describe('door.md §gives, §repair-answer: offered journey declines route to lifecycle repairs', () => {
  test('decisions.md §expects: declining an offered journey repairs its lifecycle part and is met by changing the lifecycle pin', async () => {
    const path = `${PART}/lifecycles/state/README.md`;
    const files = pages({ lifecycles: { state: lifecycle('door', ['close'], [['open', 'closed'], ['closed', 'None.']]) } });
    const dir = await prepared(files, { intake: true });
    decide(dir, 'confirm', 'parts');
    decide(dir, 'confirm', 'door/lifecycles/state');
    const declined = decide(dir, 'decline', 'door/journeys/reach-state--closed', ['--words', 'Closing must pass through latched first.']);
    // decisions.md §decision-file: a decision's basename, without .md, is its name.
    const name = declined.recorded[0].split('/').at(-1).slice(0, -3);
    const item = `repair:${name}`;
    assert.ok(missing(dir).some((entry) => entry.item === item));
    const packet = await tempFolder('forma-declined-journey-packet-');
    success(forma(dir, ['give', item, packet, '--json']));
    // door.md §gives gives the restatement and repair decision contract; routing
    // must not ask the agent to write a page under code's reach- key.
    assert.equal(await read(packet, path), files[path]);
    assert.ok(await read(packet, 'forma/decisions.md'));
    const mechanism = 'Adds a latched phase before closure.';
    const repair = { 'repair.md': fieldTable([['Mechanism', mechanism]]),
      [path]: files[path].replace('| open | closed |', '| open | latched |\n| latched | closed |') };
    await answer(dir, item, repair);
    // decisions.md §expects: the lifecycle's changed pin meets this repair and
    // design.md §confirmation-pins requires confirmation of that changed lifecycle.
    const after = missing(dir);
    assert.ok(!after.some((entry) => entry.item === item));
    assert.ok(after.some((entry) => entry.item === 'confirm:door/lifecycles/state'));
    const receipts = (await read(dir, `${PART}/lifecycles/state/receipt`)).trimEnd().split('\n').map(JSON.parse);
    // door.md §repair-answer to §receipts and decisions.md §expects: a changed file records the repair
    // it met, including the mechanism, exact before hash and accepted bytes.
    const line = receipts.find((entry) => entry.sha256 === sha256(repair[path]));
    assert.ok(line);
    assert.ok(line.answers.includes(name));
    assert.deepEqual(line.mechanisms, [{ decision: name, mechanism: mechanism }]);
    assert.equal(line.before, sha256(files[path]));
  });
});
