// A passage's restatement opened (presentation.md §explorer, "Opening": a passage's restatement): what
// cites the passage, each grey where it was met above and tagged where it goes beyond the text.
import type { EntryOf, GraphNode, NodeOf } from '../../graph.ts';
import type { ThingOf } from '../../reading.ts';
import { LABEL } from '../../words.ts';
import { isEntry } from '../access.ts';
import type { Context } from '../context.ts';
import { heading, type Passage } from '../document.ts';
import { lifecycleDrawing, lifecycleTable, pictureOf } from '../lifecycle.ts';
import { nameOf, ref } from '../refs.ts';
import { isReal } from '../revisions.ts';
import { beyond } from './common.ts';

export const restatementId = (p: Passage): string => `section:${p.id}`;

export function restatementThing(ctx: Context, p: Passage, cited: readonly GraphNode[]): ThingOf<'section'> {
  const marks = (n: GraphNode) => ({ again: ctx.order.firstMet.get(n.id) !== p, beyond: beyond(n) });
  const scenario = (j: EntryOf<'journeys'>) =>
    ref(ctx, j, nameOf(ctx, j), {
      ...marks(j),
      revisions: (ctx.rulings.on.get(j.id) ?? []).filter(isReal).flatMap((r) => ctx.rulings.number.get(r.id) ?? []),
    });
  const journeys = cited.filter((n) => isEntry(n, 'journeys'));
  return {
    id: restatementId(p),
    kind: 'section',
    title: heading(p),
    kindLabel: LABEL.restated,
    from: [],
    happens: cited.filter((n) => isEntry(n, 'actions')).map((a) => ref(ctx, a, a.data.sentence, marks(a))),
    states: cited
      .filter((n) => isEntry(n, 'lifecycles'))
      .map((l) => {
        const picture = pictureOf(ctx, l);
        return { ref: ref(ctx, l, l.name, marks(l)), drawing: lifecycleDrawing(l, picture, null), table: lifecycleTable(picture) };
      }),
    should: journeys.filter((j) => j.data.polarity !== 'must not').map(scenario),
    mustNot: journeys.filter((j) => j.data.polarity === 'must not').map(scenario),
    actors: cited
      .filter((n): n is NodeOf<'boundary'> => n.kind === 'boundary')
      .map((r) => ({ ref: ref(ctx, r, r.data.names, marks(r)), side: r.data.side, rowKind: r.data.rowKind })),
  };
}
