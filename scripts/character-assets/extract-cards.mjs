/**
 * Extrai as 24 cartas de personagens (6 classes × 4 estágios) da prancha de
 * fantasia sombria, sem textos, para `apps/web/src/modules/profile/assets/cards`.
 *
 * Uso: node scripts/character-assets/extract-cards.mjs [prancha.png]
 * Padrão: apps/web/src/modules/profile/assets/previews/characters-sheet.png
 *
 * A prancha (1448 × 1086) tem 4 linhas e 8 colunas sobre fundo preto. As três
 * primeiras trazem duas classes cada, quatro estágios, na ordem da prancha
 * rotulada aprovada. A quarta linha (versões alternativas de Sábio e Mestre)
 * não foi escolhida pelo usuário em 24/11/2026 e não é extraída. Reaproveita o recorte das conquistas: o fundo preto é
 * removido a partir das bordas da área de busca, com alfa suave no brilho
 * externo; o interior da carta (personagem, cenário e moldura) fica intacto.
 * Nenhum pixel é reamostrado.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import {
  compose,
  extractObject,
  prepare,
} from '../achievement-assets/extract.mjs';
import { encodeWebp, launchBrowser } from '../achievement-assets/cdp.mjs';
import { decodePng } from '../achievement-assets/png.mjs';
import { writeFormatted } from '../achievement-assets/write-formatted.mjs';

const ASSETS = resolve('apps/web/src/modules/profile/assets');
const SHEET = join(ASSETS, 'previews', 'characters-sheet.png');
const WEBP_QUALITY = 0.9;

/**
 * Colunas e linhas medidas na prancha de 1448 × 1086 (pixels claros, limiar 120;
 * os vãos entre linhas têm 2–4 px, então a folga de busca é pequena).
 */
const SHEET_SIZE = [1448, 1086];
const COLUMNS = [
  [13, 197],
  [204, 376],
  [384, 556],
  [562, 730],
  [737, 908],
  [914, 1084],
  [1091, 1260],
  [1267, 1440],
];
const ROWS = [
  [6, 264],
  [269, 527],
  [531, 786],
  // [789, 1047]: alternativas de Sábio e Mestre, não usadas.
];
/** Duas classes por linha: colunas 0–3 e 4–7. */
const LAYOUT = [
  ['aventureiro', 'guerreiro'],
  ['estrategista', 'guardiao'],
  ['sabio', 'mestre'],
];
/** Folga além dos pixels claros, limitada pelos vãos estreitos da prancha. */
const MARGIN_X = 3;
const MARGIN_Y = 2;

const HALO =
  'Halo tênue do brilho original fora da moldura, visível só sobre fundos claros; invisível nos fundos escuros do Life RPG.';
const GOLD_FRAME =
  'Nesta prancha a moldura do estágio IV é dourada, não vermelha como os demais estágios do Guerreiro.';
/** Revisão visual (quadriculado e fundo escuro, 2×). Ausentes: `ready`. */
const REVIEW = {
  'guerreiro-nivel-4': ['review', `${HALO} ${GOLD_FRAME}`],
  'estrategista-nivel-4': ['review', HALO],
  'guardiao-nivel-4': ['review', HALO],
  'mestre-nivel-4': ['review', HALO],
};

export const CARDS = LAYOUT.flatMap((pair, row) =>
  pair.flatMap((character, half) =>
    [1, 2, 3, 4].map((stage) => {
      const [x0, x1] = COLUMNS[half * 4 + stage - 1];
      const [y0, y1] = ROWS[row];
      return {
        id: `${character}-nivel-${stage}`,
        character,
        stage,
        rect: [
          Math.max(0, x0 - MARGIN_X),
          Math.max(0, y0 - MARGIN_Y),
          Math.min(SHEET_SIZE[0], x1 + 1 + MARGIN_X),
          Math.min(SHEET_SIZE[1], y1 + 1 + MARGIN_Y),
        ],
        mode: 'object',
        square: false,
        padding: 2,
      };
    }),
  ),
);

async function main() {
  const sheetPath = resolve(process.argv[2] ?? SHEET);
  const sheetBytes = readFileSync(sheetPath);
  const sheet = decodePng(sheetBytes);
  if (sheet.width !== SHEET_SIZE[0] || sheet.height !== SHEET_SIZE[1])
    throw new Error(`prancha inesperada: ${sheet.width}×${sheet.height}`);
  if (sheetPath !== SHEET) {
    mkdirSync(dirname(SHEET), { recursive: true });
    copyFileSync(sheetPath, SHEET);
  }
  const browser = await launchBrowser();
  const report = [];
  try {
    for (const card of CARDS) {
      const region = prepare(sheet, card.rect);
      const result = extractObject(region, card);
      const { image, content } = compose(region, result.alpha, card);
      const directory = join(ASSETS, 'cards', card.character);
      mkdirSync(directory, { recursive: true });
      const webp = await encodeWebp(browser, image, WEBP_QUALITY);
      writeFileSync(join(directory, `${card.id}.webp`), webp);
      report.push({
        id: card.id,
        character: card.character,
        stage: card.stage,
        width: image.width,
        height: image.height,
        bytes: webp.length,
        sha256: createHash('sha256').update(webp).digest('hex'),
        status: REVIEW[card.id]?.[0] ?? 'ready',
        notes: REVIEW[card.id] ? [REVIEW[card.id][1]] : [],
        sourceRect: content,
        touchesSearchEdge: result.touchesEdge,
        discardedFragments: result.discarded.length,
      });
      console.log(
        `${card.id.padEnd(22)} ${image.width}×${image.height} ${webp.length} B ${result.touchesEdge.join(',')}`,
      );
    }
  } finally {
    await browser.close();
  }
  await writeFormatted(
    join(ASSETS, 'previews', 'characters-report.json'),
    JSON.stringify({
      sheet: {
        file: 'characters-sheet.png',
        width: sheet.width,
        height: sheet.height,
        sha256: createHash('sha256').update(sheetBytes).digest('hex'),
      },
      settings: { MARGIN_X, MARGIN_Y, WEBP_QUALITY, padding: 2 },
      cards: report,
    }),
  );
}

await main();
