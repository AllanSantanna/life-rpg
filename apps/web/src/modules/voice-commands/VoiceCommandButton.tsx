import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../shared/components/Icon';
import { newId } from '../records/form';
import type { LifeRecords, RecordCommand, SaveOutcome } from '../records/types';
import { useConfirmedCommand } from '../records/useConfirmedCommand';
import {
  completeCommand,
  recordCommandFor,
  validateDraft,
  voiceContext,
} from './commands';
import { parseVoiceCommand } from './parser';
import {
  listenOnce,
  recognitionMessages,
  speechRecognitionConstructor,
  type SpeechRecognitionConstructor,
} from './recognition';
import type { ParseResult, VoiceDraft, VoiceIntent } from './types';
import {
  VoiceCommandDialog,
  type DraftPatch,
  type VoiceStatus,
} from './VoiceCommandDialog';

/** Rascunho com as correções do cartão; `undefined` remove o campo. */
function applyPatch(draft: VoiceDraft, patch: DraftPatch): VoiceDraft {
  const next: Record<string, unknown> = { ...draft };
  for (const [key, value] of Object.entries(patch))
    if (value === undefined) delete next[key];
    else next[key] = value;
  return next as unknown as VoiceDraft;
}
import './voiceCommands.css';

/** Mensagem de sucesso conforme o comando efetivamente gravado. */
function successMessage(command: RecordCommand) {
  switch (command.type) {
    case 'saveMovement':
      return command.value.kind === 'income'
        ? 'Receita registrada.'
        : 'Despesa registrada.';
    case 'saveRecurrence':
      return command.rule.kind === 'income'
        ? 'Receita recorrente registrada.'
        : 'Despesa recorrente registrada.';
    case 'saveSleep':
      return 'Sono registrado.';
    case 'saveReading':
      return 'Leitura registrada.';
    case 'saveWorkout':
      return 'Treino registrado.';
    default:
      return 'Registro salvo.';
  }
}

/**
 * Comando por voz: botão de microfone ao lado das Ações rápidas. A fala vira
 * texto pela Web Speech API (`recognition.ts`), o texto é interpretado
 * localmente (`parser.ts`) e o resultado aparece num cartão de confirmação.
 * Só “Confirmar” (ou salvar no formulário de edição) aplica o comando
 * existente do aplicativo; o sucesso aparece depois da gravação confirmada.
 */
export function VoiceCommandButton({
  records,
  today,
  onCommand,
  whenSaved,
  onOpenQuickActions,
  recognition,
}: {
  records: LifeRecords;
  today: string;
  onCommand: (command: RecordCommand) => string | null;
  whenSaved?: (() => Promise<SaveOutcome>) | undefined;
  onOpenQuickActions: () => void;
  /** Injeção para testes; `undefined` detecta no navegador. */
  recognition?: SpeechRecognitionConstructor | null;
}) {
  const Recognition = useMemo(
    () =>
      recognition !== undefined ? recognition : speechRecognitionConstructor(),
    [recognition],
  );
  const trigger = useRef<HTMLButtonElement>(null);
  const cancelListening = useRef<(() => void) | null>(null);
  const latest = useRef({ records, today });
  latest.current = { records, today };
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [choice, setChoice] = useState<DraftPatch>({});
  /** Tentativas de confirmar com pendências (leva o foco ao campo). */
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const save = useConfirmedCommand(onCommand, whenSaved);
  const draft = result?.draft ? applyPatch(result.draft, choice) : null;
  const context = voiceContext(records, today);
  const issues = draft ? validateDraft(draft, context) : [];
  const listening = status === 'requesting' || status === 'listening';

  function stopListening() {
    cancelListening.current?.();
    cancelListening.current = null;
  }
  // Microfone nunca fica aberto: ao desmontar ou ao sair da aba, encerra.
  useEffect(() => {
    function hidden() {
      if (document.visibilityState !== 'hidden' || !cancelListening.current)
        return;
      stopListening();
      setError(recognitionMessages.interrupted);
      setStatus('error');
    }
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      stopListening();
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function interpret(text: string) {
    setStatus('processing');
    setTranscript(text);
    setChoice({});
    setAttempt(0);
    setError('');
    save.reset();
    const { records: current, today: day } = latest.current;
    setResult(parseVoiceCommand(text, voiceContext(current, day)));
    setStatus('preview');
  }
  /** Inicia a escuta; chamada sempre a partir de um toque ou clique. */
  function listen() {
    if (!Recognition) {
      setStatus('unavailable');
      return;
    }
    stopListening();
    setError('');
    setStatus('requesting');
    cancelListening.current = listenOnce(Recognition, {
      onListening: () => setStatus('listening'),
      onTranscript: (text) => {
        cancelListening.current = null;
        interpret(text);
      },
      onError: (failure) => {
        cancelListening.current = null;
        setError(recognitionMessages[failure]);
        setStatus(failure === 'unsupported' ? 'unavailable' : 'error');
      },
    });
  }
  function openVoice() {
    save.reset();
    setResult(null);
    setTranscript('');
    setChoice({});
    setError('');
    setOpen(true);
    if (Recognition) listen();
    else setStatus('unavailable');
  }
  function close(restoreFocus = true) {
    if (save.saving) return;
    stopListening();
    setOpen(false);
    setStatus('idle');
    setResult(null);
    save.reset();
    if (restoreFocus)
      requestAnimationFrame(() =>
        trigger.current?.focus({ preventScroll: true }),
      );
  }
  function cancelCurrentListening() {
    stopListening();
    setStatus('idle');
  }
  async function finishSave() {
    const message = await save.confirm();
    if (message === null) return;
    setOpen(false);
    setStatus('idle');
    setResult(null);
    setToast(message);
    requestAnimationFrame(() =>
      trigger.current?.focus({ preventScroll: true }),
    );
  }
  function run(command: RecordCommand) {
    return save.run(command, successMessage(command));
  }
  const command = completeCommand(draft, context);
  /**
   * Confirmar sempre responde: com pendências, anuncia o que falta e leva o
   * foco ao primeiro campo; completo, grava pelo comando existente.
   */
  function confirm() {
    if (save.saving) return;
    if (save.isPending()) return void finishSave();
    if (!command) {
      setAttempt((n) => n + 1);
      return;
    }
    const failure = run(recordCommandFor(command, newId));
    if (failure) {
      setError(failure);
      return;
    }
    void finishSave();
  }

  return (
    <div className="voice-command">
      <button
        ref={trigger}
        type="button"
        className="voice-command__trigger"
        aria-label="Comando por voz"
        aria-haspopup="dialog"
        data-listening={(open && listening) || undefined}
        title="Comando por voz"
        onClick={openVoice}
      >
        <span className="voice-command__icon" aria-hidden="true">
          <Icon name="mic" size={20} />
        </span>
        <span className="voice-command__label" aria-hidden="true">
          Comando por voz
        </span>
      </button>
      <p
        className="quick-actions__toast voice-command__toast"
        aria-live="polite"
        data-shown={!!toast}
      >
        {toast}
      </p>
      {open && (
        <VoiceCommandDialog
          status={status}
          records={records}
          transcript={transcript}
          result={result}
          draft={draft}
          context={context}
          issues={issues}
          attempt={attempt}
          error={error}
          saveError={save.error}
          saving={save.saving}
          canListen={Recognition !== null}
          onChange={(patch) => {
            setError('');
            setChoice((previous) => ({ ...previous, ...patch }));
          }}
          onChoosePillar={(type: VoiceIntent) => {
            // Frase não entendida: o usuário escolhe o registro; nada é presumido.
            setResult((previous) =>
              previous
                ? {
                    ...previous,
                    draft: {
                      type,
                      date: latest.current.today,
                      dateSpoken: false,
                    },
                    missing: [],
                    ambiguities: [],
                    errors: [],
                    notes: [],
                  }
                : previous,
            );
            setChoice({});
            setAttempt(0);
          }}
          onListen={listen}
          onCancelListening={cancelCurrentListening}
          onInterpret={interpret}
          onEdit={() => {
            setError('');
            setStatus('editing');
          }}
          onBackToPreview={() => setStatus('preview')}
          onConfirm={confirm}
          onRetrySave={() => void finishSave()}
          onQuickActions={() => {
            // O foco vai para o menu de Ações rápidas, não volta ao microfone.
            close(false);
            onOpenQuickActions();
          }}
          onClose={() => close()}
          run={run}
          onFormSaved={() =>
            save.isPending() ? void finishSave() : setStatus('preview')
          }
        />
      )}
    </div>
  );
}
