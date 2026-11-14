// An open question opened (presentation.md §explorer, "Opening": open question).
import type { EntryOf } from '../../graph.ts';
import type { ThingOf } from '../../reading.ts';
import type { Context } from '../context.ts';
import { decided, picked } from '../decisions.ts';
import { passageLinks } from '../document.ts';
import { nameOf } from '../refs.ts';
import { expectedEnd, kindLine, stepsOf } from './common.ts';

export function questionThing(ctx: Context, n: EntryOf<'choices'>): ThingOf<'question'> {
  const d = n.data;
  const pick = picked(ctx, n);
  return {
    id: n.id,
    kind: 'question',
    title: nameOf(ctx, n),
    kindLabel: kindLine(ctx, n),
    from: passageLinks(ctx, d.cites),
    question: d.question,
    alternatives: (['a', 'b'] as const).flatMap((key) => {
      const a = d.alternatives[key];
      if (!a) return [];
      return [
        {
          key,
          picked: pick === key,
          polarity: a.polarity === 'must not' ? ('must not' as const) : ('should happen' as const),
          steps: stepsOf(ctx, a, d.holder.key),
          expectedEnd: expectedEnd(a.expectedEnd),
        },
      ];
    }),
    recommendation: d.recommendation ? { pick: d.recommendation.pick, reason: d.recommendation.reason } : null,
    decisions: decided(ctx, n),
  };
}
