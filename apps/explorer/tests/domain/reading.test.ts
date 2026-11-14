// The reading derived from the examples' graphs (presentation.md §explorer), checked as data: what the page
// will show, before anything draws it.
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { deriveReading } from '../../src/domain/derive/index.ts';
import type { Graph } from '../../src/domain/graph.ts';
import { Reading, ThingKind, type LifecycleDrawing, type Note, type Ref, type Standing, type Thing, type ThingOf } from '../../src/domain/reading.ts';
import { EXAMPLES, exampleGraph, type Example } from '../examples.ts';

const STANDINGS: Standing[] = ['recorded', 'here'];
const graphs = new Map<Example, Graph>();
const readings = new Map<string, Reading>();
const timings: string[] = [];
const reading = (example: Example, standing: Standing): Reading => {
  const r = readings.get(`${example}.${standing}`);
  assert.ok(r, `${example} ${standing} was derived`);
  return r;
};

before(async () => {
  for (const example of EXAMPLES) {
    const graph = await exampleGraph(example);
    graphs.set(example, graph);
    for (const standing of STANDINGS) {
      const start = performance.now();
      readings.set(`${example}.${standing}`, deriveReading(graph, standing));
      timings.push(`${example} ${standing}: ${(performance.now() - start).toFixed(1)} ms`);
    }
  }
});

// ---------- walking a reading ----------

const isRef = (x: unknown): x is Ref =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as Ref).id === 'string' &&
  typeof (x as Ref).label === 'string' &&
  ThingKind.safeParse((x as Ref).kind).success;

function refsIn(value: unknown, found: Ref[] = []): Ref[] {
  if (Array.isArray(value)) for (const v of value) refsIn(v, found);
  else if (typeof value === 'object' && value !== null) {
    if (isRef(value)) found.push(value);
    for (const v of Object.values(value)) refsIn(v, found);
  }
  return found;
}

const sections = (r: Reading) => r.sheet.documents.flatMap((d) => d.sections);
const things = <K extends Thing['kind']>(r: Reading, kind: K) =>
  Object.values(r.things).filter((t): t is ThingOf<K> => t.kind === kind);
const noteRefs = (n: Note): Ref[] =>
  n.kind === 'found' ? n.revisions.map((x) => x.ref) : n.kind === 'leftOpen' || n.kind === 'restated' ? [n.ref] : n.kind === 'leftOut' ? [] : n.refs;
const claimEntries = (graph: Graph, standing: Standing) =>
  graph.modes[standing].nodes.flatMap((n) => (n.kind === 'entry' && n.data.kind === 'claims' ? [{ ...n, data: n.data }] : []));

// ---------- every reading ----------

test('reading.ts: each reading of both examples, in both standings, is a Reading', () => {
  for (const example of EXAMPLES) for (const standing of STANDINGS) Reading.parse(reading(example, standing));
});

test('presentation.md §explorer, "Opening": every name on the sheet or inside a thing opens a thing given in the reading', () => {
  for (const example of EXAMPLES)
    for (const standing of STANDINGS) {
      const r = reading(example, standing);
      for (const ref of refsIn(r)) {
        const thing = r.things[ref.id];
        assert.ok(thing, `${example} ${standing}: ${ref.id} is given`);
        assert.equal(thing.kind, ref.kind, `${ref.id} opens a ${ref.kind}`);
      }
      for (const t of Object.values(r.things))
        if (t.kind === 'claim' || t.kind === 'scenario')
          for (const id of t.rulings) assert.equal(r.things[id]?.kind, 'ruling', `${t.id}'s ruling ${id} is given`);
    }
});

test('presentation.md §explorer: a section is `p-` and its percent-encoded passage address; the two readings share a generation', () => {
  for (const example of EXAMPLES) {
    const [recorded, here] = STANDINGS.map((s) => reading(example, s));
    for (const s of sections(recorded!)) assert.equal(s.id, `p-${encodeURIComponent(s.address)}`);
    assert.equal(recorded!.sheet.standing, 'recorded');
    assert.equal(here!.sheet.standing, 'here');
    assert.equal(recorded!.sheet.generation, here!.sheet.generation);
    assert.equal(recorded!.sheet.generation, graphs.get(example)?.generation);
  }
});

// ---------- the document ----------

test('presentation.md §explorer, "The document": the documents stand as written, in reading order', () => {
  const r = reading('export-ticket', 'recorded');
  const ids = sections(r).map((s) => s.id);
  const overview = ids.indexOf('p-design%2Fbrief%2Foverview.md%23purpose');
  const change = ids.findIndex((id) => id.startsWith('p-design%2Fbrief%2Fchanges%2Fv2.md'));
  assert.ok(overview >= 0 && change > overview, 'the overview is read before the document that changes it');
  assert.deepEqual(
    r.sheet.documents.map((d) => [d.number, d.path]),
    [
      [1, 'design/brief/overview.md'],
      [2, 'design/brief/changes/v2.md'],
    ],
  );
  assert.ok(
    sections(r).some((s) => /<ol>\s*<li>Do not create access after expiry\.<\/li>/.test(s.html)),
    'a list in the brief is a list on the page',
  );
  for (const example of EXAMPLES) {
    const all = sections(reading(example, 'recorded'));
    for (const s of all) {
      assert.ok(!/<script|<link|<img|style="/.test(s.html), `${s.id} holds no script, stylesheet, image or inline style`);
      for (const [, target] of s.html.matchAll(/href="#([^"]+)"/g))
        assert.ok(all.some((x) => x.id === target), `${s.id} links to ${target}, on the page`);
    }
  }
});

// ---------- the notes ----------

test('presentation.md §explorer, "Notes": each thing is met once in the notes, and named again only as met above', () => {
  for (const example of EXAMPLES)
    for (const standing of STANDINGS) {
      const r = reading(example, standing);
      const met = new Map<string, number>();
      sections(r).forEach((s, i) => {
        for (const ref of s.notes.flatMap(noteRefs)) {
          if (ref.again) assert.ok((met.get(ref.id) ?? i) < i, `${ref.id}, named again at ${s.id}, was met above`);
          else if (ref.kind !== 'section') {
            assert.ok(!met.has(ref.id), `${ref.id} is met once`);
            met.set(ref.id, i);
          }
        }
      });
      for (const claim of claimEntries(graphs.get(example)!, standing)) assert.ok(met.has(claim.id), `${claim.key} is met`);
    }
  const alsoAbove = sections(reading('export-ticket', 'recorded')).flatMap((s) => s.notes.filter((n) => n.kind === 'alsoAbove'));
  assert.ok(alsoAbove.some((n) => /^\d+ claims?\b/.test(n.label)));
});

test('presentation.md §explorer, "Notes": a passage\'s restatement counts what is met there, or what was restated above', () => {
  const r = reading('export-ticket', 'recorded');
  const restated = sections(r).flatMap((s) => s.notes.filter((n) => n.kind === 'restated'));
  assert.ok(restated.some((n) => n.kind === 'restated' && n.ref.label === '5 actions, 1 lifecycle, 11 scenarios and 5 actors and records'));
  assert.ok(restated.some((n) => n.kind === 'restated' && /^restated above \(\d+\)$/.test(n.ref.label)));
  for (const n of restated) if (n.kind === 'restated') assert.equal(r.things[n.ref.id]?.kind, 'section');
});

// ---------- the top ----------

test("presentation.md §explorer, \"The top\": the general notes say the standing once, in the page's words", () => {
  const lines = reading('export-ticket', 'recorded').sheet.general.map((runs) => runs.map((x) => x.text).join(''));
  assert.equal(lines[0], '0 of 5 claims established.');
  assert.equal(lines.filter((l) => l.includes('wait on an unfinished check (ran out of time: stopped after 1800 s)')).length, 1);
  const revisions = reading('export-ticket', 'recorded').sheet.general.find((runs) => runs.some((x) => x.tone === 'revision'));
  assert.deepEqual(revisions, [{ text: '3 revisions: faults found in the design · 3 mechanisms added, not in the document.', tone: 'revision' }]);
  assert.ok(lines.some((l) => /^\d+ assumptions? taken on, unchecked\.$/.test(l)));
  assert.ok(lines.some((l) => /^Decisions: .* · declared\.$/.test(l)));
  const paperclip = reading('paperclip-erp', 'recorded').sheet.general.map((runs) => runs.map((x) => x.text).join(''));
  assert.equal(paperclip[0], '8 of 12 claims established, within bounds.');
});

test('presentation.md §explorer, "Revisions": revisions are numbered in reading order and listed in the title block', () => {
  const r = reading('export-ticket', 'recorded');
  assert.deepEqual(
    r.sheet.title.revisions.map((x) => x.number),
    [1, 2, 3],
  );
  const marks = sections(r).flatMap((s) => s.notes.flatMap((n) => (n.kind === 'found' ? n.revisions.map((x) => ({ number: x.number, at: s.id })) : [])));
  assert.deepEqual(
    marks.map((m) => m.number),
    [1, 2, 3],
    'the marks beside the document rise as it is read',
  );
  for (const rev of r.sheet.title.revisions) {
    assert.equal(rev.sectionId, marks.find((m) => m.number === rev.number)?.at, `revision ${rev.number} links to its passage`);
    assert.equal(things(r, 'ruling').find((t) => t.id === rev.ref.id)?.revision, rev.number);
  }
  assert.ok(things(r, 'model').some((m) => m.changedBy.some((x) => x.revisions?.[0] === 1)), 'a revision is marked where its ruling is named');
});

test('presentation.md §explorer, "Standing": where the two standings differ, a cell says so', () => {
  const graph = graphs.get('export-ticket')!;
  const hereCause = [...graph.modes.here.causes].sort((a, b) => (b.lines?.length ?? 0) - (a.lines?.length ?? 0))[0];
  assert.deepEqual(reading('export-ticket', 'recorded').sheet.title.differs, { label: 'here differs', says: hereCause?.says });
  assert.deepEqual(reading('export-ticket', 'here').sheet.title.differs, { label: 'as recorded', says: 'differs' });
});

// ---------- never more than Forma knows ----------

test('presentation.md §explorer, "Marks": no claim not established shows as established anywhere', () => {
  for (const example of EXAMPLES)
    for (const standing of STANDINGS) {
      const r = reading(example, standing);
      const label = new Map(claimEntries(graphs.get(example)!, standing).map((c) => [c.id, c.data.standing.label]));
      const markOf = (id: string) => ({ established: 'established', accepted: 'accepted' })[label.get(id) as string] ?? 'not';
      for (const ref of refsIn(r).filter((x) => x.kind === 'claim')) assert.equal(ref.mark, markOf(ref.id), `${ref.id} is marked as it stands`);
      for (const claim of things(r, 'claim')) {
        assert.equal(claim.standing, markOf(claim.id));
        if (claim.standing !== 'not') continue;
        assert.match(claim.standingLine, /^Not established · waits on /);
        for (const m of claim.models) {
          assert.equal(m.established, false);
          assert.ok(m.checks.earlier.every((c) => c.mark === 'earlier'), 'a check on an earlier model is marked earlier');
        }
      }
    }
  for (const claim of things(reading('export-ticket', 'recorded'), 'claim')) {
    assert.ok(claim.models.every((m) => m.checks.now.every((c) => c.mark !== 'yes')), `${claim.id} carries no tick`);
    assert.match(claim.standingLine, /^Not established · waits on an unfinished check/);
  }
  const oneReceipt = reading('export-ticket', 'recorded').things['entry:export-ticket%2Fclaims%2Fone-receipt'];
  assert.ok(oneReceipt?.kind === 'claim');
  const tlc = oneReceipt.models.find((m) => m.model.id === 'model:export-ticket-tlc');
  assert.ok(tlc && tlc.checks.now.length === 0 && tlc.checks.earlier.length > 0, 'its checks on an earlier model are kept apart');
  const established = things(reading('paperclip-erp', 'recorded'), 'claim').filter((c) => c.standing === 'established');
  assert.equal(established.length, 8);
  for (const c of established) assert.equal(c.standingLine, 'Established on stock-to-cash, within bounds.');
});

test('presentation.md §explorer, claim: where the engine cannot express a claim, the reason and nothing more', () => {
  let seen = 0;
  for (const example of EXAMPLES)
    for (const claim of things(reading(example, 'recorded'), 'claim'))
      for (const m of claim.models.filter((x) => x.cannotExpress !== null)) {
        seen += 1;
        assert.ok(m.cannotExpress && !m.cannotExpress.startsWith('its encoding says'));
        assert.deepEqual([m.inPlace, m.notYet, m.encoding, m.checks, m.premises.refs], [[], [], null, { now: [], earlier: [] }, []]);
      }
  assert.ok(seen > 0);
});

// ---------- a lifecycle drawn ----------

test('presentation.md §explorer, "A lifecycle drawn": a scenario lights its path and marks the step that must be refused', () => {
  const r = reading('export-ticket', 'recorded');
  const scenario = r.things['entry:export-ticket%2Fjourneys%2Fno-late-creation'];
  assert.ok(scenario?.kind === 'scenario');
  assert.equal(scenario.polarity, 'must not');
  assert.deepEqual(
    scenario.steps.filter((s) => s.refused).map((s) => s.n),
    [3],
  );
  assert.equal(scenario.walk, '3 steps admitted · active-unclaimed → expired-unclaimed');
  const [drawing] = scenario.drawings;
  assert.ok(drawing?.lit);
  const refused = drawing.moves.flatMap((m) => m.actions.filter((a) => a.mustNot).map((a) => ({ ...m, ...a })));
  assert.deepEqual(
    refused.map((m) => [m.from, m.to, m.label, m.steps]),
    [['expired-unclaimed', 'expired-claimed', 'complete', [3]]],
  );
  assert.deepEqual(
    drawing.phases.filter((p) => p.visited).map((p) => p.id),
    ['active-unclaimed', 'expired-unclaimed'],
  );
  assert.ok(scenario.rulings.some((id) => r.things[id]?.kind === 'ruling' && (r.things[id] as ThingOf<'ruling'>).revision === 1));
});

test('presentation.md §explorer, "A lifecycle drawn": one arrow per pair of phases, stays and open cells under their phase', () => {
  for (const example of EXAMPLES) {
    const r = reading(example, 'recorded');
    const drawings = Object.values(r.things).flatMap((t) =>
      t.kind === 'lifecycle' ? [t.drawing] : t.kind === 'scenario' ? t.drawings : t.kind === 'section' ? t.states.map((s) => s.drawing) : [],
    );
    assert.ok(drawings.length > 0);
    for (const d of drawings) {
      const phases = d.phases.map((p) => p.id);
      const pairs = d.moves.map((m) => `${m.from}|${m.to}`);
      assert.equal(new Set(pairs).size, pairs.length, `${d.id}: one arrow for each pair of phases`);
      for (const m of d.moves) assert.ok(m.from !== m.to && phases.includes(m.from) && phases.includes(m.to));
      assert.equal(new Set(d.stays.map((s) => s.phase)).size, d.stays.length);
      for (const s of [...d.stays.map((x) => x.phase), ...d.open.map((x) => x.phase)]) assert.ok(phases.includes(s));
      assert.equal(d.phases.filter((p) => p.initial).length, 1, `${d.id} has one initial phase`);
      if (!d.lit) {
        const actions = [...d.moves, ...d.stays].flatMap((m) => m.actions);
        assert.ok(actions.every((a) => !a.steps.length && !a.mustNot) && d.refusedAt === null && d.phases.every((p) => !p.visited));
      }
    }
  }
});

test('presentation.md §explorer, "A lifecycle drawn": the lifecycle is drawn as read, a picked cell filled and every step of a walk lit', () => {
  for (const example of EXAMPLES)
    for (const standing of STANDINGS) {
      const mode = graphs.get(example)?.modes[standing];
      assert.ok(mode);
      const r = reading(example, standing);
      const drawingOf = (lifecycle: string) => {
        const thing = r.things[`entry:${encodeURIComponent(lifecycle)}`];
        return thing?.kind === 'lifecycle' ? thing : undefined;
      };
      // lifecycle-tool.md §as-read: the cells a choice still poses, and the moves, are the picture's.
      for (const d of mode.diagrams) {
        if (d.variant.kind !== 'as-read' || !d.picture || !d.lifecycle) continue;
        const thing = drawingOf(d.lifecycle);
        if (!thing) continue;
        const { picture } = d;
        const posed = picture.phases.flatMap(({ key }) =>
          picture.actions.flatMap((action) => {
            const cell = picture.cells[key]?.[action];
            if (cell?.kind === 'choice') return [`${key}|${action}`];
            if (cell?.kind === 'cases') return cell.cases.filter((k) => k.outcome.kind === 'choice').map((k) => `${key}|${action} (${k.case})`);
            return [];
          }),
        );
        assert.deepEqual(thing.drawing.open.map((o) => `${o.phase}|${o.action}`), posed, `${example} ${standing}: ${d.lifecycle} lists the cells still posed`);
        const drawn = [...thing.drawing.moves, ...thing.drawing.stays].reduce((n, m) => n + m.actions.length, 0);
        assert.equal(drawn, picture.moves.length, `${d.lifecycle}: every move of the picture is drawn once`);
        assert.deepEqual(thing.table.rows.map((row) => row.phase), picture.phases.map((p) => p.key));
      }
      // lifecycle-tool.md §stepping: each step of a walk that leaves a phase lights the move it takes.
      for (const n of mode.nodes) {
        if (n.kind !== 'entry' || n.data.kind !== 'journeys' || !n.data.walk) continue;
        const scenario = r.things[n.id];
        if (scenario?.kind !== 'scenario') continue;
        for (const m of n.data.walk.moves) {
          if (m.from === null) continue;
          const drawing: LifecycleDrawing | undefined = scenario.drawings.find((x) => x.id === `entry:${encodeURIComponent(m.lifecycle)}`);
          assert.ok(drawing, `${n.id} draws ${m.lifecycle}`);
          const label = m.case ? `${m.action} (${m.case})` : m.action;
          const lit: LifecycleDrawing['moves'][number]['actions'][number] | undefined =
            m.from === m.to
              ? drawing.stays.find((s) => s.phase === m.from)?.actions.find((a) => a.label === label)
              : drawing.moves.find((x) => x.from === m.from && x.to === m.to)?.actions.find((a) => a.label === label);
          assert.ok(lit?.steps.includes(m.step), `${example} ${standing}: ${n.id} lights step ${m.step}, ${m.from} to ${m.to} by ${label}`);
        }
      }
    }
  // The example's pick: `fetch-after-expiry` is picked, so the cell it posed reads as the picked alternative gives it.
  const ticket = reading('export-ticket', 'recorded').things['entry:export-ticket%2Flifecycles%2Fticket-state'];
  assert.ok(ticket?.kind === 'lifecycle');
  assert.ok(!ticket.drawing.open.some((o) => o.phase === 'expired-claimed' && o.action === 'fetch-receipt'));
  assert.ok(ticket.drawing.stays.find((s) => s.phase === 'expired-claimed')?.actions.some((a) => a.label === 'fetch-receipt'));
});

// ---------- the lists ----------

test("presentation.md §explorer, \"The lists\": each claim and each assumption in force once, and the account's limits", () => {
  for (const example of EXAMPLES)
    for (const standing of STANDINGS) {
      const graph = graphs.get(example)!;
      const { lists } = reading(example, standing).sheet;
      const listed = lists.claims.flatMap((g) => g.rows.map((x) => x.ref.id));
      assert.deepEqual([...listed].sort(), claimEntries(graph, standing).map((c) => c.id).sort());
      const premises = graph.modes[standing].nodes.flatMap((n) =>
        n.kind === 'premise' && (n.data.carry?.carried || n.data.counted) ? [n] : [],
      );
      const assumed = [...lists.assumptions.rows.map((x) => x.ref), ...lists.assumptions.bounds.flatMap((b) => b.rows.map((x) => x.ref))];
      assert.equal(assumed.length, premises.length);
      const keyOf = (id: string) => decodeURIComponent(id.slice(id.indexOf(':') + 1));
      assert.deepEqual(assumed.map((x) => keyOf(x.id)).sort(), premises.map((p) => p.key).sort());
      for (const b of lists.assumptions.bounds) assert.equal(b.taken, b.rows.filter((x) => !x.ref.untaken).length);
      assert.deepEqual(lists.limits, graph.cannotKnow);
    }
});

test('presentation.md §explorer, "No filler": what marks and words mean is said only in the help dialog', () => {
  for (const example of EXAMPLES)
    for (const standing of STANDINGS) {
      const text = JSON.stringify(reading(example, standing));
      for (const phrase of ['Steps that should happen, or must not.', 'A claim not established.', 'What must hold.']) assert.ok(!text.includes(phrase));
    }
});

test('the derivation takes milliseconds per standing', (t) => {
  for (const line of timings) t.diagnostic(line);
  assert.equal(timings.length, EXAMPLES.length * STANDINGS.length);
});
