// The items of missing work (account.md §items) and what waits for the developer (account.md §waits): every item with
// who supplies it, what it is about, its case, what was found, what it waits for, and this machine's
// refusals; the waiting rules; nothing but `intake` and `change:` before the intake; the waiting
// decisions (decisions.md §rulings) that `rule:` names; and where each item is read (decisions.md §confirm).

import { basisDigest, compare, sortedBy } from '../record/json.mjs';
import { engineAllowed } from '../door/spent.mjs';
import { covers } from '../record/models.mjs';
import { designPath, modelsPath } from '../record/tree.mjs';
import { claimsOf, restsOnPremises } from './standing.mjs';
import { findsOnModel, meetingLines, repairedModel } from './mechanisms.mjs';

/** The item kinds in account.md §items's order; `restate:parts` and the run: of a surprise come after their kind's others. */
const KINDS = ['intake', 'passage', 'restate', 'findings', 'confirm', 'repair', 'pick', 'cover', 'model', 'journey', 'slot', 'express', 'run', 'unanswered', 'explain', 'rule', 'brief', 'carry', 'span', 'allow', 'change'];

/** The checkpoints of account.md §waits, in its order. */
export const CHECKPOINTS = ['intake', 'confirm', 'decide', 'carry or allow'];

const agent = (answer) => ({ by: 'agent', answer });
const dev = (decision, checkpoint) => ({ by: 'developer', decision, checkpoint });
const RUN = { by: 'run' };
const ANYONE = { by: 'anyone' };

/** Who supplies each kind of item, in account.md §items's order (account.md §commands `supply`); `change:` is the file's (changeSupply). */
export const SUPPLY = {
  intake: [dev('intake', 'intake')],
  passage: [agent('restate')],
  restate: [agent('restate')],
  findings: [agent('restate')],
  confirm: [dev('confirm', 'confirm')],
  repair: [agent('repair')],
  pick: [dev('pick', 'decide')],
  cover: [agent('model')],
  model: [agent('model')],
  journey: [agent('restate')],
  slot: [agent('slot')],
  express: [agent('model'), dev('accept', 'carry or allow')],
  run: [RUN],
  unanswered: [dev('allow', 'carry or allow'), agent('model')],
  explain: [agent('explain')],
  rule: [dev('rule', 'decide')],
  brief: [dev('brief', 'carry or allow')],
  carry: [dev('carry', 'carry or allow')],
  span: [agent('restate'), agent('model'), dev('carry', 'carry or allow')],
  allow: [dev('allow', 'carry or allow')],
};

/** The cases of account.md §items's table, in its order, by item kind (account.md §commands `why`). */
const CASES = {
  passage: ['uncovered', 'unresolved'], restate: ['unresolved', 'flagged'], confirm: ['unconfirmed', 'lapsed'], pick: ['unpicked', 'revoked'],
  slot: ['unfilled', 'owed-again'], run: ['none', 'not-current', 'larger-limits', 'lost-surprise'], brief: ['unstated', 'lapsed'], carry: ['uncarried', 'lapsed'],
  span: ['no-entry', 'no-model', 'unexamined'], allow: ['answers', 'runs', 'engine'],
};

/** Cases of an item in the order of account.md §items's table (a case the table does not give last, as it came). */
const inCaseOrder = (kind, whys) => {
  const order = CASES[kind] ?? [];
  const at = (w) => (order.includes(w) ? order.indexOf(w) : order.length);
  return [...new Set(whys)].sort((x, y) => at(x) - at(y));
};

/** An item's kind: what its name holds before the first `:`. */
export const kindOf = (name) => name.slice(0, name.indexOf(':') < 0 ? name.length : name.indexOf(':'));

/** An item's place in account.md §items's order: its kind, then `restate:parts` and a surprise's runs after their kind's others. */
function orderKey(name) {
  const kind = kindOf(name);
  const sub = name === 'restate:parts' ? 1 : kind === 'run' && /\/reduction$/.test(name) ? 1 : kind === 'run' && /\/weaker-[^/]+$/.test(name) ? 2 : 0;
  return [KINDS.indexOf(kind), sub, name];
}

/** Compares two item names in account.md §items's order, then by name. */
export function itemCompare(a, b) {
  const x = orderKey(a);
  const y = orderKey(b);
  return x[0] - y[0] || x[1] - y[1] || compare(x[2], y[2]);
}

/** Who supplies `change:<path>` (account.md §items, door.md §change): an answer of the kind that holds the file, then anyone. */
function changeSupply(path) {
  const where = path.startsWith('design/') ? designPath(path) : path.startsWith('models/') ? modelsPath(path) : { kind: 'other' };
  if (where.kind === 'page') return [agent('restate'), ANYONE];
  if (where.kind === 'model-md' || where.kind === 'engine') return [agent('model'), ANYONE];
  if (where.kind === 'slot') return [agent('slot'), ANYONE];
  if (where.kind === 'explanation' || where.kind === 'weaker') return [agent('explain'), ANYONE];
  return [ANYONE];
}

/** The part, span or model a question or surprise name serves (presentation.md §reading): `{ holder }` or `{ part }` or `{ model }`. */
function servedBy(name) {
  let m;
  if ((m = /^([^/]+)\/(parts|spans)\/([^/]+)\//.exec(name))) return { holder: m[3], model: m[1] };
  if ((m = /^([^/]+)\/(actions|world)\/([^/]+)\//.exec(name))) return { holder: m[3], model: m[1] };
  return { holder: null, model: name.split('/')[0].replace(/\.[^.]*$/, '') };
}

/** The part or span holding a design/ or models/ path (presentation.md §reading), or null. */
function holderOfPath(path) {
  let m;
  if ((m = /^design\/(parts|spans)\/([^/]+)\//.exec(path))) return m[2];
  if ((m = /^models\/[^/]+\/(parts|spans|actions|world)\/([^/]+)\//.exec(path))) return m[2];
  return null;
}

/**
 * The waiting decisions (decisions.md §rulings): open surprises grouped when their claims' Rests on name a premise in common
 * or their traces take misbehaviours of one world row, closed under both; each named by the smallest of its surprises,
 * compared by question and then by basis digest; `offered` once each has an accepted explanation and no reduction left.
 * Gives `[{ name, surprises, offered, unexplained, reducing }]` in name order.
 */
export function waitingDecisions({ project, evidence }) {
  const r = project.restatement;
  const open = evidence.surprises.filter((s) => s.open);
  const parent = new Map(open.map((s) => [s.name, s.name]));
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
  const join = (a, b) => parent.set(find(a), find(b));
  const by = new Map();
  const tie = (key, name) => {
    if (by.has(key)) join(by.get(key), name);
    else by.set(key, name);
  };
  for (const s of open) {
    const where = s.where;
    if (where?.thing?.kind === 'claims') {
      const claim = r.things.get(`${where.holder.key}/claims/${where.thing.key}`);
      if (claim) for (const p of restsOnPremises(r, claim)) tie(`premise\0${p}`, s.name);
    }
    const trace = s.value.trace;
    const rows = [...(trace?.states ?? []).flatMap((st) => st.rows ?? []), ...(trace?.loop && typeof trace.loop === 'object' ? trace.loop.rows ?? [] : [])];
    for (const row of rows) if (row.misbehaviour) tie(`row\0${row.misbehaviour.split('/').slice(0, 2).join('/')}`, s.name);
  }
  const groups = new Map();
  for (const s of open) {
    const root = find(s.name);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(s);
  }
  const out = [];
  for (const members of groups.values()) {
    const sorted = [...members].sort((a, b) => compare(a.question, b.question) || compare(basisDigest(a.value.basis), basisDigest(b.value.basis)));
    out.push({
      name: sorted[0].name,
      surprises: sortedBy(members.map((s) => s.name)),
      offered: members.every((s) => s.explained && !s.reductions.left),
      unexplained: sortedBy(members.filter((s) => !s.explained).map((s) => s.name)),
      reducing: sortedBy(members.filter((s) => s.reductions.left).map((s) => s.name)),
    });
  }
  return sortedBy(out, (w) => w.name);
}

/** Whether a receipt line of a file `test` takes names `decision` in its `answers` by what it changed (decisions.md §expects). */
const repairedUnder = (project, decision, test) => meetingLines(project, decision, test).length > 0;

/**
 * The repairs owed (decisions.md §expects; account.md §items `repair:`): each `{ item, on, decision, model, frozen }`, `frozen`
 * the open surprises whose freeze holds the files it would change.
 */
function repairsOf({ project, design, evidence }) {
  const out = [];
  const force = design.force;
  const r = project.restatement;
  const openOn = (model) => evidence.surprises.filter((s) => s.open && s.model === model).map((s) => s.name);
  // The open surprises on a model whose freeze holds a file `test` takes (models.md §freeze: `held`).
  const holding = (model, test) => evidence.surprises.filter((s) => s.open && s.model === model && (s.value?.held ?? []).some((h) => test(h.path))).map((s) => s.name);
  // Declines in force (decisions.md §expects).
  for (const unit of design.units.values()) {
    if (unit.state !== 'declined') continue;
    const d = force.subjects.get(unit.name, 'unit')?.inForce;
    if (d?.kind !== 'decline') continue;
    const journey = design.journeys.get(unit.name);
    if (journey?.added === 'pick' || journey?.added === 'kept') continue;
    if (journey?.added === 'offered') {
      const lifecycle = design.lifecycles.get(journey.reaches?.lifecycle ?? journey.goesWith ?? '');
      const folder = lifecycle?.page ? lifecycle.page.slice(0, lifecycle.page.lastIndexOf('/') + 1) : null;
      if (folder && repairedUnder(project, d.name, (p) => p.startsWith(folder))) continue;
      out.push({ item: `repair:${d.name}`, on: d.name, decision: d, model: null, frozen: lifecycle?.page ? project.freezing(lifecycle.page).map((f) => f.surprise) : [] });
      continue;
    }
    // "Once met, a repair stays met" (decisions.md §expects): a receipt line under design/ that names the decline by what it changed met it,
    // so the decline in force again on its old pin, the page restored, owes no repair.
    if (repairedUnder(project, d.name, (p) => p.startsWith('design/'))) continue;
    const pages = [...new Set((unit.entries ?? [unit.name]).map((e) => r.entries.get(e)?.page ?? r.things.get(e)?.page).filter(Boolean))];
    out.push({ item: `repair:${d.name}`, on: d.name, decision: d, model: null, frozen: [...new Set(pages.flatMap((p) => project.freezing(p).map((f) => f.surprise)))] });
  }
  // Rulings in force, over the surprises they are in force for (decisions.md §rulings, §expects).
  const rulings = new Map();
  for (const [surprise, ruling] of force.rulings) {
    if (!rulings.has(ruling.name)) rulings.set(ruling.name, { ruling, surprises: [] });
    rulings.get(ruling.name).surprises.push(surprise);
  }
  for (const { ruling, surprises } of [...rulings.values()].sort((a, b) => compare(a.ruling.name, b.ruling.name))) {
    const rows = (ruling.surprises?.surprises ?? []).filter((s) => surprises.includes(s.surprise));
    const modelsRan = sortedBy([...new Set(rows.map((s) => s.question.split('/')[0]))]);
    const verdict = ruling.rows.Verdict;
    const target = ruling.rows.Target;
    // Each item waits for the surprises whose freeze holds a file it may change (account.md §items Waiting): every open
    // surprise on the model for a repair of the model's files, by default.
    // `on` holds the decision and the model, as the item's name does (account.md §commands).
    const perModel = (models, met, frozenOn = openOn) => {
      for (const m of models) if (!met(m)) out.push({ item: `repair:${ruling.name}/${m}`, on: `${ruling.name}/${m}`, decision: ruling, model: m, frozen: frozenOn(m) });
    };
    // Met when "a receipt line under `models/<model>/`, or for a lifecycle model on one of its part's lifecycle pages,
    // names the ruling in its `answers`, or the line door.md §repair-answer records the repair's removals on does, a line that a
    // Repair answer for it wrote, with its mechanism in `mechanisms`" (decisions.md §expects).
    const byRepair = (m) => repairedModel(project, ruling.name, m).length > 0;
    if (verdict === 'model wrong') perModel(modelsRan, byRepair);
    else if (findsOnModel(ruling)) perModel([target], byRepair);
    else if (verdict === 'property wrong') {
      const entries = (ruling.surprises?.entries ?? []).filter((e) => surprises.includes(e.surprise) && /\/claims\//.test(e.entry));
      const claimRows = rows.filter((s) => /\/claims\//.test(s.question));
      const claimsRead = claimRows.map((s) => {
        const m = /^[^/]+\/(parts|spans)\/([^/]+)\/claims\/([^/]+)\//.exec(s.question);
        const entry = m ? `${m[2]}/claims/${m[3]}` : null;
        const pin = entries.find((e) => e.surprise === s.surprise && e.entry === entry)?.pin ?? null;
        return { entry, pin, folder: m ? `/${m[1]}/${m[2]}/claims/${m[3]}/` : null };
      }).filter((c) => c.entry);
      const stillReads = claimsRead.filter((c) => r.pins.entries.get(c.entry)?.pin === c.pin);
      // A property-wrong repair changes the ruled claims' pages or their encodings on the model, which only a surprise on
      // one of those claims' questions there freezes (models.md §freeze: the claim's slots on that model).
      if (stillReads.length) perModel(modelsRan, (m) => repairedUnder(project, ruling.name, (p) => stillReads.some((c) => p.startsWith(`models/${m}${c.folder}encoding.`))), (m) => holding(m, (p) => stillReads.some((c) => p.startsWith(`models/${m}${c.folder}`))));
    } else if (verdict === 'abstraction too coarse') {
      const named = sortedBy([...new Set(rows.flatMap((s) => s.parts.split(', ')))]);
      const stands = named.some((p) => r.parts.get(p)?.readme?.exists || r.spans.get(p)?.readme?.exists);
      if (stands && !repairedUnder(project, ruling.name, (p) => p.startsWith('design/'))) out.push({ item: `repair:${ruling.name}`, on: ruling.name, decision: ruling, model: null, frozen: [] });
    }
  }
  return out;
}

/**
 * Every item of missing work (account.md §items), each in account.md §commands's JSON form `{ item, supply, on, why, found, waits, refused }`
 * (absent keys left out), in account.md §items's order. `a` is `{ project, design, evidence, standing, here }`, `here` this machine's
 * `{ allowance, spent, left, refusals }` (door.md §spent, §scratch), or null to read nothing of work/ (account.md §diff).
 */
export function itemsOf(a) {
  const { project, design, evidence, standing, here } = a;
  const r = project.restatement;
  const force = design.force;
  const items = new Map();
  const add = (name, fields) => {
    if (items.has(name)) {
      const was = items.get(name);
      if (fields.why && was.why && !was.why.split(', ').includes(fields.why)) was.why = inCaseOrder(kindOf(name), [...was.why.split(', '), fields.why]).join(', ');
      if (fields.found) was.found = was.found ? `${was.found}; ${fields.found}` : fields.found;
      return;
    }
    items.set(name, { item: name, supply: SUPPLY[kindOf(name)] ?? changeSupply(fields.on), ...fields });
  };

  // change: (door.md §change): every file that counts for nothing, with every reason.
  for (const c of project.items.change) add(c.item, { on: c.path, found: c.reasons.map((x) => x.says).join('; '), supply: changeSupply(c.path) });

  // Before the intake the only items are intake and any change: (door.md §answer-holds).
  if (!force.intake) {
    add('intake', { on: 'intake' });
    return finish(a, items);
  }

  // passage: (design.md §coverage, §at-read), with the citations of the journeys code adds.
  for (const p of project.items.passage) if (p.why === 'unresolved') add(p.item, { on: p.address, why: 'unresolved' });
  for (const u of design.coverage.unresolved ?? []) add(`passage:${u.address}`, { on: u.address, why: 'unresolved' });
  for (const address of design.coverage.uncovered) add(`passage:${address}`, { on: address, why: 'uncovered' });

  // restate: (design.md §restate-checks checks 2 and 3; design.md §passages `explored`).
  for (const x of project.items.restate) add(x.item, { on: x.on, why: 'unresolved', found: x.reasons.map((f) => f.says).join('; ') });
  for (const [model, fails] of standing.ruleFails) {
    for (const f of fails) {
      if (f.rule !== 'explored') continue;
      for (const need of f.needs) if (need.startsWith('restate:')) add(need, { on: need.slice('restate:'.length), why: 'flagged', found: `${f.found} on ${model}` });
    }
  }

  // findings: a finding that blocks confirmation of a unit of the part or span not yet confirmed (lifecycle-tool.md §findings).
  const blocked = new Map();
  const said = new Set();
  for (const finding of design.tool.findings) {
    if (finding.code === 'posed-cell') continue;
    for (const unit of finding.bearsOn ?? []) {
      const state = design.units.get(unit)?.state;
      if (state === 'confirmed') continue;
      const holder = unit === 'parts' ? null : unit.split('/')[0];
      if (!holder) continue;
      if (!blocked.has(unit)) blocked.set(unit, []);
      blocked.get(unit).push(finding);
      const once = `${holder}\0${finding.code}\0${finding.on}\0${finding.says}`;
      add(`findings:${holder}`, { on: holder, found: said.has(once) ? undefined : finding.says });
      said.add(once);
    }
  }

  // confirm: (decisions.md §confirm, §in-force).
  for (const unit of design.units.values()) if (unit.state === 'unconfirmed' || unit.state === 'lapsed') add(`confirm:${unit.name}`, { on: unit.name, why: unit.state });

  // repair: (decisions.md §expects).
  const repairs = repairsOf(a);
  for (const x of repairs) add(x.item, { on: x.on });

  // pick: (decisions.md §pick, §in-force).
  for (const thing of r.things.values()) {
    if (thing.kind !== 'choices') continue;
    const carry = force.carried(thing.entry);
    if (!design.picks.has(thing.entry)) add(`pick:${thing.entry}`, { on: thing.entry, why: 'unpicked' });
    else if (carry.revokedBy) add(`pick:${thing.entry}`, { on: thing.entry, why: 'revoked' });
  }
  for (const [, fails] of standing.ruleFails) for (const f of fails) for (const need of f.needs) if (need.startsWith('pick:') && !items.has(need)) add(need, { on: need.slice(5), why: 'unpicked' });

  // cover: and journey: (models.md §owed; account.md §journey-rules).
  const existing = [...evidence.models.values()].filter((m) => m.exists && m.model);
  const parts = sortedBy([...r.parts.values()].filter((p) => p.readme?.exists).map((p) => p.key));
  const engineModels = existing.filter((m) => m.engine === 'tlc' || m.engine === 'alloy');
  if (!engineModels.length && parts.length) add(`cover:${parts.join('+')}`, { on: parts.join('+') });
  else {
    for (const p of parts) if (!existing.some((m) => covers(m.model, [p]))) add(`cover:${p}`, { on: p });
    const covered = (ps) => ps.length === 0 || existing.some((m) => covers(m.model, ps));
    for (const claim of claimsOf(project)) if (!covered(claim.parts)) add(`cover:${claim.parts.join('+')}`, { on: claim.parts.join('+') });
    for (const j of design.journeys.values()) if (j.confirmed && !covered(j.parts)) add(`cover:${j.parts.join('+')}`, { on: j.parts.join('+') });
  }
  for (const p of parts) {
    if (!existing.some((m) => covers(m.model, [p]))) continue;
    const has = [...design.journeys.values()].some((j) => j.confirmed && j.polarity === 'should happen' && j.parts.includes(p));
    if (!has) add(`journey:${p}`, { on: p });
  }

  // model: (models.md §parts-change).
  for (const m of evidence.models.values()) if (m.owed) add(`model:${m.key}`, { on: m.key, found: m.reasons.map((x) => x.says).join('; ') });

  // slot: (models.md §slot-currency, §owed).
  for (const p of evidence.slots.positions) {
    if (p.state === 'unfilled') add(`slot:${p.path.replace(/^models\//, '')}`, { on: p.path.replace(/^models\//, ''), why: 'unfilled' });
  }
  for (const f of evidence.slots.files.values()) {
    if (f.owedAgain && f.exists && f.usable) {
      const name = f.path.replace(/^models\//, '').replace(/\.(tla|als|md)$/, '');
      add(`slot:${name}`, { on: name, why: 'owed-again' });
    }
  }

  // express: a claim whose encoding on every model covering it gives a reason, with no acceptance in force.
  for (const s of standing.claims.values()) {
    if (!s.models.length || s.acceptance) continue;
    if (s.models.every((m) => m.conditions.find((c) => c.condition === 'examined').cannotExpress)) add(`express:${s.entry}`, { on: s.entry });
  }

  // run:, unanswered: (evidence.md §forma-run; account.md §items).
  for (const o of evidence.owed) add(o.item, { on: o.why === 'reduction' || o.why === 'weaker' ? o.item.slice(4).replace(/\/(reduction|weaker-[^/]+)$/, '') : o.name, why: o.why === 'reduction' || o.why === 'weaker' ? undefined : o.why, engine: o.question?.engine, spends: o.spends });
  for (const u of evidence.unanswered) add(`unanswered:${u.question}`, { on: u.question });

  // explain: and rule: (evidence.md §surprises; decisions.md §rulings).
  for (const s of evidence.surprises) if (s.open && !s.explained) add(`explain:${s.name}`, { on: s.name, ...(s.sentBack.length ? { found: s.sentBack.join('; ') } : {}) });
  const waiting = waitingDecisions(a);
  for (const w of waiting) add(`rule:${w.name}`, { on: w.name, surprises: w.surprises });

  // brief: a real finding's met repair on a model, by a ruling in force, with no brief decision in force on it
  // (`unstated`), or whose brief decision lapsed (`lapsed`) (decisions.md §rulings, §in-force); it waits for nothing.
  for (const s of a.briefs?.subjects.values() ?? []) {
    if (s.inForce) continue;
    add(`brief:${s.name}`, { on: s.name, why: s.lapsed ? 'lapsed' : 'unstated' });
  }

  // carry: each premise a claim rests on (account.md §standing), but a choice premise, with no carry counted.
  const rested = new Set();
  for (const s of standing.claims.values()) {
    for (const p of restsOnPremises(r, s.claim)) rested.add(p);
    for (const m of s.models) for (const p of m.premises) rested.add(p.name);
  }
  for (const name of sortedBy([...rested])) {
    if (name.startsWith('choice:')) continue;
    const c = standing.carries.get(name);
    if (c?.counted) continue;
    add(`carry:${name}`, { on: name, why: c?.lapsed ? 'lapsed' : 'uncarried' });
  }

  // span: (account.md §journey-rules), a carry counted as the fixpoint counts it.
  for (const s of evidence.spans) {
    const carry = standing.carries.get(`span:${s.span}`);
    const carried = carry ? carry.counted : s.carried;
    if (carried) continue;
    const why = s.examined.length ? null : s.why ?? 'unexamined';
    if (why) add(`span:${s.span}`, { on: s.span, why });
  }

  return finish(a, items, { waiting, repairs, blocked });
}

/**
 * The item `allow` (account.md §items), this machine's: the allowance spent here cannot pay for what is missing, `answers`
 * while an item an answer supplies is missing and none are left, `runs` while a run that would spend is missing and
 * none are left, `engine` while a missing run's engine has no time or memory. It rests on work/, so it is shown beside
 * the account with this machine's allowance, never enters the box or the diff, and changes no other item's waits.
 * `items` are itemsOf's; `here` is `{ allowance, left }`. Gives the item in account.md §commands's form, or null.
 */
export function allowItem(items, here, force) {
  if (!force.intake || !here?.allowance) return null;
  const allowance = here.allowance;
  const left = here.left ?? { answers: allowance.answers, runs: allowance.runs };
  const answering = items.filter((i) => i.supply.some((s) => s.by === 'agent'));
  const runs = items.filter((i) => kindOf(i.item) === 'run');
  const short = { answers: left.answers <= 0 && answering.length > 0, runs: false, engines: new Set() };
  short.runs = left.runs <= 0 && runs.some((i) => i.extra?.spends !== false);
  for (const i of runs) if (i.extra?.engine && !engineAllowed(allowance, i.extra.engine)) short.engines.add(i.extra.engine);
  const whys = [short.answers ? 'answers' : null, short.runs ? 'runs' : null, short.engines.size ? 'engine' : null].filter(Boolean);
  if (!whys.length) return null;
  const item = { item: 'allow', supply: SUPPLY.allow, on: 'allow', why: whys.join(', ') };
  if (short.engines.size) item.found = `no time or memory for ${[...short.engines].sort(compare).join(', ')}`;
  const refused = here.refusals?.get('allow');
  if (refused?.length) item.refused = refused.map((x) => x.reasons);
  return item;
}

/** The waits and this machine's refusals (account.md §items, §commands), then the list in account.md §items's order. */
function finish(a, items, { waiting = [], repairs = [], blocked = new Map() } = {}) {
  const { project, design, evidence, here } = a;

  // Waits (account.md §items), each item it waits for named "in the order of this list", the list of waiting rules that follows: by
  // the rule that makes it wait (`rank`, its place in that list; within the rule's own words, `sub`), then by name.
  const has = (name) => items.has(name);
  const waits = new Map();
  const wait = (item, on, rank, sub = 0) => {
    if (!has(on) || item === on) return;
    if (!waits.has(item)) waits.set(item, new Map());
    const was = waits.get(item).get(on);
    if (!was || rank < was.rank || (rank === was.rank && sub < was.sub)) waits.get(item).set(on, { rank, sub });
  };
  const r = project.restatement;
  const partsUnit = design.units.get('parts');
  const partsDecline = partsUnit?.state === 'declined' ? design.force.subjects.get('parts', 'unit')?.inForce : null;
  const ruleOf = new Map();
  for (const w of waiting) for (const s of w.surprises) ruleOf.set(s, `rule:${w.name}`);
  for (const i of items.values()) {
    const name = i.item;
    const kind = kindOf(name);
    if (kind === 'confirm' && i.on !== 'parts' && partsUnit?.state !== 'confirmed') {
      wait(name, 'confirm:parts', 1);
      if (partsDecline) wait(name, `repair:${partsDecline.name}`, 1, 1);
    }
    if (kind === 'confirm' && blocked.has(i.on)) wait(name, `findings:${i.on.split('/')[0]}`, 2);
    if (kind === 'confirm') {
      const journey = design.journeys.get(i.on);
      if (journey?.added === 'offered' && journey.reaches) {
        for (const j of design.journeys.values()) {
          if (j.added || j.confirmed || j.declined) continue;
          const reached = design.tool.stepped.get(j.name)?.reached ?? [];
          if (reached.some((x) => x.lifecycle === journey.reaches.lifecycle && x.phase === journey.reaches.phase)) wait(name, `confirm:${j.name}`, 3);
        }
      }
    }
    if (kind === 'journey') {
      for (const j of design.journeys.values()) {
        if (j.added || j.confirmed || j.polarity !== 'should happen' || !j.parts.includes(i.on)) continue;
        if (j.declined) {
          const d = design.force.subjects.get(j.name, 'unit')?.inForce;
          if (d) wait(name, `repair:${d.name}`, 4);
        } else wait(name, `confirm:${j.name}`, 4);
      }
    }
    if (kind === 'slot') {
      const m = /^([^/]+)\/(parts|spans)\/([^/]+)\/claims\/([^/]+)\//.exec(i.on);
      if (m) for (const s of evidence.surprises) if (s.open && s.model === m[1] && s.where?.thing?.kind === 'claims' && s.where.holder.key === m[3] && s.where.thing.key === m[4] && ruleOf.has(s.name)) wait(name, ruleOf.get(s.name), 5);
    }
    if (kind === 'model') for (const s of evidence.surprises) if (s.open && s.model === i.on && ruleOf.has(s.name)) wait(name, ruleOf.get(s.name), 5);
    if (kind === 'repair') {
      const x = repairs.find((rep) => rep.item === name);
      for (const s of x?.frozen ?? []) if (ruleOf.has(s)) wait(name, ruleOf.get(s), 5);
    }
    if (kind === 'rule') {
      const w = waiting.find((x) => `rule:${x.name}` === name);
      // "for the explain: of each surprise in it, and for the run:<surprise>/reduction of each that still has a reduction to run"
      for (const s of w?.unexplained ?? []) wait(name, `explain:${s}`, 6, 0);
      for (const s of w?.reducing ?? []) wait(name, `run:${s}/reduction`, 6, 1);
    }
  }

  const out = [];
  for (const name of [...items.keys()].sort(itemCompare)) {
    const i = items.get(name);
    const refused = here?.refusals?.get(name);
    const item = { item: name, supply: i.supply, on: i.on };
    if (i.why) item.why = i.why;
    if (i.found) item.found = i.found;
    if (waits.has(name)) item.waits = [...waits.get(name)].sort(([x, a], [y, b]) => a.rank - b.rank || a.sub - b.sub || itemCompare(x, y)).map(([on]) => on);
    if (refused?.length) item.refused = refused.map((x) => x.reasons);
    Object.defineProperty(item, 'extra', { value: { engine: i.engine, spends: i.spends, surprises: i.surprises }, enumerable: false });
    out.push(item);
  }
  return out;
}

/**
 * Where an item is read (presentation.md §reading): `{ project, holders, model }`, `holders` the parts or spans it is read under,
 * `model` the model it is read under (`model:` and the items of a model's own questions), `project` whether it is read
 * under the project. `waiting` gives a waiting decision's surprises.
 */
export function readUnder(item, { project, design }) {
  const name = item.item;
  const kind = kindOf(name);
  const on = item.on ?? '';
  const r = project.restatement;
  const holderOfName = (n) => (n === 'parts' ? null : n.split('/')[0]);
  const fromServed = (q) => {
    const s = servedBy(q);
    return s.holder ? { project: false, holders: [s.holder], model: null } : { project: false, holders: [], model: s.model };
  };
  switch (kind) {
    case 'restate': return on === 'parts' ? { project: true, holders: [], model: null } : { project: false, holders: [on], model: null };
    case 'findings': case 'journey': return { project: false, holders: [on], model: null };
    case 'confirm': return on === 'parts' ? { project: true, holders: [], model: null } : { project: false, holders: [holderOfName(on)], model: null };
    case 'pick': case 'express': return { project: false, holders: [holderOfName(on)], model: null };
    case 'model': return { project: false, holders: [], model: on };
    case 'slot': return fromServed(on);
    case 'run': case 'unanswered': case 'explain': return fromServed(on);
    case 'rule': return fromServed(on);
    // A repair, and the brief decision a met real finding's repair owes, are read where the decision that sends it is
    // filed: `on` names that decision, then the model for `repair:<decision>/<model>` and `brief:<ruling>/<model>`.
    case 'repair': case 'brief': {
      const d = design.force ? project.decisions.find((x) => x.name === on.split('/')[0]) : null;
      const holder = d ? holderOfPath(`${d.folder}/`) : null;
      return holder ? { project: false, holders: [holder], model: null } : { project: true, holders: [], model: null };
    }
    case 'carry': {
      let m;
      if ((m = /^(?:store|strike):([^/]+)\//.exec(on))) return { project: false, holders: [m[1]], model: null };
      if ((m = /^bound:[^/]+\/([^/]+)\//.exec(on))) return { project: false, holders: [m[1]], model: null };
      if ((m = /^span:([^+]+)\+(.+)$/.exec(on))) return { project: true, holders: [m[1], m[2]], model: null };
      return { project: false, holders: [holderOfName(on)], model: null };
    }
    case 'span': {
      const [x, y] = on.split('+');
      return { project: true, holders: [x, y], model: null };
    }
    case 'change': {
      const holder = holderOfPath(on);
      return holder && (r.parts.has(holder) || r.spans.has(holder)) ? { project: false, holders: [holder], model: null } : { project: true, holders: [], model: null };
    }
    default: return { project: true, holders: [], model: null };
  }
}

/**
 * A group's items in the order `forma missing` lists them (account.md §commands): by item name, but that an item other items
 * of the group wait for (account.md §items) comes before them, so what the rest wait for is read first, as `confirm:parts` before
 * every other `confirm:`. Each item is placed at its turn in name order, the items of the group it waits for, in name
 * order and each with what it waits for, placed just before it.
 */
export function waitsFirst(items) {
  const byName = new Map(items.map((i) => [i.item, i]));
  const out = [];
  const placed = new Set();
  const place = (item, path) => {
    if (placed.has(item.item) || path.has(item.item)) return;
    path.add(item.item);
    for (const w of sortedBy((item.waits ?? []).filter((n) => byName.has(n)))) place(byName.get(w), path);
    placed.add(item.item);
    out.push(item);
  };
  for (const item of sortedBy(items, (i) => i.item)) place(item, new Set());
  return out;
}

/**
 * What waits for the developer (account.md §waits): every item the developer may supply, at its checkpoint, grouped by
 * checkpoint in account.md §waits's order, then as the cadence groups them, with the inbox cap. `allow`, this machine's, is shown with
 * this machine's allowance (allowItem). Gives `[{ checkpoint, groups: [{ under, full, rest }] }]`.
 */
export function forTheDeveloper(items, a, settings) {
  const cadence = settings.cadence ?? 'span';
  const cap = Number.isSafeInteger(settings.cap) ? settings.cap : 7;
  const out = [];
  for (const checkpoint of CHECKPOINTS) {
    const mine = items.filter((i) => i.supply.find((s) => s.by === 'developer')?.checkpoint === checkpoint);
    if (!mine.length) continue;
    const groups = new Map();
    const order = [];
    const put = (under, item) => {
      if (!groups.has(under)) { groups.set(under, []); order.push(under); }
      groups.get(under).push(item);
    };
    for (const item of mine) {
      if (cadence === 'question') put(null, item);
      else if (cadence === 'session') put(sessionOf(item, a) ?? 'none', item);
      else {
        const where = readUnder(item, a);
        put(where.project || (!where.holders.length && !where.model) ? 'project' : where.model ? `model ${where.model}` : where.holders[0], item);
      }
    }
    const keys = cadence === 'span' ? [...order].sort((x, y) => (x === 'project' ? -1 : y === 'project' ? 1 : compare(x, y))) : cadence === 'session' ? [...order].sort((x, y) => (x === 'none' ? 1 : y === 'none' ? -1 : compare(x, y))) : order;
    let shown = 0;
    const list = [];
    for (const key of keys) {
      // Within each group, by item name, what the others wait for first (account.md §commands); `question` lists each by itself, so in that order across the checkpoint.
      const group = waitsFirst(groups.get(key));
      const full = [];
      const rest = [];
      for (const item of group) {
        if (shown < cap) { full.push(item); shown += 1; } else rest.push(item);
      }
      list.push({ under: key, full, rest });
    }
    out.push({ checkpoint, groups: list });
  }
  return out;
}

/**
 * The session whose answer opened an item (account.md §waits cadence `session`): the `session` of the latest receipt line,
 * by `at`, among the files its subject rests on, or null.
 */
function sessionOf(item, { project }) {
  const on = item.on ?? '';
  const prefixes = [];
  let m;
  if ((m = /^([^/]+)\/(lifecycles|journeys|claims|premises|choices)\/([^/]+)$/.exec(on))) prefixes.push(`design/parts/${m[1]}/${m[2]}/${m[3]}/`, `design/spans/${m[1]}/${m[2]}/${m[3]}/`);
  else if ((m = /^(?:store|strike|bound:[^/]+\/)?:?([^/:+]+)\//.exec(on))) prefixes.push(`design/parts/${m[1]}/`, `design/spans/${m[1]}/`);
  else if (on === 'parts') prefixes.push('design/README.md');
  if (/^[^/]+\/(parts|spans|actions|world)\//.test(on)) prefixes.push(`models/${on.split('/').slice(0, -1).join('/')}/`);
  if (kindOf(item.item) === 'model') prefixes.push(`models/${on}/`);
  let latest = null;
  for (const receipt of project.receipts.values()) {
    const folder = receipt.path.slice(0, receipt.path.lastIndexOf('/') + 1);
    for (const line of receipt.lines) {
      const path = `${folder}${line.value?.file}`;
      if (!prefixes.some((p) => path.startsWith(p) || path === p)) continue;
      if (line.value?.session && (!latest || compare(line.value.at, latest.at) > 0)) latest = line.value;
    }
  }
  return latest ? `${latest.session.provider} / ${latest.session.model} / ${latest.session.session}` : null;
}
