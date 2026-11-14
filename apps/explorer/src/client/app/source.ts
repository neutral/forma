// Which source the page reads: the snapshot an export carries, else the running explorer.
import { httpSource, takeLaunchToken } from '../data/http.ts';
import { embeddedSnapshot, SNAPSHOT_ID, snapshotSource } from '../data/snapshot.ts';
import type { ReadingSource } from '../data/source.ts';

export function chooseSource(): ReadingSource {
  const embedded = document.getElementById(SNAPSHOT_ID);
  if (embedded) return snapshotSource(embeddedSnapshot(embedded.textContent ?? ''));
  return httpSource(takeLaunchToken());
}
