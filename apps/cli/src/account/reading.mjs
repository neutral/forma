// The reading (account.md §basis-line, presentation.md §reading) and what the account cannot know (account.md §cannot-know): for the project, one part or
// span, or one thing with its decisions wherever they sit; part by part and by exception, what is not
// established first; as Markdown, and with --json as one object in presentation.md §reading's keys.

import { inOrder } from '../record/decisions.mjs';
import { compare, sortedBy } from '../record/json.mjs';
import { covers } from '../record/models.mjs';
import { tidy } from '../record/pins.mjs';
import { PART_KINDS } from '../record/tree.mjs';
import { lifecyclePicture, pictureText, pictureBasis } from '../design/lifecycle-tool.mjs';
import { renderSurprise } from '../evidence/render.mjs';
import { forTheDeveloper, itemCompare, kindOf, readUnder } from './items.mjs';
import { mechanismLines } from './mechanisms.mjs';
import { foundOf, premiseLine, premiseSays, restsOnPremises } from './standing.mjs';

/** account.md §cannot-know's sentences, in order. */
export const CANNOT_KNOW = [
  'An engine checks the encoding, not its fidelity to the design; fidelity rests only on the journeys a model passes.',
  'A result holds within its stated bounds only, and a lifecycle engine result at phase level only.',
  'A `CHOOSE` in a model that its bounds do not record as a trade is not seen.',
  'Staleness follows citations, so a dependence nobody cited is not tracked.',
  'An interaction nobody wrote down is not found.',
  'Who wrote a brief passage is not recorded.',
  'Who made a decision is as declared, and is not checked; so is the session an agent declares with an answer.',
  'What one machine spent or refused is not known to another, and a session known only by answers refused is known only where it submitted.',
  'What an agent spends inside its own work is not seen: only the answers it submits count against the allowance.',
];

const THING = /^([^/]+)\/(lifecycles|journeys|claims|premises|choices)\/([^/]+)$/;

/** The holders of the project in the reading order design/README.md gives (forms.md §reading-order): named first, then the rest by key. */
function readingOrder(project) {
  const r = project.restatement;
  const all = [
    ...[...r.parts.values()].filter((p) => p.readme?.exists).map((p) => ({ key: p.key, span: false })),
    ...[...r.spans.values()].filter((s) => s.readme?.exists).map((s) => ({ key: s.key, span: true })),
  ];
  const named = (r.partList?.order ?? []).map((o) => all.find((h) => h.key === o.key && h.span === (o.kind === 'spans'))).filter(Boolean);
  const rest = all.filter((h) => !named.includes(h)).sort((a, b) => compare(a.key, b.key) || Number(a.span) - Number(b.span));
  return [...new Set([...named, ...rest])];
}

/**
 * A comparator of a holder's things in the order its README.md gives (forms.md §reading-order): named things first, then the
 * rest, those code adds included, by key and, for one key, lifecycles, journeys, claims, premises, choices.
 */
function thingComparator(project, holder) {
  const record = (holder.span ? project.restatement.spans : project.restatement.parts).get(holder.key);
  const order = record?.readme?.page?.order ?? [];
  const at = (name) => {
    const [, , kind, key] = THING.exec(name) ?? [];
    const i = order.findIndex((o) => o.kind === kind && o.key === key);
    return i < 0 ? Infinity : i;
  };
  return (x, y) => {
    const a = at(x);
    const b = at(y);
    if (a !== b) return a - b;
    const [, , ka, kx] = THING.exec(x) ?? [null, null, '', x];
    const [, , kb, ky] = THING.exec(y) ?? [null, null, '', y];
    return compare(kx, ky) || PART_KINDS.indexOf(ka) - PART_KINDS.indexOf(kb);
  };
}

/** A holder's name in the developer's terms: its README.md's heading, or its key. */
function holderName(project, holder) {
  const record = (holder.span ? project.restatement.spans : project.restatement.parts).get(holder.key);
  return record?.readme?.page?.name || holder.key;
}

/** Every decision with its state (decisions.md §in-force), as the reading's decision entry gives it (presentation.md §reading). */
function decisionEntry(a, d) {
  const s = a.design.force.states.get(d.name) ?? { state: 'nothing' };
  // "A carry whose basis claim is not established has lapsed too" (decisions.md §in-force), as account.md §standing's fixpoint counts it.
  const carry = d.kind === 'carry' ? a.standing.carries.get(d.on) : null;
  const uncounted = s.state === 'in force' && carry?.by?.name === d.name && carry.carried && !carry.counted;
  const state = s.state === 'nothing' ? 'decides nothing' : uncounted ? 'lapsed' : s.state;
  const out = { decision: d.name, path: d.path, kind: d.kind, on: d.on, pin: d.pin, rows: d.rows, session: d.session, by: d.by, at: d.at };
  if (d.words !== undefined) out.words = d.words;
  out.state = state;
  if (s.supersededBy) out.supersededBy = s.supersededBy;
  if (s.revokedBy) out.revokedBy = s.revokedBy;
  if (s.carryRevokedBy) out.revokedBy = s.carryRevokedBy;
  return out;
}

/** The part or span a decision is about (presentation.md §reading "Decided"), or null for the project as a whole. */
function decisionHolder(a, d) {
  const on = d.on ?? '';
  let m;
  if (['intake', 'allow'].includes(d.kind) || on === 'parts') return null;
  // A brief decision is read with its ruling, where it is filed (decisions.md §filing, §rulings).
  if (d.kind === 'brief') {
    const ruling = a.project.decisions.find((x) => x.name === on.split('/')[0] && x.kind === 'rule');
    return ruling ? decisionHolder(a, ruling) : null;
  }
  if (d.kind === 'rule') {
    const surprise = (d.surprises?.surprises ?? [])[0];
    const q = surprise?.question ?? '';
    if ((m = /^[^/]+\/(parts|spans|actions|world)\/([^/]+)\//.exec(q))) return m[2];
    return null;
  }
  if ((m = /^(?:store|strike):([^/]+)\//.exec(on))) return m[1];
  if ((m = /^bound:[^/]+\/([^/]+)\//.exec(on))) return m[1];
  if (/^span:/.test(on)) return null;
  return on.split('/')[0] || null;
}

/** A journey's conformance on each model covering its parts (account.md §journey-rules, presentation.md §reading): `{ model, conforms, fails }`. */
function journeyModels(a, journey) {
  const out = [];
  for (const state of a.evidence.models.values()) {
    if (!state.exists || !state.model) continue;
    const covering = state.engine === 'lifecycle' ? journey.parts.length === 1 && journey.parts[0] === state.part : covers(state.model, journey.parts);
    if (!covering) continue;
    let fails = (a.standing.ruleFails.get(state.key) ?? []).filter((f) => f.on === journey.name).map((f) => ({ rule: f.rule, on: f.on, found: f.found, items: f.items ?? [] }));
    // A journey not confirmed is judged by no journey rule (account.md §journey-rules): what it waits for is its confirmation, or its decline's repair.
    if (!journey.confirmed) {
      const names = new Set(a.items.map((i) => i.item));
      const decline = journey.declined ? a.design.force.subjects.get(journey.name, 'unit')?.inForce : null;
      const items = [decline ? `repair:${decline.name}` : `confirm:${journey.name}`].filter((x) => names.has(x));
      fails = [{ rule: 'journeys', on: journey.name, found: journey.declined ? 'declined, so judged by no journey rule' : 'not confirmed, so judged by no journey rule', items }];
    }
    const usable = state.usable || state.engine === 'lifecycle';
    out.push({ model: state.key, conforms: usable && journey.confirmed && !fails.length, fails: usable ? fails : [{ rule: 'rows', on: state.key, found: 'the model is owed a Model answer, or a file of it counts for nothing', items: (a.standing.ruleFails.get(state.key) ?? []).flatMap((f) => f.items ?? []) }] });
  }
  return sortedBy(out, (x) => x.model);
}

/**
 * A failing condition as the claim entry gives it (account.md §basis-line, presentation.md §reading JSON): its items, or for `conforming` the number
 * of rules the model fails; and, where no item supplies it, its reason, where account.md §basis-line gives one.
 */
function failEntry(f) {
  if (f.condition === 'conforming') return { condition: 'conforming', rules: f.rules ?? 0 };
  const items = f.items ?? [];
  return { condition: f.condition, items, ...(!items.length && f.reason ? { reason: f.reason } : {}) };
}

/**
 * A claim's entry (presentation.md §reading JSON). Each premise it rests on is named, marked carried or not; its statement, class,
 * falsifier and carry are shown once, under Assumed (account.md §basis-line).
 */
function claimEntry(a, s) {
  const c = s.claim;
  const named = (p) => ({ premise: p.name, carried: Boolean(p.counted) });
  const out = {
    ref: s.entry, name: c.name, sentence: c.sentence, kind: c.claimKind, stake: c.stake, standing: s.label,
    models: s.models.map((m) => ({
      model: m.model,
      standing: m.established ? 'established' : 'not established',
      fails: m.fails.map(failEntry),
      bounds: m.bounds,
      premises: m.premises.map(named),
      ...(m.basis ? { basis: m.basis } : {}),
    })),
  };
  if (s.cover) out.cover = s.cover;
  if (s.acceptance) {
    out.acceptance = s.acceptance;
    out.premises = restsOnPremises(a.project.restatement, c).map((name) => named({ name, ...(a.standing.carries.get(name) ?? { counted: false }) }));
  }
  return out;
}

/**
 * The premises a claim rests on, each once, as one thing's reading gives them (presentation.md §reading "For one thing"): those
 * its page names and those it rests on on each model covering its parts, each as a premise's entry, in name order.
 */
function claimPremises(a, s) {
  const names = sortedBy([...new Set([...restsOnPremises(a.project.restatement, s.claim), ...s.models.flatMap((m) => m.premises.map((p) => p.name))])]);
  const resting = restingOn(a);
  return names.map((name) => {
    const p = a.design.premises.find((x) => x.name === name);
    if (p) return premiseEntry(a, p, resting.get(name) ?? []);
    const line = premiseLine({ name, ...(a.standing.carries.get(name) ?? { counted: false }) }, a);
    return { premise: name, statement: line.statement, class: line.class, falsifier: line.falsifier, provider: line.provider, claims: resting.get(name) ?? [] };
  });
}

/** A surprise's entry (presentation.md §reading JSON): its journey as evidence.md renders it, with what it waits for. */
function surpriseEntry(a, s) {
  const rendered = renderSurprise(a.evidence.ctx, s);
  const items = a.items.filter((i) => i.on === s.name || (i.extra?.surprises ?? []).includes(s.name));
  return { surprise: s.name, question: s.question, journey: rendered, waits: sortedBy(items.map((i) => i.item), (x) => x).sort(itemCompare) };
}

/**
 * A premise's entry (presentation.md §reading JSON): `premise`, `statement`, `class`, `falsifier`, `claims`, and `carry`
 * (`decision`, `by`, `at`) or `pick` when one is in force; with its `provider`, which forms.md §premise-says shows in the
 * reading beside the other three.
 */
function premiseEntry(a, p, claims) {
  const says = premiseSays(p);
  const carry = a.standing.carries.get(p.name) ?? null;
  const out = { premise: p.name, statement: says.statement, class: says.class, falsifier: says.falsifier, provider: says.provider, claims };
  if (p.kind === 'choice') {
    const pick = a.design.picks.get(p.choice);
    const d = pick ? a.project.decisions.find((x) => x.name === pick.decision) : null;
    if (pick) out.pick = { decision: pick.decision, choice: pick.pick, by: d?.by ?? null, at: d?.at ?? null };
  } else if (carry?.carried && carry.by?.kind === 'carry') {
    out.carry = { decision: carry.by.name, by: carry.by.by, at: carry.by.at, ...(carry.basis ? { basis: carry.basis } : {}) };
  }
  return out;
}

/** A choice's entry (presentation.md §reading JSON). */
function choiceEntry(a, choice) {
  const pick = a.design.picks.get(choice.entry);
  const alt = (k) => {
    const x = choice.alternatives?.[k];
    return x ? { polarity: x.polarity, expectedEnd: x.expectedEnd, refusedStep: x.refusedStep ?? null, start: x.start ?? [], steps: x.steps ?? [], effects: x.effects ?? [] } : null;
  };
  // Its Recommendation as the field gives it (forms.md §choices): `a` or `b`, then `: ` and the reason.
  const r = choice.recommendation;
  const recommendation = r ? `${r.pick}: ${r.reason}` : null;
  const out = { ref: choice.entry, name: choice.name, question: choice.question, recommendation, alternatives: { a: alt('a'), b: alt('b') } };
  if (pick) {
    const d = a.project.decisions.find((x) => x.name === pick.decision);
    out.pick = { decision: pick.decision, choice: pick.pick, by: d?.by ?? null, at: d?.at ?? null };
  }
  return out;
}

/** A lifecycle's entry (presentation.md §reading JSON): its table, picture, facts, each phase classed and reached, and each journey's moves. */
function lifecycleEntry(a, l) {
  const facts = a.design.tool.findings.filter((f) => f.on === l.entry || (f.bearsOn ?? []).includes(l.entry));
  const reachedByJourney = new Set();
  for (const j of a.design.journeys.values()) {
    if (!j.confirmed) continue;
    for (const r of a.design.tool.stepped.get(j.name)?.reached ?? []) if (r.lifecycle === l.entry) reachedByJourney.add(r.phase);
  }
  // A phase is reached when a witness on the part's lifecycle model names it and its current evidence reached it (presentation.md §reading).
  const witnessed = new Set();
  for (const rec of a.evidence.questions) {
    if (rec.question.kind !== 'witness' || rec.question.model !== `lifecycles-${l.part}` || !rec.current || rec.evidence?.found?.outcome !== 'reached') continue;
    const target = rec.question.slots?.witness?.form?.target;
    for (const row of [...(target?.combination ?? []), ...(target?.transition ? [target.transition] : [])]) if (`${l.part}/lifecycles/${row.lifecycle}` === l.entry || row.lifecycle === l.key) witnessed.add(row.phase ?? row.to ?? row.from);
  }
  const conflict = (phase) => facts.some((f) => !['posed-cell', 'unchecked', 'empty-cell'].includes(f.code) && (f.concerns?.phase === phase || String(f.says).includes(`phase ${phase}`)));
  // A phase is `in conflict` where a conflict concerns it; otherwise `initial` for the initial phase, which needs no
  // journey to reach it; otherwise `covered by a confirmed journey` only where a confirmed journey reaches it; otherwise
  // `open` (presentation.md §reading).
  const classOf = (phase) => (conflict(phase) ? 'in conflict' : phase === l.initial?.phase ? 'initial' : reachedByJourney.has(phase) ? 'covered by a confirmed journey' : 'open');
  const phases = l.phases.map((phase) => ({ phase, class: classOf(phase), reached: witnessed.has(phase) }));
  // Each journey of the part stepped through the lifecycle, its moves lit (presentation.md §reading), with the tool's findings on it
  // (lifecycle-tool.md §findings): every journey whose stepping touches the lifecycle, or of the part with a finding.
  const touches = (s) => (s?.moves ?? []).some((m) => m.lifecycle === l.entry) || (s?.steps ?? []).some((x) => [...(x.refusedBy ?? []), ...(x.unknown ?? [])].some((u) => u.lifecycle === l.entry));
  const findingsOn = (j) => a.design.tool.findings.filter((f) => f.on === j.name).map((f) => ({ code: f.code, says: f.says }));
  const journeys = [...a.design.journeys.values()]
    .filter((j) => touches(a.design.tool.stepped.get(j.name)) || ((j.parts ?? []).includes(l.part) && findingsOn(j).length))
    .map((j) => ({ ref: j.name, moves: (a.design.tool.stepped.get(j.name)?.moves ?? []).filter((m) => m.lifecycle === l.entry), findings: findingsOn(j) }));
  const table = { phases: l.phases, actions: l.actions, cells: l.asRead ?? l.cells };
  return { ref: l.entry, name: l.name, table, picture: lifecyclePicture(l, [], {basis:pictureBasis(a.project,l)}), facts: facts.map((f) => ({ code: f.code, on: f.on, says: f.says })), phases, journeys: sortedBy(journeys, (x) => x.ref) };
}

/**
 * The premises of a part or span (presentation.md §reading "Assumed"): its premise pages, its store rows' premises, the strikes on
 * its world rows, its choices' premises, and its claims' bounds on each model.
 */
function premisesOfHolder(a, holder) {
  const out = [];
  for (const p of a.design.premises) {
    const m = /^(?:store|strike|choice):([^/]+)\//.exec(p.name) ?? /^([^/:]+)\/premises\//.exec(p.name) ?? /^bound:[^/]+\/([^/]+)\//.exec(p.name);
    const span = /^span:([^+]+)\+(.+)$/.exec(p.name);
    if ((m && m[1] === holder.key) || (span && !holder.span && [span[1], span[2]].includes(holder.key))) out.push(p);
  }
  return sortedBy(out, (p) => p.name);
}

/** The claims resting on each premise (presentation.md §reading), by premise name. */
function restingOn(a) {
  const out = new Map();
  const put = (p, c) => {
    if (!out.has(p)) out.set(p, new Set());
    out.get(p).add(c);
  };
  for (const s of a.standing.claims.values()) {
    for (const p of restsOnPremises(a.project.restatement, s.claim)) put(p, s.entry);
    for (const m of s.models) for (const p of m.premises) put(p.name, s.entry);
  }
  return new Map([...out].map(([k, v]) => [k, sortedBy([...v])]));
}

/** `entry` with a `type` the text reads and JSON leaves out (presentation.md §reading gives each entry's keys). */
const typed = (type, entry) => Object.defineProperty(entry, 'type', { value: type, enumerable: false });

/** One part's or span's reading under presentation.md §reading's headings (presentation.md §reading JSON `parts`). */
function holderReading(a, holder) {
  const { project, design, evidence, standing } = a;
  const r = project.restatement;
  const order = thingComparator(project, holder);
  const claims = [...standing.claims.values()].filter((s) => s.claim.holder.key === holder.key && Boolean(s.claim.holder.span) === holder.span).sort((x, y) => order(x.entry, y.entry));
  const journeys = [...design.journeys.values()].filter((j) => j.holder === holder.key && Boolean(j.span) === holder.span).sort((x, y) => order(x.name, y.name));
  const open = [];
  // The Open and Established lists hold entries of several kinds, each in its own keys (presentation.md §reading JSON); `type`, which the text uses to tell them apart, is not one of them, so it is kept out of the JSON.
  for (const s of claims.filter((x) => x.label === 'not established')) open.push(typed('claim', claimEntry(a, s)));
  // Only a confirmed journey is judged by the journey rules (account.md §journey-rules); one awaiting confirmation is read by its confirm: item.
  for (const j of journeys.filter((x) => x.confirmed)) {
    const models = journeyModels(a, j);
    if (!models.length || models.some((m) => !m.conforms)) open.push(typed('journey', { ref: j.name, name: j.heading ?? j.name, added: j.added, models }));
  }
  const readHere = (name) => {
    const s = evidence.surprises.find((x) => x.name === name);
    return s && readUnder({ item: `explain:${name}`, on: name }, a).holders.includes(holder.key);
  };
  for (const s of evidence.surprises.filter((x) => x.open && readHere(x.name))) open.push(typed('surprise', surpriseEntry(a, s)));
  const items = a.items.filter((i) => readUnder(i, a).holders.includes(holder.key));
  for (const i of items) open.push(typed('item', { ...i, ...lapsedChange(a, i) }));
  const accepted = claims.filter((s) => s.label === 'accepted').map((s) => claimEntry(a, s));
  const established = [
    ...claims.filter((s) => s.label === 'established').map((s) => typed('claim', claimEntry(a, s))),
    ...journeys.filter((j) => { const m = journeyModels(a, j); return j.confirmed && m.length && m.every((x) => x.conforms); }).map((j) => typed('journey', { ref: j.name, name: j.heading ?? j.name, added: j.added, models: journeyModels(a, j) })),
  ];
  const resting = restingOn(a);
  const assumed = premisesOfHolder(a, holder).map((p) => premiseEntry(a, p, resting.get(p.name) ?? []));
  const decided = inOrder(project.decisions.filter((d) => decisionHolder(a, d) === holder.key)).map((d) => decisionEntry(a, d)).filter((d) => d.state !== 'decides nothing');
  const record = (holder.span ? r.spans : r.parts).get(holder.key);
  const leftOut = (record?.omissions ?? []).map((o) => ({ passage: o.passage, reason: o.reason, confirmed: design.units.get(o.entry)?.state === 'confirmed' }));
  const lifecycles = holder.span ? [] : [...design.lifecycles.values()].filter((l) => l.part === holder.key).sort((x, y) => order(x.entry, y.entry)).map((l) => lifecycleEntry(a, l));
  return { ref: holder.key, name: holderName(project, holder), span: holder.span, open, accepted, established, assumed, decided, leftOut, lifecycles };
}

/**
 * The change since the lapsed decision an item's subject had (presentation.md §reading Open; presentation.md §showings): its name, `At`
 * and what changed, for a `confirm:` or `carry:` or `pick:` whose decision lapsed.
 */
function lapsedChange(a, item) {
  if (!['confirm', 'carry', 'pick', 'brief'].includes(kindOf(item.item)) || !['lapsed'].includes(item.why)) return {};
  const type = { confirm: 'unit', carry: 'premise', pick: 'choice' }[kindOf(item.item)];
  const lapsed = (kindOf(item.item) === 'brief' ? [a.briefs?.subjects.get(item.on)?.lapsed].filter(Boolean) : a.design.force.subjects.get(item.on, type)?.lapsed ?? []).slice().sort((x, y) => compare(x.at, y.at) || compare(x.name, y.name));
  const last = lapsed[lapsed.length - 1];
  return last ? { lapsed: { decision: last.name, at: last.at, path: last.path, change: a.lapseChanges?.get(item.item) ?? null } } : {};
}

/** Each model with its engine, parts and the journey rules it fails (account.md §journey-rules, presentation.md §reading). */
function modelsReading(a, filter = () => true) {
  return sortedBy([...a.evidence.models.values()].filter((m) => m.exists && m.model && filter(m)), (m) => m.key).map((m) => {
    const fails = (a.standing.ruleFails.get(m.key) ?? []).map((f) => ({ rule: f.rule, on: f.on, found: f.found, items: f.items ?? [] }));
    const own = a.items.filter((i) => readUnder(i, a).model === m.key);
    const open = a.evidence.surprises.filter((s) => s.open && s.model === m.key && readUnder({ item: `explain:${s.name}`, on: s.name }, a).model === m.key).map((s) => surpriseEntry(a, s));
    return { model: m.key, engine: m.engine, parts: m.model.parts, conforms: Boolean(a.evidence.rules.get(m.key)?.meets), fails, items: own, surprises: open };
  });
}

/** Whether `arg` names a part, span or thing (account.md §commands refusals): a folder under design/, or a journey code adds. Gives refusal reasons or null. */
export function refusedReading(a, arg) {
  if (arg === null || arg === undefined) return null;
  const r = a.project.restatement;
  const under = (prefix) => [...a.project.files.keys()].some((p) => p.startsWith(prefix)) || a.project.decisions.some((d) => `${d.folder}/`.startsWith(prefix)) || a.project.items.change.some((c) => c.path.startsWith(prefix));
  const m = THING.exec(arg);
  if (m) {
    const [, h, kind, key] = m;
    if (r.things.has(arg) || a.design.journeys.has(arg)) return null;
    if (under(`design/parts/${h}/${kind}/${key}/`) || under(`design/spans/${h}/${kind}/${key}/`)) return null;
    return [{ check: 'account.md §commands', file: null, entry: arg, field: null, says: `no ${kind.replace(/s$/, '')} ${arg}: no folder of it is under design/, and no journey code adds has that key` }];
  }
  if (!arg.includes('/')) {
    if (r.parts.get(arg)?.readme?.exists || r.spans.get(arg)?.readme?.exists || under(`design/parts/${arg}/`) || under(`design/spans/${arg}/`)) return null;
    return [{ check: 'account.md §commands', file: null, entry: arg, field: null, says: `no part or span ${arg}: no folder of it is under design/` }];
  }
  return [{ check: 'account.md §commands', file: null, entry: arg, field: null, says: `"${arg}" names no part, span or thing: a part or span by its key, a thing as <part or span>/<kind>/<key>` }];
}

/** The reading (presentation.md §reading) as data: the JSON `forma account --json` prints. */
export function readingOf(a, arg = null) {
  const { project } = a;
  const r = project.restatement;
  const holders = readingOrder(project);
  if (arg === null || arg === undefined) {
    const coverage = { passages: project.brief.passages.size, covered: [...project.brief.passages.keys()].filter((x) => a.design.coverage.covered.has(x)).length };
    const decided = inOrder(project.decisions.filter((d) => decisionHolder(a, d) === null)).map((d) => decisionEntry(a, d)).filter((d) => d.state !== 'decides nothing');
    const items = a.items.filter((i) => readUnder(i, a).project);
    return { scope: 'project', here: a.hereJson, models: modelsReading(a), project: { coverage, decided, items }, parts: holders.map((h) => holderReading(a, h)), cannotKnow: CANNOT_KNOW };
  }
  const m = THING.exec(arg);
  if (!m) {
    const holder = holders.find((h) => h.key === arg) ?? { key: arg, span: !r.parts.has(arg) && r.spans.has(arg) };
    const parts = holder.span ? (r.spanPairs.find((s) => s.name === arg)?.parts ?? []) : [arg];
    return { scope: arg, here: a.hereJson, models: modelsReading(a, (x) => parts.length && (x.engine === 'lifecycle' ? parts.length === 1 && x.part === parts[0] : covers(x.model, parts))), parts: [holderReading(a, holder)], cannotKnow: CANNOT_KNOW };
  }
  return { scope: arg, here: a.hereJson, thing: thingReading(a, arg), cannotKnow: CANNOT_KNOW };
}

/**
 * A journey code adds in the journey form without a heading (forms.md §journeys, design.md §code-journeys): its field table, `Origin` where it
 * has one (a pick's journeys have none) and `Cites`, its start table when it has a start, then its steps.
 */
function journeyForm(j) {
  const row = (cells) => `| ${cells.map((c) => String(c ?? '-').replaceAll('|', '\\|')).join(' | ')} |`;
  const table = (columns, rows) => [row(columns), row(columns.map(() => '---')), ...rows.map(row)].join('\n');
  const fields = [['Polarity', j.polarity], ['Expected end', j.expectedEnd], ['Refused step', j.refusedStep ?? '-'], ...(j.origin ? [['Origin', j.origin]] : []), ...(j.cites?.length ? [['Cites', j.cites.join(', ')]] : [])];
  const parts = [table(['Field', 'Value'], fields)];
  if (j.start?.length) parts.push(table(['Lifecycle', 'Entity', 'Phase'], j.start.map((r) => [r.lifecycle, r.entity, r.phase])));
  parts.push(table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], (j.steps ?? []).map((s) => [s.step, s.actor, s.action, s.arguments, s.entity ?? '-', s.case ?? '-'])));
  return `${parts.join('\n\n')}\n`;
}

/** One thing's reading (presentation.md §reading "For one thing"). */
function thingReading(a, name) {
  const { project, design, evidence, standing } = a;
  const r = project.restatement;
  const [, h, kind, key] = THING.exec(name);
  const thing = r.things.get(name) ?? null;
  const journey = design.journeys.get(name) ?? null;
  // `thing` holds its page, then its entry's own keys (presentation.md §reading JSON: "its entry below as a claim, journey,
  // lifecycle, premise or choice"), then `carries`, `evidence`, `items` and `decisions`; `entryKind`, which the text
  // reads, is kept out of the JSON.
  const out = {};
  // Its page as design.md reads it: the page's text as it stands, which counts (a page that counts for nothing is no thing);
  // for a journey code adds, which has no page file, the journey form without a heading (design.md §code-journeys).
  if (thing) out.page = { path: thing.page, text: project.files.get(thing.page)?.bytes?.toString('utf8') ?? null };
  else if (journey?.added) out.page = { path: null, added: journey.added, text: journeyForm(journey) };
  let entryKind = null;
  if (kind === 'claims' && standing.claims.has(name)) {
    Object.assign(out, claimEntry(a, standing.claims.get(name)));
    // One thing's reading has no Assumed, so each premise it rests on is given here, once, in full (presentation.md §reading); an
    // accepted claim's page-named premises, which the claim entry names under the same key, stay for its text.
    if (out.premises) Object.defineProperty(out, 'acceptedPremises', { value: out.premises, enumerable: false });
    out.premises = claimPremises(a, standing.claims.get(name));
    out.carries = [...standing.carries.entries()].filter(([, c]) => c.basis === name).map(([premise, c]) => ({ premise, decision: c.by?.name ?? null, counted: c.counted }));
    entryKind = 'claim';
  }
  if (kind === 'journeys' && journey) {
    Object.assign(out, { ref: name, name: journey.heading ?? name, added: journey.added, models: journeyModels(a, journey) });
    entryKind = 'journey';
  }
  if (kind === 'lifecycles' && design.lifecycles.has(name)) {
    Object.assign(out, lifecycleEntry(a, design.lifecycles.get(name)));
    entryKind = 'lifecycle';
  }
  if (kind === 'premises') {
    const p = design.premises.find((x) => x.name === name);
    if (p) {
      Object.assign(out, premiseEntry(a, p, restingOn(a).get(name) ?? []));
      entryKind = 'premise';
    }
  }
  if (kind === 'choices' && thing) {
    Object.assign(out, choiceEntry(a, thing));
    entryKind = 'choice';
    // Beside the choice, its premise (forms.md §choice-premises), which no key of the choice entry holds.
    const p = design.premises.find((x) => x.name === `choice:${h}/${key}`);
    if (p) out.premise = premiseEntry(a, p, restingOn(a).get(p.name) ?? []);
  }
  Object.defineProperty(out, 'entryKind', { value: entryKind, enumerable: false });
  // The evidence of each of its questions on each model, with its outcome and whether it is current.
  // Evidence kept for a question of it not asked now, as a journey's path while the tool cannot step it, is shown too,
  // not current (evidence.md §questions, §lifecycle-journeys, §currency): readEvidence's `kept`.
  const ofIt = (rec) => rec.question.serves === name || rec.question.claim?.entry === name || rec.question.journey?.entry === name;
  out.evidence = sortedBy([...evidence.questions, ...(evidence.kept ?? [])].filter(ofIt), (rec) => rec.question.name).map((rec) => ({ question: rec.question.name, model: rec.question.model, outcome: rec.evidence ? foundOf({ ...rec, current: true }) : 'none', current: rec.current }));
  // Every item about it.
  const prefix = `${name}`;
  out.items = a.items.filter((i) => i.on === name || String(i.on).includes(`/${kind}/${key}/`) || String(i.on).startsWith(`${prefix}/`) || (kind === 'choices' && i.on === name) || i.on === `choice:${h}/${key}`);
  // Every decision on it wherever it is filed (decisions.md §in-force): by kind and pin, by On, rulings on its surprises, and revocations.
  const pin = r.pins.entries.get(name)?.pin ?? journey?.pin ?? null;
  const unit = project.unitOf(name) ?? name;
  const unitPin = design.units.get(unit)?.pin ?? null;
  const own = project.decisions.filter((d) => {
    if (d.on === name || (d.on ?? '').split(', ').includes(name)) return true;
    if (pin && d.pin === pin) return true;
    if (unitPin && d.pin === unitPin && ['confirm', 'decline', 'redirect'].includes(d.kind)) return true;
    if (kind === 'claims' && d.kind === 'carry' && new RegExp(`^bound:[^/]+/${h}/${key}$`).test(d.on ?? '')) return true;
    if (d.kind === 'rule' && (d.surprises?.surprises ?? []).some((s) => new RegExp(`/${kind}/${key}/`).test(s.question))) return true;
    if (`${d.folder}/`.startsWith(`design/${journey?.span || r.spans.has(h) && !r.parts.has(h) ? 'spans' : 'parts'}/${h}/${kind}/${key}/`)) return true;
    return false;
  });
  // And every decision decisions.md §in-force counts on its subjects: the thing's unit, choice, premise or risk and the unit
  // holding it, among them a pick in force on the journeys it adds and a ruling on a journey it keeps.
  const records = [[name, 'unit'], [name, 'choice'], [name, 'premise'], [name, 'risk'], [unit, 'unit']].map(([n, type]) => design.force.subjects.get(n, type)).filter(Boolean);
  const counted = records.flatMap((rec) => [...(rec.on ?? []), ...(rec.lapsed ?? [])]);
  const revokers = project.decisions.filter((d) => d.kind === 'rule' && [...own, ...counted].some((x) => design.force.states.get(x.name)?.revokedBy === d.name || design.force.states.get(x.name)?.carryRevokedBy === d.name));
  const byName = new Map([...own, ...counted, ...revokers].map((d) => [d.name, d]));
  // On this thing, a ruling that keeps it or a pick that adds it, with a later decision in force on its unit at the same
  // pin, is superseded here (decisions.md §in-force "Superseded: a decision on a subject and pin with a later one on the same
  // subject and pin"), though it stays in force for its surprises or its choice.
  const supersededHere = new Map();
  for (const rec of records) for (const d of rec.on ?? []) if (rec.inForce && d.name !== rec.inForce.name && (d.kind === 'rule' || d.kind === 'pick') && rec.subject?.type === 'unit') supersededHere.set(d.name, rec.inForce.name);
  out.decisions = sortedBy([...byName.values()], (d) => [d.at, d.name]).map((d) => {
    const e = decisionEntry(a, d);
    if (e.state !== 'in force' || !supersededHere.has(d.name)) return e;
    const here = {};
    for (const [k, v] of Object.entries(e)) {
      if (k === 'supersededBy') continue;
      here[k] = v;
      if (k === 'state') Object.assign(here, { state: 'superseded', supersededBy: supersededHere.get(d.name) });
    }
    return here;
  });
  return out;
}

// --- Text ------------------------------------------------------------------------------------------------------------

const list = (items) => items.map((x) => `- ${x}`);

/** A failing condition as one line (account.md §basis-line): with the items that supply it, or its reason where none does. */
function failText(f) {
  if (f.condition === 'conforming') return `conforming fails: its model fails ${f.rules} rule${f.rules === 1 ? '' : 's'}, listed under Models`;
  if (f.items.length) return `${f.condition} fails: supplied by ${f.items.join(', ')}`;
  return `${f.condition} fails${f.reason ? `: ${f.reason}` : ''}`;
}

/**
 * A claim's lines (account.md §basis-line, presentation.md §reading): its standing on each model, with what fails, its bounds, each premise it rests
 * on there by its name, carried or not, its statement and carry being under Assumed, and its basis.
 */
function claimLines(c) {
  const lines = [`- ${c.name} (${c.ref}): ${c.standing}. ${tidy(c.sentence)}`];
  const carried = (p) => (p.carried ?? Boolean(p.carry || p.pick)) ? 'carried' : 'not carried';
  if (c.cover) lines.push(`  - no model covers its parts: ${c.cover}`);
  if (c.acceptance) {
    lines.push(`  - accepted and not examined: ${c.acceptance.words} (${c.acceptance.decision}, by ${c.acceptance.by}, ${c.acceptance.at})`);
    for (const p of c.acceptedPremises ?? c.premises ?? []) lines.push(`    - its page rests on ${p.premise}: ${carried(p)}`);
  }
  for (const m of c.models) {
    lines.push(`  - on ${m.model}: ${m.standing}`);
    for (const f of m.fails) lines.push(`    - ${failText(f)}`);
    lines.push(`    - bounds: ${m.bounds === 'phase level' ? 'phase level' : m.bounds.map((b) => `${b.bound} = ${b.value} (${b.meaning})`).join('; ') || 'none'}`);
    for (const p of m.premises) lines.push(`    - rests on ${p.premise}: ${carried(p)}`);
    if (m.basis) lines.push(...basisLines(m.basis).map((x) => `    ${x}`));
  }
  return lines;
}

/** A premise in full, as Assumed and one thing's reading show it, once (presentation.md §reading). */
function premiseText(a, x) {
  const counted = Boolean(a.standing.carries.get(x.premise)?.counted);
  const carry = x.pick ? `picked ${x.pick.choice} (${x.pick.decision}, ${x.pick.by}, ${x.pick.at})` : x.carry ? `carried by ${x.carry.decision}, ${x.carry.by}, ${x.carry.at}${x.carry.basis ? `, basis ${x.carry.basis}` : ''}${counted ? '' : ', not counted: its basis claim is not established without it'}` : 'not carried';
  return `- ${x.premise}: ${x.statement ?? '-'} (class: ${x.class ?? '-'}; falsifier: ${x.falsifier ?? '-'}; provider: ${x.provider ?? '-'}); rested on by ${x.claims.join(', ') || 'no claim'}; ${carry}`;
}

/** The basis line as text (account.md §basis-line): its premises by name, and the mechanisms repairs added to the model. */
function basisLines(b) {
  const lines = ['- basis:'];
  lines.push(`  - bounds: ${b.bounds === 'phase level' ? 'phase level' : b.bounds.map((x) => `${x.bound} = ${x.value}, ${x.meaning}`).join('; ')}`);
  for (const f of b.faults) lines.push(`  - fault ${f.question}, caught: removes ${f.mechanism}`);
  for (const w of b.witnesses) lines.push(`  - witness ${w.question}: ${w.meaning}`, ...w.journey.map((x) => `    - ${x}`));
  for (const p of b.premises) lines.push(`  - premise in force: ${p.premise}`);
  for (const m of b.mechanisms ?? []) lines.push(...mechanismLines(m, 1));
  for (const e of b.evidence) {
    const measures = Object.entries(e.measures ?? {}).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join('–') : v}`).join(', ');
    lines.push(`  - beneath ${e.question}: ${e.engine.name} ${e.engine.version}, ${e.runtime.name} ${e.runtime.version}${e.library ? `, ${e.library.name} ${e.library.version}` : ''}, Forma ${e.forma.version}; ${e.search}; bounds ${typeof e.bounds === 'string' ? e.bounds : Object.entries(e.bounds ?? {}).map(([k, v]) => `${k} = ${v}`).join(', ')}; limits ${e.limits.seconds} s${e.limits.megabytes !== undefined ? `, ${e.limits.megabytes} MB` : ''}; measures ${measures}; symmetry ${e.symmetry}${e.flags.length ? `; flags ${e.flags.map((f) => `${f.flag}${f.clearedBy.length ? ` cleared by ${f.clearedBy.join(', ')}` : ''}`).join('; ')}` : ''}`);
  }
  if (b.fairness) lines.push(`  - fairness: ${b.fairness.join(', ')}`);
  return lines;
}

/** One item's lines in the reading, with what changed since a lapsed decision. */
function itemLine(i) {
  const lines = [`- ${i.item}: ${i.supply.map((s) => (s.by === 'agent' ? `agent: ${s.answer}` : s.by === 'developer' ? `developer: ${s.decision}` : s.by)).join(', or ')}${i.why ? ` (${i.why})` : ''}${i.waits ? `; waits for ${i.waits.join(', ')}` : ''}`];
  if (i.found) lines.push(`  - found: ${i.found}`);
  if (i.lapsed) lines.push(`  - opened by the lapse of ${i.lapsed.decision} (${i.lapsed.at})${i.lapsed.change ? ':' : ''}`, ...(i.lapsed.change ?? []).map((x) => `    ${x}`));
  for (const [n, reasons] of (i.refused ?? []).entries()) lines.push(`  - refused here (${n + 1}): ${reasons.map((x) => x.says).join('; ')}`);
  return lines;
}

function surpriseLines(s) {
  const lines = [`- surprise ${s.surprise} on ${s.question}${s.waits.length ? `; waits for ${s.waits.join(', ')}` : ''}`];
  for (const t of s.journey.traces) lines.push(`  - ${t.of === s.surprise ? 'its trace' : `reduction ${t.of}`}: ${t.says} (${t.search}; ${t.bounds})`, ...t.lines.map((x) => `    - ${x}`));
  return lines;
}

function decisionLine(d) {
  return `- ${d.kind} ${d.on} (${d.decision}): ${d.state}${d.supersededBy ? `, superseded by ${d.supersededBy}` : ''}${d.revokedBy ? `, revoked by ${d.revokedBy}` : ''}; by ${d.by}, ${d.at}${d.rows?.Choice ? `; ${d.rows.Choice}` : ''}`;
}

function journeyLines(j) {
  const lines = [`- journey ${j.name} (${j.ref})${j.added ? `, added by code (${j.added})` : ''}`];
  if (!j.models.length) lines.push('  - no model covers its parts, so it conforms on none');
  for (const m of j.models) lines.push(`  - on ${m.model}: ${m.conforms ? 'conforms' : 'does not conform'}`, ...m.fails.map((f) => `    - ${f.rule}: found ${f.found}${f.items.length ? `; supplied by ${f.items.join(', ')}` : ''}`));
  return lines;
}

/** A part's or span's sections as text (presentation.md §reading): a level-3 heading for each heading that holds something. */
function holderText(a, p) {
  const lines = ['', `## ${p.name}${p.name !== p.ref ? ` (${p.ref})` : ''}`];
  const section = (title, body) => { if (body.length) lines.push('', `### ${title}`, '', ...body); };
  const openItems = p.open.filter((x) => x.type === 'item');
  const grouped = forTheDeveloper(openItems, a, a.settings);
  const devNames = new Set(grouped.flatMap((g) => g.groups.flatMap((x) => [...x.full, ...x.rest].map((i) => i.item))));
  const body = [
    ...p.open.filter((x) => x.type === 'claim').flatMap(claimLines),
    ...p.open.filter((x) => x.type === 'journey').flatMap(journeyLines),
    ...p.open.filter((x) => x.type === 'surprise').flatMap(surpriseLines),
    ...openItems.filter((i) => !devNames.has(i.item)).flatMap(itemLine),
  ];
  for (const g of grouped) {
    const all = g.groups.flatMap((x) => x.full);
    const rest = g.groups.flatMap((x) => x.rest);
    if (all.length || rest.length) body.push(`- waiting for the developer at ${g.checkpoint}:`, ...all.flatMap(itemLine).map((x) => `  ${x}`), ...(rest.length ? [`  - and ${rest.length} more: ${rest.map((i) => i.item).join(', ')}`] : []));
  }
  section('Open', body);
  section('Accepted', p.accepted.flatMap(claimLines));
  section('Established', [...p.established.filter((x) => x.type === 'claim').flatMap(claimLines), ...p.established.filter((x) => x.type === 'journey').flatMap(journeyLines)]);
  section('Assumed', p.assumed.map((x) => premiseText(a, x)));
  section('Decided', p.decided.map(decisionLine));
  section('Left out', p.leftOut.map((o) => `- ${o.passage}: ${o.reason} (${o.confirmed ? 'confirmed' : 'not confirmed'})`));
  section('Lifecycles', p.lifecycles.flatMap((l) => [
    `- ${l.name} (${l.ref})`,
    `  - Phase | ${l.table.actions.join(' | ')}`,
    ...l.table.phases.map((ph) => `  - ${ph} | ${l.table.actions.map((act) => cellText(l.table.cells?.[ph]?.[act])).join(' | ')}`),
    '  - picture:', ...pictureText(l.picture).split('\n').map(x=>`    ${x}`), '',
    ...l.facts.map((f) => `  - fact ${f.code} on ${f.on}: ${f.says}`),
    ...l.phases.map((ph) => `  - phase ${ph.phase}: ${ph.class}${ph.reached ? ', reached by a witness' : ''}`),
    ...l.journeys.flatMap((j) => [
      `  - ${j.ref} ${j.moves.length ? `moves ${j.moves.map((m) => `${m.from ?? '·'} → ${m.to} by ${m.action}${m.case ? ` (${m.case})` : ''} at step ${m.step}`).join('; ')}` : 'lights no move'}`,
      ...(j.findings ?? []).map((f) => `    - fact ${f.code} on ${j.ref}: ${f.says}`),
    ]),
  ]));
  return lines;
}

/** A cell as the reading writes it: its phase, None., (empty), the choice posing it, or each case. */
function cellText(o) {
  if (!o) return '(empty)';
  if (o.filledBy) return `choice ${String(o.filledBy).split('/').pop()}, picked ${o.pick}: ${cellText({ ...o, filledBy: undefined })}`;
  if (o.kind === 'phase') return o.phase;
  if (o.kind === 'refused') return 'None.';
  if (o.kind === 'empty') return '(empty)';
  if (o.kind === 'choice') return `choice ${o.choice}`;
  if (o.kind === 'cases') return o.cases.map((c) => `${c.case}: ${cellText(c.outcome)}`).join('; ');
  return String(o.kind);
}

/** The reading as Markdown (presentation.md §reading "Text"). */
export function readingText(a, reading) {
  const lines = [];
  const here = (h) => ['', '## On this machine', '', ...list([
    `answers: ${h.answers.left} left of ${h.answers.allowed} allowed, ${h.answers.spent} spent here`,
    `runs: ${h.runs.left} left of ${h.runs.allowed} allowed, ${h.runs.spent} spent here`,
    `tlc: ${h.engines.tlc.seconds} seconds and ${h.engines.tlc.megabytes} megabytes a run`,
    `alloy: ${h.engines.alloy.seconds} seconds and ${h.engines.alloy.megabytes} megabytes a run`,
    `lifecycle: ${h.engines.lifecycle.seconds} seconds a run`,
  ]), ...(h.allow ? itemLine({ ...h.allow, item: "allow (this machine's)" }) : [])];
  const models = (ms) => (ms.length ? ['', '## Models', '', ...ms.flatMap((m) => [
    `- ${m.model}: ${m.engine}, parts ${m.parts.join(', ')}; ${m.conforms ? 'meets the journey rules' : `fails ${m.fails.length} rule${m.fails.length === 1 ? '' : 's'}`}`,
    ...m.fails.map((f) => `  - ${f.rule} on ${f.on}: found ${f.found}${f.items.length ? `; supplied by ${f.items.join(', ')}` : ''}`),
    ...m.items.flatMap(itemLine).map((x) => `  ${x}`),
    ...m.surprises.flatMap(surpriseLines).map((x) => `  ${x}`),
  ])] : []);
  const cannot = ['', '## What it cannot know', '', ...list(reading.cannotKnow)];
  if (reading.scope === 'project') {
    lines.push('# The project', ...here(reading.here), ...models(reading.models));
    const pj = reading.project;
    lines.push('', '## The project', '', `- coverage: ${pj.coverage.covered} of ${pj.coverage.passages} passages covered`, ...pj.decided.map(decisionLine), ...pj.items.flatMap(itemLine));
    for (const p of reading.parts) lines.push(...holderText(a, p));
    lines.push(...cannot);
  } else if (reading.thing) {
    const t = reading.thing;
    lines.push(`# ${reading.scope}`, ...here(reading.here));
    lines.push('', '## Page', '', ...(t.page ? [t.page.path ? `- ${t.page.path}:` : `- a journey code adds (${t.page.added}), in the journey form, with no page file:`, '', '  ```markdown', ...(t.page.text ?? '').replace(/\n$/, '').split('\n').map((x) => `  ${x}`), '  ```'] : ['- no page: a removed thing, whose folder keeps its decisions']));
    const k = t.entryKind;
    const claimStanding = () => [...claimLines(t), ...(t.premises.length ? ['- the premises it rests on, each once:', ...t.premises.map((x) => `  ${premiseText(a, x)}`)] : [])];
    const standing = k === 'claim' ? claimStanding() : k === 'journey' ? journeyLines(t) : k === 'lifecycle' ? holderText(a, { ref: '', name: '', open: [], accepted: [], established: [], assumed: [], decided: [], leftOut: [], lifecycles: [t] }).slice(4) : k === 'choice' ? [`- ${t.name}: ${t.question}${t.pick ? `; picked ${t.pick.choice} (${t.pick.decision})` : '; not yet picked'}`] : [];
    if (standing.length) lines.push('', `## ${k === 'journey' ? 'Conformance' : 'Standing'}`, '', ...standing);
    const restedOn = k === 'premise' ? t.claims : k === 'choice' ? t.premise?.claims : null;
    const rests = [...(restedOn ? [`- rested on by ${restedOn.join(', ') || 'no claim'}`] : []), ...(t.carries ?? []).map((c) => `- the carry ${c.decision} of ${c.premise} names it as its basis${c.counted ? '' : ' (not counted)'}`)];
    if (rests.length) lines.push('', '## What rests on it', '', ...rests);
    if (t.evidence.length) lines.push('', '## Evidence', '', ...t.evidence.map((e) => `- ${e.question} on ${e.model}: ${e.outcome}, ${e.current ? 'current' : 'not current'}`));
    if (t.items.length) lines.push('', '## Items', '', ...t.items.flatMap(itemLine));
    if (t.decisions.length) lines.push('', '## Decisions', '', ...t.decisions.map(decisionLine));
    lines.push(...cannot);
  } else {
    const p = reading.parts[0];
    lines.push(`# ${p.name}`, ...here(reading.here), ...models(reading.models), ...holderText(a, p), ...cannot);
  }
  return `${lines.join('\n')}\n`;
}
