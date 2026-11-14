// Where the read index is kept, and when it is kept in memory instead (project.md §explore, "The read
// index"): in the operating system's local cache, never inside the project, and never written while
// door.md §clock's rule holds a tracked time ahead.
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { clockAhead } from '@forma/cli/graph';
import type { Snapshot } from '../domain/reading.ts';
import { canonical, inside } from './paths.ts';
import { openStore, type Store } from './store.ts';

/** The operating system's local cache folder, as Forma keeps its toolchain there. */
export { cacheBase } from '@forma/cli/graph';

/** The index file of a project, named by the SHA-256 of its canonical path. */
export const indexFile = (project: string, base: string) =>
  join(base, 'forma', 'explorer', createHash('sha256').update(project).digest('hex'), 'reading.sqlite');

/** Whether the clock rule holds; a project whose clock cannot be read is taken to hold it. */
const clockHolds = (project: string) => clockAhead(project).then((ahead) => ahead !== null, () => true);

export interface ReadIndex extends Omit<Store, 'put'> {
  /** Stores a generation, moving the index into memory first when its file may not be written. */
  put(snapshot: Snapshot): Promise<void>;
}

async function initial(project: string, base: string): Promise<Store> {
  const file = indexFile(project, base);
  try {
    if (inside(project, await canonical(file)) || (await clockHolds(project))) return openStore(':memory:');
    await mkdir(dirname(file), { recursive: true });
    return openStore(file);
  } catch {
    return openStore(':memory:');
  }
}

/** The read index of a canonical project path, under the cache folder `base`. */
export async function openReadIndex(project: string, base: string): Promise<ReadIndex> {
  let store = await initial(project, base);
  // The index moves only once the generation is stored in memory, so a failed put keeps what is served.
  const toMemory = (snapshot: Snapshot) => {
    const memory = openStore(':memory:');
    try {
      memory.put(snapshot);
    } catch (error) {
      memory.close();
      throw error;
    }
    store.close();
    store = memory;
  };
  return {
    get file() {
      return store.file;
    },
    generations: () => store.generations(),
    computedAt: (generation) => store.computedAt(generation),
    sheet: (generation, standing) => store.sheet(generation, standing),
    thing: (generation, standing, id) => store.thing(generation, standing, id),
    async put(snapshot) {
      if (store.file && (await clockHolds(project))) return toMemory(snapshot);
      try {
        store.put(snapshot);
      } catch (error) {
        if (!store.file) throw error;
        toMemory(snapshot);
      }
    },
    close: () => store.close(),
  };
}
