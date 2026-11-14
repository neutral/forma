// A model opened (presentation.md §explorer, "Opening": model).
import type { NodeOf } from '../../graph.ts';
import type { ThingOf } from '../../reading.ts';
import { ENGINE, JOURNEY_RULE, LABEL, say } from '../../words.ts';
import { uniq } from '../access.ts';
import { askedNow, evidenceOf } from '../checks.ts';
import type { Context } from '../context.ts';
import { nameOf, need, ref, rulingRef, rulingTitle, rulingDetail } from '../refs.ts';
import { itemWait } from '../standing.ts';

type Model = NodeOf<'model'>;

export function modelThing(ctx: Context, n: Model): ThingOf<'model'> {
  const d = n.data;
  const mm = d.model;
  const misbehaviours = mm.misbehaviours ?? [];
  const bounds = mm.bounds ?? [];
  return {
    id: n.id,
    kind: 'model',
    title: n.key,
    kindLabel: LABEL.model,
    from: [],
    parts: mm.parts,
    name: mm.name ?? null,
    engine: say(ENGINE, d.engine),
    // A lifecycle model has no bounds: phases only, guards unevaluated.
    bounds: bounds.length
      ? bounds.map((b) => ({ bound: b.bound.replace(/^constant /, ''), value: b.value, meaning: b.meaning }))
      : d.lifecycle
        ? null
        : [],
    world: uniq(misbehaviours.map((r) => r.row)).map((row) => {
      const b = ctx.g.find('boundary', row.replace('/', '/boundary/'));
      return { row: b ? ref(ctx, b, nameOf(ctx, b)) : row, items: misbehaviours.filter((r) => r.row === row).map((r) => r.item) };
    }),
    checks: tally(ctx, n),
    failing: ((ctx.mode.reading.models ?? []).find((x) => x.model === n.key)?.fails ?? []).map((f) => ({
      rule: say(JOURNEY_RULE, f.rule),
      found: f.found,
      waits: (f.items ?? []).map((i) => itemWait(ctx, i)),
    })),
    // The revisions, and other rulings, whose repairs changed it.
    changedBy: ctx.g
      .byKind('mechanism')
      .filter((m) => m.data.model === n.key)
      .map((m) => {
        const r = need(ctx.rulings.all.find((y) => y.data.name === m.data.ruling), `ruling ${m.data.ruling}`);
        return rulingRef(ctx, r, rulingTitle(ctx, r), true, rulingDetail(r));
      }),
  };
}

/** Its checks asked now, counted by outcome: `58 asked · 57 as expected · 1 did not finish`. */
function tally(ctx: Context, n: Model): string | null {
  const asked = ctx.g.byKind('question').filter((q) => q.data.model === n.key && askedNow(q));
  if (!asked.length) return null;
  const counts = new Map<string, number>();
  for (const q of asked) {
    const ev = evidenceOf(ctx, q)?.data;
    const outcome = !ev?.found
      ? LABEL.notRun
      : ev.found.outcome === 'unanswered'
        ? LABEL.didNotFinish
        : ev.matches === false
          ? LABEL.notAsExpected
          : ev.current === false
            ? LABEL.asExpectedNotCurrent
            : LABEL.asExpected;
    counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
  }
  return [`${asked.length} ${LABEL.asked}`, ...[...counts].map(([k, v]) => `${v} ${k}`)].join(' · ');
}
