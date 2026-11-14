// Rendering a trace as a journey in the developer's terms (presentation.md §rendering), from what the evidence or
// the surprise holds (engines.md §trace), so it shows what the trace meant when it ran: each step by the row that
// took it, as `rendered` holds it; each state's phases; the journey lit on the lifecycles confirmed
// when it is shown, through ../design/lifecycle-tool.mjs's lifecyclePicture; what the evidence says (evidence.md §result-says) with
// its bounds and kind of search (evidence.md §search); and a surprise with its kept reductions, its weaker forms and
// its accepted explanation.

import { lifecyclePicture, pictureBasis } from '../design/lifecycle-tool.mjs';
import { createHash } from 'node:crypto';
import { MENU_NAMES } from '../record/models.mjs';

/** The kind of search of an engine (evidence.md §search), derived from the engine the basis names. */
export const searchOf = (engine) => (engine === 'tlc' ? "TLC's bounded exhaustive model checking, within its constants" : engine === 'alloy' ? "Alloy's scoped search" : "the lifecycle engine's bounded exhaustive search, at phase level");

/** The bounds evidence ran at, as one line (evidence.md §keys). */
const boundsText = (bounds) => (bounds === 'phase level' ? 'phase level' : Object.entries(bounds ?? {}).map(([bound, value]) => `${bound} = ${value}`).join(', ') || 'no bounds');

/** What a result says (evidence.md §result-says), in its words, with the bounds it ran at. */
function saysOf(value) {
  const found = value.found;
  const within = value.bounds === 'phase level' ? 'at phase level' : `within the bounds ${boundsText(value.bounds)}`;
  switch (found.outcome) {
    case 'no violation': return `no violation ${within}`;
    case 'violation': return `${found.property} is violated ${within}`;
    case 'reached': return `reached in at least one behaviour ${within}, which does not say it is always reachable`;
    // A should-happen journey's path with its reason: some behaviour takes every step, and in none does End hold after the last (evidence.md §result-says).
    case 'not reached': return found.reason ? `not reached ${within}: ${found.reason}; some behaviour takes every step, and in none does End, the schedule's reading of the journey's Expected end, hold after the last` : `not reached in any behaviour ${within}`;
    case 'enabled': return `the refused step is enabled after the steps before it, in at least one behaviour ${within}`;
    case 'not enabled': return `refused at this step in every behaviour ${within} that takes the steps before it; that a behaviour takes them is the journey's path question's to show`;
    case 'admitted': return `admitted ${within}`;
    case 'refused': return found.step === 0 ? `refused at its start ${within}: the lifecycles cannot hold it` : `refused at step ${found.step} ${within}`;
    default: return `unanswered (${found.reason}): it says nothing about the question`;
  }
}

/** A canonical content's field (design.md §pins), `Field: value`; null where it holds none. */
const field = (content, name) => (content ?? '').split('\n').find((line) => line.startsWith(`${name}: `))?.slice(name.length + 2) ?? null;

const bindingsText = (bindings) => {
  const pairs = Object.entries(bindings ?? {});
  return pairs.length ? ` (${pairs.map(([name, v]) => `${name} = ${v}`).join(', ')})` : '';
};

/**
 * One row of a step in the developer's terms (presentation.md §rendering): an action by its sentence, a world row by its names
 * and the menu item, a step outside the tables by its operator's name; the faulted action with the mechanism its
 * fault removes.
 */
function rowText(row, rendered, fault) {
  if (row.action) {
    const [part, key] = row.action.split('/');
    const content = rendered.find((r) => r.entry === `${part}/actions/${key}`)?.content;
    const sentence = field(content, 'Sentence') ?? row.action;
    const as = row.case && row.case !== '-' ? `, as ${row.case}` : '';
    const faulted = fault && fault.action === row.action ? `; the fault in place of this action removes ${fault.mechanism}` : '';
    return `${sentence}${as}${bindingsText(row.bindings)}${faulted}`;
  }
  if (row.misbehaviour) {
    const [part, key, item] = row.misbehaviour.split('/');
    const content = rendered.find((r) => r.entry === `${part}/boundary/${key}`)?.content;
    return `${field(content, 'Names') ?? `${part}/${key}`}: ${MENU_NAMES[item] ?? item}${bindingsText(row.bindings)}`;
  }
  return `${row.operator}, a step the engine names outside the model's tables${bindingsText(row.bindings)}`;
}

/** Each entity's phase in a state, as `<entity> (<lifecycle>) <phase>` (presentation.md §rendering). */
function phaseLines(phases) {
  const out = [];
  for (const [lifecycle, held] of Object.entries(phases ?? {})) for (const [entity, phase] of Object.entries(held)) out.push({ key: `${lifecycle}\0${entity}`, text: `${entity} (${lifecycle}) ${phase === null ? 'in no phase' : `in ${phase}`}`, phase });
  return out;
}

/**
 * A refusal's refused step as its journey's content in `rendered` gives it (engines.md §trace, presentation.md §rendering; design.md §pins's
 * `Step <n>: <actor> | <action> | <arguments> | <entity> | <case>`): `{ sentence, case, arguments }`, the action by
 * its sentence; null where `rendered` holds no such line, as in a surprise written before it held its journey.
 */
function refusedStep(value) {
  const n = value.expected?.step;
  const content = (value.rendered ?? []).find((r) => typeof r.entry === 'string' && r.entry.includes('/journeys/'))?.content ?? '';
  const line = content.split('\n').find((l) => l.startsWith(`Step ${n}: `));
  const fields = line ? line.slice(`Step ${n}: `.length).split(' | ') : [];
  if (fields.length < 5) return null;
  const [args, , kase] = fields.slice(-3);
  const action = fields.slice(1, -3).join(' | ');
  return { sentence: /^(.*?)(?: \(cases [^()]*\))?(?: \(guard .*\))?$/s.exec(action)[1], case: kase, arguments: args };
}

/**
 * A trace's steps in the developer's terms (presentation.md §rendering): the first state with every entity's phase, each later
 * one with the row or rows that took its step and the entities whose phase changed, or that none did; the step by
 * which it loops back; for a refusal on TLC, whose trace ends where the refused step is enabled, that step after the
 * last state; and why it shows no phases or bindings when it was kept without them. `fault`, for a fault's trace,
 * `{ action, mechanism }`.
 */
function traceLines(value, { fault = null } = {}) {
  const trace = value.trace;
  if (!trace) return [];
  const rendered = value.rendered ?? [];
  const lines = [];
  let before = null;
  trace.states.forEach((state, at) => {
    const now = phaseLines(state.phases);
    const rows = state.rows ?? [];
    const step = at === 0 ? 'the start' : rows.length ? rows.map((row) => rowText(row, rendered, fault)).join('; or, read alike, ') : "no row of the model's tables takes this step";
    let phases = '';
    if (state.phases) {
      if (before === null) phases = now.length ? ` — ${now.map((p) => p.text).join(', ')}` : ' — no entity held';
      else {
        const changed = now.filter((p) => before.get(p.key) !== p.phase);
        phases = changed.length ? ` — ${changed.map((p) => p.text).join(', ')}` : ' — no phase changes';
      }
      before = new Map(now.map((p) => [p.key, p.phase]));
    }
    lines.push(`${at}. ${step}${phases}`);
  });
  // A refusal is rendered through its refused step (presentation.md §rendering): on TLC the trace ends in the state where that step is enabled,
  // so it follows the last state; on Alloy, whose run takes it, the trace shows it as it shows every step.
  if (value.kind === 'refusal' && value.basis?.engine?.name === 'tlc') {
    const n = value.expected?.step;
    const refused = refusedStep(value);
    const text = refused ? `${refused.sentence}${refused.case && refused.case !== '-' ? `, as ${refused.case}` : ''}${refused.arguments && refused.arguments !== '-' ? ` (${refused.arguments})` : ''}` : `step ${n} of the journey`;
    lines.push(`${trace.states.length}. ${text}: enabled here, where the journey says its step ${n} must be refused`);
  }
  if (trace.loop === 'stutter') lines.push('then the behaviour stutters: no step is taken again');
  else if (trace.loop) lines.push(`then back to state ${trace.loop.to}, by ${trace.loop.rows.length ? trace.loop.rows.map((row) => rowText(row, rendered, fault)).join('; or, read alike, ') : "a step no row of the model's tables takes"}`);
  if (trace.replay) lines.push(`no phases or bindings are shown: ${trace.replay}`);
  return lines;
}

/**
 * The trace lit on the lifecycles confirmed now whose entity it holds (presentation.md §rendering): for each, its picture
 * (lifecycle-tool.md §as-read) with each phase it holds visited and each move it takes followed by its steps' numbers, the step by
 * which it loops back marked. A step of one of the lifecycle's actions that leaves its entity where it was marks the
 * move its cell gives in place when the trace holds one entity of the lifecycle; with several, it marks none.
 */
function litPictures(ctx, value) {
  const trace = value.trace;
  if (!trace) return [];
  const out = [];
  const states = trace.states;
  const rowAction = (rows, part) => (rows ?? []).filter((r) => r.action?.startsWith(`${part}/`)).map((r) => ({ key: r.action.slice(part.length + 1), case: r.case && r.case !== '-' ? r.case : null }));
  for (const lifecycle of ctx.lifecycles.values()) {
    if (!lifecycle.confirmed) continue;
    const part = lifecycle.part ?? lifecycle.holder?.key;
    const name = `${part}/${lifecycle.key}`;
    const entities = [...new Set(states.flatMap((s) => Object.keys(s.phases?.[name] ?? {})))];
    if (!entities.length) continue;
    const read = lifecycle.asRead ?? lifecycle.cells;
    const caseOf = (from, action, to) => {
      const cell = read?.[from]?.[action];
      if (cell?.kind !== 'cases') return null;
      const fits = cell.cases.filter((c) => c.outcome.kind === 'phase' && c.outcome.phase === to);
      return fits.length === 1 ? fits[0].case : undefined;
    };
    const lit = [];
    const take = (left, right, rows, step, loop = false) => {
      const actions = rowAction(rows, part).filter((a) => lifecycle.actions.includes(a.key) || lifecycle.initial.enteredBy === a.key);
      let moved = false;
      for (const entity of entities) {
        const from = left?.[name]?.[entity];
        const to = right?.[name]?.[entity];
        if (to === undefined || to === null) continue;
        lit.push({ phase: to, entity, steps: [step], loop });
        if (from === undefined || from === null) { moved = true; continue; }
        if (from === to) continue;
        moved = true;
        for (const a of actions) {
          const c = a.case ?? caseOf(from, a.key, to);
          if (c !== undefined) lit.push({ from, action: a.key, case: c, to, entity, steps: [step], loop });
        }
      }
      if (!moved && entities.length === 1) {
        const phase = right?.[name]?.[entities[0]];
        if (phase === undefined || phase === null) return;
        for (const a of actions) {
          const c = a.case ?? caseOf(phase, a.key, phase);
          if (c !== undefined && (read?.[phase]?.[a.key]?.kind === 'phase' ? read[phase][a.key].phase === phase : c !== null)) lit.push({ from: phase, action: a.key, case: c, to: phase, entity: entities[0], steps: [step], loop });
        }
      }
    };
    for (const entity of entities) {
      const first = states[0]?.phases?.[name]?.[entity];
      if (first !== undefined && first !== null) lit.push({ phase: first, entity, steps: [0] });
    }
    states.forEach((state, at) => { if (at > 0) take(states[at - 1].phases, state.phases, state.rows, at); });
    if (trace.loop && typeof trace.loop === 'object') take(states.at(-1).phases, states[trace.loop.to]?.phases, trace.loop.rows, states.length, true);
    out.push({ lifecycle: lifecycle.entry, picture: lifecyclePicture(lifecycle, lit, {basis:pictureBasis(ctx.project,lifecycle),source:{question:value.question??value.name,digest:createHash('sha256').update(JSON.stringify(value.trace)).digest('hex')}}) });
  }
  return out;
}

/** The fault a fault question's evidence was composed with (engines.md §trace `rendered`): its action, from its slot as it stands, and its mechanism. */
function faultOf(ctx, value) {
  const item = (value.rendered ?? []).find((r) => r.fault);
  if (!item) return null;
  return { action: ctx.project.slots.get(item.fault)?.form?.action ?? null, mechanism: item.mechanism };
}

/**
 * One piece of evidence, a surprise or a reduction's or weaker form's evidence, rendered (presentation.md §rendering): `{ says,
 * search, bounds, lines, pictures }`.
 */
export function renderEvidence(ctx, value) {
  const engine = value.basis.engine.name;
  return {
    says: saysOf(value),
    search: searchOf(engine),
    bounds: boundsText(value.bounds),
    lines: traceLines(value, { fault: faultOf(ctx, value) }),
    pictures: litPictures(ctx, value),
  };
}

/**
 * A surprise as the account and the decisions show it (presentation.md §rendering): its own rendering and its kept reductions',
 * ordered by their number of steps, fewest first, the surprise's own last among equals and a later reduction before an
 * earlier one; its weaker forms' outcomes and the weakest that fails (evidence.md §weaker); and its accepted explanation beside it, as
 * an aid. `surprise` is one of evidence/index.mjs's surprises.
 */
export function renderSurprise(ctx, surprise) {
  const steps = (value) => Math.max(0, (value.trace?.states.length ?? 1) - 1);
  const items = [
    ...surprise.reductions.kept.map((r) => ({ own: false, n: r.n, value: r.value })),
    { own: true, n: 0, value: surprise.value },
  ];
  items.sort((a, b) => steps(a.value) - steps(b.value) || Number(a.own) - Number(b.own) || b.n - a.n);
  return {
    name: surprise.name,
    traces: items.map((item) => ({ of: item.own ? surprise.name : item.value.name, ...renderEvidence(ctx, item.value) })),
    weaker: surprise.weaker.map((w) => ({ key: w.key, found: w.found, says: w.found ? (w.found.outcome === 'violation' ? `violated: ${w.found.property}` : w.found.outcome === 'unanswered' ? `unanswered: ${w.found.reason}` : w.found.outcome) : 'not yet run' })),
    weakest: surprise.weakest,
    explanation: surprise.explanation,
  };
}
