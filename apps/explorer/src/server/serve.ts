// `forma-explorer serve` (project.md §explore, "Serving"): listens on 127.0.0.1, gives its launch URL
// with a fresh token in the fragment as soon as it listens, and serves the reading it holds.
import { randomBytes } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { homedir } from 'node:os';
import { cacheBase } from './cache.ts';
import { compute as inWorker, type Compute } from './compute.ts';
import { hold } from './holding.ts';
import { door, originOf } from './http.ts';
import { BUILT, readPage } from './page.ts';

const EVERY_MS = 3000;

export interface ServeOptions {
  project: string;
  /** 0 lets the operating system choose. */
  port?: number;
  onListen?: (url: string) => void;
  /** The built page's folder. */
  page?: string;
  /** The operating system's cache folder, under which the read index is kept. */
  cacheRoot?: string;
  compute?: Compute;
  /** How often the fingerprint is checked. */
  everyMs?: number;
}

interface Serving {
  url: string;
  origin: string;
  token: string;
  /** Settles once the first computation has. */
  ready: Promise<void>;
  /** Closes the server, its connections, its worker and its read index. */
  close(): Promise<void>;
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) =>
      reject(error.code === 'EADDRINUSE' ? new Error(`Port ${port} is already in use; choose another port or omit --port.`) : error),
    );
    server.listen(port, '127.0.0.1', resolve);
  });
}

export async function serve({
  project,
  port = 0,
  onListen = () => {},
  page = BUILT,
  cacheRoot = cacheBase(process.platform, process.env, homedir()),
  compute = inWorker,
  everyMs = EVERY_MS,
}: ServeOptions): Promise<Serving> {
  const root = await realpath(project);
  const built = await readPage(page);
  const token = randomBytes(32).toString('base64url');
  const holding = hold(root, cacheRoot, compute, everyMs);
  const server = createServer(door(token, built, holding.reads));
  await listen(server, port);
  const origin = originOf((server.address() as AddressInfo).port);
  const url = `${origin}/#token=${token}`;
  onListen(url);
  holding.start();
  let closing: Promise<void> | undefined;
  return {
    url,
    origin,
    token,
    ready: holding.ready,
    close: () =>
      (closing ??= (async () => {
        const closed = new Promise((resolve) => server.close(resolve));
        server.closeAllConnections();
        await closed;
        await holding.close();
      })()),
  };
}
