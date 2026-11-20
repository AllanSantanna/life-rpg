/** Horário civil de 24 horas, sem segundos nem fuso: "HH:mm". */
export const isTimeValue = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const hours = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, '0'),
);
export const minutes = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, '0'),
);

/** Máscara de digitação: só dígitos e ":"; sem ":" digitado, insere após a hora. */
export function maskTimeText(text: string) {
  const clean = text.replace(/[^\d:]/g, '');
  const colon = clean.indexOf(':');
  if (colon >= 0) {
    const digitsOf = (part: string) => part.replace(/:/g, '').slice(0, 2);
    return `${digitsOf(clean.slice(0, colon))}:${digitsOf(clean.slice(colon + 1))}`;
  }
  const digits = clean.slice(0, 4);
  return digits.length > 2
    ? `${digits.slice(0, 2)}:${digits.slice(2)}`
    : digits;
}

/** Interpreta "15:30", "1530", "9:05" ou "905"; retorna null se inválido. */
export function parseTimeText(text: string): string | null {
  const trimmed = text.trim();
  const match =
    /^(\d{1,2}):(\d{2})$/.exec(trimmed) ?? /^(\d{1,2})(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const value = `${match[1]!.padStart(2, '0')}:${match[2]}`;
  return isTimeValue(value) ? value : null;
}

export function currentTime(now = new Date()) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
