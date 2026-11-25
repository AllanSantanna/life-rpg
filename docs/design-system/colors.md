# Cores

Fonte: bloco `@theme` de
[index.css](../../apps/web/src/shared/styles/index.css). Ele disponibiliza tokens
como variáveis CSS e utilitários Tailwind (`bg-background`, `text-muted`, etc.).

| Token                  | Valor atual | Uso                                   |
| ---------------------- | ----------- | ------------------------------------- |
| `--color-background`   | `#090909`   | Fundo da página e campos de registros |
| `--color-surface`      | `#171717`   | Painéis                               |
| `--color-primary`      | `#dc2626`   | Destaques, progresso e identidade     |
| `--color-primary-dark` | `#7f1d1d`   | Vermelho escuro                       |
| `--color-foreground`   | `#f5f5f5`   | Texto principal                       |
| `--color-muted`        | `#a3a3a3`   | Texto secundário                      |
| `--color-positive`     | `#a8c7ac`   | Tom positivo disponível no tema       |
| `--color-on-primary`   | `#fff`      | Texto sobre ações primárias           |
| `--color-focus`        | `#fca5a5`   | Foco da ação primária padronizada     |
| `--color-bitcoin`      | `#f7931a`   | Ícone de Bitcoin                      |

`--color-error: #ffaaaa` centraliza a cor já usada em `record-error`, inclusive
nas rejeições de formulário do perfil e das configurações financeiras.

## Pilares

`data-area` atribui `--area-color`; reutilize esse mecanismo em cartões,
legendas e filtros. Tokens extraídos das cores que já existiam:

| Área         | Token               | Valor     |
| ------------ | ------------------- | --------- |
| Finanças     | `--color-finances`  | `#85c99a` |
| Treinos      | `--color-workouts`  | `#ed8989` |
| Descanso     | `--color-rest`      | `#bba0d7` |
| Conhecimento | `--color-knowledge` | `#d9bc82` |

As classes `.metric-finances`, `.metric-workouts`, `.metric-rest` e
`.metric-knowledge` usam `--accent`, respectivamente `#5be572`, `#ff5057`,
`#d69bf7` e `#f5b862`. Essa paleta mais viva pertence aos indicadores do dashboard.
Não houve migração dessas cores nesta tarefa.

## Classes

A galeria de classes atribui `--class-color` por `data-class`. Guerreiro,
Estrategista, Guardião e Sábio reutilizam os tokens de Treinos, Finanças,
Descanso e Conhecimento, coerentes com as molduras das cartas. Sem pilar
equivalente, dois tokens foram acrescentados ao tema:

| Classe      | Token                      | Valor     |
| ----------- | -------------------------- | --------- |
| Aventureiro | `--color-class-adventurer` | `#c9a27a` |
| Mestre      | `--color-class-master`     | `#f0a04b` |

Esses tokens são exclusivos da identificação das classes; não representam
pilares nem estados de progresso.

## Raridades de conquistas

Extraídas da paleta da prancha de conquistas. Uso exclusivo de raridade (brilho,
borda e etiqueta); o texto usa a cor misturada com branco para contraste.

| Raridade | Token                      | Valor     |
| -------- | -------------------------- | --------- |
| Comum    | `--color-rarity-common`    | `#8b6a4a` |
| Incomum  | `--color-rarity-uncommon`  | `#2e7d32` |
| Rara     | `--color-rarity-rare`      | `#2563eb` |
| Épica    | `--color-rarity-epic`      | `#7c3aed` |
| Lendária | `--color-rarity-legendary` | `#d4af37` |

`data-rarity` atribui `--rarity-color`, como `data-area` faz com os pilares.

## Ações e superfícies contextuais

`ActionButton` e o primário avançado usam `--color-action-start: #e33137`,
`--color-action-end: #a61920` e `--color-action-border: #ee4c50`.
O hover usa `--color-action-hover-start: #ed4449` e
`--color-action-hover-end: #bd2027`. Esses valores foram extraídos do CSS existente.
O primário dos formulários gerais continua com gradiente `#ba2028` → `#7f1d1d`.

Seletores, calendários, alertas e bordas têm tons contextuais ainda literais no
CSS. Reutilize as classes existentes; se uma nova composição exigir um token
sem equivalente, acrescente-o ao tema com sua finalidade documentada.

Não espalhe hex/RGB/HSL no JSX. Valores dinâmicos de gráficos podem usar geometria
inline; cores devem vir de tokens, classes ou `currentColor`. O ESLint verifica
literais hex e funções de cor inline e utilitários Tailwind com cores arbitrárias;
cores nomeadas, CSS externo e expressões indiretas ainda exigem revisão.

## Mapa muscular

Os tokens `--color-muscle-ready` (verde), `--color-muscle-recovering` (amarelo)
e `--color-muscle-tired` (laranja) são exclusivos da recuperação estimada no mapa.
O vermelho reutiliza `--color-primary`. O esforço parte do cinza e escurece com a
intensidade, só com tokens existentes: mistura de `--color-focus` com
`--color-muted` (Baixo), `--color-workouts`, `--color-primary` e
`--color-action-end` (Muito alto). Ausência usa `--color-muted`, com texto “Indeterminado”.
`--color-muscle-stabilizer` (`#80565a`, vermelho acinzentado) é exclusivo do
Esforço relativo: grupo que participou somente como estabilizador no período,
sem estímulo principal ou secundário contabilizado. Fica fora da escala
percentual, com texto “Estabilizador · participação não quantificada” e amostra
tracejada na legenda; não é usado na Recuperação. Nenhuma dessas
cores representa diagnóstico. São tokens temáticos, sem overrides de outros módulos.
