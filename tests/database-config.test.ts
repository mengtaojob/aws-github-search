import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { token } = vi.hoisted(() => ({ token: vi.fn() }));
vi.mock('@aws-sdk/rds-signer', () => ({ Signer: class { getAuthToken = token; } }));
import { databaseConfig } from '../src/store-postgres';

beforeEach(() => {
  for (const key of ['DB_AUTH', 'DB_HOST', 'DB_USER', 'AWS_REGION', 'DB_SECRET_ARN', 'DB_CA_FILE', 'DATABASE_URL', 'DATABASE_SSL', 'DB_PORT']) vi.stubEnv(key, '');
  token.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
function iam() {
  vi.stubEnv('DB_AUTH', 'iam'); vi.stubEnv('DB_HOST', 'example.ap-southeast-2.rds.amazonaws.com');
  vi.stubEnv('DB_USER', 'postgres'); vi.stubEnv('AWS_REGION', 'ap-southeast-2');
  vi.stubEnv('DB_PORT', '5432'); vi.stubEnv('DATABASE_SSL', 'true');
}
it('refreshes IAM tokens for each new connection and ignores a leftover local URL', async () => {
  iam(); vi.stubEnv('DATABASE_URL', 'postgresql://local:unused@localhost/unused');
  token.mockResolvedValueOnce('first-token').mockResolvedValueOnce('next-token');
  const config = await databaseConfig();
  expect(config.host).toBe('example.ap-southeast-2.rds.amazonaws.com');
  expect(config.connectionString).toBeUndefined();
  expect(config.ssl).toEqual({ rejectUnauthorized: true });
  const password = config.password as () => Promise<string>;
  expect(await password()).toBe('first-token'); expect(await password()).toBe('next-token');
});
it('rejects missing IAM settings before a database connection', async () => {
  vi.stubEnv('DB_AUTH', 'iam');
  await expect(databaseConfig()).rejects.toThrow('DB_HOST');
});
it('does not permit disabling TLS for IAM', async () => {
  iam(); vi.stubEnv('DATABASE_SSL', 'false');
  await expect(databaseConfig()).rejects.toThrow('requires TLS');
});
it('preserves the local PostgreSQL configuration', async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://local:unused@localhost/test'); vi.stubEnv('DATABASE_SSL', 'false');
  expect(await databaseConfig()).toEqual({ connectionString: 'postgresql://local:unused@localhost/test' });
});
