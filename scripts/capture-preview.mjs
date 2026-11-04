import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('docs/screenshots', { recursive: true });
const browser = await chromium.launch();
try {
  for (const mode of ['desktop', 'mobile']) {
    const context = await browser.newContext(mode === 'mobile' ? { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } : { viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
    await page.getByRole('textbox', { name: 'GitHub 搜索关键词' }).fill('torvalds');
    await page.getByRole('button', { name: '搜索开发者', exact: true }).click();
    await page.getByRole('link', { name: '@torvalds', exact: true }).waitFor({ timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('img.avatar').evaluateAll(async (images) => {
      await Promise.all(images.map(async (img) => {
        img.loading = 'eager';
        try { await img.decode(); } catch { /* Fallback is rendered by the UI if the network is unavailable. */ }
      }));
    });
    await page.screenshot({ path: `docs/screenshots/${mode}-search.png`, fullPage: true });
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`${mode}: real GitHub search screenshot captured; no browser runtime errors`);
    await context.close();
  }
} finally { await browser.close(); }
