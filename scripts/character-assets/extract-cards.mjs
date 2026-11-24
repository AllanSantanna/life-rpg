/**
 * Extrai as 24 cartas de personagens (6 classes × 4 estágios) da prancha de
 * fantasia sombria, sem textos, para `apps/web/src/modules/profile/assets/cards`.
 *
 * Uso: node scripts/character-assets/extract-cards.mjs [prancha.png]
 * Padrão: apps/web/src/modules/profile/assets/previews/characters-sheet.png
 *
 * A prancha (1536 × 1024) tem 3 linhas e 8 colunas sobre fundo preto. Cada
 * linha traz duas classes, quatro estágios cada, na mesma ordem da prancha
 * rotulada aprovada. Reaproveita o recorte das conquistas: o fundo preto é
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

/** Colunas e linhas medidas na prancha (pixels claros, limiar 60). */
const COLUMNS = [
  [24, 203],
  [217, 390],
  [402, 576],
  [586, 764],
  [782, 953],
  [966, 1140],
  [1153, 1327],
  [1338, 1514],
];
const ROWS = [
  [51, 309],
  [319, 581],
  [596, 868],
];
/** Duas classes por linha: colunas 0–3 e 4–7. */
const LAYOUT = [
  ['aventureiro', 'guerreiro'],
  ['estrategista', 'guardiao'],
  ['sabio', 'mestre'],
];
/** Folga além dos pixels claros para incluir o brilho externo da moldura. */
const MARGIN = 6;

const HALO =
  'Halo tênue do brilho original fora da moldura, visível só sobre fundos claros; invisível nos fundos escuros do Life RPG.';
const HANDS =
  'Mãos com anatomia incorreta na arte original (apontado na revisão do usuário em 24/11/2026). Recorte limpo, mas a ilustração precisa ser gerada novamente; não foi repintada para não inventar detalhes.';
/**
 * Revisão visual (quadriculado e fundo escuro, 2×) e do usuário. Ausentes:
 * `ready`. `regenerate` continua integrado até a nova arte ser fornecida.
 */
const REVIEW = {
  'aventureiro-nivel-4': ['review', HALO],
  'sabio-nivel-3': ['review', HALO],
  'sabio-nivel-4': ['review', HALO],
  'estrategista-nivel-1': ['regenerate', HANDS],
  'estrategista-nivel-3': ['regenerate', HANDS],
  'sabio-nivel-1': ['regenerate', HANDS],
  'sabio-nivel-2': ['regenerate', HANDS],
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
        rect: [x0 - MARGIN, y0 - MARGIN, x1 + 1 + MARGIN, y1 + 1 + MARGIN],
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
  if (sheet.width !== 1536 || sheet.height !== 1024)
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
      settings: { MARGIN, WEBP_QUALITY, padding: 2 },
      cards: report,
    }),
  );
}

await main();
