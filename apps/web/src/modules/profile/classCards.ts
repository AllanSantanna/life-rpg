import { CLASS_RULES, classCatalog, type ClassId } from './classes';
import type { MissionCategory } from '../missions/types';
import {
  characterCard,
  characterNames,
  portraitStages,
  stageLevels,
  stageNumerals,
  type PortraitCharacter,
  type PortraitStage,
} from './portraits';

/** Carta da galeria: a mesma arte do retrato (`characterCard`). */
export function classCard(character: PortraitCharacter, stage: PortraitStage) {
  return characterCard(character, stage);
}

/** "Nível 1 a 4" / "Nível 20 ou superior", from the same table as the portraits. */
export function stageRequirement(stage: PortraitStage) {
  const { min, max } = stageLevels[stage];
  return max === null ? `Nível ${min} ou superior` : `Nível ${min} a ${max}`;
}
export function stageTitle(stage: PortraitStage) {
  return `${stageNumerals[stage]} · ${portraitStages[stage]}`;
}

const rules = CLASS_RULES;
const tieOrder = (Object.keys(classCatalog) as ClassId[])
  .filter((id) => classCatalog[id].pillar !== null)
  .map((id) => classCatalog[id].name)
  .join(', ');
const pillarRule = (pillar: MissionCategory) => [
  `${pillar} precisa ter a maior pontuação do Radar nos últimos ${rules.period} dias (hoje e os ${rules.period - 1} anteriores).`,
  'A classe é atualizada automaticamente a cada registro, edição ou exclusão, sem pontuação mínima.',
  `Em empate, a classe atual é mantida se estiver entre os líderes; caso contrário, vale a ordem ${tieOrder}.`,
  'Quando os critérios de Mestre são atendidos, Mestre tem prioridade.',
];

export interface VisualClass {
  character: PortraitCharacter;
  /** Real class id; `null` only for the Aventureiro visual fallback. */
  classId: ClassId | null;
  name: string;
  pillar: string;
  /** Pillar used by the existing `data-area` colour tokens, when there is one. */
  area: MissionCategory | null;
  description: string;
  rules: string[];
}

function realClass(
  classId: ClassId,
  character: PortraitCharacter,
): VisualClass {
  const entry = classCatalog[classId];
  return {
    character,
    classId,
    name: entry.name,
    pillar: entry.pillar ?? 'Equilíbrio entre os quatro pilares',
    area: entry.pillar,
    description: entry.description,
    rules: entry.pillar
      ? pillarRule(entry.pillar)
      : [
          `Mínimo de ${rules.masterScore}/100 em cada pilar no Radar dos últimos ${rules.period} dias.`,
          `Diferença máxima de ${rules.masterSpread} pontos entre o pilar mais alto e o mais baixo.`,
          `Pelo menos ${rules.masterDays} dias com atividade, num intervalo de ${rules.masterSpan} dias ou mais entre o primeiro e o último.`,
          `Cada pilar com atividade em pelo menos ${rules.masterPillarDays} dias e em ${rules.masterPillarWeeks} blocos semanais, contados para trás a partir de hoje.`,
          'Equilíbrio com pouca atividade não basta: todos os critérios precisam ser atendidos ao mesmo tempo.',
        ],
  };
}

/** Gallery order: the visual fallback first, then the real catalog. */
export const visualClasses: readonly VisualClass[] = [
  {
    character: 'aventureiro',
    classId: null,
    name: characterNames.aventureiro,
    pillar: 'Sem classe definida',
    area: null,
    description:
      'Representação visual do personagem enquanto nenhuma classe está definida.',
    rules: [
      `Exibido quando nenhum dos quatro pilares tem pontuação no Radar dos últimos ${rules.period} dias.`,
      'Não é uma classe do sistema: a ficha mostra “Sem classe definida”.',
      'O primeiro registro pontuado atribui automaticamente a classe do pilar líder.',
    ],
  },
  realClass('warrior', 'guerreiro'),
  realClass('strategist', 'estrategista'),
  realClass('guardian', 'guardiao'),
  realClass('sage', 'sabio'),
  realClass('master', 'mestre'),
];

export function visualClass(character: string | null | undefined) {
  return visualClasses.find((entry) => entry.character === character) ?? null;
}
