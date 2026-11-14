// An assumption opened (presentation.md §explorer, "Opening": assumption): from its page, or from the
// premise alone where it has no page, as a bound does.
import type { EntryOf, NodeOf } from '../../graph.ts';
import type { ThingOf } from '../../reading.ts';
import { ENTRY_KIND, LABEL } from '../../words.ts';
import { isEntry, nodeId, uniq } from '../access.ts';
import type { Context } from '../context.ts';
import { decisionOf } from '../decisions.ts';
import { passageLinks } from '../document.ts';
import { claimRef, nameOf } from '../refs.ts';
import { capital, when } from '../text.ts';
import { kindLine } from './common.ts';

type Premise = NodeOf<'premise'>;
type Body = Omit<ThingOf<'assumption'>, 'id' | 'kind' | 'title' | 'kindLabel' | 'from'>;

export function pageThing(ctx: Context, n: EntryOf<'premises'>): ThingOf<'assumption'> {
  return {
    id: n.id,
    kind: 'assumption',
    title: nameOf(ctx, n),
    kindLabel: kindLine(ctx, n),
    from: passageLinks(ctx, n.data.cites),
    ...body(ctx, n, ctx.g.find('premise', n.key)),
  };
}

export function premiseThing(ctx: Context, p: Premise): ThingOf<'assumption'> {
  // The part or span it belongs to, where it has one; its class is shown below, as the record writes it.
  const holder = p.scope ? (ctx.g.node(nodeId('part', p.scope)) ?? ctx.g.node(nodeId('span', p.scope)))?.name : undefined;
  return {
    id: p.id,
    kind: 'assumption',
    title: p.data.kind === 'bound' ? capital(`${LABEL.beyondTheBoundsOf} ${p.data.model ?? ''}`) : p.data.statement || p.key,
    kindLabel: holder ? `${ENTRY_KIND.premises} · ${holder}` : ENTRY_KIND.premises,
    from: [],
    ...body(ctx, p, p),
  };
}

function body(ctx: Context, page: EntryOf<'premises'> | Premise, p: Premise | undefined): Body {
  const d = p?.data ?? page.data;
  const carry = p?.data.carry;
  const by = carry?.by;
  const falsifier = d.falsifier && d.falsifier !== '-' ? d.falsifier : null;
  return {
    statement: d.statement,
    premiseClass: d.class ?? null,
    why: d.whyNotExamined || LABEL.assumedNotChecked,
    falsifier,
    provider: d.provider || null,
    taken: carry?.carried
      ? {
          by: by?.by ?? '',
          at: when(by?.at),
          // The carry's words, where they are not its falsifier.
          words: by?.words && by.words.trim() !== (falsifier ?? '').trim() ? by.words : null,
        }
      : null,
    earlier:
      p && carry?.carried
        ? uniq(ctx.g.into(p.id, 'decides')).flatMap((x) =>
            x.kind === 'decision' && x.data.name !== by?.name ? [decisionOf(x, false)] : [],
          )
        : [],
    holds: p
      ? uniq(ctx.g.into(p.id, 'rests-on'))
          .filter((c) => isEntry(c, 'claims'))
          .map((c) => claimRef(ctx, c))
      : [],
  };
}
