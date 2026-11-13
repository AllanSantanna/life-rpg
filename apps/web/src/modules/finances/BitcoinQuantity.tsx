import { useState } from 'react';
import { Field } from '../records/RecordUI';
import { decimalToUnits, unitsToDecimal } from './monetary';
export function BitcoinQuantity({
  quantity,
  onUnitsChange,
}: {
  quantity?: number | undefined;
  onUnitsChange?: (units: number) => void;
}) {
  const [unit, setUnit] = useState<'BTC' | 'sats'>('BTC');
  const [units, setUnits] = useState(() =>
    quantity === undefined ? 0 : Math.round(quantity * 1e8),
  );
  const [btc, setBtc] = useState(() =>
    quantity === undefined
      ? ''
      : unitsToDecimal(Math.round(quantity * 1e8), 8).replace('.', ','),
  );
  const [hasValue, setHasValue] = useState(quantity !== undefined);
  return (
    <>
      <Field label="Unidade de Bitcoin">
        <select
          value={unit}
          onChange={(event) => {
            setUnit(event.target.value as 'BTC' | 'sats');
            setBtc(hasValue ? unitsToDecimal(units, 8).replace('.', ',') : '');
          }}
        >
          <option value="BTC">Bitcoin (BTC)</option>
          <option value="sats">Satoshis (sats)</option>
        </select>
      </Field>
      <Field label={`Quantidade em ${unit}`}>
        <input
          inputMode={unit === 'BTC' ? 'decimal' : 'numeric'}
          value={
            unit === 'BTC' ? btc : hasValue ? units.toLocaleString('pt-BR') : ''
          }
          placeholder={unit === 'BTC' ? '0,001 BTC' : '100.000 sats'}
          onChange={(event) => {
            const raw = event.target.value;
            if (unit === 'BTC' && !/^\d*(?:[.,]\d{0,8})?$/.test(raw)) return;
            if (unit === 'sats' && !/^[\d.\s]*$/.test(raw)) return;
            let next = 0;
            try {
              next =
                unit === 'sats'
                  ? Number(raw.replace(/[.\s]/g, ''))
                  : raw && raw !== ',' && raw !== '.'
                    ? decimalToUnits(
                        (raw.startsWith(',') || raw.startsWith('.')
                          ? '0' + raw
                          : raw
                        ).replace(/[.,]$/, ''),
                        8,
                      )
                    : 0;
            } catch {
              return;
            }
            if (!Number.isSafeInteger(next) || next < 0) return;
            setHasValue(raw.length > 0);
            setUnits(next);
            if (unit === 'BTC') setBtc(raw);
            onUnitsChange?.(next);
          }}
        />
      </Field>
      <input
        type="hidden"
        name="quantity"
        value={hasValue ? unitsToDecimal(units, 8) : ''}
      />
      <p className="record-hint">
        {units.toLocaleString('pt-BR')} sats ={' '}
        {unitsToDecimal(units, 8).replace('.', ',')} BTC. A troca de unidade
        mantém a mesma quantidade.
      </p>
    </>
  );
}
