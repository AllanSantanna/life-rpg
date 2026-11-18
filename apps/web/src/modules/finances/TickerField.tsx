import { useState } from 'react';
import { Field } from '../records/RecordUI';
import { marketClient, type TickerMatch } from './marketQuote';
import { normalizeTicker, TICKER_PATTERN } from './types';

/**
 * Código B3 do investimento. A verificação consulta a fonte pelo apps/api; ela
 * é opcional e nunca associa um ativo apenas pela semelhança do nome.
 */
export function TickerField({
  defaultValue = '',
  search = marketClient.search,
}: {
  defaultValue?: string | undefined;
  search?: (term: string) => Promise<TickerMatch[]>;
}) {
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function verify() {
    const ticker = normalizeTicker(value);
    if (!TICKER_PATTERN.test(ticker)) {
      setStatus('Formato inválido. Use o código da B3, como VALE3 ou HGLG11.');
      return;
    }
    setBusy(true);
    setStatus('Verificando ticker…');
    try {
      const exact = (await search(ticker)).find(
        (item) => item.ticker === ticker,
      );
      setStatus(
        exact
          ? `${exact.ticker} · ${exact.name} (${exact.type === 'fund' ? 'fundo' : 'ação'}).`
          : `${ticker} não foi encontrado na fonte. Confira o código antes de salvar.`,
      );
    } catch {
      setStatus(
        'Não foi possível verificar agora. O ticker pode ser salvo e será consultado depois.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ticker-field">
      <Field label="Ticker B3 (opcional)">
        <input
          name="ticker"
          value={value}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="VALE3"
          onChange={(event) => {
            setValue(normalizeTicker(event.target.value));
            setStatus('');
          }}
        />
      </Field>
      <button
        type="button"
        className="text-action"
        disabled={busy || !value}
        onClick={() => void verify()}
      >
        Verificar ticker
      </button>
      <p className="record-hint" role="status">
        {status ||
          'O ticker liga o investimento à cotação. Quantidade, custo e operações permanecem os registrados.'}
      </p>
    </div>
  );
}
