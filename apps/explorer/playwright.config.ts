// The client in a browser, against a built snapshot page (tests/browser/snapshot-page.ts) of the export-ticket
// example as it is, made once by tests/browser/setup.ts. Build first: `pnpm --filter @forma/explorer build`.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalSetup: './tests/browser/setup.ts',
  testDir: 'tests/browser',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results',
  reporter: 'list',
  fullyParallel: true,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
});
