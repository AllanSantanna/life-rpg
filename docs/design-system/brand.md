# Marca Life RPG

A identidade usa um monograma LR angular em carmesim sobre grafite, com arestas
metálicas discretas. O vetor autoral está em
[icon.svg](../../apps/web/public/icons/icon.svg); não usa fontes, imagens externas,
emojis ou filtros. A paleta fixa do arquivo exportável corresponde aos tokens
`background`, `surface`, `muted`, `primary` e `focus`. Não é um novo tema.

[BrandLogo](../../apps/web/src/shared/components/BrandLogo.tsx) oferece a versão
completa (monograma + nome) na sidebar e `compact` (monograma) no cabeçalho móvel.
O nome acessível é “Life RPG”; o desenho interno é decorativo. O caminho usa
`import.meta.env.BASE_URL`, incluindo `/life-rpg/` no Pages. O tamanho de 44 px
reutiliza a altura de controle, com distância `--space-3` até o nome.

Favicon e PNGs instaláveis usam a mesma geometria, com contraformas abertas.
O PNG maskable possui fundo opaco e arte em 64% da largura: o monograma fica
inteiro dentro do círculo seguro central de raio 40%. O SVG comum mantém o
exterior transparente e uma placa escura para leitura em fundos claros/escuros.

Para regenerar os PNGs com Chromium, sem adicionar dependências ao aplicativo:

```bash
PLAYWRIGHT_MODULE=/caminho/para/playwright/index.mjs node scripts/generate-brand-icons.mjs
```

O manifest conserva nome, identidade, escopo e caminhos de instalação. Workbox
revisa os ícones no precache pelo conteúdo; uma nova versão aguarda o fechamento
das abas antigas, sem limpar IndexedDB. O ícone exibido pelo launcher depende da
atualização de metadados do navegador/sistema operacional; o teste automatizado
não comprova quando um launcher instalado atualizará sua imagem.

A navegação desktop/móvel compartilha o mesmo catálogo `Icon`: casa, prancheta
com marcação, gráfico de barras, grade e usuário, nessa ordem. Todos usam 20 px,
traço 1.65 e os estados existentes. A marca não substitui ícones de ações.

Cabeçalhos mantêm títulos e informação prática. Não acrescentar slogans ou
subtítulos motivacionais. `SectionHeading.eyebrow` é opcional e não reserva espaço
quando ausente. Instruções, métricas, estados vazios, confirmações, conquistas e
avisos de persistência permanecem visíveis.
