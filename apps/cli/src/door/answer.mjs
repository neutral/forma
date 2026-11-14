// `forma answer <item> <folder> --provider --model --session` (door.md §answer-holds to §receipts): an answer checked
// and taken in, or refused with every reason. Before the lock: the arguments, the folder and the
// clock rule. Under it: the allowance; the count and the session seen; the door's own checks; the
// kind's checks against the project as it would read with the answer taken in; then the files
// written with their receipt lines, what goes with them removed, and the item's refusals dropped;
// or the refusal kept under the item in work/refused/ while it is missing.

import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readAccount } from '../account/index.mjs';
import { kindOf as itemKind, SUPPLY } from '../account/items.mjs';
import { checkRestate } from '../design/restate.mjs';
import { checkExplain } from '../evidence/explain.mjs';
import { movedEvidence } from '../evidence/run.mjs';
import { aheadOfClock, sha256, sortedBy } from '../record/json.mjs';
import { readProject } from '../record/project.mjs';
import { mechanismsSorted, rewriteReceipt, sameSession, takeIn, takeOut } from '../record/receipts.mjs';
import { designPath, modelsPath, moveFolder, removeEmptyFolders, removeFile, removeFolder, writeWhole } from '../record/tree.mjs';
import { withLock } from './lock.mjs';
import { allowanceOf, readSpent, spend } from './spent.mjs';
import { agentFolder, itemOf, reason, reasonLine } from './common.mjs';
import { checkModelAnswer, checkSlotAnswer } from './model-answers.mjs';
import { checkRepair, repairMarks } from './meets.mjs';
import { repairOf } from './repair.mjs';
import { addSession, dropRefusals, keepRefusal } from './work.mjs';

const CHECK = 'door.md §forma-answer';
const folderOf = (path) => path.slice(0, path.lastIndexOf('/'));
const nameOf = (path) => path.slice(path.lastIndexOf('/') + 1);

/** The output of a refusal before the answer counts (door.md §forma-answer): an argument, the clock rule, the allowance. */
function early(item, reasons, json, answers = null) {
  if (json) return { status: 1, stdout: `${JSON.stringify({ refused: reasons })}\n`, stderr: '' };
  const lines = [`refused ${item ?? ''}`.trimEnd(), ...reasons.map(reasonLine)];
  if (answers) lines.push(`answers: ${answers.spent} spent of ${answers.allowed}`);
  return { status: 1, stdout: `${lines.join('\n')}\n`, stderr: '' };
}

/** The output of an answer counted (door.md §forma-answer): accepted with what it wrote and removed, or refused with every reason. */
function told(value, json) {
  if (json) return { status: value.accepted ? 0 : 1, stdout: `${JSON.stringify(value)}\n`, stderr: '' };
  const lines = [`${value.accepted ? 'accepted' : 'refused'} ${value.item}`];
  if (value.accepted) {
    for (const w of value.written) lines.push(`wrote ${w.path}`);
    for (const path of value.removed) lines.push(`removed ${path}`);
  } else lines.push(...value.reasons.map(reasonLine));
  lines.push(`answers: ${value.answers.spent} spent of ${value.answers.allowed}`);
  return { status: value.accepted ? 0 : 1, stdout: `${lines.join('\n')}\n`, stderr: '' };
}

/** The files of an answer folder (door.md §answer-holds): `{ files: Map<path, bytes>, reasons }`, every link, empty folder or other kind of file a reason. */
async function readFolder(folder) {
  const files = new Map();
  const reasons = [];
  const visit = async (at) => {
    const names = (await readdir(join(folder, at))).sort();
    if (!names.length && at) reasons.push(reason('door.md §answer-holds', at, null, null, 'it is an empty folder; an answer holds only regular files and the folders that hold them'));
    for (const name of names) {
      const path = at ? `${at}/${name}` : name;
      const stats = await lstat(join(folder, path));
      if (stats.isSymbolicLink()) reasons.push(reason('door.md §answer-holds', path, null, null, 'it is a symbolic link; an answer holds only regular files and the folders that hold them'));
      else if (stats.isDirectory()) await visit(path);
      else if (stats.isFile()) files.set(path, await readFile(join(folder, path)));
      else reasons.push(reason('door.md §answer-holds', path, null, null, 'it is neither a regular file nor a folder; an answer holds only regular files and the folders that hold them'));
    }
  };
  await visit('');
  if (!files.size && !reasons.length) reasons.push(reason('door.md §answer-holds', null, null, null, 'the folder holds no file, so it answers nothing'));
  return { files, reasons };
}

/** The kinds whose paths hold a file of an answer (door.md §answer-holds), before its kind's contract checks it. */
function pathKinds(path) {
  const kinds = new Set();
  if (path === 'removed.md' || designPath(path).kind === 'page') kinds.add('restate');
  const where = modelsPath(path);
  if (where.kind === 'model-md' || where.kind === 'engine') kinds.add('model');
  if (where.kind === 'slot') kinds.add('slot');
  if (path === 'explain.md' || /^weaker\/[^/]+\.[^/.]+$/.test(path)) kinds.add('explain');
  return kinds;
}

/** What a file at a path that no kind holds is, for a reason (door.md §answer-holds). */
function notHeld(path) {
  const d = designPath(path);
  const m = modelsPath(path);
  if (d.kind === 'brief') return 'a file of the brief, which an agent writes directly in the project and no answer holds';
  if (d.kind === 'decision' || d.kind === 'nested') return 'a decision, which only the developer records, through forma decide';
  if (d.kind === 'receipt' || m.kind === 'receipt') return 'a receipt, which only Forma writes';
  if (['evidence', 'surprise', 'reduction', 'weaker-evidence'].includes(m.kind)) return 'evidence, which only forma run writes';
  if (/\.json$/.test(path)) return 'JSON, which no answer holds: Forma writes every JSON file itself';
  return 'at no path an answer holds: a page at its path under design/, a model file or slot at its path under models/, or removed.md, explain.md, weaker/<key>.<ext> or repair.md at the folder\'s top';
}

/** The paths a kind's answer holds (door.md §answer-holds), in words, for a reason. */
const KIND_PATHS = {
  restate: 'pages at their project paths under design/, outside design/brief/, and removed.md at the folder\'s top',
  model: 'models/<model>/model.md and every engine file of one model, at the top of its folder',
  slot: 'the one slot file, at its path under models/<model>/',
  explain: 'explain.md and weaker/<key>.<ext>, at the folder\'s top',
};

/**
 * The kind of an answer and the door's path checks (door.md §answer-holds, §forma-answer step 3): `{ kind, route, reasons }`. `route`, for a
 * Repair answer, is the target it takes: `{ kind: 'restate' }` or a model target (repair.mjs).
 */
function kindOf(account, found, files, itemName) {
  const reasons = [];
  const paths = sortedBy([...files.keys()]);
  const kinds = found.kinds;
  if (kinds.includes('repair')) {
    const repair = repairOf(account.project, account.design, itemName);
    if (!repair.kinds.length) return { kind: 'repair', route: null, repair, reasons: repair.reasons.map((says) => reason('door.md §repair-answer', null, null, null, says)) };
    if (!files.has('repair.md')) reasons.push(reason('door.md §repair-answer', 'repair.md', null, null, 'a Repair answer holds repair.md at the folder\'s top, its one row Mechanism saying what the repair adds or changes'));
    const rest = paths.filter((p) => p !== 'repair.md');
    const fits = (route, path) => {
      if (route.kind === 'restate') return path === 'removed.md' || designPath(path).kind === 'page';
      // A Repair of a model may hold removed.md at its folder's top, naming slots of the model it removes (door.md §answer-holds, §repair-answer; models.md §model-repair).
      if (path === 'removed.md') return true;
      const where = modelsPath(path);
      if (where.model === route.model && (where.kind === 'slot' || (!route.lifecycle && (where.kind === 'model-md' || where.kind === 'engine')))) return true;
      const d = designPath(path);
      return route.lifecycle && d.kind === 'page' && d.form === 'thing' && d.thing.kind === 'lifecycles' && !d.holder.span && d.holder.key === route.parts[0];
    };
    const route = rest.length ? repair.kinds.find((r) => rest.every((path) => fits(r, path))) ?? null : null;
    if (!rest.length) reasons.push(reason('door.md §repair-answer', null, null, null, 'the answer holds repair.md and nothing it repairs: it holds at least one file of its target'));
    else if (!route) {
      const where = repair.kinds.map((r) => (r.kind === 'restate' ? 'the restatement (a Restate answer\'s pages and removed.md)' : r.lifecycle ? `the lifecycle model ${r.model} (its slots and its part's confirmed lifecycle pages, and removed.md naming slots it removes)` : `the model ${r.model} (its model files, its slots, or both, and removed.md naming slots it removes)`)).join(', or ');
      const strays = rest.filter((path) => !repair.kinds.some((r) => fits(r, path)));
      for (const path of strays) reasons.push(reason('door.md §repair-answer', path, null, null, `a Repair answer for ${itemName} holds files of ${where}, and this file is none of them`));
      if (!strays.length) reasons.push(reason('door.md §repair-answer', null, null, null, `a Repair answer for ${itemName} holds files of one target, ${where}, and this one holds files of more than one`));
    }
    return { kind: 'repair', route, repair, reasons };
  }
  for (const path of paths) {
    const at = pathKinds(path);
    if (!at.size) reasons.push(reason('door.md §answer-holds', path, null, null, `it is ${notHeld(path)}`));
  }
  if (reasons.length) return { kind: kinds.length === 1 ? kinds[0] : null, reasons };
  // The kind its item's supplier names; of two, the one at whose paths its files are (door.md §answer-holds).
  const fitting = kinds.filter((kind) => paths.every((path) => pathKinds(path).has(kind)));
  if (!fitting.length) {
    if (kinds.length === 1) {
      for (const path of paths) if (!pathKinds(path).has(kinds[0])) reasons.push(reason('door.md §answer-holds', path, null, null, `an answer for ${itemName} is a ${kinds[0]} answer, which holds ${KIND_PATHS[kinds[0]]}, and this file is not one`));
    } else reasons.push(reason('door.md §answer-holds', null, null, null, `an answer for ${itemName} is ${kinds.map((k) => `a ${k} answer, holding ${KIND_PATHS[k]}`).join(', or ')}; its files are at both kinds' paths, or at neither's, so it is no one kind`));
    return { kind: null, reasons };
  }
  const kind = fitting[0];
  if (kind === 'model') {
    const models = [...new Set(paths.map((p) => p.split('/')[1]))];
    if (models.length > 1) reasons.push(reason('door.md §answer-holds', null, null, null, `a Model answer holds the files of one model, and this one holds files of ${models.join(', ')}`));
  }
  if (kind === 'slot' && paths.length > 1) reasons.push(reason('door.md §answer-holds', null, null, null, `a Fill-a-slot answer holds the one slot file, and this one holds ${paths.length} files: ${paths.join(', ')}`));
  return { kind, route: null, reasons };
}

/**
 * The paths of an answer for an item that is not missing (door.md §answer-holds, §forma-answer step 3): the folder must still hold what door.md §answer-holds
 * allows, a failure apart from the item's. Each file at no path an answer holds is a reason; where the item's kind of
 * name is supplied by one kind of answer (account.md §items), so is each file at none of that kind's paths.
 */
function pathReasons(files, itemName) {
  const kinds = (SUPPLY[itemKind(itemName)] ?? []).filter((s) => s.by === 'agent' && s.answer !== 'repair').map((s) => s.answer);
  const paths = sortedBy([...files.keys()]);
  const reasons = paths.filter((path) => !pathKinds(path).size).map((path) => reason('door.md §answer-holds', path, null, null, `it is ${notHeld(path)}`));
  if (reasons.length || kinds.length !== 1) return reasons;
  for (const path of paths) if (!pathKinds(path).has(kinds[0])) reasons.push(reason('door.md §answer-holds', path, null, null, `an answer for ${itemName} is a ${kinds[0]} answer, which holds ${KIND_PATHS[kinds[0]]}, and this file is not one`));
  return reasons;
}

/** The item's binding of an answer (door.md §answer-holds, §change; account.md §items): the model `model:` names, and `change:<path>` held. */
function bindingReasons(itemName, kind, files) {
  const reasons = [];
  const at = itemName.indexOf(':');
  const prefix = itemName.slice(0, at);
  const rest = itemName.slice(at + 1);
  const paths = [...files.keys()];
  if (prefix === 'model' && kind === 'model' && paths.some((p) => p.split('/')[1] !== rest)) reasons.push(reason('door.md §answer-holds', null, null, null, `the item ${itemName} owes the model ${rest} a Model answer, and this answer holds another model's files`));
  if (prefix === 'change') {
    const where = modelsPath(rest);
    let held = files.has(rest);
    if (kind === 'explain' && where.kind === 'explanation') held = files.has('explain.md');
    if (kind === 'explain' && where.kind === 'weaker') held = files.has(`weaker/${where.key}.${where.extension}`);
    if (kind === 'model' && (where.kind === 'model-md' || where.kind === 'engine')) held = held || paths.every((p) => p.split('/')[1] === where.model);
    if (!held) reasons.push(reason('door.md §answer-holds', rest, null, null, `an answer for ${itemName} holds that file, ${kind === 'explain' ? 'as explain.md or weaker/<key>.<ext>' : 'at its path'}, and this one does not`));
  }
  return reasons;
}

/**
 * `forma answer <item> <folder> --provider <name> --model <name> --session <id> [--json]` (door.md §forma-answer): gives `{
 * status, stdout, stderr }`. `cwd` is the folder a relative `folder` is read from.
 */
export async function answerCommand(root, { item, folder, provider, model, session, json = false, cwd = process.cwd() }) {
  const args = [];
  const want = [['item', item, 'the item, as forma missing names it'], ['folder', folder, 'the folder holding the answer'], ['--provider', provider, 'the provider of the session'], ['--model', model, 'the model of the session'], ['--session', session, 'the session\'s id']];
  for (const [name, value, what] of want) if (typeof value !== 'string' || value === '') args.push(reason(CHECK, null, null, null, `${name} is ${value === '' ? 'empty' : 'missing'}: ${what}; forma answer <item> <folder> --provider <name> --model <name> --session <id>`));
  if (args.length) return early(item, args, json);
  const target = await agentFolder(root, folder, cwd);
  if (!target.exists || !target.isFolder) return early(item, [reason(CHECK, null, null, null, `${target.path} is ${target.exists ? 'not a folder' : 'absent'}; the answer is a folder of your own holding its files`)], json);
  const ahead = aheadOfClock((await readProject(root)).clock.latest);
  if (ahead) return early(item, [reason('door.md §clock', ahead.file, null, null, `it holds the time ${ahead.at}, more than a minute ahead of this machine's clock (${new Date().toISOString()}), so forma answer takes nothing in and counts nothing until the clock passes it`)], json);
  const declared = { provider, model, session };
  return withLock(root, () => underLock(root, { item, target, declared, json }));
}

/** door.md §forma-answer steps 1 to 6, holding the writer's lock. */
async function underLock(root, { item, target, declared, json }) {
  const account = await readAccount(root);
  const { project, design, evidence } = account;
  // 1. Allowance (door.md §spent).
  const allowance = allowanceOf(design.force ?? project.force);
  let spent = await readSpent(root);
  if (spent.answers >= allowance.answers) {
    const says = allowance.answers === 0 && !(design.force ?? project.force)?.intake
      ? 'no answer is allowed before the intake: the developer records it first (forma decide intake), and the item waits for it'
      : `the answers allowed on this machine are spent, ${spent.answers} of ${allowance.answers}: the answer counts nothing, and the item waits for the developer's allowance (forma decide allow)`;
    return early(item, [reason('door.md §spent', null, null, null, says)], json, { spent: spent.answers, allowed: allowance.answers });
  }
  // 2. Count, and the session seen (door.md §sessions, §spent).
  spent = await spend(root, 'answers');
  await addSession(root, declared);
  const answers = { spent: spent.answers, allowed: allowance.answers };
  const value = { item, kind: null, accepted: false, written: [], removed: [], reasons: [], answers };
  const refuse = async (reasons, kind, keep) => {
    value.kind = kind ?? null;
    value.reasons = reasons;
    // 6. While the item is missing, its refusal is kept here (door.md §scratch).
    if (keep) await keepRefusal(root, item, declared, reasons);
    return told(value, json);
  };

  // 3. The door's checks, each failure a reason.
  const door = [];
  const found = itemOf(account, item, CHECK);
  if (found.reasons) door.push(...found.reasons);
  const missing = Boolean(found.item) && !found.further;
  if (target.inside) door.push(reason(CHECK, null, null, null, `the folder ${target.path} is the project folder or inside it${target.real !== target.path ? `, its links resolved (${target.real})` : ''}; an answer comes from a folder of the agent's own outside the project`));
  const { files, reasons: held } = await readFolder(target.path);
  door.push(...held);
  let kind = null;
  let route = null;
  let repair = null;
  if (found.item && !held.length && !target.inside) {
    const k = kindOf(account, found, files, item);
    door.push(...k.reasons);
    kind = k.kind;
    route = k.route ?? null;
    repair = k.repair ?? null;
    if (kind && !k.reasons.length) door.push(...bindingReasons(item, kind, files));
  } else if (!held.length && !target.inside) door.push(...pathReasons(files, item));
  if (project.sessions.decided.some((s) => sameSession(s, declared))) door.push(reason('door.md §sessions', null, null, null, `the session ${declared.provider} / ${declared.model} / ${declared.session} has made a decision, so it answers nothing: an agent's session never decides, and a deciding one never answers`));
  const surprise = kind === 'explain' ? explainedSurprise(project, item) : null;
  if (surprise) {
    const authors = project.models.get(surprise.where.model)?.authors ?? [];
    if (authors.some((s) => sameSession(s, declared))) door.push(reason('door.md §forma-answer', null, null, null, `the session ${declared.provider} / ${declared.model} / ${declared.session} is an author of the model ${surprise.where.model}, and no explanation of its surprises comes from one of its authors`));
  }
  if (door.length) return refuse(door, kind, missing);

  // 4. Its kind's checks, against the project as it would read with the answer taken in.
  let plan;
  try {
    plan = await kindChecks(account, { kind, route, repair, files, item, found, surprise });
  } catch (error) {
    // A check that cannot finish because a tool it needs fails refuses the answer with that reason (door.md §forma-answer step 4).
    plan = { refused: [reason(CHECK, null, null, null, `a check could not finish: ${error.message}`)] };
  }
  if (plan.refused?.length) return refuse(plan.refused, kind, missing);

  // 5. Taken in (door.md §forma-answer, §repair-answer, §receipts): moves, then removes, then writes, each with its receipt line.
  const marks = repairMarks(account, plan, { kind, repair, declared });
  const { written, removed } = await takeInPlan(root, project, plan, marks, declared);
  await dropRefusals(root, item);
  value.kind = kind;
  value.accepted = true;
  value.written = written;
  value.removed = removed;
  return told(value, json);
}

/** The surprise an Explain answer is for, from its item (door.md §forma-answer step 3): `explain:<surprise>`, or a change of its stem's file. */
function explainedSurprise(project, item) {
  const at = item.indexOf(':');
  const prefix = item.slice(0, at);
  const rest = item.slice(at + 1);
  let name = prefix === 'explain' ? rest : null;
  if (prefix === 'change') {
    const where = modelsPath(rest);
    if (where.stem) name = `${rest.slice('models/'.length, rest.lastIndexOf('/') + 1)}${where.stem}`;
  }
  const surprise = name ? project.surprises.get(name) : null;
  return surprise?.counts ? surprise : null;
}

/**
 * Each kind's checks (door.md §answer-holds): `{ refused }`, or the plan the door takes in: `{ writes: [{ path, bytes, fields }],
 * removes: [path], moves: [{ from, to, entry }], after }`, `after` the restatement and design after it where it changes.
 */
async function kindChecks(account, { kind, route, repair, files, item, found, surprise }) {
  const { project, design, evidence } = account;
  if (kind === 'restate') {
    const result = checkRestate(project, design, files);
    if (result.refused) return { refused: result.refused };
    return { writes: result.writes.map((w) => ({ ...w, fields: {} })), removes: result.removes, moves: result.moves, entries: result.entries, designAfter: result.design };
  }
  if (kind === 'model') {
    const result = await checkModelAnswer(account, files, { item });
    if (result.refused) return { refused: result.refused };
    return { writes: result.writes, removes: [...result.removes, ...result.dropSlots, ...result.dropEvidence], moves: [] };
  }
  if (kind === 'slot') {
    const [[path, bytes]] = [...files];
    const result = await checkSlotAnswer(account, path, bytes, { item, further: found.further });
    if (result.refused) return { refused: result.refused };
    return { writes: result.writes, removes: result.removes, moves: [] };
  }
  if (kind === 'explain') {
    const result = await checkExplain(project, design, evidence, files);
    if (result.refused) return { refused: result.refused };
    const named = result.writes[0].path.replace(/^models\//, '').replace(/\.explained\.md$/, '');
    if (surprise && named !== surprise.name) return { refused: [reason('door.md §answer-holds', 'explain.md', null, 'Question', `explain.md names the surprise ${named}, and the answer is for ${item}, whose surprise is ${surprise.name}`)] };
    if (!surprise) return { refused: [reason('door.md §forma-answer', 'explain.md', null, null, `${item} names no surprise this project holds`)] };
    return { writes: result.writes.map((w) => ({ ...w, fields: {} })), removes: [], moves: [] };
  }
  if (kind === 'repair') return checkRepair(account, { route, repair, files, item });
  return { refused: [reason(CHECK, null, null, null, `${item} is answered by no kind of answer Forma takes`)] };
}

/**
 * Takes a plan in (door.md §forma-answer, §repair-answer, §receipts; models.md §parts-change; evidence.md §moved): each moved folder under models/ with its
 * evidence rewritten for its new path and its receipt's pins renamed; then each removal, a file before its lines; then
 * each write with its receipt line, beside the old lines until the file is written. Gives `{ written, removed }`.
 */
async function takeInPlan(root, project, plan, marks, declared) {
  const written = [];
  const removed = [];
  for (const move of plan.moves ?? []) {
    const inside = [...project.files.values()].filter((f) => f.path.startsWith(`${move.from}/`));
    await moveFolder(root, move.from, move.to);
    for (const file of inside) {
      let moved = null;
      try {
        moved = movedEvidence(file.path, file.bytes, { from: move.from, to: move.to, fromEntry: move.entry.from, toEntry: move.entry.to });
      } catch {
        // Evidence that does not parse moves as it is; its own check fails at read and its question's next run rewrites it (door.md §change item 5).
      }
      if (moved) await writeWhole(root, moved.path, moved.bytes);
      if (file.path.endsWith('/receipt')) continue;
      removed.push(file.path);
      written.push({ path: moved?.path ?? `${move.to}${file.path.slice(move.from.length)}`, sha256: sha256(moved?.bytes ?? file.bytes) });
    }
    await rewriteReceipt(root, move.to, (line) => (line.pins ? { ...line, pins: sortedBy(line.pins.map((p) => (p.entry === move.entry.from ? { entry: move.entry.to, pin: p.pin } : p)), (p) => p.entry) } : line));
    await removeEmptyFolders(root, folderOf(move.from), 'models');
  }
  for (const path of plan.removes ?? []) {
    if (path.endsWith('/')) {
      const folder = path.slice(0, -1);
      // Every file the folder held goes with it, its receipt among them (door.md §forma-answer: each file removed).
      for (const file of project.files.values()) if (file.path.startsWith(path)) removed.push(file.path);
      await removeFolder(root, folder);
      await removeEmptyFolders(root, folderOf(folder), 'models');
      continue;
    }
    const where = path.startsWith('models/') ? modelsPath(path) : null;
    if (where && ['evidence', 'surprise', 'reduction', 'weaker-evidence'].includes(where.kind)) await removeFile(root, path);
    else await takeOut(root, folderOf(path), nameOf(path));
    removed.push(path);
    await removeEmptyFolders(root, folderOf(path), path.startsWith('design/') ? 'design' : 'models');
  }
  for (const write of plan.writes ?? []) {
    const fields = { session: declared, ...write.fields, ...(marks.lines.get(write.path) ?? {}) };
    await takeIn(root, folderOf(write.path), nameOf(write.path), Buffer.from(write.bytes), fields);
    written.push({ path: write.path, sha256: sha256(write.bytes) });
  }
  // A repair made or met by removing (door.md §repair-answer): on the line of the README.md of the part or span, or of design/README.md,
  // or for what it removed under models/<model>/ of that model's model.md, or for a lifecycle model of its part's README.md.
  for (const [readme, mark] of marks.readmes) {
    const folder = folderOf(readme);
    const name = nameOf(readme);
    await rewriteReceipt(root, folder, (line) => {
      if (line.file !== name) return line;
      const answersNow = sortedBy([...new Set([...(line.answers ?? []), ...mark.answers])]);
      // A Repair answer's removals' line gives its decision with its mechanism (door.md §repair-answer, §receipts `mechanisms`).
      const mechanismsNow = mechanismsSorted([...(line.mechanisms ?? []), ...mark.mechanisms]);
      const seen = new Map([...(line.removed ?? []), ...mark.removed].map((r) => [`${r.file}\0${r.before}`, r]));
      return { ...line, answers: answersNow, mechanisms: mechanismsNow.length ? mechanismsNow : undefined, removed: sortedBy([...seen.values()], (r) => [r.file, r.before]) };
    });
  }
  return { written: sortedBy(written, (w) => w.path), removed: sortedBy([...new Set(removed)]) };
}
