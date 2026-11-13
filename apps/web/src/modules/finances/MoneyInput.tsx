import { useLayoutEffect, useRef, useState } from 'react';
import {
  decimalToUnits,
  formatCurrency,
  maskCents,
  unitsToDecimal,
} from './monetary';
export function MoneyInput({
  name,
  defaultValue = '',
  currency = 'BRL',
  allowNegative = false,
  required = false,
  placeholder,
  onValueChange,
}: {
  name: string;
  defaultValue?: string | undefined;
  currency?: 'BRL' | 'USD';
  allowNegative?: boolean;
  required?: boolean;
  placeholder?: string;
  onValueChange?: (cents: number | null) => void;
}) {
  const [cents, setCents] = useState<number | null>(() =>
    defaultValue ? decimalToUnits(defaultValue, 2) : null,
  );
  const [negative, setNegative] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const [revision, setRevision] = useState(0);
  const text =
    cents === null ? (negative ? '-' : '') : formatCurrency(cents, currency);
  useLayoutEffect(() => {
    if (caret.current === null || !input.current) return;
    const digitsRight = caret.current;
    let position = text.length;
    let count = 0;
    while (position > 0 && count < digitsRight) {
      position--;
      if (/\d/.test(text[position]!)) count++;
    }
    input.current.setSelectionRange(position, position);
    caret.current = null;
  }, [text, revision]);
  function update(raw: string, position: number) {
    const value = maskCents(raw, allowNegative);
    if (value === undefined) {
      setRevision((n) => n + 1);
      return;
    }
    caret.current = (raw.slice(position).match(/\d/g) ?? []).length;
    setNegative(allowNegative && raw.trim() === '-');
    setCents(value);
    setRevision((n) => n + 1);
    onValueChange?.(value);
  }
  return (
    <>
      <input
        ref={input}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        value={text}
        placeholder={
          placeholder ?? (currency === 'USD' ? 'US$ 0,00' : 'R$ 0,00')
        }
        onChange={(event) =>
          update(
            event.target.value,
            event.target.selectionStart ?? event.target.value.length,
          )
        }
        onKeyDown={(event) => {
          const element = event.currentTarget;
          const start = element.selectionStart ?? 0;
          if (
            element.selectionEnd !== start ||
            (event.key !== 'Backspace' && event.key !== 'Delete')
          )
            return;
          let target = event.key === 'Backspace' ? start - 1 : start;
          if (/\d/.test(text[target] ?? '')) return;
          while (
            target >= 0 &&
            target < text.length &&
            !/\d/.test(text[target]!)
          )
            target += event.key === 'Backspace' ? -1 : 1;
          if (target < 0 || target >= text.length) return;
          event.preventDefault();
          update(text.slice(0, target) + text.slice(target + 1), target);
        }}
      />
      <input
        type="hidden"
        name={name}
        value={cents === null ? '' : unitsToDecimal(cents, 2)}
      />
    </>
  );
}
