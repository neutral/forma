// A Repair answer's checks (door.md §repair-answer; models.md §model-repair; decisions.md §expects), and the marks every answer
// leaves on the receipt lines of the files that make or meet a repair: `answers`, `before` and, for
// a Repair answer, its decision with its mechanism in `mechanisms`, on each file written; and
// `answers` with `removed`, and a Repair answer's `mechanisms`, on the line of a part's, span's or
// design/README.md, or a model's model.md, for what a repair took away by removing.

import { posix } from 'node:path';
import { checkRestate } from '../design/restate.mjs';
import { removedSlotEvidence } from '../evidence/run.mjs';
import { isOfferedJourney } from '../record/decisions.mjs';
import { sha256, sortedBy } from '../record/json.mjs';
import { isProperty, parseSlot } from '../record/models.mjs';
import { assemble, checkRestatement, coverage, parsePage, readBlocks, readFields, Reasons, spansOf, thingParts } from '../record/pages.mjs';
import { pins } from '../record/pins.mjs';
import { mechanismsSorted } from '../record/receipts.mjs';
import { designPath, isLifecycleModel, modelsPath } from '../record/tree.mjs';
import { reason } from './common.mjs';
import { changes, checkModelAnswer, checkSlotAnswer, freezeReasons } from './model-answers.mjs';
import { questionPlace, ruledRows } from './repair.mjs';

const textOf = (bytes) => Buffer.from(bytes).toString('utf8');

/** The kinds of file under models/ that an answer holds, each with a receipt line (door.md §receipts), as tree.mjs names them. */
const ANSWERED = new Set(['model-md', 'engine', 'slot', 'explanation', 'weaker']);

/** `repair.md` read (door.md §repair-answer): `{ mechanism, reasons }`, one field table with the one row `Mechanism`, and nothing else. */
function parseRepairMd(bytes) {
  const check = 'door.md §repair-answer';
  const reasons = new Reasons('repair.md', check);
  if (bytes === undefined) return { mechanism: null, reasons: [reason(check, 'repair.md', null, null, 'a Repair answer holds repair.md')] };
  const text = textOf(bytes);
  const blocks = readBlocks(text);
  if (blocks.length !== 1 || blocks[0].type !== 'table') {
    reasons.fail(null, null, 'repair.md is one field table, | Field | Value |, with exactly one row, Mechanism, and holds nothing else');
    return { mechanism: null, reasons: reasons.list };
  }
  const fields = readFields(blocks[0], ['Mechanism'], reasons, { check });
  const mechanism = fields?.Mechanism?.trim() || null;
  if (fields && !mechanism && !reasons.list.length) reasons.fail(null, 'Mechanism', 'the Mechanism says what the repair adds or changes, in the developer\'s terms');
  return { mechanism, reasons: reasons.list };
}

/**
 * The restatement after writing `writes` and removing `removes` (design.md §restate-applied), read as readProject reads one, for
 * what a repair expects of pins and for slots checked against lifecycle pages an answer rewrites.
 */
function restatementAfter(project, writes, removes = []) {
  const gone = new Set(removes);
  const written = new Map(writes.filter((w) => w.path.startsWith('design/')).map((w) => [w.path, w.bytes]));
  const records = [];
  const read = (path, where, text) => {
    const parsed = parsePage(path, where, text);
    return { path, where, exists: true, counts: parsed.reasons.length === 0, page: parsed.reasons.length ? null : parsed.page };
  };
  for (const [path, record] of project.files) {
    if (record.where.kind !== 'page' || gone.has(path) || written.has(path)) continue;
    records.push(record.counts ? read(path, record.where, record.bytes.toString('utf8')) : { path, where: record.where, exists: true, counts: false, page: null });
  }
  for (const [path, bytes] of written) records.push(read(path, designPath(path), textOf(bytes)));
  records.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const restatement = assemble(records);
  const { failures, refs } = checkRestatement(restatement, project.brief);
  restatement.failures = failures;
  restatement.refs = refs;
  restatement.thingParts = new Map([...restatement.things.values()].map((thing) => [thing.entry, thingParts(restatement, thing)]));
  restatement.spanPairs = spansOf(restatement);
  restatement.coverage = coverage(restatement, project.brief);
  restatement.pins = pins(restatement, project.brief);
  return restatement;
}

/** The claims a ruling's surprises are on, each with the pin the ruled surprise read for it (decisions.md §rulings `## Surprises`). */
function ruledClaims(project, decision) {
  const out = new Map();
  for (const row of ruledRows(decision)) {
    const place = questionPlace(row.question);
    if (place.where.thing?.kind !== 'claims') continue;
    const read = decision.surprises.entries.find((e) => e.surprise === row.surprise && e.entry === place.entry)?.pin ?? project.restatement.pins.entries.get(place.entry)?.pin ?? null;
    if (!out.has(place.entry)) out.set(place.entry, { entry: place.entry, pin: read, models: new Set() });
    out.get(place.entry).models.add(place.model);
  }
  return [...out.values()];
}

/** The models a ruling's surprises ran on (decisions.md §rulings `## Surprises`). */
const ranOn = (decision) => new Set(ruledRows(decision).map((row) => questionPlace(row.question).model));

/**
 * The files a ruling's surprises' questions read (models.md §model-repair): their bases' files, from each question's evidence and
 * each surprise file still there; with `model`, only of the surprises that ran on it.
 */
function filesRead(project, decision, model = null) {
  const paths = new Set();
  for (const row of ruledRows(decision)) {
    if (model !== null && questionPlace(row.question).model !== model) continue;
    const evidence = project.files.get(`models/${row.question}.json`);
    for (const f of evidence?.value?.basis?.files ?? []) if (f.path) paths.add(f.path);
    for (const f of project.surprises.get(row.surprise)?.value?.basis?.files ?? []) if (f.path) paths.add(f.path);
  }
  return paths;
}

/** The parts and spans a ruling's `## Surprises` records (decisions.md §rulings). */
const recordedParts = (decision) => [...new Set(ruledRows(decision).flatMap((r) => String(r.parts ?? '').split(',').map((p) => p.trim()).filter(Boolean)))];

/** A file's bytes changed by an answer: written with other bytes than it has, new, or removed. */
const changed = (project, writes, removes) => {
  const out = new Set(removes.filter((p) => !p.endsWith('/')));
  for (const w of writes) if (project.files.get(w.path)?.sha256 !== sha256(w.bytes)) out.add(w.path);
  return out;
};

const folderOf = (path) => path.slice(0, path.lastIndexOf('/'));

/**
 * A Repair on a model's `removed.md` read (models.md §model-repair, Removals): `{ removes, reasons }`, `removes` the slot files it
 * names. One slot file a line, by its path from the project folder, each once, each a filled slot of the model (its
 * file has a receipt line that matches it, models.md §slot-currency) of a claim, journey or world row that a slot the answer holds serves,
 * and none a file the answer holds. An empty removed.md removes nothing (door.md §answer-holds).
 */
function removedSlots(project, route, bytes, held) {
  const check = 'models.md §model-repair';
  const reasons = [];
  const removes = [];
  const lines = textOf(bytes).split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const served = new Set([...held.keys()].filter((path) => modelsPath(path).kind === 'slot').map(folderOf));
  const seen = new Set();
  lines.forEach((line, at) => {
    const fail = (says) => reasons.push(reason(check, 'removed.md', null, null, `line ${at + 1}, "${line}": ${says}`));
    if (line === '') return fail('a line of removed.md names one slot file, and this one is empty');
    const where = modelsPath(line);
    if (where.kind !== 'slot') return fail(`it is not the path of a slot file: a Repair of a model names in removed.md each slot file of the model it removes, by its path from the project folder (models/${route.model}/…), one a line, with nothing around it`);
    if (where.model !== route.model) return fail(`it is a slot of the model ${where.model}, and a Repair of ${route.model} removes slots of that model only`);
    if (seen.has(line)) return fail('it is named twice, and removed.md names each slot once');
    seen.add(line);
    if (held.has(line)) return fail('the answer holds this file, and removed.md names none it holds');
    if (!project.slots.get(line)?.entry) return fail('no filled slot is at this path: a slot is filled when its file has a receipt line that matches it');
    if (!served.has(folderOf(line))) return fail('no slot the answer holds serves the claim, journey or world row this slot serves, and a Repair removes slots only of what a slot it holds serves');
    removes.push(line);
  });
  return { removes, reasons };
}

/**
 * What removals leave of each claim whose slot they take (models.md §model-repair): reasons when one would lose its last encoding
 * on the model, or, while its encoding there after the answer is a property, its last witness or fault. `state` is the
 * model as the answer leaves it, `writes` the files the answer writes, `others` what else it removes.
 */
function lastSlotReasons(project, route, state, named, writes, others) {
  const check = 'models.md §model-repair';
  const out = [];
  const gone = new Set([...named, ...others]);
  const claims = new Map();
  for (const path of named) {
    const where = modelsPath(path);
    if (where.thing?.kind !== 'claims') continue;
    if (!claims.has(folderOf(path))) claims.set(folderOf(path), { entry: `${where.holder.key}/claims/${where.thing.key}`, kinds: new Set() });
    claims.get(folderOf(path)).kinds.add(where.slot);
  }
  const engine = state?.engine ?? (route.lifecycle ? 'lifecycle' : null);
  for (const [folder, { entry, kinds }] of claims) {
    // The claim's slots after the answer: those filled now that it leaves, and those it writes.
    const after = new Map();
    for (const slot of project.slots.values()) if (folderOf(slot.path) === folder && slot.entry && !gone.has(slot.path)) after.set(slot.path, { kind: slot.kind, form: slot.form });
    for (const w of writes) {
      const where = modelsPath(w.path);
      if (where.kind !== 'slot' || folderOf(w.path) !== folder) continue;
      const form = where.slot === 'encoding' && engine ? parseSlot('encoding', where.extension, textOf(w.bytes), engine, w.path).form : null;
      after.set(w.path, { kind: where.slot, form });
    }
    const left = (kind) => [...after.values()].filter((s) => s.kind === kind);
    const property = left('encoding').some((s) => isProperty(s.form));
    if (kinds.has('encoding') && !left('encoding').length) out.push(reason(check, 'removed.md', entry, null, `the answer would leave the claim ${entry} with no encoding on ${route.model}, and a Repair removes no claim's last encoding there`));
    for (const kind of ['witness', 'fault']) {
      if (kinds.has(kind) && property && !left(kind).length) out.push(reason(check, 'removed.md', entry, null, `the answer would leave the claim ${entry} with no ${kind} on ${route.model} while its encoding there is a property, and a Repair removes no claim's last ${kind} there: it holds a new one beside the one it retires`));
    }
  }
  return out;
}

/**
 * A Repair answer checked (door.md §repair-answer): its `repair.md`; its files as its target's kind, the freeze included; that it
 * changes a file; and what its decision expects (decisions.md §expects) and its verdict's rules (models.md §model-repair). Gives
 * `{ refused }` or the plan the door takes in, with `mechanism` and `decision`.
 */
export async function checkRepair(account, { route, repair, files, item }) {
  const { project, design, evidence } = account;
  const refused = [];
  const { mechanism, reasons: mechanismReasons } = parseRepairMd(files.get('repair.md'));
  refused.push(...mechanismReasons);
  const held = new Map([...files].filter(([path]) => path !== 'repair.md'));
  const writes = [];
  const removes = [];
  let moves = [];
  let designAfter = null;
  let after = null;
  if (route.kind === 'restate') {
    // The restatement: checked and applied as a Restate answer (design.md §repairs-redirects), repair.md let through.
    const result = checkRestate(project, design, files, { repair: true });
    if (result.refused) refused.push(...result.refused);
    else {
      writes.push(...result.writes.map((w) => ({ ...w, fields: {} })));
      removes.push(...result.removes);
      moves = result.moves;
      designAfter = result.design;
      after = restatementAfter(project, writes, removes);
    }
  } else {
    const modelFiles = new Map([...held].filter(([path]) => ['model-md', 'engine'].includes(modelsPath(path).kind)));
    const pages = new Map([...held].filter(([path]) => path.startsWith('design/')));
    const slots = [...held].filter(([path]) => modelsPath(path).kind === 'slot');
    let state = evidence.models.get(route.model) ?? null;
    if (modelFiles.size) {
      // A TLC or Alloy model's files: checked as a Model answer's, check 7 aside (models.md §model-repair).
      const result = await checkModelAnswer(account, modelFiles, { repair: true });
      if (result.refused) refused.push(...result.refused);
      else {
        writes.push(...result.writes);
        removes.push(...result.removes, ...result.dropSlots, ...result.dropEvidence);
        const byName = Object.fromEntries(result.writes.filter((w) => modelsPath(w.path).kind === 'engine').map((w) => [w.path.slice(w.path.lastIndexOf('/') + 1), Buffer.from(w.bytes)]));
        state = { ...(state ?? {}), key: route.model, engine: result.model.engine, exists: true, usable: true, model: result.model, files: byName };
      }
    }
    if (pages.size) {
      // A lifecycle model's pages: its part's confirmed lifecycles, each checked as a Restate answer's (models.md §model-repair).
      const result = checkRestate(project, design, pages);
      if (result.refused) refused.push(...result.refused);
      else {
        writes.push(...result.writes.map((w) => ({ ...w, fields: {} })));
        removes.push(...result.removes);
        moves = result.moves;
        designAfter = result.design;
        after = restatementAfter(project, writes, removes);
      }
    }
    if (route.lifecycle && !state) state = { key: route.model, engine: 'lifecycle', exists: true, usable: true, model: { key: route.model, engine: 'lifecycle', parts: route.parts }, files: {} };
    for (const [path, bytes] of slots) {
      // Each slot as a Fill-a-slot answer's, against the model files as the answer leaves them; it need only exist by door.md §forma-answer.
      const result = await checkSlotAnswer(account, path, bytes, { repair: true, state, restatement: after });
      if (result.refused) refused.push(...result.refused);
      else {
        writes.push(...result.writes);
        removes.push(...result.removes);
      }
    }
    // At least one file of the model besides removed.md (door.md §repair-answer's table: "and at least one").
    if (!modelFiles.size && !pages.size && !slots.length) refused.push(reason('door.md §repair-answer', null, null, null, route.lifecycle ? `a Repair of the lifecycle model ${route.model} holds at least one of its slots or its part's confirmed lifecycle pages, and removed.md alone removes only beside a slot it holds` : `a Repair of the model ${route.model} holds at least one of its model files or slots, and removed.md alone removes only beside a slot it holds`));
    // Removals (models.md §model-repair): removed.md names slots of the model the answer removes, with their questions' evidence.
    // What a removal leaves of a claim is read from the answer as taken in, so it is asked once the rest has passed.
    if (held.has('removed.md')) {
      const named = removedSlots(project, route, held.get('removed.md'), held);
      refused.push(...named.reasons);
      if (!named.reasons.length && named.removes.length) {
        refused.push(...freezeReasons(project, named.removes, 'removes'));
        if (!refused.length) refused.push(...lastSlotReasons(project, route, state, named.removes, writes, removes));
        // Each slot named goes with its receipt line, and the evidence of each question it served (evidence.md §removed
        // item 3); an encoding the answer replaces is among its removals already.
        for (const path of [...named.removes, ...removedSlotEvidence(project, named.removes)]) if (!removes.includes(path)) removes.push(path);
      }
    }
  }
  if (refused.length) return { refused };
  if (!changes(project, writes, removes)) return { refused: [reason('door.md §repair-answer', null, null, null, 'the answer changes no file: each file it holds has the bytes it has now, and it removes nothing, so it repairs nothing')] };
  refused.push(...expected(account, repair, route, { writes, removes, mechanism, designAfter, after, files }));
  if (refused.length) return { refused };
  return { writes, removes, moves, mechanism, decision: repair.decision.name, designAfter, after };
}

/** What the decision expects of a Repair answer (decisions.md §expects), with the verdict's rules on a model (models.md §model-repair): reasons when it fails. */
function expected(account, repair, route, { writes, removes, mechanism, designAfter, after }) {
  const { project } = account;
  const decision = repair.decision;
  const check15 = 'decisions.md §expects';
  const out = [];
  const touched = changed(project, writes, removes);
  if (decision.kind === 'decline') {
    if (isOfferedJourney(decision.on)) {
      const m = /^([^/]+)\/journeys\/reach-(.+?)--/.exec(decision.on);
      const lifecycle = m ? `${m[1]}/lifecycles/${m[2]}` : null;
      const before = lifecycle ? project.restatement.pins.entries.get(lifecycle)?.pin ?? null : null;
      const now = lifecycle && after ? after.pins.entries.get(lifecycle)?.pin ?? null : before;
      const unitAfter = designAfter?.units.get(decision.on);
      if (now === before && unitAfter && unitAfter.pin === decision.pin) out.push(reason(check15, null, lifecycle, null, `the decline of the offered journey ${decision.on} expects its lifecycle ${lifecycle} rewritten, given the reason as its direction, and the answer leaves that lifecycle's pin as it is`));
      return out;
    }
    const unit = designAfter?.units.get(decision.on);
    if (unit && unit.pin === decision.pin) out.push(reason(check15, null, decision.on, null, `the decline of ${decision.on} expects it rewritten or removed, given the reason as its direction, and the answer leaves it at the pin it was declined at`));
    return out;
  }
  const verdict = repair.verdict;
  if (route.kind === 'restate') {
    if (verdict === 'property wrong') {
      for (const claim of ruledClaims(project, decision)) {
        const now = after?.pins.entries.get(claim.entry)?.pin ?? null;
        if (now !== null && now === claim.pin) out.push(reason(check15, null, claim.entry, 'Sentence', `the ruling ${decision.name} found the property wrong, so it expects the claim ${claim.entry} restated, and the answer leaves it at the pin the ruled surprise read`));
      }
    }
    if (verdict === 'abstraction too coarse') {
      const parts = recordedParts(decision);
      const over = [...touched].some((path) => {
        const where = designPath(path);
        return where.holder && parts.includes(where.holder.key);
      });
      const standing = parts.filter((p) => project.restatement.parts.has(p) || project.restatement.spans.has(p));
      if (!over && standing.length) out.push(reason(check15, null, null, null, `the ruling ${decision.name} found the abstraction too coarse over ${parts.join(', ')}, so it expects a Repair of the restatement over those parts, and the answer changes no page of them`));
    }
    return out;
  }
  // A Repair on a model: the verdict's rules (models.md §model-repair). On a model a ruled surprise ran on, it changes a file that
  // surprise's question read; a real finding aimed at another model is held to the rules after that one alone.
  const check9 = 'models.md §model-repair';
  if (ranOn(decision).has(route.model)) {
    const read = filesRead(project, decision, route.model);
    if (![...touched].some((path) => read.has(path))) out.push(reason(check9, null, null, null, `the answer changes no file the questions of the ruled surprises on ${route.model} read (${[...read].sort().join(', ') || 'none is known'}), so no question is asked again: a repair that changes nothing a surprise rested on repairs nothing`));
  }
  const ruled = ruledClaims(project, decision);
  const claims = ruled.filter((c) => c.models.has(route.model));
  const encodings = new Set(claims.flatMap((c) => {
    const [holder, , key] = c.entry.split('/');
    const span = project.restatement.spans.has(holder) && !project.restatement.parts.has(holder);
    return ['tla', 'als', 'md'].map((ext) => `models/${route.model}/${span ? 'spans' : 'parts'}/${holder}/claims/${key}/encoding.${ext}`);
  }));
  const encodingChanged = [...touched].some((path) => encodings.has(path));
  const own = [...touched].filter((path) => {
    const where = modelsPath(path);
    if (where.model === route.model && (where.kind === 'model-md' || where.kind === 'engine')) return true;
    const d = designPath(path);
    return route.lifecycle && d.kind === 'page' && d.thing?.kind === 'lifecycles';
  });
  if (verdict === 'model wrong' && encodingChanged) out.push(reason(check9, null, null, null, 'the ruling found the model wrong, so the answer repairs the model and leaves the property untouched: it changes no encoding of a claim the ruled surprises are on'));
  if (verdict === 'property wrong') {
    if (!encodingChanged) out.push(reason(check9, null, null, null, `the ruling found the property wrong, so the answer on ${route.model} changes the encoding of a claim the ruled surprises are on (${claims.map((c) => c.entry).join(', ') || 'none'})`));
    if (own.length) out.push(reason(check9, own[0], null, null, `the ruling found the property wrong, so the answer changes none of the model's own files, and it changes ${own.join(', ')}`));
  }
  if (verdict === 'real finding' && ruled.length) {
    // For a claim a ruled surprise is on, whichever model the surprise ran on: the fault is on the model repaired.
    const faults = writes.filter((w) => modelsPath(w.path).slot === 'fault' && ruled.some((c) => w.path.includes(`/claims/${c.entry.split('/')[2]}/`)));
    const planted = faults.some((w) => {
      const m = /\|\s*Mechanism\s*\|\s*([^|\n]*?)\s*\|/i.exec(textOf(w.bytes));
      return m && m[1] === mechanism;
    });
    if (!planted) out.push(reason(check9, 'repair.md', null, 'Mechanism', `a real finding on a model enters its mechanism as an expectation with its planted defect: the answer holds, for a claim the ruled surprises are on, a fault whose Mechanism is "${mechanism ?? ''}", the mechanism repair.md names`));
  }
  if (verdict === 'model wrong' || verdict === 'real finding') if (!mechanism) out.push(reason(check15, 'repair.md', null, 'Mechanism', 'the ruling expects a Repair answer naming the mechanism it adds'));
  return out;
}

/**
 * The marks an answer leaves (door.md §repair-answer, §receipts; decisions.md §expects): `{ lines: Map<path, { answers, mechanisms?, before }>,
 * readmes: Map<README path, { answers, mechanisms, removed }> }`. A Repair answer names its decision on every file it
 * writes, with the decision and its mechanism in `mechanisms` and each file's hash before; any answer that meets another
 * open repair names it on each file it writes that meets it, with the hash before and no mechanism; a repair made or met
 * by removing is recorded on a README.md's line, or for what it removed under models/<model>/ on that model's model.md
 * line, with a Repair answer's mechanism there too (`readmes` is keyed by the path whose line it is).
 */
export function repairMarks(account, plan, { kind, repair }) {
  const { project } = account;
  const lines = new Map();
  const readmes = new Map();
  const writes = plan.writes ?? [];
  const removes = (plan.removes ?? []).filter((p) => !p.endsWith('/'));
  const beforeOf = (path) => project.files.get(path)?.sha256 ?? null;
  const touched = changed(project, writes, removes);
  const mark = (path, decision, mechanism = undefined) => {
    if (!lines.has(path)) lines.set(path, { answers: [], before: beforeOf(path) });
    const line = lines.get(path);
    if (!line.answers.includes(decision)) line.answers.push(decision);
    if (mechanism !== undefined) line.mechanisms = mechanismsSorted([...(line.mechanisms ?? []), { decision, mechanism }]);
  };
  // Where a removal is recorded (door.md §repair-answer): under design/, its part's or span's README.md, or design/README.md for one
  // removed whole; under models/<model>/, that model's model.md, and for a lifecycle model its part's README.md.
  const removedWhole = new Set(removes.filter((p) => /^design\/(parts|spans)\/[^/]+\/README\.md$/.test(p)).map((p) => p.split('/').slice(0, 3).join('/')));
  const recordedAt = (path) => {
    if (path.startsWith('design/')) {
      const where = designPath(path);
      const holderFolder = where.holder ? `design/${where.holder.span ? 'spans' : 'parts'}/${where.holder.key}` : null;
      return holderFolder && !removedWhole.has(holderFolder) ? `${holderFolder}/README.md` : 'design/README.md';
    }
    const where = modelsPath(path);
    if (!where.model || !ANSWERED.has(where.kind)) return null;
    if (!isLifecycleModel(where.model)) return `models/${where.model}/model.md`;
    const partFolder = `design/parts/${where.model.slice('lifecycles-'.length)}`;
    return removedWhole.has(partFolder) ? 'design/README.md' : `${partFolder}/README.md`;
  };
  const recordRemoval = (decision, paths = removes, mechanism = undefined) => {
    for (const path of paths) {
      const at = recordedAt(path);
      if (!at) continue;
      const file = posix.relative(at.slice(0, at.lastIndexOf('/')), path);
      if (!readmes.has(at)) readmes.set(at, { answers: [], mechanisms: [], removed: [] });
      const r = readmes.get(at);
      if (!r.answers.includes(decision)) r.answers.push(decision);
      // A Repair answer's removals' line gives its decision with its mechanism (door.md §repair-answer, §receipts `mechanisms`).
      if (mechanism !== undefined) r.mechanisms = mechanismsSorted([...r.mechanisms, { decision, mechanism }]);
      if (!r.removed.some((x) => x.file === file)) r.removed.push({ file, before: beforeOf(path) });
    }
  };
  // The line of each file a Repair answer changed names its decision, with its mechanism, and the hash before (door.md
  // door.md §repair-answer); a line names a decision only when its before differs from its sha256 (decisions.md §expects), so an unchanged file
  // it holds keeps a plain line.
  if (kind === 'repair' && plan.decision) {
    for (const w of writes) if (touched.has(w.path)) mark(w.path, plan.decision, plan.mechanism ?? undefined);
    if (removes.length) recordRemoval(plan.decision, removes, plan.mechanism ?? undefined);
  }
  // Open repairs this answer meets (decisions.md §expects), named by the account's `repair:` items.
  const open = new Set(account.items.filter((i) => i.item.startsWith('repair:')).map((i) => i.item.slice('repair:'.length).split('/')[0]));
  if (plan.decision) open.delete(plan.decision);
  const after = plan.after ?? (writes.some((w) => w.path.startsWith('design/')) || removes.some((p) => p.startsWith('design/')) ? restatementAfter(project, writes, removes) : null);
  for (const name of open) {
    const decision = project.decisions.find((d) => d.name === name);
    if (!decision) continue;
    const metBy = [];
    if (decision.kind === 'decline' && after) {
      if (isOfferedJourney(decision.on)) {
        const m = /^([^/]+)\/journeys\/reach-(.+?)--/.exec(decision.on);
        const lifecycle = m ? `${m[1]}/lifecycles/${m[2]}` : null;
        const page = lifecycle ? project.restatement.entries.get(lifecycle)?.page : null;
        if (page && touched.has(page) && after.pins.entries.get(lifecycle)?.pin !== project.restatement.pins.entries.get(lifecycle)?.pin) metBy.push(page);
      } else {
        const unit = account.design.units.get(decision.on);
        const entries = new Set([...(unit?.entries ?? []), decision.on]);
        const pages = new Set([...entries].map((e) => project.restatement.entries.get(e)?.page).filter(Boolean));
        if (decision.on === 'parts') pages.add('design/README.md');
        const unitAfter = plan.designAfter?.units.get(decision.on) ?? null;
        const rewritten = !unitAfter || unitAfter.pin !== decision.pin;
        if (rewritten) for (const page of pages) if (touched.has(page)) metBy.push(page);
      }
    }
    if (decision.kind === 'rule' && decision.rows?.Verdict === 'property wrong') {
      for (const claim of ruledClaims(project, decision)) {
        const page = project.restatement.entries.get(claim.entry)?.page;
        if (after && page && touched.has(page) && (after.pins.entries.get(claim.entry)?.pin ?? null) !== claim.pin) metBy.push(page);
        const [holder, , key] = claim.entry.split('/');
        for (const path of touched) {
          const where = modelsPath(path);
          if (where.slot === 'encoding' && claim.models.has(where.model) && where.holder.key === holder && where.thing.key === key) metBy.push(path);
        }
      }
    }
    if (decision.kind === 'rule' && decision.rows?.Verdict === 'abstraction too coarse') {
      const parts = recordedParts(decision);
      const gone = parts.filter((p) => removedWhole.has(`design/parts/${p}`) || removedWhole.has(`design/spans/${p}`));
      if (gone.length && gone.length === parts.filter((p) => project.restatement.parts.has(p) || project.restatement.spans.has(p)).length) recordRemoval(name);
    }
    for (const path of metBy) {
      if (!removes.includes(path)) mark(path, name);
      else {
        // The removed thing's folder goes with its page: every file removed from it records the repair.
        const folder = path.slice(0, path.lastIndexOf('/') + 1);
        recordRemoval(name, removes.filter((p) => p === path || (path.endsWith('/README.md') && p.startsWith(folder))));
      }
    }
  }
  // A README.md the answer writes takes its marks on its new line.
  for (const [readme, r] of readmes) {
    if (!writes.some((w) => w.path === readme)) continue;
    const line = lines.get(readme) ?? { answers: [], before: beforeOf(readme) };
    line.answers = sortedBy([...new Set([...line.answers, ...r.answers])]);
    if (r.mechanisms.length) line.mechanisms = mechanismsSorted([...(line.mechanisms ?? []), ...r.mechanisms]);
    line.removed = r.removed;
    lines.set(readme, line);
    readmes.delete(readme);
  }
  for (const line of lines.values()) line.answers = sortedBy(line.answers);
  for (const r of readmes.values()) r.answers = sortedBy(r.answers);
  return { lines, readmes };
}
