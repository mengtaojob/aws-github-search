import { describe, expect, it } from 'vitest';
import { handler } from '../src/handler';
import type { Context } from 'aws-lambda';

function event(path: string): Parameters<typeof handler>[0] {
  return {
    version: '2.0', routeKey: '$default', rawPath: path, rawQueryString: '', body: null,
    headers: { host: 'example.execute-api.ap-southeast-2.amazonaws.com' },
    requestContext: {
      accountId: '000000000000', apiId: 'example', authentication: null, authorizer: {},
      domainName: 'example.execute-api.ap-southeast-2.amazonaws.com', domainPrefix: 'example',
      requestId: 'test-request', routeKey: '$default', stage: '$default',
      time: '03/Nov/2026:00:00:00 +0000', timeEpoch: 1793664000000,
      http: { method: 'GET', path, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'vitest' },
    },
    isBase64Encoded: false,
  };
}
describe('API Gateway HTTP API v2 Lambda adapter', () => {
  it('returns a Lambda response with status, headers and JSON body', async () => {
    const response = await handler(event('/search/users'), {} as Context);
    expect(response.statusCode).toBe(400);
    expect(response.headers?.['content-type']).toContain('application/json');
    expect(JSON.parse(response.body as string).message).toContain('搜索关键词');
  });
  it('routes an unknown API path to 404', async () => {
    const response = await handler(event('/not-a-route'), {} as Context);
    expect(response.statusCode).toBe(404);
  });
});
