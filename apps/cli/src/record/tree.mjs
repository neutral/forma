// The project's tree: the path of everything Forma reads or writes, what each path is, folders
// created on first write, whole files written through work/tmp/, and the git files Forma writes
// (spec/project.md §The tree, design.md §paths, decisions.md §decision-file, models.md §paths, evidence.md §names,
// door.md §receipts, §scratch, §copies).

import { link, lstat, mkdir, open, readdir, readFile, rename, rm, rmdir, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

/** A key (forms.md §page-rules): lowercase letters, digits and hyphens, beginning with a letter, with no hyphen at the end or two together. */
const KEY = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Whether `text` is a key (forms.md §page-rules). */
export const isKey = (text) => typeof text === 'string' && KEY.test(text);

/** The kinds of thing a part files (forms.md §thing-pages), in the order forms.md §reading-order reads one key's things. */
export const PART_KINDS = ['lifecycles', 'journeys', 'claims', 'premises', 'choices'];

/** The kinds of thing a span files (forms.md §spans, §thing-pages). */
export const SPAN_KINDS = ['journeys', 'claims'];

/** The four git files Forma writes, by path, with what each holds (door.md §copies). */
export const GIT_FILES = Object.freeze({
  'design/.gitattributes': '* -text -ident -filter -working-tree-encoding\nreceipt merge=union\nbrief/** !text !ident !filter !working-tree-encoding !merge\n',
  'models/.gitattributes': '* -text -ident -filter -working-tree-encoding\n*.json -merge\nreceipt merge=union\n',
  'work/.gitignore': '*\n',
  'runs/.gitignore': '*\n',
});

/** The git file of the folder `path` lies in, among design/, models/, work/ and runs/ (door.md §copies); null for any other. */
function gitFileOf(path) {
  const top = path.split('/')[0];
  return Object.keys(GIT_FILES).find((file) => file.startsWith(`${top}/`)) ?? null;
}

// --- Paths (spec/project.md §The tree) -----------------------------------------------------------------

/** The folder under design/ of a part or span, `{ key, span }` (forms.md §front-pages). */
export const holderFolder = (holder) => `design/${holder.span ? 'spans' : 'parts'}/${holder.key}`;

/** A thing's folder under design/ (forms.md §thing-pages), from its part's or span's folder, kind and key. */
export const thingFolder = (holder, kind, key) => `${holderFolder(holder)}/${kind}/${key}`;

/** The decisions/ folder of a folder under design/ (decisions.md §decision-file). */
export const decisionsFolder = (folder) => `${folder}/decisions`;

/** A folder's receipt (door.md §receipts). */
export const receiptOf = (folder) => `${folder}/receipt`;

/** The paths of work/ (door.md §scratch). */
export const WORK = Object.freeze({
  folder: 'work',
  gitignore: 'work/.gitignore',
  spent: 'work/spent.json',
  sessions: 'work/sessions.json',
  lock: 'work/lock',
  tmp: 'work/tmp',
  refused: (hex) => `work/refused/${hex}.json`,
});

const TABLES = ['actions.md', 'boundary.md', 'omissions.md'];

/**
 * What a path under design/ is (design.md §paths, decisions.md §decision-file, door.md §receipts, §copies): `{ kind, ... }`, a page with
 * its form, holder and thing.
 */
export function designPath(path) {
  const parts = path.split('/');
  if (parts[0] !== 'design' || parts.length < 2) return { kind: 'other' };
  if (parts[1] === 'brief') return { kind: 'brief' };
  if (path === 'design/.gitattributes') return { kind: 'git' };
  const rest = parts.slice(1);
  // A decisions/ folder: design/decisions/, a part's or span's, or a thing's (decisions.md §decision-file).
  const decisionsAt = (depth) => {
    if (rest.length === depth + 2) return { kind: 'decision', folder: parts.slice(0, depth + 2).join('/') };
    if (rest.length > depth + 2) return { kind: 'nested', folder: parts.slice(0, depth + 2).join('/'), inside: parts.slice(0, depth + 3).join('/') };
    return null;
  };
  if (rest[0] === 'decisions') return decisionsAt(0) ?? { kind: 'other' };
  if (rest.length === 1) {
    if (rest[0] === 'README.md') return { kind: 'page', form: 'part-list', holder: null };
    if (rest[0] === 'receipt') return { kind: 'receipt', folder: 'design' };
    return { kind: 'other' };
  }
  if (rest[0] !== 'parts' && rest[0] !== 'spans') return { kind: 'other' };
  const span = rest[0] === 'spans';
  if (rest.length < 3 || !rest[1]) return { kind: 'other' };
  const holder = { key: rest[1], span };
  const folder = holderFolder(holder);
  if (rest[2] === 'decisions') return decisionsAt(2) ?? { kind: 'other' };
  if (rest.length === 3) {
    if (rest[2] === 'README.md') return { kind: 'page', form: span ? 'span' : 'part', holder };
    if (rest[2] === 'receipt') return { kind: 'receipt', folder };
    if (!span && TABLES.includes(rest[2])) return { kind: 'page', form: rest[2].slice(0, -3), holder };
    return { kind: 'other' };
  }
  const kinds = span ? SPAN_KINDS : PART_KINDS;
  if (!kinds.includes(rest[2]) || !rest[3]) return { kind: 'other' };
  const thing = { kind: rest[2], key: rest[3] };
  const at = `${folder}/${rest[2]}/${rest[3]}`;
  if (rest[4] === 'decisions') return decisionsAt(4) ?? { kind: 'other' };
  if (rest.length === 5) {
    if (rest[4] === 'README.md') return { kind: 'page', form: 'thing', holder, thing };
    if (rest[4] === 'receipt') return { kind: 'receipt', folder: at };
  }
  return { kind: 'other' };
}

/** A menu item as forms.md §menu writes it in model.md and paths. */
const ITEM = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const DIGEST = '[0-9a-f]{12}';
const NUMBER = '(?:0|[1-9][0-9]*)';
const POSITIVE = '[1-9][0-9]*';
const KEYTEXT = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';

/** Whether a model's key is a lifecycle model's (models.md §paths, §lifecycle-model). */
export const isLifecycleModel = (model) => model.startsWith('lifecycles-');

/**
 * The question an evidence file's name gives (evidence.md §question-names), from its file name in its folder
 * and where that folder is: `{ kind, digest, step, ... }`, or null. `where` is `claim`, `journey`,
 * `action`, `world` or `top`; `lifecycle` says whether the model is a lifecycle model, whose
 * questions have no bounds digest.
 */
function questionFile(name, where, lifecycle) {
  const d = lifecycle ? '' : `\\.(${DIGEST})`;
  let m;
  if (where === 'claim') {
    if ((m = new RegExp(`^base${d}$`).exec(name))) return { kind: 'base', digest: m[1] ?? null };
    if ((m = new RegExp(`^(witness|fault)-(${KEYTEXT})${d}$`).exec(name))) return { kind: m[1], key: m[2], digest: m[3] ?? null };
    return null;
  }
  if (where === 'journey') {
    if (lifecycle) {
      if (name === 'lifecycle-path') return { kind: 'lifecycle-path', variant: 'path', digest: null };
      if ((m = new RegExp(`^lifecycle-path-to-(${NUMBER})$`).exec(name))) return { kind: 'lifecycle-path', variant: 'to', step: Number(m[1]), digest: null };
      if ((m = new RegExp(`^lifecycle-path-refused-at-(${POSITIVE})$`).exec(name))) return { kind: 'lifecycle-path', variant: 'refused-at', step: Number(m[1]), digest: null };
      return null;
    }
    if ((m = new RegExp(`^path${d}$`).exec(name))) return { kind: 'path', variant: 'path', digest: m[1] };
    if ((m = new RegExp(`^path-to-(${NUMBER})${d}$`).exec(name))) return { kind: 'path', variant: 'to', step: Number(m[1]), digest: m[2] };
    if ((m = new RegExp(`^refusal-at-(${POSITIVE})${d}$`).exec(name))) return { kind: 'refusal', step: Number(m[1]), digest: m[2] };
    if ((m = new RegExp(`^start${d}$`).exec(name))) return { kind: 'start', digest: m[1] };
    return null;
  }
  if (lifecycle) return null;
  if (where === 'action') {
    if ((m = new RegExp(`^(${KEYTEXT})${d}$`).exec(name))) return { kind: 'enabled', action: m[1], digest: m[2] };
    return null;
  }
  if (where === 'world') {
    if ((m = new RegExp(`^(${KEYTEXT})\\.enabled${d}$`).exec(name))) return { kind: 'enabled', item: m[1], digest: m[2] };
    if ((m = new RegExp(`^(${KEYTEXT})${d}$`).exec(name))) return { kind: 'misbehaviour', item: m[1], digest: m[2] };
    return null;
  }
  if (where === 'top') {
    if ((m = new RegExp(`^(phases|facts)${d}$`).exec(name))) return { kind: m[1], digest: m[2] };
  }
  return null;
}

/**
 * A file in an evidence folder of a model as evidence.md §question-names, §stems name it: evidence of a
 * question (`evidence`), a surprise (`surprise`), a reduction's evidence (`reduction`), a weaker
 * form (`weaker`) or its evidence (`weaker-evidence`), or an explanation (`explanation`); with the
 * question (`question`, as questionFile gives it) and, for the files sharing a stem, the stem.
 * Null when the name is none of these.
 */
function evidenceFile(file, where, lifecycle) {
  let m;
  const family = new RegExp(`^(.+)\\.surprise-(${DIGEST})(?:\\.(reduction-(${POSITIVE})|weaker-(${KEYTEXT})|explained))?\\.(json|md|tla|als)$`).exec(file);
  if (family) {
    const [, base, hex, tail, n, key, ext] = family;
    const question = questionFile(base, where, lifecycle);
    if (!question) return null;
    const stem = `${base}.surprise-${hex}`;
    if (!tail) return ext === 'json' ? { kind: 'surprise', question, stem, base } : null;
    if (n) return ext === 'json' ? { kind: 'reduction', question, stem, base, number: Number(n) } : null;
    if (key) {
      if (ext === 'json') return { kind: 'weaker-evidence', question, stem, base, key };
      return { kind: 'weaker', question, stem, base, key, extension: ext };
    }
    return ext === 'md' ? { kind: 'explanation', question, stem, base } : null;
  }
  if ((m = /^(.+)\.json$/.exec(file))) {
    const question = questionFile(m[1], where, lifecycle);
    if (question) return { kind: 'evidence', question, base: m[1] };
  }
  return null;
}

/** What a path under models/ is (models.md §paths, §slots; evidence.md §question-names to §stems; door.md §receipts): `{ kind, model, ... }`. */
export function modelsPath(path) {
  const parts = path.split('/');
  if (parts[0] !== 'models' || parts.length < 2) return { kind: 'other' };
  if (path === 'models/.gitattributes') return { kind: 'git' };
  if (parts.length < 3 || !parts[1]) return { kind: 'other' };
  const model = parts[1];
  const lifecycle = isLifecycleModel(model);
  const rest = parts.slice(2);
  const base = { model };
  const name = rest[rest.length - 1];
  // A receipt sits in a model's folder, a thing's folder or a world row's folder (door.md §receipts).
  const folder = parts.slice(0, -1).join('/');
  if (rest.length === 1) {
    if (name === 'receipt') return { kind: 'receipt', folder, ...base };
    if (lifecycle) return { kind: 'other', ...base };
    if (name === 'model.md') return { kind: 'model-md', ...base };
    const engine = /^(.+)\.(tla|als)$/.exec(name);
    if (engine) return { kind: 'engine', extension: engine[2], ...base };
    const found = evidenceFile(name, 'top', lifecycle);
    return found ? { ...found, where: 'top', ...base } : { kind: 'other', ...base };
  }
  if (rest[0] === 'actions' && rest.length === 3 && !lifecycle) {
    // An action's folder holds the explanations and weaker forms of its enabled questions' surprises, so a receipt too.
    if (name === 'receipt') return { kind: 'receipt', folder, part: rest[1], ...base };
    const found = evidenceFile(name, 'action', lifecycle);
    return found ? { ...found, where: 'action', part: rest[1], ...base } : { kind: 'other', ...base };
  }
  if (rest[0] === 'world' && rest.length === 4 && !lifecycle) {
    const row = { part: rest[1], row: rest[2] };
    if (name === 'receipt') return { kind: 'receipt', folder, ...row, ...base };
    const slot = /^(.+)\.(tla|als)$/.exec(name);
    if (slot && ITEM.test(slot[1])) return { kind: 'slot', slot: 'misbehaviour', item: slot[1], extension: slot[2], ...row, ...base };
    const found = evidenceFile(name, 'world', lifecycle);
    return found ? { ...found, where: 'world', ...row, ...base } : { kind: 'other', ...base };
  }
  if ((rest[0] === 'parts' || rest[0] === 'spans') && rest.length === 5 && rest[1] && rest[3]) {
    const holder = { key: rest[1], span: rest[0] === 'spans' };
    const thing = { kind: rest[2], key: rest[3] };
    const at = { holder, thing, ...base };
    if (thing.kind === 'claims') {
      if (name === 'receipt') return { kind: 'receipt', folder, ...at };
      let m;
      if ((m = /^encoding\.(tla|als|md)$/.exec(name))) return { kind: 'slot', slot: 'encoding', extension: m[1], ...at };
      if ((m = new RegExp(`^(witness|fault)-(${KEYTEXT})\\.md$`).exec(name))) return { kind: 'slot', slot: m[1], key: m[2], extension: 'md', ...at };
      const found = evidenceFile(name, 'claim', lifecycle);
      return found ? { ...found, where: 'claim', ...at } : { kind: 'other', ...base };
    }
    if (thing.kind === 'journeys') {
      if (name === 'receipt') return { kind: 'receipt', folder, ...at };
      if (name === 'schedule.md' && !lifecycle) return { kind: 'slot', slot: 'schedule', extension: 'md', ...at };
      const found = evidenceFile(name, 'journey', lifecycle);
      return found ? { ...found, where: 'journey', ...at } : { kind: 'other', ...base };
    }
  }
  return { kind: 'other', ...base };
}

// --- The file system -----------------------------------------------------------------------------------

/** Every entry under a folder of the project, as `{ path, type }`, links not followed (door.md §read-checks's list). */
export async function walk(root, top) {
  const found = [];
  let names;
  try {
    names = await readdir(join(root, top));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return found;
    throw error;
  }
  names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const name of names) {
    const path = `${top}/${name}`;
    let stats;
    try {
      stats = await lstat(join(root, path));
    } catch (error) {
      // Gone since its folder was read, as a file another writer renames out of work/tmp/ into place (door.md §forma-answer, §lock):
      // it is not there, so it is not listed.
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    const type = stats.isSymbolicLink() ? 'link' : stats.isDirectory() ? 'folder' : stats.isFile() ? 'file' : 'other';
    found.push({ path, type });
    if (type === 'folder') found.push(...(await walk(root, path)));
  }
  return found;
}

/** A file's bytes, or null when there is none. */
export async function readBytes(root, path) {
  try {
    return await readFile(join(root, path));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

let written = 0;

/**
 * Writes `bytes` at `path` from a temporary file in work/tmp/, named for this process, renamed
 * into place (door.md §forma-answer, §scratch), creating every folder on the way (spec/project.md §The tree). It
 * writes no git file: writeWhole does that first.
 */
async function place(root, path, bytes) {
  const tmp = join(root, WORK.tmp);
  await mkdir(tmp, { recursive: true });
  written += 1;
  const aside = join(tmp, `${process.pid}-${written}-${basename(path)}`);
  await writeFile(aside, bytes);
  await mkdir(dirname(join(root, path)), { recursive: true });
  await rename(aside, join(root, path));
}

/** Writes one of the git files when it is missing or holds anything else (door.md §copies). */
async function writeGitFile(root, path) {
  const want = GIT_FILES[path];
  const have = await readBytes(root, path);
  if (have !== null && have.toString('utf8') === want && have.length === Buffer.byteLength(want)) return false;
  // work/.gitignore is written through work/tmp/ too, the one folder a file being written stands in (door.md §forma-answer, §scratch).
  if (path === WORK.gitignore) {
    await place(root, path, want);
    return true;
  }
  await writeGitFile(root, WORK.gitignore);
  await place(root, path, want);
  return true;
}

/**
 * Writes a whole file from work/tmp/ renamed into place (door.md §forma-answer, §scratch), the git files of work/ and of its
 * folder first (door.md §copies).
 */
export async function writeWhole(root, path, bytes) {
  await writeGitFile(root, WORK.gitignore);
  const git = gitFileOf(path);
  if (git && git !== path) await writeGitFile(root, git);
  await place(root, path, bytes);
}

/** Removes the file at `path`; nothing when there is none. */
export async function removeFile(root, path) {
  try {
    await unlink(join(root, path));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

/** Removes a folder and each empty one above it, up to `stop` (design.md §removal). */
export async function removeEmptyFolders(root, folder, stop) {
  for (let at = folder; at !== stop && at.startsWith(`${stop}/`); at = dirname(at)) {
    try {
      await rmdir(join(root, at));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      if (error.code === 'ENOTEMPTY' || error.code === 'EEXIST') return;
      throw error;
    }
  }
}

/** Removes a whole folder and all it holds (design.md §removal, models.md §parts-change). */
export async function removeFolder(root, folder) {
  await rm(join(root, folder), { recursive: true, force: true });
}

/** Moves a folder, with all it holds, to `to` (design.md §removal, models.md §parts-change, evidence.md §moved). */
export async function moveFolder(root, from, to) {
  await mkdir(dirname(join(root, to)), { recursive: true });
  await rename(join(root, from), join(root, to));
}

/** Whether a process is running on this machine (door.md §scratch, §lock). */
export function running(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/** Removes each file in work/tmp/ whose process is not running (door.md §scratch). */
export async function cleanTmp(root) {
  const removed = [];
  for (const entry of await walk(root, WORK.tmp)) {
    if (entry.type === 'folder') continue;
    const pid = Number(/^(\d+)-/.exec(basename(entry.path))?.[1]);
    if (Number.isInteger(pid) && pid > 0 && running(pid)) continue;
    await removeFile(root, entry.path);
    removed.push(entry.path);
  }
  return removed;
}

/** Places a file in one step only when none is there, linked from work/tmp/ (door.md §lock's lock). */
export async function placeIfAbsent(root, path, bytes) {
  await writeGitFile(root, WORK.gitignore);
  const tmp = join(root, WORK.tmp);
  await mkdir(tmp, { recursive: true });
  written += 1;
  const aside = join(tmp, `${process.pid}-${written}-${basename(path)}`);
  const handle = await open(aside, 'w');
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
  try {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await link(aside, join(root, path));
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  } finally {
    await removeFile(root, `${WORK.tmp}/${basename(aside)}`);
  }
}
