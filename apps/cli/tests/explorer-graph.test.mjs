import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { accountOf } from '../src/account/index.mjs';
import { readingOf, CANNOT_KNOW } from '../src/account/reading.mjs';
import { boxOf } from '../src/account/box.mjs';
import { readEvidenceForDiff } from '../src/account/diff.mjs';
import { buildGraph } from '../src/explore/graph.mjs';
import { project, read, repo, sha256, snapshot, writeFiles, fixtures } from './helpers/forma.mjs';

// The graph is a projection, so its account and box must agree with their
// established computations. Assertions about references and pictures below use
// the fixture's actual fields and moves, not the graph's implementation.
const example = join(repo, 'examples/export-ticket');
const lifecycle = 'export-ticket/lifecycles/ticket-state';
const id = (kind, key) => `${kind}:${encodeURIComponent(key)}`;
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const node = (g, kind, key) => g.nodes.find(n => n.id === id(kind, key));
const edge = (g, source, relation, target, field) => g.edges.find(e =>
  e.source === source && e.relation === relation && e.target === target &&
  (field === undefined || e.data.field === field));
const reference = (g, source, target) => g.edges.find(e =>
  e.source === source && e.target === target && (e.data.field || e.data.pin));
const sameData = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? String(v) : v));
let exampleRead;
function real() {
  return exampleRead ??= (async () => {
    const here = await accountOf(example);
    const recorded = await accountOf(example, { machine: false, project: here.project, evidenceWith: readEvidenceForDiff });
    return { graph: await buildGraph(example), accounts: { here, recorded } };
  })();
}

test('account.md §explorer-graph: real export-ticket reading and box are exact in both modes', async () => {
  const { graph, accounts } = await real();
  assert.equal(graph.format, 1);
  assert.equal(graph.project, 'export-ticket');
  assert.deepEqual(graph.local, accounts.here.hereJson);
  assert.deepEqual(graph.cannotKnow, CANNOT_KNOW);
  for (const [mode, a] of Object.entries(accounts)) {
    const g = graph.modes[mode];
    assert.deepEqual(g.reading, readingOf(a), `${mode} reading`);
    assert.deepEqual(g.box, boxOf(a), `${mode} box`);
    assert.deepEqual(Object.keys(g).sort(), ['box', 'causes', 'diagrams', 'edges', 'nodes', 'reading'], `${mode} holds what the contract lists`);
    assert.equal(new Set(g.nodes.map(n => n.id)).size, g.nodes.length);
    assert.equal(new Set(g.edges.map(e => e.id)).size, g.edges.length);
    const identities = new Set(g.nodes.map(n => n.id));
    for (const n of g.nodes) {
      assert.equal(n.id, id(n.kind, n.key));
      assert.deepEqual(Object.keys(n).sort(), ['data', 'id', 'key', 'kind', 'name', 'scope']);
    }
    for (const e of g.edges) {
      assert.ok(identities.has(e.source), `${mode}: missing source of ${e.relation}`);
      assert.ok(identities.has(e.target), `${mode}: missing target of ${e.relation}`);
      assert.ok(e.data.field || e.data.pin, `${mode}: ${e.source} ${e.relation} identifies its source field or pin`);
    }
  }
  const recorded = new Map(graph.modes.recorded.nodes.map(n => [n.id, n]));
  for (const n of graph.modes.here.nodes) if (recorded.has(n.id)) {
    const other = recorded.get(n.id);
    assert.deepEqual([other.kind, other.key], [n.kind, n.key]);
  }
});

test('account.md §explorer-graph: citations and fixed-field references retain their actual source fields', async () => {
  const { graph, accounts: { here: a } } = await real();
  for (const [mode, g] of Object.entries(graph.modes)) {
    for (const [address, p] of a.project.brief.passages) {
      const shown = node(g, 'passage', address);
      assert.equal(shown.data.canonical, p.canonical, `${mode}: ${address}`);
      assert.equal(shown.data.text.replace(/\s+/g, ' ').trim(), p.canonical.replace(/\s+/g, ' ').trim(), `${mode}: ${address} is given as written`);
      assert.equal(shown.data.hash, p.hash);
    }
    const claim = 'export-ticket/claims/no-creation-after-expiry';
    const premise = 'export-ticket/premises/atomic-completion';
    assert.ok(edge(g, id('entry', claim), 'rests-on', id('entry', premise), 'Rests on'));
    const journey = 'export-ticket/journeys/expiry-after-claim';
    for (const action of ['check', 'complete', 'return-receipt', 'expire']) {
      const e = edge(g, id('entry', journey), 'names-action', id('entry', `export-ticket/actions/${action}`), 'Action');
      assert.equal(e?.data.written, action);
    }
    assert.ok(edge(g, id('entry', journey), 'steps-through', id('entry', lifecycle)));
    const model = node(g, 'model', 'export-ticket-tlc').data;
    assert.equal(model.engine, 'tlc');
    for (const field of ['parts', 'actions', 'misbehaviours', 'bounds', 'phases']) {
      assert.deepEqual(model.model[field], sameData(a.project.models.get('export-ticket-tlc').model[field]), field);
    }
    assert.ok(model.rules, 'the model retains its computed journey rules');
  }
});

test('account.md §explorer-graph: slots link to the subject they were written for and retain receipt pins', async () => {
  const { graph, accounts: { here: a } } = await real();
  const path = 'models/export-ticket-tlc/parts/export-ticket/claims/no-creation-after-expiry/encoding.tla';
  const subject = 'export-ticket/claims/no-creation-after-expiry';
  for (const g of Object.values(graph.modes)) {
    const slot = node(g, 'slot', path);
    assert.deepEqual(slot.data.pins, a.project.slots.get(path).pins);
    assert.ok(edge(g, slot.id, 'slot-of', id('model', 'export-ticket-tlc')));
    assert.ok(edge(g, slot.id, 'written-for', id('entry', subject)), 'a slot subject is an entry, not its receipt object');
    for (const pin of slot.data.pins) {
      const e = edge(g, slot.id, 'pins', id('entry', pin.entry));
      assert.equal(e?.data.pin, pin.pin);
    }
  }
});

test('account.md §explorer-graph: questions link to each explicitly named input slot', async () => {
  const { graph, accounts } = await real();
  for (const [mode, a] of Object.entries(accounts)) {
    const g = graph.modes[mode];
    const withSlots = a.evidence.questions.filter(r => Object.keys(r.question.slots ?? {}).length);
    assert.ok(withSlots.length > 0);
    for (const { question: q } of withSlots) for (const [role, slot] of Object.entries(q.slots)) {
      assert.ok(node(g, 'slot', slot.path), `${mode}: the ${role} slot exists`);
      assert.ok(reference(g, id('question', q.name), id('slot', slot.path)), `${mode}: ${q.name} names its ${role} input`);
    }
  }
});

test('account.md §explorer-graph: model table references reach actions, world rows and state projections', async () => {
  const { graph } = await real();
  const key = 'export-ticket-tlc';
  for (const [mode, g] of Object.entries(graph.modes)) {
    const source = id('model', key);
    const model = node(g, 'model', key).data.model;
    const targets = [
      ...model.actions.map(row => ['entry', row.action.replace('/', '/actions/'), 'names-action']),
      ...model.misbehaviours.map(row => ['boundary', row.row.replace('/', '/boundary/'), 'reads']),
      ...model.phases.map(row => ['entry', row.lifecycle.replace('/', '/lifecycles/'), 'reads']),
    ];
    assert.ok(model.actions.length && model.misbehaviours.length && model.phases.length);
    for (const [kind, target, relation] of targets) {
      assert.ok(node(g, kind, target), `${mode}: the named ${kind} exists`);
      assert.ok(edge(g, source, relation, id(kind, target))?.data.field, `${mode}: ${key} names ${target} in its table`);
    }
    for (const n of g.nodes.filter(n => n.kind === 'model')) {
      for (const part of n.data.model.parts) assert.ok(reference(g, n.id, id('part', part)), `${mode}: ${n.key} names its part`);
      for (const lifecycle of n.data.model.lifecycles ?? []) assert.ok(reference(g, n.id, id('entry', lifecycle)), `${mode}: the lifecycle model names its confirmed lifecycle`);
    }
  }
});

test('account.md §explorer-graph: added journeys retain citations, resolved references and their named source', async () => {
  const { graph, accounts: { here: a } } = await real();
  const journeys = [...a.design.journeys.values()].filter(j => j.added);
  assert.ok(journeys.some(j => j.added === 'pick'));
  for (const [mode, g] of Object.entries(graph.modes)) for (const j of journeys) {
    const source = id('entry', j.name);
    for (const cite of j.cites) assert.ok(edge(g, source, 'cites', id('passage', cite), 'Cites'), `${mode}: ${j.name} cites ${cite}`);
    for (const [field, refs] of Object.entries(j.refs)) for (const ref of refs) {
      if (!ref.entry) continue;
      const relation = field === 'Action' ? 'names-action' : 'steps-through';
      const linked = edge(g, source, relation, id('entry', ref.entry.entry), field);
      assert.equal(linked?.data.written, ref.written, `${mode}: ${j.name} retains its ${field} source`);
    }
    if (j.choice) assert.ok(reference(g, source, id('entry', j.choice)), `${mode}: the added journey names its choice`);
    if (j.decision) assert.ok(reference(g, source, id('decision', j.decision)), `${mode}: the added journey names its pick`);
  }
});

test('account.md §explorer-graph: premises link to their recorded origins and carry decisions', async () => {
  const { graph, accounts: { here: a } } = await real();
  for (const [mode, g] of Object.entries(graph.modes)) for (const p of a.design.premises) {
    const source = id('premise', p.name), targets = [];
    if (p.kind === 'page') targets.push(['entry', p.name]);
    if (p.choice) targets.push(['entry', p.choice]);
    if (p.part && p.row) targets.push(['boundary', `${p.part}/boundary/${p.row}`]);
    if (p.claim) targets.push(['entry', p.claim]);
    if (p.model) targets.push(['model', p.model]);
    if (p.carry?.by) targets.push(['decision', p.carry.by.name]);
    for (const [kind, key] of targets) {
      assert.ok(node(g, kind, key), `${mode}: ${p.name}'s ${kind} origin exists`);
      assert.ok(reference(g, source, id(kind, key)), `${mode}: ${p.name} names ${key}`);
    }
  }
});

test('account.md §explorer-graph: faults name their changed actions and world slots name their boundary rows', async () => {
  const { graph, accounts: { here: a } } = await real();
  const faults = [...a.project.slots.values()].filter(s => s.kind === 'fault' && s.form?.action);
  const world = [...a.project.slots.values()].filter(s => s.kind === 'misbehaviour');
  assert.ok(faults.length && world.length);
  for (const [mode, g] of Object.entries(graph.modes)) {
    for (const slot of faults) {
      const action = slot.form.action.replace('/', '/actions/');
      assert.ok(edge(g, id('slot', slot.path), 'names-action', id('entry', action))?.data.field, `${mode}: ${slot.path} explicitly changes ${action}`);
    }
    for (const slot of world) {
      const boundary = `${slot.part}/boundary/${slot.row}`;
      assert.ok(node(g, 'boundary', boundary));
      assert.ok(edge(g, id('slot', slot.path), 'written-for', id('boundary', boundary))?.data.field, `${mode}: ${slot.path} is for ${boundary}`);
    }
  }
});

test('account.md §explorer-graph: ruling fields and brief decisions connect mechanisms to their recorded examination', async () => {
  const { graph, accounts: { here: a } } = await real();
  for (const [mode, g] of Object.entries(graph.modes)) {
    let questions = 0;
    for (const d of a.project.decisions.filter(d => d.kind === 'rule')) {
      for (const row of d.surprises.surprises) if (node(g, 'question', row.question)) {
        questions += 1;
        assert.ok(reference(g, id('decision', d.name), id('question', row.question)), `${mode}: the ruling records question ${row.question}`);
      }
      for (const row of d.surprises.entries) {
        const target = node(g, 'entry', row.entry) ?? node(g, 'boundary', row.entry);
        if (!target) continue;
        assert.equal(edge(g, id('decision', d.name), 'pins', target.id)?.data.pin, row.pin, `${mode}: the ruling retains its ${row.entry} pin`);
      }
    }
    assert.ok(questions > 0, 'the real record has historical questions still inspectable');
    for (const subject of a.briefs.subjects.values()) {
      assert.ok(subject.inForce, 'the fixture has a brief decision for its met repair');
      const decision = id('decision', subject.inForce.name);
      assert.ok(edge(g, decision, 'decides', id('mechanism', subject.name), 'On'), `${mode}: the brief decision names this met repair`);
      assert.ok(reference(g, id('mechanism', subject.name), decision), `${mode}: the mechanism names its brief decision`);
      assert.equal(subject.inForce.rows.Choice, 'accepted');
      assert.ok(!g.edges.some(e => e.source === decision && e.target.startsWith('passage:')), 'accepted prose containing passage addresses supplies no citation edges');
    }
  }
});

test('account.md §explorer-graph: question, evidence and generated-premise scopes name their actual part', async () => {
  const { graph } = await real();
  const question = 'export-ticket-tlc/parts/export-ticket/claims/one-receipt/witness-overlap-and-lost-reply.344f2c25ca7a';
  for (const [mode, g] of Object.entries(graph.modes)) {
    const q = node(g, 'question', question);
    assert.equal(q.data.holder.key, 'export-ticket');
    assert.equal(q.scope, 'export-ticket', `${mode}: a claim question belongs to the claim's holder`);
    assert.equal(node(g, 'evidence', question).scope, 'export-ticket');
    for (const key of [
      'bound:export-ticket-tlc/export-ticket/no-creation-after-expiry',
      'bound:lifecycles-export-ticket/export-ticket/no-creation-after-expiry',
    ]) assert.equal(node(g, 'premise', key).scope, 'export-ticket', `${mode}: the prefix names a premise kind and model, not its part`);
  }
});

for (const mode of ['here', 'recorded']) test(`account.md §explorer-graph: ${mode} keeps unasked evidence without a current outcome`, async () => {
  const { graph, accounts } = await real();
  const a = accounts[mode], g = graph.modes[mode];
  const asked = new Set(a.evidence.questions.map(r => r.question.name));
  const unasked = [...a.project.evidence.values()].filter(f => f.counts && !asked.has(f.name));
  assert.ok(unasked.length > 0, 'the real record contains evidence of questions no longer asked');
  for (const f of unasked) {
    const question = node(g, 'question', f.name);
    const evidence = node(g, 'evidence', f.name);
    assert.ok(question, `${mode} must retain unasked question ${f.name}`);
    assert.ok(evidence, `${mode} must retain unasked evidence ${f.name}`);
    assert.equal(question.data.asked, false);
    assert.equal(evidence.data.asked, false);
    assert.equal(evidence.data.current, false);
    assert.ok(evidence.data.reasons.some(r => /not asked/.test(r)));
    assert.deepEqual(evidence.data.basis, f.value.basis);
    assert.deepEqual(evidence.data.found, f.value.found, 'a historical outcome remains inspectable');
    const served = node(g, 'entry', question.data.serves) ?? node(g, 'boundary', question.data.serves);
    if (served) assert.ok(reference(g, question.id, served.id), `${mode}: the kept question retains its named subject`);
  }
});

test('account.md §explorer-graph: trace pictures identify their source question and exact trace', async () => {
  const { graph } = await real();
  const d = graph.modes.here.diagrams.find(d => d.lifecycle === lifecycle && d.variant.kind === 'as-read');
  assert.ok(d.traces.length > 0);
  assert.equal(d.picture.source, null);
  for (const t of d.traces) {
    assert.deepEqual(t.picture.source, { question: t.id, digest: sha256(JSON.stringify(t.trace)) });
    assert.deepEqual(t.picture.basis, d.basis, 'a displayed trace uses the current confirmed picture basis');
    assert.deepEqual(t.basis, node(graph.modes.here, 'evidence', t.id).data.basis, 'evidence keeps its own historical basis');
    assert.equal(t.current, false, 'these retained witness questions are unasked');
  }
});

test('account.md §explorer-graph: a ruling whose showing keeps no structured picture gives the showing and no picture', async () => {
  const { graph, accounts: { here: a } } = await real();
  const rules = a.project.decisions.filter(d => d.kind === 'rule' && !d.shown.includes('```json forma-diagram'));
  assert.ok(rules.length > 0);
  for (const g of Object.values(graph.modes)) for (const rule of rules) {
    const kept = g.diagrams.find(d => d.variant.kind === 'kept' && d.variant.ruling === rule.name);
    assert.ok(kept);
    assert.equal(kept.picture, null);
    assert.equal(kept.basis, null);
    assert.equal(kept.reason, 'What this ruling was shown keeps no structured picture.');
    assert.equal(kept.showing, rule.shown);
  }
});

test('account.md §explorer-graph: a met repair still exposes the model its ruling targets', async () => {
  const { graph, accounts: { here: a } } = await real();
  const ruling = a.project.decisions.find(d => d.kind === 'rule' && d.rows.Verdict === 'real finding' &&
    d.rows.Target === 'export-ticket-tlc' && [...a.project.files.values()].some(f => f.entry?.answers?.includes(d.name)));
  assert.ok(ruling, 'the recording includes a real finding whose repair has receipts');
  assert.ok(!a.items.some(i => i.item.startsWith(`repair:${ruling.name}/`)), 'this repair is already met');
  for (const g of Object.values(graph.modes)) {
    assert.equal(node(g, 'decision', ruling.name).data.rows.Target, 'export-ticket-tlc');
    assert.ok(edge(g, id('decision', ruling.name), 'repairs', id('model', 'export-ticket-tlc')),
      'a resolved repair route survives after its supplying item is met');
    for (const file of a.project.files.values()) if (file.entry?.answers?.includes(ruling.name)) {
      assert.ok(edge(g, id('decision', ruling.name), 'repairs', id('file', file.path)));
      assert.ok(edge(g, id('file', file.path), 'written-by', id('decision', ruling.name)));
    }
  }
});

test('account.md §explorer-graph: causes count distinct failed lines and retain unsupplied reasons', async () => {
  const { graph, accounts } = await real();
  for (const [mode, a] of Object.entries(accounts)) {
    const causes = graph.modes[mode].causes;
    const allLines = causes.flatMap(c => c.lines);
    const lineKey = l => JSON.stringify([l.claim, l.model, l.condition ?? null, l.rule ?? null, l.on ?? null]);
    const expected = new Set();
    let expectedCount = 0;
    for (const s of a.standing.claims.values()) {
      if (s.coverItems.length) {
        expected.add(lineKey({ claim: s.entry, model: null, condition: 'coverage' }));
        expectedCount += 1;
      }
      for (const m of s.models) for (const c of m.conditions.filter(c => !c.holds)) {
        expectedCount += 1;
        const key = lineKey({ claim: s.entry, model: m.model, condition: c.condition });
        expected.add(key);
        assert.ok(allLines.some(l => lineKey(l) === key), `${mode} omits ${key}`);
        if (!c.items.length) assert.ok(causes.some(cause => cause.says === (c.reason ?? c.why ?? c.found) &&
          cause.lines.some(l => lineKey(l) === key)), 'a condition without a supplier retains its actual reason');
      }
    }
    for (const [model, failures] of a.standing.ruleFails) for (const f of failures) {
      expectedCount += 1;
      expected.add(lineKey({ claim: null, model, rule: f.rule, on: f.on }));
    }
    assert.deepEqual(new Set(allLines.map(lineKey)), expected);
    // A negative journey can fail both its admitted prefix and its refusal.
    // Those are separate failures even though they share a rule and subject.
    assert.equal(new Set(allLines.map(l => l.id)).size, expectedCount);
    for (const cause of causes) {
      assert.equal(new Set(cause.lines.map(l => l.id)).size, cause.lines.length, `${mode}: duplicate line under one cause`);
      for (const line of cause.lines) {
        assert.ok(line.causes.includes(cause.id));
        assert.deepEqual(new Set(line.causes), new Set(causes.filter(c => c.lines.some(l => l.id === line.id)).map(c => c.id)));
      }
    }
    const claim = 'export-ticket/claims/no-creation-after-expiry';
    const reason = causes.find(c => c.lines.some(l => l.claim === claim && l.model === 'lifecycles-export-ticket' && l.condition === 'examined'));
    assert.match(reason.says, /cannot express/);
    assert.match(reason.says, /four distinct transitions/);
    const terminalRuns = a.evidence.questions.filter(q => q.evidence && !q.current &&
      a.items.some(i => i.item === `run:${q.question.name}` && !i.waits?.length));
    for (const q of terminalRuns) {
      const item = `run:${q.question.name}`;
      // Only supplying runs belong to this failure graph; unrelated work does
      // not become a cause of an existing claim or rule.
      if (!causes.some(c => c.items.includes(item))) continue;
      for (const says of q.reasons) assert.ok(causes.some(c => c.items.includes(item) && c.says === says), `${mode}: ${says}`);
    }
  }
});

// Accepted fixture pages need receipts; this helper supplies only that record
// form, without deriving a graph or asking an engine for an expected result.
async function receiptDesign(dir) {
  const groups = new Map();
  for (const [path, text] of Object.entries(await snapshot(dir))) {
    if (!path.startsWith('design/') || path.startsWith('design/brief/') || path.includes('/decisions/') || !path.endsWith('.md')) continue;
    const folder = dirname(path);
    const author = { provider: 'fixture', model: 'writer', session: 'fixture' };
    const row = { file: path.slice(folder.length + 1), sha256: sha256(text), at: '2020-01-01T00:00:00.000Z', session: author, authors: [author] };
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(row);
  }
  await writeFiles(dir, Object.fromEntries([...groups].map(([folder, rows]) =>
    [`${folder}/receipt`, rows.sort((a, b) => a.file.localeCompare(b.file)).map(r => JSON.stringify(r) + '\n').join('')])));
}

test('account.md §explorer-graph: span premises name their exact parts and shared surface rows', async t => {
  const dir = await project('decisions/base');
  t.after(() => rm(dir, { recursive: true, force: true }));
  await receiptDesign(dir);
  const graph = await buildGraph(dir);
  for (const [mode, g] of Object.entries(graph.modes)) {
    const premise = node(g, 'premise', 'span:alpha+beta');
    assert.ok(premise, 'declared surfaces generate a span premise');
    assert.deepEqual(premise.data.span.parts, ['alpha', 'beta']);
    assert.equal(premise.scope, null, 'a pair of parts is not a named design span');
    assert.ok(!node(g, 'span', 'alpha+beta'));
    for (const holder of ['alpha', 'beta', 'together']) {
      const claim = node(g, 'entry', `${holder}/claims/safe`);
      assert.equal(claim.scope, holder, `${mode}: a claim belongs to its holder`);
    }
    for (const part of premise.data.span.parts) assert.ok(reference(g, premise.id, id('part', part)), `${mode}: the premise names ${part}`);
    const shared = Object.values(premise.data.span.shared).flat();
    assert.equal(shared.length, 2);
    for (const row of shared) {
      assert.ok(node(g, 'entry', row.entry));
      assert.ok(reference(g, premise.id, id('entry', row.entry)), `${mode}: the premise names the exact shared surface`);
    }
  }
});

test('account.md §explorer-graph: sharing a part does not invent a journey-to-lifecycle reference', async t => {
  const openOnce = await read(join(fixtures, 'evidence/lifecycle'), 'design/parts/gate/journeys/open-once/README.md');
  const dir = await project('evidence/lifecycle', {
    'design/parts/gate/journeys/open-once/README.md': openOnce.replace('The ticket is open.', 'The ticket is open; gate/actions/reset is not invoked.'),
    'design/parts/gate/journeys/unresolved/README.md': openOnce.replace('# Open once', '# Unresolved action').replace('| open |', '| missing-action |'),
    'design/parts/gate/lifecycles/other/README.md': '# Another lifecycle\n\n| Field | Value |\n| --- | --- |\n| Entity | ticket |\n| Initial | cold |\n| Ends | none |\n| Unaffected | open |\n| Origin | stated |\n| Cites | design/brief/gate.md#gate |\n\n| Phase | reset |\n| --- | --- |\n| cold | warm |\n| warm | cold |\n',
  });
  t.after(() => rm(dir, { recursive: true, force: true }));
  await receiptDesign(dir);
  const graph = await buildGraph(dir);
  for (const g of Object.values(graph.modes)) {
    const journey = node(g, 'entry', 'gate/journeys/open-once');
    assert.ok(journey.data.walk.moves.some(m => m.lifecycle === 'gate/lifecycles/door'));
    assert.ok(!journey.data.walk.moves.some(m => m.lifecycle === 'gate/lifecycles/other'));
    assert.ok(edge(g, journey.id, 'steps-through', id('entry', 'gate/lifecycles/door')));
    assert.equal(edge(g, journey.id, 'steps-through', id('entry', 'gate/lifecycles/other')), undefined,
      'open is explicitly unaffected on the other lifecycle and no start row names it');
    assert.equal(edge(g, journey.id, 'names-action', id('entry', 'gate/actions/reset')), undefined,
      'a name in prose creates no reference');
    const unresolved = node(g, 'entry', 'gate/journeys/unresolved');
    const ref = unresolved.data.references.Action.find(r => r.written === 'missing-action');
    assert.equal(ref.holds, false);
    assert.equal(typeof ref.why, 'string');
    assert.ok(ref.why.length > 0, 'the unresolved fixed field retains its reason');
    assert.ok(!g.edges.some(e => e.source === unresolved.id && e.relation === 'names-action'));
  }
});

// Copying a recording into scratch permits adversarial evidence and historical
// showing fixtures without changing examples/ or running the formal engines.
async function copyExample() {
  const dir = await project();
  for (const folder of ['design', 'models']) await cp(join(example, folder), join(dir, folder), { recursive: true });
  return dir;
}
function seal(value) {
  const complete = { ...value, digest: '' };
  complete.digest = sha256(json(complete));
  return json(complete);
}

test('account.md §explorer-graph: stated brief passages are references and use brief decision state', async t => {
  const { accounts: { here: a } } = await real();
  const dir = await copyExample();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const subject = [...a.briefs.subjects.values()][0];
  const original = subject.inForce;
  const address = 'design/brief/overview.md#claim-design';
  const pin = sha256([
    ...[...new Set(subject.mechanisms)].sort().map(m => `Mechanism: ${m}`),
    `Passage: ${address} ${a.project.brief.passages.get(address).hash}`,
  ].join('\n'));
  const text = (await read(dir, original.path))
    .replace('| Choice | accepted |', '| Choice | stated |')
    .replace(`| Pin | ${original.pin} |`, `| Pin | ${pin} |`)
    .replace(`| At | ${original.at} |`, '| At | 2026-11-13T00:00:00.000Z |')
    .replace(original.words, address);
  const name = `20261113T000000Z-brief-${sha256(text).slice(0, 12)}`;
  const path = `${dirname(original.path)}/${name}.md`;
  await writeFiles(dir, { [path]: text });
  const graph = await buildGraph(dir);
  for (const [mode, g] of Object.entries(graph.modes)) {
    const decision = node(g, 'decision', name);
    assert.ok(decision, `the stated brief decision counts: ${JSON.stringify(node(g, 'file', path)?.data.reasons)}`);
    assert.equal(node(g, 'mechanism', subject.name).data.brief.name, name, 'the fixture is the in-force brief decision');
    assert.ok(edge(g, decision.id, 'cites', id('passage', address))?.data.field, `${mode}: stated Words name a passage`);
    assert.deepEqual(decision.data.state, { state: 'in force' }, `${mode}: the brief computation owns its decision state`);
    assert.deepEqual(node(g, 'decision', original.name).data.state, { state: 'superseded', supersededBy: name });
    assert.ok(edge(g, decision.id, 'overrides', id('decision', original.name)));
  }
});

test('account.md §explorer-graph: a fault variant changes only its explicit cell on its named model', async t => {
  const { accounts: { here: a } } = await real();
  const dir = await copyExample();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const folder = 'models/lifecycles-export-ticket/parts/export-ticket/claims/no-creation-after-expiry';
  const path = `${folder}/fault-revive.md`;
  const text = '| Field | Value |\n| --- | --- |\n| Action | - |\n| Mechanism | Let a check revive an expired ticket. |\n\n' +
    '| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| ticket-state | expired-unclaimed | check | active-unclaimed |\n';
  const template = a.project.slots.get(`${folder}/encoding.md`).entry;
  const receipt = { ...template, file: 'fault-revive.md', sha256: sha256(text), pins: [
    'export-ticket/claims/no-creation-after-expiry', lifecycle,
  ].sort().map(entry => ({ entry, pin: a.project.restatement.pins.entries.get(entry).pin })) };
  await writeFiles(dir, { [path]: text, [`${folder}/receipt`]: (await read(dir, `${folder}/receipt`)) + JSON.stringify(receipt) + '\n' });
  const graph = await buildGraph(dir);
  for (const g of Object.values(graph.modes)) {
    const base = g.diagrams.find(d => d.lifecycle === lifecycle && d.variant.kind === 'as-read');
    const fault = g.diagrams.find(d => d.variant.kind === 'fault' && d.variant.slot === path);
    assert.ok(fault, 'the accepted overlay has a diagram variant');
    assert.equal(fault.variant.model, 'lifecycles-export-ticket');
    assert.equal(fault.lifecycle, lifecycle);
    assert.notEqual(fault.id, base.id);
    assert.equal(base.picture.cells['expired-unclaimed'].check.kind, 'refused');
    assert.deepEqual(fault.picture.cells['expired-unclaimed'].check, { kind: 'phase', phase: 'active-unclaimed' });
    for (const [phase, cells] of Object.entries(base.picture.cells)) for (const [action, cell] of Object.entries(cells)) {
      if (phase === 'expired-unclaimed' && action === 'check') continue;
      assert.deepEqual(fault.picture.cells[phase][action], cell, `${phase} | ${action}`);
    }
    assert.deepEqual(fault.basis.slot, { path, sha256: sha256(text) });
    assert.deepEqual(fault.picture.basis, fault.basis);
  }
});

test('account.md §explorer-graph: superseding carries expose their override and Basis references', async t => {
  const { accounts: { here: a } } = await real();
  const dir = await copyExample();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const premise = 'export-ticket/premises/atomic-completion';
  const basis = 'export-ticket/claims/no-creation-after-expiry';
  const original = a.design.premises.find(p => p.name === premise).carry.by;
  const text = (await read(dir, original.path))
    .replace(`| At | ${original.at} |`, '| At | 2026-11-13T00:00:00.000Z |')
    .replace('| Basis | - |', `| Basis | ${basis} |`);
  const name = `20261113T000000Z-carry-${sha256(text).slice(0, 12)}`;
  await writeFiles(dir, { [`${dirname(original.path)}/${name}.md`]: text });
  const graph = await buildGraph(dir);
  for (const g of Object.values(graph.modes)) {
    assert.equal(node(g, 'decision', original.name).data.state.supersededBy, name);
    assert.equal(node(g, 'premise', premise).data.carry.basis, basis);
    assert.ok(edge(g, id('decision', name), 'overrides', id('decision', original.name)), 'the computed supersession is traversable');
    assert.ok(edge(g, id('premise', premise), 'carried-on', id('entry', basis)), 'the carry Basis is a reference to its claim');
  }
});

// A deliberately historical picture, with a phase absent from today's page.
// It is complete data supplied to the record, never produced by the renderer.
function historicalPicture(source) {
  return {
    format: 1, lifecycle,
    basis: {
      pins: [{ entry: lifecycle, pin: 'a'.repeat(64) }, { entry: 'export-ticket/actions/check', pin: 'f'.repeat(64) }], picks: [],
      files: [
        { path: 'design/parts/export-ticket/actions.md', sha256: 'f'.repeat(64) },
        { path: 'design/parts/export-ticket/lifecycles/ticket-state/README.md', sha256: 'b'.repeat(64) },
      ],
      versions: { forma: { version: '0.0.0', source: 'c'.repeat(64) }, xstate: { name: 'xstate', version: '5.0.0' } },
    },
    source, entity: 'ticket', initial: { phase: 'retired', enteredBy: null }, ends: ['retired'],
    phases: [{ id: 'historical-retired', key: 'retired', classes: ['visited'] }],
    actions: ['check'], cells: { retired: { check: { kind: 'refused' } } }, moves: [],
    machine: { id: 'historical-ticket', initial: 'historical-retired', states: { 'historical-retired': { id: 'historical-retired', on: {} } } },
    mapping: { states: { 'historical-retired': 'retired' }, events: { 'historical-check': { action: 'check', case: null } }, cells: { 'historical-cell': { phase: 'retired', action: 'check', case: null } } },
    marks: [{ phase: 'retired', entity: 'old-ticket' }], facts: [{ phase: 'retired', classes: ['visited'] }],
  };
}

function historicalRuling() {
  const question = 'export-ticket-tlc/parts/export-ticket/claims/one-receipt/base.344f2c25ca7a';
  const surprise = `${question}.surprise-${'b'.repeat(12)}`;
  const journey = `export-ticket/journeys/kept-${'b'.repeat(12)}`;
  const pictures = [historicalPicture({ question, digest: 'd'.repeat(64) }), historicalPicture({ question, digest: 'e'.repeat(64) })];
  const shown = 'Historical showing.\n' + pictures.map(p => '  ```json forma-diagram\n' +
    JSON.stringify(p, null, 2).split('\n').map(line => `  ${line}`).join('\n') + '\n  ```').join('\n');
  const fields = [
    ['Kind', 'rule'], ['On', surprise], ['Pin', sha256(shown + '\n')], ['Verdict', 'model wrong'],
    ['Level', 'specification'], ['Target', '-'], ['Target pin', '-'], ['Basis', '-'],
    ['Provider', '-'], ['Model', '-'], ['Session', '-'], ['By', 'Fixture developer'], ['At', '2020-01-01T00:00:00.000Z'],
  ];
  const text = `# rule ${surprise}\n\n| Field | Value |\n| --- | --- |\n` + fields.map(([k, v]) => `| ${k} | ${v} |\n`).join('') +
    '\n## Words\n\n```text\nRetain the observed forbidden journey.\n```\n' +
    '\n## Surprises\n\n| Surprise | Question | Basis | Parts | Expected | Found |\n| --- | --- | --- | --- | --- | --- |\n' +
    `| ${surprise} | ${question} | ${'b'.repeat(64)} | export-ticket | no violation | violation |\n\n` +
    `| Surprise | Entry | Pin |\n| --- | --- | --- |\n| ${surprise} | ${lifecycle} | ${'a'.repeat(64)} |\n` +
    `\n## Shown\n\n\`\`\`\`text\n${shown}\n\`\`\`\`\n` +
    `\n## Kept\n\n### ${surprise}\n\n| Field | Value |\n| --- | --- |\n| Journey | ${journey} |\n| Pin | ${'a'.repeat(64)} |\n\n` +
    '| Field | Value |\n| --- | --- |\n| Polarity | must not |\n| Expected end | - |\n| Refused step | 1 |\n| Origin | added |\n| Cites | design/brief/overview.md#claim-design |\n\n' +
    '| Lifecycle | Entity | Phase |\n| --- | --- | --- |\n| ticket-state | old-ticket | retired |\n\n' +
    '| Step | Actor | Action | Arguments | Entity | Case |\n| --- | --- | --- | --- | --- | --- |\n| 1 | The service | check | The old ticket | old-ticket | - |\n';
  const name = `20200101T000000Z-rule-${sha256(text).slice(0, 12)}`;
  return { name, text, shown, pictures, journey };
}

async function fixtureDecision(dir, { kind, on, pin, folder, at = '2026-11-14T00:00:00.000Z' }) {
  const fields = [
    ['Kind', kind], ['On', on], ['Pin', pin], ['Provider', '-'], ['Model', '-'],
    ['Session', '-'], ['By', 'Fixture developer'], ['At', at],
  ];
  const text = `# ${kind} ${on}\n\n| Field | Value |\n| --- | --- |\n` + fields.map(([k, v]) => `| ${k} | ${v} |\n`).join('') +
    (kind === 'decline' ? '\n## Words\n\n```text\nThe proposed journey is not the intended behavior.\n```\n' : '') +
    '\n## Shown\n\n```text\nA generated journey fixture.\n```\n';
  const time = `${at.slice(0, 10).replaceAll('-', '')}T${at.slice(11, 19).replaceAll(':', '')}Z`;
  const name = `${time}-${kind}-${sha256(text).slice(0, 12)}`;
  await writeFiles(dir, { [`${folder}/${name}.md`]: text });
  return name;
}

test('account.md §explorer-graph: declining an offered journey routes repair to its source lifecycle', async t => {
  const { accounts: { here: a } } = await real();
  const dir = await project('evidence/lifecycle');
  t.after(() => rm(dir, { recursive: true, force: true }));
  const intake = a.project.decisions.find(d => d.kind === 'intake');
  await writeFiles(dir, { [intake.path]: await read(example, intake.path) });
  await receiptDesign(dir);
  const life = 'gate/lifecycles/door';
  const initial = await accountOf(dir);
  await fixtureDecision(dir, { kind: 'confirm', on: life, pin: initial.design.units.get(life).pin,
    folder: 'design/parts/gate/lifecycles/door/decisions', at: '2020-01-01T00:00:00.000Z' });
  const before = await accountOf(dir);
  const journey = before.design.journeys.get('gate/journeys/reach-door--opened');
  assert.equal(journey?.added, 'offered', 'confirmation generates the reach journey');
  const name = await fixtureDecision(dir, { kind: 'decline', on: journey.name, pin: journey.pin, folder: 'design/parts/gate/decisions' });
  const graph = await buildGraph(dir);
  for (const [mode, g] of Object.entries(graph.modes)) {
    const decision = node(g, 'decision', name);
    assert.equal(decision?.data.state.state, 'in force');
    assert.ok(node(g, 'item', `repair:${name}`), `${mode}: declining the offer owes a repair`);
    assert.ok(edge(g, decision.id, 'repairs', id('entry', life), 'resolved repair'), `${mode}: repair names the source lifecycle`);
    assert.ok(!edge(g, decision.id, 'repairs', id('entry', journey.name)), 'the generated journey is not an editable repair target');
    assert.ok(decision.data.repairRoute.targets.some(target => target.id === id('entry', life)));
  }
});

for (const added of ['pick', 'kept']) test(`account.md §explorer-graph: declining a ${added} journey owes no repair route`, async t => {
  const dir = await copyExample();
  t.after(() => rm(dir, { recursive: true, force: true }));
  if (added === 'kept') {
    const fixture = historicalRuling();
    await writeFiles(dir, { [`design/parts/export-ticket/claims/one-receipt/decisions/${fixture.name}.md`]: fixture.text });
  }
  const before = await accountOf(dir);
  const journey = [...before.design.journeys.values()].find(j => j.added === added);
  assert.ok(journey);
  const name = await fixtureDecision(dir, { kind: 'decline', on: journey.name, pin: journey.pin, folder: 'design/parts/export-ticket/decisions' });
  const graph = await buildGraph(dir);
  for (const [mode, g] of Object.entries(graph.modes)) {
    const decision = node(g, 'decision', name);
    assert.equal(decision?.data.state.state, 'in force');
    assert.equal(node(g, 'entry', journey.name).data.state, 'declined');
    assert.ok(!node(g, 'item', `repair:${name}`), `${mode}: this decline owes no repair`);
    assert.deepEqual(g.edges.filter(e => e.source === decision.id && e.relation === 'repairs'), []);
    assert.deepEqual(decision.data.repairRoute?.targets ?? [], []);
  }
});

test('account.md §explorer-graph: a kept picture keeps the basis it was drawn from, its own trace source and its kept journeys', async t => {
  const dir = await copyExample();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const fixture = historicalRuling();
  const path = `design/parts/export-ticket/claims/one-receipt/decisions/${fixture.name}.md`;
  await writeFiles(dir, { [path]: fixture.text });
  const graph = await buildGraph(dir);
  for (const [mode, g] of Object.entries(graph.modes)) {
    assert.ok(node(g, 'decision', fixture.name), `the hand-written ruling is a valid record: ${JSON.stringify(node(g, 'file', path)?.data.reasons)}`);
    assert.ok(node(g, 'entry', fixture.journey), 'the ruling has an inspectable code-added journey');
    assert.ok(reference(g, id('entry', fixture.journey), id('decision', fixture.name)), 'the kept journey names its ruling');
    assert.ok(edge(g, id('entry', fixture.journey), 'cites', id('passage', 'design/brief/overview.md#claim-design'), 'Cites'));
    assert.ok(edge(g, id('entry', fixture.journey), 'names-action', id('entry', 'export-ticket/actions/check'), 'Action'));
    assert.ok(edge(g, id('entry', fixture.journey), 'steps-through', id('entry', lifecycle), 'Lifecycle'));
    const kept = g.diagrams.filter(d => d.variant.kind === 'kept' && d.variant.ruling === fixture.name);
    assert.equal(kept.length, 2, `${mode}: both traces of one lifecycle survive`);
    assert.equal(new Set(kept.map(d => d.id)).size, 2);
    for (const picture of fixture.pictures) {
      const d = kept.find(d => d.variant.source?.digest === picture.source.digest);
      assert.ok(d);
      assert.deepEqual(d.picture, picture);
      assert.deepEqual(d.basis, picture.basis);
      assert.equal(d.showing, fixture.shown);
      assert.ok(d.journeys.some(j => (j.id ?? j.name) === fixture.journey), 'the kept journey stays with the historical showing');
    }
    const current = g.diagrams.find(d => d.variant.kind === 'as-read' && d.lifecycle === lifecycle);
    assert.ok(!current.picture.phases.some(p => p.key === 'retired'));
    assert.notDeepEqual(current.basis, fixture.pictures[0].basis);
  }
});

test('account.md §explorer-graph: property-wrong repair routes name the ruled claim and model', async t => {
  const dir = await copyExample();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const text = historicalRuling().text.split('\n## Kept\n')[0].replace('| Verdict | model wrong |', '| Verdict | property wrong |');
  const name = `20200101T000000Z-rule-${sha256(text).slice(0, 12)}`;
  const path = `design/parts/export-ticket/claims/one-receipt/decisions/${name}.md`;
  await writeFiles(dir, { [path]: text });
  const graph = await buildGraph(dir);
  for (const [mode, g] of Object.entries(graph.modes)) {
    const decision = node(g, 'decision', name);
    assert.ok(decision, `the property-wrong ruling counts: ${JSON.stringify(node(g, 'file', path)?.data.reasons)}`);
    assert.equal(decision.data.repairRoute.verdict, 'property wrong');
    assert.ok(edge(g, decision.id, 'repairs', id('entry', 'export-ticket/claims/one-receipt'))?.data.field, `${mode}: the repair names the exact claim from its question`);
    assert.ok(edge(g, decision.id, 'repairs', id('model', 'export-ticket-tlc'))?.data.field, `${mode}: the model repair remains available`);
    assert.ok(!edge(g, decision.id, 'repairs', id('part', 'export-ticket')), 'a property-wrong route does not expand to its whole part');
  }
});

test('lifecycle-tool.md §as-read: multi-entity traces mark only identified moves, with entities and loops', async t => {
  const dir = await copyExample();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const question = 'export-ticket-tlc/parts/export-ticket/claims/one-receipt/witness-overlap-and-lost-reply.344f2c25ca7a';
  const path = `models/${question}.json`;
  const value = JSON.parse(await read(dir, path));
  const phases = (left, right) => ({ 'export-ticket/ticket-state': { t: left, u: right } });
  value.trace = { states: [
    { phases: phases('active-unclaimed', 'active-unclaimed') },
    { rows: [{ action: 'export-ticket/check' }], phases: phases('active-unclaimed', 'active-unclaimed') },
    { rows: [{ action: 'export-ticket/complete' }], phases: phases('active-claimed', 'active-unclaimed') },
    { rows: [{ action: 'export-ticket/complete' }], phases: phases('active-claimed', 'active-claimed') },
  ], loop: { to: 3, rows: [{ action: 'export-ticket/return-receipt' }] } };
  await writeFiles(dir, { [path]: seal(value) });
  const graph = await buildGraph(dir);
  const evidence = node(graph.modes.here, 'evidence', question);
  assert.ok(evidence, 'the sealed evidence fixture counts');
  const trace = graph.modes.here.diagrams.find(d => d.variant.kind === 'as-read' && d.lifecycle === lifecycle).traces.find(t => t.id === question);
  assert.ok(trace);
  assert.deepEqual(trace.trace, value.trace, 'unplaced self-loop and loop steps remain in the trace');
  const marks = trace.picture.marks;
  assert.deepEqual(marks.filter(m => m.phase).map(m => [m.phase, m.entity, m.steps, Boolean(m.loop)]), [
    ['active-unclaimed', 't', [0], false], ['active-unclaimed', 'u', [0], false],
    ['active-unclaimed', 't', [1], false], ['active-unclaimed', 'u', [1], false],
    ['active-claimed', 't', [2], false], ['active-unclaimed', 'u', [2], false],
    ['active-claimed', 't', [3], false], ['active-claimed', 'u', [3], false],
    ['active-claimed', 't', [4], true], ['active-claimed', 'u', [4], true],
  ], 'every state marks its known phases, even when the moving entity is not identified');
  assert.deepEqual(marks.filter(m => m.from).map(m => [m.from, m.action, m.to, m.entity, m.steps, m.loop]), [
    ['active-unclaimed', 'complete', 'active-claimed', 't', [2], false],
    ['active-unclaimed', 'complete', 'active-claimed', 'u', [3], false],
  ]);
  const numbered = trace.picture.moves.flatMap(m => m.steps.map(s => [m.action, s.step, s.loop]));
  assert.deepEqual(numbered, [['complete', 2, false], ['complete', 3, false]], 'neither stationary step can identify one of the two entities');
  assert.deepEqual(trace.picture.source, { question, digest: sha256(JSON.stringify(value.trace)) });
});
