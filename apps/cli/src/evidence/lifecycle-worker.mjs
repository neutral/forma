// One exploration of the lifecycle engine (engines.md §lifecycle-engine), run in a worker thread of its own so
// that its time limit holds and the engines running beside it are not held up: it is given the data
// form, the form to reach and the seconds allowed, and posts what explore() gives.

import { parentPort, workerData } from 'node:worker_threads';
import { explore } from './lifecycle-engine.mjs';

parentPort.postMessage(explore(workerData.data, workerData.form, { seconds: workerData.seconds }));
