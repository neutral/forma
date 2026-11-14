// The decisions on a thing (presentation.md §explorer, "Words": decisions and their states): those in force,
// and the earlier ones.
import type { GraphNode, NodeOf } from '../graph.ts';
import type { Decision, Decisions } from '../reading.ts';
import { DECISION, DECISION_STATE, LABEL, say } from '../words.ts';
import { uniq } from './access.ts';
import type { Context } from './context.ts';
import { when } from './text.ts';

type DecisionNode = NodeOf<'decision'>;

const stateOf = (d: DecisionNode): string => d.data.state?.state ?? 'in force';
const inForce = (d: DecisionNode): boolean => stateOf(d) === 'in force';

/** The decisions on a node and on the units that pin it, oldest first. */
function decisionsOn(ctx: Context, n: GraphNode): DecisionNode[] {
  const ids = [n.id, ...ctx.g.into(n.id, 'pins').filter((u) => u.kind === 'unit').map((u) => u.id)];
  return uniq(ids.flatMap((id) => ctx.g.into(id, 'decides')))
    .filter((d): d is DecisionNode => d.kind === 'decision')
    .sort((a, b) => String(a.data.at).localeCompare(String(b.data.at)));
}

/** A decision in the page's words; its choice where that says more than its kind. */
export function decisionOf(d: DecisionNode, withWords = true): Decision {
  const kind = d.data.kind;
  const c = d.data.rows.Choice ?? d.data.rows.Verdict ?? '';
  const choice = c && c !== kind && !(kind === 'carry' && c === 'carry') ? (c === 'withdraw' ? LABEL.withdrawn : c) : null;
  return {
    kind: say(DECISION, kind),
    choice,
    by: d.data.by ?? '',
    at: when(d.data.at),
    state: inForce(d) ? null : say(DECISION_STATE, stateOf(d)),
    words: withWords ? d.data.words || null : null,
  };
}

/** The alternative an open question's pick in force chose, if any. */
export function picked(ctx: Context, n: GraphNode): string | null {
  const pick = decisionsOn(ctx, n).filter((d) => d.data.kind === 'pick' && inForce(d)).pop();
  return pick?.data.rows.Choice ?? null;
}

export function decided(ctx: Context, n: GraphNode): Decisions {
  const ds = decisionsOn(ctx, n);
  return { now: ds.filter(inForce).map((d) => decisionOf(d)), earlier: ds.filter((d) => !inForce(d)).map((d) => decisionOf(d)) };
}
