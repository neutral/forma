// Alloy, driven through the pinned jar's own command line and language server
// (engines.md §engine-text, §alloy; evidence.md §running). Code reads no Alloy itself: it reads what
// Alloy's parser reports, the symbols and ranges its language server gives, and the instances
// its solver writes.

import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FORMA_VERSION } from './version.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// A parse or symbol result is kept under every file it read, the pinned jar, Forma's version
// and this file's own text, so it is used only when asking again would give exactly the same
// (engines.md §engine-text).
const SELF = sha256(readFileSync(new URL(import.meta.url)));
const CACHE = join(tmpdir(), 'forma-cache');

/** A folder of its own holding `files`, path to text or bytes, and a temporary folder for the JVM. */
async function folderOf(files) {
  const work = await mkdtemp(join(tmpdir(), 'forma-alloy-'));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(work, path)), { recursive: true });
    await writeFile(join(work, path), content);
  }
  await mkdir(join(work, 'java-tmp'));
  return work;
}

/** Runs the jar with `args` in `work`, killed after `seconds`: its output, exit code and time. */
function runJar(tools, work, args, { seconds = 120, memory = 1024, input = null } = {}) {
  const started = Date.now();
  return new Promise((done) => {
    const out = [];
    const err = [];
    let timedOut = false;
    // The solvers write their files into java.io.tmpdir, so each JVM has its own.
    const child = spawn(tools.java, [`-Xmx${memory}m`, `-Djava.io.tmpdir=${join(work, 'java-tmp')}`, '-jar', tools.alloy, ...args], { cwd: work });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, Math.max(1, Math.round(seconds * 1000)));
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', (error) => err.push(Buffer.from(String(error.message))));
    if (input) child.stdin.end(input);
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ stdout: Buffer.concat(out), stderr: Buffer.concat(err), code, timedOut, milliseconds: Date.now() - started });
    });
  });
}

// The questions being computed in this process, by key.
const asked = new Map();

/**
 * What `compute` gives, `{ result, definite }`, kept under the engine asked and every file it read
 * only when it is the engine's definite answer: asking again would give exactly the same
 * (engines.md §engine-text). An engine that did not finish answers nothing, and is asked again the next time.
 */
async function cached(kind, tools, files, main, compute) {
  const key = sha256(JSON.stringify([FORMA_VERSION, SELF, kind, tools.java, tools.alloy, main, Object.entries(files).map(([path, content]) => [path, sha256(content)]).sort()]));
  const at = join(CACHE, `alloy-${kind}-${key}.json`);
  if (existsSync(at)) return JSON.parse(await readFile(at, 'utf8'));
  // Several questions are asked at once in one process: the same one asked twice is computed once.
  if (!asked.has(key)) {
    asked.set(key, (async () => {
      const { result, definite } = await compute();
      if (!definite) return result;
      await mkdir(CACHE, { recursive: true });
      // Written aside, under a name no other write has, and renamed into place.
      const aside = `${at}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(aside, JSON.stringify(result));
      await rename(aside, at);
      return result;
    })().finally(() => asked.delete(key)));
  }
  return asked.get(key);
}

/** The engine's own words: the lines it wrote, each trimmed and joined by a space, up to 400 characters. */
const wordsOf = (...outputs) => outputs.map((bytes) => bytes?.toString('utf8') ?? '').join('\n').split('\n').map((line) => line.trim()).filter(Boolean).join(' ').slice(0, 400);

/** Alloy's own error reports, `<kind> error in <path> at line L column C:` and the message, by file. */
function alloyErrors(text, work) {
  const found = [];
  const seen = new Set();
  // The engine names a file by its real path, which on some systems differs from the folder's own.
  const roots = work ? [...new Set([work, realpathSync(work)])] : [];
  for (const match of String(text).matchAll(/(\w+) error in (.+?) at line (\d+) column (\d+):\n([\s\S]*?)(?=\n\w+ error in |\n\tat |\nError\n|$)/g)) {
    const root = roots.find((r) => match[2].startsWith(`${r}/`));
    const file = root ? match[2].slice(root.length + 1) : match[2];
    const message = match[5].trim().split('\n').map((line) => line.trim()).filter(Boolean).join(' ');
    const key = `${file}:${match[3]}:${match[4]}:${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ kind: match[1], file, line: Number(match[3]), column: Number(match[4]), message });
  }
  return found;
}

/**
 * Whether Alloy's parser accepts `main`, among `files`, with every module it opens (engines.md §engine-text): the
 * command line's `commands`, which parses and type-checks without solving. Gives `ok`, the errors
 * by file, line and column, and the file's commands as Alloy lists them.
 */
export async function alloyParse(tools, files, main) {
  return cached('parse', tools, files, main, async () => {
    const work = await folderOf(files);
    try {
      const raw = await runJar(tools, work, ['commands', main], { seconds: 120 });
      const stdout = raw.stdout.toString('utf8');
      const stderr = raw.stderr.toString('utf8');
      if (raw.code === 0) {
        // Alloy numbers its commands in a field two wide, `9 .` and then `10.`.
        const commands = [...stdout.matchAll(/^(\d+) *\. (Run|Check) (\S+)(.*)$/gm)].map((m) => ({ index: Number(m[1]), type: m[2].toLowerCase(), name: m[3], text: `${m[2]} ${m[3]}${m[4]}`.trim() }));
        return { definite: true, result: { ok: true, errors: [], commands } };
      }
      // The parser's refusal is an error it reports by file, line and column. Anything else is the
      // engine not finishing, out of time or memory or unable to start, which is no answer to keep.
      const errors = alloyErrors(stderr, work);
      if (errors.length && !raw.timedOut) return { definite: true, result: { ok: false, errors, commands: [] } };
      const why = raw.timedOut ? 'it was stopped after 120 s' : wordsOf(raw.stderr) || `exit code ${raw.code}`;
      return { definite: false, result: { ok: false, errors: [{ kind: 'Alloy', file: main, line: null, column: null, message: `Alloy's parser did not answer: ${why}` }], commands: [] } };
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });
}

// The language server's symbol kinds, as it gives them (engines.md §engine-text).
const KINDS = { 5: 'sig', 19: 'sig', 8: 'field', 12: 'fun', 17: 'pred', 7: 'assert', 24: 'command' };

/** One language-server session over stdio: initialize, open `main`, and ask its document symbols. */
function symbolSession(tools, work, main, text, seconds) {
  return new Promise((done, fail) => {
    const child = spawn(tools.java, ['-Xmx512m', `-Djava.io.tmpdir=${join(work, 'java-tmp')}`, '-jar', tools.alloy, 'lsp'], { cwd: work });
    let buffer = Buffer.alloc(0);
    let id = 0;
    let ended = false;
    const waiting = new Map();
    const said = [];
    // The session ends once, with the symbols or with why there are none, the server's own last words beside it.
    const end = (error, symbols) => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      child.kill('SIGKILL');
      if (!error) { done(symbols); return; }
      const words = wordsOf(Buffer.concat(said));
      fail(new Error(`${error.message}${words ? `: ${words}` : ''}`));
    };
    const timer = setTimeout(() => end(new Error(`Alloy's language server gave no symbols within ${seconds} s`)), seconds * 1000);
    const send = (message) => {
      const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...message }));
      child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
      child.stdin.write(body);
    };
    const request = (method, params) => new Promise((answered) => { id += 1; waiting.set(id, answered); send({ id, method, params }); });
    // Its error output is read as it comes, so the server never waits on a full pipe.
    child.stderr.on('data', (chunk) => said.push(chunk));
    child.stdin.on('error', () => {}); // a server that has exited takes no more input: its exit is the failure
    child.stdout.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const head = buffer.indexOf('\r\n\r\n');
        if (head < 0) return;
        const length = Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0, head).toString('latin1'))?.[1] ?? 0);
        if (buffer.length < head + 4 + length) return;
        let message;
        try { message = JSON.parse(buffer.subarray(head + 4, head + 4 + length).toString('utf8')); } catch (error) { end(new Error(`Alloy's language server sent a message that is not JSON: ${error.message}`)); return; }
        buffer = buffer.subarray(head + 4 + length);
        if (message?.id !== undefined && waiting.has(message.id)) { waiting.get(message.id)(message); waiting.delete(message.id); }
      }
    });
    child.on('error', (error) => end(new Error(`Alloy's language server could not be started: ${error.message}`)));
    // A server that exits before it answers has failed, at once and with its exit.
    child.on('close', (code, signal) => end(new Error(`Alloy's language server exited ${code === null ? `on ${signal}` : `with code ${code}`} before it listed the symbols`)));
    (async () => {
      // A file URI holds any path: a space, a # or another reserved character is escaped.
      const uri = pathToFileURL(join(work, main)).href;
      const started = await request('initialize', { processId: process.pid, rootUri: pathToFileURL(work).href, capabilities: {} });
      if (started.error) throw new Error(`Alloy's language server did not start its session: ${started.error.message ?? 'no reason given'}`);
      send({ method: 'initialized', params: {} });
      send({ method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: 'alloy', version: 1, text } } });
      const answer = await request('textDocument/documentSymbol', { textDocument: { uri } });
      // An error is the server's failure, never a file that defines nothing.
      if (answer.error || !Array.isArray(answer.result)) throw new Error(`Alloy's language server did not list the symbols: ${answer.error ? answer.error.message ?? 'no reason given' : 'it gave no list'}`);
      end(null, answer.result);
    })().catch((error) => end(error));
  });
}

/**
 * What `main` defines, as Alloy's language server lists it (engines.md §engine-text): each signature, field,
 * function, predicate, assertion and command, with its kind and its 0-based source range. It
 * lists no fact and no `open`. What Alloy adds of its own, a default command with its predicate
 * and a signature `Univ` for a module with none, it places outside the file, and is left out.
 */
export async function alloySymbols(tools, files, main, { seconds = 60 } = {}) {
  return cached('symbols', tools, files, main, async () => {
    const work = await folderOf(files);
    try {
      const listed = await symbolSession(tools, work, main, String(files[main]), seconds);
      const inFile = (s) => {
        if (!s.location) return true;
        try { return decodeURIComponent(new URL(s.location.uri).pathname).endsWith(`/${main}`); } catch { return false; }
      };
      // The server gives a signature declared `one` or `lone` a kind of its own: `single` says so.
      return { definite: true, result: listed.filter(inFile).map((s) => ({ name: s.name, kind: KINDS[s.kind] ?? `kind ${s.kind}`, range: s.location?.range ?? s.range, ...(KINDS[s.kind] === 'sig' && { single: s.kind === 19 }) })) };
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });
}

/**
 * Runs one command of `main` (engines.md §alloy, evidence.md §running): `exec`, with the solutions written as XML beside the
 * receipt. Gives the engine's output, whether it ran out of time, the files it wrote, unaltered,
 * by name, and the receipt and solution read from them.
 */
export async function runAlloy(tools, files, { main, command, seconds, memory }) {
  const work = await folderOf(files);
  try {
    const raw = await runJar(tools, work, ['exec', '-q', '-f', '-c', command, '-t', 'xml', '-o', 'out', main], { seconds, memory });
    const outputs = {};
    if (existsSync(join(work, 'out'))) for (const name of (await readdir(join(work, 'out'))).sort()) outputs[name] = await readFile(join(work, 'out', name));
    // A receipt the engine was stopped while writing does not parse: the run keeps what was written, and has not answered (evidence.md §outcomes).
    let receipt = null;
    let receiptError = null;
    if (outputs['receipt.json']) {
      try { receipt = JSON.parse(outputs['receipt.json'].toString('utf8')); } catch (error) { receiptError = error.message; }
    }
    const xmlName = Object.keys(outputs).find((name) => name.endsWith('.xml'));
    const xml = xmlName ? outputs[xmlName].toString('utf8') : null;
    return { ...raw, outputs, receipt, ...(receiptError && { receiptError }), xml, errors: alloyErrors(raw.stderr.toString('utf8'), work) };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/**
 * What a run of `command` answers (evidence.md §outcomes, engines.md §trace): whether it found an instance, its states, each with
 * its atoms' field values, the state its lasso loops back to, the command's scope, the scopes it
 * gives signatures and its steps, and each signature as the receipt declares it. An engine that
 * ran out of time or memory, or failed, has not answered.
 */
export function readAlloy(raw, command, { seconds = null, memory = null, type = null } = {}) {
  const failed = (why) => ({ answered: false, reason: `the engine failed: ${why}` });
  if (raw.timedOut) return { answered: false, reason: `ran out of time: stopped after ${seconds ?? '?'} s` };
  // The parser's own report comes first, whatever names it quotes; a heap run out is the Java runtime's report of it.
  const error = raw.code !== 0 || !raw.receipt?.commands?.[command] ? raw.errors?.[0] : null;
  if (error) return failed(`${error.kind} error at line ${error.line} column ${error.column}: ${error.message}`);
  if (/\bjava\.lang\.OutOfMemoryError\b/.test(`${raw.stdout?.toString('utf8') ?? ''}\n${raw.stderr?.toString('utf8') ?? ''}`)) return { answered: false, reason: `ran out of memory${memory ? `: ${memory} MB of heap` : ''}` };
  if (raw.code !== 0) {
    const words = wordsOf(raw.stderr);
    return failed(`exit code ${raw.code}${words ? `: ${words}` : ''}`);
  }
  // What it wrote is read whole, or it has not answered (evidence.md §outcomes).
  if (raw.receiptError) return failed(`its receipt could not be read: ${raw.receiptError}`);
  if (!raw.receipt || typeof raw.receipt !== 'object') return failed('it wrote no receipt');
  const entry = raw.receipt.commands?.[command];
  if (!entry || typeof entry !== 'object') return failed(`its receipt holds no command ${command}`);
  // The entry answers only when it is of the kind the question asks, a check or a run (evidence.md §outcomes).
  if (type && entry.type !== type) return failed(`its receipt's ${command} is a ${entry.type}, and the question is a ${type}`);
  // The command's measures as the receipt gives them (evidence.md §measures): one the command leaves to Alloy's own default it gives as -1, recorded as not given.
  const given = (number) => (Number.isInteger(number) && number >= 0 ? number : null);
  const measures = { scope: given(entry.overall), scopes: entry.scopes ?? [], steps: given(entry.maxprefix), stepsFrom: given(entry.minprefix), bitwidth: given(entry.bitwidth) };
  const sigs = raw.receipt.sigs ?? {};
  if (entry.solution === undefined) return { answered: true, sat: false, type: entry.type, measures, sigs };
  // A state is its atoms, each with its fields' values, tuples of atoms.
  const found = Array.isArray(entry.solution) ? entry.solution[0]?.instances : null;
  const held = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const tuples = (value) => Array.isArray(value) && value.every((tuple) => Array.isArray(tuple) && tuple.every((atom) => typeof atom === 'string'));
  const state = (instance) => held(instance) && held(instance.values ?? {}) && Object.values(instance.values ?? {}).every((fields) => held(fields) && Object.values(fields).every(tuples));
  if (!Array.isArray(found) || !found.length || !found.every(state)) return failed('its solution does not hold its states');
  const states = found.map((instance, at) => ({ state: at, values: instance.values ?? {} }));
  // Alloy's traces are lassos (engines.md §trace): the solution gives the length of the trace and of its loop, which closes on a state the trace holds.
  const attributes = /<instance [^>]*tracelength="(\d+)"[^>]*looplength="(\d+)"/.exec(raw.xml ?? '');
  if (!attributes) return failed('its solution gives no loop for its trace');
  const [length, loop] = [Number(attributes[1]), Number(attributes[2])];
  if (length !== states.length) return failed(`its solution's trace has ${length} states, and its receipt ${states.length}`);
  if (loop < 1 || loop > length) return failed(`its solution's loop of ${loop} states is not within its trace of ${length}`);
  return { answered: true, sat: true, type: entry.type, states, loopBack: length - loop, measures, sigs };
}

/**
 * The values of code's observers in one state of a solution (engines.md §alloy): the fields named `formaRow<n>`,
 * `formaOver<n>`, `formaPhase<n>x<k>` and `formaEntity<k>`, read from the integer they sit on,
 * whichever it is.
 */
export function observerValues(state) {
  const own = {};
  for (const fields of Object.values(state?.values ?? {})) {
    for (const [name, tuples] of Object.entries(fields)) if (/^forma(Row\d+|Over\d+|Phase\d+x\d+|Entity\d+)$/.test(name)) own[name] = [...(own[name] ?? []), ...tuples];
  }
  return own;
}

/**
 * The lines of a probe module that the language server does not list as code wrote them (models.md §slot-answer).
 * Each of `lines`, `{ kind, name, text }`, the line `offset` + its index of the module, is one
 * definition of that kind and name over its whole line, so a native piece it holds neither ends
 * it nor adds a definition or a fact beside it. Gives the lines that are not, as `stray`, and
 * whether the server lists a definition code did not write, as `more`.
 */
export function strayLines(listed, lines, offset) {
  const whole = (line, at) => {
    const on = listed.filter((s) => s.range.start.line === at + offset);
    return on.length === 1 && on[0].kind === line.kind && on[0].name === line.name && on[0].range.start.character === 0 && on[0].range.end.line === at + offset && on[0].range.end.character === line.text.length;
  };
  return { stray: lines.filter((line, at) => !whole(line, at)), more: listed.length !== lines.length };
}

/**
 * An atom as the developer reads it: without the module its signature is in, and, for a
 * signature declared `one`, without its number, as the model's text names it; an integer as it is.
 */
export function atomName(label, sigs = {}) {
  const at = /^(.*)\$(\d+)$/.exec(String(label));
  if (!at) return String(label);
  const name = at[1].split('/').pop();
  return sigs[at[1]]?.cardinality === 'one' ? name : `${name}$${at[2]}`;
}

/**
 * The lines of Alloy text as Alloy counts them (engines.md §engine-text), each with its text and the offset it
 * starts at: a line ends at a line feed, at a carriage return, or at the two together.
 */
export function alloyLines(text) {
  const lines = [];
  let from = 0;
  for (const ending of String(text).matchAll(/\r\n|\r|\n/g)) {
    lines.push({ text: text.slice(from, ending.index), offset: from });
    from = ending.index + ending[0].length;
  }
  lines.push({ text: String(text).slice(from), offset: from });
  return lines;
}

/** `text` with the 0-based `range` that Alloy's language server gives, in Alloy's own lines (engines.md §engine-text), replaced by `replacement`. */
export function replaceRange(text, range, replacement) {
  const lines = alloyLines(text);
  const offset = ({ line, character }) => (lines[line] ? lines[line].offset + character : text.length);
  return `${text.slice(0, offset(range.start))}${replacement}${text.slice(offset(range.end))}`;
}

/**
 * Whether the scope allows fewer than two atoms of a signature declared without `one`, `lone` or
 * `abstract` (evidence.md §flags). `scope` is the model's scope as `parseScope` reads it, and `declared` the
 * signatures the language server lists in the model's files, each `{ name, single }`. What the
 * scope allows a signature is the bound it gives it by name, or for a top-level one without a
 * bound its default number, and never more than the top-level signatures it lies within are
 * allowed together, as the receipt's `sigs` name them. A signature is `one` or `lone` when the
 * receipt or the language server says so, which also lists a subset signature's and a private
 * one's; a private signature, which no receipt lists and no scope can name, is counted at the
 * default number. Code's own observers' signature (engines.md §alloy) is no signature of the model.
 */
export function tinyScope(read, scope, declared = []) {
  const sigs = Object.entries(read.sigs ?? {}).filter(([name, sig]) => !sig.builtin && name !== 'FormaSteps').map(([name, sig]) => ({
    name, leaf: name.split('/').pop(), cardinality: sig.cardinality, tops: String(sig.type ?? '').replace(/^\{|\}$/g, '').split(',').map((top) => top.trim()).filter(Boolean),
  }));
  const byName = new Map(sigs.map((sig) => [sig.name, sig]));
  // A bound names its signature as the receipt does, by the end of that name, or as `this/`: one signature, or none.
  const bound = new Map();
  for (const given of scope.bounds) {
    const named = sigs.filter((sig) => sig.name === given.name || sig.name.endsWith(`/${given.name}`) || given.name === `this/${sig.name}`);
    if (named.length === 1) bound.set(named[0].name, given.number);
  }
  const fallback = scope.number ?? Infinity;
  const single = (leaf) => {
    const named = declared.filter((sig) => sig.name === leaf);
    return named.length > 0 && named.every((sig) => sig.single);
  };
  // A signature declared `one` or `lone` allows one atom at most, whatever the scope gives it, and so allows no more to
  // a signature that lies within it.
  const atMostOne = (sig) => ['one', 'lone'].includes(sig.cardinality) || single(sig.leaf);
  const allowed = (sig) => {
    const cap = atMostOne(sig) ? 1 : Infinity;
    const top = sig.tops.length === 1 && sig.tops[0] === sig.name;
    if (top) return Math.min(bound.get(sig.name) ?? fallback, cap);
    const within = sig.tops.reduce((sum, name) => sum + (byName.has(name) && name !== sig.name ? allowed(byName.get(name)) : Infinity), 0);
    return Math.min(bound.get(sig.name) ?? Infinity, within, cap);
  };
  if (sigs.some((sig) => ['set', 'some'].includes(sig.cardinality) && !single(sig.leaf) && allowed(sig) < 2)) return true;
  return declared.some((sig) => !sig.single && !sigs.some((listed) => listed.leaf === sig.name) && fallback < 2);
}
