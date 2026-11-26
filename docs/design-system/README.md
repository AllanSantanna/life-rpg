# Design system existente

A interface usa React, Tailwind CSS 4 e CSS compartilhado em
[index.css](../../apps/web/src/shared/styles/index.css), importado por
[main.tsx](../../apps/web/src/main.tsx). O tema é escuro, com vermelho nas ações
principais e cores por pilar. Não há biblioteca externa de componentes.

| Assunto                                     | Documento                          |
| ------------------------------------------- | ---------------------------------- |
| Tema, cores dos pilares e exceções          | [Cores](colors.md)                 |
| Família, tamanhos e hierarquia              | [Tipografia](typography.md)        |
| Tokens, dimensões, bordas e arredondamentos | [Espaçamentos](spacing.md)         |
| Componentes e estados existentes            | [Catálogo](components.md)          |
| Breakpoints e comportamento móvel           | [Responsividade](responsive.md)    |
| Teclado, semântica, foco e anúncios         | [Acessibilidade](accessibility.md) |

Identidade vetorial, variantes e recursos instaláveis: [Marca Life RPG](brand.md).

## Como escolher um padrão

1. Procure um componente no catálogo e uma tela do mesmo contexto.
2. Reutilize seu contrato, classe e tokens; não copie o JSX para criar uma variação.
3. Use utilitários Tailwind da escala existente para composições locais.
4. Se faltar um padrão, documente a necessidade e limite a mudança ao seu contexto.

## Limites e duplicações identificadas

- `.record-primary` varia entre formulários gerais e `.strength-workspace`.
  `.filter-button` também recebe regras específicas no treino avançado. Não
  existe ainda um único componente para todas as variantes de botão.
- `ActionButton` consolida as ações primárias de 160 × 44 px: “Importar treino”,
  “Nova ficha”, “Adicionar receita”, “Adicionar despesa”, “Novo investimento”, “Salvar data/hora” e
  “Criar minha quest”, entre outras. Inventário completo: busque `ActionButton`.
- `Field`, `RecordForm` e `Actions` são reutilizados entre pilares, mas permanecem
  em `modules/records/RecordUI.tsx`. Não há componente genérico `Input` ou `Card`.
- O CSS contém valores literais, regras repetidas e ajustes históricos após
  `@layer components`. A regra efetiva inclui os overrides posteriores.
- Cartões de métricas e cores de área usam paletas distintas. Não substituir uma
  pela outra sob a suposição de que representam o mesmo token.
- Não há componente global de tabela, modal ou carregamento. Use as referências
  do catálogo; não apresente uma futura consolidação como se já existisse.

Uma migração completa dessas duplicações exige tarefa própria e comparação
visual. Não se deve normalizar toda a interface como efeito colateral de uma feature.
