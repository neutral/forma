// A ruling opened (presentation.md §explorer, "Opening": ruling): what the examination found, and its repair.
import type { NodeOf } from '../../graph.ts';
import type { Added, BriefStatus, ThingOf } from '../../reading.ts';
import { DECISION, DECISION_STATE, LABEL, RULING_KIND, VERDICT, say } from '../../words.ts';
import { uniq } from '../access.ts';
import type { Context } from '../context.ts';
import { passageLinks } from '../document.ts';
import { rulingDetail, rulingTitle } from '../refs.ts';
import { verdictOf, type Ruling } from '../revisions.ts';
import { when } from '../text.ts';

type Mechanism = NodeOf<'mechanism'>;

export function rulingThing(ctx: Context, r: Ruling): ThingOf<'ruling'> {
  const d = r.data;
  const verdict = verdictOf(r);
  const revision = ctx.rulings.number.get(r.id) ?? null;
  return {
    id: r.id,
    kind: 'ruling',
    title: rulingTitle(ctx, r),
    kindLabel: `${revision ? `${LABEL.revision} ${revision} · ` : ''}${say(RULING_KIND, verdict, DECISION.rule)}`,
    from: passageLinks(ctx, uniq((ctx.rulings.served.get(r.id) ?? []).flatMap((s) => s.data.cites ?? []))),
    revision,
    verdict,
    level: d.rows.Level ?? '',
    says: say(VERDICT, verdict, ''),
    detail: rulingDetail(r),
    surprises: (d.surprises?.surprises ?? []).map((s) => ({ expected: s.expected, found: s.found, question: s.question })),
    words: d.words ? { text: d.words, by: d.by ?? '', at: when(d.at), state: stateOf(d.state?.state) } : null,
    repairTo: (d.repairRoute?.kinds ?? []).map((k) => (k.kind === 'model' ? `${LABEL.model} ${k.model ?? ''}` : k.kind)).join(', ') || null,
    added: (ctx.rulings.mechanisms.get(d.name) ?? []).flatMap((m) => m.data.mechanisms.map((t) => added(m, t))),
    shown: d.shown || null,
  };
}

/** A ruling's state in the page's words, or null while it is in force. */
const stateOf = (state: string | undefined): string | null => (!state || state === 'in force' ? null : say(DECISION_STATE, state, state));

/** How a mechanism a repair added stands against the developer's document. */
export const briefStatus = (m: Mechanism): BriefStatus =>
  !m.data.brief ? 'absent' : m.data.brief.rows.Choice === 'stated' ? 'stated' : 'accepted';

function added(m: Mechanism, mechanism: string): Added {
  const b = m.data.brief;
  const brief = briefStatus(m);
  // An acceptance gives its words, and who accepted it and when.
  const accepted = brief === 'accepted' && b?.words;
  return {
    mechanism,
    brief,
    words: b?.words || null,
    by: accepted ? (b.by ?? '') : null,
    at: accepted ? when(b.at) : null,
  };
}
