# Auditoria visual e estrutural de 17/11/2026

Registro da auditoria de padronização do frontend. Distingue o que foi
verificado, o que foi corrigido e o que permanece pendente. Referências:
[regras de desenvolvimento](../ai/development-rules.md),
[design system](../design-system/README.md) e
[responsividade](../design-system/responsive.md).

## Escopo

Botões, espaçamentos, cartões, formulários, modais, textos longos e navegação
das telas do app web, sem redesign, sem alteração de regras de negócio e sem
mudanças em XP, Radar, níveis, classes ou Quests.

## Verificações executadas

| Verificação                                      | Resultado                                   |
| ------------------------------------------------ | ------------------------------------------- |
| Testes de textos longos (etapa anterior)         | 30 aprovados, sem transbordamento           |
| `npm run format:check`                           | Aprovado após formatação de 15 arquivos     |
| `prettier --debug-check` nos arquivos formatados | Aprovado: formatação sem alteração de AST   |
| `npm run standards:check`                        | Aprovado com este relatório publicado       |
| `npm run typecheck`                              | Aprovado                                    |
| `npm run lint`                                   | Aprovado                                    |
| `npm test`                                       | 411 testes aprovados (403 web, 8 contracts) |
| `npm run build`                                  | Aprovado                                    |
| `npm run audit:visual` (matriz 320 a 1440 px)    | Aprovado: 240 capturas, 0 erros, 0 falhas   |

## Correções aplicadas

- Formatação Prettier, com a configuração do repositório, em 15 arquivos de
  `apps/web/src/modules/workouts/advanced/` (14 em `importing/` e
  `validation.ts`). Somente estilo de código; nenhuma alteração funcional.
- `AdvancedWorkouts.test.tsx`: tempo limite local de 15 s no teste de fluxo
  completo de fichas, que excedia 5 s com a suíte inteira em paralelo e passava
  isoladamente. A configuração global não foi alterada.
- Publicação deste relatório, referenciado por [docs/README.md](../README.md).

## Matriz visual

Executada em 18/11/2026 com Chromium headless (Playwright 1.65.1) contra o Vite
local, nas larguras 320, 390, 768, 1024 e 1440 px. Foram 48 telas e estados
(Dashboard, Pilares, Perfil, Estatísticas, Quests, Conhecimento, Descanso,
Finanças com diálogos e seletores, Treinos com as sete abas, assistente de
fichas, seletor de exercícios, sessão, importação e calendário), com dados
vazios, populados e com textos longos. As checagens automáticas do script não
encontraram rolagem horizontal, diálogo fora da tela nem divergência em
`ActionButton` (70 ocorrências, todas 160 × 44 px).

Todas as capturas foram inspecionadas visualmente. Os itens abaixo foram
confirmados e corrigidos; a captura final confirmou cada correção.

| Problema confirmado                                                                     | Correção                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Estatísticas, 320 px: ícone do atributo "Conhecimento" reduzido a um ponto              | `shrink-0` no ícone de `AttributesPanel`                |
| Conquistas (Dashboard e Estatísticas): cadeado esmagado quando o progresso quebra linha | `shrink-0` no ícone de `AchievementsPanel`              |
| Finanças, caixinha com nome longo: ícone reduzido a um ponto                            | `shrink-0` no ícone de `SavingsBoxCard`                 |
| Quests, até 640 px: "Concluir quest" com 42 px, vizinhos com 44 px (especificidade CSS) | Seletor incluído na regra móvel de 44 px em `index.css` |

Itens apontados e não tratados como defeito, por corresponderem ao padrão
documentado: contorno de foco no título da página após a navegação (foco
programático intencional, estilo global de `:focus-visible`); botões
`.record-primary` com largura do conteúdo (o padrão de 160 × 44 px vale apenas
para `ActionButton`); contorno interno do campo de busca do seletor de
exercícios (indicador de foco do campo aberto com foco).

## Pendências

Propostas que exigem decisão de design ou alteram texto visível; não foram
aplicadas para evitar redesign.

1. **Valores monetários em `Summary`.** Em 320 px (2 colunas) e 1024 px
   (4 colunas), "R$ 11.000,00" quebra dentro do número. O formato de moeda usa
   espaço inseparável, e o valor não cabe na coluna com a fonte atual
   (`clamp(18px, 2vw, 25px)`). Corrigir exige ajustar a escala tipográfica ou o
   número de colunas dos resumos.
2. **Botões de lista com o título do item no texto visível** (Conhecimento e
   Finanças, por exemplo "Editar livro <título>"). Com títulos longos viram
   blocos de várias linhas e alternam entre lado a lado e empilhados. Proposta:
   rótulo visível curto e título no nome acessível, como já ocorre em
   "Atualizar saldo".
3. **Espaçamento vertical irregular** de cerca de 60 px antes de alguns painéis
   (após "Modo Avançado", antes de "Carteira cadastrada", "Histórico de sono" e
   "Livros em andamento"), contra cerca de 20 px entre os demais.
4. **Prévia da importação:** botão "Remover série" restrito a uma célula da grade
   e placeholder "Opcional" do RIR cortado em 320 px.
5. **Radar em 320 a 1024 px:** rótulos dos eixos muito pequenos.
6. **Barra fixa do assistente de fichas:** fundo translúcido deixa o conteúdo
   rolado visível por trás.
7. **Textos:** "1 treinos" (plural) nos cartões de Treinos; capitalização
   divergente entre "Confirmar Importação" e "Cancelar importação".
