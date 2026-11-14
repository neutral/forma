// A claim opened (presentation.md §explorer, "Opening": claim).
import type { EntryOf, StandingModel } from '../../graph.ts';
import type { ClaimModel, ThingOf, Wait } from '../../reading.ts';
import { CONDITION, LABEL, list, say } from '../../words.ts';
import { checksOf } from '../checks.ts';
import type { Context } from '../context.ts';
import { decided } from '../decisions.ts';
import { passageLinks } from '../document.ts';
import { compactBounds } from '../bounds.ts';
import { markOf, modelRef, nameOf, need, premiseRef } from '../refs.ts';
import { claimWaits, itemWait, standingLine } from '../standing.ts';
import { when } from '../text.ts';
import { beyond, kindLine, rulingsOn } from './common.ts';

type Claim = EntryOf<'claims'>;

export function claimThing(ctx: Context, n: Claim): ThingOf<'claim'> {
  const st = n.data.standing;
  const whole = st.label === 'not established' ? claimWaits(ctx, n) : [];
  return {
    id: n.id,
    kind: 'claim',
    title: nameOf(ctx, n),
    kindLabel: kindLine(ctx, n),
    from: passageLinks(ctx, n.data.cites),
    statement: n.data.sentence,
    claimKind: n.data.claimKind,
    stake: n.data.stake,
    beyond: beyond(n),
    standing: markOf(st.label),
    standingLine: standingLine(ctx, n),
    acceptance: st.acceptance
      ? { words: st.acceptance.words ?? '', by: st.acceptance.by ?? '', at: when(st.acceptance.at) }
      : null,
    models: st.models.map((m) => onModel(ctx, n, m, whole)),
    rulings: rulingsOn(ctx, n),
    decisions: decided(ctx, n),
  };
}

const CANNOT = /^its encoding says why the engine cannot express it:\s*/;

/** The claim on one model that covers it; where the engine cannot express it, the reason and nothing more. */
function onModel(ctx: Context, n: Claim, m: StandingModel, whole: Wait[]): ClaimModel {
  const model = need(ctx.g.find('model', m.model), `model ${m.model}`);
  const holds = m.conditions.filter((c) => c.holds);
  const fails = m.conditions.filter((c) => !c.holds);
  const cannot = m.conditions.find((c) => c.cannotExpress);
  const head = {
    model: modelRef(ctx, m.model),
    established: m.established,
    bounds: m.engine === 'lifecycle' ? LABEL.phasesOnly : compactBounds(model),
  };
  if (cannot)
    return {
      ...head,
      cannotExpress: String(cannot.reason ?? cannot.found ?? '').replace(CANNOT, ''),
      inPlace: [],
      notYet: [],
      encoding: null,
      checks: { now: [], earlier: [] },
      premises: { refs: [], allTaken: false },
    };
  // Failing conditions that wait on the same items, or give the same reason, are said once.
  const groups = new Map<string, typeof fails>();
  for (const c of fails) {
    const key = c.items?.length ? `i:${c.items.join(',')}` : `r:${c.reason ?? c.found ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const notYet = [...groups.values()].map((cs) => {
    const first = cs[0];
    const items = first?.items ?? [];
    const conditions = cs.map((c) => say(CONDITION, c.condition));
    if (!items.length) return { conditions, waits: null, reason: first?.reason ?? first?.found ?? '' };
    const waits = items.map((i) => itemWait(ctx, i));
    // What the claim's own line already says is not said again.
    const sameAsWhole = whole.length === 1 && list(waits.map((w) => w.says)) === whole[0]?.says;
    return { conditions, waits: sameAsWhole ? null : waits, reason: null };
  });
  const slot = ctx.g
    .into(n.id, 'written-for')
    .find((s) => s.kind === 'slot' && s.data.model === m.model && s.data.slot === 'encoding');
  const file = slot?.kind === 'slot' ? ctx.g.find('file', slot.data.path) : undefined;
  return {
    ...head,
    cannotExpress: null,
    inPlace: holds.map((c) => say(CONDITION, c.condition)),
    notYet,
    encoding: file?.data.text ? file.data.text.trim() : null,
    checks: checksOf(ctx, n.id, m.model),
    premises: {
      refs: m.premises.map((p) => premiseRef(ctx, p.name, p.carried === false)),
      allTaken: Boolean(m.conditions.find((c) => c.condition === 'carried')?.holds),
    },
  };
}
