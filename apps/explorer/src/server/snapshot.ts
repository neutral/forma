// One generation's readings: Forma's graph checked at the boundary (src/domain/graph.ts), then both
// standings derived and checked against the reading contract (src/domain/reading.ts).
import type { z } from 'zod';
import { Graph } from '../domain/graph.ts';
import { Reading, type Snapshot, type Standing } from '../domain/reading.ts';
import { deriveReading } from '../domain/derive/index.ts';

const ISSUES_SAID = 5;

/** `value` as `schema` gives it, or an error naming `what` and its first issues. */
function checked<T extends z.ZodType>(schema: T, value: unknown, what: string): z.output<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const { issues } = result.error;
  const said = issues.slice(0, ISSUES_SAID).map((issue) => `${issue.path.join('.') || '(top)'}: ${issue.message}`);
  if (issues.length > ISSUES_SAID) said.push(`${issues.length - ISSUES_SAID} more`);
  throw new Error(`${what} does not match the explorer's schema: ${said.join('; ')}.`);
}

function readingOf(graph: Graph, standing: Standing): Reading {
  const reading = checked(Reading, deriveReading(graph, standing), `The ${standing} reading`);
  if (reading.sheet.standing !== standing || reading.sheet.generation !== graph.generation)
    throw new Error(`The ${standing} reading names another standing or generation than the graph it is derived from.`);
  return reading;
}

/** Both standings' readings of Forma's graph, with what identifies the generation. */
export function snapshotOf(value: unknown): Snapshot {
  const graph = checked(Graph, value, "Forma's graph");
  return {
    generation: graph.generation,
    computedAt: graph.computedAt,
    readings: { recorded: readingOf(graph, 'recorded'), here: readingOf(graph, 'here') },
    inputs: graph.inputs,
    versions: graph.versions,
  };
}
