import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { readSecret } from './secrets';
import type { GitHubProfile, SavedUser, UserPatch, UserStore } from './types';

const { Pool } = pg;
let poolPromise: Promise<pg.Pool> | undefined;

export function database(): Promise<pg.Pool> {
  poolPromise ??= (async () => {
    let config: pg.PoolConfig;
    if (process.env.DB_SECRET_ARN) {
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
    return new Pool({ ...config, max: 2, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000, query_timeout: 15_000 });
  })().catch((error) => { poolPromise = undefined; throw error; });
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
