// The reading the server holds (project.md §explore, "Serving"): computed when it starts and again
// whenever the fingerprint changes. A reading is replaced only by a complete later one; a computation
// that fails keeps the one before it and is reported in status.
import { setTimeout as sleep } from 'node:timers/promises';
import type { Standing } from '../domain/reading.ts';
import type { Compute } from './compute.ts';
import { openReadIndex, type ReadIndex } from './cache.ts';
import type { Answer, Reads } from './http.ts';
import { messageOf } from './message.ts';

interface Holding {
  /** Pending until `start` has computed a first reading. */
  reads: Reads;
  /** Opens the read index and computes, then checks the fingerprint every `everyMs`. */
  start(): void;
  /** Settles once the first computation has. */
  ready: Promise<void>;
  /** Stops computing, stops the worker and closes the read index. */
  close(): Promise<void>;
}

/** Holds the reading of a canonical project path, its index under the cache folder `cacheRoot`. */
export function hold(project: string, cacheRoot: string, compute: Compute, everyMs: number): Holding {
  const stopping = new AbortController();
  let index: ReadIndex | null = null;
  let active: { generation: string; computedAt: string } | null = null;
  let failure: string | null = null;
  let refreshing = false;

  async function refresh(index: ReadIndex) {
    try {
      const found = await compute(project, index.generations(), {
        signal: stopping.signal,
        onComputing: () => {
          refreshing = true;
        },
      });
      if (found.kind === 'computed') await index.put(found.snapshot);
      const generation = found.kind === 'kept' ? found.generation : found.snapshot.generation;
      const computedAt = index.computedAt(generation);
      if (computedAt === undefined) throw new Error('The read index no longer holds the generation it named.');
      active = { generation, computedAt };
      failure = null;
    } catch (error) {
      if (!stopping.signal.aborted) failure = messageOf(error);
    } finally {
      refreshing = false;
    }
  }

  let first: () => void = () => {};
  const ready = new Promise<void>((resolve) => (first = resolve));
  let loop: Promise<void> = Promise.resolve();
  const run = async () => {
    index = await openReadIndex(project, cacheRoot);
    for (;;) {
      await refresh(index);
      first();
      await sleep(everyMs, undefined, { signal: stopping.signal });
    }
  };

  const answer = (read: (index: ReadIndex, generation: string) => string | undefined): Answer => {
    if (!active || !index) return failure === null ? { kind: 'pending' } : { kind: 'failed', error: failure };
    const json = read(index, active.generation);
    return json === undefined ? { kind: 'missing' } : { kind: 'found', generation: active.generation, json };
  };
  const reads: Reads = {
    status: () => ({ generation: active?.generation ?? null, computedAt: active?.computedAt ?? null, refreshing, error: failure }),
    sheet: (standing: Standing) => answer((index, generation) => index.sheet(generation, standing)),
    thing: (standing: Standing, id: string, generation: string) => {
      if (!active || !index) return failure === null ? { kind: 'pending' } : { kind: 'failed', error: failure };
      if (!index.generations().includes(generation)) return { kind: 'gone' };
      const json = index.thing(generation, standing, id);
      return json === undefined ? { kind: 'missing' } : { kind: 'found', generation, json };
    },
  };

  return {
    reads,
    ready,
    start() {
      loop = run()
        .catch((error: unknown) => {
          if (!stopping.signal.aborted) failure = messageOf(error);
        })
        .finally(first);
    },
    async close() {
      stopping.abort();
      await loop;
      index?.close();
    },
  };
}
