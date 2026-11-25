# Revisão de integração — treinos e Mapa Muscular (25/11/2026)

## Base e inventário

Árvore inicial limpa em `fix/workout-import-whatsapp-headers`, HEAD `302a97b`.
Após `git fetch origin --prune`, `main` e `origin/main` apontavam para
`e4d9a775c5622b3287af828a78354387e95c2e24` (PR #9).
Todas as referências locais e remotas foram comparadas por ancestralidade e
por equivalência de patches (`git cherry`), preservando o trabalho existente.

| Branches analisadas                                                                                                                                                                                                                                                         | Resultado em relação à main inicial                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `chore/achievement-assets`, `feat/profile-achievements`, `feat/dark-fantasy-characters`                                                                                                                                                                                     | Integradas pelo PR #9: 42 conquistas e 24 cartas sombrias, sem reaplicação                                                     |
| `feat/workout-feedback-stabilizers`                                                                                                                                                                                                                                         | 16 commits pendentes; os primeiros 15 estão na branch consolidada e o último (`7eb9b2c`) equivale ao patch `06f713a`           |
| `fix/workout-import-whatsapp-headers`                                                                                                                                                                                                                                       | 18 commits pendentes; consolida estabilizadores, abdutores, confirmações e WhatsApp                                            |
| `fix/muscle-map-effort-colors`, `fix/muscle-map-restore-colors`, `fix/audit-castle-visibility`                                                                                                                                                                              | Já integradas pelos PRs #6–#8                                                                                                  |
| `docs/ai-git-workflow`, `docs/no-ai-coauthor-trailers`, `feat/lr-brand-interface-cleanup`, `feat/player-portraits`, `feat/class-gallery`, `feat/profile-workouts-design-system`                                                                                             | Sem patches exclusivos pendentes                                                                                               |
| `feat/finances-market-quotes`, `feat/finances-ui-organization`, `feat/interactive-statistics-dashboard`, `chore/integrate-finances-statistics`, `feat/muscle-map-redesign`, `fix/audit-technical-compliance`, `feat/data-backup-export-import`, `chore/github-pages-deploy` | Mantêm hashes históricos, mas todos os patches não merge já estão integrados; não reaplicar nem mesclar essas branches antigas |

As referências remotas existentes correspondem às branches locais do inventário.
Não foram encontradas funcionalidades independentes com patches exclusivos.
Nenhuma branch, prévia ou arte legada foi apagada.

## Estratégia e escopo

`feat/integrate-workout-improvements` foi criada em `302a97b`, descendente direto
da main atualizada. Preserva os 18 commits relacionados, sem cherry-pick,
rebase ou duplicação. A única alteração adicional desta revisão é este relatório.
O merge deve preservar o histórico pelo método de merge commit, já usado no
repositório, depois da aprovação dos checks do PR.

Incluído:

- Participação exclusivamente estabilizadora no Esforço relativo, com token
  `--color-muscle-stabilizer` (`#80565A`), e verde na Recuperação estimada sem
  percentual ou estímulo artificial.
- Abdutores rastreados nos agachamentos bilaterais revisados. Participação
  principal/secundária mantém a escala normal; ausência de participação mantém
  estado indeterminado. As superfícies anatômicas compartilham o mesmo estado.
- Cabeçalhos WhatsApp com hora antes da data e data antes da hora, preservando
  formatos anteriores e texto original.
- `Treino importado!` após a confirmação definitiva e o commit local, com nome,
  destino, exercícios, séries e OK. Interpretar o texto não importa nem confirma.
- Revisão antes de finalizar a sessão, resumo, aviso de pendências e
  `Treino finalizado!` após salvar, com bloqueio contra repetição do comando.

O hook de persistência ganhou um observador `whenSaved` do ciclo existente.
Não há mudança de schema, migrações, formato de backup ou regras de XP, níveis,
classes, Radar e Quests. Conquistas continuam derivadas dos registros; não há
novo armazenamento de desbloqueios. Nenhum dado real de navegador foi usado.

## Verificação funcional em Chromium

Perfis descartáveis em 390 e 1440 px, com a data fixa de 25/11/2026:

1. O exemplo exato de WhatsApp do pedido produziu um exercício e três séries
   (`12 × 50 kg`, `6 × 80 kg`, `9 × 100 kg`), sem horário ou remetente como
   exercício. O nome genérico "Agachamento" exige escolher a variante existente
   "Agachamento livre" no catálogo, conforme a validação de ambiguidade atual.
2. A prévia não alterou o snapshot canônico nem abriu diálogo de sucesso.
3. Depois de confirmar, o diálogo mostrou um exercício e três séries; o
   IndexedDB já continha exatamente uma sessão em andamento.
4. A revisão de finalização apareceu com a sessão ainda em andamento no banco.
5. O sucesso apareceu com a sessão concluída já persistida; recarregar preservou
   uma única sessão concluída e as três séries.
6. Nenhum erro de página. As capturas dos diálogos móveis foram inspecionadas.

As suítes existentes também exercitam falhas de gravação, conflitos, pendências,
cliques repetidos, cancelamento, teclado, foco e ausência de sucesso antecipado.

## Validações locais

| Verificação                                                  | Resultado                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `VITEST_MAX_WORKERS=2 npm run check`                         | Aprovado: padrões, TypeScript, lint, 8 testes de governança, 24 da API, 847 do frontend e builds  |
| `npm run format:check` e `npm run standards:check`           | Aprovados                                                                                         |
| `npm run audit:achievement-assets`                           | 55 assets, zero erros; três avisos preexistentes descritos abaixo                                 |
| `node scripts/audit-muscle-map.mjs`                          | 55 capturas nas cinco larguras; zero erros e falhas                                               |
| `npm run audit:persistence`                                  | IndexedDB 28/28, atualização/PWA 21/21, backup 13/13; zero falhas                                 |
| `npm run build:pages` e `node scripts/check-pages-build.mjs` | Aprovados; 154 arquivos verificados, base correta, sem segredos ou endpoints internos             |
| `npm run audit:pages`                                        | Nove cenários aprovados; manifesto, offline, assets, navegação, atualização e backup móvel        |
| Fluxo real de WhatsApp, importação e finalização             | Aprovado em 390 e 1440 px; confirmação verificada no IndexedDB antes do sucesso e após recarregar |
| `npm run audit:visual`                                       | Aprovada em 320, 390, 768, 1024 e 1440 px; zero erros de página ou falhas de layout               |

Todos os scripts pedidos existem. O Playwright 1.65.1 e o Chromium já estavam
instalados fora do projeto e foram reutilizados, sem adicionar dependências.
Os builds históricos `previous` e `pre-trapezius` foram usados na auditoria de
persistência. O bundle principal e o service worker do build local foram
comparados por SHA-256 após o check: idênticos aos auditados na persistência.

A primeira tentativa de `VITEST_MAX_WORKERS=2 npm run check`, concorrente com
build e várias auditorias de navegador, excedeu os limites originais em dois
casos de `AdvancedWorkouts.test.tsx`. Foi interrompida e repetida sem auditorias
concorrentes. Nenhuma asserção ou limite de tempo foi alterado.

A auditoria visual inicial recebeu SIGTERM, sem erros ou falhas registrados,
após concluir 320 e 390 px e durante 768 px. As larguras 768, 1024 e 1440 px
foram repetidas integralmente em execução separada, depois do check: 248 capturas,
zero erros de página e zero falhas de layout. Asserções, cenários e layout foram
preservados.

## Publicação e PWA

O PR e o deploy devem ser confirmados no GitHub antes do encerramento. O hash
final, as URLs de CI e o resultado em produção serão registrados no relatório
final da execução e na descrição do PR.

A configuração existente mantém `id`, `start_url` e `scope` em `/life-rpg/`,
assets com hash e service worker no mesmo escopo. A versão nova aguarda as abas
antigas fecharem, sem `skipWaiting`; caches de assets e IndexedDB são separados.
O teste de atualização usa perfis sintéticos e verifica os dados após ativação.

No Android, abrir a aplicação online para receber a versão, fechar todas as
abas do Life RPG e a PWA e reabrir permite ativar o worker novo. Não limpar dados
do navegador nem desinstalar para atualizar. O deploy confirmado disponibiliza
a versão; não comprova que uma instalação específica no celular já a ativou.
Não houve acesso ao aparelho físico, nem teste manual de Safari/iOS.

## Limitações e revisão

- WebGL indisponível no Chromium local: auditoria usa o fallback 2D existente.
- Permanecem os avisos documentados de chunks acima de 500 kB.
- A auditoria dos 55 assets de conquistas mantém três avisos preexistentes de
  pixels claros em peças auxiliares (`frame-uncommon`, `badge-uncommon`,
  `ui-progress`), sem erros.
- GitHub Pages continua estático, sem o backend de cotações da B3; registros e
  últimas cotações salvas permanecem disponíveis.

Os checklists de implementação e revisão foram usados: base e árvore inicial
conferidas; escopo restrito; dados e histórico preservados; identidade visual,
controles e acessibilidade revisados; validações sem enfraquecimento; diff,
staging e arquivos não rastreados conferidos antes do commit. Push, PR, merge e
publicação têm autorização explícita no pedido. Nenhum crédito automático de
IA foi adicionado aos commits.
