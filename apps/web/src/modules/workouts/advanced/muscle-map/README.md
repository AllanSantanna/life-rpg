# Mapa muscular V2

Projeção somente de leitura dos Treinos Avançados. Não recebe callbacks de
comandos, não grava em storage, não modifica o contrato v1/envelope v7 e não
altera XP, Radar, Finanças ou o registro diário. Funciona offline: anatomia e
bases visuais entram no bundle/PWA. Origem de desenvolvimento preservada em
`http://127.0.0.1:5173`.

## Anatomia e interação

58 superfícies orgânicas frontais/traseiras do MuscleMap, com IDs individuais,
contornos, gradientes e luminância das bases WebP. São 28 superfícies frontais e
30 traseiras. Cada região tem botão SVG, nome acessível, título, foco, Enter e
Espaço. Seleção identifica vista/ID; alternar modo mantém a região. Uma lista de
botões de 44 px oferece alternativa de teclado/toque, importante quando a região
anatômica fica pequena no celular. Modos usam abas, setas, Home/End e painel
rotulado. Seleção também tem borda e texto, sem depender apenas da cor.

[Créditos, licença, snapshot e adaptações](anatomy/PROVENANCE.md).
Não dependemos de `@musclemap/core`/`react`: apenas dados estáticos incorporados.
As imagens de base são geradas por IA e editadas pelo mantenedor de origem,
conforme sua declaração MIT. Não são ilustrações médicas validadas.

O mapeamento explícito está em `anatomy.ts`:

| Superfícies MuscleMap                | Grupo persistido Life RPG                 |
| ------------------------------------ | ----------------------------------------- |
| CHEST                                | chest                                     |
| SHOULDERS_FRONT / SIDE / REAR        | shoulders                                 |
| BICEPS / TRICEPS / FOREARMS          | biceps / triceps / forearms               |
| TRAPEZIUS                            | trapezius                                 |
| LATS / RHOMBOIDS / BACK_LOWER        | back                                      |
| CORE / OBLIQUES                      | core                                      |
| GLUTES / QUADS / HAMSTRINGS / CALVES | glutes / quadriceps / hamstrings / calves |
| ADDUCTORS / ABDUCTORS                | nenhum: indeterminado                     |

Cada lado tem seleção própria; suas métricas são do grupo inteiro, porque o
histórico não diferencia lados. Dorsais, lombar e romboides não ganham registros
independentes. Encolhimentos antigos classificados como Costas são interpretados
como Trapézio em memória, como já fazia `muscleActivity`, sem reescrever snapshots.

## Esforço relativo

Somente sessões `completed`, com data civil válida até hoje, e séries `working`,
`completed`, carga finita não negativa e repetições inteiras positivas. Não entram
aquecimentos, séries incompletas, rascunhos ou futuro. Os dados já passam pela
validação canônica; a projeção também rejeita valores ausentes/inválidos.

Janela: últimos 7/30/90/180/365 dias incluindo hoje, limite inferior inclusivo.
Uma série direta vale 1; uma participação secundária vale 0,5, sem duplicar um
grupo dentro da série. `E_g = séries diretas + 0,5 × séries secundárias`.
Índice: `round(100 × E_g / max(E))`, limitado inferiormente a 1 quando existe
participação. Sem participação: `null`, nunca 0% medido. O grupo com maior total
recebe 100%, sem significar treino suficiente, qualidade ou objetivo recomendado.
Mudar o histórico de outro grupo pode mudar a normalização.

Séries exibidas são participações reais não ponderadas. Volume envolvido é a soma
`carga × repetições` das séries que envolvem o grupo. Não dividir tonelagem pelo
número de músculos, nem somar os volumes de diferentes grupos. O mesmo volume
pode aparecer em vários grupos; peso zero não significa dado ausente.
Histórico cobre a janela; acima de 14 datas, agregamos em até 14 blocos de datas,
com intervalos e valores completos disponíveis em texto. Sem registros numa data:
`null` visualizado em cinza, não uma atividade fictícia com zero.

## Recuperação estimada: heurística de produto

Os parâmetros abaixo **não foram validados como medidas de recuperação humana**.
O índice é uma transformação orientativa dos registros, não diagnóstico, previsão
médica, percentual de músculo recuperado ou garantia de prontidão.

Janela fixa: últimos 14 dias incluindo hoje, independente do filtro de esforço.
As métricas de séries/volume/sessões continuam explicitamente na janela escolhida;
a data de último estímulo e o gráfico de recuperação usam os 14 dias. Atualização
é por dia civil, pois não há horário de treino persistido; não se inventam horas.

Para cada série, `r = 1 + 0,2 × (4 − min(RIR, 4)) / 4` quando RIR de 0–10 foi
registrado; sem RIR, `r = 1` e a informação permanece desconhecida, não zero.
Volume: com pelo menos duas observações anteriores do mesmo exercício nos 28
dias anteriores, `v = clamp(sqrt(volume atual / mediana anterior), 1, 1,5)`.
Sem base comparável/mediana positiva, `v = 1`. Não comparar quilos de exercícios
diferentes; essa parte é sensível à combinação carga/repetições e não estima 1RM.
Observações da mesma data não influenciam a mediana umas das outras.

Carga residual do grupo:
`B_g = soma(peso de participação × r × v × 2^(−dias desde a sessão / 2))`.
Índice: `min(99, round(100 × exp(−B_g / 12)))` se há contribuição recente,
caso contrário `null`. Estímulos sobrepostos se somam, incorporando frequência.
Não inferimos sono, dor, alimentação, novidade do exercício ou experiência.
O histórico do gráfico aplica a mesma fórmula retrospectivamente a cada data,
sem usar sessões futuras ou volumes registrados depois daquela data.

`defaultRecoveryConfig` em `model.ts` oferece parâmetros puros testáveis:
meia-vida de 2 dias, escala de 12 participações, janela de 14 dias e peso secundário
0,5. Mudanças são escolhas de produto que exigem atualização da explicação e dos
testes. Não há configuração persistida nova, migração ou gravação na montagem.
Os gráficos/ajuda devem acompanhar qualquer alteração nos defaults, pois a UI
explica o modelo vigente, enquanto a injeção de config atende testes/experimentos.

Cores: esforço vinho/vermelho (1–24, 25–49, 50–74, 75–100); recuperação verde
(≥90), amarelo (70–89), laranja (50–69), vermelho (<50). Sem contribuição recente,
grupo não mapeado ou histórico ausente: cinza/indeterminado. Um índice alto não
prova que o músculo esteja recuperado. A incerteza permanece elevada com RIR
completo, pois os registros não incluem todas as variáveis necessárias.

## Evidência publicada versus parâmetros do aplicativo

A evidência motiva a cautela; **nenhum destes trabalhos valida a fórmula, a
meia-vida, a escala, os pesos, a janela ou os limiares escolhidos acima**:

- [Morán-Navarro et al., 2017](https://pubmed.ncbi.nlm.nih.gov/28965198/): protocolos
  até a falha produziram maior queda aguda de desempenho que protocolos sem falha,
  inclusive numa comparação com volume equiparado. Amostras/protocolos limitam a
  generalização para cada usuário e grupo.
- [Pareja-Blanco et al., 2020](https://pubmed.ncbi.nlm.nih.gov/30036284/): configuração
  de séries e esforço até a falha influenciaram a fadiga e seu curso temporal.
  Não se extrai daí um cronômetro universal nem uma equivalência entre RIR e dias.
- [Chen et al., 2019](https://pubmed.ncbi.nlm.nih.gov/30663816/): comparação de
  exercícios excêntricos em diferentes regiões e exposições repetidas ilustra que
  região e exposição prévia importam. Nosso modelo não mede essa adaptação.
- [Knowles et al., 2022](https://pubmed.ncbi.nlm.nih.gov/36136596/): restrição de sono
  durante sessões repetidas afetou desempenho e fadiga em mulheres. Não atribuímos
  esses efeitos a pessoas sem dados individuais suficientes nem estimamos sono.

Aviso visível: “Estimativa baseada no histórico registrado; não substitui
percepção de fadiga e recuperação”. Uma rotina pode ter registros ausentes;
mesmo um histórico aparentemente completo não permite medir prontidão fisiológica.

## Validação e limites visuais

`model.test.ts`: ponderação, limites temporais, dados ausentes, RIR, volume
comparável, sobreposição, recuperação com o tempo, vários grupos, reclassificação
histórica, IDs e atualização após edição/exclusão. `MuscleMap.test.tsx`: seleção,
teclado, alternância de modo, dados vazios, atualização e ausência de gravações.
A suíte `AdvancedWorkouts.test.tsx` preserva o fluxo de edição/exclusão real.
`scripts/audit-muscle-map.mjs` cobre navegador isolado, responsividade, foco,
seleção, cores, duas vistas, estados vazios e preservação do envelope.

Diferenças da referência: vetores têm divisões mais amplas e não possuem as fibras
vermelhas finas do mockup. Não há asset apropriado de castelo/lua no Life RPG;
atmosfera vem de gradientes/círculos CSS. UI é composta em React/CSS/SVG, sem
recortar/renderizar o mockup inteiro. Desktop usa painel lateral quando o próprio
contêiner tem 820 px; em larguras menores, detalhes ficam abaixo. O limiar deriva
de duas figuras legíveis com painel de pelo menos 320 px; não muda breakpoints
globais. Callout e linha longa são decorativos; a linha até o painel é omitida
quando ele está abaixo, evitando cruzar texto. Em celular muito estreito o callout
em SVG mantém só o ponto; seleção e valor são mostrados em texto legível abaixo.
