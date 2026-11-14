// The writer's lock (door.md §lock): one writer at a time on each machine. work/lock holds
// `{"pid", "at"}`, the writer holding it; it appears whole in one step, written in work/tmp/ and
// linked into place, which fails while a lock is there. A writer that finds it held waits until it
// is gone; a lock naming no process running on this machine is stale, and the next writer removes
// it. A command lets it go while engines run and takes it again to write what they found.

import { link, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { jsonText, timeText } from '../record/json.mjs';
import { cleanTmp, placeIfAbsent, readBytes, running, WORK } from '../record/tree.mjs';

let aside = 0;

/** The writer the lock names (door.md §scratch, §lock): `{ pid, at }`, or null when there is no lock or it does not parse. */
async function readLock(root) {
  const bytes = await readBytes(root, WORK.lock);
  if (bytes === null) return null;
  try {
    const value = JSON.parse(bytes.toString('utf8'));
    if (value && typeof value === 'object' && Number.isSafeInteger(value.pid) && value.pid > 0) return { pid: value.pid, at: value.at ?? null, text: bytes.toString('utf8') };
  } catch {
    // a lock that does not parse is read as absent (door.md §scratch), and so names no running writer
  }
  return { pid: null, at: null, text: bytes.toString('utf8') };
}

/**
 * Removes a stale lock (door.md §lock) only while it still holds `text`: moved aside into work/tmp/ in one step, then
 * removed; a lock that changed meanwhile, another writer's, is linked back into place.
 */
async function removeStale(root, text) {
  aside += 1;
  const moved = join(root, WORK.tmp, `${process.pid}-stale-${aside}`);
  try {
    await rename(join(root, WORK.lock), moved);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  const now = await readFile(moved, 'utf8').catch(() => null);
  if (now !== null && now !== text) await link(moved, join(root, WORK.lock)).catch(() => {});
  await unlink(moved).catch(() => {});
}

/**
 * Takes the writer's lock (door.md §lock), waiting while a running writer holds it and removing a stale one, then removes
 * what work/tmp/ holds of writers no longer running (door.md §scratch). Gives `{ pid, at, release() }`.
 */
export async function takeLock(root, { poll = 50 } = {}) {
  for (;;) {
    const at = timeText();
    const text = jsonText({ pid: process.pid, at });
    if (await placeIfAbsent(root, WORK.lock, text)) {
      await cleanTmp(root);
      let held = true;
      return {
        pid: process.pid,
        at,
        /** Lets the lock go, when it is still this one. */
        release: async () => {
          if (!held) return;
          held = false;
          const now = await readBytes(root, WORK.lock);
          if (now !== null && now.toString('utf8') === text) await unlink(join(root, WORK.lock)).catch(() => {});
        },
      };
    }
    const holder = await readLock(root);
    if (holder === null) continue;
    if (holder.pid === process.pid) throw new Error('the writer\'s lock is held by this process already, so taking it again would wait forever');
    if (holder.pid === null || !running(holder.pid)) {
      await removeStale(root, holder.text);
      continue;
    }
    await new Promise((done) => setTimeout(done, poll));
  }
}

/** Runs `work` holding the writer's lock (door.md §lock), letting it go however `work` ends. */
export async function withLock(root, work) {
  const lock = await takeLock(root);
  try {
    return await work();
  } finally {
    await lock.release();
  }
}
