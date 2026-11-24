/**
 * Inventário da prancha de referência de conquistas (1536 × 1024 px).
 *
 * `rect` é a área de busca [x0, y0, x1, y1) na prancha, excluindo a legenda do
 * arquivo. `mode` define a extração: `object` (medalhas e peças opacas, com
 * fundo removido por preenchimento a partir das bordas) ou `light` (efeitos
 * luminosos, com alfa calculado pela luz emitida sobre o fundo escuro).
 * `holes` são pontos relativos ao `rect` de fundos internos que devem ficar
 * transparentes (por exemplo, o centro vazio das molduras).
 *
 * `status` e `notes` registram a revisão visual feita após a extração; a
 * validação automática pode rebaixar o estado, nunca promovê-lo.
 */

const FRAME_Y = [91, 228];
const BADGE_Y = [94, 226];
const PILLAR_Y = [288, 394];
const UTILITY_Y = [292, 382];
const SPECIFIC_ROW_1 = [458, 560];
const SPECIFIC_ROW_2 = [577, 688];
const EFFECT_Y = [748, 840];

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_NAMES = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Rara',
  epic: 'Épica',
  legendary: 'Lendária',
};

const around = (cx, half, [y0, y1]) => [cx - half, y0, cx + half, y1];

const frames = [107, 265, 422, 578, 735].map((cx, index) => ({
  id: `frame-${RARITIES[index]}`,
  name: `Moldura ${RARITY_NAMES[RARITIES[index]]}`,
  category: 'frames',
  rarity: RARITIES[index],
  source: `frame_${RARITIES[index]}.png`,
  // O título da seção termina em x≈330; à direita dele, a busca sobe mais.
  rect: around(cx, 78, cx > 400 ? [76, FRAME_Y[1]] : FRAME_Y),
  mode: 'object',
  holes: [[78, 70]],
  // O reflexo interno das molduras mais luminosas é mais intenso.
  ...(index >= 3 ? { holeDistance: 75 } : {}),
}));

const badges = [927, 1058, 1190, 1324, 1460].map((cx, index) => ({
  id: `badge-${RARITIES[index]}`,
  name: `Medalha ${RARITY_NAMES[RARITIES[index]]}`,
  category: 'badges',
  rarity: RARITIES[index],
  source: `badge_${RARITIES[index]}.png`,
  rect: around(cx, 68, cx > 1250 ? [80, BADGE_Y[1]] : BADGE_Y),
  mode: 'object',
}));

const pillarIcons = [
  ['training', 'Treinos', 105, 'training'],
  ['knowledge', 'Conhecimento', 257, 'knowledge'],
  ['finances', 'Finanças', 398, 'finances'],
  ['rest', 'Descanso', 535, 'rest'],
  ['quests', 'Quests', 665, null],
  ['milestone', 'Marco especial', 793, null],
  ['achievement', 'Conquista especial', 921, null],
].map(([key, label, cx, pillar]) => ({
  id: `icon-${key}`,
  name: `Ícone ${label}`,
  category: 'icons',
  pillar,
  source: `icon_${key === 'finances' ? 'finance' : key === 'quests' ? 'quest' : key}.png`,
  rect: around(cx, 64, PILLAR_Y),
  mode: 'object',
}));

const utilityIcons = [
  ['locked', 'Bloqueada', 1072, 'object'],
  ['unlocked', 'Desbloqueada', 1170, 'object'],
  ['progress', 'Progresso', 1271, 'object'],
  ['completed', 'Concluída', 1378, 'object'],
  ['new', 'Nova', 1474, 'light'],
].map(([key, label, cx, mode]) => ({
  id: `ui-${key}`,
  name: `Indicador ${label}`,
  category: 'ui',
  source: `icon_${key}.png`,
  rect: around(cx, 48, UTILITY_Y),
  mode,
  ...(key === 'progress' ? { holes: [[48, 45]] } : {}),
  // Os cadeados ficam sobre um disco escuro de apresentação, que é descartado.
  ...(key === 'locked'
    ? {
        backgroundDistance: 48,
        holes: [
          [48, 26],
          [48, 30],
        ],
        holeDistance: 48,
      }
    : {}),
  ...(key === 'unlocked'
    ? { backgroundDistance: 40, holes: [[58, 18]], holeDistance: 40 }
    : {}),
}));

const PILLAR_NAMES = {
  training: ['treino', 'Treinos'],
  knowledge: ['conhecimento', 'Conhecimento'],
  finances: ['financas', 'Finanças'],
  rest: ['descanso', 'Descanso'],
};

function specificRow(pillar, centers, rowY) {
  return centers.map((cx, index) => {
    const number = String(index + 1).padStart(2, '0');
    const [sourceKey, label] = PILLAR_NAMES[pillar];
    // A prancha rotula a quarta medalha de Descanso como "05" (duplicado).
    const sourceNumber = pillar === 'rest' && index === 3 ? '05' : number;
    return {
      id: `achievement-${pillar}-${number}`,
      name: `Conquista ${label} ${number}`,
      category: 'specific',
      pillar,
      source: `conquista_${sourceKey}_${sourceNumber}.png`,
      rect: around(cx, 70, rowY),
      mode: 'object',
    };
  });
}

const specific = [
  ...specificRow('training', [99, 249, 397, 543, 689], SPECIFIC_ROW_1),
  ...specificRow('knowledge', [852, 1000, 1147, 1293, 1443], SPECIFIC_ROW_1),
  ...specificRow('finances', [99, 249, 397, 543, 689], SPECIFIC_ROW_2),
  ...specificRow('rest', [852, 1000, 1147, 1293, 1443], SPECIFIC_ROW_2),
];

const effects = [
  ['unlock', 'Desbloqueio', 87],
  ['shine', 'Brilho', 210],
  ['particles', 'Partículas', 335],
  ['levelup', 'Subida de nível', 450],
  ['glow', 'Louros luminosos', 568],
].map(([key, label, cx]) => ({
  id: `effect-${key}`,
  name: `Efeito ${label}`,
  category: 'effects',
  source: `effect_${key}.png`,
  rect: around(cx, 60, EFFECT_Y),
  mode: key === 'glow' ? 'object' : 'light',
}));

const labels = [
  ['common', 745, 772],
  ['uncommon', 887, 772],
  ['rare', 1036, 772],
  ['epic', 793, 834],
  ['legendary', 965, 834],
].map(([rarity, cx, cy]) => ({
  id: `label-${rarity}`,
  name: `Etiqueta ${RARITY_NAMES[rarity]}`,
  category: 'labels',
  rarity,
  source: `label_${rarity}.png`,
  // A etiqueta Lendária é mais larga; as demais ficam entre vizinhas próximas.
  rect:
    rarity === 'legendary'
      ? [cx - 78, cy - 22, cx + 78, cy + 21]
      : [cx - 72, cy - 20, cx + 72, cy + 19],
  mode: 'object',
  square: false,
}));

const decor = [
  {
    id: 'banner-achievement',
    name: 'Estandarte de conquista',
    source: 'banner_achievement.png',
    rect: [1180, 748, 1284, 836],
  },
  {
    id: 'laurel',
    name: 'Louros',
    source: 'laurel.png',
    rect: [1318, 752, 1424, 836],
  },
  {
    id: 'gem-red',
    name: 'Gema vermelha',
    source: 'gem_red.png',
    rect: [1444, 750, 1530, 836],
  },
].map((asset) => ({ ...asset, category: 'decor', mode: 'object' }));

export const ASSETS = [
  ...frames,
  ...badges,
  ...pillarIcons,
  ...utilityIcons,
  ...specific,
  ...effects,
  ...labels,
  ...decor,
];

/** Elementos identificados na prancha que não são extraídos como assets. */
export const NOT_EXTRACTED = [
  {
    element: 'Logotipo "LIFE RPG" com espada',
    reason:
      'Elemento de apresentação da prancha; a marca oficial já existe em apps/web/public/icons.',
  },
  {
    element: 'Botão "Pacote Completo (PNG)" e títulos das seções',
    reason: 'Texto de apresentação.',
  },
  {
    element: 'Paleta de raridades (cinco amostras)',
    reason:
      'Referência de cor, não ilustração; os valores ficam registrados em manifest.json.',
  },
  {
    element: 'Castelo com lua vermelha (canto inferior direito)',
    reason:
      'Cenário pintado sobre o fundo e a borda do painel, sem contorno separável; exigiria geração individual.',
  },
];

export const RARITY_PALETTE = {
  common: '#8B6A4A',
  uncommon: '#2E7D32',
  rare: '#2563EB',
  epic: '#7C3AED',
  legendary: '#D4AF37',
};

const HALO =
  'Halo leve do brilho original da prancha, visível sobre fundos claros; sem impacto sobre os fundos escuros do Life RPG.';
const LIGHT =
  'Alfa reconstruído a partir da luz emitida sobre o fundo escuro; fiel sobre fundos escuros, mais suave sobre fundos claros.';

/**
 * Revisão visual feita sobre preto, cinza e quadriculado, lado a lado com a
 * prancha. Assets ausentes daqui ficaram `ready` sem observações adicionais.
 */
export const REVIEW = {
  'frame-epic': { status: 'review', notes: [HALO] },
  'frame-legendary': {
    status: 'review',
    notes: [HALO, 'Resquício tênue do reflexo interno junto à gema inferior.'],
  },
  'badge-epic': { status: 'review', notes: [HALO] },
  'badge-legendary': { status: 'review', notes: [HALO] },
  ...Object.fromEntries(
    ['01', '02', '03', '04', '05'].flatMap((n) => [
      [`achievement-knowledge-${n}`, { status: 'review', notes: [HALO] }],
      [`achievement-rest-${n}`, { status: 'review', notes: [HALO] }],
    ]),
  ),
  'achievement-rest-04': {
    status: 'review',
    notes: [
      HALO,
      'A prancha rotula este arquivo como conquista_descanso_05 (duplicado); renumerado pela posição.',
    ],
  },
  'ui-locked': {
    status: 'ready',
    notes: ['O disco escuro de apresentação atrás do cadeado foi descartado.'],
  },
  'effect-unlock': { status: 'review', notes: [LIGHT] },
  'effect-shine': { status: 'review', notes: [LIGHT] },
  'effect-particles': { status: 'review', notes: [LIGHT] },
  'effect-levelup': { status: 'review', notes: [LIGHT] },
  'effect-glow': { status: 'review', notes: [HALO] },
  'ui-new': { status: 'ready', notes: [LIGHT] },
  laurel: { status: 'review', notes: [HALO] },
  'gem-red': {
    status: 'ready',
    notes: ['A borda do painel à direita foi detectada e descartada.'],
  },
  'label-common': {
    status: 'ready',
    notes: ['O texto em português faz parte da arte da etiqueta.'],
  },
  'label-uncommon': {
    status: 'ready',
    notes: ['O texto em português faz parte da arte da etiqueta.'],
  },
  'label-rare': {
    status: 'ready',
    notes: ['O texto em português faz parte da arte da etiqueta.'],
  },
  'label-epic': {
    status: 'ready',
    notes: ['O texto em português faz parte da arte da etiqueta.'],
  },
  'label-legendary': {
    status: 'ready',
    notes: ['O texto em português faz parte da arte da etiqueta.'],
  },
};

/** Observação comum a todos os assets, ligada à resolução da prancha. */
export const RESOLUTION_NOTE =
  'Resolução nativa da prancha (sem ampliação): nítido até cerca de metade da largura em px CSS em telas 2x; tamanhos maiores exigem geração individual.';
