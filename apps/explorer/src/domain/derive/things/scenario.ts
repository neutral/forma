// A scenario opened (presentation.md §explorer, "Opening": scenario).
import type { EntryOf } from '../../graph.ts';
import type { ThingOf } from '../../reading.ts';
import { LABEL } from '../../words.ts';
import { uniq } from '../access.ts';
import { checksOf, questionsOf } from '../checks.ts';
import type { Context } from '../context.ts';
import { decided } from '../decisions.ts';
import { passageLinks } from '../document.ts';
import { lifecycleDrawing, pictureOf } from '../lifecycle.ts';
import { holderKey, modelRef, nameOf } from '../refs.ts';
import { beyond, expectedEnd, kindLine, rulingsOn, stepsOf } from './common.ts';

export function scenarioThing(ctx: Context, n: EntryOf<'journeys'>): ThingOf<'scenario'> {
  const d = n.data;
  const walk = d.walk ?? null;
  // Each lifecycle it moves, drawn with its path lit.
  const moved = walk ? uniq([...walk.moves.map((m) => m.lifecycle), ...walk.reached.map((r) => r.lifecycle)]) : [];
  return {
    id: n.id,
    kind: 'scenario',
    title: nameOf(ctx, n),
    kindLabel: kindLine(ctx, n),
    from: passageLinks(ctx, d.cites),
    polarity: d.polarity === 'must not' ? 'must not' : 'should happen',
    beyond: beyond(n),
    steps: stepsOf(ctx, d, holderKey(n)),
    expectedEnd: expectedEnd(d.expectedEnd),
    walk: walk
      ? `${walk.refusedAt ? `${LABEL.refusedAtStep} ${walk.refusedAt}` : `${walk.admitted ?? ''} ${LABEL.stepsAdmitted}`}${
          walk.reached.length ? ` · ${walk.reached.map((r) => r.phase).join(' → ')}` : ''
        }`
      : null,
    drawings: moved.flatMap((key) => {
      const lc = ctx.g.entry('lifecycles', key);
      return lc ? [lifecycleDrawing(lc, pictureOf(ctx, lc), walk)] : [];
    }),
    models: uniq(questionsOf(ctx, n.id).map((q) => q.data.model)).map((m) => ({ model: modelRef(ctx, m), checks: checksOf(ctx, n.id, m) })),
    rulings: rulingsOn(ctx, n),
    decisions: decided(ctx, n),
  };
}
