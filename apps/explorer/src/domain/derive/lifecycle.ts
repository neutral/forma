// A lifecycle drawn and as a table (presentation.md §explorer, "A lifecycle drawn"), from its picture, the
// lifecycle as read (lifecycle-tool.md §as-read), and, for a scenario, the walk the lifecycle tool gives
// (lifecycle-tool.md §stepping). The page runs no machine.
import type { Cell, EntryOf, Outcome, Picture, Walk } from '../graph.ts';
import type { LifecycleDrawing, LifecycleTable } from '../reading.ts';
import { LABEL } from '../words.ts';
import { push } from './access.ts';
import type { Context } from './context.ts';

type Lifecycle = EntryOf<'lifecycles'>;
type Move = { from: string; to: string; label: string };
type MoveAction = LifecycleDrawing['moves'][number]['actions'][number];

const labelOf = (action: string, named: string | null): string => (named ? `${action} (${named})` : action);
const moveKey = (from: string, to: string, label: string) => `${from}|${to}|${label}`;

/** The picture of a lifecycle as the graph gives it. Every lifecycle entry has one. */
export function pictureOf(ctx: Context, lc: Lifecycle): Picture {
  const picture = ctx.pictures.get(lc.key);
  if (!picture) throw new Error(`the graph gives no picture of the lifecycle ${lc.key}`);
  return picture;
}

/** The lifecycle drawn; with a walk, the moves it takes lit by step, and the step it says must be refused. */
export function lifecycleDrawing(lc: Lifecycle, picture: Picture, walk: Walk | null): LifecycleDrawing {
  const phases = picture.phases.map((p) => p.key);
  const initial = picture.initial?.phase ?? null;
  const steps = new Map<string, number[]>();
  const mustNot = new Set<string>();
  for (const m of walk?.moves ?? []) {
    // A step that enters the lifecycle leaves no phase: it lights the phase it reaches, and no move.
    if (m.lifecycle !== lc.key || m.from === null) continue;
    const key = moveKey(m.from, m.to, labelOf(m.action, m.case));
    push(steps, key, m.step);
    if (m.refusedStep) mustNot.add(key);
  }
  const action = (m: Move): MoveAction => {
    const key = moveKey(m.from, m.to, m.label);
    return { label: m.label, steps: steps.get(key) ?? [], mustNot: mustNot.has(key) };
  };
  const moves: Move[] = picture.moves.map((m) => ({ from: m.from, to: m.to, label: labelOf(m.action, m.case) }));
  // One arrow for each pair of phases some action moves between.
  const pairs = new Map<string, { from: string; to: string; moves: Move[] }>();
  const stays = new Map<string, Move[]>();
  for (const m of moves) {
    if (m.from === m.to) push(stays, m.from, m);
    else {
      const key = `${m.from}|${m.to}`;
      const pair = pairs.get(key) ?? pairs.set(key, { from: m.from, to: m.to, moves: [] }).get(key);
      pair?.moves.push(m);
    }
  }
  // Columns by how many moves a phase is from the initial phase; a phase no move reaches stands after the last.
  const column = new Map<string, number>([[initial ?? phases[0] ?? '', 0]]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const m of moves) {
      const at = column.get(m.from);
      if (at !== undefined && !column.has(m.to)) {
        column.set(m.to, at + 1);
        grew = true;
      }
    }
  }
  const unreached = Math.max(0, ...column.values()) + 1;
  return {
    id: lc.id,
    name: lc.name,
    phases: phases.map((p) => ({
      id: p,
      column: column.get(p) ?? unreached,
      initial: initial === p,
      end: picture.ends.includes(p),
      visited: (walk?.reached ?? []).some((r) => r.lifecycle === lc.key && r.phase === p),
    })),
    moves: [...pairs.values()].map((p) => ({ from: p.from, to: p.to, actions: p.moves.map(action) })),
    stays: phases.flatMap((p) => {
      const ms = stays.get(p);
      return ms ? [{ phase: p, actions: ms.map(action) }] : [];
    }),
    open: phases.flatMap((phase) =>
      picture.actions.flatMap((a) => posedIn(picture.cells[phase]?.[a]).map((named) => ({ phase, action: labelOf(a, named) }))),
    ),
    refusedAt: walk?.refusedAt ?? null,
    lit: walk !== null,
  };
}

/** The cases of a cell a choice still poses: null for the cell itself. */
function posedIn(c: Cell | undefined): (string | null)[] {
  if (c?.kind === 'choice') return [null];
  if (c?.kind === 'cases') return c.cases.filter((k) => k.outcome.kind === 'choice').map((k) => k.case);
  return [];
}

/** The lifecycle as a table: a row per phase, a column per action, each cell what the action does there. */
export function lifecycleTable(picture: Picture): LifecycleTable {
  return {
    entity: picture.entity ?? LABEL.phase,
    actions: picture.actions,
    rows: picture.phases.map(({ key }) => ({
      phase: key,
      initial: picture.initial?.phase === key,
      end: picture.ends.includes(key),
      cells: picture.actions.map((a) => cellOf(picture.cells[key]?.[a] ?? { kind: 'empty' })),
    })),
    unaffected: picture.unaffected,
  };
}

function outcomeText(o: Outcome): string {
  switch (o.kind) {
    case 'phase':
      return `→ ${o.phase}`;
    case 'refused':
      return LABEL.refused;
    case 'choice':
      return `${LABEL.leftOpen}: ${o.choice}`;
    case 'empty':
      return LABEL.unspecified;
  }
}

function cellOf(c: Cell): LifecycleTable['rows'][number]['cells'][number] {
  switch (c.kind) {
    case 'phase':
      return { kind: 'move', text: outcomeText(c) };
    case 'refused':
      return { kind: 'refused', text: outcomeText(c) };
    case 'choice':
      return { kind: 'open', text: outcomeText(c) };
    case 'empty':
      return { kind: 'unspecified', text: outcomeText(c) };
    case 'cases':
      return { kind: 'cases', text: c.cases.map((k) => `${k.case}: ${outcomeText(k.outcome)}`).join('\n') };
  }
}
