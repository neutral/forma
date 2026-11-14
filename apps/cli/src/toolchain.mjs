// The pinned engine toolchain (evidence.md §toolchain): the Java runtime, TLC's tla2tools and Alloy, each
// checked against its SHA-256 in toolchain.json before use, the runtime also as unpacked from its
// archive; and the lifecycle engine's Node, within the range package.json names as its engine, and
// the XState package.json pins. The folder is FORMA_TOOLCHAIN, or forma/toolchain in the user's cache folder.

import { createHash } from 'node:crypto';
import { createReadStream, existsSync, lstatSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { filesUnder, PACKAGE, satisfies } from './version.mjs';

const PINS = JSON.parse(readFileSync(new URL('./toolchain.json', import.meta.url), 'utf8'));
const verified = new Map();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The pinned versions: the Java runtime's, TLC's and Alloy's. */
const VERSIONS = Object.freeze({ jre: PINS.jreVersion, tlc: PINS.tlcVersion, alloy: PINS.alloyVersion });

/** The version of a dependency as installed where Node resolves it from Forma's own files. */
export const installedVersion = (name) =>
  JSON.parse(readFileSync(createRequire(import.meta.url).resolve(`${name}/package.json`), 'utf8')).version;

/** The XState installed beside Forma, which steps the lifecycle engine (evidence.md §toolchain). */
const XSTATE = installedVersion('xstate');

/** The XState package.json pins for Forma, or null when it names none. */
const PINNED_XSTATE = PACKAGE.dependencies?.xstate ?? null;

/** Node's exact version as a basis records it, without its leading `v` (evidence.md §toolchain, §basis). */
const NODE_VERSION = process.versions.node;

/**
 * The versions each engine's basis names (evidence.md §toolchain, §basis): `engine` and `runtime`, each `{ name, version }`,
 * and for the lifecycle engine `library`; the lifecycle engine's own version is Forma's package version.
 */
export const ENGINE_VERSIONS = Object.freeze({
  tlc: Object.freeze({ engine: { name: 'tlc', version: VERSIONS.tlc }, runtime: { name: 'java', version: VERSIONS.jre } }),
  alloy: Object.freeze({ engine: { name: 'alloy', version: VERSIONS.alloy }, runtime: { name: 'java', version: VERSIONS.jre } }),
  lifecycle: Object.freeze({ engine: { name: 'lifecycle', version: PACKAGE.version }, runtime: { name: 'node', version: NODE_VERSION }, library: { name: 'xstate', version: XSTATE } }),
});

/** The user's cache folder on this operating system. */
export function cacheBase(platform = process.platform, env = process.env, home = homedir()) {
  if (platform === 'darwin') return join(home, 'Library', 'Caches');
  if (platform === 'win32') return env.LOCALAPPDATA ?? join(home, 'AppData', 'Local');
  return env.XDG_CACHE_HOME && isAbsolute(env.XDG_CACHE_HOME) ? env.XDG_CACHE_HOME : join(home, '.cache');
}

/** The toolchain's folder: FORMA_TOOLCHAIN, or forma/toolchain in the user's cache folder, outside any checkout or installed package. */
export const toolchainDir = () => process.env.FORMA_TOOLCHAIN ?? join(cacheBase(), 'forma', 'toolchain');

function sha256File(path) {
  return new Promise((done, fail) => {
    const hash = createHash('sha256');
    createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('end', () => done(hash.digest('hex'))).on('error', fail);
  });
}

async function pinned(dir, file, sha) {
  const path = join(dir, file);
  if (!existsSync(path)) throw new Error(`the toolchain has no ${file} in ${dir}`);
  if (!verified.has(path)) verified.set(path, await sha256File(path));
  if (verified.get(path) !== sha) throw new Error(`${file} in ${dir} does not match its pinned SHA-256`);
  return path;
}

/** The regular files of a gzipped tar archive, by path, each with its SHA-256 (ustar, with GNU and pax long names). */
function archiveFiles(bytes) {
  const tar = gunzipSync(bytes);
  const text = (from, length) => tar.subarray(from, from + length).toString('utf8').replace(/\0[\s\S]*$/, '');
  const files = new Map();
  let longName = null;
  for (let at = 0; at + 512 <= tar.length;) {
    if (tar.subarray(at, at + 512).every((byte) => byte === 0)) break;
    const size = parseInt(text(at + 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(tar[at + 156] || 48);
    const prefix = text(at + 345, 155);
    const name = longName ?? (prefix ? `${prefix}/${text(at, 100)}` : text(at, 100));
    const body = tar.subarray(at + 512, at + 512 + size);
    at += 512 + Math.ceil(size / 512) * 512;
    if (type === 'L') { longName = body.toString('utf8').replace(/\0[\s\S]*$/, ''); continue; }
    if (type === 'x') { longName = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(body.toString('utf8'))?.[1] ?? null; continue; }
    if (type === 'g') continue;
    longName = null;
    if (type === '0' || type === '\0' || type === '7') files.set(name.replace(/^\.\//, ''), sha256(body));
  }
  return files;
}

/**
 * Why `folder`, unpacked from the gzipped tar `archive` where it is named `root`, is not exactly
 * the archive's regular files with their bytes, and no other file; none when it is.
 */
export function unpackedDiffers(archive, folder, root) {
  const expected = archiveFiles(archive);
  const found = new Map(filesUnder(folder).map((path) => [`${root}/${path}`, path]));
  const reasons = [];
  for (const [path, hash] of expected) {
    if (!found.has(path)) reasons.push(`${path} is missing`);
    else if (!lstatSync(join(folder, found.get(path))).isFile() || sha256(readFileSync(join(folder, found.get(path)))) !== hash) reasons.push(`${path} differs from the archive`);
  }
  for (const path of found.keys()) if (!expected.has(path)) reasons.push(`${path} is not in the archive`);
  return reasons;
}

/** The pinned Java runtime, checked as its archive and as unpacked from it: the path of its `java`. */
async function java(dir) {
  const archive = await pinned(dir, PINS.jreFile, PINS.jreSha256);
  const unpacked = join(dir, PINS.jreRoot);
  const path = join(unpacked, PINS.jreJava);
  if (!existsSync(path)) throw new Error(`the toolchain's Java runtime is not unpacked at ${unpacked}`);
  if (!verified.has(unpacked)) verified.set(unpacked, unpackedDiffers(readFileSync(archive), unpacked, PINS.jreRoot));
  const differs = verified.get(unpacked);
  if (differs.length) throw new Error(`the Java runtime unpacked at ${unpacked} is not its pinned archive: ${differs.slice(0, 5).join('; ')}${differs.length > 5 ? `; and ${differs.length - 5} more` : ''}`);
  return path;
}

/** The toolchain's paths, after checking each pinned file and the Java runtime as unpacked from its pinned archive. */
export async function toolchain(dir = toolchainDir()) {
  return {
    java: await java(dir),
    tla2tools: await pinned(dir, PINS.tlcFile, PINS.tlcSha256),
    alloy: await pinned(dir, PINS.alloyFile, PINS.alloySha256),
  };
}

/**
 * One engine's toolchain as a run needs it (evidence.md §toolchain): `{ ok: true, tools }` with the paths it runs from, or
 * `{ ok: false, why }`, why it runs nothing, in the developer's terms. TLC needs the Java runtime and tla2tools, Alloy
 * the Java runtime and Alloy's jar, and the lifecycle engine a Node within package.json's engines and the XState
 * package.json pins.
 */
export async function engineToolchain(engine, dir = toolchainDir()) {
  try {
    if (engine === 'lifecycle') {
      const range = PACKAGE.engines?.node ?? null;
      const within = range === null ? false : satisfies(NODE_VERSION, range);
      if (within === null) return { ok: false, why: `package.json names Node's engine as ${range}, a range Forma cannot read` };
      if (!within) return { ok: false, why: range === null ? 'package.json names no Node engine' : `Node ${NODE_VERSION} is not within ${range}, the versions package.json names` };
      if (PINNED_XSTATE !== null && PINNED_XSTATE !== XSTATE) return { ok: false, why: `the XState installed is ${XSTATE}, and package.json pins ${PINNED_XSTATE}` };
      return { ok: true, tools: null };
    }
    const runtime = await java(dir);
    if (engine === 'tlc') return { ok: true, tools: { java: runtime, tla2tools: await pinned(dir, PINS.tlcFile, PINS.tlcSha256) } };
    if (engine === 'alloy') return { ok: true, tools: { java: runtime, alloy: await pinned(dir, PINS.alloyFile, PINS.alloySha256) } };
    return { ok: false, why: `${engine} is no engine Forma drives` };
  } catch (error) {
    return { ok: false, why: `${error.message}; run \`forma-toolchain\` to fetch and unpack the toolchain` };
  }
}
