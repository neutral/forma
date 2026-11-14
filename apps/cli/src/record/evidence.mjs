// Evidence: a question's bounds and their digest (evidence.md §bounds), its name and its evidence's
// path (evidence.md §question-names), a surprise's name and stem and the files sharing it (evidence.md §stems), the evidence file's keys
// and its own check (evidence.md §evidence-file, §own-check), and the Explain answer's explain.md (evidence.md §explain). What runs, and when
// evidence is written, is ../evidence/run.mjs's; this module reads and writes the files.

import { basisDigest, digestHolds, hex12, inOrder, isSha256, isTime, ordered, sealed, sha256, sortedBy } from './json.mjs';
import { readBlocks, readFields, readList, Reasons } from './pages.mjs';
import { isKey, modelsPath } from './tree.mjs';
import { claimBounds } from './models.mjs';

/** The outcomes a run finds (evidence.md §outcomes). */
const OUTCOMES = ['no violation', 'violation', 'reached', 'not reached', 'enabled', 'not enabled', 'admitted', 'refused', 'unanswered'];

/** The keys of a question's evidence, in the order evidence.md §keys lists them. */
const EVIDENCE_KEYS = ['name', 'kind', 'expected', 'bounds', 'limits', 'basis', 'found', 'matches', 'measures', 'flags', 'cases', 'trace', 'rendered', 'established', 'previous', 'digest'];
/** A surprise's keys (evidence.md §surprise-file): evidence.md §keys's, `question` after `name`, `held` after `basis`, and no `previous`. */
const SURPRISE_KEYS = ['name', 'question', 'kind', 'expected', 'bounds', 'limits', 'basis', 'held', 'found', 'matches', 'measures', 'flags', 'cases', 'trace', 'rendered', 'established', 'digest'];
/** A reduction's keys (evidence.md §keys). */
const REDUCTION_KEYS = ['name', 'kind', 'reduces', 'bounds', 'limits', 'basis', 'found', 'measures', 'trace', 'rendered', 'established', 'digest'];
/** A weaker form's evidence's keys (evidence.md §keys). */
const WEAKER_KEYS = ['name', 'kind', 'weakens', 'bounds', 'limits', 'basis', 'found', 'measures', 'trace', 'rendered', 'established', 'digest'];
/** A basis's keys (evidence.md §basis). */
export const BASIS_KEYS = ['files', 'entries', 'engine', 'runtime', 'library', 'forma'];
/** A run's measures (evidence.md §measures), in the order it lists them. */
export const MEASURE_KEYS = ['duration', 'states', 'depth', 'scope', 'steps', 'bitwidth', 'combinations'];
/** The measures evidence holds on each engine (evidence.md §measures): `duration` and that engine's own, each once and no other. */
const ENGINE_MEASURES = Object.freeze({ tlc: ['duration', 'states', 'depth'], alloy: ['duration', 'scope', 'steps', 'bitwidth'], lifecycle: ['duration', 'combinations'] });

const REQUIRED = {
  evidence: ['name', 'kind', 'expected', 'bounds', 'limits', 'basis', 'found', 'measures', 'flags', 'established', 'previous', 'digest'],
  surprise: ['name', 'question', 'kind', 'expected', 'bounds', 'limits', 'basis', 'held', 'found', 'matches', 'measures', 'flags', 'established', 'digest'],
  reduction: ['name', 'kind', 'reduces', 'bounds', 'limits', 'basis', 'found', 'measures', 'established', 'digest'],
  'weaker-evidence': ['name', 'kind', 'weakens', 'bounds', 'limits', 'basis', 'found', 'measures', 'established', 'digest'],
};
const ORDER = { evidence: EVIDENCE_KEYS, surprise: SURPRISE_KEYS, reduction: REDUCTION_KEYS, 'weaker-evidence': WEAKER_KEYS };

// --- Bounds (evidence.md §bounds) -------------------------------------------------------------------------------

/** A bound's cell normalized as evidence.md §bounds normalizes it, whitespace and spacing outside double-quoted strings. */
export function normalizeBound(text) {
  const source = String(text);
  // The text as pieces outside and inside double-quoted strings; only the pieces outside change.
  const pieces = [];
  let outside = '';
  for (let at = 0; at < source.length; at += 1) {
    if (source[at] !== '"') {
      outside += source[at];
      continue;
    }
    let end = at + 1;
    while (end < source.length && source[end] !== '"') end += source[end] === '\\' ? 2 : 1;
    pieces.push({ string: false, text: outside }, { string: true, text: source.slice(at, end + 1) });
    outside = '';
    at = end;
  }
  pieces.push({ string: false, text: outside });
  const outer = pieces.filter((p) => !p.string);
  // Every run of whitespace, as design.md §passages reads it, Unicode's White_Space property, becomes one space (evidence.md §bounds).
  for (const piece of outer) piece.text = piece.text.replace(/\p{White_Space}+/gu, ' ');
  pieces[0].text = pieces[0].text.replace(/^ /, '');
  pieces[pieces.length - 1].text = pieces[pieces.length - 1].text.replace(/ $/, '');
  for (const piece of outer) piece.text = piece.text.replace(/\{ /g, '{').replace(/ \}/g, '}').replace(/ ,/g, ',').replace(/ ?\.\. ?/g, '..').replace(/,(?! )/g, ', ');
  return pieces.map((p) => p.text).join('');
}

/**
 * A question's bounds (evidence.md §bounds) on a parsed model, each `{ bound, value }` normalized and sorted, a liveness
 * claim's leaving a TLC constraint out; `'phase level'` on a lifecycle model.
 */
export function questionBounds(model, claimKind = null) {
  if (model.engine === 'lifecycle') return 'phase level';
  return sortedBy(claimBounds(model, claimKind).map((b) => ({ bound: normalizeBound(b.bound), value: normalizeBound(b.value) })), (b) => `${b.bound} = ${b.value}`);
}

/** A question's bounds digest (evidence.md §bounds): the first twelve hexadecimal digits of the SHA-256 of its bounds' lines, sorted in byte order, each ending in a line feed. */
export function boundsDigest(bounds) {
  const lines = sortedBy(bounds.map((b) => `${b.bound} = ${b.value}`));
  return hex12(lines.map((line) => `${line}\n`).join(''));
}

/** A question's bounds as its evidence writes them (evidence.md §keys): an object from each bound to its value, in byte order; or `"phase level"`. */
export function boundsObject(bounds) {
  if (bounds === 'phase level') return 'phase level';
  return Object.fromEntries(sortedBy(bounds, (b) => b.bound).map((b) => [b.bound, b.value]));
}

// --- Names and paths (evidence.md §question-names, §stems) ---------------------------------------------------------------------

/**
 * A question's name (evidence.md §question-names), from `{ model, holder, thingKind, key, kind, digest, slot, polarity, step,
 * variant, part, action, row, item }` as its kind needs them.
 */
export function questionName(q) {
  const d = q.digest ? `.${q.digest}` : '';
  const thing = () => `${q.model}/${q.holder.span ? 'spans' : 'parts'}/${q.holder.key}/${q.thingKind}/${q.key}`;
  switch (q.kind) {
    case 'base': return `${thing()}/base${d}`;
    case 'witness': case 'fault': return `${thing()}/${q.kind}-${q.slot}${d}`;
    case 'path': return q.polarity === 'must not' ? `${thing()}/path-to-${q.step}${d}` : `${thing()}/path${d}`;
    case 'refusal': return `${thing()}/refusal-at-${q.step}${d}`;
    case 'start': return `${thing()}/start${d}`;
    case 'lifecycle-path': return `${thing()}/${q.variant === 'to' ? `lifecycle-path-to-${q.step}` : q.variant === 'refused-at' ? `lifecycle-path-refused-at-${q.step}` : 'lifecycle-path'}`;
    case 'enabled': return q.item ? `${q.model}/world/${q.part}/${q.row}/${q.item}.enabled${d}` : `${q.model}/actions/${q.part}/${q.action}${d}`;
    case 'misbehaviour': return `${q.model}/world/${q.part}/${q.row}/${q.item}${d}`;
    case 'phases': case 'facts': return `${q.model}/${q.kind}${d}`;
    default: throw new Error(`no question of kind ${q.kind} has a name of its own`);
  }
}

/** The evidence file of a question by its name (evidence.md §question-names). */
export const evidencePath = (name) => `models/${name}.json`;

/** A surprise's name (evidence.md §stems): its question's name, `.surprise-` and the first twelve hexadecimal digits of its basis digest. */
export const surpriseName = (question, digest) => `${question}.surprise-${digest.slice(0, 12)}`;

/** A surprise's file (evidence.md §stems), which is also its stem with `.json`. */
export const surprisePath = (name) => `models/${name}.json`;

/** The files that share a surprise's stem (evidence.md §stems), by path: its reductions' evidence, its weaker forms and their evidence, its explanation. */
export const stemFiles = {
  reduction: (surprise, n) => `models/${surprise}.reduction-${n}.json`,
  weaker: (surprise, key, extension) => `models/${surprise}.weaker-${key}.${extension}`,
  weakerEvidence: (surprise, key) => `models/${surprise}.weaker-${key}.json`,
  explanation: (surprise) => `models/${surprise}.explained.md`,
};

/** A question's name from its evidence file's path, or a surprise's, reduction's or weaker form's name from its file's path: the path under models/ without `.json`. */
export const nameOfPath = (path) => path.replace(/^models\//, '').replace(/\.json$/, '');

// --- The evidence file and its own check (evidence.md §evidence-file) ---------------------------------------------------------

/** Why a basis is not in evidence.md §basis's form; null when it is. */
function basisReason(basis, engine) {
  if (!basis || typeof basis !== 'object' || Array.isArray(basis)) return 'its basis is not an object';
  const keys = Object.keys(basis);
  let last = -1;
  for (const key of keys) {
    const at = BASIS_KEYS.indexOf(key);
    if (at === -1 || at < last) return `its basis holds ${key} out of evidence.md §basis's keys or their order`;
    last = at;
  }
  for (const key of ['files', 'entries', 'engine', 'runtime', 'forma']) if (!Object.hasOwn(basis, key)) return `its basis has no ${key}`;
  if (!Array.isArray(basis.files) || !basis.files.every((f) => f && typeof f === 'object' && isSha256(f.sha256) && ((typeof f.path === 'string' && Object.keys(f).join(',') === 'path,sha256') || (typeof f.generated === 'string' && Object.keys(f).join(',') === 'generated,sha256')))) return "its basis's files are not { path, sha256 } or { generated, sha256 }";
  const projectFiles = basis.files.filter((f) => Object.hasOwn(f, 'path'));
  const generated = basis.files.filter((f) => Object.hasOwn(f, 'generated'));
  if (basis.files.indexOf(generated[0]) !== -1 && basis.files.slice(0, projectFiles.length).some((f) => Object.hasOwn(f, 'generated'))) return "its basis lists a generated file before a project file";
  if (sortedBy(projectFiles, (f) => f.path).some((f, at) => f !== projectFiles[at]) || sortedBy(generated, (f) => f.generated).some((f, at) => f !== generated[at])) return "its basis's files are not in byte order";
  if (!Array.isArray(basis.entries) || !basis.entries.every((e) => e && typeof e === 'object' && Object.keys(e).join(',') === 'entry,pin' && typeof e.entry === 'string' && isSha256(e.pin))) return "its basis's entries are not { entry, pin }";
  if (sortedBy(basis.entries, (e) => e.entry).some((e, at) => e !== basis.entries[at])) return "its basis's entries are not in byte order of entry";
  const named = (value) => value && typeof value === 'object' && Object.keys(value).join(',') === 'name,version' && typeof value.name === 'string' && typeof value.version === 'string';
  if (!named(basis.engine) || !['tlc', 'alloy', 'lifecycle'].includes(basis.engine.name)) return "its basis's engine is not { name, version } of tlc, alloy or lifecycle";
  if (engine && basis.engine.name !== engine) return `its basis's engine is ${basis.engine.name}, and its model's is ${engine}`;
  if (!named(basis.runtime)) return "its basis's runtime is not { name, version }";
  if (basis.engine.name === 'lifecycle' ? !named(basis.library) : Object.hasOwn(basis, 'library')) return 'its basis names a library for the lifecycle engine only, and there always';
  if (!basis.forma || typeof basis.forma !== 'object' || Object.keys(basis.forma).join(',') !== 'version,source' || typeof basis.forma.version !== 'string' || typeof basis.forma.source !== 'string') return "its basis's forma is not { version, source }";
  return null;
}

/**
 * A file at an evidence path checked as evidence.md §own-check checks it: `{ value, reasons }`, a file with reasons
 * counting for nothing (door.md §change).
 */
export function readEvidence(path, text, where = modelsPath(path)) {
  const reasons = new Reasons(path, 'evidence.md §own-check');
  const fail = (says, check = 'evidence.md §own-check') => reasons.fail(null, null, says, check);
  const held = digestHolds(text);
  if (!held.ok) {
    fail(held.says);
    return { value: null, reasons: reasons.list };
  }
  const value = held.value;
  const shape = where.kind;
  const order = ORDER[shape];
  const keys = Object.keys(value);
  let last = -1;
  for (const key of keys) {
    const at = order.indexOf(key);
    if (at === -1) fail(`it holds the key ${key}, which no ${shape === 'evidence' ? 'evidence' : shape} holds`, 'evidence.md §keys');
    else if (at < last) fail(`its key ${key} is out of evidence.md §keys's order`, 'evidence.md §keys');
    last = Math.max(last, at);
  }
  for (const key of REQUIRED[shape]) if (!Object.hasOwn(value, key)) fail(`it has no ${key}`, 'evidence.md §keys');
  const name = nameOfPath(path);
  if (value.name !== name) fail(`its name is ${JSON.stringify(value.name)}, and its path gives ${name}`);
  const kind = shape === 'reduction' ? 'reduction' : shape === 'weaker-evidence' ? 'weaker' : where.question.kind;
  if (value.kind !== kind) fail(`its kind is ${JSON.stringify(value.kind)}, and its path gives ${kind}`);
  if (shape === 'surprise' && value.question !== `${where.model}/${pathTail(path, where.base)}`) fail(`its question is ${JSON.stringify(value.question)}, and its path gives ${where.model}/${pathTail(path, where.base)}`);
  if (shape === 'reduction' && value.reduces !== `${where.model}/${pathTail(path, where.stem)}`) fail(`it reduces ${JSON.stringify(value.reduces)}, and its path gives ${where.model}/${pathTail(path, where.stem)}`);
  if (shape === 'weaker-evidence' && value.weakens !== `${where.model}/${pathTail(path, where.stem)}`) fail(`it weakens ${JSON.stringify(value.weakens)}, and its path gives ${where.model}/${pathTail(path, where.stem)}`);
  const engine = isLifecycle(where.model) ? 'lifecycle' : null;
  const why = basisReason(value.basis, engine);
  if (why) fail(why, 'evidence.md §basis');
  const found = foundReason(value.found, shape === 'evidence' || shape === 'surprise' ? where.question : null);
  if (found) fail(found, 'evidence.md §keys');
  // The bounds as evidence.md §bounds writes them; on TLC and Alloy, their digest is the one the name holds (evidence.md §question-names): another bound is
  // another question. A reduction runs at its own bounds, under its surprise's name.
  const boundsWhy = boundsReason(value.bounds, where.question?.digest ?? null, shape === 'reduction');
  if (boundsWhy) fail(boundsWhy, 'evidence.md §bounds');
  // A question's expected outcome is fixed by its kind (evidence.md §questions); matches says whether what it found is that (evidence.md §keys).
  if (shape === 'evidence' || shape === 'surprise') {
    const expected = expectedOf(where.question);
    if (JSON.stringify(value.expected) !== JSON.stringify(expected)) fail(`its expected is ${JSON.stringify(value.expected)}, and its question, ${where.question.kind}, expects ${JSON.stringify(expected)}`, 'evidence.md §questions');
    // Whether it answered, and whether what it found is what it expects, are read from its outcome even where the rest
    // of its found is out of form, so a violation without its property marked as matching gives both reasons (door.md §forma-answer).
    else if (!why && value.found && typeof value.found === 'object' && OUTCOMES.includes(value.found.outcome)) {
      const answered = value.found.outcome !== 'unanswered';
      if (answered !== Object.hasOwn(value, 'matches')) fail(answered ? 'it answered and holds no matches' : 'it did not answer, and holds matches, which only an answer holds', 'evidence.md §keys');
      else if (answered && value.matches !== matchesOf(expected, value.found, value.basis.engine.name)) fail(`its matches is ${JSON.stringify(value.matches)}, and what it found ${value.matches ? 'is not' : 'is'} what it expects`, 'evidence.md §keys');
    }
    if (shape === 'surprise' && value.matches !== false) fail('a surprise is evidence that answered and does not match, so its matches is false', 'evidence.md §surprise-file');
  }
  // A surprise's name ends in the first twelve digits of its basis digest (evidence.md §stems).
  if (shape === 'surprise' && !why && basisDigest(value.basis).slice(0, 12) !== where.stem.slice(-12)) fail(`its name ends in ${where.stem.slice(-12)}, and its basis digest begins ${basisDigest(value.basis).slice(0, 12)}`, 'evidence.md §stems');
  if (Object.hasOwn(value, 'established') && !isTime(value.established)) fail('its established is not a time written YYYY-MM-DDTHH:MM:SS.sssZ', 'evidence.md §keys');
  if (value.previous !== undefined && value.previous !== null && !(typeof value.previous === 'object' && isTime(value.previous.until))) fail("its previous is neither null nor a found with its until", 'evidence.md §keys');
  if (Object.hasOwn(value, 'flags') && !(Array.isArray(value.flags) && value.flags.every((f) => typeof f === 'string'))) fail('its flags are not a list', 'evidence.md §flags');
  if (!why) {
    const measures = measuresReason(value.measures, value.basis.engine.name);
    if (measures) fail(measures, 'evidence.md §measures');
  }
  if (shape === 'surprise' && Object.hasOwn(value, 'held')) {
    const held = heldReason(value.held);
    if (held) fail(held, 'evidence.md §surprise-file');
  }
  // `digested` is the value wherever its digest holds, whatever else fails, for the times it holds (door.md §clock).
  return reasons.list.length ? { value: null, reasons: reasons.list, digested: value } : { value, reasons: [], digested: value };
}

const isLifecycle = (model) => model.startsWith('lifecycles-');

/**
 * Why `found` is not in evidence.md §keys's form; null when it is: its outcome, then `property` for a violation, `step`
 * for refused, `reason` for unanswered, and for a should-happen journey's path's `not reached` where evidence.md §outcomes gives one.
 * `question` is the question its path names, as tree.mjs reads it.
 */
const END_REASON = /^the expected end does not hold after step [1-9][0-9]*$/;
function foundReason(found, question = null) {
  if (!found || typeof found !== 'object' || Array.isArray(found) || !OUTCOMES.includes(found.outcome)) return 'its found is not { outcome, … } of one of the outcomes evidence.md §outcomes gives';
  const ended = found.outcome === 'not reached' && Object.hasOwn(found, 'reason') && question?.kind === 'path' && question.variant === 'path';
  if (ended && !END_REASON.test(String(found.reason))) return "its found's reason is not the one evidence.md §outcomes gives a path's not reached, the expected end does not hold after step <n>";
  const more = { violation: 'property', refused: 'step', unanswered: 'reason' }[found.outcome] ?? (ended ? 'reason' : undefined);
  const want = more ? ['outcome', more] : ['outcome'];
  if (Object.keys(found).join(',') !== want.join(',')) return `its found holds ${Object.keys(found).join(', ')}, and a found of ${found.outcome} holds ${want.join(', ')}`;
  if (more === 'step' ? !Number.isInteger(found.step) || found.step < 0 : more && (typeof found[more] !== 'string' || found[more] === '')) return `its found's ${more} is not ${more === 'step' ? 'a step number' : 'text'}`;
  return null;
}

/** Why `bounds` are not as evidence.md §bounds, §keys write them; null when they are. `digest` is the one the name holds, null on the lifecycle engine. */
function boundsReason(bounds, digest, own) {
  if (digest === null && !own) return bounds === 'phase level' ? null : 'its bounds are not "phase level", as every lifecycle engine question\'s are';
  if (bounds === null || typeof bounds !== 'object' || Array.isArray(bounds)) return 'its bounds are not an object from each bound to its value';
  const entries = Object.entries(bounds);
  if (!entries.every(([b, v]) => typeof v === 'string' && normalizeBound(b) === b && normalizeBound(v) === v)) return 'its bounds are not each written as evidence.md §bounds normalizes them';
  if (!inOrder(entries, ([b]) => b)) return 'its bounds are not in byte order';
  if (!own && boundsDigest(entries.map(([bound, value]) => ({ bound, value }))) !== digest) return `its bounds' digest is ${boundsDigest(entries.map(([bound, value]) => ({ bound, value })))}, and its name holds ${digest}: another bound is another question`;
  return null;
}

/** A question's expected outcome, fixed by its kind (evidence.md §questions, §lifecycle-journeys, §keys), from its file's name as tree.mjs reads it. */
function expectedOf(question) {
  const outcome = { base: 'no violation', witness: 'reached', fault: 'caught', misbehaviour: 'reached', enabled: 'reached', start: 'reached', phases: 'no violation', facts: 'reached', path: 'reached', refusal: 'not enabled' }[question.kind];
  if (question.kind === 'lifecycle-path') {
    if (question.variant === 'refused-at') return { outcome: 'refused', step: question.step };
    return question.variant === 'to' ? { outcome: 'admitted', step: question.step } : { outcome: 'admitted' };
  }
  if (question.kind === 'refusal' || (question.kind === 'path' && question.variant === 'to')) return { outcome, step: question.step };
  return { outcome };
}

/** Whether what a run found is what its question expects (evidence.md §keys): `caught` a violation of the encoding's own property, `refused` at the expected step. */
function matchesOf(expected, found, engine) {
  if (expected.outcome === 'caught') return found.outcome === 'violation' && ({ tlc: ['Invariant', 'Property'], alloy: ['Claim'], lifecycle: ['forbidden form'] }[engine] ?? []).includes(found.property);
  if (expected.outcome === 'refused') return found.outcome === 'refused' && found.step === expected.step;
  return found.outcome === expected.outcome;
}

/**
 * Why `measures` are not in evidence.md §measures's form on `engine`; null when they are: `duration` and the engine's own
 * measures, each once, in evidence.md §measures's order, and no other, each a number or null, `steps` `[least, most]` or null.
 */
function measuresReason(measures, engine) {
  if (measures === null || typeof measures !== 'object' || Array.isArray(measures)) return 'its measures are not an object';
  const want = ENGINE_MEASURES[engine] ?? ['duration'];
  if (Object.keys(measures).join(',') !== want.join(',')) return `its measures are ${Object.keys(measures).join(', ') || 'none'}, and evidence on ${engine} holds ${want.join(', ')}, each once and no other`;
  for (const [key, value] of Object.entries(measures)) {
    const fits = key === 'steps' ? value === null || (Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === 'number' || n === null)) : value === null || typeof value === 'number';
    if (!fits) return `its measure ${key} is not ${key === 'steps' ? '[least, most] or null' : 'a number or null'}`;
  }
  return null;
}

/** Why a surprise's `held` is not in evidence.md §surprise-file's form; null when it is: a list of `{ path, sha256 }`, each once, in byte order of path. */
function heldReason(held) {
  if (!Array.isArray(held) || !held.every((f) => f && typeof f === 'object' && !Array.isArray(f) && Object.keys(f).join(',') === 'path,sha256' && typeof f.path === 'string' && f.path !== '' && isSha256(f.sha256))) return 'its held is not a list of { path, sha256 }';
  if (!inOrder(held, (f) => f.path)) return 'its held is not each path once, in byte order of path';
  return null;
}

/** The path of a file's folder under its model, joined to `base`, a file name without its extension. */
function pathTail(path, base) {
  const parts = path.split('/');
  return [...parts.slice(2, -1), base].join('/');
}

/** Every time evidence holds (door.md §clock): its `established` and its previous `until`. */
export const evidenceTimes = (value) => [value?.established, value?.previous?.until].filter((t) => isTime(t));

/**
 * The bytes of evidence, a surprise, or a reduction's or weaker form's evidence (evidence.md §own-check), its keys
 * in evidence.md §keys's order and its digest sealed; `shape` is `evidence`, `surprise`, `reduction` or `weaker-evidence`.
 */
export function evidenceText(value, shape = 'evidence') {
  const keyed = (object, keys) => (object && typeof object === 'object' && !Array.isArray(object) ? ordered(object, keys) : object);
  const held = Array.isArray(value.held) ? sortedBy(value.held.map((f) => ({ path: f.path, sha256: f.sha256 })), (f) => f.path) : value.held;
  const inner = { ...value, basis: keyed(value.basis, BASIS_KEYS), held, measures: keyed(value.measures, MEASURE_KEYS), digest: '' };
  return sealed(ordered(inner, ORDER[shape])).text;
}

// --- The Explain answer's explain.md (evidence.md §explain) ---------------------------------------------------------

const VERDICTS = ['model wrong', 'property wrong', 'abstraction too coarse', 'real finding'];
const LEVELS = ['implementation', 'specification', 'requirement'];

/** explain.md in evidence.md §explain's form: `{ explanation, reasons }`. */
export function parseExplain(text, path = 'explain.md') {
  const check = 'evidence.md §explain';
  const reasons = new Reasons(path, check);
  const fail = (field, says) => reasons.fail(null, field, says, check);
  const blocks = readBlocks(text);
  const explanation = { question: '', basis: '', verdict: '', level: '', weaker: [], sections: {} };
  const fields = readFields(blocks[0], ['Question', 'Basis', 'Verdict', 'Level', 'Weaker'], reasons, { check });
  if (!fields) {
    fail(null, 'explain.md begins with its field table');
    return { explanation, reasons: reasons.list };
  }
  explanation.question = fields.Question ?? '';
  explanation.basis = fields.Basis ?? '';
  if (fields.Basis !== undefined && !/^[0-9a-f]{12}$/.test(explanation.basis)) fail('Basis', "Basis is the first twelve hexadecimal digits of the surprise's basis digest");
  explanation.verdict = fields.Verdict ?? '';
  if (fields.Verdict !== undefined && !VERDICTS.includes(explanation.verdict)) fail('Verdict', `the verdict is one of ${VERDICTS.join(', ')}`);
  explanation.level = fields.Level ?? '';
  if (fields.Level !== undefined && !LEVELS.includes(explanation.level)) fail('Level', `the level is one of ${LEVELS.join(', ')}`);
  const weaker = readList(fields.Weaker ?? 'none');
  if (weaker === null) fail('Weaker', "Weaker lists the weaker forms' keys separated by \", \", or is none");
  explanation.weaker = weaker ?? [];
  for (const key of explanation.weaker) if (!isKey(key)) fail('Weaker', `${key} is not a key`);
  if (new Set(explanation.weaker).size !== explanation.weaker.length) fail('Weaker', 'each weaker form is named once');
  const wanted = ['Trace', 'Failure shape', 'Mechanism'];
  const sections = [];
  for (const block of blocks.slice(1)) {
    if (block.type === 'heading' && block.level <= 2) sections.push({ name: block.level === 2 ? block.text : null, blocks: [] });
    else if (!sections.length) fail(null, `line ${block.line} stands between the field table and ## Trace`);
    else sections[sections.length - 1].blocks.push(block);
  }
  if (sections.map((s) => s.name).join('\n') !== wanted.join('\n')) fail(null, 'after its field table explain.md holds ## Trace, ## Failure shape and ## Mechanism, in that order, and nothing else at level 2 or above');
  for (const section of sections) {
    if (!section.blocks.length) fail(section.name, `## ${section.name} holds text`);
    if (section.name) explanation.sections[section.name] = section.blocks;
  }
  return { explanation, reasons: reasons.list };
}

/** A surprise's basis digest, its first twelve digits as its name holds them (evidence.md §stems, §basis). */
export const surpriseDigest = (value) => basisDigest(value.basis);
