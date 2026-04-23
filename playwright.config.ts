import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  retries: 0,
  workers: 1, // Electron tests must run sequentially

  use: {
    // Video recording for every test
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    // Screenshot on failure
    screenshot: 'on',
    // Trace for debugging (open with: npx playwright show-trace)
    trace: 'on',
  },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e/report' }],
  ],

  outputDir: 'e2e/results',
});
