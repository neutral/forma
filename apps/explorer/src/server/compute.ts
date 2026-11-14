// The computation, off the serving thread. Each runs in a worker of its own, so Forma's source and
// toolchain load afresh: no cache of an earlier computation survives into a reading of other inputs.
import { Worker } from 'node:worker_threads';
import type { Snapshot } from '../domain/reading.ts';

/** What a computation finds: the project's generation already kept, or a new one with its readings. */
type Computed = { kind: 'kept'; generation: string } | { kind: 'computed'; snapshot: Snapshot };

export interface WorkerInput {
  project: string;
  kept: string[];
}
export type WorkerMessage = { kind: 'computing' } | Computed | { kind: 'failed'; error: string };

interface ComputeOptions {
  /** Aborting it stops the worker. */
  signal?: AbortSignal;
  /** Called when the generation is not kept and its readings are being computed. */
  onComputing?: () => void;
}

/** Fingerprints the project and, unless its generation is one of `kept`, computes both readings. */
export type Compute = (project: string, kept: readonly string[], options: ComputeOptions) => Promise<Computed>;

export const compute: Compute = (project, kept, { signal, onComputing }) =>
  new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const input: WorkerInput = { project, kept: [...kept] };
    const worker = new Worker(new URL('./reading-worker.ts', import.meta.url), { workerData: input, execArgv: [] });
    let settled = false;
    const settle = (finish: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      void worker.terminate();
      finish();
    };
    const abort = () => settle(() => reject(signal?.reason));
    signal?.addEventListener('abort', abort, { once: true });
    worker.on('message', (message: WorkerMessage) => {
      if (message.kind === 'computing') onComputing?.();
      else if (message.kind === 'failed') settle(() => reject(new Error(message.error)));
      else settle(() => resolve(message));
    });
    worker.on('error', (error) => settle(() => reject(error)));
    worker.on('exit', (code) => settle(() => reject(new Error(`The explorer's computation stopped (exit code ${code}).`))));
  });
