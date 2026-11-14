// What every part of one standing's derivation reads: the mode indexed, the reading order and the rulings,
// and what the sheet and the things name so far, so every thing a name opens can be given.
import type { Graph, Mode, NodeOf, Picture } from '../graph.ts';
import type { Standing, ThingOf } from '../reading.ts';
import { access, type Access } from './access.ts';
import { readingOrder, type ReadingOrder } from './document.ts';
import { rulings, type Rulings } from './revisions.ts';

export type Context = {
  graph: Graph;
  standing: Standing;
  mode: Mode;
  /** The other standing's mode, to say where the two differ. */
  other: Mode;
  g: Access;
  order: ReadingOrder;
  rulings: Rulings;
  /** Each lifecycle's picture, the lifecycle as read, by the lifecycle's name (account.md §explorer-graph, `diagrams`). */
  pictures: Map<string, Picture>;
  /** Slots by their path under `models/` without extension, for a question that reads none of them. */
  slotsByStem: Map<string, NodeOf<'slot'>>;
  /** The ids of the things named so far: each must be given in the reading. */
  named: Set<string>;
  /** Each passage's restatement, by its id: it is no node of the graph. */
  restatements: Map<string, ThingOf<'section'>>;
};

export function context(graph: Graph, standing: Standing): Context {
  const mode = graph.modes[standing];
  const g = access(mode);
  const order = readingOrder(g);
  return {
    graph,
    standing,
    mode,
    other: graph.modes[standing === 'here' ? 'recorded' : 'here'],
    g,
    order,
    rulings: rulings(g, order),
    pictures: new Map(mode.diagrams.flatMap((d) => (d.variant.kind === 'as-read' && d.lifecycle && d.picture ? [[d.lifecycle, d.picture] as const] : []))),
    slotsByStem: new Map(g.byKind('slot').map((s) => [s.data.path.replace(/^models\//, '').replace(/\.[a-z]+$/, ''), s])),
    named: new Set(),
    restatements: new Map(),
  };
}
