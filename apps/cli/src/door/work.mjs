// Scratch: work/ (door.md §sessions, §scratch): the sessions seen on this machine and the refusals kept for
// items still missing. Only code writes here; a file that does not parse is read as absent and written whole
// the next time. The allowance spent is spent.mjs's, the writer's lock lock.mjs's.

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { hex12, jsonText, ordered } from '../record/json.mjs';
import { sessionsSorted } from '../record/receipts.mjs';
import { readBytes, removeFile, WORK, writeWhole } from '../record/tree.mjs';

/** A reason's keys, in door.md §forma-answer's order. */
const REASON_KEYS = ['check', 'file', 'entry', 'field', 'says'];

/** A reason in door.md §forma-answer's form, every key present, a missing one null. */
const reasonOf = (r) => ordered({ check: r.check, file: r.file ?? null, entry: r.entry ?? null, field: r.field ?? null, says: r.says }, REASON_KEYS);

/** Whether a value is a reason in door.md §forma-answer's form, as work/refused/ holds them. */
const isReason = (r) => Boolean(r) && typeof r === 'object' && !Array.isArray(r) && typeof r.check === 'string' && typeof r.says === 'string'
  && ['file', 'entry', 'field'].every((key) => r[key] === null || typeof r[key] === 'string');

/** A JSON file of work/ parsed, or undefined when it is absent or does not parse (door.md §scratch). */
async function readJson(root, path) {
  const bytes = await readBytes(root, path);
  if (bytes === null) return undefined;
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return undefined;
  }
}

// --- Sessions seen (door.md §sessions) ---------------------------------------------------------------------------------

/** Whether a value is a session as door.md §sessions declares one: three names, none empty. */
const isSession = (s) => Boolean(s) && typeof s === 'object' && ['provider', 'model', 'session'].every((key) => typeof s[key] === 'string' && s[key] !== '');

/**
 * The sessions that submitted an answer on this machine (door.md §sessions): work/sessions.json, each `{ provider, model,
 * session }` once, in byte order; a file that is absent or does not parse is read as none (door.md §scratch).
 */
export async function sessionsSeen(root) {
  const value = await readJson(root, WORK.sessions);
  if (!Array.isArray(value)) return [];
  return sessionsSorted(value.filter(isSession));
}

/** Adds a session to the sessions seen here (door.md §forma-answer step 2, door.md §sessions), writing work/sessions.json whole. The caller holds the lock. */
export async function addSession(root, session) {
  const seen = sessionsSorted([...(await sessionsSeen(root)), session]);
  await writeWhole(root, WORK.sessions, jsonText(seen));
  return seen;
}

// --- Refusals (door.md §scratch) -------------------------------------------------------------------------------------

/** The path of an item's refusals: `work/refused/<h>.json`, `<h>` the first twelve hexadecimal digits of the SHA-256 of its name (door.md §scratch). */
const refusedPath = (item) => WORK.refused(hex12(item));

/** A work/refused/ file's value when it is in door.md §scratch's form for the item its name gives, or null. */
function refusalsValue(value, hex) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.item !== 'string' || !Array.isArray(value.refusals)) return null;
  if (hex !== null && hex12(value.item) !== hex) return null;
  if (!value.refusals.every((refusal) => Array.isArray(refusal) && refusal.every(isReason))) return null;
  return value;
}

/** The reasons of each refusal of `item` kept on this machine, oldest first (door.md §gives `refused`, door.md §scratch): `[[reason]]`. */
export async function refusalsOf(root, item) {
  const value = refusalsValue(await readJson(root, refusedPath(item)), null);
  if (!value || value.item !== item) return [];
  return value.refusals.map((refusal) => refusal.map(reasonOf));
}

/**
 * Every refusal kept on this machine (door.md §scratch), by item name: `Map<item, [{ at, session, reasons }]>`, oldest
 * first. door.md §scratch's file keeps only each refusal's reasons, so `at` and `session` are null.
 */
export async function refusalsHere(root) {
  const found = new Map();
  let names = [];
  try {
    names = await readdir(join(root, 'work/refused'));
  } catch {
    return found;
  }
  for (const name of names.sort()) {
    const m = /^([0-9a-f]{12})\.json$/.exec(name);
    if (!m) continue;
    const value = refusalsValue(await readJson(root, `work/refused/${name}`), m[1]);
    if (!value || !value.refusals.length) continue;
    found.set(value.item, value.refusals.map((reasons) => ({ at: null, session: null, reasons: reasons.map(reasonOf) })));
  }
  return found;
}

/**
 * Keeps one refusal of `item` (door.md §forma-answer step 6, door.md §scratch): its reasons appended to the item's file, oldest first; a file
 * holding another item's name, or that does not parse, is replaced. `session` is the refused answer's, which the file
 * does not keep. The caller holds the lock.
 */
export async function keepRefusal(root, item, session, reasons) {
  const path = refusedPath(item);
  const value = refusalsValue(await readJson(root, path), hex12(item));
  const earlier = value && value.item === item ? value.refusals.map((refusal) => refusal.map(reasonOf)) : [];
  await writeWhole(root, path, jsonText({ item, refusals: [...earlier, reasons.map(reasonOf)] }));
}

/** Deletes an item's refusals once an answer for it is taken in (door.md §forma-answer step 5, door.md §scratch). The caller holds the lock. */
export async function dropRefusals(root, item) {
  const path = refusedPath(item);
  const value = await readJson(root, path);
  // A file holding another item's name is that item's, and stays.
  if (value && typeof value === 'object' && typeof value.item === 'string' && value.item !== item) return false;
  return removeFile(root, path);
}
