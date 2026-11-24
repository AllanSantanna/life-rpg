/**
 * Gera manifest.json e a página previews/achievements-contact-sheet.html a
 * partir do inventário, da revisão visual e do relatório de extração.
 *
 * Uso: node scripts/achievement-assets/build-manifest.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSETS,
  NOT_EXTRACTED,
  RARITY_PALETTE,
  RESOLUTION_NOTE,
  REVIEW,
} from './assets.config.mjs';
import { decodePng } from './png.mjs';
import { writeFormatted } from './write-formatted.mjs';

const ROOT = 'apps/web/public/assets/achievements';
const report = JSON.parse(
  readFileSync(join(ROOT, 'previews', 'extraction-report.json'), 'utf8'),
);

const CATEGORY_NAMES = {
  frames: 'Molduras',
  badges: 'Medalhas genéricas',
  icons: 'Ícones de pilar e especiais',
  ui: 'Indicadores de estado',
  specific: 'Medalhas específicas',
  effects: 'Efeitos',
  labels: 'Etiquetas de raridade',
  decor: 'Elementos decorativos',
};

function describe(path) {
  const bytes = readFileSync(join(ROOT, path));
  return {
    path,
    bytes: statSync(join(ROOT, path)).size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

const assets = ASSETS.map((asset) => {
  const extraction = report.assets.find((item) => item.id === asset.id);
  if (!extraction) throw new Error(`${asset.id} ausente do relatório`);
  const png = decodePng(
    readFileSync(join(ROOT, asset.category, `${asset.id}.png`)),
  );
  const review = REVIEW[asset.id] ?? { status: 'ready', notes: [] };
  return {
    id: asset.id,
    name: asset.name,
    category: asset.category,
    rarity: asset.rarity ?? null,
    pillar: asset.pillar ?? null,
    width: png.width,
    height: png.height,
    status: review.status,
    notes: [...review.notes, RESOLUTION_NOTE],
    files: {
      webp: describe(`${asset.category}/${asset.id}.webp`),
      png: describe(`${asset.category}/${asset.id}.png`),
    },
    source: {
      label: asset.source,
      rect: extraction.sourceRect,
      mode: asset.mode,
    },
  };
});

const summary = { total: assets.length, ready: 0, review: 0, regenerate: 0 };
for (const asset of assets) summary[asset.status] += 1;

const manifest = {
  $schema: 'Life RPG achievement assets manifest',
  version: 1,
  basePath: '/assets/achievements/',
  generatedBy: 'scripts/achievement-assets/build-manifest.mjs',
  statuses: {
    ready: 'Recorte limpo, validado e pronto.',
    review: 'Utilizável, mas exige avaliação visual.',
    regenerate: 'Não foi possível obter qualidade aceitável.',
  },
  source: report.sheet,
  rarityPalette: RARITY_PALETTE,
  summary,
  notExtracted: NOT_EXTRACTED,
  assets,
};
await writeFormatted(join(ROOT, 'manifest.json'), JSON.stringify(manifest));

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const groups = Object.entries(CATEGORY_NAMES).map(([key, title]) => ({
  key,
  title,
  items: assets
    .filter((asset) => asset.category === key)
    .sort(
      (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity),
    ),
}));

/** Região da prancha enquadrada como o asset (mesma escala relativa). */
function originalTile(asset) {
  const { x, y, width, height } = asset.source.rect;
  const box = Math.max(width, height) / 0.92;
  const left = x - (box - width) / 2;
  const top = y - (box - height) / 2;
  const pct = (value) => ((value / box) * 100).toFixed(3);
  return `<div class="tile original" data-label="Original" role="img" aria-label="Recorte original da prancha"><img src="source-sheet.png" alt="" style="width:${pct(report.sheet.width)}%;left:-${pct(left)}%;top:-${pct(top)}%"></div>`;
}

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Assets de conquistas</title>
<style>
:root {
  color-scheme: dark;
  --bg: #090909; --panel: #141010; --line: #3a1d1d; --text: #f1e7e7;
  --muted: #b9a9a9; --accent: #c62828; --ready: #2e7d32; --review: #b7791f;
  --regenerate: #b42318; --focus: #ff6b6b;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
header, main { max-width: 1280px; margin: 0 auto; padding: 16px; }
h1 { margin: 8px 0 4px; font-size: 1.6rem; }
h1 span { color: var(--accent); }
h2 { margin: 32px 0 12px; font-size: 1.2rem; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
p { color: var(--muted); margin: 4px 0; }
.summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.chip { border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; font-size: .85rem; }
.chip.ready { border-color: var(--ready); } .chip.review { border-color: var(--review); }
.chip.regenerate { border-color: var(--regenerate); }
.controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 12px 0; }
.controls label { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
button { background: var(--panel); color: var(--text); border: 1px solid var(--line);
  border-radius: 6px; padding: 6px 12px; font: inherit; cursor: pointer; }
button[aria-pressed="true"] { border-color: var(--accent); background: #2a1212; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 12px; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
.card h3 { margin: 0; font-size: 1rem; }
.meta { font-size: .8rem; color: var(--muted); word-break: break-all; }
.tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin: 10px 0 6px; }
.tile { position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden; }
.tile img { position: absolute; inset: 4%; width: 92%; height: 92%; object-fit: contain; }
.tile.original img { inset: auto; height: auto; object-fit: fill; }
.tile.black { background: #000; } .tile.grey { background: #808080; }
.tile.checker { background: repeating-conic-gradient(#d9d9d9 0 25%, #ffffff 0 50%) 0 0 / 12px 12px; }
.tile.original { background: #000; }
.tile::after { content: attr(data-label); position: absolute; left: 4px; bottom: 2px; font-size: .65rem; color: #fff; background: rgb(0 0 0 / .6); padding: 0 4px; border-radius: 3px; }
.status { display: inline-block; font-size: .75rem; font-weight: 600; padding: 1px 8px; border-radius: 999px; color: #fff; }
.status.ready { background: var(--ready); } .status.review { background: var(--review); }
.status.regenerate { background: var(--regenerate); }
.notes { margin: 6px 0 0; padding-left: 18px; font-size: .8rem; color: var(--muted); }
.sizes { display: flex; gap: 12px; align-items: end; margin-top: 8px; background: #000; border-radius: 6px; padding: 8px; }
.sizes figure { margin: 0; text-align: center; font-size: .7rem; color: var(--muted); }
.sheet { position: relative; max-width: 100%; }
.sheet img { display: block; width: 100%; height: auto; border-radius: 8px; }
.box { position: absolute; border: 1px solid; pointer-events: none; }
.box.ready { border-color: #4caf50; } .box.review { border-color: #f0b429; }
.box.regenerate { border-color: #ff4d4f; }
table { border-collapse: collapse; width: 100%; font-size: .85rem; }
td, th { border-bottom: 1px solid var(--line); padding: 6px; text-align: left; vertical-align: top; }
.hidden { display: none; }
</style>
</head>
<body>
<header>
  <h1>Life <span>RPG</span>: assets de conquistas</h1>
  <p>Pré-visualização local de ${summary.total} assets extraídos da prancha de referência
    (${report.sheet.width} × ${report.sheet.height} px). Abra este arquivo diretamente no navegador.</p>
  <div class="summary" aria-label="Resumo dos estados">
    <span class="chip">Total: ${summary.total}</span>
    <span class="chip ready">ready: ${summary.ready}</span>
    <span class="chip review">review: ${summary.review}</span>
    <span class="chip regenerate">regenerate: ${summary.regenerate}</span>
  </div>
  <div class="controls">
    <span>Formato:</span>
    <button type="button" data-format="webp" aria-pressed="true">WebP</button>
    <button type="button" data-format="png" aria-pressed="false">PNG</button>
    <span>Estados:</span>
    <label><input type="checkbox" data-status="ready" checked> ready</label>
    <label><input type="checkbox" data-status="review" checked> review</label>
    <label><input type="checkbox" data-status="regenerate" checked> regenerate</label>
  </div>
</header>
<main>
${groups
  .map(
    (group) => `<section aria-labelledby="g-${group.key}">
  <h2 id="g-${group.key}">${group.title} (${group.items.length})</h2>
  <div class="grid">
${group.items
  .map(
    (asset) => `    <article class="card" data-status="${asset.status}">
      <h3>${asset.name}</h3>
      <div class="meta">${asset.files.webp.path} · ${asset.width} × ${asset.height} px ·
        WebP ${(asset.files.webp.bytes / 1024).toFixed(1)} KiB · PNG ${(asset.files.png.bytes / 1024).toFixed(1)} KiB</div>
      <div class="meta">Categoria: ${asset.category}${asset.rarity ? ` · raridade: ${asset.rarity}` : ''}${asset.pillar ? ` · pilar: ${asset.pillar}` : ''} · origem: ${asset.source.label}</div>
      <div class="tiles">
        ${originalTile(asset)}
        <div class="tile black" data-label="Preto"><img data-asset="${asset.category}/${asset.id}" src="../${asset.files.webp.path}" alt="${asset.name} sobre fundo preto" width="${asset.width}" height="${asset.height}"></div>
        <div class="tile grey" data-label="Cinza"><img data-asset="${asset.category}/${asset.id}" src="../${asset.files.webp.path}" alt="${asset.name} sobre fundo cinza" width="${asset.width}" height="${asset.height}"></div>
        <div class="tile checker" data-label="Quadriculado"><img data-asset="${asset.category}/${asset.id}" src="../${asset.files.webp.path}" alt="${asset.name} sobre quadriculado" width="${asset.width}" height="${asset.height}"></div>
      </div>
      <div class="sizes" aria-label="Tamanhos de uso">
        ${[24, 48, 72]
          .map(
            (size) =>
              `<figure><img data-asset="${asset.category}/${asset.id}" src="../${asset.files.webp.path}" alt="" style="width:${size}px;height:auto"><figcaption>${size} px</figcaption></figure>`,
          )
          .join('')}
      </div>
      <p><span class="status ${asset.status}">${asset.status}</span></p>
      <ul class="notes">${asset.notes.map((note) => `<li>${note}</li>`).join('')}</ul>
    </article>`,
  )
  .join('\n')}
  </div>
</section>`,
  )
  .join('\n')}
<section aria-labelledby="g-sheet">
  <h2 id="g-sheet">Comparação com a prancha original</h2>
  <p>Contornos indicam a área real de cada asset (verde: ready; âmbar: review; vermelho: regenerate).</p>
  <div class="sheet">
    <img src="source-sheet.png" alt="Prancha original de referência" width="${report.sheet.width}" height="${report.sheet.height}">
${assets
  .map(
    (asset) =>
      `    <span class="box ${asset.status}" title="${asset.id}" style="left:${((asset.source.rect.x / report.sheet.width) * 100).toFixed(3)}%;top:${((asset.source.rect.y / report.sheet.height) * 100).toFixed(3)}%;width:${((asset.source.rect.width / report.sheet.width) * 100).toFixed(3)}%;height:${((asset.source.rect.height / report.sheet.height) * 100).toFixed(3)}%"></span>`,
  )
  .join('\n')}
  </div>
  <h2>Elementos identificados e não extraídos</h2>
  <table>
    <thead><tr><th>Elemento</th><th>Motivo</th></tr></thead>
    <tbody>${NOT_EXTRACTED.map((item) => `<tr><td>${item.element}</td><td>${item.reason}</td></tr>`).join('')}</tbody>
  </table>
</section>
</main>
<script>
for (const button of document.querySelectorAll('[data-format]')) {
  button.addEventListener('click', () => {
    const format = button.dataset.format;
    for (const other of document.querySelectorAll('[data-format]')) {
      other.setAttribute('aria-pressed', String(other === button));
    }
    for (const image of document.querySelectorAll('img[data-asset]')) {
      image.src = '../' + image.dataset.asset + '.' + format;
    }
  });
}
for (const box of document.querySelectorAll('[data-status]')) {
  if (box.tagName !== 'INPUT') continue;
  box.addEventListener('change', () => {
    const visible = new Set(
      [...document.querySelectorAll('input[data-status]:checked')].map((input) => input.dataset.status),
    );
    for (const card of document.querySelectorAll('.card')) {
      card.classList.toggle('hidden', !visible.has(card.dataset.status));
    }
  });
}
</script>
</body>
</html>
`;
await writeFormatted(
  join(ROOT, 'previews', 'achievements-contact-sheet.html'),
  html,
);
console.log(summary);
