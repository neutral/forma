// A thing's checks (presentation.md §explorer, "Checks"): each question with its evidence. Those asked now,
// run or not, then those not asked now that ran on an earlier model, which never carry a tick.
import type { NodeOf } from '../graph.ts';
import type { Check, Checks } from '../reading.ts';
import { LABEL, QUESTION_KIND, say } from '../words.ts';
import { uniq } from './access.ts';
import type { Context } from './context.ts';
import { when } from './text.ts';

type Question = NodeOf<'question'>;

const RANK = Object.keys(QUESTION_KIND);
const byRank = (a: Question, b: Question) => RANK.indexOf(a.data.kind) - RANK.indexOf(b.data.kind);

export const questionsOf = (ctx: Context, id: string): Question[] =>
  uniq(ctx.g.into(id, 'examines')).filter((q): q is Question => q.kind === 'question');

export const evidenceOf = (ctx: Context, q: Question): NodeOf<'evidence'> | undefined =>
  ctx.g.find('evidence', q.key);

/** Whether a question is asked now: one kept from an earlier model is not. */
export const askedNow = (q: Question): boolean => q.data.asked !== false;

/** The checks on a thing, on one model or on all. */
export function checksOf(ctx: Context, id: string, model?: string): Checks {
  const qs = questionsOf(ctx, id).filter((q) => model === undefined || q.data.model === model);
  const ran = (q: Question) => Boolean(evidenceOf(ctx, q)?.data.found);
  return {
    now: qs.filter(askedNow).sort(byRank).map((q) => check(ctx, q, false)),
    earlier: qs.filter((q) => !askedNow(q) && ran(q)).sort(byRank).map((q) => check(ctx, q, true)),
  };
}

function check(ctx: Context, q: Question, earlier: boolean): Check {
  const d = evidenceOf(ctx, q)?.data;
  const kind = q.data.kind;
  const found = d?.found?.outcome;
  const state = !found ? 'none' : found === 'unanswered' ? 'unanswered' : d?.matches === false ? 'no' : 'yes';
  const form = slotOf(ctx, q)?.data.form;
  const says = kind === 'fault' ? form?.mechanism : kind === 'witness' || kind === 'misbehaviour' ? form?.meaning : undefined;
  const expected = q.data.expected?.outcome;
  const result =
    state === 'none'
      ? LABEL.notRun
      : state === 'unanswered'
        ? `${LABEL.didNotFinish}${d?.found?.reason ? `: ${d.found.reason}` : ''}`
        : state === 'yes'
          ? kind === 'fault'
            ? LABEL.caught
            : String(found)
          : `${found}${expected ? `, ${LABEL.expected} ${expected}` : ''}`;
  const details = [measures(d?.measures), d?.rendered?.search ?? '', d?.established ? `${LABEL.run} ${when(d.established)}` : '']
    .filter(Boolean)
    .join(' · ');
  const stale = !earlier && found && d?.current === false ? `${LABEL.notCurrent}: ${(d.reasons ?? []).join('; ')}` : null;
  const lines = d?.rendered?.lines ?? [];
  return {
    mark: earlier ? 'earlier' : state,
    what: say(QUESTION_KIND, kind),
    says: says || null,
    result,
    details,
    flags: (d?.flags ?? []).map((f) => (typeof f === 'string' ? f : (f.flag ?? JSON.stringify(f)))),
    stale,
    path: lines.length ? lines.map((l) => l.replace(/^\d+\.\s*/, '')) : null,
    question: q.key,
  };
}

/** The slot a question's `Mechanism` or `Meaning` is read from. */
function slotOf(ctx: Context, q: Question): NodeOf<'slot'> | undefined {
  const read = ctx.g
    .outOf(q.id, 'reads')
    .find((s): s is NodeOf<'slot'> => s.kind === 'slot' && ['fault', 'witness', 'misbehaviour'].includes(s.data.slot));
  return read ?? ctx.slotsByStem.get(q.key.replace(/\.[0-9a-f]{12}$/, ''));
}

/** An engine's own measures: duration, states searched, and the rest by name. */
function measures(m: Record<string, unknown> | null | undefined): string {
  return Object.entries(m ?? {})
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => {
      if (k === 'duration') return Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)} s` : `${String(v)} ms`;
      if (k === 'states') return `${Number(v).toLocaleString('en')} ${LABEL.states}`;
      return `${k} ${String(v)}`;
    })
    .join(' · ');
}
