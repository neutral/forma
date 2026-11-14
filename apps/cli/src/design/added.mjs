// What code adds to the restatement: the premises (forms.md §code-premises) and the journeys (design.md §code-journeys).
// A journey code adds is no page, so no answer changes or removes one; it has the journey form
// without a heading, is stepped and judged like any journey, and is a unit of its own (design.md §units).

import { inOrder } from '../record/decisions.mjs';
import { MENU_NAMES } from '../record/models.mjs';
import { isPart, isSpan, journeyParts, resolveRef } from '../record/pages.mjs';
import { strikeFalsifier, tidy } from '../record/pins.mjs';

const other = (pick) => (pick === 'a' ? 'b' : 'a');

/**
 * A journey code adds, in the journey form (forms.md §journeys, design.md §code-journeys) with what readDesign gives every journey: its name
 * `<part or span>/journeys/<key>`, `holder` its part's or span's key, `span`, `from` (`{ key, span }`, where its bare
 * references are read), `folder`, the folder its page would have, under each model `models/<model>/<folder>` (design.md §paths, §code-journeys),
 * its parts (design.md §filing), each reference resolved (`refs`), and its canonical text and pin (design.md §pins).
 */
function codeJourney(restatement, { holder, key, added, goesWith, fields, ...extra }) {
  const from = { key: holder.key, span: holder.span };
  const name = `${holder.key}/journeys/${key}`;
  const journey = {
    name, entry: name, kind: 'journeys', key, holder: holder.key, span: holder.span, from, page: null, heading: null,
    folder: `${holder.span ? 'spans' : 'parts'}/${holder.key}/journeys/${key}`,
    polarity: fields.polarity, expectedEnd: fields.expectedEnd, refusedStep: fields.refusedStep ?? null,
    start: fields.start ?? [], steps: fields.steps ?? [], origin: fields.origin ?? null, cites: fields.cites ?? [],
    added, goesWith, ...extra,
  };
  journey.parts = journeyParts(restatement, journey, from);
  journey.refs = {
    Lifecycle: journey.start.map((row) => resolveRef(restatement, row.lifecycle, from, 'lifecycles')),
    Action: journey.steps.map((step) => resolveRef(restatement, step.action, from, 'actions')),
  };
  const { text, pin } = restatement.pins.journey(journey, from);
  return Object.assign(journey, { text, pin });
}

/** The part or span a key names, standing: `{ key, span }`, or null when neither stands (forms.md §front-pages). */
function standing(restatement, key) {
  if (isPart(restatement, key)) return { key, span: false };
  if (isSpan(restatement, key)) return { key, span: true };
  return null;
}

// --- A pick's journeys (design.md §code-journeys; decisions.md §pick) -----------------------------------------------------------

/** The step at which two alternatives of a choice differ (forms.md §choices), its number, or null when they do not differ at one step. */
function differAtOne(a, b) {
  if (!a || !b || a.polarity !== 'should happen' || b.polarity !== 'should happen') return null;
  if (a.expectedEnd !== b.expectedEnd || (a.refusedStep ?? null) !== (b.refusedStep ?? null)) return null;
  const rows = (alternative) => alternative.start.map((r) => `${r.lifecycle}\0${r.entity}\0${r.phase}`).sort();
  if (rows(a).join('\n') !== rows(b).join('\n')) return null;
  if (a.steps.length !== b.steps.length) return null;
  let at = null;
  for (const [k, x] of a.steps.entries()) {
    const y = b.steps[k];
    if (x.actor !== y.actor || x.arguments !== y.arguments || (x.entity ?? null) !== (y.entity ?? null)) return null;
    if (x.action === y.action && (x.case ?? null) === (y.case ?? null)) continue;
    if (at !== null) return null;
    at = k + 1;
  }
  return at;
}

/**
 * The journeys a pick in force adds (design.md §code-journeys): for each choice with a pick in force, `<choice>-<pick>`, the picked
 * alternative as written, and, when the alternatives differ at one step, `<choice>-not-<other>`, the other refused at
 * that step; both of the choice's part, citing its passages, with no Origin, going with the choice. `picks` is the pick
 * in force of each choice by entry name, `{ pick, decision }`.
 */
export function pickJourneys(restatement, picks) {
  const out = [];
  for (const choice of restatement.things.values()) {
    if (choice.kind !== 'choices' || !picks.has(choice.entry)) continue;
    const { pick, decision } = picks.get(choice.entry);
    const picked = choice.alternatives?.[pick];
    if (!picked) continue;
    const holder = { key: choice.holder.key, span: false };
    const base = { holder, added: 'pick', goesWith: choice.entry, choice: choice.entry, pick, decision: decision.name };
    out.push(codeJourney(restatement, { ...base, key: `${choice.key}-${pick}`, fields: { polarity: picked.polarity, expectedEnd: picked.expectedEnd, refusedStep: picked.refusedStep, start: picked.start, steps: picked.steps, cites: choice.cites } }));
    const unpicked = choice.alternatives?.[other(pick)];
    const step = differAtOne(picked, unpicked);
    if (step !== null) {
      out.push(codeJourney(restatement, { ...base, key: `${choice.key}-not-${other(pick)}`, refusedFrom: other(pick), fields: { polarity: 'must not', expectedEnd: '-', refusedStep: step, start: unpicked.start, steps: unpicked.steps, cites: choice.cites } }));
    }
  }
  return out;
}

// --- Kept journeys (design.md §code-journeys; decisions.md §kept-journeys) --------------------------------------------------------------

/**
 * The journeys `model wrong` rulings keep (design.md §code-journeys): for each surprise, from the ruling in force for that surprise
 * (decisions.md §in-force), the journey its `## Kept` holds, filed in the part or span its `Journey` names, going with that
 * part or span, with `keptPin`, the pin `## Kept` records, which confirms it while it is the journey's pin now (decisions.md §kept-journeys).
 * A declined one stays, declined, so it counts nowhere, its ruling kept (decisions.md §expects): it is added while its ruling
 * is in force for its surprise, whatever is in force on it, and readDesign gives it the state its decline makes.
 */
export function keptJourneys(restatement, force) {
  const out = [];
  for (const [surprise, ruling] of force.rulings) {
    const item = (ruling.kept ?? []).find((k) => k.surprise === surprise && k.journey);
    if (!item) continue;
    const m = /^([^/]+)\/journeys\/(kept-[0-9a-f]{12})$/.exec(item.journey.name);
    const holder = m ? standing(restatement, m[1]) : null;
    if (!holder) continue;
    const j = item.journey.journey;
    out.push(codeJourney(restatement, {
      holder, key: m[2], added: 'kept', goesWith: holder.key, surprise, ruling: ruling.name, keptPin: item.journey.pin,
      fields: { polarity: j.polarity, expectedEnd: j.expectedEnd, refusedStep: j.refusedStep, start: j.start, steps: j.steps, origin: j.origin, cites: j.cites },
    }));
  }
  return out;
}

// --- Offered journeys (design.md §code-journeys; decisions.md §confirm) ------------------------------------------------------------

const OFFERED = /^([^/]+)\/journeys\/(reach-(.+))$/;

/** An offered journey's key, `reach-<lifecycle>--<phase>` (design.md §code-journeys). */
const offeredKey = (lifecycleKey, phase) => `reach-${lifecycleKey}--${phase}`;

/** The lifecycle and phase an offered journey's key names, or null when the key holds no `--` (design.md §code-journeys). */
function reachOf(part, rest) {
  const at = rest.indexOf('--');
  return at > 0 && at + 2 < rest.length ? { lifecycle: `${part}/lifecycles/${rest.slice(0, at)}`, phase: rest.slice(at + 2) } : null;
}

/**
 * The offered journeys read from a confirmation (design.md §code-journeys; decisions.md §confirm): for each name `<part>/journeys/reach-…`
 * whose latest decision naming it in `On` is a confirmation, current or lapsed, the journey its `## Journey` holds, a
 * should-happen journey of that part going with the part, whatever the lifecycles now say.
 */
export function confirmedOffered(restatement, decisions) {
  const latest = new Map();
  for (const d of inOrder(decisions)) if (OFFERED.test(d.on ?? '')) latest.set(d.on, d);
  const out = [];
  for (const [name, d] of latest) {
    if (d.kind !== 'confirm' || !d.journey) continue;
    const [, part, key, rest] = OFFERED.exec(name);
    if (!isPart(restatement, part)) continue;
    const j = d.journey.journey;
    out.push(codeJourney(restatement, {
      holder: { key: part, span: false }, key, added: 'offered', goesWith: part, readFrom: d.name, reaches: reachOf(part, rest),
      fields: { polarity: j.polarity, expectedEnd: j.expectedEnd, refusedStep: j.refusedStep, start: j.start, steps: j.steps, origin: j.origin, cites: j.cites },
    }));
  }
  return out;
}

/**
 * The offered journeys generated afresh (design.md §code-journeys): for each lifecycle whose confirmation is in force and that the
 * tool could check, for each phase but its initial one that a shortest journey of its part reaches (lifecycle-tool.md §shortest) and that no
 * confirmed journey other than an offered one reaches (lifecycle-tool.md §stepping), that shortest journey as a should-happen journey of the
 * lifecycle's part, going with the lifecycle; none under a name `taken` holds, a confirmed offered journey's or a page's.
 * `shortest` gives each shortest journey's steps in the offered form by `'<lifecycle entry>--<phase>'`, and `reached`
 * holds `<lifecycle>\0<phase>` for each phase a confirmed journey other than an offered one reaches.
 */
export function generatedOffered(restatement, { lifecycles, shortest, reached, taken }) {
  const out = [];
  for (const lifecycle of lifecycles) {
    if (!lifecycle.confirmed || lifecycle.unchecked.length) continue;
    const from = { key: lifecycle.part, span: false };
    const entity = resolveRef(restatement, lifecycle.entity, from, 'boundary').entry;
    for (const phase of lifecycle.phases) {
      if (phase === lifecycle.initial.phase || reached.has(`${lifecycle.entry}\0${phase}`)) continue;
      const steps = shortest.get(`${lifecycle.entry}--${phase}`);
      const key = offeredKey(lifecycle.key, phase);
      if (!steps || taken.has(`${lifecycle.part}/journeys/${key}`)) continue;
      out.push(codeJourney(restatement, {
        holder: from, key, added: 'offered', goesWith: lifecycle.entry, reaches: { lifecycle: lifecycle.entry, phase },
        fields: { polarity: 'should happen', expectedEnd: `${entity?.names ?? lifecycle.entity} reaches ${phase}.`, refusedStep: null, start: [], steps: steps.map((s) => ({ ...s })), origin: 'added', cites: lifecycle.cites },
      }));
    }
  }
  return out;
}

// --- Premises code adds (forms.md §code-premises) ---------------------------------------------------------------------------

/** The words of the carry in force on a premise, a strike's among them (decisions.md §carry, §in-force), or null while none is. */
const carryWords = (carry) => (carry?.by?.kind === 'carry' && carry.by.rows?.Choice === 'carry' ? carry.by.words ?? null : null);

/**
 * A span premise's statement (forms.md §premise-says): each part's Purpose, in key order, joined by " and ", then each surface
 * row naming what the two share, as `<direction> <name>`, separated by ", ". A part that counts for nothing stands as
 * `missing <key>`, as in a pin (design.md §pins).
 */
function spanStatement(restatement, span) {
  const purposes = span.parts.map((part) => restatement.pins.purpose(part) ?? `missing ${part}`);
  const rows = span.parts.flatMap((part) => {
    const surface = restatement.parts.get(part)?.surface ?? [];
    const at = (row) => surface.findIndex((r) => r === row || (r.direction === row.direction && r.name === row.name));
    return [...(span.shared?.[part] ?? [])].sort((a, b) => at(a) - at(b)).map((row) => `${row.direction} ${row.name}`);
  });
  return `${purposes.join(' and ')} hold together over what they share: ${rows.join(', ')}.`;
}

/**
 * A claim's bounds' statement on a model (forms.md §premise-says): the claim's sentence, its last full stop left out, then
 * each bound in the model's order, or phase level on a lifecycle model.
 */
function boundStatement(restatement, p) {
  const sentence = tidy(restatement.things.get(p.claim)?.sentence ?? p.claim);
  if (p.bounds === 'phase level') return `Beyond phase level on ${p.model}: ${sentence}`;
  return `Beyond its bounds on ${p.model} (${(p.bounds ?? []).map((b) => `${b.bound} = ${b.value}`).join(', ')}): ${sentence}`;
}

/**
 * Every premise, page or code-added (forms.md §premises, §code-premises; decisions.md §carry), each `{ name, kind, class, statement,
 * falsifier, provider, pin, carry }`, `kind` one of `page`, `store`, `choice`, `strike`, `span`, `bound`, named as a
 * carry's `On` names it, and `carry` what decisions.md §in-force holds in force on it (`force.carried`); whether a carry with a
 * basis counts is account.md §standing's. Each premise code adds has the class, statement, falsifier and provider design.md
 * forms.md §premise-says's table gives it. `added` is the record's code premises (`project.premises`), `picks` each choice's pick in
 * force by entry name.
 */
export function premisesOf(restatement, added, force, picks) {
  const out = [];
  const pin = (name) => restatement.pins.entries.get(name)?.pin ?? null;
  for (const thing of restatement.things.values()) {
    if (thing.kind !== 'premises') continue;
    out.push({ name: thing.entry, kind: 'page', class: thing.class, statement: thing.statement, whyNotExamined: thing.whyNotExamined, falsifier: thing.falsifier, provider: thing.provider, pin: pin(thing.entry), carry: force.carried(thing.entry) });
  }
  for (const p of added.store ?? []) out.push({ name: p.name, kind: 'store', class: 'store phenomena', part: p.part, row: p.row, statement: p.statement, falsifier: p.falsifier, provider: p.provider, pin: p.pin, carry: force.carried(p.name) });
  for (const thing of restatement.things.values()) {
    if (thing.kind !== 'choices') continue;
    const name = `choice:${thing.holder.key}/${thing.key}`;
    const picked = picks.get(thing.entry)?.pick ?? null;
    const end = picked ? tidy(thing.alternatives?.[picked]?.expectedEnd ?? '-') : '-';
    const statement = picked ? `${tidy(thing.question)} Picked ${picked}.${end === '-' || end === '' ? '' : ` ${end}`}` : `${tidy(thing.question)} Not yet picked.`;
    out.push({ name, kind: 'choice', class: 'choice', choice: thing.entry, question: thing.question, pick: picked, statement, falsifier: 'a pick of the other alternative', provider: "the developer's pick", pin: pin(thing.entry), carry: force.carried(thing.entry) });
  }
  for (const p of added.strike ?? []) {
    const row = restatement.parts.get(p.part)?.boundary.find((r) => r.key === p.row);
    const item = MENU_NAMES[p.item] ?? p.item;
    const carry = force.carried(p.name);
    out.push({ name: p.name, kind: 'strike', class: 'world', part: p.part, row: p.row, item: p.item, statement: `${tidy(row?.names ?? p.row)} never does ${item}.`, falsifier: carryWords(carry) ?? strikeFalsifier(item, row?.names ?? p.row), provider: "the developer's strike", pin: p.pin, carry });
  }
  for (const p of added.span ?? []) {
    const carry = force.carried(p.name);
    out.push({ name: p.name, kind: 'span', class: 'span', span: p.span, statement: spanStatement(restatement, p.span), falsifier: carryWords(carry) ?? '-', provider: "the developer's carry", pin: p.pin, carry });
  }
  // A claim's bounds on every model covering its parts are a premise (decisions.md §carry: "the claim's bounds on a model
  // covering its parts"; engines.md §bounds; presentation.md §reading Assumed: "its claims' bounds on each model"), shown as forms.md §premise-says
  // says; the claim rests on them only where its encoding there is a property (account.md §standing), which `property` says.
  for (const p of added.boundAll ?? added.bound ?? []) {
    const carry = force.carried(p.name);
    out.push({ name: p.name, kind: 'bound', class: 'bound', model: p.model, claim: p.claim, bounds: p.bounds, property: p.property ?? true, statement: boundStatement(restatement, p), falsifier: carryWords(carry) ?? '-', provider: "the developer's carry", pin: p.pin, carry });
  }
  return out;
}
