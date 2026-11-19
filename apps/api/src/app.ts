import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { ErrorRequestHandler } from 'express';
import { marketRoutes } from './modules/market/routes.js';
import type { MarketService } from './modules/market/service.js';

export function createApp(
  webOrigin: string,
  options: { market?: MarketService } = {},
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: webOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  if (options.market) app.use(marketRoutes(options.market));
  app.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });
  const handleError: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next,
  ) => {
    if (
      error instanceof SyntaxError &&
      'status' in error &&
      error.status === 400
    ) {
      res.status(400).json({ error: 'JSON inválido.' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  };
  app.use(handleError);
  return app;
}
