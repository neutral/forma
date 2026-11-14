#!/usr/bin/env node
// Fetches Forma's pinned engine toolchain (evidence.md §toolchain): the Java runtime, TLC's tla2tools and Alloy, each
// downloaded from the address toolchain.json, beside this file, pins, checked against its byte count and SHA-256, and kept in the
// toolchain folder, FORMA_TOOLCHAIN or forma/toolchain in the user's cache folder; the Java runtime is then unpacked
// beside its archive, again whenever what is unpacked is not exactly the archive or its java does not run. A file
// already there with its pinned hash is kept. Every failure ends with one line, `forma-toolchain: <why>`, and exits 1.
// Run as `forma-toolchain`, or `pnpm toolchain` in Forma's checkout.

import { createHash } from 'node:crypto';
import { accessSync, constants, createReadStream, existsSync, lstatSync, readFileSync, readlinkSync, statSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, resolve } from 'node:path';

const fail = (why) => {
  process.stderr.write(`forma-toolchain: ${why}\n`);
  process.exit(1);
};

const megabytes = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;

const hashOf = (path) => new Promise((resolve, reject) => {
  const hash = createHash('sha256');
  createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('error', reject).on('end', () => resolve(hash.digest('hex')));
});

const runs = (path) => {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const NAME = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const oneName = (value) => typeof value === 'string' && NAME.test(value) && !value.includes('..');
const KEYS = ['platform', 'arch', 'jreFile', 'jreUrl', 'jreBytes', 'jreSha256', 'jreRoot', 'jreJava', 'tlcFile', 'tlcUrl',
  'tlcBytes', 'tlcSha256', 'alloyFile', 'alloyUrl', 'alloyBytes', 'alloySha256'];

/** The pins, read from toolchain.json beside this file, refused unless every file they name lies inside the toolchain folder. */
function readPins() {
  let pins;
  try {
    pins = JSON.parse(readFileSync(new URL('./toolchain.json', import.meta.url), 'utf8'));
  } catch (error) {
    return fail(`apps/cli/src/toolchain.json, which pins the toolchain, cannot be read: ${error.message}`);
  }
  for (const key of KEYS) {
    if (pins?.[key] === undefined) fail(`apps/cli/src/toolchain.json has no ${key}`);
    if (typeof pins[key] !== 'string') fail(`apps/cli/src/toolchain.json gives ${key} as ${JSON.stringify(pins[key])}, which is no string`);
  }
  const names = ['jreFile', 'jreRoot', 'tlcFile', 'alloyFile'];
  for (const key of names) {
    if (!oneName(pins[key])) fail(`apps/cli/src/toolchain.json names ${key} as ${JSON.stringify(pins[key])}, which is no single file or folder name`);
  }
  if (new Set(names.map((key) => pins[key])).size !== names.length) fail(`apps/cli/src/toolchain.json names one file or folder twice among ${names.join(', ')}`);
  if (!pins.jreJava.split('/').every(oneName)) fail(`apps/cli/src/toolchain.json names jreJava as ${JSON.stringify(pins.jreJava)}, which is no path inside the Java runtime's folder`);
  for (const key of ['jreBytes', 'tlcBytes', 'alloyBytes']) if (!/^[1-9][0-9]*$/.test(pins[key])) fail(`apps/cli/src/toolchain.json names ${key} as ${JSON.stringify(pins[key])}, which is no byte count`);
  for (const key of ['jreSha256', 'tlcSha256', 'alloySha256']) if (!/^[0-9a-f]{64}$/.test(pins[key])) fail(`apps/cli/src/toolchain.json names ${key} as ${JSON.stringify(pins[key])}, which is no SHA-256`);
  return pins;
}

/** Forma's toolchain module, which needs Forma's dependencies installed. */
async function toolchainModule() {
  try {
    return await import('./toolchain.mjs');
  } catch (error) {
    if (error.code === 'ENOENT' && /node_modules/.test(error.message)) {
      return fail(`Forma's dependencies are not installed (${error.message}): in Forma's checkout run \`pnpm install\`; an installed package carries them, so install it again`);
    }
    return fail(`Forma's toolchain module cannot be loaded: ${error.message}`);
  }
}

/** The toolchain folder, refused unless FORMA_TOOLCHAIN, when set, is an absolute path to a folder or to nothing yet. */
function folderOf(toolchainDir) {
  const given = process.env.FORMA_TOOLCHAIN;
  if (given !== undefined && given === '') fail('FORMA_TOOLCHAIN is set but empty: unset it to use forma/toolchain in your cache folder, or set it to a folder');
  if (given !== undefined && !isAbsolute(given)) {
    fail(`FORMA_TOOLCHAIN is ${given}, a relative path, which each command would read from its own folder: set it to an absolute path (a ~ inside quotes is not expanded)`);
  }
  const dir = resolve(toolchainDir());
  let link = null;
  try {
    if (lstatSync(dir).isSymbolicLink()) link = readlinkSync(dir);
  } catch {
    link = null;
  }
  if (link !== null && !existsSync(dir)) fail(`the toolchain folder ${dir} is a symbolic link to ${link}, which does not exist: restore that folder, or remove the link`);
  if (existsSync(dir) && !statSync(dir).isDirectory()) {
    fail(`the toolchain folder ${dir} is not a folder: ${given === undefined ? 'move that file away' : 'set FORMA_TOOLCHAIN to a folder'}`);
  }
  return dir;
}

async function fetchPinned(dir, pin) {
  const target = join(dir, pin.file);
  await rm(`${target}.partial`, { force: true });
  let again = '';
  if (existsSync(target)) {
    if (!statSync(target).isFile()) fail(`${target} is not a file: remove it, then run this again`);
    if ((await hashOf(target)) === pin.sha256) {
      process.stdout.write(`present ${pin.file}\n`);
      return;
    }
    again = ' again: the file there does not match its pinned SHA-256';
  }
  process.stdout.write(`fetching ${pin.name}, ${megabytes(pin.bytes)}, from ${pin.url}${again}\n`);
  const kept = again ? `; ${pin.file} is left as it was` : '';
  let response;
  try {
    response = await fetch(pin.url, { redirect: 'follow' });
  } catch (error) {
    fail(`${pin.url} could not be fetched (${error.cause?.message ?? error.message}): nothing was written${kept}. Check this machine's connection, and the address apps/cli/src/toolchain.json pins, then run this again`);
  }
  if (!response.ok) fail(`${pin.url} answered ${response.status} ${response.statusText}: nothing was written${kept}. The address is pinned in apps/cli/src/toolchain.json`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== pin.bytes) fail(`${pin.url} gave ${bytes.length} bytes and apps/cli/src/toolchain.json pins ${pin.bytes}: nothing was written${kept}`);
  const got = createHash('sha256').update(bytes).digest('hex');
  if (got !== pin.sha256) fail(`${pin.url} gave bytes whose SHA-256 is ${got}, and apps/cli/src/toolchain.json pins ${pin.sha256}: nothing was written${kept}`);
  const partial = `${target}.partial`;
  await writeFile(partial, bytes);
  await rename(partial, target);
  process.stdout.write(`fetched ${pin.file}\n`);
}

async function unpackRuntime(dir, pins, unpackedDiffers) {
  const archive = join(dir, pins.jreFile);
  const unpacked = join(dir, pins.jreRoot);
  const java = join(unpacked, pins.jreJava);
  let why = null;
  if (!existsSync(java)) why = existsSync(unpacked) ? `its java is missing at ${java}` : null;
  else if (!runs(java)) why = `its java at ${java} is not executable`;
  else {
    const differs = unpackedDiffers(readFileSync(archive), unpacked, pins.jreRoot);
    if (differs.length) why = `it is not exactly its archive: ${differs[0]}${differs.length > 1 ? `, and ${differs.length - 1} more` : ''}`;
  }
  if (why === null && existsSync(java)) {
    process.stdout.write(`present ${pins.jreRoot}\n`);
    return java;
  }
  process.stdout.write(why === null ? `unpacking the Java runtime into ${unpacked}\n` : `unpacking the Java runtime again, since ${why}\n`);
  await rm(unpacked, { recursive: true, force: true });
  const untar = spawnSync('tar', ['-xzf', archive, '-C', dir], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (untar.error) fail(untar.error.code === 'ENOENT' ? `tar, which unpacks ${pins.jreFile}, is not on this machine's PATH` : `tar could not be started to unpack ${pins.jreFile}: ${untar.error.message}`);
  if (untar.status !== 0) fail(`tar exited with status ${untar.status} unpacking ${pins.jreFile} into ${dir}`);
  if (!existsSync(java)) fail(`unpacking ${pins.jreFile} left no java at ${java}`);
  process.stdout.write(`unpacked ${pins.jreRoot}\n`);
  return java;
}

async function main() {
  const pins = readPins();
  if (process.platform !== pins.platform || process.arch !== pins.arch) {
    const gloss = pins.platform === 'darwin' && pins.arch === 'arm64' ? ' (macOS on Apple silicon)' : '';
    fail(`the toolchain is pinned for ${pins.platform} on ${pins.arch}${gloss}, and this machine is ${process.platform} on ${process.arch}: no other platform has a pinned Java runtime`);
  }
  const { toolchain, toolchainDir, unpackedDiffers } = await toolchainModule();
  const dir = folderOf(toolchainDir);
  await mkdir(dir, { recursive: true });
  const files = [
    { name: 'the Java runtime', file: pins.jreFile, url: pins.jreUrl, bytes: Number(pins.jreBytes), sha256: pins.jreSha256 },
    { name: 'TLC', file: pins.tlcFile, url: pins.tlcUrl, bytes: Number(pins.tlcBytes), sha256: pins.tlcSha256 },
    { name: 'Alloy', file: pins.alloyFile, url: pins.alloyUrl, bytes: Number(pins.alloyBytes), sha256: pins.alloySha256 },
  ];
  for (const pin of files) await fetchPinned(dir, pin);
  const java = await unpackRuntime(dir, pins, unpackedDiffers);
  const version = spawnSync(java, ['-version'], { encoding: 'utf8' });
  if (version.error || version.status !== 0) {
    fail(`the Java runtime at ${java} does not run: ${version.error?.message ?? (version.stderr || '').trim().split('\n')[0]}`);
  }
  try {
    await toolchain(dir);
  } catch (error) {
    fail(`the toolchain in ${dir} is not as pinned: ${error.message}`);
  }
  process.stdout.write(`toolchain ready in ${dir}\n`);
}

main().catch((error) => fail(error.message));
