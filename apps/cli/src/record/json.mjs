// JSON as Forma writes it, digests, and byte order: evidence.md §basis, §own-check, door.md §receipts, §scratch.
// It imports nothing of Forma's own, so every module of the record may use it.

import { createHash } from 'node:crypto';

/** The SHA-256 of bytes, or of a string in UTF-8, as 64 lowercase hexadecimal digits (evidence.md §basis). */
export const sha256 = (bytes) => createHash('sha256').update(typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes).digest('hex');

/** The first twelve hexadecimal digits of a SHA-256 (decisions.md §decision-file, evidence.md §bounds, §stems, door.md §scratch). */
export const hex12 = (bytes) => sha256(bytes).slice(0, 12);

/** Whether a value is 64 lowercase hexadecimal digits, as every SHA-256 is written (evidence.md §basis, door.md §receipts). */
export const isSha256 = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

/**
 * Byte order of two strings (evidence.md §basis, door.md §receipts, design.md §pins): UTF-8 byte order, which is
 * code-point order, not JavaScript's UTF-16 order.
 */
export function compare(a, b) {
  const x = String(a);
  const y = String(b);
  if (x === y) return 0;
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    const p = x.codePointAt(i);
    const q = y.codePointAt(j);
    if (p !== q) return p < q ? -1 : 1;
    i += p > 0xffff ? 2 : 1;
    j += q > 0xffff ? 2 : 1;
  }
  if (i < x.length) return 1;
  if (j < y.length) return -1;
  return 0;
}

/** Byte order of two keys, each a string or a list of strings compared in turn. */
function compareKeys(p, q) {
  if (!Array.isArray(p)) return compare(p, q);
  for (let at = 0; at < Math.max(p.length, q.length); at += 1) {
    if (at >= p.length) return -1;
    if (at >= q.length) return 1;
    const c = compare(p[at], q[at]);
    if (c) return c;
  }
  return 0;
}

/** A copy of `items` sorted in byte order of `key(item)`, a string or a list of strings compared in turn. */
export const sortedBy = (items, key = (item) => item) => [...items].sort((a, b) => compareKeys(key(a), key(b)));

/** Whether `items` are in byte order of `key(item)`, each once (door.md §receipts's lists). */
export function inOrder(items, key = (item) => item) {
  for (let at = 1; at < items.length; at += 1) if (compareKeys(key(items[at - 1]), key(items[at])) >= 0) return false;
  return true;
}

/** A value as evidence.md §own-check writes JSON: `JSON.stringify(value, null, 2)` and a line feed. */
export const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** A value as one receipt line writes it, with no space outside its strings (door.md §receipts). */
export const jsonLine = (value) => JSON.stringify(value);

/** `object` with only `keys`, in that order, those whose value is undefined left out (evidence.md §keys, door.md §receipts). */
export function ordered(object, keys) {
  const out = {};
  for (const key of keys) if (object[key] !== undefined) out[key] = object[key];
  return out;
}

/**
 * A value with its digest sealed (evidence.md §own-check): `{ value, text }`, the digest the SHA-256 of the bytes with
 * its own value written as an empty string.
 */
export function sealed(value) {
  if (!Object.hasOwn(value, 'digest')) throw new Error('a sealed value holds digest among its keys');
  const open = { ...value, digest: '' };
  const digest = sha256(jsonText(open));
  const done = { ...value, digest };
  return { value: done, text: jsonText(done) };
}

/** Whether text is JSON in evidence.md §own-check's form whose digest holds: `{ ok, value, says }`. */
export function digestHolds(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, value: null, says: `it is not JSON: ${error.message}` };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { ok: false, value: null, says: 'it is not a JSON object' };
  if (jsonText(value) !== text) return { ok: false, value, says: 'it is not written in the form Forma writes JSON, two-space indentation ending in a line feed' };
  if (!isSha256(value.digest)) return { ok: false, value, says: 'its digest is not a SHA-256' };
  if (sha256(jsonText({ ...value, digest: '' })) !== value.digest) return { ok: false, value, says: 'its digest does not hold: its bytes are not those it was written with' };
  return { ok: true, value, says: null };
}

/** A basis's digest (evidence.md §basis): the SHA-256 of the basis value written alone as evidence.md §own-check writes JSON, ending in a line feed. */
export const basisDigest = (basis) => sha256(jsonText(basis));

/** A time as Forma writes it, UTC to the millisecond, `YYYY-MM-DDTHH:MM:SS.sssZ` (door.md §clock). */
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Whether `text` is a time in door.md §clock's form that names a moment that exists. */
export function isTime(text) {
  if (typeof text !== 'string' || !TIME.test(text)) return false;
  const at = new Date(text);
  return !Number.isNaN(at.getTime()) && at.toISOString() === text;
}

/** An object with no prototype, from `[key, value]` pairs, so a key such as `constructor` reads nothing inherited (forms.md §page-rules's keys). */
export const dict = (entries = []) => Object.assign(Object.create(null), Object.fromEntries(entries));

/** A moment as door.md §clock writes it: the machine's clock in UTC to the millisecond. */
export const timeText = (date = new Date()) => date.toISOString();

/**
 * The clock rule (door.md §clock): `latest`, the latest tracked time `{ at, file }`, when more than sixty seconds
 * ahead of the clock; null otherwise.
 */
export function aheadOfClock(latest, now = new Date()) {
  if (!latest) return null;
  return Date.parse(latest.at) - now.getTime() > 60_000 ? latest : null;
}
