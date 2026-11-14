// The lifecycle engine (engines.md §lifecycle-engine): the data form a lifecycle model's questions are composed
// into, and the exploration that answers them. The engine holds one entity of each lifecycle in the
// data form, every case possible and guards unevaluated, and enumerates every reachable combination
// of phases breadth first, stepping each lifecycle with XState; an empty cell, or one a choice poses
// with no pick in force, admits its action to every phase. It imports nothing of ../design/,
// so it runs in a worker of its own (lifecycle-worker.mjs).

import { createMachine, transition } from 'xstate';
import { lifecycleConfiguration, lifecycleId } from '../lifecycle-machine.mjs';

const eventOf = (action, caseName) => (caseName ? `${action}:${caseName}` : action);

/** A cell as the data form writes it (forms.md §lifecycles): a phase, `None.`, empty, posed by a choice, or cases. */
export function formCell(cell) {
  if (!cell || cell.kind === 'empty') return { kind: 'empty' };
  if (cell.kind === 'refused') return { kind: 'refused' };
  if (cell.kind === 'phase') return { kind: 'phase', phase: cell.phase };
  if (cell.kind === 'choice') return { kind: 'choice', choice: cell.choice };
  if (cell.kind === 'cases') return { kind: 'cases', cases: (cell.cases ?? []).map((item) => ({ case: item.case, outcome: formCell(item.outcome) })) };
  return { kind: 'empty' };
}

/**
 * The data form (engines.md §lifecycle-engine) of a part's lifecycles whose confirmation is in force: each with its initial
 * phase and the action that enters it, its phases, columns, unaffected actions and its cells as the picks in force
 * fill them; the part's actions with their cases and guards; and a fault's `overlay` replacing the cells it lists.
 * `lifecycles` are the design's lifecycles as read (lifecycle-tool.md §as-read), `actions` the part's actions.
 */
export function dataForm(part, lifecycles, actions, overlay = []) {
  const form = {
    part,
    lifecycles: [...lifecycles].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map((l) => {
      const read = l.asRead ?? l.cells;
      const cells = {};
      for (const phase of l.phases) {
        cells[phase] = {};
        for (const action of l.actions) cells[phase][action] = formCell(read?.[phase]?.[action]);
      }
      return { key: l.key, entity: l.entity, initial: { phase: l.initial.phase, enteredBy: l.initial.enteredBy ?? null }, ends: [...(l.ends ?? [])], phases: [...l.phases], actions: [...l.actions], unaffected: [...(l.unaffected ?? [])], cells };
    }),
    actions: actions.map((a) => ({ key: a.key, cases: [...(a.cases ?? [])], guard: a.guard ?? null })),
  };
  for (const row of overlay) {
    const lifecycle = form.lifecycles.find((l) => l.key === row.lifecycle);
    if (lifecycle?.cells[row.phase] && row.action in lifecycle.cells[row.phase]) lifecycle.cells[row.phase][row.action] = formCell(row.outcome);
  }
  return form;
}

/** One XState machine per lifecycle (evidence.md §toolchain): its phases as states, each cell admitting a phase as a transition. */
function machineOf(lifecycle) {
  const configuration = lifecycleConfiguration(lifecycle);
  return {...configuration, actor:createMachine(configuration.machine)};
}

/** What a cell does for one case of its action: its outcome, the cell itself when it is not a cell of cases. */
function outcomeOf(cell, caseName) {
  if (cell?.kind === 'cases') return cell.cases.find((item) => item.case === caseName)?.outcome ?? { kind: 'empty' };
  return cell ?? { kind: 'empty' };
}

/** Every action of the part with each of its cases (engines.md §lifecycle-engine: every case possible). */
const eventsOf = (data) => data.actions.flatMap((a) => (a.cases.length ? a.cases.map((c) => ({ action: a.key, case: c })) : [{ action: a.key, case: null }]));

const keyOf = (combination, data) => JSON.stringify(data.lifecycles.map((l) => combination[l.key]));

/**
 * The combinations one event leads to from `combination` (engines.md §lifecycle-engine), none when it is refused. An entered
 * lifecycle's entity starts absent: its entering action makes it present in its initial phase and is refused while it
 * is present; any other action of the lifecycle is refused while it is absent. `met` records each open cell met.
 */
function successors(data, machines, combination, event, met) {
  let options = [{}];
  for (const lifecycle of data.lifecycles) {
    const now = combination[lifecycle.key];
    let choices;
    if (lifecycle.initial.enteredBy === event.action) {
      if (now !== null) return [];
      choices = [lifecycle.initial.phase];
    } else if (lifecycle.actions.includes(event.action)) {
      if (now === null) return [];
      const outcome = outcomeOf(lifecycle.cells[now]?.[event.action], event.case);
      if (outcome.kind === 'refused') return [];
      if (outcome.kind === 'phase') {
        const machine = machines.get(lifecycle.key);
        let next = outcome.phase;
        try {
          const state = transition(machine.actor, machine.actor.resolveState({ value: machine.stateKeys[now] }), { type: lifecycleId('event', event.action, event.case ?? null) })[0].value;
          next = machine.mapping.states[state];
        } catch {
          // a target the lifecycle does not have: the cell's own phase stands
        }
        choices = [next];
      } else {
        // An empty cell or outcome, or one posed with no pick in force, may do anything.
        met.add(`${lifecycle.key}/${now}/${event.action}${event.case ? `/${event.case}` : ''}`);
        choices = [...lifecycle.phases];
      }
    } else choices = [now];
    options = options.flatMap((partial) => choices.map((phase) => ({ ...partial, [lifecycle.key]: phase })));
  }
  return options;
}

/** Whether a combination form holds, or a step takes a transition (engines.md §slot-forms lifecycle forms). */
function asks(form) {
  if (form.combination) return { state: (c) => form.combination.every((row) => c[row.lifecycle] === row.phase), step: null };
  const t = form.transition;
  return { state: null, step: (before, event, after) => event.action === t.action && before[t.lifecycle] === t.from && after[t.lifecycle] === t.to };
}

/**
 * Explores the data form breadth first (engines.md §lifecycle-engine) for `form`, a combination to reach or a transition to take,
 * within `seconds`. Gives `{ answered: true, found, trace, combinations, flags }`, `trace` the shortest journey to what
 * was asked, each state `{ combination, event }`, and `flags` (evidence.md §flags) once the whole space is explored; or
 * `{ answered: false, reason, combinations }` when its time ran out.
 */
export function explore(data, form, { seconds }) {
  const started = Date.now();
  const deadline = started + seconds * 1000;
  const machines = new Map(data.lifecycles.map((l) => [l.key, machineOf(l)]));
  const events = eventsOf(data);
  const wanted = asks(form);
  const met = new Set();
  const held = new Map(data.lifecycles.map((l) => [l.key, new Set()]));
  const taken = new Set();
  const initial = Object.fromEntries(data.lifecycles.map((l) => [l.key, l.initial.enteredBy ? null : l.initial.phase]));
  const seen = new Map([[keyOf(initial, data), { combination: initial, parent: null, event: null }]]);
  const hold = (c) => {
    for (const l of data.lifecycles) if (c[l.key] !== null) held.get(l.key).add(c[l.key]);
  };
  const path = (key, extra = null) => {
    const states = [];
    for (let at = seen.get(key); at; at = at.parent ? seen.get(at.parent) : null) states.unshift({ combination: at.combination, event: at.event });
    return extra ? [...states, extra] : states;
  };
  hold(initial);
  if (wanted.state?.(initial)) return { answered: true, found: true, trace: path(keyOf(initial, data)), combinations: 1, flags: [] };
  const queue = [initial];
  let checked = 0;
  while (queue.length) {
    const combination = queue.shift();
    for (const event of events) {
      checked += 1;
      if ((checked & 1023) === 0 && Date.now() > deadline) return { answered: false, reason: `ran out of time: stopped after ${seconds} s`, combinations: seen.size };
      for (const next of successors(data, machines, combination, event, met)) {
        taken.add(eventOf(event.action, event.case));
        if (wanted.step?.(combination, event, next)) return { answered: true, found: true, trace: path(keyOf(combination, data), { combination: next, event }), combinations: seen.size, flags: [] };
        const key = keyOf(next, data);
        if (seen.has(key)) continue;
        seen.set(key, { combination: next, parent: keyOf(combination, data), event });
        hold(next);
        if (wanted.state?.(next)) return { answered: true, found: true, trace: path(key), combinations: seen.size, flags: [] };
        queue.push(next);
      }
    }
    if (Date.now() > deadline) return { answered: false, reason: `ran out of time: stopped after ${seconds} s`, combinations: seen.size };
  }
  // The whole abstraction explored: what it met (evidence.md §flags).
  const flags = [];
  for (const l of data.lifecycles) for (const phase of l.phases) if (!held.get(l.key).has(phase)) flags.push(`unreachable-phase ${l.key}/${phase}`);
  for (const event of events) if (!taken.has(eventOf(event.action, event.case))) flags.push(`untaken-action ${event.action}${event.case ? `/${event.case}` : ''}`);
  for (const pair of met) flags.push(`open-pair ${pair}`);
  return { answered: true, found: false, trace: null, combinations: seen.size, flags: [...new Set(flags)].sort() };
}

/**
 * The phases each lifecycle of the data form reaches from its initial phase as moves lead (lifecycle-tool.md §as-read), an open
 * cell leading to every phase: used to tell a start the data form cannot hold (evidence.md §lifecycle-journeys).
 */
export function reachablePhases(data) {
  const out = new Map();
  for (const l of data.lifecycles) {
    const seen = new Set([l.initial.phase]);
    const queue = [l.initial.phase];
    while (queue.length) {
      const phase = queue.shift();
      for (const action of l.actions) {
        const cell = l.cells[phase]?.[action];
        const outcomes = cell?.kind === 'cases' ? cell.cases.map((c) => c.outcome) : [cell ?? { kind: 'empty' }];
        for (const o of outcomes) {
          const to = o.kind === 'phase' ? [o.phase] : o.kind === 'refused' ? [] : l.phases;
          for (const next of to) if (l.phases.includes(next) && !seen.has(next)) { seen.add(next); queue.push(next); }
        }
      }
    }
    out.set(l.key, seen);
  }
  return out;
}
