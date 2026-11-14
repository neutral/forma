// The top of the sheet (presentation.md §explorer, "The top" and "Standing"): the numbered general notes,
// each fact once, and the title block.
import type { Mode } from '../graph.ts';
import type { Sheet, TitleBlock } from '../reading.ts';
import { ENGINE, ENTRY_KIND, LABEL, list, plural, say } from '../words.ts';
import type { Context } from './context.ts';
import { deciders } from './lists.ts';
import { rulingOn, rulingRef } from './refs.ts';
import { isReal } from './revisions.ts';
import { claimWaits } from './standing.ts';
import { sectionId } from './document.ts';
import { when } from './text.ts';

type General = Sheet['general'];
const plain = (text: string): General[number] => [{ text, tone: 'plain' }];

export function generalNotes(ctx: Context): General {
  const claims = ctx.g.entries('claims');
  const count = (label: string) => claims.filter((c) => c.data.standing.label === label).length;
  const established = count('established');
  const accepted = count('accepted');
  // The claims that wait on the same things, said once.
  const waiting = new Map<string, number>();
  for (const c of claims.filter((x) => x.data.standing.label === 'not established')) {
    const on = claimWaits(ctx, c)
      .map((w) => w.says)
      .join('; on ');
    waiting.set(on, (waiting.get(on) ?? 0) + 1);
  }
  const real = ctx.rulings.all.filter(isReal).length;
  const unstated = ctx.g
    .byKind('mechanism')
    .filter((m) => m.data.brief?.rows.Choice !== 'stated')
    .reduce((n, m) => n + m.data.mechanisms.length, 0);
  const taken = ctx.g.byKind('premise').filter((p) => p.data.carry?.carried).length;
  const notes: General = [];
  notes.push(
    plain(
      claims.length
        ? `${established} ${LABEL.of} ${plural(claims.length, ENTRY_KIND.claims)} ${LABEL.established}${established ? `, ${LABEL.withinBounds}` : ''}.`
        : LABEL.noClaimYet,
    ),
  );
  for (const [on, n] of waiting) notes.push(plain(`${n} ${n === 1 ? LABEL.waitsOn : LABEL.waitOn} ${on}.`));
  if (accepted) notes.push(plain(`${accepted} ${LABEL.acceptedUnexamined}.`));
  if (real)
    notes.push([
      {
        text: `${plural(real, LABEL.revision)}: ${real === 1 ? LABEL.aFault : LABEL.faults} ${LABEL.foundInTheDesign}${
          unstated ? ` · ${plural(unstated, LABEL.mechanism)} ${LABEL.addedNotInTheDocument}` : ''
        }.`,
        tone: 'revision',
      },
    ]);
  notes.push(plain(`${plural(taken, ENTRY_KIND.premises)} ${LABEL.takenOnUnchecked}.`));
  notes.push(plain(`${LABEL.decisions}: ${list(deciders(ctx).map(([by]) => by))} · ${LABEL.declared}.`));
  return notes;
}

/** Claims' standing labels and the causes, to tell whether the two standings differ. */
const fingerprint = (mode: Mode): string =>
  JSON.stringify([
    mode.nodes.flatMap((n) => (n.kind === 'entry' && n.data.kind === 'claims' ? [[n.key, n.data.standing.label]] : [])),
    mode.causes.map((c) => c.says),
  ]);

export function titleBlock(ctx: Context): TitleBlock {
  const { graph, g } = ctx;
  const recorded = ctx.standing === 'recorded';
  // As recorded, the cause that accounts for the most lines here.
  const hereCause = [...graph.modes.here.causes].sort((a, b) => (b.lines?.length ?? 0) - (a.lines?.length ?? 0))[0];
  // Each engine by the page's name for it, without what the name says it searches.
  const engines = Object.values(graph.versions.engines ?? {})
    .map((e) => `${say(ENGINE, e.engine.name).split(' · ')[0]} ${String(e.engine.version).split(' ')[0]}`)
    .join(' · ');
  const spans = g.byKind('span').length;
  return {
    project: graph.project,
    computedAt: when(graph.computedAt),
    differs:
      fingerprint(ctx.mode) === fingerprint(ctx.other)
        ? null
        : {
            label: recorded ? LABEL.hereDiffers : LABEL.asRecorded,
            says: recorded && hereCause ? hereCause.says : LABEL.differs,
          },
    build: `${LABEL.forma} ${graph.versions.forma.version}${graph.versions.forma.source ? `+${graph.versions.forma.source}` : ''} · ${engines}`,
    sheets: [
      plural(ctx.order.files.length, LABEL.document),
      plural(g.byKind('part').length, LABEL.part),
      ...(spans ? [plural(spans, LABEL.span)] : []),
      plural(g.entries('actions').length, ENTRY_KIND.actions),
      plural(g.entries('lifecycles').length, ENTRY_KIND.lifecycles),
      plural(g.entries('journeys').length, ENTRY_KIND.journeys),
    ].join(' · '),
    revisions: [...ctx.rulings.number].flatMap(([id, number]) => {
      const r = ctx.rulings.all.find((x) => x.id === id);
      if (!r) return [];
      const home = ctx.rulings.home.get(id);
      return [{ number, ref: rulingRef(ctx, r, rulingOn(ctx, r), false), sectionId: home ? sectionId(home) : null, date: when(r.data.at).slice(0, 10) }];
    }),
  };
}
