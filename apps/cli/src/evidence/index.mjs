// What the evidence says as the project stands (evidence.md, models.md §slot-currency, account.md §journey-rules): every
// question asked now with its evidence's currency; what is owed a run, with account.md §items's `run:`
// reason; each surprise with its state; each slot's state; and the journey and span rules. Computed
// at every read and stored nowhere (account.md §what-it-is); `forma run` and the account read it.

import { basisDigest, compare } from '../record/json.mjs';
import { ruledSurprises } from '../record/decisions.mjs';
import { surpriseName, surprisePath } from '../record/evidence.mjs';
import { compose } from './compose.mjs';
import { journeyRules, spanRules } from './conformance.mjs';
import { evidenceContext } from './context.mjs';
import { evidenceCurrency, modelStates, slotStates, writtenLater } from './currency.mjs';
import { byName, claimQuestions, modelQuestions, questionAt, reductionAt, reductionPlan, weakerForms, weakestFailing } from './questions.mjs';

/** Limits larger than others (evidence.md §limits): either is larger. */
const larger = (a, b) => a.seconds > b.seconds || (a.megabytes ?? 0) > (b.megabytes ?? 0);

/** The limits of `engine` in force (evidence.md §limits). */
const limitsNow = (ctx, engine) => (engine === 'lifecycle' ? { seconds: ctx.allowance.engines.lifecycle.seconds } : ctx.allowance.engines[engine]);

/** One question asked now with its evidence and that evidence's currency (evidence.md §currency). */
async function recordOf(ctx, models, q) {
  const composed = await compose(ctx, models, q);
  const file = ctx.project.files.get(q.path);
  const evidence = file?.counts ? file.value : null;
  const currency = evidence ? evidenceCurrency(ctx, evidence, composed) : { current: false, reasons: ['it has no evidence'], versionsOnly: false };
  return { question: q, composed, evidence, current: currency.current, reasons: currency.reasons, versionsOnly: currency.versionsOnly, later: writtenLater(evidence) };
}

/** Whether a ruling names a surprise (decisions.md §rulings). */
const ruledName = (project, name) => project.decisions.some((d) => d.kind === 'rule' && ruledSurprises(d).includes(name));

/**
 * The question of evidence kept for a question not asked now (evidence.md §questions, §currency), from its file's place: its name, kind,
 * model and engine, and what it examines, `serves` by entry name, with its claim or journey where it has one.
 */
export function keptQuestion(ctx, file) {
  const where = file.where;
  const q = { name: file.name, path: file.path, kind: file.value.kind, model: where.model, engine: file.value.basis.engine.name, expected: file.value.expected, serves: null, kept: true };
  if (where.thing) {
    const entry = `${where.holder.key}/${where.thing.kind}/${where.thing.key}`;
    Object.assign(q, { holder: where.holder, thingKind: where.thing.kind, key: where.thing.key, serves: entry });
    if (where.thing.kind === 'claims') q.claim = ctx.claims.find((c) => c.entry === entry) ?? { entry };
    else q.journey = ctx.journeys.get(entry) ?? { entry };
  } else if (where.where === 'action') Object.assign(q, { part: where.part, action: where.question.action, serves: `${where.part}/actions/${where.question.action}` });
  else if (where.where === 'world') Object.assign(q, { part: where.part, row: where.row, item: where.question.item, serves: `${where.part}/boundary/${where.row}` });
  return q;
}

/**
 * Why a surprise goes back to the agent first (evidence.md §sent-back), read from its file, the strikes in force and the
 * evidence as they stand: each reason, naming the step; none when it does not.
 */
function sentBack(ctx, records, surprise) {
  const value = surprise.value;
  const where = surprise.where;
  const reasons = [];
  const states = value.trace?.states ?? [];
  const steps = states.map((s, at) => ({ at, rows: s.rows ?? [] })).slice(1);
  if (value.trace?.loop && typeof value.trace.loop === 'object') steps.push({ at: 'loop', rows: value.trace.loop.rows });
  const lifecycleModel = where.model.startsWith('lifecycles-');
  if (lifecycleModel && ['base', 'lifecycle-path'].includes(where.question.kind)) {
    const part = where.model.slice('lifecycles-'.length);
    for (const { at, rows } of steps) {
      for (const row of rows) {
        if (!row.action) continue;
        const [owner, key] = row.action.split('/');
        const content = (value.rendered ?? []).find((r) => r.entry === `${owner}/actions/${key}`)?.content ?? ctx.textNow(`${owner}/actions/${key}`) ?? '';
        const guard = /^Guard: (.*)$/m.exec(content)?.[1] ?? 'none';
        const column = [...ctx.lifecycles.values()].some((l) => (l.holder?.key ?? l.entry.split('/')[0]) === part && l.actions.includes(key));
        if (guard !== 'none' && guard !== '' && column) reasons.push(`its trace takes a guarded transition at step ${at}: ${row.action}${row.case && row.case !== '-' ? ` as ${row.case}` : ''} needs ${guard}, which the lifecycle engine does not evaluate`);
      }
    }
  }
  for (const { at, rows } of steps) {
    // A misbehaviour is taken at a step no Actions row takes (presentation.md §rendering).
    if (rows.some((row) => row.action)) continue;
    for (const row of rows) {
      if (!row.misbehaviour) continue;
      if (ctx.strikes.has(`strike:${row.misbehaviour}`)) {
        const [part, key, item] = row.misbehaviour.split('/');
        reasons.push(`its trace takes ${item} of ${part}/${key} at step ${at}, a misbehaviour struck now`);
      }
    }
  }
  if (where.question.kind === 'path' && where.thing) {
    const start = value.question.replace(/\/path(-to-\d+)?\.([0-9a-f]{12})$/, '/start.$2');
    const record = records.get(start);
    if (record?.current && record.evidence?.found.outcome === 'not reached') reasons.push(`its journey's start question, ${start}, has current evidence that found it not reached on this model at these bounds, so the path had nowhere to begin`);
  }
  if (where.question.kind === 'lifecycle-path' && value.found.outcome === 'refused' && value.found.step === 0) reasons.push("it is refused at step 0: the lifecycles cannot hold its journey's start");
  return reasons;
}

/**
 * The evidence as the project stands (evidence.md, models.md §slot-currency, account.md §journey-rules), from `project`, as
 * src/record/project.mjs reads it, and `design`, as src/design/index.mjs's readDesign gives it. Gives:
 * - `questions`: every question asked now, each `{ question, composed, evidence, current, reasons, versionsOnly, later }`;
 * - `kept`: the evidence of each question not asked now, in the same form, `current` false and `composed` null, its
 *   `question` read from its file's place (`kept: true`), so it is shown not current and owed nothing (evidence.md §questions, §currency);
 * - `owed`: what is owed a run, in byte order of names, each `{ name, item, why, question, composed, spends, later }`,
 *   `why` account.md §items's reason, `none`, `not-current`, `larger-limits` or `lost-surprise`, or `reduction` or `weaker`;
 * - `newer`: each question asked now that is not run because its open surprise names a later Forma, `{ name, later }` (evidence.md §versions);
 * - `unanswered`: each question whose current evidence is unanswered at the limits its engine has now;
 * - `surprises`: each surprise file, `{ name, path, question, model, value, open, ruledBy, explained, explanation,
 *   reductions, weaker, weakest, sentBack, later }`;
 * - `slots` (models.md §slot-currency) and `models` (models.md §lifecycle-model, §parts-change) as currency.mjs gives them;
 * - `rules` and `spans` (account.md §journey-rules), and `unchecked`, the journeys a lifecycle model has no question for (evidence.md §lifecycle-journeys);
 * - `ctx`, and `rebuild(where, bounds, reduction)`, a question rebuilt from its place (account.md §commands).
 */
export async function readEvidence(project, design) {
  const ctx = evidenceContext(project, design);
  const models = await modelStates(ctx);
  const slots = await slotStates(ctx, models);
  const records = new Map();
  const { questions: first, unchecked } = modelQuestions(ctx, models, slots);
  for (const q of first) records.set(q.name, await recordOf(ctx, models, q));
  // A claim's questions are asked only while the model meets the journey rules but `explored` (evidence.md §questions).
  const before = journeyRules(ctx, models, records, slots, unchecked);
  for (const q of claimQuestions(ctx, models, slots, (key) => before.get(key)?.gate ?? false)) records.set(q.name, await recordOf(ctx, models, q));
  const rules = journeyRules(ctx, models, records, slots, unchecked);
  const spans = spanRules(ctx, models, records);
  // Evidence of a question not asked now is kept and shown, not current, and owed nothing (evidence.md §questions, §currency).
  const kept = [];
  for (const file of project.evidence.values()) {
    if (!file.counts || records.has(file.name)) continue;
    kept.push({ question: keptQuestion(ctx, file), composed: null, evidence: file.value, current: false, reasons: ['its question is not asked now'], versionsOnly: false, later: writtenLater(file.value) });
  }

  // Surprises (evidence.md §surprises).
  const surprises = [];
  for (const surprise of project.surprises.values()) {
    if (!surprise.counts) continue;
    const stem = project.stems.get(surprise.name);
    const explanation = stem?.explanation ? project.files.get(stem.explanation) : null;
    const explained = Boolean(explanation?.counts && stem.explained);
    const plan = surprise.open ? reductionPlan(ctx, models, slots, surprise) : { reducible: false, ran: [], kept: [], next: null };
    const weaker = surprise.open ? weakerForms(ctx, models, slots, surprise) : [];
    surprises.push({
      name: surprise.name,
      path: surprise.path,
      question: surprise.value.question,
      model: surprise.where.model,
      where: surprise.where,
      value: surprise.value,
      open: surprise.open,
      ruledBy: surprise.ruledBy,
      explained,
      explanation: explained ? { path: stem.explanation, ...stem.explained } : null,
      reductions: { reducible: plan.reducible, ran: plan.ran, kept: plan.kept, next: plan.next?.name ?? null, left: Boolean(plan.next) },
      weaker: weaker.map((w) => ({ key: w.key, path: w.path, found: w.evidence?.found ?? null, ran: Boolean(w.evidence) })),
      weakest: weakestFailing(weaker),
      sentBack: surprise.open ? sentBack(ctx, records, surprise) : [],
      later: writtenLater(surprise.value),
      plan,
      forms: weaker,
    });
  }
  const openOn = new Set(surprises.filter((s) => s.open).map((s) => s.question));
  // A question asked now whose open surprise a later Forma wrote is not run, and forma run names it (evidence.md §versions).
  const newer = [];
  for (const s of surprises) if (s.open && s.later && records.has(s.question) && !newer.some((n) => n.name === s.question)) newer.push({ name: s.question, later: s.later });

  // What is owed a run (evidence.md §forma-run; account.md §items).
  const owed = [];
  const unanswered = [];
  for (const record of records.values()) {
    const q = record.question;
    if (openOn.has(q.name)) continue;
    const evidence = record.evidence;
    let why = null;
    let spends = true;
    if (!evidence) why = 'none';
    else if (!record.current) { why = 'not-current'; spends = !record.versionsOnly; }
    else if (evidence.found.outcome === 'unanswered') {
      if (larger(limitsNow(ctx, q.engine), evidence.limits)) why = 'larger-limits';
      else unanswered.push({ question: q.name, found: evidence.found, limits: evidence.limits });
    } else if (evidence.matches === false) {
      const name = surpriseName(q.name, basisDigest(evidence.basis));
      if (!project.files.get(surprisePath(name))?.counts && !ruledName(project, name)) why = 'lost-surprise';
    }
    if (why) owed.push({ name: q.name, item: `run:${q.name}`, why, question: q, composed: record.composed, spends, later: record.later });
  }
  for (const surprise of surprises.filter((s) => s.open)) {
    if (surprise.plan.next) owed.push({ name: surprise.plan.next.name, item: `run:${surprise.name}/reduction`, why: 'reduction', question: surprise.plan.next, composed: await compose(ctx, models, surprise.plan.next), spends: true, later: surprise.later });
    for (const form of surprise.forms) {
      if (form.evidence || !form.question) continue;
      owed.push({ name: form.question.name, item: `run:${surprise.name}/weaker-${form.key}`, why: 'weaker', question: form.question, composed: await compose(ctx, models, form.question), spends: true, later: surprise.later });
    }
  }
  for (const s of surprises) { delete s.plan; delete s.forms; }
  return {
    ctx,
    models,
    slots,
    questions: byName([...records.values()].map((r) => r.question)).map((q) => records.get(q.name)),
    kept: kept.sort((a, b) => compare(a.question.name, b.question.name)),
    newer: newer.sort((a, b) => compare(a.name, b.name)),
    owed: owed.sort((a, b) => compare(a.name, b.name)),
    unanswered,
    surprises,
    rules,
    spans,
    unchecked,
    /** A question rebuilt from its place (evidence.md §reductions, §rerun), at a reduction's bounds when `reduction` is given. */
    rebuild: (where, bounds = null, reduction = null) => (reduction ? reductionAt(ctx, models, slots, where, bounds, reduction) : questionAt(ctx, models, slots, where)),
  };
}
