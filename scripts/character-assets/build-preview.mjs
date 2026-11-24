/**
 * Gera `apps/web/src/modules/profile/assets/previews/characters-preview.html`,
 * que compara a arte pixelada anterior (retrato e carta, em assets/legacy) com
 * as novas cartas de fantasia sombria, por classe e estágio.
 *
 * Uso: node scripts/character-assets/build-preview.mjs
 * Abra o HTML diretamente no navegador; ele não entra no bundle do app.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { writeFormatted } from '../achievement-assets/write-formatted.mjs';

const ASSETS = resolve('apps/web/src/modules/profile/assets');
const report = JSON.parse(
  readFileSync(join(ASSETS, 'previews', 'characters-report.json'), 'utf8'),
);
const NAMES = {
  aventureiro: 'Aventureiro',
  guerreiro: 'Guerreiro',
  estrategista: 'Estrategista',
  guardiao: 'Guardião',
  sabio: 'Sábio',
  mestre: 'Mestre',
};
const STAGES = {
  1: 'I · Inicial · nível 1–4',
  2: 'II · Experiente · nível 5–9',
  3: 'III · Avançado · nível 10–19',
  4: 'IV · Elite · nível 20+',
};
const counts = { ready: 0, review: 0, regenerate: 0 };
for (const card of report.cards) counts[card.status] += 1;

const sections = Object.entries(NAMES).map(([slug, name]) => {
  const cards = report.cards.filter((card) => card.character === slug);
  return `<section aria-labelledby="c-${slug}">
  <h2 id="c-${slug}">${name}</h2>
  <div class="grid">
${cards
  .map(
    (card) => `    <article class="card" data-status="${card.status}">
      <h3>${name} · ${STAGES[card.stage]}</h3>
      <div class="compare">
        <figure><img src="../legacy/portraits/${slug}/${card.id}.webp" alt="Retrato antigo de ${name}, estágio ${card.stage}" class="pixel"><figcaption>Retrato antigo</figcaption></figure>
        <figure><img src="../legacy/cards/${slug}/${card.id}.webp" alt="Carta antiga de ${name}, estágio ${card.stage}" class="pixel"><figcaption>Carta antiga</figcaption></figure>
        <figure class="new"><img src="../cards/${slug}/${card.id}.webp" alt="Nova carta de ${name}, estágio ${card.stage}" width="${card.width}" height="${card.height}"><figcaption>Nova carta</figcaption></figure>
      </div>
      <p class="meta">cards/${slug}/${card.id}.webp · ${card.width} × ${card.height} px · ${(card.bytes / 1024).toFixed(1)} KiB</p>
      <p><span class="status ${card.status}">${card.status}</span></p>
      ${card.notes.length ? `<ul class="notes">${card.notes.map((note) => `<li>${note}</li>`).join('')}</ul>` : ''}
    </article>`,
  )
  .join('\n')}
  </div>
</section>`;
});

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Personagens: antigo e novo</title>
<style>
:root { color-scheme: dark; --bg: #090909; --panel: #141010; --line: #3a1d1d; --text: #f5f5f5; --muted: #a3a3a3; --accent: #dc2626; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, sans-serif; }
header, main { max-width: 1280px; margin: 0 auto; padding: 16px; }
h1 { font-size: 1.6rem; margin: 8px 0 4px; } h1 span { color: var(--accent); }
h2 { margin: 28px 0 12px; font-size: 1.2rem; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
h3 { margin: 0 0 8px; font-size: .95rem; }
p { color: var(--muted); margin: 4px 0; }
.grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr)); }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
.compare { display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 8px; align-items: end; }
figure { margin: 0; text-align: center; font-size: .7rem; color: var(--muted); }
figure img { display: block; width: 100%; height: auto; margin: 0 auto 4px; }
.pixel { image-rendering: pixelated; opacity: .9; }
.new img { max-width: 181px; filter: drop-shadow(0 6px 14px rgb(0 0 0 / .6)); }
.meta { font-size: .75rem; word-break: break-all; }
.status { display: inline-block; font-size: .75rem; font-weight: 600; padding: 1px 8px; border-radius: 999px; color: #fff; }
.status.ready { background: #2e7d32; } .status.review { background: #b7791f; } .status.regenerate { background: #b42318; }
.notes { margin: 6px 0 0; padding-left: 18px; font-size: .8rem; color: var(--muted); }
.sheet img { width: 100%; height: auto; border-radius: 8px; }
</style>
</head>
<body>
<header>
  <h1>Life <span>RPG</span>: personagens antigos e novos</h1>
  <p>${report.cards.length} cartas extraídas da prancha de ${report.sheet.width} × ${report.sheet.height} px · ready: ${counts.ready} · review: ${counts.review} · regenerate: ${counts.regenerate}. A arte pixelada anterior permanece em <code>assets/legacy/</code>.</p>
</header>
<main>
${sections.join('\n')}
<section aria-labelledby="c-sheet">
  <h2 id="c-sheet">Prancha original</h2>
  <div class="sheet"><img src="characters-sheet.png" alt="Prancha original das 24 cartas" width="${report.sheet.width}" height="${report.sheet.height}"></div>
</section>
</main>
</body>
</html>
`;
await writeFormatted(join(ASSETS, 'previews', 'characters-preview.html'), html);
console.log(counts);
