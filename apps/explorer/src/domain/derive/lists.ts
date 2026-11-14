// The four lists after the documents (presentation.md §explorer, "The lists"), each thing once.
import type { EntryOf, NodeOf } from '../graph.ts';
import type { Sheet } from '../reading.ts';
import { ENGINE, LABEL, RULING_KIND, say } from '../words.ts';
import { isEntry, nodeId, uniq } from './access.ts';
import { compactBounds } from './bounds.ts';
import type { Context } from './context.ts';
import { passageLink } from './document.ts';
import { claimRef, modelRef, need, premiseLabel, ref, rulingRef, rulingTitle, rulingDetail } from './refs.ts';
import { isReal, verdictOf } from './revisions.ts';
import { standingSays } from './standing.ts';

type Claim = EntryOf<'claims'>;
type Premise = NodeOf<'premise'>;
type Lists = Sheet['lists'];

export function lists(ctx: Context): Lists {
  return {
    claims: claimSchedule(ctx),
    assumptions: assumptionSchedule(ctx),
    examination: examination(ctx),
    limits: ctx.graph.cannotKnow,
  };
}

/** Every claim once, by part or span; where every claim of one stands alike, its row says so once. */
function claimSchedule(ctx: Context): Lists['claims'] {
  const claims = ctx.g.entries('claims');
  const holderOf = (c: Claim) => nodeId(c.data.holder.span ? 'span' : 'part', c.data.holder.key);
  return uniq(claims.map(holderOf)).map((hid) => {
    const h = ctx.g.node(hid);
    const mine = claims.filter((c) => holderOf(c) === hid);
    const says = mine.map((c) => standingSays(ctx, c));
    const shared = mine.length > 1 && uniq(says).length === 1 ? (says[0] ?? null) : null;
    return {
      title: h?.name ?? hid,
      span: h?.kind === 'span',
      shared,
      rows: mine.map((c, i) => {
        const met = ctx.order.firstMet.get(c.id);
        return { ref: claimRef(ctx, c), says: shared ? null : (says[i] ?? null), section: met ? passageLink(met) : null };
      }),
    };
  });
}

/** Every premise carried or counted, most claims first; bound premises by model, with how many are taken on. */
function assumptionSchedule(ctx: Context): Lists['assumptions'] {
  const inForce = ctx.g.byKind('premise').filter((p) => p.data.carry?.carried || p.data.counted);
  const restingOn = (p: Premise) => uniq(ctx.g.into(p.id, 'rests-on')).filter((c) => isEntry(c, 'claims'));
  const untaken = (p: Premise) => !p.data.carry?.carried;
  const pages = inForce.filter((p) => p.data.kind !== 'bound').sort((a, b) => restingOn(b).length - restingOn(a).length);
  const bounds = inForce.filter((p) => p.data.kind === 'bound');
  return {
    rows: pages.map((p) => ({
      ref: ref(ctx, ctx.g.entry('premises', p.key) ?? p, premiseLabel(p), { untaken: untaken(p) }),
      provider: p.data.provider || null,
      claims: restingOn(p).length,
    })),
    bounds: uniq(bounds.map((p) => p.data.model ?? '')).map((key) => {
      const mine = bounds.filter((p) => (p.data.model ?? '') === key);
      const model = need(ctx.g.find('model', key), `model ${key}`);
      return {
        model: modelRef(ctx, key),
        bounds: compactBounds(model) || null,
        taken: mine.filter((p) => !untaken(p)).length,
        rows: mine.map((p) => {
          // A bound premise is named for the claim it bounds.
          const claim = (p.data.claim ? ctx.g.entry('claims', p.data.claim) : undefined) ?? restingOn(p)[0];
          return { ref: ref(ctx, p, claim ? claim.name : p.key, { untaken: untaken(p) }), provider: p.data.provider || null };
        }),
      };
    }),
  };
}

/** The models, the rulings that corrected something other than the design, and who decided how often. */
function examination(ctx: Context): Lists['examination'] {
  const claims = ctx.g.entries('claims');
  return {
    models: ctx.g.byKind('model').map((m) => ({
      ref: ref(ctx, m, m.key),
      engine: say(ENGINE, m.data.engine),
      covers: m.data.model.parts.join(', '),
      established: claims.filter((c) => c.data.standing.models.some((x) => x.model === m.key && x.established)).length,
    })),
    corrections: ctx.rulings.all
      .filter((r) => !isReal(r))
      .map((r) => ({ kind: say(RULING_KIND, verdictOf(r)), ref: rulingRef(ctx, r, rulingTitle(ctx, r), false, rulingDetail(r)) })),
    decisions: deciders(ctx).map(([by, count]) => ({ count, by })),
  };
}

/** Each declared maker of decisions, with how many they made, most first. */
export function deciders(ctx: Context): [string, number][] {
  const made = new Map<string, number>();
  for (const d of ctx.g.byKind('decision')) {
    const by = d.data.by ?? LABEL.unnamed;
    made.set(by, (made.get(by) ?? 0) + 1);
  }
  return [...made].sort((a, b) => b[1] - a[1]);
}
