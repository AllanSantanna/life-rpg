import { currentSessionStart } from './sessionTiming';
import type { AdvancedWorkoutCommand, AdvancedWorkoutState } from './types';

/** Sessões em andamento, da mais recente para a mais antiga. */
export function sessionsInProgress(state: AdvancedWorkoutState) {
  return state.sessions.filter((s) => s.status === 'in_progress').reverse();
}

/**
 * Início de treino a partir de uma ficha, compartilhado pela página Treinos e
 * pelas Ações rápidas. Se já houver sessão em andamento da mesma ficha, ela é
 * retomada e nenhum comando é gerado: não cria sessão duplicada.
 */
export function planStart(
  state: AdvancedWorkoutState,
  planId: string,
  today: string,
  newId: () => string = () => crypto.randomUUID(),
): {
  sessionId: string;
  command?: Extract<AdvancedWorkoutCommand, { type: 'startSession' }>;
} {
  const existing = state.sessions.findLast(
    (s) => s.status === 'in_progress' && s.planId === planId,
  );
  if (existing) return { sessionId: existing.id };
  const id = newId();
  const startedAt = currentSessionStart(today);
  return {
    sessionId: id,
    command: {
      type: 'startSession',
      id,
      planId,
      date: today,
      ...(startedAt !== undefined ? { startedAt } : {}),
    },
  };
}
