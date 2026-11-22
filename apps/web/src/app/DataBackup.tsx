import { useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
import { ActionButton } from '../shared/components/ActionButton';
import { downloadRaw } from '../shared/storage/backups';
import { plural } from '../shared/lib/plural';
import {
  BACKUP_MAX_BYTES,
  backupProblemMessages,
  createBackupFile,
  parseBackupFile,
  readFileText,
  type BackupCounts,
  type BackupPreview,
} from './backupFile';
import type { PlayerState } from './playerState';
import type { BackupImportOutcome } from './usePlayerState';

type Status = 'idle' | 'exporting' | 'reading' | 'restoring';
interface Pending {
  data: PlayerState;
  preview: BackupPreview;
  expected: string | null;
  fileName: string;
}
const RESTORE_WARNING =
  'Os dados atuais deste dispositivo serão substituídos pelos dados do arquivo selecionado. Uma cópia de recuperação será preservada.';
const outcomeMessages: Record<BackupImportOutcome, string> = {
  saved:
    'Backup restaurado. Os registros anteriores deste dispositivo foram guardados em “Cópias de segurança dos registros”.',
  conflict:
    'Os registros deste dispositivo foram alterados em outra aba antes da confirmação. Nada foi substituído. Selecione o arquivo novamente para revisar a prévia.',
  failed:
    'A restauração não foi confirmada. Os registros anteriores foram preservados.',
  reload:
    'Backup restaurado, mas não foi possível reler os registros. Recarregue a página.',
};
const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;
const total = (counts: BackupCounts) =>
  Object.values(counts).reduce((sum, value) => sum + value, 0);
const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;

function previewRows(preview: BackupPreview): [string, string][] {
  const c = preview.counts;
  return [
    ['Jogador', preview.profileName],
    [
      'Exportado em',
      preview.exportedAt
        ? formatDate(preview.exportedAt)
        : 'Cópia do armazenamento, sem data de exportação',
    ],
    [
      'Formato dos registros',
      preview.migrated
        ? `Versão ${preview.storageVersion}, atualizado pelas migrações oficiais`
        : `Versão ${preview.storageVersion}`,
    ],
    [
      'Finanças',
      [
        plural(c.movements, 'movimentação', 'movimentações'),
        plural(c.investments, 'investimento', 'investimentos'),
        plural(
          c.investmentEntries,
          'operação de investimento',
          'operações de investimento',
        ),
        plural(c.accounts, 'conta', 'contas'),
        plural(c.transfers, 'transferência', 'transferências'),
        plural(c.valuations, 'avaliação', 'avaliações'),
        plural(c.quotes, 'cotação', 'cotações'),
      ].join(', '),
    ],
    [
      'Treinos',
      [
        plural(c.workouts, 'dia registrado', 'dias registrados'),
        plural(c.workoutSessions, 'sessão', 'sessões'),
        plural(c.workoutPlans, 'ficha', 'fichas'),
        plural(
          c.workoutExercises,
          'exercício personalizado',
          'exercícios personalizados',
        ),
      ].join(', '),
    ],
    ['Descanso', plural(c.sleep, 'noite registrada', 'noites registradas')],
    [
      'Conhecimento',
      [
        plural(c.books, 'livro', 'livros'),
        plural(c.readings, 'leitura', 'leituras'),
      ].join(', '),
    ],
    [
      'Quests',
      [
        plural(c.goals, 'quest', 'quests'),
        plural(c.goalUpdates, 'atualização', 'atualizações'),
        plural(c.missionEvents, 'missão histórica', 'missões históricas'),
      ].join(', '),
    ],
  ];
}

/**
 * Backup manual entre dispositivos. Exporta somente o estado confirmado no
 * IndexedDB e restaura por substituição completa, após validação e prévia.
 * Não sincroniza dispositivos nem usa servidor.
 */
export function DataBackup({
  readSource,
  beginImport,
  onImport,
  onImported,
  download = downloadRaw,
  now = () => new Date(),
}: {
  readSource: () => Promise<string>;
  beginImport: () => { expected: string | null };
  onImport: (
    data: PlayerState,
    expected: string | null,
  ) => Promise<BackupImportOutcome>;
  onImported?: () => void;
  download?: (raw: string, fileName: string) => void;
  now?: () => Date;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importTrigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  useLayoutEffect(() => {
    // Como em ConfirmAction: foco na opção segura ao abrir; ao fechar, de
    // volta ao gatilho de importação.
    if (pending) cancel.current?.focus();
    else if (returnFocus.current) importTrigger.current?.focus();
    returnFocus.current = false;
  }, [pending]);
  const busy = status !== 'idle';

  async function exportData() {
    setMessage(null);
    setStatus('exporting');
    try {
      const raw = await readSource();
      const file = createBackupFile(raw, now());
      download(file.content, file.fileName);
      setMessage({
        text: `Download de ${file.fileName} iniciado, com ${plural(total(file.counts), 'registro', 'registros')}. O arquivo contém seus dados pessoais e financeiros: guarde-o em local seguro.`,
        error: false,
      });
    } catch (error) {
      setMessage({
        text: errorText(
          error,
          'Não foi possível exportar o backup. Nenhum dado foi alterado.',
        ),
        error: true,
      });
    } finally {
      setStatus('idle');
    }
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Permite escolher o mesmo arquivo de novo após cancelar ou corrigir.
    event.target.value = '';
    if (!file) return;
    setMessage(null);
    setPending(null);
    let expected: string | null;
    try {
      // A revisão é fixada antes da leitura: qualquer gravação posterior,
      // nesta ou em outra aba, transforma a confirmação em conflito.
      ({ expected } = beginImport());
    } catch (error) {
      setMessage({
        text: errorText(error, 'Não é possível importar agora.'),
        error: true,
      });
      return;
    }
    if (file.size > BACKUP_MAX_BYTES) {
      setMessage({ text: backupProblemMessages['too-large'], error: true });
      return;
    }
    setStatus('reading');
    try {
      const parsed = parseBackupFile(await readFileText(file), file.size);
      if (!parsed.ok) {
        setMessage({
          text: `${parsed.message} Nenhum dado foi alterado.`,
          error: true,
        });
        return;
      }
      setPending({
        data: parsed.data,
        preview: parsed.preview,
        expected,
        fileName: file.name,
      });
    } catch {
      setMessage({
        text: 'Não foi possível ler o arquivo selecionado. Nenhum dado foi alterado.',
        error: true,
      });
    } finally {
      setStatus('idle');
    }
  }

  function close(text: string, error: boolean) {
    returnFocus.current = true;
    setPending(null);
    setMessage({ text, error });
  }

  async function restore() {
    if (!pending) return;
    setStatus('restoring');
    try {
      const outcome = await onImport(pending.data, pending.expected);
      close(outcomeMessages[outcome], outcome !== 'saved');
      if (outcome === 'saved' || outcome === 'reload') onImported?.();
    } catch (error) {
      close(errorText(error, outcomeMessages.failed), true);
    } finally {
      setStatus('idle');
    }
  }

  return (
    <section
      className="panel record-section data-backup"
      aria-labelledby="data-backup-title"
      aria-busy={busy || undefined}
    >
      <h2 id="data-backup-title">Backup de dados</h2>
      <p className="record-hint">
        Os dispositivos não são sincronizados automaticamente. Para usar seus
        registros em outro computador ou celular, exporte um backup aqui e
        importe o arquivo no outro dispositivo. Tudo acontece neste navegador,
        sem servidor.
      </p>
      <div className="data-backup__options">
        <div className="data-backup__option">
          <h3>Exportar backup</h3>
          <p className="record-hint">
            Salve uma cópia dos seus dados para guardar ou transferir para outro
            dispositivo.
          </p>
          <ActionButton
            icon="download"
            disabled={busy || pending !== null}
            onClick={() => void exportData()}
          >
            {status === 'exporting' ? 'Exportando…' : 'Exportar dados'}
          </ActionButton>
        </div>
        <div className="data-backup__option">
          <h3>Importar backup</h3>
          <p className="record-hint" id="data-backup-import-hint">
            Restaure seus registros a partir de um arquivo de backup do Life
            RPG.
          </p>
          <ActionButton
            ref={importTrigger}
            icon="upload"
            aria-describedby="data-backup-import-hint"
            disabled={busy || pending !== null}
            onClick={() => fileInput.current?.click()}
          >
            {status === 'reading' ? 'Lendo arquivo…' : 'Importar dados'}
          </ActionButton>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="data-backup__file"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void selectFile(event)}
          />
        </div>
      </div>
      {pending && (
        <div
          className="strength-confirm data-backup__confirm"
          role="group"
          aria-labelledby="data-backup-preview-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && status !== 'restoring')
              close('Importação cancelada. Nenhum dado foi alterado.', false);
          }}
        >
          <h3 id="data-backup-preview-title">Prévia do backup</h3>
          <p className="record-hint">
            {pending.fileName} · {size(pending.preview.bytes)} ·{' '}
            {plural(total(pending.preview.counts), 'registro', 'registros')}
          </p>
          <dl className="data-backup__preview">
            {previewRows(pending.preview).map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="data-backup__warning">{RESTORE_WARNING}</p>
          <button
            type="button"
            className="record-primary"
            disabled={status === 'restoring'}
            onClick={() => void restore()}
          >
            {status === 'restoring' ? 'Restaurando…' : 'Restaurar backup'}
          </button>
          <button
            ref={cancel}
            type="button"
            className="filter-button"
            disabled={status === 'restoring'}
            onClick={() =>
              close('Importação cancelada. Nenhum dado foi alterado.', false)
            }
          >
            Cancelar
          </button>
        </div>
      )}
      {/* Mesmo padrão de StorageBackups: a mensagem só existe quando há algo a
          anunciar, sem uma segunda região de status vazia no Perfil. */}
      {message && (
        <p
          className={message.error ? 'record-error' : 'record-feedback'}
          role={message.error ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
