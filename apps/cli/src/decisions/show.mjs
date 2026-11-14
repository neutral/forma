// What Forma shows before each decision (presentation.md §showings to decisions.md §redirect) and `forma show` (decisions.md §forma-show): every
// showing, plain text in blocks, every reference replaced by what it names as design.md §pins's pins
// replace it; the change since a lapsed decision; the token; and what `forma show` refuses.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BRIEF_ON, briefPin, CADENCES, inOrder, LEVELS, SITUATIONS, statedAddresses, statedWordsReason, VERDICTS } from '../record/decisions.mjs';
import { basisDigest, sha256, sortedBy } from '../record/json.mjs';
import { MENU_NAMES } from '../record/models.mjs';
import { resolveRef } from '../record/pages.mjs';
import { tidy } from '../record/pins.mjs';
import { readDesign } from '../design/index.mjs';
import { pickJourneys, premisesOf } from '../design/added.mjs';
import { lifecyclePicture, pictureText, pictureBasis } from '../design/lifecycle-tool.mjs';
import { checkRedirect } from '../design/restate.mjs';
import { renderSurprise } from '../evidence/render.mjs';
import { foundText } from '../evidence/run.mjs';
import { accountOf } from '../account/index.mjs';
import { boundsOf, premiseSays } from '../account/standing.mjs';
import { keptOf } from './kept.mjs';

/** The kinds `forma show` and `forma decide` take (decisions.md §kinds), `brief` among them. */
const KINDS = ['intake', 'allow', 'confirm', 'decline', 'pick', 'rule', 'carry', 'accept', 'redirect', 'brief'];

/** A refusal reason in door.md §forma-answer's form. */
export const reason = (check, says, { file = null, entry = null, field = null } = {}) => ({ check, file, entry, field, says });

/** A reason as one line of text. */
const reasonText = (r) => `refused: ${r.says} (${r.check}${r.file ? `, ${r.file}` : ''}${r.entry ? `, ${r.entry}` : ''}${r.field ? `, ${r.field}` : ''})`;

/** The token (presentation.md §showings): the SHA-256 of the showing, a line feed, and the pin of each decision it would record, one per line. */
const tokenOf = (shown, pins) => sha256(`${shown}\n${pins.join('\n')}`);

/** Lines indented by two spaces, as every block's further lines are (presentation.md §showings). */
const indent = (lines) => lines.map((line) => `  ${line}`);

/** What each kind of entry is called in a block's first line (design.md §pins). */
const ENTRY_WORDS = { actions: 'action', boundary: 'boundary row', surface: 'surface row', lifecycles: 'lifecycle', journeys: 'journey', claims: 'claim', premises: 'premise', choices: 'choice', omissions: 'omission' };

/** The entry kinds whose form has an `Origin` row or column, just before `Cites` (forms.md §actions, §boundary, §lifecycles to §premises). */
const WITH_ORIGIN = new Set(['actions', 'boundary', 'lifecycles', 'journeys', 'claims', 'premises']);

/**
 * An entry's lines in a showing (presentation.md §showings): one line per field, `<Field>: <value>`, in the order of its form,
 * every reference replaced as design.md §pins's pins replace it, and each row of a table as one line, its cells
 * separated by ` | `. Built from its canonical text (design.md §pins), which holds every field but its key, `Origin`
 * and its heading, its references replaced: `Origin`, where its form has one, stands again before `Cites`; `Cites`
 * names its addresses, one that names no citable passage as `missing <address>`, as a pin writes it, each passage
 * then a block of its own; a start row, a step and an effect lose their `Start:`, `Step <n>:` and `Effect:` labels, a
 * step's number becoming its row's first cell. A lifecycle's cells stay as its pin holds them, its table and picture
 * following in blocks of their own.
 */
function formLines(text, { origin = null, cites = [], passages, passage = null }) {
  const out = [];
  for (const line of text.split('\n')) {
    let m;
    if (line.startsWith('Cites: ')) {
      if (origin) out.push(`Origin: ${origin}`);
      out.push(`Cites: ${sortedBy(cites).map((address) => (passages.get(address)?.citable ? address : `missing ${address}`)).join(', ')}`);
    } else if (line.startsWith('Passage: ') && passage) out.push(`Passage: ${passage}`);
    else if ((m = /^Step (\d+): (.*)$/.exec(line))) out.push(`${m[1]} | ${m[2]}`);
    else if ((m = /^(?:Start|Effect): (.*)$/.exec(line))) out.push(m[1]);
    else out.push(line);
  }
  return out;
}

/** The first line of the actions block and of the premises block (presentation.md §showings). */
const ACTIONS = 'Actions:';
const PREMISES = 'Premises:';

/**
 * A showing under construction (presentation.md §showings): the actions block and the premises block first, each action's
 * sentence and guard and each premise's statement shown once; then the blocks in order; then each passage once, a
 * passage cited again named by its address alone.
 */
class Showing {
  constructor(a, first) {
    this.a = a;
    this.first = first;
    this.blocks = [];
    this.cited = [];
    this.passagesShown = new Set();
    // The entry names of the actions the showing's entries name, and the names of the premises their Rests on name.
    this.actions = new Set();
    this.premises = new Set();
    // An action's or a premise's own block, by its name: its first line.
    this.own = new Map();
  }

  block(head, lines) {
    this.blocks.push([head, ...indent(lines)]);
  }

  /** A premise's own block (presentation.md §showings): a premise with a block of its own is not shown again in the premises block. */
  ownBlock(name, head, lines) {
    this.own.set(name, head);
    this.block(head, lines);
  }

  cite(addresses) {
    for (const address of addresses ?? []) if (!this.cited.includes(address)) this.cited.push(address);
  }

  /** What a block's lines name, as the pins' showing text gives them: its actions and its premises (presentation.md §showings). */
  names(shown) {
    for (const x of shown?.actions ?? []) this.actions.add(x);
    for (const x of shown?.premises ?? []) this.premises.add(x);
  }

  /** An action a block names by its key, from `from`, for the actions block (presentation.md §showings). */
  nameAction(written, from) {
    const ref = resolveRef(this.a.project.restatement, written, from, 'actions');
    if (ref.entry) this.actions.add(ref.entry.entry);
  }

  /**
   * An entry's block: its kind and name, then its form's lines (formLines), its citations by address, an action named
   * by its key and a premise in `Rests on` by its name, their sentences, guards and statements being in the actions and
   * premises blocks.
   */
  entry(name, { heading = null } = {}) {
    const r = this.a.project.restatement;
    const pinned = r.pins.entries.get(name);
    const entry = r.entries.get(name);
    if (!pinned) return;
    const shown = r.pins.shown(name);
    this.names(shown);
    const lines = formLines(shown.text, { origin: WITH_ORIGIN.has(pinned.kind) ? entry?.origin || null : null, cites: entry?.cites ?? [], passages: this.a.project.brief.passages, passage: entry?.passage ?? null });
    this.cite(entry?.cites);
    if (entry?.passage) this.cite([entry.passage]);
    const added = this.a.project.isAdded(name) ? ', an addition' : '';
    const head = `${ENTRY_WORDS[pinned.kind] ?? pinned.kind} ${name}${heading ?? entry?.name ? ` (${heading ?? entry.name})` : ''}${added}`;
    // An action's or a premise's page shown as an entry is its own block; a choice's entry is its choice premise's.
    if (pinned.kind === 'actions' || pinned.kind === 'premises') this.own.set(name, head);
    if (pinned.kind === 'choices' && entry) this.own.set(`choice:${entry.holder.key}/${entry.key}`, head);
    this.block(head, lines);
    if (pinned.kind === 'lifecycles') this.lifecycle(name);
  }

  /**
   * The actions block (presentation.md §showings): `Actions:`, then one line per action the showing's entries name, in the order
   * of entry names, `<part>/<action> | <Sentence> | <Cases> | <Guard>`, as its row of actions.md writes them.
   */
  actionsBlock() {
    const r = this.a.project.restatement;
    const names = sortedBy([...this.actions].filter((name) => !this.own.has(name)));
    return names.map((name) => {
      const action = r.entries.get(name);
      return action ? `${action.holder.key}/${action.key} | ${action.sentence} | ${action.cases.length ? action.cases.join(', ') : 'none'} | ${action.guard ?? 'none'}` : `${name} | missing ${name}`;
    });
  }

  /**
   * The premises block (presentation.md §showings): `Premises:`, then one line per premise the showing's entries' `Rests on` name
   * that has no block of its own, in the order of their names, `<name> | <statement>`: a premise page's Statement, and
   * for a premise code adds what the pins read it as, `store <the row's Names>` or `choice <the choice's Question>`.
   */
  premisesBlock() {
    const r = this.a.project.restatement;
    const names = sortedBy([...this.premises].filter((name) => !this.own.has(name)));
    return names.map((name) => {
      let m;
      if ((m = /^store:([^/]+)\/(.+)$/.exec(name))) {
        const row = r.parts.get(m[1])?.boundary.find((b) => b.key === m[2]);
        return `${name} | store ${row ? tidy(row.names) : `missing ${m[1]}/${m[2]}`}`;
      }
      if ((m = /^choice:([^/]+)\/(.+)$/.exec(name))) {
        const choice = r.things.get(`${m[1]}/choices/${m[2]}`);
        return `${name} | choice ${choice ? tidy(choice.question) : `missing ${m[1]}/${m[2]}`}`;
      }
      const premise = r.entries.get(name);
      return `${name} | ${premise ? tidy(premise.statement) : `missing ${name}`}`;
    });
  }

  /** A lifecycle's table as read and its picture (lifecycle-tool.md §as-read; presentation.md §showings): a cell a pick fills as `choice <key>, picked <a or b>: <outcome>`. */
  lifecycle(name) {
    const l = this.a.design.lifecycles.get(name);
    if (!l) return;
    const outcome = (o) => {
      if (!o) return '(empty)';
      if (o.filledBy) {
        const { filledBy, pick, posedBy, ...plain } = o;
        return `choice ${String(filledBy).split('/').pop()}, picked ${pick}: ${outcome(plain)}`;
      }
      if (o.kind === 'phase') return o.phase;
      if (o.kind === 'refused') return 'None.';
      if (o.kind === 'empty') return '(empty)';
      if (o.kind === 'choice') return `choice ${o.choice}`;
      if (o.kind === 'cases') return o.cases.map((c) => `${c.case}: ${outcome(c.outcome)}`).join('; ');
      return String(o.kind);
    };
    const read = l.asRead ?? l.cells;
    const table = [`Phase | ${l.actions.join(' | ')}`, ...l.phases.map((phase) => `${phase} | ${l.actions.map((act) => outcome(read?.[phase]?.[act])).join(' | ')}`)];
    this.block(`table of ${name}`, table);
    this.block(`picture of ${name}`, pictureText(lifecyclePicture(l, [], {basis:pictureBasis(this.a.project,l)})).split('\n'));
  }

  /**
   * A journey code adds, in its form (design.md §code-journeys; formLines): an offered or kept one with `Origin: added`, a pick's
   * with none; its steps name actions by key, their sentences and guards being in the actions block. `head` names the
   * block where it is not one of the journeys standing now, as one a pick would add (forms.md §thing-pages).
   */
  codeJourney(journey, head = null) {
    const r = this.a.project.restatement;
    const shown = r.pins.shownJourney(journey, journey.from ?? { key: journey.holder, span: Boolean(journey.span) });
    this.names(shown);
    const lines = formLines(shown.text, { origin: journey.origin ?? null, cites: journey.cites ?? [], passages: this.a.project.brief.passages });
    this.cite(journey.cites);
    this.block(head ?? `journey ${journey.name}, added by code (${journey.added})`, lines);
  }

  /**
   * The text (presentation.md §showings): the first line; the actions block, first when the entries name any; the premises block,
   * after it or first; the blocks; then each passage cited, once.
   */
  text() {
    const passages = [];
    for (const address of this.cited) {
      const p = this.a.project.brief.passages.get(address);
      if (this.passagesShown.has(address)) continue;
      this.passagesShown.add(address);
      passages.push([`Cites ${address}:`, ...indent(p ? p.canonical.split('\n') : [`no passage stands at ${address}`])]);
    }
    const heads = [];
    const actions = this.actionsBlock();
    if (actions.length) heads.push([ACTIONS, ...indent(actions)]);
    const premises = this.premisesBlock();
    if (premises.length) heads.push([PREMISES, ...indent(premises)]);
    return [this.first, ...heads.flat(), ...this.blocks.flat(), ...passages.flat()].join('\n');
  }
}

/** A showing's blocks (presentation.md §showings): each a first line at the margin and the lines indented under it; the first line of the showing left out. */
function blocksOf(text) {
  const out = [];
  for (const line of text.split('\n').slice(1)) {
    if (!line.startsWith('  ') || !out.length) out.push([line]);
    else out[out.length - 1].push(line);
  }
  return out;
}

/** The premise a block is the own block of, by its first line (presentation.md §showings): a premise page's entry, or a store premise's block; or null. */
function ownPremise(head) {
  const m = /^premise (\S+)/.exec(head) ?? /^store premise (\S+)/.exec(head);
  return m ? m[1] : null;
}

/** The names a block's `Rests on` line gives (presentation.md §showings), a premise by its name. */
function restsOnNames(block) {
  const line = block.find((x) => x.startsWith('  Rests on: '));
  return line ? line.slice('  Rests on: '.length).split(', ') : [];
}

/** The premises block's lines, `<name> | <statement>`, by name (presentation.md §showings). */
function premiseRows(blocks) {
  const block = blocks.find((b) => b[0] === PREMISES);
  return new Map((block ?? []).slice(1).map((line) => {
    const text = line.trim();
    const at = text.indexOf(' | ');
    return at < 0 ? [text, ''] : [text.slice(0, at), text.slice(at + 3)];
  }));
}

/**
 * The change since a lapsed decision (presentation.md §showings): that decision by name and `At`; each premise that reads
 * otherwise than its `## Shown` held it, once, as one change, its line of the premises block as `<name>: <as it read> →
 * <as it reads now>` or its own block with the lines lost and gained, and under it, by their first lines, the blocks
 * whose `Rests on` names it, in which its change does not show; each other block that reads otherwise, with the lines
 * lost and gained, the premises block among them only for a premise named now and not then, or then and not now; each
 * new block by its first line; each block gone, as it read; and the count of blocks that read as they did. So a premise
 * whose statement changed shows once, not under every claim resting on it. Lines to append, or none.
 */
function changeSince(lapsed, shown) {
  if (!lapsed?.shown) return [];
  const before = blocksOf(lapsed.shown);
  const now = blocksOf(shown);
  const byHead = (list) => new Map(list.map((b) => [b[0], b]));
  const was = byHead(before);
  const is = byHead(now);
  const lines = [`changed since ${lapsed.name}, made ${lapsed.at}, which lapsed (its showing stays whole in ${lapsed.path})`];
  const lostGained = (old, block) => [
    ...old.slice(1).filter((line) => !block.includes(line)).map((line) => `    lost: ${line.trim()}`),
    ...block.slice(1).filter((line) => !old.includes(line)).map((line) => `    gained: ${line.trim()}`),
  ];
  const namedBy = (name) => now.filter((b) => restsOnNames(b).includes(name)).map((b) => `    named by: ${b[0]}`);
  // Each premise that reads otherwise, once: its line of the premises block, or its own block.
  const rowsWas = premiseRows(before);
  const rowsIs = premiseRows(now);
  for (const [name, text] of rowsIs) {
    if (rowsWas.has(name) && rowsWas.get(name) !== text) lines.push(`  reads otherwise: ${name}: ${rowsWas.get(name)} → ${text}`, ...namedBy(name));
  }
  const shownAsPremise = new Set();
  for (const block of now) {
    const name = ownPremise(block[0]);
    const old = was.get(block[0]);
    if (!name || !old || old.join('\n') === block.join('\n')) continue;
    shownAsPremise.add(block[0]);
    lines.push(`  reads otherwise: ${block[0]}`, ...lostGained(old, block), ...namedBy(name));
  }
  // Each other block that reads otherwise; the premises block only for a premise named now and not then, or then and not now.
  let same = 0;
  const added = [];
  for (const block of now) {
    const old = was.get(block[0]);
    if (shownAsPremise.has(block[0])) continue;
    if (!old) { added.push(`  new: ${block[0]}`); continue; }
    if (old.join('\n') === block.join('\n')) { same += 1; continue; }
    if (block[0] === PREMISES) {
      const lost = [...rowsWas].filter(([name]) => !rowsIs.has(name)).map(([name, text]) => `    lost: ${name} | ${text}`);
      const gained = [...rowsIs].filter(([name]) => !rowsWas.has(name)).map(([name, text]) => `    gained: ${name} | ${text}`);
      if (lost.length || gained.length) lines.push(`  reads otherwise: ${PREMISES}`, ...lost, ...gained);
      continue;
    }
    lines.push(`  reads otherwise: ${block[0]}`, ...lostGained(old, block));
  }
  lines.push(...added);
  for (const block of before) if (!is.has(block[0])) lines.push('  gone:', ...block.map((line) => `    ${line}`));
  lines.push(`  ${same} block${same === 1 ? '' : 's'} read${same === 1 ? 's' : ''} as ${same === 1 ? 'it' : 'they'} did`);
  return lines;
}

/** The subject type each kind of decision is on (decisions.md §in-force). */
const SUBJECT_OF_KIND = { confirm: 'unit', decline: 'unit', redirect: 'unit', pick: 'choice', carry: 'premise', accept: 'risk' };

/** The latest lapsed decision on a subject (presentation.md §showings, decisions.md §in-force), from the force's record of it, by the subject's kind and name. */
function lapsedOf(design, name, kinds) {
  const list = inOrder((design.force.subjects.get(name, SUBJECT_OF_KIND[kinds[0]])?.lapsed ?? []).filter((d) => kinds.includes(d.kind)));
  return list[list.length - 1] ?? null;
}

/** The options lines each kind takes (decisions.md §forma-show, §forma-decide). */
function takesOf(kind, { choices = null } = {}) {
  const who = ['--by <name>', '--provider <name> --model <name> --session <id>, where standard input or output is not a terminal'];
  const allowance = ['--answers <n>', '--runs <n>', '--tlc-seconds <n>', '--tlc-megabytes <n>', '--alloy-seconds <n>', '--alloy-megabytes <n>', '--lifecycle-seconds <n>'];
  const settings = [`--cadence <${CADENCES.join(', ')}>`, '--inbox-cap <n>'];
  const shown = '--shown <token>';
  switch (kind) {
    case 'intake': return [`--situation <${SITUATIONS.join(', ')}>`, ...allowance, ...settings, '--words <what is out of scope and why>', ...who];
    case 'allow': return [...allowance, ...settings, ...who];
    case 'confirm': return [shown, ...who];
    case 'decline': return [shown, '--words <the reason>', ...who];
    case 'pick': return [shown, `--choice <${(choices ?? ['a', 'b']).join(' or ')}>`, ...who];
    case 'rule': return [shown, `--verdict <${VERDICTS.join(', ')}>`, `--level <${LEVELS.join(', ')}>`, '--target <brief, a model\'s key, premise:<premise> or choice:<part>/<choice>, for a real finding>', '--basis <a pointer to what it rests on outside Forma and one line of premise, or ->', '--words <the direction its repairs are given>', ...who];
    case 'carry': return [shown, '--choice <carry or withdraw>', '--basis <a claim, <part or span>/claims/<claim>, or ->', '--words <the falsifier, for a carry>', ...who];
    case 'accept': return [shown, '--choice <accept or withdraw>', '--words <why its risk is accepted without examination, for an acceptance>', ...who];
    case 'redirect': return [shown, '--words <the claim\'s new sentence> or --from <the file holding the new journey\'s page>', ...who];
    case 'brief': return [shown, '--choice <stated or accepted>', '--words <for stated, the address of each brief passage that states the mechanism, one a line, as forma show was given them; for accepted, why the difference is accepted>', ...who];
    default: return [];
  }
}

/** The units a lifecycle-model surprise's freeze holds from confirmation, decline and pick (decisions.md §forma-show; models.md §freeze). */
function lifecycleFreeze(a) {
  const parts = new Set(a.evidence.surprises.filter((s) => s.open && s.model.startsWith('lifecycles-')).map((s) => s.model.slice('lifecycles-'.length)));
  const lifecycles = [...a.design.lifecycles.values()].filter((l) => parts.has(l.part));
  const choices = new Set();
  for (const l of lifecycles) for (const c of choicesOf(a, l)) choices.add(c);
  return { lifecycles: new Set(lifecycles.map((l) => l.entry)), choices };
}

/** The findings that block confirming a unit (lifecycle-tool.md §findings): those bearing on it, `posed-cell` bearing on nothing. */
const blocking = (design, unit) => design.tool.findings.filter((f) => f.code !== 'posed-cell' && (f.bearsOn ?? []).includes(unit));

/** A lifecycle tool finding as compared with and without a pick: what it is on and what it says, its code among it. */
const findingKey = (f) => `${f.on}\0${f.says}`;

/**
 * Whether a pick of `choice` as `pick` is refused (decisions.md §pick): with it in force, a finding that is not there
 * without it blocks a journey it adds or a lifecycle whose cells it fills. Gives the findings.
 */
export function pickBlocked(a, choice, pick) {
  const thing = a.project.restatement.things.get(choice);
  const assume = { kind: 'pick', on: choice, pin: a.project.restatement.pins.entries.get(choice)?.pin ?? '', rows: { Choice: pick }, at: '9999-12-31T23:59:59.999Z', name: '99991231T235959Z-pick-assumed', words: null, shown: '', by: '-', session: null };
  if (!thing) return [];
  const after = readDesign(a.project, { assume: [assume] });
  const record = after.picks.get(choice);
  const bears = new Set([...(record?.journeys ?? []), ...(record?.fills ?? []).map((f) => f.lifecycle)]);
  const without = new Set(a.design.tool.findings.map(findingKey));
  return after.tool.findings.filter((f) => f.code !== 'posed-cell' && (f.bearsOn ?? []).some((u) => bears.has(u)) && !without.has(findingKey(f)));
}

/**
 * The showing of a decision and what it would record (presentation.md §showings to decisions.md §redirect): `{ refused }`, or `{ kind, on, shown,
 * takes, pins, records, token }`, `records` each decision it would record with `{ on, pin, shown, journey?, surprises?,
 * kept?, subject?, unit? }`. `a` is the account; `ons` the names given; `words`, `from` a redirect's. With `toDecide`
 * false, the refusals that bear only on making the decision now (the intake first, the freeze, a finding that blocks
 * confirming, the part list first) are not made, so a reading can show what a subject reads as (presentation.md §reading Open).
 */
export function showingOf(a, kind, ons, { words = null, fromText = null, toDecide = true } = {}) {
  const { project, design } = a;
  const r = project.restatement;
  const fail = (says, entry = null, check = 'decisions.md §forma-show') => ({ refused: [reason(check, says, { entry })] });
  if (!KINDS.includes(kind)) return fail(`"${kind}" is no kind of decision: one of ${KINDS.join(', ')}`);
  if (toDecide && kind !== 'intake' && !design.force.intake) return fail('no intake is in force, and the intake is made before any other decision', null, 'decisions.md §intake');
  const freeze = toDecide ? lifecycleFreeze(a) : { lifecycles: new Set(), choices: new Set() };

  if (kind === 'intake' || kind === 'allow') {
    if (ons.length && !(ons.length === 1 && ons[0] === kind)) return fail(`${kind === 'intake' ? 'an intake is on intake' : 'an allowance is on allow'}, and "${ons.join(', ')}" was given`);
    return { kind, on: kind, shown: `${kind} ${kind}`, takes: takesOf(kind), pins: [], records: [], token: null };
  }
  if (!ons.length) return fail(`a ${kind} names what it is on`);

  if (kind === 'confirm' || kind === 'decline') {
    if (ons.length > 1) return fail(`a ${kind} is on one unit`);
    const name = ons[0];
    const unit = design.units.get(name);
    if (!unit) return fail(`no unit ${name} stands (design.md §units)`, name);
    if (freeze.lifecycles.has(name)) return fail(`a surprise open on ${name.split('/')[0]}'s lifecycle model freezes its lifecycles, so ${name} is not ${kind === 'confirm' ? 'confirmed' : 'declined'} until it is ruled`, name, 'models.md §freeze');
    if (kind === 'confirm' && toDecide) {
      const found = blocking(design, name);
      if (found.length) return { refused: found.map((f) => reason('lifecycle-tool.md §findings', `${name} is not confirmed while the lifecycle tool finds, on ${f.on}, ${f.says}`, { entry: name })) };
      if (name !== 'parts' && design.units.get('parts')?.state !== 'confirmed') return fail('the part list has no confirmation in force, and the parts are confirmed first, then each part\'s entries', name, 'decisions.md §confirm');
    }
    const s = new Showing(a, `${kind} ${name}`);
    unitBlocks(s, a, unit);
    let shown = s.text();
    const lapsed = lapsedOf(design, name, ['confirm', 'decline', 'redirect']);
    if (lapsed) shown = [shown, ...changeSince(lapsed, shown)].join('\n');
    const journey = design.journeys.get(name);
    const record = { on: name, pin: unit.pin, shown, unit: name };
    if (kind === 'confirm' && journey?.added === 'offered') record.journey = { name, journey: { polarity: journey.polarity, expectedEnd: journey.expectedEnd, refusedStep: journey.refusedStep ?? '-', origin: journey.origin ?? 'added', cites: journey.cites, start: journey.start ?? [], steps: journey.steps } };
    return done(kind, name, shown, [record], takesOf(kind));
  }

  if (kind === 'pick') {
    if (ons.length > 1) return fail('a pick is on one choice');
    const name = ons[0];
    const choice = r.things.get(name);
    if (!choice || choice.kind !== 'choices') return fail(`no choice ${name} stands, and a pick is on a choice, <part>/choices/<choice>`, name);
    if (freeze.choices.has(name)) return fail(`a surprise open on ${choice.holder.key}'s lifecycle model freezes the lifecycles whose cells ${name} poses, so it is not picked until it is ruled`, name, 'models.md §freeze');
    const allowed = ['a', 'b'].filter((p) => !pickBlocked(a, name, p).length);
    if (!allowed.length) return { refused: ['a', 'b'].flatMap((p) => pickBlocked(a, name, p).map((f) => reason('decisions.md §pick', `with ${p} picked, the lifecycle tool would find, on ${f.on}, ${f.says}`, { entry: name }))) };
    const s = new Showing(a, `pick ${name}`);
    s.entry(name);
    for (const l of design.lifecycles.values()) if (choicesOf(a, l).has(name)) s.lifecycle(l.entry);
    if (choice.recommendation) s.block("the agent's recommendation, shown as one", [`${choice.recommendation.pick}: ${tidy(choice.recommendation.reason)}`]);
    // For each of a and b, the journeys a pick of it would add, each as a journey's block under its name: <choice>-<pick>
    // and, where the alternatives differ at one step, <choice>-not-<other>, so what each pick confirms is read first (decisions.md §pick).
    for (const p of ['a', 'b']) {
      for (const j of pickJourneys(r, new Map([[name, { pick: p, decision: { name: null } }]]))) s.codeJourney(j, `journey ${j.name}, which a pick of ${p} would add`);
    }
    let shown = s.text();
    const lapsed = lapsedOf(design, name, ['pick']);
    if (lapsed) shown = [shown, ...changeSince(lapsed, shown)].join('\n');
    return { ...done(kind, name, shown, [{ on: name, pin: r.pins.entries.get(name).pin, shown }], takesOf(kind, { choices: allowed })), allowed };
  }

  if (kind === 'accept') {
    if (ons.length > 1) return fail('an acceptance is on one claim');
    const name = ons[0];
    const claim = r.things.get(name);
    if (!claim || claim.kind !== 'claims') return fail(`no claim ${name} stands, and an acceptance is on a claim, <part or span>/claims/<claim>`, name, 'decisions.md §forma-decide');
    const s = new Showing(a, `accept ${name}`);
    s.entry(name);
    let shown = s.text();
    const lapsed = lapsedOf(design, name, ['accept']);
    if (lapsed) shown = [shown, ...changeSince(lapsed, shown)].join('\n');
    return done(kind, name, shown, [{ on: name, pin: r.pins.entries.get(name).pin, shown }], takesOf(kind));
  }

  if (kind === 'carry') return carryShowing(a, ons);
  if (kind === 'rule') return ruleShowing(a, ons);
  if (kind === 'brief') return briefShowing(a, ons, { words, toDecide });
  if (kind === 'redirect') {
    if (ons.length > 1) return fail('a redirect is on one claim or one new journey');
    const name = ons[0];
    const text = /\/claims\//.test(name) ? words : fromText;
    if (text === null || text === undefined) return fail(/\/claims\//.test(name) ? "a redirect of a claim's sentence is shown with its new sentence, --words" : "a redirect adding a journey is shown with its page, --from <file>", name, 'decisions.md §forma-show');
    const checked = checkRedirect(project, design, { on: name, words: text });
    if (checked.refused) return { refused: checked.refused };
    const s = new Showing(a, `redirect ${name}`);
    const unit = checked.design.units.get(checked.unit.name);
    // checkRedirect gives the design after the redirect: the unit is shown from that design's journeys for a new journey, and for a claim from its canonical text now with its Sentence line as the new words give it.
    const journey = checked.design.journeys.get(name);
    if (/\/journeys\//.test(name) && journey) {
      s.cite(journey.cites);
      const shownJourney = r.pins.shownJourney(journey, journey.from ?? { key: journey.holder, span: Boolean(journey.span) });
      s.names(shownJourney);
      s.block(`journey ${name} (${journey.heading ?? 'new'}), new`, formLines(shownJourney.text, { origin: journey.origin || null, cites: journey.cites ?? [], passages: project.brief.passages }));
    } else if (unit) {
      for (const entry of unit.entries ?? [unit.name]) {
        if (entry !== name) { s.entry(entry); continue; }
        const claim = r.things.get(entry);
        const shownClaim = r.pins.shown(entry);
        s.names(shownClaim);
        s.cite(claim?.cites);
        s.block(`claim ${entry} (${claim?.name ?? entry}), redirected`, formLines(shownClaim.text, { origin: claim?.origin || null, cites: claim?.cites ?? [], passages: project.brief.passages }).map((line) => (line.startsWith('Sentence: ') ? `Sentence: ${tidy(text)}` : line)));
      }
    }
    const shown = s.text();
    // `## Words` holds the claim's new sentence, or the new journey's page exactly as Forma writes it, its last line
    // feed included, followed in the fence by one line feed (decisions.md §decision-file, §redirect).
    const said = /\/claims\//.test(name) ? String(text).replace(/\n$/, '') : String(text);
    return { ...done(kind, name, shown, [{ on: name, pin: checked.unit.pin, shown, unit: checked.unit.name, words: said }], takesOf(kind)), writes: checked.writes };
  }
  return fail(`"${kind}" is no kind of decision`);
}

/** A showing's result with its token (presentation.md §showings, decisions.md §forma-show). */
function done(kind, on, shown, records, takes) {
  const pins = records.map((x) => x.pin);
  return { kind, on, shown, takes, pins, records, token: tokenOf(shown, pins) };
}

/** The blocks of a unit (design.md §units; decisions.md §confirm): each entry of it beside its passages, each lifecycle drawn. */
function unitBlocks(s, a, unit) {
  const r = a.project.restatement;
  if (unit.name === 'parts') {
    for (const row of r.partList?.rows ?? []) {
      s.cite(row.cites);
      s.block(`part ${row.key}`, [`Purpose: ${tidy(row.purpose)}`, `Cites: ${sortedBy(row.cites).join(', ')}`]);
    }
    return;
  }
  const journey = a.design.journeys.get(unit.name);
  if (journey?.added) { s.codeJourney(journey); return; }
  for (const name of unit.entries ?? [unit.name]) s.entry(name);
}

/**
 * A claim's bounds on a model covering its parts that no claim rests on yet, its encoding there not a property
 * (forms.md §premises, decisions.md §carry, account.md §standing): still a premise a carry is on, shown as forms.md §premise-says shows one.
 */
function boundPremise(a, name) {
  const p = (a.project.premises?.boundAll ?? []).find((x) => x.name === name);
  if (!p) return null;
  return premisesOf(a.project.restatement, { bound: [p] }, a.design.force, new Map()).find((x) => x.name === name) ?? null;
}

/** The showing of one or several carries (decisions.md §carry): each premise in the developer's terms, each passage and each model's bounds once. */
function carryShowing(a, ons) {
  const { project, design, standing } = a;
  const r = project.restatement;
  const names = [];
  for (const on of ons) {
    const m = /^bound:([^/]+)$/.exec(on);
    if (m) {
      const owed = a.items.filter((i) => i.item.startsWith(`carry:bound:${m[1]}/`)).map((i) => i.on);
      if (!owed.length) return { refused: [reason('decisions.md §carry', `no claim's bounds on ${m[1]} wait for a carry`, { entry: on })] };
      names.push(...owed);
    } else names.push(on);
  }
  const refused = [];
  const premises = [];
  for (const name of [...new Set(names)]) {
    if (name.startsWith('choice:')) { refused.push(reason('decisions.md §carry', `${name} is a choice premise, which its pick carries, and no carry is made of it`, { entry: name })); continue; }
    const premise = design.premises.find((p) => p.name === name) ?? boundPremise(a, name);
    if (!premise) { refused.push(reason('decisions.md §forma-show', `no premise ${name} stands, as decisions.md §carry names what a carry is on`, { entry: name })); continue; }
    premises.push(premise);
  }
  if (refused.length) return { refused };
  const show = (list, first) => {
    const s = new Showing(a, first);
    const boundsShown = new Set();
    for (const p of list) {
      const says = premiseSays(p, { project, design });
      const lines = [`Statement: ${says.statement ?? '-'}`, `Class: ${says.class ?? '-'}`, `Falsifier: ${says.falsifier ?? '-'}`, `Provider: ${says.provider ?? '-'}`];
      if (p.kind === 'page') { s.entry(p.name); continue; }
      if (p.kind === 'store') {
        s.ownBlock(p.name, `store premise ${p.name}`, lines);
        s.entry(`${p.part}/boundary/${p.row}`);
      } else if (p.kind === 'strike') {
        const row = r.parts.get(p.part)?.boundary.find((b) => b.key === p.row);
        s.block(`strike ${p.name}`, [`Row: ${tidy(row?.names ?? p.row)}`, `Item: ${MENU_NAMES[p.item] ?? p.item}`, `Falsifier Forma wrote: ${p.falsifier}`]);
        s.entry(`${p.part}/boundary/${p.row}`);
      } else if (p.kind === 'span') {
        const span = r.spanPairs.find((x) => `span:${x.name}` === p.name);
        s.block(`span ${p.name}`, [`Statement: ${says.statement}`, ...(span?.parts ?? []).flatMap((part) => [`Part: ${part}: ${r.pins.purpose(part) ?? `missing ${part}`}`, ...sortedBy((span.shared?.[part] ?? []).map((row) => `Surface: ${row.direction} ${row.name}`))])]);
      } else if (p.kind === 'bound') {
        const claim = r.things.get(p.claim);
        const state = a.evidence.models.get(p.model);
        const rows = state && claim ? boundsOf(state, { ...claim }) : p.bounds;
        const left = state?.engine === 'tlc' && claim?.claimKind === 'liveness' && (state.model.bounds ?? []).some((b) => b.bound === 'constraint') ? ['Left out: the constraint row, which does not bound a liveness claim'] : [];
        s.block(`bounds ${p.name}`, [`Statement: ${says.statement}`, `Model: ${p.model}`, `Claim: ${p.claim}`, ...(rows === 'phase level' ? ['Bound: phase level'] : rows.map((b) => `Bound: ${b.bound} | ${b.value} | ${b.meaning}`)), ...left]);
        if (!boundsShown.has(p.claim)) { boundsShown.add(p.claim); s.entry(p.claim); }
      }
    }
    return s.text();
  };
  const sorted = sortedBy(premises, (p) => p.name);
  const records = sorted.map((p) => {
    let shown = show([p], `carry ${p.name}`);
    const lapsed = lapsedOf(design, p.name, ['carry']);
    if (lapsed) shown = [shown, ...changeSince(lapsed, shown)].join('\n');
    return { on: p.name, pin: p.pin, shown, premise: p };
  });
  const on = sorted.map((p) => p.name);
  const shown = sorted.length === 1 ? records[0].shown : show(sorted, `carry ${on.join(', ')}`);
  return done('carry', on.length === 1 ? on[0] : on, shown, records, takesOf('carry'));
}

/** The parts of what a surprise's question serves (decisions.md §rulings `## Surprises`). */
function partsServed(a, surprise) {
  const r = a.project.restatement;
  const where = surprise.where;
  if (where?.thing) {
    const name = `${where.holder.key}/${where.thing.kind}/${where.thing.key}`;
    return r.thingParts.get(name) ?? a.design.journeys.get(name)?.parts ?? [where.holder.key];
  }
  if (where?.part) return [where.part];
  return a.evidence.models.get(surprise.model)?.model?.parts ?? [];
}

/** What each verdict sends (decisions.md §rulings), for the ruling's showing. */
function sendsOf(a, surprises) {
  const models = sortedBy([...new Set(surprises.map((s) => s.model))]);
  const claims = sortedBy([...new Set(surprises.filter((s) => s.where?.thing?.kind === 'claims').map((s) => `${s.where.holder.key}/claims/${s.where.thing.key}`))]);
  const parts = sortedBy([...new Set(surprises.flatMap((s) => partsServed(a, s)))]);
  return [
    ['model wrong', `a Repair of each model the surprises ran on, ${models.join(', ')}, naming the mechanism it adds, keeping traces as journeys (below)`],
    ['property wrong', claims.length ? `a repair of each claim the surprises are on, ${claims.join(', ')}: its page restated, or its encoding on ${models.join(', ')} refilled by a Repair answer` : 'nothing: none of the surprises is on a claim, so property wrong is refused'],
    ['abstraction too coarse', `a Restate repair of the parts ${parts.join(', ')}`],
    ['real finding', 'on brief, nothing to an agent: the developer edits the brief; on a model, a Repair of that model naming the mechanism it adds, and once that repair is met, a brief decision of the developer\'s: that the brief states the mechanism, or that the difference is accepted; on a premise, the revocation of its carry, or of the pick\'s carry for a choice premise'],
  ];
}

/** The showing of a ruling (decisions.md §rulings, §kept-journeys): each surprise as a journey, then each verdict with what it sends, and what model wrong keeps. */
function ruleShowing(a, ons) {
  const names = sortedBy([...new Set(ons)]);
  const refused = [];
  const groups = [];
  for (const name of names) {
    const w = a.waiting.find((x) => x.name === name);
    if (!w) refused.push(reason('decisions.md §rulings', `${name} is no waiting decision: a waiting decision is named by the smallest of its open surprises' names`, { entry: name }));
    else if (!w.offered) refused.push(reason('decisions.md §rulings', `${name} is not yet offered: ${[...w.unexplained.map((s) => `${s} has no accepted explanation`), ...w.reducing.map((s) => `${s} has a reduction still to run`)].join('; ')}`, { entry: name }));
    else groups.push(w);
  }
  if (refused.length) return { refused };
  const surprises = sortedBy(groups.flatMap((w) => w.surprises)).map((n) => a.evidence.surprises.find((s) => s.name === n));
  const s = new Showing(a, `rule ${names.join(', ')}`);
  const ctx = a.evidence.ctx;
  const kept = [];
  for (const surprise of surprises) {
    const shown = renderSurprise(ctx, surprise);
    const lines = [`Question: ${surprise.question}`, `Expected: ${expectedText(surprise.value.expected)}`, `Found: ${foundText(surprise.value.found)}`];
    const slot = askedSlot(a, surprise);
    // A misbehaviour witness asks its Target under its world row, by the row's names, and its item, as the menu names it (decisions.md §rulings).
    if (slot?.kind === 'misbehaviour') {
      const row = a.project.restatement.parts.get(slot.part)?.boundary.find((b) => b.key === slot.row);
      lines.push(`World row: ${row ? tidy(row.names) : `missing ${slot.part}/${slot.row}`}`, `Item: ${MENU_NAMES[slot.item] ?? slot.item}`);
    }
    for (const t of shown.traces) {
      lines.push(`${t.of === surprise.name ? 'its trace' : `the reduction ${t.of}`}: ${t.says}`, `  search: ${t.search}; bounds: ${t.bounds}`, ...t.lines.map((x) => `  ${x}`));
      for (const p of t.pictures) lines.push(`  lit on ${p.lifecycle}:`, ...pictureText(p.picture).split('\n').map((x) => `    ${x}`));
    }
    for (const w of shown.weaker) lines.push(`weaker form ${w.key}: ${w.says}`);
    if (shown.weakest) lines.push(`the weakest that fails: ${typeof shown.weakest === 'string' ? shown.weakest : shown.weakest.key ?? JSON.stringify(shown.weakest)}`);
    if (shown.explanation) {
      const file = a.project.files.get(shown.explanation.path);
      lines.push(`the accepted explanation, ${shown.explanation.path}: recommends ${shown.explanation.verdict} at ${shown.explanation.level}`, ...(file ? file.bytes.toString('utf8').replace(/\n$/, '').split('\n').map((x) => `  ${x}`) : []));
    }
    if (surprise.sentBack.length) lines.push(...surprise.sentBack.map((x) => `sent back first: ${x}`));
    s.block(`surprise ${surprise.name}`, lines);
    if (slot) slotBlock(s, a, surprise, slot.path);
    kept.push({ surprise: surprise.name, ...keptOf(a, surprise) });
  }
  for (const [verdict, sends] of sendsOf(a, surprises)) s.block(`verdict ${verdict}`, [`Sends: ${sends}`]);
  for (const k of kept) {
    if (k.journey) {
      // Its steps name actions by key, their sentences and guards being in the actions block (presentation.md §showings).
      const holder = k.journey.name.split('/')[0];
      const from = { key: holder, span: !a.project.restatement.parts.get(holder)?.readme?.exists && Boolean(a.project.restatement.spans.get(holder)?.readme?.exists) };
      for (const step of k.journey.journey.steps ?? []) s.nameAction(step.action, from);
      s.block(`model wrong keeps ${k.journey.name} of ${k.surprise}`, [`Pin: ${k.journey.pin}`, ...keptLines(k.journey.journey)]);
    } else s.block(`model wrong keeps no journey of ${k.surprise}`, [`Why: ${k.notKept}`]);
  }
  const shown = s.text();
  const surprisesTable = {
    surprises: surprises.map((x) => ({ surprise: x.name, question: x.question, basis: basisDigestOf(x), parts: partsServed(a, x).join(', '), expected: expectedText(x.value.expected), found: foundText(x.value.found) })),
    entries: surprises.flatMap((x) => (x.value.basis.entries ?? []).map((e) => ({ surprise: x.name, entry: e.entry, pin: e.pin }))),
  };
  const pin = sha256(`${shown}\n`);
  const record = { on: names.join(', '), pin, shown, surprises: surprisesTable, kept, subject: surprises[0], ruled: surprises };
  return done('rule', names.length === 1 ? names[0] : names, shown, [record], takesOf('rule'));
}

/**
 * The slot a surprise's question asks, for a witness, misbehaviour or path question (decisions.md §rulings): `{ kind, path }`,
 * with a misbehaviour's `part`, `row` and `item`; or null. The path is the slot file's from the project folder.
 */
function askedSlot(a, surprise) {
  const w = surprise.where;
  const q = w?.question;
  if (!q) return null;
  const top = `models/${surprise.model}`;
  const thing = (kind) => `${top}/${w.holder.span ? 'spans' : 'parts'}/${w.holder.key}/${kind}/${w.thing.key}`;
  if (q.kind === 'witness' && w.thing) return { kind: 'witness', path: `${thing('claims')}/witness-${q.key}.md` };
  if (q.kind === 'path' && w.thing) return { kind: 'path', path: `${thing('journeys')}/schedule.md` };
  if (q.kind === 'misbehaviour' && w.part && w.row) {
    const stem = `${top}/world/${w.part}/${w.row}/${q.item}.`;
    const ran = (surprise.value?.basis?.files ?? []).find((f) => typeof f.path === 'string' && f.path.startsWith(stem) && /^(tla|als)$/.test(f.path.slice(stem.length)));
    const engine = a.evidence.models.get(surprise.model)?.engine;
    return { kind: 'misbehaviour', part: w.part, row: w.row, item: q.item, path: ran?.path ?? `${stem}${engine === 'alloy' ? 'als' : 'tla'}` };
  }
  return null;
}

/**
 * A slot block (presentation.md §showings, decisions.md §rulings): `Slot <path>:`, then the text of its file, so what was asked is read in the
 * developer's terms, a witness with its Meaning and Target, a schedule with its End and that end's Meaning; its first
 * line followed by ` (changed since the run)` where the file's SHA-256 is not the one the surprise's basis names, and
 * by ` (gone)`, with no text, where there is no file.
 */
function slotBlock(s, a, surprise, path) {
  const file = a.project.files.get(path);
  if (!file) {
    s.block(`Slot ${path}: (gone)`, []);
    return;
  }
  const ran = (surprise.value?.basis?.files ?? []).find((f) => f.path === path)?.sha256 ?? null;
  const text = file.bytes.toString('utf8').replace(/\n$/, '');
  s.block(`Slot ${path}:${file.sha256 === ran ? '' : ' (changed since the run)'}`, text.split('\n'));
}

/**
 * Why `on` is no real finding's met repair on a model by a ruling in force (decisions.md §rulings, §forma-show), for a refusal.
 */
function noBriefReason(a, on) {
  const m = BRIEF_ON.exec(on);
  if (!m) return `${on} names no real finding's met repair on a model: a brief decision is on <ruling>/<model>, the ruling by its name and the model it targets`;
  const [, name, model] = m;
  const ruling = a.project.decisions.find((d) => d.name === name);
  if (!ruling || ruling.kind !== 'rule') return `no ruling ${name} stands`;
  if (![...a.design.force.rulings.values()].some((r) => r.name === name)) return `the ruling ${name} is in force for none of its surprises, each of which a later ruling names`;
  if (ruling.rows.Verdict !== 'real finding' || ruling.rows.Target !== model) return `the ruling ${name} is ${ruling.rows.Verdict}${ruling.rows.Verdict === 'real finding' ? ` on ${ruling.rows.Target}` : ''}, no real finding on ${model}`;
  return `the repair the ruling ${name} sends to ${model} is not yet met: no receipt line a Repair answer for it wrote under ${model} names it with its mechanism, so there is no mechanism to name`;
}

/**
 * The showing of a `brief` decision (decisions.md §rulings, §forma-show): the ruling by its name, with its verdict, level and target
 * and each of its surprises by name, question, and what was expected and what was found, as its `## Surprises` records
 * them; the mechanism; each passage cited by an entry its `## Surprises` names, as the restatement reads now; and, with
 * `words`, the addresses a stated decision will name, each passage they name; each passage as a passage block. Without
 * words it is the showing an accepted one pins. Refused for an `<on>` that is no real finding's met repair on a model by
 * a ruling in force, or words naming an address that is no citable passage.
 */
function briefShowing(a, ons, { words = null, toDecide = true } = {}) {
  const { project, design } = a;
  const r = project.restatement;
  const passages = project.brief.passages;
  const refuse = (says, entry = null) => ({ refused: [reason('decisions.md §forma-show', says, { entry })] });
  if (ons.length !== 1) return refuse("a brief decision is on one real finding's met repair on a model, <ruling>/<model>");
  const name = ons[0];
  const subject = a.briefs?.subjects.get(name);
  if (!subject) return refuse(noBriefReason(a, name), name);
  const stated = words !== null && words !== undefined;
  if (stated) {
    const why = statedWordsReason(words);
    if (why) return { refused: [reason('decisions.md §rulings', why, { entry: name, field: 'Words' })] };
    if (toDecide) {
      const missing = statedAddresses(words).filter((address) => !passages.get(address)?.citable);
      if (missing.length) return { refused: missing.map((address) => reason('decisions.md §forma-show', `${address} is no citable passage of the brief (design.md §passages), so it states nothing`, { entry: name, field: 'Words' })) };
    }
  }
  const ruling = subject.ruling;
  const s = new Showing(a, `brief ${name}`);
  const rows = ruling.surprises?.surprises ?? [];
  s.block(`ruling ${ruling.name}`, [
    `Verdict: ${ruling.rows.Verdict}`, `Level: ${ruling.rows.Level}`, `Target: ${ruling.rows.Target}`,
    ...rows.map((x) => `Surprise: ${x.surprise} | ${x.question} | expected ${x.expected} | found ${x.found}`),
  ]);
  s.block(`mechanism the repair of ${ruling.name} added to ${subject.model}`, subject.mechanisms.map(tidy));
  // Each passage an entry its ## Surprises names cites, as the restatement reads now.
  for (const e of ruling.surprises?.entries ?? []) s.cite(r.entries.get(e.entry)?.cites ?? r.things.get(e.entry)?.cites ?? design.journeys.get(e.entry)?.cites ?? []);
  if (stated) {
    s.block('the brief states it, as the words name', statedAddresses(words));
    s.cite(statedAddresses(words));
  }
  let shown = s.text();
  const lapsed = subject.lapsed;
  if (lapsed) shown = [shown, ...changeSince(lapsed, shown)].join('\n');
  const choice = stated ? 'stated' : 'accepted';
  const pin = briefPin(subject.mechanisms, choice, stated ? words : null, passages);
  return { ...done('brief', name, shown, [{ on: name, pin, shown, ruling, choice, words: stated ? words : null }], takesOf('brief')), stated };
}

/** A kept journey's tables as lines of a block. */
function keptLines(j) {
  return [
    `Polarity: ${j.polarity}`, `Expected end: ${j.expectedEnd}`, `Refused step: ${j.refusedStep}`, `Origin: ${j.origin}`, `Cites: ${j.cites.join(', ')}`,
    ...j.start.map((x) => `Start: ${x.lifecycle} | ${x.entity} | ${x.phase}`),
    ...j.steps.map((x) => `Step ${x.step}: ${x.actor} | ${x.action} | ${x.arguments} | ${x.entity} | ${x.case}`),
  ];
}

/** A surprise's whole basis digest (evidence.md §basis). */
const basisDigestOf = (surprise) => basisDigest(surprise.value.basis);

/** The choices whose cells a lifecycle poses or a pick fills (lifecycle-tool.md §as-read), by entry name. */
function choicesOf(a, l) {
  const r = a.project.restatement;
  const out = new Set();
  for (const p of [...(l.posed ?? []), ...(l.fills ?? [])]) {
    const name = String(p.choice).includes('/choices/') ? p.choice : resolveRef(r, p.choice, l.holder, 'choices').entry?.entry;
    if (name) out.add(name);
  }
  return out;
}

/** An expected outcome as text, with its step where it has one. */
const expectedText = (e) => (e?.step !== undefined ? `${e.outcome} at step ${e.step}` : e?.outcome ?? '-');

// --- forma show (decisions.md §forma-show) ----------------------------------------------------------------------------------

/**
 * Parses a command's arguments (project.md §commands): positionals, and each option once with its value; `flags` take
 * none. Gives `{ positional, options, refused }`.
 */
export function parseArgs(argv, valued, flags = ['--json']) {
  const positional = [];
  const options = new Map();
  const refused = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    if (!valued.includes(arg) && !flags.includes(arg)) { refused.push(reason('project.md §commands', `${arg} is no option of this command`)); continue; }
    if (options.has(arg)) { refused.push(reason('project.md §commands', `${arg} is given twice`)); continue; }
    if (flags.includes(arg)) { options.set(arg, true); continue; }
    // An option this command takes, next, is that option, so the one before it is given without its value.
    if (i + 1 >= argv.length || valued.includes(argv[i + 1]) || flags.includes(argv[i + 1])) { refused.push(reason('project.md §commands', `${arg} is given without its value`)); continue; }
    options.set(arg, argv[i + 1]);
    i += 1;
  }
  return { positional, options, refused };
}

/** The names a decision is on, separated by commas (decisions.md §forma-show). */
export const onsOf = (text) => (text === undefined || text === null ? [] : String(text).split(',').map((x) => x.trim()).filter(Boolean));

/** A refused command's result: every reason, exit status 1 (decisions.md §forma-show). */
export function refusedResult(reasons, json) {
  return json
    ? { status: 1, stdout: `${JSON.stringify({ refused: reasons }, null, 2)}\n`, stderr: '' }
    : { status: 1, stdout: `${reasons.map(reasonText).join('\n')}\n`, stderr: '' };
}

/** The showing's text as `forma show` prints it (decisions.md §forma-show): the showing, the options, then the token. */
export function showText(showing) {
  const lines = [showing.shown, '', 'This decision takes:', ...showing.takes.map((t) => `  ${t}`)];
  if (showing.token) lines.push('', `shown: ${showing.token}`);
  return `${lines.join('\n')}\n`;
}

/** `forma show <kind> [<on>] [--words <text> | --from <file>] [--json]` (decisions.md §forma-show): writes nothing. */
export async function showCommand(root, argv = []) {
  const { positional, options, refused } = parseArgs(argv, ['--words', '--from']);
  const json = options.get('--json') === true;
  if (refused.length) return refusedResult(refused, json);
  if (!positional.length) return refusedResult([reason('decisions.md §forma-show', 'forma show names the kind of decision to show')], json);
  if (positional.length > 2) return refusedResult([reason('project.md §commands', `forma show takes a kind and what it is on, and was given ${positional.length} arguments`)], json);
  const [kind, on] = positional;
  if (options.has('--words') && options.has('--from')) return refusedResult([reason('decisions.md §forma-show', 'a redirect is shown with --words or with --from, not both')], json);
  // A brief decision is shown with no words for accepted, and for stated with the addresses it will name, by --words (decisions.md §forma-show).
  if (options.has('--from') && kind !== 'redirect') return refusedResult([reason('decisions.md §forma-show', '--from is a redirect\'s, when shown')], json);
  if (options.has('--words') && kind !== 'redirect' && kind !== 'brief') return refusedResult([reason('decisions.md §forma-show', '--words is a redirect\'s or a brief decision\'s, when shown')], json);
  let fromText = null;
  if (options.has('--from')) {
    try { fromText = await readFile(resolve(options.get('--from')), 'utf8'); } catch (error) { return refusedResult([reason('decisions.md §forma-show', `--from names no file that can be read: ${error.message}`)], json); }
  }
  const a = await accountOf(root);
  const showing = showingOf(a, kind, onsOf(on), { words: options.get('--words') ?? null, fromText });
  if (showing.refused) return refusedResult(showing.refused, json);
  if (json) {
    const out = { kind: showing.kind, on: showing.on, shown: showing.shown, takes: showing.takes, pins: showing.pins };
    if (showing.token) out.token = showing.token;
    return { status: 0, stdout: `${JSON.stringify(out, null, 2)}\n`, stderr: '' };
  }
  return { status: 0, stdout: showText(showing), stderr: '' };
}
