import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { createGoBackend } from '../src/go-backend';

function setup(response = new Response('{"items":[]}', { headers: { 'Content-Type': 'application/json' } })) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
  const store = { list: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn() };
  const github = { search: vi.fn(), profile: vi.fn() };
  const app = createApp({ goBaseUrl: 'http://go.internal:8080', goFetch: fetcher, token: async () => 'gateway-test', store, github });
  return { app, fetcher, store, github };
}
const auth = { Authorization: 'Bearer gateway-test' };

describe('optional Go gateway', () => {
  it('forwards query, uses a fixed origin and leaves legacy storage untouched', async () => {
    const { app, fetcher, store, github } = setup();
    const result = await app.request('/search/users?q=go%20language&page=2', { headers: { ...auth, Cookie: 'private=secret', Origin: 'http://localhost:3000', 'X-Forwarded-Host': 'attacker.example' } });
    expect(result.status).toBe(200);
    const [target, init] = fetcher.mock.calls[0];
    expect(String(target)).toBe('http://go.internal:8080/search/users?q=go%20language&page=2');
    const headers = new Headers(init?.headers);
    for (const name of ['Authorization', 'Cookie', 'Origin', 'X-Forwarded-Host']) expect(headers.has(name)).toBe(false);
    expect(init?.redirect).toBe('error');
    expect(result.headers.get('X-OctoShelf-Backend')).toBe('go');
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(store.list).not.toHaveBeenCalled(); expect(github.search).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', '/github/users/octocat', undefined], ['GET', '/users', undefined],
    ['POST', '/users', '{"login":"octocat"}'],
    ['PATCH', '/users/583231', '{"note":"中文","tags":["Go"]}'],
    ['GET', '/ready', undefined],
  ])('forwards %s %s without changing the JSON body', async (method, path, body) => {
    const { app, fetcher } = setup();
    expect((await app.request(path, { method, headers: { ...auth, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body })).status).toBe(200);
    const [target, init] = fetcher.mock.calls[0];
    expect(String(target)).toBe(`http://go.internal:8080${path}`);
    expect(init?.method).toBe(method);
    if (body) expect(new TextDecoder().decode(init?.body as ArrayBuffer)).toBe(body);
  });

  it('keeps authentication, origin validation, body limits and preflight at the gateway', async () => {
    const { app, fetcher } = setup();
    expect((await app.request('/users')).status).toBe(401);
    expect((await app.request('/users', { method: 'POST', headers: { ...auth, Origin: 'https://attacker.example' }, body: '{}' })).status).toBe(403);
    expect((await app.request('/users', { method: 'POST', headers: auth, body: 'x'.repeat(17000) })).status).toBe(413);
    const preflight = await app.request('/users', { method: 'OPTIONS', headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Authorization,Content-Type' } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect((await app.request('/unknown', { headers: auth })).status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns Go health plus gateway auth configuration', async () => {
    const { app } = setup(Response.json({ status: 'ok', service: 'go-api', storage: 'postgres' }));
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ backend: 'go', storage: 'postgres', authRequired: true });
  });

  it.each(['/health', '/users'])('preserves bodyless HEAD responses for %s', async (path) => {
    const { app, fetcher } = setup(new Response(null, { headers: { 'Content-Type': 'application/json' } }));
    const response = await app.request(path, { method: 'HEAD', headers: auth });
    expect(response.status).toBe(200); expect(await response.text()).toBe('');
    expect(fetcher.mock.calls[0][1]?.method).toBe('HEAD');
  });

  it('preserves status, Retry-After and empty DELETE responses', async () => {
    const limited = setup(Response.json({ message: 'rate limited' }, { status: 429, headers: { 'Retry-After': '60', 'Set-Cookie': 'upstream=private' } }));
    const response = await limited.app.request('/search/users?q=go', { headers: auth });
    expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('60');
    expect(response.headers.has('Set-Cookie')).toBe(false);
    const removed = setup(new Response(null, { status: 204 }));
    const deleted = await removed.app.request('/users/1', { method: 'DELETE', headers: auth });
    expect(deleted.status).toBe(204); expect(await deleted.text()).toBe('');
  });

  it.each([
    [new TypeError('password=do-not-expose'), 502], [new DOMException('timed out', 'TimeoutError'), 504],
  ])('does not retry, expose connection details or fall back on upstream failure', async (error, status) => {
    const { app, fetcher, store } = setup();
    fetcher.mockRejectedValue(error);
    const response = await app.request('/users', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{"login":"octocat"}' });
    expect(response.status).toBe(status); expect(await response.text()).not.toContain('password');
    expect(fetcher).toHaveBeenCalledTimes(1); expect(store.add).not.toHaveBeenCalled();
  });

  it.each([new Response('<h1>proxy error</h1>', { status: 502 }), new Response('invalid JSON', { headers: { 'Content-Type': 'application/json' } })])('rejects invalid upstream responses', async (upstream) => {
    const { app } = setup(upstream);
    expect((await app.request('/users', { headers: auth })).status).toBe(502);
  });

  it.each(['file:///tmp/go', 'http://user:password@go.internal', 'http://go.internal/path', 'http://go.internal?token=x', 'http://go.internal/#x'])('rejects unsafe configuration %s', (value) => {
    expect(() => createGoBackend(value)).toThrow();
  });
});
