// Reading a project folder whole, with the checks of every read (door.md §read-checks): each file checked
// as door.md §read-checks's list says, against the freeze, the session rule and the authors; each page put
// to design.md §restate-checks's checks 1 to 3 as design.md §at-read asks them; and every file that counts for nothing
// listed as `change:<path>` with its reasons (door.md §change). The account, items and standing are
// ../account/'s; this object is what they read.

import { readBrief } from './brief.mjs';
import { inForce, parseDecision, decidingSessions, ruledSurprises } from './decisions.mjs';
import { readEvidence, nameOfPath, surpriseDigest, evidenceTimes, parseExplain, questionBounds, boundsDigest } from './evidence.mjs';
import { compare, dict, isTime, sha256, sortedBy } from './json.mjs';
import { claimBounds, covers, EXTENSION, isProperty, lifecycleModels, MENU, parseModel, parseSlot, slotReasons } from './models.mjs';
import { assemble, checkRestatement, coverage, isAdded, parsePage, spansOf, thingParts } from './pages.mjs';
import { boundPin, pins, spanPin, storePremise, strikePin, unitOf } from './pins.mjs';
import { authorsOf, entryOf, lineContextReason, linesFor, parseReceipt, sessionId, sessionsSorted } from './receipts.mjs';
import { designPath, GIT_FILES, isLifecycleModel, modelsPath, readBytes, walk } from './tree.mjs';
import { toolchain } from '../toolchain.mjs';

const reason = (check, file, says, entry = null, field = null) => ({ check, file, entry, field, says });
const folderOf = (path) => path.slice(0, path.lastIndexOf('/'));
const nameOf = (path) => path.slice(path.lastIndexOf('/') + 1);
const sessionText = (s) => `${s.provider} / ${s.model} / ${s.session}`;

/**
 * The restatement from page records, design.md §restate-checks's checks 2 and 3 made and its facts and pins computed.
 * A read and a Restate answer both build it here, so an answer's restatement is checked exactly as a read's.
 */
export function restatementOf(pageRecords, brief) {
  const restatement = assemble([...pageRecords].sort((a, b) => compare(a.path, b.path)));
  const { failures, refs } = checkRestatement(restatement, brief);
  restatement.failures = failures;
  restatement.refs = refs;
  restatement.thingParts = new Map([...restatement.things.values()].map((thing) => [thing.entry, thingParts(restatement, thing)]));
  restatement.spanPairs = spansOf(restatement);
  restatement.coverage = coverage(restatement, brief);
  restatement.pins = pins(restatement, brief);
  return restatement;
}

/**
 * The subjects of decisions.md §in-force that a restatement names, and the premises code adds for its rows
 * (forms.md §code-premises): `{ subjects, premises: { store, strike, span } }`. The bounds premises rest on models and
 * slots, and readProject adds them.
 */
export function subjectsOf(restatement) {
  const pinned = restatement.pins;
  const subjects = [];
  for (const unit of pinned.units.values()) {
    const claimParts = new Set();
    for (const name of unit.entries) {
      const entry = restatement.entries.get(name);
      if (entry?.kind === 'claims') for (const p of entry.parts) claimParts.add(p);
    }
    subjects.push({ type: 'unit', name: unit.name, pin: unit.pin, claimParts });
  }
  for (const entry of pinned.entries.values()) {
    if (entry.kind === 'choices') subjects.push({ type: 'choice', name: entry.name, pin: entry.pin });
    if (entry.kind === 'premises') subjects.push({ type: 'premise', name: entry.name, pin: entry.pin });
    if (entry.kind === 'claims') subjects.push({ type: 'risk', name: entry.name, pin: entry.pin });
  }
  const store = [];
  const strike = [];
  for (const part of restatement.parts.values()) {
    for (const row of part.boundary) {
      if (row.rowKind === 'store') store.push(storePremise(part.key, row));
      if (row.side === 'world' && ['actor', 'service', 'queue', 'clock'].includes(row.rowKind)) {
        for (const item of MENU) strike.push({ name: `strike:${part.key}/${row.key}/${item}`, part: part.key, row: row.key, item, pin: strikePin(item, row.names) });
      }
    }
  }
  const span = restatement.spanPairs.map((s) => ({ name: `span:${s.name}`, span: s, pin: spanPin(s, pinned, pinned.purpose) }));
  for (const premise of [...store, ...strike, ...span]) subjects.push({ type: 'premise', name: premise.name, pin: premise.pin });
  return { subjects, premises: { store, strike, span } };
}

/**
 * Reads a project folder as every command reads it (door.md §read-checks to §change, design.md §at-read, account.md §what-it-is) into one
 * object; its keys are listed where it is returned.
 */
export async function readProject(root) {
  const files = new Map();
  const changes = new Map();
  const change = (path, why) => {
    if (!changes.has(path)) changes.set(path, []);
    changes.get(path).push(why);
  };

  // --- What is there (door.md §read-checks's list) ----------------------------------------------------------------------
  const receipts = new Map();
  const decisionFiles = [];
  const gitSeen = new Map();
  // Whether design/ holds a file outside design/brief/, and models/ any file (door.md §change item 7).
  const holdsFile = { design: false, models: false };
  for (const top of ['design', 'models']) {
    for (const item of await walk(root, top)) {
      if (top === 'design' && (item.path === 'design/brief' || item.path.startsWith('design/brief/'))) continue;
      const where = top === 'design' ? designPath(item.path) : modelsPath(item.path);
      if (item.type !== 'folder' && where.kind !== 'git') holdsFile[top] = true;
      if (item.type === 'folder') {
        if (where.kind === 'decision') change(item.path, reason('decisions.md §decision-file', item.path, 'a folder inside a decisions/ folder is no decision'));
        continue;
      }
      if (where.kind === 'nested') {
        change(item.path, reason('door.md §change', item.path, 'it lies in a folder inside a decisions/ folder, and is no decision'));
        continue;
      }
      if (item.type !== 'file') {
        // Anything that is neither a regular file nor a folder, a symbolic link included, is not Forma's (door.md §read-checks, §change item 8).
        change(item.path, reason('door.md §change', item.path, `it is a ${item.type === 'link' ? 'symbolic link' : 'file of another type'}, and Forma writes only regular files here`));
        continue;
      }
      const bytes = await readBytes(root, item.path);
      const record = { path: item.path, where, bytes, sha256: sha256(bytes), needsEntry: false, entry: null, counts: true, reasons: [] };
      files.set(item.path, record);
      if (where.kind === 'git') gitSeen.set(item.path, record);
      else if (where.kind === 'receipt') receipts.set(where.folder, { path: item.path, ...parseReceipt(bytes.toString('utf8')) });
      else if (where.kind === 'decision') decisionFiles.push(record);
      else if (['page', 'model-md', 'engine', 'slot', 'weaker', 'explanation'].includes(where.kind)) record.needsEntry = true;
      else if (['evidence', 'surprise', 'reduction', 'weaker-evidence'].includes(where.kind)) record.evidence = true;
      else {
        record.counts = false;
        change(item.path, reason('door.md §change', item.path, "it is no file of Forma's: nothing Forma writes stands at this path"));
      }
    }
  }
  // A line that parses but does not hold what its file's kind asks is not in its form (door.md §repair-answer, §receipts): it is ignored.
  for (const [folder, receipt] of receipts) {
    const kept = [];
    for (const line of receipt.lines) {
      const why = lineContextReason(line.value, fileKindOf(`${folder}/${line.value.file}`));
      if (why) receipt.bad.push({ line: null, text: line.text, says: `the line for ${line.value.file}: ${why}` });
      else kept.push(line);
    }
    receipt.lines = kept;
  }
  for (const receipt of receipts.values()) {
    for (const bad of receipt.bad) change(receipt.path, reason('door.md §receipts', receipt.path, bad.line === null ? `a line does not parse in a receipt line's form, ${bad.says}` : `line ${bad.line} does not parse in a receipt line's form: ${bad.says}`));
  }

  // --- Decisions, by their names (decisions.md §decision-file) -------------------------------------------------------------
  const decisions = [];
  for (const record of decisionFiles) {
    const { decision, reasons } = parseDecision(record.path, nameOf(record.path), record.bytes.toString('utf8'));
    if (decision) decisions.push(decision);
    else {
      record.counts = false;
      record.reasons.push(...reasons);
      for (const why of reasons) change(record.path, why);
    }
  }
  const decided = new Set(decidingSessions(decisions).map(sessionId));

  // --- Entries, and the session rule (door.md §receipts, §sessions) ---------------------------------------------------------
  for (const record of files.values()) {
    if (!record.needsEntry) continue;
    const receipt = receipts.get(folderOf(record.path));
    record.entry = entryOf(receipt, nameOf(record.path), record.sha256);
    if (!record.entry) {
      record.counts = false;
      const edited = linesFor(receipt, nameOf(record.path)).length > 0;
      const why = reason('door.md §receipts', record.path, edited ? 'it has no entry: its bytes are not those of any line of its receipt, so it was changed since Forma took it in' : 'it has no entry: no line of its folder\'s receipt names it, so Forma never took it in');
      record.reasons.push(why);
      change(record.path, why);
      continue;
    }
    // The session rule reads the entry's `session` (door.md §sessions).
    if (record.entry.session && decided.has(sessionId(record.entry.session))) {
      record.counts = false;
      const why = reason('door.md §sessions', record.path, `its entry names the session ${sessionText(record.entry.session)}, which has made a decision, so the answer counts for nothing; the decision stands`);
      record.reasons.push(why);
      change(record.path, why);
    }
  }

  // --- Evidence, surprises and their stems (evidence.md §stems, §own-check, §surprises) ----------------------------------------
  const evidence = new Map();
  const surprises = new Map();
  const stems = new Map();
  for (const record of files.values()) {
    if (!record.evidence) continue;
    const { value, reasons, digested } = readEvidence(record.path, record.bytes.toString('utf8'), record.where);
    record.value = value;
    record.digested = digested ?? null;
    if (!value) {
      record.counts = false;
      record.reasons.push(...reasons);
      for (const why of reasons) change(record.path, why);
    }
    if (record.where.kind === 'evidence') evidence.set(record.path, { path: record.path, name: nameOfPath(record.path), question: record.where.question, where: record.where, value, counts: Boolean(value) });
    if (record.where.kind === 'surprise') surprises.set(nameOfPath(record.path), { path: record.path, name: nameOfPath(record.path), where: record.where, value, counts: Boolean(value), open: false, ruledBy: null });
  }
  const ruled = new Map();
  for (const d of decisions.filter((x) => x.kind === 'rule')) for (const name of ruledSurprises(d)) ruled.set(name, d.name);
  for (const surprise of surprises.values()) {
    surprise.ruledBy = ruled.get(surprise.name) ?? null;
    surprise.open = surprise.counts && !surprise.ruledBy;
  }
  for (const record of files.values()) {
    const kind = record.where.kind;
    if (!['reduction', 'weaker', 'weaker-evidence', 'explanation'].includes(kind)) continue;
    const surpriseNameOf = [...record.path.split('/').slice(1, -1), record.where.stem].join('/');
    if (!stems.has(surpriseNameOf)) stems.set(surpriseNameOf, { surprise: surpriseNameOf, reductions: [], weaker: [], weakerEvidence: [], explanation: null });
    const stem = stems.get(surpriseNameOf);
    if (kind === 'reduction') stem.reductions.push(record.path);
    if (kind === 'weaker') stem.weaker.push(record.path);
    if (kind === 'weaker-evidence') stem.weakerEvidence.push(record.path);
    if (kind === 'explanation') stem.explanation = record.path;
    // A file that shares a stem no surprise file has belongs to no surprise and counts for nothing (evidence.md §at-ruling);
    // one whose surprise file counts for nothing waits for it (door.md §change).
    if (!surprises.has(surpriseNameOf) && record.counts) {
      record.counts = false;
      const why = reason('evidence.md §at-ruling', record.path, `it shares the stem ${surpriseNameOf}, which no surprise file has, so it belongs to no surprise`);
      record.reasons.push(why);
      change(record.path, why);
    }
  }

  // --- The freeze (models.md §freeze; evidence.md §surprise-file; door.md §read-checks): an open surprise's file records, as `held`, each file
  // its freeze holds when it opens. At read a file `held` names whose bytes differ, and a new engine file of its model or
  // a new slot of its claim on that model, which `held` does not name, count for nothing until the ruling.
  for (const surprise of surprises.values()) surprise.held = surprise.value?.held ?? [];
  for (const surprise of [...surprises.values()].filter((s) => s.open)) {
    const held = new Map(surprise.held.map((f) => [f.path, f.sha256]));
    const discount = (record, says) => {
      record.counts = false;
      const why = reason('models.md §freeze', record.path, says);
      record.reasons.push(why);
      record.frozen = surprise.name;
      change(record.path, why);
    };
    for (const [path, sha] of held) {
      const record = files.get(path);
      if (record && record.sha256 !== sha) discount(record, `the freeze holds it while the surprise ${surprise.name} is open, and its bytes are not those the surprise's held names`);
      else if (!record) change(path, reason('models.md §freeze', path, `the freeze holds it while the surprise ${surprise.name} is open, and it is gone: no regular file stands at its path`));
    }
    for (const record of files.values()) {
      if (held.has(record.path) || !newUnderFreeze(surprise, record.path)) continue;
      discount(record, `it is new while the surprise ${surprise.name} is open: the freeze holds the ${record.where.kind === 'engine' ? "model's engine files" : "claim's slots on the model"} its held names, and this is not one`);
    }
  }

  // --- model.md, and which files are a model's engine files (engines.md §model-md) ----------------------------------------
  const models = new Map();
  const modelOf = (key) => {
    if (!models.has(key)) models.set(key, { key, folder: `models/${key}`, lifecycle: isLifecycleModel(key), modelMd: null, model: null, reasons: [], engine: null, engineFiles: [], files: dict(), authors: [], strikes: null });
    return models.get(key);
  };
  for (const record of files.values()) if (record.where.model) modelOf(record.where.model);
  for (const record of files.values()) {
    if (record.where.kind !== 'model-md') continue;
    const entry = modelOf(record.where.model);
    entry.modelMd = record;
    if (!record.counts) continue;
    const { model, reasons } = parseModel(record.where.model, record.bytes.toString('utf8'));
    entry.reasons = reasons;
    if (reasons.length) {
      record.counts = false;
      record.reasons.push(...reasons);
      for (const why of reasons) change(record.path, why);
      continue;
    }
    entry.model = model;
    entry.engine = model.engine || null;
    entry.strikes = record.entry?.strikes ?? [];
  }
  for (const record of files.values()) {
    if (record.where.kind !== 'engine') continue;
    const entry = modelOf(record.where.model);
    if (entry.engine && EXTENSION[entry.engine] !== record.where.extension) {
      if (record.counts) {
        record.counts = false;
        const why = reason('door.md §change', record.path, `it is no engine file of the ${entry.engine} model ${entry.key}, whose engine files are .${EXTENSION[entry.engine]} files, so it is no file of Forma's`);
        record.reasons.push(why);
        change(record.path, why);
      }
      continue;
    }
    entry.engineFiles.push(nameOf(record.path));
    if (record.counts) entry.files[nameOf(record.path)] = record.bytes;
  }
  for (const entry of models.values()) {
    entry.engineFiles.sort(compare);
    if (entry.lifecycle) continue;
    // A model's authors (door.md §receipts): every session among the authors of its model.md and its engine files, all of
    // each file's lines counted.
    const receipt = receipts.get(entry.folder);
    const present = [entry.modelMd, ...entry.engineFiles.map((n) => files.get(`${entry.folder}/${n}`))].filter(Boolean);
    entry.authors = sessionsSorted(present.flatMap((r) => authorsOf(receipt, nameOf(r.path))));
  }

  // --- The brief and the restatement (design.md §brief to §filing, §restate-checks checks 1 to 3, design.md §at-read) -----------------------------------
  const brief = await readBrief(root);
  const pageRecords = [];
  for (const record of files.values()) {
    if (record.where.kind !== 'page') continue;
    let page = null;
    if (record.counts) {
      const parsed = parsePage(record.path, record.where, record.bytes.toString('utf8'));
      if (parsed.reasons.length) {
        record.counts = false;
        record.reasons.push(...parsed.reasons);
        for (const why of parsed.reasons) change(record.path, why);
      } else page = parsed.page;
    }
    pageRecords.push({ path: record.path, where: record.where, exists: true, counts: record.counts, page });
  }
  const restatement = restatementOf(pageRecords, brief);
  const thingsParts = restatement.thingParts;
  const pinned = restatement.pins;

  // --- Models and slots (models.md §slots, §lifecycle-model) -------------------------------------------------------------------------
  const slots = new Map();
  for (const record of files.values()) {
    if (record.where.kind !== 'slot') continue;
    const model = models.get(record.where.model);
    const engine = model.lifecycle ? 'lifecycle' : model.engine;
    const slot = { path: record.path, ...record.where, kind: record.where.slot, record, counts: record.counts, entry: record.entry, pins: record.entry?.pins ?? null, form: null, formReasons: [] };
    if (record.counts && engine) {
      const parsed = parseSlot(slot.kind, slot.extension, record.bytes.toString('utf8'), engine, record.path);
      slot.form = parsed.form;
      slot.formReasons = parsed.reasons;
      // A Markdown slot that does not parse into its form (engines.md §slot-forms) fails a check of its own form, so it is
      // change:<path> and counts for nothing (door.md §read-checks, §change); a slot the model's files no longer accept is owed again
      // instead (models.md §slot-currency). A native slot's own form is its engine's text, which the engine's parser checks.
      if (slot.extension === 'md' && parsed.reasons.length) {
        record.counts = false;
        slot.counts = false;
        for (const why of parsed.reasons) {
          record.reasons.push(why);
          change(record.path, why);
        }
      }
    }
    slots.set(record.path, slot);
  }

  // Each pin a slot's receipt line records, beside the entry's pin now, null for an entry no page holds now (models.md §slot-currency item 3).
  // A journey code adds has no page, so its pin now is ../design/index.mjs's (design.md §code-journeys).
  for (const slot of slots.values()) slot.pinsNow = (slot.pins ?? []).map((p) => ({ entry: p.entry, pin: p.pin, now: pinned.entries.get(p.entry)?.pin ?? null }));

  // --- Which decision is in force, over what the pages and models name (decisions.md §in-force) --------------------------
  const { subjects, premises: { store: storePremises, strike: strikePremises, span: spanPremises } } = subjectsOf(restatement);
  // A redirect lapses under the name of the unit that holds its On now (decisions.md §redirect to §in-force).
  const holdingUnit = (name) => {
    const entry = restatement.entries.get(name);
    return entry ? unitOf(entry) ?? name : name;
  };
  const force = inForce(decisions, subjects, { unitOf: holdingUnit });
  const confirmedLifecycles = [...restatement.things.values()].filter((t) => t.kind === 'lifecycles' && force.subjects.get(t.entry, 'unit')?.inForce?.kind === 'confirm').map((t) => t.entry);
  for (const [key, record] of lifecycleModels(restatement, confirmedLifecycles)) Object.assign(modelOf(key), { engine: 'lifecycle', model: record, exists: true });
  // A lifecycle model's authors are those of its part's confirmed lifecycle pages, every line counted (door.md §receipts, models.md §lifecycle-model).
  for (const entry of models.values()) {
    if (!entry.lifecycle) continue;
    const part = entry.key.slice('lifecycles-'.length);
    entry.authors = sessionsSorted(confirmedLifecycles.filter((name) => name.startsWith(`${part}/lifecycles/`)).flatMap((name) => {
      const thing = restatement.things.get(name);
      return thing ? authorsOf(receipts.get(folderOf(thing.page)), 'README.md') : [];
    }));
  }
  // Each claim's bounds on each model covering its parts, the premise bound:<model>/<part or span>/<claim>, carried
  // apart from the claim (forms.md §premises; decisions.md §carry): a subject of decisions.md §in-force whether or not the claim
  // rests on it. `property` says whether it does: wherever its encoding there is a property (account.md §standing).
  const boundPremises = [];
  for (const claim of [...restatement.things.values()].filter((t) => t.kind === 'claims')) {
    const parts = thingsParts.get(claim.entry);
    for (const model of models.values()) {
      const engine = model.lifecycle ? (model.exists ? 'lifecycle' : null) : model.model?.engine;
      if (!engine) continue;
      const record = model.model;
      if (!covers({ engine, parts: record.parts }, parts)) continue;
      const folder = `models/${model.key}/${claim.holder.span ? 'spans' : 'parts'}/${claim.holder.key}/claims/${claim.key}/`;
      const encoding = [...slots.values()].find((s) => s.path.startsWith(folder) && s.kind === 'encoding' && s.path.slice(folder.length).startsWith('encoding.') && s.counts);
      const property = Boolean(encoding && isProperty(encoding.form));
      const claimPin = pinned.entries.get(claim.entry)?.pin;
      if (!claimPin) continue;
      const bounds = engine === 'lifecycle' ? 'phase level' : claimBounds(record, claim.claimKind);
      boundPremises.push({ name: `bound:${model.key}/${claim.holder.key}/${claim.key}`, model: model.key, claim: claim.entry, bounds, pin: boundPin(model.key, claimPin, bounds), property });
    }
  }
  for (const premise of boundPremises) subjects.push({ type: 'premise', name: premise.name, pin: premise.pin });
  const forceAll = inForce(decisions, subjects, { unitOf: holdingUnit });

  // --- The authors (door.md §receipts, §read-checks): an explanation or weaker form from an author of its surprise's model counts for nothing ---
  for (const record of files.values()) {
    if (!['explanation', 'weaker'].includes(record.where.kind) || !record.entry?.session) continue;
    const model = models.get(record.where.model);
    if (model?.authors.some((a) => sessionId(a) === sessionId(record.entry.session))) {
      record.counts = false;
      const why = reason('door.md §read-checks', record.path, `its entry names the session ${sessionText(record.entry.session)}, one of the authors of the model ${record.where.model}, whose surprises it may not explain`);
      record.reasons.push(why);
      change(record.path, why);
    }
  }
  await checkExplanations({ stems, surprises, files, models, restatement, change });

  // --- The git files (door.md §read-checks, §change item 7, door.md §copies): design/.gitattributes is owed while design/ holds a file outside
  // design/brief/, and models/.gitattributes while models/ holds a file. work/.gitignore and runs/.gitignore are no
  // item and are not read: Forma writes each again at its next write there.
  const needed = { 'design/.gitattributes': holdsFile.design, 'models/.gitattributes': holdsFile.models };
  const gitFiles = {};
  for (const path of Object.keys(needed)) {
    const want = GIT_FILES[path];
    const bytes = gitSeen.get(path)?.bytes ?? null;
    gitFiles[path] = bytes === null || bytes === undefined ? 'missing' : bytes.toString('utf8') === want ? 'holds' : 'differs';
    if (gitFiles[path] === 'differs') change(path, reason('door.md §copies', path, 'it holds something other than what Forma writes there'));
    if (gitFiles[path] === 'missing' && needed[path]) change(path, reason('door.md §change', path, path.startsWith('design/') ? 'it is missing while design/ holds a file outside design/brief/' : 'it is missing while models/ holds a file'));
  }

  // --- The clock (door.md §clock): the latest tracked time, in a receipt line that parses, a decision read under its own name, or evidence whose digest holds ---
  let latest = null;
  const track = (at, file) => {
    if (isTime(at) && (!latest || compare(at, latest.at) > 0)) latest = { at, file };
  };
  for (const receipt of receipts.values()) for (const line of receipt.lines) track(line.value.at, receipt.path);
  for (const d of decisions) track(d.at, d.path);
  for (const record of files.values()) if (record.evidence && record.digested) for (const at of evidenceTimes(record.digested)) track(at, record.path);

  // --- Items design.md §at-read, §coverage owe, and every change (door.md §change) --------------------------------------------
  const restate = new Map();
  const passage = new Map();
  for (const failure of restatement.failures) {
    if (failure.address) {
      if (!passage.has(failure.address)) passage.set(failure.address, { item: `passage:${failure.address}`, address: failure.address, why: 'unresolved', reasons: [] });
      passage.get(failure.address).reasons.push(failure);
      continue;
    }
    const where = designPath(failure.holder);
    const on = where.form === 'part-list' || failure.holder === 'design/README.md' ? 'parts' : where.holder?.key;
    if (!on) continue;
    const item = `restate:${on}`;
    if (!restate.has(item)) restate.set(item, { item, on, why: 'unresolved', reasons: [] });
    restate.get(item).reasons.push(failure);
  }
  for (const address of restatement.coverage.uncovered) if (!passage.has(address)) passage.set(address, { item: `passage:${address}`, address, why: 'uncovered', reasons: [] });
  const changeItems = sortedBy([...changes.keys()]).map((path) => ({ item: `change:${path}`, path, reasons: changes.get(path) }));

  return {
    root,
    // design.md §brief to §passages: { documents, sources, passages }, passages by address with path, hash, source, citable.
    brief,
    // Every regular file under design/ (outside design/brief/) and models/, by path: { where, bytes, sha256, entry, counts, reasons }.
    files,
    // door.md §receipts: each folder's receipt, by folder: { path, lines, bad }.
    receipts,
    // forms.md §front-pages to design.md §at-read: partList, partListPage, parts, spans (each with readme, tables, rows, things, thingPages),
    // entries and things by name, failures and refs (checks 2 and 3), thingParts, spanPairs, coverage, pins.
    restatement,
    // decisions.md §decision-file to §kinds: every file that is a decision, parsed; those that are not are changes.
    decisions,
    // decisions.md §in-force over `subjects`, the units, choices, premises (pages, store, strike, span, bound) and risks the
    // pages and models name; ../design/index.mjs adds the journeys code adds (design.md §code-journeys) and runs inForce again.
    force: forceAll,
    subjects,
    // forms.md §store-premises, forms.md §menu, forms.md §surface and account.md §standing: the premises code adds, each with its pin.
    // `bound` holds the bounds a claim rests on (its encoding there a property, account.md §standing); `boundAll` every
    // claim's bounds on every model covering its parts (forms.md §premises, decisions.md §carry), each with `property`.
    premises: { store: storePremises, strike: strikePremises, span: spanPremises, bound: boundPremises.filter((p) => p.property), boundAll: boundPremises },
    // models.md §lifecycle-model: the lifecycles whose confirmation is in force, by entry name.
    confirmedLifecycles,
    // engines.md §model-md, models.md §lifecycle-model: by key, { folder, lifecycle, modelMd, model, reasons (its form), engine, engineFiles, files (those that count, by name), authors, strikes (recorded on model.md's line), exists }.
    models,
    // models.md §slots: every slot file by path: { kind, model, holder, thing, key, item, extension, entry, counts, form, formReasons, pins, pinsNow }.
    slots,
    // evidence.md §question-names, §own-check: every evidence file by path: { name, question, where, value, counts }.
    evidence,
    // evidence.md §stems, §surprises, models.md §freeze: every surprise by name: { path, where, value, counts, open, ruledBy, held },
    // `held` its file's list of { path, sha256 }, the files its freeze holds while it is open.
    surprises,
    // evidence.md §stems, §explain: the files sharing each surprise's stem, by surprise name, `explained` its explanation as read;
    // a weaker form the parser could not check at read carries `unchecked` on its file.
    stems,
    // door.md §read-checks, §copies: design/.gitattributes' and models/.gitattributes' state, `holds`, `differs` or `missing`.
    gitFiles,
    // door.md §sessions: the sessions that made decisions, and those every receipt line names.
    sessions: {
      decided: sessionsSorted(decidingSessions(decisions)),
      answered: sessionsSorted([...receipts.values()].flatMap((r) => r.lines.flatMap((l) => [...(l.value.session ? [l.value.session] : []), ...(l.value.authors ?? [])]))),
    },
    // door.md §clock: the latest tracked time and its file, for json.mjs's aheadOfClock.
    clock: { latest },
    // door.md §change: `change`, every file that counts for nothing with every reason; design.md §at-read, §coverage: `restate` and `passage`.
    items: {
      change: changeItems,
      restate: sortedBy([...restate.values()], (i) => i.item),
      passage: sortedBy([...passage.values()], (i) => i.item),
    },
    /** The unit that holds an entry (design.md §units), by the entry's name. */
    unitOf: (name) => {
      const entry = restatement.entries.get(name);
      return entry ? unitOf(entry) : null;
    },
    /** Whether an entry is added (design.md §coverage). */
    isAdded: (name) => {
      const entry = restatement.entries.get(name);
      return entry ? isAdded(entry) : null;
    },
    /** A question's bounds and their digest on a parsed TLC or Alloy model (evidence.md §bounds). */
    bounds: (model, claimKind = null) => {
      const bounds = questionBounds(model, claimKind);
      return { bounds, digest: bounds === 'phase level' ? null : boundsDigest(bounds) };
    },
    /** A surprise's whole basis digest (evidence.md §basis). */
    surpriseDigest,
    /**
     * The open surprises whose freeze holds a path, `held`, or under which a file at that path would be new, `new`
     * (models.md §freeze): each `{ surprise, why }`, for an answer the freeze refuses and an item that waits on a ruling.
     */
    freezing: (path) => {
      const found = [];
      for (const surprise of surprises.values()) {
        if (!surprise.open) continue;
        if (surprise.held.some((f) => f.path === path)) found.push({ surprise: surprise.name, why: 'held' });
        else if (newUnderFreeze(surprise, path)) found.push({ surprise: surprise.name, why: 'new' });
      }
      return found;
    },
  };
}

/**
 * evidence.md §explain's checks asked again at read (door.md §change item 3): an explanation or weaker form that fails one its
 * answer passed counts for nothing; one whose surprise file, explanation, model or claim counts for nothing waits.
 */
async function checkExplanations({ stems, surprises, files, models, restatement, change }) {
  const check = 'evidence.md §explain';
  const discount = (record, reasons) => {
    if (!reasons.length || !record.counts) return;
    record.counts = false;
    record.reasons.push(...reasons);
    for (const why of reasons) change(record.path, why);
  };
  // Check 3 discounts no weaker form the parser cannot check on this machine for want of its toolchain, until it can.
  let toolchainWant;
  const wantOfToolchain = async () => {
    if (toolchainWant === undefined) {
      try {
        await toolchain();
        toolchainWant = null;
      } catch (error) {
        toolchainWant = error.message;
      }
    }
    return toolchainWant;
  };
  for (const [name, stem] of stems) {
    const surprise = surprises.get(name);
    const record = stem.explanation ? files.get(stem.explanation) : null;
    stem.explained = null;
    if (!surprise?.counts) continue;
    // Check 3 (evidence.md §explain): weaker forms for a surprise on a base question of a TLC or Alloy model that found a
    // violation of the encoding's own property, and for no other, a type invariant violated first failing every one alike.
    const surpriseModel = models.get(surprise.where.model);
    const engine = isLifecycleModel(surprise.where.model) ? 'lifecycle' : surpriseModel?.model?.engine ?? surpriseModel?.engine ?? null;
    const own = { tlc: ['Invariant', 'Property'], alloy: ['Claim'] }[engine] ?? [];
    const found = surprise.value?.found;
    const takesWeaker = surprise.where.question.kind === 'base' && engine !== 'lifecycle' && found?.outcome === 'violation' && own.includes(found.property);
    // A weaker form of a surprise that takes none fails check 3 by itself, whatever its explanation's state, so it is a
    // change of its own, not one that fails only because another counts for nothing (door.md §change).
    if (!takesWeaker) {
      for (const weaker of stem.weaker.map((path) => files.get(path)).filter((r) => r?.counts)) discount(weaker, [reason(check, weaker.path, "it is a weaker form of a surprise that takes none: only a surprise on a base question of a TLC or Alloy model that found a violation of the encoding's own property does")]);
    }
    if (!record?.counts) continue;
    const { explanation, reasons } = parseExplain(record.bytes.toString('utf8'), record.path);
    stem.explained = explanation;
    const digest = surpriseDigest(surprise.value).slice(0, 12);
    const failed = [...reasons];
    // Check 2 at read asks only that Question and Basis name the surprise of its stem.
    if (explanation.question !== surprise.value.question) failed.push(reason(check, record.path, `its Question is ${explanation.question}, and the surprise it explains is of ${surprise.value.question}`, null, 'Question'));
    if (explanation.basis !== digest) failed.push(reason(check, record.path, `its Basis is ${explanation.basis}, and the surprise's basis digest begins ${digest}`, null, 'Basis'));
    if (takesWeaker && !explanation.weaker.length) failed.push(reason(check, record.path, "a surprise on a base question of a TLC or Alloy model that found a violation of the encoding's own property is explained with at least one weaker form", null, 'Weaker'));
    if (!takesWeaker && explanation.weaker.length) failed.push(reason(check, record.path, "only a surprise on a base question of a TLC or Alloy model that found a violation of the encoding's own property is explained with weaker forms", null, 'Weaker'));
    // Weaker names each weaker form once and nothing else (check 1): a key it names with no weaker form standing fails.
    const standing = new Set(stem.weaker.map((path) => files.get(path)?.where.key).filter(Boolean));
    for (const key of explanation.weaker) if (!standing.has(key)) failed.push(reason(check, record.path, `its Weaker names ${key}, and no weaker form ${key} stands beside it`, null, 'Weaker'));
    discount(record, failed);
    if (!record.counts) continue;
    // Each weaker form: named once by Weaker, of the claim's encoding's extension, passing models.md §slot-answer's checks of an encoding's text.
    const model = models.get(surprise.where.model);
    const claim = surprise.where.thing?.kind === 'claims' ? restatement.things.get(`${surprise.where.holder.key}/claims/${surprise.where.thing.key}`) : null;
    for (const weaker of stem.weaker.map((path) => files.get(path)).filter((r) => r?.counts)) {
      const key = weaker.where.key;
      if (!takesWeaker) { discount(weaker, [reason(check, weaker.path, "it is a weaker form of a surprise that takes none: only a surprise on a base question of a TLC or Alloy model that found a violation of the encoding's own property does")]); continue; }
      if (!explanation.weaker.includes(key)) { discount(weaker, [reason(check, weaker.path, `the explanation's Weaker does not name ${key}`, null, 'Weaker')]); continue; }
      if (!model?.model || !claim) { weaker.unchecked = 'its model or its claim counts for nothing'; continue; }
      const extension = EXTENSION[model.model.engine];
      if (weaker.where.extension !== extension) { discount(weaker, [reason(check, weaker.path, `a weaker form has the extension of the claim's encoding on the model, .${extension}`)]); continue; }
      const want = await wantOfToolchain();
      if (want) { weaker.unchecked = `the engine's parser cannot check it on this machine: ${want}`; continue; }
      const found = await slotReasons({ kind: 'encoding', extension, path: weaker.path }, weaker.bytes.toString('utf8'), { model: model.model, files: model.files, restatement, claim });
      const tool = found.filter((r) => r.check === 'door.md §forma-answer');
      if (tool.length) { weaker.unchecked = tool.map((r) => r.says).join(' '); continue; }
      discount(weaker, found);
    }
  }
}

/**
 * Whether a file is new under an open surprise's freeze (models.md §freeze): an engine file of its model, or a slot of its
 * claim on that model, that its `held` does not name; the caller has `held` set aside.
 */
function newUnderFreeze(surprise, path) {
  const where = modelsPath(path);
  if (where.model !== surprise.where.model) return false;
  const engine = surprise.value?.basis?.engine?.name;
  if (where.kind === 'engine') return engine !== 'lifecycle' && where.extension === EXTENSION[engine];
  const claim = surprise.where.thing?.kind === 'claims' ? surprise.where : null;
  return Boolean(claim) && where.kind === 'slot' && ['encoding', 'witness', 'fault'].includes(where.slot) && where.thing?.kind === 'claims' && where.thing.key === claim.thing.key && where.holder.key === claim.holder.key && where.holder.span === claim.holder.span;
}

/** What kind of file a receipt line names, for the keys its line holds (door.md §repair-answer, §receipts). */
function fileKindOf(path) {
  const where = path.startsWith('design/') ? designPath(path) : modelsPath(path);
  if (where.kind === 'slot') return 'slot';
  if (where.kind === 'model-md') return 'model-md';
  if (where.kind === 'page') return ['part-list', 'part', 'span'].includes(where.form) ? 'front' : 'page';
  return 'other';
}

