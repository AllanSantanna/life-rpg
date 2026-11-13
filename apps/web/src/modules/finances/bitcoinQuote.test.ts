import { describe, it, expect, vi } from 'vitest';
const now = new Date('2026-11-13T12:00:00Z').getTime();
async function service() {
  vi.resetModules();
  return import('./bitcoinQuote');
}
const response = (body: unknown, ok = true) =>
  ({ ok, json: async () => body }) as Response;
describe('Cotação BTC/BRL', () => {
  it('consulta BRL, valida resposta, compartilha requisições e usa cache por uma hora', async () => {
    const { fetchBitcoinQuote, QUOTE_TTL } = await service();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        bitcoin: { brl: 500000.23, last_updated_at: (now - 1000) / 1000 },
      }),
    );
    const [first, second] = await Promise.all([
      fetchBitcoinQuote(undefined, fetcher, now),
      fetchBitcoinQuote(undefined, fetcher, now),
    ]);
    expect(first).toEqual(second);
    expect(first.priceCents).toBe(50000023);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toContain('vs_currencies=brl');
    expect(
      await fetchBitcoinQuote(first, fetcher, now + QUOTE_TTL - 1),
    ).toEqual(first);
    await fetchBitcoinQuote(first, fetcher, now + QUOTE_TTL);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('reutiliza cache persistido sem consultar e mantém erro limitado a uma tentativa por hora', async () => {
    const { fetchBitcoinQuote, QUOTE_TTL } = await service();
    const last = { priceCents: 100, updatedAt: now, observedAt: now };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('offline'));
    expect(await fetchBitcoinQuote(last, fetcher, now + 100)).toEqual(last);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      fetchBitcoinQuote(last, fetcher, now + QUOTE_TTL),
    ).rejects.toThrow('offline');
    await expect(
      fetchBitcoinQuote(last, fetcher, now + QUOTE_TTL + 1),
    ).rejects.toThrow('60 minutos');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(last.priceCents).toBe(100);
  });
  it.each([
    response({}, false),
    response({ bitcoin: { brl: 'x', last_updated_at: now / 1000 } }),
    response({ bitcoin: { brl: 10, last_updated_at: (now + 120000) / 1000 } }),
  ])('rejeita HTTP inválido e valores inválidos', async (result) => {
    const { fetchBitcoinQuote } = await service();
    await expect(
      fetchBitcoinQuote(
        undefined,
        vi.fn<typeof fetch>().mockResolvedValue(result),
        now,
      ),
    ).rejects.toThrow();
  });
});
