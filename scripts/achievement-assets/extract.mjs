/**
 * Extrai os assets de conquistas da prancha de referência.
 *
 * Uso: node scripts/achievement-assets/extract.mjs [prancha.png]
 * Padrão: apps/web/public/assets/achievements/previews/source-sheet.png
 *
 * Nenhum pixel é reamostrado: o recorte mantém a escala original, recebe
 * margem transparente e é centralizado. O fundo de apresentação é estimado
 * pelas bordas da área de busca e removido; as arestas recebem alfa suave
 * com descontaminação de cor. Gera PNG (sem perdas) e WebP (Canvas do
 * Chromium) e um relatório técnico consumido por build-manifest.mjs.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { ASSETS } from './assets.config.mjs';
import { launchBrowser, encodeWebp } from './cdp.mjs';
import { decodePng, encodePng } from './png.mjs';
import { writeFormatted } from './write-formatted.mjs';

export const OUTPUT = resolve('apps/web/public/assets/achievements');
const SHEET = join(OUTPUT, 'previews', 'source-sheet.png');
const WEBP_QUALITY = 0.9;

/** Distância de cor abaixo da qual o pixel é considerado fundo. */
const BACKGROUND_DISTANCE = 22;
/** Limiar maior para fundos internos, que recebem reflexo da moldura. */
const HOLE_DISTANCE = 55;
/** Meia largura, em px, das frestas que o preenchimento não atravessa. */
const CLOSE_GAPS = 2;
/** Largura, em px, da faixa de borda com alfa suave nos objetos. */
const EDGE_BAND = 3;
/** Excesso de luz (0–1) a partir do qual a borda fica opaca. */
const EDGE_OPAQUE = 0.22;
/** Ruído de textura do fundo ignorado nos efeitos luminosos. */
const LIGHT_FLOOR = 0.05;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
}

/** Recorta a área e estima o fundo por interpolação das medianas das bordas. */
function prepare(sheet, [x0, y0, x1, y1]) {
  const width = x1 - x0;
  const height = y1 - y0;
  const rgb = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = ((y0 + y) * sheet.width + x0 + x) * 4;
      const o = (y * width + x) * 3;
      rgb[o] = sheet.data[i];
      rgb[o + 1] = sheet.data[i + 1];
      rgb[o + 2] = sheet.data[i + 2];
    }
  }
  const side = (points) =>
    [0, 1, 2].map((c) =>
      median(points.map(([x, y]) => rgb[(y * width + x) * 3 + c])),
    );
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const top = side(
    range(width).flatMap((x) => [
      [x, 0],
      [x, 1],
    ]),
  );
  const bottom = side(
    range(width).flatMap((x) => [
      [x, height - 1],
      [x, height - 2],
    ]),
  );
  const left = side(
    range(height).flatMap((y) => [
      [0, y],
      [1, y],
    ]),
  );
  const right = side(
    range(height).flatMap((y) => [
      [width - 1, y],
      [width - 2, y],
    ]),
  );
  const background = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      for (let c = 0; c < 3; c += 1) {
        background[(y * width + x) * 3 + c] =
          ((1 - v) * top[c] +
            v * bottom[c] +
            (1 - u) * left[c] +
            u * right[c]) /
          2;
      }
    }
  }
  const distance = new Float32Array(width * height);
  const excess = new Float32Array(width * height);
  for (let p = 0; p < width * height; p += 1) {
    let sum = 0;
    let light = 0;
    for (let c = 0; c < 3; c += 1) {
      // Só o que é mais claro que o fundo conta: sombras externas, quase
      // invisíveis sobre o fundo escuro, não viram halos opacos.
      const delta = rgb[p * 3 + c] - background[p * 3 + c];
      sum += Math.max(0, delta) ** 2;
      light = Math.max(light, delta / (255 - background[p * 3 + c]));
    }
    distance[p] = Math.sqrt(sum);
    excess[p] = Math.max(0, Math.min(1, light));
  }
  return { width, height, rgb, background, distance, excess };
}

function flood(region, seeds, passable) {
  const { width, height } = region;
  const visited = new Uint8Array(width * height);
  const stack = [];
  for (const [x, y] of seeds) {
    const p = y * width + x;
    if (passable(p) && !visited[p]) {
      visited[p] = 1;
      stack.push(p);
    }
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % width;
    const y = (p / width) | 0;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (!visited[n] && passable(n)) {
        visited[n] = 1;
        stack.push(n);
      }
    }
  }
  return visited;
}

function components(mask, width, height) {
  const labels = new Int32Array(width * height).fill(-1);
  const list = [];
  for (let start = 0; start < width * height; start += 1) {
    if (!mask[start] || labels[start] >= 0) continue;
    const item = { area: 0, x0: width, y0: height, x1: -1, y1: -1, pixels: [] };
    const stack = [start];
    labels[start] = list.length;
    while (stack.length) {
      const p = stack.pop();
      const x = p % width;
      const y = (p / width) | 0;
      item.area += 1;
      item.pixels.push(p);
      item.x0 = Math.min(item.x0, x);
      item.y0 = Math.min(item.y0, y);
      item.x1 = Math.max(item.x1, x);
      item.y1 = Math.max(item.y1, y);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (mask[n] && labels[n] < 0) {
          labels[n] = list.length;
          stack.push(n);
        }
      }
    }
    list.push(item);
  }
  return list;
}

/** Distância (chanfro 3-4, em px) de cada pixel do objeto até o fundo. */
function insideDistance(mask, width, height) {
  const big = 1e6;
  const d = new Float32Array(width * height);
  for (let p = 0; p < d.length; p += 1) d[p] = mask[p] ? big : 0;
  const pass = (forward) => {
    for (let k = 0; k < d.length; k += 1) {
      const p = forward ? k : d.length - 1 - k;
      if (!d[p]) continue;
      const x = p % width;
      const y = (p / width) | 0;
      const s = forward ? -1 : 1;
      for (const [dx, dy, w] of [
        [s, 0, 3],
        [0, s, 3],
        [s, s, 4],
        [-s, s, 4],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        const value =
          nx < 0 || ny < 0 || nx >= width || ny >= height
            ? 0
            : d[ny * width + nx];
        d[p] = Math.min(d[p], value + w);
      }
    }
  };
  pass(true);
  pass(false);
  for (let p = 0; p < d.length; p += 1) d[p] /= 3;
  return d;
}

/** Dilatação quadrada (raio em px) de uma máscara binária. */
function dilate(mask, width, height, radius) {
  const horizontal = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (
        let k = Math.max(0, x - radius);
        k <= Math.min(width - 1, x + radius);
        k += 1
      ) {
        if (mask[y * width + k]) {
          horizontal[y * width + x] = 1;
          break;
        }
      }
    }
  }
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (
        let k = Math.max(0, y - radius);
        k <= Math.min(height - 1, y + radius);
        k += 1
      ) {
        if (horizontal[k * width + x]) {
          out[y * width + x] = 1;
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Preenchimento do fundo que não atravessa falhas estreitas (até 2 × `gap` px)
 * nos aros escuros: o fundo é inundado longe do objeto e depois recresce
 * `gap + 1` px, sem alcançar o interior por uma fresta.
 */
function guardedFlood(region, seeds, threshold, gap) {
  const { width, height, distance } = region;
  const isBackground = (p) => distance[p] < threshold;
  const solid = distance.map((value) => (value >= threshold ? 1 : 0));
  const blocked = gap > 0 ? dilate(solid, width, height, gap) : solid;
  let filled = flood(region, seeds, (p) => isBackground(p) && !blocked[p]);
  for (let step = 0; step <= gap; step += 1) {
    const next = Uint8Array.from(filled);
    for (let p = 0; p < filled.length; p += 1) {
      if (filled[p] || !isBackground(p)) continue;
      const x = p % width;
      const y = (p / width) | 0;
      if (
        (x > 0 && filled[p - 1]) ||
        (x < width - 1 && filled[p + 1]) ||
        (y > 0 && filled[p - width]) ||
        (y < height - 1 && filled[p + width])
      ) {
        next[p] = 1;
      }
    }
    filled = next;
  }
  return filled;
}

function extractObject(region, asset) {
  const { width, height, excess } = region;
  const threshold = asset.backgroundDistance ?? BACKGROUND_DISTANCE;
  const border = [];
  for (let x = 0; x < width; x += 1) border.push([x, 0], [x, height - 1]);
  for (let y = 0; y < height; y += 1) border.push([0, y], [width - 1, y]);
  const gap = asset.closeGaps ?? CLOSE_GAPS;
  const background = guardedFlood(region, border, threshold, gap);
  if (asset.holes) {
    // Fundo interno (centro das molduras): aceita o reflexo de luz da prancha.
    const inner = guardedFlood(
      region,
      asset.holes,
      asset.holeDistance ?? HOLE_DISTANCE,
      gap,
    );
    for (let p = 0; p < inner.length; p += 1) background[p] |= inner[p];
  }
  const foreground = background.map((value) => (value ? 0 : 1));
  const parts = components(foreground, width, height).sort(
    (a, b) => b.area - a.area,
  );
  const main = parts[0];
  const mask = new Uint8Array(width * height);
  const kept = parts.filter(
    (part) =>
      part === main ||
      (part.x0 >= main.x0 &&
        part.x1 <= main.x1 &&
        part.y0 >= main.y0 &&
        part.y1 <= main.y1),
  );
  for (const part of kept) for (const p of part.pixels) mask[p] = 1;
  const discarded = parts.filter(
    (part) => !kept.includes(part) && part.area >= 6,
  );
  const depth = insideDistance(mask, width, height);
  const band = asset.edgeBand ?? EDGE_BAND;
  const alpha = new Float32Array(width * height);
  for (let p = 0; p < width * height; p += 1) {
    const soft = Math.min(1, excess[p] / EDGE_OPAQUE);
    if (mask[p]) {
      alpha[p] = depth[p] > band ? 1 : Math.max(soft, (depth[p] - 1) / band);
    } else {
      // Anel externo de 1 px: preserva a suavização original da aresta.
      const x = p % width;
      const y = (p / width) | 0;
      const touches = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(
        ([nx, ny]) =>
          nx >= 0 &&
          ny >= 0 &&
          nx < width &&
          ny < height &&
          mask[ny * width + nx],
      );
      alpha[p] = touches ? soft * 0.6 : 0;
    }
  }
  return { alpha, discarded, touchesEdge: touchesEdge(mask, width, height) };
}

function extractLight(region) {
  const { width, height, excess } = region;
  const alpha = new Float32Array(width * height);
  for (let p = 0; p < width * height; p += 1) {
    alpha[p] =
      excess[p] <= LIGHT_FLOOR
        ? 0
        : (excess[p] - LIGHT_FLOOR) / (1 - LIGHT_FLOOR);
  }
  const mask = alpha.map((value) => (value > 0.08 ? 1 : 0));
  return {
    alpha,
    discarded: [],
    touchesEdge: touchesEdge(mask, width, height),
  };
}

function touchesEdge(mask, width, height) {
  const sides = [];
  const any = (points) => points.some(([x, y]) => mask[y * width + x]);
  const xs = Array.from({ length: width }, (_, x) => x);
  const ys = Array.from({ length: height }, (_, y) => y);
  if (any(xs.map((x) => [x, 0]))) sides.push('top');
  if (any(xs.map((x) => [x, height - 1]))) sides.push('bottom');
  if (any(ys.map((y) => [0, y]))) sides.push('left');
  if (any(ys.map((y) => [width - 1, y]))) sides.push('right');
  return sides;
}

/** Descontamina a cor do fundo, recorta, centraliza e adiciona margem. */
function compose(region, alpha, asset) {
  const { width, height, rgb, background } = region;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let p = 0; p < width * height; p += 1) {
    if (alpha[p] * 255 < 2) continue;
    const x = p % width;
    const y = (p / width) | 0;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const contentWidth = x1 - x0 + 1;
  const contentHeight = y1 - y0 + 1;
  const pad = Math.max(
    4,
    Math.round(Math.max(contentWidth, contentHeight) * 0.06),
  );
  let outWidth = contentWidth + pad * 2;
  let outHeight = contentHeight + pad * 2;
  if (asset.square !== false)
    outWidth = outHeight = Math.max(outWidth, outHeight);
  const offsetX = Math.floor((outWidth - contentWidth) / 2);
  const offsetY = Math.floor((outHeight - contentHeight) / 2);
  const data = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const p = y * width + x;
      const a = Math.round(alpha[p] * 255);
      if (a === 0) continue;
      const o = ((y - y0 + offsetY) * outWidth + (x - x0 + offsetX)) * 4;
      for (let c = 0; c < 3; c += 1) {
        const source = rgb[p * 3 + c];
        const base = background[p * 3 + c];
        data[o + c] = a === 255 ? source : base + (source - base) / alpha[p];
      }
      data[o + 3] = a;
    }
  }
  return {
    image: { width: outWidth, height: outHeight, data },
    content: {
      x: asset.rect[0] + x0,
      y: asset.rect[1] + y0,
      width: contentWidth,
      height: contentHeight,
    },
  };
}

async function main() {
  const sheetPath = resolve(process.argv[2] ?? SHEET);
  const sheetBytes = readFileSync(sheetPath);
  const sheet = decodePng(sheetBytes);
  if (sheetPath !== SHEET) {
    mkdirSync(dirname(SHEET), { recursive: true });
    copyFileSync(sheetPath, SHEET);
  }
  const browser = await launchBrowser();
  const report = [];
  try {
    for (const asset of ASSETS) {
      const region = prepare(sheet, asset.rect);
      const result =
        asset.mode === 'light'
          ? extractLight(region)
          : extractObject(region, asset);
      const { image, content } = compose(region, result.alpha, asset);
      const directory = join(OUTPUT, asset.category);
      mkdirSync(directory, { recursive: true });
      const png = encodePng(image);
      const webp = await encodeWebp(browser, image, WEBP_QUALITY);
      writeFileSync(join(directory, `${asset.id}.png`), png);
      writeFileSync(join(directory, `${asset.id}.webp`), webp);
      report.push({
        id: asset.id,
        width: image.width,
        height: image.height,
        sourceRect: content,
        searchRect: asset.rect,
        touchesSearchEdge: result.touchesEdge,
        discardedFragments: result.discarded.map(
          ({ area, x0, y0, x1, y1 }) => ({
            area,
            box: [
              asset.rect[0] + x0,
              asset.rect[1] + y0,
              asset.rect[0] + x1,
              asset.rect[1] + y1,
            ],
          }),
        ),
        bytes: { png: png.length, webp: webp.length },
      });
      console.log(
        `${asset.id.padEnd(28)} ${image.width}×${image.height} ${result.touchesEdge.join(',')}`,
      );
    }
  } finally {
    await browser.close();
  }
  await writeFormatted(
    join(OUTPUT, 'previews', 'extraction-report.json'),
    JSON.stringify({
      sheet: {
        file: 'previews/source-sheet.png',
        width: sheet.width,
        height: sheet.height,
        sha256: createHash('sha256').update(sheetBytes).digest('hex'),
      },
      settings: {
        BACKGROUND_DISTANCE,
        HOLE_DISTANCE,
        CLOSE_GAPS,
        EDGE_BAND,
        EDGE_OPAQUE,
        LIGHT_FLOOR,
        WEBP_QUALITY,
      },
      assets: report,
    }),
  );
}

await main();
