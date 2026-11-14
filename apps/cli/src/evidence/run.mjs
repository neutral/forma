// Running questions (evidence.md §running): each engine within its limits, on the pinned toolchain; what a
// run found, its measures, flags and trace (evidence.md §outcomes, §measures to engines.md §trace) and its replay (engines.md §replay); the evidence it
// writes and when (evidence.md §evidence-file, §written), the surprise it opens (evidence.md §surprise-file), a closed surprise's files removed
// (evidence.md §at-ruling); a run again where a machine lacks one (evidence.md §rerun); and `forma run` (evidence.md §forma-run) as runOwed().

import { availableParallelism, totalmem } from 'node:os';
import { Worker } from 'node:worker_threads';
import { readDesign } from '../design/index.mjs';
import { allowanceOf, engineAllowed, left as allowanceLeft, readSpent, spend } from '../door/spent.mjs';
import { takeLock } from '../door/lock.mjs';
import { aheadOfClock, basisDigest, compare, jsonText, ordered, sha256, sortedBy, timeText } from '../record/json.mjs';
import { BASIS_KEYS, evidenceText, MEASURE_KEYS, surpriseName, surprisePath } from '../record/evidence.mjs';
import { ruledSurprises } from '../record/decisions.mjs';
import { parseScope } from '../record/models.mjs';
import { readProject } from '../record/project.mjs';
import { takeOut } from '../record/receipts.mjs';
import { modelsPath, readBytes, removeFile, removeFolder, walk, writeWhole } from '../record/tree.mjs';
import { alloySymbols, atomName, observerValues, readAlloy, runAlloy, tinyScope } from '../alloy.mjs';
import { functionPairs, parseTlcValue, readTlc, runTlc, tlcText } from '../tlc.mjs';
import { engineToolchain } from '../toolchain.mjs';
import { compose, composeReplay } from './compose.mjs';
import { evidenceContext } from './context.mjs';
import { versionsHere } from './currency.mjs';
import { explorationTrace, stepLifecyclePath, steppingTrace } from './stepping.mjs';
import { readEvidence } from './index.mjs';

// --- Outcomes (evidence.md §outcomes, §keys) -----------------------------------------------------------------------

const REACHED = new Set(['witness', 'misbehaviour', 'enabled', 'path', 'start', 'facts']);

/** The kind a question is read as: a reduction as the question it reduces (evidence.md §reductions), a weaker form as a base (evidence.md §weaker). */
const readAs = (q) => (q.kind === 'reduction' ? q.reduces : q.kind === 'weaker' ? 'base' : q.kind);

/**
 * Whether what a run found matches what its question expects (evidence.md §keys): `no violation`, `reached`, `not
 * enabled` and `admitted` match themselves; `caught` matches a violation of the encoding's own property; `refused`
 * matches when its step is the expected one. Undefined where it did not answer or nothing is expected.
 */
function matchesOf(q, found, property) {
  if (found.outcome === 'unanswered' || !q.expected) return undefined;
  if (q.expected.outcome === 'caught') return found.outcome === 'violation' && found.property === property;
  if (q.expected.outcome === 'refused') return found.outcome === 'refused' && found.step === q.expected.step;
  return found.outcome === q.expected.outcome;
}

/** A `found` written as evidence.md §keys writes it: `outcome`, with `property`, `step` or `reason` where it applies. */
const foundOf = (outcome, more = {}) => ordered({ outcome, ...more }, ['outcome', 'property', 'step', 'reason']);

/** What TLC's output answers (engines.md §tlc, evidence.md §outcomes), read by tlc.mjs from its tool-mode messages. */
function tlcFound(q, run, raw, said, limits) {
  if (raw.timedOut) return foundOf('unanswered', { reason: `ran out of time: stopped after ${limits.seconds} s` });
  if (said.outOfMemory || /OutOfMemoryError/.test(`${raw.stdout}\n${raw.stderr}`)) return foundOf('unanswered', { reason: `ran out of memory: ${limits.megabytes} MB of heap` });
  const kind = readAs(q);
  // A conjunct named by its place: the question's invariant when it is in the wrapper, the type invariant when in a model file (engines.md §tlc).
  let violated = said.violated ?? (said.violatedIn ? (said.violatedIn === 'FormaExam' ? run.watch : run.typeInvariant) : null);
  if (!violated && said.temporal) violated = run.watch;
  if (violated) {
    if (violated === run.typeInvariant) return foundOf('violation', { property: run.typeInvariant });
    if (violated === run.watch) {
      if (REACHED.has(kind)) return foundOf('reached');
      if (kind === 'refusal') return foundOf('enabled');
      if (kind === 'phases') return foundOf('violation', { property: 'phases' });
      return foundOf('violation', { property: run.property ?? run.watch });
    }
    return foundOf('violation', { property: violated });
  }
  if (said.success && !said.errors.length) {
    // A should-happen journey's path without a start that reached the depth of its last step took every step, so End
    // did not hold after the last in any behaviour (engines.md §tlc, evidence.md §outcomes).
    const end = kind === 'path' ? run.end : null;
    if (end && end.step > 0 && end.depth !== null && said.depth === end.depth) return foundOf('not reached', { reason: `the expected end does not hold after step ${end.step}` });
    if (REACHED.has(kind)) return foundOf('not reached');
    if (kind === 'refusal') return foundOf('not enabled');
    return foundOf('no violation');
  }
  const why = said.errors.join(' ') || raw.stderr.toString('utf8').trim() || `exit code ${raw.code}`;
  return foundOf('unanswered', { reason: `the engine failed: ${why.slice(0, 600)}` });
}

/** What Alloy's command summary answers (engines.md §alloy, evidence.md §outcomes): an instance of a `check` is a violation, of a `run` what it asks reached or enabled. */
function alloyFound(q, run, read) {
  if (!read.answered) return foundOf('unanswered', { reason: read.reason });
  const kind = readAs(q);
  if (run.asks === 'check') return read.sat ? foundOf('violation', { property: run.property }) : foundOf('no violation');
  if (kind === 'refusal') return read.sat ? foundOf('enabled') : foundOf('not enabled');
  return read.sat ? foundOf('reached') : foundOf('not reached');
}

// --- Traces (engines.md §trace) ---------------------------------------------------------------------------------

/** Whether a run keeps its trace in its evidence (engines.md §trace): a start or witness that reached, a reduction or weaker form that found a violation. */
const evidenceKeeps = (q, found) => ((q.kind === 'start' || q.kind === 'witness') && found.outcome === 'reached') || ((q.kind === 'reduction' || q.kind === 'weaker') && found.outcome === 'violation');

/** A row of a TLC step (engines.md §trace), from the operator TLC names: a row of the tables by its `FormaRow<n>`, a scheduled step by its `FormaStep<k>`, else the operator. */
function tlcRow(run, label) {
  const operator = label?.operator ?? null;
  const n = /^FormaRow(\d+)$/.exec(operator ?? '')?.[1];
  const row = n ? run.rows.find((r) => r.n === Number(n)) : null;
  if (row?.action) return { row: { action: row.action }, replay: { row: { operator: row.operator, parameters: row.parameters } }, names: row.parameters.map((p) => p.name) };
  if (row) return { row: { misbehaviour: `${row.row}/${row.item}` }, replay: { row: { operator: row.operator, parameters: row.parameters } }, names: row.parameters.map((p) => p.name) };
  const k = /^FormaStep(\d+)$/.exec(operator ?? '')?.[1];
  const step = k ? run.steps.find((s) => s.n === Number(k)) : null;
  if (step) return { row: { action: step.action }, replay: { args: step.args }, names: step.parameters };
  return { row: { operator: operator ?? 'the initial predicate' }, replay: null, names: [] };
}

/** An entity as a trace names it (engines.md §trace): by the schedule's name for its value, by each name when one value has several. */
function entityNames(entities, printed) {
  const names = new Map();
  if (!printed) return names;
  try {
    parseTlcValue(printed).items.forEach((value, at) => {
      const text = tlcText(value);
      names.set(text, [...(names.get(text) ?? []), entities[at][0]]);
    });
  } catch {
    // the schedule's values unread: entities are named by their values
  }
  return new Map([...names].map(([text, list]) => [text, list.join(', ')]));
}

/**
 * The replay of a TLC trace (engines.md §replay): a second run whose initial state and steps are the trace's states as
 * TLC printed them, with the Phases expressions, each step's bindings and the schedule's entity values added as
 * variables, within the time the run has left. Gives `{ phases, bindings, names }`, or `{ reason }` why it gave none.
 */
async function replay(state, composed, said, { tools, limits, spent, runFolder, root }) {
  const run = composed.run;
  const trace = said.trace;
  const labels = [...trace.states.map((s) => s.step), ...(trace.back ? [trace.back.step] : [])];
  const rows = labels.map((label, at) => (at === 0 ? null : tlcRow(run, label)));
  let parsed;
  try {
    parsed = trace.states.map((s) => Object.fromEntries(Object.entries(s.values).map(([name, text]) => [name, parseTlcValue(text.replace(/\s*\n\s*/g, ' '))])));
  } catch (error) {
    return { reason: `the trace's values could not be read for the replay: ${error.message}` };
  }
  const model = state.model;
  const { module, cfg, length } = composeReplay(composed.atModel ?? model, parsed, { steps: rows.map((r) => r?.replay ?? null), entities: run.entities, back: trace.back?.state ?? null });
  await writeWhole(root, `${runFolder}/replay/FormaTrace.tla`, module);
  await writeWhole(root, `${runFolder}/replay/FormaTrace.cfg`, cfg);
  const seconds = limits.seconds - spent / 1000;
  if (seconds <= 0) return { reason: 'the run had no time left for its replay' };
  const files = { ...composed.engineFiles, 'FormaExam.tla': composed.generated['FormaExam.tla'], 'FormaTrace.tla': module, 'FormaTrace.cfg': cfg };
  const raw = await runTlc(tools, files, { module: 'FormaTrace', cfg: 'FormaTrace.cfg', seconds, memory: limits.megabytes });
  await writeWhole(root, `${runFolder}/replay/tlc.out`, raw.stdout);
  if (raw.stderr.length) await writeWhole(root, `${runFolder}/replay/tlc.err`, raw.stderr);
  if (raw.timedOut) return { reason: 'the replay ran out of the time the run had left' };
  const out = readTlc(raw.stdout.toString('utf8'));
  if (out.violated !== 'FormaReplayEnd' || out.trace?.states.length !== length) return { reason: `the engine refused or failed the replay: ${(out.errors.join(' ') || raw.stderr.toString('utf8').trim() || `exit code ${raw.code}`).slice(0, 600)}` };
  try {
    const printed = out.trace.states;
    const names = entityNames(run.entities, printed[0].values.FormaEntities);
    const phases = printed.slice(0, trace.states.length).map((s) => {
      const value = parseTlcValue(s.values.FormaPhases.replace(/\s*\n\s*/g, ' '));
      const out2 = {};
      model.phases.forEach((row, at) => {
        const held = {};
        for (const [entity, phase] of functionPairs(value.items[at])) held[names.get(entity) ?? entity] = phase.kind === 'string' ? phase.value : tlcText(phase);
        out2[row.lifecycle] = Object.fromEntries(sortedBy(Object.keys(held)).map((k) => [k, held[k]]));
      });
      return Object.fromEntries(sortedBy(Object.keys(out2)).map((k) => [k, out2[k]]));
    });
    const bindings = printed.map((s, at) => {
      if (!at || !rows[at]) return null;
      const set = parseTlcValue(s.values.FormaBindings.replace(/\s*\n\s*/g, ' '));
      const first = set.items[0];
      return first ? Object.fromEntries(rows[at].names.map((name, i) => [name, tlcText(first.items[i])])) : {};
    });
    return { phases, bindings };
  } catch (error) {
    return { reason: `the replay's values could not be read: ${error.message}` };
  }
}

/** A TLC trace as evidence keeps it (engines.md §trace), with the replay's phases and bindings or its reason. */
function tlcTrace(run, said, replayed, hasPhases) {
  const trace = said.trace;
  const states = trace.states.map((s, at) => {
    const state = {};
    if (at > 0) {
      const { row } = tlcRow(run, s.step);
      state.rows = [replayed.bindings ? { ...row, bindings: replayed.bindings[at] ?? {} } : row];
    }
    if (replayed.phases) state.phases = replayed.phases[at];
    return state;
  });
  const out = { states };
  if (trace.back) {
    const { row } = tlcRow(run, trace.back.step);
    out.loop = { to: trace.back.state - 1, rows: [replayed.bindings ? { ...row, bindings: replayed.bindings[trace.states.length] ?? {} } : row] };
  } else if (trace.stuttering) out.loop = 'stutter';
  if (!replayed.phases) out.replay = hasPhases ? replayed.reason : 'the model has no Phases rows, so no replay is made';
  return out;
}

/**
 * An Alloy instance as evidence keeps its trace (engines.md §trace): each state's rows, every row whose predicate the
 * observers give for the step into it, each with its bindings; each entity's phase; and the loop that closes it.
 */
function alloyTrace(run, read) {
  const named = new Map();
  for (const state of read.states) for (const [atom, fields] of Object.entries(state.values)) for (const label of [atom, ...Object.values(fields).flat(2)]) named.set(label, atomName(label, read.sigs));
  const counts = new Map();
  for (const short of new Set(named.values())) counts.set(short, [...named.values()].filter((v) => v === short).length);
  const distinct = new Map();
  for (const [label, short] of named) if (!distinct.has(short)) distinct.set(short, new Set());
  for (const [label, short] of named) distinct.get(short).add(label);
  const name = (label) => {
    const short = named.get(label) ?? atomName(label, read.sigs);
    return (distinct.get(short)?.size ?? 1) > 1 ? String(label) : short;
  };
  const aliases = new Map();
  run.entities.forEach(([entity], at) => {
    for (const [atom] of observerValues(read.states[0])[`formaEntity${at + 1}`] ?? []) aliases.set(atom, [...(aliases.get(atom) ?? []), entity]);
  });
  const entityName = (atom) => (aliases.has(atom) ? aliases.get(atom).join(', ') : name(atom));
  const rowsAt = (state) => run.rows.flatMap((row) => {
    const tuples = observerValues(state)[`formaRow${row.n}`] ?? [];
    if (!tuples.length) return [];
    const head = row.action ? { action: row.action } : { misbehaviour: `${row.row}/${row.item}` };
    if (!row.parameters.length) return [{ ...head, bindings: {} }];
    return tuples.map((tuple) => ({ ...head, bindings: Object.fromEntries(row.parameters.map((p, i) => [p.name, entityName(tuple[i])])) }));
  });
  const phasesAt = (state) => {
    const observed = observerValues(state);
    const out = {};
    run.phaseRows.forEach((row, at) => {
      const members = row.keys.map((_, k) => new Set((observed[`formaPhase${at + 1}x${k + 1}`] ?? []).map(([e]) => e)));
      const held = {};
      for (const [entity] of observed[`formaOver${at + 1}`] ?? []) {
        const phase = row.keys.find((_, k) => members[k].has(entity)) ?? null;
        held[entityName(entity)] = phase;
      }
      out[row.lifecycle] = Object.fromEntries(sortedBy(Object.keys(held)).map((k) => [k, held[k]]));
    });
    return Object.fromEntries(sortedBy(Object.keys(out)).map((k) => [k, out[k]]));
  };
  const states = read.states.map((state, at) => (at ? { rows: rowsAt(read.states[at - 1]), phases: phasesAt(state) } : { phases: phasesAt(state) }));
  return { states, loop: { to: read.loopBack, rows: rowsAt(read.states.at(-1)) } };
}

/** The entries a trace's rows name (evidence.md §basis, engines.md §trace): each action's and each world row's, by entry name. */
function traceEntries(trace) {
  const out = new Set();
  const rows = [...trace.states.flatMap((s) => s.rows ?? []), ...(trace.loop && typeof trace.loop === 'object' ? trace.loop.rows : [])];
  for (const row of rows) {
    if (row.action) {
      const [part, key] = row.action.split('/');
      out.add(`${part}/actions/${key}`);
    }
    if (row.misbehaviour) {
      const [part, key] = row.misbehaviour.split('/');
      out.add(`${part}/boundary/${key}`);
    }
  }
  return sortedBy([...out]);
}

/**
 * What a trace meant when it ran (engines.md §trace): for each action and world row its rows name, and for a refusal its
 * journey, whose refused step the rendering shows (presentation.md §rendering), its entry, pin and canonical content, in byte order of entry;
 * and for a fault, the fault slot's path with its mechanism.
 */
function renderedOf(ctx, q, trace) {
  const names = [...traceEntries(trace), ...(readAs(q) === 'refusal' && q.journey?.entry ? [q.journey.entry] : [])];
  const out = sortedBy([...new Set(names)]).filter((name) => ctx.pinNow(name) !== null).map((entry) => ({ entry, pin: ctx.pinNow(entry), content: ctx.textNow(entry) ?? '' }));
  const fault = q.slots?.fault;
  if (fault && readAs(q) === 'fault') out.push({ fault: fault.path, mechanism: fault.form.mechanism });
  return out;
}

// --- One run (evidence.md §running, §runs) ----------------------------------------------------------------------------

/** The basis of a run (evidence.md §basis): the files read and generated, the entries read and named by its trace, the versions. */
function basisOf(ctx, q, composed, trace) {
  const files = sortedBy(composed.files.map((f) => ({ path: f.path, sha256: sha256(f.bytes) })), (f) => f.path);
  const generated = sortedBy(Object.entries(composed.generated).map(([name, text]) => ({ generated: name, sha256: sha256(text) })), (f) => f.generated);
  const names = sortedBy([...new Set([...q.reads, ...(trace ? traceEntries(trace) : [])])]);
  const entries = names.filter((name) => ctx.pinNow(name) !== null).map((entry) => ({ entry, pin: ctx.pinNow(entry) }));
  const here = versionsHere(q.engine);
  return ordered({ files: [...files, ...generated], entries, engine: here.engine, runtime: here.runtime, library: here.library, forma: here.forma }, BASIS_KEYS);
}

/** The limits a run of `engine` runs within now (evidence.md §limits), as evidence writes them. */
const limitsOf = (allowance, engine) => (engine === 'lifecycle' ? { seconds: allowance.engines.lifecycle.seconds } : { seconds: allowance.engines[engine].seconds, megabytes: allowance.engines[engine].megabytes });

/** Explores the data form in a worker of its own (engines.md §lifecycle-engine), stopped once its time is out. */
function exploreInWorker(data, form, seconds) {
  return new Promise((done) => {
    const worker = new Worker(new URL('./lifecycle-worker.mjs', import.meta.url), { workerData: { data, form, seconds } });
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      done(value);
    };
    const timer = setTimeout(() => settle({ answered: false, reason: `ran out of time: stopped after ${seconds} s`, combinations: null }), seconds * 1000 + 1000);
    worker.once('message', settle);
    worker.once('error', (error) => settle({ answered: false, reason: `the engine failed: ${error.message}`, combinations: null }));
    worker.once('exit', (code) => settle({ answered: false, reason: `the engine stopped with exit code ${code}`, combinations: null }));
  });
}

/**
 * Runs one composed question (evidence.md §running) into `runs/<name>/` (evidence.md §runs), with its marker while it runs (evidence.md §in-progress): gives
 * `{ q, found, matches, measures, flags, cases, trace, basis, limits, finished, duration, timedOut }`, `trace` the
 * trace the run gave, kept by evidence or a surprise as engines.md §trace says.
 */
async function runQuestion(ctx, models, q, composed, { root, tools, limits, folder = q.name }) {
  const runFolder = `runs/${folder}`;
  const started = new Date();
  await removeFolder(root, runFolder);
  await writeWhole(root, `${runFolder}/running.json`, jsonText({ name: folder, started: started.toISOString(), ends: new Date(started.getTime() + limits.seconds * 1000).toISOString() }));
  for (const [name, text] of Object.entries(composed.generated)) await writeWhole(root, `${runFolder}/inputs/${name}`, text);
  for (const file of composed.files) await writeWhole(root, `${runFolder}/inputs/${file.path}`, file.bytes);
  const state = models.get(q.model);
  const run = composed.run;
  let found;
  let measures;
  let flags = [];
  let trace = null;
  let duration;
  if (q.engine === 'tlc') {
    const raw = await runTlc(tools, { ...composed.engineFiles, ...composed.generated }, { module: 'FormaExam', cfg: 'FormaExam.cfg', seconds: limits.seconds, memory: limits.megabytes });
    duration = raw.milliseconds;
    await writeWhole(root, `${runFolder}/output/tlc.out`, raw.stdout);
    if (raw.stderr.length) await writeWhole(root, `${runFolder}/output/tlc.err`, raw.stderr);
    const said = readTlc(raw.stdout.toString('utf8'));
    found = tlcFound(q, run, raw, said, limits);
    measures = { duration, states: said.distinct ?? null, depth: said.depth ?? null };
    const matched = matchesOf(q, found, run.property);
    if (found.outcome !== 'unanswered' && said.trace) {
      // A trace the evidence or a surprise keeps is replayed (engines.md §replay); any other is read for the entries its rows name,
      // which the basis names whether or not the trace is kept (evidence.md §basis).
      const kept = evidenceKeeps(q, found) || matched === false;
      const hasPhases = state.model.phases.length > 0;
      const replayed = kept && hasPhases ? await replay(state, composed, said, { tools, limits, spent: duration, runFolder, root }) : { reason: kept ? null : 'not kept' };
      trace = tlcTrace(run, said, replayed, hasPhases);
    }
    if (q.kind === 'base' && found.outcome === 'no violation') {
      if (duration < 1000) flags.push('instant-pass');
      if (said.distinct !== null && said.distinct < 100) flags.push('tiny-state-space');
    }
  } else if (q.engine === 'alloy') {
    const raw = await runAlloy(tools, composed.engineFiles, { main: 'FormaExam.als', command: run.command, seconds: limits.seconds, memory: limits.megabytes });
    duration = raw.milliseconds;
    await writeWhole(root, `${runFolder}/output/alloy.out`, raw.stdout);
    if (raw.stderr.length) await writeWhole(root, `${runFolder}/output/alloy.err`, raw.stderr);
    for (const [name, bytes] of Object.entries(raw.outputs)) await writeWhole(root, `${runFolder}/output/${name}`, bytes);
    const read = readAlloy(raw, run.command, { seconds: limits.seconds, memory: limits.megabytes, type: run.asks });
    found = alloyFound(q, run, read);
    const m = read.measures ?? {};
    const least = m.stepsFrom ?? null;
    const most = m.steps ?? null;
    // Each is null where the command leaves it to Alloy's own default (evidence.md §measures): no `steps` or `int` row in the bounds it
    // ran at, or a scope of signature bounds alone, whatever default the summary then fills in.
    const bound = (name) => (Array.isArray(q.bounds) ? q.bounds.find((b) => b.bound === name)?.value ?? null : null);
    let defaultNumber = null;
    try { defaultNumber = parseScope(bound('scope') ?? '').number; } catch { /* a scope not in its form was refused at read */ }
    measures = {
      duration,
      scope: defaultNumber === null ? null : m.scope ?? null,
      steps: bound('steps') === null || (least === null && most === null) ? null : [least, most],
      bitwidth: bound('int') === null ? null : m.bitwidth ?? null,
    };
    if (read.answered && read.sat) trace = alloyTrace(run, read);
    if (q.kind === 'base' && found.outcome === 'no violation') {
      const declared = [];
      try {
        const texts = Object.fromEntries(Object.entries(state.files).map(([name, bytes]) => [name, bytes.toString('utf8')]));
        for (const file of Object.keys(texts)) for (const symbol of await alloySymbols(tools, texts, file)) if (symbol.kind === 'sig') declared.push({ name: symbol.name, single: Boolean(symbol.single) });
      } catch {
        declared.length = 0;
      }
      let scope = { number: null, bounds: [] };
      try { scope = parseScope(state.model.bounds.find((b) => b.bound === 'scope')?.value ?? ''); } catch { /* a scope not in its form was refused at read */ }
      if (tinyScope(read, scope, declared)) flags.push('tiny-scope');
      if (m.steps !== null && m.steps !== undefined && m.steps < 2) flags.push('tiny-trace');
    }
  } else {
    const startedAt = Date.now();
    if (run.ask.ask === 'journey') {
      const result = stepLifecyclePath(ctx, run.data, run.lifecycles, run.actions, q.journey, q.variant);
      duration = Date.now() - startedAt;
      await writeWhole(root, `${runFolder}/output/result.json`, jsonText(result));
      found = result.unchecked ? foundOf('unanswered', { reason: result.unchecked }) : result.outcome === 'refused' ? foundOf('refused', { step: result.step }) : foundOf('admitted');
      measures = { duration, combinations: null };
      if (!result.unchecked) trace = steppingTrace(ctx, run.data, q.journey, result);
    } else {
      const result = await exploreInWorker(run.data, run.ask.form, limits.seconds);
      duration = Date.now() - startedAt;
      await writeWhole(root, `${runFolder}/output/result.json`, jsonText(result));
      measures = { duration, combinations: result.combinations ?? null };
      if (!result.answered) found = foundOf('unanswered', { reason: result.reason });
      else if (q.kind === 'witness') found = result.found ? foundOf('reached') : foundOf('not reached');
      else found = result.found ? foundOf('violation', { property: 'forbidden form' }) : foundOf('no violation');
      if (result.answered && result.trace) trace = explorationTrace(run.data, result.trace);
      if (q.kind === 'base' && found.outcome === 'no violation') flags = result.flags ?? [];
    }
  }
  const property = q.engine === 'lifecycle' ? 'forbidden form' : run.property;
  const matches = matchesOf(q, found, property);
  const finished = timeText();
  const basis = basisOf(ctx, q, composed, trace);
  await writeWhole(root, `${runFolder}/basis.json`, jsonText({ name: folder, basis, finished }));
  await removeFile(root, `${runFolder}/running.json`);
  return { q, found, matches, measures: ordered(measures, MEASURE_KEYS), flags: sortedBy([...new Set(flags)]), cases: run.cases ?? (['path', 'refusal'].includes(q.kind) ? [] : null), trace, basis, limits, finished, duration, timedOut: found.outcome === 'unanswered' && /^ran out of time/.test(found.reason) };
}

// --- Evidence and surprises (evidence.md §evidence-file, §written, §surprise-file) -----------------------------------------------------

/** Whether two founds differ in outcome, property or step (evidence.md §written). */
const differs = (a, b) => a.outcome !== b.outcome || (a.property ?? null) !== (b.property ?? null) || (a.step ?? null) !== (b.step ?? null);

/** Whether limits are larger than others (evidence.md §limits): either is larger. */
const larger = (a, b) => a.seconds > b.seconds || (a.megabytes ?? 0) > (b.megabytes ?? 0);

/**
 * Whether a run writes its question's evidence (evidence.md §written): when there is none, when its basis digest differs,
 * when on the same basis its found differs in outcome, property or step, or when unanswered again at larger limits.
 */
function writes(existing, result) {
  if (!existing) return true;
  if (basisDigest(existing.basis) !== basisDigest(result.basis)) return true;
  if (differs(existing.found, result.found)) return true;
  return existing.found.outcome === 'unanswered' && result.found.outcome === 'unanswered' && larger(result.limits, existing.limits);
}

/** A question's evidence from a run (evidence.md §keys), `previous` kept or become the old found (evidence.md §written). */
function evidenceValue(ctx, result, existing) {
  const q = result.q;
  const keep = result.trace && evidenceKeeps(q, result.found);
  const previous = !existing ? null : !differs(existing.found, result.found) ? existing.previous ?? null : { ...existing.found, until: result.finished };
  return {
    name: q.name,
    kind: q.kind,
    expected: q.expected ?? undefined,
    reduces: q.kind === 'reduction' ? q.reduction.surprise : undefined,
    weakens: q.kind === 'weaker' ? q.weaker.surprise : undefined,
    bounds: q.boundsObject,
    limits: result.limits,
    basis: result.basis,
    found: result.found,
    matches: q.shape === 'evidence' && result.matches !== undefined ? result.matches : undefined,
    measures: result.measures,
    flags: q.shape === 'evidence' ? result.flags : undefined,
    cases: q.shape === 'evidence' && ['path', 'refusal'].includes(q.kind) ? result.cases ?? [] : undefined,
    trace: keep ? result.trace : undefined,
    rendered: keep ? renderedOf(ctx, q, result.trace) : undefined,
    established: result.finished,
    previous: q.shape === 'evidence' ? previous : undefined,
    digest: '',
  };
}

/**
 * The files a surprise's freeze holds as it opens (evidence.md §surprise-file, models.md §freeze), each `{ path, sha256 }` in byte
 * order of path: the model's model.md and engine files, for a lifecycle model the part's lifecycle pages confirmed now
 * that its basis names; and, for a claim's question, every slot of that claim on that model.
 */
function heldBy(ctx, models, q, basis) {
  const state = models.get(q.model);
  const out = new Map();
  const add = (path) => {
    const file = ctx.project.files.get(path);
    if (file?.counts) out.set(path, file.sha256);
  };
  if (state.engine === 'lifecycle') {
    const pages = new Set(state.lifecycles.map((name) => ctx.lifecycles.get(name)?.page).filter(Boolean));
    for (const f of basis.files) if (f.path && pages.has(f.path)) out.set(f.path, f.sha256);
  } else {
    add(`${state.folder}/model.md`);
    for (const name of state.engineFiles) add(`${state.folder}/${name}`);
  }
  if (q.claim) {
    const folder = `models/${q.model}/${q.claim.holder.span ? 'spans' : 'parts'}/${q.claim.holder.key}/claims/${q.claim.key}/`;
    for (const slot of ctx.project.slots.values()) if (slot.path.startsWith(folder) && !slot.path.slice(folder.length).includes('/') && slot.counts) add(slot.path);
  }
  return sortedBy([...out], ([path]) => path).map(([path, sha]) => ({ path, sha256: sha }));
}

/** Whether a ruling names the surprise of this question and basis digest (evidence.md §surprise-file, decisions.md §rulings). */
const ruled = (project, name) => project.decisions.some((d) => d.kind === 'rule' && ruledSurprises(d).includes(name));

/**
 * Writes what a run's result says (evidence.md §written, §surprise-file), holding the writer's lock: the question's evidence when
 * evidence.md §written asks, and a surprise's file when it answered and does not match and no file or ruling names that surprise.
 * Gives `{ wrote, opened }`.
 */
async function writeResult(ctx, models, result, root) {
  const q = result.q;
  const existing = ctx.project.files.get(q.path);
  const before = existing?.counts ? existing.value : null;
  let wrote = false;
  if (writes(before, result)) {
    const value = evidenceValue(ctx, result, before);
    await writeWhole(root, q.path, evidenceText(value, q.shape));
    wrote = true;
  }
  let opened = null;
  if (q.shape === 'evidence' && result.matches === false) {
    const name = surpriseName(q.name, basisDigest(result.basis));
    const file = ctx.project.files.get(surprisePath(name));
    if (!file?.counts && !ruled(ctx.project, name)) {
      const run = evidenceValue(ctx, result, null);
      const value = {
        ...run,
        name,
        question: q.name,
        held: heldBy(ctx, models, q, result.basis),
        trace: result.trace ?? undefined,
        rendered: result.trace ? renderedOf(ctx, q, result.trace) : undefined,
        previous: undefined,
      };
      await writeWhole(root, surprisePath(name), evidenceText(value, 'surprise'));
      opened = name;
    }
  }
  return { wrote, opened };
}

/**
 * Removes each closed surprise's file and every file sharing its stem (evidence.md §at-ruling): a surprise file a ruling
 * names, as after a merge, with its reductions' evidence, its weaker forms and their evidence and its explanation, the
 * explanation's and the weaker forms' receipt lines with them. Holding the writer's lock. Gives the paths removed, in
 * byte order; `onRemoved` is told each path as it is removed, as forma run prints it (evidence.md §forma-run).
 */
export async function removeClosed(project, root, onRemoved = () => {}) {
  const removed = [];
  const gone = (path) => {
    removed.push(path);
    onRemoved(path);
  };
  for (const surprise of project.surprises.values()) {
    if (!surprise.ruledBy) continue;
    const stem = project.stems.get(surprise.name);
    for (const path of [...(stem?.reductions ?? []), ...(stem?.weakerEvidence ?? [])]) if (await removeFile(root, path)) gone(path);
    for (const path of [...(stem?.weaker ?? []), ...(stem?.explanation ? [stem.explanation] : [])]) {
      const folder = path.slice(0, path.lastIndexOf('/'));
      await takeOut(root, folder, path.slice(folder.length + 1));
      gone(path);
    }
    if (await removeFile(root, surprise.path)) gone(surprise.path);
  }
  return sortedBy(removed);
}

// --- Evidence moved or removed with what it examines (evidence.md §moved, §removed) -------------------------------------

/**
 * One evidence file moved with a re-filed thing's folder (evidence.md §moved): `{ path, bytes }` at its new path, written
 * again with only its `name`, the paths in its basis under the moved folder and the moved thing's entry in its basis
 * changed, its digest following; null when the file is no evidence. `move` is `{ from, to, fromEntry, toEntry }`,
 * `from` and `to` the folders under models/ and the entries the thing's old and new names.
 */
export function movedEvidence(path, bytes, move) {
  const newPath = `${move.to}${path.slice(move.from.length)}`;
  const where = modelsPath(newPath);
  if (!['evidence', 'surprise', 'reduction', 'weaker-evidence'].includes(where.kind)) return null;
  const value = JSON.parse(Buffer.from(bytes).toString('utf8'));
  const moved = (p) => (p.startsWith(`${move.from}/`) ? `${move.to}${p.slice(move.from.length)}` : p);
  const files = value.basis.files.filter((f) => f.path).map((f) => ({ path: moved(f.path), sha256: f.sha256 }));
  const generated = value.basis.files.filter((f) => f.generated);
  const entries = value.basis.entries.map((e) => (e.entry === move.fromEntry ? { entry: move.toEntry, pin: e.pin } : e));
  const basis = { ...value.basis, files: [...sortedBy(files, (f) => f.path), ...generated], entries: sortedBy(entries, (e) => e.entry) };
  return { path: newPath, bytes: evidenceText({ ...value, name: newPath.replace(/^models\//, '').replace(/\.json$/, ''), basis }, where.kind) };
}

/**
 * The evidence a Model answer that drops a part takes from its model (evidence.md §removed item 2): each evidence file,
 * by path, of a question that serves an action or world row of the part, or a thing one of whose parts it is.
 */
export function droppedEvidence(project, design, model, part) {
  const ctx = evidenceContext(project, design);
  const folders = [`models/${model}/actions/${part}/`, `models/${model}/world/${part}/`];
  for (const claim of ctx.claims) if (claim.parts.includes(part)) folders.push(`models/${model}/${claim.holder.span ? 'spans' : 'parts'}/${claim.holder.key}/claims/${claim.key}/`);
  for (const journey of ctx.journeys.values()) if (journey.parts.includes(part)) folders.push(`models/${model}/${journey.holder.span ? 'spans' : 'parts'}/${journey.holder.key}/journeys/${journey.key}/`);
  return sortedBy([...project.files.values()].filter((f) => f.where.kind === 'evidence' && folders.some((folder) => f.path.startsWith(folder))).map((f) => f.path));
}

/**
 * The evidence an accepted Repair answer of a model takes with the slots its `removed.md` names (evidence.md §removed item
 * 3, models.md §model-repair): by path, in byte order, each evidence file on the slot's model of a question that slot served, at
 * every bounds digest. `paths` are the slots' paths from the project folder.
 */
export function removedSlotEvidence(project, paths) {
  const out = new Set();
  for (const path of paths) {
    const model = modelsPath(path).model;
    if (!model) continue;
    for (const file of project.files.values()) {
      if (file.where?.kind !== 'evidence' || file.where.model !== model || !file.counts || !file.value) continue;
      if ((file.value.basis?.files ?? []).some((f) => f.path === path)) out.add(file.path);
    }
  }
  return sortedBy([...out]);
}

// --- `forma run` (evidence.md §forma-run) -----------------------------------------------------------------------------

/** How many runs at once (evidence.md §limits): at most half the processors, and no more than half the memory holds at the largest memory limit. */
function atOnce(allowance) {
  const largest = Math.max(1, allowance.engines.tlc.megabytes, allowance.engines.alloy.megabytes);
  return Math.max(1, Math.min(Math.floor(availableParallelism() / 2), Math.floor(totalmem() / 2 ** 20 / 2 / largest)));
}

/** A run in progress here (evidence.md §in-progress): a marker whose `ends` has not passed. */
async function inProgress(root, name) {
  const bytes = await readBytes(root, `runs/${name}/running.json`);
  if (!bytes) return false;
  try {
    const value = JSON.parse(bytes.toString('utf8'));
    return Date.parse(value.ends) > Date.now();
  } catch {
    return false;
  }
}

/** A found as one line says it (evidence.md §forma-run): the outcome with its property or step, or with its reason where it has one (evidence.md §keys). */
export const foundText = (found) => (found.outcome === 'violation' ? `violation of ${found.property}` : found.outcome === 'refused' ? `refused at step ${found.step}` : found.reason ? `${found.outcome}: ${found.reason}` : found.outcome);

/** Why an owed run is not started now (evidence.md §forma-run), or null when it may start. */
async function notRunWhy(root, owed, allowance, toolchains, spentNow) {
  if (owed.later) return `written by Forma ${owed.later}`;
  if (await inProgress(root, owed.name)) return 'in progress here';
  const tool = toolchains.get(owed.question.engine);
  if (!tool.ok) return `${owed.question.engine} toolchain: ${tool.why}`;
  if (!engineAllowed(allowance, owed.question.engine)) return `no limit for ${owed.question.engine}`;
  if (owed.composed?.cannot) return `it cannot be composed: ${owed.composed.cannot}`;
  if (owed.spends && allowanceLeft(allowance, spentNow).runs <= 0) return 'no run left';
  return null;
}

/** Whether a run of another process is in progress on this machine (evidence.md §limits, §in-progress): a marker in runs/ whose `ends` has not passed. */
async function othersRunning(root) {
  for (const entry of await walk(root, 'runs')) {
    if (entry.type !== 'file' || !entry.path.endsWith('/running.json')) continue;
    if (await inProgress(root, entry.path.slice('runs/'.length, -'/running.json'.length))) return true;
  }
  return false;
}

/** The project's evidence as one read gives it: the design read, then evidence/index.mjs's readEvidence. */
async function stateOf(project) {
  return readEvidence(project, await readDesign(project));
}

/**
 * `forma run` (evidence.md §forma-run): runs on this machine what is owed a run, within the runs left, until nothing is owed
 * or no run is left. Gives `{ exit, output, value }`: `value` is evidence.md §forma-run's JSON object, `{ ran, opened, removed, skipped,
 * runs }`, or `{ refused }`; `output` what is left to print: with `json`, that object, printed once the command has
 * ended; as text, each line as soon as what it says has happened, given to `write` then where it is given, so a long
 * run shows its progress while it runs, and `output` is then empty; without `write`, the same lines in the same order.
 */
export async function runOwed(root, { json = false, write = null } = {}) {
  const gathered = [];
  const print = (line) => {
    if (json) return;
    if (write) write(`${line}\n`);
    else gathered.push(line);
  };
  const say = (value, exit) => {
    if (json) return { exit, value, output: `${JSON.stringify(value)}\n` };
    if (value.refused) for (const line of refusedLines(value.refused)) print(line);
    return { exit, value, output: write || !gathered.length ? '' : `${gathered.join('\n')}\n` };
  };
  // The clock rule (door.md §clock) is asked before anything is written, the lock included.
  const first = await readProject(root);
  const ahead = aheadOfClock(first.clock.latest);
  if (ahead) return say({ refused: [clockReason(ahead)] }, 1);
  const toolchains = new Map();
  for (const engine of ['tlc', 'alloy', 'lifecycle']) toolchains.set(engine, await engineToolchain(engine));
  const report = { ran: [], opened: [], removed: [], waiting: new Map(), skipped: [], runs: { spent: 0, left: 0 } };
  const tried = new Set();
  let lock = await takeLock(root);
  try {
    let project = await readProject(root);
    const late = aheadOfClock(project.clock.latest);
    if (late) return say({ refused: [clockReason(late)] }, 1);
    // Step 1: each closed surprise's files go (evidence.md §at-ruling), each line printed as its file is removed.
    report.removed = await removeClosed(project, root, (path) => print(`removed ${path}`));
    if (report.removed.length) project = await readProject(root);
    let state;
    for (;;) {
      state = await stateOf(project);
      const allowance = allowanceOf(state.ctx.force);
      let spent = await readSpent(root);
      const batch = [];
      for (const owed of state.owed) {
        if (tried.has(owed.name) || batch.length >= atOnce(allowance)) continue;
        if (await notRunWhy(root, owed, allowance, toolchains, spent)) continue;
        // A run that spends counts one as it starts (evidence.md §forma-run step 2; door.md §spent).
        if (owed.spends) spent = await spend(root, 'runs');
        batch.push(owed);
      }
      if (!batch.length) break;
      for (const owed of batch) tried.add(owed.name);
      const others = await othersRunning(root);
      await lock.release();
      const retry = await runAndWrite(state, batch, allowance, toolchains, root, others, report, print);
      lock = await takeLock(root);
      // A run that ran out of time while another ran beside it writes nothing and runs again at once by itself (evidence.md §limits).
      for (const result of retry) {
        const now = await stateOf(await readProject(root));
        const owed = now.owed.find((o) => o.name === result.q.name);
        if (!owed) continue;
        const allowance2 = allowanceOf(now.ctx.force);
        const why = await notRunWhy(root, owed, allowance2, toolchains, await readSpent(root));
        if (why) { report.waiting.set(owed.name, why); continue; }
        if (owed.spends) await spend(root, 'runs');
        const others2 = await othersRunning(root);
        await lock.release();
        await runAndWrite(now, [owed], allowance2, toolchains, root, others2, report, print);
        lock = await takeLock(root);
      }
      project = await readProject(root);
    }
    // What is still owed and not run (evidence.md §forma-run): each with its reason, decided now that nothing more is run.
    const allowance = allowanceOf(state.ctx.force);
    const spent = await readSpent(root);
    for (const owed of state.owed) {
      let why = report.waiting.get(owed.name) ?? null;
      if (!why && !tried.has(owed.name)) why = await notRunWhy(root, owed, allowance, toolchains, spent);
      if (why) report.skipped.push({ name: owed.name, reason: why });
    }
    // A question whose open surprise a later Forma wrote is owed nothing while it is open, and is named all the same (evidence.md §versions).
    for (const held of state.newer ?? []) if (!report.skipped.some((s) => s.name === held.name)) report.skipped.push({ name: held.name, reason: `written by Forma ${held.later}` });
    report.skipped = sortedBy(report.skipped, (s) => s.name);
    for (const s of report.skipped) print(`not run ${s.name}: ${s.reason}`);
    report.runs = { spent: spent.runs, left: allowanceLeft(allowance, spent).runs };
  } finally {
    await lock.release();
  }
  // Last, once nothing is left to run (evidence.md §forma-run).
  print(`runs: ${report.runs.spent} spent here, ${report.runs.left} left`);
  const value = {
    ran: report.ran.map((r) => ({ name: r.name, found: r.found, matches: r.matches ?? null, duration: r.duration, wrote: r.wrote, spent: r.spent })),
    opened: report.opened,
    removed: report.removed,
    skipped: report.skipped,
    runs: report.runs,
  };
  return say(value, 0);
}

/** The clock rule's reason (door.md §clock, in door.md §forma-answer's form). */
const clockReason = (ahead) => ({ check: 'door.md §clock', file: ahead.file, entry: null, field: null, says: `it holds the time ${ahead.at}, more than a minute ahead of this machine's clock, so forma run runs and writes nothing until the clock passes it` });

/**
 * Runs a batch at once (evidence.md §limits, §forma-run steps 2 and 3), each in a process of its own within its limits, and,
 * when each ends, takes the writer's lock again to write what it found, printing its lines then (evidence.md §forma-run's output). A run
 * is beside another when the batch holds more than one, or another process's run was in progress here. Its runs go
 * into `report` in the batch's order. Gives those that ran out of time beside another, to run again alone.
 */
async function runAndWrite(state, batch, allowance, toolchains, root, others, report, print) {
  const beside = batch.length > 1 || others;
  const lines = new Array(batch.length);
  const opened = new Array(batch.length);
  const retry = [];
  const ended = [];
  // Writes are one at a time, each holding the lock: the results that have ended since the last, together.
  let writing = Promise.resolve();
  const writeEnded = () => {
    writing = writing.then(async () => {
      if (!ended.length) return;
      const ready = ended.splice(0);
      const held = await takeLock(root);
      try {
        const written = await writeBatch(root, ready.map((r) => r.result), print);
        written.lines.forEach((line, k) => { lines[ready[k].at] = line; opened[ready[k].at] = written.opened[k]; });
        retry.push(...written.retry);
      } finally {
        await held.release();
      }
    });
    return writing;
  };
  await Promise.all(batch.map(async (owed, at) => {
    let result;
    try {
      const limits = limitsOf(allowance, owed.question.engine);
      result = { ...(await runQuestion(state.ctx, state.models, owed.question, owed.composed, { root, tools: toolchains.get(owed.question.engine).tools, limits })), owed };
    } catch (error) {
      result = { q: owed.question, owed, failed: error.message };
    }
    result.beside = beside;
    ended.push({ at, result });
    await writeEnded();
  }));
  await writing;
  report.ran.push(...lines.filter(Boolean));
  report.opened.push(...opened.filter(Boolean));
  return retry;
}

/**
 * Writes results (evidence.md §forma-run step 3), holding the lock, each when its question is still owed and its inputs are
 * those it ran on, and the run did not run out of time beside another, printing each run's line and any surprise it
 * opened as it is written. Gives `{ lines, opened, retry }`: each result's line and the surprise it opened, in order, and
 * those that ran out of time beside another, to run again.
 */
async function writeBatch(root, results, print) {
  const state = await stateOf(await readProject(root));
  const out = { lines: [], opened: [], retry: [] };
  for (const result of results) {
    const line = { name: result.q.name, found: result.found ?? { outcome: 'unanswered', reason: `the run failed: ${result.failed}` }, matches: result.matches, expected: Boolean(result.q.expected), duration: result.duration ?? 0, wrote: false, spent: Boolean(result.owed?.spends) };
    out.lines.push(line);
    out.opened.push(null);
    const owed = result.failed || (result.timedOut && result.beside) ? null : state.owed.find((o) => o.name === result.q.name);
    if (result.timedOut && result.beside && !result.failed) out.retry.push(result);
    if (owed?.composed && !owed.composed.cannot && sameInputs(owed.composed, result)) {
      const { wrote, opened } = await writeResult(state.ctx, state.models, { ...result, q: owed.question }, root);
      line.wrote = wrote;
      out.opened[out.opened.length - 1] = opened;
    }
    print(runLine(line));
    if (out.opened.at(-1)) print(`surprise ${out.opened.at(-1)}`);
  }
  return out;
}

/** Whether a question composes now from the inputs a run ran on (evidence.md §forma-run step 3): the same project files and generated files. */
function sameInputs(composed, result) {
  const now = [...composed.files.map((f) => `${f.path}\0${sha256(f.bytes)}`), ...Object.entries(composed.generated).map(([name, text]) => `\0${name}\0${sha256(text)}`)].sort(compare);
  const then = result.basis.files.map((f) => (f.path ? `${f.path}\0${f.sha256}` : `\0${f.generated}\0${f.sha256}`)).sort(compare);
  return now.join('\n') === then.join('\n');
}

/** evidence.md §forma-run's refusal as text, each reason in door.md §forma-answer's form, one a line. */
const refusedLines = (refused) => refused.map((r) => `${[r.file, r.entry, r.field].filter((x) => x !== null && x !== undefined).join(' ')}${r.file || r.entry || r.field ? ': ' : ''}${r.says} (${r.check})`);

/** One run's line of door.md §read-checks's text output: `<name>: <found>, <match>, <duration> ms, <written>`. */
function runLine(r) {
  const expected = !/\.(reduction-\d+|weaker-[a-z0-9-]+)$/.test(r.name);
  return `${r.name}: ${foundText(r.found)}, ${r.matches === true ? 'as expected' : !expected ? 'no expected outcome' : 'not as expected'}, ${r.duration} ms, ${r.wrote ? 'wrote' : 'wrote nothing'}${r.spent ? '' : ', spent nothing'}`;
}

// --- Running again where a machine lacks a run (evidence.md §rerun) -------------------------------------------------

/**
 * Makes sure runs/ on this machine holds a run of an open surprise and of each of its reductions on the basis its
 * file names (evidence.md §rerun), for forma give's Explain packet: one that has none is run again, composed from the files
 * as they stand, within the limits its file names, writing only its folder in runs/, spending nothing, writing no
 * evidence and opening nothing. Gives `{ ran, differ, cannot }`: the names run, each generated file composed now whose
 * SHA-256 is not the one the file's basis names, by path in runs/, and why one could not be composed. The caller holds
 * the writer's lock as a writer does (door.md §forma-give).
 */
export async function rerunForExplain(root, surpriseName0) {
  const project = await readProject(root);
  const design = await readDesign(project);
  const state = await readEvidence(project, design, { surprisesOnly: true });
  const surprise = project.surprises.get(surpriseName0);
  if (!surprise?.counts) return { ran: [], differ: [], cannot: `${surpriseName0} is no surprise this project holds` };
  const out = { ran: [], differ: [], cannot: null };
  const items = [{ name: surprise.value.question, value: surprise.value, folder: surprise.value.question, reduction: null }];
  for (const path of project.stems.get(surpriseName0)?.reductions ?? []) {
    const file = project.files.get(path);
    if (file?.counts) items.push({ name: file.value.name, value: file.value, folder: file.value.name, reduction: file });
  }
  for (const item of items) {
    const held = await readBytes(root, `runs/${item.folder}/basis.json`);
    try {
      if (held && basisDigest(JSON.parse(held.toString('utf8')).basis) === basisDigest(item.value.basis)) continue;
    } catch {
      // read as no run (evidence.md §runs)
    }
    const q = state.rebuild(surprise.where, item.reduction ? item.value.bounds : null, item.reduction ? { surprise: surpriseName0, n: item.reduction.where.number } : null);
    if (!q) { out.cannot = 'its question cannot be composed from the files as they stand: its claim, journey, model or a slot it needs is gone or counts for nothing'; continue; }
    const composed = await compose(state.ctx, state.models, q);
    if (composed.cannot) { out.cannot = composed.cannot; continue; }
    const had = new Map(item.value.basis.files.filter((f) => f.generated).map((f) => [f.generated, f.sha256]));
    for (const [name, text] of Object.entries(composed.generated)) if (had.get(name) !== sha256(text)) out.differ.push(`runs/${item.folder}/inputs/${name}`);
    const tool = await engineToolchain(q.engine);
    if (!tool.ok) { out.cannot = `${q.engine} toolchain: ${tool.why}`; continue; }
    await runQuestion(state.ctx, state.models, q, composed, { root, tools: tool.tools, limits: item.value.limits, folder: item.folder });
    out.ran.push(item.name);
  }
  out.differ = sortedBy(out.differ);
  return out;
}
