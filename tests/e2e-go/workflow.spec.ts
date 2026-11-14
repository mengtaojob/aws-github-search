import { expect, test } from '@playwright/test';
import pg from 'pg';

test('real browser → Node gateway → Go → PostgreSQL', async ({ page, request }, testInfo) => {
  // These fixed loopback endpoints cannot target the production website or RDS.
  const api = 'http://127.0.0.1:3001';
  const health = await request.get(`${api}/health`);
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ backend: 'go', storage: 'postgres', authRequired: false });
  const sql = new pg.Client({ connectionString: 'postgresql://github_app:local_dev_password@127.0.0.1:5432/github_search', ssl: false });
  await sql.connect();
  const digest = async () => (await sql.query("SELECT count(*)::int AS count, md5(COALESCE(string_agg(row_to_json(t)::text, '' ORDER BY github_id), '')) AS digest FROM github_users t")).rows[0];
  const before = await digest();
  const existing = await sql.query('SELECT 1 FROM github_users WHERE github_id=$1', [583231]);
  expect(existing.rowCount, 'octocat must be absent so existing data is never edited').toBe(0);
  let created = false;
  const note = '网页联调验收：前端经 Node.js 调用 Go 写入数据库';
  const responseFor = (path: string, method: string) => page.waitForResponse(r => new URL(r.url()).origin === api && new URL(r.url()).pathname === path && r.request().method() === method);
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('发现优秀的开发者');
    await page.getByRole('textbox', { name: 'GitHub 搜索关键词' }).fill('octocat in:login');
    const searched = responseFor('/search/users', 'GET');
    await page.getByRole('button', { name: '搜索开发者', exact: true }).click();
    const searchResponse = await searched;
    expect(searchResponse.status()).toBe(200);
    expect(searchResponse.headers()['x-octoshelf-backend']).toBe('go');
    const card = page.getByRole('article').filter({ has: page.getByRole('link', { name: '@octocat', exact: true }) });
    await expect(card).toBeVisible();
    const detailed = responseFor('/github/users/octocat', 'GET');
    await card.getByRole('button', { name: 'octocat', exact: true }).click();
    expect((await detailed).status()).toBe(200);
    const dialog = page.getByRole('dialog', { name: '开发者档案' });
    await expect(dialog.getByRole('link', { name: '@octocat' })).toBeVisible();
    const added = responseFor('/users', 'POST');
    await dialog.getByRole('button', { name: '加入我的收藏', exact: true }).click();
    const addedResponse = await added;
    expect(addedResponse.status()).toBe(201);
    created = true;
    const saved = await addedResponse.json();
    expect(saved.id).toBe(583231);
    await dialog.getByLabel(/我的备注/).fill(note);
    await dialog.getByLabel('分类标签').fill('Go, 网页验收, Go');
    const patched = responseFor('/users/583231', 'PATCH');
    await dialog.getByRole('button', { name: '保存备注', exact: true }).click();
    expect((await patched).status()).toBe(200);
    await expect(dialog).not.toBeVisible();
    const persisted = (await sql.query('SELECT note,tags FROM github_users WHERE github_id=$1', [583231])).rows[0];
    expect(persisted).toEqual({ note, tags: ['Go', '网页验收'] });
    await page.reload();
    await page.getByRole('button', { name: /我的收藏/ }).click();
    await page.getByRole('textbox', { name: '筛选收藏' }).fill('octocat');
    await page.getByRole('button', { name: '编辑备注', exact: true }).click();
    await expect(dialog.getByLabel(/我的备注/)).toHaveValue(note);
    await expect(dialog.getByLabel('分类标签')).toHaveValue('Go, 网页验收');
    await dialog.getByRole('button', { name: '关闭对话框' }).click();
    const screenshotPath = testInfo.outputPath('go-chain-success.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach('verified local UI', { path: screenshotPath, contentType: 'image/png' });
    await page.getByRole('button', { name: '列表视图' }).click();
    await page.getByRole('button', { name: '移除 octocat' }).click();
    const removed = responseFor('/users/583231', 'DELETE');
    await page.getByRole('dialog').getByRole('button', { name: '确认移除' }).click();
    expect((await removed).status()).toBe(204);
    created = false;
    await expect(page.getByRole('heading', { name: '没有匹配的收藏' })).toBeVisible();
    expect(await digest()).toEqual(before);
    await testInfo.attach('acceptance summary', { body: JSON.stringify({ backend: 'go', realGitHub: true, sqlVerified: true, browserReloadVerified: true, beforeCount: before.count, afterCount: before.count, originalDataUnchanged: true }), contentType: 'application/json' });
  } finally {
    // Only clean up a record successfully created by this run, even if a UI assertion fails.
    if (created) {
      const cleanup = await request.delete(`${api}/users/583231`);
      expect([204, 404]).toContain(cleanup.status());
    }
    await sql.end();
  }
});
