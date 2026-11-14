// The notes beside a passage (presentation.md §explorer, "Notes"): only what is first met there, in the
// contract's order; what cites it and was met above is only counted and named again.
import type { GraphNode } from '../graph.ts';
import type { Note } from '../reading.ts';
import { ENTRY_KIND, LABEL, RULING_KIND, counts, say } from '../words.ts';
import { isEntry } from './access.ts';
import type { Context } from './context.ts';
import { picked } from './decisions.ts';
import type { Passage } from './document.ts';
import { claimRef, ref, rulingOn, rulingRef } from './refs.ts';
import { isReal, verdictOf } from './revisions.ts';
import { expectedEnd } from './things/common.ts';
import { briefStatus } from './things/ruling.ts';
import { restatementId, restatementThing } from './things/section.ts';

type Cited = Extract<GraphNode, { kind: 'entry' | 'boundary' }>;

const kindOf = (n: Cited): string => (n.kind === 'boundary' ? 'boundary' : n.data.kind);
const of = (xs: readonly Cited[], kind: string) => xs.filter((n) => kindOf(n) === kind);
/** What a passage's restatement holds. */
const RESTATED = ['actions', 'lifecycles', 'journeys', 'boundary'];

export function notesOf(ctx: Context, p: Passage): Note[] {
  const cited = p.data.citations.flatMap((id) => {
    const n = ctx.g.node(id);
    return n && (n.kind === 'entry' || n.kind === 'boundary') ? [n] : [];
  });
  const fresh = cited.filter((n) => ctx.order.firstMet.get(n.id) === p);
  const seen = cited.filter((n) => ctx.order.firstMet.get(n.id) !== p);
  const notes: Note[] = [];

  const ruled = ctx.rulings.at.get(p.id) ?? [];
  const real = ruled.filter(isReal);
  if (real.length)
    notes.push({
      kind: 'found',
      revisions: real.map((r) => ({
        number: ctx.rulings.number.get(r.id) ?? 0,
        ref: rulingRef(ctx, r, rulingOn(ctx, r), false),
        added: (ctx.rulings.mechanisms.get(r.data.name) ?? []).flatMap((m) =>
          m.data.mechanisms.map((mechanism) => ({ mechanism, brief: briefStatus(m) })),
        ),
      })),
    });
  // A ruling of verdict model wrong is listed only under Examination.
  const corrected = ruled.filter((r) => !['real finding', 'model wrong'].includes(verdictOf(r)));
  if (corrected.length)
    notes.push({
      kind: 'corrected',
      refs: corrected.map((r) => rulingRef(ctx, r, `${say(RULING_KIND, verdictOf(r))}: ${rulingOn(ctx, r)}`, false)),
    });

  for (const c of fresh.filter((n) => isEntry(n, 'choices'))) {
    const pick = picked(ctx, c);
    const alternative = pick === 'a' || pick === 'b' ? c.data.alternatives[pick] : undefined;
    const end = expectedEnd(alternative?.expectedEnd);
    notes.push({ kind: 'leftOpen', ref: ref(ctx, c, c.name), settled: pick ? `${pick}${end ? `. ${end}` : ''}` : null });
  }

  for (const o of p.data.omissions)
    notes.push({ kind: 'leftOut', reason: o.reason, confirmation: o.confirmation && o.confirmation !== 'confirmed' ? o.confirmation : null });

  const claims = fresh.filter((n) => isEntry(n, 'claims'));
  if (claims.length) notes.push({ kind: 'mustHold', refs: claims.map((c) => claimRef(ctx, c)) });

  const premises = of(fresh, 'premises');
  if (premises.length)
    notes.push({
      kind: 'assumes',
      refs: premises.map((c) => ref(ctx, c, c.name, { untaken: !ctx.g.find('premise', c.key)?.data.carry?.carried })),
    });

  if (cited.some((n) => RESTATED.includes(kindOf(n)))) notes.push(restated(ctx, p, cited, fresh, seen));

  const back = seen.filter((n) => ['claims', 'premises', 'choices'].includes(kindOf(n)));
  if (back.length)
    notes.push({
      kind: 'alsoAbove',
      label: counts([
        [of(back, 'claims').length, ENTRY_KIND.claims],
        [of(back, 'premises').length, ENTRY_KIND.premises],
        [of(back, 'choices').length, ENTRY_KIND.choices],
      ]),
      refs: back.map((n) => (isEntry(n, 'claims') ? claimRef(ctx, n, { again: true }) : ref(ctx, n, n.name, { again: true }))),
    });
  return notes;
}

/** The note opening the passage's restatement: how many of each are met here, or how many were restated above. */
function restated(ctx: Context, p: Passage, cited: Cited[], fresh: Cited[], seen: Cited[]): Note {
  const thing = restatementThing(ctx, p, cited);
  ctx.restatements.set(thing.id, thing);
  ctx.named.add(thing.id);
  const freshRestated = fresh.filter((n) => RESTATED.includes(kindOf(n)));
  const label = freshRestated.length
    ? counts([
        [of(freshRestated, 'actions').length, ENTRY_KIND.actions],
        [of(freshRestated, 'lifecycles').length, ENTRY_KIND.lifecycles],
        [of(freshRestated, 'journeys').length, ENTRY_KIND.journeys],
        [of(freshRestated, 'boundary').length, ENTRY_KIND.boundary, LABEL.actorsAndRecords],
      ])
    : `${LABEL.restatedAbove} (${seen.filter((n) => RESTATED.includes(kindOf(n))).length})`;
  return {
    kind: 'restated',
    ref: { id: restatementId(p), kind: 'section', label },
    beyond: freshRestated.filter((n) => n.data.origin === 'added').length,
  };
}

