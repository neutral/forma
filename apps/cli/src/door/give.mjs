// `forma give <item> <folder>` (door.md §forma-give, §gives): the packet an agent is given for an item missing
// now and supplied by an agent's answer, written into a folder of its own outside the project. It
// holds the inputs of the item's kind at their project paths, the contracts under `forma/`, Forma's
// base pages under `base/`, and `item.json`; for an Explain item, the run it needs, run again first
// where this machine lacks it. Nothing is recorded of a give, and it spends nothing.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAccount } from '../account/index.mjs';
import { journeyTablesText, whatItSays } from '../record/decisions.mjs';
import { aheadOfClock, basisDigest, jsonText, sha256, sortedBy } from '../record/json.mjs';
import { parseModel } from '../record/models.mjs';
import { resolveRef } from '../record/pages.mjs';
import { designPath, modelsPath, readBytes, walk } from '../record/tree.mjs';
import { rerunForExplain } from '../evidence/run.mjs';
import { withLock } from './lock.mjs';
import { agentFolder, CONTRACTS, itemOf, reason, reasonLine } from './common.mjs';
import { repairOf } from './repair.mjs';
import { refusalsOf } from './work.mjs';

const CHECK = 'door.md §forma-give';
/** The workspace's root, whose `spec/` and `base/` a packet carries. */
const FORMA = fileURLToPath(new URL('../../../../', import.meta.url));

/** A give refused (door.md §forma-give): writing nothing, exit status 1; with --json `{"refused": [<reason>]}`. */
function refused(reasons, json) {
  return { status: 1, stdout: json ? `${JSON.stringify({ refused: reasons })}\n` : `${reasons.map(reasonLine).join('\n')}\n`, stderr: '' };
}

/**
 * `forma give <item> <folder> [--json]` (door.md §forma-give): writes the packet for `item` into `folder` and gives `{ status,
 * stdout, stderr }`. `cwd` is the folder a relative `folder` is read from.
 */
export async function giveCommand(root, { item, folder, json = false, cwd = process.cwd() }) {
  const missing = [];
  if (!item) missing.push(reason(CHECK, null, null, null, 'the item is missing: forma give <item> <folder>, the item as forma missing names it'));
  if (!folder) missing.push(reason(CHECK, null, null, null, 'the folder is missing: forma give <item> <folder>, a folder of your own outside the project, absent or empty'));
  if (missing.length) return refused(missing, json);

  // The folder (door.md §forma-give): outside the project, with every symbolic link resolved; absent or an empty folder.
  const target = await agentFolder(root, folder, cwd);
  const folderReasons = [];
  if (target.inside) folderReasons.push(reason(CHECK, null, null, null, `the folder ${target.path} is ${target.real === target.path ? '' : `, with its links resolved (${target.real}), `}the project folder or inside it; an agent works in a folder of its own outside the project`));
  else if (target.exists && !target.isFolder) folderReasons.push(reason(CHECK, null, null, null, `${target.path} is not a folder; name a folder that is absent, which Forma creates, or empty`));
  else if (target.exists && !target.empty) folderReasons.push(reason(CHECK, null, null, null, `the folder ${target.path} is not empty, and a packet's folder holds exactly the packet; name an absent or empty folder`));
  if (folderReasons.length) return refused(folderReasons, json);

  const account = await readAccount(root);
  const found = itemOf(account, item, CHECK);
  if (found.reasons) return refused(found.reasons, json);
  const { project, design, evidence } = account;

  // An Explain item's run, where runs/ here holds none on the basis its evidence names (door.md §gives; evidence.md §rerun).
  const packet = new Map();
  const extra = { journey: null, decision: null, differ: null, cannot: null };
  const kinds = found.kinds;
  const surprise = kinds.includes('explain') ? surpriseOf(project, item) : null;
  if (surprise) {
    const needed = await runsNeeded(root, project, surprise);
    if (needed.length) {
      const ahead = aheadOfClock(project.clock.latest);
      if (ahead) return refused([reason('door.md §clock', ahead.file, null, null, `the packet needs ${needed.join(' and ')} run again on this machine, and ${ahead.file} holds the time ${ahead.at}, more than a minute ahead of this machine's clock, so Forma writes nothing until the clock passes it`)], json);
      const rerun = await withLock(root, () => rerunForExplain(root, surprise.name));
      extra.differ = rerun.differ;
      extra.cannot = rerun.cannot;
    } else extra.differ = [];
  }

  // What each kind is given (door.md §gives), together where the item may be answered by more than one.
  const add = async (path) => {
    if (packet.has(path)) return;
    const bytes = await readBytes(root, path);
    if (bytes !== null) packet.set(path, bytes);
  };
  const contracts = new Set(['door.md', 'account.md', 'presentation.md']);
  for (const kind of kinds) {
    if (kind === 'restate') await restatePacket(root, project, add);
    if (kind === 'model') await modelPacket(project, design, modelTargetOf(project, item), add);
    if (kind === 'slot') await slotPacket(project, design, evidence, slotTargetOf(project, item, found), add, extra);
    if (kind === 'explain' && surprise) await explainPacket(root, project, design, surprise, add, extra);
    if (kind === 'repair') {
      const repair = repairOf(project, design, item);
      if (repair.decision) extra.decision = whatItSays(repair.decision);
      for (const target of repair.kinds) {
        if (target.kind === 'restate') {
          await restatePacket(root, project, add);
          for (const c of CONTRACTS.restate) contracts.add(c);
        } else {
          await modelPacket(project, design, { model: target.model, parts: target.parts }, add);
          // Every slot on that model, accepted or not, since the answer may change any of them and must not break what
          // it cannot see (door.md §gives).
          for (const slot of project.slots.values()) if (slot.model === target.model) await add(slot.path);
          for (const c of CONTRACTS.model) contracts.add(c);
        }
      }
      contracts.add('decisions.md');
    }
    for (const c of CONTRACTS[kind] ?? []) contracts.add(c);
  }

  // item.json (door.md §gives), computed from what is given.
  const given = [...packet.keys()];
  const itemJson = itemValue(project, design, evidence, found.item, given, await refusalsOf(root, item), extra);
  const files = new Map();
  for (const [path, bytes] of packet) files.set(path, bytes);
  for (const name of sortedBy([...contracts])) files.set(`forma/${name}`, await readFile(join(FORMA, 'spec', name)));
  for (const entry of await walk(FORMA, 'base')) if (entry.type === 'file') files.set(entry.path, await readFile(join(FORMA, entry.path)));
  files.set('item.json', Buffer.from(jsonText(itemJson)));

  // Written whole into the folder, which Forma creates when absent.
  await mkdir(target.path, { recursive: true });
  const listed = sortedBy([...files.keys()]);
  for (const path of listed) {
    await mkdir(dirname(join(target.path, path)), { recursive: true });
    await writeFile(join(target.path, path), files.get(path));
  }
  const differ = extra.differ ?? [];
  if (json) {
    const value = { item, folder: target.path, files: listed.map((path) => ({ path, sha256: sha256(files.get(path)) })), differ };
    if (extra.cannot) value.cannot = extra.cannot;
    return { status: 0, stdout: `${JSON.stringify(value)}\n`, stderr: '' };
  }
  const lines = [`gave ${item} into ${target.path}`, ...listed, ...differ];
  if (extra.cannot) lines.push(`no run of ${surprise.name} could be made on this machine: ${extra.cannot}`);
  return { status: 0, stdout: `${lines.join('\n')}\n`, stderr: '' };
}

// --- What each kind is given (door.md §gives) -----------------------------------------------------------------------

/** Restate (door.md §gives): every brief document and source, and every page under design/ outside design/brief/. */
async function restatePacket(root, project, add) {
  for (const entry of await walk(root, 'design/brief')) if (entry.type === 'file') await add(entry.path);
  for (const path of project.files.keys()) if (designPath(path).kind === 'page') await add(path);
}

/** Every page in a part's folder (door.md §gives): its front page, tables and thing pages, whatever each counts for. */
const partPages = (project, part) => [...project.files.keys()].filter((path) => path.startsWith(`design/parts/${part}/`) && designPath(path).kind === 'page');

/** The parts a model's model.md names, from its parsed form or, for one that counts for nothing, its bytes as they stand. */
function modelParts(project, key) {
  const record = project.models.get(key);
  if (!record) return [];
  if (record.lifecycle) return [key.slice('lifecycles-'.length)];
  if (record.model?.parts) return record.model.parts;
  if (record.modelMd?.bytes) return parseModel(key, record.modelMd.bytes.toString('utf8')).model?.parts ?? [];
  return [];
}

/** The model and parts a Model answer for an item is given (door.md §gives; account.md §items). */
function modelTargetOf(project, item) {
  const at = item.indexOf(':');
  const prefix = item.slice(0, at);
  const rest = item.slice(at + 1);
  if (prefix === 'cover' || prefix === 'span') return { model: null, parts: rest.split('+'), every: true };
  if (prefix === 'express') return { model: null, parts: project.restatement.thingParts.get(rest) ?? [], every: true };
  if (prefix === 'model') return { model: rest, parts: modelParts(project, rest) };
  if (prefix === 'unanswered') {
    const model = rest.split('/')[0];
    return { model, parts: modelParts(project, model) };
  }
  if (prefix === 'change') {
    const model = modelsPath(rest).model ?? null;
    return { model, parts: model ? modelParts(project, model) : [] };
  }
  return { model: null, parts: [] };
}

/**
 * Model (door.md §gives): design/README.md; every page of each part; the page of every thing filed in a span whose parts all lie
 * among those; the model's model.md and engine files when it exists; with `every`, for an item that names no model,
 * every TLC and Alloy model's model.md and engine files.
 */
async function modelPacket(project, design, { model, parts, every = false }, add) {
  await add('design/README.md');
  for (const part of parts) for (const path of partPages(project, part)) await add(path);
  for (const thing of project.restatement.things.values()) {
    if (!thing.holder.span) continue;
    const thingParts = project.restatement.thingParts.get(thing.entry) ?? [];
    if (thingParts.length && thingParts.every((p) => parts.includes(p))) await add(thing.page);
  }
  const records = every ? sortedBy([...project.models.values()], (r) => r.folder) : [model ? project.models.get(model) : null];
  for (const record of records) {
    if (!record || record.lifecycle) continue;
    if (record.modelMd) await add(record.modelMd.path);
    for (const name of record.engineFiles) await add(`${record.folder}/${name}`);
  }
}

/** A slot path under models/ with its extension, or the place a witness or fault would go, as tree.mjs reads it. */
function slotWhere(path) {
  for (const extension of ['md', 'tla', 'als']) {
    const where = modelsPath(`${path}.${extension}`);
    if (where.kind === 'slot') return { ...where, path: `${path}.${extension}` };
  }
  const further = /^(.+)\/(witness|fault)$/.exec(path);
  if (further) {
    const where = modelsPath(`${further[1]}/${further[2]}-x.md`);
    if (where.kind === 'slot') return { ...where, key: null, path: null };
  }
  return null;
}

/** The slot a Fill-a-slot answer for an item is given (door.md §gives): `{ where, file }`, `file` the slot's own file when there is one. */
function slotTargetOf(project, item, found) {
  const at = item.indexOf(':');
  const prefix = item.slice(0, at);
  const rest = item.slice(at + 1);
  if (prefix === 'change') {
    const where = modelsPath(rest);
    return where.kind === 'slot' ? { where: { ...where, path: rest }, file: rest, change: true } : null;
  }
  if (prefix !== 'slot') return null;
  const where = slotWhere(`models/${rest}`);
  if (!where) return null;
  const file = [...project.slots.keys()].find((p) => p.replace(/\.(tla|als|md)$/, '') === `models/${rest}`) ?? null;
  return { where, file, change: false, further: found.further };
}

/**
 * Slot (door.md §gives): the page of the thing the slot serves and of every entry it names; actions.md, boundary.md and every
 * lifecycle page of each of its parts; the model's files; the thing's other accepted slots there; the slot's own file
 * when it is owed again.
 */
async function slotPacket(project, design, evidence, target, add, extra) {
  if (!target) return;
  const { where } = target;
  const restatement = project.restatement;
  let entry = null;
  let parts = [];
  let thingFolder = null;
  if (where.thing) {
    entry = `${where.holder.key}/${where.thing.kind}/${where.thing.key}`;
    thingFolder = `models/${where.model}/${where.holder.span ? 'spans' : 'parts'}/${where.holder.key}/${where.thing.kind}/${where.thing.key}`;
    const thing = restatement.things.get(entry);
    const journey = where.thing.kind === 'journeys' ? design.journeys.get(entry) : null;
    if (thing) {
      await add(thing.page);
      parts = restatement.thingParts.get(entry) ?? [];
    } else if (journey) {
      parts = journey.parts ?? [];
      if (journey.page) await add(journey.page);
      if (journey.added) extra.journey = journeyPageText(journey);
    }
    for (const page of namedPages(restatement, entry, journey)) await add(page);
  } else if (where.part) {
    entry = `${where.part}/boundary/${where.row}`;
    thingFolder = `models/${where.model}/world/${where.part}/${where.row}`;
    parts = [where.part];
  }
  for (const part of parts) {
    await add(`design/parts/${part}/actions.md`);
    await add(`design/parts/${part}/boundary.md`);
    for (const path of partPages(project, part)) if (designPath(path).thing?.kind === 'lifecycles') await add(path);
  }
  const record = project.models.get(where.model);
  if (record && !record.lifecycle) {
    if (record.modelMd) await add(record.modelMd.path);
    for (const name of record.engineFiles) await add(`${record.folder}/${name}`);
  }
  if (thingFolder) {
    for (const slot of project.slots.values()) {
      if (!slot.counts || slot.path === target.file || slot.path.slice(0, slot.path.lastIndexOf('/')) !== thingFolder) continue;
      await add(slot.path);
    }
  }
  if (target.file && (target.change || evidence.slots.files.get(target.file)?.owedAgain)) await add(target.file);
}

/** The pages of the entries a thing's page names (door.md §gives), from its references as design.md §restate-checks's check 2 resolved them. */
function namedPages(restatement, entry, journey) {
  const pages = new Set();
  const take = (resolved) => {
    const page = resolved?.entry?.page ?? resolved?.page ?? null;
    if (typeof page === 'string') pages.add(page);
  };
  for (const list of Object.values(restatement.refs?.get(entry) ?? {})) for (const resolved of list) take(resolved);
  for (const resolved of Object.values(journey?.refs ?? {}).flat()) take(resolved);
  // A journey's steps name their actions and lifecycles; their pages are its parts' tables and lifecycle pages.
  return [...pages];
}

/** A journey code adds, in a journey page's form (door.md §gives `journey`; forms.md §journeys, design.md §code-journeys). */
function journeyPageText(journey) {
  return `# ${journey.heading ?? journey.key}\n\n${journeyTablesText(journey)}\n`;
}

// --- Explain (door.md §gives; evidence.md §surprises, §rerun) -----------------------------------------------------------------

/** The surprise an Explain item is for: `explain:<surprise>`, or the stem of an explanation or weaker form that is a change. */
function surpriseOf(project, item) {
  const at = item.indexOf(':');
  const prefix = item.slice(0, at);
  const rest = item.slice(at + 1);
  let name = null;
  if (prefix === 'explain') name = rest;
  if (prefix === 'change') {
    const where = modelsPath(rest);
    if (where.stem) name = `${rest.slice('models/'.length, rest.lastIndexOf('/') + 1)}${where.stem}`;
  }
  const surprise = name ? project.surprises.get(name) : null;
  return surprise?.counts ? surprise : null;
}

/** The surprise's run and each of its reductions' that runs/ here does not hold on the basis its evidence names (evidence.md §rerun). */
async function runsNeeded(root, project, surprise) {
  const items = [{ name: surprise.value.question, value: surprise.value }];
  for (const path of project.stems.get(surprise.name)?.reductions ?? []) {
    const file = project.files.get(path);
    if (file?.counts && file.value) items.push({ name: file.value.name, value: file.value });
  }
  const needed = [];
  for (const item of items) {
    const held = await readBytes(root, `runs/${item.name}/basis.json`);
    let ok = false;
    try {
      ok = Boolean(held) && basisDigest(JSON.parse(held.toString('utf8')).basis) === basisDigest(item.value.basis);
    } catch {
      ok = false;
    }
    if (!ok) needed.push(item.name);
  }
  return needed;
}

/** The entries a trace names (door.md §gives): each action, lifecycle and world row its states hold (engines.md §trace). */
function traceEntries(trace) {
  const names = new Set();
  for (const state of trace?.states ?? []) {
    for (const row of state.rows ?? []) {
      if (typeof row.action === 'string' && row.action.includes('/')) {
        const [part, action] = row.action.split('/');
        names.add(`${part}/actions/${action}`);
      }
      if (typeof row.misbehaviour === 'string') {
        const [part, key] = row.misbehaviour.split('/');
        names.add(`${part}/boundary/${key}`);
      }
    }
    for (const lifecycle of Object.keys(state.phases ?? {})) {
      const [part, key] = lifecycle.split('/');
      if (part && key) names.add(`${part}/lifecycles/${key}`);
    }
  }
  return names;
}

/**
 * Explain (door.md §gives): the surprise's file, the evidence of its reductions and weaker forms, and for a path surprise its
 * journey's start question's evidence; the pages of what they read or their traces name; the files their bases name,
 * the model's files and the slots; and runs/ of the surprise and each reduction.
 */
async function explainPacket(root, project, design, surprise, add, extra) {
  const stem = project.stems.get(surprise.name) ?? {};
  const read = [surprise.path, ...(stem.reductions ?? []), ...(stem.weakerEvidence ?? [])];
  if (surprise.where.question?.kind === 'path') {
    const start = surprise.value.question.replace(/\/path(-to-\d+)?\.([0-9a-f]{12})$/, '/start.$2');
    if (start !== surprise.value.question) read.push(`models/${start}.json`);
  }
  const entries = new Set();
  for (const path of read) {
    await add(path);
    const file = path === surprise.path ? surprise : project.files.get(path);
    const value = file?.value ?? null;
    for (const e of value?.basis?.entries ?? []) entries.add(e.entry);
    for (const name of traceEntries(value?.trace)) entries.add(name);
    for (const f of value?.basis?.files ?? []) if (f.path) await add(f.path);
  }
  for (const name of entries) {
    const entry = project.restatement.entries.get(name);
    if (entry?.page) await add(entry.page);
    const journey = design.journeys.get(name);
    if (journey?.page) await add(journey.page);
    if (journey?.added && surprise.where.thing?.kind === 'journeys' && name === `${surprise.where.holder.key}/journeys/${surprise.where.thing.key}`) extra.journey = journeyPageText(journey);
    // The brief document or source holding each passage the entry cites (design.md §passages), since the verdict an
    // explanation recommends turns on what the brief says; a journey code adds cites as its page would.
    for (const address of [...(entry?.cites ?? []), ...(!entry && journey?.added ? journey.cites ?? [] : [])]) {
      const passage = project.brief.passages.get(address);
      if (passage) await add(passage.path);
    }
  }
  if (!extra.journey && surprise.where.thing?.kind === 'journeys') {
    const journey = design.journeys.get(`${surprise.where.holder.key}/journeys/${surprise.where.thing.key}`);
    if (journey?.added) extra.journey = journeyPageText(journey);
  }
  // The model's files and the slots: its model.md and engine files, and the accepted slots of the thing it is on.
  const record = project.models.get(surprise.where.model);
  if (record && !record.lifecycle) {
    if (record.modelMd) await add(record.modelMd.path);
    for (const name of record.engineFiles) await add(`${record.folder}/${name}`);
  }
  const folder = surprise.path.slice(0, surprise.path.lastIndexOf('/'));
  for (const slot of project.slots.values()) if (slot.counts && slot.path.slice(0, slot.path.lastIndexOf('/')) === folder) await add(slot.path);
  // What runs/ holds of the run of the surprise and of each reduction.
  const runs = [surprise.value.question, ...(stem.reductions ?? []).map((p) => project.files.get(p)?.value?.name).filter(Boolean)];
  for (const name of runs) for (const entry of await walk(root, `runs/${name}`)) if (entry.type === 'file' && !entry.path.endsWith('/running.json')) await add(entry.path);
}

// --- item.json (door.md §gives) -------------------------------------------------------------------------------------

/** The entries whose pages a packet gives, by name, and the parts whose pages it gives. */
function givenEntries(project, given) {
  const pages = new Set(given.filter((p) => p.startsWith('design/')));
  const entries = new Set();
  for (const [name, entry] of project.restatement.entries) if (pages.has(entry.page)) entries.add(name);
  const parts = new Set();
  for (const path of pages) {
    const where = designPath(path);
    if (where.holder && !where.holder.span) parts.add(where.holder.key);
  }
  return { pages, entries, parts };
}

/** item.json's value (door.md §gives), its keys in the contract's order. */
function itemValue(project, design, evidence, item, given, refusals, extra) {
  const { pages, entries, parts } = givenEntries(project, given);
  const confirmed = [];
  for (const unit of design.units.values()) {
    if (unit.state !== 'confirmed') continue;
    const among = unit.name === 'parts' ? pages.has('design/README.md') : (unit.entries ?? []).some((e) => entries.has(e)) || entries.has(unit.name);
    if (among) confirmed.push({ name: unit.name, pin: unit.pin });
  }
  // Each pick in force on a choice among the entries given, or on a choice whose cells a lifecycle given poses: as
  // written, so a cell the pick fills counts with those still posed (lifecycle-tool.md §as-read).
  const posing = new Set();
  for (const lifecycle of design.lifecycles.values()) {
    if (!entries.has(lifecycle.entry)) continue;
    for (const cell of [...(lifecycle.posed ?? []), ...(lifecycle.fills ?? [])]) {
      const name = String(cell.choice).includes('/choices/') ? cell.choice : resolveRef(project.restatement, cell.choice, lifecycle.holder, 'choices').entry?.entry;
      if (name) posing.add(name);
    }
  }
  const picks = [];
  for (const [choice, pick] of design.picks) {
    if (!entries.has(choice) && !posing.has(choice)) continue;
    const picked = pick.journeys ?? [];
    picks.push({ choice, journey: picked.length === 1 ? picked[0] : picked, cells: pick.fills ?? [] });
  }
  const struck = sortedBy([...(evidence.ctx?.strikes ?? [])].filter((name) => parts.has(name.slice('strike:'.length).split('/')[0])));
  const value = {
    item,
    confirmed: sortedBy(confirmed, (u) => u.name),
    picks: sortedBy(picks, (p) => p.choice),
    struck,
    refused: refusals,
  };
  if (extra.journey) value.journey = extra.journey;
  if (extra.decision) value.decision = extra.decision;
  if (extra.differ) value.differ = extra.differ;
  return value;
}
