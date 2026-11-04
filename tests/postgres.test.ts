import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { database, PostgresStore } from '../src/store-postgres';
import { torvalds } from './fixtures';

// Only run against a dedicated ephemeral test database, never production.
beforeAll(async () => {
  if (process.env.ALLOW_TEST_DATABASE !== 'true') throw new Error('Set ALLOW_TEST_DATABASE=true for a dedicated test database');
  await (await database()).query(await readFile(new URL('../database/001_initial.sql', import.meta.url), 'utf8'));
});
afterAll(async () => {
  if (process.env.ALLOW_TEST_DATABASE === 'true') {
    const pool = await database();
    await pool.query('DELETE FROM github_users WHERE github_id = $1', [torvalds.id]);
    await pool.end();
  }
});
it('persists a PostgreSQL CRUD lifecycle with duplicate protection', async () => {
  const store = new PostgresStore();
  expect(await store.add(torvalds)).toMatchObject({ login: 'torvalds' });
  expect(await store.add(torvalds)).toBeNull();
  expect(await store.update(torvalds.id, { note: "quotes ' ; -- remain data", tags: ['systems'] })).toMatchObject({ note: "quotes ' ; -- remain data", tags: ['systems'] });
  expect((await store.list()).find((u) => u.id === torvalds.id)).toMatchObject({ login: 'torvalds' });
  expect(await store.remove(torvalds.id)).toBe(true);
  expect(await store.remove(torvalds.id)).toBe(false);
});
