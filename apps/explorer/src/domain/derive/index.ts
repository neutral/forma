// Graph → reading (presentation.md §explorer): one standing's sheet, and every thing a name on it or inside
// another thing opens, by id. It decides no standing, cause or link: every fact is the graph's.
import type { Graph } from '../graph.ts';
import type { Reading, Standing, Thing } from '../reading.ts';
import { context } from './context.ts';
import { documents } from './document.ts';
import { lists } from './lists.ts';
import { thingOf } from './things/index.ts';
import { generalNotes, titleBlock } from './top.ts';

export function deriveReading(graph: Graph, standing: Standing): Reading {
  const ctx = context(graph, standing);
  const sheet = {
    standing,
    generation: graph.generation,
    general: generalNotes(ctx),
    title: titleBlock(ctx),
    documents: documents(ctx),
    lists: lists(ctx),
  };
  // Give each thing named, until a pass names nothing new.
  const things: Record<string, Thing> = {};
  for (let todo = [...ctx.named]; todo.length; todo = [...ctx.named].filter((id) => !(id in things)))
    for (const id of todo) things[id] = thingOf(ctx, id);
  return { sheet, things };
}
