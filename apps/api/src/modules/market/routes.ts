import { Router, type RequestHandler, type Response } from 'express';
import { createRateLimiter } from './rateLimit.js';
import { MarketError, TICKER_PATTERN } from './brapi.js';
import { RETRY_AFTER_FAILURE, type MarketService } from './service.js';

const status: Record<MarketError['code'], number> = {
  not_found: 404,
  unauthorized: 502,
  rate_limited: 503,
  unavailable: 502,
  invalid: 502,
};
/** Erro da fonte em JSON; o detalhe de configuração vai só para o log. */
function sendMarketError(res: Response, error: MarketError) {
  if (error.code === 'unauthorized')
    console.warn(
      'brapi recusou o acesso: confira BRAPI_TOKEN na configuração do servidor.',
    );
  if (error.code === 'rate_limited')
    res.set('Retry-After', String(RETRY_AFTER_FAILURE / 1000));
  res
    .status(status[error.code])
    .json({ error: error.message, code: error.code });
}

/** Proxy somente leitura de cotações da B3; não expõe o token da fonte. */
export function marketRoutes(
  service: MarketService,
  limiter: RequestHandler = createRateLimiter({ limit: 60, windowMs: 60_000 }),
) {
  const router = Router();
  router.use('/market', limiter);
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
        sendMarketError(res, error);
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
        sendMarketError(res, error);
        return;
      }
      next(error);
    }
  });
  return router;
}
