// The checks a Model answer, a Fill-a-slot answer and a Repair on a model meet at the door
// (models.md §model-answer to §freeze, §parts-change to §owed), and what each takes in: a model's model.md and engine files, the one
// slot file with the pins of the entries it is written for, and what a dropped part takes with it.
// Every function here is pure but for the engine's parser: it writes nothing, and gives the door the
// files to take in with their receipt lines' fields.

import { sha256, sortedBy } from '../record/json.mjs';
import { covers, EXTENSION, isProperty, modelEngineReasons, modelRowReasons, parseModel, parseSlot, slotReasons, slotsOf, writtenFor } from '../record/models.mjs';
import { modelsPath } from '../record/tree.mjs';
import { droppedEvidence } from '../evidence/run.mjs';
import { reason } from './common.mjs';

/** The extensions a slot of `kind` may have on a model of `engine` (models.md §slots). */
function slotExtensions(kind, engine) {
  if (kind === 'encoding') return engine === 'lifecycle' ? ['md'] : [EXTENSION[engine], 'md'];
  if (kind === 'misbehaviour') return engine === 'lifecycle' ? [] : [EXTENSION[engine]];
  return ['md'];
}

const folderOf = (path) => path.slice(0, path.lastIndexOf('/'));
const nameOf = (path) => path.slice(path.lastIndexOf('/') + 1);
const textOf = (bytes) => Buffer.from(bytes).toString('utf8');

/** The freeze at an answer (models.md §freeze): a reason for each file it holds or removes that an open surprise holds, or that is new under one. */
export function freezeReasons(project, paths, verb = 'holds') {
  const reasons = [];
  for (const path of sortedBy([...new Set(paths)])) {
    for (const { surprise, why } of project.freezing(path)) {
      reasons.push(reason('models.md §freeze', path, null, null, why === 'held'
        ? `the open surprise ${surprise} holds this file frozen, so no answer ${verb === 'holds' ? 'holds' : 'removes'} it, whatever its bytes, until the developer rules on the surprise`
        : `it would be new while the open surprise ${surprise} is open: the freeze holds that surprise's model and its claim's slots on the model, and admits no new file until the developer rules on it`));
    }
  }
  return reasons;
}

/** Whether any file an answer holds or removes changes the project's bytes (door.md §repair-answer): one written whose bytes differ, or one removed. */
export const changes = (project, writes, removes) => removes.length > 0 || writes.some((w) => project.files.get(w.path)?.sha256 !== sha256(w.bytes));

// --- A Model answer (models.md §model-answer, §parts-change, §one-model-first) ---------------------------------------------------------------------

/** The strikes in force over a model's parts, as model.md's receipt line records them (door.md §receipts, forms.md §menu). */
const strikesOver = (strikes, parts) => sortedBy([...strikes].filter((s) => parts.includes(s.slice('strike:'.length).split('/')[0])));

/** Where the slots and evidence a dropped part takes with it lie under a model (models.md §parts-change). */
function droppedFolders(ctx, model, part) {
  const folders = [`models/${model}/actions/${part}/`, `models/${model}/world/${part}/`];
  for (const claim of ctx.claims) if ((claim.parts ?? []).includes(part)) folders.push(`models/${model}/${claim.holder.span ? 'spans' : 'parts'}/${claim.holder.key}/claims/${claim.key}/`);
  for (const journey of ctx.journeys.values()) if ((journey.parts ?? []).includes(part)) folders.push(`models/${model}/${journey.holder.span ? 'spans' : 'parts'}/${journey.holder.key}/journeys/${journey.key}/`);
  return folders;
}

/**
 * One model first, and a smaller model (models.md §one-model-first), for an answer making `model` (parsed) of `key`: reasons when
 * it is refused. `before` is the model's state as it stands (currency.mjs), or undefined when it does not exist.
 */
function firstAndSmaller(account, key, model, before) {
  const { project, evidence } = account;
  const check = 'models.md §one-model-first';
  const others = [...evidence.models.values()].filter((s) => s.exists && s.engine !== 'lifecycle' && s.key !== key);
  const existed = Boolean(before?.exists);
  if (!others.length && !existed) {
    const listed = (project.restatement.partList?.rows ?? []).map((r) => r.key);
    const left = listed.filter((p) => !model.parts.includes(p));
    if (left.length) return [reason(check, `models/${key}/model.md`, null, 'Parts', `no TLC or Alloy model exists yet, so the first covers every part on the part list; it leaves out ${left.join(', ')}`)];
    return [];
  }
  const after = model.parts.length;
  const was = existed ? before.model.parts.length : null;
  const dropsNothing = !existed || before.model.parts.every((p) => model.parts.includes(p));
  const from = [];
  if (existed && after < was) from.push({ key, engine: before.engine, parts: before.model.parts });
  const alreadySmaller = existed && others.some((o) => o.model.parts.length > was);
  if (!(alreadySmaller && dropsNothing)) {
    for (const other of others) if (other.model.parts.length > after && (!existed || was >= other.model.parts.length)) from.push({ key: other.key, engine: other.engine, parts: other.model.parts });
  }
  if (!from.length) return [];
  const fromKeys = new Set(from.map((f) => f.key));
  const unanswered = evidence.questions.some((r) => fromKeys.has(r.question.model) && r.current && r.evidence?.found?.outcome === 'unanswered');
  if (unanswered) return [];
  // Or, on another engine than every model it splits from, while a claim whose parts it covers is owed another engine
  // (door.md §copies): its encoding gives a reason on every model that covers it, a lifecycle model among them, and no acceptance of
  // its risk is in force, which is the account's `express:<claim>` (account.md §items).
  if (from.every((f) => f.engine !== model.engine)) {
    const express = new Set((account.items ?? []).filter((i) => i.item.startsWith('express:')).map((i) => i.on));
    const owed = evidence.ctx.claims.some((claim) => claim.parts?.length && claim.parts.every((p) => model.parts.includes(p)) && express.has(claim.entry));
    if (owed) return [];
  }
  const names = from.map((f) => `${f.key} (${f.parts.length} part${f.parts.length === 1 ? '' : 's'})`).join(', ');
  return [reason(check, `models/${key}/model.md`, null, 'Parts', `the answer splits: after it the model covers ${after} part${after === 1 ? '' : 's'}, fewer than ${names}; a split is accepted only while a question on a model it splits from has current unanswered evidence, or, on another engine, while a claim whose parts it covers is owed another engine`)];
}

/**
 * A Model answer (models.md §model-answer) checked: `files` maps each project path under `models/<model>/` to its bytes. Gives
 * `{ refused }`, or `{ key, model, writes: [{ path, bytes, fields }], removes: [path], dropped: [part] }`. With `repair`,
 * check 7 is not asked and models.md §one-model-first is (models.md §model-repair); `item` is the item answered, for check 7.
 */
export async function checkModelAnswer(account, files, { item = null, repair = false } = {}) {
  const { project, design, evidence } = account;
  const ctx = evidence.ctx;
  const restatement = project.restatement;
  const refused = [];
  const paths = sortedBy([...files.keys()]);
  const key = paths[0].split('/')[1];
  const mdPath = `models/${key}/model.md`;
  if (!files.has(mdPath)) return { refused: [reason('models.md §model-answer', mdPath, null, null, `a Model answer holds the model's model.md, at models/${key}/model.md, with every engine file beside it`)] };
  const text = textOf(files.get(mdPath));
  // Check 1: the form, and the engine files the engine's.
  const { model, reasons: form } = parseModel(key, text);
  refused.push(...form);
  if (!model) return { refused };
  const extension = EXTENSION[model.engine];
  const engineFiles = [];
  const byName = {};
  for (const path of paths) {
    if (path === mdPath) continue;
    const name = nameOf(path);
    if (!extension || !name.endsWith(`.${extension}`)) {
      refused.push(reason('models.md §model-answer', path, null, null, extension ? `an engine file of a ${model.engine === 'tlc' ? 'TLC' : 'Alloy'} model is a .${extension} file` : 'model.md names no engine Forma knows, so no file beside it is an engine file'));
      continue;
    }
    engineFiles.push(name);
    byName[name] = files.get(path);
  }
  // Checks 1 and 2 against the parts as they stand, and 3 and 4 through the parser.
  refused.push(...modelRowReasons(model, restatement, engineFiles, ctx.strikes, null));
  if (!form.length && engineFiles.length && extension) refused.push(...(await modelEngineReasons(model, byName, restatement, ctx.strikes)));
  // Engine files of the model that the answer leaves out are removed (door.md §receipts).
  const record = project.models.get(key);
  const removes = (record?.engineFiles ?? []).map((name) => `models/${key}/${name}`).filter((path) => !files.has(path));
  // Check 5: the freeze (door.md §scratch).
  refused.push(...freezeReasons(project, paths), ...freezeReasons(project, removes, 'removes'));
  // door.md §read-checks: a part dropped is refused while an unruled surprise on the model rests on what the drop would remove.
  const before = evidence.models.get(key);
  const dropped = before?.exists ? before.model.parts.filter((p) => !model.parts.includes(p)) : [];
  for (const part of dropped) {
    const folders = droppedFolders(ctx, key, part);
    for (const surprise of project.surprises.values()) {
      if (!surprise.open || !folders.some((f) => surprise.path.startsWith(f))) continue;
      refused.push(reason('models.md §parts-change', mdPath, null, 'Parts', `the answer drops the part ${part}, and the open surprise ${surprise.name} rests on what the drop would remove: the developer rules on it first`));
    }
  }
  // Checks 6 (models.md §one-model-first) and 7, only when an answer is checked.
  refused.push(...firstAndSmaller(account, key, model, before));
  if (!repair && item) {
    const at = item.indexOf(':');
    const prefix = item.slice(0, at);
    const rest = item.slice(at + 1);
    const owed = prefix === 'cover' ? rest.split('+') : prefix === 'express' ? restatement.thingParts.get(rest) ?? [] : [];
    const left = owed.filter((p) => !model.parts.includes(p));
    if (left.length) refused.push(reason('models.md §model-answer', mdPath, null, 'Parts', `the item ${item} owes a model covering ${owed.join(', ')}, and this one does not cover ${left.join(', ')}`));
  }
  if (refused.length) return { refused };
  const strikes = strikesOver(ctx.strikes, model.parts);
  const writes = paths.map((path) => ({ path, bytes: files.get(path), fields: path === mdPath ? { strikes } : {} }));
  // What a dropped part takes with it (door.md §read-checks; evidence.md §removed): the slots of things whose parts include it, the
  // misbehaviour witnesses under world/<part>/, with their receipt lines, and the evidence that goes with them.
  const dropSlots = [];
  const dropEvidence = [];
  for (const part of dropped) {
    const folders = droppedFolders(ctx, key, part);
    for (const slot of project.slots.values()) if (slot.model === key && folders.some((f) => slot.path.startsWith(f))) dropSlots.push(slot.path);
    dropEvidence.push(...droppedEvidence(project, design, key, part));
  }
  return { key, model, writes, removes, dropped, dropSlots: sortedBy([...new Set(dropSlots)]), dropEvidence: sortedBy([...new Set(dropEvidence)]) };
}

// --- A Fill-a-slot answer (models.md §slot-answer, §slot-currency) --------------------------------------------------------------------

/** A model's slot positions by models.md §slots (currency.mjs's reading), from the model as given. */
function positionsOf(account, state) {
  const { project, evidence } = account;
  const ctx = evidence.ctx;
  const claims = ctx.claims.map((c) => ({ entry: c.entry, key: c.key, holder: c.holder, parts: c.parts }));
  const journeys = [...ctx.journeys.values()].filter((j) => j.confirmed).map((j) => ({ entry: j.entry, key: j.key, holder: j.holder, parts: j.parts }));
  const property = (claim) => {
    const folder = `models/${state.key}/${claim.holder.span ? 'spans' : 'parts'}/${claim.holder.key}/claims/${claim.key}`;
    return [...project.slots.values()].some((s) => s.kind === 'encoding' && s.model === state.key && folderOf(s.path) === folder && s.counts && s.entry && isProperty(s.form));
  };
  return slotsOf(state.model, project.restatement, { claims, journeys, property, strikes: ctx.strikes });
}

/**
 * A Fill-a-slot answer (models.md §slot-answer) checked: `path` and `bytes` its one file under models/. Gives `{ refused }` or
 * `{ writes: [{ path, bytes, fields }], removes }`, the fields the pins of the entries it is written for (models.md §slot-currency). With
 * `repair`, `state` is the model as the Repair answer leaves it and the slot need only exist by models.md §slots (models.md §model-repair); `item` binds
 * which slot the answer is for; `restatement` is the restatement it is checked against.
 */
export async function checkSlotAnswer(account, path, bytes, { item = null, further = false, repair = false, state = null, restatement = null } = {}) {
  const { project, evidence } = account;
  const ctx = evidence.ctx;
  const against = restatement ?? project.restatement;
  const check = 'models.md §slot-answer';
  const where = modelsPath(path);
  const refused = [];
  const model = state ?? evidence.models.get(where.model);
  const engine = model?.engine ?? null;
  // Check 1: the slot exists by door.md §forma-answer, on a usable model, at its path and with its extension.
  if (!model?.exists) return { refused: [reason(check, path, null, null, `no model ${where.model} stands, so it has no slots: ${where.model.startsWith('lifecycles-') ? `a lifecycle model exists while its part has a confirmed lifecycle` : 'a Model answer makes a model first'}`)] };
  if (!repair && !model.usable) refused.push(reason(check, path, null, null, `the model ${where.model} is not usable now: it is owed a Model answer, or one of its files counts for nothing (models.md §slot-currency), so no slot on it is taken until it is`));
  const folder = folderOf(path);
  const stem = nameOf(path).replace(/\.(tla|als|md)$/, '');
  const position = positionsOf(account, model).find((p) => p.kind === where.slot && (where.slot === 'witness' || where.slot === 'fault' ? folderOf(`${p.path}.md`) === folder : p.path === `${folder}/${stem}`));
  const entry = where.thing ? `${where.holder.key}/${where.thing.kind}/${where.thing.key}` : `${where.part}/boundary/${where.row}`;
  if (!position) refused.push(reason(check, path, entry, null, slotAbsent(where, model)));
  else if (!slotExtensions(where.slot, engine).includes(where.extension)) refused.push(reason(check, path, entry, null, `a ${where.slot} on ${engine === 'lifecycle' ? 'a lifecycle model' : `a ${engine === 'tlc' ? 'TLC' : 'Alloy'} model`} is a .${slotExtensions(where.slot, engine).join(' or .')} file`));
  // The item binds the slot it is for (account.md §items): `slot:<path>`, or a witness or fault of the claim's folder.
  if (item?.startsWith('slot:') && !repair) {
    const named = `models/${item.slice('slot:'.length)}`;
    // `slot:<claim folder>/witness` or `/fault` names a witness or fault under a key its answer gives (account.md §items).
    const furtherOf = /^(.+)\/(witness|fault)$/.exec(named);
    const fits = furtherOf ? where.slot === furtherOf[2] && folder === furtherOf[1] : `${folder}/${stem}` === named;
    if (!fits) refused.push(reason('door.md §answer-holds', path, entry, null, `the answer's slot is not the one ${item} names: ${furtherOf ? `a ${furtherOf[2]}-<key>.md in ${furtherOf[1]}` : `${named}.<ext>`}`));
    if (fits && furtherOf) {
      const used = [...project.slots.values()].some((s) => s.path === path && s.counts && s.entry);
      if (used) refused.push(reason('models.md §owed', path, entry, null, `the key ${where.key} is used already by an accepted ${where.slot} of this claim; a further one takes a key it has not yet used`));
    }
  }
  if (refused.length) return { refused };
  // Checks 2 to 5 against the model and the restatement.
  const text = textOf(bytes);
  const claim = where.thing?.kind === 'claims' ? against.things.get(entry) ?? null : null;
  const journey = where.thing?.kind === 'journeys' ? ctx.journeys.get(entry) ?? null : null;
  const slot = { ...where, kind: where.slot, path };
  refused.push(...(await slotReasons(slot, text, { model: model.model, files: model.files ?? {}, restatement: against, claim, journey, from: where.holder ?? null })));
  // Check 6: the freeze (door.md §scratch).
  refused.push(...freezeReasons(project, [path]));
  if (refused.length) return { refused };
  // Accepted: the pins of the entries it is written for (door.md §lock; door.md §receipts).
  const { form } = parseSlot(where.slot, where.extension, text, engine, path);
  const names = writtenFor(against, model.model, { kind: where.slot }, { claim: claim?.entry ?? null, fault: where.slot === 'fault' ? form : null, journey, from: where.holder ?? null, row: where.slot === 'misbehaviour' ? entry : null });
  const pinOf = (name) => (restatement ? restatement.pins.entries.get(name)?.pin ?? ctx.pinNow(name) : ctx.pinNow(name));
  const pins = names.map((name) => ({ entry: name, pin: pinOf(name) })).filter((p) => p.pin);
  // A claim has one encoding on a model: the file accepted for it replaces one of another extension (door.md §forma-answer).
  const removes = where.slot === 'encoding' ? [...project.slots.values()].filter((s) => s.kind === 'encoding' && folderOf(s.path) === folder && s.path !== path).map((s) => s.path) : [];
  return { writes: [{ path, bytes, fields: { pins } }], removes };
}

/** Why a slot does not exist by models.md §slots at a path, in the agent's terms. */
function slotAbsent(where, model) {
  if (where.slot === 'encoding') return `no encoding slot is here: the claim's parts are not all among those the model ${model.key} covers, or no such claim stands`;
  if (where.slot === 'witness' || where.slot === 'fault') return `no ${where.slot} slot is here: a claim takes witnesses and faults on a model only while its encoding there is filled and a property`;
  if (where.slot === 'schedule') return `no schedule slot is here: a schedule exists for a confirmed journey whose parts the TLC or Alloy model ${model.key} covers`;
  return `no misbehaviour witness slot is here: one exists for each item not struck of a world row with a seam in a part the TLC or Alloy model ${model.key} covers`;
}
