// A claim's standing in words (presentation.md §explorer, claim): its one line, and what a claim not
// established waits on, each thing once.
import type { EntryOf } from '../graph.ts';
import type { Wait } from '../reading.ts';
import { ITEM, LABEL, list, say } from '../words.ts';
import { evidenceOf } from './checks.ts';
import type { Context } from './context.ts';
import { capital } from './text.ts';

type Claim = EntryOf<'claims'>;

/** An item, in the page's words: an unfinished check also says why, as its evidence gives it. */
export function itemWait(ctx: Context, item: string): Wait {
  const colon = item.indexOf(':');
  const kind = colon < 0 ? item : item.slice(0, colon);
  const q = ctx.g.find('question', item.slice(kind.length + 1));
  const evidence = q ? evidenceOf(ctx, q)?.data : undefined;
  // An unfinished check says why it stopped; a run owed on evidence that is not current says what changed.
  // The found reason of a run owed again belongs to the run before, and is not why it is owed.
  const reason =
    kind === 'unanswered' ? evidence?.found?.reason : kind === 'run' && evidence?.current === false ? evidence.reasons?.join('; ') : undefined;
  return { says: `${say(ITEM, kind)}${reason ? ` (${reason})` : ''}`, item };
}

/**
 * What a claim not established waits on: each item its failing conditions name, once. A model whose engine
 * cannot express the claim adds nothing unless no other model is left; a model passing its scenarios is
 * named by the items it waits on, not by its own condition.
 */
export function claimWaits(ctx: Context, c: Claim): Wait[] {
  const models = c.data.standing.models;
  if (!models.length) return [{ says: ITEM.cover, item: 'cover' }];
  const waits: Wait[] = [];
  let cannotOnly = true;
  for (const m of models) {
    if (m.established) continue;
    const fails = m.conditions.filter((x) => !x.holds);
    if (fails.some((x) => x.cannotExpress)) continue;
    cannotOnly = false;
    for (const x of fails) {
      const items = x.items ?? [];
      if (items.length) waits.push(...items.map((i) => itemWait(ctx, i)));
      else if (x.condition !== 'conforming') waits.push({ says: x.reason ?? x.found ?? x.condition, item: x.condition });
    }
  }
  if (cannotOnly) return [{ says: ITEM.express, item: 'express' }];
  return waits.filter((w, i) => waits.findIndex((x) => x.says === w.says) === i);
}

/** The models a claim is established on. */
const establishedOn = (c: Claim): string[] => c.data.standing.models.filter((m) => m.established).map((m) => m.model);

/** `Established on <models>, within bounds.`, `Accepted, unexamined.`, or `Not established · waits on ….` */
export function standingLine(ctx: Context, c: Claim): string {
  const label = c.data.standing.label;
  if (label === 'established') return `${capital(LABEL.establishedOn)} ${list(establishedOn(c))}, ${LABEL.withinBounds}.`;
  if (label === 'accepted') return `${capital(LABEL.acceptedUnexamined)}.`;
  return `${capital(LABEL.notEstablished)} · ${LABEL.waitsOn} ${list(claimWaits(ctx, c).map((w) => w.says))}.`;
}

/** A claim's standing in the Claims list: `established on <models>`, `accepted, unexamined`, or what it waits on. */
export function standingSays(ctx: Context, c: Claim): string {
  const label = c.data.standing.label;
  if (label === 'established') return `${LABEL.establishedOn} ${list(establishedOn(c))}`;
  if (label === 'accepted') return LABEL.acceptedUnexamined;
  return `${LABEL.waitsOn} ${list(claimWaits(ctx, c).map((w) => w.says))}`;
}
