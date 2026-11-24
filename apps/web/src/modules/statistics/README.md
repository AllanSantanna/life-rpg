# Estatísticas: histórico real e exploração

`StatisticsPage` organiza o Radar original, a paisagem, o calendário e os quatro
cartões. `EvolutionPanel`, `EvolutionRadar`, `scoring.ts` e seus estilos não são
alterados. O filtro persistido do Radar continua no `App`; o filtro dos novos
gráficos é local, começa em 30 dias e aceita 7/30/90. O calendário tem navegação
mensal independente. Os novos controles não gravam estado, emitem comandos ou
alteram recompensas, Quests, personagem ou contratos de storage.
O resumo de conquistas (o mesmo do Início) permanece após os indicadores, com o
atalho "Ver conquistas" para a galeria no Perfil.

## Personalização da visualização

O botão “Personalizar visualização”, no cabeçalho da visão geral, abre um painel
em largura total com interruptores (`input type="checkbox" role="switch"`, estilo
`.strength-switch`) para o Radar, a paisagem, o calendário e cada um dos quatro
cartões. Tudo começa visível; “Mostrar todas as seções” restaura o padrão. Escape
e “Concluir” fecham o painel e devolvem o foco ao botão.

As escolhas ficam em `life-rpg:statistics-view` (envelope `{ version: 1, data }`),
gravadas pelo adaptador `createLocalStateStorage` somente quando o usuário altera
um interruptor. A chave é separada de `life-rpg:player-state`: preferências visuais
não mudam o esquema, a validação, as migrações nem os registros. Valor ausente ou
inválido mostra todas as seções e não é sobrescrito na leitura.

Ocultar remove apenas a interface. Projeções, filtros e cálculos continuam iguais;
o Radar é o mesmo `EvolutionPanel`, apenas não montado. Sem a paisagem, o
`React.lazy` não solicita `LandscapeScene` (o renderer WebGL). O filtro 7/30/90 só
aparece quando a paisagem ou algum cartão está visível. A grade de cartões usa a
quantidade visível (`data-count`) para ocupar a linha sem colunas vazias, e uma
mensagem explica quando todas as seções estão ocultas.

## Dados, indicadores e comparação

- `aggregation.ts` contém projeções puras; `types.ts` define o contrato da UI.
- `indexActivities` lê movimentos financeiros, transferências, investimentos,
  avaliações, dias de treino, sessões detalhadas, sono e leituras de `LifeRecords`.
  Não transforma cotações automáticas, criação de contas ou saldo inicial em atividade.
  Posições iniciais aparecem no detalhe, identificadas e sem intensidade.
  Referências ausentes usam “Livro/Investimento/Conta indisponível”; não há dados
  demonstrativos em produção, estimativa de duração ou calorias.
- `evolutionSeries` reutiliza `scorePeriod` sobre as atividades verificadas que
  já alimentam o Radar. Cada data mostra a dedicação móvel de **sete dias**
  encerrados nela, em 0–100. Há uma amostra por dia do período, inclusive zeros.
  As laterais das montanhas representam largura geométrica; a crista é o valor.
  Não há interpolação de dados, novo sistema de pontuação ou esforço vindo das séries.
- O valor anterior de uma amostra usa sete dias encerrados 7/30/90 dias antes,
  conforme o filtro. Só é comparado se há esforço verificável nessa janela.
  A comparação é em pontos, sem percentuais inventados.
- Cartões usam `comparePeriods` no período completo selecionado, com a mesma
  fórmula do Radar. A linha compacta usa a série móvel de sete dias. Esses dois
  intervalos são identificados na interface. Sem esforço pontuado, o cartão mostra
  “—” e o estado vazio; não apresenta dados fictícios.
- Consistência = dias civis com intensidade positiva ÷ dias do período, incluindo
  dias sem registro no denominador e excluindo datas futuras. É uma medida de
  registro, diferente de dedicação. Treinos mostra separadamente os dias realmente
  marcados como treinados. Sessões podem aumentar cobertura do calendário sem
  acrescentar dedicação ou XP. Confirmações históricas podem aparecer na dedicação,
  como no Radar, mas não são inventadas como registros no calendário.

Datas usam os helpers civis existentes. Os detalhes mostram somente os registros
da data selecionada, incluindo declarações de não treino e sono zero quando
existirem. A ausência de registros tem mensagem explícita.

## Intensidade do calendário

As escalas medem atividade registrada dentro de cada pilar, sem comparar sua
importância entre pilares e sem qualificar sucesso financeiro, saúde ou esforço.
Múltiplos registros do mesmo tipo não implicam maior intensidade, salvo páginas,
cuja métrica explícita é o volume lido no dia.

| Pilar        | Nenhuma (0)                                         | Baixa (1)                         | Média (2)                         | Alta (3)                      | Muito alta (4)                                   |
| ------------ | --------------------------------------------------- | --------------------------------- | --------------------------------- | ----------------------------- | ------------------------------------------------ |
| Finanças     | Sem operações elegíveis                             | Somente avaliação de investimento | Receita, despesa ou transferência | Aporte ou resgate não inicial | Operação de caixa e de investimento no mesmo dia |
| Treinos      | Sem treino/sessão; declaração de não treino isolada | Sessão em andamento               | Dia marcado como treinado         | Sessão concluída              | Dia treinado com sessão concluída                |
| Descanso     | Sem sono positivo                                   | Menos de 50% da meta pessoal      | 50% a menos de 75%                | 75% a menos de 100%           | A partir de 100%, sem bônus por exceder          |
| Conhecimento | Sem páginas positivas                               | 1–9 páginas                       | 10–19 páginas                     | 20–39 páginas                 | 40 ou mais páginas                               |

Vale o maior nível aplicável no dia. Valores monetários, quantidade de despesas,
quantidade de sessões, exercícios e séries não determinam a intensidade.
O nível financeiro 4 mede cobertura de tipos de registro; gastar mais não melhora
o indicador. O nível de treino mede completude de registro, sem pontos extras.

## Renderização 3D e alternativa acessível

Three.js e seus tipos são as únicas adições. `OrbitControls` vem do próprio
Three.js; React Three Fiber e Drei não são necessários para esta cena limitada.
`EvolutionLandscape` carrega `LandscapeScene` com `React.lazy` somente quando
Estatísticas está aberta e o navegador oferece WebGL 2. Os três modos compartilham
a série: cristas temporais, colunas por data/pilar e faixas de superfície com malha.

Arraste para orbitar; roda/pinça ajustam distância. Há botões para rotação,
inclinação, zoom e restauração, e seleção por raycasting em superfícies/colunas.
Seletor de data, botões anterior/próximo, camadas com `aria-pressed`, resumo vivo
da seleção e tabela completa expõem os mesmos valores por teclado e toque.
Pilares ocultos continuam disponíveis na tabela acessível.

A câmera é preservada ao trocar dados, modo ou seleção. Não há rotação automática,
inércia ou loop contínuo: frames são solicitados somente por mudança de câmera,
dados, tamanho ou seleção. DPR limitado a 1,5, no máximo 90 amostras × quatro
pilares, sem sombras ou pós-processamento. Geometrias, materiais, contexto,
listeners e observadores são liberados na desmontagem, inclusive em StrictMode.
O renderer usa os tokens do tema, sem paleta duplicada.

Ausência de WebGL 2, falha de criação/carregamento do renderer e perda de contexto
mantêm a alternativa SVG 2D, o seletor, a tabela e o detalhe da seleção. A
alternativa conserva os dados ao trocar modos; as diferenças geométricas dos
modos pertencem à renderização 3D. Movimento reduzido desativa transições; não há
animação contínua em qualquer preferência.

O chunk `LandscapeScene-*.js` é separado no build. O service worker não o inclui
no precache global: armazena-o sob demanda com CacheFirst (até dois chunks, 30 dias).
Assim ele não é baixado na primeira visita a outra página. Offline, o 3D depende
de uma visita anterior com cache; sem o chunk, os valores permanecem no fallback.
Configuração em [vite.config.ts](../../../vite.config.ts).

Referências técnicas: [OrbitControls](https://threejs.org/docs/pages/OrbitControls),
[renderização sob demanda](https://threejs.org/manual/pages/rendering-on-demand.html)
e [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer).

## Componentes, estilos e testes

`ActivityCalendar`, `DayDetails`, `EvolutionLandscape`, `EvolutionLines`,
`LandscapeScene`, `PillarCards` e `PeriodSelector` têm responsabilidades separadas.
Os cartões reutilizam `MetricCard`, com `actionLabel` opcional e `Sparkline` para
uma série real. `CustomDatePicker` é o seletor mensal. Controles secundários usam
`.filter-button`; não há ação primária de formulário ou dropdown nativo novo.

`statistics.css` contém somente os novos contextos. O contêiner do Radar muda
de posição, sem sobrescrever suas regras internas. A visão geral permanece
empilhada em todas as larguras: o Radar ocupa a largura total, como antes, e a
paisagem vem abaixo. Em meia coluna, o contêiner do Radar ficaria abaixo de
400 px no desktop e acionaria o modo compacto da container query `radar`,
alterando sua aparência original. Cartões: uma coluna no celular, duas a partir
de 768 px e quatro a partir de 1280 px.

## Calendário compacto e arraste

O heatmap é compacto: quadrados de 28 px no celular e entre 24 e 30 px no
desktop, com vão de 6 px nas duas direções (`--heat-gap`). As colunas são fluidas:
a tabela ocupa a largura disponível e só rola localmente abaixo de 34 px por dia no
celular ou 30 px a partir de 640 px. Em 1440 px o mês inteiro cabe; em 320 px
aparecem cerca de cinco dias, sem reduzir os quadrados. A coluna dos pilares
(84/112 px) permanece fixa. Esses alvos ficam abaixo do mínimo recorrente de
44 px por decisão explícita de compactação; ver a exceção em
[acessibilidade](../../../../../docs/design-system/accessibility.md).

`useDragScroll` trata o mouse com Pointer Events: após 6 px de movimento
predominantemente horizontal, aplica `scrollLeft` direto no DOM, sem estado React
por movimento, e descarta o clique seguinte para não selecionar o dia sob o
ponteiro. Gestos verticais e o botão secundário são ignorados. Toque e caneta
usam a rolagem nativa (inércia e gesto vertical liberado para a página), e o
navegador não gera clique após um deslize. Durante o arraste há cursor
`grabbing` e um contorno discreto. A barra de rolagem continua como alternativa.

Abrir um mês centraliza a data selecionada sem animação; “Hoje” seleciona a data
atual e rola suavemente até ela, inclusive dentro do mês atual. As rolagens movem
somente a área do calendário, respeitam movimento reduzido e não acontecem
durante um arraste. As setas, Home e End exploram dias e linhas sem exigir uma
tabulação por célula; a célula focada é revelada ao lado da coluna fixa com
`focus({ preventScroll: true })`. A data atual e a seleção têm marcas além da cor.

Investigação de desempenho: não havia estado React atualizado durante a rolagem;
a sensação de travamento vinha das células de 44 px, que exigiam a barra de
rolagem, e da ausência de arraste com mouse. Os ajustes evitam renderizações por
movimento, `scroll-behavior: smooth` durante o arraste e listeners recriados.

Testes próximos cobrem períodos, indicadores, limites das escalas, detalhes,
ausências, modo, seleção, fallback, Radar, persistência e ausência de XP adicional,
além da personalização, das preferências salvas e do arraste do calendário.
`npm run audit:visual` inclui cenários em 320/390/768/1024/1440 px para Estatísticas,
modos, filtros, camadas, teclado, dia selecionado, dia vazio, overflow e preservação
do storage, além de geometria compacta, arraste com mouse, deslize e toque
(eventos de toque reais do Chrome), rolagem vertical e personalização persistida. Em navegador com WebGL disponível, verifica movimento da câmera e
fallback por perda de contexto. Registre a limitação quando o ambiente não
conseguir criar WebGL; jsdom não comprova a imagem 3D. Inspecione as capturas reais.
