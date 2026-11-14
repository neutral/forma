// The served page's reads (presentation.md §explorer, Standing; project.md §explore): the launch token,
// a reading still being computed, a thing read from the sheet's own generation, and a later reading
// offered, never swapped in. The explorer's reads are answered here from the export-ticket example's snapshot.
import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import type { Sheet } from '../../src/domain/reading.ts';
import { ORIGIN, exportTicket } from './snapshot-page.ts';

const TOKEN = 'launch-token';
const dist = new URL('../../dist/client/', import.meta.url);
const { readings, computedAt } = exportTicket();
const first = readings.recorded.sheet;
const later: Sheet = { ...first, generation: `${first.generation}-later` };

interface Explorer {
  /** The generation `/api/status` reports. */
  latest: string;
  /** How many sheet reads are answered `202` before the sheet. */
  pending: number;
  /** Whether a thing read is answered `409`: its generation is no longer kept. */
  gone: boolean;
  unauthorized: string[];
  thingReads: URL[];
}

async function serve(page: Page, explorer: Explorer): Promise<void> {
  const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) {
      const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      return route.fulfill({ body: readFileSync(new URL(name, dist)), contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html' });
    }
    if (route.request().headers().authorization !== `Bearer ${TOKEN}`) {
      explorer.unauthorized.push(url.pathname);
      return json(route, 401, { error: 'Open the launch URL again.' });
    }
    if (url.pathname === '/api/status') return json(route, 200, { generation: explorer.latest, computedAt, refreshing: false, error: null });
    if (url.pathname === '/api/sheet') {
      if (explorer.pending > 0) {
        explorer.pending -= 1;
        return json(route, 202, { pending: true });
      }
      return json(route, 200, explorer.latest === later.generation ? later : first);
    }
    explorer.thingReads.push(url);
    if (explorer.gone) return json(route, 409, { error: 'That reading is no longer kept; load the new reading.' });
    return json(route, 200, readings.recorded.things[url.searchParams.get('id') ?? '']);
  });
}

const explorer = (): Explorer => ({ latest: first.generation, pending: 2, gone: false, unauthorized: [], thingReads: [] });
const purpose = (page: Page) => page.locator('main section').filter({ has: page.getByRole('heading', { name: 'Purpose', exact: true }) });

test('the launch token is taken from the address once, and every read carries it', async ({ page }) => {
  const reads = explorer();
  await serve(page, reads);
  await page.goto(`${ORIGIN}/#token=${TOKEN}`);
  await expect(page.getByRole('heading', { level: 1, name: 'export-ticket', exact: true })).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#/');
  await purpose(page).locator('aside').getByRole('button', { name: 'No new receipt after expiry' }).click();
  await expect(purpose(page).locator('article h4')).toHaveText('No new receipt after expiry');
  expect(reads.thingReads[0]?.searchParams.get('generation')).toBe(first.generation);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'export-ticket', exact: true })).toBeVisible();
  expect(reads.unauthorized).toEqual([]);
});

test('without the launch token the page says where to find it', async ({ page }) => {
  await serve(page, explorer());
  await page.goto(`${ORIGIN}/`);
  await expect(page.getByText('Open the launch URL that forma-explorer serve printed.')).toBeVisible();
});

test('a later reading is offered in the computed cell, and read only when the reader asks', async ({ page }) => {
  const reads = explorer();
  await serve(page, reads);
  await page.goto(`${ORIGIN}/#token=${TOKEN}`);
  await expect(page.locator(`main[data-generation="${first.generation}"]`)).toBeVisible();
  await purpose(page).locator('aside').getByRole('button', { name: 'No new receipt after expiry' }).click();
  reads.latest = later.generation;
  const offer = page.getByRole('button', { name: 'new reading ↻' });
  await expect(offer).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`main[data-generation="${first.generation}"]`)).toBeVisible();
  await expect(purpose(page).locator('article')).toHaveCount(1);
  await offer.click();
  await expect(page.locator(`main[data-generation="${later.generation}"]`)).toBeVisible();
  await expect(offer).toHaveCount(0);
});

test('a thing whose generation is no longer kept offers the later reading and keeps the page', async ({ page }) => {
  const reads = explorer();
  await serve(page, reads);
  await page.goto(`${ORIGIN}/#token=${TOKEN}`);
  await expect(page.getByRole('heading', { level: 1, name: 'export-ticket', exact: true })).toBeVisible();
  reads.gone = true;
  await purpose(page).locator('aside').getByRole('button', { name: 'No new receipt after expiry' }).click();
  await expect(page.getByRole('button', { name: 'new reading ↻' })).toBeVisible();
  await expect(purpose(page).locator('article')).toContainText('That reading is no longer kept');
  await expect(page.locator(`main[data-generation="${first.generation}"]`)).toBeVisible();
});
