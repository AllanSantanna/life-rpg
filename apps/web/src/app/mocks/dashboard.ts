import type { MetricSnapshot } from '../../shared/components/MetricCard';
import type { PlayerProfile } from '../../modules/profile/types';
import type {
  PlayerProgress,
  Attribute,
  Achievement,
} from '../../modules/gamification/types';
import type { Mission } from '../../modules/missions/types';

// Única fonte dos dados ilustrativos. Sem chamadas de API ou persistência.
export const player: PlayerProfile = {
  name: 'Allan',
  initials: 'AL',
  title: 'Explorador',
  journey: 'O caminho da constância',
  joined: 'Novembro de 2026',
  focus: 'Evoluir um pouco, todos os dias.',
};
export const initialProgress: PlayerProgress = {
  level: 12,
  xp: 1640,
  xpPerLevel: 2000,
};
export const attributes: Attribute[] = [
  {
    name: 'Força',
    value: 68,
    max: 100,
    icon: 'dumbbell',
    description: 'Corpo em movimento',
  },
  {
    name: 'Disciplina',
    value: 82,
    max: 100,
    icon: 'flame',
    description: 'Pequenas ações, todos os dias',
  },
  {
    name: 'Conhecimento',
    value: 54,
    max: 100,
    icon: 'book',
    description: 'Aprender para ir além',
  },
  {
    name: 'Riqueza',
    value: 46,
    max: 100,
    icon: 'wallet',
    description: 'Construindo o futuro',
  },
];
export const metrics: MetricSnapshot[] = [
  {
    id: 'finances',
    title: 'Finanças',
    icon: 'wallet',
    category: 'Seu patrimônio',
    value: '24.850',
    unit: 'BRL',
    change: '+8,2% neste mês',
    details: [
      { label: 'Investimentos', value: 'R$ 18.400' },
      { label: 'Meta de reserva', value: 'R$ 30.000' },
    ],
    progress: {
      label: 'Reserva de emergência',
      value: 24850,
      max: 30000,
      text: '83%',
    },
    trend: [25, 32, 28, 45, 42, 60, 72, 65, 90],
  },
  {
    id: 'workouts',
    title: 'Treinos',
    icon: 'dumbbell',
    category: 'Corpo & movimento',
    value: '3 de 4',
    unit: 'treinos / semana',
    change: '+1 treino vs. semana anterior',
    details: [
      { label: 'Volume semanal', value: '8.450 kg' },
      { label: 'Tempo em movimento', value: '3h 20min' },
    ],
    progress: { label: 'Frequência semanal', value: 3, max: 4, text: '75%' },
    trend: [35, 55, 20, 75, 30, 92, 55, 72, 88],
  },
  {
    id: 'rest',
    title: 'Descanso',
    icon: 'moon',
    category: 'Recupere sua energia',
    value: '7h 32',
    unit: 'média / noite',
    change: '+42 min vs. semana anterior',
    details: [
      { label: 'Meta de sono', value: '8h por noite' },
      { label: 'Consistência', value: '5 de 7 noites' },
    ],
    progress: { label: 'Consistência semanal', value: 5, max: 7, text: '71%' },
    trend: [45, 60, 55, 72, 62, 80, 74, 90, 83],
  },
  {
    id: 'knowledge',
    title: 'Conhecimento',
    icon: 'book',
    category: 'Expanda seus horizontes',
    value: '6h 15',
    unit: 'de estudo / semana',
    change: '+1h 30 vs. semana anterior',
    details: [
      { label: 'Leitura nesta semana', value: '84 páginas' },
      { label: 'Livro atual', value: 'Hábitos Atômicos' },
    ],
    progress: {
      label: 'Meta de estudo · 8h',
      value: 6.25,
      max: 8,
      text: '78%',
    },
    trend: [20, 40, 35, 50, 62, 55, 70, 82, 95],
  },
];
export const initialMissions: Mission[] = [
  {
    id: 'water',
    title: 'Comece com o essencial',
    description: 'Beber 2 litros de água ao longo do dia',
    category: 'Descanso',
    icon: 'moon',
    xp: 120,
    completed: true,
  },
  {
    id: 'workout',
    title: 'Um passo mais forte',
    description: 'Concluir o treino de hoje',
    category: 'Treinos',
    icon: 'dumbbell',
    xp: 150,
    completed: false,
  },
  {
    id: 'read',
    title: 'Alimente a sua mente',
    description: 'Ler 20 páginas do seu livro',
    category: 'Conhecimento',
    icon: 'book',
    xp: 100,
    completed: false,
  },
  {
    id: 'finance',
    title: 'Cada escolha conta',
    description: 'Revisar os gastos do dia',
    category: 'Finanças',
    icon: 'wallet',
    xp: 80,
    completed: false,
  },
  {
    id: 'sleep',
    title: 'Prepare o próximo capítulo',
    description: 'Desconectar das telas antes de dormir',
    category: 'Descanso',
    icon: 'moon',
    xp: 120,
    completed: false,
  },
];
export const achievements: Achievement[] = [
  {
    id: 'first',
    title: 'Primeiro passo',
    description: 'Sua primeira missão concluída.',
    tier: 'Nível I',
    icon: 'sword',
    unlocked: true,
    progress: 'Conquistada',
  },
  {
    id: 'consistent',
    title: 'Em chamas',
    description: '7 dias seguidos de constância.',
    tier: 'Nível II',
    icon: 'flame',
    unlocked: true,
    progress: 'Conquistada',
  },
  {
    id: 'reader',
    title: 'Mente curiosa',
    description: 'Concluir a leitura de 3 livros.',
    tier: 'Nível III',
    icon: 'book',
    unlocked: false,
    progress: '2 de 3 livros',
  },
  {
    id: 'balance',
    title: 'Em equilíbrio',
    description: 'Atingir as metas dos 4 pilares.',
    tier: 'Nível IV',
    icon: 'shield',
    unlocked: false,
    progress: '2 de 4 pilares',
  },
];
export const weeklyActivity = [
  { day: 'Seg', xp: 180 },
  { day: 'Ter', xp: 260 },
  { day: 'Qua', xp: 140 },
  { day: 'Qui', xp: 320 },
  { day: 'Sex', xp: 240 },
  { day: 'Sáb', xp: 400 },
  { day: 'Dom', xp: 120 },
];
