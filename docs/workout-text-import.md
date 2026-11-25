# Relatório — Importação Rápida de Treinos

## Funcionalidades

- Botão **Importar treino** disponível em todas as abas do modo avançado.
- Fluxo **colar → interpretar → revisar/editar → confirmar → salvar**.
- Seleção de ficha A–E/personalizada, treino livre ou sessão existente; data
  selecionável para novas sessões. A data detectada no texto também pode mudar a
  data de uma sessão existente, mantendo o horário de início gravado. Sessões
  novas criadas pela importação ficam sem horário de início (não é inventado).
- Interpretação de blocos e linhas compactas, kg, decimais com ponto/vírgula,
  `x`/`×`, RIR opcional, aquecimento e séries válidas, mantendo a ordem.
- Mensagens copiadas do WhatsApp: `[hora, data] Remetente: texto`,
  `[data, hora] Remetente: texto` e a exportação `data, hora - Remetente: texto`
  (hífen opcional; segundos aceitos). `whatsappMessage` (`metadata.ts`) remove
  só esse cabeçalho no início da linha, durante a interpretação; o remetente vai
  até o primeiro `: ` e o conteúdo segue intacto (inclusive outros dois-pontos).
  A data vai para os metadados (data inválida gera aviso). O texto original da
  importação não é alterado. Linhas sem data e horário no início, como
  `Supino reto: 60x10`, não são tratadas como mensagens. Datas em ordem
  americana (MM/DD) e horários com AM/PM não são reconhecidos.
- Normalização de acentos/caixa e Fuse.js, com sinônimos, catálogo completo,
  exercícios personalizados e snapshots da sessão. A ficha/sessão tem prioridade
  na lista de alternativas. Correspondências ambíguas exigem escolha manual.
- Prévia com troca/remoção de exercícios e edição/adição/remoção de séries,
  cargas, repetições, RIR e tipos; avisos sobre informações não interpretadas.
- Carga e repetições obrigatórias para confirmar; valores ausentes não são
  inventados. RIR vazio permanece `null`, distinto de zero.
- Conflitos por exercício com escolha explícita entre manter, substituir e
  acrescentar apenas novas séries. A comparação considera também a quantidade
  de séries iguais, RIR e tipo.
- Confirmação atômica, bloqueio de cliques repetidos e repetição idempotente do
  mesmo comando. Uma sessão alterada após a prévia exige nova conferência.
- Durante a gravação, “Importando…” desabilita confirmar, cancelar e
  interpretar. O diálogo **Treino importado!** (“O treino foi importado com sucesso.”, `StatusDialog`) só aparece após
  `whenSaved()` confirmar o commit local, com nome, destino (nova sessão ou sessão existente), data, exercícios e séries
  realmente escritos (`receipt.ts`: manter não conta, acrescentar conta só as
  novas) e séries planejadas pendentes, quando houver. Falha ou conflito de
  gravação exibem erro e restauram o botão. Se nenhuma série nova seria gravada,
  nada é enviado e uma explicação substitui a confirmação.
- Persistência pelo mecanismo local existente, sem alteração do contrato v1,
  do envelope ou da chave `life-rpg:player-state`.
- Preservação de fichas permanentes, exercícios personalizados, snapshots e
  sessões não selecionadas. Séries substituídas reutilizam os IDs dos slots.
- Layout dark/vermelho e regras responsivas para os formulários de importação.

## Comportamentos explícitos

Séries importadas são registradas como realizadas. Uma nova sessão permanece em
andamento para revisão e conclusão pelo fluxo existente. Corrigir uma sessão
concluída recalcula os indicadores avançados derivados daquela sessão.

Importar não altera o registro diário, XP, Radar, classes, níveis, conquistas ou
rotação. Exercícios adicionais entram somente na sessão, sem alterar a ficha.
O cabeçalho escrito no texto não escolhe o destino automaticamente.
Ao mudar a data de uma sessão existente, o horário de início gravado é mantido;
se o resultado ficar no futuro, a importação é recusada com orientação, pela
mesma regra do registro e da correção manuais.

Sem marcador de tipo, a série é válida. Avisos referem-se ao texto interpretado;
editar o texto, destino ou data invalida a prévia e exige nova interpretação.
Os erros de validação nos campos refletem as correções feitas na prévia.

## Arquivos desta implementação

| Arquivo                                                                        | Responsabilidade                                                |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `apps/web/package.json`                                                        | Dependência Fuse.js                                             |
| `package-lock.json`                                                            | Versão resolvida da dependência                                 |
| `apps/web/src/modules/workouts/advanced/AdvancedWorkouts.tsx`                  | Entrada e navegação do fluxo                                    |
| `apps/web/src/modules/workouts/advanced/types.ts`                              | Comando de importação atômica                                   |
| `apps/web/src/modules/workouts/advanced/commands.ts`                           | Integração ao executor existente                                |
| `apps/web/src/modules/workouts/advanced/importing/types.ts`                    | Modelos temporários da prévia e destino                         |
| `apps/web/src/modules/workouts/advanced/importing/normalize.ts`                | Normalização dos nomes                                          |
| `apps/web/src/modules/workouts/advanced/importing/matcher.ts`                  | Fuse.js, sinônimos, confiança e alternativas                    |
| `apps/web/src/modules/workouts/advanced/importing/parser.ts`                   | Interpretação local do texto                                    |
| `apps/web/src/modules/workouts/advanced/importing/validation.ts`               | Validação das séries importadas                                 |
| `apps/web/src/modules/workouts/advanced/importing/ImportPreview.tsx`           | Prévia editável e decisões de conflito                          |
| `apps/web/src/modules/workouts/advanced/importing/TextWorkoutImport.tsx`       | Destino, texto, interpretação e confirmação                     |
| `apps/web/src/modules/workouts/advanced/importing/sessionIntegration.ts`       | Associação de IDs, snapshots e mesclagem                        |
| `apps/web/src/modules/workouts/advanced/importing/persistence.ts`              | Confirmação atômica e proteção de alterações concorrentes       |
| `apps/web/src/modules/workouts/advanced/importing/receipt.ts`                  | Resumo exato do que a importação grava                          |
| `apps/web/src/modules/workouts/advanced/importing/importing.css`               | Estilos específicos e responsividade                            |
| `apps/web/src/modules/workouts/advanced/importing/importing.test.ts`           | Interpretação, busca, integração e persistência                 |
| `apps/web/src/modules/workouts/advanced/importing/contextual.test.ts`          | Interpretação contextual de linhas e metadados                  |
| `apps/web/src/modules/workouts/advanced/importing/TextWorkoutImport.test.tsx`  | Interface e aplicação real                                      |
| `apps/web/src/modules/workouts/advanced/importing/whatsapp.test.ts`            | Cabeçalhos do WhatsApp, formatos equivalentes e casos negativos |
| `apps/web/src/modules/workouts/advanced/importing/importConfirmation.test.tsx` | Recibo, gravação confirmada, erros e diálogo de sucesso         |
| `apps/web/src/modules/workouts/README.md`                                      | Documentação do fluxo e decisões                                |
| `docs/workout-text-import.md`                                                  | Este relatório                                                  |

O workspace já continha outras alterações e o módulo avançado ainda não rastreado
pelo Git. Essas alterações anteriores foram preservadas; a tabela lista somente
os arquivos envolvidos neste trabalho.

## Verificação na entrega original

_Registro histórico da entrega; as contagens atuais estão no resultado de
`npm test`._

- `npm run typecheck`: passou em todos os workspaces.
- `npm run lint`: passou, sem avisos.
- `npm run test -w @life-rpg/web -- --maxWorkers=2`: **369 testes passaram em 46
  arquivos**, incluindo os **56 testes novos**.
- `npm run test -w @life-rpg/api`: **8 testes passaram em 2 arquivos**.
- `npm run build`: passou em todos os workspaces, incluindo o build PWA.
- Prettier aplicado aos arquivos de código/documentação envolvidos.
- `git diff --check`: passou.

A primeira execução de `npm test`, simultânea aos demais verificadores, atingiu
timeout de 5 segundos em três testes de interface existentes. A suíte web inteira
passou ao limitar a concorrência a dois workers, sem mudar os timeouts. Os testes
HTTP da API precisaram executar fora do sandbox para abrir uma porta local.

## Pendências e limites

- Verificação visual em navegador a 375 px e desktop pendente: foi tentada com
  Chromium/Playwright, mas o navegador não iniciou porque o ambiente não possui
  `libglib-2.0.so.0`. Edição, confirmação e recarga foram verificadas nos testes
  de integração com a aplicação real em jsdom.
- O Vite avisou que o bundle JavaScript principal ultrapassa 500 kB
  (aproximadamente 512 kB minificado, 160 kB gzip). O build terminou com sucesso;
  dividir o bundle fica como melhoria de desempenho futura.
- Novos sinônimos podem ser acrescentados ao dicionário local. Nomes que não
  atingem confiança suficiente permanecem para decisão manual.

Não foram implementados backend, autenticação, APIs externas, voz ou cronômetro.
