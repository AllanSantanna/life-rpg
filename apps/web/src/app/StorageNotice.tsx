import { useLayoutEffect, useRef, useState } from 'react';
import { ConfirmAction } from '../shared/components/ConfirmAction';
import { downloadRaw } from '../shared/storage/backups';
import type { Persistence } from './usePlayerState';

const fileName = (today: string) => `life-rpg-registros-${today}.json`;

/**
 * Aviso da situação real dos registros quando a gravação está suspensa para
 * protegê-los. Nenhuma ação destrutiva acontece sem confirmação explícita.
 */
export function StorageNotice({
  persistence,
  today,
  onReload,
  onStartFresh,
}: {
  persistence: Persistence;
  today: string;
  onReload: () => void;
  onStartFresh: () => string;
}) {
  const [error, setError] = useState<string | null>(null);
  const returnToContent = useRef(false);
  useLayoutEffect(() => {
    if (persistence.kind === 'saved' && returnToContent.current) {
      document.getElementById('main')?.focus();
      returnToContent.current = false;
    }
  }, [persistence.kind]);
  if (persistence.kind === 'conflict')
    return (
      <section
        className="panel record-section storage-notice"
        role="alert"
        aria-labelledby="storage-notice-title"
      >
        <h2 id="storage-notice-title">Registros alterados em outra aba</h2>
        <p className="record-hint">
          Sua última alteração nesta aba não foi salva para não sobrescrever o
          que foi gravado na outra. Carregue os registros atuais e refaça a
          alteração, se ainda for necessária.
        </p>
        <div className="record-actions">
          <button
            type="button"
            className="record-primary"
            onClick={() => {
              returnToContent.current = true;
              onReload();
            }}
          >
            Carregar registros atuais
          </button>
        </div>
      </section>
    );
  if (persistence.kind !== 'protected') return null;
  return (
    <section
      className="panel record-section storage-notice"
      role="alert"
      aria-labelledby="storage-notice-title"
    >
      <h2 id="storage-notice-title">Registros salvos protegidos</h2>
      <p className="record-hint">
        {persistence.reason === 'incompatible'
          ? 'Os registros deste navegador foram salvos por uma versão diferente do Life RPG e não puderam ser convertidos.'
          : 'Os registros deste navegador não puderam ser lidos: parte do conteúdo está em formato inválido.'}{' '}
        Eles foram preservados sem alteração e nada será gravado por cima deles.
        Você pode usar o app nesta sessão, mas as alterações não serão salvas
        até decidir o que fazer.
      </p>
      <div className="record-actions">
        <button
          type="button"
          className="filter-button"
          onClick={() => downloadRaw(persistence.raw, fileName(today))}
        >
          Baixar cópia dos registros
        </button>
        <ConfirmAction
          label="Começar do zero guardando uma cópia"
          detail="Uma cópia verificada dos registros atuais será guardada neste navegador antes de iniciar um jogador novo. Ela pode ser baixada ou restaurada depois, em Perfil."
          confirmLabel="Guardar cópia e começar do zero"
          onConfirm={() => {
            try {
              onStartFresh();
              // O aviso e seu botão desaparecem após a recuperação. Devolver
              // o foco ao conteúdo evita deixá-lo no body sem contexto.
              returnToContent.current = true;
              setError(null);
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : 'Não foi possível guardar a cópia. Nada foi apagado.',
              );
            }
          }}
        />
      </div>
      {error && (
        <p className="record-error" role="alert">
          {error} Baixe uma cópia antes de tentar novamente.
        </p>
      )}
    </section>
  );
}
