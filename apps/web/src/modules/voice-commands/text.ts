/**
 * Normalização, tokens e números em português do Brasil. Funções puras, sem
 * ponto flutuante para valores monetários.
 */

/** Minúsculas e sem acentos: “Página” → “pagina”. */
export function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface Token {
  /** Texto original (com acentos), sem pontuação nas bordas. */
  raw: string;
  /** Forma normalizada para comparação. */
  norm: string;
}

/**
 * Separa a frase em palavras. “R$10” vira “r$” e “10”; a pontuação das bordas
 * é removida, mas vírgula e ponto internos de números (“10,50”) e horários
 * (“7h30”, “7:30”) e datas (“12/11”) são mantidos.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const piece of text.replace(/[“”"«»()!?;]/g, ' ').split(/\s+/)) {
    let word = piece.replace(/^[.,:'’-]+|[.,:'’-]+$/g, '');
    if (!word) continue;
    const currency = /^r\$/i.exec(word);
    if (currency) {
      tokens.push({ raw: 'R$', norm: 'r$' });
      word = word.slice(2);
      if (!word) continue;
    }
    tokens.push({ raw: word, norm: normalize(word) });
  }
  return tokens;
}

const small: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezasseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  cincoenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  duzentas: 200,
  trezentos: 300,
  trezentas: 300,
  quatrocentos: 400,
  quatrocentas: 400,
  quinhentos: 500,
  quinhentas: 500,
  seiscentos: 600,
  seiscentas: 600,
  setecentos: 700,
  setecentas: 700,
  oitocentos: 800,
  oitocentas: 800,
  novecentos: 900,
  novecentas: 900,
};

export function isNumberWord(norm: string) {
  return norm in small || norm === 'mil';
}

/** Número a partir do token `start`: dígitos ou por extenso. */
export interface NumberMatch {
  /** Valor inteiro em unidades ou, para dígitos decimais, o texto exato. */
  value: number;
  /** Representação decimal exata (“10.5”), usada para centavos. */
  decimal: string;
  start: number;
  end: number;
  digits: boolean;
}

const digitPattern = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$|^\d+(?:[.,]\d+)?$/;

/** “10,50” → “10.50”; “1.000” → “1000”; “10.50” → “10.50”. */
export function decimalText(token: string): string | null {
  if (!digitPattern.test(token)) return null;
  if (/^\d{1,3}(?:\.\d{3})+/.test(token) && !/^\d+\.\d{1,2}$/.test(token))
    return token.replace(/\./g, '').replace(',', '.');
  return token.replace(',', '.');
}

/**
 * Lê um número. Por extenso, “e” só une partes de ordem menor (“vinte e
 * cinco”, “cento e vinte”, “mil e duzentos”); “dez e cinquenta” não vira 60.
 */
export function readNumber(
  tokens: readonly Token[],
  start: number,
): NumberMatch | null {
  const first = tokens[start];
  if (!first) return null;
  const digits = decimalText(first.norm);
  if (digits !== null) {
    let value = Number(digits);
    let end = start + 1;
    if (tokens[end]?.norm === 'mil' && !digits.includes('.')) {
      value *= 1000;
      end += 1;
    }
    return {
      value,
      decimal: value === Number(digits) ? digits : String(value),
      start,
      end,
      digits: true,
    };
  }
  if (!isNumberWord(first.norm)) return null;
  let total = 0;
  let group = 0;
  /** Menor ordem já usada no grupo atual (limita o próximo “e”). */
  let limit = Infinity;
  let index = start;
  let any = false;
  while (index < tokens.length) {
    const norm = tokens[index]!.norm;
    if (norm === 'mil') {
      total += (group || 1) * 1000;
      group = 0;
      limit = 1000;
      index += 1;
      any = true;
      // “mil e quinhentos”
      if (tokens[index]?.norm === 'e') {
        const next = tokens[index + 1]?.norm;
        if (next && next in small) index += 1;
        else break;
      }
      continue;
    }
    if (!(norm in small)) break;
    const value = small[norm]!;
    if (any && value >= limit) break;
    group += value;
    any = true;
    limit = value >= 100 ? 100 : value >= 20 ? 10 : 0;
    index += 1;
    // “e” só continua se o próximo for uma parte de ordem menor.
    if (tokens[index]?.norm === 'e') {
      const next = tokens[index + 1]?.norm;
      if (next && next in small && small[next]! < limit) {
        index += 1;
        continue;
      }
      break;
    }
    // “três mil”: o milhar multiplica o grupo lido.
    if (tokens[index]?.norm === 'mil' && total === 0) continue;
    // Sem “e”, só segue depois de milhar (“dois mil trezentos”).
    if (total === 0 || group >= 100 || limit === 0) break;
  }
  if (!any) return null;
  const value = total + group;
  return { value, decimal: String(value), start, end: index, digits: false };
}

/** Converte texto decimal exato em centavos inteiros (sem ponto flutuante). */
export function decimalToCents(decimal: string): number | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(decimal);
  if (!match) return null;
  const fraction = match[2] ?? '';
  if (fraction.length > 2) return null;
  const cents =
    BigInt(match[1]!) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}
