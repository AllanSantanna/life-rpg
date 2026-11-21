import { useState } from 'react';
import { downloadRaw } from '../shared/storage/backups';
import type { LegacyChange } from '../shared/storage/transactionalStateStorage';

export function LegacyStorageNotice({
  change,
  onAcknowledge,
}: {
  change: LegacyChange;
  onAcknowledge: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  return (
    <section
      className="panel record-section storage-notice"
      role="alert"
      aria-labelledby="legacy-storage-title"
    >
      <h2 id="legacy-storage-title">Uma versão antiga alterou a cópia local</h2>
      <p className="record-hint">
        Seus registros atuais continuam protegidos.{' '}
        {change.preserved === false
          ? 'Não foi possível guardar todas as alterações antigas. Elas estão apenas nesta sessão: baixe uma cópia antes de fechar a aba.'
          : change.raw === null
            ? 'A cópia antiga foi removida.'
            : 'O conteúdo recebido foi guardado para recuperação, em Perfil.'}{' '}
        Nenhum dado financeiro foi mesclado automaticamente. Use a versão atual
        para continuar.
      </p>
      <div className="record-actions">
        <button
          type="button"
          className="filter-button"
          disabled={change.raw === null && !change.pending?.length}
          onClick={() => {
            if (change.pending?.length)
              downloadRaw(
                JSON.stringify({ version: 1, entries: change.pending }),
                'life-rpg-alteracoes-antigas-pendentes.json',
              );
            else if (change.raw !== null)
              downloadRaw(change.raw, 'life-rpg-versao-antiga.json');
          }}
        >
          {change.preserved === false
            ? 'Baixar alterações não guardadas'
            : 'Baixar cópia da versão antiga'}
        </button>
        <button
          type="button"
          className="filter-button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void onAcknowledge()
              .catch(() =>
                setError(
                  'Não foi possível confirmar. A cópia protegida continua preservada.',
                ),
              )
              .finally(() => setPending(false));
          }}
        >
          Manter registros atuais e fechar aviso
        </button>
      </div>
      {error && (
        <p className="record-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
