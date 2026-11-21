import { useEffect, useState } from 'react';
import { ConfirmAction } from '../shared/components/ConfirmAction';
import {
  downloadRaw,
  listBackups,
  type BackupAccess,
} from '../shared/storage/backups';
import {
  isPromise,
  type CopyRepository,
  type MaybePromise,
} from '../shared/storage/transactionalStateStorage';
import { PLAYER_STORAGE_KEY } from './playerState';

const browserStorage = (): BackupAccess => window.localStorage;

/**
 * Cópias criadas antes de substituir registros protegidos ou de restaurar
 * outra cópia. Só aparece quando existe alguma; nada é removido aqui.
 */
export function StorageBackups({
  onRestore,
  access = browserStorage,
  copyStore,
}: {
  onRestore: (backupKey: string) => MaybePromise<void>;
  copyStore?: CopyRepository;
  access?: () => BackupAccess;
}) {
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [storedCopies, setStoredCopies] = useState<
    ReturnType<typeof listBackups>
  >([]);
  useEffect(() => {
    if (!copyStore) return;
    let active = true;
    const result = copyStore.listCopies();
    const success = (copies: ReturnType<typeof listBackups>) => {
      if (active) setStoredCopies(copies);
    };
    if (isPromise(result))
      void result.then(success, () => {
        if (active)
          setMessage({
            text: 'Não foi possível listar as cópias protegidas. Tente novamente ao reabrir o Perfil.',
            error: true,
          });
      });
    else success(result);
    return () => {
      active = false;
    };
  }, [copyStore, revision]);
  let backups: ReturnType<typeof listBackups> = [];
  try {
    backups = copyStore
      ? storedCopies
      : listBackups(access(), PLAYER_STORAGE_KEY);
  } catch {
    backups = [];
  }
  void revision;
  if (!backups.length && !message) return null;
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
              {backup.label && <p>{backup.label}</p>}
              <p>{Math.max(1, Math.round(backup.size / 1024))} KB</p>
            </div>
            <div className="record-actions">
              <button
                type="button"
                aria-label={`Baixar cópia de ${label(backup.createdAt)}`}
                onClick={() => {
                  const download = (raw: string | null) => {
                    if (raw !== null)
                      downloadRaw(
                        raw,
                        `life-rpg-copia-${backup.createdAt.slice(0, 10)}.json`,
                      );
                  };
                  const result = copyStore
                    ? copyStore.readCopy(backup.key)
                    : access().getItem(backup.key);
                  if (isPromise(result))
                    void result.then(download, () =>
                      setMessage({
                        text: 'Não foi possível baixar a cópia. Nenhum registro foi alterado.',
                        error: true,
                      }),
                    );
                  else download(result);
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
                  const success = () => {
                    setMessage({ text: 'Cópia restaurada.', error: false });
                    setRevision((n) => n + 1);
                  };
                  const failure = () =>
                    setMessage({
                      text: 'Não foi possível restaurar a cópia. Os registros anteriores foram preservados.',
                      error: true,
                    });
                  try {
                    const result = onRestore(backup.key);
                    if (isPromise(result)) return result.then(success, failure);
                    success();
                  } catch {
                    failure();
                  }
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
