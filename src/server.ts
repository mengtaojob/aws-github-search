import { serve } from '@hono/node-server';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);
const hostname = process.env.HOST ?? '127.0.0.1';
const server = serve({ fetch: createApp().fetch, port, hostname }, (info) => {
  console.log(`API ready at http://${hostname}:${info.port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
