import { normalizedName } from '../catalog';
import type { Exercise, Muscle } from '../types';

/**
 * Grupos exibidos pelo mapa. Os 12 primeiros são os grupos persistidos
 * (`Muscle`); Lombar, Adutores e Abdutores existem apenas nesta projeção
 * somente leitura, sem alterar o contrato salvo de exercícios e sessões.
 */
export const mapGroupLabels = {
  chest: 'Peito',
  back: 'Costas',
  lowerBack: 'Lombar',
  trapezius: 'Trapézio',
  shoulders: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebraços',
  core: 'Abdômen',
  glutes: 'Glúteos',
  quadriceps: 'Quadríceps',
  hamstrings: 'Posteriores de coxa',
  adductors: 'Adutores',
  abductors: 'Abdutores',
  calves: 'Panturrilhas',
} as const satisfies Record<Muscle, string> & Record<string, string>;
export type MapGroup = keyof typeof mapGroupLabels;
export const mapGroups = Object.keys(mapGroupLabels) as MapGroup[];
export const isMapGroup = (value: string): value is MapGroup =>
  Object.hasOwn(mapGroupLabels, value);

/**
 * Principal: músculo-alvo. Secundário: participa ativamente do movimento.
 * Estabilizador: controla postura, articulação ou pelve; é rastreado, mas não
 * vira série equivalente nem carga de recuperação.
 */
export type ParticipationRole = 'primary' | 'secondary' | 'stabilizer';
export const roleLabels: Record<ParticipationRole, string> = {
  primary: 'Principal',
  secondary: 'Secundário',
  stabilizer: 'Estabilizador',
};
export interface Participation {
  group: MapGroup;
  role: ParticipationRole;
  reason: string;
  /** `review`: tabela revisada do catálogo; `record`: snapshot salvo na sessão. */
  source: 'review' | 'record';
}

const primaryReason = 'Exercício direcionado a este grupo muscular.';
const secondaryReasons: Record<MapGroup, string> = {
  chest: 'Adução horizontal do ombro auxilia o movimento.',
  back: 'Dorsais e romboides auxiliam a extensão e a adução do ombro.',
  lowerBack:
    'Eretores da coluna sustentam o tronco contra o momento de flexão do quadril sob carga.',
  trapezius: 'Trapézio participa da elevação e da rotação da escápula.',
  shoulders: 'Deltoides auxiliam a flexão ou a abdução do ombro.',
  biceps: 'Flexão do cotovelo durante a puxada.',
  triceps: 'Extensão do cotovelo durante o empurrar.',
  forearms: 'Flexores do punho e dos dedos sustentam a pegada sob carga.',
  core: 'Musculatura do tronco participa ativamente do movimento.',
  glutes: 'Extensão do quadril.',
  quadriceps: 'Extensão do joelho.',
  hamstrings: 'Extensão do quadril.',
  adductors:
    'Adutor magno contribui para a extensão do quadril em flexão profunda.',
  abductors: 'Abdutores do quadril participam ativamente do movimento.',
  calves: 'Flexão plantar do tornozelo.',
};
const stabilizerReasons: Partial<Record<MapGroup, string>> = {
  core: 'Estabilização do tronco durante o movimento.',
  lowerBack:
    'Eretores mantêm a coluna neutra, com contração predominantemente isométrica.',
  abductors: 'Glúteo médio e mínimo controlam a pelve no apoio unilateral.',
  adductors:
    'Controle do joelho e da pelve no plano frontal em apoio unilateral.',
  shoulders: 'Estabilização da articulação do ombro.',
  trapezius: 'Sustenta a cintura escapular contra a carga.',
  back: 'Dorsais mantêm a barra próxima ao corpo, sem mover o ombro.',
  forearms: 'Pegada isométrica para sustentar o corpo ou a carga.',
};
const stabilizerFallback = 'Estabilização articular ou postural.';

interface Review {
  primary: MapGroup;
  secondary?: MapGroup[];
  stabilizers?: MapGroup[];
  reasons?: Partial<Record<MapGroup, string>>;
}
// Decisão de produto (25/11/2026): nos agachamentos bilaterais, glúteo médio e
// mínimo são estabilizadores (peso 0): só rastreados, sem séries equivalentes.
const squat = (stabilizers: MapGroup[], adductors = true): Review => ({
  primary: 'quadriceps',
  secondary: adductors ? ['glutes', 'adductors'] : ['glutes'],
  stabilizers: [...stabilizers, 'abductors'],
  reasons: {
    abductors:
      'Glúteo médio e mínimo estabilizam a pelve e o alinhamento do joelho no plano frontal.',
  },
});
const unilateral: Review = {
  primary: 'quadriceps',
  secondary: ['glutes'],
  stabilizers: ['abductors', 'adductors'],
};
const hinge = (stabilizers: MapGroup[]): Review => ({
  primary: 'hamstrings',
  secondary: ['glutes', 'lowerBack'],
  stabilizers,
});

/**
 * Revisão biomecânica do catálogo (ver README). Só entram exercícios cuja
 * classificação mudou ou ganhou estabilizadores; os demais usam o snapshot.
 * IDs sem revisão (inclusive exercícios próprios) nunca recebem papéis novos.
 */
export const reviewedParticipation: Readonly<Record<string, Review>> = {
  squat: squat(['core', 'lowerBack']),
  'library:front-squat': squat(['core', 'lowerBack']),
  'library:goblet-squat': squat(['core', 'lowerBack']),
  'library:smith-squat': squat(['lowerBack']),
  'library:hack-squat': squat([]),
  'library:bodyweight-squat': squat(['core'], false),
  'library:bulgarian-squat': unilateral,
  'library:lunge': unilateral,
  'library:step-up': {
    primary: 'quadriceps',
    secondary: ['glutes'],
    stabilizers: ['abductors'],
  },
  deadlift: {
    ...hinge(['core', 'back', 'trapezius']),
    secondary: ['glutes', 'lowerBack', 'forearms'],
  },
  'library:rdl': hinge(['core', 'forearms']),
  'library:stiff': hinge(['core', 'forearms']),
  'library:dumbbell-stiff': hinge(['core', 'forearms']),
  'library:good-morning': hinge(['core']),
  'library:sumo-deadlift': {
    primary: 'glutes',
    secondary: ['hamstrings', 'quadriceps', 'adductors', 'lowerBack'],
    stabilizers: ['core', 'forearms'],
    reasons: {
      adductors:
        'Base afastada: o adutor magno contribui para a extensão do quadril abduzido.',
    },
  },
  'library:back-extension': {
    primary: 'lowerBack',
    secondary: ['glutes', 'hamstrings'],
  },
  'library:adductor': { primary: 'adductors' },
  'library:abductor': {
    primary: 'abductors',
    secondary: ['glutes'],
    reasons: {
      glutes: 'Fibras superiores do glúteo máximo também abduzem o quadril.',
    },
  },
  row: {
    primary: 'back',
    secondary: ['biceps', 'forearms'],
    stabilizers: ['lowerBack'],
  },
  'library:tbar-row': {
    primary: 'back',
    secondary: ['biceps', 'forearms'],
    stabilizers: ['lowerBack'],
  },
  'library:upright-row': {
    primary: 'shoulders',
    secondary: ['trapezius'],
  },
  'library:farmer-walk': {
    primary: 'forearms',
    stabilizers: ['core', 'trapezius'],
    reasons: {
      core: 'Oblíquos e eretores evitam a inclinação lateral do tronco ao caminhar.',
    },
  },
  'library:plank': {
    primary: 'core',
    stabilizers: ['shoulders'],
  },
  'library:pushup': {
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    stabilizers: ['core'],
    reasons: {
      core: 'Mantém o corpo alinhado em prancha durante a flexão.',
    },
  },
  'library:hanging-leg-raise': {
    primary: 'core',
    stabilizers: ['forearms'],
  },
};

/**
 * IDs revisados que atribuem algum papel ao grupo. Para grupos que só existem
 * no mapa (sem `Muscle` correspondente), são os únicos exercícios capazes de
 * identificá-los: exercícios próprios usam apenas os grupos do cadastro.
 */
export function reviewedExerciseIds(group: MapGroup): string[] {
  return Object.entries(reviewedParticipation)
    .filter(
      ([, review]) =>
        review.primary === group ||
        review.secondary?.includes(group) ||
        review.stabilizers?.includes(group),
    )
    .map(([id]) => id);
}
// Encolhimentos antigos foram salvos como Costas antes do grupo Trapézio.
const trapeziusReclassified = new Set(['shrug', 'barbell-shrug']);
function recordedPrimary(exercise: Exercise): Muscle {
  return exercise.primary === 'back' &&
    (trapeziusReclassified.has(exercise.id) ||
      normalizedName(exercise.name).startsWith('encolhimento'))
    ? 'trapezius'
    : exercise.primary;
}

/**
 * Papéis de cada grupo para um exercício registrado. Determinístico, sem
 * duplicar grupos: um grupo aparece uma única vez, com o papel mais forte.
 */
export function exerciseParticipation(exercise: Exercise): Participation[] {
  const review = reviewedParticipation[exercise.id];
  const result: Participation[] = [];
  const add = (
    group: MapGroup,
    role: ParticipationRole,
    source: Participation['source'],
    reason?: string,
  ) => {
    if (!isMapGroup(group) || result.some((p) => p.group === group)) return;
    result.push({
      group,
      role,
      source,
      reason:
        reason ??
        (role === 'primary'
          ? primaryReason
          : role === 'secondary'
            ? secondaryReasons[group]
            : (stabilizerReasons[group] ?? stabilizerFallback)),
    });
  };
  if (review) {
    add(review.primary, 'primary', 'review', review.reasons?.[review.primary]);
    for (const group of review.secondary ?? [])
      add(group, 'secondary', 'review', review.reasons?.[group]);
    for (const group of review.stabilizers ?? [])
      add(group, 'stabilizer', 'review', review.reasons?.[group]);
    return result;
  }
  add(recordedPrimary(exercise), 'primary', 'record');
  for (const group of exercise.secondary) add(group, 'secondary', 'record');
  return result;
}
