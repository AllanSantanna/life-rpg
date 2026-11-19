import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createBrapiClient } from './modules/market/brapi.js';
import { createMarketService } from './modules/market/service.js';

const config = loadConfig();
const market = createMarketService(
  createBrapiClient({
    token: config.brapiToken,
    baseUrl: config.brapiBaseUrl,
  }),
);
const server = createApp(config.webOrigin, { market }).listen(
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
