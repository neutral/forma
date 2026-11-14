// The arrow for each pair of phases some action moves between: forward across the columns, straight within
// one, and back underneath. Its label lists the actions one to a line, so that it stays within the gap.
import type { LifecycleDrawing } from '../../domain/reading.ts';
import { BOX_HEIGHT, type Box, type Layout } from './layout.ts';

export interface Route {
  path: string;
  /** Where the label's first line stands. */
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
  /** How far down the arrow reaches. */
  bottom: number;
}

/** The arrowhead's room at the end of a path. */
const HEAD = 6;
export const LABEL_LINE = 11;

/** The route from `a` to `b`, for a label of `lines` lines. */
function route(a: Box, b: Box, lines: number): Route {
  const block = (lines - 1) * LABEL_LINE;
  const midA = a.y + BOX_HEIGHT / 2;
  const midB = b.y + BOX_HEIGHT / 2;
  if (b.column > a.column) {
    const x1 = a.x + a.width;
    const x2 = b.x;
    const mx = (x1 + x2) / 2;
    return {
      path: `M${x1},${midA} C${mx},${midA} ${mx},${midB} ${x2 - HEAD},${midB}`,
      label: { x: mx, y: (midA + midB) / 2 - 6 - block, anchor: 'middle' },
      bottom: Math.max(midA, midB),
    };
  }
  if (b.column === a.column) {
    const down = b.y > a.y;
    const x = a.x + a.width / 2 + (down ? 16 : -16);
    const y1 = down ? a.y + a.height : a.y;
    const y2 = down ? b.y - HEAD : b.y + b.height + HEAD;
    return {
      path: `M${x},${y1} L${x},${y2}`,
      label: { x: x + (down ? 8 : -8), y: (y1 + y2) / 2 - block / 2, anchor: down ? 'start' : 'end' },
      bottom: Math.max(y1, y2),
    };
  }
  const x1 = a.x;
  const x2 = b.x + b.width;
  const under = Math.max(a.y + a.height, b.y + b.height) + 24;
  return {
    path: `M${x1},${midA} C${x1 - 40},${under} ${x2 + 40},${under} ${x2 + HEAD},${midB}`,
    label: { x: (x1 + x2) / 2, y: under + 12, anchor: 'middle' },
    bottom: under + 12 + block,
  };
}

export const moveKey = (move: { from: string; to: string }): string => `${move.from}→${move.to}`;

/** Every arrow's route, and the extent of the whole drawing with them. */
export function geometry(drawing: LifecycleDrawing, layout: Layout): { routes: Map<string, Route>; width: number; height: number } {
  const routes = new Map<string, Route>();
  for (const move of drawing.moves) {
    const a = layout.boxes.get(move.from);
    const b = layout.boxes.get(move.to);
    if (a && b) routes.set(moveKey(move), route(a, b, move.actions.length));
  }
  const lowest = Math.max(0, ...[...routes.values()].map((r) => r.bottom + 16));
  return { routes, width: layout.width, height: Math.max(layout.height, lowest) };
}
