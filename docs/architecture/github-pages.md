# Publicação no GitHub Pages

Endereço: <https://allansantanna.github.io/life-rpg/>. O GitHub Pages serve
apenas arquivos estáticos: o frontend React/Vite e a PWA. Não há backend, banco
ou sincronização. Os registros ficam no IndexedDB de cada navegador e passam de
um dispositivo a outro pelo [backup manual](data-backup.md).

## Build

| Comando               | Base         | Saída                 | Uso                                         |
| --------------------- | ------------ | --------------------- | ------------------------------------------- |
| `npm run build`       | `/`          | `apps/web/dist`       | Local, CI de qualidade e auditorias PWA     |
| `npm run build:pages` | `/life-rpg/` | `apps/web/dist-pages` | Publicação no GitHub Pages (`--mode pages`) |

O desenvolvimento continua em `http://127.0.0.1:5173/`, na raiz. O modo
`pages` em [vite.config.ts](../../apps/web/vite.config.ts):

- define `base: '/life-rpg/'`: scripts, CSS, imagens, ícones, manifest e
  `registerSW.js` recebem o prefixo;
- substitui `VITE_API_URL` por vazio: nenhum endereço do `.env` local entra no
  bundle publicado;
- copia `index.html` para `404.html`. O Pages não tem fallback de SPA; um link
  direto como `/life-rpg/perfil` recebe o `404.html`, que carrega o app.

As rotas do app (`/perfil`, `/financas`…) são relativas a `import.meta.env.BASE_URL`
([useUrlNavigation.ts](../../apps/web/src/app/useUrlNavigation.ts)); em `/` o
comportamento local não muda.

## PWA

- Manifest com `id`, `start_url` e `scope` iguais a `/life-rpg/` e ícones com o
  prefixo. O `id` próprio evita colisão com outros sites em
  `allansantanna.github.io`. Localmente continuam `/`, preservando instalações.
- Service worker `/life-rpg/sw.js`, registrado com escopo `/life-rpg/`.
  Pré-cache dos arquivos do build (exceto `404.html` e o renderer 3D, que tem
  cache próprio sob demanda) e navegação offline com `index.html`.
- Atualização: `registerType: 'prompt'` sem `skipWaiting`. A versão nova espera
  todas as abas antigas fecharem; `cleanupOutdatedCaches` remove caches de
  pré-cache antigos. Caches do service worker e IndexedDB são independentes:
  atualizar a PWA não apaga registros.
- Origem nova: `allansantanna.github.io` não compartilha dados, cache ou service
  worker com `127.0.0.1:5173`. Para levar os registros do uso local, exporte um
  backup no endereço local e importe no publicado.

## Dependências de backend

| Funcionalidade                                     | Fonte                              | No GitHub Pages                                                                             |
| -------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Cotação e gráfico de ações e FIIs (B3)             | `apps/api` → brapi.dev             | **Indisponível.** Cartões mostram aviso; investimentos e últimas cotações salvas continuam. |
| Pesquisa de tickers no cadastro                    | `apps/api` → brapi.dev             | **Indisponível.** O ticker pode ser digitado e salvo; é consultado quando houver servidor.  |
| Cotação do Bitcoin                                 | CoinGecko, direto do navegador     | Disponível, sujeita à API pública; falhas já são toleradas.                                 |
| Cotação do dólar (PTAX)                            | Banco Central, direto do navegador | Disponível, sujeita à API pública; falhas já são toleradas.                                 |
| Registros, XP, Radar, Quests, Treinos, backup, PWA | Navegador                          | Disponível, inclusive offline.                                                              |

Sem servidor configurado num build de produção, o cliente de mercado
([marketQuote.ts](../../apps/web/src/modules/finances/marketQuote.ts)) não faz
requisição e devolve a mensagem de indisponibilidade. Para reativar as cotações
da B3 no futuro, é preciso hospedar o `apps/api` com HTTPS e CORS para
`https://allansantanna.github.io`, manter `BRAPI_TOKEN` somente no servidor e
publicar o frontend com a URL pública da API. Isso exige decisão própria
(proposta, não implementada).

## Workflow

[pages.yml](../../.github/workflows/pages.yml):

1. Em pull requests: `npm ci`, `npm run check`, `npm run format:check`,
   `npm run build:pages` e [check-pages-build.mjs](../../scripts/check-pages-build.mjs).
   Nada é publicado.
2. Em push na `main` (ou execução manual na `main`): os mesmos passos, upload de
   `apps/web/dist-pages` como artefato do Pages e deploy no ambiente
   `github-pages`.

Permissões: `contents: read` no workflow; somente o job de deploy recebe
`pages: write` e `id-token: write`. Actions fixadas por SHA. Não há secrets; o
runner não tem `.env`. O verificador recusa o build com arquivo oculto ou de
ambiente, mapas de código, código-fonte, nomes de variáveis privadas, formatos
de token/chave, endpoints locais ou de rede privada, caminhos fora de
`/life-rpg/`, manifest incorreto ou `404.html` ausente.

### Ativação

1. Em _Settings → Pages_, a origem deve ser **GitHub Actions** (não um branch).
2. O primeiro deploy acontece quando este workflow chegar à `main` (merge do
   pull request). Depois, cada integração na `main` publica de novo.
3. Conferir o endereço, instalar a PWA pelo navegador do celular e testar
   exportação e importação de backup.

## Validação local do build publicado

```bash
npm run build:pages
node scripts/check-pages-build.mjs
npm run audit:pages   # Vite local em 127.0.0.1:5173 e PLAYWRIGHT_MODULE
```

[audit-pages.mjs](../../scripts/audit-pages.mjs) serve `dist-pages` em
`/life-rpg/` como o Pages (sem fallback, `404.html` com status 404) e verifica,
em Chromium com perfis descartáveis e dados sintéticos: manifest, ícones,
instalabilidade, escopo do service worker, pré-cache, links diretos e recarga,
offline com dados preservados, atualização sem `skipWaiting` e sem perda de
dados, backup no celular emulado (Pixel 7), aviso de cotações sem API e
ausência de rolagem horizontal em 320, 390, 768, 1024 e 1440 px. Também falha se
o app pedir algo fora de `/life-rpg/` ou chamar `localhost`.

## Limites

- Safari/iOS não é testado automaticamente neste ambiente; validar a instalação
  e o backup manualmente no iPhone.
- No iOS, a PWA instalada e o Safari podem ter armazenamentos separados, e o
  sistema pode remover dados de sites pouco usados. Exporte backups com
  frequência.
- Um service worker na raiz de `allansantanna.github.io`, se outro repositório
  o publicar, não controla `/life-rpg/` depois que o escopo mais específico
  estiver registrado; no primeiro acesso, a navegação passa pelo servidor.
