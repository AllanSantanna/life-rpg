# Arquitetura atual

Monorepo npm workspaces: `apps/web`, `apps/api` e `packages/contracts`.
[package.json](../../package.json) coordena scripts; TypeScript estrito deriva de
[tsconfig.base.json](../../tsconfig.base.json). Convenções práticas em
[conventions.md](conventions.md).

```text
apps/web/src/
  app/                 Composição, estado canônico, migração e URLs
  modules/             Regras e telas por domínio
  shared/components/   Controles e elementos visuais reutilizados
  shared/dates/        Datas civis, máscara e navegação de calendário
  shared/hooks/        Feedback visual reutilizado
  shared/storage/      Adaptador local de leitura e gravação
  shared/styles/       Tema, tokens e estilos do aplicativo
  test/                Setup e helpers de Testing Library
apps/api/src/          Infraestrutura Express, proxy de cotações (market) e reservas
packages/contracts/    Reserva de contratos públicos futuros
docs/                  Regras oficiais e contratos de domínio
scripts/               Validação da documentação e testes das regras
```

## Frontend e fluxo de dados

[App.tsx](../../apps/web/src/app/App.tsx) compõe páginas e aplica comandos.
[usePlayerState](../../apps/web/src/app/usePlayerState.ts) hidrata, reconcilia o
personagem e salva o estado canônico. Os módulos recebem dados e callbacks;
componentes compartilhados não gravam registros nem calculam recompensas.

```text
Interface → onCommand → comando puro/validação → novo estado
          → usePlayerState → repositório transacional → IndexedDB
          → projeções de personagem, XP, Radar e indicadores → interface
```

| Módulo         | Responsabilidade atual                                                                    |
| -------------- | ----------------------------------------------------------------------------------------- |
| `finances`     | Movimentos, contas, investimentos, cotações e cálculos monetários                         |
| `workouts`     | Registro diário, calendário e musculação opcional em `advanced/`                          |
| `rest`         | Sono diário, meta e médias                                                                |
| `knowledge`    | Biblioteca, leituras e progresso                                                          |
| `records`      | `LifeRecords`, união de comandos, validação e projeções comuns                            |
| `goals`        | Quests, comandos, ciclos, progresso, recompensas e apresentação                           |
| `gamification` | XP, níveis, atributos e conquistas derivados                                              |
| `evolution`    | Dedicação por pilar, períodos e Radar                                                     |
| `statistics`   | Projeções somente de leitura, paisagem 3D sob demanda, calendário e indicadores por pilar |
| `profile`      | Perfil, avatar, classe e projeção do personagem                                           |
| `missions`     | Compatibilidade de confirmações históricas; sem novas missões fixas                       |
| `auth`         | Reserva; não há autenticação implementada                                                 |

Integração entre pilares passa por `LifeRecords`, comandos e projeções comuns.
Quests consultam fontes reais; não alteram registros dos pilares. O treino
avançado mantém sessões próprias e pode atualizar o registro diário por data,
sem prêmio extra. Não crie cópias de XP, Radar ou nível nos componentes.
Mudanças nessas regras exigem solicitação explícita e os contratos do domínio.

O frontend só chama o `apps/api` para cotações de ações e FIIs
([módulo market](../../apps/api/src/modules/market/README.md)), que protege o
token da fonte. Sem a API, essas cotações ficam indisponíveis e o restante do app
continua local.

## Persistência

[playerState.ts](../../apps/web/src/app/playerState.ts) define `PlayerState`,
validação, migração, `PLAYER_STORAGE_KEY = 'life-rpg:player-state'` e versão 8.
O envelope é `{ version, data }`.
[transactionalStateStorage.ts](../../apps/web/src/shared/storage/transactionalStateStorage.ts)
é a fonte de verdade do jogador em IndexedDB. Importação com cópia original,
comparação de revisão, gravação e recuperação usam transações. A chave legada
`life-rpg:player-state` permanece intacta. O adaptador síncrono `localStateStorage.ts`
continua nas preferências descartáveis e na classificação dos formatos históricos.
Veja [persistência transacional](transactional-persistence.md).

Não há backend de dados do jogador nem sincronização entre dispositivos.
Ausente, inválido, incompatível e indisponível são estados diferentes. Conteúdo
inválido/futuro fica protegido, e indisponibilidade não monta um jogador vazio
no lugar dos registros. StrictMode e duas abas não duplicam a importação.
A interface aguarda hidratação e commit, sem anunciar salvamento antecipado.
Não use `localStorage.clear()` em código de produção nem grave por fora do hook.
Detalhes e histórico em [Persistência](../../apps/web/src/shared/storage/README.md).

## Navegação, serviços e backend

[useUrlNavigation](../../apps/web/src/app/useUrlNavigation.ts) usa History API;
[views.ts](../../apps/web/src/app/views.ts) define URLs e aliases. Preserve acesso
direto, recarga, Voltar/Avançar e foco após navegar.

As consultas externas existentes são isoladas no módulo financeiro:
`bitcoinQuote.ts` (BTC/BRL público), `usdQuote.ts` (PTAX) e `marketQuote.ts`, que
consulta ações e FIIs pelo proxy `market` da API (`VITE_API_URL`), com seus hooks.
Não adicione chamadas HTTP em elementos visuais compartilhados. Não há cliente
geral de API consumindo contratos de negócio.

[API](../../apps/api/src/app.ts): Express com Helmet, CORS, JSON limitado,
`GET /health`, 404 e middleware de erros. `server.ts` inicia o processo;
`config/env.ts` valida ambiente. O módulo `market` está implementado (proxy de
cotações da B3 via brapi, com cache e limites; ver
[market](../../apps/api/src/modules/market/README.md)); os demais diretórios de
domínio backend são reservas.
Prisma/PostgreSQL estão preparados, sem modelos de negócio ou migrações.
[contracts](../../packages/contracts/src/index.ts) ainda não exporta contratos de negócio.
Não implemente camadas futuras apenas para aproximar o projeto de um diagrama ideal.

PWA: Vite gera manifesto e cache de arquivos estáticos; não sincroniza dados.
Decisões de infraestrutura e planos futuros estão no
[registro arquitetural](../architecture.md).

## Dependências e riscos residuais

Atualizações são dirigidas, nunca `npm audit fix --force`. Situação em 20/11/2026:

- `@prisma/client` foi removido da API: não havia uso. A CLI `prisma` continua
  como dependência de desenvolvimento para `db:validate` e o schema preparado.
- `effect` (ReDoS, GHSA-7589-6fvf-x4pw) chega pela CLI do Prisma, que fixa
  `3.20.0`; nenhuma versão do Prisma corrige. O `overrides` da raiz usa `3.22.5`,
  mesmo major; `npm run db:validate` foi conferido. Remover o override quando o
  `@prisma/config` adotar uma versão corrigida.
- `typescript-eslint` foi atualizado dentro da faixa `^8` (8.73.0), o que
  corrigiu o `minimatch` usado por ele.
- **Risco residual (4 moderadas):** `glob` ≤ 14.0.1 (GHSA-3g3m-2fjr-6pw4) e o
  `minimatch` interno dele chegam por `vite-plugin-pwa` → `workbox-build`
  (`glob ^11`). Afetam só a geração do service worker durante o build, com
  caminhos do próprio projeto; não entram no bundle nem no servidor. A correção
  exige glob 14+, fora da faixa do `workbox-build`; `npm audit fix` não a aplica,
  e forçar a troca ou rebaixar o plugin não se justifica. Reavaliar quando o
  `workbox-build` aceitar glob corrigido.

### Tamanho do bundle

O Vite avisa que dois chunks passam de 500 kB (minificados). Análise com
sourcemaps em 20/11/2026: `LandscapeScene` (~556 kB) é o `three.js`, já
carregado sob demanda só quando a paisagem 3D é exibida; o `index` (~772 kB,
~250 kB gzip) reúne `react-dom`, Treinos (incluindo os vetores anatômicos do
mapa), Finanças, `fuse.js` e os demais módulos. O PWA pré-carrega os chunks
comuns, mas exclui `LandscapeScene` do precache e o obtém sob demanda; o cache
desse renderer é limitado a duas entradas por 30 dias. Dividir as demais rotas,
mantendo-as no precache, reduziria principalmente o parse inicial, não o download.
A divisão com benefício maior seria carregar Treinos Avançados sob demanda; ela
foi adiada porque exige reescrever dezenas de testes de fluxo como assíncronos.
O aviso permanece ativo de propósito (não se eleva `chunkSizeWarningLimit`).

As actions do CI ficam fixadas por SHA com a versão em comentário (ver
`.github/workflows/quality.yml`).

## Testes e validação

O Vitest do web usa `maxWorkers: '50%'`: com o padrão (núcleos − 1 processos
jsdom), fluxos de integração de 1 a 3 s passavam de 5 s de forma intermitente
pela disputa de CPU com o Vite e o editor. Nenhum tempo limite foi alterado.

Vitest com jsdom/Testing Library no web e ambiente Node/Supertest na API.
Testes `*.test.ts(x)` ficam próximos ao código. `test/setup.ts` fixa a data,
isola storage e restaura mocks. As suítes de persistência e migração exercitam
recarga, compatibilidade e preservação de dados; não usam dados reais do navegador.
Scripts de governança têm testes Node em `scripts/*.test.mjs`.

Há um roteiro de auditoria responsiva em Chromium separado das suítes Vitest:
[execução e limites](../design-system/responsive.md). Ele usa fixtures, valida
geometria e captura imagens, sem comparação automática de pixels.
Supertest precisa poder abrir porta local. Não exige banco ou integrações reais.
Comandos e limitações estão nas [regras de desenvolvimento](../ai/development-rules.md).

Os testes de componentes injetam um adaptador síncrono no limite da persistência,
sem mockar o hook ou as regras de domínio. A suíte assíncrona do hook testa filas,
confirmação, conflitos e leituras atrasadas. `npm run audit:persistence` exercita o
repositório nativo no Chromium, migrações, concorrência forçada entre abas,
recuperação, código legado e atualizações reais do service worker. O CI possui
um job `persistence` separado, com builds históricos e contextos descartáveis.
