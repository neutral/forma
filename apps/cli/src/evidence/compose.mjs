// Composing a question (engines.md §composition): code writes the wrapper and everything around the slots'
// native text, which enters as written. TLC gets FormaExam.tla and FormaExam.cfg (engines.md §tlc), Alloy
// FormaExam.als and, for a fault, the copy of the model file it rewrites (engines.md §alloy), the lifecycle
// engine lifecycles.json and question.json (engines.md §lifecycle-engine); and a TLC trace the evidence keeps is replayed
// through FormaTrace (engines.md §replay). The same inputs compose the same bytes, so composing again tells
// currency (evidence.md §currency).

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sany } from '../sany.mjs';
import { jsonText, sortedBy } from '../record/json.mjs';
import { alloyBounds, alloyPredicates, existsOver, faultedFile, moduleOf, phaseSig, scheduleDefinitions, unionOver, valueText } from '../record/models.mjs';
import { journeyEntities, resolveRef } from '../record/pages.mjs';
import { dataForm, formCell } from './lifecycle-engine.mjs';

const call = (operator, args) => `${operator}${args.length ? `(${args.join(', ')})` : ''}`;
const applied = (operator, args) => (args.length ? `${operator}[${args.join(', ')}]` : operator);
const tlaModule = (name, extending, body) => `---- MODULE ${name} ----\nEXTENDS ${extending.join(', ')}\n${body.join('\n')}\n====\n`;

let empty = null;
/** A folder of its own holding nothing, so SANY reads only the files it is given (engines.md §engine-text). */
async function nothing() {
  empty ??= await mkdtemp(join(tmpdir(), 'forma-evidence-'));
  return empty;
}

/** The names a TLC slot's native text defines, as SANY reads it in a module extending the entry (engines.md §engine-text): never read by code itself. */
async function tlcDefines(model, files, native) {
  const source = `---- MODULE FormaSlot ----\nEXTENDS ${model.entry.replace(/\.tla$/, '')}\n${native}\n====\n`;
  const report = await sany(await nothing(), 'FormaSlot', { ...files, 'FormaSlot.tla': source });
  if (!report.ok) return { ok: false, why: report.messages.join(' ') };
  return { ok: true, names: report.root.definitions.map((op) => op.name).sort(), levels: Object.fromEntries(report.root.definitions.map((op) => [op.name, op.level])) };
}

// TLC refuses, before it computes any state, an invariant of constant level whose value is FALSE (its message 2230,
// "The invariant of ... is equal to FALSE"): one of constant level is asked through a definition of the wrapper equal
// to it in every state, `vars = vars` making it a state predicate, so the type invariant is still checked first and
// the first state answers it (engines.md §tlc).
const stateLevel = (name, body) => `${name} == vars = vars /\\ ${body}`;

// --- The model at a question's bounds (evidence.md §bounds, §reductions) -------------------------------------------------

/** The model with `rows`' values in place of its Bounds' (a reduction's, evidence.md §reductions), each `{ bound, value, parsed? }`. */
function atBounds(model, rows = null) {
  if (!rows) return model;
  return { ...model, bounds: model.bounds.map((b) => rows.find((r) => r.bound === b.bound) ?? b) };
}

// --- TLC (engines.md §tlc) -------------------------------------------------------------------------------------

/**
 * The rows of the next-state relation (engines.md §tlc): each row of the Actions table, then each Misbehaviours row of an item
 * not struck, numbered from 1, so TLC names the row of every step by its `FormaRow<n>`.
 */
function tlcRows(model, strikes) {
  const rows = [
    ...model.actions.map((r) => ({ action: r.action, operator: r.operator, parameters: r.parameters })),
    ...model.misbehaviours.filter((r) => !strikes.has(`strike:${r.row}/${r.item}`)).map((r) => ({ row: r.row, item: r.item, operator: r.operator, parameters: r.parameters })),
  ];
  return rows.map((row, at) => ({ n: at + 1, ...row }));
}

/** Each row's `FormaRow<n>` and `FormaNext` (engines.md §tlc), `frame` its first conjunct, the faulted row applying `Fault`. */
function nextState(rows, { frame = 'TRUE', faulted = null } = {}) {
  const lines = rows.map((row) => {
    const head = existsOver(row.parameters);
    const operator = faulted && row.action === faulted ? 'Fault' : row.operator;
    return `FormaRow${row.n} == ${head}${frame} /\\ ${call(operator, row.parameters.map((p) => p.name))}`;
  });
  return [...lines, `FormaNext == ${rows.length ? rows.map((row) => `FormaRow${row.n}`).join(' \\/ ') : 'FALSE'}`];
}

// The pinned TLC's configuration reads neither a range nor a negative integer, and reads a string's backslash as
// itself: a constant whose value holds one, at any depth, is given by a definition the configuration substitutes
// (engines.md §tlc). A model value exists only in the configuration, so a value holding one stays there as written.
const anywhere = (value, test) => test(value) || (value?.kind === 'set' && value.items.some((item) => anywhere(item, test)));
const unreadable = (v) => v?.kind === 'range' || (v?.kind === 'integer' && v.value < 0) || (v?.kind === 'string' && v.text.includes('\\'));
const byDefinition = (value) => anywhere(value, unreadable) && !anywhere(value, (v) => v?.kind === 'model value');
const integerText = (n) => (BigInt(n) < 0n ? `FormaIntegers!-.(${-BigInt(n)})` : String(n));
function definitionText(value) {
  if (value.kind === 'set') return `{${value.items.map(definitionText).join(', ')}}`;
  if (value.kind === 'range') return `FormaIntegers!..(${integerText(value.from)}, ${integerText(value.to)})`;
  if (value.kind === 'integer') return integerText(value.value);
  return valueText(value);
}

/** The wrapper's definitions of the constants the configuration cannot hold (engines.md §tlc). */
function constantDefinitions(model) {
  const lines = model.bounds.filter((b) => b.constant && b.parsed && byDefinition(b.parsed)).map((b) => `FormaConstant${b.constant} == ${definitionText(b.parsed)}`);
  return lines.some((line) => line.includes('FormaIntegers!')) ? ['FormaIntegers == INSTANCE Integers', ...lines] : lines;
}

/** A TLC configuration (engines.md §tlc): the constants, the question, `FormaConstraint` unless left out, no deadlock checking. */
function configuration(model, { init = 'Init', next = 'FormaNext', spec = null, invariants = [], properties = [], constraint = false, extra = [] }) {
  const values = [
    ...model.bounds.filter((b) => b.constant).map((b) => (b.parsed && byDefinition(b.parsed) ? `  ${b.constant} <- FormaConstant${b.constant}` : `  ${b.constant} = ${b.parsed ? valueText(b.parsed) : b.value}`)),
    ...extra,
  ];
  const lines = values.length ? ['CONSTANTS', ...values] : [];
  if (spec) lines.push(`SPECIFICATION ${spec}`);
  else lines.push(`INIT ${init}`, `NEXT ${next}`);
  for (const name of invariants) lines.push(`INVARIANT ${name}`);
  for (const name of properties) lines.push(`PROPERTY ${name}`);
  if (constraint) lines.push('CONSTRAINT FormaConstraint');
  lines.push('CHECK_DEADLOCK FALSE');
  return `${lines.join('\n')}\n`;
}

/** The constraint row, when the question is bounded by it: every question on the model but a liveness claim's (engines.md §bounds). */
const constraintOf = (model, liveness) => (liveness ? null : model.bounds.find((b) => b.bound === 'constraint') ?? null);

// --- Journeys on TLC and Alloy (engines.md §composition, §tlc, §alloy) ----------------------------------------------------

/**
 * What a schedule's journey asks of the model (engines.md §composition): each step's action row and bindings; for a step with a case, each
 * lifecycle of the action's part having the action as a column, the entity the step acts on there (lifecycle-tool.md §stepping)
 * and the moves its cell gives the case, from the lifecycles as read; and every entity of the schedule with the
 * lifecycles it is named in.
 */
function journeyPlan(ctx, model, journey, schedule) {
  const { restatement } = ctx;
  const from = journey.holder;
  const { named, steps: acting } = journeyEntities(restatement, journey, from);
  const steps = journey.steps.map((step, at) => {
    const ref = resolveRef(restatement, step.action, from, 'actions');
    const action = ref.part && ref.key ? `${ref.part}/${ref.key}` : null;
    const row = action ? model.actions.find((r) => r.action === action) ?? null : null;
    const bindings = schedule.steps[at]?.bindings ?? {};
    const moves = [];
    let placed = false;
    if (step.case !== null && ref.entry) {
      for (const move of acting[at]?.moves ?? []) {
        const lifecycle = ctx.lifecycles.get(move.lifecycle) ?? restatement.things.get(move.lifecycle);
        if (!lifecycle || !lifecycle.actions.includes(ref.key)) continue;
        placed = true;
        const read = lifecycle.asRead ?? lifecycle.cells;
        const outcomes = lifecycle.phases.flatMap((phase) => {
          const cell = formCell(read?.[phase]?.[ref.key]);
          const outcome = cell.kind === 'cases' ? cell.cases.find((c) => c.case === step.case)?.outcome : null;
          return outcome?.kind === 'phase' ? [{ from: phase, to: outcome.phase }] : [];
        });
        moves.push({ lifecycle: move.lifecycle, phasesRow: `${ref.part}/${lifecycle.key}`, entity: move.entity, outcomes });
      }
    }
    return { step: step.step, action, actionKey: ref.key, part: ref.part, row, bindings, args: row ? row.parameters.map((p) => bindings[p.name]) : [], case: step.case, moves, alone: step.case !== null && !placed };
  });
  // Every entity of the schedule, by the lifecycles the journey names it in (lifecycle-tool.md §stepping).
  const lifecyclesOf = new Map();
  for (const [lifecycle, names] of named) for (const name of names) lifecyclesOf.set(name, [...(lifecyclesOf.get(name) ?? []), lifecycle]);
  // The entity each step acts on in each lifecycle it moves, named by its lifecycle's key where the journey names none.
  for (const move of acting.flatMap((s) => s.moves)) if (!(lifecyclesOf.get(move.entity) ?? []).includes(move.lifecycle)) lifecyclesOf.set(move.entity, [...(lifecyclesOf.get(move.entity) ?? []), move.lifecycle]);
  const start = (journey.start ?? []).map((row) => {
    const ref = resolveRef(restatement, row.lifecycle, from, 'lifecycles');
    return { lifecycle: ref.entry?.entry ?? null, phasesRow: ref.part && ref.key ? `${ref.part}/${ref.key}` : null, entity: row.entity, phase: row.phase };
  });
  return { steps, lifecyclesOf, start };
}

/** The initial phase of a lifecycle, by entry name, as read. */
const initialOf = (ctx, lifecycle) => (ctx.lifecycles.get(lifecycle) ?? ctx.restatement.things.get(lifecycle))?.initial.phase ?? null;

/**
 * The phases a journey starts from (forms.md §journeys, engines.md §composition): each start row's, and each other entity of the
 * schedule in its lifecycle's initial phase, as `{ phasesRow, entity, phase }`.
 */
function startPhases(ctx, plan, schedule, withStart) {
  const listed = new Set(plan.start.map((row) => `${row.lifecycle}\0${row.entity}`));
  const phases = withStart ? plan.start.filter((row) => row.phasesRow).map((row) => ({ phasesRow: row.phasesRow, entity: row.entity, phase: row.phase })) : [];
  for (const entity of Object.keys(schedule.entities)) {
    for (const lifecycle of plan.lifecyclesOf.get(entity) ?? []) {
      if (listed.has(`${lifecycle}\0${entity}`)) continue;
      const [part, , key] = lifecycle.split('/');
      phases.push({ phasesRow: `${part}/${key}`, entity, phase: initialOf(ctx, lifecycle) });
    }
  }
  return phases;
}

// --- Composition by engine -------------------------------------------------------------------------------------

/**
 * Composes a question (engines.md §composition) from the model as it stands, its current slots and the restatement: gives
 * `{ generated, files, engineFiles, run }`, `generated` each file code writes by name, `files` each project file the
 * composition read or the engine is given, `{ path, bytes }`, `engineFiles` what the engine is given by name, and
 * `run` what reading its answer needs; or `{ cannot }`, why it cannot be composed.
 */
export async function compose(ctx, models, question) {
  const state = models.get(question.model);
  if (!state?.exists) return { cannot: `the model ${question.model} does not exist` };
  try {
    if (question.engine === 'lifecycle') return await composeLifecycle(ctx, state, question);
    if (question.engine === 'tlc') return await composeTlc(ctx, state, question);
    return await composeAlloy(ctx, state, question);
  } catch (error) {
    // A parser composition needs (SANY for an encoding's names, Alloy's language server for a fault's range) that cannot run.
    return { cannot: `the engine's parser could not run: ${error.message}`, tool: true };
  }
}

/** A slot's bytes and native text, from the project as read. */
const slotFile = (ctx, slot) => ({ path: slot.path, bytes: ctx.project.files.get(slot.path).bytes });

/** The model's own files as a composition reads them (engines.md §composition): model.md and every engine file. */
function modelFiles(ctx, state) {
  const files = [{ path: `${state.folder}/model.md`, bytes: ctx.project.files.get(`${state.folder}/model.md`).bytes }];
  for (const name of Object.keys(state.files).sort()) files.push({ path: `${state.folder}/${name}`, bytes: state.files[name] });
  return files;
}

async function composeTlc(ctx, state, question) {
  const model = atBounds(state.model, question.reduction?.bounds ?? null);
  const kind = question.reduces ?? question.kind;
  const type = model.typeInvariant;
  const liveness = question.claim?.claimKind === 'liveness';
  const rows = tlcRows(model, ctx.strikes);
  const entry = model.entry.replace(/\.tla$/, '');
  const constraint = constraintOf(model, liveness);
  const head = [...constantDefinitions(model), ...(constraint ? [`FormaConstraint == ${constraint.value}`] : [])];
  const files = modelFiles(ctx, state);
  const read = (slot) => {
    files.push(slotFile(ctx, slot));
    return String(slot.form.native);
  };
  const done = (body, cfg, run) => ({
    generated: { 'FormaExam.cfg': cfg, 'FormaExam.tla': tlaModule('FormaExam', [entry], [...head, ...body]) },
    files,
    engineFiles: { ...state.files },
    run: { watch: run.watch, typeInvariant: type, rows, steps: run.steps ?? [], entities: run.entities ?? [], phasesRows: model.phases, liveness, property: run.property ?? null, cases: run.cases ?? null, end: run.end ?? null },
    atModel: model,
  });

  // The encoding asked (engines.md §tlc): its Invariant as an invariant, or its Property as a temporal property, a liveness claim's under its Fairness.
  const asked = async (native, faulted = null) => {
    const defines = await tlcDefines(model, state.files, native);
    if (!defines.ok) return { cannot: `SANY refuses the encoding with the model's files: ${defines.why}` };
    const next = nextState(rows, { faulted });
    if (liveness) {
      if (!defines.names.includes('Property')) return { cannot: "a liveness claim's encoding defines Property" };
      return { body: [native, ...next, 'FormaSpec == Init /\\ [][FormaNext]_vars /\\ Fairness'], cfg: { spec: 'FormaSpec', invariants: [type], properties: ['Property'] }, watch: 'Property' };
    }
    if (defines.names.includes('Invariant')) {
      if (defines.levels.Invariant === 0) return { body: [native, ...next, stateLevel('FormaInvariant', 'Invariant')], cfg: { invariants: [type, 'FormaInvariant'] }, watch: 'FormaInvariant', property: 'Invariant' };
      return { body: [native, ...next], cfg: { invariants: [type, 'Invariant'] }, watch: 'Invariant' };
    }
    if (defines.names.includes('Property')) return { body: [native, ...next], cfg: { invariants: [type], properties: ['Property'] }, watch: 'Property' };
    return { cannot: 'the encoding defines neither Invariant nor Property' };
  };

  if (kind === 'base' || kind === 'weaker') {
    const native = kind === 'weaker' ? question.weaker.text : read(question.slots.encoding);
    if (kind === 'weaker') files.push({ path: question.weaker.path, bytes: question.weaker.bytes });
    const q = await asked(native);
    if (q.cannot) return q;
    return done(q.body, configuration(model, { ...q.cfg, constraint: Boolean(constraint) }), { watch: q.watch, property: q.property ?? q.watch });
  }
  if (kind === 'fault') {
    const native = read(question.slots.encoding);
    const fault = read(question.slots.fault);
    const action = question.slots.fault.form.action;
    if (!rows.some((r) => r.action === action)) return { cannot: `the fault's action ${action} has no row in the model's Actions table` };
    const q = await asked(`${native}\n${fault}`, action);
    if (q.cannot) return q;
    return done(q.body, configuration(model, { ...q.cfg, constraint: Boolean(constraint) }), { watch: q.watch, property: q.property ?? q.watch });
  }
  if (kind === 'witness' || kind === 'misbehaviour') {
    const native = read(kind === 'witness' ? question.slots.witness : question.slots.misbehaviour);
    const defines = await tlcDefines(model, state.files, native);
    const unreached = defines.ok && defines.levels.Target === 0 ? stateLevel('FormaUnreached', '~Target') : 'FormaUnreached == ~Target';
    return done([native, ...nextState(rows), unreached], configuration(model, { invariants: [type, 'FormaUnreached'], constraint: Boolean(constraint) }), { watch: 'FormaUnreached' });
  }
  if (kind === 'enabled') {
    const row = question.modelRow;
    const names = row.parameters.map((p) => p.name);
    const head2 = existsOver(row.parameters);
    return done([...nextState(rows), `FormaNotEnabled == ~(${head2}ENABLED ${call(row.operator, names)})`], configuration(model, { invariants: [type, 'FormaNotEnabled'], constraint: Boolean(constraint) }), { watch: 'FormaNotEnabled' });
  }
  if (kind === 'phases') {
    const checks = [];
    for (const row of model.phases) {
      const lifecycle = resolveRef(ctx.restatement, row.lifecycle, null, 'lifecycles').entry;
      checks.push(`(\\A ${row.over.name} \\in ${row.over.domain} : (${row.expression}) \\in {${(lifecycle?.phases ?? []).map((p) => `"${p}"`).join(', ')}})`);
    }
    // An expression may be constant, as a model of one phase writes it: the invariant is a state predicate all the same.
    return done([...nextState(rows), stateLevel('FormaPhases', `(${checks.join(' /\\ ') || 'TRUE'})`)], configuration(model, { invariants: [type, 'FormaPhases'], constraint: Boolean(constraint) }), { watch: 'FormaPhases' });
  }
  // path, refusal and start (engines.md §tlc).
  const schedule = question.slots.schedule.form;
  read(question.slots.schedule);
  const journey = question.journey;
  const plan = journeyPlan(ctx, model, journey, schedule);
  if (plan.steps.some((s) => !s.row)) return { cannot: "a step's action has no row in the model's Actions table" };
  const withStart = Boolean(journey.start?.length);
  const phaseRow = (name) => model.phases.find((p) => p.lifecycle === name);
  const valueOf = (entity) => schedule.entities[entity];
  const inPhase = ({ phasesRow, entity, phase }) => {
    const row = phaseRow(phasesRow);
    const value = valueOf(entity);
    if (!row || value === undefined || phase === null) return null;
    return `(\\A ${row.over.name} \\in {${value}} : (${row.expression}) = "${phase}")`;
  };
  const phases = startPhases(ctx, plan, schedule, withStart).map(inPhase);
  if (phases.includes(null)) return { cannot: "a lifecycle of the journey has no row in the model's Phases table, or the schedule gives no value for one of its entities" };
  const caseOf = (step) => {
    if (step.case === null || step.alone) return null;
    const conditions = step.moves.map((move) => {
      const row = phaseRow(move.phasesRow);
      const value = valueOf(move.entity);
      if (!row || value === undefined) return undefined;
      const phase = `(${row.expression})`;
      const choices = move.outcomes.map((o) => `(${phase} = "${o.from}" /\\ ${phase}' = "${o.to}")`);
      return `(\\A ${row.over.name} \\in {${value}} : (${choices.length ? choices.join(' \\/ ') : 'FALSE'}))`;
    });
    return conditions.includes(undefined) ? undefined : conditions.join(' /\\ ');
  };
  const cases = plan.steps.map(caseOf);
  if (cases.includes(undefined)) return { cannot: "a step's case moves an entity whose lifecycle has no row in the model's Phases table, or whose value the schedule does not give" };
  const steps = plan.steps.map((s, at) => ({ n: s.step, action: s.action, operator: s.row.operator, parameters: s.row.parameters.map((p) => p.name), args: s.args, call: call(s.row.operator, s.args), case: cases[at], alone: s.alone }));
  const entities = Object.entries(schedule.entities);
  const started = withStart ? [`FormaStart == ${schedule.start}`, `FormaStartPhases == ${phases.join(' /\\ ') || 'TRUE'}`] : [];
  const initial = withStart ? [] : [`FormaInitialPhases == ${phases.join(' /\\ ') || 'TRUE'}`];
  if (question.kind === 'start') {
    return done([...started, ...nextState(rows), stateLevel('FormaNoStart', '~(FormaStart /\\ FormaStartPhases)')], configuration(model, { invariants: [type, 'FormaNoStart'], constraint: Boolean(constraint) }), { watch: 'FormaNoStart', steps, entities });
  }
  // The scheduled steps asked: through the last for a should-happen path, those before the refused one for a must-not.
  const refused = journey.polarity === 'must not' ? journey.refusedStep : null;
  const last = refused === null ? steps.length : refused - 1;
  const body = ['VARIABLE formaStep', ...started, ...initial];
  if (withStart) body.push('FormaInit == Init /\\ formaStep = 0', 'FormaFree == formaStep = 0 /\\ UNCHANGED formaStep', ...nextState(rows, { frame: 'FormaFree' }), 'FormaReady == formaStep = 0 /\\ FormaStart /\\ FormaStartPhases');
  else body.push('FormaInit == Init /\\ formaStep = 1 /\\ FormaInitialPhases');
  // A step k is taken at step variable k, the first from where the start holds when the journey has one.
  const at = (n) => (n === 1 && withStart ? 'FormaReady' : `formaStep = ${n}`);
  for (const step of steps.slice(0, last)) {
    if (step.case) body.push(`FormaCase${step.n} == ${step.case}`);
    body.push(`FormaStep${step.n} == ${at(step.n)} /\\ ${step.call}${step.case ? ` /\\ FormaCase${step.n}` : ''} /\\ formaStep' = ${step.n + 1}`);
  }
  const disjuncts = [...(withStart ? ['FormaNext'] : []), ...steps.slice(0, last).map((s) => `FormaStep${s.n}`)];
  // With no step to take and no start, a relation that never holds: the path is answered in the first state (engines.md §tlc).
  body.push(`FormaPath == ${disjuncts.length ? disjuncts.join(' \\/ ') : 'FALSE /\\ UNCHANGED <<formaStep, vars>>'}`);
  const asked2 = steps.slice(0, question.kind === 'refusal' ? refused : last).filter((s) => s.alone).map((s) => s.n);
  if (question.kind === 'path') {
    // TLC refuses an invariant that is a constant: with no step to take and no start, the first state, where the step variable is 1, has taken them all.
    if (refused !== null) {
      body.push(`FormaNotThere == ${last === 0 && withStart ? '~FormaReady' : `formaStep # ${last + 1}`}`);
      return done(body, configuration(model, { init: 'FormaInit', next: 'FormaPath', invariants: [type, 'FormaNotThere'], constraint: Boolean(constraint) }), { watch: 'FormaNotThere', steps, entities, cases: asked2 });
    }
    // A should-happen journey's path asks the schedule's End, as the slot writes it, of the state after the last step
    // (engines.md §tlc). Without a start, the depth the search reached tells whether a behaviour took every step (evidence.md §outcomes), which
    // `end` carries for reading the answer.
    const end = schedule.end?.native;
    if (end === undefined) return { cannot: 'the schedule of a journey that should happen defines no End' };
    const there = last === 0 && withStart ? 'FormaReady' : `formaStep = ${last + 1}`;
    body.push(end, `FormaNotThere == ~(${there} /\\ End)`);
    return done(body, configuration(model, { init: 'FormaInit', next: 'FormaPath', invariants: [type, 'FormaNotThere'], constraint: Boolean(constraint) }), { watch: 'FormaNotThere', steps, entities, cases: asked2, end: { step: steps.length ? steps.at(-1).n : 0, depth: withStart ? null : last + 1 } });
  }
  const step = steps[refused - 1];
  if (step.case) body.push(`FormaCase${step.n} == ${step.case}`);
  body.push(`FormaRefused == ${at(step.n)} => ~ENABLED (${step.call}${step.case ? ` /\\ FormaCase${step.n}` : ''})`);
  return done(body, configuration(model, { init: 'FormaInit', next: 'FormaPath', invariants: [type, 'FormaRefused'], constraint: Boolean(constraint) }), { watch: 'FormaRefused', steps, entities, cases: asked2 });
}

// --- Alloy (engines.md §alloy) -----------------------------------------------------------------------------------

/** That `expression` gives one atom, and of the phase's signature (engines.md §alloy). */
const inAlloyPhase = (expression, phase) => `(one (${expression}) and (${expression}) in ${phaseSig(phase)})`;

/**
 * Code's observers (engines.md §alloy): one signature, `FormaSteps`, a subset of the integers holding one, with a variable field
 * for each row, equal in every state to the bindings for which its predicate holds from that state to the next; for
 * each Phases row its entities and, for each phase of its lifecycle, the entities in it; and, for a schedule, one for
 * each entity it gives a value, equal in the first state to that value. A struck item's row is observed too, and a fact
 * keeps out every behaviour that takes it.
 */
function alloyObservers(phaseRows, rows, values = []) {
  const fields = [];
  const equal = [];
  for (const row of rows) {
    const names = row.parameters.map((p) => p.name);
    fields.push(`var formaRow${row.n}: set ${names.length ? names.map(() => 'univ').join(' -> ') : 'FormaSteps'}`);
    equal.push(names.length
      ? `FormaSteps.formaRow${row.n} = { ${row.parameters.map((p) => `${p.name}: ${p.domain}`).join(', ')} | ${applied(row.operator, names)} }`
      : `FormaSteps.formaRow${row.n} = (${row.operator} => FormaSteps else none)`);
  }
  phaseRows.forEach((row, at) => {
    fields.push(`var formaOver${at + 1}: set univ`);
    equal.push(`FormaSteps.formaOver${at + 1} = (${row.over.domain})`);
    row.keys.forEach((key, k) => {
      fields.push(`var formaPhase${at + 1}x${k + 1}: set univ`);
      equal.push(`FormaSteps.formaPhase${at + 1}x${k + 1} = { ${row.over.name}: ${row.over.domain} | some ((${row.expression}) & ${phaseSig(key)}) }`);
    });
  });
  values.forEach((_, at) => fields.push(`formaEntity${at + 1}: set univ`));
  const lines = [`one sig FormaSteps in Int {${fields.length ? `\n  ${fields.join(',\n  ')}\n` : ''}}`];
  if (equal.length) lines.push(`fact formaObserve {\n  always {\n    ${equal.join('\n    ')}\n  }\n}`);
  const struck = rows.filter((row) => row.struck);
  if (struck.length) {
    const actions = rows.filter((row) => row.action).map((row) => `some FormaSteps.formaRow${row.n}`);
    lines.push(`fact formaStruck {\n  always {\n    ${struck.map((row) => `some FormaSteps.formaRow${row.n} implies (${actions.length ? actions.join(' or ') : 'some none'})`).join('\n    ')}\n  }\n}`);
  }
  if (values.length) lines.push(`fact formaEntities {\n  ${values.map((value, at) => `FormaSteps.formaEntity${at + 1} = (${value})`).join('\n  ')}\n}`);
  return lines;
}

/** The rows Alloy observes (engines.md §alloy): every Actions row, then every Misbehaviours row, a struck item's marked. */
function alloyRows(model, strikes) {
  const rows = [
    ...model.actions.map((r) => ({ action: r.action, operator: r.operator, parameters: r.parameters })),
    ...model.misbehaviours.map((r) => ({ row: r.row, item: r.item, operator: r.operator, parameters: r.parameters, struck: strikes.has(`strike:${r.row}/${r.item}`) })),
  ];
  return rows.map((row, at) => ({ n: at + 1, ...row }));
}

async function composeAlloy(ctx, state, question) {
  const model = atBounds(state.model, question.reduction?.bounds ?? null);
  const kind = question.reduces ?? question.kind;
  const rows = alloyRows(model, ctx.strikes);
  const phaseRows = model.phases.map((row) => {
    const lifecycle = resolveRef(ctx.restatement, row.lifecycle, null, 'lifecycles').entry;
    return { ...row, keys: lifecycle?.phases ?? [] };
  });
  const files = modelFiles(ctx, state);
  const read = (slot) => {
    files.push(slotFile(ctx, slot));
    return String(slot.form.native);
  };
  const engineFiles = { ...state.files };
  const generated = {};
  const done = (body, command, { values = [], asks, entities = [], cases = null } = {}) => {
    generated['FormaExam.als'] = `${['module FormaExam', `open ${moduleOf(model.entry)}`, ...body, ...alloyObservers(phaseRows, rows, values), `FormaQuestion: ${command} ${alloyBounds(model)}`].join('\n')}\n`;
    return { generated: sortedGenerated(generated), files, engineFiles: { ...engineFiles, ...generated }, run: { command: 'FormaQuestion', asks, rows, phaseRows, entities, cases, property: asks === 'check' ? (kind === 'phases' ? 'phases' : 'Claim') : null } };
  };
  if (kind === 'base' || kind === 'weaker') {
    const native = kind === 'weaker' ? question.weaker.text : read(question.slots.encoding);
    if (kind === 'weaker') files.push({ path: question.weaker.path, bytes: question.weaker.bytes });
    return done([native], 'check Claim', { asks: 'check' });
  }
  if (kind === 'fault') {
    const native = read(question.slots.encoding);
    const fault = read(question.slots.fault);
    const row = model.actions.find((r) => r.action === question.slots.fault.form.action);
    if (!row) return { cannot: `the fault's action ${question.slots.fault.form.action} has no row in the model's Actions table` };
    const texts = Object.fromEntries(Object.entries(state.files).map(([name, bytes]) => [name, bytes.toString('utf8')]));
    const at = (await alloyPredicates(texts))[row.operator];
    if (!at) return { cannot: `Alloy's language server gives no one predicate ${row.operator} in the model's files, so the fault has no range to replace` };
    generated[at.file] = faultedFile(texts[at.file], at.range, fault, row);
    return done([native], 'check Claim', { asks: 'check' });
  }
  if (kind === 'witness' || kind === 'misbehaviour') return done([read(kind === 'witness' ? question.slots.witness : question.slots.misbehaviour)], 'run { eventually Target }', { asks: 'run' });
  if (kind === 'enabled') {
    const row = question.modelRow;
    const names = row.parameters.map((p) => p.name);
    const holds = names.length ? `some ${row.parameters.map((p) => `${p.name}: ${p.domain}`).join(', ')} | ${applied(row.operator, names)}` : row.operator;
    return done([], `run { eventually (${holds}) }`, { asks: 'run' });
  }
  if (kind === 'phases') {
    const exactlyOne = (expression, keys) => {
      const within = keys.map((key) => `(${expression}) in ${phaseSig(key)}`);
      const both = within.flatMap((one, i) => within.slice(i + 1).map((other) => `not (${one} and ${other})`));
      return [`one (${expression})`, `(${expression}) in (${keys.map(phaseSig).join(' + ') || 'none'})`, ...both].join(' and ');
    };
    const checks = phaseRows.map((row) => `always (all ${row.over.name}: ${row.over.domain} | ${exactlyOne(row.expression, row.keys)})`);
    return done([], `check { ${checks.join(' and ') || 'some none'} }`, { asks: 'check' });
  }
  if (kind === 'facts') return done([], 'run {}', { asks: 'run' });
  // path, refusal and start (engines.md §alloy).
  const schedule = question.slots.schedule.form;
  read(question.slots.schedule);
  const journey = question.journey;
  const plan = journeyPlan(ctx, model, journey, schedule);
  if (plan.steps.some((s) => !s.row)) return { cannot: "a step's action has no row in the model's Actions table" };
  if (plan.steps.some((s) => s.row.parameters.some((p) => s.bindings[p.name] === undefined))) return { cannot: 'the schedule does not bind every parameter of a step' };
  const definitions = scheduleDefinitions(schedule, plan.steps.map((s) => s.row));
  const entityNames = Object.keys(schedule.entities);
  const valueOf = (entity) => (entityNames.includes(entity) ? `FormaSteps.formaEntity${entityNames.indexOf(entity) + 1}` : undefined);
  const oneEach = entityNames.length ? [`pred FormaEntities { ${entityNames.map((entity) => `one ${valueOf(entity)}`).join(' and ')} }`] : [];
  const askedOf = (q) => (oneEach.length ? `FormaEntities and ${q}` : q);
  const phaseRow = (name) => model.phases.find((p) => p.lifecycle === name);
  const caseOf = (step) => {
    if (step.case === null || step.alone) return null;
    const conditions = step.moves.map((move) => {
      const row = phaseRow(move.phasesRow);
      const value = valueOf(move.entity);
      if (!row || value === undefined) return undefined;
      const choices = move.outcomes.map((o) => `(${inAlloyPhase(row.expression, o.from)} and after ${inAlloyPhase(row.expression, o.to)})`);
      return `(all ${row.over.name}: ${value} | ${choices.length ? choices.join(' or ') : 'some none'})`;
    });
    return conditions.includes(undefined) ? undefined : conditions.join(' and ');
  };
  const cases = plan.steps.map(caseOf);
  if (cases.includes(undefined)) return { cannot: "a step's case moves an entity whose lifecycle has no row in the model's Phases table, or whose value the schedule does not give" };
  const withStart = Boolean(journey.start?.length);
  const phases = withStart ? startPhases(ctx, plan, schedule, true).map(({ phasesRow, entity, phase }) => {
    const row = phaseRow(phasesRow);
    const value = valueOf(entity);
    return row && value !== undefined && phase !== null ? `(all ${row.over.name}: ${value} | ${inAlloyPhase(row.expression, phase)})` : null;
  }) : [];
  if (phases.includes(null)) return { cannot: "a lifecycle of the journey's start has no row in the model's Phases table, or the schedule gives no value for one of its entities" };
  const steps = plan.steps.map((s, at) => ({ n: s.step, action: s.action, call: applied(s.row.operator, s.row.parameters.map((_, k) => `FormaArg${s.step}x${k + 1}`)), case: cases[at], alone: s.alone, parameters: s.row.parameters.map((p) => p.name), args: s.args }));
  const values = entityNames.map((_, at) => `FormaEntity${at + 1}`);
  const definitionsOf = (keep) => definitions.filter(keep).map((line) => line.text);
  const start = [
    ...definitionsOf((line) => line.name.startsWith('FormaEntity')), ...oneEach, ...definitionsOf((line) => line.name === 'FormaStart'),
    ...(withStart ? [`pred FormaStartPhases { ${phases.join(' and ') || 'some univ'} }`] : []),
  ];
  const entities = Object.entries(schedule.entities);
  if (question.kind === 'start') return done(start, `run { ${askedOf('eventually (FormaStart and FormaStartPhases)')} }`, { values, asks: 'run', entities });
  // A should-happen journey's path ends its sequence with `; End`, the slot's `pred End` as it writes it, so the run
  // conjoins End on the state after the last step (engines.md §alloy).
  const journeyTo = (upTo, end = null) => {
    const body = [...start];
    for (const step of steps.slice(0, upTo)) {
      body.push(...definitionsOf((line) => line.step === step.n && line.kind === 'fun'));
      if (step.case) body.push(`pred FormaCase${step.n} { ${step.case} }`);
      body.push(`pred FormaStep${step.n} { ${step.call}${step.case ? ` and FormaCase${step.n}` : ''} }`);
    }
    if (end !== null) body.push(end);
    const sequence = [...steps.slice(0, upTo).map((s) => `FormaStep${s.n}`), ...(end !== null ? ['End'] : [])].join(' ; ');
    const journeyed = withStart ? `eventually (FormaStart and FormaStartPhases${sequence ? ` and (${sequence})` : ''})` : sequence ? `(${sequence})` : '';
    const q = journeyed ? askedOf(journeyed) : oneEach.length ? 'FormaEntities' : '';
    return { body, command: `run {${q ? ` ${q} ` : ''}}` };
  };
  const refused = journey.polarity === 'must not' ? journey.refusedStep : null;
  const upTo = question.kind === 'refusal' ? refused : refused === null ? steps.length : refused - 1;
  const should = question.kind === 'path' && refused === null;
  if (should && schedule.end?.native === undefined) return { cannot: 'the schedule of a journey that should happen defines no End' };
  const { body, command } = journeyTo(upTo, should ? schedule.end.native : null);
  return done(body, command, { values, asks: 'run', entities, cases: steps.slice(0, upTo).filter((s) => s.alone).map((s) => s.n) });
}

/** Generated files by name in byte order (evidence.md §basis). */
const sortedGenerated = (generated) => Object.fromEntries(sortedBy(Object.keys(generated)).map((name) => [name, generated[name]]));

// --- The lifecycle engine (engines.md §lifecycle-engine) -------------------------------------------------------------------

async function composeLifecycle(ctx, state, question) {
  const part = state.part;
  const holder = ctx.restatement.parts.get(part);
  const lifecycles = state.lifecycles.map((name) => ctx.lifecycles.get(name)).filter(Boolean);
  const actions = holder?.actions ?? [];
  const kind = question.kind;
  const files = [];
  const slot = (s) => files.push(slotFile(ctx, s));
  const overlay = kind === 'fault' ? question.slots.fault.form.overlay ?? [] : [];
  const data = dataForm(part, lifecycles, actions, overlay);
  const pages = new Set();
  for (const l of lifecycles) {
    pages.add(l.page);
    const read = l.asRead ?? {};
    for (const phase of Object.keys(read)) for (const cell of Object.values(read[phase] ?? {})) {
      for (const filled of [cell, ...(cell?.kind === 'cases' ? cell.cases.map((c) => c.outcome) : [])]) {
        if (filled?.filledBy) pages.add(ctx.restatement.things.get(filled.filledBy)?.page);
      }
      if (cell?.filledBy) pages.add(ctx.restatement.things.get(cell.filledBy)?.page);
    }
  }
  if (holder?.tables.actions?.exists) pages.add(holder.tables.actions.path);
  for (const path of [...pages].filter(Boolean)) files.push({ path, bytes: ctx.project.files.get(path)?.bytes ?? Buffer.alloc(0) });
  let ask;
  if (kind === 'base' || kind === 'fault') {
    slot(question.slots.encoding);
    if (kind === 'fault') slot(question.slots.fault);
    ask = { ask: 'forbidden', form: question.slots.encoding.form.forbidden };
  } else if (kind === 'witness') {
    slot(question.slots.witness);
    ask = { ask: 'target', form: question.slots.witness.form.target };
  } else {
    const journey = question.journey;
    // Each step's action and each start row's lifecycle by the key it resolves to in the part, not as written, so a
    // journey re-filed, whose bare references are then written `<part>/<key>`, composes the same (evidence.md §moved).
    const from = journey.from ?? journey.holder;
    const keyOf = (ref, kind) => {
      const resolved = resolveRef(ctx.restatement, ref, from, kind);
      return resolved.entry ? resolved.key : ref;
    };
    const start = (journey.start ?? []).map(({ line, ...row }) => ({ ...row, lifecycle: keyOf(row.lifecycle, 'lifecycles') }));
    const steps = journey.steps.map(({ line, ...step }) => ({ ...step, action: keyOf(step.action, 'actions') }));
    ask = { ask: 'journey', variant: question.variant, step: question.expected.step ?? null, journey: { polarity: journey.polarity, refusedStep: journey.refusedStep ?? null, start, steps } };
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    generated: { 'lifecycles.json': jsonText(data), 'question.json': jsonText(ask) },
    files,
    engineFiles: {},
    run: { data, ask, lifecycles, actions },
  };
}

// --- The replay (engines.md §replay) ------------------------------------------------------------------------------

/** A printed TLC value written back as TLA+ the replay can read, model values by the replay's own constants. */
function replayText(value, names) {
  switch (value.kind) {
    case 'tuple': return `<<${value.items.map((v) => replayText(v, names)).join(', ')}>>`;
    case 'set': return `{${value.items.map((v) => replayText(v, names)).join(', ')}}`;
    case 'record': return `[${value.fields.map(([name, v]) => `${name} |-> ${replayText(v, names)}`).join(', ')}]`;
    case 'function': return `(${value.pairs.map(([k, v]) => `${replayText(k, names)} :> ${replayText(v, names)}`).join(' @@ ')})`;
    case 'string': return `"${value.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    case 'range': return `{${Array.from({ length: Math.max(0, Number(BigInt(value.to) - BigInt(value.from)) + 1) }, (_, k) => integerText(BigInt(value.from) + BigInt(k))).join(', ')}}`;
    case 'integer': return integerText(value.value);
    case 'boolean': return value.value ? 'TRUE' : 'FALSE';
    default: return names.get(value.name) ?? value.name;
  }
}

/** Every model-value name in printed values (engines.md §replay). */
function modelValueNames(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found;
  if (value.kind === 'name') found.add(value.name);
  for (const item of value.items ?? []) modelValueNames(item, found);
  for (const [, v] of value.fields ?? []) modelValueNames(v, found);
  for (const [k, v] of value.pairs ?? []) { modelValueNames(k, found); modelValueNames(v, found); }
  return found;
}

/**
 * The replay of a TLC trace (engines.md §replay): a module extending the run's wrapper whose initial state and steps are the trace's
 * states as TLC printed them, `parsed` each state's values as tlc.mjs reads them, with `FormaPhases`, `FormaBindings`
 * and `FormaEntities` added as variables. `steps[i]` says how to read the bindings of the step into state i: a row of
 * the next-state relation, or a scheduled step's arguments. Every name it adds begins `Forma`: a model value is written
 * through a constant `FormaValue<k>` the configuration gives that model value, so no name of the model's own, a bound
 * parameter's included, is declared again.
 */
export function composeReplay(model, parsed, { steps = [], entities = [], back = null, rows = [] } = {}) {
  const names = Object.keys(parsed[0]).sort();
  const values = new Set();
  for (const state of parsed) for (const value of Object.values(state)) modelValueNames(value, values);
  const valueNames = new Map(sortedBy([...values]).map((name, at) => [name, `FormaValue${at + 1}`]));
  const integers = [];
  const assign = (state, prime) => names.map((name) => `${name}${prime} = (${replayText(state[name], valueNames)})`).join(' /\\ ');
  const replayed = back ? [...parsed, parsed[back - 1]] : parsed;
  const bindingsOf = (step) => {
    if (step?.row) {
      const { operator, parameters } = step.row;
      if (!parameters.length) return `(IF ${operator} THEN {<<>>} ELSE {})`;
      const tuple = `<<${parameters.map((p) => p.name).join(', ')}>>`;
      return unionOver(parameters, `(IF ${call(operator, parameters.map((p) => p.name))} THEN {${tuple}} ELSE {})`);
    }
    if (step?.args) return `{<<${step.args.map((a) => `(${a})`).join(', ')}>>}`;
    return '{}';
  };
  const body = [];
  if (valueNames.size) body.push(`CONSTANTS ${[...valueNames.values()].join(', ')}`);
  body.push('VARIABLES FormaAt, FormaPhases, FormaBindings, FormaEntities');
  body.push(`FormaPhasesNow == <<${model.phases.map((row) => `[${row.over.name} \\in ${row.over.domain} |-> ${row.expression}]`).join(', ')}>>`);
  replayed.slice(1).forEach((_, at) => body.push(`FormaBindings${at + 2} == ${bindingsOf(steps[at + 1])}`));
  body.push(`FormaReplayInit == FormaAt = 1 /\\ ${assign(parsed[0], '')} /\\ FormaPhases = FormaPhasesNow /\\ FormaBindings = {} /\\ FormaEntities = <<${entities.map(([, value]) => `(${value})`).join(', ')}>>`);
  const kept = ['FormaAt', 'FormaPhases', 'FormaBindings', 'FormaEntities', ...names];
  if (replayed.length === 1) body.push(`FormaReplayNext == FormaAt = 0 /\\ UNCHANGED <<${kept.join(', ')}>>`);
  else {
    body.push('FormaReplayNext ==');
    replayed.slice(1).forEach((state, at) => {
      body.push(`  ${at === 0 ? '/\\ \\/' : '   \\/'} (FormaAt = ${at + 1} /\\ FormaAt' = ${at + 2} /\\ ${assign(state, "'")} /\\ FormaBindings' = FormaBindings${at + 2})`);
    });
    body.push("  /\\ FormaPhases' = FormaPhasesNow'", "  /\\ FormaEntities' = FormaEntities");
  }
  body.push(`FormaReplayEnd == FormaAt # ${replayed.length}`);
  if (body.some((line) => line.includes('FormaIntegers!'))) integers.push('FormaIntegers == INSTANCE Integers');
  const module = tlaModule('FormaTrace', ['FormaExam', 'TLC'], [...(valueNames.size ? [body[0]] : []), ...integers, ...body.slice(valueNames.size ? 1 : 0)]);
  const extra = [...valueNames].map(([name, constant]) => `  ${constant} = ${name}`);
  const cfg = configuration(model, { init: 'FormaReplayInit', next: 'FormaReplayNext', invariants: ['FormaReplayEnd'], extra });
  void rows;
  return { module, cfg, length: replayed.length, valueNames };
}
