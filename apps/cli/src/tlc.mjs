// Running TLC and reading what it says (engines.md §tlc, evidence.md §running, §outcomes).
// TLC runs in tool mode, whose numbered messages code reads. Code reads the values TLC
// prints, as data, and never TLA+ itself.

import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Tool-mode message codes of the pinned TLC (tlc2.output.EC), as its output shows them.
const CODE = {
  success: 2193,
  initial: 2107,
  invariant: 2110,
  propertyInitial: 2108,
  actionProperty: 2112,
  temporal: 2116,
  behaviour: 2121,
  counterExample: 2264,
  state: 2217,
  back: 2122,
  stuttering: 2218,
  stats: 2199,
  depth: 2194,
  progress: 2200,
  outOfMemory: 1001,
  outOfMemoryInitial: 1002,
};
const ERROR_CLASS = 1;
// TLC's own words when the Java heap runs out, in its messages or from the runtime itself.
const OUT_OF_MEMORY = /OutOfMemoryError|Java ran out of memory|^Out Of Memory\b/;
const MESSAGE = /@!@!@STARTMSG (\d+):(\d+) @!@!@\r?\n([\s\S]*?)@!@!@ENDMSG \1 @!@!@\r?\n?/g;

/**
 * Runs TLC on `files` (name to text or bytes) in a fresh folder, breadth first with one
 * worker, within `seconds` and `memory` megabytes of heap. Returns its raw output.
 */
export async function runTlc(tools, files, { module, cfg, seconds, memory }) {
  const work = await mkdtemp(join(tmpdir(), 'forma-tlc-'));
  try {
    for (const [name, content] of Object.entries(files)) await writeFile(join(work, name), content);
    // TLC unpacks the standard modules into java.io.tmpdir; a folder of its own keeps runs apart.
    const own = join(work, 'java-tmp');
    await mkdir(own);
    const args = [`-Xmx${memory}m`, '-XX:+UseParallelGC', `-Djava.io.tmpdir=${own}`, '-cp', tools.tla2tools, 'tlc2.TLC', '-tool', '-workers', '1', '-fp', '0', '-metadir', join(work, 'states'), '-config', cfg, `${module}.tla`];
    const started = Date.now();
    return await new Promise((done) => {
      const out = [];
      const err = [];
      let timedOut = false;
      const child = spawn(tools.java, args, { cwd: work });
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, Math.max(1, Math.round(seconds * 1000)));
      child.stdout.on('data', (chunk) => out.push(chunk));
      child.stderr.on('data', (chunk) => err.push(chunk));
      child.on('error', (error) => err.push(Buffer.from(String(error.message))));
      child.on('close', (code) => {
        clearTimeout(timer);
        done({ stdout: Buffer.concat(out), stderr: Buffer.concat(err), code, timedOut, milliseconds: Date.now() - started });
      });
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

const number = (text) => Number(text.replace(/,/g, ''));

/** One printed state: `/\ name = value` lines, a value continuing on indented lines. */
function stateValues(lines) {
  const values = {};
  let current = null;
  for (const line of lines) {
    const start = /^(?:\/\\ )?([A-Za-z_][A-Za-z0-9_]*) = (.*)$/.exec(line);
    if (start) {
      current = start[1];
      values[current] = start[2];
    } else if (current && /^\s/.test(line) && line.trim()) values[current] += `\n${line}`;
  }
  return values;
}

/** The step label TLC prints: the initial predicate, or the operator it names and where. */
function label(text) {
  if (text === 'Initial predicate') return null;
  const named = /^(\S+?) line (\d+), col (\d+) to line (\d+), col (\d+) of module (\S+)$/.exec(text);
  return named ? { operator: named[1], module: named[6], line: Number(named[2]) } : { operator: text, module: null, line: null };
}

/**
 * Reads TLC's tool-mode output: its answer, its trace, its measures and its errors, and whether
 * the heap ran out. The depth is the complete search's, or, when TLC prints none, as for a
 * liveness violation, the level of its last progress report.
 */
export function readTlc(text) {
  // A violated invariant as TLC names it: by name, or a conjunct of one by its place in a module.
  const invariant = (line) => {
    const named = /^Invariant (\S+) is violated/.exec(line);
    if (named && named[1] !== 'line') return { violated: named[1] };
    const placed = /^Invariant line \d+, col \d+ to line \d+, col \d+ of module (\S+) is violated/.exec(line);
    return placed ? { violatedIn: placed[1] } : {};
  };
  const result = { success: false, violated: null, violatedIn: null, temporal: false, trace: null, generated: null, distinct: null, depth: null, outOfMemory: false, errors: [] };
  const states = [];
  let back = null;
  let stuttering = false;
  let messages = 0;
  let progress = null;
  for (const match of text.matchAll(MESSAGE)) {
    messages += 1;
    const code = Number(match[1]);
    const body = match[3];
    const lines = body.split(/\r?\n/);
    if (code === CODE.success) result.success = true;
    else if (code === CODE.invariant) Object.assign(result, invariant(lines[0]));
    else if (code === CODE.initial) {
      Object.assign(result, invariant(lines[0]));
      states.push({ state: 1, step: null, values: stateValues(lines.slice(1)) });
    } else if (code === CODE.temporal || code === CODE.actionProperty) result.temporal = true; // a property of the configuration is violated, as a temporal formula or as an action property
    else if (code === CODE.propertyInitial) {
      result.temporal = true;
      states.push({ state: 1, step: null, values: stateValues(lines.slice(1)) });
    } else if (code === CODE.state) {
      const head = /^(\d+): <(.*)>$/.exec(lines[0]);
      if (head) states.push({ state: Number(head[1]), step: label(head[2]), values: stateValues(lines.slice(1)) });
    } else if (code === CODE.back) {
      const head = /^(\d+): Back to state: <(.*)>$/.exec(lines[0]);
      if (head) back = { state: Number(head[1]), step: label(head[2]) };
    } else if (code === CODE.stuttering) stuttering = true;
    else if (code === CODE.stats) {
      const stats = /^([\d,]+) states generated, ([\d,]+) distinct states found/.exec(lines[0]);
      if (stats) Object.assign(result, { generated: number(stats[1]), distinct: number(stats[2]) });
    } else if (code === CODE.depth) {
      const depth = /depth of the complete state graph search is ([\d,]+)/.exec(body);
      if (depth) result.depth = number(depth[1]);
    } else if (code === CODE.progress) {
      const level = /^Progress\(([\d,]+)\)/.exec(lines[0]);
      if (level) progress = number(level[1]);
    } else if (Number(match[2]) === ERROR_CLASS && code !== CODE.behaviour && code !== CODE.counterExample) {
      const said = body.trim().replace(/\s+/g, ' ');
      if (code === CODE.outOfMemory || code === CODE.outOfMemoryInitial || OUT_OF_MEMORY.test(said)) result.outOfMemory = true;
      result.errors.push(said);
    }
  }
  result.depth ??= progress;
  // Outside tool-mode messages TLC prints only its parser's reports.
  if (!result.success && !result.violated && !result.violatedIn && !result.temporal && !result.errors.length) {
    const said = text.replace(MESSAGE, '').split(/\r?\n/).filter((line) => line.trim() && !/^(Parsing file|Semantic processing)/.test(line));
    if (said.length) result.errors.push(said.join(' ').replace(/\s+/g, ' ').trim());
  }
  if (states.length) result.trace = { states, back, stuttering };
  result.messages = messages;
  return result;
}

// --- Values TLC prints ---------------------------------------------------------------------------

/**
 * Reads one value as TLC prints it: an integer, a string, TRUE or FALSE, a model value or
 * named set, a range m..n, a set {…}, a tuple <<…>>, a record […|->…], or a function
 * (k :> v @@ …).
 */
export function parseTlcValue(text) {
  const source = text;
  let at = 0;
  const space = () => { while (/\s/.test(source[at] ?? '')) at += 1; };
  const expect = (token) => {
    space();
    if (!source.startsWith(token, at)) throw new Error(`expected ${token} at ${at + 1}`);
    at += token.length;
  };
  const list = (close, item) => {
    const items = [];
    space();
    if (source.startsWith(close, at)) { at += close.length; return items; }
    for (;;) {
      items.push(item());
      space();
      if (source[at] === ',') { at += 1; continue; }
      expect(close);
      return items;
    }
  };
  const value = () => {
    space();
    if (source.startsWith('<<', at)) { at += 2; return { kind: 'tuple', items: list('>>', value) }; }
    if (source[at] === '{') { at += 1; return { kind: 'set', items: list('}', value) }; }
    if (source[at] === '[') {
      at += 1;
      return {
        kind: 'record',
        fields: list(']', () => {
          space();
          const name = /^[A-Za-z0-9_]+/.exec(source.slice(at));
          if (!name) throw new Error(`expected a field name at ${at + 1}`);
          at += name[0].length;
          expect('|->');
          return [name[0], value()];
        }),
      };
    }
    if (source[at] === '(') {
      at += 1;
      const pairs = [];
      for (;;) {
        const key = value();
        expect(':>');
        pairs.push([key, value()]);
        space();
        if (source.startsWith('@@', at)) { at += 2; continue; }
        expect(')');
        return { kind: 'function', pairs };
      }
    }
    if (source[at] === '"') {
      let end = at + 1;
      let string = '';
      while (end < source.length && source[end] !== '"') {
        if (source[end] === '\\') { string += { n: '\n', t: '\t', '"': '"', '\\': '\\' }[source[end + 1]] ?? source[end + 1]; end += 2; } else { string += source[end]; end += 1; }
      }
      if (end >= source.length) throw new Error('unterminated string');
      at = end + 1;
      return { kind: 'string', value: string };
    }
    const range = /^(-?\d+)\.\.(-?\d+)/.exec(source.slice(at));
    if (range) { at += range[0].length; return { kind: 'range', from: Number(range[1]), to: Number(range[2]) }; }
    const integer = /^-?\d+/.exec(source.slice(at));
    if (integer) { at += integer[0].length; return { kind: 'integer', value: Number(integer[0]) }; }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(at));
    if (word) {
      at += word[0].length;
      if (word[0] === 'TRUE' || word[0] === 'FALSE') return { kind: 'boolean', value: word[0] === 'TRUE' };
      return { kind: 'name', name: word[0] };
    }
    throw new Error(`unexpected "${source[at] ?? 'end'}" at ${at + 1}`);
  };
  const result = value();
  space();
  if (at !== source.length) throw new Error(`unexpected text after the value at ${at + 1}`);
  return result;
}

/** A value written back in one canonical form, so equal values print equally. */
export function tlcText(value) {
  switch (value.kind) {
    case 'tuple': return `<<${value.items.map(tlcText).join(', ')}>>`;
    case 'set': return `{${value.items.map(tlcText).join(', ')}}`;
    case 'record': return `[${value.fields.map(([name, v]) => `${name} |-> ${tlcText(v)}`).join(', ')}]`;
    case 'function': return `(${value.pairs.map(([k, v]) => `${tlcText(k)} :> ${tlcText(v)}`).join(' @@ ')})`;
    case 'string': return `"${value.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    case 'range': return `${value.from}..${value.to}`;
    case 'integer': return String(value.value);
    case 'boolean': return value.value ? 'TRUE' : 'FALSE';
    default: return value.name;
  }
}

/**
 * A printed function as its pairs, each key in canonical form: TLC prints a function on
 * strings as a record, on 1..n as a tuple, and otherwise with :> and @@.
 */
export function functionPairs(value) {
  if (value.kind === 'record') return value.fields.map(([name, v]) => [tlcText({ kind: 'string', value: name }), v]);
  if (value.kind === 'tuple') return value.items.map((v, index) => [String(index + 1), v]);
  if (value.kind === 'function') return value.pairs.map(([k, v]) => [tlcText(k), v]);
  throw new Error(`not a function: ${tlcText(value)}`);
}
