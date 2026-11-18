# Responsividade

Referências: [App](../../apps/web/src/app/App.tsx),
[Navigation](../../apps/web/src/app/Navigation.tsx) e
[index.css](../../apps/web/src/shared/styles/index.css).

O body tem largura mínima de 320 px. O conteúdo usa `min-width: 0`, grades
`minmax(0, 1fr)`, quebra de texto e flex com wrap para evitar transbordamento.

| Contexto                              | Regra implementada                                                         |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Conteúdo da página                    | `max-w-[1480px]`, `px-5 sm:px-8 lg:px-10`                                  |
| Navegação abaixo de 1024 px           | Barra inferior fixa com `safe-area-inset-bottom`; conteúdo reserva `pb-28` |
| Navegação a partir de 1024 px         | Sidebar de 240 px; conteúdo `lg:ml-60`                                     |
| Resumos abaixo de 768 px              | Quatro → duas colunas; painéis de registros com padding de 16 px           |
| Colunas de registros abaixo de 768 px | Uma coluna                                                                 |
| Campos de registro abaixo de 480 px   | Uma coluna                                                                 |
| Seletor compacto de Quests até 640 px | Ocupa a linha inteira                                                      |
| Treino avançado até 600 px            | Padding de 14 px; abas em quatro colunas, altura mínima de 65 px           |
| Treino avançado em telas maiores      | Sete abas em colunas iguais                                                |
| Gráfico de evolução de carga          | Rolagem local, SVG com largura mínima de 520 px                            |

Tailwind usa `sm`, `md`, `lg`, `xl` padrão (640/768/1024/1280 px). O CSS também
possui limites históricos em 359/479/480/600/639/640/767 px. Não invente um novo
breakpoint quando o componente correspondente já possui um.

`ActionButton` mantém 160 × 44 px com limite de 100% do contêiner. A toolbar de
importação alinha à direita e deixa 18 px antes das abas. Ações de largura total,
como `.workout-wide`, são outro contexto; não sobrescreva o componente para isso.

Validar manualmente em 320, 375/390, 768, 1024 e 1280 px, com texto longo e zoom.
Confira barra inferior, foco, popovers, teclado virtual, tabelas e ações fixas.
Essas larguras são uma matriz de revisão, não novos breakpoints de implementação.
Os testes jsdom de viewport não substituem a inspeção num navegador real.
