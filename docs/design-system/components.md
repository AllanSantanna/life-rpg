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
  Reutilize em novas escolhas; não introduza `<select>` nativo.
- [CustomDatePicker](../../apps/web/src/shared/components/CustomDatePicker.tsx):
  `mode` de data/mês, limites ISO, obrigatório, leitura e desabilitado. Reutilize
  no lugar de `input type="date"` / `type="month"`.
- Ambos compartilham [useAnchoredPopover](../../apps/web/src/shared/components/useAnchoredPopover.ts)
  para portal, geometria, fechamento e movimento reduzido.

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
alvos de 44 px e rolagem local. Esses componentes de domínio não substituem o Radar.

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

A caixinha financeira reutiliza `.record-actions` para “Atualizar saldo”; o nome
do investimento fica no rótulo acessível e no título do cartão. Listas de
registros e seus botões permitem quebra de títulos longos sem alargar a página.

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
