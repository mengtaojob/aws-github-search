import { defineConfig, devices } from '@playwright/test';

// Opt-in live test: start the three local services as described in docs/local-go-chain.md.
// Deliberately separate from the mocked UI suite and ordinary CI.
export default defineConfig({
  testDir: './tests/e2e-go',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'test-results/go-chain',
  use: { baseURL: 'http://127.0.0.1:3000', ...devices['Desktop Chrome'], screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
