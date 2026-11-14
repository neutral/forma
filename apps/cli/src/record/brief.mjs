// The brief: the developer's documents and the sources supplied with them, their passages, each
// passage's address and hash, and each source's provenance (design.md §brief, §passages).

import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import MarkdownIt from 'markdown-it';
import reference from 'markdown-it/lib/rules_block/reference.mjs';
import { parse as parseYaml } from 'yaml';
import { compare, sha256 } from './json.mjs';

/** The brief's folder (design.md §brief). */
const BRIEF = 'design/brief';
/** The folder of the sources supplied with the brief (design.md §brief). */
const SOURCES = 'design/brief/sources';

// A document is CommonMark read with no extension, so a table is read as a paragraph (design.md §brief). A link
// reference definition is a block of its passage (design.md §passages) that markdown-it leaves without a token, so
// its lines are marked.
const markdown = new MarkdownIt('commonmark');
markdown.block.ruler.at('reference', (state, startLine, endLine, silent) => {
  if (!reference(state, startLine, endLine, silent)) return false;
  if (!silent) state.push('reference', '', 0).map = [startLine, state.line];
  return true;
});

const PROVENANCE = ['title', 'author', 'date', 'origin'];
const DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/** A source's date (design.md §brief): a calendar date that exists, written YYYY-MM-DD, or YYYY-MM or YYYY. */
function dateExists(text) {
  const match = DATE.exec(text);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  if (match[2] === undefined) return true;
  if (month < 1 || month > 12) return false;
  if (match[3] === undefined) return true;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/**
 * Front matter, a YAML block between `---` lines at a file's top, split from its text (design.md §brief), line endings
 * read as design.md §passages reads them.
 */
function splitFrontMatter(text) {
  const normal = String(text).replace(/\r\n?/g, '\n');
  if (!normal.startsWith('---\n')) return { frontMatter: null, body: normal };
  const end = normal.indexOf('\n---\n', 3);
  if (end === -1) {
    if (normal.endsWith('\n---')) return { frontMatter: normal.slice(4, -4), body: '' };
    return { frontMatter: null, body: normal };
  }
  return { frontMatter: normal.slice(4, end), body: normal.slice(end + 5) };
}

/** A source's provenance (design.md §brief): `{ ok, fields }` with its four fields, each a string holding a character other than whitespace, or `{ ok: false, reasons }`. */
function provenance(frontMatter) {
  if (frontMatter === null) return { ok: false, reasons: ['it has no front matter'] };
  let fields;
  try {
    fields = parseYaml(frontMatter);
  } catch (error) {
    return { ok: false, reasons: [`its front matter is not YAML: ${error.message.split('\n')[0]}`] };
  }
  if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) return { ok: false, reasons: ['its front matter is not a mapping'] };
  const reasons = [];
  for (const name of PROVENANCE) {
    if (fields[name] === undefined || fields[name] === null) reasons.push(`it has no ${name}`);
    else if (typeof fields[name] !== 'string') reasons.push(`its ${name} is not a string`);
    else if (!/[^\p{White_Space}]/u.test(fields[name])) reasons.push(`its ${name} holds only whitespace`);
  }
  if (typeof fields.date === 'string' && fields.date !== 'unknown' && !dateExists(fields.date)) {
    reasons.push(`its date "${fields.date}" is not a calendar date that exists, written YYYY-MM-DD, YYYY-MM or YYYY, nor unknown`);
  }
  if (reasons.length) return { ok: false, reasons };
  return { ok: true, fields: Object.fromEntries(PROVENANCE.map((name) => [name, fields[name]])) };
}

/**
 * A heading's slug before any `-<n>` for a repeat (design.md §passages): lowercased, all but letters (category L), digits
 * (category Nd), spaces, hyphens and underscores removed, each space a hyphen.
 */
const slugBase = (headingText) => headingText.toLowerCase().replace(/[^\p{L}\p{Nd} _-]/gu, '').replace(/ /g, '-');

/** A heading's text (design.md §passages): its inline markup removed, and an image read as its alt text. */
function headingText(children = []) {
  return children
    .map((child) => {
      if (child.type === 'text' || child.type === 'code_inline') return child.content;
      if (child.type === 'softbreak' || child.type === 'hardbreak') return ' ';
      if (child.type === 'image') return headingText(child.children ?? []);
      return '';
    })
    .join('');
}

/** Whitespace as design.md §passages means it: the characters of Unicode's White_Space property. */
const WHITE = /\p{White_Space}+/gu;
const collapse = (lines) => lines.join(' ').replace(WHITE, ' ').replace(/^ | $/g, '');

/**
 * A top-level block's canonical text (design.md §passages): its source with whitespace collapsed, except the lines
 * of fenced code at any depth, kept as written less trailing whitespace, with the text before,
 * between and after the fences collapsed and the pieces joined by line feeds.
 */
function blockText(lines, block) {
  const pieces = [];
  let at = block.start;
  for (const [start, end] of block.fences) {
    const before = collapse(lines.slice(at, start));
    if (before) pieces.push(before);
    pieces.push(lines.slice(start, end).map((line) => line.replace(/\p{White_Space}+$/u, '')).join('\n'));
    at = end;
  }
  const after = collapse(lines.slice(at, block.end));
  if (after) pieces.push(after);
  return pieces.join('\n');
}

/**
 * The sections of one file of the brief (design.md §passages): its body's lines, and each top-level heading's
 * section and the opening passage, front matter aside, each with its address and blocks.
 */
function sectionsOf(path, text) {
  const { body } = splitFrontMatter(text);
  const lines = body.split('\n');
  const tokens = markdown.parse(body, {});
  const blocks = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === 'fence' && token.level > 0 && token.map && blocks.length) blocks[blocks.length - 1].fences.push(token.map);
    if (token.level !== 0 || !token.map || token.nesting === -1) continue;
    const block = { start: token.map[0], end: token.map[1], fences: token.type === 'fence' ? [token.map] : [] };
    if (token.type === 'heading_open') block.heading = headingText(tokens[index + 1]?.children ?? []);
    blocks.push(block);
  }
  const sections = [];
  for (const block of blocks) {
    if (block.heading !== undefined) sections.push({ heading: block.heading, blocks: [block] });
    else if (sections.length === 0) sections.push({ heading: null, blocks: [block] });
    else sections[sections.length - 1].blocks.push(block);
  }
  const given = new Set();
  for (const section of sections) {
    section.address = path;
    if (section.heading === null) continue;
    const base = slugBase(section.heading);
    let slug = base;
    for (let n = 1; given.has(slug); n += 1) slug = `${base}-${n}`;
    given.add(slug);
    section.address = `${path}#${slug}`;
  }
  return { lines, sections };
}

/**
 * The passages of one file of the brief (design.md §passages), each `{ address, heading, canonical, hash }`: each
 * top-level heading's section and the opening passage, front matter aside.
 */
function passages(path, text) {
  const { lines, sections } = sectionsOf(path, text);
  return sections.map((section) => {
    const canonical = section.blocks.map((block) => blockText(lines, block)).join('\n\n');
    return { address: section.address, heading: section.heading, canonical, hash: sha256(canonical) };
  });
}

/** Each passage of one file as its developer wrote it, by address: its lines from its first block to its last. */
export function writtenPassages(path, text) {
  const { lines, sections } = sectionsOf(path, text);
  return new Map(sections.map((section) => [section.address, lines.slice(section.blocks[0].start, section.blocks[section.blocks.length - 1].end).join('\n')]));
}

/**
 * Whether a symbolic link leads to a file outside design/brief/, which then counts as a file at the
 * link's path (design.md §brief). A link to a file inside it is not read, since that file is read as itself.
 */
async function linksOut(path, top) {
  try {
    if (!(await stat(path)).isFile()) return false;
    const target = await realpath(path);
    return !(target === top || target.startsWith(`${top}/`));
  } catch {
    return false;
  }
}

/** Every `.md` file under a folder of the brief, its `.md` matched in any letter case (design.md §brief), by project path. */
async function markdownFiles(root, path, top) {
  let entries;
  try {
    entries = await readdir(join(root, path), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
    throw error;
  }
  const found = [];
  for (const entry of entries) {
    const at = `${path}/${entry.name}`;
    if (entry.isDirectory()) found.push(...(await markdownFiles(root, at, top)));
    else if (/\.md$/i.test(entry.name) && (entry.isFile() || (entry.isSymbolicLink() && (await linksOut(join(root, at), top))))) found.push(at);
  }
  return found;
}

/**
 * The brief of a project (design.md §brief to §passages): `{ documents, sources, passages }`, `passages` every passage by
 * address with its path, hash, whether a source's, and whether citable.
 */
export async function readBrief(root) {
  const top = await realpath(join(root, BRIEF)).catch(() => join(root, BRIEF));
  const paths = (await markdownFiles(root, BRIEF, top)).sort(compare);
  const documents = [];
  const sources = [];
  const index = new Map();
  for (const path of paths) {
    const text = await readFile(join(root, path), 'utf8');
    const source = path.startsWith(`${SOURCES}/`);
    const file = { path, passages: passages(path, text) };
    if (source) {
      file.provenance = provenance(splitFrontMatter(text).frontMatter);
      sources.push(file);
    } else documents.push(file);
    for (const passage of file.passages) {
      if (!index.has(passage.address)) index.set(passage.address, { ...passage, path, source, citable: !source || file.provenance.ok });
    }
  }
  return { documents, sources, passages: index };
}
