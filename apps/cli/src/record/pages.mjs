// The restatement's pages: Markdown read as forms.md §page-rules's tables and cells, every page parsed
// into its entries (forms.md §front-pages to §thing-pages, check 1 of design.md §restate-checks), and the restatement resolved and placed
// as a whole (checks 2 and 3), with what a thing's parts are and which parts form a span (forms.md §surface,
// design.md §filing). Code writes no page here: pages enter through answers and redirects (design.md §paths, §restate).

import MarkdownIt from 'markdown-it';
import { compare, dict, sortedBy } from './json.mjs';
import { isKey, PART_KINDS, SPAN_KINDS } from './tree.mjs';

const markdown = new MarkdownIt('commonmark').enable('table');

/** An entry's origins (forms.md §page-rules). */
const ORIGINS = ['stated', 'added'];
/** A boundary row's kinds (forms.md §boundary). */
const ROW_KINDS = ['actor', 'service', 'store', 'queue', 'clock', 'entity'];
/** The kinds of boundary row that act: actors, services, queues and clocks (forms.md §actions, §boundary). */
export const ACTING = ['actor', 'service', 'queue', 'clock'];
/** A boundary row's sides (forms.md §boundary). */
const SIDES = ['machine', 'world'];
/** A world row's seams (forms.md §boundary). */
const SEAMS = ['request-response', 'webhook', 'queue', 'clock', 'person'];
/** A surface row's directions (forms.md §surface). */
const DIRECTIONS = ['emits', 'consumes', 'reads', 'writes', 'calls'];
/** A journey's polarities (forms.md §journeys). */
const POLARITIES = ['should happen', 'must not'];
/** A claim's kinds (forms.md §claims). */
const CLAIM_KINDS = ['safety', 'liveness', 'structure'];
/** A premise's classes (forms.md §premises). */
const PREMISE_CLASSES = ['world', 'promise', 'fairness', 'atomicity', 'bound', 'omission'];
/** Why a premise is not examined (forms.md §premises). */
const WHY_NOT = ['impossible', 'not worth the cost', 'not verifiable here'];

/** The anomalies of forms.md §store-premises, in the order a store premise names them. */
export const ANOMALIES = ['dirty read', 'read skew', 'lost update', 'write skew', 'phantom'];

/** What each isolation permits (forms.md §store-premises); a doubtful cell of the matrix counts as permitted. */
export const PERMITS = Object.freeze({
  'read uncommitted': ANOMALIES,
  'read committed': ANOMALIES.slice(1),
  'postgres read committed': ANOMALIES.slice(1),
  'oracle read committed': ANOMALIES.slice(1),
  'sql server read committed': ANOMALIES.slice(1),
  'snapshot isolation': ['write skew', 'phantom'],
  'postgres repeatable read': ['write skew', 'phantom'],
  'oracle serializable': ['write skew', 'phantom'],
  'sql server snapshot': ['write skew', 'phantom'],
  'mysql repeatable read': ['lost update', 'write skew', 'phantom'],
  'sql server repeatable read': ['read skew', 'phantom'],
  serializable: [],
  'postgres serializable': [],
  'sql server serializable': [],
  'mysql serializable': [],
  'cockroachdb serializable': [],
  unknown: ANOMALIES,
});
/** The isolations a store row may name (forms.md §store-premises). */
const ISOLATIONS = Object.keys(PERMITS);

// --- Markdown as blocks (forms.md §page-rules) ------------------------------------------------------------------

/**
 * The cells a table row was written with: its text split at each `|` not escaped, the row's own
 * outer ones aside, as markdown-it's table rule splits it, which drops a cell too many and fills
 * one too few (forms.md §page-rules).
 */
function cellsWritten(line) {
  const text = String(line ?? '').trim();
  const cells = [];
  let current = '';
  let last = 0;
  let escaped = false;
  for (let at = 0; at < text.length; at += 1) {
    const ch = text[at];
    if (ch === '|') {
      if (!escaped) {
        cells.push(current + text.slice(last, at));
        current = '';
        last = at + 1;
      } else {
        current += text.slice(last, at - 1);
        last = at;
      }
    }
    escaped = ch === '\\';
  }
  cells.push(current + text.slice(last));
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells.length;
}

/** A cell's text as forms.md §page-rules reads it: trimmed, `\|` as `|`, one code span without its backticks. */
function cellValue(content) {
  const text = String(content).trim();
  if (text.startsWith('`')) {
    const children = markdown.parseInline(text, {})[0]?.children ?? [];
    if (children.length === 1 && children[0].type === 'code_inline') return children[0].content;
  }
  return text;
}

/** One ordered or bullet list's items: each item's destination when it is one link and nothing else, or null. */
function listItems(tokens, from, closer) {
  const items = [];
  let item = null;
  let at = from + 1;
  for (; at < tokens.length; at += 1) {
    const t = tokens[at];
    if (t.type === closer && t.level === 0) break;
    if (t.type === 'list_item_open' && t.level === 1) item = { line: (t.map?.[0] ?? 0) + 1, tokens: [] };
    else if (t.type === 'list_item_close' && t.level === 1) {
      const inner = item.tokens;
      let destination = null;
      if (inner.length === 3 && inner[0].type === 'paragraph_open' && inner[1].type === 'inline' && inner[2].type === 'paragraph_close') {
        const children = inner[1].children ?? [];
        const links = children.filter((c) => c.type === 'link_open').length;
        if (links === 1 && children[0]?.type === 'link_open' && children[children.length - 1]?.type === 'link_close') destination = children[0].attrGet('href');
      }
      items.push({ line: item.line, destination });
      item = null;
    } else if (item) item.tokens.push(t);
  }
  return { items, end: at };
}

/**
 * A Markdown page's top-level blocks in order (forms.md §page-rules): headings, tables with each row's cells and the
 * number it was written with, paragraphs, lists of links, fences.
 */
export function readBlocks(text) {
  const source = String(text).replace(/\r\n?/g, '\n');
  const lines = source.split('\n');
  const tokens = markdown.parse(source, {});
  const found = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.level !== 0 || token.nesting === -1 || !token.map) continue;
    const line = token.map[0] + 1;
    if (token.type === 'heading_open') {
      found.push({ type: 'heading', level: Number(token.tag.slice(1)), text: (tokens[index + 1]?.content ?? '').trim(), line });
    } else if (token.type === 'table_open') {
      const columns = [];
      const rows = [];
      let inHead = false;
      let row = null;
      for (index += 1; tokens[index].type !== 'table_close'; index += 1) {
        const t = tokens[index];
        if (t.type === 'thead_open') inHead = true;
        else if (t.type === 'thead_close') inHead = false;
        else if (t.type === 'tr_open') row = { cells: [], line: t.map ? t.map[0] + 1 : null, written: t.map ? cellsWritten(lines[t.map[0]]) : null };
        else if (t.type === 'tr_close') {
          if (inHead) columns.push(...row.cells);
          else rows.push(row);
        } else if (t.type === 'inline') row.cells.push(cellValue(t.content));
      }
      found.push({ type: 'table', columns, header: columns.map((c) => c.trim().toLowerCase()), rows, line });
    } else if (token.type === 'paragraph_open') {
      found.push({ type: 'paragraph', text: tokens[index + 1]?.content ?? '', line });
    } else if (token.type === 'ordered_list_open' || token.type === 'bullet_list_open') {
      const closer = token.type.replace('_open', '_close');
      const { items, end } = listItems(tokens, index, closer);
      found.push({ type: 'list', ordered: token.type === 'ordered_list_open', items, line });
      index = end;
    } else if (token.type === 'fence') {
      found.push({ type: 'fence', info: token.info.trim(), content: token.content, markup: token.markup, line });
    } else {
      found.push({ type: token.type.replace(/_open$/, ''), line });
    }
  }
  return found;
}

/** Whether a page's text begins with front matter, a YAML block between `---` lines at its top (design.md §brief, forms.md §page-rules). */
function hasFrontMatter(text) {
  const normal = String(text).replace(/\r\n?/g, '\n');
  return normal.startsWith('---\n') && (normal.indexOf('\n---\n', 3) !== -1 || normal.endsWith('\n---'));
}

// --- The form of a table and its cells (forms.md §page-rules) --------------------------------------------------

/** One file's failures, each a reason in door.md §forma-answer's form: `{ check, file, entry, field, says }`. */
export class Reasons {
  constructor(file, check) {
    this.file = file;
    this.check = check;
    this.list = [];
  }

  fail(entry, field, says, check = this.check) {
    this.list.push({ check, file: this.file, entry: entry ?? null, field: field ?? null, says });
  }
}

/**
 * A table with exactly `columns` (forms.md §page-rules): its rows as objects by column name, or null when a column is
 * missing, extra or repeated; uneven rows and empty cells are form errors.
 */
export function readTable(block, columns, reasons, { entry = null, entryOf = null, rowName = (at) => `row ${at + 1}`, empty = false, check } = {}) {
  const want = columns.map((c) => c.toLowerCase());
  const have = block.header;
  const before = reasons.list.length;
  const exactly = `the table at line ${block.line} has exactly the columns ${columns.join(', ')}`;
  have.forEach((name, at) => {
    if (!want.includes(name)) reasons.fail(entry, block.columns[at] || `column ${at + 1}`, `${exactly}, and this is not one of them`, check);
    else if (have.indexOf(name) !== at) reasons.fail(entry, columns[want.indexOf(name)], `${exactly}, and this one is repeated`, check);
  });
  want.forEach((name, at) => {
    if (!have.includes(name)) reasons.fail(entry, columns[at], `${exactly}, and this one is missing`, check);
  });
  if (reasons.list.length > before) return null;
  return block.rows.map((row, at) => {
    const value = Object.fromEntries(columns.map((name, k) => [name, row.cells[have.indexOf(want[k])] ?? '']));
    const who = entryOf ? entryOf(value, at) : entry;
    if (row.written !== null && row.written !== columns.length) reasons.fail(who, null, `${rowName(at)} of the table at line ${block.line} holds ${row.written} cells for its ${columns.length} columns: a | inside a cell is written \\|`, check);
    if (!empty) for (const name of columns) if (value[name] === '') reasons.fail(who, name, `${rowName(at)} of the table at line ${block.line} has an empty cell: every cell holds text`, check);
    value.line = row.line;
    return value;
  });
}

/**
 * A field table, `| Field | Value |` with each of `fields` once (forms.md §page-rules): an object by field name, or null
 * when the block is no such table.
 */
export function readFields(block, fields, reasons, { entry = null, check, optional = [] } = {}) {
  if (block?.type !== 'table') return null;
  const rows = readTable(block, ['Field', 'Value'], reasons, { entry, check, rowName: (at) => `field row ${at + 1}`, empty: true });
  if (!rows) return null;
  const known = new Map(fields.map((name) => [name.toLowerCase(), name]));
  const out = {};
  for (const row of rows) {
    const name = known.get(row.Field.trim().toLowerCase());
    if (row.Field === '') reasons.fail(entry, null, `a row of the field table at line ${block.line} names no field`, check);
    else if (!name) reasons.fail(entry, row.Field, `"${row.Field}" is not a field of this table, whose fields are ${fields.join(', ')}`, check);
    else if (Object.hasOwn(out, name)) reasons.fail(entry, name, 'the field is given twice; each is given once', check);
    else {
      out[name] = row.Value;
      if (row.Value === '') reasons.fail(entry, name, 'the value is empty: every cell holds text', check);
    }
  }
  for (const name of fields) if (!Object.hasOwn(out, name) && !optional.includes(name)) reasons.fail(entry, name, 'the field is missing', check);
  return out;
}

/** A list cell's items (forms.md §page-rules), `none` the empty list; null when it is not written `, ` exactly. */
export function readList(value) {
  const text = String(value ?? '');
  if (text === 'none') return [];
  if (text === '') return null;
  const items = text.split(', ');
  return items.every((item) => item !== '' && item === item.trim() && !item.includes(',')) ? items : null;
}

/** A lifecycle cell's outcome (forms.md §lifecycles): a phase, `None.`, `choice:<key>`, or nothing. */
function readOutcome(text) {
  const value = String(text).trim();
  if (value === '') return { kind: 'empty' };
  if (value === 'None.') return { kind: 'refused' };
  // `choice:` with no space after the colon names a choice; whether what follows is a choice's key is check 2's (design.md §at-read).
  if (/^choice:\S/.test(value)) return { kind: 'choice', choice: value.slice('choice:'.length) };
  return { kind: 'phase', phase: value };
}

/**
 * A lifecycle cell (forms.md §lifecycles), an outcome or a cell of cases, each `<case>: <outcome>` separated by `<br>`,
 * with `bad` for each piece not so written.
 */
export function readCell(text) {
  const value = String(text).trim();
  if (value === '') return { kind: 'empty' };
  if (value === 'None.') return { kind: 'refused' };
  if (!value.includes('<br>') && /^choice:\S/.test(value)) return { kind: 'choice', choice: value.slice('choice:'.length) };
  if (!value.includes('<br>') && !value.includes(':')) return { kind: 'phase', phase: value };
  const cases = [];
  const bad = [];
  for (const piece of value.split('<br>')) {
    const at = piece.indexOf(':');
    const name = at === -1 ? '' : piece.slice(0, at).trim();
    const after = at === -1 ? '' : piece.slice(at + 1);
    if (at === -1 || name === '' || (after !== '' && !/^\s/.test(after))) bad.push(piece.trim());
    else cases.push({ case: name, outcome: readOutcome(after) });
  }
  return { kind: 'cases', cases, bad };
}

/** A cell or outcome written back as forms.md §lifecycles writes it. */
function cellText(cell) {
  if (cell.kind === 'empty') return '';
  if (cell.kind === 'refused') return 'None.';
  if (cell.kind === 'choice') return `choice:${cell.choice}`;
  if (cell.kind === 'phase') return cell.phase;
  return cell.cases.map((item) => `${item.case}: ${cellText(item.outcome)}`.trimEnd()).join('<br>');
}

// --- Pages (forms.md §front-pages to §thing-pages) -------------------------------------------------------------------------------

/** Reasons that name one entry (door.md §forma-answer's `entry`), each `says` led by `label` where one is given. */
function scoped(reasons, entry, label = null) {
  return {
    get list() { return reasons.list; },
    fail: (named, field, says, check) => reasons.fail(entry === undefined ? named : entry, field, label ? `${label}: ${says}` : says, check),
  };
}

/**
 * The opening every page shares (forms.md §page-rules): no front matter, its one level-1 heading on its
 * first line. Gives the blocks after the heading, and the heading's text.
 */
function opening(text, reasons, check = 'forms.md §page-rules') {
  const blocks = readBlocks(text);
  if (hasFrontMatter(text)) reasons.fail(null, null, 'a page holds no front matter', check);
  const first = blocks[0];
  if (!first || first.type !== 'heading' || first.level !== 1 || first.line !== 1) reasons.fail(null, null, 'a page begins on its first line with its level-1 heading', check);
  const headings = blocks.filter((b) => b.type === 'heading' && b.level === 1).length;
  if (headings > 1) reasons.fail(null, null, `a page holds one level-1 heading, and this one holds ${headings}`, check);
  const heading = first?.type === 'heading' && first.level === 1 ? first.text : null;
  return { heading, rest: first?.type === 'heading' && first.level === 1 ? blocks.slice(1) : blocks };
}

/** Each block beyond what a form gives, a form error (forms.md §page-rules). */
function nothingElse(blocks, reasons, what, check = 'forms.md §page-rules') {
  for (const block of blocks) reasons.fail(null, null, `line ${block.line} holds a ${block.type}, and ${what}`, check);
}

/** The reading order (forms.md §reading-order): an ordered list whose every item is one link to a folder's path ending in `/`. */
function readingOrder(block, reasons, shapes, check = 'forms.md §reading-order') {
  if (!block) return [];
  if (block.type !== 'list' || !block.ordered) {
    reasons.fail(null, null, `line ${block.line}: the reading order is an ordered list`, check);
    return [];
  }
  const order = [];
  for (const item of block.items) {
    if (item.destination === null) {
      reasons.fail(null, null, `the reading order's item at line ${item.line} is one link and nothing else`, check);
      continue;
    }
    const match = /^([^/]+)\/([^/]+)\/$/.exec(item.destination);
    if (!match || !shapes.includes(match[1])) {
      reasons.fail(null, null, `the reading order's link at line ${item.line} goes to "${item.destination}", and a link goes to ${shapes.map((s) => `${s}/<key>/`).join(' or ')}`, check);
      continue;
    }
    order.push({ kind: match[1], key: match[2], destination: item.destination, line: item.line });
  }
  return order;
}

/** A `Cites` value (forms.md §page-rules): one or more passage addresses as a list. */
function readCites(value, reasons, entry, check) {
  const items = readList(value);
  if (items === null) {
    reasons.fail(entry, 'Cites', `"${value}" is not a list of passage addresses separated by ", "`, check);
    return [];
  }
  if (!items.length) reasons.fail(entry, 'Cites', 'an entry cites one or more passages', check);
  return items;
}

/** A value of one of `allowed` (forms.md §part-tables, §thing-pages). */
function oneOf(value, allowed, reasons, entry, field, check) {
  if (!allowed.includes(value)) reasons.fail(entry, field, `"${value}" is not one of ${allowed.join(', ')}`, check);
  return value;
}

/** A list cell's items, or [] with a form error (forms.md §page-rules). */
function listOf(value, reasons, entry, field, check) {
  const items = readList(value);
  if (items === null) {
    reasons.fail(entry, field, `"${value}" is not a list of items separated by ", ", or none`, check);
    return [];
  }
  return items;
}

/** The part list, `design/README.md` (forms.md §part-list). */
function parsePartList(text, reasons) {
  const check = 'forms.md §part-list';
  const { rest } = opening(text, reasons);
  const page = { rows: [], order: [] };
  const table = rest[0];
  if (table?.type !== 'table') {
    reasons.fail(null, null, 'the heading is followed by the part list, | Part | Purpose | Cites |', check);
    return page;
  }
  // A part list's rows are the unit `parts` (design.md §units); each reason names the row's key in what it says.
  const rows = readTable(table, ['Part', 'Purpose', 'Cites'], reasons, { check, entry: 'parts' }) ?? [];
  page.rows = rows.map((row) => ({ key: row.Part, purpose: row.Purpose, cites: readCites(row.Cites, scoped(reasons, 'parts', `the part ${row.Part}`), 'parts', check), line: row.line }));
  const list = rest[1];
  page.order = readingOrder(list, reasons, ['parts', 'spans']);
  nothingElse(rest.slice(list ? 2 : 1), reasons, 'design/README.md holds its heading, the part list and the reading order, and nothing else');
  return page;
}

/** A part's README.md (forms.md §part-readme): its name, then the reading order of its things. */
function parsePartReadme(text, reasons) {
  const { heading, rest } = opening(text, reasons);
  const page = { name: heading ?? '', order: readingOrder(rest[0], reasons, PART_KINDS) };
  nothingElse(rest.slice(rest[0] ? 1 : 0), reasons, "a part's README.md holds its name and its reading order, and nothing else");
  return page;
}

/** A span's README.md (forms.md §spans): its name, one paragraph of its purpose, then the reading order of its things. */
function parseSpanReadme(text, reasons) {
  const check = 'forms.md §spans';
  const { heading, rest } = opening(text, reasons);
  const page = { name: heading ?? '', purpose: '', order: [] };
  if (rest[0]?.type !== 'paragraph') {
    reasons.fail(null, null, "a span's heading is followed by one paragraph, a sentence of its purpose", check);
    return page;
  }
  page.purpose = rest[0].text;
  page.order = readingOrder(rest[1], reasons, SPAN_KINDS);
  nothingElse(rest.slice(rest[1] ? 2 : 1), reasons, "a span's README.md holds its name, its purpose and its reading order, and nothing else");
  return page;
}

/** A part's actions.md (forms.md §actions). */
function parseActions(text, reasons, holder) {
  const check = 'forms.md §actions';
  const { rest } = opening(text, reasons);
  // A heading, then its table, which may have no rows (forms.md §part-tables): an absent table file holds no rows, an existing page its table.
  if (rest[0]?.type !== 'table') {
    reasons.fail(null, null, 'the heading is followed by the actions table, which may have no rows', check);
    return { actions: [] };
  }
  nothingElse(rest.slice(1), reasons, 'actions.md holds its heading and its table, and nothing else');
  const named = (key) => (key ? `${holder}/actions/${key}` : null);
  const rows = readTable(rest[0], ['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'], reasons, { check, entryOf: (row) => named(row.Action) }) ?? [];
  return {
    actions: rows.map((row) => {
      const entry = named(row.Action);
      const cases = listOf(row.Cases, reasons, entry, 'Cases', check);
      if (cases.length === 1) reasons.fail(entry, 'Cases', 'an action with cases has two or more', check);
      return {
        key: row.Action,
        actor: row.Actor,
        sentence: row.Sentence,
        cases,
        guard: row.Guard === 'none' ? null : row.Guard,
        origin: oneOf(row.Origin, ORIGINS, reasons, entry, 'Origin', check),
        cites: readCites(row.Cites, reasons, entry, check),
        line: row.line,
      };
    }),
  };
}

/** One boundary row (forms.md §boundary): each field that does not apply is `-`. */
function boundaryRow(row, reasons, check, holder) {
  const entry = row.Row ? `${holder}/boundary/${row.Row}` : null;
  const kind = oneOf(row.Kind, ROW_KINDS, reasons, entry, 'Kind', check);
  const side = oneOf(row.Side, SIDES, reasons, entry, 'Side', check);
  const seamed = side === 'world' && ACTING.includes(kind);
  const shared = kind === 'store' || kind === 'entity';
  const dash = (field) => {
    if (row[field] !== '-') reasons.fail(entry, field, `the field does not apply to a ${side} ${kind}, so it is -`, check);
    return null;
  };
  const refs = (field) => listOf(row[field], reasons, entry, field, check);
  // The row's Kind is `rowKind`: an entry's `kind` is the kind of entry it is (design.md §pins).
  return {
    key: row.Row,
    names: row.Names,
    rowKind: kind,
    side,
    seam: seamed ? oneOf(row.Seam, SEAMS, reasons, entry, 'Seam', check) : dash('Seam'),
    isolation: kind === 'store' ? oneOf(row.Isolation, ISOLATIONS, reasons, entry, 'Isolation', check) : dash('Isolation'),
    reads: shared ? refs('Reads') : dash('Reads'),
    writes: shared ? refs('Writes') : dash('Writes'),
    origin: oneOf(row.Origin, ORIGINS, reasons, entry, 'Origin', check),
    cites: readCites(row.Cites, reasons, entry, check),
    line: row.line,
  };
}

/** A part's boundary.md (forms.md §boundary, §surface): `## Boundary` with its table, then `## Surface` with its table, either left out. */
function parseBoundary(text, reasons, holder) {
  const check = 'forms.md §boundary';
  const { rest } = opening(text, reasons);
  const page = { boundary: [], surface: [] };
  let at = 0;
  const section = (name) => {
    if (rest[at]?.type !== 'heading' || rest[at].level !== 2 || rest[at].text !== name) return null;
    const table = rest[at + 1];
    if (table?.type !== 'table') {
      reasons.fail(null, name, `## ${name} holds its table`, check);
      at += 1;
      return null;
    }
    at += 2;
    return table;
  };
  const boundary = section('Boundary');
  const surface = section('Surface');
  nothingElse(rest.slice(at), reasons, 'boundary.md holds its heading, then ## Boundary with its table, then ## Surface with its table, and nothing else');
  if (boundary) {
    const rows = readTable(boundary, ['Row', 'Names', 'Kind', 'Side', 'Seam', 'Isolation', 'Reads', 'Writes', 'Origin', 'Cites'], reasons, { check, entryOf: (row) => (row.Row ? `${holder}/boundary/${row.Row}` : null) }) ?? [];
    page.boundary = rows.map((row) => boundaryRow(row, reasons, check, holder));
  }
  if (surface) {
    const check3 = 'forms.md §surface';
    const surfaceName = (row) => (row.Direction && row.Name ? `${holder}/surface/${row.Direction}/${row.Name}` : null);
    const rows = readTable(surface, ['Direction', 'Name', 'Cites'], reasons, { check: check3, entryOf: surfaceName }) ?? [];
    page.surface = rows.map((row) => ({
      direction: oneOf(row.Direction, DIRECTIONS, reasons, surfaceName(row), 'Direction', check3),
      name: row.Name,
      cites: readCites(row.Cites, reasons, surfaceName(row), check3),
      line: row.line,
    }));
  }
  return page;
}

/** A part's omissions.md (forms.md §omissions). */
function parseOmissions(text, reasons, holder) {
  const check = 'forms.md §omissions';
  const { rest } = opening(text, reasons);
  if (rest[0]?.type !== 'table') {
    reasons.fail(null, null, 'the heading is followed by the omissions table, which may have no rows', check);
    return { omissions: [] };
  }
  nothingElse(rest.slice(1), reasons, 'omissions.md holds its heading and its table, and nothing else');
  const rows = readTable(rest[0], ['Passage', 'Reason'], reasons, { check, entryOf: (row) => (row.Passage ? `${holder}/omissions/${row.Passage}` : null) }) ?? [];
  return { omissions: rows.map((row) => ({ passage: row.Passage, reason: row.Reason, line: row.line })) };
}

/** A lifecycle's page (forms.md §lifecycles): its heading, its field table, then its matrix. */
function parseLifecycle(text, reasons) {
  const check = 'forms.md §lifecycles';
  const { heading, rest } = opening(text, reasons);
  const page = { name: heading ?? '', entity: '', initial: { phase: '', enteredBy: null }, ends: [], unaffected: [], origin: '', cites: [], actions: [], phases: [], cells: dict(), repeatedColumns: [], repeatedPhases: [] };
  const fields = readFields(rest[0], ['Entity', 'Initial', 'Ends', 'Unaffected', 'Origin', 'Cites'], reasons, { check });
  if (!fields) {
    reasons.fail(null, null, "a lifecycle's heading is followed by its field table", check);
    return page;
  }
  page.entity = fields.Entity ?? '';
  const initial = fields.Initial ?? '';
  const entered = /^(.*), entered by (.*)$/.exec(initial);
  if (entered && (!entered[1] || !entered[2])) reasons.fail(null, 'Initial', `"${initial}" is a phase, or <phase>, entered by <action>`, check);
  page.initial = entered ? { phase: entered[1], enteredBy: entered[2] } : { phase: initial, enteredBy: null };
  page.ends = listOf(fields.Ends ?? 'none', reasons, null, 'Ends', check);
  page.unaffected = listOf(fields.Unaffected ?? 'none', reasons, null, 'Unaffected', check);
  page.origin = oneOf(fields.Origin ?? '', ORIGINS, reasons, null, 'Origin', check);
  page.cites = fields.Cites === undefined ? [] : readCites(fields.Cites, reasons, null, check);
  const matrix = rest[1];
  if (matrix?.type !== 'table') {
    reasons.fail(null, null, "a lifecycle's field table is followed by its matrix", check);
    return page;
  }
  nothingElse(rest.slice(2), reasons, 'a lifecycle holds its heading, its field table and its matrix, and nothing else');
  // A Phase column and the action columns, in any order (forms.md §page-rules, §lifecycles): the Phase column matched as any column
  // is, case-insensitively after trimming; the action columns are keys, matched exactly.
  // No action is keyed `phase` (forms.md §page-rules, check 2 on actions.md), so a second column named Phase is a repeated column, a form error.
  const phaseAt = matrix.header.flatMap((name, at) => (name === 'phase' ? [at] : []));
  if (phaseAt.length !== 1) {
    reasons.fail(null, 'Phase', phaseAt.length ? `the matrix has one Phase column, and this one has ${phaseAt.length}` : 'the matrix has a Phase column', check);
    if (!phaseAt.length) return page;
  }
  const phaseColumn = phaseAt[0];
  const columns = matrix.columns.map((name, at) => ({ name, at })).filter((c) => !phaseAt.includes(c.at));
  // An action column named twice, and a phase given two rows, are check 2's, as every key's uniqueness is (forms.md §page-rules, design.md §at-read):
  // kept for it, the first read.
  for (const c of columns) {
    if (page.actions.includes(c.name)) page.repeatedColumns.push(c.name);
    else page.actions.push(c.name);
  }
  // Phases looked up in a set, so a long matrix is read in time that grows with its rows, not their square.
  const phasesSeen = new Set();
  for (const row of matrix.rows) {
    if (row.written !== null && row.written !== matrix.columns.length) reasons.fail(null, null, `the matrix's row at line ${row.line} holds ${row.written} cells for its ${matrix.columns.length} columns: a | inside a cell is written \\|`, check);
    const phase = row.cells[phaseColumn] ?? '';
    if (phase === '') {
      reasons.fail(null, 'Phase', `the matrix's row at line ${row.line} has an empty Phase cell: only an action column's cell may be empty`, check);
      continue;
    }
    if (phasesSeen.has(phase)) {
      page.repeatedPhases.push(phase);
      continue;
    }
    phasesSeen.add(phase);
    page.phases.push(phase);
    page.cells[phase] = dict();
    for (const c of columns) {
      if (Object.hasOwn(page.cells[phase], c.name)) continue;
      const cell = readCell(row.cells[c.at] ?? '');
      // Each cell written as its form gives (forms.md §lifecycles, design.md §at-read): a piece of a cell of cases is <case>: <outcome>.
      if (cell.kind === 'cases') for (const piece of cell.bad) reasons.fail(null, `${phase} | ${c.name}`, `"${piece}" is not written <case>: <outcome>`, check);
      page.cells[phase][c.name] = cell;
    }
  }
  return page;
}

/** A journey's tables after its field table (forms.md §journeys): its start table, when it has one, and its steps. */
function journeyTables(blocks, reasons, check, entry = null) {
  const out = { start: [], steps: [], used: 0 };
  let at = 0;
  const startColumns = ['lifecycle', 'entity', 'phase'];
  if (blocks[at]?.type === 'table' && blocks[at].header.length === 3 && startColumns.every((c) => blocks[at].header.includes(c))) {
    const rows = readTable(blocks[at], ['Lifecycle', 'Entity', 'Phase'], reasons, { entry, check, rowName: (k) => `start row ${k + 1}` }) ?? [];
    out.start = rows.map((row) => ({ lifecycle: row.Lifecycle, entity: row.Entity, phase: row.Phase, line: row.line }));
    at += 1;
  }
  if (blocks[at]?.type !== 'table') {
    reasons.fail(entry, 'Step', 'a journey has its steps table, | Step | Actor | Action | Arguments | Entity | Case |', check);
    out.used = at;
    return out;
  }
  const rows = readTable(blocks[at], ['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], reasons, { entry, check, rowName: (k) => `step ${k + 1}` }) ?? [];
  if (!rows.length && blocks[at].header.length) reasons.fail(entry, 'Step', 'a journey has one or more steps', check);
  out.steps = rows.map((row, k) => {
    if (row.Step !== String(k + 1)) reasons.fail(entry, 'Step', `the steps are numbered 1, 2 and so on, without gaps, and step ${k + 1} is numbered "${row.Step}"`, check);
    return { step: k + 1, actor: row.Actor, action: row.Action, arguments: row.Arguments, entity: row.Entity === '-' ? null : row.Entity, case: row.Case === '-' ? null : row.Case, line: row.line };
  });
  out.used = at + 1;
  return out;
}

/** A journey's polarity, expected end and refused step (forms.md §journeys), as its field table gives them. */
function journeyFields(fields, steps, reasons, check, entry = null) {
  const polarity = oneOf(fields.Polarity ?? '', POLARITIES, reasons, entry, 'Polarity', check);
  const expectedEnd = fields['Expected end'] ?? '';
  const refused = fields['Refused step'] ?? '';
  let refusedStep = null;
  if (polarity === 'should happen') {
    if (expectedEnd === '-') reasons.fail(entry, 'Expected end', 'a should-happen journey gives its end in the developer\'s terms', check);
    if (refused !== '-') reasons.fail(entry, 'Refused step', 'a should-happen journey has no refused step, so it is -', check);
  } else if (polarity === 'must not') {
    if (expectedEnd !== '-') reasons.fail(entry, 'Expected end', 'a must-not journey has no expected end, so it is -', check);
    if (!/^[1-9][0-9]*$/.test(refused) || Number(refused) > steps.length) reasons.fail(entry, 'Refused step', `a must-not journey names the number of one of its steps as the one refused, and "${refused}" is not one`, check);
    else refusedStep = Number(refused);
  }
  return { polarity, expectedEnd, refusedStep };
}

/** A journey's page (forms.md §journeys), or a journey's tables as a decision holds them (decisions.md §confirm, §kept-journeys). */
export function parseJourneyBlocks(blocks, reasons, { check = 'forms.md §journeys', withOrigin = true, entry = null } = {}) {
  const names = ['Polarity', 'Expected end', 'Refused step', ...(withOrigin ? ['Origin', 'Cites'] : [])];
  const journey = { polarity: '', expectedEnd: '', refusedStep: null, start: [], steps: [], ...(withOrigin ? { origin: '', cites: [] } : {}) };
  const fields = readFields(blocks[0], names, reasons, { check, entry });
  if (!fields) {
    reasons.fail(entry, null, 'a journey begins with its field table', check);
    return { journey, used: 0 };
  }
  const tables = journeyTables(blocks.slice(1), reasons, check, entry);
  Object.assign(journey, journeyFields(fields, tables.steps, reasons, check, entry), { start: tables.start, steps: tables.steps });
  if (withOrigin) {
    journey.origin = oneOf(fields.Origin ?? '', ORIGINS, reasons, entry, 'Origin', check);
    journey.cites = fields.Cites === undefined ? [] : readCites(fields.Cites, reasons, entry, check);
  }
  return { journey, used: 1 + tables.used };
}

function parseJourney(text, reasons) {
  const { heading, rest } = opening(text, reasons);
  const { journey, used } = parseJourneyBlocks(rest, reasons);
  nothingElse(rest.slice(used), reasons, 'a journey holds its heading, its field table, its start table if it has one and its steps, and nothing else', 'forms.md §journeys');
  return { name: heading ?? '', ...journey };
}

/** A claim's page (forms.md §claims). */
function parseClaim(text, reasons) {
  const check = 'forms.md §claims';
  const { heading, rest } = opening(text, reasons);
  // The claim's Kind is `claimKind`: an entry's `kind` is the kind of entry it is (design.md §pins).
  const page = { name: heading ?? '', sentence: '', claimKind: '', stake: '', restsOn: [], parts: [], origin: '', cites: [] };
  const fields = readFields(rest[0], ['Sentence', 'Kind', 'Stake', 'Rests on', 'Parts', 'Origin', 'Cites'], reasons, { check });
  if (!fields) {
    reasons.fail(null, null, "a claim's heading is followed by its field table", check);
    return page;
  }
  nothingElse(rest.slice(1), reasons, 'a claim holds its heading and its field table, and nothing else', check);
  page.sentence = fields.Sentence ?? '';
  page.claimKind = oneOf(fields.Kind ?? '', CLAIM_KINDS, reasons, null, 'Kind', check);
  page.stake = fields.Stake ?? '';
  // Rests on: references to premises and boundary rows, and store: or choice: followed by a reference (forms.md §claims, §code-premises).
  page.restsOn = listOf(fields['Rests on'] ?? 'none', reasons, null, 'Rests on', check).map((item) => {
    const tagged = /^(store|choice):(.*)$/.exec(item);
    return tagged ? { tag: tagged[1], ref: tagged[2], written: item } : { tag: null, ref: item, written: item };
  });
  page.parts = listOf(fields.Parts ?? '', reasons, null, 'Parts', check);
  if (fields.Parts !== undefined && !page.parts.length) reasons.fail(null, 'Parts', 'a claim names one or more parts it is about', check);
  page.origin = oneOf(fields.Origin ?? '', ORIGINS, reasons, null, 'Origin', check);
  page.cites = fields.Cites === undefined ? [] : readCites(fields.Cites, reasons, null, check);
  return page;
}

/** A premise's page (forms.md §premises). */
function parsePremise(text, reasons) {
  const check = 'forms.md §premises';
  const { heading, rest } = opening(text, reasons);
  const page = { name: heading ?? '', statement: '', class: '', whyNotExamined: '', falsifier: '', provider: '', origin: '', cites: [] };
  const fields = readFields(rest[0], ['Statement', 'Class', 'Why not examined', 'Falsifier', 'Provider', 'Origin', 'Cites'], reasons, { check });
  if (!fields) {
    reasons.fail(null, null, "a premise's heading is followed by its field table", check);
    return page;
  }
  nothingElse(rest.slice(1), reasons, 'a premise holds its heading and its field table, and nothing else', check);
  page.statement = fields.Statement ?? '';
  page.class = oneOf(fields.Class ?? '', PREMISE_CLASSES, reasons, null, 'Class', check);
  page.whyNotExamined = fields['Why not examined'] ?? '';
  if (fields['Why not examined'] !== undefined && !WHY_NOT.some((option) => page.whyNotExamined === option || (page.whyNotExamined.startsWith(`${option}: `) && page.whyNotExamined.length > option.length + 2))) {
    reasons.fail(null, 'Why not examined', `"${page.whyNotExamined}" is ${WHY_NOT.join(', ')}, alone or followed by ": " and a reason`, check);
  }
  page.falsifier = fields.Falsifier ?? '';
  page.provider = fields.Provider ?? '';
  page.origin = oneOf(fields.Origin ?? '', ORIGINS, reasons, null, 'Origin', check);
  page.cites = fields.Cites === undefined ? [] : readCites(fields.Cites, reasons, null, check);
  return page;
}

/** A choice's page (forms.md §choices): its field table, then `## a` and `## b`, each a journey's tables and an effects table where it poses cells. */
function parseChoice(text, reasons) {
  const check = 'forms.md §choices';
  const { heading, rest } = opening(text, reasons);
  const page = { name: heading ?? '', question: '', recommendation: null, cites: [], alternatives: {} };
  const fields = readFields(rest[0], ['Question', 'Recommendation', 'Cites'], reasons, { check });
  if (!fields) {
    reasons.fail(null, null, "a choice's heading is followed by its field table", check);
    return page;
  }
  page.question = fields.Question ?? '';
  const recommendation = /^(a|b): (.+)$/s.exec(fields.Recommendation ?? '');
  if (recommendation) page.recommendation = { pick: recommendation[1], reason: recommendation[2] };
  else if (fields.Recommendation !== undefined) reasons.fail(null, 'Recommendation', 'a recommendation is a or b, then ": " and the reason', check);
  page.cites = fields.Cites === undefined ? [] : readCites(fields.Cites, reasons, null, check);
  const sections = [];
  for (const block of rest.slice(1)) {
    if (block.type === 'heading' && block.level === 2) sections.push({ name: block.text, blocks: [], line: block.line });
    else if (!sections.length) reasons.fail(null, null, `line ${block.line} holds a ${block.type} between the field table and ## a`, check);
    else sections[sections.length - 1].blocks.push(block);
  }
  if (sections.map((s) => s.name).join(',') !== 'a,b') reasons.fail(null, null, 'a choice has ## a and then ## b, and no other section', check);
  for (const section of sections.filter((s) => s.name === 'a' || s.name === 'b')) {
    if (page.alternatives[section.name]) continue;
    // An alternative's reasons name the choice, each said of `alternative a` or `alternative b` (door.md §forma-answer).
    const own = scoped(reasons, undefined, `alternative ${section.name}`);
    const { journey, used } = parseJourneyBlocks(section.blocks, own, { check, withOrigin: false });
    const after = section.blocks.slice(used);
    journey.effects = [];
    if (after.length) {
      const table = after[0];
      if (table.type === 'table') {
        const rows = readTable(table, ['Lifecycle', 'Phase', 'Action', 'Outcome'], own, { check, rowName: (k) => `effects row ${k + 1}` }) ?? [];
        journey.effects = rows.map((row) => {
          // Each cell written as its form gives (forms.md §choices, design.md §at-read): an outcome as forms.md §lifecycles writes a cell, but not choice:.
          const outcome = readCell(row.Outcome);
          const where = `effects row at line ${row.line}`;
          if (outcome.kind === 'cases') for (const piece of outcome.bad) own.fail(null, 'Outcome', `${where}: "${piece}" is not written <case>: <outcome>`, check);
          const outcomes = outcome.kind === 'cases' ? outcome.cases.map((item) => item.outcome) : [outcome];
          if (outcomes.some((o) => o.kind === 'choice')) own.fail(null, 'Outcome', `${where}: an effect's outcome is never choice:`, check);
          return { lifecycle: row.Lifecycle, phase: row.Phase, action: row.Action, outcome, written: row.Outcome, line: row.line };
        });
      } else own.fail(null, null, `line ${table.line}: after its steps an alternative holds at most its effects table`, check);
      nothingElse(after.slice(1), own, 'an alternative holds its field table, its start table if it has one, its steps and its effects table if it poses cells, and nothing else', check);
    }
    page.alternatives[section.name] = journey;
  }
  const { a, b } = page.alternatives;
  // A choice's two alternatives differing is check 1's (forms.md §choices, design.md §at-read).
  if (a && b && JSON.stringify(sameShape(a)) === JSON.stringify(sameShape(b))) reasons.fail(null, null, 'the alternatives differ, and these two are the same', check);
  return page;
}

/** What an alternative holds, without the lines it is written on, for telling two alike (forms.md §choices). */
function sameShape(alternative) {
  const strip = (rows) => rows.map(({ line, ...rest }) => rest);
  return { ...alternative, start: strip(alternative.start), steps: strip(alternative.steps), effects: strip(alternative.effects ?? []) };
}

const THING_PARSERS = { lifecycles: parseLifecycle, journeys: parseJourney, claims: parseClaim, premises: parsePremise, choices: parseChoice };

/**
 * One page parsed by its place (forms.md §front-pages to §thing-pages): `{ page, reasons }`, the reasons the failures of its own
 * checks, check 1 of design.md §restate-checks, which make it `change:<path>` (design.md §at-read).
 */
export function parsePage(path, where, text) {
  const reasons = new Reasons(path, 'forms.md §page-rules');
  const holder = where.holder?.key;
  let page;
  if (where.form === 'part-list') page = parsePartList(text, reasons);
  else if (where.form === 'part') page = parsePartReadme(text, reasons);
  else if (where.form === 'span') page = parseSpanReadme(text, reasons);
  else if (where.form === 'actions') page = parseActions(text, reasons, holder);
  else if (where.form === 'boundary') page = parseBoundary(text, reasons, holder);
  else if (where.form === 'omissions') page = parseOmissions(text, reasons, holder);
  // A thing page's reasons name the thing, by its entry name (door.md §forma-answer, design.md §pins).
  else page = THING_PARSERS[where.thing.kind](text, scoped(reasons, entryName(holder, where.thing.kind, where.thing.key)));
  return { page, reasons: reasons.list };
}

// --- The restatement as a whole (design.md §filing, §restate-checks checks 2 and 3, design.md §at-read) ----------------------------------

/** An entry's name (design.md §pins): `<part or span>/<kind>/<key>`, a surface row `<part>/surface/<direction>/<name>`, an omission `<part>/omissions/<address>`. */
const entryName = (holder, kind, key) => `${holder}/${kind}/${key}`;

/**
 * The restatement from the pages as project.mjs reads them (forms.md §front-pages to design.md §filing): its part list, parts and spans
 * with their rows and things, and every entry by name, a page that counts for nothing holding none.
 */
export function assemble(pages) {
  const restatement = { partList: null, partListPage: null, parts: new Map(), spans: new Map(), entries: new Map(), things: new Map() };
  const holderOf = (holder) => {
    const map = holder.span ? restatement.spans : restatement.parts;
    if (!map.has(holder.key)) {
      map.set(holder.key, {
        key: holder.key, span: holder.span, folder: `design/${holder.span ? 'spans' : 'parts'}/${holder.key}`,
        readme: null, tables: {}, actions: [], boundary: [], surface: [], omissions: [],
        things: Object.fromEntries((holder.span ? SPAN_KINDS : PART_KINDS).map((kind) => [kind, new Map()])),
        thingPages: Object.fromEntries((holder.span ? SPAN_KINDS : PART_KINDS).map((kind) => [kind, new Map()])),
      });
    }
    return map.get(holder.key);
  };
  const state = (record) => ({ path: record.path, exists: record.exists, counts: record.counts });
  for (const record of pages) {
    const { where } = record;
    if (where.form === 'part-list') {
      restatement.partListPage = state(record);
      if (record.counts) restatement.partList = record.page;
      continue;
    }
    const holder = holderOf(where.holder);
    if (where.form === 'part' || where.form === 'span') {
      holder.readme = { ...state(record), page: record.counts ? record.page : null };
    } else if (where.form === 'thing') {
      holder.thingPages[where.thing.kind].set(where.thing.key, state(record));
      if (record.counts) {
        const name = entryName(holder.key, where.thing.kind, where.thing.key);
        const thing = { ...record.page, entry: name, kind: where.thing.kind, key: where.thing.key, holder: where.holder, page: record.path };
        holder.things[where.thing.kind].set(where.thing.key, thing);
        restatement.things.set(name, thing);
        restatement.entries.set(name, thing);
      }
    } else {
      holder.tables[where.form] = state(record);
      if (!record.counts) continue;
      if (where.form === 'actions') holder.actions = record.page.actions.map((row) => ({ ...row, entry: entryName(holder.key, 'actions', row.key), kind: 'actions', holder: where.holder, page: record.path }));
      if (where.form === 'boundary') {
        holder.boundary = record.page.boundary.map((row) => ({ ...row, entry: entryName(holder.key, 'boundary', row.key), kind: 'boundary', holder: where.holder, page: record.path }));
        holder.surface = record.page.surface.map((row) => ({ ...row, entry: `${holder.key}/surface/${row.direction}/${row.name}`, kind: 'surface', holder: where.holder, page: record.path }));
      }
      if (where.form === 'omissions') holder.omissions = record.page.omissions.map((row) => ({ ...row, entry: `${holder.key}/omissions/${row.passage}`, kind: 'omissions', holder: where.holder, page: record.path }));
      for (const list of [holder.actions, holder.boundary, holder.surface, holder.omissions]) for (const entry of list) if (entry.page === record.path && !restatement.entries.has(entry.entry)) restatement.entries.set(entry.entry, entry);
    }
  }
  return restatement;
}

/** Whether a part folder holds a README.md, whatever it counts for: a part (forms.md §part-list). */
export const isPart = (restatement, key) => Boolean(restatement.parts.get(key)?.readme?.exists);

/** Whether a span folder holds a README.md: a span folder (forms.md §spans). */
export const isSpan = (restatement, key) => Boolean(restatement.spans.get(key)?.readme?.exists);

/**
 * One reference resolved as forms.md §page-rules writes it, from a part or span or from outside the pages:
 * `{ written, part, key, entry, holds, why }`, `holds` too where the page that would hold it counts for nothing.
 */
export function resolveRef(restatement, written, from, kind) {
  const out = { written, part: null, key: null, entry: null, holds: false, why: null };
  const pieces = String(written).split('/');
  if (!written || /\s/.test(written) || pieces.length > 2 || pieces.some((p) => p === '')) {
    out.why = `"${written}" is not a reference, a key or <part>/<key>`;
    return out;
  }
  if (pieces.length === 2) {
    [out.part, out.key] = pieces;
    if (from && !from.span && out.part === from.key) {
      out.why = `"${written}" names its own part: within its part a reference is the key alone`;
      return out;
    }
  } else {
    if (!from || from.span) {
      out.why = from ? `"${written}" is a key alone, and a span holds no entry a field names, so every reference in it is <part>/<key>` : `"${written}" is not <part>/<key>`;
      return out;
    }
    out.part = from.key;
    out.key = pieces[0];
  }
  const part = restatement.parts.get(out.part);
  if (!part || !part.readme?.exists) {
    out.why = `no part ${out.part}`;
    return out;
  }
  const what = { actions: 'action', boundary: 'boundary row', lifecycles: 'lifecycle', journeys: 'journey', claims: 'claim', premises: 'premise', choices: 'choice' }[kind];
  if (kind === 'actions' || kind === 'boundary') {
    const table = part.tables[kind === 'actions' ? 'actions' : 'boundary'];
    if (table?.exists && !table.counts) {
      out.holds = true;
      return out;
    }
    out.entry = part[kind].find((row) => row.key === out.key) ?? null;
  } else {
    const page = part.thingPages[kind]?.get(out.key);
    if (page?.exists && !page.counts) {
      out.holds = true;
      return out;
    }
    out.entry = part.things[kind]?.get(out.key) ?? null;
  }
  if (!out.entry) out.why = `${out.part} has no ${what} ${out.key}`;
  out.holds = Boolean(out.entry);
  return out;
}

/** A thing's parts (design.md §filing): a claim's `Parts`, a journey's steps' actions' parts, any other thing's part. */
export function thingParts(restatement, thing) {
  if (thing.kind === 'claims') return sortedBy([...new Set(thing.parts)]);
  if (thing.kind === 'journeys') return journeyParts(restatement, thing, thing.holder);
  return [thing.holder.key];
}

/** The parts of a journey's steps' actions (design.md §filing), its steps read from `from`, its part or span. */
export function journeyParts(restatement, journey, from) {
  const parts = new Set();
  for (const step of journey.steps ?? []) {
    const ref = resolveRef(restatement, step.action, from, 'actions');
    if (ref.holds && ref.part) parts.add(ref.part);
  }
  return sortedBy([...parts]);
}

/**
 * A consumed event as forms.md §surface writes it, read from part `from`: its key when this part emits it, otherwise
 * `<part>/<event>`, each a name with no `/` or whitespace. Gives `{ part, event, own }`, or null when not so written.
 */
export function consumedEvent(name, from) {
  const pieces = String(name).split('/');
  if (pieces.length > 2 || pieces.some((piece) => piece === '' || /\s/.test(piece))) return null;
  const [part, event] = pieces.length === 2 ? pieces : [from, pieces[0]];
  return { part, event, own: part === from };
}

/**
 * The spans of two parts from declared surfaces (forms.md §surface), each `{ name, parts, shared }`, `shared` the
 * surface rows of each part that name what the two share.
 */
export function spansOf(restatement) {
  const found = new Map();
  const add = (a, b, rowA, rowB) => {
    if (a === b) return;
    const [x, y] = sortedBy([a, b]);
    const name = `${x}+${y}`;
    if (!found.has(name)) found.set(name, { name, parts: [x, y], shared: { [x]: new Set(), [y]: new Set() } });
    const span = found.get(name);
    span.shared[a].add(rowA);
    span.shared[b].add(rowB);
  };
  const touches = [];
  for (const part of restatement.parts.values()) {
    for (const row of part.surface) {
      if (row.direction === 'emits') touches.push({ part: part.key, row, what: `event ${part.key}/${row.name}`, mode: 'event' });
      else if (row.direction === 'consumes') {
        const event = consumedEvent(row.name, part.key);
        if (event) touches.push({ part: part.key, row, what: `event ${event.part}/${event.event}`, mode: 'consume' });
      } else {
        const ref = resolveRef(restatement, row.name, { key: part.key, span: false }, 'boundary');
        if (!ref.part || !ref.key) continue;
        touches.push({ part: part.key, row, what: `row ${ref.part}/${ref.key}`, mode: row.direction === 'calls' ? 'call' : 'store' });
      }
    }
  }
  for (const a of touches) {
    for (const b of touches) {
      if (a.part === b.part || a.what !== b.what) continue;
      if ((a.mode === 'event' && b.mode === 'consume') || (a.mode === 'store' && b.mode === 'store') || (a.mode === 'call' && b.mode === 'call')) add(a.part, b.part, a.row, b.row);
    }
  }
  return sortedBy([...found.values()], (span) => span.name).map((span) => ({ name: span.name, parts: span.parts, shared: Object.fromEntries(span.parts.map((p) => [p, [...span.shared[p]]])) }));
}

// Every rule about names is check 2's or 3's, even where the page alone answers it (design.md §at-read): a key's
// form and uniqueness, and whether what a cell names exists. parsePage's reasons are check 1's alone.
/**
 * Checks 2 and 3 of design.md §restate-checks over the restatement as it stands (design.md §at-read): `{ failures, refs }`, each
 * failure with the page that holds it, and `address` for a citation the item `passage:` owes.
 */
export function checkRestatement(restatement, brief) {
  const failures = [];
  const refs = new Map();
  const fail = (holder, entry, field, says, check, extra = {}) => failures.push({ check, file: holder, entry: entry ?? null, field: field ?? null, says, holder, ...extra });
  const remember = (entry, field, resolved) => {
    if (!refs.has(entry)) refs.set(entry, {});
    const fields = refs.get(entry);
    (fields[field] ??= []).push(resolved);
  };
  const c2 = 'design.md §restate-checks';
  const keyOk = (holder, entry, field, key, what) => {
    if (!isKey(key)) fail(holder, entry, field, `"${key}" is not a key, as ${what} is: lowercase letters, digits and hyphens, beginning with a letter, with no hyphen at the end or two together`, 'forms.md §page-rules');
  };
  // A reference of a field, of `kind`, whose entry, when found, passes `fits`.
  const ref = (entry, holderPath, from, field, written, kind, fits = null, expected = null) => {
    const resolved = resolveRef(restatement, written, from, kind);
    if (resolved.entry && fits && !fits(resolved.entry)) {
      resolved.why = `"${written}" names ${resolved.entry.entry}, and ${field} names ${expected}`;
      resolved.holds = false;
      resolved.entry = null;
    }
    remember(entry, field, resolved);
    if (!resolved.holds) fail(holderPath, entry, field, resolved.why, 'forms.md §page-rules');
    return resolved;
  };
  const cite = (entry, holderPath, address) => {
    const passage = brief.passages.get(address);
    if (!passage || !passage.citable) {
      fail(holderPath, entry, 'Cites', passage ? `${address} is a passage of a source without all its provenance, which is not citable` : `${address} names no passage of the brief`, 'design.md §passages', { address });
    }
  };

  // The part list against the part folders (forms.md §part-list).
  const listPage = restatement.partListPage;
  const partFolders = [...restatement.parts.values()].filter((part) => part.readme?.exists).map((part) => part.key);
  if (restatement.partList) {
    const rows = restatement.partList.rows;
    const keys = rows.map((row) => row.key);
    rows.forEach((row, at) => {
      keyOk(listPage.path, row.key, 'Part', row.key, "a part's");
      if (keys.indexOf(row.key) !== at) fail(listPage.path, row.key, 'Part', `the part ${row.key} has two rows; each part has one`, 'forms.md §part-list');
      if (!partFolders.includes(row.key)) fail(listPage.path, row.key, 'Part', `the part ${row.key} has a row and no folder design/parts/${row.key}/ holding a README.md`, 'forms.md §part-list');
      for (const address of row.cites) cite(row.key, listPage.path, address);
    });
    for (const key of partFolders) if (!keys.includes(key)) fail(listPage.path, key, 'Part', `design/parts/${key}/ holds a README.md and the part list has no row for it`, 'forms.md §part-list');
    for (const item of restatement.partList.order) {
      if (item.kind === 'parts' && !isPart(restatement, item.key)) fail(listPage.path, null, null, `the reading order names parts/${item.key}/, which has no README.md`, 'forms.md §reading-order');
      if (item.kind === 'spans' && !isSpan(restatement, item.key)) fail(listPage.path, null, null, `the reading order names spans/${item.key}/, which has no README.md`, 'forms.md §reading-order');
    }
  } else if (!listPage && partFolders.length) {
    for (const key of partFolders) fail('design/README.md', key, 'Part', `design/parts/${key}/ holds a README.md and there is no part list`, 'forms.md §part-list');
  }

  // Each part and span: its keys, its references, its citations and its front page (forms.md §page-rules to design.md §filing).
  for (const span of restatement.spans.values()) {
    if (!span.readme?.exists) continue;
    keyOk(span.readme.path, null, null, span.key, "a span's");
    if (restatement.parts.get(span.key)?.readme?.exists) {
      const says = `the part and the span ${span.key} share a key, and a part and a span never do`;
      fail(span.readme.path, null, null, says, 'forms.md §page-rules');
      fail(restatement.parts.get(span.key).readme.path, null, null, says, 'forms.md §page-rules');
    }
  }
  for (const holder of [...restatement.parts.values(), ...restatement.spans.values()]) {
    if (!holder.readme?.exists) {
      // A page in a part or span folder that has no README.md fails check 2, owed restate:<that folder's key> (design.md §at-read);
      // its pages are read as they stand meanwhile, so every other check is asked of them too.
      const orphans = [...Object.values(holder.tables), ...Object.values(holder.thingPages).flatMap((m) => [...m.values()])].filter((p) => p?.exists);
      for (const page of orphans) fail(page.path, null, null, `the page lies in ${holder.folder}/, which holds no README.md, so it is in no ${holder.span ? 'span' : 'part'}`, 'forms.md §front-pages');
    }
    const from = { key: holder.key, span: holder.span };
    const readmePath = holder.readme?.path ?? null;
    if (!holder.span && readmePath) keyOk(readmePath, null, null, holder.key, "a part's");
    for (const item of holder.readme?.page?.order ?? []) {
      if (!holder.thingPages[item.kind]?.get(item.key)?.exists) fail(readmePath, null, null, `the reading order names ${item.kind}/${item.key}/, which has no page`, 'forms.md §reading-order');
    }
    // Keys of things, rows, phases and cases; unique within their kind (forms.md §page-rules).
    for (const [kind, pages] of Object.entries(holder.thingPages)) {
      for (const [key, page] of pages) {
        if (!page.exists) continue;
        keyOk(page.path, entryName(holder.key, kind, key), null, key, "a thing's");
      }
    }
    for (const [list, field, what] of [[holder.actions, 'Action', "an action's"], [holder.boundary, 'Row', "a boundary row's"]]) {
      list.forEach((row, at) => {
        keyOk(row.page, row.entry, field, row.key, what);
        if (list.findIndex((other) => other.key === row.key) !== at) fail(row.page, row.entry, field, `two rows share the key ${row.key}; keys are unique within their kind in a part`, 'forms.md §page-rules');
      });
    }
    // Premises and boundary rows count as one kind, since Rests on names both by key (forms.md §page-rules, §claims).
    for (const row of holder.boundary) {
      const premise = holder.thingPages.premises?.get(row.key);
      if (!premise?.exists) continue;
      const says = `the premise and the boundary row ${row.key} share a key, and premises and boundary rows count as one kind, since Rests on names both by key`;
      fail(row.page, row.entry, 'Row', says, 'forms.md §page-rules');
      fail(premise.path, entryName(holder.key, 'premises', row.key), null, says, 'forms.md §page-rules');
    }
    for (const action of holder.actions) {
      // No action is keyed `phase`, which names a lifecycle matrix's Phase column (forms.md §page-rules).
      if (action.key === 'phase') fail(action.page, action.entry, 'Action', 'no action is keyed phase, which names a lifecycle matrix\'s Phase column', 'forms.md §page-rules');
      for (const name of action.cases) keyOk(action.page, action.entry, 'Cases', name, "a case's name");
      for (const name of new Set(action.cases.filter((c, at) => action.cases.indexOf(c) !== at))) fail(action.page, action.entry, 'Cases', `the case ${name} is named twice; the cases are distinct`, 'forms.md §actions');
      ref(action.entry, action.page, from, 'Actor', action.actor, 'boundary', (row) => ACTING.includes(row.rowKind), 'a row of kind actor, service, queue or clock');
      for (const address of action.cites) cite(action.entry, action.page, address);
    }
    for (const row of holder.boundary) {
      for (const field of ['Reads', 'Writes']) for (const item of row[field.toLowerCase()] ?? []) ref(row.entry, row.page, from, field, item, 'boundary', (target) => ACTING.includes(target.rowKind), 'rows of kind actor, service, queue or clock');
      for (const address of row.cites) cite(row.entry, row.page, address);
    }
    for (const row of holder.surface) {
      if (row.direction === 'emits') keyOk(row.page, row.entry, 'Name', row.name, "an event's");
      else if (row.direction === 'consumes') {
        const resolved = { written: row.name, part: null, key: null, entry: null, holds: false, why: null };
        const event = consumedEvent(row.name, holder.key);
        if (!event) resolved.why = `"${row.name}" is not an event's key, nor <part>/<event>`;
        else {
          [resolved.part, resolved.key] = [event.part, event.event];
          if (event.own && row.name.includes('/')) resolved.why = `"${row.name}" names its own part: an event this part emits is consumed by its key alone`;
        }
        const owner = restatement.parts.get(resolved.part);
        if (!resolved.why) {
          if (!owner?.readme?.exists) resolved.why = `no part ${resolved.part}`;
          else if (owner.tables.boundary?.exists && !owner.tables.boundary.counts) resolved.holds = true;
          else if (owner.surface.some((s) => s.direction === 'emits' && s.name === resolved.key)) resolved.holds = true;
          else resolved.why = `${resolved.part} emits no event ${resolved.key}`;
        }
        remember(row.entry, 'Name', resolved);
        if (!resolved.holds) fail(row.page, row.entry, 'Name', resolved.why, 'forms.md §surface');
      } else if (row.direction === 'calls') ref(row.entry, row.page, from, 'Name', row.name, 'boundary', (target) => target.side === 'world' && ['actor', 'service'].includes(target.rowKind), 'a world row of kind actor or service');
      else ref(row.entry, row.page, from, 'Name', row.name, 'boundary', (target) => ['store', 'entity'].includes(target.rowKind), 'a row of kind store or entity');
      for (const address of row.cites) cite(row.entry, row.page, address);
    }
    // A surface row is known by its direction and name, each pair once in a part (forms.md §surface).
    holder.surface.forEach((row, at) => {
      if (holder.surface.findIndex((other) => other.direction === row.direction && other.name === row.name) !== at) fail(row.page, row.entry, 'Name', `${row.direction} ${row.name} is given twice; each direction and name once in a part`, 'forms.md §surface');
    });
    holder.omissions.forEach((row, at) => {
      if (!brief.passages.has(row.passage)) fail(row.page, row.entry, 'Passage', `${row.passage} names no passage of the brief`, c2);
      if (holder.omissions.findIndex((other) => other.passage === row.passage) !== at) fail(row.page, row.entry, 'Passage', `${row.passage} is named twice; a passage is named at most once in a part's omissions`, 'forms.md §omissions');
    });
    for (const thing of Object.values(holder.things).flatMap((map) => [...map.values()])) {
      for (const address of thing.cites ?? []) cite(thing.entry, thing.page, address);
      if (thing.kind === 'lifecycles') checkLifecycleNames(restatement, holder, thing, from, ref, fail, keyOk);
      if (thing.kind === 'journeys') {
        checkJourneyNames(restatement, thing, from, thing.entry, thing.page, ref, fail, null);
        const reserved = /^(reach|kept)-/.test(thing.key) || (!holder.span && [...holder.thingPages.choices.keys()].some((choice) => ['a', 'b', 'not-a', 'not-b'].some((tail) => thing.key === `${choice}-${tail}`)));
        if (reserved) fail(thing.page, thing.entry, null, `the key ${thing.key} is one code gives a journey it adds, so no page takes it`, 'design.md §code-journeys');
      }
      if (thing.kind === 'claims') {
        for (const item of thing.restsOn) {
          if (item.tag === 'store') ref(thing.entry, thing.page, from, 'Rests on', item.ref, 'boundary', (row) => row.rowKind === 'store', 'a store row');
          else if (item.tag === 'choice') ref(thing.entry, thing.page, from, 'Rests on', item.ref, 'choices');
          else {
            const premise = resolveRef(restatement, item.ref, from, 'premises');
            const row = resolveRef(restatement, item.ref, from, 'boundary');
            // A premise and a boundary row of one part never share a key (forms.md §page-rules), so at most one resolves; where a
            // shared key fails check 2 above, the premise is read meanwhile.
            const resolved = premise.holds ? premise : row.holds ? row : premise;
            remember(thing.entry, 'Rests on', { ...resolved, as: resolved === row ? 'boundary' : 'premises' });
            if (!resolved.holds) fail(thing.page, thing.entry, 'Rests on', `${item.ref} names no premise or boundary row: ${premise.why}`, 'forms.md §claims');
          }
        }
        for (const part of thing.parts) {
          keyOk(thing.page, thing.entry, 'Parts', part, "a part's");
          if (!isPart(restatement, part)) fail(thing.page, thing.entry, 'Parts', `no part ${part}`, c2);
        }
      }
      if (thing.kind === 'premises' && thing.class === 'promise') {
        const provider = thing.provider;
        if (provider === holder.key) fail(thing.page, thing.entry, 'Provider', 'a promise is of another part, so its provider is not this part', c2);
        else if (!isPart(restatement, provider)) fail(thing.page, thing.entry, 'Provider', `no part ${provider}`, c2);
      }
      if (thing.kind === 'choices') {
        if (thing.key.endsWith('-not')) fail(thing.page, thing.entry, null, `the key ${thing.key} ends in -not, which no choice's key does`, 'forms.md §choices');
        for (const [name, alternative] of Object.entries(thing.alternatives)) {
          checkJourneyNames(restatement, alternative, from, thing.entry, thing.page, ref, fail, `alternative ${name}`);
        }
      }
    }
  }
  checkLiveness(restatement, refs, fail);
  checkPlacement(restatement, fail);
  return { failures, refs };
}

/** An action of a part by its key, or `holds` when the part's actions.md exists and counts for nothing (design.md §at-read). */
function actionOf(holder, key) {
  if (holder.tables.actions?.exists && !holder.tables.actions.counts) return { holds: true, action: null };
  const action = holder.actions.find((row) => row.key === key) ?? null;
  return { holds: Boolean(action), action };
}

/** Whether a choice of this part has a page, whatever it counts for (forms.md §lifecycles's `choice:<key>`). */
const choiceOf = (holder, key) => holder.thingPages.choices?.get(key)?.exists ?? false;

/**
 * Check 2 for a lifecycle (forms.md §lifecycles, design.md §restate-checks): its entity is a row of kind entity; its phases
 * are keys; its Initial and Ends, and every cell's phases, are its phases; every cell's choice is
 * one of its part's; every case a cell names is one of its action's.
 */
function checkLifecycleNames(restatement, holder, lifecycle, from, ref, fail, keyOk) {
  const at = lifecycle.page;
  const entry = lifecycle.entry;
  ref(entry, at, from, 'Entity', lifecycle.entity, 'boundary', (row) => row.rowKind === 'entity', 'a row of kind entity');
  for (const phase of lifecycle.phases) keyOk(at, entry, 'Phase', phase, "a phase's name");
  for (const phase of new Set(lifecycle.repeatedPhases ?? [])) fail(at, entry, 'Phase', `the phase ${phase} has two rows; one row per phase`, 'forms.md §lifecycles');
  for (const action of new Set(lifecycle.repeatedColumns ?? [])) fail(at, entry, action, `the action ${action} is a column of the matrix twice; one column per action`, 'forms.md §lifecycles');
  const phases = new Set(lifecycle.phases);
  const phase = (name, field) => {
    if (!phases.has(name)) fail(at, entry, field, `${name} is not a phase of the lifecycle`, 'forms.md §lifecycles');
  };
  phase(lifecycle.initial.phase, 'Initial');
  for (const end of lifecycle.ends) phase(end, 'Ends');
  const outcome = (o, where) => {
    if (o.kind === 'phase') phase(o.phase, where);
    if (o.kind === 'choice' && !choiceOf(holder, o.choice)) fail(at, entry, where, `choice:${o.choice} names no choice of ${holder.key}`, 'forms.md §lifecycles');
  };
  for (const name of lifecycle.phases) {
    for (const [action, cell] of Object.entries(lifecycle.cells[name] ?? {})) {
      const where = `${name} | ${action}`;
      if (cell.kind !== 'cases') outcome(cell, where);
      else {
        const found = actionOf(holder, action);
        for (const item of cell.cases) {
          outcome(item.outcome, where);
          if (found.action && !found.action.cases.includes(item.case)) fail(at, entry, where, `${item.case} is not a case of ${action}`, 'forms.md §lifecycles');
        }
      }
    }
  }
}

/**
 * Check 2 for a journey's tables, a page's or a choice's alternative's (forms.md §journeys, §choices,
 * design.md §restate-checks): each start row's lifecycle resolves and its phase is the lifecycle's; each step's action
 * resolves and its case is one of the action's when it has cases, or `-`; an alternative's effects
 * rows name a lifecycle of this part by its key, one of its cells, and its phases and cases.
 */
function checkJourneyNames(restatement, journey, from, entry, at, ref, fail, label) {
  const say = (text) => (label ? `${label}: ${text}` : text);
  const start = journey.start ?? [];
  start.forEach((row, k) => {
    const lifecycle = ref(entry, at, from, 'Lifecycle', row.lifecycle, 'lifecycles');
    if (lifecycle.entry && !lifecycle.entry.phases.includes(row.phase)) fail(at, entry, 'Phase', say(`${row.phase} is not a phase of ${lifecycle.entry.entry}`), 'forms.md §journeys');
    // Each entity once per lifecycle (forms.md §journeys): a rule about names, check 2's (design.md §at-read).
    if (start.findIndex((other) => other.lifecycle === row.lifecycle && other.entity === row.entity) !== k) fail(at, entry, 'Entity', say(`the start table lists the entity ${row.entity} twice for ${row.lifecycle}; each entity once per lifecycle`), 'forms.md §journeys');
  });
  for (const step of journey.steps ?? []) {
    const action = ref(entry, at, from, 'Action', step.action, 'actions');
    if (!action.entry) continue;
    const cases = action.entry.cases;
    if (cases.length && !cases.includes(step.case)) fail(at, entry, 'Case', say(`step ${step.step}: ${action.entry.entry} has the cases ${cases.join(', ')}, and the step names ${step.case ?? '-'}`), 'forms.md §journeys');
    if (!cases.length && step.case !== null) fail(at, entry, 'Case', say(`step ${step.step}: ${action.entry.entry} has no cases, so its Case is -`), 'forms.md §journeys');
  }
  for (const row of journey.effects ?? []) {
    const lifecycle = ref(entry, at, from, 'Lifecycle', row.lifecycle, 'lifecycles');
    if (lifecycle.holds && lifecycle.part !== from.key) fail(at, entry, 'Lifecycle', say(`${row.lifecycle} is not a lifecycle of this part by its key`), 'forms.md §choices');
    const target = lifecycle.entry;
    if (!target || lifecycle.part !== from.key) continue;
    if (!target.phases.includes(row.phase) || !target.actions.includes(row.action)) {
      fail(at, entry, 'Phase', say(`${row.lifecycle} has no cell ${row.phase} | ${row.action}`), 'forms.md §choices');
      continue;
    }
    const holder = restatement.parts.get(from.key);
    const action = actionOf(holder, row.action).action;
    const outcomes = row.outcome.kind === 'cases' ? row.outcome.cases.map((c) => c.outcome) : [row.outcome];
    for (const o of outcomes) if (o.kind === 'phase' && !target.phases.includes(o.phase)) fail(at, entry, 'Outcome', say(`${o.phase} is not a phase of ${row.lifecycle}`), 'forms.md §choices');
    if (row.outcome.kind === 'cases' && action) for (const c of row.outcome.cases) if (!action.cases.includes(c.case)) fail(at, entry, 'Outcome', say(`${c.case} is not a case of ${row.action}`), 'forms.md §choices');
  }
}

/** Check 2's last rule for claims (forms.md §claims, design.md §restate-checks): every liveness claim rests on at least one premise of class fairness. */
function checkLiveness(restatement, refs, fail) {
  for (const thing of restatement.things.values()) {
    if (thing.kind !== 'claims' || thing.claimKind !== 'liveness') continue;
    const rested = refs.get(thing.entry)?.['Rests on'] ?? [];
    const fair = rested.some((r) => (r.as === 'premises' && r.entry?.class === 'fairness') || (r.as === 'premises' && r.holds && !r.entry));
    if (!fair) fail(thing.page, thing.entry, 'Rests on', 'a liveness claim rests on at least one premise of class fairness', 'forms.md §claims');
  }
}

/**
 * Check 3 of design.md §restate-checks, placement: each action of a part is a column of each of its
 * lifecycles or in its Unaffected, and not both; every column, Unaffected item and `entered by`
 * action is one of the part's actions; every cell holds what forms.md §lifecycles allows for its action; and each
 * choice's effects tables give exactly the cells and cases the choice poses (forms.md §choices). A part whose
 * actions.md counts for nothing is taken as holding (design.md §at-read).
 */
function checkPlacement(restatement, fail) {
  const c = 'design.md §restate-checks';
  for (const holder of restatement.parts.values()) {
    // A part folder with no README.md still has its pages placed, read as they stand (design.md §at-read).
    const unknown = holder.tables.actions?.exists && !holder.tables.actions.counts;
    const actions = new Map(holder.actions.map((row) => [row.key, row]));
    const lifecycles = [...holder.things.lifecycles.values()];
    for (const lifecycle of lifecycles) {
      const at = lifecycle.page;
      const entry = lifecycle.entry;
      if (!unknown) {
        for (const column of lifecycle.actions) if (!actions.has(column)) fail(at, entry, column, `the column ${column} is not an action of ${holder.key}`, c);
        for (const item of lifecycle.unaffected) if (!actions.has(item)) fail(at, entry, 'Unaffected', `${item} is not an action of ${holder.key}`, c);
        if (lifecycle.initial.enteredBy !== null && !actions.has(lifecycle.initial.enteredBy)) fail(at, entry, 'Initial', `${lifecycle.initial.enteredBy}, which enters the lifecycle, is not an action of ${holder.key}`, c);
        for (const key of actions.keys()) {
          const column = lifecycle.actions.includes(key);
          const listed = lifecycle.unaffected.includes(key);
          if (!column && !listed) fail(at, entry, null, `the action ${key} is neither a column of the lifecycle nor in its Unaffected`, c);
          if (column && listed) fail(at, entry, 'Unaffected', `the action ${key} is a column of the lifecycle and in its Unaffected, and it is one or the other`, c);
        }
      }
      for (const phase of lifecycle.phases) {
        for (const [key, cell] of Object.entries(lifecycle.cells[phase] ?? {})) {
          const action = actions.get(key);
          const where = `${phase} | ${key}`;
          if (!action) continue;
          if (action.cases.length) {
            if (cell.kind !== 'cases' && cell.kind !== 'empty') fail(at, entry, where, `${key} has cases, so its cell holds one <case>: <outcome> for each of them, or nothing`, 'forms.md §lifecycles');
            if (cell.kind === 'cases') {
              const named = cell.cases.map((item) => item.case);
              for (const name of action.cases) {
                const count = named.filter((n) => n === name).length;
                if (count === 0) fail(at, entry, where, `the case ${name} of ${key} has no outcome in the cell`, 'forms.md §lifecycles');
                if (count > 1) fail(at, entry, where, `the case ${name} of ${key} has ${count} outcomes in the cell, and has one`, 'forms.md §lifecycles');
              }
            }
          } else if (cell.kind === 'cases') fail(at, entry, where, `${key} has no cases, so its cell holds one outcome`, 'forms.md §lifecycles');
        }
      }
    }
    // Each choice's effects tables give exactly the cells and cases it poses (forms.md §choices).
    const unread = new Set([...holder.thingPages.lifecycles].filter(([, page]) => page.exists && !page.counts).map(([key]) => key));
    for (const choice of holder.things.choices.values()) {
      const posed = new Map();
      for (const lifecycle of lifecycles) {
        for (const phase of lifecycle.phases) {
          for (const [key, cell] of Object.entries(lifecycle.cells[phase] ?? {})) {
            const at = `${lifecycle.key}\0${phase}\0${key}`;
            if (cell.kind === 'choice' && cell.choice === choice.key) posed.set(at, { lifecycle: lifecycle.key, phase, action: key, whole: true, cases: [] });
            if (cell.kind === 'cases') {
              const cases = cell.cases.filter((item) => item.outcome.kind === 'choice' && item.outcome.choice === choice.key).map((item) => item.case);
              if (cases.length) posed.set(at, { lifecycle: lifecycle.key, phase, action: key, whole: false, cases });
            }
          }
        }
      }
      for (const [name, alternative] of Object.entries(choice.alternatives)) {
        const given = new Map();
        for (const row of alternative.effects ?? []) {
          const at = `${row.lifecycle}\0${row.phase}\0${row.action}`;
          const where = `alternative ${name}: ${row.lifecycle} | ${row.phase} | ${row.action}`;
          if (given.has(at)) fail(choice.page, choice.entry, 'Lifecycle', `${where} is given twice; each cell once`, 'forms.md §choices');
          given.set(at, row);
          if (unread.has(row.lifecycle)) continue;
          const pose = posed.get(at);
          if (!pose) {
            fail(choice.page, choice.entry, 'Lifecycle', `${where}: the choice poses no such cell`, 'forms.md §choices');
            continue;
          }
          if (pose.whole && row.outcome.kind === 'cases') fail(choice.page, choice.entry, 'Outcome', `${where}: the choice poses the cell whole, so its outcome is a cell, not cases`, 'forms.md §choices');
          if (!pose.whole) {
            const named = row.outcome.kind === 'cases' ? row.outcome.cases.map((item) => item.case) : [];
            if (sortedBy(named).join(',') !== sortedBy(pose.cases).join(',')) fail(choice.page, choice.entry, 'Outcome', `${where}: the choice poses the cases ${pose.cases.join(', ')}, and the outcome gives ${named.join(', ') || 'none'}`, 'forms.md §choices');
          }
        }
        for (const [at, pose] of posed) {
          if (!given.has(at)) fail(choice.page, choice.entry, 'Lifecycle', `alternative ${name} gives no outcome for ${pose.lifecycle} | ${pose.phase} | ${pose.action}, which the choice poses`, 'forms.md §choices');
        }
      }
    }
  }
}

/** Coverage (design.md §coverage): `{ covered, uncovered, unresolved }`, `extra` the citations of journeys code adds. */
export function coverage(restatement, brief, extra = []) {
  const cited = new Map();
  const add = (address, entry) => {
    if (!cited.has(address)) cited.set(address, new Set());
    cited.get(address).add(entry);
  };
  for (const row of restatement.partList?.rows ?? []) for (const address of row.cites) add(address, 'parts');
  for (const entry of restatement.entries.values()) {
    for (const address of entry.cites ?? []) add(address, entry.entry);
  }
  for (const item of extra) for (const address of item.cites ?? []) add(address, item.entry);
  const covered = new Set();
  const unresolved = [];
  for (const [address, entries] of cited) {
    if (brief.passages.get(address)?.citable) covered.add(address);
    else unresolved.push({ address, entries: sortedBy([...entries]) });
  }
  for (const holder of restatement.parts.values()) for (const row of holder.omissions) if (brief.passages.has(row.passage)) covered.add(row.passage);
  const uncovered = [...brief.passages.keys()].filter((address) => !covered.has(address)).sort(compare);
  return { covered, uncovered, unresolved: sortedBy(unresolved, (u) => u.address) };
}

/** Whether an entry is an addition (design.md §coverage, forms.md §page-rules): `added`, or citing only sources. */
export function isAdded(entry) {
  const cites = entry.cites ?? [];
  const sourcesOnly = cites.length > 0 && cites.every((address) => address.startsWith('design/brief/sources/'));
  return entry.origin === 'added' || sourcesOnly;
}

/** The lifecycles an action moves (lifecycle-tool.md §stepping): those of its part that have it as a column or are entered by it. */
export function lifecyclesMoved(restatement, action) {
  const part = restatement.parts.get(action.part);
  if (!part) return [];
  return [...part.things.lifecycles.values()].filter((l) => l.actions.includes(action.key) || l.initial.enteredBy === action.key);
}

/**
 * A journey's entities as lifecycle-tool.md §stepping names them: `{ named, steps }`, the names per lifecycle and the
 * entity each step acts on in each lifecycle it moves.
 */
export function journeyEntities(restatement, journey, from) {
  const named = new Map();
  const add = (lifecycle, name) => {
    if (!named.has(lifecycle)) named.set(lifecycle, []);
    if (!named.get(lifecycle).includes(name)) named.get(lifecycle).push(name);
  };
  const startFor = new Map();
  for (const row of journey.start ?? []) {
    const ref = resolveRef(restatement, row.lifecycle, from, 'lifecycles');
    if (!ref.entry) continue;
    add(ref.entry.entry, row.entity);
    startFor.set(row.entity, [...(startFor.get(row.entity) ?? []), ref.entry.entry]);
  }
  const moved = (journey.steps ?? []).map((step) => {
    const ref = resolveRef(restatement, step.action, from, 'actions');
    return { step, lifecycles: ref.entry ? lifecyclesMoved(restatement, ref).map((l) => l.entry) : [] };
  });
  for (const { step, lifecycles } of moved) {
    if (step.entity === null) continue;
    for (const lifecycle of lifecycles) {
      const elsewhere = (startFor.get(step.entity) ?? []).some((other) => other !== lifecycle && lifecycles.includes(other));
      if (!elsewhere) add(lifecycle, step.entity);
    }
  }
  const steps = moved.map(({ step, lifecycles }) => ({
    step: step.step,
    moves: lifecycles.map((lifecycle) => {
      const names = named.get(lifecycle) ?? [];
      const key = lifecycle.split('/').pop();
      const entity = names.length > 1 ? step.entity : names[0] ?? key;
      return { lifecycle, entity };
    }),
  }));
  return { named, steps };
}
