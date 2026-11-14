// Names that open things (presentation.md §explorer, "Opening"). Each name made here is noted, so the
// reading gives every thing a name on the sheet or inside another thing opens.
import type { EntryOf, GraphNode, NodeOf, StandingLabel } from '../graph.ts';
import type { Mark, Ref, ThingKind } from '../reading.ts';
import { LABEL } from '../words.ts';
import { isEntry, nodeId } from './access.ts';
import type { Context } from './context.ts';
import { verdictOf, type Ruling } from './revisions.ts';

const ENTRY_THING: Readonly<Record<string, ThingKind>> = {
  claims: 'claim',
  journeys: 'scenario',
  actions: 'action',
  lifecycles: 'lifecycle',
  choices: 'question',
  premises: 'assumption',
};

const NODE_THING: Partial<Record<GraphNode['kind'], ThingKind>> = {
  boundary: 'actor',
  premise: 'assumption',
  decision: 'ruling',
  model: 'model',
};

function thingKind(n: GraphNode): ThingKind {
  const kind = n.kind === 'entry' ? ENTRY_THING[n.data.kind] : NODE_THING[n.kind];
  if (!kind) throw new Error(`${n.id} is no thing the page opens`);
  return kind;
}

export const markOf = (label: StandingLabel): Mark => (label === 'established' ? 'established' : label === 'accepted' ? 'accepted' : 'not');

type Marks = { again?: boolean; beyond?: boolean; untaken?: boolean; revisions?: readonly number[] };

/** A name for a node, opening it. A claim's carries its standing mark; the other marks only where they are set. */
export function ref(ctx: Context, n: GraphNode, label: string, marks: Marks = {}): Ref {
  ctx.named.add(n.id);
  return {
    id: n.id,
    kind: thingKind(n),
    label,
    ...(isEntry(n, 'claims') ? { mark: markOf(n.data.standing.label) } : {}),
    ...(marks.revisions?.length ? { revisions: [...marks.revisions] } : {}),
    ...(marks.again ? { again: true } : {}),
    ...(marks.beyond ? { beyond: true } : {}),
    ...(marks.untaken ? { untaken: true } : {}),
  };
}

export const claimRef = (ctx: Context, c: EntryOf<'claims'>, marks: Marks = {}): Ref => ref(ctx, c, c.name, marks);

/** The node a key names, which the graph's own rules say is there. */
export function need<T>(found: T | undefined, what: string): T {
  if (found === undefined) throw new Error(`the graph names ${what}, which is not in this mode`);
  return found;
}

export const modelRef = (ctx: Context, key: string): Ref => ref(ctx, need(ctx.g.find('model', key), `model ${key}`), key);

/** An assumption's name: its page where it has one, else the premise. */
export function premiseRef(ctx: Context, key: string, untaken: boolean): Ref {
  const p = need(ctx.g.find('premise', key), `premise ${key}`);
  return ref(ctx, ctx.g.entry('premises', key) ?? p, premiseLabel(p), { untaken });
}

export const premiseLabel = (p: NodeOf<'premise'>): string =>
  p.data.kind === 'bound' ? `${LABEL.beyondTheBoundsOf} ${p.data.model ?? ''}` : p.data.statement || p.name;

/** A ruling's name, with its revision's mark where it found a fault in the design. */
export function rulingRef(ctx: Context, r: Ruling, label: string, withRevision: boolean, detail: string | null = null): Ref {
  const n = ctx.rulings.number.get(r.id);
  return { ...ref(ctx, r, label, { revisions: withRevision && n ? [n] : [] }), ...(detail ? { detail } : {}) };
}

/** A node's name; a scenario a pick added is named for its question and the alternative picked. */
export function nameOf(ctx: Context, n: GraphNode): string {
  if (n.name && n.name !== n.key) return n.name;
  const m = /^(.*)\/journeys\/(.+)-([ab])$/.exec(n.key);
  const choice = m ? ctx.g.entry('choices', `${m[1]}/choices/${m[2]}`) : undefined;
  return choice && m ? `${choice.name} ${LABEL.asPicked}: ${m[3]}` : n.name;
}

/** What a ruling is on, by the first thing its surprises serve, else its verdict. */
export const rulingOn = (ctx: Context, r: Ruling): string => {
  const on = ctx.rulings.served.get(r.id)?.[0];
  return on ? nameOf(ctx, on) : nameOf(ctx, r);
};

/** A ruling's title: what it is on, else its verdict. */
export function rulingTitle(ctx: Context, r: Ruling): string {
  const on = ctx.rulings.served.get(r.id)?.[0];
  return on ? nameOf(ctx, on) : verdictOf(r);
}

/** A ruling's quieter detail: its first surprise's expected and found outcome. */
export function rulingDetail(r: Ruling): string | null {
  const s = r.data.surprises?.surprises[0];
  return s ? `(${LABEL.expected} ${s.expected}, ${LABEL.found} ${s.found})` : null;
}

/** The part or span an entry or boundary row is held by, by its name. */
export function holderName(ctx: Context, n: GraphNode): string {
  if (n.kind !== 'entry' && n.kind !== 'boundary') return '';
  const h = n.data.holder;
  const holder =
    typeof h === 'string'
      ? (ctx.g.node(nodeId('part', h)) ?? ctx.g.node(nodeId('span', h)))
      : ctx.g.node(nodeId(h.span ? 'span' : 'part', h.key));
  return holder?.name ?? holderKey(n) ?? '';
}

/** The key of the part or span holding an entry or boundary row; a scenario a pick adds names it alone. */
export function holderKey(n: GraphNode): string | undefined {
  if (n.kind !== 'entry' && n.kind !== 'boundary') return undefined;
  const h = n.data.holder;
  return typeof h === 'string' ? h : h.key;
}
