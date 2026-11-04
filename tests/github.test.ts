import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGitHub } from '../src/github';
import { searchResult, torvalds } from './fixtures';

afterEach(() => vi.unstubAllEnvs());
describe('GitHub HTTP client', () => {
  it('encodes the query and sends GitHub headers and an abort signal', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token');
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(searchResult));
    expect(await createGitHub(fetcher).search('location:Shanghai language:TypeScript', 2)).toEqual({ ...searchResult, items: searchResult.items.map(({ id, login, avatar_url, html_url, type }) => ({ id, login, avatar_url, html_url, type })) });
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(String(url)).searchParams.get('q')).toBe('location:Shanghai language:TypeScript');
    expect(new URL(String(url)).searchParams.get('per_page')).toBe('12');
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer test-token', 'User-Agent': 'aws-github-search-homework' });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });
  it('reads a full profile', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(torvalds));
    expect(await createGitHub(fetcher).profile('torvalds')).toEqual(torvalds);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.github.com/users/torvalds');
  });
  it.each([[403, 403], [429, 429], [500, 502], [404, 404], [401, 401], [422, 422]])('handles upstream %s', async (upstream, expected) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: upstream }));
    await expect(createGitHub(fetcher).search('torvalds', 1)).rejects.toMatchObject({ status: expected });
  });
  it.each(['AbortError', 'TimeoutError'])('maps %s to 504', async (name) => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new DOMException('timeout', name));
    await expect(createGitHub(fetcher).search('torvalds', 1)).rejects.toMatchObject({ status: 504 });
  });
  it('handles network errors', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network failure'));
    await expect(createGitHub(fetcher).search('torvalds', 1)).rejects.toMatchObject({ status: 502 });
  });
  it.each([{}, { items: 'unexpected' }])('rejects an unexpected response schema', async (payload) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload));
    await expect(createGitHub(fetcher).search('torvalds', 1)).rejects.toMatchObject({ status: 502 });
  });
  it('handles a non-JSON upstream body', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>bad gateway</html>'));
    await expect(createGitHub(fetcher).search('torvalds', 1)).rejects.toMatchObject({ status: 502 });
  });
});
