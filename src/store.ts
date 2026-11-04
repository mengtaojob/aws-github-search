import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { GitHubProfile, SavedUser, UserPatch, UserStore } from './types';

export class FileStore implements UserStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly file: string) {}

  private async read(): Promise<SavedUser[]> {
    try { return JSON.parse(await readFile(this.file, 'utf8')) as SavedUser[]; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private transact<T>(action: (users: SavedUser[]) => T): Promise<T> {
    const pending = this.queue.then(async () => {
      const users = await this.read();
      const result = action(users);
      await mkdir(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(tmp, JSON.stringify(users, null, 2), 'utf8');
      await rename(tmp, this.file);
      return result;
    });
    this.queue = pending.catch(() => {});
    return pending;
  }

  async list() { await this.queue; return (await this.read()).sort((a, b) => b.created_at.localeCompare(a.created_at)); }
  add(profile: GitHubProfile) {
    return this.transact((users) => {
      if (users.some((u) => u.id === profile.id)) return null;
      const now = new Date().toISOString();
      const user: SavedUser = { ...profile, note: '', tags: [], created_at: now, updated_at: now };
      users.push(user);
      return user;
    });
  }
  update(id: number, patch: UserPatch) {
    return this.transact((users) => {
      const index = users.findIndex((u) => u.id === id);
      if (index === -1) return null;
      users[index] = { ...users[index], ...patch, updated_at: new Date().toISOString() };
      return users[index];
    });
  }
  remove(id: number) {
    return this.transact((users) => {
      const index = users.findIndex((u) => u.id === id);
      if (index === -1) return false;
      users.splice(index, 1);
      return true;
    });
  }
}

let store: UserStore | undefined;
export async function getStore(): Promise<UserStore> {
  if (store) return store;
  if (process.env.STORE_DRIVER === 'postgres') {
    const { PostgresStore } = await import('./store-postgres');
    store = new PostgresStore();
  } else {
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) throw new Error('Lambda must use PostgreSQL persistence');
    store = new FileStore(resolve(process.env.DATA_FILE ?? '.data/users.json'));
  }
  return store;
}
