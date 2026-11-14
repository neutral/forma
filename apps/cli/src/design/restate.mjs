// The Restate answer (design.md §restate): what it holds, with removed.md (design.md §restate-holds); how it is applied to
// the restatement as it stands (design.md §restate-applied); its checks 1 to 5 (design.md §restate-checks); what it removes or re-files and
// what follows under models/ (design.md §removal); and the pages Forma writes for a redirect (design.md §repairs-redirects;
// decisions.md §redirect). Every function here is pure: it reads the project as given and writes nothing.

import { sortedBy } from '../record/json.mjs';
import { isPart, isSpan, parsePage } from '../record/pages.mjs';
import { unitOf as unitOfEntry } from '../record/pins.mjs';
import { restatementOf, subjectsOf } from '../record/project.mjs';
import { designPath, isKey, PART_KINDS, SPAN_KINDS } from '../record/tree.mjs';
import { readDesign } from './index.mjs';

const reason = (check, file, entry, field, says) => ({ check, file: file ?? null, entry: entry ?? null, field: field ?? null, says });
const folderOf = (path) => path.slice(0, path.lastIndexOf('/'));
const holderPath = (holder) => `${holder.span ? 'spans' : 'parts'}/${holder.key}`;

// --- removed.md (design.md §restate-holds) ---------------------------------------------------------------------------------

/**
 * `removed.md` read as design.md §restate-holds gives it, against the project as it stands: `{ removed, reasons }`, `removed`
 * each path it names, `{ path, kind: 'thing' | 'part' | 'span', holder, thing }`. One path a line, none twice, each of
 * a thing, a part or a span that exists, without a final `/`; an empty file removes nothing.
 */
function parseRemoved(text, project) {
  const check = 'design.md §restate-holds';
  const reasons = [];
  const removed = [];
  const lines = String(text).split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const seen = new Set();
  lines.forEach((line, at) => {
    const fail = (says) => reasons.push(reason(check, 'removed.md', null, null, `line ${at + 1}, "${line}": ${says}`));
    if (line === '') return fail('a line of removed.md holds one path, and this one is empty');
    const m = /^design\/(parts|spans)\/([^/]+)(?:\/([^/]+)\/([^/]+))?$/.exec(line);
    if (!m) return fail('it is not the path of a thing, a part or a span: design/parts/<part>/<kind>/<key>, design/spans/<span>/<kind>/<key>, design/parts/<part> or design/spans/<span>, with no final / and nothing around it');
    const holder = { key: m[2], span: m[1] === 'spans' };
    const kinds = holder.span ? SPAN_KINDS : PART_KINDS;
    if (m[3] !== undefined && !kinds.includes(m[3])) return fail(`a ${holder.span ? 'span' : 'part'} files things of the kinds ${kinds.join(', ')}, and ${m[3]} is none of them`);
    if (seen.has(line)) return fail('it is named twice, and removed.md names each path once');
    seen.add(line);
    if (!project.files.has(`${line}/README.md`)) return fail(m[3] ? `there is no thing at ${line}: its folder holds no README.md` : `there is no ${holder.span ? 'span' : 'part'} at ${line}: its folder holds no README.md`);
    removed.push({ path: line, kind: m[3] ? 'thing' : holder.span ? 'span' : 'part', holder, thing: m[3] ? { kind: m[3], key: m[4] } : null });
  });
  return { removed, reasons };
}

/** The pages `removed.md` removes (design.md §restate-holds): a thing's page, or a part's or span's README.md, tables and every thing page in it. */
function pagesRemoved(project, removed) {
  const out = new Set();
  for (const item of removed) {
    if (item.thing) {
      out.add(`${item.path}/README.md`);
      continue;
    }
    for (const [path, record] of project.files) {
      if (record.where.kind !== 'page' || !record.where.holder) continue;
      if (record.where.holder.key === item.holder.key && record.where.holder.span === item.holder.span) out.add(path);
    }
  }
  return out;
}

// --- The restatement after an answer (design.md §restate-applied) ------------------------------------------------------------

/** A project as it would read with a restatement in place of its own, for readDesign (design.md §restate-applied to §restate-checks). */
function projectWith(project, restatement) {
  // The bounds premises rest on models and slots and bear on no design fact, so none is carried over.
  const { subjects, premises } = subjectsOf(restatement);
  return {
    ...project, restatement, subjects, premises: { ...premises, bound: [] },
    unitOf: (name) => {
      const entry = restatement.entries.get(name);
      return entry ? unitOfEntry(entry) : null;
    },
  };
}

/**
 * A reason in door.md §forma-answer's form, its `entry` the entry's name (design.md §pins) where the page names one.
 * A page's parse reasons name a table row by its key or label, and a thing page's entry as null; the label is kept
 * at the head of `says`.
 */
function normalized(r) {
  const where = r.file ? designPath(r.file) : { kind: 'other' };
  let { entry, says } = r;
  const label = (text) => {
    if (!says.includes(entry)) says = `${text}: ${says}`;
    entry = null;
  };
  const holder = where.holder?.key;
  if (where.form === 'thing') {
    const name = `${holder}/${where.thing.kind}/${where.thing.key}`;
    if (entry && entry !== name && !says.includes(entry)) says = `${entry}: ${says}`;
    entry = name;
  } else if (entry && /^((field |start |surface |effects )?row|step) \d+$/.test(entry)) {
    label(entry);
  } else if (entry && !entry.includes('/') && (where.form === 'actions' || where.form === 'boundary') && isKey(entry)) {
    entry = `${holder}/${where.form}/${entry}`;
  } else if (entry && where.form === 'omissions' && !entry.startsWith(`${holder}/omissions/`)) {
    entry = `${holder}/omissions/${entry}`;
  } else if (entry && where.form === 'part-list') label(`the part ${entry}`);
  else if (entry && !entry.includes('/')) label(entry);
  return reason(r.check, r.file, entry, r.field, says);
}

/** The section that states a Restate answer's checks 1 to 5 (design.md §restate-checks). */
const CHECKS = 'design.md §restate-checks';

/** A reason of design.md §restate-checks's checks 1 to 5: citing design.md §restate-checks, with the section of the rule it applies at the end of its words. */
const ofCheck = (r) => (r.check === CHECKS ? r : reason(CHECKS, r.file, r.entry, r.field, `${r.says} (${r.check})`));

/** UTF-8 text of an answer's file, or null when its bytes are not UTF-8. */
function textOf(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Checks 1 to 4 of design.md §restate-checks (and design.md §restate-holds's form) for `answer`, a Map from each file's path in the answer folder
 * to its bytes, applied to the restatement as it stands (design.md §restate-applied): `{ reasons, removed, removedPages, restatement,
 * after, design }`, `after` the project as it would read and `design` its design when checks 1 to 4 hold. Checks 2 and
 * 3 give a reason for each failure in a page the answer holds and each failure elsewhere the restatement before it did
 * not have, never for one elsewhere that was there before (design.md §restate-applied).
 */
function applied(project, answer, { repair = false } = {}) {
  const reasons = [];
  // design.md §restate-holds: pages at their project paths, and removed.md at the folder's top, and nothing else.
  let removedText = '';
  const pages = [];
  for (const [path, bytes] of sortedBy([...answer], ([p]) => p)) {
    if (path === 'removed.md') {
      removedText = textOf(bytes);
      if (removedText === null) {
        reasons.push(ofCheck(reason('design.md §restate-holds', 'removed.md', null, null, 'removed.md is not UTF-8 text')));
        removedText = '';
      }
      continue;
    }
    if (repair && path === 'repair.md') continue;
    const where = designPath(path);
    if (where.kind !== 'page') {
      const what = where.kind === 'brief' ? 'a file of the brief, which agents write directly and no answer holds'
        : where.kind === 'decision' || where.kind === 'nested' ? 'a decision, which only forma decide records'
          : where.kind === 'receipt' ? 'a receipt, which only Forma writes'
            : path.startsWith('models/') ? 'a file under models/, which a Model, Fill-a-slot or Explain answer holds'
              : 'no page: a Restate answer holds design/README.md, a part\'s README.md, actions.md, boundary.md and omissions.md, a span\'s README.md and thing pages, each at its path in the project, and removed.md at its top';
      reasons.push(reason('design.md §restate-holds', path, null, null, `it is ${what}`));
      continue;
    }
    pages.push({ path, where, bytes });
  }
  const { removed, reasons: removedReasons } = parseRemoved(removedText, project);
  // Check 1: removed.md parses into its own form (design.md §restate-holds).
  reasons.push(...removedReasons.map(ofCheck));
  if (!pages.length && !removed.length && !removedReasons.length) reasons.push(reason('design.md §restate-holds', null, null, null, 'the answer holds no page and removed.md names nothing, so it restates nothing: it holds at least one page or one path in removed.md'));

  // Check 1: every page it holds parses into its form (forms.md §page-rules to §thing-pages).
  const formed = reasons.length === 0;
  const held = new Map();
  for (const page of pages) {
    const text = textOf(page.bytes);
    if (text === null) {
      reasons.push(ofCheck(normalized(reason('forms.md §page-rules', page.path, null, null, 'the page is not UTF-8 text'))));
      held.set(page.path, { path: page.path, where: page.where, exists: true, counts: false, page: null });
      continue;
    }
    const parsed = parsePage(page.path, page.where, text);
    reasons.push(...parsed.reasons.map(normalized).map(ofCheck));
    held.set(page.path, { path: page.path, where: page.where, exists: true, counts: parsed.reasons.length === 0, page: parsed.reasons.length ? null : parsed.page });
  }

  // design.md §restate-applied: from the pages that count now, drop what removed.md removes, then put in every page the answer holds.
  const removedPages = pagesRemoved(project, removed);
  const records = [];
  for (const [path, record] of project.files) {
    if (record.where.kind !== 'page' || removedPages.has(path) || held.has(path)) continue;
    const parsed = record.counts ? parsePage(path, record.where, record.bytes.toString('utf8')) : null;
    records.push({ path, where: record.where, exists: true, counts: Boolean(parsed && !parsed.reasons.length), page: parsed && !parsed.reasons.length ? parsed.page : null });
  }
  records.push(...held.values());
  const restatement = restatementOf(records, project.brief);
  // Whether every page and removed.md took its form, so the entries after the answer can be compared (design.md §removal).
  const parsed = formed && reasons.length === 0;

  // Checks 2 and 3, over the restatement after the answer, whole, with the brief as it is (design.md §restate-applied): each failure in a page
  // the answer holds refuses it, and each failure elsewhere that the restatement before it did not have, the two
  // compared by file, entry, field and what they say; a failure elsewhere that was there before refuses nothing.
  const failure = (r) => `${r.file}\0${r.entry}\0${r.field}\0${r.says}`;
  const before = new Set((project.restatement.failures ?? []).map((f) => failure(normalized(f))));
  reasons.push(...restatement.failures.map(normalized).filter((r) => held.has(r.file) || !before.has(failure(r))).map(ofCheck));
  const after = projectWith(project, restatement);
  const out = { reasons, parsed, removed, removedPages, held, restatement, after, design: null };
  if (reasons.length) return out;

  // Check 4: the lifecycle tool runs to completion over every lifecycle and journey; its findings refuse nothing.
  try {
    out.design = readDesign(after);
  } catch (error) {
    reasons.push(reason('design.md §restate-checks', null, null, null, `the lifecycle tool could not run to completion over the restatement after the answer: ${error.message}`));
  }
  return out;
}

// --- What is removed, re-filed and new (design.md §removal) ----------------------------------------------------------

const sameHolder = (a, b) => a?.key === b?.key && Boolean(a?.span) === Boolean(b?.span);

/**
 * The entries before the answer and after it compared (design.md §removal): `{ same, added, removed, refiled }`, by entry
 * name, `refiled` each `{ from, to, kind, key }`.
 */
function compared(project, applying) {
  const before = project.restatement;
  const after = applying.restatement;
  const pinBefore = (name) => before.pins.entries.get(name)?.pin ?? null;
  const pinAfter = (name) => after.pins.entries.get(name)?.pin ?? null;
  const same = new Map();
  for (const entry of before.entries.values()) {
    const other = after.entries.get(entry.entry);
    if (!other || !sameHolder(entry.holder, other.holder)) continue;
    // Removed by removed.md and held again by the answer: the same entry only at the same pin.
    const again = applying.removedPages.has(entry.page) && applying.held.has(other.page);
    if (again && pinBefore(entry.entry) !== pinAfter(other.entry)) continue;
    same.set(entry.entry, other.entry);
  }
  const sameAfter = new Set(same.values());
  const vanished = [...before.things.values()].filter((t) => !same.has(t.entry));
  const fresh = [...after.things.values()].filter((t) => !sameAfter.has(t.entry));
  const triple = (t, pin) => `${t.kind}\0${t.key}\0${pin}`;
  const count = new Map();
  for (const t of vanished) count.set(triple(t, pinBefore(t.entry)), (count.get(triple(t, pinBefore(t.entry))) ?? 0) + 1);
  for (const t of fresh) count.set(`new\0${triple(t, pinAfter(t.entry))}`, (count.get(`new\0${triple(t, pinAfter(t.entry))}`) ?? 0) + 1);
  const refiled = [];
  for (const t of vanished) {
    const key = triple(t, pinBefore(t.entry));
    if (count.get(key) !== 1 || count.get(`new\0${key}`) !== 1) continue;
    const to = fresh.find((n) => triple(n, pinAfter(n.entry)) === key);
    refiled.push({ from: t.entry, to: to.entry, kind: t.kind, key: t.key, fromHolder: t.holder, toHolder: to.holder });
  }
  const refiledFrom = new Set(refiled.map((r) => r.from));
  const refiledTo = new Set(refiled.map((r) => r.to));
  const removed = [...before.entries.values()].filter((e) => !same.has(e.entry) && !refiledFrom.has(e.entry));
  const added = [...after.entries.values()].filter((e) => !sameAfter.has(e.entry) && !refiledTo.has(e.entry)).map((e) => e.entry);
  const standing = (r, holder) => (holder.span ? isSpan(r, holder.key) : isPart(r, holder.key));
  const holders = [...before.parts.values(), ...before.spans.values()].filter((h) => standing(before, h) && !standing(after, h)).map((h) => ({ key: h.key, span: h.span }));
  return { same: [...same.keys()], added, removed, refiled, holdersRemoved: holders };
}

/** Every path under the project that a prefix holds: the files read and those that count for nothing. */
function pathsUnder(project, prefix) {
  return sortedBy([...new Set([...project.files.keys(), ...project.items.change.map((c) => c.path)])].filter((p) => p.startsWith(prefix)));
}

/** The folder names right under a folder of the project that hold anything. */
function foldersUnder(project, folder) {
  const names = new Set();
  for (const path of pathsUnder(project, `${folder}/`)) {
    const rest = path.slice(folder.length + 1);
    if (rest.includes('/')) names.add(rest.slice(0, rest.indexOf('/')));
  }
  return sortedBy([...names]);
}

/**
 * What follows under models/ from the entries the answer removes and re-files (design.md §removal; models.md §parts-change): the
 * folders and files to remove, and the folders to move with the entry each names before and after.
 */
function underModels(project, design, change) {
  const models = sortedBy([...new Set([...project.files.keys()].filter((p) => p.startsWith('models/')).map((p) => p.split('/')[1]))]);
  const removes = new Set();
  const moves = [];
  const folder = (model, holder, kind, key) => `models/${model}/${holderPath(holder)}/${kind}/${key}`;
  const has = (path) => pathsUnder(project, `${path}/`).length > 0;
  const removeFolder = (path) => {
    if (has(path)) removes.add(`${path}/`);
  };
  const pickKeys = (choiceKey) => ['a', 'b', 'not-a', 'not-b'].map((tail) => `${choiceKey}-${tail}`);
  for (const entry of change.removed) {
    const holder = entry.holder;
    for (const model of models) {
      if (PART_KINDS.includes(entry.kind) || SPAN_KINDS.includes(entry.kind)) removeFolder(folder(model, holder, entry.kind, entry.key));
      if (entry.kind === 'actions') for (const path of pathsUnder(project, `models/${model}/actions/${holder.key}/${entry.key}.`)) removes.add(path);
      if (entry.kind === 'boundary') removeFolder(`models/${model}/world/${holder.key}/${entry.key}`);
      if (entry.kind === 'choices') for (const key of pickKeys(entry.key)) removeFolder(folder(model, holder, 'journeys', key));
      if (entry.kind === 'lifecycles') {
        for (const key of foldersUnder(project, `models/${model}/${holderPath(holder)}/journeys`)) {
          if (!key.startsWith(`reach-${entry.key}--`)) continue;
          const journey = design.journeys.get(`${holder.key}/journeys/${key}`);
          if (journey?.added === 'offered' && journey.readFrom) continue;
          removeFolder(folder(model, holder, 'journeys', key));
        }
      }
    }
  }
  for (const holder of change.holdersRemoved) {
    for (const model of models) for (const key of foldersUnder(project, `models/${model}/${holderPath(holder)}/journeys`)) removeFolder(folder(model, holder, 'journeys', key));
  }
  for (const r of change.refiled) {
    for (const model of models) {
      const from = folder(model, r.fromHolder, r.kind, r.key);
      if (has(from)) moves.push({ from, to: folder(model, r.toHolder, r.kind, r.key), entry: { from: r.from, to: r.to } });
      if (r.kind !== 'choices') continue;
      for (const key of pickKeys(r.key)) {
        const at = folder(model, r.fromHolder, 'journeys', key);
        if (has(at)) moves.push({ from: at, to: folder(model, r.toHolder, 'journeys', key), entry: { from: `${r.fromHolder.key}/journeys/${key}`, to: `${r.toHolder.key}/journeys/${key}` } });
      }
    }
  }
  return { removes: sortedBy([...removes]), moves: sortedBy(moves, (m) => m.from) };
}

// --- Check 5: nothing frozen moves (design.md §restate-checks, §removal; models.md §freeze) ----------------------------------------

/** The entries, and parts or spans, an open surprise rests on (design.md §removal): what its question serves, what its basis names, what a journey code adds among them goes with, and the part or span holding any of them. */
function restsOn(surprise, design) {
  const where = surprise.where;
  const entries = new Set();
  const holders = new Set();
  if (where.thing) entries.add(`${where.holder.key}/${where.thing.kind}/${where.thing.key}`);
  if (where.where === 'action' && where.question?.action) entries.add(`${where.part}/actions/${where.question.action}`);
  if (where.where === 'world' && where.row) entries.add(`${where.part}/boundary/${where.row}`);
  for (const e of surprise.value?.basis?.entries ?? []) entries.add(e.entry);
  for (const name of [...entries]) {
    const goes = design.journeys.get(name)?.goesWith;
    if (!goes) continue;
    if (goes.includes('/')) entries.add(goes);
    else holders.add(goes);
  }
  for (const name of entries) holders.add(name.split('/')[0]);
  return { entries, holders };
}

/** Check 5 of design.md §restate-checks: the reasons the answer changes a page the freeze holds, or removes or re-files what an unruled surprise rests on. */
function frozen(project, design, applying, change) {
  const check = 'design.md §restate-checks';
  const reasons = [];
  for (const surprise of [...project.surprises.values()].filter((s) => s.open)) {
    // models.md §freeze: an answer holding or removing a file `held` names is refused whatever its bytes.
    for (const path of (surprise.held ?? surprise.value?.held ?? []).map((h) => (typeof h === 'string' ? h : h.path))) {
      if (applying.held.has(path)) reasons.push(reason(check, path, null, null, `the freeze holds this page while the surprise ${surprise.name} is open, so no answer holds it, whatever its bytes, until the developer rules on the surprise`));
      else if (applying.removedPages.has(path)) reasons.push(reason(check, 'removed.md', null, null, `removing ${path} would change a page the freeze holds while the surprise ${surprise.name} is open: the developer rules on the surprise first`));
    }
    if (!change) continue;
    const rests = restsOn(surprise, design);
    for (const entry of change.removed) {
      if (rests.entries.has(entry.entry)) reasons.push(reason(check, entry.page ?? null, entry.entry, null, `the answer would remove ${entry.entry}, on which the open surprise ${surprise.name} rests: the developer rules on the surprise first`));
    }
    for (const r of change.refiled) {
      if (rests.entries.has(r.from)) reasons.push(reason(check, null, r.from, null, `the answer would re-file ${r.from} as ${r.to}, which renames the questions of what it moves, and the open surprise ${surprise.name} rests on it: the developer rules on the surprise first`));
    }
    for (const holder of change.holdersRemoved) {
      if (rests.holders.has(holder.key)) reasons.push(reason(check, 'removed.md', null, null, `the answer would remove the ${holder.span ? 'span' : 'part'} ${holder.key}, which holds what the open surprise ${surprise.name} rests on: the developer rules on the surprise first`));
    }
  }
  return reasons;
}

// --- The Restate answer (design.md §restate) ---------------------------------------------------------------------------

/**
 * A Restate answer checked and applied (design.md §restate), writing nothing. `design` is readDesign(project), `answer` a Map
 * from each file's path in the answer folder to its bytes; `repair` lets `repair.md` stand at its top for door.md §repair-answer,
 * which checks it. Returns `{ refused: [reason] }`, each in door.md §forma-answer's form naming file, entry and field; or `{ writes:
 * [{ path, bytes }], removes: [path], moves: [{ from, to, entry: { from, to } }], entries, design }`, paths from the
 * project folder, a folder in `removes` ending in `/` and removed with all it holds, `moves` (folders under models/,
 * each moved before anything is removed) naming the entry each holds before and after, `entries` the entries
 * `same`, `added`, `removed` and `refiled`, and `design` the design after the answer. The door writes the receipt lines.
 */
export function checkRestate(project, design, answer, { repair = false } = {}) {
  const applying = applied(project, answer, { repair });
  // Check 5 beside checks 1 to 4, so every failed check is named (design.md §restate-applied); what the answer removes or re-files
  // is compared only once every page it holds takes its form.
  const change = applying.parsed ? compared(project, applying) : null;
  const refused = [...applying.reasons, ...frozen(project, design, applying, change)];
  if (refused.length) return { refused };
  const writes = sortedBy([...answer].filter(([path]) => applying.held.has(path)), ([path]) => path).map(([path, bytes]) => ({ path, bytes }));
  // Each page removed.md removes, and what else its folder holds but decisions/ and the receipt, whose lines go with
  // the files they name (design.md §removal; door.md §receipts); nothing in a folder whose page the answer holds again.
  const removes = new Set();
  for (const path of applying.removedPages) if (!applying.held.has(path)) removes.add(path);
  const kept = (rest, thing) => (thing ? rest === 'receipt' || rest.startsWith('decisions/') : /^(receipt|decisions\/.*|[^/]+\/[^/]+\/(receipt|decisions\/.*))$/.test(rest));
  for (const item of applying.removed) {
    for (const path of pathsUnder(project, `${item.path}/`)) {
      const rest = path.slice(item.path.length + 1);
      if (kept(rest, Boolean(item.thing)) || applying.held.has(path) || applying.held.has(`${folderOf(path)}/README.md`)) continue;
      removes.add(path);
    }
  }
  const models = underModels(project, design, change);
  return {
    writes,
    removes: sortedBy([...removes, ...models.removes]),
    moves: models.moves,
    entries: { same: change.same, added: change.added, removed: change.removed.map((e) => e.entry), refiled: change.refiled.map((r) => ({ from: r.from, to: r.to })) },
    design: applying.design,
  };
}

// --- Redirects (design.md §repairs-redirects; decisions.md §redirect) ----------------------------------------------------------------

/** A cell's text as forms.md §page-rules writes it, `|` as `\|`. */
const cell = (value) => String(value).replace(/\|/g, '\\|');

/** A claim's page with a new sentence and its other fields as they stand (decisions.md §redirect), in forms.md §claims's form. */
function claimPage(claim, sentence) {
  const rows = [
    ['Sentence', sentence], ['Kind', claim.claimKind], ['Stake', claim.stake],
    ['Rests on', claim.restsOn.length ? claim.restsOn.map((r) => r.written).join(', ') : 'none'],
    ['Parts', claim.parts.join(', ')], ['Origin', claim.origin], ['Cites', claim.cites.join(', ')],
  ];
  return `# ${claim.name}\n\n| Field | Value |\n| --- | --- |\n${rows.map(([f, v]) => `| ${f} | ${cell(v)} |`).join('\n')}\n`;
}

/**
 * The page Forma would write for a redirect (decisions.md §redirect), held to design.md §restate-checks's checks 1 to 4 as if an answer
 * held it (design.md §repairs-redirects), writing nothing. `redirect` is `{ on, words }`: a claim, `<part or span>/claims/<claim>`, and its new
 * sentence; or a new journey, `<part or span>/journeys/<key>`, and its page. Returns `{ refused }`, or `{ writes, unit:
 * { name, pin }, design }`: the page, the unit that holds the change as it reads after it, and the design after it. It
 * is also refused when that unit then has a lifecycle finding that blocks its confirmation (decisions.md §redirect).
 */
export function checkRedirect(project, design, { on, words }) {
  const fail = (check, file, entry, field, says) => ({ refused: [reason(check, file, entry, field, says)] });
  const claimOn = /^([^/]+)\/claims\/([^/]+)$/.exec(on ?? '');
  const journeyOn = /^([^/]+)\/journeys\/([^/]+)$/.exec(on ?? '');
  const text = String(words ?? '');
  let path;
  let bytes;
  let unitName;
  if (claimOn) {
    const claim = project.restatement.things.get(on);
    const holder = project.restatement.parts.get(claimOn[1]) ?? project.restatement.spans.get(claimOn[1]);
    const page = holder?.thingPages.claims?.get(claimOn[2]);
    if (!claim) {
      if (page?.exists && !page.counts) return fail('decisions.md §redirect', page.path, on, null, `the claim's page holds a change no accepted answer or redirect made (change:${page.path}), which writing would lose: restore it, or answer it again, first`);
      return fail('decisions.md §redirect', null, on, null, `no claim ${on} stands, and a redirect of a claim's sentence is on an existing claim`);
    }
    const sentence = text.trim();
    if (!sentence || /[\r\n]/.test(sentence)) return fail('decisions.md §redirect', null, on, 'Sentence', "a claim's new sentence is one line of text");
    path = claim.page;
    bytes = Buffer.from(claimPage(claim, sentence));
  } else if (journeyOn) {
    const [, holderKey, key] = journeyOn;
    const holder = isPart(project.restatement, holderKey) ? { key: holderKey, span: false } : isSpan(project.restatement, holderKey) ? { key: holderKey, span: true } : null;
    if (!holder) return fail('decisions.md §redirect', null, on, null, `no part or span ${holderKey} stands for the new journey to be filed in`);
    // Check 2 of design.md §restate-checks, asked of the new journey's key before its page is made.
    if (!isKey(key)) return { refused: [ofCheck(reason('forms.md §page-rules', null, on, null, `"${key}" is not a key: lowercase letters, digits and hyphens, beginning with a letter, with no hyphen at the end or two together`))] };
    const choices = holder.span ? [] : [...(project.restatement.parts.get(holderKey)?.thingPages.choices.keys() ?? [])];
    if (/^(reach|kept)-/.test(key) || choices.some((c) => ['a', 'b', 'not-a', 'not-b'].some((tail) => key === `${c}-${tail}`))) return { refused: [ofCheck(reason('forms.md §journeys', null, on, null, `the key ${key} is one code gives a journey it adds (design.md §code-journeys), so no page takes it`))] };
    path = `design/${holderPath(holder)}/journeys/${key}/README.md`;
    if (project.files.has(path) || design.journeys.has(on)) return fail('decisions.md §redirect', path, on, null, `a journey ${on} is there already, and a redirect adds a journey under a key no journey there has`);
    unitName = on;
    bytes = Buffer.from(text);
  } else {
    return fail('decisions.md §redirect', null, null, null, `a redirect is on a claim, <part or span>/claims/<claim>, or a new journey, <part or span>/journeys/<key>, and "${on ?? ''}" is neither`);
  }
  const applying = applied(project, new Map([[path, bytes]]));
  if (applying.reasons.length) return { refused: applying.reasons };
  const after = applying.design;
  if (claimOn) unitName = applying.after.unitOf(on) ?? on;
  const unit = after.units.get(unitName);
  const blocking = after.tool.findings.filter((f) => f.bearsOn.includes(unitName));
  if (blocking.length) return { refused: blocking.map((f) => reason('decisions.md §redirect', path, unitName, null, `the redirect would confirm ${unitName}, which this lifecycle tool finding then blocks: ${f.says}`)) };
  return { writes: [{ path, bytes }], unit: { name: unitName, pin: unit?.pin ?? null }, design: after };
}
