import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { ApiError } from './errors';
import { createGitHub, type GitHubService } from './github';
import { getStore } from './store';
import { accessToken } from './secrets';
import type { UserStore } from './types';

interface Dependencies { github?: GitHubService; store?: UserStore; token?: () => Promise<string | undefined> }
const loginSchema = z.string().regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/, '请输入有效的 GitHub 用户名');
const patchSchema = z.object({ note: z.string().trim().max(1000), tags: z.array(z.string().trim().min(1).max(24)).max(8) }).strict();

export function createApp(deps: Dependencies = {}) {
  const app = new Hono();
  const github = deps.github ?? createGitHub();
  const store = () => deps.store ? Promise.resolve(deps.store) : getStore();
  const token = deps.token ?? accessToken;
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000').split(',').map((s) => s.trim());

  app.use('*', cors({ origin: (origin) => origins.includes(origin) ? origin : undefined, allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'], exposeHeaders: ['Retry-After'], maxAge: 600 }));
  app.use('*', bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ message: '请求体过大' }, 413) }));
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    if (c.req.path === '/health') return next();
    const expected = await token();
    if (expected) {
      const provided = c.req.header('Authorization')?.replace(/^Bearer /, '') ?? '';
      const a = Buffer.from(expected), b = Buffer.from(provided);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return c.json({ message: '请输入有效的项目访问令牌' }, 401);
    }
    // A non-browser client may omit Origin, but a browser write must come from our UI.
    const origin = c.req.header('Origin');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && origin && !origins.includes(origin)) {
      return c.json({ message: '不允许此来源修改数据' }, 403);
    }
    await next();
  });

  async function jsonBody(request: Request): Promise<unknown> {
    if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError(415, '请使用 application/json');
    try { return await request.json(); } catch { throw new ApiError(400, 'JSON 格式不正确'); }
  }
  function id(value: string) {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new ApiError(400, '用户 ID 不正确');
    return Number(value);
  }

  app.get('/health', async (c) => c.json({ status: 'ok', authRequired: Boolean(await token()), storage: process.env.STORE_DRIVER === 'postgres' ? 'postgres' : 'file' }));
  app.get('/search/users', async (c) => {
    const q = c.req.query('q')?.trim();
    if (!q || q.length > 256) throw new ApiError(400, '请提供 1–256 个字符的搜索关键词 q');
    const rawPage = c.req.query('page') ?? '1';
    if (!/^\d+$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > 84) throw new ApiError(400, 'page 必须为 1–84 的整数');
    return c.json(await github.search(q, Number(rawPage)));
  });
  app.get('/github/users/:login', async (c) => c.json(await github.profile(loginSchema.parse(c.req.param('login')))));
  app.get('/users', async (c) => c.json({ items: await (await store()).list() }));
  app.post('/users', async (c) => {
    const { login } = z.object({ login: loginSchema }).strict().parse(await jsonBody(c.req.raw));
    const profile = await github.profile(login);
    const user = await (await store()).add(profile);
    if (!user) throw new ApiError(409, '这个用户已经在收藏中了');
    return c.json(user, 201);
  });
  app.patch('/users/:id', async (c) => {
    const userId = id(c.req.param('id'));
    const patch = patchSchema.parse(await jsonBody(c.req.raw));
    patch.tags = [...new Set(patch.tags)];
    const user = await (await store()).update(userId, patch);
    if (!user) throw new ApiError(404, '收藏用户不存在');
    return c.json(user);
  });
  app.delete('/users/:id', async (c) => {
    if (!await (await store()).remove(id(c.req.param('id')))) throw new ApiError(404, '收藏用户不存在');
    return c.body(null, 204);
  });
  app.notFound((c) => c.json({ message: '接口不存在' }, 404));
  app.onError((error, c) => {
    if (error instanceof z.ZodError) return c.json({ message: '参数格式不正确', details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) }, 400);
    if (error instanceof ApiError) {
      if (error.retryAfter) c.header('Retry-After', error.retryAfter);
      return c.json({ message: error.message }, error.status as 400);
    }
    console.error('API error', { name: error.name, code: (error as NodeJS.ErrnoException).code });
    return c.json({ message: '服务暂时不可用，请稍后重试' }, 500);
  });
  return app;
}
