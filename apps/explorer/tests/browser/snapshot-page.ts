// A snapshot page as an export makes one (src/server/export.ts): the built index.html with its script and
// style inlined, the export's Content-Security-Policy, and both standings' readings in
// `<script id="forma-snapshot" type="application/json">`. The tests read it from a test origin.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page as Browser } from '@playwright/test';
import { snapshotDocument } from '../../src/server/document.ts';
import type { Page } from '../../src/server/page.ts';
import { Snapshot } from '../../src/domain/reading.ts';
import { cache } from '../examples.ts';

const dist = new URL('../../dist/client/', import.meta.url);

/** The export-ticket snapshot setup.ts writes before the tests. */
export const SNAPSHOT = join(cache, 'export-ticket.snapshot.json');

export const ORIGIN = 'http://explorer.test';

const page: Page = (() => {
  const read = (name: string) => {
    try {
      return readFileSync(new URL(name, dist), 'utf8');
    } catch {
      throw new Error(`dist/client/${name} is missing: run \`pnpm --filter @forma/explorer build\` first.`);
    }
  };
  return { html: read('index.html'), script: read('explorer.js'), style: read('explorer.css') };
})();

/** The export-ticket example's two readings, as an export makes them from the example as it is. */
export function exportTicket(): Snapshot {
  let text: string;
  try {
    text = readFileSync(SNAPSHOT, 'utf8');
  } catch {
    throw new Error(`${SNAPSHOT} is missing: run the browser tests through playwright.config.ts, whose setup writes it.`);
  }
  return Snapshot.parse(JSON.parse(text));
}

/** The page an export writes for `snapshot`, assembled by the export's own code from the built page. */
export function snapshotPage(snapshot: Snapshot): string {
  return snapshotDocument(page, snapshot);
}

/** Opens the snapshot page at the test origin and waits for its sheet. Gives what the page reported as errors. */
export async function openSnapshot(page: Browser, snapshot: Snapshot = exportTicket()): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const html = snapshotPage(snapshot);
  await page.route(`${ORIGIN}/**`, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(`${ORIGIN}/`);
  await page.locator('main h1').first().waitFor();
  return errors;
}
