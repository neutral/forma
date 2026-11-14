// Where a lifecycle's phases stand (presentation.md §explorer, A lifecycle drawn): each in the column the
// reading gives it (how many moves it is from the initial phase), left to right. ELK's layered layout keeps
// those columns, orders the phases within each, and spaces them by their size.
import Elk from 'elkjs/lib/elk.bundled.js';
import type { ELK, ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { LifecycleDrawing } from '../../domain/reading.ts';
import { isLit, litLabel, type Action } from './lighting.ts';

/** The phase's box; what stays and what is left open are listed under it. */
export const BOX_HEIGHT = 34;
const LINE_HEIGHT = 12;
/** The advance of the 9.5px fixed-width face the lines under a box are set in. */
const ADVANCE = 5.75;
/** The least room between columns; more where a move's label needs it. */
const COLUMN_GAP = 118;
const ROW_GAP = 56;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  column: number;
}
export interface Layout {
  boxes: Map<string, Box>;
  width: number;
  height: number;
}

const OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  // The columns are given, as the x of each phase below; ELK keeps them.
  'elk.layered.layering.strategy': 'INTERACTIVE',
  // Within a column, phases keep the reading's order and stand balanced about the boxes they join.
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
  'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
  'elk.spacing.nodeNode': String(ROW_GAP),
  'elk.padding': '[top=34,left=30,bottom=30,right=30]',
};

/** A move's actions as they read with the whole walk lit: their longest. */
const moveLabel = (actions: Action[]): string => actions.map((a) => (isLit(a) ? litLabel(a) : a.label)).join(', ');

/** The line listing what stays in a phase, as it reads with the whole walk lit. */
const staysLine = (actions: Action[]): string => `stays: ${moveLabel(actions)}`;

function wrappedLines(text: string, perLine: number): number {
  let lines = 1;
  let used = 0;
  for (const word of text.split(' ')) {
    const need = used === 0 ? word.length : used + 1 + word.length;
    if (need > perLine && used > 0) {
      lines += 1;
      used = word.length;
    } else used = need;
  }
  return lines;
}

function sizes(drawing: LifecycleDrawing): { width: number; heights: Map<string, number> } {
  const width = Math.max(128, ...drawing.phases.map((p) => p.id.length * 7.1 + 26));
  const perLine = Math.floor((width - 8) / ADVANCE);
  const heights = new Map<string, number>();
  for (const phase of drawing.phases) {
    const stays = drawing.stays.filter((s) => s.phase === phase.id && s.actions.length > 0);
    const open = drawing.open.filter((o) => o.phase === phase.id);
    const lines = [...stays.map((s) => staysLine(s.actions)), ...open.map((o) => `left open: ${o.action}`)]
      .map((line) => wrappedLines(line, perLine))
      .reduce((a, b) => a + b, 0);
    heights.set(phase.id, BOX_HEIGHT + (lines ? lines * LINE_HEIGHT + 6 : 0));
  }
  return { width, heights };
}

let engine: ELK | undefined;
const cache = new Map<string, Promise<Layout>>();

/** What the layout depends on: the phases, the moves, and the lines under each phase. */
export const layoutKey = (drawing: LifecycleDrawing): string =>
  JSON.stringify([
    drawing.phases.map((p) => [p.id, p.column]),
    drawing.moves.map((m) => [m.from, m.to, moveLabel(m.actions)]),
    drawing.stays.map((s) => [s.phase, staysLine(s.actions)]),
    drawing.open,
  ]);

export function layoutLifecycle(drawing: LifecycleDrawing): Promise<Layout> {
  const key = layoutKey(drawing);
  const known = cache.get(key);
  if (known) return known;
  const laying = place(drawing);
  cache.set(key, laying);
  return laying;
}

async function place(drawing: LifecycleDrawing): Promise<Layout> {
  engine ??= new Elk();
  const column = new Map(drawing.phases.map((p) => [p.id, p.column]));
  const { width, heights } = sizes(drawing);
  // The moves join the boxes at their middle, not the lines listed under them.
  const port = (id: string, side: 'WEST' | 'EAST') => ({
    id: `${id}:${side}`,
    x: side === 'WEST' ? 0 : width,
    y: BOX_HEIGHT / 2,
    width: 0,
    height: 0,
    layoutOptions: { 'elk.port.side': side },
  });
  const children: ElkNode[] = drawing.phases.map((phase, row) => ({
    id: phase.id,
    width,
    height: heights.get(phase.id) ?? BOX_HEIGHT,
    x: phase.column * 1000,
    y: row * 100,
    layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
    ports: [port(phase.id, 'WEST'), port(phase.id, 'EAST')],
  }));
  // Each move across columns places the phases it joins, from the left one to the right one. A move within
  // a column has no place in a layered layout; it is drawn between the two, straight.
  const across = drawing.moves.filter((m) => column.get(m.from) !== column.get(m.to));
  const edges: ElkExtendedEdge[] = across.map((m, i) => {
    const [left, right] = (column.get(m.from) ?? 0) < (column.get(m.to) ?? 0) ? [m.from, m.to] : [m.to, m.from];
    return { id: `m${i}`, sources: [`${left}:EAST`], targets: [`${right}:WEST`] };
  });
  const labelled = across.flatMap((m) => m.actions.map((a) => (isLit(a) ? litLabel(a) : a.label).length));
  const gap = Math.max(COLUMN_GAP, ...labelled.map((chars) => chars * ADVANCE + 24));
  const options = { ...OPTIONS, 'elk.layered.spacing.nodeNodeBetweenLayers': String(gap) };
  const graph: ElkNode = { id: 'lifecycle', layoutOptions: options, children, edges };
  const laid = await engine.layout(graph);
  const boxes = new Map<string, Box>();
  for (const node of laid.children ?? [])
    boxes.set(node.id, {
      x: node.x ?? 0,
      y: node.y ?? 0,
      width: node.width ?? width,
      height: node.height ?? BOX_HEIGHT,
      column: column.get(node.id) ?? 0,
    });
  return { boxes, width: laid.width ?? 0, height: laid.height ?? 0 };
}
