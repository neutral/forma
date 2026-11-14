// What `forma give` and `forma answer` share at the door (door.md §forma-give, §answer-holds, §forma-answer): a reason in door.md §forma-answer's
// form and its line of text, the agent's folder outside the project with every symbolic link
// resolved, an item as the account names it and the kinds of answer that supply it, and further
// witnesses and faults that models.md §owed lets be answered at any time.

import { lstat, readdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { modelsPath } from '../record/tree.mjs';

/** A reason in door.md §forma-answer's form. */
export const reason = (check, file, entry, field, says) => ({ check, file: file ?? null, entry: entry ?? null, field: field ?? null, says });

/** A reason as one line of text (door.md §forma-answer): `<file> <entry> <field>: <says> (<check>)`, without what is null. */
export function reasonLine(r) {
  const where = [r.file, r.entry, r.field].filter((x) => x !== null && x !== undefined && x !== '').join(' ');
  return `${where ? `${where}: ` : ''}${r.says} (${r.check})`;
}

/** A path with every symbolic link in it resolved, the part that does not exist yet appended as written (door.md §forma-give, §forma-answer). */
async function realOf(path) {
  const rest = [];
  let at = resolve(path);
  for (;;) {
    try {
      const real = await realpath(at);
      return rest.length ? join(real, ...rest.reverse()) : real;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      const up = dirname(at);
      if (up === at) return resolve(path);
      rest.push(basename(at));
      at = up;
    }
  }
}

/**
 * The agent's folder (door.md §forma-give, §forma-answer): `{ path, real, exists, isFolder, empty, inside }`, `path` absolute as
 * given from `cwd`, `real` with every symbolic link resolved, and `inside` whether it is the project folder or inside it.
 */
export async function agentFolder(root, folder, cwd) {
  const path = resolve(cwd, folder);
  const real = await realOf(path);
  const project = await realOf(root);
  const inside = real === project || real.startsWith(project.endsWith(sep) ? project : `${project}${sep}`);
  let exists = false;
  let isFolder = false;
  let empty = false;
  try {
    const stats = await stat(path);
    exists = true;
    isFolder = stats.isDirectory();
    if (isFolder) empty = (await readdir(path)).length === 0;
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    // A dangling symbolic link is there, and is no folder.
    try {
      await lstat(path);
      exists = true;
    } catch {
      // absent
    }
  }
  return { path, real, exists, isFolder, empty, inside };
}

// --- Items (account.md §items, §commands) ---------------------------------------------------------------------------------

/** The kinds of answer an item's supply names (account.md §commands): `restate`, `model`, `slot`, `explain` or `repair`, in its order. */
const answerKinds = (item) => (item?.supply ?? []).filter((s) => s?.by === 'agent' && typeof s.answer === 'string').map((s) => s.answer);

/** Who supplies an item, in words (account.md §items), for a refusal that it is not an agent's to answer. */
function supplyWords(item) {
  const words = (item?.supply ?? []).map((s) => (s.by === 'agent' ? `an agent's ${s.answer} answer` : s.by === 'run' ? 'forma run' : s.by === 'developer' ? `the developer's ${s.decision} (forma decide ${s.decision})` : s.by === 'anyone' ? 'anyone restoring the file from the project\'s history, or removing one no answer can hold' : String(s.by)));
  return words.join(', or ') || 'no one';
}

/**
 * Whether `slot:<claim folder>/witness` or `/fault` may be answered now though it is not missing (models.md §owed): the
 * claim's encoding on that model is filled, current and a property there, on a usable model. `evidence` is
 * readEvidence's. Gives `{ ok, claimFolder, model, says }`.
 */
function furtherSlot(evidence, name) {
  const m = /^slot:(.+)\/(witness|fault)$/.exec(name ?? '');
  if (!m) return { ok: false };
  const claimFolder = `models/${m[1]}`;
  const where = modelsPath(`${claimFolder}/${m[2]}-x.md`);
  if (where.kind !== 'slot' || where.thing?.kind !== 'claims') return { ok: false };
  const state = evidence.models.get(where.model);
  const encoding = [...evidence.slots.files.values()].find((s) => s.kind === 'encoding' && s.model === where.model && s.path.startsWith(`${claimFolder}/encoding.`));
  if (!state?.usable) return { ok: false, claimFolder, model: where.model, says: `the model ${where.model} is not usable now, so no ${m[2]} is owed or taken on it (models.md §slot-currency)` };
  if (!encoding?.current || !encoding.property) return { ok: false, claimFolder, model: where.model, says: `the claim's encoding on ${where.model} is not a current property, so it takes no ${m[2]} there (models.md §owed)` };
  return { ok: true, claimFolder, model: where.model, slot: m[2], entry: `${where.holder.key}/claims/${where.thing.key}` };
}

/**
 * An item by name as the account lists it, with the kinds of answer that supply it (door.md §forma-give, §forma-answer step 3): `{ item,
 * kinds, further }`, or `{ reasons }`. A further witness or fault that models.md §owed lets be answered at any time is
 * taken though not missing; its item is written as account.md §commands writes a `slot:` item.
 */
export function itemOf(account, name, check) {
  const found = account.items.find((i) => i.item === name);
  if (found) {
    const kinds = answerKinds(found);
    if (kinds.length) return { item: found, kinds, further: false };
    return { reasons: [reason(check, null, null, null, `${name} is missing, and it is supplied by ${supplyWords(found)}, not by an agent's answer`)] };
  }
  const further = furtherSlot(account.evidence, name);
  if (further.ok) return { item: { item: name, supply: [{ by: 'agent', answer: 'slot' }], on: name.slice('slot:'.length), why: 'further' }, kinds: ['slot'], further: true };
  const hint = further.says ? `: ${further.says}` : '; forma missing lists every item missing now, and an answer is for one of them';
  return { reasons: [reason(check, null, null, null, `${name} is not missing${hint}`)] };
}

/**
 * The contracts a packet holds under `forma/`, by kind (door.md §gives); `door.md` and `account.md` are in every packet,
 * and a Repair's are its target's kind's and `decisions.md`.
 */
export const CONTRACTS = {
  restate: ['design.md', 'forms.md', 'lifecycle-tool.md'],
  model: ['models.md', 'engines.md', 'design.md', 'forms.md', 'evidence.md'],
  slot: ['models.md', 'engines.md', 'design.md', 'forms.md', 'evidence.md'],
  // An explanation recommends a verdict, reads the engines' traces and lifecycles, and its explain.md follows the pages' table rules.
  explain: ['evidence.md', 'engines.md', 'models.md', 'decisions.md', 'design.md', 'forms.md', 'lifecycle-tool.md'],
};
