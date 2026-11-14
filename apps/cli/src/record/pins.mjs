// Units, canonical texts, pins and entry names (design.md §units-and-pins), the premises code adds for store
// rows (forms.md §store-premises), and the pins of what a carry is on (decisions.md §carry).

import { sha256, sortedBy } from './json.mjs';
import { ANOMALIES, consumedEvent, isAdded, PERMITS, resolveRef } from './pages.mjs';

/** A value's whitespace collapsed as design.md §passages collapses a block: every run to one space, its ends trimmed. */
export const tidy = (value) => String(value ?? '').replace(/\p{White_Space}+/gu, ' ').replace(/^ | $/g, '');

/** Lines joined as a canonical text joins them: one line feed between, none after the last (design.md §pins). */
const joined = (lines) => lines.join('\n');

/** A pin: the SHA-256 of a canonical text in UTF-8 (design.md §pins). */
const pinOf = (text) => sha256(text);

/** A list's value in a canonical text: its items, once replaced, sorted in code-point order and joined by `, `; `none` the empty string (design.md §pins). */
const listValue = (items) => sortedBy(items).join(', ');

/**
 * The canonical texts and pins of a restatement (design.md §units-and-pins): `{ entries, units }` by name, and helpers to pin
 * what code adds, `journey(journey, from)` among them.
 */
export function pins(restatement, brief) {
  const citation = (address) => {
    const passage = brief.passages.get(address);
    return passage?.citable ? passage.hash : `missing ${address}`;
  };
  const cites = (list) => listValue((list ?? []).map(citation));
  const found = (written, from, kind) => resolveRef(restatement, written, from, kind).entry;

  /** An action as a reference names it: its Sentence, then ` (cases …)` and ` (guard …)` where it has them. */
  const actionText = (action) => `${tidy(action.sentence)}${action.cases.length ? ` (cases ${listValue(action.cases)})` : ''}${action.guard !== null ? ` (guard ${tidy(action.guard)})` : ''}`;
  /** A boundary row as a reference names it: its Names, then its Kind, Side, Seam and Isolation. */
  const rowText = (row) => `${tidy(row.names)} (${row.rowKind}, ${row.side}, ${row.seam ?? '-'}, ${row.isolation ?? '-'})`;
  // A part named by its key is replaced by its Purpose (design.md §pins), which only the part list holds (forms.md §part-list): it
  // names that while the part list counts and holds its row and the part stands, its folder holding a README.md; a part
  // not on the part list, or with no folder, is `missing <key>`.
  const purpose = (key) => {
    const row = restatement.partList?.rows.find((r) => r.key === key);
    return row && restatement.parts.get(key)?.readme?.exists ? tidy(row.purpose) : null;
  };
  const named = (written, from, kind, text) => {
    const entry = found(written, from, kind);
    return entry ? text(entry) : `missing ${written}`;
  };
  const canonicalAction = (written, from) => named(written, from, 'actions', actionText);
  const row = (written, from) => named(written, from, 'boundary', rowText);
  /** A lifecycle as a reference names it: by its entity's Names. */
  const lifecycleName = (written, from) => {
    const lifecycle = found(written, from, 'lifecycles');
    if (!lifecycle) return `missing ${written}`;
    const entity = found(lifecycle.entity, lifecycle.holder, 'boundary');
    return entity ? tidy(entity.names) : `missing ${lifecycle.entity}`;
  };
  const part = (key) => purpose(key) ?? `missing ${key}`;
  const outcome = (o, from) => {
    if (o.kind === 'phase') return o.phase;
    if (o.kind === 'refused') return 'None.';
    if (o.kind === 'empty') return '(empty)';
    if (o.kind === 'choice') return `choice ${named(o.choice, from, 'choices', (c) => tidy(c.question))}`;
    return sortedBy(o.cases.map((item) => `${item.case}: ${outcome(item.outcome, from)}`)).join('; ');
  };
  const field = (name, value) => `${name}: ${value}`;

  /** A claim's `Rests on` item as a canonical text replaces it (design.md §pins). */
  const canonicalRestsOn = (item, e) => {
    if (item.tag === 'store') return `store ${named(item.ref, e.holder, 'boundary', (r) => tidy(r.names))}`;
    if (item.tag === 'choice') return `choice ${named(item.ref, e.holder, 'choices', (c) => tidy(c.question))}`;
    const premise = found(item.ref, e.holder, 'premises');
    if (premise) return tidy(premise.statement);
    const target = found(item.ref, e.holder, 'boundary');
    return target ? rowText(target) : `missing ${item.ref}`;
  };

  /**
   * An entry's lines (design.md §pins), `action` and `restsOn` replacing an action and a `Rests on` item: the canonical
   * text's, or a showing's (presentation.md §showings), which differ in those alone.
   */
  const linesWith = ({ action, restsOn }) => {
    /** A journey's lines, or an alternative's (design.md §pins): its fields, its start rows sorted, its steps in order. */
    const journeyLines = (journey, from, { withCites = true } = {}) => [
      field('Polarity', tidy(journey.polarity)),
      field('Expected end', tidy(journey.expectedEnd)),
      field('Refused step', journey.refusedStep ?? '-'),
      ...(withCites ? [field('Cites', cites(journey.cites))] : []),
      ...sortedBy((journey.start ?? []).map((r) => `Start: ${lifecycleName(r.lifecycle, from)} | ${tidy(r.entity)} | ${tidy(r.phase)}`)),
      ...(journey.steps ?? []).map((s) => `Step ${s.step}: ${tidy(s.actor)} | ${action(s.action, from)} | ${tidy(s.arguments)} | ${s.entity === null ? '-' : tidy(s.entity)} | ${s.case ?? '-'}`),
    ];
    return { journeyLines, lines: entryLines({ action, restsOn, journeyLines }) };
  };

  const entryLines = ({ action, restsOn, journeyLines }) => ({
    actions: (e) => [field('Actor', row(e.actor, e.holder)), field('Sentence', tidy(e.sentence)), field('Cases', listValue(e.cases)), field('Guard', e.guard === null ? 'none' : tidy(e.guard)), field('Cites', cites(e.cites))],
    boundary: (e) => {
      const refs = (list) => (list === null ? '-' : listValue(list.map((r) => row(r, e.holder))));
      return [field('Names', tidy(e.names)), field('Kind', e.rowKind), field('Side', e.side), field('Seam', e.seam ?? '-'), field('Isolation', e.isolation ?? '-'), field('Reads', refs(e.reads)), field('Writes', refs(e.writes)), field('Cites', cites(e.cites))];
    },
    surface: (e) => {
      let name = e.name;
      if (['reads', 'writes', 'calls'].includes(e.direction)) name = row(e.name, e.holder);
      else if (e.direction === 'consumes') {
        // A consumed event names an event its part emits: its key when this part emits it, else <event> (<that part's
        // Purpose>); one that names nothing that counts is `missing <as written>` (design.md §pins).
        const event = consumedEvent(e.name, e.holder.key);
        const emitted = event && !(event.own && e.name.includes('/')) && (restatement.parts.get(event.part)?.surface ?? []).some((r) => r.direction === 'emits' && r.name === event.event);
        if (!emitted) name = `missing ${e.name}`;
        else name = event.own ? event.event : `${event.event} (${part(event.part)})`;
      }
      return [field('Direction', e.direction), field('Name', name), field('Cites', cites(e.cites))];
    },
    omissions: (e) => [field('Passage', citationOrMissing(e.passage)), field('Reason', tidy(e.reason))],
    lifecycles: (e) => [
      field('Entity', row(e.entity, e.holder)),
      field('Initial', e.initial.enteredBy === null ? tidy(e.initial.phase) : `${tidy(e.initial.phase)}, entered by ${action(e.initial.enteredBy, e.holder)}`),
      field('Ends', listValue(e.ends)),
      field('Unaffected', listValue(e.unaffected.map((a) => action(a, e.holder)))),
      field('Cites', cites(e.cites)),
      ...sortedBy(e.phases.flatMap((phase) => e.actions.map((a) => `Cell: ${phase} | ${action(a, e.holder)} | ${outcome(e.cells[phase][a], e.holder)}`))),
    ],
    journeys: (e) => journeyLines(e, e.holder),
    claims: (e) => [
      field('Sentence', tidy(e.sentence)),
      field('Kind', e.claimKind),
      field('Stake', tidy(e.stake)),
      field('Rests on', listValue(e.restsOn.map((item) => restsOn(item, e)))),
      field('Parts', listValue(e.parts.map(part))),
      field('Cites', cites(e.cites)),
    ],
    premises: (e) => [field('Statement', tidy(e.statement)), field('Class', e.class), field('Why not examined', tidy(e.whyNotExamined)), field('Falsifier', tidy(e.falsifier)), field('Provider', e.class === 'promise' ? part(e.provider) : tidy(e.provider)), field('Cites', cites(e.cites))],
    choices: (e) => [
      field('Question', tidy(e.question)),
      field('Recommendation', e.recommendation ? tidy(`${e.recommendation.pick}: ${e.recommendation.reason}`) : '-'),
      field('Cites', cites(e.cites)),
      ...['a', 'b'].flatMap((name) => {
        const alt = e.alternatives[name];
        if (!alt) return [];
        const effects = sortedBy((alt.effects ?? []).map((r) => `Effect: ${lifecycleName(r.lifecycle, e.holder)} | ${tidy(r.phase)} | ${action(r.action, e.holder)} | ${outcome(r.outcome, e.holder)}`));
        return [`Alternative ${name}`, ...journeyLines(alt, e.holder, { withCites: false }), ...effects];
      }),
    ],
  });
  const { journeyLines, lines } = linesWith({ action: canonicalAction, restsOn: canonicalRestsOn });

  /**
   * What a showing writes for an entry or a journey code adds (presentation.md §showings): its canonical text, but that an action,
   * which a field, a cell or a step names, is named by its key, or as `<part>/<action>` when it is another part's, and a
   * premise, which `Rests on` names, by its name: a premise page's entry name, `store:<part>/<row>` or
   * `choice:<part>/<choice>`. Gives `{ text, actions, premises }`: the lines, and the entry names of the actions and
   * the names of the premises it names, whose sentences, guards and statements the showing shows once.
   */
  const shownWith = (build) => {
    const actions = new Set();
    const premises = new Set();
    const action = (written, from) => {
      const ref = resolveRef(restatement, written, from, 'actions');
      if (!ref.entry) return `missing ${written}`;
      actions.add(ref.entry.entry);
      return from && !from.span && ref.part === from.key ? ref.key : `${ref.part}/${ref.key}`;
    };
    const restsOn = (item, e) => {
      if (item.tag === 'store' || item.tag === 'choice') {
        const ref = resolveRef(restatement, item.ref, e.holder, item.tag === 'store' ? 'boundary' : 'choices');
        if (!ref.entry) return `missing ${item.tag}:${item.ref}`;
        const name = `${item.tag}:${ref.part}/${ref.key}`;
        premises.add(name);
        return name;
      }
      const premise = found(item.ref, e.holder, 'premises');
      if (premise) {
        premises.add(premise.entry);
        return premise.entry;
      }
      return canonicalRestsOn(item, e);
    };
    const text = joined(build(linesWith({ action, restsOn })));
    return { text, actions: sortedBy([...actions]), premises: sortedBy([...premises]) };
  };
  // An omission names a passage, any passage, by its hash (design.md §pins).
  function citationOrMissing(address) {
    const passage = brief.passages.get(address);
    return passage ? passage.hash : `missing ${address}`;
  }

  const entries = new Map();
  for (const entry of restatement.entries.values()) {
    const text = joined(lines[entry.kind](entry));
    entries.set(entry.entry, { name: entry.entry, kind: entry.kind, text, pin: pinOf(text), entry });
  }

  const units = new Map();
  const unit = (name, kind, text, held) => units.set(name, { name, kind, text, pin: pinOf(text), entries: held });
  if (restatement.partList) {
    const rows = restatement.partList.rows.map((r) => joined([field('Purpose', tidy(r.purpose)), field('Cites', cites(r.cites))]));
    unit('parts', 'parts', joined(sortedBy(rows)), []);
  }
  for (const holder of [...restatement.parts.values(), ...restatement.spans.values()]) {
    const stated = [];
    const statedNames = [];
    const kinds = holder.span ? [['claims', [...holder.things.claims.values()]]] : [
      ['actions', holder.actions], ['claims', [...holder.things.claims.values()]], ['premises', [...holder.things.premises.values()]], ['boundary', holder.boundary], ['surface', holder.surface],
    ];
    for (const [kind, list] of kinds) {
      for (const item of list) {
        const pinned = entries.get(item.entry);
        if (!pinned) continue;
        if (isAdded(item)) unit(item.entry, kind, pinned.text, [item.entry]);
        else {
          stated.push(`${kind}\n${pinned.text}`);
          statedNames.push(item.entry);
        }
      }
    }
    if (stated.length) unit(`${holder.key}/stated`, 'stated', joined(sortedBy(stated)), sortedBy(statedNames));
    for (const kind of ['lifecycles', 'journeys']) {
      for (const thing of holder.things[kind]?.values() ?? []) unit(thing.entry, kind, entries.get(thing.entry).text, [thing.entry]);
    }
    for (const row of holder.omissions) unit(row.entry, 'omissions', entries.get(row.entry).text, [row.entry]);
  }

  return {
    entries,
    units,
    /** The canonical text and pin of a journey code adds, or one a decision keeps, read from the part or span `from` (design.md §code-journeys, §pins). */
    journey: (journey, from) => {
      const text = joined(journeyLines(journey, from));
      return { text, pin: pinOf(text) };
    },
    /** An entry as a showing writes it (presentation.md §showings): `{ text, actions, premises }`, or null for no entry. */
    shown: (name) => {
      const entry = restatement.entries.get(name);
      return entry ? shownWith((w) => w.lines[entry.kind](entry)) : null;
    },
    /** A journey code adds, or one a ruling would keep, as a showing writes it (presentation.md §showings), read from `from`. */
    shownJourney: (journey, from) => shownWith((w) => w.journeyLines(journey, from)),
    lifecycleName,
    actionText,
    rowText,
    citation,
    purpose,
  };
}

/** The unit that holds an entry (design.md §units): its own when it is added, a lifecycle, a journey or an omission; otherwise its part's or span's stated entries. */
export function unitOf(entry) {
  if (['lifecycles', 'journeys', 'omissions'].includes(entry.kind)) return entry.entry;
  if (entry.kind === 'choices') return null;
  return isAdded(entry) ? entry.entry : `${entry.holder.key}/stated`;
}

// --- Premises code adds, and the pins of what a carry is on (forms.md §store-premises; decisions.md §carry) -------------

/** A strike's pin (decisions.md §carry): the SHA-256 of `Strike: <item> at <the row's names>`, the item as forms.md §menu writes it in paths. */
export const strikePin = (item, rowNames) => pinOf(`Strike: ${item} at ${tidy(rowNames)}`);

/** The falsifier Forma pre-writes for a strike (decisions.md §carry), the item named as the menu names it. */
export const strikeFalsifier = (itemName, rowNames) => `an observed ${itemName} at ${tidy(rowNames)}`;

/**
 * The premise code adds for a store row (forms.md §store-premises), with its statement, falsifier, provider and pin
 * (decisions.md §carry).
 */
export function storePremise(part, row) {
  // An isolation is one of PERMITS' own keys (forms.md §store-premises); any other, `constructor` included, permits every anomaly, as unknown does.
  const permitted = typeof row.isolation === 'string' && Object.hasOwn(PERMITS, row.isolation) ? PERMITS[row.isolation] : ANOMALIES;
  const anomalies = ANOMALIES.filter((a) => permitted.includes(a));
  const statement = `${tidy(row.names)} permits exactly ${anomalies.length ? anomalies.join(', ') : 'no anomaly'} and prevents the rest.`;
  const falsifier = 'an observed prevented anomaly';
  const provider = "the store's documented and measured isolation";
  return { name: `store:${part}/${row.key}`, part, row: row.key, statement, falsifier, provider, pin: pinOf(joined([`Statement: ${statement}`, `Falsifier: ${falsifier}`, `Provider: ${provider}`])) };
}

/** A span's pin (decisions.md §carry): each part's purpose, then its surface rows naming what the two share. */
export function spanPin(span, pinned, purposeOf) {
  const lines = [];
  for (const part of span.parts) {
    lines.push(`Part: ${purposeOf(part) ?? `missing ${part}`}`);
    const surface = (span.shared[part] ?? []).map((row) => {
      const text = pinned.entries.get(row.entry)?.text ?? '';
      const name = /^Name: (.*)$/m.exec(text)?.[1] ?? row.name;
      return `Surface: ${row.direction} ${name}`;
    });
    lines.push(...sortedBy(surface));
  }
  return pinOf(joined(lines));
}

/** A claim's bounds' pin on a model (decisions.md §carry): the model, the claim's pin, then each bound, or phase level. */
export function boundPin(model, claimPin, bounds) {
  const rows = bounds === 'phase level' ? ['Bound: phase level'] : bounds.map((b) => `Bound: ${b.bound} | ${b.value} | ${b.meaning}`);
  return pinOf(joined([`Model: ${model}`, `Claim: ${claimPin}`, ...rows]));
}
