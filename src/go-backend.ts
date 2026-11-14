import { ApiError } from './errors';

/** Only this server-owned origin is used; client headers cannot select an upstream. */
export function createGoBackend(base: string, fetcher: typeof fetch = fetch) {
  const origin = new URL(base);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('GO_API_BASE_URL must be an HTTP(S) origin without credentials, path, query or fragment');
  }

  return async function forward(request: Request): Promise<Response> {
    const incoming = new URL(request.url);
    const target = new URL(origin);
    target.pathname = incoming.pathname;
    target.search = incoming.search;
    // Never pass the browser's access token, cookies, Origin or forwarding headers to Go.
    const headers = new Headers({ Accept: 'application/json' });
    const contentType = request.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
    try {
      const response = await fetcher(target, {
        method: request.method, headers, body, redirect: 'error',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
      });
      const resultHeaders = new Headers({ 'X-OctoShelf-Backend': 'go' });
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) resultHeaders.set('Retry-After', retryAfter);
      if (request.method === 'HEAD') {
        const contentType = response.headers.get('Content-Type');
        if (contentType) resultHeaders.set('Content-Type', contentType);
        return new Response(null, { status: response.status, headers: resultHeaders });
      }
      if (response.status === 204) return new Response(null, { status: 204, headers: resultHeaders });
      if (!response.headers.get('Content-Type')?.includes('application/json')) {
        throw new ApiError(502, 'Go 服务返回的数据格式异常');
      }
      // Consume the response under the same timeout, then let Hono apply gateway CORS.
      const payload = await response.text();
      try { JSON.parse(payload); } catch { throw new ApiError(502, 'Go 服务返回的数据格式异常'); }
      resultHeaders.set('Content-Type', 'application/json; charset=utf-8');
      return new Response(payload, { status: response.status, headers: resultHeaders });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
        throw new ApiError(504, 'Go 服务请求超时，请稍后重试');
      }
      // Writes are never retried and never fall back to the old store.
      throw new ApiError(502, '无法连接 Go 服务，请检查服务是否启动');
    }
  };
}
