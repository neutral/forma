// Models and slots (models.md): model.md and its small forms (engines.md §model-md), the misbehaviour menu (forms.md §menu),
// slots, their paths and forms and which exist (models.md §slots), the lifecycle model (models.md §lifecycle-model), the checks of a
// Model answer asked again at every read (models.md §model-answer checks 1 to 4), and those of a Fill-a-slot answer
// (models.md §slot-answer checks 2 to 5), and what a slot is written for (models.md §slot-currency). Engine text is read only through
// ../sany.mjs and ../alloy.mjs (engines.md §engine-text).

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { alloyLines, alloyParse, alloySymbols, replaceRange, strayLines } from '../alloy.mjs';
import { sany } from '../sany.mjs';
import { toolchain } from '../toolchain.mjs';
import { ACTING, journeyEntities, lifecyclesMoved, readBlocks, readCell, readFields, readList, readTable, Reasons, resolveRef } from './pages.mjs';
import { dict } from './json.mjs';
import { isKey, isLifecycleModel } from './tree.mjs';

/** The misbehaviour menu (forms.md §menu), as model.md and paths write each item. */
export const MENU = ['drop', 'duplicate', 'delay', 'reorder', 'fail-forever', 'fail-then-succeed', 'crash', 'go-silent'];

/** Each menu item in the developer's terms, as a falsifier, a showing or a rendering names it (forms.md §menu). */
export const MENU_NAMES = Object.freeze({ drop: 'drop', duplicate: 'duplicate', delay: 'delay', reorder: 'reorder', 'fail-forever': 'fail forever', 'fail-then-succeed': 'fail then succeed', crash: 'crash', 'go-silent': 'go silent mid-step' });

/** The engines of a TLC or Alloy model (engines.md §model-fields). */
const ENGINES = ['tlc', 'alloy'];
/** The extension of a model's engine files and native slots (engines.md §model-fields, models.md §slots). */
export const EXTENSION = { tlc: 'tla', alloy: 'als' };

/**
 * The head that binds a row's parameters over their domains in TLA+ (engines.md §model-actions), one `\E` for each in order, so a
 * domain may speak of the parameters before it: `\E a \in Things : \E b \in {a} : `. SANY reads the bounds of one
 * `\E a \in S, b \in T` outside it, so T could not name a.
 */
export const existsOver = (parameters) => parameters.map((p) => `\\E ${p.name} \\in ${p.domain} : `).join('');

/** The set of bindings `body` gives over a row's parameters (engines.md §model-actions), each bound in its own comprehension, in order. */
export const unionOver = (parameters, body) => parameters.reduceRight((inner, p) => `UNION {${inner} : ${p.name} \\in ${p.domain}}`, body);

/** What a level SANY gives a definition means: 0 a constant, 1 a state predicate, 2 an action, 3 a temporal formula. */
const LEVELS = ['a constant', 'a state predicate', 'an action', 'a temporal formula'];

const NAME = /^[\p{L}\p{N}_]+$/u;
const kept = (name) => /^forma/i.test(name);

// --- Small forms Forma reads itself (engines.md §bounds, §model-actions) --------------------------------------------------

/** Text split at each separator outside every bracket and double-quoted string (engines.md §model-actions, §slot-forms). */
function splitOutside(text, separator) {
  const pieces = [];
  let depth = 0;
  let from = 0;
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (char === '"') {
      at += 1;
      while (at < text.length && text[at] !== '"') at += text[at] === '\\' ? 2 : 1;
    } else if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && text.startsWith(separator, at)) {
      pieces.push(text.slice(from, at));
      from = at + separator.length;
      at = from - 1;
    }
  }
  pieces.push(text.slice(from));
  return pieces;
}

/** A constant's value in engines.md §bounds's small form, as `{ kind, ... }`, integers as BigInt; throws when it is not one. */
export function parseValue(text) {
  let at = 0;
  // Whitespace is Unicode's White_Space, as design.md §passages reads it (evidence.md §bounds), so U+0085 is one and U+FEFF none.
  const source = String(text).replace(/^\p{White_Space}+|\p{White_Space}+$/gu, '');
  const space = () => { while (/\p{White_Space}/u.test(source[at] ?? '')) at += 1; };
  const value = (inSet) => {
    space();
    if (source[at] === '{') {
      at += 1;
      const items = [];
      space();
      if (source[at] === '}') { at += 1; return { kind: 'set', items }; }
      for (;;) {
        items.push(value(true));
        space();
        if (source[at] === ',') { at += 1; continue; }
        if (source[at] === '}') { at += 1; return { kind: 'set', items }; }
        throw new Error(`expected , or } at ${at + 1}`);
      }
    }
    if (source[at] === '"') {
      let end = at + 1;
      while (end < source.length && source[end] !== '"') end += source[end] === '\\' ? 2 : 1;
      if (end >= source.length) throw new Error('a string is not closed');
      const raw = source.slice(at, end + 1);
      at = end + 1;
      return { kind: 'string', text: raw };
    }
    const range = /^(-?\d+)\p{White_Space}*\.\.\p{White_Space}*(-?\d+)/u.exec(source.slice(at));
    // Integers are kept exact, as BigInt, so no bound is rounded (engines.md §bounds, models.md §model-answer: a configuration is written from these values).
    if (range) { at += range[0].length; return { kind: 'range', from: BigInt(range[1]), to: BigInt(range[2]) }; }
    const word = /^-?[A-Za-z0-9_]+/.exec(source.slice(at));
    if (word && /^-?\d+$/.test(word[0])) { at += word[0].length; return { kind: 'integer', value: BigInt(word[0]) }; }
    if (word && !word[0].startsWith('-')) {
      at += word[0].length;
      if (word[0] === 'TRUE' || word[0] === 'FALSE') return { kind: 'boolean', value: word[0] === 'TRUE' };
      if (!inSet) throw new Error(`a model-value name stands in a set, such as {${word[0]}}`);
      return { kind: 'model value', name: word[0] };
    }
    throw new Error(`unexpected "${source[at] ?? 'end'}" at ${at + 1}`);
  };
  const result = value(false);
  space();
  if (at !== source.length) throw new Error(`unexpected text after the value at ${at + 1}`);
  return result;
}

/** A value in the small form written back as TLC's configuration writes it. */
export function valueText(value) {
  if (value.kind === 'set') return `{${value.items.map(valueText).join(', ')}}`;
  if (value.kind === 'string') return value.text;
  if (value.kind === 'range') return `${value.from}..${value.to}`;
  if (value.kind === 'integer') return String(value.value);
  if (value.kind === 'boolean') return value.value ? 'TRUE' : 'FALSE';
  return value.name;
}

// A signature's name in a scope (engines.md §bounds): letters, digits and underscores, with `/` after each module it is qualified by.
const SCOPED = /^(?:[\p{L}\p{N}_]+\/)*[\p{L}\p{N}_]+$/u;

/** An Alloy scope in engines.md §bounds's small form, as `{ number, bounds }`; throws when it is not one. */
export function parseScope(text) {
  const source = String(text).trim();
  const whole = /^(\d+)(?: but (.+))?$/.exec(source);
  const listed = whole ? whole[2] ?? '' : source;
  const bounds = listed === '' ? [] : listed.split(', ').map((item) => {
    const bound = /^(exactly )?(\d+) (\S+)$/.exec(item);
    if (!bound || !SCOPED.test(bound[3])) throw new Error(`"${item}" is not a signature bound such as exactly 1 Doc`);
    // Steps and the bitwidth have their own rows and never stand in the scope (engines.md §bounds).
    if (['steps', 'Int', 'int'].includes(bound[3])) throw new Error(`"${item}" bounds ${bound[3] === 'steps' ? 'the steps' : 'the bitwidth'}, which has its own row and never stands in the scope`);
    return { exactly: Boolean(bound[1]), number: Number(bound[2]), name: bound[3] };
  });
  if (!whole && !bounds.length) throw new Error('a scope is a default number, signature bounds, or both joined by " but "');
  return { number: whole ? Number(whole[1]) : null, bounds };
}

/**
 * A scope as a command in a module that opens the entry reads it (engines.md §bounds, models.md §model-answer; engines.md §alloy). The scope names
 * signatures as a command of the entry would: a name qualified by a module the entry opens, such as `extra/Extra`, is
 * reached from the opening module through the entry, `core/extra/Extra`, and `this/` is the entry itself. A name the
 * entry qualifies, or one unqualified, reads the same in both; a scope not in its form is left as it is, and refused.
 */
function openedScope(scope, entry) {
  let read;
  try { read = parseScope(scope); } catch { return scope; }
  const seen = (name) => {
    if (!name.includes('/')) return name;
    const [first, ...rest] = name.split('/');
    if (first === 'this') return [entry, ...rest].join('/');
    return first === entry ? name : `${entry}/${name}`;
  };
  if (read.bounds.every((b) => seen(b.name) === b.name)) return scope;
  const bounds = read.bounds.map((b) => `${b.exactly ? 'exactly ' : ''}${b.number} ${seen(b.name)}`).join(', ');
  return read.number === null ? bounds : `${read.number} but ${bounds}`;
}

/** An Alloy command's bounds (engines.md §alloy): `for <scope>`, then the steps and bitwidth, after ` but ` when the scope is its default number alone and after `, ` when it holds signature bounds. */
export function alloyBounds(model) {
  const value = (name) => model.bounds.find((b) => b.bound === name)?.value ?? null;
  const base = openedScope(String(value('scope') ?? '').trim(), moduleOf(model.entry ?? ''));
  const more = [value('steps') && `${value('steps')} steps`, value('int') && `${value('int')} Int`].filter(Boolean);
  if (!more.length) return `for ${base}`;
  let listed = false;
  try { listed = parseScope(base).bounds.length > 0; } catch { listed = false; }
  return `for ${base}${listed ? ', ' : ' but '}${more.join(', ')}`;
}

/** A claim's bounds on a model (engines.md §bounds): every row of its Bounds, but for a liveness claim on a TLC model the `constraint` row. */
export const claimBounds = (model, claimKind) => (model.engine === 'tlc' && claimKind === 'liveness' ? model.bounds.filter((b) => b.bound !== 'constraint') : model.bounds);

/** One parameter with its native domain (engines.md §model-actions): `p \in People` for TLC, `p: Person` for Alloy. */
function parameter(item, engine) {
  const match = engine === 'alloy' ? /^([\p{L}\p{N}_]+)\s*:\s*(.+)$/su.exec(item) : /^([\p{L}\p{N}_]+)\s*\\in\s+(.+)$/su.exec(item);
  return match ? { name: match[1], domain: match[2].trim() } : { name: null, domain: null, text: item };
}

/** A Parameters cell (engines.md §model-actions): its parameters, separated by the commas outside every bracket and string; `none`, which an empty cell is not. */
function parameters(text, engine) {
  const cell = String(text).trim();
  if (cell === 'none') return [];
  return splitOutside(cell, ',').map((item) => parameter(item.trim(), engine));
}

// --- model.md (engines.md §model-md) ---------------------------------------------------------------------------------

/**
 * The entry a model.md row's reason is about, by its entry name (door.md §forma-answer, design.md §pins): an Actions row's action,
 * a Misbehaviours row's world row, a Phases row's lifecycle; null for a bound or the file as a whole.
 */
function asEntry(label, field) {
  if (typeof label !== 'string') return null;
  const pieces = (label.startsWith('strike:') ? label.slice('strike:'.length) : label).split('/');
  if (pieces.some((piece) => piece === '' || /\s/.test(piece))) return null;
  if (pieces.length === 3) return `${pieces[0]}/boundary/${pieces[1]}`;
  if (pieces.length !== 2) return null;
  return ['Phases', 'Lifecycle', 'Over', 'Expression'].includes(field) ? `${pieces[0]}/lifecycles/${pieces[1]}` : `${pieces[0]}/actions/${pieces[1]}`;
}

/** A model's model.md in engines.md §model-md's form: `{ model, reasons }`, the reasons the form's failures (models.md §model-answer check 1). */
export function parseModel(key, text) {
  const file = `models/${key}/model.md`;
  const reasons = new Reasons(file, 'engines.md §model-md');
  const fail = (entry, field, says, check = 'engines.md §model-md') => reasons.fail(asEntry(entry, field), field, says, check);
  const model = { key, name: '', engine: '', parts: [], entry: '', typeInvariant: '-', bounds: [], actions: [], misbehaviours: [], phases: [] };
  const blocks = readBlocks(text);
  if (blocks[0]?.type !== 'heading' || blocks[0].level !== 1) fail(null, null, "model.md begins with a level-1 heading, the model's name");
  else model.name = blocks[0].text;
  const at = blocks[0]?.type === 'heading' && blocks[0].level === 1 ? 1 : 0;
  const fields = readFields(blocks[at], ['Engine', 'Parts', 'Entry', 'Type invariant'], reasons, { check: 'engines.md §model-fields' });
  if (!fields) {
    fail(null, null, 'the heading is followed by the field table', 'engines.md §model-fields');
    return { model, reasons: reasons.list };
  }
  model.engine = ENGINES.includes(fields.Engine) ? fields.Engine : '';
  if (fields.Engine !== undefined && !model.engine) fail(null, 'Engine', `"${fields.Engine}" is not tlc or alloy`, 'engines.md §model-fields');
  const parts = readList(fields.Parts ?? '');
  if (parts === null || !parts.length) fail(null, 'Parts', 'Parts lists the keys of the parts the model covers, separated by ", "', 'engines.md §model-fields');
  model.parts = parts ?? [];
  for (const part of model.parts) if (model.parts.indexOf(part) !== model.parts.lastIndexOf(part)) fail(null, 'Parts', `the part ${part} is listed twice; each once`, 'engines.md §model-fields');
  model.entry = fields.Entry ?? '';
  model.typeInvariant = fields['Type invariant'] ?? '-';
  if (model.engine === 'tlc' && (model.typeInvariant === '-' || !NAME.test(model.typeInvariant))) fail(null, 'Type invariant', "a TLC model names its type invariant, a state predicate the model's files define", 'engines.md §model-fields');
  if (model.engine === 'alloy' && model.typeInvariant !== '-') fail(null, 'Type invariant', 'an Alloy model has no type invariant, so it is -', 'engines.md §model-fields');
  if (model.entry.includes('/') || !(model.engine === 'alloy' ? /\.als$/ : /\.tla$/).test(model.entry)) fail(null, 'Entry', `the entry is the root engine file by its name, a .${EXTENSION[model.engine] ?? 'tla or .als'} file`, 'engines.md §model-fields');

  const sections = new Map();
  let current = null;
  for (const block of blocks.slice(at + 1)) {
    if (block.type === 'heading' && block.level === 2) {
      current = block.text;
      if (!['Bounds', 'Actions', 'Misbehaviours', 'Phases'].includes(current)) fail(null, current, `"${current}" is not a section of model.md`);
      else if (sections.has(current)) fail(null, current, 'the section is given twice; each once');
      else sections.set(current, []);
    } else if (current && sections.has(current)) sections.get(current).push(block);
    else fail(null, null, `line ${block.line} stands outside the four sections, and nothing else stands in model.md`);
  }
  const table = (name, columns, check, entryOf) => {
    const nodes = sections.get(name);
    if (!nodes) { fail(null, name, `model.md has ## ${name}`); return []; }
    if (nodes.length !== 1 || nodes[0].type !== 'table') { fail(null, name, `## ${name} holds only its table`); return []; }
    return readTable(nodes[0], columns, reasons, { check, entryOf }) ?? [];
  };

  const given = new Map();
  for (const row of table('Bounds', ['Bound', 'Value', 'Meaning'], 'engines.md §bounds', (r) => r.Bound)) {
    const bound = { bound: row.Bound, value: row.Value, meaning: row.Meaning };
    const once = (name) => {
      if (given.has(name)) fail(row.Bound, 'Bound', `${name} is given twice; at most once`, 'engines.md §bounds');
      given.set(name, true);
    };
    if (model.engine === 'tlc') {
      const constant = /^constant (\S+)$/.exec(row.Bound);
      const choose = /^choose (\S+)$/.exec(row.Bound);
      if (constant && NAME.test(constant[1])) {
        bound.constant = constant[1];
        once(row.Bound);
        try { bound.parsed = parseValue(row.Value); } catch (error) { fail(row.Bound, 'Value', `the value is not in the small form: ${error.message}`, 'engines.md §bounds'); }
      } else if (row.Bound === 'constraint') once('constraint');
      else if (choose && NAME.test(choose[1])) {
        bound.choose = choose[1];
        once(row.Bound);
        if (row.Value !== '-') fail(row.Bound, 'Value', "a choose row's value is -", 'engines.md §bounds');
      } else fail(row.Bound, 'Bound', 'a TLC bound is constant <Name>, constraint or choose <Operator>', 'engines.md §bounds');
    } else if (model.engine === 'alloy') {
      if (!['scope', 'steps', 'int'].includes(row.Bound)) fail(row.Bound, 'Bound', 'an Alloy bound is scope, steps or int', 'engines.md §bounds');
      else {
        once(row.Bound);
        if (row.Bound === 'steps' && !/^\d+(\.\.\d+)?$/.test(row.Value)) fail(row.Bound, 'Value', 'steps is a number of steps or a range m..n of them', 'engines.md §bounds');
        if (row.Bound === 'int' && !/^[1-9]\d*$/.test(row.Value)) fail(row.Bound, 'Value', 'int is a number of at least 1', 'engines.md §bounds');
        if (row.Bound === 'scope') {
          try { parseScope(row.Value); } catch (error) { fail(row.Bound, 'Value', `the scope is not in its small form: ${error.message}`, 'engines.md §bounds'); }
        }
      }
    }
    model.bounds.push(bound);
  }
  if (model.engine === 'alloy' && !given.has('scope')) fail(null, 'Bounds', 'an Alloy model gives its scope, once', 'engines.md §bounds');

  const ref = (value, entry, field, check) => {
    if (!/^[^/\s]+\/[^/\s]+$/.test(value)) fail(entry, field, `"${value}" is written <part>/<key>`, check);
  };
  const rowParameters = (row, entry, check) => {
    const list = parameters(row.Parameters, model.engine);
    for (const p of list) if (!p.name) fail(entry, 'Parameters', `"${p.text}" is not a parameter with its native domain`, check);
    const names = list.map((p) => p.name).filter(Boolean);
    for (const name of new Set(names)) if (names.filter((n) => n === name).length > 1) fail(entry, 'Parameters', `the parameter ${name} is named twice; once in its row`, check);
    for (const name of names) if (kept(name)) fail(entry, 'Parameters', `the parameter ${name} begins Forma or forma, which is kept for code's own names`, 'engines.md §model-fields');
    return list;
  };
  model.actions = table('Actions', ['Action', 'Operator', 'Parameters'], 'engines.md §model-actions', (r) => r.Action).map((row) => {
    ref(row.Action, row.Action, 'Action', 'engines.md §model-actions');
    return { action: row.Action, operator: row.Operator, parameters: rowParameters(row, row.Action, 'engines.md §model-actions') };
  });
  model.misbehaviours = table('Misbehaviours', ['Row', 'Item', 'Operator', 'Parameters'], 'engines.md §model-misbehaviours', (r) => `${r.Row}/${r.Item}`).map((row) => {
    const entry = `${row.Row}/${row.Item}`;
    ref(row.Row, entry, 'Row', 'engines.md §model-misbehaviours');
    if (!MENU.includes(row.Item)) fail(entry, 'Item', `"${row.Item}" is not an item of the menu as model.md writes it: ${MENU.join(', ')}`, 'engines.md §model-misbehaviours');
    return { row: row.Row, item: row.Item, operator: row.Operator, parameters: rowParameters(row, entry, 'engines.md §model-misbehaviours') };
  });
  model.phases = table('Phases', ['Lifecycle', 'Over', 'Expression'], 'engines.md §model-phases', (r) => r.Lifecycle).map((row) => {
    ref(row.Lifecycle, row.Lifecycle, 'Lifecycle', 'engines.md §model-phases');
    const over = parameter(row.Over.trim(), model.engine);
    if (!over.name) fail(row.Lifecycle, 'Over', 'Over names one parameter and its native domain', 'engines.md §model-phases');
    else if (kept(over.name)) fail(row.Lifecycle, 'Over', `the Over ${over.name} begins Forma or forma, which is kept for code's own names`, 'engines.md §model-fields');
    return { lifecycle: row.Lifecycle, over, expression: row.Expression };
  });
  // No two rows of the Actions and Misbehaviours tables name one operator (engines.md §model-actions).
  const operators = [...model.actions.map((r) => [r.operator, r.action]), ...model.misbehaviours.map((r) => [r.operator, `${r.row}/${r.item}`])];
  for (const [operator, entry] of operators) if (operators.filter(([o]) => o === operator).length > 1) fail(entry, 'Operator', `the operator ${operator} is named by two rows; each row names its own`, 'engines.md §model-actions');
  return { model, reasons: reasons.list };
}

// --- Rows against the restatement, and the strikes (forms.md §menu, models.md §model-answer checks 1 and 2, models.md §parts-change) ----------------------

/**
 * The world rows with a seam of a part (forms.md §menu): world rows of kind actor, service, queue or
 * clock, each with the whole menu; null when the part's boundary.md counts for nothing, which is
 * taken as holding (design.md §at-read).
 */
function seamRows(part) {
  if (part.tables.boundary?.exists && !part.tables.boundary.counts) return null;
  return part.boundary.filter((row) => row.side === 'world' && ACTING.includes(row.rowKind));
}

/**
 * Checks 1 and 2 of models.md §model-answer but the parser, and forms.md §menu's rule on strikes recorded on model.md's line, against
 * the restatement and the strikes in force: reasons in door.md §forma-answer's form.
 */
export function modelRowReasons(model, restatement, engineFiles, strikes = new Set(), recorded = null) {
  const reasons = new Reasons(`models/${model.key}/model.md`, 'models.md §model-answer');
  const fail = (entry, field, says, check = 'models.md §model-answer') => reasons.fail(asEntry(entry, field), field, says, check);
  if (!isKey(model.key)) fail(null, null, `the model's key ${model.key} is not a key`);
  if (isLifecycleModel(model.key)) fail(null, null, 'a key beginning lifecycles- is a lifecycle model\'s, and no Model answer writes one');
  for (const name of engineFiles) if (kept(name)) fail(null, null, `the engine file ${name} begins Forma or forma, which is kept for code's own files`, 'engines.md §model-fields');
  if (model.entry && !engineFiles.includes(model.entry)) fail(null, 'Entry', `the entry ${model.entry} is not one of the model's engine files`);
  const covered = [];
  for (const key of model.parts) {
    const part = restatement.parts.get(key);
    const listed = restatement.partList ? restatement.partList.rows.some((r) => r.key === key) : restatement.partListPage?.exists;
    if (!part?.readme?.exists || !listed) fail(null, 'Parts', `${key} is not a part on the part list`);
    else covered.push(part);
  }
  const exactly = (rows, keyOf, wanted, allowed, field, unknown) => {
    const given = rows.map(keyOf);
    for (const want of wanted) {
      const count = given.filter((g) => g === want).length;
      if (count !== 1) fail(want, field, count ? `${want} has ${count} rows; it has one` : `${want} has no row`);
    }
    given.forEach((g, at) => {
      if (unknown(g)) return;
      if (!allowed.has(g)) fail(g, field, `${g} names nothing of a part the model covers`);
      else if (!wanted.includes(g) && given.indexOf(g) !== at) fail(g, field, `${g} has two rows`);
    });
  };
  // Actions: one row for each action of each covered part (engines.md §model-actions).
  const actionsWanted = [];
  const actionsAllowed = new Set();
  const unknownParts = new Set();
  for (const part of covered) {
    if (part.tables.actions?.exists && !part.tables.actions.counts) { unknownParts.add(`a:${part.key}`); continue; }
    for (const action of part.actions) { actionsWanted.push(`${part.key}/${action.key}`); actionsAllowed.add(`${part.key}/${action.key}`); }
  }
  exactly(model.actions, (r) => r.action, actionsWanted, actionsAllowed, 'Actions', (g) => unknownParts.has(`a:${g.split('/')[0]}`));
  // Misbehaviours: one row for each item not struck of each world row with a seam; a struck item's row is allowed (engines.md §model-misbehaviours, forms.md §menu).
  const itemsWanted = [];
  const itemsAllowed = new Set();
  for (const part of covered) {
    const rows = seamRows(part);
    if (!rows) { unknownParts.add(`m:${part.key}`); continue; }
    for (const row of rows) {
      for (const item of MENU) {
        const name = `${part.key}/${row.key}/${item}`;
        itemsAllowed.add(name);
        if (!strikes.has(`strike:${name}`)) itemsWanted.push(name);
      }
    }
  }
  exactly(model.misbehaviours, (r) => `${r.row}/${r.item}`, itemsWanted, itemsAllowed, 'Misbehaviours', (g) => unknownParts.has(`m:${g.split('/')[0]}`));
  // Phases: one row for each lifecycle of each covered part (engines.md §model-phases); a lifecycle whose page counts for nothing is taken as holding.
  const lifecyclesWanted = [];
  const lifecyclesAllowed = new Set();
  for (const part of covered) {
    for (const [key, page] of part.thingPages.lifecycles) {
      if (!page.exists) continue;
      lifecyclesAllowed.add(`${part.key}/${key}`);
      if (page.counts) lifecyclesWanted.push(`${part.key}/${key}`);
    }
  }
  exactly(model.phases, (r) => r.lifecycle, lifecyclesWanted, lifecyclesAllowed, 'Phases', () => false);
  // forms.md §menu: a TLC model whose model.md line records a strike no longer in force is owed a Model answer.
  if (model.engine === 'tlc' && recorded) {
    for (const strike of recorded) if (!strikes.has(strike)) fail(strike, 'Misbehaviours', `model.md was accepted while ${strike} was in force, so the row of that item was never checked; with the strike no longer in force the model is owed a Model answer`, 'forms.md §menu');
  }
  return reasons.list;
}

// --- The parser (engines.md §engine-text, models.md §model-answer checks 3 and 4) ------------------------------------------------------------

let emptyFolder = null;
/** A folder of its own holding nothing, for SANY to read only the files it is given. */
async function nothing() {
  emptyFolder ??= await mkdtemp(join(tmpdir(), 'forma-record-'));
  return emptyFolder;
}

/** SANY's report on `module`, among the model's `files` (name to bytes) and `extra` files (engines.md §engine-text). */
async function parse(files, module, extra = {}) {
  return sany(await nothing(), module, { ...files, ...extra });
}

const tlaModule = (name, extending, lines) => `---- MODULE ${name} ----\nEXTENDS ${extending}\n${lines.join('\n')}\n====\n`;

/** Why a definition SANY reports is not what models.md makes it: its parameters and its level. None when it is. */
function definitionReasons(op, { arity = 0, levels, kind, as = op.name }) {
  const reasons = [];
  if (op.arity !== arity) reasons.push(arity === 0 ? `${as} takes no parameters` : `${as} takes ${arity} parameters`);
  if (!levels.includes(op.level)) reasons.push(`${as} is ${kind}; SANY reads it as ${LEVELS[op.level]}`);
  return reasons;
}

/**
 * Checks 3 and 4 of models.md §model-answer for a TLC model, through SANY: every engine file parses, those
 * the entry does not reach included; no file or definition has a name kept for code; the entry
 * defines `Init`, a state predicate, and `vars`, the tuple of every variable declared, each once;
 * the type invariant is a state predicate of the model's files; the constraint, as its row writes
 * it, a state predicate; one constant row for each constant declared; each choose row's operator
 * defined; each Actions row's operator, and each unstruck Misbehaviours row's, an action of the
 * model's files applied to its parameters over their domains; each Phases expression a state
 * function of its Over. `files` maps each engine file's name to its bytes.
 */
async function tlcReasons(model, files, strikes, fail) {
  const names = Object.keys(files).filter((n) => n.endsWith('.tla')).sort();
  const own = new Set(names.map((n) => n.slice(0, -4)));
  const main = names.includes(model.entry) ? model.entry.slice(0, -4) : null;
  const entry = main ? await parse(files, main) : null;
  if (entry && !entry.ok) fail(null, 'Entry', `SANY refuses ${model.entry}: ${entry.messages.join(' ')}`);
  const ours = (op) => own.has(op.module);
  // No definition of the model's files has a name kept for code or a slot (engines.md §model-fields).
  const seen = new Set();
  const keptNames = (report) => {
    for (const op of report.operators.filter(ours)) {
      if (seen.has(`${op.module}.${op.name}`)) continue;
      seen.add(`${op.module}.${op.name}`);
      if (kept(op.name)) fail(null, null, `${op.module}.tla defines ${op.name}, a name kept for code's own definitions`, 'engines.md §model-fields');
      if (['Invariant', 'Property', 'Fairness', 'Target', 'Fault', 'End'].includes(op.name)) fail(null, null, `${op.module}.tla defines ${op.name}, which a slot defines`, 'engines.md §model-fields');
    }
  };
  if (entry?.ok) keptNames(entry);
  for (const name of names) {
    const module = name.slice(0, -4);
    if (module === main || entry?.modules?.includes(module)) continue;
    const report = await parse(files, module);
    if (!report.ok) fail(null, null, `SANY refuses ${name}: ${report.messages.join(' ')}`);
    else keptNames(report);
  }
  if (!entry?.ok) return;
  const scope = new Map(entry.root.scope.map((op) => [op.name, op]));
  const declared = (kind) => entry.root.declarations.filter((d) => d.kind === kind).map((d) => d.name);
  const init = scope.get('Init');
  if (!init || !ours(init)) fail(null, 'Entry', `${model.entry} defines no Init`);
  else for (const message of definitionReasons(init, { levels: [0, 1], kind: 'a state predicate' })) fail(null, 'Entry', message);
  const variables = declared('variable').sort();
  const vars = scope.get('vars');
  if (!vars) fail(null, 'Entry', `${model.entry} defines no vars`);
  else if (vars.arity !== 0 || !vars.tuple || vars.tuple.includes(null) || [...vars.tuple].sort().join(',') !== variables.join(',') || new Set(vars.tuple).size !== vars.tuple.length) {
    fail(null, 'Entry', `vars is the tuple of every variable the model declares, each once: <<${variables.join(', ')}>>, in any order`);
  }
  const type = scope.get(model.typeInvariant);
  if (!type || !ours(type)) fail(null, 'Type invariant', `the model's files define no ${model.typeInvariant}`);
  else for (const message of definitionReasons(type, { levels: [0, 1], kind: 'a state predicate', as: `the type invariant ${type.name}` })) fail(null, 'Type invariant', message);
  // Check 3: one constant row for each constant declared, and no other; each choose row's operator defined (models.md §model-answer).
  const constants = declared('constant');
  const valued = model.bounds.filter((b) => b.constant).map((b) => b.constant);
  for (const name of constants) if (!valued.includes(name)) fail(name, 'Bounds', `the constant ${name} has no row`, 'models.md §model-answer');
  for (const name of valued) if (!constants.includes(name)) fail(name, 'Bounds', `${name} is not a constant the entry and the modules it uses declare`, 'models.md §model-answer');
  for (const bound of model.bounds.filter((b) => b.choose)) {
    const op = scope.get(bound.choose);
    if (!op || !ours(op)) fail(bound.bound, 'Bound', `${bound.choose} is not an operator the model's files define`, 'models.md §model-answer');
  }
  const constraint = model.bounds.find((b) => b.bound === 'constraint');
  if (constraint) {
    const report = await parse(files, 'FormaConstraintCheck', { 'FormaConstraintCheck.tla': tlaModule('FormaConstraintCheck', main, [`FormaConstraint == ${constraint.value}`]) });
    if (!report.ok) fail('constraint', 'Value', `SANY refuses the constraint: ${report.messages.join(' ')}`);
    else {
      const op = report.root.definitions.find((d) => d.name === 'FormaConstraint');
      if (op) for (const message of definitionReasons(op, { levels: [0, 1], kind: 'a state predicate', as: 'the constraint' })) fail('constraint', 'Value', message);
    }
  }
  const rows = [...model.actions.map((r) => ({ ...r, label: r.action })), ...model.misbehaviours.filter((r) => !strikes.has(`strike:${r.row}/${r.item}`)).map((r) => ({ ...r, label: `${r.row}/${r.item}` }))];
  for (const row of rows) {
    const op = scope.get(row.operator);
    if (!op) { fail(row.label, 'Operator', `${row.operator} is not defined in the model's files`); continue; }
    if (!ours(op)) fail(row.label, 'Operator', `${row.operator} is not defined in the model's files: it comes from ${op.module}`);
    // An action is a Boolean of level at most 2, as TLA+ reads one: a state predicate or a constant is one that primes nothing.
    if (op.level > 2) fail(row.label, 'Operator', `${row.operator} performs ${row.label}, so it is an action; SANY reads it as ${LEVELS[op.level]}`);
  }
  const calls = rows.filter((row) => row.parameters.every((p) => p.name) && scope.has(row.operator)).map((row, at) => {
    const head = existsOver(row.parameters);
    return `FormaRow${at} == ${head}${row.operator}${row.parameters.length ? `(${row.parameters.map((p) => p.name).join(', ')})` : ''}`;
  });
  if (calls.length) {
    const report = await parse(files, 'FormaRowsCheck', { 'FormaRowsCheck.tla': tlaModule('FormaRowsCheck', main, calls) });
    if (!report.ok) fail(null, null, `SANY refuses the Actions and Misbehaviours tables applied to their parameters: ${report.messages.join(' ')}`);
  }
  const phases = model.phases.filter((row) => row.over.name);
  if (phases.length) {
    const lines = phases.flatMap((row, at) => [`FormaOver${at} == ${row.over.domain}`, `FormaPhase${at}(${row.over.name}) == ${row.expression}`]);
    const report = await parse(files, 'FormaPhasesCheck', { 'FormaPhasesCheck.tla': tlaModule('FormaPhasesCheck', main, lines) });
    if (!report.ok) fail(null, 'Phases', `SANY refuses the Phases table: ${report.messages.join(' ')}`);
    else phases.forEach((row, at) => {
      const level = report.root.definitions.find((d) => d.name === `FormaPhase${at}`)?.level ?? 0;
      if (level > 1) fail(row.lifecycle, 'Expression', `the expression gives a phase in a state, so it is a state function; SANY reads it as ${LEVELS[level]}`);
    });
  }
}

/** A phase's Alloy signature (engines.md §model-phases): its key, each hyphen written as an underscore. */
export const phaseSig = (phase) => phase.replace(/-/g, '_');

/** The module name `open` gives an Alloy file. */
export const moduleOf = (file) => file.replace(/\.als$/, '');

/**
 * Check 4 of models.md §model-answer for an Alloy model, through Alloy's parser and language server: every
 * engine file parses; no file or definition has a name kept for code or a slot; each operator is the
 * one predicate of its name and each phase's signature the one signature of its name; and one probe
 * module opening the entry holds each parameter's domain, each row's bindings, each Phases row's Over
 * and expression, and a command at the Bounds, each the whole body of a definition the language
 * server lists over its whole line.
 */
async function alloyReasons(model, files, restatement, fail) {
  const tools = await toolchain();
  const names = Object.keys(files).filter((n) => n.endsWith('.als')).sort();
  let refused = false;
  for (const name of names) {
    const parsed = await alloyParse(tools, files, name);
    for (const e of parsed.errors) { refused = true; fail(null, null, `Alloy refuses ${e.file ?? name}${e.line ? ` at line ${e.line} column ${e.column}` : ''}: ${e.message}`); }
  }
  if (refused) return;
  const defined = [];
  for (const name of names) {
    for (const symbol of await alloySymbols(tools, files, name)) {
      defined.push({ file: name, kind: symbol.kind, name: symbol.name });
      if (kept(symbol.name)) fail(null, null, `${name} defines ${symbol.kind} ${symbol.name}, a name kept for code's own definitions`, 'engines.md §model-fields');
      if (['Claim', 'Target', 'Fault', 'End'].includes(symbol.name)) fail(null, null, `${name} defines ${symbol.kind} ${symbol.name}, which a slot defines`, 'engines.md §model-fields');
    }
  }
  if (!Object.hasOwn(files, model.entry)) return;
  const count = (kind, name) => defined.filter((s) => s.kind === kind && s.name === name).length;
  const rows = [...model.actions.map((r) => ({ ...r, label: r.action })), ...model.misbehaviours.map((r) => ({ ...r, label: `${r.row}/${r.item}` }))];
  for (const row of rows) {
    const found = count('pred', row.operator);
    if (found !== 1) fail(row.label, 'Operator', found ? `the model's files define ${found} predicates named ${row.operator}; an operator names the one predicate that performs it` : `${row.operator} is not a predicate the model's files define, by its name alone`);
  }
  const phases = model.phases.map((row) => {
    const ref = resolveRef(restatement, row.lifecycle, null, 'lifecycles');
    return { ...row, keys: ref.entry?.phases ?? [] };
  });
  for (const row of phases) for (const key of row.keys) {
    const found = count('sig', phaseSig(key));
    if (found !== 1) fail(row.lifecycle, 'Lifecycle', `the model's files define ${found || 'no'} signature${found === 1 ? '' : 's'} named ${phaseSig(key)} for the phase ${key}; each phase has the one signature of its name`);
  }
  const lines = [];
  const add = (kind, name, text, entry, field, what) => lines.push({ kind, name, text, entry, field, what });
  const decls = (ps) => ps.map((p) => `${p.name}: ${p.domain}`).join(', ');
  rows.forEach((row, at) => {
    if (!row.parameters.every((p) => p.name)) return;
    const params = row.parameters.map((p) => p.name);
    row.parameters.forEach((p, k) => add('fun', `FormaDom${at + 1}x${k + 1}`, `fun FormaDom${at + 1}x${k + 1}${k ? `[${decls(row.parameters.slice(0, k))}]` : ''}: set univ { ${p.domain} }`, row.label, 'Parameters', `the domain of ${p.name}`));
    if (params.length) add('fun', `FormaRow${at + 1}`, `fun FormaRow${at + 1}: ${params.length === 1 ? 'set univ' : params.map(() => 'univ').join(' -> ')} { { ${decls(row.parameters)} | ${row.operator}[${params.join(', ')}] } }`, row.label, 'Operator', 'the operator');
    else add('pred', `FormaRow${at + 1}`, `pred FormaRow${at + 1} { ${row.operator} }`, row.label, 'Operator', 'the operator');
  });
  phases.forEach((row, at) => {
    if (!row.over.name) return;
    const over = `${row.over.name}: ${row.over.domain}`;
    add('fun', `FormaOver${at + 1}`, `fun FormaOver${at + 1}: set univ { ${row.over.domain} }`, row.lifecycle, 'Over', "the Over's domain");
    add('fun', `FormaPhase${at + 1}`, `fun FormaPhase${at + 1}[${over}]: set univ { ${row.expression} }`, row.lifecycle, 'Expression', 'the expression');
    if (row.keys.length) add('pred', `FormaPhaseIn${at + 1}`, `pred FormaPhaseIn${at + 1}[${over}] { ${row.keys.map((key) => `(${row.expression}) in ${phaseSig(key)}`).join(' or ')} }`, row.lifecycle, 'Expression', 'the expression');
  });
  add('pred', 'FormaBounded', 'pred FormaBounded {}', 'scope', 'Value', 'the Bounds');
  add('command', 'FormaBounds', `FormaBounds: run FormaBounded ${alloyBounds(model)}`, 'scope', 'Value', 'the Bounds');
  const all = { ...files, 'FormaProbe.als': `module FormaProbe\nopen ${moduleOf(model.entry)}\n${lines.map((l) => l.text).join('\n')}\n` };
  const probe = await alloyParse(tools, all, 'FormaProbe.als');
  for (const e of probe.errors) {
    const line = e.file === 'FormaProbe.als' ? lines[e.line - 3] : null;
    if (line) fail(line.entry, line.field, `Alloy refuses ${line.what} of ${line.entry}: ${e.message}`);
    else fail(null, null, `Alloy refuses ${e.file}${e.line ? ` at line ${e.line} column ${e.column}` : ''}: ${e.message}`);
  }
  if (!probe.ok) return;
  const { stray, more } = strayLines(await alloySymbols(tools, all, 'FormaProbe.als'), lines, 2);
  for (const line of stray) fail(line.entry, line.field, `${line.what} is one whole native expression: this one ends the definition code writes it into, or adds a definition or a fact beside it`);
  if (!stray.length && more) fail(null, null, 'a cell of model.md adds a definition beside those code writes');
}

/**
 * Checks 3 and 4 of models.md §model-answer through the engine's parser (engines.md §engine-text), `files` the model's engine files
 * that count, by name: reasons in door.md §forma-answer's form.
 */
export async function modelEngineReasons(model, files, restatement, strikes = new Set()) {
  const reasons = new Reasons(`models/${model.key}/model.md`, 'models.md §model-answer');
  const fail = (entry, field, says, check = 'models.md §model-answer') => reasons.fail(asEntry(entry, field), field, says, check);
  try {
    if (model.engine === 'tlc') await tlcReasons(model, files, strikes, fail);
    if (model.engine === 'alloy') await alloyReasons(model, files, restatement, fail);
  } catch (error) {
    fail(null, null, `the parser could not finish: ${error.message}`, 'door.md §forma-answer');
  }
  return reasons.list;
}

// --- Slots (models.md §slots, engines.md §slot-forms) -------------------------------------------------------------------------------

/** A lifecycle form (engines.md §slot-forms): `| Lifecycle | Phase |`, at least one row, or one row of `| Lifecycle | From | Action | To |`. */
function lifecycleForm(block, reasons, check) {
  if (block?.type !== 'table') {
    reasons.fail(null, null, 'a lifecycle form is a table, | Lifecycle | Phase | or one row of | Lifecycle | From | Action | To |', check);
    return null;
  }
  if (block.header.length === 2) {
    const rows = readTable(block, ['Lifecycle', 'Phase'], reasons, { check }) ?? [];
    if (!rows.length) reasons.fail(null, null, 'a combination names at least one lifecycle', check);
    const named = rows.map((r) => r.Lifecycle);
    for (const key of new Set(named)) if (named.filter((n) => n === key).length > 1) reasons.fail(null, 'Lifecycle', `the combination has more than one row for ${key}; at most one per lifecycle`, check);
    return { combination: rows.map((r) => ({ lifecycle: r.Lifecycle, phase: r.Phase })) };
  }
  const rows = readTable(block, ['Lifecycle', 'From', 'Action', 'To'], reasons, { check }) ?? [];
  if (rows.length !== 1) reasons.fail(null, null, 'a transition is one row of | Lifecycle | From | Action | To |', check);
  return rows[0] ? { transition: { lifecycle: rows[0].Lifecycle, from: rows[0].From, action: rows[0].Action, to: rows[0].To } } : null;
}

/** The one fenced block of the engine's language after a slot's field table (engines.md §slot-forms). */
function nativeBlock(blocks, engine, reasons, what, check) {
  const language = engine === 'tlc' ? 'tla' : 'alloy';
  if (blocks.length !== 1 || blocks[0].type !== 'fence' || blocks[0].info !== language) reasons.fail(null, null, `${what} holds its field table, then one fenced ${language} block, and nothing else`, check);
  return blocks.find((b) => b.type === 'fence' && b.info === language)?.content;
}

/** A slot's text in engines.md §slot-forms's form by its kind, extension and engine: `{ form, reasons }`. */
export function parseSlot(kind, extension, text, engine, path = null) {
  const check = 'engines.md §slot-forms';
  const reasons = new Reasons(path, check);
  const form = { kind };
  const native = extension === 'tla' || extension === 'als';
  if (native) {
    if (kind !== 'encoding' && kind !== 'misbehaviour') reasons.fail(null, null, `a ${kind} slot is a Markdown file`, check);
    form.native = String(text);
    return { form, reasons: reasons.list };
  }
  const blocks = readBlocks(text);
  const fields = (names, optional = []) => readFields(blocks[0], names, reasons, { check, optional });
  if (kind === 'encoding') {
    // A field table's columns stand in any order, matched case-insensitively (forms.md §page-rules).
    const isField = blocks[0]?.type === 'table' && [...blocks[0].header].sort().join(',') === 'field,value';
    if (isField || engine !== 'lifecycle') {
      const values = fields(['Cannot express']);
      if (!values || blocks.length !== 1) reasons.fail(null, null, 'an encoding.md gives why the engine cannot express the claim, | Cannot express | <why> |, and nothing else', check);
      form.cannotExpress = values?.['Cannot express'] ?? '';
    } else {
      if (blocks.length !== 1) reasons.fail(null, null, 'a forbidden form is one table, and nothing else', check);
      form.forbidden = lifecycleForm(blocks[0], reasons, check);
    }
  } else if (kind === 'witness') {
    const values = fields(['Meaning']);
    if (!values) reasons.fail(null, null, 'a witness begins with its field table, | Meaning | <what is reached> |', check);
    form.meaning = values?.Meaning ?? '';
    if (engine === 'lifecycle') {
      if (blocks.length !== 2) reasons.fail(null, null, 'a witness on a lifecycle model holds its field table, then the combination or transition to reach, and nothing else', check);
      form.target = lifecycleForm(blocks[1], reasons, check);
    } else form.native = nativeBlock(blocks.slice(1), engine, reasons, 'a witness', check);
  } else if (kind === 'fault') {
    const values = fields(['Action', 'Mechanism']);
    if (!values) reasons.fail(null, null, 'a fault begins with its field table, | Action | … | and | Mechanism | … |', check);
    form.action = values?.Action ?? '';
    form.mechanism = values?.Mechanism ?? '';
    if (engine === 'lifecycle') {
      if (values && form.action !== '-') reasons.fail(null, 'Action', "a fault's Action on a lifecycle model is -", check);
      const table = blocks[1];
      if (blocks.length !== 2 || table?.type !== 'table') reasons.fail(null, null, 'a fault on a lifecycle model holds its field table, then its overlay, and nothing else', check);
      const rows = table?.type === 'table' ? readTable(table, ['Lifecycle', 'Phase', 'Action', 'Outcome'], reasons, { check, empty: true }) ?? [] : [];
      for (const row of rows) for (const name of ['Lifecycle', 'Phase', 'Action']) if (row[name] === '') reasons.fail(null, name, `the overlay's row at line ${row.line} has an empty cell; only an Outcome may be empty`, check);
      if (table?.type === 'table' && !rows.length) reasons.fail(null, null, 'an overlay has at least one row', check);
      form.overlay = rows.map((row) => ({ lifecycle: row.Lifecycle, phase: row.Phase, action: row.Action, outcome: readCell(row.Outcome), line: row.line }));
    } else form.native = nativeBlock(blocks.slice(1), engine, reasons, 'a fault', check);
  } else if (kind === 'schedule') {
    // The tables, each told by its columns, and for a journey that should happen its end: a field table with the one
    // row Meaning, then one fenced block of the engine's language defining End (engines.md §slot-forms Schedule 4). Whether the
    // journey should happen is check 5's (models.md §slot-answer), which knows the journey.
    const language = engine === 'tlc' ? 'tla' : 'alloy';
    const shapes = { entity: ['Entity', 'Value'], start: ['Start'], steps: ['Step', 'Bindings'], end: ['Field', 'Value'] };
    const tables = {};
    let end = null;
    for (let at = 0; at < blocks.length; at += 1) {
      const block = blocks[at];
      const shape = block.type === 'table' ? Object.keys(shapes).find((k) => shapes[k].length === block.header.length && shapes[k].every((c) => block.header.includes(c.toLowerCase()))) : null;
      if (!shape) {
        reasons.fail(null, null, `line ${block.line}: a schedule holds only its entity table, its start table and its steps table, each told by its columns, and for a journey that should happen its end, a field table | Meaning | … | then one fenced ${language} block`, check);
        continue;
      }
      if (tables[shape]) {
        reasons.fail(null, null, shape === 'end' ? 'a schedule has one end, one field table | Meaning | … |' : `a schedule has one ${shape} table`, check);
        if (shape === 'end' && blocks[at + 1]?.type === 'fence') at += 1;
        continue;
      }
      if (shape !== 'end') {
        tables[shape] = readTable(block, shapes[shape], reasons, { check }) ?? [];
        continue;
      }
      tables.end = true;
      const values = readFields(block, ['Meaning'], reasons, { check });
      const fence = blocks[at + 1]?.type === 'fence' ? blocks[at + 1] : null;
      if (fence) at += 1;
      if (!fence) reasons.fail(null, null, `a schedule's end is its field table, | Meaning | … |, then one fenced ${language} block defining ${engine === 'alloy' ? 'pred End' : 'End'}`, check);
      else if (fence.info !== language) reasons.fail(null, null, `a schedule's end holds one fenced ${language} block, and this one is fenced ${fence.info || 'with no language'}`, check);
      end = { meaning: values?.Meaning ?? '', native: fence && fence.info === language ? fence.content : undefined };
    }
    form.end = end;
    if (end?.native !== undefined) form.native = end.native;
    if (!tables.entity) reasons.fail(null, null, 'a schedule has its entity table, | Entity | Value |', check);
    if (!tables.steps) reasons.fail(null, null, 'a schedule has its steps table, | Step | Bindings |', check);
    if (tables.start && tables.start.length !== 1) reasons.fail(null, null, 'a start table has one row', check);
    const entities = (tables.entity ?? []).map((r) => r.Entity);
    for (const name of new Set(entities)) if (entities.filter((e) => e === name).length > 1) reasons.fail(null, 'Entity', `the entity ${name} is given twice; each once`, check);
    form.entities = dict((tables.entity ?? []).map((r) => [r.Entity, r.Value]));
    form.start = tables.start ? tables.start[0]?.Start ?? null : null;
    form.steps = (tables.steps ?? []).map((row, at) => {
      if (row.Step !== String(at + 1)) reasons.fail(null, 'Step', `the steps are numbered as the journey numbers them, in order, and row ${at + 1} is numbered ${row.Step}`, check);
      const text = row.Bindings.trim();
      const listed = text === 'none' ? [] : splitOutside(text, '; ');
      if (listed.some((pair) => splitOutside(pair, ';').length > 1)) reasons.fail(null, 'Bindings', `step ${at + 1}: bindings are separated by "; "`, check);
      const pairs = listed.map((pair) => {
        const equals = pair.indexOf('=');
        if (equals === -1) reasons.fail(null, 'Bindings', `step ${at + 1}: "${pair}" is not <parameter> = <native expression>`, check);
        return equals === -1 ? [pair.trim(), ''] : [pair.slice(0, equals).trim(), pair.slice(equals + 1).trim()];
      });
      const names = pairs.map(([n]) => n);
      for (const name of new Set(names)) if (names.filter((n) => n === name).length > 1) reasons.fail(null, 'Bindings', `step ${at + 1} binds ${name} twice`, check);
      return { step: at + 1, bindings: dict(pairs) };
    });
  } else reasons.fail(null, null, `a ${kind} slot is native text, a .${EXTENSION[engine] ?? 'tla or .als'} file`, check);
  return { form, reasons: reasons.list };
}

/** Whether a claim's encoding on a model is a property (models.md §slots): its slot filled and giving no reason. */
export const isProperty = (form) => Boolean(form) && !Object.hasOwn(form, 'cannotExpress') && (form.native !== undefined || Boolean(form.forbidden));

/**
 * The lifecycle models (models.md §lifecycle-model), `lifecycles-<part>` for each part with a lifecycle in `confirmed`, the
 * entry names of those whose confirmation is in force.
 */
export function lifecycleModels(restatement, confirmed) {
  const models = new Map();
  for (const name of confirmed) {
    const part = name.split('/')[0];
    if (!restatement.parts.get(part)?.things.lifecycles.has(name.split('/').pop())) continue;
    const key = `lifecycles-${part}`;
    if (!models.has(key)) models.set(key, { key, engine: 'lifecycle', parts: [part], lifecycles: [] });
    models.get(key).lifecycles.push(name);
  }
  return models;
}

/** Whether a model covers a thing's parts (models.md §slots): its Parts names every one of them; a lifecycle model covers a claim whose parts are its part. */
export const covers = (model, parts) => parts.length > 0 && (model.engine === 'lifecycle' ? parts.length === 1 && parts[0] === model.parts[0] : parts.every((p) => model.parts.includes(p)));

/**
 * The slots that exist on a model by models.md §slots, each `{ kind, path, serves }`, from the claims and confirmed
 * journeys with their parts, whether a claim's encoding is a property there, and the strikes in force.
 */
export function slotsOf(model, restatement, { claims = [], journeys = [], property = () => false, strikes = new Set() } = {}) {
  const slots = [];
  const folder = (holder, kind, key) => `models/${model.key}/${holder.span ? 'spans' : 'parts'}/${holder.key}/${kind}/${key}`;
  for (const claim of claims) {
    if (!covers(model, claim.parts)) continue;
    const at = folder(claim.holder, 'claims', claim.key);
    slots.push({ kind: 'encoding', path: `${at}/encoding`, serves: claim.entry });
    if (property(claim)) {
      slots.push({ kind: 'witness', path: `${at}/witness`, serves: claim.entry });
      slots.push({ kind: 'fault', path: `${at}/fault`, serves: claim.entry });
    }
  }
  if (model.engine === 'lifecycle') return slots;
  for (const journey of journeys) {
    if (!covers(model, journey.parts)) continue;
    slots.push({ kind: 'schedule', path: `${folder(journey.holder, 'journeys', journey.key)}/schedule`, serves: journey.entry });
  }
  for (const key of model.parts) {
    const part = restatement.parts.get(key);
    if (!part) continue;
    for (const row of seamRows(part) ?? []) {
      for (const item of MENU) {
        if (strikes.has(`strike:${key}/${row.key}/${item}`)) continue;
        slots.push({ kind: 'misbehaviour', path: `models/${model.key}/world/${key}/${row.key}/${item}`, serves: row.entry, item });
      }
    }
  }
  return slots;
}

/** The entries a slot is written for (models.md §slot-currency), by name, from its claim, fault, journey or world row. */
export function writtenFor(restatement, model, slot, { claim = null, fault = null, journey = null, from = null, row = null } = {}) {
  const names = new Set();
  if (slot.kind === 'encoding' || slot.kind === 'witness' || slot.kind === 'fault') if (claim) names.add(claim);
  if (slot.kind === 'fault' && model.engine !== 'lifecycle' && fault?.action) {
    const [part, key] = fault.action.split('/');
    if (part && key) names.add(`${part}/actions/${key}`);
  }
  if (slot.kind === 'schedule' && journey) {
    names.add(journey.entry);
    for (const step of journey.steps ?? []) {
      const ref = resolveRef(restatement, step.action, from, 'actions');
      if (!ref.entry) continue;
      names.add(ref.entry.entry);
      if (step.case !== null) for (const lifecycle of lifecyclesMoved(restatement, ref)) if (lifecycle.actions.includes(ref.key)) names.add(lifecycle.entry);
    }
  }
  if (slot.kind === 'misbehaviour' && row) names.add(row);
  if (model.engine === 'lifecycle') {
    for (const lifecycle of restatement.parts.get(model.parts[0])?.things.lifecycles.values() ?? []) names.add(lifecycle.entry);
  }
  return [...names].sort();
}

// --- A slot's checks against its model and the restatement (models.md §slot-answer checks 2 to 5) ------------------------

/** The text SANY places at a location in a module's source; null for another module's (models.md §slot-answer check 4). */
function textAt(source, at, module) {
  if (!at || at.module !== module) return null;
  const lines = source.split('\n');
  const [first, last] = at.line;
  const [from, to] = at.column;
  if (first === last) return lines[first - 1]?.slice(from - 1, to) ?? null;
  return [lines[first - 1]?.slice(from - 1), ...lines.slice(first, last - 1), lines[last - 1]?.slice(0, to)].join('\n');
}

const QUANTIFIERS = { $BoundedForall: '\\A', $UnboundedForall: '\\A', $BoundedExists: '\\E', $UnboundedExists: '\\E', $TemporalForall: '\\AA', $TemporalExists: '\\EE' };
// A quantifier by its operator's name in SANY's tree, or null: an own key only, so a name such as `constructor` is none.
const quantifier = (name) => (typeof name === 'string' && Object.hasOwn(QUANTIFIERS, name) ? QUANTIFIERS[name] : null);
// A domain as the row writes it, whitespace aside: whitespace outside double-quoted strings removed, each string kept
// as written, so `{"a b"}` and `{"ab"}` stay two domains (engines.md §slot-forms).
const unspaced = (text) => splitStrings(String(text ?? '')).map((p) => (p.string ? p.text : p.text.replace(/\p{White_Space}+/gu, ''))).join('');

/** Text as pieces outside and inside double-quoted strings, a `\` escaping the character after it inside a string. */
function splitStrings(source) {
  const pieces = [];
  let outside = '';
  for (let at = 0; at < source.length; at += 1) {
    if (source[at] !== '"') {
      outside += source[at];
      continue;
    }
    let end = at + 1;
    while (end < source.length && source[end] !== '"') end += source[end] === '\\' ? 2 : 1;
    pieces.push({ string: false, text: outside }, { string: true, text: source.slice(at, end + 1) });
    outside = '';
    at = end;
  }
  pieces.push({ string: false, text: outside });
  return pieces;
}
const listed = (names) => names.join(', ') || 'none';

/** Why a Fairness's terms, as SANY's tree gives them, are not of engines.md §slot-forms's form (models.md §slot-answer check 4). */
function fairnessReasons(terms, actions, textOf) {
  const reasons = [];
  const operators = new Set(actions.map((r) => r.operator));
  const flat = (text) => String(text).replace(/\s+/g, ' ').trim();
  for (const term of terms ?? []) {
    const written = flat(textOf(term.at) ?? term.head);
    const said = (message) => reasons.push(`Fairness: the term ${written} ${message}`);
    if (!term.fairness) {
      if (term.head === '$BoundedForall' && term.body === '$BoundedForall') said("is under two \\A: a term stands under one \\A, or binds its row's parameters by one \\E at the head of the action inside WF_vars or SF_vars");
      else if (term.head !== '$BoundedForall' && quantifier(term.head)) said(`is under ${quantifier(term.head)}${term.head.startsWith('$Unbounded') ? ' without a set' : ''}: a term stands alone or under one \\A, and an \\E stands only at the head of the action inside WF_vars or SF_vars`);
      else said("is not WF_vars or SF_vars of an operator of the Actions table applied to its row's parameters");
      continue;
    }
    const { kind, subscript, action, exists } = term.fairness;
    if (subscript !== 'vars') said(`is not subscripted by vars: a term is ${kind}_vars of one operator of the Actions table`);
    const candidates = [];
    for (const conjunct of action) {
      const shown = flat(textOf(conjunct.at) ?? conjunct.name);
      if (conjunct.level === 0) continue;
      if (conjunct.kind === 'UserDefinedOpKind') candidates.push(conjunct);
      else if (quantifier(conjunct.name)) said(exists ? `holds ${shown}, a second quantifier inside the \\E at the head of its action` : `holds ${shown}, a quantifier beside other conjuncts of its action: an \\E stands at the head of the action inside ${kind}_vars`);
      else said(`holds ${shown}, which is neither an operator of the Actions table applied to its row's parameters nor a constant-level condition on them`);
    }
    if (candidates.length > 1) { said(`is of ${candidates.map((c) => c.name).join(' and ')}: each term is of one operator of the Actions table`); continue; }
    if (!candidates.length) { if (!action.some((c) => c.level !== 0)) said('is of no operator of the Actions table: a term is WF_vars or SF_vars of one'); continue; }
    const [applied] = candidates;
    if (!operators.has(applied.name)) continue;
    const bindings = [...(term.bounds ?? []).map((bound) => ({ by: '\\A', bound })), ...(exists ?? []).map((bound) => ({ by: '\\E', bound }))].flatMap(({ by, bound }) => bound.names.map((name) => ({ name, by, bound })));
    const rowReasons = (row) => {
      const found = [];
      const params = row.parameters.map((p) => p.name);
      const args = applied.args.map((a) => a.name);
      if (args.length !== params.length || args.some((a, at) => a !== params[at])) found.push(`applies ${applied.name} to ${applied.args.length ? `(${applied.args.map((a) => flat(textOf(a.at) ?? a.name ?? '?')).join(', ')})` : 'nothing'}, and its row's parameters are ${listed(params)}: apply ${applied.name} to them by their names, in the row's order`);
      if (!params.length) {
        if (bindings.length) found.push(`binds ${listed(bindings.map((b) => b.name))}, and the row of ${applied.name} has no parameter: its term stands alone`);
        return found;
      }
      for (const by of ['\\A', '\\E']) if ([...(by === '\\A' ? term.bounds ?? [] : exists ?? [])].some((b) => b.tuple)) found.push(`binds a tuple by its ${by}: bind each parameter by its own name`);
      for (const binding of bindings.filter((b) => !params.includes(b.name))) found.push(`binds ${binding.name} by its ${binding.by}, which is not a parameter of the row of ${applied.name}`);
      params.forEach((param, at) => {
        const own = bindings.filter((b) => b.name === param);
        if (!own.length) { found.push(`does not bind ${param}, a parameter of the row of ${applied.name}`); return; }
        if (own.length > 1) { found.push(`binds ${param} twice`); return; }
        const [{ by, bound }] = own;
        const { domain } = row.parameters[at];
        // The set as written is compared, so whitespace inside its strings stays as written; `set` is only how it is shown.
        const written = textOf(bound.set) ?? '?';
        const set = flat(written);
        if (unspaced(written) !== unspaced(domain)) found.push(`ranges ${param} over ${set} by its ${by}, and the row of ${applied.name} gives its domain as ${domain}: range it over that domain, written as the row writes it`);
        else if (bound.level !== 0 && by === '\\A') found.push(`ranges ${param} over ${domain} by its \\A, and that domain is not constant-level: bind ${param} by an \\E at the head of the action`);
      });
      return found;
    };
    const rows = actions.filter((r) => r.operator === applied.name).map(rowReasons);
    if (!rows.some((found) => !found.length)) for (const message of rows[0]) said(message);
  }
  return reasons;
}

/** Why a TLC encoding's `Fairness` is not of engines.md §slot-forms's form against the model's Actions table (models.md §slot-answer check 4); none when it defines no Fairness. */
function fairnessErrors(report, actions, source) {
  const fairness = report.root.definitions.find((op) => op.name === 'Fairness');
  if (!fairness) return [];
  const errors = [];
  if (fairness.arity !== 0) errors.push('Fairness takes no parameters');
  const allowed = new Set([...actions.map((r) => r.operator), 'vars']);
  const constant = (name) => report.operators.some((op) => op.name === name && op.level === 0);
  // What a quantifier's set names is the row's domain, which fairnessReasons checks against the row as written (engines.md §slot-forms).
  for (const name of fairness.refersOutsideBounds ?? fairness.refers) if (!allowed.has(name) && !constant(name)) errors.push(`Fairness names ${name}, which is neither in the Actions table nor a constant-level definition`);
  errors.push(...fairnessReasons(fairness.terms, actions, (at) => textAt(source, at, 'FormaSlot')));
  return errors;
}

/** The one predicate of each name the model's Alloy `files` define, with its file and the range the language server gives it; a name defined twice names no one predicate. */
export async function alloyPredicates(files) {
  const tools = await toolchain();
  const found = new Map();
  const twice = new Set();
  for (const file of Object.keys(files).filter((n) => n.endsWith('.als')).sort()) {
    for (const symbol of await alloySymbols(tools, files, file)) {
      if (symbol.kind !== 'pred') continue;
      if (found.has(symbol.name)) twice.add(symbol.name);
      else found.set(symbol.name, { file, range: symbol.range });
    }
  }
  for (const name of twice) found.delete(name);
  return Object.fromEntries(found);
}

/** A model file with a fault in place (engines.md §alloy): the action's predicate's range replaced by the slot's `pred Fault` and a predicate of the action's name and parameters applying `Fault` to them. */
export function faultedFile(text, range, native, row) {
  const names = row.parameters.map((p) => p.name);
  const alias = `pred ${row.operator}${names.length ? `[${row.parameters.map((p) => `${p.name}: ${p.domain}`).join(', ')}]` : ''} { ${names.length ? `Fault[${names.join(', ')}]` : 'Fault'} }`;
  return replaceRange(text, range, `${native}\n${alias}`);
}

/**
 * An Alloy schedule's start, values and bindings as the definitions code writes them, one a line (models.md
 * models.md §slot-answer check 5).
 */
export function scheduleDefinitions(form, rows) {
  const lines = [];
  const add = (kind, name, body, what, step = null) => lines.push({ kind, name, text: kind === 'pred' ? `pred ${name} { ${body} }` : `fun ${name}: set univ { ${body} }`, what, step });
  Object.entries(form.entities).forEach(([entity, value], at) => add('fun', `FormaEntity${at + 1}`, value, `the value of ${entity}`));
  if (form.start) add('pred', 'FormaStart', form.start, 'the start');
  rows.forEach((row, at) => {
    const bindings = form.steps[at]?.bindings ?? dict();
    if (!row || row.parameters.some((p) => bindings[p.name] === undefined)) return;
    row.parameters.forEach((p, k) => add('fun', `FormaArg${at + 1}x${k + 1}`, bindings[p.name], `step ${at + 1}'s binding of ${p.name}`, at + 1));
    const args = row.parameters.map((_, k) => `FormaArg${at + 1}x${k + 1}`);
    add('pred', `FormaStep${at + 1}`, `${row.operator}${args.length ? `[${args.join(', ')}]` : ''}`, `step ${at + 1}`, at + 1);
  });
  return lines;
}

/** The first and last places of `text` that are not whitespace, as 0-based line and character in Alloy's own lines, offset by `lines`. */
function span(text, lines) {
  const rows = alloyLines(text).map((line) => line.text);
  const first = rows.findIndex((row) => row.trim());
  let last = rows.length - 1;
  while (last > 0 && !rows[last].trim()) last -= 1;
  return { start: { line: first + lines, character: rows[first]?.search(/\S/) ?? 0 }, end: { line: last + lines, character: rows[last].replace(/\s+$/, '').length } };
}
const before = (a, b) => a.line < b.line || (a.line === b.line && a.character < b.character);

/** Checks 3 and 4 of models.md §slot-answer for an Alloy slot's native text, in a probe module opening the entry; for a fault, again where it is composed. */
async function alloySlotReasons(kind, native, model, files, faulted, fail) {
  const tools = await toolchain();
  const probe = `module FormaSlot\nopen ${moduleOf(model.entry)}\n${native}\n`;
  const all = { ...files, 'FormaSlot.als': probe };
  const parsed = await alloyParse(tools, all, 'FormaSlot.als');
  if (!parsed.ok) { fail(`Alloy refuses the slot: ${parsed.errors.map((e) => (e.file === 'FormaSlot.als' && e.line ? `line ${e.line - 2}: ${e.message}` : e.message)).join(' ')}`); return; }
  const want = kind === 'encoding' ? 'assert Claim' : kind === 'fault' ? 'pred Fault' : kind === 'schedule' ? 'pred End' : 'pred Target';
  const defined = await alloySymbols(tools, all, 'FormaSlot.als');
  const names = defined.map((s) => `${s.kind} ${s.name}`);
  if (names.length !== 1 || names[0] !== want) fail(`defines exactly ${want} and nothing else, and defines ${names.join(', ') || 'nothing'}`);
  else {
    const whole = span(native, 2);
    const { range } = defined[0];
    if (before(whole.start, range.start) || before(range.end, whole.end)) fail(`holds only its ${want}: its range does not cover the slot's whole text, so something stands beside it, such as a fact, an open, or a modifier before it`);
  }
  const apply = (row) => (row.parameters.length ? `some ${row.parameters.map((p) => `${p.name}: ${p.domain}`).join(', ')} | Fault[${row.parameters.map((p) => p.name).join(', ')}]` : 'Fault');
  // Target and a schedule's End take no parameters, a Fault those of its action's predicate (models.md §slot-answer check 3).
  const use = kind === 'encoding' ? null : kind === 'fault' ? (faulted ? apply(faulted) : null) : kind === 'schedule' ? 'End' : 'Target';
  if (use && names.length && (kind !== 'schedule' || names.includes(want))) {
    const applied = await alloyParse(tools, { ...files, 'FormaSlot.als': `${probe}pred FormaUse { ${use} }\n` }, 'FormaSlot.als');
    if (!applied.ok) fail(kind === 'fault' ? `Fault takes the parameters of ${faulted.operator}: ${applied.errors.map((e) => e.message).join(' ')}` : `${use} takes no parameters: ${applied.errors.map((e) => e.message).join(' ')}`);
  }
  if (kind === 'fault' && faulted) {
    const at = (await alloyPredicates(files))[faulted.operator];
    if (!at) fail(`the language server gives no one predicate ${faulted.operator} in the model's files, so the fault has no range to replace`);
    else {
      const composed = await alloyParse(tools, { ...files, [at.file]: faultedFile(String(files[at.file]), at.range, native, faulted) }, model.entry);
      if (!composed.ok) fail(`Alloy refuses the fault where it is composed, in ${at.file} in place of ${faulted.operator}: ${composed.errors.map((e) => e.message).join(' ')}`);
    }
  }
}

/** Check 3 of models.md §slot-answer for a TLC slot's native text, in a module extending the entry, with check 4's fault arity and fairness. */
async function tlcSlotReasons(kind, native, model, files, ctx, fail) {
  const entry = model.entry.replace(/\.tla$/, '');
  const source = `---- MODULE FormaSlot ----\nEXTENDS ${entry}\n${native}\n====\n`;
  const report = await parse(files, 'FormaSlot', { 'FormaSlot.tla': source });
  if (!report.ok) { fail(`SANY refuses the slot: ${report.messages.join(' ')}`); return; }
  const { definitions, declarations, instances, other } = report.root;
  const names = definitions.map((op) => op.name).sort();
  let want;
  if (kind === 'encoding') {
    // Exactly one of Invariant and Property; for a claim of kind liveness, Property and Fairness (engines.md §slot-forms).
    want = ctx.claimKind === 'liveness' ? ['Property', 'Fairness'] : [names.includes('Property') ? 'Property' : 'Invariant'];
  } else want = kind === 'fault' ? ['Fault'] : kind === 'schedule' ? ['End'] : ['Target'];
  if (names.join(',') !== [...want].sort().join(',')) fail(`defines exactly ${want.join(' and ')}, and defines ${names.join(', ') || 'nothing'}`);
  if (declarations.some((d) => d.module === 'FormaSlot')) fail('declares no variable or constant');
  if (instances.length) fail('brings in no module');
  for (const k of other) fail(`holds nothing but its definitions, and holds ${k === 'TheoremNode' ? 'a THEOREM' : k === 'AssumeNode' ? 'an ASSUME' : k}`);
  const defined = (name) => definitions.find((op) => op.name === name);
  // A schedule's End is a state predicate, of level 1 or less as SANY reads it, like a witness's Target (models.md §slot-answer check 5).
  const shapes = { Invariant: [0, 1, 'a state predicate'], Property: [3, 3, 'a temporal formula'], Target: [0, 1, 'a state predicate'], End: [0, 1, 'a state predicate'] };
  for (const [name, [lo, hi, what]] of Object.entries(shapes)) {
    const op = defined(name);
    if (!op || !want.includes(name)) continue;
    for (const message of definitionReasons(op, { levels: lo === hi ? [lo] : [lo, hi], kind: what })) fail(message);
  }
  const fault = defined('Fault');
  if (kind === 'fault' && fault) {
    if (ctx.faulted && fault.arity !== ctx.faulted.parameters.length) fail(`Fault takes the ${ctx.faulted.parameters.length} parameters of ${ctx.faulted.operator}`);
    if (fault.level > 2) fail(`Fault is an action; SANY reads it as ${LEVELS[fault.level]}`);
  }
  for (const message of fairnessErrors(report, model.actions, source)) fail(message);
}

/** Why an overlay's or effect's outcome is not written as a cell of `lifecycle` for `action` (forms.md §lifecycles); none when it is. */
function cellReasons(cell, lifecycle, action, part) {
  const reasons = [];
  const outcome = (o) => {
    if (o.kind === 'phase' && !lifecycle.phases.includes(o.phase)) reasons.push(`${o.phase} is not a phase of ${lifecycle.key}`);
    if (o.kind === 'choice' && !part.thingPages.choices.get(o.choice)?.exists) reasons.push(`no choice ${o.choice} in ${part.key}`);
  };
  const cases = action?.cases ?? [];
  if (cell.kind === 'cases') {
    for (const piece of cell.bad) reasons.push(`"${piece}" is not <case>: <outcome>`);
    if (!cases.length) reasons.push(`${action?.key ?? 'the action'} has no cases`);
    const named = cell.cases.map((c) => c.case);
    for (const name of cases) if (named.filter((n) => n === name).length !== 1) reasons.push(`the case ${name} has ${named.filter((n) => n === name).length} outcomes; one`);
    for (const item of cell.cases) {
      if (cases.length && !cases.includes(item.case)) reasons.push(`${item.case} is not a case of ${action.key}`);
      outcome(item.outcome);
    }
  } else if (cell.kind !== 'empty') {
    if (cases.length) reasons.push(`${action.key} has cases, so the outcome gives each of them`);
    outcome(cell);
  }
  return reasons;
}

/**
 * Checks 2 to 5 of models.md §slot-answer for one slot against its model and the restatement as they stand (models.md §slot-currency item
 * 4), `ctx` giving `model`, `files`, `restatement`, `claim`, `journey` and `from`: reasons in door.md §forma-answer's form.
 */
export async function slotReasons(slot, text, ctx) {
  const { model, files = {}, restatement } = ctx;
  const path = slot.path;
  const reasons = new Reasons(path, 'models.md §slot-answer');
  const fail = (says, field = null, check = 'models.md §slot-answer') => reasons.fail(ctx.claim?.entry ?? ctx.journey?.entry ?? null, field, says, check);
  const engine = model.engine;
  const { form, reasons: formReasons } = parseSlot(slot.kind, slot.extension, text, engine, path);
  reasons.list.push(...formReasons);
  // On a lifecycle model, a claim of kind liveness gives a reason, since a forbidden form is no liveness property (engines.md §slot-forms).
  if (engine === 'lifecycle' && slot.kind === 'encoding' && form.forbidden && ctx.claim?.claimKind === 'liveness') fail('a claim of kind liveness gives a reason on a lifecycle model, since a forbidden form is no liveness property', null, 'engines.md §slot-forms');
  const part = restatement.parts.get(model.parts[0]);
  const faulted = slot.kind === 'fault' && engine !== 'lifecycle' && form.action ? model.actions.find((r) => r.action === form.action) ?? null : null;
  if (slot.kind === 'fault' && engine !== 'lifecycle' && form.action && !faulted) fail(`${form.action} is not a row of the model's Actions table`, 'Action');
  try {
    if (engine === 'tlc' && form.native !== undefined) await tlcSlotReasons(slot.kind, form.native, model, files, { claimKind: ctx.claim?.claimKind, faulted }, (says) => fail(says));
    if (engine === 'alloy' && form.native !== undefined) await alloySlotReasons(slot.kind, form.native, model, files, faulted, (says) => fail(says));
    if (slot.kind === 'schedule' && ctx.journey) await scheduleReasons(form, ctx, fail);
  } catch (error) {
    fail(`the parser could not finish: ${error.message}`, null, 'door.md §forma-answer');
  }
  if (engine === 'lifecycle' && part) {
    const lifecycleOf = (key) => part.things.lifecycles.get(key);
    const target = form.forbidden ?? form.target;
    for (const row of target?.combination ?? []) {
      const lifecycle = lifecycleOf(row.lifecycle);
      if (!lifecycle) fail(`${part.key} has no lifecycle ${row.lifecycle}`, 'Lifecycle');
      else if (!lifecycle.phases.includes(row.phase)) fail(`${row.lifecycle} has no phase ${row.phase}`, 'Phase');
    }
    if (target?.transition) {
      const t = target.transition;
      const lifecycle = lifecycleOf(t.lifecycle);
      if (!lifecycle) fail(`${part.key} has no lifecycle ${t.lifecycle}`, 'Lifecycle');
      else {
        for (const phase of new Set([t.from, t.to])) if (!lifecycle.phases.includes(phase)) fail(`${t.lifecycle} has no phase ${phase}`, 'Phase');
        if (!lifecycle.actions.includes(t.action)) fail(`${t.lifecycle} has no column ${t.action}`, 'Action');
      }
    }
    const cells = new Set();
    for (const row of form.overlay ?? []) {
      const lifecycle = lifecycleOf(row.lifecycle);
      const where = `${row.lifecycle} | ${row.phase} | ${row.action}`;
      if (!lifecycle?.phases.includes(row.phase) || !lifecycle.actions.includes(row.action)) { fail(`the overlay names no cell ${where}`, 'Lifecycle'); continue; }
      if (cells.has(where)) fail(`the overlay names the cell ${where} twice; each at most once`, 'Lifecycle');
      cells.add(where);
      for (const message of cellReasons(row.outcome, lifecycle, part.actions.find((a) => a.key === row.action), part)) fail(`the overlay's cell ${where}: ${message}`, 'Outcome');
    }
  }
  return reasons.list;
}

/**
 * Check 5 of models.md §slot-answer for a schedule: one Steps row per step of its journey, each binding
 * exactly the parameters of its step's operator; a value for every entity the journey names and
 * every entity a step with a case moves (lifecycle-tool.md §stepping); a start table exactly when the journey
 * has one; its end exactly when the journey should happen, End's block being check 3's; and the
 * start, each value and each binding put to the engine's parser.
 */
async function scheduleReasons(form, ctx, fail) {
  const { model, files, restatement, journey, from } = ctx;
  if (!form.steps) return;
  if (form.steps.length !== journey.steps.length) fail(`the schedule has ${form.steps.length} steps, and the journey has ${journey.steps.length}`, 'Step');
  const { named, steps } = journeyEntities(restatement, journey, from);
  const required = new Set([...named.values()].flat());
  journey.steps.forEach((step, at) => {
    if (step.case !== null) for (const move of steps[at]?.moves ?? []) required.add(move.entity);
  });
  for (const name of required) if (!Object.hasOwn(form.entities, name)) fail(`the entity table gives no value for ${name}`, 'Entity');
  if (Boolean(form.start) !== Boolean(journey.start?.length)) fail(journey.start?.length ? 'the journey has a start, so the schedule has a start table' : 'the journey has no start, so the schedule has no start table', 'Start');
  // Its end is there exactly when its journey should happen (engines.md §slot-forms Schedule 4); End's block is check 3's.
  const should = journey.polarity !== 'must not';
  if (should && !form.end) fail(`the journey should happen, so the schedule has its end: a field table | Meaning | … |, how End reads the journey's Expected end, then one fenced ${model.engine === 'alloy' ? 'alloy block defining pred End' : 'tla block defining End'}`, 'Meaning');
  if (!should && form.end) fail('the journey must not happen, so the schedule has no end and defines no End', 'Meaning');
  const rows = journey.steps.map((step) => {
    const ref = resolveRef(restatement, step.action, from, 'actions');
    return ref.part && ref.key ? model.actions.find((r) => r.action === `${ref.part}/${ref.key}`) ?? null : null;
  });
  const calls = [];
  journey.steps.forEach((step, at) => {
    const row = rows[at];
    const bindings = form.steps[at]?.bindings ?? dict();
    if (!row) { fail(`step ${step.step}: its action has no row in the model's Actions table`, 'Bindings'); return; }
    const params = row.parameters.map((p) => p.name);
    if (Object.keys(bindings).sort().join(',') !== [...params].sort().join(',')) fail(`step ${step.step} binds exactly the parameters of ${row.operator}: ${params.join(', ') || 'none'}`, 'Bindings');
    else calls.push(`FormaStep${at + 1} == ${row.operator}${params.length ? `(${params.map((p) => bindings[p]).join(', ')})` : ''}`);
  });
  if (model.engine === 'tlc') {
    const lines = [...(form.start ? [`FormaStart == ${form.start}`] : []), ...Object.values(form.entities).map((value, at) => `FormaEntity${at + 1} == ${value}`), ...calls];
    if (!lines.length) return;
    const report = await parse(files, 'FormaSchedule', { 'FormaSchedule.tla': tlaModule('FormaSchedule', model.entry.replace(/\.tla$/, ''), lines) });
    if (!report.ok) { fail(`SANY refuses the schedule's start, values or bindings: ${report.messages.join(' ')}`); return; }
    const start = report.root.definitions.find((d) => d.name === 'FormaStart');
    if (start) for (const message of definitionReasons(start, { levels: [0, 1], kind: 'a state predicate', as: 'the start' })) fail(message, 'Start');
    Object.keys(form.entities).forEach((name, at) => {
      const value = report.root.definitions.find((d) => d.name === `FormaEntity${at + 1}`);
      if (value) for (const message of definitionReasons(value, { levels: [0], kind: 'a constant-level expression', as: `the value of ${name}` })) fail(message, 'Value');
    });
  }
  if (model.engine === 'alloy') {
    const lines = scheduleDefinitions(form, rows);
    if (!lines.length) return;
    const tools = await toolchain();
    const all = { ...files, 'FormaSchedule.als': `module FormaSchedule\nopen ${moduleOf(model.entry)}\n${lines.map((l) => l.text).join('\n')}\n` };
    const parsed = await alloyParse(tools, all, 'FormaSchedule.als');
    if (!parsed.ok) {
      const piece = (e) => (e.file === 'FormaSchedule.als' && lines[e.line - 3] ? `${lines[e.line - 3].what}: ` : '');
      fail(`Alloy refuses the schedule's start, values or bindings: ${parsed.errors.map((e) => `${piece(e)}${e.message}`).join(' ')}`);
      return;
    }
    const { stray, more } = strayLines(await alloySymbols(tools, all, 'FormaSchedule.als'), lines, 2);
    for (const line of stray) fail(`${line.what} is one whole native ${line.kind === 'pred' ? 'formula' : 'expression'}: it ends the definition code writes it into, or adds a definition or a fact beside it`);
    if (!stray.length && more) fail('the schedule adds a definition beside those code writes');
  }
}
