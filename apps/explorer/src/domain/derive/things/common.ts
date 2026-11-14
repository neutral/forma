// What every opened thing shows first (presentation.md §explorer, "Opening"): its kind, and the rulings and
// pieces several kinds share.
import type { GraphNode, JourneyStep } from '../../graph.ts';
import type { Step } from '../../reading.ts';
import { ENTRY_KIND, say } from '../../words.ts';
import type { Context } from '../context.ts';
import { holderName, ref } from '../refs.ts';

/** The upper-case kind line: the entry's kind in the page's words, and the part or span holding it. */
export function kindLine(ctx: Context, n: GraphNode): string {
  const kind = n.kind === 'entry' ? say(ENTRY_KIND, n.data.kind) : say(ENTRY_KIND, n.kind);
  const holder = holderName(ctx, n);
  return holder ? `${kind} · ${holder}` : kind;
}

/** `Origin` `added`: not said outright in the text it cites. */
export const beyond = (n: GraphNode): boolean => (n.kind === 'entry' || n.kind === 'boundary') && n.data.origin === 'added';

/** The rulings on a thing, by id; each is given in the reading. */
export function rulingsOn(ctx: Context, n: GraphNode): string[] {
  const ids = (ctx.rulings.on.get(n.id) ?? []).map((r) => r.id);
  for (const id of ids) ctx.named.add(id);
  return ids;
}

/** An expected end as written; `-` writes none. */
export const expectedEnd = (end: string | null | undefined): string | null => (end && end !== '-' ? end : null);

/** A scenario's steps, each naming its action; the step it says must be refused marked. */
export function stepsOf(
  ctx: Context,
  journey: { steps: readonly JourneyStep[]; refusedStep?: number | null | undefined },
  holder: string | undefined,
): Step[] {
  return journey.steps.map((s) => {
    const key = s.action.includes('/') ? s.action.replace('/', '/actions/') : `${holder}/actions/${s.action}`;
    const action = ctx.g.entry('actions', key);
    return {
      n: s.step,
      action: action ? ref(ctx, action, s.action) : s.action,
      case: s.case ?? null,
      arguments: s.arguments ?? '',
      refused: journey.refusedStep === s.step,
    };
  });
}
