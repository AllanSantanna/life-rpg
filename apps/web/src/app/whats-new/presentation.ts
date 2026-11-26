import type { PlayerState } from '../playerState';
import { isNewerRelease } from './whatsNewPreference';

/**
 * Há sinais de uso anterior no estado carregado? Só leitura: nada é migrado,
 * regravado ou enviado. Cotações (gravadas automaticamente) não contam.
 */
export function hasPersonalHistory(state: PlayerState): boolean {
  const { records } = state;
  const finance = records.finance;
  const advanced = records.advancedWorkouts;
  return (
    records.movements.length > 0 ||
    records.investments.length > 0 ||
    records.investmentEntries.length > 0 ||
    records.workouts.length > 0 ||
    records.sleep.length > 0 ||
    records.books.length > 0 ||
    records.readings.length > 0 ||
    records.sleepGoalHours !== 8 ||
    (finance !== undefined &&
      (finance.accounts.length > 0 ||
        finance.transfers.length > 0 ||
        finance.valuations.length > 0 ||
        (finance.recurrences?.length ?? 0) > 0 ||
        (finance.budgets?.length ?? 0) > 0)) ||
    (advanced !== undefined &&
      (advanced.enabled ||
        advanced.plans.length > 0 ||
        advanced.sessions.length > 0)) ||
    state.goals.items.length > 0 ||
    state.missionEvents.length > 0 ||
    state.unlockedAchievementIds.length > 0 ||
    state.missionCompletion.some((mission) => mission.completed) ||
    state.profile.name !== 'Jogador'
  );
}

/**
 * - `show`: há novidades inéditas para quem já usava o aplicativo;
 * - `mark`: instalação nova; registra a versão atual sem abrir a janela;
 * - `none`: nada a fazer (já apresentada, sem catálogo ou preferência de uma
 *   versão posterior do aplicativo).
 */
export type WhatsNewDecision = 'show' | 'mark' | 'none';

export function whatsNewDecision({
  release,
  seen,
  existingUser,
}: {
  release: string | undefined;
  /** Última apresentada; `null` quando não há preferência gravada. */
  seen: string | null;
  existingUser: boolean;
}): WhatsNewDecision {
  if (release === undefined || !isNewerRelease(release, seen)) return 'none';
  // Preferência anterior prova uso anterior; sem ela, decidem os registros.
  if (seen !== null || existingUser) return 'show';
  return 'mark';
}

const editable =
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"]';
/**
 * Algo prioritário está acontecendo na tela? Modal aberto (formulário rápido,
 * comando por voz, confirmação, restauração de backup), janela não modal
 * (Ações rápidas, ajuda, conquista), lista suspensa, gravação em andamento,
 * campo em edição ou aba oculta. Nesses casos a apresentação é adiada.
 */
export function interfaceIsBusy(doc: Document = document): boolean {
  if (doc.visibilityState === 'hidden') return true;
  if (
    doc.querySelector(
      'dialog[open], [role="dialog"], [role="alertdialog"], .achievement-unlock, [aria-busy="true"], [role="listbox"]:not([aria-hidden="true"]), [role="menu"]:not([aria-hidden="true"])',
    )
  )
    return true;
  const active = doc.activeElement;
  return active instanceof HTMLElement && active.matches(editable);
}
