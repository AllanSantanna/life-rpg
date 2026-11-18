# Espaçamentos, dimensões e bordas

Fonte: [index.css](../../apps/web/src/shared/styles/index.css). Os tokens em
`:root` foram extraídos de medidas já usadas; não representam um redesenho.

| Token             | Valor | Referência de uso                         |
| ----------------- | ----- | ----------------------------------------- |
| `--space-1`       | 4 px  | Pequenos ajustes e padding de gráficos    |
| `--space-2`       | 8 px  | Ações e distância entre ícone e texto     |
| `--space-3`       | 12 px | Grupos, cabeçalhos e conteúdo compacto    |
| `--space-4`       | 16 px | Painéis móveis de registros               |
| `--space-5`       | 20 px | Separação entre seções de pilares         |
| `--space-6`       | 24 px | Padding de confirmação financeira         |
| `--space-field`   | 14 px | Grades de campos                          |
| `--space-section` | 18 px | Pilhas e separação da barra de importação |
| `--space-panel`   | 22 px | Padding de registros em telas maiores     |

Os utilitários Tailwind `gap-2`, `gap-3`, `p-4`, `p-5`, `p-6` seguem sua escala
normal de 4 px por unidade. Em composições locais, prefira essa escala ou as
classes existentes; valores de 14/18/22 px devem usar seus tokens semânticos.
Não substitua um valor contextual por outro só para torná-lo múltiplo de 4.

## Controles

- `--control-height`: 44 px, altura mínima recorrente; em `ActionButton`, também fixa.
- `--action-width`: 160 px para `ActionButton`; `max-width: 100%` e sem encolhimento flex.
- `--control-padding-y` / `--control-padding-x`: 10 / 12 px.
- `--control-radius`: 8 px; `--radius-panel`: 14 px.
- `ActionButton` centraliza ícone/texto, usa ícone de 18 px e não permite
  `className` ou `style` na API TypeScript. Não use esse componente para textos
  que não cabem ou ações que precisam de largura total.

Não imponha largura de 160 px a abas, filtros, células e botões de navegação.
São funções distintas. Ações equivalentes devem compartilhar a mesma dimensão.

## Bordas e arredondamentos existentes

Painéis `.panel`: borda de 1 px branco com 7% de opacidade e raio de 14 px.
Campos e ações gerais: raio de 8 px. Trigger de `CustomSelect`: 9 px;
popup: 11 px; confirmação financeira: 16 px. Preserve essas diferenças até
uma alteração explícita do padrão correspondente.

Há bordas contextuais como `#ffffff20`, `#ffffff26` e vermelho para confirmação.
Reutilize a classe responsável; não duplique todo o estilo em um novo seletor.
