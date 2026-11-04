const base = (process.env.API_BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
const headers = process.env.API_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.API_ACCESS_TOKEN}` } : {};
const response = await fetch(`${base}/search/users?q=torvalds`, { headers, signal: AbortSignal.timeout(20_000) });
if (!response.ok) throw new Error(`Search returned ${response.status}: ${await response.text()}`);
const data = await response.json();
if (typeof data.total_count !== 'number' || !Array.isArray(data.items) || !data.items.some((u) => u.login === 'torvalds')) throw new Error('Unexpected search response');
const invalid = await fetch(`${base}/search/users`, { headers, signal: AbortSignal.timeout(20_000) });
if (invalid.status !== 400) throw new Error(`Missing q returned ${invalid.status}, expected 400`);
console.log(`PASS ${base}: search contains torvalds; missing q returns 400. No persistent data changed.`);
