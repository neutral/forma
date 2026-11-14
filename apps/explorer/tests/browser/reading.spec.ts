// The reading in a browser (presentation.md §explorer), drawn by the built client from the export-ticket
// example's snapshot, under the export's Content-Security-Policy.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { exportTicket, openSnapshot } from './snapshot-page.ts';

const snapshot = exportTicket();
const passage = (page: Page, heading: string) => page.locator('main section').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
const scenarioName = 'A remembered check must not create a receipt after expiry';

/** Opens the scenario from the restatement of `Claim design`, and gives it. */
async function openScenario(page: Page): Promise<Locator> {
  const section = passage(page, 'Claim design');
  await section.getByRole('button', { name: /^5 actions/ }).click();
  const restated = section.locator('article').first();
  await restated.getByRole('button', { name: scenarioName, exact: true }).click();
  const scenario = restated.locator('article').filter({ has: page.getByRole('heading', { name: scenarioName }) });
  await expect(scenario.getByRole('img', { name: 'Ticket expiry and claim state' })).toBeVisible();
  return scenario;
}

test('presentation.md §explorer: the reading draws without an error, the documents in reading order and the lists after', async ({ page }) => {
  const errors = await openSnapshot(page, snapshot);
  await expect(page.getByRole('heading', { level: 1, name: 'export-ticket' })).toBeVisible();
  const headings = await page.locator('main section > h2').allTextContents();
  expect(headings).toEqual(['Claims', 'Assumptions', 'Examination', 'Limits']);
  for (const sentence of snapshot.readings.recorded.sheet.lists.limits) await expect(page.getByText(sentence, { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'revision 1' }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('presentation.md §explorer: a claim opens in place under its passage, and no ✓ stands beside a claim not established', async ({ page }) => {
  await openSnapshot(page, snapshot);
  const claims = Object.values(snapshot.readings.recorded.things).filter((thing) => thing.kind === 'claim');
  const purpose = passage(page, 'Purpose');
  for (const claim of claims) {
    const name = purpose.locator('aside').getByRole('button', { name: claim.title });
    await name.click();
    await expect(name).toHaveAttribute('aria-expanded', 'true');
    const opened = purpose.locator('article');
    await expect(opened).toHaveCount(1);
    await expect(opened.getByRole('heading', { name: claim.title })).toBeVisible();
    await expect(opened).toContainText(claim.standingLine);
    await expect(opened).toContainText('not established');
    await expect(opened).not.toContainText('✓');
    expect(await opened.evaluate((element) => getComputedStyle(element).borderLeftStyle)).toBe('dashed');
  }
  // Pressing the name again closes what it opened.
  const last = purpose.locator('aside').getByRole('button', { name: claims.at(-1)?.title });
  await last.click();
  await expect(purpose.locator('article')).toHaveCount(0);
  await expect(last).toHaveAttribute('aria-expanded', 'false');
});

test('presentation.md §explorer: a name inside an opened thing opens under its line; Escape closes the thing opened last', async ({ page }) => {
  await openSnapshot(page, snapshot);
  const purpose = passage(page, 'Purpose');
  await purpose.locator('aside').getByRole('button', { name: 'No new receipt after expiry' }).click();
  const claim = purpose.locator('article').first();
  await claim.getByRole('button', { name: 'export-ticket-tlc', exact: true }).first().click();
  const model = claim.locator('article');
  await expect(model.getByRole('heading', { name: 'export-ticket-tlc' })).toBeVisible();
  await expect(model).toContainText('TLC · every order of events, within bounds');
  await page.keyboard.press('Escape');
  await expect(model).toHaveCount(0);
  await expect(claim).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(purpose.locator('article')).toHaveCount(0);
});

test('presentation.md §explorer: a scenario draws its walk, and its player steps it', async ({ page }) => {
  await openSnapshot(page, snapshot);
  const scenario = await openScenario(page);
  const drawing = scenario.getByRole('img', { name: 'Ticket expiry and claim state' });
  const steps = scenario.getByRole('group', { name: 'steps' });
  await expect(scenario).toContainText('lifecycle, phases only, no standing:');
  await expect(steps).toContainText('step 3 of 3');
  await expect(drawing).toContainText('3. complete ✕ must be refused');

  await steps.getByRole('button', { name: 'back to the start' }).click();
  await expect(steps).toContainText('step 0 of 3');
  await expect(drawing).not.toContainText('1. check');
  await steps.getByRole('button', { name: 'next' }).click();
  await expect(steps).toContainText('step 1 of 3');
  await expect(drawing).toContainText('1. check');
  await expect(drawing).not.toContainText('must be refused');

  await steps.getByRole('button', { name: 'play' }).click();
  await expect(steps.getByRole('button', { name: 'pause' })).toBeVisible();
  await expect(steps).toContainText('step 3 of 3', { timeout: 5000 });
  await expect(steps.getByRole('button', { name: 'play' })).toBeVisible();
  await expect(drawing).toContainText('3. complete ✕ must be refused');
});

test('presentation.md §explorer: the help dialog opens by ? and holds the words; Escape closes only it', async ({ page }) => {
  await openSnapshot(page, snapshot);
  const words = ['Steps that should happen, or must not.', 'A claim not established.', 'What must hold.'];
  for (const phrase of words) await expect(page.getByText(phrase, { exact: true })).toHaveCount(0);
  await passage(page, 'Purpose').locator('aside').getByRole('button', { name: 'No new receipt after expiry' }).click();

  await page.keyboard.press('?');
  const help = page.getByRole('dialog', { name: 'Help' });
  await expect(help).toBeVisible();
  for (const phrase of words) await expect(help.getByText(phrase, { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(help).toHaveCount(0);
  await expect(passage(page, 'Purpose').locator('article')).toHaveCount(1);

  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(help).toBeVisible();
  await help.getByRole('button', { name: 'close' }).click();
  await expect(help).toHaveCount(0);
});

test('presentation.md §explorer: the standing switch draws the reading here, and the address says so', async ({ page }) => {
  await openSnapshot(page, snapshot);
  const standing = page.getByRole('radiogroup', { name: 'standing' });
  await expect(standing.getByRole('radio', { name: 'as recorded' })).toBeChecked();
  await expect(page.locator('header')).toContainText('here differs');
  await passage(page, 'Purpose').locator('aside').getByRole('button', { name: 'No new receipt after expiry' }).click();

  await standing.getByRole('radio', { name: 'here' }).click();
  await expect(standing.getByRole('radio', { name: 'here' })).toBeChecked();
  await expect(page.locator('main[data-standing="here"]')).toBeVisible();
  await expect(page.locator('header')).toContainText(snapshot.readings.here.sheet.general[1]?.[0]?.text ?? '');
  await expect(passage(page, 'Purpose').locator('article')).toHaveCount(0);
  expect(new URL(page.url()).hash).toContain('standing=here');

  await page.reload();
  await expect(page.locator('main[data-standing="here"]')).toBeVisible();
});

test('presentation.md §explorer: every kind of note and of thing draws', async ({ page }) => {
  // Neither example has a `corrected` note: one is added to `Scope`.
  const { recorded } = structuredClone(snapshot.readings);
  const correction = recorded.sheet.lists.examination.corrections[0];
  const scope = recorded.sheet.documents[0]?.sections.find((section) => section.heading === 'Scope');
  if (!correction || !scope) throw new Error('The export-ticket example has changed: it lacks a correction or a Scope passage.');
  scope.notes.unshift({ kind: 'corrected', refs: [correction.ref] });
  const errors = await openSnapshot(page, { ...snapshot, readings: { ...snapshot.readings, recorded } });

  const opens = async (section: string, name: string, shows: string) => {
    const passageOf = passage(page, section);
    await passageOf.locator('aside').getByRole('button', { name, exact: true }).click();
    await expect(passageOf.locator('article').first()).toContainText(shows);
  };
  await opens('Scope', `${correction.ref.label} ${correction.ref.detail}`, 'model at fault');
  await opens('Purpose', 'May the original receipt be fetched after expiry?', 'readings');
  await opens('Claim design', 'Atomic creation and claim marking', 'falsified by');
  await opens('Claim design', 'A remembered check must not create a receipt after expiry', 'repair added');

  const claimDesign = passage(page, 'Claim design');
  await claimDesign.locator('aside').getByRole('button', { name: /^5 actions/ }).click();
  const restated = claimDesign.locator('article').first();
  await expect(restated).toContainText('happens');
  await restated.getByRole('button', { name: 'Ticket expiry and claim state', exact: true }).click();
  await expect(restated.locator('article').first()).toContainText('walked by');
  await restated.getByRole('button', { name: /^The export-ticket service that owns tickets/ }).click();
  await expect(restated.locator('article').filter({ hasText: 'actor or record' })).toHaveCount(1);
  await restated.getByRole('button', { name: /^The service checks an active ticket/ }).click();
  await expect(restated).toContainText('defects planted');
  expect(errors).toEqual([]);
});

test('presentation.md §explorer: a link within the page moves there and leaves the address as it is', async ({ page }) => {
  await openSnapshot(page, snapshot);
  const before = page.url();
  await page.getByRole('navigation', { name: 'contents' }).getByRole('link', { name: 'limits' }).click();
  await expect(page.locator('section#limits')).toBeInViewport();
  expect(page.url()).toBe(before);
});

test('presentation.md §explorer: every name, fold and switch is reached by keyboard', async ({ page }) => {
  await openSnapshot(page, snapshot);
  const purpose = passage(page, 'Purpose');
  const name = purpose.locator('aside').getByRole('button', { name: 'No new receipt after expiry' });
  await name.focus();
  await page.keyboard.press('Enter');
  const claim = purpose.locator('article');
  await expect(claim).toHaveCount(1);
  const fold = claim.getByRole('button', { name: /in the model's language/ });
  await fold.focus();
  await page.keyboard.press('Enter');
  await expect(fold).toHaveAttribute('aria-expanded', 'true');
  await claim.getByRole('button', { name: 'close' }).focus();
  await page.keyboard.press('Enter');
  await expect(claim).toHaveCount(0);
  await expect(name).toBeFocused();
});

test('presentation.md §explorer: axe finds no serious violation, with things opened and with help open', async ({ page }) => {
  await openSnapshot(page, snapshot);
  await passage(page, 'Purpose').locator('aside').getByRole('button', { name: 'No new receipt after expiry' }).click();
  await openScenario(page);
  const serious = async () =>
    (await new AxeBuilder({ page }).analyze()).violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => `${violation.id}: ${violation.nodes.length} × ${violation.nodes[0]?.target.join(' ')}`);
  expect(await serious()).toEqual([]);
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Help' })).toBeVisible();
  expect(await serious()).toEqual([]);
});
