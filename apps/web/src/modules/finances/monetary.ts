/** Converte decimal canônico sem multiplicação em ponto flutuante. */
export function decimalToUnits(value: string, places: number): number {
  const normalized = value.trim().replace(',', '.');
  if (!new RegExp(`^-?\\d+(?:\\.\\d{1,${places}})?$`).test(normalized))
    throw new Error(`Informe um valor com até ${places} casas decimais.`);
  const negative = normalized.startsWith('-');
  const [whole, fraction = ''] = normalized.replace('-', '').split('.');
  const units =
    BigInt(whole!) * 10n ** BigInt(places) +
    BigInt(fraction.padEnd(places, '0'));
  const result = Number(negative ? -units : units);
  if (!Number.isSafeInteger(result))
    throw new Error('Valor excede a precisão suportada.');
  return result;
}
export function unitsToDecimal(units: number, places: number) {
  const digits = String(Math.abs(units)).padStart(places + 1, '0');
  return `${units < 0 ? '-' : ''}${digits.slice(0, -places)}.${digits.slice(-places)}`;
}
export function formatCurrency(cents: number, currency: 'BRL' | 'USD' = 'BRL') {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });
}
export function maskCents(
  raw: string,
  signed = false,
): number | null | undefined {
  const cleaned = raw.replace(/US\$|R\$|\$/g, '').replace(/\s/g, '');
  if (!cleaned || cleaned === '-') return null;
  if (!/^-?[\d.,]+$/.test(cleaned) || (!signed && cleaned.startsWith('-')))
    return undefined;
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return null;
  const result = Number(digits) * (cleaned.startsWith('-') ? -1 : 1);
  return Number.isSafeInteger(result) && Math.abs(result) <= 1e12
    ? result
    : undefined;
}
