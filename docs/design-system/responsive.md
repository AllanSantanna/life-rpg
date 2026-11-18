# Responsividade

Referências: [App](../../apps/web/src/app/App.tsx),
[Navigation](../../apps/web/src/app/Navigation.tsx) e
[index.css](../../apps/web/src/shared/styles/index.css).

O body tem largura mínima de 320 px. O conteúdo usa `min-width: 0`, grades
`minmax(0, 1fr)`, quebra de texto e flex com wrap para evitar transbordamento.

| Contexto                              | Regra implementada                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| Conteúdo da página                    | `max-w-[1480px]`, `px-5 sm:px-8 lg:px-10`                                          |
| Navegação abaixo de 1024 px           | Barra inferior fixa com `safe-area-inset-bottom`; conteúdo reserva `pb-28`         |
| Navegação a partir de 1024 px         | Sidebar de 240 px; conteúdo `lg:ml-60`                                             |
| Resumos abaixo de 768 px              | Quatro → duas colunas; painéis de registros com padding de 16 px                   |
| Resumos abaixo de 480 px              | Uma coluna; valores não quebram no meio (ex.: “R$ 11.000,00”)                      |
| Colunas de registros abaixo de 768 px | Uma coluna                                                                         |
| Campos de registro abaixo de 480 px   | Uma coluna                                                                         |
| Seletor compacto de Quests até 640 px | Ocupa a linha inteira                                                              |
| Treino avançado até 600 px            | Padding de 14 px; abas em quatro colunas, altura mínima de 65 px                   |
| Treino avançado em telas maiores      | Sete abas em colunas iguais                                                        |
| Gráfico de evolução de carga          | Rolagem local, SVG com largura mínima de 520 px                                    |
| Radar com menos de 400 px de largura  | Container query `radar`: rótulos e escala maiores no viewBox                       |
| Visão geral de Estatísticas           | Radar original em largura total e paisagem abaixo, em todas as larguras            |
| Cartões de Estatísticas               | Uma coluna no celular, duas a partir de 768 px e quatro a partir de 1280 px        |
| Calendário de atividades              | Células de 44 px, cabeçalhos fixos e rolagem horizontal restrita ao próprio painel |

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

## Auditoria visual automatizada

Com Vite rodando localmente e Playwright disponível no ambiente de auditoria,
execute `npm run audit:visual`. `PLAYWRIGHT_MODULE` aceita o caminho do módulo
Playwright instalado fora do projeto; `AUDIT_BASE_URL` aponta para o Vite local
e `AUDIT_OUTPUT` define a pasta de resultados (por padrão, uma pasta temporária).
Não execute fixtures de auditoria contra um site remoto ou um perfil real.

O roteiro percorre 320, 390, 768, 1024 e 1440 px, com dados vazios, preenchidos,
textos longos, formulários e popovers. `AUDIT_WIDTHS` permite restringir larguras.
Estatísticas inclui filtros, modos, camadas, seleção, calendário, teclado,
preservação do estado e alternativa 2D. O teste de câmera e perda de contexto
depende de WebGL disponível; sua ausência é registrada no log.

O comando verifica geometria e gera capturas e `results.json`; não faz comparação
automática de pixels nem auditoria completa de acessibilidade. Abra as capturas
para conferir legibilidade, foco, estados e alinhamento. O CI mantém os artefatos
para revisão. Limitações do navegador/GPU devem acompanhar o relatório.
