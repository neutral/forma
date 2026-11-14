// The journey a `model wrong` ruling keeps of a surprise (decisions.md §kept-journeys): computed from the
// surprise's trace at the ruling, as a must-not journey keyed `kept-<12 hex>` in the claim's part or
// span, or why none is kept, naming the condition its trace fails.

import { basisDigest } from '../record/json.mjs';
import { resolveRef } from '../record/pages.mjs';

/** A reference to `<part>/<key>` as written from `from` (forms.md §page-rules): the key alone within its own part. */
const refFrom = (from, part, key) => (from && !from.span && from.key === part ? key : `${part}/${key}`);

/**
 * The kept journey of one surprise (decisions.md §kept-journeys): `{ journey: { name, pin, journey } }`, the journey in a journey
 * page's form, or `{ notKept: <why> }`. `a` is the account (src/account/index.mjs accountOf), `surprise` one of
 * readEvidence's surprises.
 */
export function keptOf(a, surprise) {
  const { project, design, evidence } = a;
  const r = project.restatement;
  const where = surprise.where;
  const value = surprise.value;
  if (where?.question?.kind !== 'base' || where.thing?.kind !== 'claims') return { notKept: "the surprise is on no claim's base question" };
  const claim = r.things.get(`${where.holder.key}/claims/${where.thing.key}`);
  if (!claim) return { notKept: 'the claim its question serves no longer stands' };
  if (claim.claimKind === 'liveness') return { notKept: 'the claim is a liveness claim, whose violation is a behaviour without end that no journey refused at a step tells' };
  const state = evidence.models.get(surprise.model);
  const engine = value.basis?.engine?.name;
  const own = { tlc: ['Invariant', 'Property'], alloy: ['Claim'], lifecycle: ['forbidden form'] }[engine] ?? [];
  const typeInvariant = state?.model?.typeInvariant ?? null;
  const typed = typeInvariant && (value.found.property === typeInvariant || value.found.property === (typeInvariant.name ?? typeInvariant) || value.found.property === 'TypeInvariant');
  if (value.found?.outcome !== 'violation' || !(own.includes(value.found.property) || typed)) return { notKept: "it found no violation of the claim's property or of the type invariant" };
  const trace = value.trace;
  const states = trace?.states ?? [];
  if (states.length < 2) return { notKept: 'its trace has no step: a violation in the first state is told by no journey, which has one step or more' };

  const lifecycleModel = engine === 'lifecycle';
  const modelParts = state?.model?.parts ?? [];
  const lifecycles = [...design.lifecycles.values()].filter((l) => modelParts.includes(l.part));
  const lname = (l) => `${l.part}/${l.key}`;
  // The conditions on entities bear on the lifecycles of the model's parts; with none, the steps alone tell the journey.
  if (lifecycles.length && states.some((s) => !s.phases)) return { notKept: `its trace keeps no phases${trace.replay ? `: ${trace.replay}` : ''}, so no step's entities can be told` };

  // Each step: exactly one action of the model's action table, or on a lifecycle model an action of its part.
  const steps = [];
  for (let i = 1; i < states.length; i += 1) {
    const rows = states[i].rows ?? [];
    const actions = rows.filter((row) => row.action);
    const tableRows = lifecycleModel
      ? actions.filter((row) => row.action.startsWith(`${modelParts[0]}/`) && r.parts.get(modelParts[0])?.actions.some((x) => x.key === row.action.split('/')[1]))
      : actions.filter((row) => (state.model.actions ?? []).some((x) => x.action === row.action));
    if (tableRows.length !== 1 || rows.length !== actions.length || actions.length !== 1) {
      return { notKept: `step ${i} is ${rows.length ? rows.map((x) => x.action ?? x.misbehaviour ?? x.operator).join(' or ') : 'taken by no row'}, and each step is one action ${lifecycleModel ? 'of the lifecycle model\'s part' : "of the model's action table, which exactly one row of it takes"}` };
    }
    const [part, key] = tableRows[0].action.split('/');
    steps.push({ at: i, part, key, case: tableRows[0].case && tableRows[0].case !== '-' ? tableRows[0].case : null });
  }

  // Each entity a state holds is in exactly one phase; an entity a state does not hold is entered by an action.
  const entitiesOf = (l) => [...new Set(states.flatMap((s) => Object.keys(s.phases?.[lname(l)] ?? {})))];
  const phaseAt = (l, e, i) => {
    const v = states[i].phases?.[lname(l)]?.[e];
    return typeof v === 'string' ? v : null;
  };
  for (const l of lifecycles) {
    for (const e of entitiesOf(l)) {
      for (let i = 0; i < states.length; i += 1) {
        const v = states[i].phases?.[lname(l)]?.[e];
        if (v !== undefined && v !== null && typeof v !== 'string') return { notKept: `in state ${i}, ${e} of ${l.entry} is in no one phase` };
      }
      const held = states.map((_, i) => phaseAt(l, e, i) !== null);
      if (held.every(Boolean)) continue;
      const enteredBy = l.initial?.enteredBy ?? null;
      const first = held.indexOf(true);
      const ok = enteredBy && first > 0 && held.slice(first).every(Boolean) && steps[first - 1]?.key === enteredBy && steps[first - 1]?.part === l.part;
      if (!ok) return { notKept: `${e} of ${l.entry} is held by some states and not others, and only an entity its lifecycle's entering action enters is held from that step on and by no state before it` };
    }
  }

  // Each step moves at most one entity of each lifecycle having its action as a column, one case's cell moving it.
  const actedOn = new Map(lifecycles.map((l) => [l.entry, new Set()]));
  const stepEntity = [];
  for (const step of steps) {
    const i = step.at;
    let found = step.case;
    let entity = null;
    for (const l of lifecycles) {
      if (l.part !== step.part) continue;
      const column = l.actions.includes(step.key);
      const enters = l.initial?.enteredBy === step.key;
      if (!column && !enters) continue;
      const all = entitiesOf(l);
      const moved = all.filter((e) => phaseAt(l, e, i - 1) !== phaseAt(l, e, i));
      if (moved.length > 1) return { notKept: `step ${i} moves ${moved.length} entities of ${l.entry}, and a step moves at most one` };
      if (!moved.length && all.length !== 1) return { notKept: `step ${i} moves no entity of ${l.entry}, and the trace holds ${all.length} of them, so which it acts on cannot be told` };
      const e = moved[0] ?? all[0];
      const before = phaseAt(l, e, i - 1);
      const after = phaseAt(l, e, i);
      if (before === null) {
        if (after !== l.initial.phase) return { notKept: `step ${i} enters ${e} of ${l.entry} in ${after}, and an entity its action enters is in its lifecycle's initial phase, ${l.initial.phase}` };
      } else if (column) {
        const cell = (l.asRead ?? l.cells)?.[before]?.[step.key];
        const fits = (o) => o?.kind === 'phase' && o.phase === after;
        if (cell?.kind === 'cases') {
          const cases = cell.cases.filter((c) => fits(c.outcome)).map((c) => c.case);
          if (cases.length !== 1) return { notKept: `at step ${i}, ${cases.length ? 'several cases' : 'no case'} of ${step.key}'s cell at ${before} in ${l.entry} move${cases.length ? '' : 's'} ${e} to ${after}` };
          if (found && found !== cases[0]) return { notKept: `step ${i} is ${step.key} as ${found} in one lifecycle and as ${cases[0]} in another` };
          found = cases[0];
        }
        // An action without cases is not held to its cell (decisions.md §kept-journeys): the step the model wrongly admits is the one the kept journey refuses.
      }
      actedOn.get(l.entry).add(e);
      entity = entity ?? { lifecycle: l, entity: e };
    }
    step.case = found;
    stepEntity.push(entity);
  }
  for (const l of lifecycles) {
    const many = actedOn.get(l.entry).size > 1;
    if (many) for (const e of actedOn.get(l.entry)) if (phaseAt(l, e, 0) === null) return { notKept: `${e} of ${l.entry} is missing from the first state, and the steps act on several entities of that lifecycle` };
  }

  // The journey (decisions.md §kept-journeys): Polarity must not, its last step refused, Origin added, citing the claim's passages.
  const from = claim.holder;
  const actionOf = (part, key) => r.parts.get(part)?.actions.find((x) => x.key === key);
  const actorNames = (part, key) => {
    const action = actionOf(part, key);
    const row = action ? resolveRef(r, action.actor, { key: part, span: false }, 'boundary').entry : null;
    return row?.names ?? action?.actor ?? '-';
  };
  const oneEach = (step) => lifecycles.filter((l) => l.part === step.part && l.actions.includes(step.key)).every((l) => actedOn.get(l.entry).size <= 1);
  const journeySteps = steps.map((step, n) => ({
    step: n + 1,
    actor: actorNames(step.part, step.key),
    action: refFrom(from, step.part, step.key),
    arguments: '-',
    entity: oneEach(step) || !stepEntity[n] ? '-' : stepEntity[n].entity,
    case: step.case ?? '-',
  }));
  const start = [];
  for (const l of lifecycles) {
    const acted = actedOn.get(l.entry);
    for (const e of [...acted].sort()) {
      const phase = phaseAt(l, e, 0);
      if (phase === null) continue;
      if (acted.size > 1 || phase !== l.initial.phase) start.push({ lifecycle: refFrom(from, l.part, l.key), entity: e, phase });
    }
  }
  const key = `kept-${basisDigest(value.basis).slice(0, 12)}`;
  const journey = { polarity: 'must not', expectedEnd: '-', refusedStep: String(journeySteps.length), origin: 'added', cites: [...claim.cites], start, steps: journeySteps };
  const pinned = r.pins.journey({ ...journey, refusedStep: journeySteps.length }, from);
  return { journey: { name: `${from.key}/journeys/${key}`, pin: pinned.pin, journey } };
}
