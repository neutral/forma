// The black-box harness every contract test uses: a project folder built from hand-written files,
// Forma run on it through its command line, and the files it leaves. Nothing here knows a contract's
// rules; each test states the rule it checks and the contract section it comes from.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toolchainDir } from '../../src/toolchain.mjs';

/** Forma's command-line app in the workspace, `apps/cli`. */
export const app = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The workspace's root: the examples and the contracts. */
export const repo = join(app, '..', '..');
export const cli = join(app, 'src', 'cli.mjs');
export const fixtures = join(app, 'tests', 'fixtures');

/** The SHA-256 of bytes or text, as 64 lowercase hexadecimal digits. */
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** A new empty folder outside any project, for a project, an answer or a packet. */
export const tempFolder = (prefix = 'forma-') => mkdtemp(join(tmpdir(), prefix));

/** Writes `files`, a map from a path relative to `dir` to its text or bytes; a value of `null` writes nothing. */
export async function writeFiles(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    if (content === null) continue;
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), content);
  }
  return dir;
}

/** A project folder in a new temporary folder: a copy of `tests/fixtures/<name>` when a name is given, then `files` over it. */
export async function project(name = null, files = {}) {
  const dir = await tempFolder('forma-project-');
  if (name) await cp(join(fixtures, name), dir, { recursive: true });
  return writeFiles(dir, files);
}

/** An answer's folder, outside the project, holding `files`. */
export async function answerFolder(files) {
  return writeFiles(await tempFolder('forma-answer-'), files);
}

/**
 * Runs `forma --project <dir> <args...>` and returns `{ status, stdout, stderr, json }`, `json` being
 * stdout parsed when it parses and otherwise `null`. `options.env` adds to the environment, and
 * `options.input` is given as standard input, which is then not a terminal.
 */
export function forma(dir, args, options = {}) {
  const result = spawnSync(process.execPath, [cli, '--project', dir, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
    input: options.input ?? '',
    timeout: options.timeout ?? 600_000,
    maxBuffer: 1024 * 1024 * 1024,
  });
  let json = null;
  try { json = JSON.parse(result.stdout); } catch { json = null; }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, json };
}

/** Every file under `dir`, as paths relative to it with `/`, in byte order. */
export async function tree(dir) {
  const found = [];
  const walk = async (at) => {
    for (const entry of await readdir(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) await walk(path);
      else found.push(relative(dir, path).split('\\').join('/'));
    }
  };
  if (existsSync(dir)) await walk(dir);
  return found.sort((a, b) => (Buffer.from(a) < Buffer.from(b) ? -1 : a === b ? 0 : 1));
}

/** Every file under `dir` with its bytes as text, for comparing a folder before and after a command. */
export async function snapshot(dir, { skip = [] } = {}) {
  const files = {};
  for (const path of await tree(dir)) {
    if (skip.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) continue;
    files[path] = await readFile(join(dir, path), 'utf8');
  }
  return files;
}

/** Reads a file of a project as text, or `null` when it does not exist. */
export async function read(dir, path) {
  return existsSync(join(dir, path)) ? readFile(join(dir, path), 'utf8') : null;
}

/** Whether the pinned engine toolchain is present, as evidence.md §toolchain runs TLC and Alloy from it. */
export const toolchain = toolchainDir();
export const hasToolchain = existsSync(toolchain);
