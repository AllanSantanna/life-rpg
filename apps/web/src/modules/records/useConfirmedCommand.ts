import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecordCommand, SaveOutcome } from './types';

export const saveErrorMessages: Record<
  Exclude<SaveOutcome, 'saved'>,
  string
> = {
  failed:
    'A gravação não foi confirmada neste navegador. O registro não foi salvo com segurança: confira o aviso de armazenamento antes de registrar de novo.',
  conflict:
    'Os registros foram alterados em outra aba e esta alteração não foi salva. Recarregue os registros antes de registrar de novo.',
};

/**
 * Aplica um comando de registro uma única vez e só anuncia sucesso depois que
 * `whenSaved` confirmar a gravação. Usado pelas Ações rápidas e pelo comando
 * por voz. Enquanto um comando aceito aguarda confirmação (ou falhou ao
 * gravar), novos envios são recusados: nada é aplicado em duplicidade.
 */
export function useConfirmedCommand(
  onCommand: (command: RecordCommand) => string | null,
  whenSaved?: () => Promise<SaveOutcome>,
) {
  const pending = useRef<string | null>(null);
  const mounted = useRef(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Remarca na montagem: o StrictMode desmonta e remonta os efeitos.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** `message` é o texto de sucesso anunciado depois da gravação. */
  const run = useCallback(
    (command: RecordCommand, message: string) => {
      if (pending.current !== null)
        return error || 'Este registro já está sendo salvo.';
      const failure = onCommand(command);
      if (!failure) pending.current = message;
      return failure;
    },
    [onCommand, error],
  );
  /**
   * Aguarda a gravação do comando aceito. Devolve a mensagem de sucesso, ou
   * `null` em falha (o erro fica em `error`). Pode ser chamada de novo para
   * verificar outra vez, sem reaplicar o comando.
   */
  const confirm = useCallback(async (): Promise<string | null> => {
    const message = pending.current;
    if (message === null) return null;
    setSaving(true);
    setError('');
    const outcome = whenSaved ? await whenSaved() : 'saved';
    if (!mounted.current) return null;
    setSaving(false);
    if (outcome !== 'saved') {
      setError(saveErrorMessages[outcome]);
      return null;
    }
    pending.current = null;
    return message;
  }, [whenSaved]);
  const reset = useCallback(() => {
    pending.current = null;
    setError('');
    setSaving(false);
  }, []);
  return {
    run,
    confirm,
    reset,
    saving,
    error,
    /** Há comando aceito aguardando (ou sem) confirmação de gravação. */
    isPending: () => pending.current !== null,
  };
}
