import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { FileStore } from '../src/store';
import { createGitHub } from '../src/github';
import { searchResult, torvalds } from './fixtures';

describe('shared HTTP application', () => {
  let directory: string;
  let store: FileStore;
  const github = { search: vi.fn(), profile: vi.fn() };
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'octoshelf-'));
    store = new FileStore(join(directory, 'users.json'));
    github.search.mockResolvedValue(searchResult); github.profile.mockResolvedValue(torvalds);
  });
  afterEach(async () => { vi.clearAllMocks(); await rm(directory, { recursive: true, force: true }); });
  const body = (value: unknown, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  function app() { return createApp({ store, github, token: async () => undefined }); }

  it('searches a trimmed keyword with pagination', async () => {
    const response = await app().request('/search/users?q=%20torvalds%20&page=2');
    expect(response.status).toBe(200); expect(await response.json()).toEqual(searchResult);
    expect(github.search).toHaveBeenCalledWith('torvalds', 2);
  });
  it.each(['/search/users', '/search/users?q=', '/search/users?q=%20%20', '/search/users?q=x&page=0', '/search/users?q=x&page=1.5', '/search/users?q=x&page=85', `/search/users?q=${'a'.repeat(257)}`])('rejects invalid search %s', async (path) => {
    expect((await app().request(path)).status).toBe(400); expect(github.search).not.toHaveBeenCalled();
  });
  it('supports a persistent add, list, update and delete lifecycle', async () => {
    const api = app();
    const added = await api.request('/users', body({ login: 'torvalds' }));
    expect(added.status).toBe(201); expect(github.profile).toHaveBeenCalledWith('torvalds');
    expect((await api.request('/users', body({ login: 'torvalds' }))).status).toBe(409);
    const patch = { note: '  Linux creator  ', tags: [' Linux ', 'systems', 'Linux'] };
    const updated = await api.request(`/users/${torvalds.id}`, body(patch, 'PATCH'));
    expect(updated.status).toBe(200); expect(await updated.json()).toMatchObject({ note: 'Linux creator', tags: ['Linux', 'systems'] });
    const reopened = new FileStore(join(directory, 'users.json'));
    expect((await reopened.list())[0].note).toBe('Linux creator');
    const list = await api.request('/users'); expect((await list.json()).items).toHaveLength(1);
    expect((await api.request(`/users/${torvalds.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await reopened.list())).toEqual([]);
    expect((await api.request(`/users/${torvalds.id}`, { method: 'DELETE' })).status).toBe(404);
  });
  it('rejects spoofed profile fields and invalid notes', async () => {
    const api = app();
    expect((await api.request('/users', body({ login: 'torvalds', id: 7 }))).status).toBe(400);
    expect((await api.request('/users', body({ login: '../etc' }))).status).toBe(400);
    expect((await api.request('/users/1', body({ note: 'x'.repeat(1001), tags: [] }, 'PATCH'))).status).toBe(400);
    expect((await api.request('/users/1', body({ note: '', tags: Array(9).fill('x') }, 'PATCH'))).status).toBe(400);
    expect((await api.request('/users/nope', { method: 'DELETE' })).status).toBe(400);
    expect((await api.request('/users/0', { method: 'DELETE' })).status).toBe(400);
    expect((await api.request('/users/1', body({ note: '', tags: [] }, 'PATCH'))).status).toBe(404);
  });
  it('rejects malformed JSON and oversized bodies', async () => {
    const api = app();
    expect((await api.request('/users', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } })).status).toBe(400);
    expect((await api.request('/users', { method: 'POST', body: '{}' })).status).toBe(415);
    expect((await api.request('/users', body({ login: 'x'.repeat(17000) }))).status).toBe(413);
  });
  it('authenticates APIs while exposing health and CORS preflight', async () => {
    const api = createApp({ store, github, token: async () => 'test-only-access-token' });
    expect((await api.request('/users')).status).toBe(401);
    expect((await api.request('/users', { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);
    expect((await api.request('/users', { headers: { Authorization: 'Bearer test-only-access-token' } })).status).toBe(200);
    const health = await api.request('/health'); expect(health.status).toBe(200); expect((await health.json()).authRequired).toBe(true);
    const preflight = await api.request('/users', { method: 'OPTIONS', headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST' } });
    expect(preflight.status).toBe(204); expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });
  it('rejects browser mutations from an untrusted origin', async () => {
    const response = await app().request('/users', { ...body({ login: 'torvalds' }), headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' } });
    expect(response.status).toBe(403); expect(github.profile).not.toHaveBeenCalled();
  });
  it('serializes concurrent duplicate saves', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => store.add(torvalds)));
    expect(results.filter(Boolean)).toHaveLength(1); expect(await store.list()).toHaveLength(1);
  });
  it('returns a generic message for storage errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { ...store, list: async () => { throw new Error('password=do-not-expose'); } } as unknown as FileStore;
    const response = await createApp({ store: broken, github, token: async () => undefined }).request('/users');
    expect(response.status).toBe(500); expect(await response.text()).not.toContain('password');
    errorSpy.mockRestore();
  });
  it('propagates GitHub rate limits with retry metadata', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '60' } }));
    const response = await createApp({ store, github: createGitHub(fetcher), token: async () => undefined }).request('/search/users?q=torvalds');
    expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('60');
  });
});
