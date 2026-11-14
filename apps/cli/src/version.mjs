// The version of Forma (evidence.md §toolchain, §basis, §versions): its package version and the first twelve
// hexadecimal digits of a SHA-256 over its source files in path order; semantic versions compared;
// and whether a Node version is within the range package.json names as its engine. It imports
// nothing of Forma's own, so any module may name the version.

import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Every file under a folder, by its path relative to the folder with `/` between names, sorted. */
export function filesUnder(root, prefix = '') {
  const found = [];
  for (const name of readdirSync(join(root, prefix))) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (lstatSync(join(root, path)).isDirectory()) found.push(...filesUnder(root, path));
    else found.push(path);
  }
  return found.sort(byName);
}

/**
 * The first twelve hexadecimal digits of the SHA-256 over Forma's source files (evidence.md §basis):
 * every file under src/, in sorted path order, each as its path, a NUL, its length in bytes, a NUL,
 * and its bytes.
 */
export function sourceDigest(root = fileURLToPath(new URL('.', import.meta.url))) {
  const hash = createHash('sha256');
  for (const path of filesUnder(root)) {
    const bytes = readFileSync(join(root, path));
    hash.update(`${path}\0${bytes.length}\0`);
    hash.update(bytes);
  }
  return hash.digest('hex').slice(0, 12);
}

/** Forma's package.json, read once. */
export const PACKAGE = Object.freeze(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')));

/** Forma as every basis names it (evidence.md §basis): `{ version, source }`, its package version and its source digest. */
export const FORMA = Object.freeze({ version: PACKAGE.version, source: sourceDigest() });

/** Forma's version as one string, `<package version>+<source digest>`, which the parsers' caches are keyed by. */
export const FORMA_VERSION = `${FORMA.version}+${FORMA.source}`;

// --- Semantic versions (evidence.md §versions) ------------------------------------------------------------------

const SEMVER = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** A semantic version's parts, `{ major, minor, patch, pre }`; null when the text is none. */
function parseVersion(text) {
  const m = SEMVER.exec(String(text ?? '').trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] ? m[4].split('.') : [] };
}

/** Two semantic versions compared as semver orders them (evidence.md §versions): negative, zero or positive; null when either is no version. */
export function compareVersions(a, b) {
  const x = typeof a === 'string' ? parseVersion(a) : a;
  const y = typeof b === 'string' ? parseVersion(b) : b;
  if (!x || !y) return null;
  for (const key of ['major', 'minor', 'patch']) if (x[key] !== y[key]) return x[key] - y[key];
  if (!x.pre.length || !y.pre.length) return (x.pre.length ? -1 : 0) + (y.pre.length ? 1 : 0);
  for (let at = 0; at < Math.max(x.pre.length, y.pre.length); at += 1) {
    if (at >= x.pre.length) return -1;
    if (at >= y.pre.length) return 1;
    const p = x.pre[at];
    const q = y.pre[at];
    if (p === q) continue;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) return Number(p) - Number(q);
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

/** One comparator of a range, `>=24`, `<26.1`, `^24.2.0`, `~24.2`, `24` or `24.x`, as `[op, version]` pairs. */
function comparators(text) {
  const m = /^(>=|<=|>|<|=|\^|~)?\s*v?(\d+|x|\*)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?(-[0-9A-Za-z.-]+)?$/.exec(text.trim());
  if (!m) return null;
  const [, op = '', a, b, c, pre = ''] = m;
  const wild = (part) => part === undefined || part === 'x' || part === '*';
  const n = (part) => (wild(part) ? 0 : Number(part));
  const at = `${n(a)}.${n(b)}.${n(c)}${pre}`;
  if (wild(a)) return op === '<' || op === '>' ? [['<', '0.0.0-0']] : [];
  const up = (level) => (level === 0 ? `${n(a) + 1}.0.0-0` : `${n(a)}.${n(b) + 1}.0-0`);
  if (op === '^') return [['>=', at], ['<', n(a) > 0 || wild(b) ? up(0) : n(b) > 0 || wild(c) ? up(1) : `0.0.${n(c) + 1}-0`]];
  if (op === '~') return [['>=', at], ['<', wild(b) ? up(0) : up(1)]];
  if (op === '' || op === '=') {
    if (wild(b)) return [['>=', at], ['<', up(0)]];
    if (wild(c)) return [['>=', at], ['<', up(1)]];
    return [['=', at]];
  }
  if (op === '>' && (wild(b) || wild(c))) return [['>=', wild(b) ? up(0) : up(1)]];
  if (op === '<=' && (wild(b) || wild(c))) return [['<', wild(b) ? up(0) : up(1)]];
  return [[op, at]];
}

/**
 * Whether `version` lies within `range` as package.json writes an engine's range (evidence.md §toolchain): comparators
 * joined by spaces, alternatives by `||`; null when the range is not one this reads.
 */
export function satisfies(version, range) {
  const v = parseVersion(version);
  if (!v || typeof range !== 'string') return null;
  const alternatives = range.split('||').map((alt) => alt.trim().replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1'));
  let readable = true;
  const fits = alternatives.some((alt) => {
    const parts = alt === '' ? [] : alt.split(/\s+/);
    const all = [];
    for (const part of parts) {
      const found = comparators(part);
      if (!found) { readable = false; return false; }
      all.push(...found);
    }
    return all.every(([op, at]) => {
      const c = compareVersions(v, at);
      return op === '>=' ? c >= 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : op === '<' ? c < 0 : c === 0;
    });
  });
  return readable || fits ? fits : null;
}
