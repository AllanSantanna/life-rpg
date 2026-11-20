import { useState } from 'react';
import { ConfirmAction } from '../shared/components/ConfirmAction';
import {
  downloadRaw,
  listBackups,
  type BackupAccess,
} from '../shared/storage/backups';
import { PLAYER_STORAGE_KEY } from './playerState';

const browserStorage = (): BackupAccess => window.localStorage;

/**
 * Cópias criadas antes de substituir registros protegidos ou de restaurar
 * outra cópia. Só aparece quando existe alguma; nada é removido aqui.
 */
export function StorageBackups({
  onRestore,
  access = browserStorage,
}: {
  onRestore: (backupKey: string) => void;
  access?: () => BackupAccess;
}) {
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  let backups: ReturnType<typeof listBackups> = [];
  try {
    backups = listBackups(access(), PLAYER_STORAGE_KEY);
  } catch {
    backups = [];
  }
  void revision;
  if (!backups.length) return null;
  const label = (createdAt: string) => {
    const date = new Date(createdAt);
    return Number.isNaN(date.getTime())
      ? createdAt
      : date.toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        });
  };
  return (
    <section
      className="panel record-section"
      aria-labelledby="storage-backups-title"
    >
      <h2 id="storage-backups-title">Cópias de segurança dos registros</h2>
      <p className="record-hint">
        Guardadas neste navegador antes de substituir ou restaurar registros.
        Restaurar também guarda os registros atuais como nova cópia.
      </p>
      <ul className="record-list">
        {backups.map((backup) => (
          <li key={backup.key}>
            <div>
              <strong>Cópia de {label(backup.createdAt)}</strong>
              <p>{Math.max(1, Math.round(backup.size / 1024))} KB</p>
            </div>
            <div className="record-actions">
              <button
                type="button"
                aria-label={`Baixar cópia de ${label(backup.createdAt)}`}
                onClick={() => {
                  const raw = access().getItem(backup.key);
                  if (raw !== null)
                    downloadRaw(
                      raw,
                      `life-rpg-copia-${backup.createdAt.slice(0, 10)}.json`,
                    );
                }}
              >
                Baixar
              </button>
              <ConfirmAction
                label="Restaurar"
                ariaLabel={`Restaurar cópia de ${label(backup.createdAt)}`}
                className=""
                detail="Os registros atuais serão guardados como nova cópia antes da restauração."
                confirmLabel="Restaurar cópia"
                onConfirm={() => {
                  try {
                    onRestore(backup.key);
                    setMessage({ text: 'Cópia restaurada.', error: false });
                  } catch (reason) {
                    setMessage({
                      text:
                        reason instanceof Error
                          ? reason.message
                          : 'Não foi possível restaurar a cópia.',
                      error: true,
                    });
                  }
                  setRevision((n) => n + 1);
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      {message && (
        <p
          className={message.error ? 'record-error' : 'record-hint'}
          role={message.error ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
