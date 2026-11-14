// The design as a project reads (forms.md §code-premises to design.md §units-and-pins, with decisions.md §confirm, §pick, §kept-journeys, §in-force
// as the design reads them): each lifecycle as read, every journey written or code-added, every
// unit with its state, which decision is in force with the journeys code adds, the lifecycle tool's
// facts, every premise, and coverage. Computed at every read and stored nowhere (account.md §what-it-is).

import { inForce, inOrder } from '../record/decisions.mjs';
import { compare, sortedBy } from '../record/json.mjs';
import { coverage, resolveRef } from '../record/pages.mjs';
import { confirmedOffered, generatedOffered, keptJourneys, pickJourneys, premisesOf } from './added.mjs';
import { findingOf, LazyMap, lifecycleAsRead, lifecycleFindings, shortestJourneys, stepJourney } from './lifecycle-tool.mjs';

/** The kinds of decision that confirm a unit while in force (decisions.md §in-force). */
const CONFIRMING = new Set(['confirm', 'redirect', 'pick', 'rule']);

/**
 * A unit's state (decisions.md §confirm, §in-force): `confirmed` while a confirmation, a confirming redirect, a pick or a ruling is
 * in force on it, `declined` while a decline is, `lapsed` when none is and its latest lapsed decision confirmed it, and
 * `unconfirmed` otherwise.
 */
function stateOf(record) {
  const d = record?.inForce;
  if (d && CONFIRMING.has(d.kind)) return 'confirmed';
  if (d?.kind === 'decline') return 'declined';
  const lapsed = inOrder(record?.lapsed ?? []);
  const last = lapsed[lapsed.length - 1];
  return last && (last.kind === 'confirm' || last.kind === 'redirect') ? 'lapsed' : 'unconfirmed';
}

/** A subject of decisions.md §in-force for a journey code adds: a unit, with its pick or its kept record (src/record/decisions.mjs inForce). */
function subjectOf(journey) {
  return {
    type: 'unit', name: journey.name, pin: journey.pin, claimParts: new Set(),
    ...(journey.added === 'pick' ? { pick: journey.choice } : {}),
    ...(journey.added === 'kept' ? { kept: { surprise: journey.surprise, pin: journey.keptPin } } : {}),
  };
}

/** A failure of check 2 or 3 that is a citation, which the item `passage:` owes, keeps the tool from checking nothing (lifecycle-tool.md §findings, design.md §at-read). */
const blocksTool = (failure) => !failure.address;

/** Why the tool cannot check a lifecycle (lifecycle-tool.md §findings `unchecked`): a page it needs that counts for nothing, check 2 or 3 failing for it other than by a citation, its posed cells' effects. */
function lifecycleBlocks(restatement, lifecycle, problems) {
  const reasons = restatement.failures.filter((f) => f.file === lifecycle.page && blocksTool(f)).map((f) => ({ kind: 'check', check: f.check, field: f.field, says: f.says, address: f.address ?? null }));
  const actions = restatement.parts.get(lifecycle.holder.key)?.tables.actions;
  if (actions?.exists && !actions.counts) reasons.push({ kind: 'page', path: actions.path, says: `the page ${actions.path}, which holds its part's actions, counts for nothing (change:${actions.path})` });
  return [...reasons, ...problems];
}

/** Why the tool cannot check a journey (lifecycle-tool.md §findings `unchecked`): check 2 or 3 failing for its page other than by a citation, or a page it needs that counts for nothing. */
function journeyBlocks(restatement, journey) {
  const reasons = journey.page ? restatement.failures.filter((f) => f.file === journey.page && blocksTool(f)).map((f) => ({ kind: 'check', check: f.check, field: f.field, says: f.says, address: f.address ?? null })) : [];
  const pages = new Set();
  for (const row of journey.start ?? []) {
    const ref = resolveRef(restatement, row.lifecycle, journey.from, 'lifecycles');
    if (ref.holds && !ref.entry) pages.add(restatement.parts.get(ref.part)?.thingPages.lifecycles.get(ref.key)?.path);
  }
  for (const step of journey.steps ?? []) {
    const ref = resolveRef(restatement, step.action, journey.from, 'actions');
    const part = ref.holds ? restatement.parts.get(ref.part) : null;
    if (!part) continue;
    if (!ref.entry) pages.add(part.tables.actions?.path);
    for (const page of part.thingPages.lifecycles.values()) if (page.exists && !page.counts) pages.add(page.path);
  }
  for (const path of [...pages].filter(Boolean).sort(compare)) reasons.push({ kind: 'page', path, says: `the page ${path} it steps through counts for nothing (change:${path})` });
  return reasons;
}

/** The `unchecked` finding of lifecycle-tool.md §findings for what the tool could not check, naming why and what clears it. */
function uncheckedFinding(on, holder, reasons) {
  const clears = [];
  // A failure of check 2 or 3 is owed by restate: (design.md §at-read); a citation, owed by passage:, is never a reason here.
  if (reasons.some((r) => r.kind === 'check')) clears.push(`a Restate answer of ${holder} that mends what check 2 or 3 of design.md §restate-checks finds (restate:${holder})`);
  if (reasons.some((r) => r.kind === 'page')) clears.push('restoring each page that counts for nothing, or an answer that holds it again');
  if (reasons.some((r) => r.kind === 'limit')) clears.push('fewer phases or lifecycles in the part');
  const then = clears.length ? ` What lets the tool check it: ${clears.join('; or ')}.` : '';
  return findingOf('unchecked', on, { why: reasons[0]?.kind ?? 'tool', reasons }, [on], `the tool could not check ${on}: ${reasons.map((r) => r.says).join('; ')}.${then}`);
}

/**
 * The design of a project (forms.md §code-premises to design.md §restate), from `project = await readProject(root)`: `{ lifecycles, journeys, units,
 * force, tool, premises, coverage, picks }` (each key below). `assume` lists decisions, in src/record/decisions.mjs's
 * parsed form, to read as made, as `forma show` asks of a pick (decisions.md §pick, §forma-show).
 *
 * - `lifecycles`: Map by entry name: the lifecycle as src/record/ parses it, with `part`, `asRead`, `fills`, `posed`,
 *   `pin`, `state`, `confirmed` and `unchecked` (why the tool could not check it, or []: each `{ kind, says }`, `kind`
 *   `check` for check 2 or 3 failing for its page other than by a citation, `page` for a page it needs that counts for
 *   nothing, or `limit` for lifecycle-tool.md §shortest's limit passed in its part).
 * - `journeys`: Map by name `<part or span>/journeys/<key>`, written and code-added: the journey form with `name`,
 *   `key`, `holder` (its part's or span's key), `span`, `from` (`{ key, span }`), `page`, `heading`, `folder` (under
 *   each model, `models/<model>/<folder>`), `parts`, `refs`,
 *   `added` (null, `pick`, `offered` or `kept`), `goesWith` (the choice's or lifecycle's entry name, or the part's or
 *   span's key, or null), `pin`, `state`, `confirmed`, `declined`.
 * - `units`: Map by unit name: `{ name, kind, pin, entries, state }`, the journeys code adds included.
 * - `force`: src/record/decisions.mjs inForce over every subject, the journeys code adds with their `pick` and `kept`.
 * - `tool`: `{ findings, shortest, stepped }`: every finding of lifecycle-tool.md §findings; each shortest journey by
 *   `'<lifecycle entry>--<phase>'` (lifecycle-tool.md §shortest), its steps in the offered journey's form (a LazyMap of lifecycle-tool.mjs,
 *   read as a Map, each journey built when first read); each journey's stepping (lifecycle-tool.md §stepping),
 *   as stepJourney gives it, or with `ended.why` `unchecked` and nothing stepped where a page it needs counts for
 *   nothing or check 2 or 3 fails for its page other than by a citation, which the item `passage:` owes (lifecycle-tool.md §findings).
 * - `premises`: every premise, page or code-added (forms.md §code-premises), each premise code adds with the class, statement, falsifier and
 *   provider of forms.md §premise-says's table. `coverage`: design.md §coverage, the journeys code adds' citations included.
 * - `picks`: Map by choice entry name: `{ choice, pick, decision, journeys, fills }`, each pick in force and what it fills.
 */
export function readDesign(project, { assume = [] } = {}) {
  const { restatement, brief } = project;
  const decisions = [...project.decisions, ...assume];
  const unitOf = (name) => project.unitOf(name) ?? name;
  const pinned = restatement.pins;
  const force0 = inForce(decisions, project.subjects, { unitOf });

  // Each pick in force (decisions.md §pick, §in-force), by its choice's entry name.
  const picks = new Map();
  for (const thing of restatement.things.values()) {
    const d = thing.kind === 'choices' ? force0.subjects.get(thing.entry, 'choice')?.inForce : null;
    if (d?.kind === 'pick' && (d.rows.Choice === 'a' || d.rows.Choice === 'b')) picks.set(thing.entry, { pick: d.rows.Choice, decision: d });
  }
  const pickOf = new Map([...picks].map(([name, p]) => [name, p.pick]));

  // Each lifecycle as read (lifecycle-tool.md §as-read), and why the tool could not check it (lifecycle-tool.md §findings).
  const lifecycles = new Map();
  for (const thing of sortedBy([...restatement.things.values()].filter((t) => t.kind === 'lifecycles'), (t) => t.entry)) {
    const part = restatement.parts.get(thing.holder.key);
    const read = lifecycleAsRead(thing, part, pickOf);
    lifecycles.set(thing.entry, {
      ...thing, part: thing.holder.key, asRead: read.asRead, fills: read.fills, posed: read.posed,
      pin: pinned.entries.get(thing.entry)?.pin ?? null, unchecked: lifecycleBlocks(restatement, thing, read.problems),
    });
  }
  // The shortest journeys of each part (lifecycle-tool.md §shortest), each step in the offered journey's form (design.md §code-journeys): its Actor the Names of
  // its action's actor, its Arguments and Entity `-`. A search past lifecycle-tool.md §shortest's limit leaves the part's lifecycles unchecked.
  // Each is built when first read (a LazyMap), since only the offered journeys of confirmed lifecycles ask for one.
  const shortestOf = new Map();
  for (const part of restatement.parts.values()) {
    const own = [...lifecycles.values()].filter((l) => l.part === part.key);
    if (!own.length) continue;
    const { journeys, failed } = shortestJourneys(own, part.actions);
    for (const key of journeys.keys()) shortestOf.set(key, { part, journeys });
    if (failed) for (const l of own) l.unchecked.push({ kind: 'limit', says: failed });
  }
  const shortest = new LazyMap(shortestOf, ({ part, journeys }, key) => journeys.get(key).map((s, at) => {
    const action = part.actions.find((a) => a.key === s.action);
    const actor = action ? resolveRef(restatement, action.actor, { key: part.key, span: false }, 'boundary').entry : null;
    return { step: at + 1, actor: actor?.names ?? action?.actor ?? '-', action: s.action, arguments: '-', entity: null, case: s.case ?? null };
  }));

  // The journeys: written, a pick's and kept, then offered ones (design.md §code-journeys).
  const pageJourneys = sortedBy([...restatement.things.values()].filter((t) => t.kind === 'journeys'), (t) => t.entry).map((thing) => ({
    ...thing, name: thing.entry, heading: thing.name, holder: thing.holder.key, span: thing.holder.span, from: thing.holder,
    folder: `${thing.holder.span ? 'spans' : 'parts'}/${thing.holder.key}/journeys/${thing.key}`,
    parts: restatement.thingParts.get(thing.entry) ?? [], refs: restatement.refs.get(thing.entry) ?? {}, added: null, goesWith: null,
    pin: pinned.entries.get(thing.entry)?.pin ?? null, text: pinned.entries.get(thing.entry)?.text ?? null,
  }));
  const taken = new Set(pageJourneys.map((j) => j.name));
  const unique = (list) => list.filter((j) => !taken.has(j.name) && taken.add(j.name));
  const picked = unique(pickJourneys(restatement, picks));
  const kept = unique(keptJourneys(restatement, force0));
  const allActions = [...restatement.parts.values()].flatMap((p) => p.actions);
  const stepped = new Map();
  const blocks = new Map();
  const step = (journey) => {
    const reasons = journeyBlocks(restatement, journey);
    blocks.set(journey.name, reasons);
    stepped.set(journey.name, reasons.length
      ? { journey: journey.name, admitted: 0, refusedAt: null, reached: [], moves: [], ended: { why: 'unchecked', step: 0, says: reasons.map((r) => r.says).join('; ') }, steps: [], entities: [], final: [], findings: [] }
      : stepJourney(lifecycles, allActions, journey));
  };
  for (const journey of [...pageJourneys, ...picked, ...kept]) step(journey);

  // Offered journeys (design.md §code-journeys): read from a confirmation, or offered afresh to each phase of a confirmed lifecycle that no
  // confirmed journey other than an offered one reaches, judged by what is in force with the pick's and kept journeys.
  const forceA = inForce(decisions, [...project.subjects, ...[...picked, ...kept].map(subjectOf)], { unitOf });
  const isConfirmed = (name) => CONFIRMING.has(forceA.subjects.get(name, 'unit')?.inForce?.kind);
  for (const l of lifecycles.values()) l.confirmed = isConfirmed(l.entry);
  const reached = new Set();
  for (const journey of [...pageJourneys, ...picked, ...kept]) {
    if (!isConfirmed(journey.name)) continue;
    for (const r of stepped.get(journey.name).reached) reached.add(`${r.lifecycle}\0${r.phase}`);
  }
  const confirmedOffer = unique(confirmedOffered(restatement, decisions));
  const offered = unique(generatedOffered(restatement, { lifecycles: [...lifecycles.values()], shortest, reached, taken: new Set(taken) }));
  for (const journey of [...confirmedOffer, ...offered]) step(journey);
  const added = [...picked, ...kept, ...confirmedOffer, ...offered];

  // Which decision is in force over every subject, the journeys code adds included (decisions.md §in-force).
  const force = inForce(decisions, [...project.subjects, ...added.map(subjectOf)], { unitOf });
  const units = new Map();
  for (const unit of pinned.units.values()) units.set(unit.name, { name: unit.name, kind: unit.kind, pin: unit.pin, entries: unit.entries, text: unit.text, state: stateOf(force.subjects.get(unit.name, 'unit')) });
  const journeys = new Map();
  for (const journey of sortedBy([...pageJourneys, ...added], (j) => j.name)) {
    let state = stateOf(force.subjects.get(journey.name, 'unit'));
    // A kept journey whose pin is not the one its ruling's ## Kept records has lost its confirmation (design.md §code-journeys).
    if (journey.added === 'kept' && state === 'unconfirmed' && journey.keptPin !== journey.pin) state = 'lapsed';
    Object.assign(journey, { state, confirmed: state === 'confirmed', declined: state === 'declined' });
    journeys.set(journey.name, journey);
    if (journey.added) units.set(journey.name, { name: journey.name, kind: 'journeys', pin: journey.pin, entries: [journey.name], text: journey.text, added: journey.added, state });
  }
  for (const l of lifecycles.values()) {
    l.state = units.get(l.entry)?.state ?? stateOf(force.subjects.get(l.entry, 'unit'));
    l.confirmed = l.state === 'confirmed';
  }

  // The lifecycle tool's findings (lifecycle-tool.md §findings): on each lifecycle, then on each journey, in name order.
  const findings = [];
  for (const l of lifecycles.values()) {
    if (l.unchecked.length) findings.push(uncheckedFinding(l.entry, l.part, l.unchecked));
    else findings.push(...lifecycleFindings(l, restatement.parts.get(l.part)));
  }
  for (const journey of journeys.values()) {
    const reasons = blocks.get(journey.name) ?? [];
    if (reasons.length) findings.push(uncheckedFinding(journey.name, journey.holder, reasons));
    else findings.push(...(stepped.get(journey.name)?.findings ?? []));
  }
  const pickRecords = new Map([...picks].map(([name, p]) => [name, {
    choice: name, pick: p.pick, decision: p.decision.name,
    journeys: added.filter((j) => j.added === 'pick' && j.choice === name).map((j) => j.name),
    fills: [...lifecycles.values()].flatMap((l) => l.fills.filter((f) => f.choice === name).map((f) => ({ lifecycle: l.entry, ...f }))),
  }]));

  return {
    lifecycles,
    journeys,
    units,
    force,
    tool: { findings, shortest, stepped },
    premises: premisesOf(restatement, project.premises ?? {}, force, picks),
    coverage: coverage(restatement, brief, added.map((j) => ({ entry: j.name, cites: j.cites }))),
    picks: pickRecords,
  };
}
