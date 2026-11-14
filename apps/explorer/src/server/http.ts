// The loopback door (project.md §explore, "Serving"): the built page, and three GET reads that need
// the launch token. Only the serving origin and host, only GET, and no cross-site request.
import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestListener, ServerResponse } from 'node:http';
import { Standing, type Status } from '../domain/reading.ts';
import type { Page } from './page.ts';
import { messageOf } from './message.ts';

/** A read of the reading held: none yet, the first computation's failure, a generation no longer kept, nothing by that name, or the stored JSON. */
export type Answer =
  | { kind: 'pending' }
  | { kind: 'failed'; error: string }
  | { kind: 'gone' }
  | { kind: 'missing' }
  | { kind: 'found'; generation: string; json: string };

export interface Reads {
  status(): Status;
  sheet(standing: Standing): Answer;
  /** A thing of the generation the page's sheet came from, so what opens never differs from the sheet it opens on. */
  thing(standing: Standing, id: string, generation: string): Answer;
}

/** The header that gives a sheet's or a thing's generation. */
export const GENERATION = 'Forma-Generation';

// React Flow places what it draws with inline styles; no script runs but the served file.
const POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const JSON_TYPE = 'application/json; charset=utf-8';

/** The serving origin of a loopback port, as a browser writes it. */
export const originOf = (port: number) => new URL(`http://127.0.0.1:${port}`).origin;

const digest = (text: string) => createHash('sha256').update(text).digest();
const authorised = (header: string | undefined, token: string) =>
  header?.startsWith('Bearer ') === true && timingSafeEqual(digest(header.slice('Bearer '.length)), digest(token));

function send(res: ServerResponse, status: number, type: string, body: string, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
const json = (res: ServerResponse, status: number, value: unknown) => send(res, status, JSON_TYPE, JSON.stringify(value));

function answer(res: ServerResponse, found: Answer) {
  if (found.kind === 'pending') return json(res, 202, { pending: true });
  if (found.kind === 'failed') return json(res, 503, { error: found.error });
  if (found.kind === 'gone') return json(res, 409, { error: 'That reading is no longer kept; load the new reading.' });
  if (found.kind === 'missing') return json(res, 404, { error: 'This reading holds nothing by that id.' });
  return send(res, 200, JSON_TYPE, found.json, { [GENERATION]: found.generation });
}

function read(res: ServerResponse, url: URL, reads: Reads) {
  const name = url.pathname.slice('/api/'.length);
  if (name === 'status') return json(res, 200, reads.status());
  if (name !== 'sheet' && name !== 'thing') return json(res, 404, { error: 'No such read: the reads are status, sheet and thing.' });
  const standing = Standing.safeParse(url.searchParams.get('standing'));
  if (!standing.success) return json(res, 400, { error: 'A read names its standing: standing=recorded or standing=here.' });
  if (name === 'sheet') return answer(res, reads.sheet(standing.data));
  const id = url.searchParams.get('id');
  if (!id) return json(res, 400, { error: 'A thing read names its thing: id=<id>.' });
  const generation = url.searchParams.get('generation');
  if (!generation) return json(res, 400, { error: "A thing read names the generation of the page's sheet: generation=<generation>." });
  return answer(res, reads.thing(standing.data, id, generation));
}

/** The request handler: `token` is the launch token, `page` the built page, `reads` the reading held. */
export function door(token: string, page: Page, reads: Reads): RequestListener {
  const files = new Map([
    ['/', { type: 'text/html; charset=utf-8', body: page.html }],
    ['/index.html', { type: 'text/html; charset=utf-8', body: page.html }],
    ['/explorer.js', { type: 'text/javascript; charset=utf-8', body: page.script }],
    ['/explorer.css', { type: 'text/css; charset=utf-8', body: page.style }],
  ]);
  return (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', POLICY);
    try {
      const origin = originOf(req.socket.localPort ?? 0);
      if (req.headers.host !== new URL(origin).host || (req.headers.origin !== undefined && req.headers.origin !== origin))
        return json(res, 403, { error: 'Only the serving loopback origin is allowed.' });
      if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: 'Cross-site requests are refused.' });
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { error: 'The explorer answers GET reads only.' });
      }
      const url = new URL(req.url ?? '/', origin);
      if (url.pathname.startsWith('/api/')) {
        if (!authorised(req.headers.authorization, token))
          return json(res, 401, { error: 'Open the launch URL forma-explorer serve printed: it carries the token these reads need.' });
        return read(res, url, reads);
      }
      const file = files.get(url.pathname);
      if (!file) return json(res, 404, { error: 'No such file of the explorer.' });
      return send(res, 200, file.type, file.body, { 'Cache-Control': 'no-cache' });
    } catch (error) {
      return json(res, 500, { error: messageOf(error) });
    }
  };
}
