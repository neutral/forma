#!/usr/bin/env node
// Forma's command line (spec/project.md §commands): `forma [--project <folder>] <command> ...`, the
// project folder the one --project names or else the current one. It refuses an unknown command or
// option, an option given twice or without its value, and a --project that names no folder, writing
// nothing; asks the clock rule (door.md §clock) before a command that records; and hands each command
// to its module: give and answer to the door (door.md §forma-give, §forma-answer), run to the evidence (evidence.md §forma-run),
// show and decide to the decisions (decisions.md §forma-show, §forma-decide), missing, account, box and diff to the
// account (account.md §commands). Each command returns `{ status, stdout, stderr }`; this file prints it and
// exits with its status, 0 when it did what was asked and 1 when it refused.

import { realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reasonLine } from './door/common.mjs';

/** The commands and what each takes (spec/project.md §commands): positional arguments, and options with a value. */
const COMMANDS = {
  give: { positional: [2, 2], values: [], usage: 'forma give <item> <folder> [--json]' },
  answer: { positional: [2, 2], values: ['--provider', '--model', '--session'], usage: 'forma answer <item> <folder> --provider <name> --model <name> --session <id> [--json]' },
  run: { positional: [0, 0], values: [], usage: 'forma run [--json]' },
  show: { passthrough: true, usage: 'forma show <kind> [<on>] [--words <text> | --from <file>] [--json]' },
  decide: { passthrough: true, usage: 'forma decide <kind> [<on>] [<option> ...]' },
  missing: { positional: [0, 0], values: [], usage: 'forma missing [--json]' },
  account: { positional: [0, 1], values: [], usage: 'forma account [<part, span or thing>] [--json]' },
  box: { positional: [0, 0], values: [], usage: 'forma box [--json]' },
  diff: { positional: [0, 1], values: [], usage: 'forma diff [<commit or folder>] [--json]' },
  explore: { positional: [0, 0], values: [], usage: 'forma explore --json' },
};

const CHECK = 'project.md §commands';
const reason = (says, check = CHECK, file = null) => ({ check, file, entry: null, field: null, says });

/** A refusal before any command ran, printed as text or, with --json, `{"refused": [<reason>]}`. */
function refusal(reasons, json) {
  return { status: 1, stdout: json ? `${JSON.stringify({ refused: reasons })}\n` : `${reasons.map(reasonLine).join('\n')}\n`, stderr: '' };
}

/**
 * The options of a decide or show command line that take a value (decisions.md §forma-show, §forma-decide): the token after one is its
 * value, unless it is one of these options, --json or --project, which a value never is.
 */
const D_VALUES = new Set(['--words', '--from', '--shown', '--by', '--provider', '--model', '--session', '--choice', '--basis', '--situation', '--answers', '--runs', '--tlc-seconds', '--tlc-megabytes', '--alloy-seconds', '--alloy-megabytes', '--lifecycle-seconds', '--cadence', '--inbox-cap', '--verdict', '--level', '--target']);

/**
 * Reads a command line (spec/project.md §commands): `{ project, command, positional, values, json, rest, refused }`.
 * `--project` and `--json` may stand anywhere; a show or decide line is passed on as it is, but for --project.
 */
function parseLine(argv) {
  const refused = [];
  let project = null;
  let command = null;
  let json = false;
  const positional = [];
  const values = new Map();
  const rest = [];
  const seen = new Set();
  // After an unknown command nothing more is read as its arguments, but --json still asks for the refusal as JSON.
  let unknown = false;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (unknown) {
      if (token === '--json') json = true;
      continue;
    }
    const spec = command ? COMMANDS[command] : null;
    if (token === '--project') {
      if (seen.has('--project')) refused.push(reason('the option --project is given twice; give it once'));
      seen.add('--project');
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        refused.push(reason('the option --project is given without its value: --project <folder>'));
        continue;
      }
      project = value;
      i += 1;
      continue;
    }
    if (spec?.passthrough) {
      rest.push(token);
      // A value is the next token, unless that is itself an option a show or decide line takes: then this one is given
      // without its value, which the command refuses.
      const next = argv[i + 1];
      if (D_VALUES.has(token) && next !== undefined && !D_VALUES.has(next) && next !== '--json' && next !== '--project') rest.push(argv[(i += 1)]);
      if (token === '--json') json = true;
      continue;
    }
    if (token === '--json') {
      if (seen.has('--json')) refused.push(reason('the option --json is given twice; give it once'));
      seen.add('--json');
      json = true;
      continue;
    }
    if (token.startsWith('--')) {
      if (!command) {
        refused.push(reason(`${token} is no option Forma knows before a command: forma [--project <folder>] <command> ...`));
        continue;
      }
      if (!spec.values.includes(token)) {
        refused.push(reason(`${token} is no option of forma ${command}: ${spec.usage}`));
        continue;
      }
      if (seen.has(token)) refused.push(reason(`the option ${token} is given twice; give it once`));
      seen.add(token);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        refused.push(reason(`the option ${token} is given without its value: ${spec.usage}`));
        continue;
      }
      values.set(token, value);
      i += 1;
      continue;
    }
    if (!command) {
      if (!Object.hasOwn(COMMANDS, token)) {
        refused.push(reason(`${token} is no command Forma knows; the commands are ${Object.keys(COMMANDS).join(', ')}`));
        unknown = true;
        continue;
      }
      command = token;
      continue;
    }
    positional.push(token);
  }
  if (!command && !refused.length) refused.push(reason(`no command is given: forma [--project <folder>] <command> ..., the command one of ${Object.keys(COMMANDS).join(', ')}`));
  if (command && !COMMANDS[command].passthrough) {
    const [, most] = COMMANDS[command].positional;
    if (positional.length > most) refused.push(reason(`forma ${command} takes ${most === 0 ? 'no argument' : `at most ${most} argument${most === 1 ? '' : 's'}`}, and was given ${positional.map((p) => `"${p}"`).join(' ')}: ${COMMANDS[command].usage}`));
  }
  return { project, command, positional, values, json, rest, refused };
}

/** The project folder (spec/project.md §commands): the folder --project names, or else the current one; null when it names no folder. */
function projectFolder(project, cwd) {
  const folder = resolve(cwd, project ?? '.');
  try {
    return statSync(folder).isDirectory() ? folder : null;
  } catch {
    return null;
  }
}

/** The clock rule (door.md §clock) asked before a command that records: the reason it holds, or null. */
async function clockRefusal(root, command) {
  const { readProject } = await import('./record/project.mjs');
  const { aheadOfClock } = await import('./record/json.mjs');
  const ahead = aheadOfClock((await readProject(root)).clock.latest);
  if (!ahead) return null;
  return reason(`it holds the time ${ahead.at}, more than a minute ahead of this machine's clock (${new Date().toISOString()}), so forma ${command} writes nothing until the clock passes it`, 'door.md §clock', ahead.file);
}

/** The clock rule (door.md §clock) for a command that only reads: it still reads, and says which time is ahead. The line to say, or null. */
async function clockNote(root, command) {
  let ahead = null;
  try {
    const { readProject } = await import('./record/project.mjs');
    const { aheadOfClock } = await import('./record/json.mjs');
    ahead = aheadOfClock((await readProject(root)).clock.latest);
  } catch {
    return null;
  }
  if (!ahead) return null;
  return `${ahead.file} holds the time ${ahead.at}, more than a minute ahead of this machine's clock (${new Date().toISOString()}), so forma ${command} reads and no command writes until the clock passes it (door.md §clock)\n`;
}

/** A read command's result with the clock rule's line, when it holds, after what it printed to standard error. */
async function reading(root, command, run) {
  const note = await clockNote(root, command);
  const result = await run();
  return note ? { ...result, stderr: `${result.stderr ?? ''}${note}` } : result;
}

/** One line read from standard input for forma decide at a terminal (decisions.md §forma-decide), null once input ends. */
function lineReader(input, output) {
  const lines = [];
  const waiting = [];
  let ended = false;
  let buffer = '';
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    input.setEncoding('utf8');
    input.on('data', (chunk) => {
      buffer += chunk;
      let at;
      while ((at = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, at).replace(/\r$/, '');
        buffer = buffer.slice(at + 1);
        if (waiting.length) waiting.shift()(line);
        else lines.push(line);
      }
    });
    input.on('end', () => {
      ended = true;
      if (buffer) {
        if (waiting.length) waiting.shift()(buffer);
        else lines.push(buffer);
        buffer = '';
      }
      while (waiting.length) waiting.shift()(null);
    });
  };
  const readLine = (prompt = '') => {
    if (prompt) output.write(prompt);
    start();
    if (lines.length) return Promise.resolve(lines.shift());
    if (ended) return Promise.resolve(null);
    input.resume();
    return new Promise((done) => waiting.push((line) => {
      if (!waiting.length) input.pause();
      done(line);
    }));
  };
  return { readLine, close: () => input.pause() };
}

/**
 * Runs one command line (spec/project.md §commands) and gives `{ status, stdout, stderr }`; nothing is printed and the
 * process does not exit here. `io` gives the current folder and, for forma decide, the terminal.
 */
export async function main(argv, io = {}) {
  const cwd = io.cwd ?? process.cwd();
  const line = parseLine(argv);
  if (line.refused.length) return refusal(line.refused, line.json);
  const root = projectFolder(line.project, cwd);
  if (!root) return refusal([reason(`--project names ${resolve(cwd, line.project ?? '.')}, which is no folder: name the project folder, or run forma inside it`)], line.json);
  const [first, second] = line.positional;
  switch (line.command) {
    case 'give': {
      const { giveCommand } = await import('./door/give.mjs');
      return giveCommand(root, { item: first, folder: second, json: line.json, cwd });
    }
    case 'answer': {
      const { answerCommand } = await import('./door/answer.mjs');
      return answerCommand(root, { item: first, folder: second, provider: line.values.get('--provider'), model: line.values.get('--model'), session: line.values.get('--session'), json: line.json, cwd });
    }
    case 'run': {
      const { runOwed } = await import('./evidence/run.mjs');
      const output = io.stdout ?? process.stdout;
      // `write` prints at once, so each line of forma run stands as soon as what it says has happened (evidence.md §forma-run);
      // runOwed gives in `output` only what it has not written, the --json value among it, printed once it ends.
      const result = await runOwed(root, { json: line.json, write: (text) => output.write(text) });
      return { status: result.exit, stdout: result.output, stderr: '' };
    }
    case 'show': {
      const { showCommand } = await import('./decisions/index.mjs');
      return reading(root, 'show', () => showCommand(root, line.rest));
    }
    case 'decide': {
      const ahead = await clockRefusal(root, 'decide');
      if (ahead) return refusal([ahead], line.json);
      const { decideCommand } = await import('./decisions/index.mjs');
      const input = io.stdin ?? process.stdin;
      const output = io.stdout ?? process.stdout;
      const reader = lineReader(input, output);
      try {
        // `write` prints at once, so what a terminal decision shows can stand before its prompts (decisions.md §forma-decide).
        return await decideCommand(root, line.rest, { stdinIsTTY: Boolean(input.isTTY), stdoutIsTTY: Boolean(output.isTTY), readLine: reader.readLine, write: (text) => output.write(text) });
      } finally {
        reader.close();
      }
    }
    case 'missing': {
      const { missingCommand } = await import('./account/index.mjs');
      return reading(root, 'missing', () => missingCommand(root, { json: line.json }));
    }
    case 'account': {
      const { accountCommand } = await import('./account/index.mjs');
      return reading(root, 'account', () => accountCommand(root, first ?? null, { json: line.json }));
    }
    case 'box': {
      const { boxCommand } = await import('./account/index.mjs');
      return reading(root, 'box', () => boxCommand(root, { json: line.json }));
    }
    case 'diff': {
      const { diffCommand } = await import('./account/index.mjs');
      return reading(root, 'diff', () => diffCommand(root, first ?? null, { json: line.json }));
    }
    case 'explore': {
      const { exploreCommand } = await import('./explore/graph.mjs');
      return reading(root, 'explore', () => exploreCommand(root, { json: line.json }));
    }
    default:
      return refusal([reason(`${line.command} is no command Forma knows`)], line.json);
  }
}

/** Whether this file is the program being run, as `node src/cli.mjs` or through the `forma` link package.json names. */
function isEntry() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntry()) {
  let result;
  try {
    result = await main(process.argv.slice(2));
  } catch (error) {
    result = { status: 1, stdout: '', stderr: `forma stopped on an internal error, a fault of Forma's and not of the project or the answer: ${error?.stack ?? error}\n` };
  }
  process.exitCode = result?.status === 0 ? 0 : 1;
  // A reader that closes the pipe early, as `forma account | head` does, ends the command with its status and no more said.
  for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', (error) => {
      if (error.code === 'EPIPE') process.exit();
      throw error;
    });
  }
  if (result?.stdout) process.stdout.write(result.stdout);
  if (result?.stderr) process.stderr.write(result.stderr);
}
