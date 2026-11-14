// The live source: a running `forma-explorer serve`, read with the launch token it printed.
import type { z } from 'zod';
import { Sheet, Status, Thing } from '../../domain/reading.ts';
import { NotKept, SourceError, type ReadingSource } from './source.ts';

const KEY = 'forma-explorer-token';
const PENDING_PAUSE_MS = 500;

/**
 * The launch token: taken once from `#token=…`, then kept in memory and in this tab's session, so that the
 * hash is the router's and a reload still reads. Storage may be refused; the token then lives in memory only.
 */
export function takeLaunchToken(): string | null {
  const given = /(?:^#|&)token=([^&]+)/.exec(window.location.hash)?.[1] ?? null;
  if (!given) {
    try {
      return window.sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  }
  try {
    window.sessionStorage.setItem(KEY, given);
  } catch {
    // kept in memory only
  }
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
  return given;
}

export function httpSource(token: string | null): ReadingSource {
  async function read<T>(schema: z.ZodType<T>, path: string): Promise<T> {
    if (!token) throw new SourceError('Open the launch URL that forma-explorer serve printed.');
    for (;;) {
      let response: Response;
      try {
        response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
      } catch {
        throw new SourceError('The explorer has stopped.');
      }
      // 202: the reading is still being computed.
      if (response.status === 202) {
        await new Promise((resolve) => setTimeout(resolve, PENDING_PAUSE_MS));
        continue;
      }
      const body: unknown = await response.json().catch(() => null);
      // 409: the generation asked for is no longer kept; a later reading is.
      if (response.status === 409) throw new NotKept(errorIn(body) ?? 'That reading is no longer kept.');
      if (!response.ok) throw new SourceError(errorIn(body) ?? 'The reading could not be computed.');
      const checked = schema.safeParse(body);
      if (!checked.success) throw new SourceError('The explorer sent a reading this page cannot read.');
      return checked.data;
    }
  }
  return {
    status: () => read(Status, '/api/status'),
    sheet: (standing) => read(Sheet, `/api/sheet?standing=${standing}`),
    thing: (standing, generation, id) =>
      read(Thing, `/api/thing?standing=${standing}&generation=${encodeURIComponent(generation)}&id=${encodeURIComponent(id)}`),
  };
}

const errorIn = (body: unknown): string | null =>
  typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : null;
