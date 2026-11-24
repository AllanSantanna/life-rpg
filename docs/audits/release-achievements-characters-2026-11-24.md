# Revisão de conquistas e personagens — 24/11/2026

Base inicial: `488fa84` (`main` e `origin/main`). Árvore inicial limpa, na branch
`feat/dark-fantasy-characters`, em `a2a485f`. Fetch com prune realizado.

## Histórico e escopo

Confirmado com `merge-base --is-ancestor`: `origin/main` →
`chore/achievement-assets` → `feat/profile-achievements` →
`feat/dark-fantasy-characters`. São 4 commits de assets, 5 de conquistas e 8 de
personagens, todos preservados. Integração por PR consolidado, com merge commit.

Branches locais comparadas com `origin/main` e respectivas remotas existentes:

- Trabalho novo: `chore/achievement-assets` (4), `feat/profile-achievements` (9
  cumulativos), `feat/dark-fantasy-characters` (17 cumulativos).
- Já ancestrais da main: `docs/ai-git-workflow`, `docs/no-ai-coauthor-trailers`,
  `feat/class-gallery`, `feat/lr-brand-interface-cleanup`, `feat/player-portraits`,
  `feat/profile-workouts-design-system`, `fix/audit-castle-visibility`,
  `fix/muscle-map-effort-colors`, `fix/muscle-map-restore-colors`.
- Histórico divergente antigo, sem patches exclusivos segundo `git cherry`:
  `chore/github-pages-deploy` (70 commits fora da ancestralidade, 65 patches equivalentes),
  `chore/integrate-finances-statistics` (19/17),
  `feat/data-backup-export-import` (63/59), `feat/finances-market-quotes` (8/8),
  `feat/finances-ui-organization` (5/5),
  `feat/interactive-statistics-dashboard` (9/9), `feat/muscle-map-redesign` (33/31),
  `fix/audit-technical-compliance` (57/54). A diferença de contagens inclui merges.
  Nenhuma dessas branches foi integrada novamente ou excluída.
- Remotas existentes: `origin/main`, `origin/chore/github-pages-deploy`,
  `origin/docs/no-ai-coauthor-trailers`, `origin/feat/class-gallery`,
  `origin/feat/data-backup-export-import`, `origin/feat/lr-brand-interface-cleanup`,
  `origin/feat/player-portraits`, `origin/fix/audit-castle-visibility`,
  `origin/fix/muscle-map-effort-colors`, `origin/fix/muscle-map-restore-colors`.
  Todas coincidem com suas branches locais correspondentes.

## Revisão funcional e visual

42 conquistas, cinco raridades e cinco categorias. Galeria no Perfil, resumo no
Início, destaques, progresso, filtros, notificação e preferência de ocultação.
A preferência usa `life-rpg:achievements-view`, separada do estado canônico.
Desbloqueios são projeções reversíveis dos registros, sem bônus de XP nem cópia
persistida dos resultados. A suíte cobre edição, exclusão, importação e ausência
de duplicação de notificações. Nenhuma nova aba foi adicionada.

24 cartas distintas, seis classes e quatro estágios. Limites 1–4, 5–9, 10–19 e
20+ preservados. Início e Perfil usam as mesmas cartas da galeria. Testes
existentes cobrem transições de nível e mudanças automáticas de classe. Inspeção
da prancha revisada e das cartas de Estrategista I/III e Sábio I/II não mostrou os
problemas anatômicos anteriores; a avaliação visual não equivale a uma garantia
anatômica automatizada.

Guerreiro IV: feita uma tentativa em cópia temporária, com canvas, limitada aos
trilhos externos da moldura e sem atingir interior ou gemas. O resultado perdeu
as transições metálicas e ficou artificial. Tentativa descartada; arquivo
original preservado byte a byte. Nenhuma dependência de imagem adicionada.

Auditoria suplementar Chromium em 320/390/768/1024/1440 px verificou 42 cards,
filtros combinados, preferência após recarga, notificação real após registrar
um treino e ausência de animações com movimento reduzido. Início e Perfil sem
imagens quebradas ou overflow horizontal. Capturas e resultados temporários em
`/tmp/life-final-achievements`.

## Dados e PWA

Não houve alteração em `playerState.ts`, armazenamento transacional, regras de
classes ou fórmulas de progressão. Dados sintéticos em contextos descartáveis;
nenhum perfil real foi usado. Assets legados e prévias foram preservados.

Playwright não faz parte das dependências do aplicativo nem está instalado pelo
lockfile: o CI o instala separadamente. Instalado `playwright@1.65.1` em
`/tmp/life-rpg-final-audit-tools`, com Chromium disponível, e definido
`PLAYWRIGHT_MODULE`. Builds históricos `6b0d981` e `43ddebbe` preparados em `/tmp`
pelo procedimento do workflow; nenhum ajuste no package.json ou lockfile.

A PWA mantém `registerType: prompt`, sem `skipWaiting`. Assets usados de
conquistas têm revisões de conteúdo; as 24 cartas têm hashes no build e precache.
Arte pixelada não entra no bundle. Atualizar o SW não apaga IndexedDB.
No Android, abrir online permite detectar/baixar a atualização; fechar a PWA e
todas as abas do Life RPG e reabrir permite ativar o worker em espera. Se ainda
aparecer a versão anterior, repetir a abertura online e o fechamento completo.
Não limpar dados do site nem reinstalar como procedimento de atualização.
A ativação num aparelho real não pode ser confirmada pelo deploy.

## Checklists

Revisados os checklists de implementação e revisão. Escopo, componentes e tokens
existentes preservados; sem alteração de layout, catálogo ou requisitos. Não
houve reset de dados, refatoração global, novas dependências do projeto, exclusão
de branches ou publicação fora da autorização explícita desta tarefa.

## Validações locais

- `VITEST_MAX_WORKERS=2 npm run check`: padrões, typecheck estrito, lint,
  8 testes Node de governança, 24 testes da API, 765 testes do frontend e build.
  Inclui os testes de conquistas, personagens, classes, progressão e migrações.
- `npm run format:check` e `npm run standards:check`: aprovados.
- `npm run audit:achievement-assets`: 55 assets; zero erros e três avisos
  preexistentes de pixels claros (`frame-uncommon`, `badge-uncommon`,
  `ui-progress`), mantidos sem processamento adicional.
- `npm run audit:persistence`: aprovado; 28 cenários nativos, 21 de migração/PWA
  e 13 de backup, sem falhas, erros de página ou bloqueios.
- `npm run build:pages` e `node scripts/check-pages-build.mjs`: aprovados;
  154 arquivos, base correta, sem segredos/endpoints internos.
- `npm run audit:pages`: nove cenários aprovados, sem erros de página ou
  requisições fora de `/life-rpg/`.
- Precache Pages: 80 entradas, 1550,83 KiB; 24 cartas e 44 recursos usados de
  conquistas. Sem arte legada ou prancha de conquistas no precache.

A primeira auditoria visual apontou uma asserção antiga: esperava quatro seções
no Perfil. Corrigida para cinco, incluindo Conquistas, sem reduzir a distância
mínima de 16 px. Os vãos medidos foram 20 px. Nenhuma regra visual foi alterada.
Uma primeira tentativa de auditoria da PWA coincidiu com a reconstrução de
`dist` e recebeu 404 temporário de `sw.js`; foi repetida com build estável.
Execuções interrompidas pelo terminal foram repetidas em sessão persistente.
Somente execuções completas com código de saída zero são consideradas aprovadas.

Avisos residuais: chunks acima de 500 kB, já documentados; WebGL indisponível no
Chromium local, com fallback 2D exercitado. Não houve relaxamento de testes,
limites de tempo ou validações.

## Commits da integração

- `0f96346` chore(assets): add achievement asset extraction and validation tooling
- `6018feb` build(pwa): keep achievement assets out of the precache until integration
- `7e23ae8` chore(assets): add extracted achievement assets, manifest and preview
- `52fbd42` docs(assets): document achievement asset preparation and quality limits
- `61156b1` feat(navigation): open profile sections by URL anchor
- `1c862ef` feat(achievements): add record-based achievement gallery to the profile
- `4555939` build(pwa): precache only the achievement assets in use
- `765b4d6` docs(achievements): document catalog, rules, limitations and visual patterns
- `b6f47df` docs(audits): add achievement screenshots for review
- `64cfdda` chore(assets): add dark fantasy character card extraction tooling
- `6e4fb9b` feat(profile): replace pixel character art with dark fantasy cards
- `edc1baf` docs(profile): document dark fantasy character cards and legacy art
- `07c0efa` docs(audits): add dark fantasy character screenshots for review
- `0998fa6` chore(assets): adapt character card extraction to the revised sheet
- `c644865` feat(profile): use the revised dark fantasy character cards
- `de617ee` docs(profile): update character card sizes, states and source sheet
- `a2a485f` docs(audits): refresh dark fantasy character screenshots
- `4c37fab` test(audit): account for the achievements section in profile spacing

## Resultado da auditoria visual completa

`npm run audit:visual`: **414 capturas, zero erros de página e zero falhas de
layout**, nas larguras 320, 390, 768, 1024 e 1440 px. Execução final em
`/tmp/life-final-visual-confirmed`, com inspeção das capturas de Início, Perfil,
galeria de classes, conquistas e notificação. O cenário de WebGL usou fallback 2D.
A execução final de `VITEST_MAX_WORKERS=2 npm run check` também terminou com
código zero após a correção da auditoria, assim como `npm run format:check`.

Publicação e ativação em um Android real são etapas distintas: o deploy e a
verificação pública serão registrados no PR e no relatório final da tarefa;
a ativação no aparelho depende de seus clientes antigos fecharem.
