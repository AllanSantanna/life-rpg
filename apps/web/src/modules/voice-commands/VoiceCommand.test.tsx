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
const confirmButton = () =>
  within(voice()).getByRole('button', { name: 'Confirmar' });

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

describe('confirmação por pilar', () => {
  it('despesa: mostra a prévia, nada é salvo antes de confirmar', async () => {
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
    speak('Comprei um chocolate por dez reais');
    expect(
      within(voice()).getByRole('heading', { name: 'Confirmar despesa' }),
    ).toBeInTheDocument();
    expect(voice()).toHaveTextContent('“Comprei um chocolate por dez reais”');
    const card = voice().querySelector('.voice-card')!;
    expect(card).toHaveTextContent('Chocolate');
    expect(card).toHaveTextContent(/R\$\s10,00/);
    expect(card).toHaveTextContent('Hoje');
    expect(
      within(card as HTMLElement).getByRole('button', { name: 'Alimentação' }),
    ).toHaveAttribute('aria-pressed', 'true');
    // Reconhecer não é executar.
    expect(stored().records.movements).toHaveLength(1);
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Despesa registrada.'));
    expect(document.querySelector('dialog.voice-dialog')).toBeNull();
    expect(stored().records.movements.at(-1)).toMatchObject({
      kind: 'expense',
      description: 'Chocolate',
      amountCents: 1000,
      category: 'Alimentação',
      date: today,
    });
    expect(stored().records.movements.at(-1)).not.toHaveProperty('accountId');
  });

  it('receita: categoria não inferida exige escolha antes de confirmar', async () => {
    seed();
    speak('Recebi duzentos reais de um serviço');
    expect(
      within(voice()).getByRole('heading', { name: 'Confirmar receita' }),
    ).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(within(voice()).getByRole('button', { name: 'Geral' }));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Receita registrada.'));
    expect(stored().records.movements).toEqual([
      expect.objectContaining({
        kind: 'income',
        amountCents: 20000,
        description: 'Serviço',
        category: 'Geral',
      }),
    ]);
  });

  it('sono: confirma e aparece no Descanso após recarregar', async () => {
    const view = seed();
    speak('Ontem dormi sete horas e meia');
    expect(voice().querySelector('.voice-card')).toHaveTextContent('Ontem');
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

  it('sono existente: avisa e substitui sem duplicar', async () => {
    seed(
      apply(empty(), { type: 'saveSleep', value: { date: today, hours: 6 } }),
    );
    speak('dormi oito horas');
    expect(voice()).toHaveTextContent('Já existe registro de 6 h');
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Sono registrado.'));
    expect(stored().records.sleep).toEqual([{ date: today, hours: 8 }]);
  });

  it('leitura: identifica o livro e respeita as páginas', async () => {
    seed(withBooks());
    speak('Li vinte páginas de Meditações');
    const card = voice().querySelector('.voice-card')!;
    expect(card).toHaveTextContent('Meditações');
    expect(card).toHaveTextContent('20');
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Leitura registrada.'));
    expect(stored().records.readings).toEqual([
      expect.objectContaining({ bookId: 'med', pages: 20, date: today }),
    ]);
    speak('li 281 paginas de meditacoes');
    expect(voice()).toHaveTextContent('ultrapassa o total');
    expect(confirmButton()).toBeDisabled();
  });

  it('treino simples: confirma uma vez; já registrado não confirma', async () => {
    seed();
    speak('Treinei hoje');
    expect(
      within(voice()).getByRole('heading', { name: 'Registrar treino?' }),
    ).toBeInTheDocument();
    expect(voice()).toHaveTextContent('Registro simples');
    fireEvent.click(confirmButton());
    await waitFor(() => expect(feedback()).toBe('Treino registrado.'));
    expect(stored().records.workouts).toEqual([{ date: today, trained: true }]);
    // Sessões avançadas não são criadas.
    expect(stored().records.advancedWorkouts?.sessions ?? []).toEqual([]);
    speak('fiz musculação hoje');
    expect(voice()).toHaveTextContent('já está registrado');
    expect(confirmButton()).toBeDisabled();
    expect(stored().records.workouts).toHaveLength(1);
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
    expect(voice().querySelector('.voice-card')).toHaveTextContent(
      /R\$\s12,00/,
    );
  });

  it('Editar usa o formulário existente, com os valores reconhecidos', async () => {
    seed();
    speak('Gastei dinheiro no mercado');
    expect(voice()).toHaveTextContent('Falta informar: valor');
    expect(confirmButton()).toBeDisabled();
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

  it('frase desconhecida: nada é gravado; oferece falar, corrigir ou Ações rápidas', () => {
    seed();
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);
    speak('qual é a previsão do tempo');
    expect(voice()).toHaveTextContent('Não consegui identificar a ação.');
    expect(
      within(voice()).getByRole('button', { name: /Falar de novo/ }),
    ).toBeInTheDocument();
    expect(within(voice()).getByLabelText('Corrigir a frase')).toBeEnabled();
    fireEvent.click(
      within(voice()).getByRole('button', { name: 'Abrir ações rápidas' }),
    );
    expect(document.querySelector('dialog.voice-dialog')).toBeNull();
    expect(
      screen.getByRole('dialog', { name: 'Ações rápidas' }),
    ).toBeInTheDocument();
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
      expect(voice()).toHaveTextContent('7 h');
      // Duplo clique e novo envio não reaplicam o comando.
      fireEvent.click(confirmButton());
      fireEvent.click(confirmButton());
      expect(commands).toHaveLength(1);
      result = 'saved';
      fireEvent.click(
        within(voice()).getByRole('button', { name: 'Tentar novamente' }),
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
