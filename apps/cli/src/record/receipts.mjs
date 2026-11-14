// Receipts: the record of what Forma checked and took in, one per folder of accepted files, one
// line per file (door.md §receipts): the line's form, a file's entry, its authors, answers and mechanisms,
// writing a line beside a file taken in, or with one removed (door.md §forma-answer, §repair-answer, §receipts), and the
// mechanisms the lines meeting a repair give for its decision (decisions.md §rulings, §expects).

import { compare, inOrder, isSha256, isTime, jsonLine, ordered, sha256, sortedBy, timeText } from './json.mjs';
import { isLifecycleModel, readBytes, receiptOf, removeFile, writeWhole } from './tree.mjs';

/** A receipt line's keys, in the order door.md §receipts gives them. */
const LINE_KEYS = ['file', 'sha256', 'at', 'session', 'decision', 'authors', 'pins', 'strikes', 'answers', 'mechanisms', 'before', 'removed'];

const SESSION_KEYS = ['provider', 'model', 'session'];
const DECISION_NAME = /^\d{8}T\d{6}Z-redirect-[0-9a-f]{12}$/;

/** Whether a value is one of a line's `mechanisms`, `{ decision, mechanism }`: a decision's name and the Mechanism its Repair answer gave (door.md §repair-answer, §receipts). */
const isMechanism = (m) => m !== null && typeof m === 'object' && !Array.isArray(m) && Object.keys(m).join(',') === 'decision,mechanism'
  && typeof m.decision === 'string' && m.decision !== '' && typeof m.mechanism === 'string' && m.mechanism !== '';

/** The order of a line's `mechanisms`: byte order of `decision`, then of `mechanism` (door.md §receipts). */
const mechanismKey = (m) => [m.decision, m.mechanism];

/** `[{ decision, mechanism }]`, each pair once, in door.md §receipts's order: the `mechanisms` of lines joined. */
export const mechanismsSorted = (items) => {
  const seen = new Map();
  for (const m of items) seen.set(JSON.stringify(mechanismKey(m)), { decision: m.decision, mechanism: m.mechanism });
  return sortedBy([...seen.values()], mechanismKey);
};

/** A session's three names as one list, the order sessions are sorted in (door.md §receipts, §sessions, §scratch). */
const sessionKey = (session) => SESSION_KEYS.map((key) => session[key]);

/** Whether two sessions are one: all three names equal (door.md §sessions). */
export const sameSession = (a, b) => SESSION_KEYS.every((key) => a?.[key] === b?.[key]);

/** A session as one string, for sets of sessions (door.md §sessions). */
export const sessionId = (session) => JSON.stringify(sessionKey(session));

/** Sessions each once, in byte order of provider, then model, then session (door.md §receipts, §scratch). */
export function sessionsSorted(sessions) {
  const seen = new Map();
  for (const session of sessions) seen.set(sessionId(session), ordered(session, SESSION_KEYS));
  return sortedBy([...seen.values()], sessionKey);
}

/** Why a value is not a session as door.md §forma-answer, §receipts give one: three names, none empty; null when it is. */
function sessionReason(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'is not an object';
  const keys = Object.keys(value);
  if (keys.join(',') !== SESSION_KEYS.join(',')) return 'does not hold exactly provider, model and session, in that order';
  if (!SESSION_KEYS.every((key) => typeof value[key] === 'string' && value[key] !== '')) return 'has a name that is not a string or is empty';
  return null;
}

/** Why one receipt line does not parse in door.md §receipts's form; null when it does. */
function lineReason(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return 'it is not JSON';
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'it is not a JSON object';
  if (jsonLine(value) !== text) return 'it is not one JSON object written with no space outside its strings';
  const keys = Object.keys(value);
  let last = -1;
  for (const key of keys) {
    const at = LINE_KEYS.indexOf(key);
    if (at === -1) return `it holds the key ${key}, which no receipt line holds`;
    if (at < last) return `its key ${key} is out of door.md §receipts's order`;
    last = at;
  }
  if (typeof value.file !== 'string' || value.file === '' || value.file.includes('/') || value.file === '.' || value.file === '..') return 'its file is not a name in its folder';
  if (!isSha256(value.sha256)) return 'its sha256 is not 64 lowercase hexadecimal digits';
  if (!isTime(value.at)) return 'its at is not a time written YYYY-MM-DDTHH:MM:SS.sssZ';
  const hasSession = Object.hasOwn(value, 'session');
  const hasDecision = Object.hasOwn(value, 'decision');
  if (hasSession === hasDecision) return 'it holds neither or both of session and decision, and holds exactly one';
  if (hasSession) {
    const why = sessionReason(value.session);
    if (why) return `its session ${why}`;
  }
  if (hasDecision && (typeof value.decision !== 'string' || !DECISION_NAME.test(value.decision))) return "its decision is not a redirect's name";
  if (hasSession && !Object.hasOwn(value, 'authors')) return 'it records an answer and holds no authors';
  if (Object.hasOwn(value, 'authors')) {
    if (!Array.isArray(value.authors)) return 'its authors is not a list';
    for (const author of value.authors) {
      const why = sessionReason(author);
      if (why) return `an author ${why}`;
    }
    if (!inOrder(value.authors, sessionKey)) return 'its authors are not each once in byte order of provider, model and session';
    if (hasSession && !value.authors.some((author) => sameSession(author, value.session))) return 'its authors do not hold its own session';
  }
  if (Object.hasOwn(value, 'pins')) {
    if (!Array.isArray(value.pins) || !value.pins.every((p) => p && typeof p === 'object' && Object.keys(p).join(',') === 'entry,pin' && typeof p.entry === 'string' && isSha256(p.pin))) return 'its pins are not a list of { entry, pin }';
    if (!inOrder(value.pins, (p) => p.entry)) return 'its pins are not each once in byte order of entry';
  }
  if (Object.hasOwn(value, 'strikes')) {
    if (!Array.isArray(value.strikes) || !value.strikes.every((s) => typeof s === 'string' && /^strike:[^/]+\/[^/]+\/[^/]+$/.test(s))) return 'its strikes are not a list of strike:<part>/<row>/<item>';
    if (!inOrder(value.strikes)) return 'its strikes are not each once in byte order';
  }
  if (Object.hasOwn(value, 'answers')) {
    if (!Array.isArray(value.answers) || !value.answers.every((a) => typeof a === 'string' && a !== '')) return "its answers are not a list of decisions' names";
    if (!inOrder(value.answers)) return 'its answers are not each once in byte order';
  }
  if (Object.hasOwn(value, 'mechanisms')) {
    if (!Array.isArray(value.mechanisms) || !value.mechanisms.every(isMechanism)) return "its mechanisms are not a list of { decision, mechanism }, each a decision's name with the Mechanism its Repair answer's repair.md gave";
    if (!inOrder(value.mechanisms, mechanismKey)) return 'its mechanisms are not each once in byte order of decision';
    const named = new Set(value.answers ?? []);
    const stray = value.mechanisms.find((m) => !named.has(m.decision));
    if (stray) return `its mechanisms give the decision ${stray.decision}, which its answers do not name: a Repair answer names its decision in both`;
  }
  if (Object.hasOwn(value, 'before') && value.before !== null && !isSha256(value.before)) return 'its before is neither null nor a SHA-256';
  if (Object.hasOwn(value, 'removed')) {
    if (!Array.isArray(value.removed) || !value.removed.every((r) => r && typeof r === 'object' && Object.keys(r).join(',') === 'file,before' && typeof r.file === 'string' && r.file !== '' && isSha256(r.before))) return 'its removed is not a list of { file, before }';
    if (!inOrder(value.removed, (r) => [r.file, r.before])) return 'its removed are not each once in byte order of file';
  }
  return null;
}

/**
 * Why a line that parses is not in its form for the file it names (door.md §repair-answer, §receipts): `kind` is `slot`, `model-md`,
 * `front` (design/README.md, a part's or span's README.md), `page` (any other page), or `other`. Null when it is.
 */
export function lineContextReason(value, kind) {
  const has = (key) => Object.hasOwn(value, key);
  if (kind === 'slot' && !has('pins')) return "it is a slot's line and holds no pins, the pin of each entry the slot was written for";
  if (kind !== 'slot' && has('pins')) return 'it holds pins, which only a slot\'s line holds';
  if (kind === 'model-md' && !has('strikes')) return "it is model.md's line and holds no strikes, those in force when Forma took it in";
  if (kind !== 'model-md' && has('strikes')) return "it holds strikes, which only a model's model.md's line holds";
  // A repair made by removing is recorded on a README.md's line, or for what it removed under models/<model>/ on that model's model.md line (door.md §repair-answer).
  if (kind !== 'front' && kind !== 'model-md' && has('removed')) return "it holds removed, which only the line of a README.md or a model's model.md recording a repair made by removing holds";
  // A repair made by removing is recorded with its decision in answers, and each file removed in removed (door.md §repair-answer).
  if (has('removed') && !has('answers')) return 'it holds removed, which records a repair made by removing, and names no decision in answers';
  if (has('decision') && kind !== 'front' && kind !== 'page') return "it names a redirect, which writes only pages";
  // `mechanisms` is on a line on which a Repair answer named its decision in `answers`, its removals' line included, and
  // on every later version of it, which keeps them with no `before` of its own (door.md §repair-answer, §receipts).
  if (has('mechanisms') && !has('answers')) return "it holds mechanisms, which a line naming a Repair answer's decision in answers holds, and names no decision in answers";
  if (has('before') && !has('answers')) return 'it holds before, which a line meeting a repair holds, and names no decision in answers';
  return null;
}

/**
 * A receipt's lines read as a set (door.md §receipts), a last line without its line feed not parsing: `{ lines, bad }`, a
 * bad line ignored and making the receipt `change:<path>` (door.md §change).
 */
export function parseReceipt(text) {
  const lines = [];
  const bad = [];
  const seen = new Set();
  const pieces = String(text).split('\n');
  const ended = pieces[pieces.length - 1] === '';
  if (ended) pieces.pop();
  pieces.forEach((piece, at) => {
    const unended = !ended && at === pieces.length - 1;
    const why = unended ? 'it does not end in a line feed' : lineReason(piece);
    if (why) bad.push({ line: at + 1, text: piece, says: why });
    else if (!seen.has(piece)) {
      seen.add(piece);
      lines.push({ text: piece, value: JSON.parse(piece) });
    }
  });
  return { lines, bad };
}

/** Every line of a parsed receipt for the file `name`, as the receipt holds them (door.md §receipts). */
export const linesFor = (receipt, name) => (receipt?.lines ?? []).filter((line) => line.value.file === name);

/**
 * A file's entry (door.md §receipts): of its lines whose `sha256` is that of its bytes, the latest by `at`, then the
 * first in byte order; null when there is none.
 */
export function entryOf(receipt, name, hash) {
  const matching = linesFor(receipt, name).filter((line) => line.value.sha256 === hash);
  if (!matching.length) return null;
  matching.sort((a, b) => compare(b.value.at, a.value.at) || compare(a.text, b.text));
  return matching[0].value;
}

/** Every session that wrote any version of a file: the `authors` of all its lines together (door.md §receipts). */
export const authorsOf = (receipt, name) => sessionsSorted(linesFor(receipt, name).flatMap((line) => line.value.authors ?? []));

/**
 * Whether a file's receipt line can record a repair of `model` (decisions.md §expects; door.md §repair-answer): a file under
 * `models/<model>/`; for a lifecycle model, also its part's lifecycle pages, and the `README.md` its removals are
 * recorded on, its part's, or `design/README.md` when that part was removed whole. Gives a test of a project path.
 */
export function onModel(model) {
  const part = isLifecycleModel(model) ? model.slice('lifecycles-'.length) : null;
  return (path) => path.startsWith(`models/${model}/`)
    || (part !== null && (path.startsWith(`design/parts/${part}/lifecycles/`) || path === `design/parts/${part}/README.md` || path === 'design/README.md'));
}

/**
 * The mechanisms the receipt lines meeting a repair give for its decision (decisions.md §rulings, §expects; door.md §repair-answer, §receipts):
 * `[{ mechanism, files }]`, each mechanism once, in byte order, `files` the project paths whose lines give it, in byte
 * order. A line counts when its file is one `test` takes (onModel(model), say), it names `decision` in its `answers` by
 * what it changed (its `before` is not its `sha256`, or it records files `removed`), and its `mechanisms` give the
 * decision a mechanism, as only a Repair answer's lines do. `receipts` is readProject's, by folder; [] when no line
 * counts, so a repair that only a Repair answer meets is met exactly when this is not empty.
 */
export function repairMechanisms(receipts, decision, test = () => true) {
  const found = new Map();
  for (const receipt of receipts.values()) {
    const folder = receipt.path.slice(0, receipt.path.lastIndexOf('/'));
    for (const { value } of receipt.lines) {
      if (!(value.answers ?? []).includes(decision)) continue;
      if (value.before === value.sha256 && !(value.removed ?? []).length) continue;
      const path = `${folder}/${value.file}`;
      if (!test(path)) continue;
      for (const m of value.mechanisms ?? []) {
        if (m.decision !== decision) continue;
        if (!found.has(m.mechanism)) found.set(m.mechanism, new Set());
        found.get(m.mechanism).add(path);
      }
    }
  }
  return sortedBy([...found.keys()]).map((mechanism) => ({ mechanism, files: sortedBy([...found.get(mechanism)]) }));
}

/**
 * A new receipt line (door.md §receipts), carrying forward the `authors`, `answers`, `mechanisms` and `removed` of the lines
 * it replaces. `fields.mechanisms`, `[{ decision, mechanism }]`, are a Repair answer's, each decision also in
 * `fields.answers`.
 */
function newLine(fields, previous = []) {
  const authors = sessionsSorted([...(fields.session ? [fields.session] : []), ...previous.flatMap((line) => line.value.authors ?? [])]);
  const answers = sortedBy([...new Set([...(fields.answers ?? []), ...previous.flatMap((line) => line.value.answers ?? [])])]);
  const mechanisms = mechanismsSorted([...previous.flatMap((line) => line.value.mechanisms ?? []), ...(fields.mechanisms ?? [])]);
  const removed = new Map();
  for (const item of [...previous.flatMap((line) => line.value.removed ?? []), ...(fields.removed ?? [])]) removed.set(`${item.file}\0${item.before}`, { file: item.file, before: item.before });
  const line = {
    file: fields.file,
    sha256: fields.sha256,
    at: fields.at ?? timeText(),
    session: fields.session ? ordered(fields.session, SESSION_KEYS) : undefined,
    decision: fields.session ? undefined : fields.decision,
    authors: authors.length ? authors : undefined,
    pins: fields.pins ? sortedBy(fields.pins.map((p) => ({ entry: p.entry, pin: p.pin })), (p) => p.entry) : undefined,
    strikes: fields.strikes ? sortedBy([...new Set(fields.strikes)]) : undefined,
    answers: answers.length ? answers : undefined,
    mechanisms: mechanisms.length ? mechanisms : undefined,
    before: fields.before,
    removed: removed.size ? sortedBy([...removed.values()], (item) => [item.file, item.before]) : undefined,
  };
  const value = ordered(line, LINE_KEYS);
  const why = lineReason(jsonLine(value));
  if (why) throw new Error(`a receipt line Forma would write does not parse: ${why}`);
  return value;
}

/** A receipt's bytes from its lines' values (door.md §receipts): each line once, in byte order, each ending in a line feed. */
function receiptText(values) {
  const texts = sortedBy([...new Set(values.map((value) => jsonLine(value)))]);
  return texts.map((text) => `${text}\n`).join('');
}

/** A folder's receipt, parsed (door.md §receipts); none read as empty. */
async function readReceipt(root, folder) {
  const bytes = await readBytes(root, receiptOf(folder));
  return { path: receiptOf(folder), exists: bytes !== null, ...parseReceipt(bytes === null ? '' : bytes.toString('utf8')) };
}

/** Writes a folder's receipt with these lines' values, or removes it when there are none: a receipt goes with its last line (door.md §receipts). */
async function writeReceipt(root, folder, values) {
  if (!values.length) {
    await removeFile(root, receiptOf(folder));
    return;
  }
  await writeWhole(root, receiptOf(folder), receiptText(values));
}

/**
 * Takes in one file with its receipt line (door.md §forma-answer, §receipts): the new line beside the old, the file written
 * whole, then the old lines dropped.
 */
export async function takeIn(root, folder, name, bytes, fields) {
  const receipt = await readReceipt(root, folder);
  const previous = linesFor(receipt, name);
  const line = newLine({ ...fields, file: name, sha256: sha256(bytes) }, previous);
  const others = receipt.lines.filter((l) => l.value.file !== name).map((l) => l.value);
  await writeReceipt(root, folder, [...others, ...previous.map((l) => l.value), line]);
  await writeWhole(root, `${folder}/${name}`, bytes);
  await writeReceipt(root, folder, [...others, line]);
  return line;
}

/** Removes one file Forma took in, then its lines (door.md §forma-answer, §receipts); the receipt goes with its last line. */
export async function takeOut(root, folder, name) {
  await removeFile(root, `${folder}/${name}`);
  const receipt = await readReceipt(root, folder);
  await writeReceipt(root, folder, receipt.lines.filter((l) => l.value.file !== name).map((l) => l.value));
}

/** Rewrites a folder's receipt with `edit` applied to each line, null dropping it (door.md §repair-answer, models.md §parts-change). */
export async function rewriteReceipt(root, folder, edit) {
  const receipt = await readReceipt(root, folder);
  const values = receipt.lines.map((l) => edit(l.value)).filter(Boolean).map((value) => ordered(value, LINE_KEYS));
  for (const value of values) {
    const why = lineReason(jsonLine(value));
    if (why) throw new Error(`a receipt line Forma would write does not parse: ${why}`);
  }
  await writeReceipt(root, folder, values);
}
