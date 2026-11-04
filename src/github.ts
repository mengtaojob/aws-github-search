import { z } from 'zod';
import { ApiError } from './errors';
import type { GitHubProfile, SearchResult } from './types';

const userSchema = z.object({
  id: z.number().int().positive(), login: z.string(), avatar_url: z.url(),
  html_url: z.url(), type: z.string(),
});
const profileSchema = userSchema.extend({
  name: z.string().nullable(), bio: z.string().nullable(),
  location: z.string().nullable(), company: z.string().nullable(),
  public_repos: z.number().int().nonnegative(), followers: z.number().int().nonnegative(),
});
const searchSchema = z.object({ total_count: z.number(), incomplete_results: z.boolean(), items: z.array(userSchema) });

export interface GitHubService {
  search(q: string, page: number): Promise<SearchResult>;
  profile(login: string): Promise<GitHubProfile>;
}

export function createGitHub(fetcher: typeof fetch = fetch): GitHubService {
  async function request(path: string) {
    try {
      const response = await fetcher(`https://api.github.com${path}`, {
        headers: {
          Accept: 'application/vnd.github+json', 'User-Agent': 'aws-github-search-homework',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        const status = response.status;
        const messages: Record<number, string> = {
          401: 'GitHub 凭证无效，请检查后端 GITHUB_TOKEN',
          403: 'GitHub 暂时拒绝访问，可能达到请求限额，请稍后重试',
          404: '未找到这个 GitHub 用户',
          422: 'GitHub 无法处理该搜索条件，请简化关键词',
          429: 'GitHub 请求过于频繁，请稍后重试',
        };
        throw new ApiError(status >= 500 ? 502 : status, messages[status] ?? 'GitHub API 请求失败', response.headers.get('retry-after') ?? undefined);
      }
      return await response.json() as unknown;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
        throw new ApiError(504, 'GitHub 请求超时，请重试');
      }
      throw new ApiError(502, 'GitHub API 连接失败，请稍后重试');
    }
  }
  return {
    async search(q, page) {
      const data = searchSchema.safeParse(await request(`/search/users?${new URLSearchParams({ q, page: String(page), per_page: '12' })}`));
      if (!data.success) throw new ApiError(502, 'GitHub 返回的数据格式异常');
      return data.data;
    },
    async profile(login) {
      const data = profileSchema.safeParse(await request(`/users/${encodeURIComponent(login)}`));
      if (!data.success) throw new ApiError(502, 'GitHub 返回的数据格式异常');
      return data.data;
    },
  };
}
