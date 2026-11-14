// The journey and span rules (account.md §journey-rules): a model's claims count only once the model meets them,
// and a claim's questions are asked only while it meets them but `explored` (evidence.md §questions). Each
// rule a model fails is named once, for each journey, part, row, misbehaviour or flag it fails on,
// with what was found and the questions or slots that supply it.

import { covers, MENU } from '../record/models.mjs';
import { questionName } from '../record/evidence.mjs';
import { ACTING } from '../record/pages.mjs';
import { unpickedOnly } from './questions.mjs';

/** What a question's current evidence found, as the account names it (account.md §journey-rules): its outcome, or `none`. */
function foundOf(record) {
  if (!record) return 'none';
  if (!record.evidence) return 'none';
  if (!record.current) return 'none, its evidence not current';
  const found = record.evidence.found;
  // A path's `not reached` gives its reason where it has one, as unanswered does (evidence.md §outcomes, §keys).
  return found.outcome === 'violation' ? `violation of ${found.property}` : found.outcome === 'refused' ? `refused at step ${found.step}` : found.reason ? `${found.outcome}: ${found.reason}` : found.outcome;
}

/** Whether a question's current evidence matched its expected outcome (account.md §journey-rules). */
const matched = (record) => Boolean(record?.current && record.evidence?.matches === true);

/**
 * The journey rules on each model (account.md §journey-rules): by model key, `{ meets, gate, failures }`, `meets` every rule held,
 * `gate` every rule but `explored` held (evidence.md §questions), and `failures` each `{ rule, on, found, questions, slots }`.
 * `records` are the questions asked now, by name, each `{ question, evidence, current }`; `unchecked` the journeys
 * a lifecycle model has no question for while their stepping meets an open cell (evidence.md §lifecycle-journeys).
 */
export function journeyRules(ctx, models, records, slots, unchecked = []) {
  const out = new Map();
  const exempt = unpickedOnly(ctx);
  const get = (name) => records.get(name) ?? null;
  for (const state of models.values()) {
    if (!state.exists) continue;
    const failures = [];
    const fail = (rule, on, record, more = {}) => failures.push({ rule, on, found: more.found ?? foundOf(record), questions: more.questions ?? (record ? [record.question.name] : []), slots: more.slots ?? [] });
    if (state.engine === 'lifecycle') {
      const part = state.part;
      const journeys = [...ctx.journeys.values()].filter((j) => j.confirmed && j.parts.length === 1 && j.parts[0] === part);
      const pathOf = (journey) => [...records.values()].find((r) => r.question.kind === 'lifecycle-path' && r.question.model === state.key && r.question.journey?.entry === journey.entry) ?? null;
      for (const journey of journeys) {
        const stuck = unchecked.find((u) => u.model === state.key && u.journey === journey.entry);
        if (stuck) { fail('journeys', journey.entry, null, { found: `none: ${stuck.why}`, questions: [] }); continue; }
        const record = pathOf(journey);
        if (!matched(record)) fail('journeys', journey.entry, record);
      }
      const should = journeys.filter((j) => j.polarity === 'should happen');
      if (!should.some((j) => matched(pathOf(j)))) fail('progress', part, null, { found: should.length ? should.map((j) => `${j.entry}: ${foundOf(pathOf(j))}`).join('; ') : 'none: no confirmed should-happen journey of the part', questions: should.map((j) => pathOf(j)?.question.name).filter(Boolean) });
      const gate = failures.length === 0;
      // explored: no current base evidence on it holds a flag of the lifecycle engine's own (evidence.md §flags).
      for (const record of records.values()) {
        if (record.question.model !== state.key || record.question.kind !== 'base' || !record.current) continue;
        for (const flag of record.evidence.flags ?? []) fail('explored', record.question.claim.entry, record, { found: flag });
      }
      out.set(state.key, { meets: failures.length === 0, gate, failures });
      continue;
    }
    if (!state.usable) {
      fail('rows', state.key, null, { found: state.owed ? state.reasons.map((r) => r.says).join('; ') : `a file of the model counts for nothing: ${state.discounted.join(', ')}`, questions: [] });
      out.set(state.key, { meets: false, gate: false, failures });
      continue;
    }
    const model = state.model;
    const { digest } = ctx.project.bounds(model);
    const nameOf = (fields) => questionName({ model: model.key, digest, ...fields });
    const journeys = [...ctx.journeys.values()].filter((j) => j.confirmed && covers(model, j.parts));
    const scheduleOf = (journey) => slots.positions.find((p) => p.model === model.key && p.kind === 'schedule' && p.serves === journey.entry) ?? null;
    const pathName = (journey) => nameOf({ kind: 'path', holder: journey.holder, thingKind: 'journeys', key: journey.key, polarity: journey.polarity, step: journey.refusedStep - 1 });
    for (const journey of journeys) {
      const asked = [pathName(journey)];
      if (journey.polarity === 'must not') asked.push(nameOf({ kind: 'refusal', holder: journey.holder, thingKind: 'journeys', key: journey.key, step: journey.refusedStep }));
      if (journey.start?.length) asked.push(nameOf({ kind: 'start', holder: journey.holder, thingKind: 'journeys', key: journey.key }));
      for (const name of asked) {
        const record = get(name);
        if (!matched(record)) {
          const schedule = scheduleOf(journey);
          fail('journeys', journey.entry, record, { questions: [name], slots: schedule && schedule.state !== 'filled' ? [schedule.path] : [] });
        }
      }
    }
    for (const part of model.parts) {
      const should = journeys.filter((j) => j.polarity === 'should happen' && j.parts.includes(part));
      if (!should.some((j) => matched(get(pathName(j))))) fail('progress', part, null, { found: should.length ? should.map((j) => `${j.entry}: ${foundOf(get(pathName(j)))}`).join('; ') : 'none: no confirmed should-happen journey whose parts include the part', questions: should.map(pathName) });
    }
    for (const row of model.actions) {
      const [part, action] = row.action.split('/');
      // An action only an alternative a pick in force did not pick takes is owed no enabled question (evidence.md §questions).
      if (exempt.has(`${part}/actions/${action}`)) continue;
      const name = nameOf({ kind: 'enabled', part, action });
      if (!matched(get(name))) fail('enabled', row.action, get(name), { questions: [name] });
    }
    for (const row of model.misbehaviours) {
      if (ctx.strikes.has(`strike:${row.row}/${row.item}`)) continue;
      const [part, key] = row.row.split('/');
      const name = nameOf({ kind: 'enabled', part, row: key, item: row.item });
      if (!matched(get(name))) fail('enabled', `${row.row}/${row.item}`, get(name), { questions: [name] });
    }
    for (const part of model.parts) {
      for (const row of ctx.restatement.parts.get(part)?.boundary ?? []) {
        if (row.side !== 'world' || !ACTING.includes(row.rowKind)) continue;
        for (const item of MENU) {
          if (ctx.strikes.has(`strike:${part}/${row.key}/${item}`)) continue;
          const name = nameOf({ kind: 'misbehaviour', part, row: row.key, item });
          if (!matched(get(name))) {
            const slot = slots.positions.find((p) => p.model === model.key && p.kind === 'misbehaviour' && p.path === `models/${model.key}/world/${part}/${row.key}/${item}`);
            fail('misbehaviours', `${part}/${row.key}/${item}`, get(name), { questions: [name], slots: slot && slot.state !== 'filled' ? [slot.path] : [] });
          }
        }
      }
    }
    if (model.phases.length) {
      const name = nameOf({ kind: 'phases' });
      if (!matched(get(name))) fail('phases', model.key, get(name), { questions: [name] });
    }
    if (model.engine === 'alloy') {
      const name = nameOf({ kind: 'facts' });
      if (!matched(get(name))) fail('facts', model.key, get(name), { questions: [name] });
    }
    out.set(state.key, { meets: failures.length === 0, gate: failures.length === 0, failures });
  }
  return out;
}

/**
 * The span rules (account.md §journey-rules): for each span of two parts (forms.md §surface), `{ span, parts, owed, why, carried,
 * examined }`. A span is owed a claim or journey of both its parts examined on a model covering both, or the
 * developer's carry of it: a claim is examined there when its base evidence is current and answered; a journey when its
 * path evidence is, and for a must-not journey its refusal evidence too. `why` is `no-entry`, `no-model` or
 * `unexamined` while it is owed.
 */
export function spanRules(ctx, models, records) {
  const out = [];
  const answered = (record) => Boolean(record?.current && record.evidence && record.evidence.found.outcome !== 'unanswered');
  for (const span of ctx.restatement.spanPairs) {
    const [a, b] = span.parts;
    const both = (parts) => parts.includes(a) && parts.includes(b);
    const carried = Boolean(ctx.force.carried(`span:${span.name}`)?.carried);
    const claims = ctx.claims.filter((c) => both(c.parts));
    const journeys = [...ctx.journeys.values()].filter((j) => both(j.parts));
    const covering = [...models.values()].filter((m) => m.exists && m.engine !== 'lifecycle' && covers(m.model, [a, b]));
    const examined = [];
    for (const state of covering) {
      for (const record of records.values()) {
        const q = record.question;
        if (q.model !== state.key || !answered(record)) continue;
        if (q.kind === 'base' && claims.some((c) => c.entry === q.claim.entry)) examined.push(q.name);
        if (q.kind === 'path' && journeys.some((j) => j.entry === q.journey.entry)) {
          if (q.journey.polarity !== 'must not') examined.push(q.name);
          else {
            const refusal = [...records.values()].find((r) => r.question.kind === 'refusal' && r.question.model === state.key && r.question.journey.entry === q.journey.entry);
            if (answered(refusal)) examined.push(q.name, refusal.question.name);
          }
        }
      }
    }
    const why = examined.length ? null : !claims.length && !journeys.length ? 'no-entry' : !covering.length ? 'no-model' : 'unexamined';
    out.push({ span: span.name, parts: span.parts, owed: !carried && why !== null, why: carried ? null : why, carried, examined });
  }
  return out;
}
