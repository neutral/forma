// A lifecycle opened (presentation.md §explorer, "Opening": lifecycle).
import type { EntryOf } from '../../graph.ts';
import type { ThingOf } from '../../reading.ts';
import { uniq } from '../access.ts';
import type { Context } from '../context.ts';
import { decided } from '../decisions.ts';
import { passageLinks } from '../document.ts';
import { lifecycleDrawing, lifecycleTable, pictureOf } from '../lifecycle.ts';
import { nameOf, ref } from '../refs.ts';
import { beyond, kindLine } from './common.ts';

export function lifecycleThing(ctx: Context, n: EntryOf<'lifecycles'>): ThingOf<'lifecycle'> {
  const full = `${n.data.holder.key}/${n.data.key}`;
  const picture = pictureOf(ctx, n);
  return {
    id: n.id,
    kind: 'lifecycle',
    title: nameOf(ctx, n),
    kindLabel: kindLine(ctx, n),
    from: passageLinks(ctx, n.data.cites),
    beyond: beyond(n),
    drawing: lifecycleDrawing(n, picture, null),
    table: lifecycleTable(picture),
    expressions: ctx.g.byKind('model').flatMap((m) =>
      (m.data.model.phases ?? []).filter((p) => p.lifecycle === full).map((p) => ({ model: ref(ctx, m, m.key), expression: p.expression })),
    ),
    // The scenarios, and the open questions' alternatives, that walk it: each once.
    scenarios: uniq(ctx.g.into(n.id, 'steps-through')).map((j) => ref(ctx, j, nameOf(ctx, j))),
    decisions: decided(ctx, n),
  };
}
