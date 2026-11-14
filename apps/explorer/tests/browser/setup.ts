// Before the browser tests: the export-ticket example's snapshot, made from the example as it is through
// Forma's graph and the export's own code, and written where snapshot-page.ts reads it.
import { mkdir, writeFile } from 'node:fs/promises';
import { cache, exampleSnapshot } from '../examples.ts';
import { SNAPSHOT } from './snapshot-page.ts';

export default async function setup() {
  await mkdir(cache, { recursive: true });
  await writeFile(SNAPSHOT, JSON.stringify(await exampleSnapshot('export-ticket')));
}
