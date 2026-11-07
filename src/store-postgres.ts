import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { Signer } from '@aws-sdk/rds-signer';
import { readSecret } from './secrets';
import type { GitHubProfile, SavedUser, UserPatch, UserStore } from './types';

const { Pool } = pg;
let poolPromise: Promise<pg.Pool> | undefined;

export async function databaseConfig(): Promise<pg.PoolConfig> {
    let config: pg.PoolConfig;
    if (process.env.DB_AUTH === 'iam') {
      const host = process.env.DB_HOST;
      const user = process.env.DB_USER;
      const region = process.env.AWS_REGION;
      const port = Number(process.env.DB_PORT ?? 5432);
      if (!host || !user || !region) throw new Error('IAM database auth requires DB_HOST, DB_USER and AWS_REGION');
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid DB_PORT');
      if (process.env.DATABASE_SSL === 'false') throw new Error('IAM database auth requires TLS; set DATABASE_SSL=true');
      const signer = new Signer({ hostname: host, username: user, port, region });
      config = { host, user, port, database: process.env.DB_NAME ?? 'github_search', password: () => signer.getAuthToken(),
        // Express uses publicly trusted certificates. Never disable certificate verification.
        ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 60_000 };
      return config;
    } else if (process.env.DB_SECRET_ARN) {
      const secret = JSON.parse(await readSecret(process.env.DB_SECRET_ARN)) as { username: string; password: string };
      config = { host: process.env.DB_HOST, database: process.env.DB_NAME ?? 'github_search', user: secret.username,
        password: async () => (JSON.parse(await readSecret(process.env.DB_SECRET_ARN!)) as { password: string }).password,
        port: 5432 };
    } else {
      if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for PostgreSQL');
      config = { connectionString: process.env.DATABASE_URL };
    }
    const ssl = process.env.DATABASE_SSL !== 'false';
    if (ssl) {
      config.ssl = { rejectUnauthorized: true, ...(process.env.DB_CA_FILE ? { ca: await readFile(process.env.DB_CA_FILE, 'utf8') } : {}) };
    }
    return config;
}

export function database(): Promise<pg.Pool> {
  poolPromise ??= databaseConfig().then((config) => new Pool({ max: 2, connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000, query_timeout: 15_000, ...config })).catch((error) => { poolPromise = undefined; throw error; });
  return poolPromise;
}

function map(row: Record<string, unknown>): SavedUser {
  return { ...(row.profile as GitHubProfile), note: row.note as string, tags: row.tags as string[], created_at: new Date(row.created_at as string).toISOString(), updated_at: new Date(row.updated_at as string).toISOString() };
}

export class PostgresStore implements UserStore {
  async list() {
    const result = await (await database()).query('SELECT * FROM github_users ORDER BY created_at DESC');
    return result.rows.map(map);
  }
  async add(profile: GitHubProfile) {
    const result = await (await database()).query('INSERT INTO github_users (github_id, profile) VALUES ($1, $2::jsonb) ON CONFLICT (github_id) DO NOTHING RETURNING *', [profile.id, JSON.stringify(profile)]);
    return result.rows[0] ? map(result.rows[0]) : null;
  }
  async update(id: number, patch: UserPatch) {
    const result = await (await database()).query('UPDATE github_users SET note=$2, tags=$3, updated_at=NOW() WHERE github_id=$1 RETURNING *', [id, patch.note, patch.tags]);
    return result.rows[0] ? map(result.rows[0]) : null;
  }
  async remove(id: number) {
    const result = await (await database()).query('DELETE FROM github_users WHERE github_id=$1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
