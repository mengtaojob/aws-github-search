import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { parseArgs, promisify } from 'node:util';
import pg from 'pg';

const { values } = parseArgs({ options: {
  help: { type: 'boolean', short: 'h' },
  stack: { type: 'string', default: 'octoshelf-course-dev' },
  profile: { type: 'string', default: 'aws-course' },
  region: { type: 'string', default: 'ap-southeast-2' },
  port: { type: 'string', default: '15432' },
} });

if (values.help) {
  console.log('Usage: node scripts/migrate-aws.mjs --stack octoshelf-course-dev --profile aws-course --port 15432');
  console.log('Requires an active SSM port-forwarding tunnel to this stack\'s Aurora endpoint.');
  console.log('Reads AWS secrets into memory, verifies RDS TLS, and runs database/001_initial.sql.');
} else {
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local tunnel port');
  if (!/^[a-zA-Z][a-zA-Z0-9-]{0,127}$/.test(values.stack)) throw new Error('Invalid stack name');
  const execute = promisify(execFile);
  async function aws(args) {
    const { stdout } = await execute(process.platform === 'win32' ? 'aws.exe' : 'aws', [
      ...args, '--profile', values.profile, '--region', values.region, '--output', 'json', '--no-cli-pager',
      '--cli-connect-timeout', '10', '--cli-read-timeout', '20',
    ], { timeout: 45_000, windowsHide: true, maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout);
  }
  try {
    const stack = await aws(['cloudformation', 'describe-stacks', '--stack-name', values.stack]);
    const outputs = Object.fromEntries(stack.Stacks[0].Outputs.map((o) => [o.OutputKey, o.OutputValue]));
    if (!outputs.DatabaseHost || !outputs.DatabaseSecretArn) throw new Error('Stack is missing database outputs');
    const result = await aws(['secretsmanager', 'get-secret-value', '--secret-id', outputs.DatabaseSecretArn]);
    const credentials = JSON.parse(result.SecretString);
    if (!credentials.username || !credentials.password) throw new Error('Database secret is missing credentials');
    const pool = new pg.Pool({
      host: '127.0.0.1', port, database: 'github_search',
      user: credentials.username, password: credentials.password,
      ssl: {
        rejectUnauthorized: true,
        servername: outputs.DatabaseHost,
        ca: await readFile(new URL('../dist/lambda/rds-ca.pem', import.meta.url), 'utf8'),
      },
      max: 1, connectionTimeoutMillis: 10_000, query_timeout: 30_000,
    });
    try {
      await pool.query(await readFile(new URL('../database/001_initial.sql', import.meta.url), 'utf8'));
      console.log(`Database schema is ready for stack ${values.stack}.`);
    } finally { await pool.end(); }
  } catch (error) {
    console.error('AWS database migration failed:', error.message);
    console.error('Check AWS login, stack outputs, the active SSM tunnel and the RDS CA bundle.');
    process.exitCode = 1;
  }
}
