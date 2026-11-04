import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: [
    { command: 'npm run dev:api', url: 'http://127.0.0.1:3001/health', reuseExistingServer: !process.env.CI, env: { DATA_FILE: '.data/e2e-users.json', API_ACCESS_TOKEN: '', API_SECRET_ARN: '', STORE_DRIVER: 'file' } },
    { command: 'npm run dev:web', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
});
