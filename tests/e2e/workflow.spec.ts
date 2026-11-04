import { expect, test } from '@playwright/test';
import { torvalds } from '../fixtures';

// UI tests isolate GitHub and persistence at the browser network boundary.
// Real shared API/storage behavior is tested in app.test.ts and postgres.test.ts.
test('search, save, edit, filter and remove a developer', async ({ page }) => {
  let saved: Record<string, unknown>[] = [];
  await page.route('http://127.0.0.1:3001/**', async (route) => {
    const request = route.request(), url = new URL(request.url());
    const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:3000', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let status = 200, json: unknown;
    if (url.pathname === '/health') json = { status: 'ok', storage: 'file', authRequired: false };
    else if (url.pathname === '/search/users') json = { total_count: 1, incomplete_results: false, items: [torvalds] };
    else if (url.pathname === '/users' && request.method() === 'POST') {
      saved = [{ ...torvalds, note: '', tags: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
      status = 201; json = saved[0];
    } else if (request.method() === 'PATCH') { saved[0] = { ...saved[0], ...request.postDataJSON() }; json = saved[0]; }
    else if (request.method() === 'DELETE') { saved = []; return route.fulfill({ status: 204, headers: cors }); }
    else if (url.pathname === '/users') json = { items: saved };
    else json = torvalds;
    await route.fulfill({ status, json, headers: cors });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('发现优秀的开发者');
  await page.getByRole('textbox', { name: 'GitHub 搜索关键词' }).fill('torvalds');
  await page.getByRole('button', { name: '搜索开发者', exact: true }).click();
  await expect(page.getByRole('link', { name: '@torvalds', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '加入收藏', exact: true }).click();
  await expect(page.getByRole('button', { name: '已收藏', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /我的收藏/ }).click();
  await page.getByRole('button', { name: '编辑备注', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '开发者档案' });
  await dialog.getByLabel(/我的备注/).fill('Linux 内核开发者');
  await dialog.getByLabel('分类标签').fill('Linux, 系统编程');
  await dialog.getByRole('button', { name: '保存备注' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('系统编程', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '筛选收藏' }).fill('不存在的人');
  await expect(page.getByRole('heading', { name: '没有匹配的收藏' })).toBeVisible();
  await page.getByRole('textbox', { name: '筛选收藏' }).fill('Linux');
  await page.getByRole('button', { name: '列表视图' }).click();
  await page.getByRole('button', { name: '移除 torvalds' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认移除' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('textbox', { name: '筛选收藏' }).clear();
  await expect(page.getByRole('heading', { name: '值得关注的人，都可以留在这里' })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport);
});

test('displays API failures without leaving a loading state', async ({ page }) => {
  await page.route('http://127.0.0.1:3001/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ status: url.pathname === '/search/users' ? 429 : 200, json: url.pathname === '/search/users' ? { message: 'GitHub 请求过于频繁，请稍后重试' } : url.pathname === '/health' ? { status: 'ok', storage: 'file' } : { items: [] }, headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:3000' } });
  });
  await page.goto('/');
  await page.getByRole('textbox', { name: 'GitHub 搜索关键词' }).fill('torvalds');
  await page.getByRole('button', { name: '搜索开发者', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'GitHub 请求过于频繁' })).toBeVisible();
  await expect(page.getByRole('button', { name: '搜索开发者', exact: true })).toBeEnabled();
});
