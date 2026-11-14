// Where the page's reading comes from: a running explorer (live), or the snapshot an export carries.
// Every reading that arrives is checked against the domain's schemas before anything draws it.
import type { Sheet, Standing, Status, Thing } from '../../domain/reading.ts';

export interface ReadingSource {
  status(): Promise<Status>;
  sheet(standing: Standing): Promise<Sheet>;
  /** A thing of the generation the shown sheet came from, so what opens never differs from the sheet it opens on. */
  thing(standing: Standing, generation: string, id: string): Promise<Thing>;
}

/** A failure the reader is told, in these words. */
export class SourceError extends Error {
  override name = 'SourceError';
}

/** The reading shown is no longer kept: a later one is, and is offered. */
export class NotKept extends SourceError {
  override name = 'NotKept';
}

export const sayFailure = (error: unknown): string =>
  error instanceof SourceError ? error.message : 'The reading could not be shown.';
