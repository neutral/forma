// The lifecycle tool (lifecycle-tool.md): a lifecycle as read, with the cells the picks in force fill,
// and its structured picture (lifecycle-tool.md §as-read); stepping a journey through the lifecycles (lifecycle-tool.md §stepping); the shortest
// journeys of a part (lifecycle-tool.md §shortest); and the findings on lifecycles and journeys (lifecycle-tool.md §findings). It works on the
// lifecycles and actions src/record/ parses, and stores nothing: its facts are never a file and
// never count for standing (lifecycle-tool.md; account.md §what-it-is).

import { sortedBy, sha256 } from '../record/json.mjs';
import { lifecycleConfiguration } from '../lifecycle-machine.mjs';
import { FORMA } from '../version.mjs';
import { ENGINE_VERSIONS } from '../toolchain.mjs';

/** The most combinations of phases the tool steps for a part (lifecycle-tool.md §shortest); past it, each of the part's lifecycles is `unchecked`, naming the limit. */
const COMBINATIONS = 250_000;
const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const values = (collection) => (collection instanceof Map ? [...collection.values()] : [...(collection ?? [])]);
const partOf = (lifecycle) => lifecycle.holder?.key ?? String(lifecycle.entry).split('/')[0];
const caseText = (name) => (name ? ` (case ${name})` : '');

// The tool reads every lifecycle at every read (lifecycle-tool.md), so nothing it does may grow with the square of a
// lifecycle's phases: a lifecycle's phases are looked up in a set, kept per lifecycle object for the read.
const PHASE_SETS = new WeakMap();
const phaseSet = (lifecycle) => {
  let set = PHASE_SETS.get(lifecycle);
  if (!set || set.size !== lifecycle.phases.length) {
    set = new Set(lifecycle.phases);
    PHASE_SETS.set(lifecycle, set);
  }
  return set;
};

/**
 * A Map whose values are computed when first read, from `sources`, a Map of what each key's value is made from, and
 * `compute(source, key)`: so the shortest journeys of a part (lifecycle-tool.md §shortest), whose steps together can grow with the
 * square of its phases, are built only for the phases something asks of.
 */
export class LazyMap {
  #sources;
  #compute;
  #made = new Map();

  constructor(sources, compute) {
    this.#sources = sources;
    this.#compute = compute;
  }

  get size() {
    return this.#sources.size;
  }

  has(key) {
    return this.#sources.has(key);
  }

  get(key) {
    if (!this.#sources.has(key)) return undefined;
    if (!this.#made.has(key)) this.#made.set(key, this.#compute(this.#sources.get(key), key));
    return this.#made.get(key);
  }

  keys() {
    return this.#sources.keys();
  }

  *values() {
    for (const key of this.#sources.keys()) yield this.get(key);
  }

  *entries() {
    for (const key of this.#sources.keys()) yield [key, this.get(key)];
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}

/**
 * A finding as lifecycle-tool.md §findings reports it: its code, the lifecycle or journey it is on, what it concerns, the units it
 * bears on (none for `posed-cell`), the parts or spans of those units, and `says`, its words: its code, then what is
 * wrong and what would clear it, since the tool reports each finding with its code (lifecycle-tool.md §findings) and wherever a finding is
 * worded, as an item's `found` (account.md §commands), it is worded as design.md words it.
 */
export function findingOf(code, on, concerns, bearsOn, says) {
  const units = [...new Set(bearsOn)];
  return { code, on, concerns, bearsOn: units, holders: [...new Set(units.map((u) => u.split('/')[0]))], says: `${code}: ${says}` };
}

// --- A lifecycle as read (lifecycle-tool.md §as-read) ------------------------------------------------------------------------

/**
 * A lifecycle as read (lifecycle-tool.md §as-read): `{ asRead, fills, posed, problems }`. `asRead` is its matrix with each cell or
 * case outcome a choice poses filled as the picked alternative's effects table gives it, while a pick of the choice is
 * in force, each filled cell and filled case outcome marked `{ filledBy: '<part>/choices/<choice>', pick }`; a cell no
 * pick fills stays posed. `part` is the lifecycle's part as src/record/pages.mjs assembles it, `picks` the pick in force
 * of each choice, by entry name. `problems` are what keep the tool from checking the lifecycle (lifecycle-tool.md §findings `unchecked`): a
 * choice page it names that counts for nothing, or check 3 failing for one of its posed cells.
 */
export function lifecycleAsRead(lifecycle, part, picks = new Map()) {
  const asRead = {};
  const fills = [];
  const posed = [];
  const problems = [];
  const where = (phase, action, name = null) => `${phase} | ${action}${caseText(name)}`;
  const choiceNamed = (key) => {
    const page = part?.thingPages?.choices?.get(key);
    if (page?.exists && !page.counts) {
      problems.push({ kind: 'page', path: page.path, says: `the page ${page.path} of the choice ${key}, which poses cells of ${lifecycle.entry}, counts for nothing (change:${page.path})` });
      return null;
    }
    return part?.things?.choices?.get(key) ?? null;
  };
  // The effects rows of one alternative for one cell; check 3 (forms.md §choices, design.md §restate-checks) asks for exactly one.
  const effectOf = (choice, alternative, phase, action) => {
    const rows = (choice.alternatives?.[alternative]?.effects ?? []).filter((e) => e.lifecycle === lifecycle.key && e.phase === phase && e.action === action);
    if (rows.length !== 1) {
      problems.push({ kind: 'check', choice: choice.entry, alternative, phase, action, says: rows.length ? `alternative ${alternative} of ${choice.entry} gives the cell ${where(phase, action)} of ${lifecycle.entry} ${rows.length} times, and gives it once` : `alternative ${alternative} of ${choice.entry} gives no outcome for the cell ${where(phase, action)} of ${lifecycle.entry}, which the choice poses` });
      return null;
    }
    return rows[0];
  };
  for (const phase of lifecycle.phases) {
    asRead[phase] = {};
    for (const action of lifecycle.actions) {
      const cell = lifecycle.cells?.[phase]?.[action] ?? { kind: 'empty' };
      if (cell.kind === 'choice') {
        const choice = choiceNamed(cell.choice);
        if (choice) for (const alternative of ['a', 'b']) {
          const row = effectOf(choice, alternative, phase, action);
          if (row && (row.outcome.kind === 'choice' || (row.outcome.kind === 'cases' && row.outcome.cases.some((c) => c.outcome.kind === 'choice')))) problems.push({ kind: 'check', choice: choice.entry, alternative, phase, action, says: `alternative ${alternative} of ${choice.entry} gives the cell ${where(phase, action)} of ${lifecycle.entry} as choice:, and an effect's outcome never is` });
          if (row?.outcome.kind === 'cases') problems.push({ kind: 'check', choice: choice.entry, alternative, phase, action, says: `alternative ${alternative} of ${choice.entry} gives the cell ${where(phase, action)} of ${lifecycle.entry}, which the choice poses whole, as cases, and its outcome is a cell` });
        }
        const pick = choice ? picks.get(choice.entry) ?? null : null;
        const row = pick ? (choice.alternatives?.[pick]?.effects ?? []).find((e) => e.lifecycle === lifecycle.key && e.phase === phase && e.action === action) : null;
        if (row && row.outcome.kind !== 'choice') {
          const filled = { ...row.outcome, filledBy: choice.entry, pick, posedBy: cell.choice };
          asRead[phase][action] = filled;
          fills.push({ phase, action, case: null, choice: choice.entry, pick, outcome: filled });
        } else {
          asRead[phase][action] = { ...cell };
          posed.push({ phase, action, case: null, choice: cell.choice });
        }
        continue;
      }
      if (cell.kind !== 'cases' || !cell.cases.some((c) => c.outcome.kind === 'choice')) {
        asRead[phase][action] = cell;
        continue;
      }
      // A cell of cases some of whose outcomes a choice poses: each posed case filled from the picked alternative.
      const cases = cell.cases.map((item) => {
        if (item.outcome.kind !== 'choice') return item;
        const choice = choiceNamed(item.outcome.choice);
        if (choice) for (const alternative of ['a', 'b']) {
          const row = effectOf(choice, alternative, phase, action);
          if (row && (row.outcome.kind !== 'cases' || !row.outcome.cases.some((c) => c.case === item.case))) problems.push({ kind: 'check', choice: choice.entry, alternative, phase, action, case: item.case, says: `alternative ${alternative} of ${choice.entry} gives no outcome for the case ${item.case} of the cell ${where(phase, action)} of ${lifecycle.entry}, which the choice poses` });
        }
        const pick = choice ? picks.get(choice.entry) ?? null : null;
        const row = pick ? (choice.alternatives?.[pick]?.effects ?? []).find((e) => e.lifecycle === lifecycle.key && e.phase === phase && e.action === action) : null;
        const given = row?.outcome.kind === 'cases' ? row.outcome.cases.find((c) => c.case === item.case) : null;
        if (given && given.outcome.kind !== 'choice') {
          const outcome = { ...given.outcome, filledBy: choice.entry, pick, posedBy: item.outcome.choice };
          fills.push({ phase, action, case: item.case, choice: choice.entry, pick, outcome });
          return { case: item.case, outcome };
        }
        posed.push({ phase, action, case: item.case, choice: item.outcome.choice });
        return item;
      });
      const filledBy = cases.find((c) => c.outcome.filledBy)?.outcome ?? null;
      asRead[phase][action] = { kind: 'cases', cases, bad: cell.bad ?? [], ...(filledBy ? { filledBy: filledBy.filledBy, pick: filledBy.pick } : {}) };
    }
  }
  const said = new Set();
  return { asRead, fills, posed, problems: problems.filter((p) => !said.has(p.says) && said.add(p.says)) };
}

/** The cells of a lifecycle as read, or as written when it has not been read (lifecycle-tool.md §as-read). */
const cellsOf = (lifecycle) => lifecycle.asRead ?? lifecycle.cells ?? {};

/**
 * What a lifecycle as read does with an action at a phase, for a case when the action has cases (forms.md §lifecycles,
 * lifecycle-tool.md §stepping): an outcome `{ kind: 'phase' | 'refused' | 'empty' | 'choice', ... }`, or `no-row`, `no-column` or `no-case`.
 */
function outcomeAt(lifecycle, phase, action, caseName) {
  if (!phaseSet(lifecycle).has(phase)) return { kind: 'no-row' };
  const cell = cellsOf(lifecycle)[phase]?.[action];
  if (!cell) return { kind: 'no-column' };
  if (cell.kind === 'cases') {
    const item = cell.cases.find((c) => c.case === caseName);
    return item ? item.outcome : { kind: 'no-case' };
  }
  return cell;
}

/** The outcomes of a cell, one per case for a cell of cases, each with its case. */
const outcomesOf = (cell) => (!cell ? [] : cell.kind === 'cases' ? cell.cases.map((c) => ({ case: c.case, outcome: c.outcome })) : [{ case: null, outcome: cell }]);

/** Every move of a lifecycle as read (forms.md §lifecycles): in the order of its rows, then its columns, then each cell's cases as written. */
function movesOf(lifecycle) {
  const moves = [];
  for (const phase of lifecycle.phases) {
    for (const action of lifecycle.actions) {
      for (const { case: name, outcome } of outcomesOf(cellsOf(lifecycle)[phase]?.[action])) {
        if (outcome.kind === 'phase') moves.push({ from: phase, action, case: name, to: outcome.phase });
      }
    }
  }
  return moves;
}

/** The phases moves lead to from the initial phase, it included (lifecycle-tool.md §as-read: reachable). */
function reachablePhases(lifecycle) {
  const phases = phaseSet(lifecycle);
  const next = new Map();
  for (const move of movesOf(lifecycle)) {
    if (!next.has(move.from)) next.set(move.from, []);
    next.get(move.from).push(move.to);
  }
  const seen = new Set(phases.has(lifecycle.initial?.phase) ? [lifecycle.initial.phase] : []);
  const queue = [...seen];
  for (let head = 0; head < queue.length; head += 1) {
    for (const to of next.get(queue[head]) ?? []) {
      if (seen.has(to) || !phases.has(to)) continue;
      seen.add(to);
      queue.push(to);
    }
  }
  return seen;
}

/** The phases outside the ends that refuse every action of a lifecycle as read, as every one does with no action column (lifecycle-tool.md §findings `no-way-out`). */
function stuckPhases(lifecycle) {
  const ends = new Set(lifecycle.ends);
  return lifecycle.phases.filter((phase) => !ends.has(phase) && lifecycle.actions.every((action) => {
    const outcomes = outcomesOf(cellsOf(lifecycle)[phase]?.[action]);
    return outcomes.length > 0 && outcomes.every((o) => o.outcome.kind === 'refused');
  }));
}

// --- Findings on a lifecycle (lifecycle-tool.md §findings) --------------------------------------------------------------------

/**
 * The findings on one lifecycle as read that the tool could check (lifecycle-tool.md §findings): `unreachable-phase`,
 * `no-way-out`, `end-way-out`, `empty-cell` and `posed-cell`. `part` is its part, for the outcomes posed cells may take.
 */
export function lifecycleFindings(lifecycle, part) {
  const findings = [];
  const on = lifecycle.entry;
  const cells = cellsOf(lifecycle);
  // Reach for unreachable-phase: the moves as read and the outcomes posed cells may take, the effects of both alternatives.
  const posedOutcomes = (phase, action, name, choiceKey) => {
    const choice = part?.things?.choices?.get(choiceKey);
    const out = [];
    for (const alternative of ['a', 'b']) {
      for (const row of (choice?.alternatives?.[alternative]?.effects ?? []).filter((e) => e.lifecycle === lifecycle.key && e.phase === phase && e.action === action)) {
        for (const item of outcomesOf(row.outcome)) if (name === null || item.case === name) out.push(item.outcome);
      }
    }
    return out;
  };
  const phases = phaseSet(lifecycle);
  const seen = new Set(phases.has(lifecycle.initial.phase) ? [lifecycle.initial.phase] : []);
  const queue = [...seen];
  let open = false;
  for (let head = 0; head < queue.length; head += 1) {
    const phase = queue[head];
    for (const action of lifecycle.actions) {
      const cell = cells[phase]?.[action];
      if (cell?.kind === 'empty') open = true;
      for (const item of outcomesOf(cell)) {
        const pending = item.outcome.kind === 'choice' ? posedOutcomes(phase, action, cell.kind === 'cases' ? item.case : null, item.outcome.choice) : [item.outcome];
        if (cell.kind === 'cases' && item.outcome.kind === 'empty') open = true;
        for (const outcome of pending) {
          if (outcome.kind === 'phase' && phases.has(outcome.phase) && !seen.has(outcome.phase)) {
            seen.add(outcome.phase);
            queue.push(outcome.phase);
          }
        }
      }
    }
  }
  const stuck = new Set(stuckPhases(lifecycle));
  const ends = new Set(lifecycle.ends);
  for (const phase of lifecycle.phases) {
    if (!open && !seen.has(phase)) {
      findings.push(findingOf('unreachable-phase', on, { phase }, [on], `the phase ${phase} of ${on} is led to from its initial phase ${lifecycle.initial.phase} by no move, nor by any outcome a posed cell may take: add a move that leads to it, or take the phase out`));
    }
    if (stuck.has(phase)) {
      findings.push(findingOf('no-way-out', on, { phase }, [on], lifecycle.actions.length
        ? `the phase ${phase} of ${on} refuses every action and is not one of its Ends: give one of its cells a move, or list ${phase} in Ends`
        : `${on} has no action column, so its phase ${phase}, which is not one of its Ends, refuses every action: place its part's actions as columns, or list ${phase} in Ends`));
    }
    if (ends.has(phase)) {
      for (const action of lifecycle.actions) {
        for (const item of outcomesOf(cells[phase]?.[action])) {
          if (item.outcome.kind === 'phase' && item.outcome.phase !== phase) {
            findings.push(findingOf('end-way-out', on, { phase, action, case: item.case, to: item.outcome.phase }, [on], `the phase ${phase} is one of the Ends of ${on}, and its cell ${phase} | ${action}${caseText(item.case)} moves to ${item.outcome.phase}: an end has no move to another phase, so refuse that cell or take ${phase} out of Ends`));
          }
        }
      }
    }
    for (const action of lifecycle.actions) {
      const cell = cells[phase]?.[action];
      if (cell?.kind === 'empty') {
        findings.push(findingOf('empty-cell', on, { phase, action, case: null }, [on], `the cell ${phase} | ${action} of ${on} is empty, a transition the lifecycle leaves unspecified: write the phase it leads to, None. where it is refused, or choice:<key> where the brief leaves it open`));
      }
      if (cell?.kind === 'cases') {
        for (const item of cell.cases) {
          if (item.outcome.kind === 'empty') findings.push(findingOf('empty-cell', on, { phase, action, case: item.case }, [on], `the case ${item.case} of the cell ${phase} | ${action} of ${on} has an empty outcome, a transition left unspecified: write the phase it leads to, None. where it is refused, or choice:<key> where the brief leaves it open`));
        }
      }
      for (const item of outcomesOf(cell)) {
        if (item.outcome.kind !== 'choice') continue;
        const choice = `${partOf(lifecycle)}/choices/${item.outcome.choice}`;
        findings.push(findingOf('posed-cell', on, { phase, action, case: cell.kind === 'cases' ? item.case : null, choice }, [], `the cell ${phase} | ${action}${caseText(cell.kind === 'cases' ? item.case : null)} of ${on} is posed by the choice ${choice}, which has no pick in force: it waits on that choice, and the developer's pick fills it with no other confirmation (forma decide pick ${choice})`));
      }
    }
  }
  return findings;
}

// --- Stepping a journey (lifecycle-tool.md §stepping) -------------------------------------------------------------------------

/** A reference as forms.md §page-rules writes one, from the journey's part or span: `{ part, key, entry }`, or `{ why }`. */
function refOf(written, from, kind) {
  const text = String(written ?? '');
  const pieces = text.split('/');
  if (!text || /\s/.test(text) || pieces.length > 2 || pieces.some((p) => p === '')) return { why: `"${text}" is not a reference, a key or <part>/<key>` };
  if (pieces.length === 2) return { part: pieces[0], key: pieces[1], entry: `${pieces[0]}/${kind}/${pieces[1]}` };
  if (!from || from.span) return { why: `"${text}" is a key alone, and from a span every reference is <part>/<key>` };
  return { part: from.key, key: text, entry: `${from.key}/${kind}/${text}` };
}

/** The part or span a journey's bare references are read from (forms.md §page-rules, design.md §filing): `{ key, span }`. */
function fromOf(journey) {
  if (journey.from) return journey.from;
  if (journey.holder && typeof journey.holder === 'object') return journey.holder;
  if (typeof journey.holder === 'string') return { key: journey.holder, span: Boolean(journey.span) };
  return { key: String(journey.entry ?? journey.name ?? '').split('/')[0], span: false };
}

/**
 * Steps a journey through lifecycles as read (lifecycle-tool.md §stepping). `lifecyclesAsRead` are the lifecycles to step through
 * (a Map or a list, each with its `asRead`), `actions` the actions their steps may name (each as src/record/ parses an
 * action, with `entry`), and `journey` a journey with its steps, start rows, polarity and refused step, its bare
 * references read from its `from` or `holder`. An action moves only lifecycles of its own part given here. Returns:
 *
 * - `admitted`: how many steps, from the first, the tool admitted;
 * - `refusedAt`: the step refused, or null;
 * - `reached`: `[{ lifecycle, entity, phase }]`, each phase an entity holds at the start or after an admitted step, a
 *   must-not journey's refused step excluded;
 * - `moves`: `[{ step, lifecycle, entity, from, action, case, to, entered, refusedStep }]`, what each admitted step did,
 *   `entered` for a lifecycle the step's action enters (`from` null where the journey held no such entity);
 * - `ended`: `{ why, step, says }`, `why` one of `completed` (every step through the last stepped admitted, a must-not
 *   journey's refused step included, whose refusal is then left to a model), `refused` (with `expected` true for a
 *   must-not journey's refused step), `unknown` (an empty or posed cell), `entity` (a step naming no entity of a
 *   lifecycle the journey names several of) or `unresolved` (a start row, at step 0, or a step naming what is not given);
 * - `steps`, `entities`, `final` and `findings`: each step's outcome, the entities named per lifecycle, the phase of each
 *   entity held at the end, and the findings stepping found (`start-phase`, `step-refused`, `creates-existing-entity`,
 *   `step-entity`, `unchecked`).
 *
 * An entity of a lifecycle `entered by` an action that the start table does not list is absent until a step taking that
 * action enters it; a step acting on it with another action meanwhile is refused by that lifecycle, as the lifecycle
 * engine refuses it (lifecycle-tool.md §stepping; engines.md §lifecycle-engine), its `refusedBy` item `{ lifecycle, entity, phase: null, absent: true,
 * enteredBy }`.
 */
export function stepJourney(lifecyclesAsRead, actions, journey) {
  const lifecycles = new Map(values(lifecyclesAsRead).map((l) => [l.entry, l]));
  const actionsBy = new Map(values(actions).map((a) => [a.entry ?? `${a.holder?.key}/actions/${a.key}`, a]));
  const from = fromOf(journey);
  const on = journey.entry ?? journey.name;
  const out = { journey: on, admitted: 0, refusedAt: null, reached: [], moves: [], ended: null, steps: [], entities: [], initial: [], final: [], findings: [] };
  const reachedSeen = new Set();
  const reach = (lifecycle, entity, phase) => {
    const key = `${lifecycle}\0${entity}\0${phase}`;
    if (reachedSeen.has(key)) return;
    reachedSeen.add(key);
    out.reached.push({ lifecycle, entity, phase });
  };
  const end = (why, step, says, extra = {}) => {
    out.ended = { why, step, says, ...extra };
  };
  const unchecked = (concerns, says) => out.findings.push(findingOf('unchecked', on, concerns, [on], says));
  const polarity = journey.polarity;
  const steps = journey.steps ?? [];
  const last = polarity === 'must not' ? journey.refusedStep ?? steps.length : steps.length;

  // The start rows (forms.md §journeys): each a lifecycle given here and one of its phases.
  const start = [];
  for (const [at, row] of (journey.start ?? []).entries()) {
    const ref = refOf(row.lifecycle, from, 'lifecycles');
    const lifecycle = ref.entry ? lifecycles.get(ref.entry) : null;
    const why = ref.why ?? (!lifecycle ? `${row.lifecycle} names ${ref.entry}, which is not among the lifecycles stepped` : !phaseSet(lifecycle).has(row.phase) ? `${row.phase} is not a phase of ${lifecycle.entry}` : null);
    if (why) {
      unchecked({ why: 'unresolved', start: { row: at + 1, lifecycle: row.lifecycle, entity: row.entity, phase: row.phase } }, `the tool could not check ${on}: its start row ${at + 1}, ${row.lifecycle} | ${row.entity} | ${row.phase}: ${why}`);
      end('unresolved', 0, `start row ${at + 1}: ${why}`);
      return out;
    }
    start.push({ row, lifecycle });
  }
  // Each step's action, and the lifecycles it moves: those of its own part that have it as a column or are entered by it.
  const resolved = steps.map((step) => {
    const ref = refOf(step.action, from, 'actions');
    const action = ref.entry ? actionsBy.get(ref.entry) ?? null : null;
    const moved = action ? [...lifecycles.values()].filter((l) => partOf(l) === ref.part && (l.actions.includes(ref.key) || l.initial?.enteredBy === ref.key)) : [];
    let why = ref.why ?? (!action ? `${step.action} names ${ref.entry}, which is not among the actions given` : null);
    if (!why && action.cases.length && !action.cases.includes(step.case)) why = `${action.entry} has the cases ${action.cases.join(', ')}, and the step names ${step.case ?? '-'}`;
    if (!why && !action.cases.length && step.case !== null && step.case !== undefined) why = `${action.entry} has no cases, and the step names the case ${step.case}`;
    return { step, ref, action, moved, why };
  });

  // The entities the journey names, per lifecycle (lifecycle-tool.md §stepping).
  const named = new Map();
  const name = (lifecycle, entity) => {
    if (!named.has(lifecycle)) named.set(lifecycle, []);
    if (!named.get(lifecycle).includes(entity)) named.get(lifecycle).push(entity);
  };
  const startFor = new Map();
  for (const { row, lifecycle } of start) {
    name(lifecycle.entry, row.entity);
    startFor.set(row.entity, [...(startFor.get(row.entity) ?? []), lifecycle.entry]);
  }
  for (const { step, moved } of resolved) {
    if (step.entity === null || step.entity === undefined) continue;
    for (const lifecycle of moved) {
      const elsewhere = (startFor.get(step.entity) ?? []).some((other) => other !== lifecycle.entry && moved.some((m) => m.entry === other));
      if (!elsewhere) name(lifecycle.entry, step.entity);
    }
  }
  out.entities = [...named].map(([lifecycle, names]) => ({ lifecycle, names: [...names] }));

  // What the journey holds: by lifecycle, each entity's phase. An entity of a lifecycle `entered by` an action that the
  // start table does not list is absent until a step taking that action enters it (lifecycle-tool.md §stepping; engines.md §lifecycle-engine).
  const held = new Map();
  const hold = (lifecycle, entity, phase) => {
    if (!held.has(lifecycle)) held.set(lifecycle, new Map());
    held.get(lifecycle).set(entity, phase);
  };
  const phaseOf = (lifecycle, entity) => held.get(lifecycle.entry)?.get(entity) ?? lifecycle.initial.phase;
  const absent = (lifecycle, entity) => Boolean(lifecycle.initial?.enteredBy) && !(held.get(lifecycle.entry)?.has(entity) ?? false);
  for (const { row, lifecycle } of start) {
    hold(lifecycle.entry, row.entity, row.phase);
    reach(lifecycle.entry, row.entity, row.phase);
    if (!reachablePhases(lifecycle).has(row.phase)) {
      out.findings.push(findingOf('start-phase', on, { start: { lifecycle: lifecycle.entry, entity: row.entity, phase: row.phase } }, [on, lifecycle.entry], `${on} starts ${row.entity} in the phase ${row.phase} of ${lifecycle.entry}, which no move leads to from its initial phase ${lifecycle.initial.phase}: start it in a phase the lifecycle reaches, or give the lifecycle the moves that reach ${row.phase}`));
    }
  }

  // The start the stepping uses, absent entities included, so whoever draws the walk
  // places step zero without working the start out again (lifecycle-tool.md §stepping).
  const involved = new Map([...start.map(s => s.lifecycle), ...resolved.flatMap(s => s.moved)].map(l => [l.entry, l]));
  out.initial = [...involved.values()].flatMap(lifecycle => (named.get(lifecycle.entry)?.length ? named.get(lifecycle.entry) : [lifecycle.key]).map(entity => ({ lifecycle: lifecycle.entry, entity, phase: absent(lifecycle, entity) ? null : phaseOf(lifecycle, entity) })));

  for (const item of resolved) {
    const { step, action, moved } = item;
    if (step.step > last) break;
    const refusedStep = polarity === 'must not' && step.step === journey.refusedStep;
    const record = { step: step.step, action: action?.entry ?? null, case: step.case ?? null, outcome: null, acts: [], refusedBy: [], unknown: [] };
    out.steps.push(record);
    if (item.why) {
      record.outcome = 'unresolved';
      unchecked({ why: 'unresolved', step: step.step }, `the tool could not check ${on} from its step ${step.step} on: ${item.why}`);
      end('unresolved', step.step, item.why);
      break;
    }
    // The entity it acts on in each lifecycle it moves (lifecycle-tool.md §stepping).
    const several = moved.filter((l) => (named.get(l.entry) ?? []).length > 1);
    const unnamed = several.filter((l) => step.entity === null || step.entity === undefined || !named.get(l.entry).includes(step.entity));
    if (unnamed.length) {
      record.outcome = 'entity';
      for (const lifecycle of unnamed) {
        out.findings.push(findingOf('step-entity', on, { step: step.step, entity: step.entity ?? null, lifecycle: lifecycle.entry, named: [...named.get(lifecycle.entry)] }, [on], `step ${step.step} of ${on} acts on ${lifecycle.entry}, of which the journey names the entities ${named.get(lifecycle.entry).join(', ')}, and its Entity, ${step.entity ?? '-'}, names none of them: name in the step's Entity the one it acts on`));
      }
      end('entity', step.step, `step ${step.step} names no entity of ${unnamed.map((l) => l.entry).join(', ')}, of which the journey names several`);
      break;
    }
    if (!several.length && step.entity !== null && step.entity !== undefined) {
      out.findings.push(findingOf('step-entity', on, { step: step.step, entity: step.entity, lifecycle: null, named: [] }, [on], `step ${step.step} of ${on} names the entity ${step.entity}, and no lifecycle it moves has more than one entity named in the journey: write - in its Entity`));
    }
    const acts = moved.map((lifecycle) => ({ lifecycle, entity: several.includes(lifecycle) ? step.entity : named.get(lifecycle.entry)?.[0] ?? lifecycle.key }));
    const taken = [];
    for (const { lifecycle, entity } of acts) {
      if (lifecycle.initial?.enteredBy === action.key) {
        taken.push({ lifecycle, entity, from: held.get(lifecycle.entry)?.get(entity) ?? null, to: lifecycle.initial.phase, entered: true, existing: held.get(lifecycle.entry)?.has(entity) ?? false });
        continue;
      }
      // A step acting with another action on an entity still absent is refused there (lifecycle-tool.md §stepping).
      if (absent(lifecycle, entity)) {
        record.refusedBy.push({ lifecycle: lifecycle.entry, entity, phase: null, absent: true, enteredBy: lifecycle.initial.enteredBy });
        continue;
      }
      const at = phaseOf(lifecycle, entity);
      const outcome = outcomeAt(lifecycle, at, action.key, step.case ?? null);
      if (outcome.kind === 'phase') taken.push({ lifecycle, entity, from: at, to: outcome.phase, entered: false });
      else if (outcome.kind === 'refused') record.refusedBy.push({ lifecycle: lifecycle.entry, entity, phase: at });
      else record.unknown.push({ lifecycle: lifecycle.entry, entity, phase: at, action: action.key, case: step.case ?? null, cell: outcome.kind, choice: outcome.choice ?? null });
    }
    // A step that a lifecycle it moves refuses is refused, whatever the others' cells; only a step none refuses that
    // meets an empty or posed cell does what is not known (lifecycle-tool.md §stepping).
    if (record.refusedBy.length) {
      record.outcome = 'refused';
      out.refusedAt = step.step;
      const by = record.refusedBy.map((r) => (r.absent
        ? `${r.lifecycle} refuses it while its entity ${r.entity} is absent: the lifecycle is entered by ${r.enteredBy}, no step before this one takes ${r.enteredBy} for ${r.entity}, and the start table does not list it`
        : `${r.lifecycle} refuses it at ${r.phase}, the phase of its entity ${r.entity} (cell ${r.phase} | ${action.key}${caseText(step.case)} is None.)`)).join('; ');
      if (refusedStep) {
        end('refused', step.step, `step ${step.step}, the journey's refused step, is refused: ${by}`, { expected: true });
      } else {
        const why = polarity === 'must not' ? `the journey is refused at its step ${journey.refusedStep}, and this earlier step is refused first` : 'every step of a should-happen journey is admitted';
        const mend = record.refusedBy.every((r) => r.absent) ? 'so change the journey: enter the entity first, or start it in the start table' : 'so change the journey, or that cell of the lifecycle';
        out.findings.push(findingOf('step-refused', on, { step: step.step, action: action.entry, case: step.case ?? null, refusedBy: record.refusedBy }, [on, ...record.refusedBy.map((r) => r.lifecycle)], `step ${step.step} of ${on}, ${action.entry}${caseText(step.case)}, is refused: ${by}; ${why}, ${mend}`));
        end('refused', step.step, `step ${step.step} is refused: ${by}`, { expected: false });
      }
      break;
    }
    if (record.unknown.length) {
      record.outcome = 'unknown';
      const cells = record.unknown.map((u) => `${u.phase} | ${u.action}${caseText(u.case)} of ${u.lifecycle}, ${u.cell === 'choice' ? `posed by the choice ${partOf(lifecycles.get(u.lifecycle))}/choices/${u.choice} with no pick in force` : u.cell === 'empty' ? 'empty' : u.cell === 'no-case' ? 'giving no outcome for the case' : 'not a cell of the lifecycle'}`);
      unchecked({ why: 'cell', step: step.step, cells: record.unknown }, `the tool could not check ${on} from its step ${step.step} on: the step meets the cell ${cells.join('; and the cell ')}, so what it does is not known until that cell is written${record.unknown.some((u) => u.cell === 'choice') ? ' or the choice is picked' : ''}`);
      end('unknown', step.step, `step ${step.step} meets ${cells.join('; ')}`);
      break;
    }
    record.outcome = 'admitted';
    out.admitted += 1;
    for (const t of taken) {
      if (t.entered && t.existing) {
        out.findings.push(findingOf('creates-existing-entity', on, { step: step.step, lifecycle: t.lifecycle.entry, entity: t.entity }, [on], `step ${step.step} of ${on}, ${action.entry}, enters ${t.lifecycle.entry} for ${t.entity}, which the journey already holds: name another entity in the step's Entity, or take the step out`));
      }
      hold(t.lifecycle.entry, t.entity, t.to);
      const move = { step: step.step, lifecycle: t.lifecycle.entry, entity: t.entity, from: t.from, action: action.key, case: step.case ?? null, to: t.to, entered: t.entered, refusedStep };
      out.moves.push(move);
      record.acts.push({ lifecycle: move.lifecycle, entity: move.entity, from: move.from, to: move.to, entered: move.entered });
      if (!refusedStep) reach(t.lifecycle.entry, t.entity, t.to);
    }
    if (refusedStep) {
      end('completed', step.step, `step ${step.step}, the journey's refused step, is admitted by the lifecycles: its refusal is left to a model`);
      break;
    }
  }
  if (!out.ended) end('completed', Math.min(last, steps.length), steps.length ? `every step through step ${Math.min(last, steps.length)} is admitted` : 'the journey has no step');
  out.final = [...held].flatMap(([lifecycle, entities]) => [...entities].map(([entity, phase]) => ({ lifecycle, entity, phase })));
  return out;
}

// --- Shortest journeys (lifecycle-tool.md §shortest) --------------------------------------------------------------------------

/**
 * The shortest journeys of one part (lifecycle-tool.md §shortest): `{ journeys, failed }`, `journeys` a Map (a LazyMap, each value
 * built when first read) from `'<lifecycle entry>--<phase>'` to its steps `[{ action, case }]`, for each phase but the
 * initial one of each lifecycle given that a journey reaches; `failed`, naming lifecycle-tool.md §shortest's limit when the search passed it,
 * or null. `lifecyclesAsRead` are the part's lifecycles as read and `actions` the part's actions. Each entity starts in
 * its lifecycle's initial phase, or absent where the lifecycle is `entered by` an action, so a journey to its phases
 * begins with the entering step (lifecycle-tool.md §stepping). Of the shortest to a phase, the steps that come first, compared step by step by
 * action key and then case key in code-point order. The search keeps, for each phase, only the combination at which it
 * first reached it, so its memory grows with the combinations it steps, at most lifecycle-tool.md §shortest's limit, and not with the steps
 * of every journey together, which for one long chain of phases grows with their square.
 */
export function shortestJourneys(lifecyclesAsRead, actions) {
  const lifecycles = values(lifecyclesAsRead);
  // Each phase a journey reaches, by `'<lifecycle entry>--<phase>'`: the key of the combination that first reached it.
  const found = new Map();
  // Each step one of the part's actions, with one of its cases when it has them, in code-point order; one that moves no lifecycle is never taken.
  const steps = sortedBy(values(actions).flatMap((a) => (a.cases.length ? a.cases : [null]).map((name) => ({ action: a.key, case: name }))), (s) => [s.action, s.case ?? ''])
    .map((s) => ({ ...s, moves: lifecycles.map((l, at) => (l.initial?.enteredBy === s.action ? { at, enters: true } : l.actions.includes(s.action) ? { at, enters: false } : null)).filter(Boolean) }))
    .filter((s) => s.moves.length);
  // A combination: for each lifecycle, whether the journey holds its one entity, and its phase. An entity not yet held of
  // a lifecycle `entered by` an action is absent (lifecycle-tool.md §stepping).
  // lifecycle-tool.md §shortest counts combinations of phases: an entity of an `entered by` lifecycle not yet entered is absent,
  // which is a value of its own; whether the journey holds any other entity changes no step, so it is no part of the key.
  const keyOf = (combination) => combination.map(([holds, phase], at) => (!holds && lifecycles[at].initial?.enteredBy ? '∅' : `=${phase}`)).join('\0');
  const take = (combination, step) => {
    const next = combination.slice();
    for (const { at, enters } of step.moves) {
      const lifecycle = lifecycles[at];
      if (enters) {
        if (combination[at][0]) return null;
        next[at] = [true, lifecycle.initial.phase];
        continue;
      }
      // Absent, its entity refuses every action but the one that enters it.
      if (!combination[at][0] && lifecycle.initial?.enteredBy) return null;
      const outcome = outcomeAt(lifecycle, combination[at][1], step.action, step.case);
      if (outcome.kind !== 'phase') return null;
      next[at] = [true, outcome.phase];
    }
    return next;
  };
  const targets = lifecycles.reduce((n, l) => n + l.phases.filter((p) => p !== l.initial.phase).length, 0);
  const start = lifecycles.map((l) => [false, l.initial.phase]);
  const parents = new Map([[keyOf(start), null]]);
  const queue = [start];
  const pathTo = (key) => {
    const path = [];
    for (let at = parents.get(key); at; at = parents.get(at.parent)) path.push({ action: at.step.action, case: at.step.case });
    return path.reverse();
  };
  const journeys = new LazyMap(found, (key) => pathTo(key));
  for (let head = 0; head < queue.length && found.size < targets; head += 1) {
    const combination = queue[head];
    const key = keyOf(combination);
    for (const step of steps) {
      const next = take(combination, step);
      if (!next) continue;
      const nextKey = keyOf(next);
      if (parents.has(nextKey)) continue;
      parents.set(nextKey, { parent: key, step });
      if (parents.size > COMBINATIONS) return { journeys, failed: `the part's lifecycles hold more than ${grouped(COMBINATIONS)} combinations of phases, the most the tool steps for a part (lifecycle-tool.md §shortest's limit)` };
      queue.push(next);
      next.forEach(([holds, phase], at) => {
        const lifecycle = lifecycles[at];
        const target = `${lifecycle.entry}--${phase}`;
        if (holds && phase !== lifecycle.initial.phase && phaseSet(lifecycle).has(phase) && !found.has(target)) found.set(target, nextKey);
      });
    }
  }
  return { journeys, failed: null };
}

// --- The picture (lifecycle-tool.md §as-read) --------------------------------------------------------------------------------

/** The source basis of a picture at the time it is shown (lifecycle-tool.md §as-read). */
export function pictureBasis(project, lifecycle) {
  const names = [lifecycle.entry, ...lifecycle.actions.map(key => `${lifecycle.part ?? lifecycle.holder?.key}/actions/${key}`)];
  const paths = new Set(names.map(name => project?.restatement?.entries.get(name)?.page).filter(Boolean));
  if(lifecycle.page) paths.add(lifecycle.page);
  return {
    pins:names.map(entry => ({entry,pin:project?.restatement?.pins.entries.get(entry)?.pin ?? (entry===lifecycle.entry?lifecycle.pin:null) ?? null})),
    picks:lifecycle.fills ?? [],
    files:[...paths].sort().map(path=>({path,sha256:project?.files.get(path)?.sha256 ?? null})),
    versions:{forma:FORMA,xstate:ENGINE_VERSIONS.lifecycle.library},
  };
}

/** The lifecycle's picture (lifecycle-tool.md §as-read); its marks come from the tool or a trace's rendering, and whoever draws it adds none. */
export function lifecyclePicture(lifecycle, lit = [], options = {}) {
  const lowered = lifecycleConfiguration(lifecycle);
  const reachable = reachablePhases(lifecycle);
  const stuck = new Set(stuckPhases(lifecycle));
  const cells = cellsOf(lifecycle);
  const visited = new Set(lit.flatMap(m => [m.phase,m.from,m.to]).filter(p=>p !== undefined && p !== null));
  const holds = (phase,kind) => lifecycle.actions.some(action => outcomesOf(cells[phase]?.[action]).some(o=>o.outcome.kind===kind));
  for(const move of lowered.moves) {
    const steps = new Map();
    for(const mark of lit) if(mark.from===move.from && mark.to===move.to && mark.action===move.action && (mark.case??null)===move.case) {
      for(const step of mark.steps ?? (mark.step!==undefined?[mark.step]:[])) steps.set(step,Boolean(steps.get(step)||mark.loop));
    }
    move.steps=[...steps].sort(([a],[b])=>a-b).map(([step,loop])=>({step,loop}));
  }
  const phases = lifecycle.phases.map(key=>({id:lowered.stateKeys[key],key,classes:[...(!reachable.has(key)?['unreachable']:[]),...(stuck.has(key)?['stuck']:[]),...(holds(key,'choice')?['posed']:[]),...(holds(key,'empty')?['empty']:[]),...(visited.has(key)?['visited']:[])]}));
  return {format:1,lifecycle:lifecycle.entry ?? lifecycle.key,basis:options.basis ?? pictureBasis(null,lifecycle),source:options.source ?? (lit.length?{journey:null,digest:sha256(JSON.stringify(lit))}:null),entity:lifecycle.entity,initial:lifecycle.initial,ends:[...lifecycle.ends],phases,actions:[...lifecycle.actions],unaffected:[...(lifecycle.unaffected??[])],cells,moves:lowered.moves,machine:lowered.machine,mapping:lowered.mapping,marks:lit,facts:phases.filter(p=>p.classes.length).map(p=>({phase:p.key,classes:p.classes}))};
}

/** Human-readable picture and the exact retained data (lifecycle-tool.md §as-read). */
export function pictureText(picture) {
  const lines=[`Initial: ${picture.initial?.phase ?? 'unspecified'}${picture.initial?.enteredBy?` entered by ${picture.initial.enteredBy}`:''}`];
  for(const phase of picture.phases) lines.push(`Phase ${phase.key}${phase.classes.length?`: ${phase.classes.join(', ')}`:''}`);
  for(const move of picture.moves) lines.push(`${move.from} → ${move.to}: ${move.action}${move.case?` (${move.case})`:''}${move.steps.length?` at ${move.steps.map(s=>`${s.step}${s.loop?' loops back':''}`).join(', ')}`:''}`);
  for(const phase of picture.phases) for(const action of picture.actions) {
    const cell=picture.cells[phase.key]?.[action];
    const outcomes=cell?.kind==='cases'?cell.cases:[{case:null,outcome:cell}];
    for(const row of outcomes) if(row.outcome?.kind!=='phase') lines.push(`${phase.key} / ${action}${row.case?` (${row.case})`:''}: ${row.outcome?.kind==='refused'?'refused':row.outcome?.kind==='choice'?`choice ${row.outcome.choice}`:'empty'}`);
  }
  lines.push('Drawn by the explorer app, forma-explorer.','','```json forma-diagram',JSON.stringify(picture,null,2),'```');
  return lines.join('\n');
}
