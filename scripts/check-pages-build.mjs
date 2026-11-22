/**
 * Verifica o build estático do GitHub Pages ANTES do upload. Falha se houver
 * arquivo de ambiente, nome ou formato de credencial, endpoint local/privado,
 * mapa de código-fonte ou caminho fora de /life-rpg/. Não lê nem imprime o .env.
 *
 * Uso: node scripts/check-pages-build.mjs [diretório] (padrão apps/web/dist-pages)
 */
import fs from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const BASE = '/life-rpg/';
const root = resolve(process.argv[2] ?? 'apps/web/dist-pages');
const problems = [];
const fail = (message) => problems.push(message);

async function files(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(path)));
    else out.push(path);
  }
  return out;
}
const all = await files(root);
const rel = (path) => relative(root, path);

// 1. Somente artefatos estáticos esperados.
for (const path of all) {
  const name = rel(path);
  if (/(^|\/)\.env/.test(name) || /(^|\/)\./.test(name))
    fail(`arquivo oculto ou de ambiente no build: ${name}`);
  if (name.endsWith('.map')) fail(`mapa de código-fonte publicado: ${name}`);
  if (/\.(tsx?|mjs|cjs)$/.test(name) || name.includes('node_modules'))
    fail(`código-fonte bruto no build: ${name}`);
}

// 2. Segredos e endpoints internos no conteúdo textual.
const secretPatterns = [
  [
    /BRAPI_TOKEN|POSTGRES_PASSWORD|DATABASE_URL|WEB_ORIGIN/,
    'nome de variável privada',
  ],
  [/postgres(?:ql)?:\/\//i, 'string de conexão de banco'],
  [/\bghp_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/, 'token do GitHub'],
  [/\bsk-[A-Za-z0-9]{20,}/, 'chave de API'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada'],
  [
    /(?:https?:)?\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?/,
    'endpoint local',
  ],
  [
    /https?:\/\/(?:10\.\d+|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+/,
    'endpoint de rede privada',
  ],
];
for (const path of all) {
  if (!/\.(js|css|html|json|webmanifest|svg|txt)$/.test(path)) continue;
  const text = await fs.readFile(path, 'utf8');
  for (const [pattern, label] of secretPatterns)
    if (pattern.test(text)) fail(`${label} em ${rel(path)}`);
}

// 3. Base de publicação, fallback de rota e PWA.
const index = await fs.readFile(join(root, 'index.html'), 'utf8');
const fallback = await fs
  .readFile(join(root, '404.html'), 'utf8')
  .catch(() => null);
if (fallback !== index) fail('404.html ausente ou diferente de index.html');
for (const [, url] of index.matchAll(/(?:src|href)="([^"]+)"/g))
  if (!/^https?:/.test(url) && !url.startsWith(BASE))
    fail(`index.html referencia caminho fora de ${BASE}: ${url}`);
const manifest = JSON.parse(
  await fs.readFile(join(root, 'manifest.webmanifest'), 'utf8'),
);
for (const key of ['id', 'start_url', 'scope'])
  if (manifest[key] !== BASE) fail(`manifest.${key} deveria ser ${BASE}`);
for (const icon of manifest.icons ?? []) {
  if (!icon.src.startsWith(BASE)) fail(`ícone fora da base: ${icon.src}`);
  else
    await fs
      .access(join(root, icon.src.slice(BASE.length)))
      .catch(() => fail(`ícone inexistente: ${icon.src}`));
}
const register = await fs.readFile(join(root, 'registerSW.js'), 'utf8');
if (
  !register.includes(`'${BASE}sw.js'`) ||
  !register.includes(`scope: '${BASE}'`)
)
  fail('service worker não registrado em /life-rpg/');
const sw = await fs.readFile(join(root, 'sw.js'), 'utf8');
if (!sw.includes('createHandlerBoundToURL("index.html")'))
  fail('service worker sem fallback de navegação para index.html');

if (problems.length) {
  console.error(`Build do Pages recusado (${problems.length}):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(
  `Build do Pages verificado: ${all.length} arquivos, base ${BASE}, sem segredos ou endpoints internos.`,
);
