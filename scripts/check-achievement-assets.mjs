/**
 * Valida os assets de conquistas em apps/web/public/assets/achievements.
 *
 * Uso: npm run audit:achievement-assets
 *
 * Erros (código de saída 1): manifesto inválido, caminhos fora da pasta ou
 * inexistentes, arquivos corrompidos (PNG com CRC/estrutura inválidos, WebP
 * com RIFF inconsistente), dimensões divergentes entre PNG, WebP e manifesto,
 * imagens totalmente transparentes ou sem transparência, conteúdo encostado na
 * borda (recorte cortado), duplicados e arquivos órfãos não listados.
 * Avisos: indícios de elementos estranhos da prancha, que exigem revisão
 * visual na página de pré-visualização.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { decodePng } from './achievement-assets/png.mjs';

const ROOT = resolve(
  process.env.ACHIEVEMENT_ASSETS_ROOT ?? 'apps/web/public/assets/achievements',
);
const STATUSES = new Set(['ready', 'review', 'regenerate']);
const CATEGORIES = new Set([
  'frames',
  'badges',
  'icons',
  'ui',
  'specific',
  'effects',
  'labels',
  'decor',
]);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_SIZE = 32;
const MAX_SIZE = 512;
const MAX_WEBP_BYTES = 40 * 1024;

const errors = [];
const warnings = [];
const fail = (id, message) => errors.push(`${id}: ${message}`);
const warn = (id, message) => warnings.push(`${id}: ${message}`);

/** Lê dimensões e alfa de um WebP pelos chunks RIFF, sem decodificar. */
function inspectWebp(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString('latin1', 0, 4) !== 'RIFF' ||
    buffer.toString('latin1', 8, 12) !== 'WEBP'
  ) {
    throw new Error('cabeçalho RIFF/WEBP inválido');
  }
  if (buffer.readUInt32LE(4) + 8 !== buffer.length) {
    throw new Error('tamanho RIFF diferente do arquivo (truncado?)');
  }
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('latin1', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = buffer.subarray(offset + 8, offset + 8 + size);
    if (data.length !== size) throw new Error(`chunk ${type} truncado`);
    chunks.push({ type, data });
    offset += 8 + size + (size % 2);
  }
  const first = chunks[0];
  if (!first) throw new Error('sem chunks');
  if (first.type === 'VP8X') {
    const hasAlphaFlag = Boolean(first.data[0] & 0x10);
    const width = 1 + first.data.readUIntLE(4, 3);
    const height = 1 + first.data.readUIntLE(7, 3);
    const hasAlpha =
      hasAlphaFlag &&
      chunks.some(
        (chunk) =>
          chunk.type === 'ALPH' ||
          (chunk.type === 'VP8L' && chunk.data[4] & 0x10),
      );
    return { width, height, hasAlpha };
  }
  if (first.type === 'VP8L') {
    const bits = first.data.readUInt32LE(1);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      hasAlpha: Boolean((bits >> 28) & 1),
    };
  }
  if (first.type === 'VP8 ') {
    return {
      width: first.data.readUInt16LE(6) & 0x3fff,
      height: first.data.readUInt16LE(8) & 0x3fff,
      hasAlpha: false,
    };
  }
  throw new Error(`chunk inicial inesperado ${first.type}`);
}

function safePath(id, path) {
  if (typeof path !== 'string' || path.startsWith('/') || path.includes('\\')) {
    fail(id, `caminho inválido "${path}"`);
    return null;
  }
  const absolute = resolve(ROOT, path);
  if (!absolute.startsWith(ROOT + sep)) {
    fail(id, `caminho fora da pasta de assets "${path}"`);
    return null;
  }
  if (!existsSync(absolute)) {
    fail(id, `arquivo referenciado inexistente "${path}"`);
    return null;
  }
  return absolute;
}

function analyseAlpha(image) {
  const { width, height, data } = image;
  let visible = 0;
  let transparent = 0;
  let edge = 0;
  let lightText = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      if (alpha > 16) visible += 1;
      if (alpha < 255) transparent += 1;
      if (
        (x === 0 || y === 0 || x === width - 1 || y === height - 1) &&
        alpha > 8
      ) {
        edge += 1;
      }
      // Legenda da prancha: branco neutro e opaco no quinto inferior.
      const neutral =
        Math.max(data[i], data[i + 1], data[i + 2]) -
          Math.min(data[i], data[i + 1], data[i + 2]) <
        12;
      if (y > height * 0.8 && alpha === 255 && neutral && data[i] > 225) {
        lightText += 1;
      }
    }
  }
  return { visible, transparent, edge, lightText, total: width * height };
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}

function main() {
  const manifestPath = join(ROOT, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error('manifest.json ausente');
    process.exit(1);
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    console.error(`manifest.json inválido: ${error.message}`);
    process.exit(1);
  }
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  if (assets.length === 0) fail('manifest', 'nenhum asset listado');

  const ids = new Set();
  const referenced = new Set(['manifest.json']);
  const hashes = new Map();
  const pixelHashes = new Map();
  const counts = { ready: 0, review: 0, regenerate: 0 };

  for (const asset of assets) {
    const id = asset.id ?? '(sem id)';
    if (!ID_PATTERN.test(id))
      fail(id, 'id fora do padrão minúsculas-com-hífens');
    if (ids.has(id)) fail(id, 'id duplicado');
    ids.add(id);
    if (!asset.name) fail(id, 'nome ausente');
    if (!CATEGORIES.has(asset.category))
      fail(id, `categoria inválida ${asset.category}`);
    if (!STATUSES.has(asset.status))
      fail(id, `estado inválido ${asset.status}`);
    else counts[asset.status] += 1;
    if (!Array.isArray(asset.notes)) fail(id, 'observações ausentes');

    const decoded = {};
    for (const format of ['png', 'webp']) {
      const file = asset.files?.[format];
      if (!file) {
        fail(id, `arquivo ${format} ausente no manifesto`);
        continue;
      }
      const expectedPath = `${asset.category}/${id}.${format}`;
      if (file.path !== expectedPath) {
        fail(id, `caminho ${file.path} difere do esperado ${expectedPath}`);
      }
      const absolute = safePath(id, file.path);
      if (!absolute) continue;
      referenced.add(file.path);
      const bytes = readFileSync(absolute);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (file.sha256 !== sha256)
        fail(id, `${format}: SHA-256 difere do manifesto`);
      if (file.bytes !== statSync(absolute).size)
        fail(id, `${format}: tamanho difere do manifesto`);
      if (hashes.has(sha256))
        fail(id, `${format}: duplicado de ${hashes.get(sha256)}`);
      hashes.set(sha256, id);
      try {
        decoded[format] =
          format === 'png' ? decodePng(bytes) : inspectWebp(bytes);
      } catch (error) {
        fail(id, `${format} corrompido: ${error.message}`);
      }
    }

    const png = decoded.png;
    if (png) {
      if (png.colorType !== 6) fail(id, 'PNG sem canal alfa');
      if (png.width !== asset.width || png.height !== asset.height) {
        fail(id, `dimensões ${png.width}×${png.height} diferem do manifesto`);
      }
      for (const size of [png.width, png.height]) {
        if (size < MIN_SIZE || size > MAX_SIZE)
          fail(id, `dimensão fora de ${MIN_SIZE}–${MAX_SIZE} px`);
      }
      const pixels = createHash('sha256').update(png.data).digest('hex');
      if (pixelHashes.has(pixels))
        fail(id, `pixels idênticos a ${pixelHashes.get(pixels)}`);
      pixelHashes.set(pixels, id);
      const alpha = analyseAlpha(png);
      if (alpha.visible === 0) fail(id, 'imagem completamente transparente');
      else if (alpha.visible < alpha.total * 0.03)
        warn(id, 'conteúdo visível muito pequeno');
      if (alpha.transparent === 0)
        fail(id, 'sem pixels transparentes (fundo não removido)');
      if (alpha.edge > 0)
        fail(
          id,
          `${alpha.edge} px visíveis na borda: possível recorte cortado`,
        );
      if (alpha.visible > alpha.total * 0.95)
        warn(id, 'quase sem área transparente: fundo pode ter permanecido');
      if (asset.category !== 'labels' && alpha.lightText > 12) {
        warn(
          id,
          `${alpha.lightText} px brancos opacos no rodapé: conferir se há legenda da prancha`,
        );
      }
    }
    const webp = decoded.webp;
    if (webp && png) {
      if (webp.width !== png.width || webp.height !== png.height) {
        fail(id, `WebP ${webp.width}×${webp.height} difere do PNG`);
      }
      if (!webp.hasAlpha) fail(id, 'WebP sem canal alfa');
      if (asset.files.webp.bytes > MAX_WEBP_BYTES) {
        warn(
          id,
          `WebP com ${asset.files.webp.bytes} bytes (acima de ${MAX_WEBP_BYTES})`,
        );
      }
    }
  }

  for (const status of Object.keys(counts)) {
    if (manifest.summary?.[status] !== counts[status]) {
      fail(
        'manifest',
        `resumo de "${status}" (${manifest.summary?.[status]}) difere da contagem (${counts[status]})`,
      );
    }
  }
  if (manifest.summary?.total !== assets.length)
    fail('manifest', 'total do resumo difere');

  // Arquivos órfãos: imagens nas pastas de categoria fora do manifesto.
  for (const file of walk(ROOT)) {
    const path = relative(ROOT, file).split(sep).join('/');
    if (path.startsWith('previews/')) continue;
    if (!referenced.has(path))
      fail('pasta', `arquivo não listado no manifesto: ${path}`);
  }
  for (const path of [
    'previews/source-sheet.png',
    'previews/achievements-contact-sheet.html',
  ]) {
    if (!existsSync(join(ROOT, path))) fail('previews', `${path} ausente`);
  }
  const preview = existsSync(
    join(ROOT, 'previews/achievements-contact-sheet.html'),
  )
    ? readFileSync(
        join(ROOT, 'previews/achievements-contact-sheet.html'),
        'utf8',
      )
    : '';
  for (const asset of assets) {
    if (preview && !preview.includes(`../${asset.files?.webp?.path}`)) {
      fail(asset.id, 'ausente da página de pré-visualização');
    }
  }

  console.log(
    `Assets: ${assets.length} (ready ${counts.ready}, review ${counts.review}, regenerate ${counts.regenerate})`,
  );
  for (const message of warnings) console.log(`AVISO  ${message}`);
  for (const message of errors) console.error(`ERRO   ${message}`);
  console.log(`${errors.length} erro(s), ${warnings.length} aviso(s).`);
  process.exit(errors.length ? 1 : 0);
}

main();
