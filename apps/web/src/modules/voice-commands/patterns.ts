import { isDate, shiftDate } from '../../shared/dates/calendar';
import {
  decimalText,
  decimalToCents,
  readNumber,
  type NumberMatch,
  type Token,
} from './text';

/** Trecho reconhecido da frase (índices de tokens, fim exclusivo). */
export interface Span {
  start: number;
  end: number;
}

export interface MoneyMatch extends Span {
  cents: number;
  /** Tem marca de moeda (R$, reais, centavos); números soltos não têm. */
  tagged: boolean;
}

const currencyUnits = new Set(['real', 'reais', 'conto', 'contos', 'pila']);
const centUnits = new Set(['centavo', 'centavos']);

/**
 * Valores monetários: “dez reais”, “10 reais”, “R$ 10”, “dez reais e cinquenta
 * centavos”, “10 e 50”, “10,50”, “cinquenta centavos”, “três mil reais”.
 */
export function findMoney(tokens: readonly Token[]): MoneyMatch[] {
  const found: MoneyMatch[] = [];
  let index = 0;
  while (index < tokens.length) {
    const currency = tokens[index]!.norm === 'r$';
    const number = readNumber(tokens, currency ? index + 1 : index);
    if (!number) {
      index += 1;
      continue;
    }
    let end = number.end;
    let tagged = currency;
    let cents = decimalToCents(number.decimal);
    const unit = tokens[end]?.norm;
    if (unit && centUnits.has(unit) && !currency) {
      // “cinquenta centavos”
      if (number.value < 100 && Number.isInteger(number.value))
        found.push({
          start: index,
          end: end + 1,
          cents: number.value,
          tagged: true,
        });
      index = end + 1;
      continue;
    }
    if (unit && currencyUnits.has(unit)) {
      tagged = true;
      end += 1;
    }
    // Centavos depois de “e”: “dez reais e cinquenta (centavos)”, “10 e 50”.
    if (tokens[end]?.norm === 'e' && cents !== null && cents % 100 === 0) {
      const fraction = readNumber(tokens, end + 1);
      const after = fraction ? tokens[fraction.end]?.norm : undefined;
      const centWord = after !== undefined && centUnits.has(after);
      const digitsPair =
        number.digits &&
        fraction?.digits &&
        /^\d{2}$/.test(tokens[end + 1]!.norm);
      if (
        fraction &&
        Number.isInteger(fraction.value) &&
        fraction.value < 100 &&
        (centWord || (tagged && unit !== undefined) || digitsPair)
      ) {
        cents += fraction.value;
        end = fraction.end + (centWord ? 1 : 0);
        tagged = tagged || centWord || Boolean(digitsPair);
      }
    }
    if (cents !== null && cents > 0)
      found.push({ start: index, end, cents, tagged });
    index = end;
  }
  return found;
}

export interface HoursMatch extends Span {
  hours: number;
}

const hourUnits = new Set(['hora', 'horas', 'h', 'hr', 'hrs']);
const minuteUnits = new Set(['minuto', 'minutos', 'min']);

/**
 * Horas: “sete horas”, “sete horas e meia”, “seis horas e trinta minutos”,
 * “7,5 horas”, “7h30”, “7:30”, “7h”. Minutos de 0 a 59.
 */
export function findHours(tokens: readonly Token[]): HoursMatch[] {
  const found: HoursMatch[] = [];
  tokens.forEach((token, index) => {
    const compact = /^(\d{1,2})(?:h|:)(\d{2})?$/.exec(token.norm);
    if (compact) {
      const minutes = Number(compact[2] ?? 0);
      if (minutes < 60)
        found.push({
          start: index,
          end: index + 1,
          hours: round(Number(compact[1]) + minutes / 60),
        });
    }
  });
  for (let index = 0; index < tokens.length; index++) {
    const number = readNumber(tokens, index);
    if (!number) continue;
    const unit = tokens[number.end]?.norm;
    if (!unit || !hourUnits.has(unit)) continue;
    let end = number.end + 1;
    let hours = Number(number.decimal);
    if (tokens[end]?.norm === 'e') {
      if (tokens[end + 1]?.norm === 'meia') {
        hours += 0.5;
        end += 2;
      } else {
        const minutes = readNumber(tokens, end + 1);
        const minuteUnit = minutes ? tokens[minutes.end]?.norm : undefined;
        if (
          minutes &&
          minuteUnit &&
          minuteUnits.has(minuteUnit) &&
          Number.isInteger(minutes.value) &&
          minutes.value < 60
        ) {
          hours += minutes.value / 60;
          end = minutes.end + 1;
        }
      }
    }
    found.push({ start: index, end, hours: round(hours) });
    index = end - 1;
  }
  return found;
}

const round = (value: number) => Math.round(value * 100) / 100;

export interface PagesMatch extends Span {
  pages: number;
}

/** Páginas: “vinte páginas”, “20 páginas”, “15 pág”. */
export function findPages(tokens: readonly Token[]): PagesMatch[] {
  const found: PagesMatch[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const number = readNumber(tokens, index);
    if (!number) continue;
    const unit = tokens[number.end]?.norm;
    if (unit && /^(pagina|paginas|pag|pags|pg|pgs)$/.test(unit)) {
      found.push({ start: index, end: number.end + 1, pages: number.value });
      index = number.end;
    }
  }
  return found;
}

const months: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

export interface DateMatch extends Span {
  date: string;
}

const iso = (year: number, month: number, day: number) =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/**
 * Datas: “hoje”, “ontem”, “anteontem”, “12/11”, “12/11/2026”, “dia 12”,
 * “12 de novembro” (ano atual quando omitido). Datas inválidas são ignoradas.
 */
export function findDates(
  tokens: readonly Token[],
  today: string,
): DateMatch[] {
  const found: DateMatch[] = [];
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  for (let index = 0; index < tokens.length; index++) {
    const norm = tokens[index]!.norm;
    const relative =
      norm === 'hoje'
        ? 0
        : norm === 'ontem'
          ? -1
          : norm === 'anteontem'
            ? -2
            : null;
    if (relative !== null) {
      found.push({
        start: index,
        end: index + 1,
        date: shiftDate(today, relative),
      });
      continue;
    }
    const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(norm);
    if (slash) {
      const y = slash[3]
        ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3])
        : year;
      const date = iso(y, Number(slash[2]), Number(slash[1]));
      if (isDate(date)) found.push({ start: index, end: index + 1, date });
      continue;
    }
    // “dia 12 (de novembro)” ou “12 de novembro”.
    const lead = norm === 'dia' ? index + 1 : index;
    const day = readNumber(tokens, lead);
    if (!day || !Number.isInteger(day.value) || day.value < 1 || day.value > 31)
      continue;
    const named =
      tokens[day.end]?.norm === 'de'
        ? months[tokens[day.end + 1]?.norm ?? '']
        : undefined;
    if (named === undefined && norm !== 'dia') continue;
    let end = named === undefined ? day.end : day.end + 2;
    let y = year;
    if (named !== undefined && tokens[end]?.norm === 'de') {
      const spokenYear = readNumber(tokens, end + 1);
      if (spokenYear && spokenYear.value >= 1900) {
        y = spokenYear.value;
        end = spokenYear.end;
      }
    }
    const date = iso(y, named ?? month, day.value);
    if (isDate(date)) found.push({ start: index, end, date });
    index = end - 1;
  }
  return found;
}

/** Número logo após a posição (“gastei 10 com…”), sem marca de moeda. */
export function bareNumberAt(
  tokens: readonly Token[],
  index: number,
): (NumberMatch & { cents: number }) | null {
  const number = readNumber(tokens, index);
  if (!number) return null;
  const next = tokens[number.end]?.norm;
  // “gastei 3 chocolates”: número seguido de substantivo é quantidade.
  if (
    next &&
    !/^(com|no|na|nos|nas|em|de|do|da|pra|para|por|hoje|ontem|anteontem)$/.test(
      next,
    )
  )
    return null;
  const cents = decimalToCents(number.decimal);
  return cents && cents > 0 ? { ...number, cents } : null;
}

export { decimalText };
