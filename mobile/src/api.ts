export const DEFAULT_API_URL = 'https://bya6zpuudd.execute-api.ap-southeast-2.amazonaws.com';
export interface Connection { base: string; token: string }
export interface SavedUser {
  id: number; login: string; name: string | null; avatar_url: string; html_url: string;
  bio: string | null; company: string | null; location: string | null;
  public_repos: number; followers: number; note: string; tags: string[];
  created_at: string; updated_at: string;
}
export function normalizeBase(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('请输入完整的 HTTPS API 地址。'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('API 地址必须使用 HTTPS，且不能包含账号、查询参数或锚点。');
  return url.toString().replace(/\/+$/, '');
}
export function parseUsers(data: unknown): SavedUser[] {
  const items = (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) throw new Error('服务返回的数据格式不正确，请检查 API 地址。');
  return items.map((value: unknown) => {
    const u = value as SavedUser | null;
    if (!u || !Number.isSafeInteger(u.id) || u.id < 1 || typeof u.login !== 'string' || typeof u.note !== 'string' || !Array.isArray(u.tags) || u.tags.some(t => typeof t !== 'string')) throw new Error('收藏数据不完整，请刷新重试。');
    return { ...u, avatar_url: typeof u.avatar_url === 'string' && u.avatar_url.startsWith('https://') ? u.avatar_url : '', name: typeof u.name === 'string' ? u.name : null, bio: typeof u.bio === 'string' ? u.bio : null, company: typeof u.company === 'string' ? u.company : null, location: typeof u.location === 'string' ? u.location : null, public_repos: typeof u.public_repos === 'number' ? u.public_repos : 0, followers: typeof u.followers === 'number' ? u.followers : 0 };
  });
}
export async function fetchUsers(connection: Connection, signal?: AbortSignal): Promise<SavedUser[]> {
  const base = normalizeBase(connection.base);
  if (!connection.token.trim()) throw new Error('请输入项目访问令牌。');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 25_000);
  try {
    const response = await fetch(`${base}/users`, { headers: { Authorization: `Bearer ${connection.token.trim()}` }, signal: controller.signal });
    if (response.status === 401 || response.status === 403) throw new Error('访问令牌无效或权限不足，请在连接设置中重新输入。');
    if (response.status === 429) throw new Error('请求过于频繁，请稍后下拉刷新。');
    if (!response.ok) throw new Error(`服务暂时不可用（${response.status}），请稍后重试。`);
    return parseUsers(await response.json());
  } catch (error) {
    if (controller.signal.aborted) throw new Error('连接已取消或超时，请检查网络后重试。');
    if (error instanceof TypeError) throw new Error('无法连接服务，请检查网络和 API 地址。');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
export function filterUsers(users: SavedUser[], query: string): SavedUser[] {
  const text = query.trim().toLocaleLowerCase();
  return users.filter(u => `${u.login} ${u.name ?? ''} ${u.note} ${u.tags.join(' ')}`.toLocaleLowerCase().includes(text));
}
