// The examples as the explorer's tests read them: each example's graph as Forma builds it, and the snapshot an
// export would make of it. Building paperclip-erp's graph takes half a minute, so each graph is kept in an
// ignored cache under the fingerprint of its inputs and versions (`@forma/cli/graph`): a change to the example,
// the toolchain, Forma or the commit names another file, and no kept graph is read for inputs it was not built from.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph, fingerprint } from '@forma/cli/graph';
import { Graph } from '../src/domain/graph.ts';
import type { Snapshot } from '../src/domain/reading.ts';
import { snapshotOf } from '../src/server/snapshot.ts';

export const repo = fileURLToPath(new URL('../../../', import.meta.url));

/** Where kept graphs and the browser tests' snapshot live, ignored with node_modules. */
export const cache = fileURLToPath(new URL('../node_modules/.cache/forma-explorer-tests/', import.meta.url));

export const EXAMPLES = ['export-ticket', 'paperclip-erp'] as const;
export type Example = (typeof EXAMPLES)[number];

async function graphOf(example: Example): Promise<unknown> {
  const root = join(repo, 'examples', example);
  const { hash } = await fingerprint(root);
  const file = join(cache, `${example}.${hash.slice(0, 16)}.graph.json`);
  return readFile(file, 'utf8').then(
    (text) => JSON.parse(text),
    async () => {
      const built = await buildGraph(root);
      await mkdir(cache, { recursive: true });
      await writeFile(file, JSON.stringify(built));
      return built;
    },
  );
}

/** An example's graph, checked against the explorer's schema. */
export async function exampleGraph(example: Example): Promise<Graph> {
  return Graph.parse(await graphOf(example));
}

/** An example's two readings, as `forma-explorer export` makes them (src/server/snapshot.ts). */
export async function exampleSnapshot(example: Example): Promise<Snapshot> {
  return snapshotOf(await graphOf(example));
}
