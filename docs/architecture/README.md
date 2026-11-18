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
apps/api/src/          Infraestrutura Express e reservas de módulos
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
          → usePlayerState → adaptador local → localStorage
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

## Persistência

[playerState.ts](../../apps/web/src/app/playerState.ts) define `PlayerState`,
validação, migração, `PLAYER_STORAGE_KEY = 'life-rpg:player-state'` e versão 7.
O envelope é `{ version, data }`.
[localStateStorage.ts](../../apps/web/src/shared/storage/localStateStorage.ts)
isola JSON, acesso ao navegador, validação e tratamento de falhas.

Não há backend de dados do jogador nem sincronização entre dispositivos.
Storage ausente, inválido, incompatível e indisponível são estados diferentes.
Versão desconhecida ou leitura indisponível não deve ser sobrescrita. StrictMode
não deve duplicar migração, recompensas ou gravações na montagem.
Não use `localStorage.clear()` em código de produção nem grave por fora do hook.
Detalhes e histórico em [Persistência](../../apps/web/src/shared/storage/README.md).

## Navegação, serviços e backend

[useUrlNavigation](../../apps/web/src/app/useUrlNavigation.ts) usa History API;
[views.ts](../../apps/web/src/app/views.ts) define URLs e aliases. Preserve acesso
direto, recarga, Voltar/Avançar e foco após navegar.

As consultas externas existentes são isoladas em `bitcoinQuote.ts`, `usdQuote.ts`
e seus hooks no módulo financeiro. Não adicione chamadas HTTP em elementos
visuais compartilhados. Não há cliente geral de API consumindo contratos de negócio.

[API](../../apps/api/src/app.ts): Express com Helmet, CORS, JSON limitado,
`GET /health`, 404 e middleware de erros. `server.ts` inicia o processo;
`config/env.ts` valida ambiente. Os diretórios de domínio backend são reservas.
Prisma/PostgreSQL estão preparados, sem modelos de negócio ou migrações.
[contracts](../../packages/contracts/src/index.ts) ainda não exporta contratos de negócio.
Não implemente camadas futuras apenas para aproximar o projeto de um diagrama ideal.

PWA: Vite gera manifesto e cache de arquivos estáticos; não sincroniza dados.
Decisões de infraestrutura e planos futuros estão no
[registro arquitetural](../architecture.md).

## Testes e validação

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
