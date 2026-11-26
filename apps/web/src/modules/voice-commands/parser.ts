import { displayDate } from '../../shared/dates/calendar';
import { formatCurrency } from '../finances/monetary';
import {
  bareNumberAt,
  findDates,
  findHours,
  findMoney,
  findPages,
  type Span,
} from './patterns';
import { normalize, tokenize, type Token } from './text';
import type {
  ParseContext,
  ParseResult,
  VoiceDraft,
  VoiceField,
  VoiceIntent,
} from './types';

/**
 * Interpretador determinístico de comandos falados ou digitados. Não usa IA:
 * reconhece apenas os formatos documentados em `README.md` e nunca completa
 * dados importantes sem base na frase. O resultado é um rascunho para revisão.
 */

const expenseVerbs = new Set([
  'gastei',
  'gastamos',
  'gasto',
  'comprei',
  'compramos',
  'paguei',
  'pagamos',
  'despesa',
]);
const incomeVerbs = new Set([
  'recebi',
  'recebemos',
  'ganhei',
  'ganhamos',
  'entrou',
  'entraram',
  'receita',
  'vendi',
  'faturei',
]);
/** “Ganhei” só é financeiro com contexto de dinheiro. */
const moneyContext = new Set([
  'dinheiro',
  'salario',
  'pix',
  'pagamento',
  'renda',
  'freela',
  'real',
  'reais',
  'r$',
]);
const sleepWords = new Set(['dormi', 'dormimos', 'cochilei', 'sono', 'soneca']);
const readingVerbs = new Set([
  'li',
  'lemos',
  'leitura',
  'lido',
  'lidas',
  'lidos',
]);
const workoutVerbs = new Set(['treinei', 'treinamos', 'malhei', 'malhamos']);
const workoutObjects = new Set([
  'musculacao',
  'treino',
  'academia',
  'exercicio',
  'exercicios',
  'malhacao',
]);
/** Palavras que não fazem parte de uma descrição. */
const fillers = new Set([
  'eu',
  'nos',
  'registra',
  'registrar',
  'registre',
  'anota',
  'anotar',
  'anote',
  'lanca',
  'lancar',
  'hoje',
  'ontem',
  'anteontem',
  'uma',
  'nova',
  'novo',
]);
const connectors = new Set([
  'com',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'por',
  'pra',
  'para',
  'pelo',
  'pela',
  'um',
  'uma',
  'uns',
  'umas',
  'o',
  'a',
  'os',
  'as',
  'e',
  'cada',
  'que',
  'meu',
  'minha',
  'referente',
]);

/** Palavra-chave → nomes de categoria possíveis (só os já existentes valem). */
const categoryHints: { words: string[]; names: string[] }[] = [
  {
    words: [
      'chocolate',
      'lanche',
      'mercado',
      'supermercado',
      'restaurante',
      'almoco',
      'jantar',
      'cafe',
      'comida',
      'padaria',
      'pizza',
      'ifood',
      'acougue',
      'feira',
      'hamburguer',
      'sorvete',
    ],
    names: ['Alimentação', 'Mercado', 'Comida'],
  },
  {
    words: [
      'uber',
      'onibus',
      'gasolina',
      'combustivel',
      'taxi',
      'metro',
      'estacionamento',
    ],
    names: ['Transporte'],
  },
  {
    words: [
      'internet',
      'luz',
      'agua',
      'aluguel',
      'condominio',
      'energia',
      'gas',
    ],
    names: ['Moradia', 'Contas', 'Casa'],
  },
  {
    words: ['farmacia', 'remedio', 'medico', 'consulta', 'dentista', 'exame'],
    names: ['Saúde'],
  },
  { words: ['cinema', 'show', 'bar', 'festa'], names: ['Lazer'] },
  {
    words: ['curso', 'faculdade', 'escola', 'livro', 'livros'],
    names: ['Educação'],
  },
  { words: ['academia'], names: ['Academia', 'Saúde'] },
  { words: ['salario'], names: ['Salário'] },
  {
    words: ['freela', 'servico', 'bico', 'trabalho'],
    names: ['Trabalho extra', 'Freela', 'Serviços'],
  },
];

const pillarLabels: Record<string, string> = {
  finance: 'Finanças',
  sleep: 'Descanso',
  reading: 'Conhecimento',
  workout: 'Treinos',
};

function has(tokens: readonly Token[], words: ReadonlySet<string>) {
  return tokens.findIndex((token) => words.has(token.norm));
}

function overlaps(span: Span, index: number) {
  return index >= span.start && index < span.end;
}

/** Texto dos tokens restantes, sem conectores nas bordas. */
function phrase(tokens: readonly Token[], keep: (index: number) => boolean) {
  const words = tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token, index }) => keep(index) && !fillers.has(token.norm));
  while (words.length && connectors.has(words[0]!.token.norm)) words.shift();
  while (words.length && connectors.has(words.at(-1)!.token.norm)) words.pop();
  const text = words.map(({ token }) => token.raw).join(' ');
  return text ? text[0]!.toLocaleUpperCase('pt-BR') + text.slice(1) : '';
}

const same = (a: string, b: string) =>
  normalize(a).trim() === normalize(b).trim();

function inferCategory(
  tokens: readonly Token[],
  available: readonly string[],
): string | undefined {
  const words = new Set(tokens.map((token) => token.norm));
  const matches = new Set<string>();
  for (const hint of categoryHints)
    if (hint.words.some((word) => words.has(word)))
      for (const name of hint.names) {
        const existing = available.find((item) => same(item, name));
        if (existing) matches.add(existing);
      }
  // Só com segurança: exatamente uma categoria existente compatível.
  return matches.size === 1 ? [...matches][0] : undefined;
}

export function parseVoiceCommand(
  text: string,
  context: ParseContext,
): ParseResult {
  const result: ParseResult = {
    text,
    draft: null,
    missing: [],
    ambiguities: [],
    errors: [],
    notes: [],
  };
  const tokens = tokenize(text);
  if (!tokens.length) {
    result.errors.push('Não consegui identificar a ação.');
    return result;
  }
  const money = findMoney(tokens);
  const tagged = money.filter((item) => item.tagged);
  const hours = findHours(tokens);
  const pages = findPages(tokens);
  const dates = findDates(tokens, context.today);

  // Intenções por pilar, com regras de prioridade explícitas.
  const expenseAt = has(tokens, expenseVerbs);
  const incomeAt = has(tokens, incomeVerbs);
  const moneyWords = has(tokens, moneyContext) !== -1;
  const financeVerb = expenseAt !== -1 || incomeAt !== -1;
  const incomeOnlyGanhei =
    incomeAt !== -1 &&
    expenseAt === -1 &&
    /^ganh/.test(tokens[incomeAt]!.norm) &&
    !tagged.length &&
    !moneyWords;
  const finance =
    (financeVerb &&
      !incomeOnlyGanhei &&
      (tagged.length > 0 ||
        moneyWords ||
        expenseAt !== -1 ||
        incomeAt !== -1)) ||
    (!financeVerb && tagged.length > 0);
  const sleep = has(tokens, sleepWords) !== -1;
  const reading = has(tokens, readingVerbs) !== -1 || pages.length > 0;
  const workout =
    has(tokens, workoutVerbs) !== -1 ||
    (tokens.some((token) => /^(fiz|fui|treino)$/.test(token.norm)) &&
      has(tokens, workoutObjects) !== -1 &&
      !financeVerb);
  // “Comprei um livro”: livro sem verbo de leitura nem páginas não é leitura.
  const pillars = [
    finance && 'finance',
    sleep && 'sleep',
    reading &&
      !(finance && !pages.length && has(tokens, readingVerbs) === -1) &&
      'reading',
    workout && !finance && 'workout',
  ].filter((item): item is string => Boolean(item));
  // Valor em dinheiro com sono/leitura/treino explícito: duas ações.
  if (pillars.length > 1) {
    result.ambiguities.push(
      `A frase parece ter mais de uma ação (${pillars.map((pillar) => pillarLabels[pillar]).join(' e ')}). Fale uma ação por vez.`,
    );
    return result;
  }
  if (!pillars.length) {
    result.errors.push('Não consegui identificar a ação.');
    return result;
  }

  // Data: uma só; futura é recusada; ausente = hoje.
  const distinct = [...new Set(dates.map((item) => item.date))];
  if (distinct.length > 1)
    result.ambiguities.push('A frase tem mais de uma data. Confirme a data.');
  const date = distinct[0] ?? context.today;
  if (date > context.today)
    result.errors.push(`A data ${displayDate(date)} está no futuro.`);
  const used = (index: number) => dates.some((item) => overlaps(item, index));
  const pillar = pillars[0]!;
  const base = { date, dateSpoken: distinct.length > 0 };
  const missing = (field: VoiceField) => result.missing.push(field);

  if (pillar === 'finance') {
    const type: VoiceIntent =
      expenseAt !== -1 && (incomeAt === -1 || expenseAt < incomeAt)
        ? 'finance.expense'
        : incomeAt !== -1
          ? 'finance.income'
          : 'finance.expense';
    const draft: VoiceDraft = { type, ...base };
    const verbAt = type === 'finance.expense' ? expenseAt : incomeAt;
    let amountSpan: Span | undefined;
    if (tagged.length > 1) {
      const values = [...new Set(tagged.map((item) => item.cents))];
      if (values.length > 1)
        result.ambiguities.push(
          `A frase tem mais de um valor (${values.map((cents) => formatCurrency(cents)).join(', ')}). Informe o valor correto.`,
        );
      else amountSpan = tagged[0];
    } else if (tagged.length === 1) amountSpan = tagged[0];
    else if (verbAt !== -1) {
      const bare = bareNumberAt(tokens, verbAt + 1);
      if (bare) amountSpan = { start: bare.start, end: bare.end };
    }
    const amount =
      amountSpan &&
      (tagged.find((item) => item.start === amountSpan!.start)?.cents ??
        bareNumberAt(tokens, amountSpan.start)?.cents);
    if (amount !== undefined && amountSpan) {
      draft.amountCents = amount;
      // “três chocolates por dez reais cada”: total só com padrão claro.
      const after = tokens[amountSpan.end]?.norm;
      if (after === 'cada') {
        const quantity = tokens
          .slice(verbAt + 1, amountSpan.start)
          .map((_, offset) => verbAt + 1 + offset)
          .map((index) => ({ index, value: bareQuantity(tokens, index) }))
          .find((item) => item.value !== null);
        if (quantity?.value && quantity.value > 1) {
          draft.amountCents = amount * quantity.value;
          draft.amountDetail = `${quantity.value} × ${formatCurrency(amount)}`;
        } else {
          delete draft.amountCents;
          result.ambiguities.push(
            'O valor parece ser por unidade. Informe o valor total.',
          );
        }
      }
    }
    if (draft.amountCents === undefined && !result.ambiguities.length)
      missing('amount');
    const description = phrase(
      tokens,
      (index) =>
        index !== verbAt &&
        !(amountSpan && overlaps(amountSpan, index)) &&
        !money.some((item) => item.tagged && overlaps(item, index)) &&
        !used(index) &&
        ![
          'reais',
          'real',
          'r$',
          'centavos',
          'dinheiro',
          'despesa',
          'receita',
        ].includes(tokens[index]!.norm),
    );
    if (description) draft.description = description;
    else missing('description');
    const available =
      type === 'finance.income'
        ? context.categories.income
        : context.categories.expense;
    const category = inferCategory(tokens, available);
    if (category) draft.category = category;
    else missing('category');
    result.draft = draft;
    return result;
  }

  if (pillar === 'sleep') {
    const draft: VoiceDraft = { type: 'rest.sleep', ...base };
    const values = [...new Set(hours.map((item) => item.hours))];
    if (values.length > 1)
      result.ambiguities.push(
        'A frase tem mais de uma duração. Informe as horas dormidas.',
      );
    else if (values.length === 1) {
      const value = values[0]!;
      if (value <= 0 || value > 24)
        result.errors.push('As horas dormidas devem estar entre 0 e 24.');
      else draft.hours = value;
    } else missing('hours');
    const existing = context.sleep.find((item) => item.date === date);
    if (existing)
      result.notes.push(
        `Já existe registro de ${String(existing.hours).replace('.', ',')} h em ${displayDate(date)}. Confirmar substitui as horas desse dia.`,
      );
    result.draft = draft;
    return result;
  }

  if (pillar === 'reading') {
    const draft: VoiceDraft = { type: 'knowledge.reading', ...base };
    if (pages.length > 1 && new Set(pages.map((item) => item.pages)).size > 1)
      result.ambiguities.push('A frase tem mais de uma quantidade de páginas.');
    else if (pages.length) {
      const value = pages[0]!.pages;
      if (!Number.isInteger(value) || value <= 0)
        result.errors.push('Informe uma quantidade de páginas maior que zero.');
      else draft.pages = value;
    } else missing('pages');
    if (!context.books.length) {
      result.errors.push(
        'Nenhum livro cadastrado. Cadastre um livro antes de registrar leituras.',
      );
      result.draft = draft;
      return result;
    }
    // Título: o que vem depois das páginas (“de”, “do livro”, “no livro”).
    const after = pages[0] ? pages[0].end : 0;
    // “no livro Meditações”: “livro” só é marcador quando vem antes do título.
    const titleText = phrase(
      tokens,
      (index) =>
        index >= after &&
        !used(index) &&
        !['pagina', 'paginas'].includes(tokens[index]!.norm),
    ).replace(/^livro\s+(?=\S)/i, '');
    const spoken = normalize(titleText);
    const exact = context.books.filter(
      (book) => normalize(book.title) === spoken,
    );
    const partial = exact.length
      ? exact
      : context.books.filter((book) => {
          const title = normalize(book.title);
          return spoken && (title.includes(spoken) || spoken.includes(title));
        });
    const active = context.books.filter((book) => !book.completed);
    // “do livro” sozinho, sem livro correspondente, não é título.
    if (titleText && !(spoken === 'livro' && !partial.length)) {
      if (partial.length === 1) draft.bookId = partial[0]!.id;
      else {
        draft.bookSpoken = titleText;
        draft.bookCandidates = (partial.length ? partial : active).map(
          (book) => book.id,
        );
        result.ambiguities.push(
          partial.length
            ? `Mais de um livro corresponde a “${titleText}”. Escolha o livro.`
            : `Nenhum livro cadastrado corresponde a “${titleText}”. Escolha o livro.`,
        );
      }
    } else if (active.length === 1) draft.bookId = active[0]!.id;
    else {
      draft.bookCandidates = active.map((book) => book.id);
      missing('book');
    }
    const book = context.books.find((item) => item.id === draft.bookId);
    if (book && draft.pages !== undefined && draft.pages > book.remaining)
      result.errors.push(
        `A leitura ultrapassa o total de páginas do livro (restam ${book.remaining}).`,
      );
    result.draft = draft;
    return result;
  }

  // Treino simples: só marca o dia, sem sessão avançada.
  const draft: VoiceDraft = { type: 'workout.simple', ...base };
  const day = context.workouts.find((item) => item.date === date);
  if (day?.trained)
    result.errors.push(`O treino de ${displayDate(date)} já está registrado.`);
  else if (day)
    result.notes.push(
      `${displayDate(date)} está marcado como dia sem treino. Confirmar altera para treinou.`,
    );
  if (context.completedSessionDates.includes(date) && !day?.trained)
    result.notes.push(
      'Há uma sessão avançada concluída nesta data. O dia é contado uma única vez.',
    );
  result.draft = draft;
  return result;
}

/** Quantidade inteira seguida de um substantivo (“três chocolates”). */
function bareQuantity(tokens: readonly Token[], index: number) {
  const token = tokens[index];
  if (!token) return null;
  const value = /^\d+$/.test(token.norm)
    ? Number(token.norm)
    : (
        {
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
        } as Record<string, number>
      )[token.norm];
  const next = tokens[index + 1]?.norm;
  return value && next && !connectors.has(next) ? value : null;
}
