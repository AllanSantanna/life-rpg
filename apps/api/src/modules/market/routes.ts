import { Router } from 'express';
import { MarketError, TICKER_PATTERN } from './brapi.js';
import type { MarketService } from './service.js';

const status: Record<MarketError['code'], number> = {
  not_found: 404,
  unauthorized: 502,
  rate_limited: 503,
  unavailable: 502,
};

/** Proxy somente leitura de cotações da B3; não expõe o token da fonte. */
export function marketRoutes(service: MarketService) {
  const router = Router();
  router.get('/market/quotes/:ticker', async (req, res, next) => {
    const ticker = String(req.params.ticker).toUpperCase();
    if (!TICKER_PATTERN.test(ticker)) {
      res.status(400).json({ error: 'Ticker inválido.' });
      return;
    }
    try {
      res.set('Cache-Control', 'no-store').json(await service.quote(ticker));
    } catch (error) {
      if (error instanceof MarketError) {
        res.status(status[error.code]).json({
          error: error.message,
          code: error.code,
        });
        return;
      }
      next(error);
    }
  });
  router.get('/market/tickers', async (req, res, next) => {
    const search = String(req.query.search ?? '').trim();
    if (!/^[A-Za-z0-9]{2,12}$/.test(search)) {
      res.status(400).json({ error: 'Pesquise com 2 a 12 letras ou números.' });
      return;
    }
    try {
      res.json({ results: await service.search(search) });
    } catch (error) {
      if (error instanceof MarketError) {
        res.status(status[error.code]).json({
          error: error.message,
          code: error.code,
        });
        return;
      }
      next(error);
    }
  });
  return router;
}
