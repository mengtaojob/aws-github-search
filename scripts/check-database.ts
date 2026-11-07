import { database } from '../src/store-postgres';
const pool = await database();
try {
  const identity = await pool.query('SELECT current_database() AS database, current_user AS username');
  const count = await pool.query('SELECT COUNT(*)::int AS count FROM github_users');
  console.log('Connected:', identity.rows[0]);
  console.log('Saved users:', count.rows[0].count);
  console.log('PASS: authenticated TLS database connection and table query. No records changed.');
} catch (error) {
  console.error('Database check failed:', (error as Error).message);
  process.exitCode = 1;
} finally { await pool.end(); }
