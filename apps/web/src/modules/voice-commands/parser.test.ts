import { describe, expect, it } from 'vitest';
import { completeCommand, recordCommandFor } from './commands';
import { parseVoiceCommand } from './parser';
import { findHours, findMoney } from './patterns';
import { readNumber, tokenize } from './text';
import type { ParseContext } from './types';

/** Interpretador de comandos. Dados sintéticos; hoje é 13/11/2026. */
const today = '2026-11-13';
const context = (overrides: Partial<ParseContext> = {}): ParseContext => ({
  today,
  books: [
    { id: 'med', title: 'Meditações', remaining: 280, completed: false },
    {
      id: 'leis',
      title: 'As 48 Leis do Poder',
      remaining: 500,
      completed: false,
    },
    { id: 'fim', title: 'Livro concluído', remaining: 0, completed: true },
  ],
  categories: {
    expense: ['Alimentação', 'Moradia', 'Transporte', 'Geral'],
    income: ['Salário', 'Trabalho extra', 'Geral'],
  },
  sleep: [],
  workouts: [],
  completedSessionDates: [],
  ...overrides,
});
const parse = (text: string, overrides?: Partial<ParseContext>) =>
  parseVoiceCommand(text, context(overrides));

describe('números e valores', () => {
  it.each([
    ['dez', 10],
    ['vinte e cinco', 25],
    ['cento e vinte e três', 123],
    ['três mil', 3000],
    ['mil e quinhentos', 1500],
    ['dois mil trezentos', 2300],
    ['duzentos', 200],
    ['10', 10],
  ])('“%s” = %i', (text, value) => {
    expect(readNumber(tokenize(text), 0)?.value).toBe(value);
  });

  it('“dez e cinquenta” não soma partes de mesma ordem', () => {
    expect(readNumber(tokenize('dez e cinquenta'), 0)?.value).toBe(10);
  });

  it.each([
    ['dez reais', 1000],
    ['10 reais', 1000],
    ['R$ 10', 1000],
    ['R$10', 1000],
    ['dez reais e cinquenta centavos', 1050],
    ['10 e 50', 1050],
    ['10,50 reais', 1050],
    ['R$ 1.234,56', 123456],
    ['cinquenta centavos', 50],
    ['três mil reais', 300000],
  ])('valor “%s” = %i centavos', (text, cents) => {
    const tagged = findMoney(tokenize(text)).filter((item) => item.tagged);
    expect(tagged.map((item) => item.cents)).toEqual([cents]);
  });

  it.each([
    ['sete horas', 7],
    ['sete horas e meia', 7.5],
    ['seis horas e trinta minutos', 6.5],
    ['sete horas e quinze minutos', 7.25],
    ['7,5 horas', 7.5],
    ['7h30', 7.5],
  ])('horas “%s” = %f', (text, hours) => {
    expect(findHours(tokenize(text)).map((item) => item.hours)).toEqual([
      hours,
    ]);
  });
});

describe('Finanças', () => {
  it.each([
    ['Gastei dez reais com chocolate.', 1000, 'Chocolate', 'Alimentação'],
    ['Comprei um chocolate por dez reais.', 1000, 'Chocolate', 'Alimentação'],
    ['Paguei cinquenta reais de internet.', 5000, 'Internet', 'Moradia'],
    ['Gastei vinte e cinco reais no mercado.', 2500, 'Mercado', 'Alimentação'],
    [
      'Comprei um lanche por quinze reais e cinquenta centavos.',
      1550,
      'Lanche',
      'Alimentação',
    ],
    ['gastei 10 com chocolate', 1000, 'Chocolate', 'Alimentação'],
    ['Gastei R$ 32,90 de uber', 3290, 'Uber', 'Transporte'],
    ['gastei 10 e 50 na padaria', 1050, 'Padaria', 'Alimentação'],
    ['Comprei um livro por cinquenta reais.', 5000, 'Livro', undefined],
  ])('despesa: “%s”', (text, cents, description, category) => {
    const result = parse(text);
    expect(result.draft).toMatchObject({
      type: 'finance.expense',
      amountCents: cents,
      description,
      date: today,
      dateSpoken: false,
    });
    expect(result.draft?.category).toBe(category);
    expect(result.errors).toEqual([]);
  });

  it.each([
    ['Recebi duzentos reais.', 20000, undefined, undefined],
    ['Ganhei cinquenta reais.', 5000, undefined, undefined],
    ['Recebi três mil reais de salário.', 300000, 'Salário', 'Salário'],
    ['Entraram cem reais de um serviço.', 10000, 'Serviço', 'Trabalho extra'],
    ['recebi 200 do freela', 20000, 'Freela', 'Trabalho extra'],
  ])('receita: “%s”', (text, cents, description, category) => {
    const result = parse(text);
    expect(result.draft).toMatchObject({
      type: 'finance.income',
      amountCents: cents,
    });
    expect(result.draft?.description).toBe(description);
    expect(result.draft?.category).toBe(category);
  });

  it('sem valor: pede o valor, não inventa', () => {
    const result = parse('Gastei dinheiro no mercado.');
    expect(result.draft?.type).toBe('finance.expense');
    expect(result.draft?.amountCents).toBeUndefined();
    expect(result.missing).toContain('amount');
    expect(completeCommand(result)).toBeNull();
  });

  it('dois valores diferentes: pede esclarecimento', () => {
    const result = parse('Gastei dez reais e depois vinte reais no mercado');
    expect(result.ambiguities[0]).toMatch(/mais de um valor/);
    expect(result.draft?.amountCents).toBeUndefined();
  });

  it('quantidade sem “cada” não multiplica o valor', () => {
    const result = parse('Comprei três chocolates por dez reais.');
    expect(result.draft).toMatchObject({
      amountCents: 1000,
      description: 'Três chocolates',
    });
    expect(result.draft?.amountDetail).toBeUndefined();
  });

  it('quantidade com “cada” mostra a conta para confirmação', () => {
    const result = parse('Comprei três chocolates por dez reais cada.');
    expect(result.draft).toMatchObject({
      amountCents: 3000,
      amountDetail: '3 × R$ 10,00',
      description: 'Três chocolates',
    });
  });

  it('“ganhei” fora de contexto financeiro não vira receita', () => {
    expect(parse('Ganhei um livro de presente').draft).toBeNull();
    expect(parse('Ganhei a partida hoje').errors).toEqual([
      'Não consegui identificar a ação.',
    ]);
  });

  it('categoria só é inferida se já existir', () => {
    const result = parse('Gastei dez reais com chocolate', {
      categories: { expense: ['Geral'], income: [] },
    });
    expect(result.draft?.category).toBeUndefined();
    expect(result.missing).toContain('category');
  });

  it('gera o comando existente de movimentação na carteira única', () => {
    const result = parse('Gastei dez reais com chocolate ontem');
    const command = completeCommand(result)!;
    expect(recordCommandFor(command, () => 'id-1')).toEqual({
      type: 'saveMovement',
      value: {
        id: 'id-1',
        kind: 'expense',
        description: 'Chocolate',
        amountCents: 1000,
        category: 'Alimentação',
        date: '2026-11-12',
      },
    });
  });
});

describe('Descanso', () => {
  it.each([
    ['Dormi sete horas.', 7, today],
    ['Dormi sete horas e meia.', 7.5, today],
    ['Hoje dormi oito horas.', 8, today],
    ['Ontem dormi seis horas e trinta minutos.', 6.5, '2026-11-12'],
    ['Registra sete horas e quinze minutos de sono.', 7.25, today],
    ['dormi 7h30 anteontem', 7.5, '2026-11-11'],
    ['DORMI 6 HORAS', 6, today],
  ])('“%s”', (text, hours, date) => {
    const result = parse(text);
    expect(result.draft).toMatchObject({ type: 'rest.sleep', hours, date });
    expect(completeCommand(result)).toEqual({
      type: 'rest.sleep',
      hours,
      date,
    });
  });

  it('registro existente na data: avisa, não duplica', () => {
    const result = parse('dormi oito horas', {
      sleep: [{ date: today, hours: 6 }],
    });
    expect(result.notes[0]).toMatch(/Já existe registro de 6 h/);
    expect(recordCommandFor(completeCommand(result)!, () => 'x')).toEqual({
      type: 'saveSleep',
      value: { date: today, hours: 8 },
    });
  });

  it('sem horas: pede as horas; acima de 24 é recusado', () => {
    expect(parse('dormi bem').missing).toEqual(['hours']);
    expect(parse('dormi 30 horas').errors[0]).toMatch(/entre 0 e 24/);
  });
});

describe('Conhecimento', () => {
  it.each([
    ['Li vinte páginas de Meditações.', 20, 'med'],
    ['Registra dez páginas no livro Meditações.', 10, 'med'],
    ['Li trinta páginas de As 48 Leis do Poder.', 30, 'leis'],
    ['li 12 paginas de meditacoes', 12, 'med'],
    ['Li quinze páginas de leis do poder', 15, 'leis'],
  ])('“%s”', (text, pages, bookId) => {
    expect(parse(text).draft).toMatchObject({
      type: 'knowledge.reading',
      pages,
      bookId,
    });
  });

  it('um único livro em andamento é escolhido sem título', () => {
    const result = parse('Hoje li quinze páginas.', {
      books: [
        { id: 'med', title: 'Meditações', remaining: 280, completed: false },
      ],
    });
    expect(result.draft?.bookId).toBe('med');
  });

  it('vários livros e nenhum título: pede o livro', () => {
    const result = parse('Li vinte páginas.');
    expect(result.draft?.bookId).toBeUndefined();
    expect(result.missing).toEqual(['book']);
    expect(result.draft?.bookCandidates).toEqual(['med', 'leis']);
  });

  it('título ambíguo não é escolhido ao acaso', () => {
    const result = parse('Li dez páginas do livro', {
      books: [
        { id: 'a', title: 'O Livro A', remaining: 100, completed: false },
        { id: 'b', title: 'O Livro B', remaining: 100, completed: false },
      ],
    });
    expect(result.draft?.bookId).toBeUndefined();
    const named = parse('Li dez páginas de O Livro', {
      books: [
        { id: 'a', title: 'O Livro A', remaining: 100, completed: false },
        { id: 'b', title: 'O Livro B', remaining: 100, completed: false },
      ],
    });
    expect(named.draft?.bookId).toBeUndefined();
    expect(named.ambiguities[0]).toMatch(/Mais de um livro/);
    expect(named.draft?.bookCandidates).toEqual(['a', 'b']);
  });

  it('sem livros cadastrados: informa e não confirma', () => {
    const result = parse('Li vinte páginas', { books: [] });
    expect(result.errors[0]).toMatch(/Nenhum livro cadastrado/);
    expect(completeCommand(result)).toBeNull();
  });

  it('acima do total do livro é recusado', () => {
    expect(parse('li 281 paginas de meditações').errors[0]).toMatch(
      /restam 280/,
    );
  });
});

describe('Treinos', () => {
  it.each([
    ['Treinei hoje.', today],
    ['Fiz musculação hoje.', today],
    ['Hoje eu treinei.', today],
    ['Treinei ontem.', '2026-11-12'],
    ['malhei dia 10', '2026-11-10'],
    ['treinei 05/11', '2026-11-05'],
    ['treinei em 3 de novembro', '2026-11-03'],
  ])('“%s”', (text, date) => {
    const result = parse(text);
    expect(result.draft).toMatchObject({ type: 'workout.simple', date });
    expect(recordCommandFor(completeCommand(result)!, () => 'x')).toEqual({
      type: 'saveWorkout',
      value: { date, trained: true },
    });
  });

  it('treino já registrado: informa e não confirma', () => {
    const result = parse('treinei hoje', {
      workouts: [{ date: today, trained: true }],
    });
    expect(result.errors[0]).toMatch(/já está registrado/);
    expect(completeCommand(result)).toBeNull();
  });

  it('sessão avançada concluída: avisa que o dia conta uma vez', () => {
    const result = parse('treinei hoje', { completedSessionDates: [today] });
    expect(result.notes[0]).toMatch(/contado uma única vez/);
  });

  it('data futura é recusada', () => {
    expect(parse('treinei dia 20').errors[0]).toMatch(/futuro/);
  });
});

describe('prioridade, variações e frases desconhecidas', () => {
  it('“Comprei um livro” é despesa, não leitura', () => {
    expect(parse('Comprei um livro por cinquenta reais').draft?.type).toBe(
      'finance.expense',
    );
  });

  it('“Paguei a academia” é despesa, não treino', () => {
    expect(parse('paguei 90 reais da academia').draft?.type).toBe(
      'finance.expense',
    );
  });

  it('duas ações na mesma frase pedem uma por vez', () => {
    const result = parse('Dormi sete horas e li vinte páginas');
    expect(result.draft).toBeNull();
    expect(result.ambiguities[0]).toMatch(/mais de uma ação/);
  });

  it.each(['Qual é a previsão do tempo?', 'abrir configurações', '', 'olá'])(
    'desconhecida: “%s”',
    (text) => {
      const result = parse(text);
      expect(result.draft).toBeNull();
      expect(result.errors).toEqual(['Não consegui identificar a ação.']);
    },
  );

  it('acentos e maiúsculas não mudam o resultado', () => {
    const withAccents = parse('Li vinte páginas de Meditações');
    const without = parse('LI VINTE PAGINAS DE MEDITACOES');
    expect(without.draft).toEqual(withAccents.draft);
  });

  it('preserva o texto original', () => {
    expect(parse('Gastei R$ 10 com café!').text).toBe('Gastei R$ 10 com café!');
  });
});
