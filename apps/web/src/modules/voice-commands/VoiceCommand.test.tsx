import { readFileSync } from 'node:fs';
import { StrictMode, useState } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { createBackupFile, parseBackupFile } from '../../app/backupFile';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from '../../app/playerState';
import { QUICK_ACTIONS_KEY } from '../../app/quick/quickActionsPreference';
import { applyRecordCommand } from '../records/commands';
import { recordReward } from '../records/progression';
import type { LifeRecords, RecordCommand, SaveOutcome } from '../records/types';
import type {
  SpeechRecognitionConstructor,
  SpeechRecognitionLike,
} from './recognition';
import { VoiceCommandButton } from './VoiceCommandButton';

/**
 * Comando por voz pela interface, com a Web Speech API simulada (sem
 * microfone real). Dados sintéticos; hoje é 13/11/2026.
 */
afterEach(() => {
  cleanup();
  delete (window as { SpeechRecognition?: unknown }).SpeechRecognition;
});
const today = '2026-11-13';
const stored = (): PlayerState =>
  JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;

/** Reconhecimento controlado pelo teste. */
class FakeRecognition implements SpeechRecognitionLike {
  static instances: FakeRecognition[] = [];
  lang = '';
  continuous = true;
  interimResults = true;
  maxAlternatives = 5;
  onstart: SpeechRecognitionLike['onstart'] = null;
  onresult: SpeechRecognitionLike['onresult'] = null;
  onerror: SpeechRecognitionLike['onerror'] = null;
  onend: SpeechRecognitionLike['onend'] = null;
  started = false;
  aborted = false;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.aborted = true;
    this.onerror?.({ error: 'aborted' });
    this.onend?.();
  }
  /** Permissão concedida e escuta iniciada. */
  listen() {
    act(() => this.onstart?.());
  }
  say(text: string) {
    act(() => {
      this.onresult?.({
        results: [Object.assign([{ transcript: text }], { isFinal: true })],
      });
      this.onend?.();
    });
  }
  fail(error: string) {
    act(() => {
      this.onerror?.({ error });
      this.onend?.();
    });
  }
}
const latest = () => FakeRecognition.instances.at(-1)!;
const fake = FakeRecognition as unknown as SpeechRecognitionConstructor;

function seed(records?: LifeRecords, speech = true) {
  FakeRecognition.instances = [];
  if (speech)
    (window as { SpeechRecognition?: unknown }).SpeechRecognition = fake;
  const state = createInitialPlayerState();
  if (records) state.records = records;
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
  );
  localStorage.setItem(
    QUICK_ACTIONS_KEY,
    JSON.stringify({ version: 1, data: { introSeen: true } }),
  );
  return render(<App />);
}
const apply = (records: LifeRecords, ...commands: RecordCommand[]) =>
  commands.reduce((state, c) => applyRecordCommand(state, c, today), records);
const empty = () => createInitialPlayerState().records;
const withBooks = () =>
  apply(empty(), {
    type: 'saveBook',
    value: { id: 'med', title: 'Meditações', totalPages: 300 },
  });
const mic = () => screen.getByRole('button', { name: 'Comando por voz' });
const voice = () => document.querySelector<HTMLElement>('dialog.voice-dialog')!;
const feedback = () =>
  document.querySelector('.voice-command__toast')?.textContent ?? '';
/** Toca no microfone e fala a frase. */
function speak(text: string) {
  fireEvent.click(mic());
  latest().listen();
  latest().say(text);
}
/** Ação principal do cartão (“Confirmar” ou “Substituir registro”). */
const confirmButton = () =>
  voice().querySelector<HTMLButtonElement>('.voice-actions .record-primary')!;

describe('botão de microfone', () => {
  it('fica ao lado do “+” e não altera a navegação', () => {
    seed();
    const group = mic().closest('.global-actions')!;
    expect(
      within(group as HTMLElement).getByRole('button', {
        name: 'Abrir ações rápidas',
      }),
    ).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getAllByRole('button')).toHaveLength(5);
    expect(within(nav).queryByRole('button', { name: /voz/ })).toBeNull();
  });

  it('não inicia a escuta sem toque e configura pt-BR, comando único e resultado final', () => {
    seed();
    expect(FakeRecognition.instances).toHaveLength(0);
    fireEvent.click(mic());
    expect(latest()).toMatchObject({
      lang: 'pt-BR',
      continuous: false,
      interimResults: false,
      maxAlternatives: 1,
      started: true,
    });
    expect(voice()).toHaveTextContent('Solicitando acesso ao microfone');
    latest().listen();
    expect(voice()).toHaveTextContent('Ouvindo...');
    expect(mic()).toHaveAttribute('data-listening', 'true');
  });

  it('cancelar libera o microfone e não grava nada', () => {
    seed();
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);
    fireEvent.click(mic());
    latest().listen();
    fireEvent.click(within(voice()).getByRole('button', { name: 'Cancelar' }));
    expect(latest().aborted).toBe(true);
    expect(voice()).toHaveTextContent('Fale o que deseja registrar.');
    // Fechar por Esc devolve o foco ao microfone.
    fireEvent(voice(), new Event('cancel', { cancelable: true }));
    expect(document.querySelector('dialog.voice-dialog')).toBeNull();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
  });

  it('Esc durante a escuta encerra o microfone', () => {
    seed();
    fireEvent.click(mic());
    latest().listen();
    fireEvent(voice(), new Event('cancel', { cancelable: true }));
    expect(latest().aborted).toBe(true);
    expect(document.querySelector('dialog.voice-dialog')).toBeNull();
  });

  it.each([
    ['not-allowed', 'acesso ao microfone foi negado'],
    ['audio-capture', 'Nenhum microfone disponível'],
    ['no-speech', 'Nenhuma fala foi detectada'],
    ['network', 'não respondeu'],
  ])(
    'erro “%s” é explicado e permite tentar de novo ou digitar',
    (code, text) => {
      seed();
      fireEvent.click(mic());
      latest().fail(code);
      expect(within(voice()).getByRole('alert')).toHaveTextContent(text);
      expect(
        within(voice()).getByRole('button', { name: 'Falar' }),
      ).toBeInTheDocument();
      expect(
        within(voice()).getByLabelText('Ou digite o comando'),
      ).toBeEnabled();
    },
  );

  it('API indisponível: sem botão de gravação, com entrada digitada', () => {
    seed(undefined, false);
    fireEvent.click(mic());
    expect(voice()).toHaveTextContent(
      'O reconhecimento de voz não está disponível neste navegador',
    );
    expect(within(voice()).queryByRole('button', { name: 'Falar' })).toBeNull();
    fireEvent.change(within(voice()).getByLabelText('Ou digite o comando'), {
      target: { value: 'Dormi sete horas' },
    });
    fireEvent.click(
      within(voice()).getByRole('button', { name: 'Interpretar' }),
    );
    expect(
      within(voice()).getByRole('heading', { name: 'Confirmar sono' }),
    ).toBeInTheDocument();
  });

  it('informa privacidade sem prometer funcionamento offline', () => {
    seed();
    fireEvent.click(mic());
    expect(voice()).toHaveTextContent(
      'pode processar o áudio fora do aparelho',
    );
    expect(voice().textContent).not.toMatch(/offline/i);
  });
});

const card = () => voice().querySelector<HTMLElement>('.voice-card')!;
const pressed = (group: string) =>
  within(within(card()).getByRole('group', { name: group }))
    .queryAllByRole('button', { pressed: true })
    .map((button) => button.textContent);
const movementsShown = () => {
  window.history.replaceState(null, '', '/financas');
};

describe('regressão: “comprei um chocolate de r$ 10”', () => {
  it('sem categoria compatível: nada aparece como escolhido e Confirmar explica o que falta', async () => {
    seed();
    speak('comprei um chocolate de r$ 10');
    expect(
      within(voice()).getByRole('heading', { name: 'Confirmar despesa' }),
    ).toBeInTheDocument();
    expect(card()).toHaveTextContent('Finanças · Registrar despesa');
    expect(card()).toHaveAttribute('data-tone', 'expense');
    expect(pressed('Tipo de movimentação')).toEqual(['Despesa']);
    expect(within(card()).getByLabelText('Descrição')).toHaveValue('Chocolate');
    expect(within(card()).getByLabelText('Valor (R$)')).toHaveValue('R$ 10,00');
    expect(card()).toHaveTextContent('Hoje');
    // “Geral” é opção (categoria padrão do app), mas não está escolhida.
    expect(pressed('Categoria')).toEqual([]);
    expect(card()).toHaveTextContent(
      'Preciso confirmar algumas informações: categoria.',
    );
    expect(card()).toHaveTextContent('Escolha a categoria.');
    // Confirmar nunca fica mudo: anuncia a pendência e leva o foco ao campo.
    fireEvent.click(confirmButton());
    expect(within(card()).getByRole('alert')).toHaveTextContent('categoria');
    expect(
      within(
        within(card()).getByRole('group', { name: 'Categoria' }),
      ).getAllByRole('button')[0],
    ).toHaveFocus();
    expect(stored().records.movements).toEqual([]);
    // Escolha direta no cartão, sem abrir outro formulário.
    fireEvent.click(within(card()).getByRole('button', { name: 'Geral' }));
    expect(pressed('Categoria')).toEqual(['Geral']);
    expect(card()).not.toHaveTextContent('Preciso confirmar');
    fireEvent.click(confirmButton());
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Despesa registrada.'));
    expect(document.querySelector('dialog.voice-dialog')).toBeNull();
    expect(stored().records.movements).toEqual([
      expect.objectContaining({
        kind: 'expense',
        description: 'Chocolate',
        amountCents: 1000,
        category: 'Geral',
        date: today,
      }),
    ]);
    // Saldo e histórico atualizados pela página de Finanças.
    cleanup();
    movementsShown();
    render(<App />);
    expect(screen.getAllByText(/-R\$\s10,00/).length).toBeGreaterThan(0);
  });

  it('com categoria compatível existente: sugere e confirma direto', async () => {
    seed(
      apply(empty(), {
        type: 'saveMovement',
        value: {
          id: 'm0',
          kind: 'expense',
          description: 'Padaria',
          amountCents: 900,
          category: 'Alimentação',
          date: '2026-11-01',
        },
      }),
    );
    speak('comprei um chocolate de r$ 10');
    expect(pressed('Categoria')).toEqual(['Alimentação']);
    expect(card()).not.toHaveTextContent('Preciso confirmar');
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Despesa registrada.'));
    expect(stored().records.movements).toHaveLength(2);
    expect(stored().records.movements.at(-1)).toMatchObject({
      category: 'Alimentação',
      amountCents: 1000,
    });
    expect(stored().records.movements.at(-1)).not.toHaveProperty('accountId');
  });
});

describe('confirmação por pilar', () => {
  it('receita: tipo verde, edição direta de campos', async () => {
    seed();
    speak('Recebi duzentos reais de pagamento');
    expect(card()).toHaveAttribute('data-tone', 'income');
    expect(pressed('Tipo de movimentação')).toEqual(['Receita']);
    fireEvent.change(within(card()).getByLabelText('Descrição'), {
      target: { value: 'Pagamento do cliente' },
    });
    fireEvent.click(within(card()).getByRole('button', { name: 'Geral' }));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Receita registrada.'));
    expect(stored().records.movements).toEqual([
      expect.objectContaining({
        kind: 'income',
        amountCents: 20000,
        description: 'Pagamento do cliente',
        category: 'Geral',
      }),
    ]);
  });

  it('valor sem verbo: o tipo é escolhido no cartão, não presumido', () => {
    seed();
    speak('dez reais de chocolate');
    expect(card()).toHaveAttribute('data-tone', 'pending');
    expect(pressed('Tipo de movimentação')).toEqual([]);
    expect(card()).toHaveTextContent('tipo de movimentação');
    fireEvent.click(within(card()).getByRole('button', { name: 'Despesa' }));
    expect(pressed('Tipo de movimentação')).toEqual(['Despesa']);
  });

  it('valor pendente: campo destacado e foco ao confirmar', () => {
    seed();
    speak('Gastei dinheiro no mercado');
    fireEvent.click(within(card()).getByRole('button', { name: 'Geral' }));
    fireEvent.click(confirmButton());
    expect(within(card()).getByRole('alert')).toHaveTextContent('valor');
    expect(within(card()).getByLabelText('Valor (R$)')).toHaveFocus();
    fireEvent.change(within(card()).getByLabelText('Valor (R$)'), {
      target: { value: '1250' },
    });
    expect(card()).not.toHaveTextContent('Preciso confirmar');
  });

  it('sono: confirma e aparece no Descanso após recarregar', async () => {
    const view = seed();
    speak('Ontem dormi sete horas e meia');
    expect(card()).toHaveTextContent('Descanso · Registrar horas de sono');
    expect(within(card()).getByLabelText('Horas dormidas')).toHaveValue('7,5');
    expect(card()).toHaveTextContent('Ontem');
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Sono registrado.'));
    expect(stored().records.sleep).toEqual([
      { date: '2026-11-12', hours: 7.5 },
    ]);
    view.unmount();
    window.history.replaceState(null, '', '/descanso');
    render(<App />);
    expect(screen.getByLabelText('Histórico de sono')).toHaveTextContent(
      '7,5 h',
    );
  });

  it('sono existente: pergunta antes de substituir; não duplica', async () => {
    seed(
      apply(empty(), { type: 'saveSleep', value: { date: today, hours: 6 } }),
    );
    speak('dormi oito horas');
    expect(card()).toHaveTextContent(
      'Já existe um registro de sono nesta data (6 h). Deseja substituí-lo?',
    );
    fireEvent.click(
      within(voice()).getByRole('button', { name: 'Substituir registro' }),
    );
    await waitFor(() => expect(feedback()).toBe('Sono registrado.'));
    expect(stored().records.sleep).toEqual([{ date: today, hours: 8 }]);
  });

  it('sono com horas inválidas: pendência no campo', () => {
    seed();
    speak('dormi sete horas');
    fireEvent.change(within(card()).getByLabelText('Horas dormidas'), {
      target: { value: '30' },
    });
    fireEvent.click(confirmButton());
    expect(card()).toHaveTextContent('entre 0 e 24');
    expect(stored().records.sleep).toEqual([]);
  });

  it('leitura: identifica o livro e respeita as páginas', async () => {
    seed(withBooks());
    speak('Li vinte páginas de Meditações');
    expect(card()).toHaveTextContent('Conhecimento · Registrar páginas lidas');
    expect(card()).toHaveTextContent('Meditações');
    expect(within(card()).getByLabelText('Páginas lidas')).toHaveValue('20');
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Leitura registrada.'));
    expect(stored().records.readings).toEqual([
      expect.objectContaining({ bookId: 'med', pages: 20, date: today }),
    ]);
    speak('li 281 paginas de meditacoes');
    fireEvent.click(confirmButton());
    expect(card()).toHaveTextContent('ultrapassa o total');
    expect(stored().records.readings).toHaveLength(1);
  });

  it('leitura com vários livros: escolha direta no cartão; concluído fica fora', async () => {
    seed(
      apply(
        withBooks(),
        {
          type: 'saveBook',
          value: { id: 'leis', title: 'As 48 Leis do Poder', totalPages: 400 },
        },
        {
          type: 'saveBook',
          value: { id: 'fim', title: 'Livro antigo', totalPages: 10 },
        },
        {
          type: 'saveReading',
          value: { id: 'r0', bookId: 'fim', pages: 10, date: '2026-11-01' },
        },
      ),
    );
    speak('Li vinte páginas');
    const books = within(card()).getByRole('group', { name: 'Livro' });
    expect(
      within(books)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Meditações', 'As 48 Leis do Poder']);
    fireEvent.click(confirmButton());
    expect(card()).toHaveTextContent('Escolha o livro.');
    fireEvent.click(
      within(books).getByRole('button', { name: 'As 48 Leis do Poder' }),
    );
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Leitura registrada.'));
    expect(stored().records.readings.at(-1)).toMatchObject({
      bookId: 'leis',
      pages: 20,
    });
  });

  it('treino: confirma uma vez, sem sessão avançada; já registrado explica', async () => {
    seed();
    speak('Acabei de treinar');
    expect(
      within(voice()).getByRole('heading', { name: 'Confirmar treino' }),
    ).toBeInTheDocument();
    expect(card()).toHaveTextContent('Treinos · Registrar treino realizado');
    expect(card()).toHaveTextContent('Treinou hoje');
    expect(card()).toHaveTextContent('Registro simples');
    const before = recordReward(stored().records, [], today);
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Treino registrado.'));
    expect(stored().records.workouts).toEqual([{ date: today, trained: true }]);
    expect(stored().records.advancedWorkouts?.sessions ?? []).toEqual([]);
    const after = recordReward(stored().records, [], today);
    expect(after).toBeGreaterThan(before);
    speak('fiz musculação hoje');
    fireEvent.click(confirmButton());
    expect(card()).toHaveTextContent('já está registrado');
    expect(stored().records.workouts).toHaveLength(1);
    // Nenhum XP a mais.
    expect(recordReward(stored().records, [], today)).toBe(after);
  });
});

describe('correção, edição e frases desconhecidas', () => {
  it('corrige a frase reconhecida manualmente', () => {
    seed();
    speak('gastei dez reais com chocolate');
    fireEvent.change(within(voice()).getByLabelText('Corrigir a frase'), {
      target: { value: 'gastei doze reais com chocolate' },
    });
    fireEvent.click(
      within(voice()).getByRole('button', { name: 'Interpretar' }),
    );
    expect(within(card()).getByLabelText('Valor (R$)')).toHaveValue('R$ 12,00');
  });

  it('Editar usa o formulário existente, com os valores reconhecidos', async () => {
    seed();
    speak('Gastei dinheiro no mercado');
    fireEvent.click(within(voice()).getByRole('button', { name: 'Editar' }));
    const form = within(voice()).getByRole('form', {
      name: 'Nova movimentação',
    });
    expect(within(form).getByLabelText('Descrição')).toHaveValue('Mercado');
    fireEvent.change(within(form).getByLabelText('Valor (R$)'), {
      target: { value: '4590' },
    });
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar movimentação' }),
    );
    await waitFor(() => expect(feedback()).toBe('Despesa registrada.'));
    expect(stored().records.movements.at(-1)).toMatchObject({
      description: 'Mercado',
      amountCents: 4590,
    });
  });

  it('frase desconhecida: oferece pilares, falar, corrigir e Ações rápidas; nada é gravado', () => {
    seed();
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);
    speak('qual é a previsão do tempo');
    expect(voice()).toHaveTextContent('Não consegui identificar a ação.');
    const options = within(voice()).getByRole('group', {
      name: 'Escolher o que registrar',
    });
    expect(
      within(options)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Despesa', 'Receita', 'Sono', 'Leitura', 'Treino']);
    fireEvent.click(within(options).getByRole('button', { name: 'Sono' }));
    expect(
      within(voice()).getByRole('heading', { name: 'Confirmar sono' }),
    ).toBeInTheDocument();
    expect(within(card()).getByLabelText('Horas dormidas')).toHaveValue('');
    fireEvent.change(within(voice()).getByLabelText('Corrigir a frase'), {
      target: { value: 'previsão do tempo' },
    });
    fireEvent.click(
      within(voice()).getByRole('button', { name: 'Interpretar' }),
    );
    fireEvent.click(
      within(voice()).getByRole('button', { name: 'Abrir ações rápidas' }),
    );
    expect(document.querySelector('dialog.voice-dialog')).toBeNull();
    expect(
      screen.getByRole('dialog', { name: 'Ações rápidas' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
  });

  it.each([
    ['Comprei ações', /investimento/],
    ['Recebi uma transferência da minha própria conta', /Transferências/],
    ['Paguei a academia e treinei', /mais de uma ação/],
    ['Ganhei um livro', /Não consegui identificar/],
  ])('não interpreta “%s”', (phrase, message) => {
    seed();
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);
    speak(phrase);
    expect(voice()).toHaveTextContent(message);
    expect(voice().querySelector('.voice-card[data-tone]')).toBeNull();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
  });

  it('funciona em StrictMode (efeitos remontados)', async () => {
    seed();
    cleanup();
    (window as { SpeechRecognition?: unknown }).SpeechRecognition = fake;
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    speak('treinei hoje');
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Treino registrado.'));
  });
});

describe('segurança da gravação', () => {
  it.each([
    ['failed', 'A gravação não foi confirmada'],
    ['conflict', 'alterados em outra aba'],
  ] as const)(
    'falha %s: sem sucesso, dados mantidos, nada duplicado; permite tentar de novo',
    async (outcome, message) => {
      const commands: RecordCommand[] = [];
      let result: SaveOutcome = outcome;
      function Harness() {
        const [records, setRecords] = useState(empty());
        return (
          <VoiceCommandButton
            records={records}
            today={today}
            recognition={fake}
            onCommand={(command) => {
              commands.push(command);
              setRecords((previous) =>
                applyRecordCommand(previous, command, today),
              );
              return null;
            }}
            whenSaved={() => Promise.resolve(result)}
            onOpenQuickActions={() => {}}
          />
        );
      }
      FakeRecognition.instances = [];
      render(<Harness />);
      speak('dormi sete horas');
      fireEvent.click(confirmButton());
      expect(
        await within(voice()).findByText(new RegExp(message)),
      ).toBeInTheDocument();
      expect(feedback()).toBe('');
      expect(within(voice()).getByLabelText('Horas dormidas')).toHaveValue('7');
      // Duplo clique e novo envio não reaplicam o comando: só reverificam.
      fireEvent.click(confirmButton());
      fireEvent.click(confirmButton());
      expect(commands).toHaveLength(1);
      result = 'saved';
      fireEvent.click(
        await within(voice()).findByRole('button', {
          name: 'Tentar novamente',
        }),
      );
      await waitFor(() => expect(feedback()).toBe('Sono registrado.'));
      expect(commands).toHaveLength(1);
    },
  );

  it('duplo clique em Confirmar grava uma única vez', async () => {
    seed();
    speak('gastei 10 reais com chocolate');
    fireEvent.click(within(voice()).getByRole('button', { name: 'Geral' }));
    const button = confirmButton();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(feedback()).toBe('Despesa registrada.'));
    expect(stored().records.movements).toHaveLength(1);
  });

  it('registros por voz são exportados e restaurados em backup', async () => {
    seed();
    speak('treinei hoje');
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Treino registrado.'));
    const state = stored();
    const file = createBackupFile(
      JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
      new Date(2026, 10, 13, 9),
    );
    const restored = parseBackupFile(file.content);
    expect(restored.ok && restored.data.records).toEqual(state.records);
  });

  it('dados legados são lidos sem alteração antes de confirmar', () => {
    const legacy = apply(empty(), {
      type: 'saveSleep',
      value: { date: '2026-01-01', hours: 7 },
    });
    seed(legacy);
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);
    speak('dormi 6 horas');
    fireEvent(voice(), new Event('cancel', { cancelable: true }));
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
  });
});

describe('estilos do comando por voz', () => {
  const path = './voiceCommands.css';
  const css = readFileSync(new URL(path, import.meta.url), 'utf8');
  it('respeita prefers-reduced-motion', () => {
    expect(
      css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)')),
    ).toMatch(/\.voice-listening__pulse\[data-active\] \{\s*animation: none;/);
  });
  it('botão de voz com o mesmo tamanho do “+” (48 px)', () => {
    expect(css).toMatch(
      /\.voice-command__trigger \{[^}]*width: 48px;[^}]*height: 48px;/,
    );
  });
});
