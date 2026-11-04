import { readFile } from 'node:fs/promises';
import { database } from '../src/store-postgres';
const pool = await database();
try {
  await pool.query(await readFile(new URL('../database/001_initial.sql', import.meta.url), 'utf8'));
  console.log('Database schema is ready.');
} finally { await pool.end(); }
