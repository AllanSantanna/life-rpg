import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Endereço de publicação no GitHub Pages (`npm run build:pages`). */
const PAGES_BASE = '/life-rpg/';

/**
 * O GitHub Pages não tem fallback de SPA: um link direto como
 * `/life-rpg/perfil` responde com `404.html`. Uma cópia do `index.html`
 * carrega o app, que resolve a rota pelo caminho da URL.
 */
function spaFallback(): Plugin {
  return {
    name: 'life-rpg:pages-404',
    apply: 'build',
    async writeBundle(options) {
      const dir = options.dir ?? 'dist-pages';
      await copyFile(join(dir, 'index.html'), join(dir, '404.html'));
    },
  };
}

export default defineConfig(({ mode }) => {
  const pages = mode === 'pages';
  // Local, auditorias e testes continuam na raiz (127.0.0.1:5173).
  const base = pages ? PAGES_BASE : '/';
  return {
    base,
    envDir: '../..',
    // O build publicado é estático: nenhum endereço de API local ou privado
    // do .env entra no bundle. Sem API, as cotações da B3 ficam indisponíveis.
    ...(pages ? { define: { 'import.meta.env.VITE_API_URL': '""' } } : {}),
    build: pages ? { outDir: 'dist-pages', emptyOutDir: true } : {},
    server: { port: 5173, strictPort: true },
    plugins: [
      react(),
      tailwindcss(),
      ...(pages ? [spaFallback()] : []),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icons/icon.svg'],
        manifest: {
          // Relativos à base: identidade, escopo e ícones ficam em /life-rpg/
          // no Pages, sem colidir com outros sites do mesmo domínio github.io.
          id: base,
          name: 'Life RPG',
          short_name: 'Life RPG',
          description: 'Evolua sua vida, um objetivo por vez.',
          lang: 'pt-BR',
          theme_color: '#090909',
          background_color: '#090909',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            {
              src: `${base}icons/icon-192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}icons/icon-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}icons/icon-maskable-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,webp,svg,woff2}'],
          // 404.html é só o fallback do servidor; a navegação offline usa
          // index.html (navigateFallback do plugin).
          globIgnores: ['**/LandscapeScene-*.js', '404.html'],
          runtimeCaching: [
            {
              // O renderer 3D é baixado somente ao abrir Estatísticas com WebGL.
              urlPattern: /\/assets\/LandscapeScene-[^/]+\.js$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'statistics-3d-assets',
                expiration: {
                  maxEntries: 2,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
          navigateFallbackDenylist: [/^\/api(?:\/|$)/],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  };
});
