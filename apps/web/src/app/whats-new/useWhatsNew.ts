import { useCallback, useEffect, useRef, useState } from 'react';
import type { StateStorage } from '../../shared/storage/localStateStorage';
import { latestRelease, type Release } from './releases';
import { interfaceIsBusy, whatsNewDecision } from './presentation';
import {
  createWhatsNewStorage,
  isNewerRelease,
  type WhatsNewPreference,
} from './whatsNewPreference';

/** Espera após o carregamento, para a página assentar antes da janela. */
export const WHATS_NEW_DELAY_MS = 800;
/** Intervalo de nova verificação enquanto a interface estiver ocupada. */
export const WHATS_NEW_RETRY_MS = 1500;

type Stored =
  | { kind: 'ready'; seen: string | null }
  /** Sem armazenamento ou preferência de versão posterior: sem abertura automática. */
  | { kind: 'unavailable' };

function readPreference(
  storage: StateStorage<WhatsNewPreference> | null,
): Stored {
  if (!storage) return { kind: 'unavailable' };
  try {
    const result = storage.load();
    if (result.status === 'loaded')
      return { kind: 'ready', seen: result.data.seen };
    // Valor inválido é descartável (será substituído); sem valor, decide o uso.
    if (result.status === 'missing' || result.status === 'invalid')
      return { kind: 'ready', seen: null };
    return { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}

/**
 * Novidades da versão. A decisão é tomada uma única vez, quando os registros
 * já foram carregados e validados (`settled`), com base no estado daquele
 * momento: registros criados nesta sessão não transformam um usuário novo em
 * existente. A versão só é registrada ao fechar a janela (ou, numa instalação
 * nova, sem abri-la). Enquanto `blocked` ou a interface estiver ocupada, a
 * abertura é adiada e verificada de novo.
 */
export function useWhatsNew({
  settled,
  existingUser,
  blocked,
  storage: given,
  catalog,
  delayMs = WHATS_NEW_DELAY_MS,
  retryMs = WHATS_NEW_RETRY_MS,
}: {
  settled: boolean;
  existingUser: () => boolean;
  blocked: boolean;
  storage?: StateStorage<WhatsNewPreference>;
  catalog?: readonly Release[];
  delayMs?: number;
  retryMs?: number;
}) {
  const [release] = useState(() => latestRelease(catalog));
  const [storage] = useState(() => {
    try {
      return given ?? createWhatsNewStorage();
    } catch {
      return null;
    }
  });
  const [open, setOpen] = useState<'auto' | 'manual' | null>(null);
  const [pending, setPending] = useState(false);
  const decided = useRef(false);
  const existing = useRef(existingUser);
  existing.current = existingUser;

  const markSeen = useCallback(() => {
    if (!release || !storage) return;
    try {
      // Nunca regride: preferência igual ou posterior permanece como está.
      const stored = readPreference(storage);
      if (stored.kind === 'ready' && isNewerRelease(release.id, stored.seen))
        storage.save({ seen: release.id });
    } catch {
      // Sem armazenamento: vale apenas para esta sessão.
    }
  }, [release, storage]);

  useEffect(() => {
    if (!settled || decided.current) return;
    decided.current = true;
    const stored = readPreference(storage);
    if (stored.kind === 'unavailable') return;
    const decision = whatsNewDecision({
      release: release?.id,
      seen: stored.seen,
      existingUser: existing.current(),
    });
    if (decision === 'mark') markSeen();
    else if (decision === 'show') setPending(true);
  }, [settled, storage, release, markSeen]);

  useEffect(() => {
    if (!pending || open || blocked) return;
    let timer: number;
    const attempt = () => {
      if (interfaceIsBusy()) timer = window.setTimeout(attempt, retryMs);
      else {
        setPending(false);
        setOpen('auto');
      }
    };
    timer = window.setTimeout(attempt, delayMs);
    return () => window.clearTimeout(timer);
  }, [pending, open, blocked, delayMs, retryMs]);

  const openManually = useCallback(() => {
    if (release) setOpen('manual');
  }, [release]);
  const close = useCallback(() => {
    // Fechar por qualquer meio conta como apresentada.
    markSeen();
    setPending(false);
    setOpen(null);
  }, [markSeen]);

  return { release, open, openManually, close } as const;
}
