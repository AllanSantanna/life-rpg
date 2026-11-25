import { describe, expect, it } from 'vitest';
import { exerciseCatalog } from '../catalog';
import { emptyAdvancedWorkouts } from '../types';
import { whatsappMessage } from './metadata';
import { parseWorkoutText } from './parser';

// Remetente fictício: os testes não usam nomes de pessoas reais.
const catalog = exerciseCatalog(emptyAdvancedWorkouts());
const parse = (text: string) => parseWorkoutText(text, catalog);
/** Estrutura comparável: nome de origem, exercício reconhecido e séries. */
const shape = (text: string) =>
  parse(text).exercises.map((e) => ({
    name: e.sourceName,
    id: e.exerciseId,
    sets: e.sets.map((s) => [s.kind, s.reps, s.weight, s.rir]),
  }));
const lines = (header: (time: string) => string, body: string[]) =>
  body.map((line, i) => `${header(`15:${15 + i}`)}${line}`).join('\n');
const workout = [
  'Cadeira extensora',
  '12 x 50 kg',
  '6 x 80 kg',
  '9 x 100 kg',
  'Leg press',
  '6 x 25 kg',
  '8 x 30 kg',
];
const plain =
  'Cadeira extensora\n12 x 50 kg\n6 x 80 kg\n9 x 100 kg\n\nLeg press\n6 x 25 kg\n8 x 30 kg';

describe('cabeçalhos do WhatsApp', () => {
  it('regressão: [hora, data] com o formato exato gera um exercício com três séries', () => {
    const text = [
      '[15:15, 25/11/2026] Fulano de Tal: Agachamento',
      '[15:15, 25/11/2026] Fulano de Tal: 12 x 50 kg',
      '[15:15, 25/11/2026] Fulano de Tal: 6 x 80 kg',
      '[15:15, 25/11/2026] Fulano de Tal: 9 x 100 kg',
    ].join('\n');
    const result = parse(text);
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0]!.sourceName).toBe('Agachamento');
    expect(result.exercises[0]!.sets.map((s) => [s.reps, s.weight])).toEqual([
      [12, 50],
      [6, 80],
      [9, 100],
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.metadata?.dates).toEqual(['2026-11-25']);
    // O texto original da importação é preservado.
    expect(result.originalText).toBe(text);
  });

  it('os quatro formatos produzem a mesma estrutura de exercícios e séries', () => {
    const expected = shape(plain);
    expect(expected.map((e) => [e.name, e.id, e.sets.length])).toEqual([
      ['Cadeira extensora', 'extension', 3],
      ['Leg press', 'legpress', 2],
    ]);
    // A: horário antes da data; B: data antes do horário; C: exportação com hífen.
    for (const header of [
      (t: string) => `[${t}, 25/11/2026] Fulano de Tal: `,
      (t: string) => `[25/11/2026, ${t}] Fulano de Tal: `,
      (t: string) => `25/11/2026, ${t} - Fulano de Tal: `,
      (t: string) => `[25/11/2026 ${t}:07] Fulano de Tal: `,
    ]) {
      const text = lines(header, workout);
      expect(shape(text)).toEqual(expected);
      expect(parse(text).warnings).toEqual([]);
      expect(parse(text).metadata?.dates).toEqual(['2026-11-25']);
    }
  });

  it('remetentes compostos, horários diferentes e acentos não viram exercícios', () => {
    const text = [
      '[06:05, 25/11/2026] Maria José da Silva Souza: Elevação lateral',
      '[06:09, 25/11/2026] Maria José da Silva Souza: 12,5kg x 12',
      '[06:14, 25/11/2026] Maria José da Silva Souza: 12,5kg x 10',
      '[07:01, 25/11/2026] Maria José da Silva Souza: Tríceps na polia',
      '[07:03, 25/11/2026] Maria José da Silva Souza: 25 x 12',
    ].join('\n');
    const result = shape(text);
    expect(result.map((e) => e.name)).toEqual([
      'Elevação lateral',
      'Tríceps na polia',
    ]);
    expect(result.map((e) => e.id)).toEqual(['raise', 'triceps']);
    expect(result[0]!.sets.map((s) => [s[1], s[2]])).toEqual([
      [12, 12.5],
      [10, 12.5],
    ]);
    for (const e of result) {
      expect(e.name).not.toMatch(/\d{1,2}:\d{2}|Maria|\[|\]/);
    }
  });

  it('preserva RIR, aquecimento e série válida no conteúdo da mensagem', () => {
    const text = [
      '[15:15, 25/11/2026] Fulano de Tal: Supino reto',
      '[15:16, 25/11/2026] Fulano de Tal: aquecimento 40x12',
      '[15:18, 25/11/2026] Fulano de Tal: 60x10 rir 2',
      '[15:20, 25/11/2026] Fulano de Tal: válida 65x8 rir 0',
    ].join('\n');
    expect(shape(text)).toEqual([
      {
        name: 'Supino reto',
        id: 'bench',
        sets: [
          ['warmup', 12, 40, null],
          ['working', 10, 60, 2],
          ['working', 8, 65, 0],
        ],
      },
    ]);
  });

  it('mensagem com dois-pontos no conteúdo mantém o conteúdo após o remetente', () => {
    expect(
      whatsappMessage('[15:15, 25/11/2026] Fulano de Tal: Supino reto: 60x10'),
    ).toEqual({ date: '25/11/2026', content: 'Supino reto: 60x10' });
    expect(
      shape('[15:15, 25/11/2026] Fulano de Tal: Supino reto: 60x10, 65x8'),
    ).toEqual([
      {
        name: 'Supino reto',
        id: 'bench',
        sets: [
          ['working', 10, 60, null],
          ['working', 8, 65, null],
        ],
      },
    ]);
  });

  it('texto com dois-pontos sem cabeçalho não é tratado como mensagem', () => {
    for (const line of [
      'Supino reto: 60x10',
      'Obs: 15:15 descanso curto',
      'Treino às 15:15: pernas',
      '25/11/2026',
      '15:15 Supino reto 60x10',
    ])
      expect(whatsappMessage(line)).toBeNull();
    expect(shape('Supino reto: 60x10\nRosca direta: 20x12')).toEqual([
      { name: 'Supino reto', id: 'bench', sets: [['working', 10, 60, null]] },
      { name: 'Rosca direta', id: 'curl', sets: [['working', 12, 20, null]] },
    ]);
  });

  it('data inválida no cabeçalho gera aviso, sem virar exercício', () => {
    const result = parse(
      '[15:15, 32/13/2026] Fulano de Tal: Supino reto\n[15:16, 32/13/2026] Fulano de Tal: 60x10',
    );
    expect(result.exercises.map((e) => e.sourceName)).toEqual(['Supino reto']);
    expect(result.metadata?.dates).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/data inválida “32\/13\/2026”/),
      ]),
    );
  });

  it('cabeçalhos malformados não são removidos parcialmente', () => {
    for (const line of [
      '[15:15 25/11/2026 Fulano: 12 x 50 kg', // sem colchete de fechamento
      '15:15, 25/11/2026] Fulano: 12 x 50 kg', // sem colchete de abertura
      '[1515, 25/11/2026] Fulano: 12 x 50 kg', // horário sem dois-pontos
      '[15:15, 25-11-2026] Fulano: 12 x 50 kg', // separador de data inválido
    ])
      expect(whatsappMessage(line)).toBeNull();
    // Cabeçalho válido sem remetente (mensagem de sistema): só o cabeçalho sai.
    expect(
      whatsappMessage('25/11/2026, 15:15 - As mensagens são protegidas'),
    ).toEqual({ date: '25/11/2026', content: 'As mensagens são protegidas' });
  });

  it('marcas invisíveis de direção do WhatsApp são ignoradas', () => {
    expect(
      whatsappMessage('‎[15:15, 25/11/2026] Fulano de Tal: ‎12 x 50 kg'),
    ).toEqual({ date: '25/11/2026', content: '12 x 50 kg' });
  });

  it('formatos anteriores continuam iguais', () => {
    expect(
      shape('Supno reto: 60x10,65x8\nElevação lateral: 12,5kg x 12'),
    ).toEqual([
      {
        name: 'Supno reto',
        id: 'bench',
        sets: [
          ['working', 10, 60, null],
          ['working', 8, 65, null],
        ],
      },
      {
        name: 'Elevação lateral',
        id: 'raise',
        sets: [['working', 12, 12.5, null]],
      },
    ]);
    // Cabeçalhos de treino, data e divisão seguem como metadados.
    const result = parse(
      'Treino A - Peito\nData: 25/11/2026\nSupino reto\n60x10',
    );
    expect(result.metadata).toMatchObject({
      title: 'A - Peito',
      division: 'A',
      dates: ['2026-11-25'],
    });
    expect(result.exercises.map((e) => e.sourceName)).toEqual(['Supino reto']);
  });
});
