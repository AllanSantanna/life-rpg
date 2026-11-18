import { useState, type ReactNode } from 'react';
import { FinancialConfirmation } from './FinancialConfirmation';

export interface PendingDeletion {
  title: string;
  description: ReactNode;
  confirm: string;
  /** Executa o comando existente; devolve a mensagem de erro, se houver. */
  run: () => string | null;
}

/** Confirmação para exclusões financeiras; não altera dados ao cancelar. */
export function DeleteConfirmation({
  pending,
  onClose,
}: {
  pending: PendingDeletion;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  return (
    <FinancialConfirmation title={pending.title} onCancel={onClose}>
      <p>{pending.description}</p>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        className="record-primary financial-danger"
        disabled={done}
        onClick={() => {
          if (done) return;
          const failure = pending.run();
          if (failure) setError(failure);
          else {
            setDone(true);
            onClose();
          }
        }}
      >
        {pending.confirm}
      </button>
    </FinancialConfirmation>
  );
}
