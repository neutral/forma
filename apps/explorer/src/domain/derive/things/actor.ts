// An actor or record opened (presentation.md §explorer, "Opening": actor or record).
import type { NodeOf } from '../../graph.ts';
import type { ThingOf } from '../../reading.ts';
import { checksOf } from '../checks.ts';
import type { Context } from '../context.ts';
import { decided } from '../decisions.ts';
import { passageLinks } from '../document.ts';
import { ref } from '../refs.ts';
import { beyond, kindLine } from './common.ts';

export function actorThing(ctx: Context, n: NodeOf<'boundary'>): ThingOf<'actor'> {
  const d = n.data;
  const row = `${d.holder.key}/${d.key}`;
  return {
    id: n.id,
    kind: 'actor',
    title: d.key,
    kindLabel: kindLine(ctx, n),
    from: passageLinks(ctx, d.cites),
    names: d.names,
    rowKind: d.rowKind,
    side: d.side,
    seam: d.seam,
    isolation: d.isolation,
    beyond: beyond(n),
    // On each model that has misbehaviours of it, their checks.
    models: ctx.g
      .byKind('model')
      .filter((m) => (m.data.model.misbehaviours ?? []).some((r) => r.row === row))
      .map((m) => ({ model: ref(ctx, m, m.key), checks: checksOf(ctx, n.id, m.key) })),
    decisions: decided(ctx, n),
  };
}
