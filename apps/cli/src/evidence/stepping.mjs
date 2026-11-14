// A journey on the lifecycle engine (evidence.md §lifecycle-journeys): a confirmed journey stepped through the data
// form with no schedule, as the lifecycle tool steps a journey (lifecycle-tool.md §stepping), through
// ../design/lifecycle-tool.mjs's stepJourney; and the traces of the lifecycle engine, in phases (engines.md §trace).

import { stepJourney } from '../design/lifecycle-tool.mjs';
import { resolveRef } from '../record/pages.mjs';
import { reachablePhases } from './lifecycle-engine.mjs';

/**
 * Steps `journey` through the data form (evidence.md §lifecycle-journeys, engines.md §lifecycle-engine): `data` as lifecycle-engine.mjs writes it, `lifecycles`
 * the design's lifecycles as read that it holds, `actions` the part's actions. `variant` is `path` for a should-happen
 * journey, `refused-at` to step a must-not journey through its refused step, or `to` to step its steps before the
 * refused one. Gives `{ outcome: 'admitted' }` or `{ outcome: 'refused', step }`, with `stepped`, the tool's own
 * stepping, and `upTo`, the steps it admitted; or `{ unchecked }`, why the tool's stepping ended where what a step does
 * is not known, so the journey has no question there.
 */
export function stepLifecyclePath(ctx, data, lifecycles, actions, journey, variant) {
  const from = journey.from ?? journey.holder;
  // A start the data form cannot hold is refused at step 0 (evidence.md §lifecycle-journeys).
  const reach = reachablePhases(data);
  for (const row of journey.start ?? []) {
    const ref = resolveRef(ctx.restatement, row.lifecycle, from, 'lifecycles');
    const held = ref.entry ? data.lifecycles.find((l) => `${data.part}/lifecycles/${l.key}` === ref.entry.entry) : null;
    if (held && !reach.get(held.key)?.has(row.phase)) return { outcome: 'refused', step: 0, upTo: 0, stepped: null };
  }
  const refused = journey.polarity === 'must not' ? journey.refusedStep : null;
  const asked = variant === 'to'
    ? { ...journey, polarity: 'should happen', expectedEnd: '-', refusedStep: null, steps: journey.steps.slice(0, refused - 1) }
    : journey;
  let stepped;
  try {
    stepped = stepJourney(lifecycles, actions, { ...asked, from });
  } catch (error) {
    return { unchecked: `the lifecycle tool could not step the journey: ${error.message}` };
  }
  const ended = stepped.ended ?? { why: 'completed' };
  // A step entering a lifecycle whose entity the journey already holds is refused, as the data form refuses it
  // (evidence.md §lifecycle-journeys, engines.md §lifecycle-engine): the tool admits it with the finding creates-existing-entity, and records its move.
  const again = (stepped.moves ?? []).find((m) => m.entered && m.from !== null && m.from !== undefined);
  if (again) return { outcome: 'refused', step: again.step, upTo: again.step - 1, stepped };
  if (ended.why === 'refused') return { outcome: 'refused', step: stepped.refusedAt, upTo: stepped.admitted, stepped };
  if (ended.why === 'completed') return { outcome: 'admitted', upTo: stepped.admitted, stepped };
  // A start row whose lifecycle the data form does not hold is a start the data form cannot hold: refused at step 0.
  if (ended.why === 'unresolved' && ended.step === 0) return { outcome: 'refused', step: 0, upTo: 0, stepped };
  return { unchecked: ended.says ?? `the lifecycle tool's stepping ended at step ${ended.step} (${ended.why})` };
}

/**
 * The trace of a stepping (engines.md §trace): its states, the first numbered 0, each later one with the row that took
 * the step into it, `{ action, case }`, and each entity's phase there, by lifecycle as `<part>/<lifecycle>`, from the
 * tool's moves; entities named as the journey names them, or by their lifecycle's key, an entity not yet held absent.
 */
export function steppingTrace(ctx, data, journey, result) {
  const from = journey.from ?? journey.holder;
  const inForm = new Set(data.lifecycles.map((l) => `${data.part}/lifecycles/${l.key}`));
  const held = new Map();
  const set = (lifecycle, entity, phase) => {
    if (!held.has(lifecycle)) held.set(lifecycle, new Map());
    held.get(lifecycle).set(entity, phase);
  };
  for (const row of journey.start ?? []) {
    const ref = resolveRef(ctx.restatement, row.lifecycle, from, 'lifecycles');
    if (ref.entry && inForm.has(ref.entry.entry)) set(ref.entry.entry, row.entity, row.phase);
  }
  const snapshot = () => {
    const out = {};
    for (const [lifecycle, entities] of [...held].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const [part, , key] = lifecycle.split('/');
      out[`${part}/${key}`] = Object.fromEntries([...entities].sort(([a], [b]) => (a < b ? -1 : 1)));
    }
    return out;
  };
  const states = [{ phases: snapshot() }];
  const moves = result?.stepped?.moves ?? [];
  for (const step of journey.steps.slice(0, result?.upTo ?? 0)) {
    for (const move of moves.filter((m) => m.step === step.step && inForm.has(m.lifecycle))) set(move.lifecycle, move.entity, move.to);
    const ref = resolveRef(ctx.restatement, step.action, from, 'actions');
    states.push({ rows: [{ action: `${ref.part}/${ref.key}`, case: step.case ?? '-' }], phases: snapshot() });
  }
  return { states };
}

/**
 * The trace of an exploration (engines.md §lifecycle-engine, §trace): explore()'s shortest journey as states, each later one with
 * its action's row, `{ action, case }`, and each lifecycle's one entity, named by its lifecycle's key, in its phase.
 */
export function explorationTrace(data, trace) {
  return {
    states: trace.map(({ combination, event }, at) => {
      const phases = {};
      for (const l of data.lifecycles) if (combination[l.key] !== null) phases[`${data.part}/${l.key}`] = { [l.key]: combination[l.key] };
      return at === 0 ? { phases } : { rows: [{ action: `${data.part}/${event.action}`, case: event.case ?? '-' }], phases };
    }),
  };
}
