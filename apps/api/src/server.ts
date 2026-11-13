import { createApp } from './app.js';
import { loadConfig } from './config/env.js';

const config = loadConfig();
const server = createApp(config.webOrigin).listen(
  config.port,
  '127.0.0.1',
  () => {
    console.info(`Life RPG API: http://localhost:${config.port}`);
  },
);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close((error) => {
      process.exit(error ? 1 : 0);
    });
    setTimeout(() => {
      process.exit(1);
    }, 10_000).unref();
  });
}
