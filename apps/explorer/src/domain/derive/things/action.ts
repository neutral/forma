// An action opened (presentation.md §explorer, "Opening": action).
import type { EntryOf, NodeOf } from '../../graph.ts';
import type { ThingOf } from '../../reading.ts';
import { isEntry, uniq } from '../access.ts';
import { checksOf } from '../checks.ts';
import type { Context } from '../context.ts';
import { decided } from '../decisions.ts';
import { passageLinks } from '../document.ts';
import { claimRef, nameOf, need, ref } from '../refs.ts';
import { beyond, kindLine } from './common.ts';

export function actionThing(ctx: Context, n: EntryOf<'actions'>): ThingOf<'action'> {
  const d = n.data;
  const full = `${d.holder.key}/${d.key}`;
  const named = ctx.g.into(n.id, 'names-action');
  const faults = named.filter((s): s is NodeOf<'slot'> => s.kind === 'slot' && s.data.slot === 'fault');
  return {
    id: n.id,
    kind: 'action',
    title: d.key,
    kindLabel: kindLine(ctx, n),
    from: passageLinks(ctx, d.cites),
    statement: d.sentence,
    actor: d.actor,
    guard: d.guard && d.guard !== 'none' ? d.guard : null,
    cases: d.cases.map((c) => (typeof c === 'string' ? c : c.case)),
    beyond: beyond(n),
    models: ctx.g.byKind('model').flatMap((m) => {
      const row = (m.data.model.actions ?? []).find((a) => a.action === full);
      if (!row) return [];
      const operator = `${row.operator}(${row.parameters.map((p) => p.name).join(', ')})`;
      return [{ model: ref(ctx, m, m.key), operator, checks: checksOf(ctx, n.id, m.key) }];
    }),
    // Each fault that names it, by its mechanism and the claim it is planted against.
    faults: faults.map((s) => {
      const key = `${s.data.holder?.key}/claims/${s.data.thing?.key}`;
      return { mechanism: s.data.form.mechanism || s.data.key || '', claim: claimRef(ctx, need(ctx.g.entry('claims', key), `claim ${key}`)) };
    }),
    scenarios: uniq(named)
      .filter((j) => isEntry(j, 'journeys'))
      .map((j) => ref(ctx, j, nameOf(ctx, j))),
    decisions: decided(ctx, n),
  };
}
