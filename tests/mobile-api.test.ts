import { afterEach, expect, it, vi } from 'vitest';
import { fetchUsers, filterUsers, normalizeBase, parseUsers } from '../mobile/src/api';

afterEach(() => vi.unstubAllGlobals());
const user = { id: 12232166, login: 'TorvaldsDB', note: '已切换到 RDS', tags: ['标签001'], name: 'torvalds' };
it('rejects unsafe connection addresses before sending the access token', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(fetchUsers({ base: 'http://example.com', token: 'private' })).rejects.toThrow('HTTPS');
  for (const address of ['https://u:p@example.com', 'https://example.com?token=x', 'https://example.com/#x']) expect(() => normalizeBase(address)).toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it('uses bearer auth and reports invalid credentials clearly', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 401 })); vi.stubGlobal('fetch', fetch);
  await expect(fetchUsers({ base: ' https://example.com/prod/ ', token: ' test-token ' })).rejects.toThrow('令牌无效');
  expect(fetch).toHaveBeenCalledWith('https://example.com/prod/users', expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }));
});
it('validates responses and searches Chinese notes, tags, names and logins', () => {
  const users = parseUsers({ items: [user] });
  expect(users[0].company).toBeNull();
  for (const q of [' rds ', '标签001', 'torvaldsdb', 'Torvalds']) expect(filterUsers(users, q)).toHaveLength(1);
  expect(filterUsers(users, '不存在')).toEqual([]);
  expect(() => parseUsers({ items: [{ ...user, tags: [null] }] })).toThrow('数据不完整');
  expect(() => parseUsers({ items: null })).toThrow('格式');
});
