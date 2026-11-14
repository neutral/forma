// One computation (src/server/compute.ts): the fingerprint first, and the graph and both readings only
// when the fingerprint names a generation that is not kept.
import { parentPort, workerData } from 'node:worker_threads';
import { buildGraph, fingerprint } from '@forma/cli/graph';
import type { WorkerInput, WorkerMessage } from './compute.ts';
import { messageOf } from './message.ts';
import { snapshotOf } from './snapshot.ts';

const { project, kept } = workerData as WorkerInput;
const say = (message: WorkerMessage) => parentPort?.postMessage(message);

try {
  const { hash } = await fingerprint(project);
  if (kept.includes(hash)) say({ kind: 'kept', generation: hash });
  else {
    say({ kind: 'computing' });
    say({ kind: 'computed', snapshot: snapshotOf(await buildGraph(project)) });
  }
} catch (error) {
  say({ kind: 'failed', error: messageOf(error) });
}
