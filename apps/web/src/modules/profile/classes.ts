import { areas, scorePeriod, type EffortActivity } from '../evolution/scoring';
import type { MissionCategory } from '../missions/types';
import type { IconName } from '../../shared/components/Icon';

export const classCatalog = {
  warrior: {
    name: 'Guerreiro',
    icon: 'sword',
    description: 'Força construída com dedicação aos treinos.',
    pillar: 'Treinos',
  },
  sage: {
    name: 'Sábio',
    icon: 'book',
    description: 'O conhecimento transforma sua jornada.',
    pillar: 'Conhecimento',
  },
  strategist: {
    name: 'Estrategista',
    icon: 'target',
    description: 'Cuidado constante com a vida financeira.',
    pillar: 'Finanças',
  },
  guardian: {
    name: 'Guardião',
    icon: 'moon',
    description: 'Descansar também é uma forma de evoluir.',
    pillar: 'Descanso',
  },
  master: {
    name: 'Mestre',
    icon: 'trophy',
    description: 'Quatro pilares. Equilíbrio conquistado com constância.',
    pillar: null,
  },
} satisfies Record<
  string,
  {
    name: string;
    icon: IconName;
    description: string;
    pillar: MissionCategory | null;
  }
>;
export type ClassId = keyof typeof classCatalog;
export const CLASS_RULES = {
  period: 30,
  masterScore: 60,
  masterSpread: 20,
  masterDays: 14,
  masterSpan: 21,
  masterPillarDays: 6,
  masterPillarWeeks: 3,
} as const;
export interface ClassState {
  current: ClassId | null;
  changedOn: string | null;
  pending: { id: ClassId; since: string } | null;
}
export const initialClass = (): ClassState => ({
  current: null,
  changedOn: null,
  pending: null,
});
export function evaluateClass(
  activities: readonly EffortActivity[],
  state: ClassState,
  today: string,
) {
  const rules = CLASS_RULES;
  const recent = activities.filter(
    (a) =>
      Number.isInteger(a.daysAgo) &&
      a.daysAgo >= 0 &&
      a.daysAgo < rules.period &&
      Number.isFinite(a.effort) &&
      a.effort > 0,
  );
  const scores = scorePeriod(recent, rules.period);
  const days = [...new Set(recent.map((a) => a.daysAgo))];
  const span = days.length ? Math.max(...days) - Math.min(...days) + 1 : 0;
  const pillarDays = (area: MissionCategory) =>
    new Set(recent.filter((a) => a.area === area).map((a) => a.daysAgo)).size;
  const weeks = (area: MissionCategory) =>
    new Set(
      recent
        .filter((a) => a.area === area)
        .map((a) => Math.floor(a.daysAgo / 7)),
    ).size;
  const values = Object.values(scores);
  const master =
    days.length >= rules.masterDays &&
    span >= rules.masterSpan &&
    Math.min(...values) >= rules.masterScore &&
    Math.max(...values) - Math.min(...values) <= rules.masterSpread &&
    areas.every(
      (area) =>
        pillarDays(area) >= rules.masterPillarDays &&
        weeks(area) >= rules.masterPillarWeeks,
    );
  const highest = Math.max(...values);
  const leaders = (Object.keys(classCatalog) as ClassId[]).filter((id) => {
    const pillar = classCatalog[id].pillar;
    return pillar !== null && scores[pillar] === highest;
  });
  const candidate: ClassId | null = master
    ? 'master'
    : highest > 0
      ? state.current && leaders.includes(state.current)
        ? state.current
        : leaders[0]!
      : null;
  const reason =
    candidate === 'master'
      ? 'Equilíbrio confirmado: dedicação consistente nos quatro pilares.'
      : candidate
        ? `${classCatalog[candidate].pillar} lidera o Radar com ${highest} pontos.`
        : 'Registre uma atividade para definir sua classe pelas estatísticas.';
  const next =
    candidate === state.current && state.pending === null
      ? state
      : {
          current: candidate,
          changedOn: candidate === state.current ? state.changedOn : today,
          pending: null,
        };
  return { state: next, scores, candidate, reason, activeDays: days.length };
}
