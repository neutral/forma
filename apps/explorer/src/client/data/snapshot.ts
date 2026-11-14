// The export's source: both standings, carried in the page as `<script id="forma-snapshot" type="application/json">`.
import { Snapshot } from '../../domain/reading.ts';
import { SourceError, type ReadingSource } from './source.ts';

export const SNAPSHOT_ID = 'forma-snapshot';

export async function embeddedSnapshot(text: string): Promise<Snapshot> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new SourceError('This export holds no reading this page can read.');
  }
  const checked = Snapshot.safeParse(json);
  if (!checked.success) throw new SourceError('This export holds no reading this page can read.');
  return checked.data;
}

export function snapshotSource(snapshot: Promise<Snapshot>): ReadingSource {
  return {
    status: async () => {
      const { generation, computedAt } = await snapshot;
      return { generation, computedAt, refreshing: false, error: null };
    },
    sheet: async (standing) => (await snapshot).readings[standing].sheet,
    // A snapshot holds one generation.
    thing: async (standing, _generation, id) => {
      const thing = (await snapshot).readings[standing].things[id];
      if (!thing) throw new SourceError(`${id} is not in this reading.`);
      return thing;
    },
  };
}
