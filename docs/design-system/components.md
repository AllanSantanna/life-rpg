# Catálogo de componentes e estados

## Ações

| Necessidade                                | Implementação real                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Ação primária de tamanho padrão            | [ActionButton](../../apps/web/src/shared/components/ActionButton.tsx), 160 × 44 px                           |
| Salvar/cancelar em formulários de registro | `Actions` em [RecordUI](../../apps/web/src/modules/records/RecordUI.tsx)                                     |
| Primário de outros contextos existentes    | `.record-primary`; o treino avançado possui override próprio                                                 |
| Secundário/filtro                          | `.filter-button`, com `.active` ou `aria-pressed` conforme o controle                                        |
| Ação textual                               | `.text-action`; não significa automaticamente destruição                                                     |
| Destrutivo financeiro                      | `.financial-danger` e [FinancialConfirmation](../../apps/web/src/modules/finances/FinancialConfirmation.tsx) |
| Exclusão no treino avançado                | `DeleteAction` em [Controls](../../apps/web/src/modules/workouts/advanced/Controls.tsx), confirmação inline  |

Exemplo usado em `PlansPanel`:

```tsx
<ActionButton icon="plus" onClick={() => setCreating(true)}>
  Nova ficha
</ActionButton>
```

`ActionButton` usa `type="button"` por padrão. Aceita atributos nativos, `disabled`,
`ref` do React 19 e `type="submit"` explícito. Recebe `children` para o rótulo;
forneça texto significativo. Sem dependências, estado de domínio ou persistência.
Não crie outro botão primário se esse contrato atende à necessidade. Se precisar
de variante legítima, evolua o componente e documente-a antes de copiar o CSS.

## Formulários e seleção

- `Field`: label envolvendo rótulo e campo. `RecordForm`: título, `FormData` e
  captura de erro com `role="alert"`. `DateField`, `Summary`, `Empty` e
  `RecordFeedback` também estão em `RecordUI`.
- Inputs usam `.record-field input`; textarea tem regras de Quests ou de
  `.strength-workspace`. Não há componente genérico de input.
- [MoneyInput](../../apps/web/src/modules/finances/MoneyInput.tsx): máscara monetária
  e input oculto para o valor decimal. Reutilize no domínio financeiro.
- [CustomSelect](../../apps/web/src/shared/components/CustomSelect.tsx): `label`,
  `options`, `value/onChange` ou `defaultValue`; `name` participa de `FormData`.
  `describedBy` e `invalid` associam dicas e erros ao campo. Reutilize em novas
  escolhas; não introduza `<select>` nativo.
- [CustomDatePicker](../../apps/web/src/shared/components/CustomDatePicker.tsx):
  `mode` de data/mês, limites ISO, obrigatório, leitura e desabilitado. Reutilize
  no lugar de `input type="date"` / `type="month"`.
- [CustomTimePicker](../../apps/web/src/shared/components/CustomTimePicker.tsx):
  horário de 24 horas (`HH:mm`), controlado por `value/onChange`, com `required`,
  `disabled` e `describedBy`. Reutilize no lugar de `input type="time"`.
- [Disclosure](../../apps/web/src/shared/components/Disclosure.tsx): componente
  **oficial** de seção recolhível, usado em Finanças e no Mapa muscular. Botão com
  `aria-expanded`/`aria-controls` no título e seta (`chevron`) que gira; conteúdo
  montado só quando aberto. Props: `label` (nome acessível quando o título se
  repete), `level` (h2–h6), `defaultOpen`, `variant="text"` (`.text-action` em
  cartões), `count` (“Título (6)”), `hint` (“Mostrar/Ocultar detalhes”, oculto do
  leitor de tela) e `animated` (entrada discreta). Classes `.disclosure*`; seta e
  animação respeitam movimento reduzido. Troque a `key` para reiniciar o estado.
  Não crie outra seção recolhível.
- `<details>` nativo continua legítimo, e não deve ser trocado automaticamente,
  em quatro casos revisados em 20/11/2026: (1) ajuda e explicação de método
  (“Como funciona”, “Como ler…”, “Sobre os indicadores”), que permanece no DOM
  e na busca da página; (2) alternativa textual de gráfico (“Consultar valores
  do histórico”); (3) trechos de formulário com campos não salvos (“Detalhes do
  exercício”, “Data, horário, observações…”, observações da ficha, avisos da
  importação, apelidos), porque o `Disclosure` desmonta o conteúdo fechado e
  perderia o que foi digitado; (4) detalhes compactos dentro de cartões ou listas
  (sessões, recordes, ciclos de Quests, grupos do mapa). Áreas de seção de página
  usam `Disclosure`: em Finanças, “Contas, transferências e avaliações manuais” e
  “Configurações financeiras” foram convertidas para seguir as seções de histórico
  do mesmo módulo.
- [ConfirmAction](../../apps/web/src/shared/components/ConfirmAction.tsx): ação
  com confirmação explícita (exclusões, substituição ou restauração de registros).
  Mostra a consequência, “Confirmar …” e “Cancelar”; o foco vai para Cancelar ao
  abrir, Escape cancela e o foco volta ao gatilho. Usa `.strength-confirm`,
  `.record-primary` e `.filter-button`. Reutilize em vez de excluir no clique.
- Os três compartilham [useAnchoredPopover](../../apps/web/src/shared/components/useAnchoredPopover.ts)
  para portal, geometria, fechamento e movimento reduzido.
- Confirmação com prévia (backup de dados no Perfil): o `DataBackup` reutiliza
  `.strength-confirm`, `.record-primary` e `.filter-button` e o comportamento de
  foco de `ConfirmAction` (Cancelar focado, Escape cancela, foco volta ao gatilho).
  Não usa `ConfirmAction` porque a confirmação nasce da seleção de um arquivo e
  precisa exibir a prévia validada antes dos botões, sem um gatilho adicional.

Exceção atual: o `<select>` de tipo de série em
[SessionPanel](../../apps/web/src/modules/workouts/advanced/SessionPanel.tsx)
ocupa uma célula compacta, mostrando número/A+número. Foi preservado para evitar
alterar a tabela nesta tarefa; possui dispensa local justificada no ESLint.
Não é precedente para novos dropdowns nativos. Sua substituição deve considerar
largura, teclado, toque e contraste no celular.

## Painéis, navegação, tabelas e gráficos

| Tipo                      | Reutilização ou referência                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Painel genérico           | Classe `.panel`; não existe componente `Card`                                                                                                                 |
| Indicador do dashboard    | [MetricCard](../../apps/web/src/shared/components/MetricCard.tsx)                                                                                             |
| Linha compacta de valores | [Sparkline](../../apps/web/src/shared/components/Sparkline.tsx), usada por `MetricCard` quando `trend` tem série real; escala 0–100                           |
| Título de seção           | [SectionHeading](../../apps/web/src/shared/components/SectionHeading.tsx)                                                                                     |
| Barra com valor acessível | [ProgressBar](../../apps/web/src/shared/components/ProgressBar.tsx)                                                                                           |
| Navegação principal       | [Navigation](../../apps/web/src/app/Navigation.tsx), botões com `aria-current`                                                                                |
| Abas de treino            | [AdvancedWorkouts](../../apps/web/src/modules/workouts/advanced/AdvancedWorkouts.tsx), `tablist/tab/tabpanel` e teclado                                       |
| Listas e resumos          | `.record-list` e `Summary` com `dl/dt/dd`                                                                                                                     |
| Linhas de séries          | `SessionPanel`, grade CSS com grupos rotulados e cabeçalho visual; não é tabela HTML genérica                                                                 |
| Gráfico financeiro        | [FinancialChart](../../apps/web/src/modules/finances/FinancialChart.tsx), modelo separado em `chartModel.ts`                                                  |
| Cotação de ativos         | [MarketCharts](../../apps/web/src/modules/finances/MarketCharts.tsx): `PriceSparkline` no cartão e `MarketChart` com classes do `FinancialChart`              |
| Radar                     | [EvolutionRadar](../../apps/web/src/modules/evolution/EvolutionRadar.tsx), SVG e valores acessíveis                                                           |
| Evolução/volume de treino | [ProgressChart](../../apps/web/src/modules/workouts/advanced/ProgressChart.tsx) e [VolumeChart](../../apps/web/src/modules/workouts/advanced/VolumeChart.tsx) |

Não existe tabela compartilhada. Para novos dados tabulares, preserve semântica
de cabeçalhos, leitura e rolagem; não transforme a grade de séries em padrão
universal. Gráficos aceitam medidas calculadas inline, mas não novos temas inline.

`MetricCard` permite `actionLabel` opcional, preservando “Registrar {pilar}” por
padrão. Estatísticas usa “Ver detalhes”, com o pilar no nome acessível, e
`trendLabel` para descrever a série real do gráfico compacto. Valores sem esforço
pontuado usam “—” e explicação explícita. Não preencha `trend` com exemplos fictícios.

O [painel de Estatísticas](../../apps/web/src/modules/statistics/README.md) usa
tokens do tema, `data-area`, `.filter-button` e `CustomDatePicker` mensal. A paisagem
tem alternativa SVG e tabela textual; o heatmap possui intensidades rotuladas,
grade compacta, arraste horizontal e rolagem local. Esses componentes de domínio
não substituem o Radar.

Interruptor liga/desliga: `label.strength-switch` com `input type="checkbox"`,
`role="switch"`, nome acessível e `.strength-switch-track`, como no Modo Avançado
de Treinos e na personalização de Estatísticas. Não crie outro estilo de switch.

## Modais, alertas e estados

- `FinancialConfirmation` usa `<dialog>`, título associado, cancelamento por
  Escape e restauração do foco. É específico de Finanças, não um modal global.
- Calendário usa diálogo próprio; seletor usa listbox. Formulários de ficha são
  inline. Não há abstração global de modal ou toast.
- Erro: `.record-error` com `role="alert"`. Feedback: `RecordFeedback` com
  `aria-live="polite"`; alguns módulos usam `role="status"`.
  Associe o erro ao campo com `aria-describedby` quando aplicável; uma rejeição
  de formulário não deve ser anunciada apenas como mensagem de sucesso/status.
- Vazio: `Empty` / `.record-empty`, ou conteúdo contextual como `.workout-empty`.
  Explique a próxima ação; não preencha gráficos com progresso fictício.
- Hover/foco/desabilitado variam por controle. `ActionButton` usa gradiente de
  hover, outline de 2 px, offset de 3 px e opacidade 0.45 quando desabilitado.
  `CustomSelect` usa borda/outline próprios e opacidade 0.5.
- Não existe spinner ou componente global de carregamento. Se houver operação
  assíncrona, indique status, evite reenvio duplicado e mantenha o nome acessível.
  Não anuncie “salvo” enquanto a operação ainda estiver pendente.

Os cartões da carteira financeira ([InvestmentCard](../../apps/web/src/modules/finances/InvestmentCard.tsx))
usam `.panel` e mostram só duas ações: a principal da categoria (“Aportar”,
“Comprar mais”, “Comprar”) com `ActionButton` e o gatilho “Mais ações”
(`ActionMenu`), que reúne as secundárias, Editar e Excluir (com confirmação).
“Ver detalhes” usa `.text-action` e concentra notas longas, horário da cotação,
custos e operações recentes, sem repetir ações. Valores reutilizam a regra de
`.record-summary dd` e as métricas seguem as linhas `dt/dd` do `MetricCard`. A
grade usa `subgrid` para alinhar cabeçalho, conteúdo, ações e rodapé entre cartões
da mesma linha. Um teste e a auditoria visual falham se surgirem outros botões nos
cartões ou se as ações da mesma linha ficarem desalinhadas. O nome do
investimento fica no rótulo acessível e no título do cartão. Listas de
registros e seus botões permitem quebra de títulos longos sem alargar a página.

## Menu de ações

[ActionMenu](../../apps/web/src/shared/components/ActionMenu.tsx) agrupa ações
secundárias de um item. O gatilho é `.text-action` com seta (`chevron`),
`aria-haspopup="menu"` e `aria-expanded`. O painel usa `useAnchoredPopover`
(portal, posição dentro da viewport, clique fora, saída animada e movimento
reduzido) e as classes visuais do popup de `CustomSelect`
(`.custom-select__popup` e `.custom-select__option`), sem cores ou medidas novas.
Itens são `menuitem` com ícone do catálogo e nome acessível iniciado pelo texto
visível. Teclado: Enter, Espaço ou setas abrem; setas, Home e End percorrem as
opções habilitadas; Escape fecha e devolve o foco ao gatilho; Tab fecha. Ações
destrutivas continuam abrindo a confirmação correspondente. Use-o quando um item
tiver uma ação principal e outras secundárias; não substitui `CustomSelect` para
escolha de valores.

## Finanças: abas, áreas recolhíveis e formulários sob demanda

Componentes locais de [FinanceLayout](../../apps/web/src/modules/finances/FinanceLayout.tsx),
restritos ao módulo Finanças até que outra tela precise do mesmo contrato:

| Componente           | Uso                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `FinanceTabs`        | `tablist/tab/tabpanel`, roving tabIndex, setas, Home/End; botões com `.filter-button` e `.active`            |
| `Disclosure`         | Usa o [Disclosure oficial](../../apps/web/src/shared/components/Disclosure.tsx); a cópia local foi removida  |
| `InlineForm`         | Envolve um `RecordForm` aberto sob demanda: foca o primeiro campo e devolve o foco ao controle que o abriu   |
| `DeleteConfirmation` | Exclusões financeiras via `FinancialConfirmation`, com “Confirmar exclusão” e cancelamento sem alterar dados |

`Actions` aceita `cancel` para o rótulo do cancelamento (padrão “Cancelar edição”;
formulários de criação usam “Cancelar”). A seta gira sem transição com
`prefers-reduced-motion: reduce`. Formulários continuam inline: popovers de
`CustomSelect`/`CustomDatePicker`/`CustomTimePicker` usam portal e não devem ficar sob um `<dialog>` modal.

Ações de item em listas exibem só a ação (“Editar”, “Editar livro”, “Excluir
investimento”) e levam o nome do item no `aria-label`, que começa pelo texto
visível (ex.: `Editar livro Meditações`). Não repita títulos longos no texto do
botão. Rótulos de botões e abas usam maiúscula só na primeira palavra
(“Importar treino”), exceto nomes próprios como Quests e os pilares.

Quantidades com substantivo usam `plural` de
[shared/lib/plural.ts](../../apps/web/src/shared/lib/plural.ts): `1 treino`,
`2 treinos`, `1 série válida`.

Na importação, `.strength-stack` combinado com `.strength-confirm` mantém a pilha
vertical. A criação de fichas mostra somente a barra de ações do seletor enquanto
ele está aberto; a barra da etapa fica oculta nesse estado.

## Ícones

[Icon](../../apps/web/src/shared/components/Icon.tsx) é o catálogo SVG tipado por
`IconName`, com `currentColor`, `viewBox="0 0 24 24"`, traço 1.65 e tamanho padrão
20 px. As ações padronizadas usam 18 px. Ícones são decorativos (`aria-hidden`);
o nome acessível pertence ao botão ou texto acompanhante. Não adicione biblioteca
de ícones para reproduzir um símbolo que já existe.

## Anatomia interativa em Treinos Avançados

O [Mapa muscular](../../apps/web/src/modules/workouts/advanced/muscle-map/README.md)
é local ao módulo: regiões SVG selecionáveis, lista alternativa de botões de
44 px, duas abas com navegação por setas e `CustomSelect` de período. Título
local de 24 px, detalhes abaixo em contêineres menores e painel lateral a partir
de 820 px de largura disponível. A geometria anatômica não dita o tamanho dos
controles alternativos. Cores e borda de seleção também possuem rótulos textuais.
