import type { RequestHandler } from 'express';

/**
 * Limite simples por cliente (janela fixa, em memória). Protege a cota da fonte
 * contra repetição acidental ou abusiva; o mapa de clientes também é limitado.
 */
export function createRateLimiter({
  limit,
  windowMs,
  maxClients = 1000,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  maxClients?: number;
  now?: () => number;
}): RequestHandler {
  const clients = new Map<string, { count: number; start: number }>();
  return (req, res, next) => {
    const key = req.ip ?? 'desconhecido';
    const time = now();
    let entry = clients.get(key);
    if (!entry || time - entry.start >= windowMs) {
      entry = { count: 0, start: time };
      clients.delete(key);
      clients.set(key, entry);
      if (clients.size > maxClients) {
        const oldest = clients.keys().next().value;
        if (oldest !== undefined) clients.delete(oldest);
      }
    }
    entry.count += 1;
    if (entry.count > limit) {
      res
        .set(
          'Retry-After',
          String(
            Math.max(1, Math.ceil((entry.start + windowMs - time) / 1000)),
          ),
        )
        .status(429)
        .json({
          error:
            'Muitas consultas em pouco tempo. Tente novamente em instantes.',
          code: 'too_many_requests',
        });
      return;
    }
    next();
  };
}
