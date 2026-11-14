// The questions asked now (evidence.md §questions): on every usable model, each kind's question for what its
// row of evidence.md §questions's table names, with its engine, bounds and their digest (evidence.md §bounds), its name and evidence
// path (evidence.md §question-names), its expected outcome, fixed before anything runs, and the entries it reads; a
// journey's question on the lifecycle engine (evidence.md §lifecycle-journeys); and, for each open surprise, its next
// reduction (evidence.md §reductions) and the weaker forms of its accepted explanation (evidence.md §weaker).

import { boundsDigest, boundsObject, evidencePath, normalizeBound, questionBounds, questionName, stemFiles } from '../record/evidence.mjs';
import { claimBounds, covers, parseScope, parseValue, valueText } from '../record/models.mjs';
import { journeyEntities, resolveRef } from '../record/pages.mjs';
import { compare, sortedBy } from '../record/json.mjs';
import { dataForm } from './lifecycle-engine.mjs';
import { stepLifecyclePath } from './stepping.mjs';

const lifecycleEntry = (row) => {
  const [part, key] = row.split('/');
  return `${part}/lifecycles/${key}`;
};
const actionEntry = (ref) => {
  const [part, key] = ref.split('/');
  return `${part}/actions/${key}`;
};

/** The bounds of a question on a model (evidence.md §bounds): normalized, with their digest and as evidence writes them. */
function boundsOf(model, claimKind = null) {
  if (model.engine === 'lifecycle') return { bounds: 'phase level', digest: null, object: 'phase level' };
  const bounds = questionBounds(model, claimKind);
  return { bounds, digest: boundsDigest(bounds), object: boundsObject(bounds) };
}

/** A question as every module reads it, with its name and path (evidence.md §question-names) and its reads sorted. */
function question(fields) {
  const name = fields.name ?? questionName(fields);
  return { ...fields, name, path: fields.path ?? evidencePath(name), reads: sortedBy([...new Set(fields.reads)]), shape: fields.shape ?? 'evidence' };
}

/** Each lifecycle the model's Phases rows name, by entry name, which every Alloy question also reads (evidence.md §questions). */
const phasesReads = (model) => model.phases.map((row) => lifecycleEntry(row.lifecycle));

/** Each lifecycle and action of a lifecycle model's part, which every lifecycle engine question reads (evidence.md §questions). */
function partReads(ctx, part) {
  const holder = ctx.restatement.parts.get(part);
  return [...[...(holder?.things.lifecycles.values() ?? [])].map((l) => l.entry), ...(holder?.actions ?? []).map((a) => a.entry)];
}

/** The entries a journey's path or refusal reads (evidence.md §questions): the journey, its steps' actions, the lifecycles its cases move in, and its start's. */
function journeyReads(ctx, journey, withSteps = true) {
  const reads = [journey.entry];
  const from = journey.holder;
  for (const row of journey.start ?? []) {
    const ref = resolveRef(ctx.restatement, row.lifecycle, from, 'lifecycles');
    if (ref.entry) reads.push(ref.entry.entry);
  }
  if (!withSteps) return reads;
  const { steps } = journeyEntities(ctx.restatement, journey, from);
  journey.steps.forEach((step, at) => {
    const ref = resolveRef(ctx.restatement, step.action, from, 'actions');
    if (!ref.entry) return;
    reads.push(ref.entry.entry);
    if (step.case === null) return;
    for (const move of steps[at]?.moves ?? []) {
      const lifecycle = ctx.lifecycles.get(move.lifecycle) ?? ctx.restatement.things.get(move.lifecycle);
      if (lifecycle?.actions.includes(ref.key)) reads.push(move.lifecycle);
    }
  });
  return reads;
}

/** A thing's folder under a model (design.md §paths, models.md §paths). */
const folderOf = (model, holder, kind, key) => `models/${model}/${holder.span ? 'spans' : 'parts'}/${holder.key}/${kind}/${key}`;

/** The slot states in a folder of one kind (models.md §slots), from currency.mjs's slot states. */
const slotsIn = (slots, folder, kind) => [...slots.files.values()].filter((s) => s.kind === kind && s.path.startsWith(`${folder}/`) && !s.path.slice(folder.length + 1).includes('/'));

/** The data form's lifecycles and the part's actions, for a lifecycle model's journeys (evidence.md §lifecycle-journeys, engines.md §lifecycle-engine). */
function lifecycleModelForm(ctx, state) {
  const lifecycles = state.lifecycles.map((name) => ctx.lifecycles.get(name)).filter(Boolean);
  const actions = ctx.restatement.parts.get(state.part)?.actions ?? [];
  return { data: dataForm(state.part, lifecycles, actions), lifecycles, actions };
}

/**
 * The question a confirmed journey has on a lifecycle model (evidence.md §lifecycle-journeys), or null while its stepping through the
 * data form meets a cell that is empty or posed with no pick in force. A must-not journey refused at step n is asked
 * `lifecycle-path-refused-at-<n>` when the model holds its evidence, or when its stepping now admits every step before
 * n and refuses step n; otherwise `lifecycle-path-to-<m>`, m = n − 1.
 */
function lifecycleQuestion(ctx, state, journey) {
  const form = lifecycleModelForm(ctx, state);
  const reads = [...journeyReads(ctx, journey, false), ...partReads(ctx, state.part)];
  const base = { kind: 'lifecycle-path', engine: 'lifecycle', model: state.key, holder: journey.holder, thingKind: 'journeys', key: journey.key, journey, serves: journey.entry, bounds: 'phase level', boundsObject: 'phase level', digest: null };
  // The tool's own stepping of the journey, through its last step or its refused step (lifecycle-tool.md §stepping).
  const stepped = stepLifecyclePath(ctx, form.data, form.lifecycles, form.actions, journey, journey.polarity === 'must not' ? 'refused-at' : 'path');
  if (stepped.unchecked) return { unchecked: stepped.unchecked };
  // A should-happen journey's Expected end is not asked here: the lifecycle engine steps it with no schedule, so with no
  // End (evidence.md §lifecycle-journeys); its TLC and Alloy path questions ask End (evidence.md §questions, engines.md §composition).
  if (journey.polarity !== 'must not') return question({ ...base, variant: 'path', expected: { outcome: 'admitted' }, reads });
  const n = journey.refusedStep;
  const refusedAt = question({ ...base, variant: 'refused-at', step: n, expected: { outcome: 'refused', step: n }, reads });
  const held = ctx.project.evidence.get(refusedAt.path);
  if (held?.counts || (stepped.outcome === 'refused' && stepped.step === n)) return refusedAt;
  return question({ ...base, variant: 'to', step: n - 1, expected: { outcome: 'admitted', step: n - 1 }, reads });
}

/** The steps a journey or a choice's alternative takes (evidence.md §questions): every step of a should-happen one; those before its refused step of a must-not one. */
const takenSteps = (journey) => (journey.polarity === 'must not' ? (journey.steps ?? []).slice(0, Math.max(0, (journey.refusedStep ?? 1) - 1)) : journey.steps ?? []);

/**
 * The actions owed no `enabled` question (evidence.md §questions, account.md §journey-rules), by entry name: each that only an alternative a
 * pick in force did not pick takes as a step, no other journey or alternative taking it, since the developer chose the
 * other grain. Every journey counts, confirmed or not, the journeys code adds included; a pick's must-not journey takes
 * only the steps before its refused one, those it shares with the picked alternative.
 */
export function unpickedOnly(ctx) {
  const unpicked = new Set();
  const elsewhere = new Set();
  const add = (into, journey, from) => {
    for (const step of takenSteps(journey)) {
      const ref = resolveRef(ctx.restatement, step.action, from, 'actions');
      if (ref.entry) into.add(ref.entry.entry);
    }
  };
  for (const journey of ctx.journeys.values()) add(elsewhere, journey, journey.holder);
  for (const choice of ctx.restatement.things.values()) {
    if (choice.kind !== 'choices') continue;
    const pick = ctx.design?.picks?.get(choice.entry)?.pick ?? null;
    for (const [name, alternative] of Object.entries(choice.alternatives ?? {})) add(pick !== null && name !== pick ? unpicked : elsewhere, alternative, choice.holder);
  }
  return new Set([...unpicked].filter((entry) => !elsewhere.has(entry)));
}

/**
 * Every question asked now on the usable models that is not a claim's (evidence.md §questions): `enabled`, `misbehaviour`,
 * `path`, `refusal`, `start`, `phases`, `facts` and `lifecycle-path`. Gives `{ questions, unchecked }`, `unchecked`
 * each confirmed journey that has no question on a lifecycle model while its stepping meets an open cell (evidence.md §lifecycle-journeys).
 */
export function modelQuestions(ctx, models, slots) {
  const out = [];
  const unchecked = [];
  const exempt = unpickedOnly(ctx);
  for (const state of models.values()) {
    if (!state.usable) continue;
    if (state.engine === 'lifecycle') {
      for (const journey of ctx.journeys.values()) {
        if (!journey.confirmed || journey.parts.length !== 1 || journey.parts[0] !== state.part) continue;
        const q = lifecycleQuestion(ctx, state, journey);
        if (q.unchecked) unchecked.push({ model: state.key, journey: journey.entry, why: q.unchecked });
        else out.push(q);
      }
      continue;
    }
    const model = state.model;
    const alloy = model.engine === 'alloy';
    const { bounds, digest, object } = boundsOf(model);
    const shared = { engine: model.engine, model: model.key, bounds, digest, boundsObject: object };
    const extra = alloy ? phasesReads(model) : [];
    // enabled: each Actions row, but an action only an unpicked alternative takes, and each Misbehaviours row of an item not struck.
    for (const row of model.actions) {
      if (exempt.has(actionEntry(row.action))) continue;
      const [part, action] = row.action.split('/');
      out.push(question({ ...shared, kind: 'enabled', part, action, modelRow: row, serves: actionEntry(row.action), expected: { outcome: 'reached' }, reads: [actionEntry(row.action), ...extra] }));
    }
    for (const row of model.misbehaviours) {
      if (ctx.strikes.has(`strike:${row.row}/${row.item}`)) continue;
      const [part, key] = row.row.split('/');
      out.push(question({ ...shared, kind: 'enabled', part, row: key, item: row.item, modelRow: row, serves: `${part}/boundary/${key}`, expected: { outcome: 'reached' }, reads: [`${part}/boundary/${key}`, ...extra] }));
    }
    // misbehaviour: each misbehaviour witness slot, current.
    for (const slot of slots.files.values()) {
      if (slot.model !== model.key || slot.kind !== 'misbehaviour' || !slot.current) continue;
      out.push(question({ ...shared, kind: 'misbehaviour', part: slot.part, row: slot.row, item: slot.item, slots: { misbehaviour: slot }, serves: `${slot.part}/boundary/${slot.row}`, expected: { outcome: 'reached' }, reads: [`${slot.part}/boundary/${slot.row}`, ...extra] }));
    }
    // path, refusal and start: each confirmed journey with a schedule slot on the model, current.
    for (const journey of ctx.journeys.values()) {
      if (!journey.confirmed || !covers(model, journey.parts)) continue;
      const schedule = slotsIn(slots, folderOf(model.key, journey.holder, 'journeys', journey.key), 'schedule').find((s) => s.current);
      if (!schedule) continue;
      const j = { ...shared, holder: journey.holder, thingKind: 'journeys', key: journey.key, journey, slots: { schedule }, serves: journey.entry };
      const reads = [...journeyReads(ctx, journey), ...extra];
      if (journey.polarity === 'must not') {
        const n = journey.refusedStep;
        out.push(question({ ...j, kind: 'path', polarity: 'must not', step: n - 1, expected: { outcome: 'reached', step: n - 1 }, reads }));
        out.push(question({ ...j, kind: 'refusal', step: n, expected: { outcome: 'not enabled', step: n }, reads }));
      } else out.push(question({ ...j, kind: 'path', polarity: 'should happen', expected: { outcome: 'reached' }, reads }));
      if (journey.start?.length) out.push(question({ ...j, kind: 'start', expected: { outcome: 'reached' }, reads: [...journeyReads(ctx, journey, false), ...extra] }));
    }
    if (model.phases.length) out.push(question({ ...shared, kind: 'phases', serves: null, expected: { outcome: 'no violation' }, reads: phasesReads(model) }));
    if (alloy) out.push(question({ ...shared, kind: 'facts', serves: null, expected: { outcome: 'reached' }, reads: extra }));
  }
  return { questions: out, unchecked };
}

/** The lifecycles a lifecycle form or overlay names (engines.md §slot-forms), by key. */
const formLifecycles = (form) => [...(form?.combination ?? []).map((r) => r.lifecycle), ...(form?.transition ? [form.transition.lifecycle] : [])];

/**
 * A claim's questions on a model (evidence.md §questions): `base`, `witness` and `fault`, each from current slots, on a model
 * the gate lets ask them (account.md §journey-rules's journey rules but `explored`); on a lifecycle model, only while every
 * lifecycle the question's slots name is confirmed.
 */
export function claimQuestions(ctx, models, slots, gate) {
  const out = [];
  for (const state of models.values()) {
    if (!state.usable || !gate(state.key)) continue;
    const model = state.model;
    const lifecycle = state.engine === 'lifecycle';
    for (const claim of ctx.claims) {
      if (!covers(model, claim.parts)) continue;
      const folder = folderOf(model.key, claim.holder, 'claims', claim.key);
      const encoding = slotsIn(slots, folder, 'encoding').find((s) => s.current && s.property);
      if (!encoding) continue;
      const { bounds, digest, object } = boundsOf(model, claim.claimKind);
      const extra = lifecycle ? partReads(ctx, state.part) : model.engine === 'alloy' ? phasesReads(model) : [];
      const shared = { engine: lifecycle ? 'lifecycle' : model.engine, model: model.key, holder: claim.holder, thingKind: 'claims', key: claim.key, claim, serves: claim.entry, bounds, digest, boundsObject: object };
      const confirmed = (forms) => !lifecycle || forms.flatMap(formLifecycles).every((key) => ctx.confirmed(`${state.part}/lifecycles/${key}`));
      if (confirmed([encoding.form.forbidden])) out.push(question({ ...shared, kind: 'base', slots: { encoding }, expected: { outcome: 'no violation' }, reads: [claim.entry, ...extra] }));
      for (const witness of slotsIn(slots, folder, 'witness').filter((s) => s.current)) {
        if (!confirmed([witness.form.target])) continue;
        out.push(question({ ...shared, kind: 'witness', slot: witness.key, slots: { encoding, witness }, expected: { outcome: 'reached' }, reads: [claim.entry, ...extra] }));
      }
      for (const fault of slotsIn(slots, folder, 'fault').filter((s) => s.current)) {
        if (!confirmed([encoding.form.forbidden, ...(fault.form.overlay ?? []).map((r) => ({ combination: [{ lifecycle: r.lifecycle }] }))])) continue;
        const reads = [claim.entry, ...extra, ...(!lifecycle && fault.form.action ? [actionEntry(fault.form.action)] : [])];
        out.push(question({ ...shared, kind: 'fault', slot: fault.key, slots: { encoding, fault }, expected: { outcome: 'caught' }, reads }));
      }
    }
  }
  return out;
}

/**
 * A claim's question rebuilt from its evidence's place (evidence.md §reductions, §rerun), whatever its slots' currency and the
 * model's: from `where` as tree.mjs's modelsPath gives it, its slots read from the files as they stand. Null when the
 * claim, its model or a slot it needs is gone.
 */
function claimQuestionAt(ctx, models, slots, where) {
  const state = models.get(where.model);
  if (!state?.exists || where.thing?.kind !== 'claims') return null;
  const entry = `${where.holder.key}/claims/${where.thing.key}`;
  const claim = ctx.claims.find((c) => c.entry === entry);
  if (!claim) return null;
  const folder = folderOf(where.model, where.holder, 'claims', where.thing.key);
  const encoding = slotsIn(slots, folder, 'encoding').find((s) => s.filled);
  if (!encoding) return null;
  const kind = where.question.kind;
  const model = state.model;
  const lifecycle = state.engine === 'lifecycle';
  const { bounds, digest, object } = boundsOf(model, claim.claimKind);
  const extra = lifecycle ? partReads(ctx, state.part) : model.engine === 'alloy' ? phasesReads(model) : [];
  const shared = { engine: lifecycle ? 'lifecycle' : model.engine, model: model.key, holder: claim.holder, thingKind: 'claims', key: claim.key, claim, serves: claim.entry, bounds, digest, boundsObject: object };
  if (kind === 'base') return question({ ...shared, kind, slots: { encoding }, expected: { outcome: 'no violation' }, reads: [claim.entry, ...extra] });
  const slot = slotsIn(slots, folder, kind).find((s) => s.key === where.question.key && s.filled);
  if (!slot) return null;
  if (kind === 'witness') return question({ ...shared, kind, slot: slot.key, slots: { encoding, witness: slot }, expected: { outcome: 'reached' }, reads: [claim.entry, ...extra] });
  if (kind === 'fault') return question({ ...shared, kind, slot: slot.key, slots: { encoding, fault: slot }, expected: { outcome: 'caught' }, reads: [claim.entry, ...extra, ...(!lifecycle && slot.form.action ? [actionEntry(slot.form.action)] : [])] });
  return null;
}

/**
 * Any question rebuilt from its evidence's place (evidence.md §reductions, §rerun), from the files as they stand whatever their
 * currency and the model's usability: a claim's as claimQuestionAt gives it; a journey's from its filled schedule, or
 * on a lifecycle model as its place names it; an action's, a world row's, the phases' or the facts' from the model.
 */
export function questionAt(ctx, models, slots, where) {
  if (where.thing?.kind === 'claims') return claimQuestionAt(ctx, models, slots, where);
  const state = models.get(where.model);
  if (!state?.exists) return null;
  const kind = where.question.kind;
  if (where.thing?.kind === 'journeys') {
    const journey = ctx.journeys.get(`${where.holder.key}/journeys/${where.thing.key}`);
    if (!journey) return null;
    if (kind === 'lifecycle-path') {
      const reads = [...journeyReads(ctx, journey, false), ...partReads(ctx, state.part)];
      const variant = where.question.variant;
      const step = where.question.step ?? null;
      const expected = variant === 'refused-at' ? { outcome: 'refused', step } : variant === 'to' ? { outcome: 'admitted', step } : { outcome: 'admitted' };
      return question({ kind, engine: 'lifecycle', model: state.key, holder: journey.holder, thingKind: 'journeys', key: journey.key, journey, serves: journey.entry, bounds: 'phase level', boundsObject: 'phase level', digest: null, variant, step, expected, reads });
    }
    const model = state.model;
    const schedule = slotsIn(slots, folderOf(model.key, journey.holder, 'journeys', journey.key), 'schedule').find((s) => s.filled);
    if (!schedule) return null;
    const { bounds, digest, object } = boundsOf(model);
    const extra = model.engine === 'alloy' ? phasesReads(model) : [];
    const j = { engine: model.engine, model: model.key, bounds, digest, boundsObject: object, holder: journey.holder, thingKind: 'journeys', key: journey.key, journey, slots: { schedule }, serves: journey.entry };
    if (kind === 'start') return question({ ...j, kind, expected: { outcome: 'reached' }, reads: [...journeyReads(ctx, journey, false), ...extra] });
    const reads = [...journeyReads(ctx, journey), ...extra];
    if (kind === 'refusal') return question({ ...j, kind, step: journey.refusedStep, expected: { outcome: 'not enabled', step: journey.refusedStep }, reads });
    if (journey.polarity === 'must not') return question({ ...j, kind: 'path', polarity: 'must not', step: journey.refusedStep - 1, expected: { outcome: 'reached', step: journey.refusedStep - 1 }, reads });
    return question({ ...j, kind: 'path', polarity: 'should happen', expected: { outcome: 'reached' }, reads });
  }
  if (state.engine === 'lifecycle') return null;
  const model = state.model;
  const { bounds, digest, object } = boundsOf(model);
  const extra = model.engine === 'alloy' ? phasesReads(model) : [];
  const shared = { engine: model.engine, model: model.key, bounds, digest, boundsObject: object };
  if (kind === 'enabled' && where.where === 'action') {
    const row = model.actions.find((r) => r.action === `${where.part}/${where.question.action}`);
    return row ? question({ ...shared, kind, part: where.part, action: where.question.action, modelRow: row, serves: actionEntry(row.action), expected: { outcome: 'reached' }, reads: [actionEntry(row.action), ...extra] }) : null;
  }
  if (kind === 'enabled') {
    const row = model.misbehaviours.find((r) => r.row === `${where.part}/${where.row}` && r.item === where.question.item);
    return row ? question({ ...shared, kind, part: where.part, row: where.row, item: row.item, modelRow: row, serves: `${where.part}/boundary/${where.row}`, expected: { outcome: 'reached' }, reads: [`${where.part}/boundary/${where.row}`, ...extra] }) : null;
  }
  if (kind === 'misbehaviour') {
    const slot = [...slots.files.values()].find((s) => s.kind === 'misbehaviour' && s.model === model.key && s.part === where.part && s.row === where.row && s.item === where.question.item && s.filled);
    return slot ? question({ ...shared, kind, part: where.part, row: where.row, item: slot.item, slots: { misbehaviour: slot }, serves: `${where.part}/boundary/${where.row}`, expected: { outcome: 'reached' }, reads: [`${where.part}/boundary/${where.row}`, ...extra] }) : null;
  }
  if (kind === 'phases') return question({ ...shared, kind, serves: null, expected: { outcome: 'no violation' }, reads: phasesReads(model) });
  if (kind === 'facts') return question({ ...shared, kind, serves: null, expected: { outcome: 'reached' }, reads: extra });
  return null;
}

/**
 * A reduction's question at the bounds its evidence names (evidence.md §reductions, §rerun), each bound read back from its line
 * into the model's row; null when the question cannot be rebuilt.
 */
export function reductionAt(ctx, models, slots, where, boundsObject0, { surprise, n }) {
  const reduced = questionAt(ctx, models, slots, where);
  if (!reduced) return null;
  const model = models.get(where.model).model;
  const rows = model.bounds.map((b) => {
    const value = boundsObject0?.[normalizeBound(b.bound)];
    if (value === undefined) return b;
    if (!b.constant) return { ...b, value };
    try { return { ...b, value, parsed: parseValue(value) }; } catch { return { ...b, value }; }
  });
  const name = `${surprise}.reduction-${n}`;
  const bounds = questionBounds({ ...model, bounds: rows }, reduced.claim?.claimKind ?? null);
  return question({ ...reduced, kind: 'reduction', reduces: where.question.kind, name, path: stemFiles.reduction(surprise, n), shape: 'reduction', expected: null, bounds, digest: boundsDigest(bounds), boundsObject: boundsObject(bounds), reduction: { surprise, n, bounds: rows } });
}

// --- Reductions (evidence.md §reductions) ------------------------------------------------------------------------------

/**
 * One step smaller (evidence.md §reductions): a set loses the last half of its elements, a range the last half of its values, rounded
 * down and at least one, down to the empty set and to one value; an integer falls by one, down to zero; null when none
 * is left. Integers are exact, as ../record/models.mjs reads them (BigInt).
 */
function smaller(value) {
  const drop = (size) => (size / 2n > 1n ? size / 2n : 1n);
  if (value?.kind === 'set') return value.items.length ? { kind: 'set', items: value.items.slice(0, value.items.length - Number(drop(BigInt(value.items.length)))) } : null;
  if (value?.kind === 'range') {
    const size = BigInt(value.to) - BigInt(value.from) + 1n;
    return size > 1n ? { kind: 'range', from: BigInt(value.from), to: BigInt(value.to) - drop(size) } : null;
  }
  if (value?.kind === 'integer') return BigInt(value.value) > 0n ? { kind: 'integer', value: BigInt(value.value) - 1n } : null;
  return null;
}

/**
 * The bounds one step smaller than `rows` (evidence.md §reductions), in the order they are tried: on TLC each constant reduced alone, in
 * the order of the model's Bounds, a string, a truth value, the constraint and a `choose` row never; on Alloy the
 * scope's default number less one, down to one.
 */
function reducedBounds(engine, rows) {
  if (engine === 'alloy') {
    const scope = rows.find((r) => r.bound === 'scope');
    if (!scope) return [];
    let read;
    try { read = parseScope(scope.value); } catch { return []; }
    if (read.number === null || read.number <= 1) return [];
    return [rows.map((r) => (r === scope ? { ...r, value: String(scope.value).trim().replace(/^\d+/, String(read.number - 1)) } : r))];
  }
  return rows.flatMap((at) => {
    if (!at.constant) return [];
    let parsed = at.parsed;
    try { parsed ??= parseValue(at.value); } catch { return []; }
    const step = smaller(parsed);
    return step ? [rows.map((r) => (r === at ? { ...r, value: valueText(step), parsed: step } : r))] : [];
  });
}

/** Whether a reduction's evidence is kept (evidence.md §reductions): it found the same property violated as its surprise. */
const keptBy = (surprise, reduction) => reduction?.found?.outcome === 'violation' && reduction.found.property === surprise.found.property;

/**
 * An open surprise's reductions (evidence.md §reductions): `{ reducible, ran, kept, next }`, `ran` its reduction files in
 * order, `kept` those that found its property violated, and `next` the question of its next reduction, or null when it
 * stops: no reduction of the bounds last kept is kept, none is left, or six have run. The next follows from the
 * surprise's bounds and the outcomes of its reductions so far, in order.
 */
export function reductionPlan(ctx, models, slots, surprise) {
  const where = surprise.where;
  const value = surprise.value;
  const state = models.get(where.model);
  const reducible = Boolean(state?.exists) && state.engine !== 'lifecycle' && ['base', 'fault'].includes(where.question.kind) && value.found.outcome === 'violation';
  const stem = ctx.project.stems.get(surprise.name);
  const ran = (stem?.reductions ?? []).map((path) => ctx.project.files.get(path)).filter((r) => r?.counts && r.value).map((r) => ({ path: r.path, n: r.where.number, value: r.value })).sort((a, b) => a.n - b.n);
  const kept = ran.filter((r) => keptBy(value, r.value));
  if (!reducible) return { reducible: false, ran, kept, next: null };
  const reduced = claimQuestionAt(ctx, models, slots, where);
  if (!reduced) return { reducible, ran, kept, next: null, why: 'its claim, its model or a slot its question needs is gone' };
  const model = state.model;
  let last = claimBounds(model, reduced.claim.claimKind);
  let tries = reducedBounds(model.engine, last);
  let at = 0;
  for (const reduction of ran) {
    if (keptBy(value, reduction.value)) {
      last = tries[at] ?? last;
      tries = reducedBounds(model.engine, last);
      at = 0;
    } else at += 1;
  }
  if (ran.length >= 6 || at >= tries.length) return { reducible, ran, kept, next: null };
  const rows = tries[at];
  const n = (ran.at(-1)?.n ?? 0) + 1;
  const name = `${surprise.name}.reduction-${n}`;
  const bounds = questionBounds({ ...model, bounds: rows }, reduced.claim.claimKind);
  return {
    reducible,
    ran,
    kept,
    next: question({ ...reduced, kind: 'reduction', reduces: where.question.kind, name, path: stemFiles.reduction(surprise.name, n), shape: 'reduction', expected: null, bounds, digest: boundsDigest(bounds), boundsObject: boundsObject(bounds), reduction: { surprise: surprise.name, n, bounds: rows } }),
  };
}

// --- Weaker forms (evidence.md §weaker) ----------------------------------------------------------------------------

/**
 * The weaker forms of an open surprise's accepted explanation (evidence.md §weaker), in its order from the strongest to
 * the weakest: each `{ key, path, evidence, question }`, `evidence` its evidence when it has run, `question` the
 * `weaker` question that runs it, the base question with the form in place of the encoding.
 */
export function weakerForms(ctx, models, slots, surprise) {
  const stem = ctx.project.stems.get(surprise.name);
  const explanation = stem?.explanation ? ctx.project.files.get(stem.explanation) : null;
  if (!explanation?.counts || !stem.explained) return [];
  const where = surprise.where;
  const state = models.get(where.model);
  if (!state?.exists || state.engine === 'lifecycle' || where.question.kind !== 'base') return [];
  const base = claimQuestionAt(ctx, models, slots, where);
  const out = [];
  for (const key of stem.explained.weaker) {
    const path = stem.weaker.find((p) => ctx.project.files.get(p)?.where.key === key && ctx.project.files.get(p)?.counts) ?? null;
    const evidencePathOf = stemFiles.weakerEvidence(surprise.name, key);
    const ran = ctx.project.files.get(evidencePathOf);
    const record = path ? ctx.project.files.get(path) : null;
    const name = `${surprise.name}.weaker-${key}`;
    out.push({
      key,
      path,
      evidence: ran?.counts ? ran.value : null,
      question: base && record ? question({ ...base, kind: 'weaker', name, path: evidencePathOf, shape: 'weaker-evidence', expected: null, slots: {}, weaker: { surprise: surprise.name, key, path, bytes: record.bytes, text: record.bytes.toString('utf8') } }) : null,
    });
  }
  return out;
}

/** The weakest weaker form that fails (evidence.md §weaker): the last in the order whose run found a violation, or null when none does. */
export function weakestFailing(forms) {
  const failing = forms.filter((f) => f.evidence?.found?.outcome === 'violation');
  return failing.length ? failing.at(-1).key : null;
}

/** Questions in byte order of names (evidence.md §forma-run). */
export const byName = (questions) => [...questions].sort((a, b) => compare(a.name, b.name));
