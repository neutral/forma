// Decisions: the file each decision is, its name, its form and every kind's rows and sections
// (decisions.md §decision-file, §kinds), where each is filed (decisions.md §filing), and which decision is in force, superseded,
// lapsed or revoked (decisions.md §in-force). Forma writes a decision only through `forma decide` (decisions.md §forma-decide), whose
// command is ../decisions/decide.mjs; this module writes the file it is given.

import { compare, isSha256, isTime, sha256, sortedBy } from './json.mjs';
import { parseJourneyBlocks, readBlocks, readFields, readTable, Reasons } from './pages.mjs';
import { decisionsFolder, holderFolder, thingFolder, writeWhole } from './tree.mjs';

/** The kinds of decision (decisions.md §kinds): spec/SPEC.md's nine, and `brief`, which a real finding sent to a model owes. */
const KINDS = ['intake', 'allow', 'confirm', 'decline', 'pick', 'rule', 'carry', 'accept', 'redirect', 'brief'];
/** The intake's situations (decisions.md §intake). */
export const SITUATIONS = ['document a known system', 'showcase a fixed bug', 'localize a live bug', 'understand an unfamiliar system', 'change against a new requirement', 'design new'];
/** The allowance's rows (decisions.md §intake), in the order a decision holds them. */
export const ALLOWANCE = ['Answers', 'Runs', 'TLC seconds', 'TLC megabytes', 'Alloy seconds', 'Alloy megabytes', 'Lifecycle seconds'];
/** The settings' rows (decisions.md §intake). */
const SETTINGS = ['Cadence', 'Inbox cap'];
/** The cadences of the settings (decisions.md §intake). */
export const CADENCES = ['span', 'question', 'session'];
/** A ruling's verdicts (decisions.md §rulings). */
export const VERDICTS = ['model wrong', 'property wrong', 'abstraction too coarse', 'real finding'];
/** A ruling's levels (decisions.md §rulings). */
export const LEVELS = ['implementation', 'specification', 'requirement'];
/** The settings the intake gives when the developer gives none (decisions.md §intake). */
export const DEFAULT_SETTINGS = Object.freeze({ Cadence: 'span', 'Inbox cap': '7' });

/** The rows each kind takes between `Pin` and `Provider` (decisions.md §kinds); an allowance takes any of the settings' rows. */
const KIND_ROWS = {
  intake: ['Situation', ...ALLOWANCE, ...SETTINGS],
  allow: ALLOWANCE,
  confirm: [],
  decline: [],
  pick: ['Choice'],
  rule: ['Verdict', 'Level', 'Target', 'Target pin', 'Basis'],
  carry: ['Choice', 'Basis'],
  accept: ['Choice'],
  redirect: [],
  brief: ['Choice'],
};
const CHOICES = { pick: ['a', 'b'], carry: ['carry', 'withdraw'], accept: ['accept', 'withdraw'], brief: ['stated', 'accepted'] };

/** A `brief` decision's `On` (decisions.md §kinds, §rulings): `<ruling>/<model>`, the ruling by its name and the model it targets. */
export const BRIEF_ON = /^(\d{8}T\d{6}Z-rule-[0-9a-f]{12})\/([^/\s]+)$/;
const SECTIONS = ['Words', 'Surprises', 'Shown', 'Journey', 'Kept'];

/** A decision's time stamp in its name (decisions.md §decision-file): its `At` in UTC to the second, `YYYYMMDDTHHMMSSZ`. */
const stampOf = (at) => at.slice(0, 19).replace(/[-:]/g, '') + 'Z';

/** A decision's file name (decisions.md §decision-file): `<stamp>-<kind>-<the first twelve hexadecimal digits of the SHA-256 of its bytes>.md`. */
const decisionFileName = (text, kind, at) => `${stampOf(at)}-${kind}-${sha256(text).slice(0, 12)}.md`;

/** Whether a decision's `## Words` is present: required for these kinds, and for a carry or an acceptance only when it carries or accepts (decisions.md §kinds). */
function takesWords(kind, choice) {
  if (['intake', 'decline', 'rule', 'redirect', 'brief'].includes(kind)) return true;
  if (kind === 'carry') return choice === 'carry';
  if (kind === 'accept') return choice === 'accept';
  return false;
}

/** Whether an `On` names an offered journey, whose confirmation holds `## Journey` (decisions.md §kinds, §confirm; design.md §code-journeys). */
export const isOfferedJourney = (on) => /^[^/]+\/journeys\/reach-/.test(on);

/** The fence Forma writes a block of text in (decisions.md §decision-file): a run of backticks one longer than the longest in it, and at least three. */
function fenceFor(content) {
  const longest = Math.max(0, ...[...String(content).matchAll(/`+/g)].map((m) => m[0].length));
  return '`'.repeat(Math.max(3, longest + 1));
}

/** A cell's value written as forms.md §page-rules writes one: `|` as `\|`. */
function cell(value) {
  const text = String(value);
  if (text === '' || text !== text.trim() || /[\r\n]/.test(text)) throw new Error(`a decision's cell holds text on one line, trimmed, and "${text}" is not so`);
  return text.replace(/\|/g, '\\|');
}

/** A table's text: its header, its separator and its rows (forms.md §page-rules). */
function tableText(columns, rows) {
  return [`| ${columns.join(' | ')} |`, `| ${columns.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`)].join('\n');
}

/** A journey's tables as its page writes them (forms.md §journeys): its field table, its start table when it has one, its steps. */
export function journeyTablesText(journey) {
  const fields = [['Polarity', journey.polarity], ['Expected end', journey.expectedEnd], ['Refused step', journey.refusedStep ?? '-']];
  if (Object.hasOwn(journey, 'origin')) fields.push(['Origin', journey.origin], ['Cites', journey.cites.join(', ')]);
  const parts = [tableText(['Field', 'Value'], fields)];
  if (journey.start?.length) parts.push(tableText(['Lifecycle', 'Entity', 'Phase'], journey.start.map((r) => [r.lifecycle, r.entity, r.phase])));
  parts.push(tableText(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], journey.steps.map((s) => [String(s.step), s.actor, s.action, s.arguments, s.entity ?? '-', s.case ?? '-'])));
  return parts.join('\n\n');
}

/**
 * A decision's bytes in decisions.md §decision-file's form, from `{ kind, on, pin, rows, session, by, at, words, surprises,
 * shown, journey, kept }`: its heading, field table and the sections its kind holds.
 */
export function decisionText(d) {
  const session = d.session ?? null;
  const fields = [['Kind', d.kind], ['On', d.on], ['Pin', d.pin], ...(d.rows ?? []), ['Provider', session?.provider ?? '-'], ['Model', session?.model ?? '-'], ['Session', session?.session ?? '-'], ['By', d.by], ['At', d.at]];
  const out = [`# ${d.kind} ${d.on}`, tableText(['Field', 'Value'], fields)];
  const fenced = (content) => {
    const fence = fenceFor(content);
    return `${fence}text\n${content}\n${fence}`;
  };
  if (d.words !== undefined && d.words !== null) out.push('## Words', fenced(d.words));
  if (d.surprises) {
    out.push('## Surprises');
    out.push(tableText(['Surprise', 'Question', 'Basis', 'Parts', 'Expected', 'Found'], d.surprises.surprises.map((s) => [s.surprise, s.question, s.basis, s.parts, s.expected, s.found])));
    out.push(tableText(['Surprise', 'Entry', 'Pin'], d.surprises.entries.map((e) => [e.surprise, e.entry, e.pin])));
  }
  out.push('## Shown', fenced(d.shown));
  if (d.journey) out.push('## Journey', `### ${d.journey.name}`, journeyTablesText(d.journey.journey));
  if (d.kept) {
    out.push('## Kept');
    for (const item of d.kept) {
      out.push(`### ${item.surprise}`);
      if (item.journey) out.push(tableText(['Field', 'Value'], [['Journey', item.journey.name], ['Pin', item.journey.pin]]), journeyTablesText(item.journey.journey));
      else out.push(tableText(['Field', 'Value'], [['Not kept', item.notKept]]));
    }
  }
  return `${out.join('\n\n')}\n`;
}

/** A fenced block's text as decisions.md §decision-file asks: one fence, info string `text`, a fence of backticks one longer than the longest run inside and at least three, the text then one line feed. */
function fencedText(blocks, section, reasons) {
  const check = 'decisions.md §decision-file';
  if (blocks.length !== 1 || blocks[0].type !== 'fence') {
    reasons.fail(null, section, `## ${section} holds one fenced block`, check);
    return null;
  }
  const [fence] = blocks;
  if (fence.info !== 'text') reasons.fail(null, section, `## ${section}'s fence has the info string text`, check);
  if (fence.markup !== fenceFor(fence.content.endsWith('\n') ? fence.content.slice(0, -1) : fence.content)) reasons.fail(null, section, `## ${section}'s fence is a run of backticks one longer than the longest in its content, and at least three`, check);
  if (!fence.content.endsWith('\n')) {
    reasons.fail(null, section, `## ${section}'s text is followed by one line feed`, check);
    return fence.content;
  }
  return fence.content.slice(0, -1);
}

/**
 * One file of a decisions/ folder read by its name (decisions.md §decision-file to §kinds): `{ decision, reasons }`; a file with
 * reasons is no decision and counts for nothing (door.md §change).
 */
export function parseDecision(path, fileName, text) {
  const reasons = new Reasons(path, 'decisions.md §decision-file');
  const check = 'decisions.md §decision-file';
  const decision = { path, name: fileName.replace(/\.md$/, ''), file: fileName, folder: path.slice(0, path.length - fileName.length - 1) };
  if (!text.endsWith('\n')) reasons.fail(null, null, 'a decision ends in a line feed', check);
  const blocks = readBlocks(text);
  const heading = blocks[0];
  if (heading?.type !== 'heading' || heading.level !== 1 || heading.line !== 1) {
    reasons.fail(null, null, 'a decision begins with its heading, # <kind> <on>', check);
    return { decision: null, reasons: reasons.list };
  }
  const table = blocks[1];
  if (table?.type !== 'table') {
    reasons.fail(null, null, "a decision's heading is followed by its field table", check);
    return { decision: null, reasons: reasons.list };
  }
  const rows = readTable(table, ['Field', 'Value'], reasons, { check, rowName: (at) => `field row ${at + 1}` });
  if (!rows) return { decision: null, reasons: reasons.list };
  const given = rows.map((row) => [row.Field.trim().toLowerCase(), row.Value]);
  const value = (name) => given.find(([field]) => field === name.toLowerCase())?.[1];
  const kind = value('Kind');
  if (!KINDS.includes(kind)) {
    reasons.fail(null, 'Kind', `"${kind ?? ''}" is not one of ${KINDS.join(', ')}`, 'decisions.md §kinds');
    return { decision: null, reasons: reasons.list };
  }
  const choice = value('Choice');
  // The rows: exactly those of the form and of its kind, in this order (decisions.md §decision-file, §kinds); an allowance takes any of the settings' rows.
  let own = KIND_ROWS[kind];
  if (kind === 'allow') own = [...ALLOWANCE, ...SETTINGS.filter((s) => given.some(([field]) => field === s.toLowerCase()))];
  const want = ['Kind', 'On', 'Pin', ...own, 'Provider', 'Model', 'Session', 'By', 'At'];
  if (given.map(([field]) => field).join('\n') !== want.map((w) => w.toLowerCase()).join('\n')) {
    reasons.fail(null, null, `a ${kind}'s rows are exactly ${want.join(', ')}, in that order`, 'decisions.md §decision-file');
  }
  Object.assign(decision, {
    kind,
    on: value('On') ?? '',
    pin: value('Pin') ?? '',
    rows: Object.fromEntries(own.map((name) => [name, value(name)])),
    session: null,
    by: value('By') ?? '',
    at: value('At') ?? '',
  });
  if (heading.text !== `${kind} ${decision.on}`) reasons.fail(null, null, `the heading is "# ${kind} ${decision.on}"`, check);
  if (!isSha256(decision.pin)) reasons.fail(null, 'Pin', 'the pin is 64 lowercase hexadecimal digits', check);
  const provider = value('Provider');
  const model = value('Model');
  const session = value('Session');
  const dashes = [provider, model, session].filter((v) => v === '-').length;
  if (dashes !== 0 && dashes !== 3) reasons.fail(null, 'Session', 'a session is declared whole, provider, model and session, or not at all', 'decisions.md §who-decides');
  if (dashes === 0 && provider !== undefined) decision.session = { provider, model, session };
  if (!decision.by || decision.by === '-') reasons.fail(null, 'By', 'a decision records the name its maker gives', 'decisions.md §who-decides');
  if (!isTime(decision.at)) reasons.fail(null, 'At', 'At is a time in UTC to the millisecond, YYYY-MM-DDTHH:MM:SS.sssZ', check);
  checkKindRows(decision, reasons);

  // The sections, in order, each only where decisions.md §kinds says (decisions.md §decision-file).
  const sections = [];
  for (const block of blocks.slice(2)) {
    if (block.type === 'heading' && block.level === 2) sections.push({ name: block.text, blocks: [] });
    else if (!sections.length) reasons.fail(null, null, `line ${block.line} holds a ${block.type} between the field table and the sections`, check);
    else sections[sections.length - 1].blocks.push(block);
  }
  const names = sections.map((s) => s.name);
  const wanted = [
    takesWords(kind, choice) ? 'Words' : null,
    kind === 'rule' ? 'Surprises' : null,
    'Shown',
    kind === 'confirm' && isOfferedJourney(decision.on) ? 'Journey' : null,
    kind === 'rule' && decision.rows.Verdict === 'model wrong' ? 'Kept' : null,
  ].filter(Boolean);
  if (names.join('\n') !== wanted.join('\n')) reasons.fail(null, null, `a ${kind}${choice ? ` (${choice})` : ''} holds the sections ${wanted.map((w) => `## ${w}`).join(', ')}, in that order, and no other`, 'decisions.md §kinds');
  const section = (name) => sections.find((s) => s.name === name && SECTIONS.includes(name));
  if (section('Words')) decision.words = fencedText(section('Words').blocks, 'Words', reasons);
  if (section('Shown')) decision.shown = fencedText(section('Shown').blocks, 'Shown', reasons);
  if (section('Surprises')) decision.surprises = parseSurprises(section('Surprises').blocks, reasons);
  if (section('Journey')) decision.journey = parseJourneySection(section('Journey').blocks, reasons);
  if (section('Kept')) decision.kept = parseKept(section('Kept').blocks, reasons);
  // A stated brief decision's words are the addresses of the passages that state the mechanism, one a line, each once (decisions.md §kinds, §rulings).
  if (kind === 'brief' && choice === 'stated' && typeof decision.words === 'string') {
    const why = statedWordsReason(decision.words);
    if (why) reasons.fail(null, 'Words', why, 'decisions.md §rulings');
  }
  // ## Kept holds, for each surprise of the ruling in name order, its heading and its journey or why none is kept (decisions.md §kept-journeys).
  if (decision.kept && decision.surprises) {
    const ruled = decision.surprises.surprises.map((x) => x.surprise);
    const kept = decision.kept.map((x) => x.surprise);
    if (kept.join('\n') !== ruled.join('\n')) reasons.fail(null, 'Kept', `## Kept holds a ### heading for each surprise of the ruling, in name order, ${ruled.join(', ') || 'none'}, and holds ${kept.join(', ') || 'none'}`, 'decisions.md §kept-journeys');
  }
  // ## Surprises names its surprises in name order (decisions.md §rulings).
  if (decision.surprises && compare(sortedBy(decision.surprises.surprises.map((x) => x.surprise)).join('\n'), decision.surprises.surprises.map((x) => x.surprise).join('\n')) !== 0) {
    reasons.fail(null, 'Surprises', "## Surprises names one row per surprise, in name order", 'decisions.md §rulings');
  }
  // An intake, allowance or ruling whose Pin is not the SHA-256 of what its ## Shown's fence holds, its last line
  // feed included, is out of its kind's form, so the file is no decision (decisions.md §kinds).
  if (['intake', 'allow', 'rule'].includes(kind) && typeof decision.shown === 'string' && decision.pin !== sha256(`${decision.shown}\n`)) {
    reasons.fail(null, 'Pin', `a ${kind}'s pin is the SHA-256 of what ## Shown's fence holds, its last line feed included`, 'decisions.md §kinds');
  }
  // Read by its name (decisions.md §decision-file): <At to the second>-<Kind>-<the first twelve hexadecimal digits of the SHA-256 of its bytes>.md.
  if (isTime(decision.at) && fileName !== decisionFileName(text, kind, decision.at)) {
    reasons.fail(null, null, `the file's name is not its own, ${decisionFileName(text, kind, decision.at)}`, 'decisions.md §decision-file');
  }
  return reasons.list.length ? { decision: null, reasons: reasons.list } : { decision, reasons: [] };
}

/** The values of a kind's rows (decisions.md §kinds, §intake, §pick, §rulings, §carry, §accept). */
function checkKindRows(d, reasons) {
  const check = 'decisions.md §kinds';
  const r = d.rows;
  const fail = (field, says, at = check) => reasons.fail(null, field, says, at);
  const whole = (name) => {
    if (r[name] !== undefined && !/^\d+$/.test(r[name])) fail(name, `${name} is a whole number, 0 or more`, 'decisions.md §intake');
  };
  if (d.kind === 'intake' && d.on !== 'intake') fail('On', 'an intake is on intake');
  if (d.kind === 'allow' && d.on !== 'allow') fail('On', 'an allowance is on allow');
  if (d.kind === 'intake' && !SITUATIONS.includes(r.Situation)) fail('Situation', `the situation is one of ${SITUATIONS.join(', ')}`, 'decisions.md §intake');
  if (d.kind === 'intake' || d.kind === 'allow') {
    for (const name of ALLOWANCE) whole(name);
    if (r.Cadence !== undefined && !CADENCES.includes(r.Cadence)) fail('Cadence', `the cadence is one of ${CADENCES.join(', ')}`, 'decisions.md §intake');
    whole('Inbox cap');
  }
  if (CHOICES[d.kind] && !CHOICES[d.kind].includes(r.Choice)) fail('Choice', `a ${d.kind}'s choice is ${CHOICES[d.kind].join(' or ')}`);
  if (d.kind === 'pick' && !/^[^/]+\/choices\/[^/]+$/.test(d.on)) fail('On', 'a pick is on a choice, <part>/choices/<choice>');
  if (d.kind === 'accept' && !/^[^/]+\/claims\/[^/]+$/.test(d.on)) fail('On', 'an acceptance is on a claim, <part or span>/claims/<claim>');
  if (d.kind === 'redirect' && !/^[^/]+\/(claims|journeys)\/[^/]+$/.test(d.on)) fail('On', 'a redirect is on a claim or a new journey');
  if (d.kind === 'brief' && !BRIEF_ON.test(d.on)) fail('On', "a brief decision is on a real finding's met repair on a model, <ruling>/<model>: the ruling by its name and the model it targets");
  if (d.kind === 'carry' && !/^([^/:]+\/premises\/[^/]+|store:[^/]+\/[^/]+|bound:[^/]+\/[^/]+\/[^/]+|strike:[^/]+\/[^/]+\/[^/]+|span:[^/+]+\+[^/+]+)$/.test(d.on)) fail('On', 'a carry is on a premise, as decisions.md §carry names it');
  // A carry's Basis is a claim, <part or span>/claims/<claim>, or - for none (decisions.md §carry).
  if (d.kind === 'carry' && r.Basis !== '-' && !/^[^/]+\/claims\/[^/]+$/.test(r.Basis ?? '')) fail('Basis', "a carry's basis is a claim, <part or span>/claims/<claim>, or - for none", 'decisions.md §carry');
  if (d.kind === 'rule') {
    const names = d.on.split(', ');
    if (!names.every((n) => n !== '') || compare(sortedBy(names).join('\n'), names.join('\n')) !== 0) fail('On', 'a ruling is on the waiting decisions it rules, by name in name order, separated by ", "');
    if (!VERDICTS.includes(r.Verdict)) fail('Verdict', `the verdict is one of ${VERDICTS.join(', ')}`, 'decisions.md §rulings');
    if (!LEVELS.includes(r.Level)) fail('Level', `the level is one of ${LEVELS.join(', ')}`, 'decisions.md §rulings');
    const premiseTarget = /^(premise:|choice:)/.test(r.Target ?? '');
    if (r.Verdict === 'real finding') {
      if (!r.Target || r.Target === '-') fail('Target', 'a real finding has a target', 'decisions.md §rulings');
      if (premiseTarget && !isSha256(r['Target pin'])) fail('Target pin', "a premise target's pin is 64 lowercase hexadecimal digits", 'decisions.md §rulings');
      if (!premiseTarget && r['Target pin'] !== '-') fail('Target pin', 'only a premise target has a pin; otherwise -', 'decisions.md §rulings');
    } else {
      if (r.Target !== '-') fail('Target', 'only a real finding has a target; otherwise -', 'decisions.md §rulings');
      if (r['Target pin'] !== '-') fail('Target pin', 'only a premise target has a pin; otherwise -', 'decisions.md §rulings');
    }
  }
}

/** A ruling's `## Surprises` (decisions.md §rulings): its two tables. */
function parseSurprises(blocks, reasons) {
  const check = 'decisions.md §rulings';
  const out = { surprises: [], entries: [] };
  if (blocks.length !== 2 || blocks.some((b) => b.type !== 'table')) {
    reasons.fail(null, 'Surprises', '## Surprises holds two tables', check);
    return out;
  }
  out.surprises = (readTable(blocks[0], ['Surprise', 'Question', 'Basis', 'Parts', 'Expected', 'Found'], reasons, { check }) ?? []).map((row) => ({ surprise: row.Surprise, question: row.Question, basis: row.Basis, parts: row.Parts, expected: row.Expected, found: row.Found }));
  out.entries = (readTable(blocks[1], ['Surprise', 'Entry', 'Pin'], reasons, { check }) ?? []).map((row) => ({ surprise: row.Surprise, entry: row.Entry, pin: row.Pin }));
  return out;
}

/** A confirmation's `## Journey` (decisions.md §confirm): `### <part>/journeys/<key>`, then a journey page's tables. */
function parseJourneySection(blocks, reasons) {
  const check = 'decisions.md §confirm';
  if (blocks[0]?.type !== 'heading' || blocks[0].level !== 3) {
    reasons.fail(null, 'Journey', '## Journey begins with ### <part>/journeys/<key>', check);
    return null;
  }
  const { journey, used } = parseJourneyBlocks(blocks.slice(1), reasons, { check });
  if (used + 1 !== blocks.length) reasons.fail(null, 'Journey', "## Journey holds its heading and a journey page's tables, and nothing else", check);
  return { name: blocks[0].text, journey };
}

/** A ruling's `## Kept` (decisions.md §kept-journeys): for each surprise, its heading, then the kept journey's field table and tables, or why none is kept. */
function parseKept(blocks, reasons) {
  const check = 'decisions.md §kept-journeys';
  const kept = [];
  let current = null;
  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 3) {
      current = { surprise: block.text, blocks: [] };
      kept.push(current);
    } else if (!current) reasons.fail(null, 'Kept', '## Kept holds a ### <surprise name> for each surprise', check);
    else current.blocks.push(block);
  }
  return kept.map((item) => {
    const fields = readFields(item.blocks[0], ['Journey', 'Pin', 'Not kept'], reasons, { check, optional: ['Journey', 'Pin', 'Not kept'] }) ?? {};
    if (Object.hasOwn(fields, 'Not kept')) {
      if (Object.hasOwn(fields, 'Journey') || Object.hasOwn(fields, 'Pin') || item.blocks.length !== 1) reasons.fail(item.surprise, 'Not kept', 'a surprise not kept has only its field table, | Not kept | <why> |', check);
      return { surprise: item.surprise, notKept: fields['Not kept'] };
    }
    if (!Object.hasOwn(fields, 'Journey') || !Object.hasOwn(fields, 'Pin') || !isSha256(fields.Pin)) reasons.fail(item.surprise, 'Journey', 'a kept journey has its field table, | Journey | <name> | and | Pin | <pin> |', check);
    const { journey, used } = parseJourneyBlocks(item.blocks.slice(1), reasons, { check });
    if (used + 1 !== item.blocks.length) reasons.fail(item.surprise, 'Journey', "a kept journey's field table is followed by a journey page's tables, and nothing else", check);
    return { surprise: item.surprise, journey: { name: fields.Journey, pin: fields.Pin, journey } };
  });
}

/** What a decision says, which a packet may hold (decisions.md §who-decides, door.md §gives, §repair-answer): every row and section of its file but `Provider`, `Model`, `Session` and `By`. */
export function whatItSays(decision) {
  const { session, by, path, folder, file, ...rest } = decision;
  return rest;
}

/** Every session the decisions name in their `Provider`, `Model` and `Session` rows (decisions.md §who-decides, door.md §sessions). */
export const decidingSessions = (decisions) => decisions.filter((d) => d.session).map((d) => d.session);

/** Decisions in their order (decisions.md §decision-file): by `At`, two of one `At` by name. */
export const inOrder = (decisions) => [...decisions].sort((a, b) => compare(a.at, b.at) || compare(a.name, b.name));

/**
 * A new decision's `At` (decisions.md §decision-file, door.md §clock): the clock, or one millisecond after `latest`, the latest
 * tracked time, when the clock is not past it.
 */
export function nextAt(latest, now = new Date()) {
  const last = latest ? Date.parse(latest) : Number.NaN;
  const at = Number.isFinite(last) && now.getTime() <= last ? new Date(last + 1) : now;
  return at.toISOString();
}

/**
 * Where a decision is filed (decisions.md §filing), from the restatement, its kind and its `On`; for a ruling,
 * `subject` is its first surprise's subject as rulingSubject gives it; for a `brief` decision, `ruling` is its ruling,
 * where it is filed (decisions.md §rulings).
 */
export function decisionFolderFor(restatement, kind, on, { subject = null, ruling = null } = {}) {
  const top = 'design/decisions';
  if (kind === 'brief') return ruling?.folder ?? top;
  const holderOf = (key) => (restatement.parts.get(key)?.readme?.exists || !restatement.spans.get(key)?.readme?.exists ? { key, span: false } : { key, span: true });
  const thingOr = (holderKey, thingKind, key, { always = false } = {}) => {
    const holder = holderOf(holderKey);
    const record = (holder.span ? restatement.spans : restatement.parts).get(holderKey);
    if (always || record?.thingPages[thingKind]?.get(key)?.exists) return decisionsFolder(thingFolder(holder, thingKind, key));
    return decisionsFolder(holderFolder(holder));
  };
  if (kind === 'intake' || kind === 'allow') return top;
  if (kind === 'rule') {
    if (!subject) return top;
    if (subject.thing) return thingOr(subject.holder.key, subject.thing.kind, subject.thing.key);
    if (subject.holder) return decisionsFolder(holderFolder(subject.holder));
    return top;
  }
  if (kind === 'carry') {
    let m;
    if ((m = /^([^/]+)\/premises\/([^/]+)$/.exec(on))) return thingOr(m[1], 'premises', m[2]);
    if ((m = /^(?:store|strike):([^/]+)\//.exec(on))) return decisionsFolder(holderFolder(holderOf(m[1])));
    if ((m = /^bound:[^/]+\/([^/]+)\/(?:claims\/)?([^/]+)$/.exec(on))) return thingOr(m[1], 'claims', m[2]);
    return top;
  }
  if (on === 'parts') return top;
  const [holderKey, entryKind, ...rest] = on.split('/');
  const key = rest.join('/');
  if (entryKind === undefined) return top;
  if (['lifecycles', 'journeys', 'claims', 'premises', 'choices'].includes(entryKind)) return thingOr(holderKey, entryKind, key, { always: kind === 'redirect' });
  return decisionsFolder(holderFolder(holderOf(holderKey)));
}

/**
 * Where a ruling's first surprise's subject is filed (decisions.md §filing), from its question's path as tree.mjs's
 * modelsPath reads it: `{ holder, thing }`.
 */
export function rulingSubject(question) {
  if (question.thing) return { holder: question.holder, thing: question.thing };
  if (question.where === 'action' || question.where === 'world') return { holder: { key: question.part, span: false }, thing: null };
  return { holder: null, thing: null };
}

/** Writes a decision's file in its folder, whole (decisions.md §decision-file, door.md §forma-answer): gives its path. */
export async function writeDecision(root, folder, text, kind, at) {
  const path = `${folder}/${decisionFileName(text, kind, at)}`;
  await writeWhole(root, path, text);
  return path;
}

// --- Which decision is in force (decisions.md §in-force) ------------------------------------------------------

/** The subject a decision is on, by its kind and pin (decisions.md §in-force): `unit:`, `choice:`, `premise:` or `risk:` and the pin; null for the intake, an allowance and a ruling. */
function subjectKey(decision) {
  if (['confirm', 'decline', 'redirect'].includes(decision.kind)) return `unit:${decision.pin}`;
  if (decision.kind === 'pick') return `choice:${decision.pin}`;
  if (decision.kind === 'carry') return `premise:${decision.pin}`;
  if (decision.kind === 'accept') return `risk:${decision.pin}`;
  return null;
}

/** The surprises a ruling names (decisions.md §rulings): the rows of its `## Surprises`. */
export const ruledSurprises = (ruling) => (ruling.surprises?.surprises ?? []).map((s) => s.surprise);

/** The subject types of decisions.md §in-force that inForce records: a unit, a choice, a premise and a claim's risk. */
const SUBJECT_TYPES = ['unit', 'choice', 'premise', 'risk'];

/**
 * inForce's record of each subject (decisions.md §in-force), by its kind and name. A unit may share its name with a subject
 * of another kind: an added claim's unit with the claim's risk, an added premise's unit with the premise, an added
 * choice's unit with the choice (design.md §units names an added entry's unit by the entry), and none replaces another.
 * `get(name, type)` gives the record of the subject of that type and name; `get(name)` without a type gives the unit's
 * when a unit has that name, and otherwise the one subject of that name (a choice, premise and risk never share one).
 */
class SubjectRecords {
  #byName = new Map();

  /** Records `record` for the subject of `type` and `name`. */
  set(type, name, record) {
    if (!SUBJECT_TYPES.includes(type)) throw new Error(`"${type}" is no subject type of decisions.md §in-force`);
    if (!this.#byName.has(name)) this.#byName.set(name, new Map());
    this.#byName.get(name).set(type, record);
    return this;
  }

  /** The record of the subject of `type` and `name`; without a type, the unit's of that name, else the one subject's. */
  get(name, type = null) {
    const byType = this.#byName.get(name);
    if (!byType) return undefined;
    if (type) return byType.get(type);
    return byType.get('unit') ?? byType.values().next().value;
  }

  /** Whether a subject of `type` (any, without one) and `name` has a record. */
  has(name, type = null) {
    return this.get(name, type) !== undefined;
  }

  /** The number of subjects recorded. */
  get size() {
    let n = 0;
    for (const byType of this.#byName.values()) n += byType.size;
    return n;
  }

  /** Every record, `[name, record]`, each subject once, by name as first recorded and then by type. */
  *entries() {
    for (const [name, byType] of this.#byName) for (const record of byType.values()) yield [name, record];
  }

  *values() {
    for (const [, record] of this.entries()) yield record;
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}

/**
 * Which decision is in force (decisions.md §in-force) over `subjects`, each `{ type, name, pin, pick?, kept?, claimParts? }`,
 * `unitOf` naming the unit that holds an entry now: `{ subjects, states, rulings, intake, allowances, carried, revoked }`,
 * `subjects` a SubjectRecords, by subject kind and name.
 */
export function inForce(decisions, subjects, { unitOf = (name) => name } = {}) {
  const ordered = inOrder(decisions);
  const states = new Map(ordered.map((d) => [d.name, { state: 'nothing' }]));
  // "Made before it, by At" (decisions.md §in-force): an earlier At alone, never a name, so two decisions of one At touch neither.
  const madeBefore = (decision, ruling) => compare(decision.at, ruling.at) < 0;

  // Rulings (decisions.md §rulings, §in-force): in force for each surprise they name that no later ruling names.
  const rulings = new Map();
  for (const ruling of ordered.filter((d) => d.kind === 'rule')) for (const surprise of ruledSurprises(ruling)) rulings.set(surprise, ruling);
  const rulingInForce = new Set([...rulings.values()].map((r) => r.name));
  for (const ruling of ordered.filter((d) => d.kind === 'rule')) states.set(ruling.name, { state: rulingInForce.has(ruling.name) ? 'in force' : 'superseded' });
  // What its verdict revokes, keeps or proposes again follows from a ruling while it is in force for any of its surprises (decisions.md §in-force).

  // The intake and allowances never lapse: the latest intake is in force, every allowance counts (decisions.md §intake, §in-force).
  const intakes = ordered.filter((d) => d.kind === 'intake');
  const intake = intakes[intakes.length - 1] ?? null;
  for (const d of intakes) states.set(d.name, d === intake ? { state: 'in force' } : { state: 'superseded', supersededBy: intake.name });
  const allowances = ordered.filter((d) => d.kind === 'allow');
  for (const d of allowances) states.set(d.name, { state: 'in force' });

  // Proposed again (decisions.md §in-force): an abstraction-too-coarse ruling in force lapses every confirmation made before it of
  // a unit holding a claim whose Parts include a part the Parts column of its ## Surprises names.
  const coarse = ordered.filter((d) => d.kind === 'rule' && d.rows.Verdict === 'abstraction too coarse' && rulingInForce.has(d.name));
  const coarseParts = coarse.map((r) => ({ ruling: r, parts: new Set(r.surprises.surprises.flatMap((s) => s.parts.split(', '))) }));
  const reproposed = (decision, subject) => decision.kind === 'confirm' && coarseParts.some(({ ruling, parts }) => madeBefore(decision, ruling) && [...(subject.claimParts ?? [])].some((p) => parts.has(p)));

  const byKey = new Map();
  for (const d of ordered) {
    const key = subjectKey(d);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(d);
  }
  const picksInForce = new Map();
  const out = new SubjectRecords();
  const standing = (subject) => `${subject.type}:${subject.pin}`;
  // Choices first, since a pick in force confirms its journeys (decisions.md §pick, §in-force).
  const sortedSubjects = [...subjects].sort((a, b) => (a.type === 'choice' ? -1 : 0) - (b.type === 'choice' ? -1 : 0));
  for (const subject of sortedSubjects) {
    let on = [...(byKey.get(standing(subject)) ?? [])];
    if (subject.type === 'unit' && subject.pick && picksInForce.has(subject.pick)) on.push(picksInForce.get(subject.pick));
    if (subject.type === 'unit' && subject.kept) {
      const ruling = rulings.get(subject.kept.surprise);
      if (ruling && subject.kept.pin === subject.pin) on.push(ruling);
    }
    on = inOrder(on);
    const lapsedByRuling = on.filter((d) => reproposed(d, subject));
    const candidates = on.filter((d) => !lapsedByRuling.includes(d));
    const current = candidates[candidates.length - 1] ?? null;
    if (subject.type === 'choice' && current?.kind === 'pick') picksInForce.set(subject.name, current);
    // Lapsed (decisions.md §in-force): on a subject that stands under the name its On records, or for a redirect under the name of the
    // unit that holds its On now (decisions.md §redirect), at another pin.
    const standsUnder = (d) => (d.kind === 'redirect' ? unitOf(d.on) : d.on) === subject.name;
    const lapsed = ordered.filter((d) => subjectKey(d)?.split(':')[0] === subject.type && standsUnder(d) && d.pin !== subject.pin);
    out.set(subject.type, subject.name, { subject, on, inForce: current, lapsed: [...lapsed, ...lapsedByRuling] });
    for (const d of candidates) {
      if (d.kind === 'rule' || (d.kind === 'pick' && subject.type === 'unit')) continue;
      if (d === current) states.set(d.name, { state: 'in force' });
      else if (states.get(d.name).state !== 'in force') states.set(d.name, { state: 'superseded', supersededBy: current.name });
    }
    for (const d of [...lapsed, ...lapsedByRuling]) if (states.get(d.name).state === 'nothing') states.set(d.name, { state: 'lapsed' });
  }

  // Revoked (decisions.md §in-force): a real finding in force on a premise target revokes every carry made before it on
  // that premise at its Target pin; on a choice premise, the pick's carry, the pick staying in force
  // for its journeys and cells.
  const revoked = new Map();
  for (const ruling of ordered.filter((d) => d.kind === 'rule' && d.rows.Verdict === 'real finding' && rulingInForce.has(d.name))) {
    const target = ruling.rows.Target ?? '';
    if (target.startsWith('premise:')) {
      for (const carry of ordered.filter((d) => d.kind === 'carry' && d.pin === ruling.rows['Target pin'] && madeBefore(d, ruling))) {
        revoked.set(carry.name, ruling.name);
        states.set(carry.name, { state: 'revoked', revokedBy: ruling.name });
      }
    }
    if (target.startsWith('choice:')) {
      for (const pick of ordered.filter((d) => d.kind === 'pick' && d.pin === ruling.rows['Target pin'] && madeBefore(d, ruling))) {
        revoked.set(pick.name, ruling.name);
        states.set(pick.name, { ...states.get(pick.name), carryRevokedBy: ruling.name });
      }
    }
  }
  // Whether a premise is carried (decisions.md §carry, §in-force): a carry in force and not revoked, or for a choice, by its entry name, its
  // pick in force (decisions.md §pick); a premise's or choice's own record, never a unit's of the same name.
  const carried = (name) => {
    const record = out.get(name, 'premise') ?? out.get(name, 'choice');
    const d = record?.inForce;
    if (!d) return { carried: false, by: null };
    if (d.kind === 'pick') return { carried: !revoked.has(d.name), by: d, revokedBy: revoked.get(d.name) ?? null };
    if (d.kind !== 'carry' || d.rows.Choice !== 'carry') return { carried: false, by: d };
    return { carried: !revoked.has(d.name), by: d, basis: d.rows.Basis === '-' ? null : d.rows.Basis, revokedBy: revoked.get(d.name) ?? null };
  };
  return { subjects: out, states, rulings, intake, allowances, carried, revoked };
}

// --- The brief decision (decisions.md §rulings, §in-force) ------------------------------------------------------------

/** The addresses a stated brief decision's words name (decisions.md §rulings): one a line, in their order. */
export const statedAddresses = (words) => (words === null || words === undefined ? [] : String(words).split('\n'));

/**
 * Why a stated brief decision's words are not addresses, one or more, one a line, each once (decisions.md §rulings, §forma-decide), or
 * null. Whether each names a citable passage is the brief's as it reads now, so the pin's and `forma decide`'s to say,
 * never the file's form.
 */
export function statedWordsReason(words) {
  const lines = statedAddresses(words);
  if (!lines.some((l) => l.trim() !== '')) return "a stated brief decision's words give the address of each brief passage that states the mechanism, one or more, one a line";
  const bad = lines.filter((l) => l.trim() === '' || l !== l.trim());
  if (bad.length) return `a stated brief decision's words are addresses, one a line, each trimmed and none blank, and ${bad.map((l) => JSON.stringify(l)).join(', ')} is not one`;
  const twice = [...new Set(lines.filter((l, i) => lines.indexOf(l) !== i))];
  if (twice.length) return `a stated brief decision's words name each address once, and name ${twice.join(', ')} more than once`;
  return null;
}

/**
 * The lines a brief decision's `Pin` hashes (decisions.md §rulings): `Mechanism: <the mechanism>`, then, for `stated`, a line
 * `Passage: <address> <hash>` for each passage its words name, in their order, the hash the passage's (design.md §passages), or
 * `missing` for an address that is no citable passage now. `mechanisms` are those the receipt lines meeting the repair
 * give for its ruling.
 */
function briefPinLines(mechanisms, choice, words, passages) {
  const lines = sortedBy([...new Set(mechanisms)]).map((m) => `Mechanism: ${m}`);
  if (choice === 'stated') {
    for (const address of statedAddresses(words)) {
      const passage = passages.get(address);
      lines.push(`Passage: ${address} ${passage?.citable ? passage.hash : 'missing'}`);
    }
  }
  return lines;
}

/** A brief decision's pin (decisions.md §rulings): its lines joined by one line feed, with none after the last, as decisions.md §carry's pins are, hashed in UTF-8. */
export const briefPin = (mechanisms, choice, words, passages) => sha256(briefPinLines(mechanisms, choice, words, passages).join('\n'));

/**
 * Which `brief` decision is in force on each real finding's met repair on a model (decisions.md §rulings, §in-force), `repairs` each
 * `{ name, mechanisms }`, `name` its `<ruling>/<model>`, and `passages` the brief's. A brief decision pins its own words,
 * so of those on a repair only the last, by `At` and then by name, can be in force: it is in force while the lines its
 * `Pin` hashes, read again now, give its pin, and has lapsed otherwise; each earlier one is superseded by it. One on no
 * met repair decides nothing. Gives `{ subjects, states }`: `subjects` by repair name, each the repair with `decisions`
 * (in order), `inForce` and `lapsed`; `states` each such decision's, as inForce's states give them.
 */
export function briefForce(decisions, repairs, passages) {
  const subjects = new Map();
  const states = new Map();
  for (const repair of repairs) {
    const on = inOrder(decisions.filter((d) => d.kind === 'brief' && d.on === repair.name));
    const last = on[on.length - 1] ?? null;
    const holds = Boolean(last) && last.pin === briefPin(repair.mechanisms, last.rows.Choice, last.words, passages);
    for (const d of on.slice(0, -1)) states.set(d.name, { state: 'superseded', supersededBy: last.name });
    if (last) states.set(last.name, { state: holds ? 'in force' : 'lapsed' });
    subjects.set(repair.name, { ...repair, decisions: on, inForce: holds ? last : null, lapsed: last && !holds ? last : null });
  }
  return { subjects, states };
}
