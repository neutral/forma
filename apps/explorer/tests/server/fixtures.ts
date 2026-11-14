// What the server's tests share: small project folders, a stub of the built page, readings that meet
// the contract, a computation the test steers, and a client for the loopback door.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestContext } from 'node:test';
import { Reading, type Snapshot, type Standing } from '../../src/domain/reading.ts';
import type { Compute } from '../../src/server/compute.ts';

export const app = fileURLToPath(new URL('../../', import.meta.url));

export const MARKER = 'private-project-marker-for-server-tests';

/** A new folder, canonical, removed after the test. */
export async function scratch(t: TestContext): Promise<string> {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'forma-explorer-test-')));
  t.after(() => rm(folder, { recursive: true, force: true }));
  return folder;
}

/** Writes `files`, paths relative to `folder`. */
export async function writeFiles(folder: string, files: Record<string, string>): Promise<string> {
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(folder, path)), { recursive: true });
    await writeFile(join(folder, path), text);
  }
  return folder;
}

/** Every file under `folder` with its text, to compare a folder before and after. */
export async function contents(folder: string): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  const walk = async (at: string) => {
    for (const entry of await readdir(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) await walk(path);
      else found[relative(folder, path)] = await readFile(path, 'utf8');
    }
  };
  if (existsSync(folder)) await walk(folder);
  return found;
}

/** A small Forma project: one brief document. */
export const project = (folder: string, text = '') =>
  writeFiles(folder, {
    'design/brief/ticket.md': `# Ticket\n\n${MARKER}. ${text}\n\n## Clause 0\n\nReceipt clause 0 remains in the record.\n`,
  });

/** A tracked time far ahead of this machine's clock (door.md §clock). */
export const clockAheadRecord = () => {
  const session = { provider: 'fixture', model: 'writer', session: 'old-answer' };
  return {
    'design/receipt': `${JSON.stringify({ file: 'README.md', sha256: '0'.repeat(64), at: '2099-01-01T00:00:00.000Z', session, authors: [session] })}\n`,
  };
};

export const STUB_SCRIPT = 'globalThis.said = ["</script><script>bad()</script>", "<!-- a comment opener", "end"];\n';
export const STUB_STYLE = 'body { color: #123456; }\n';

/** A stub of dist/client, the way Vite writes it. */
export async function builtPage(folder: string): Promise<string> {
  return writeFiles(folder, {
    'index.html':
      '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <title>Forma · reading</title>\n' +
      '    <script type="module" crossorigin src="./explorer.js"></script>\n    <link rel="stylesheet" crossorigin href="./explorer.css">\n' +
      '  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n',
    'explorer.js': STUB_SCRIPT,
    'explorer.css': STUB_STYLE,
  });
}

export const thingId = (marker: string) => `boundary:${marker}/clock`;

/** A reading that meets the contract, `marker` in its passage and its one thing. */
export function readingFor(generation: string, standing: Standing, marker: string): Reading {
  return Reading.parse({
    sheet: {
      standing,
      generation,
      general: [[{ text: `general ${marker}`, tone: 'plain' }]],
      title: { project: 'ticket', computedAt: '2026-11-12T00:00:00.000Z', differs: null, build: 'forma 0.1.0', sheets: '1 of 1', revisions: [] },
      documents: [
        {
          number: 1,
          name: 'Ticket',
          path: 'design/brief/ticket.md',
          sections: [{ id: 'ticket', address: 'design/brief/ticket.md', heading: 'Ticket', html: `<p>${marker}</p>`, notes: [] }],
        },
      ],
      lists: { claims: [], assumptions: { rows: [], bounds: [] }, examination: { models: [], corrections: [], decisions: [] }, limits: [] },
    },
    things: {
      [thingId(marker)]: {
        id: thingId(marker),
        kind: 'actor',
        title: `Clock ${marker}`,
        kindLabel: 'actor or record',
        from: null,
        names: `${marker} as ${standing}`,
        rowKind: 'clock',
        side: 'world',
        seam: null,
        isolation: null,
        beyond: false,
        models: [],
        decisions: { now: [], earlier: [] },
      },
    },
  });
}

export function snapshotFor(generation: string, marker: string, computedAt = new Date().toISOString()): Snapshot {
  return {
    generation,
    computedAt,
    readings: { recorded: readingFor(generation, 'recorded', marker), here: readingFor(generation, 'here', marker) },
    inputs: [{ path: 'design/brief/ticket.md', sha256: 'a'.repeat(64) }],
    versions: { forma: { version: '0.1.0' }, graph: 1 },
  };
}

/** A promise the test opens. */
export function gate() {
  let open: () => void = () => {};
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

/**
 * A computation the test steers: the project's generation and marker, a failure, and a gate the
 * computing waits on. It counts fingerprints and computed readings.
 */
export function steered(generation = 'generation-1', marker = MARKER) {
  const state: { generation: string; marker: string; failure: string | null; waiting: Promise<void> | null } = {
    generation,
    marker,
    failure: null,
    waiting: null,
  };
  const runs = { fingerprinted: 0, computed: 0 };
  const compute: Compute = async (_project, kept, { signal, onComputing }) => {
    runs.fingerprinted += 1;
    if (state.failure) throw new Error(state.failure);
    if (kept.includes(state.generation)) return { kind: 'kept', generation: state.generation };
    const { generation: next, marker: text, waiting } = state;
    onComputing?.();
    if (waiting)
      await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason);
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        waiting.then(resolve);
      });
    runs.computed += 1;
    return { kind: 'computed', snapshot: snapshotFor(next, text) };
  };
  return { compute, state, runs };
}

export interface Reply {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  text: string;
  json: unknown;
}

/** A request to the door, with the launch token unless `auth` is false. */
export function get(
  at: { origin: string; token: string },
  path: string,
  { method = 'GET', auth = true, headers = {} }: { method?: string; auth?: boolean; headers?: Record<string, string> } = {},
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const sent = request(
      new URL(path, at.origin),
      { method, headers: { ...(auth ? { Authorization: `Bearer ${at.token}` } : {}), ...headers } },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (text += chunk));
        res.on('end', () => {
          let json: unknown = null;
          try {
            json = JSON.parse(text);
          } catch {}
          resolve({ status: res.statusCode ?? 0, headers: res.headers, text, json });
        });
      },
    );
    sent.once('error', reject);
    sent.end();
  });
}

/** Waits until `check` gives a truthy value. */
export async function until<T>(check: () => Promise<T> | T, message: string, milliseconds = 15000): Promise<T> {
  const end = Date.now() + milliseconds;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) assert.fail(message);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
