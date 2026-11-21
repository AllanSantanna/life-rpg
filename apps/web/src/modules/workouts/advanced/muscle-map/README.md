# Mapa muscular V2

Projeção somente de leitura dos Treinos Avançados. Não recebe callbacks de
comandos, não grava em storage, não modifica o contrato v1 nem o envelope salvo e não
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

| Superfícies MuscleMap                | Grupo do mapa                             |
| ------------------------------------ | ----------------------------------------- |
| CHEST                                | chest                                     |
| SHOULDERS_FRONT / SIDE / REAR        | shoulders                                 |
| BICEPS / TRICEPS / FOREARMS          | biceps / triceps / forearms               |
| TRAPEZIUS                            | trapezius                                 |
| LATS / RHOMBOIDS                     | back                                      |
| BACK_LOWER                           | lowerBack (Lombar, só no mapa)            |
| CORE / OBLIQUES                      | core                                      |
| GLUTES / QUADS / HAMSTRINGS / CALVES | glutes / quadriceps / hamstrings / calves |
| ADDUCTORS / ABDUCTORS                | adductors / abductors (só no mapa)        |

Cada lado tem seleção própria; suas métricas são do grupo inteiro, porque o
histórico não diferencia lados. Encolhimentos antigos classificados como Costas
são interpretados como Trapézio em memória, sem reescrever snapshots.

## Participação muscular e rastreabilidade

### Diagnóstico do comportamento anterior

- **Abdômen com estímulo sem exercício abdominal:** `core` estava cadastrado como
  **secundário** em Agachamento livre, frontal e goblet e na Caminhada do
  fazendeiro. Cada série desses exercícios somava 0,5 série equivalente ao
  abdômen, no Esforço e na Recuperação. Não havia como distinguir estabilização
  de tronco de participação motora.
- **Adutores e abdutores sempre sem estímulo:** o tipo persistido `Muscle` não tem
  esses grupos, e `anatomy.ts` mapeava as superfícies para `null`. Nenhum
  exercício podia pontuá-los. Além disso, a Cadeira adutora estava classificada
  como **quadríceps** (erro) e a Cadeira abdutora como glúteos.
- **Lombar = Costas:** a superfície lombar mostrava o grupo Costas. O `back`
  secundário do terra, do stiff e do good morning (eretores da coluna) somava em
  Costas, junto de dorsais e romboides.
- **Cálculo:** `projectMuscles` aplicava corretamente o snapshot (principal 1,
  secundário 0,5). O problema estava na classificação e na ausência de grupos e
  de um papel estabilizador, não na fórmula.

### Três papéis

| Papel         | Definição                                                   | Esforço e Recuperação |
| ------------- | ----------------------------------------------------------- | --------------------- |
| Principal     | Músculo-alvo, com papel relevante na execução               | 1 por série           |
| Secundário    | Participa ativamente do movimento, sem ser o foco           | 0,5 por série         |
| Estabilizador | Controla postura, articulação ou pelve, em geral isométrico | 0: só rastreado       |

Os pesos 1 e 0,5 foram mantidos. A contagem fracionada (indireta = 0,5) teve o
melhor ajuste para hipertrofia em meta-regressões de dose-resposta
([Pelland et al., Sports Medicine](https://doi.org/10.1007/s40279-025-02344-w);
[preprint](https://sportrxiv.org/index.php/server/preprint/view/460)). Isso apoia
uma ordem de grandeza, não um valor fisiológico exato. Estabilizador não tem
evidência equivalente de estímulo hipertrófico por série; por isso vale 0. Não há
dupla contagem: cada grupo aparece uma vez por exercício, com o papel mais forte.

### Onde a classificação vem

`participation.ts` define `reviewedParticipation`, uma tabela **somente leitura**
indexada pelo ID dos exercícios do catálogo. Ela reinterpreta o histórico em
memória, como o encolhimento; snapshots não são regravados, não há migração e o
contrato salvo (`Exercise.primary/secondary`, `Muscle`) não mudou. IDs fora da
tabela, inclusive exercícios próprios do usuário, usam os papéis do snapshot
(principal e secundários) e nunca recebem papéis novos. Lombar, Adutores e
Abdutores existem só nesta projeção, para não invalidar dados lidos pela `main`.

### Classificações revisadas

| Exercício                            | Principal   | Secundário                                | Estabilizador             |
| ------------------------------------ | ----------- | ----------------------------------------- | ------------------------- |
| Agachamento livre, frontal, goblet   | Quadríceps  | Glúteos, Adutores                         | Abdômen, Lombar           |
| Agachamento no Smith                 | Quadríceps  | Glúteos, Adutores                         | Lombar                    |
| Agachamento hack                     | Quadríceps  | Glúteos, Adutores                         | —                         |
| Agachamento com peso corporal        | Quadríceps  | Glúteos                                   | Abdômen                   |
| Agachamento búlgaro, Afundo          | Quadríceps  | Glúteos                                   | Abdutores, Adutores       |
| Subida no banco                      | Quadríceps  | Glúteos                                   | Abdutores                 |
| Levantamento terra                   | Posteriores | Glúteos, Lombar, Antebraços               | Abdômen, Costas, Trapézio |
| Terra romeno, Stiff (barra/halteres) | Posteriores | Glúteos, Lombar                           | Abdômen, Antebraços       |
| Good morning                         | Posteriores | Glúteos, Lombar                           | Abdômen                   |
| Terra sumô                           | Glúteos     | Posteriores, Quadríceps, Adutores, Lombar | Abdômen, Antebraços       |
| Extensão lombar                      | Lombar      | Glúteos, Posteriores                      | —                         |
| Cadeira adutora                      | Adutores    | —                                         | —                         |
| Cadeira abdutora                     | Abdutores   | Glúteos                                   | —                         |
| Remada curvada, Remada cavalinho     | Costas      | Bíceps, Antebraços                        | Lombar                    |
| Remada alta                          | Ombros      | Trapézio                                  | —                         |
| Caminhada do fazendeiro              | Antebraços  | —                                         | Abdômen, Trapézio         |
| Prancha com toque nos ombros         | Abdômen     | —                                         | Ombros                    |
| Flexão de braços                     | Peito       | Tríceps, Ombros                           | Abdômen                   |
| Elevação de pernas na barra          | Abdômen     | —                                         | Antebraços                |

Confirmados sem mudança: supinos, crucifixos, puxadas, desenvolvimentos,
roscas, tríceps, panturrilhas, elevação pélvica e abdominais. **Leg press não
recebe Adutores:** não encontramos evidência específica; a abordagem é
conservadora. Variações não recebem os mesmos auxiliares sem justificativa: o
Smith e o hack reduzem a exigência de estabilização do tronco; o peso corporal
não tem a carga do estudo de agachamento; os unilaterais exigem controle da pelve.

### Participação, estímulo contabilizado e recuperação

1. **Participação:** qualquer papel registrado para o exercício.
2. **Estímulo contabilizado:** séries × peso do papel (1 ou 0,5); alimenta o
   Esforço.
3. **Recuperação estimada:** carga residual dos estímulos contabilizados, com as
   fórmulas abaixo. Estabilizadores não entram, logo não reduzem a recuperação.

Ao selecionar um grupo, **Exercícios que estimularam este músculo (N)** aparece
recolhida (`Disclosure` compartilhado), com a contagem no título. Aberta, mostra os
5 registros mais recentes; **Mostrar mais N** acrescenta 5 por vez e **Mostrar
menos** volta aos 5 primeiros, mantendo o foco no controle restante. A
**Participação estabilizadora · não contabilizada (N)** é outra seção
independente, com a mesma regra. Trocar de grupo ou de período recolhe as duas e
volta a 5 registros. A paginação é só visual. A lista inclui apenas
sessões concluídas e registradas: nome, data e horário (se houver), séries
válidas, papel, contribuição (séries equivalentes no Esforço; carga residual
atual e inicial na Recuperação) e motivo. No Esforço, a janela é o período
escolhido; na Recuperação, os 14 dias da estimativa. As contagens do painel
(séries válidas, volume, sessões, diretas e secundárias), o anúncio para leitor
de tela e a lista de grupos seguem a mesma janela do modo (`windowMetrics`), e o
texto indica qual é. A ordem é do mais recente ao mais antigo pelo instante real
(`compareSessionsDesc`, com o deslocamento UTC gravado); no mesmo dia, sessões
sem horário vêm depois das com horário. Sem estímulo, a mensagem é
“Nenhum estímulo contabilizado para este músculo no período selecionado.”;
estabilizadores ficam numa lista separada, marcada como não contabilizada. A
lista é recalculada a cada renderização a partir das sessões (registrar, editar
séries, mudar data/horário ou excluir), sem cópia persistida.

### Evidência e limites

- **Adutores no agachamento (hipertrofia, ressonância magnética):**
  [Kubo et al., 2019](https://doi.org/10.1007/s00421-019-04181-y) observaram
  aumento de volume dos adutores e do glúteo máximo após agachamento, maior no
  agachamento completo. Amostra pequena, destreinados, um exercício.
- **Tronco no agachamento e no terra (eletromiografia):**
  [Hamlyn et al., 2007](https://pubmed.ncbi.nlm.nih.gov/18076231/) encontraram
  alta atividade dos eretores da coluna, sem aumento significativo em oblíquo
  externo e abdominal inferior. Apoia abdômen como estabilizador e Lombar como
  participante relevante nas flexões de quadril. Não mediu hipertrofia.
- **Glúteo médio em apoio unilateral (eletromiografia):** revisão sistemática
  sobre os segmentos do glúteo médio e mínimo
  ([IJSPT, 2020](https://pubmed.ncbi.nlm.nih.gov/33344003/)) inclui exercícios
  unilaterais entre os de maior atividade. Usado apenas para justificar o papel
  estabilizador, sem contar estímulo.
- **Limite da eletromiografia:** amplitude de sEMG não é proxy validada de
  hipertrofia ([Vigotsky et al., 2018](https://pubmed.ncbi.nlm.nih.gov/29354060/);
  [2022](https://doi.org/10.1007/s40279-021-01619-2)). Por isso nenhum percentual
  de ativação é usado como peso.
- **Heurística do aplicativo:** a escolha entre secundário e estabilizador para
  Lombar nas flexões de quadril, os adutores no terra sumô (função anatômica do
  adutor magno como extensor do quadril, sem estudo de hipertrofia específico) e
  a ausência de Adutores no leg press e no terra convencional são decisões
  conservadoras do produto, revisáveis com nova evidência.
- **Pendência:** confirmar autoria completa da revisão do IJSPT e a versão
  final de Pelland et al. antes de citações formais.

## Esforço relativo

Somente sessões `completed`, com data civil válida até hoje, e séries `working`,
`completed`, carga finita não negativa e repetições inteiras positivas. Não entram
aquecimentos, séries incompletas, rascunhos ou futuro. Os dados já passam pela
validação canônica; a projeção também rejeita valores ausentes/inválidos.

Janela: últimos 7/30/90/180/365 dias incluindo hoje, limite inferior inclusivo.
Uma série direta vale 1; uma participação secundária vale 0,5; estabilizador
vale 0, sem duplicar um grupo dentro da série.
`E_g = séries diretas + 0,5 × séries secundárias`.
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
médica, percentual de músculo recuperado ou garantia de prontidão para treinar.

### Falha corrigida (tempo em dias inteiros)

A versão anterior calculava o decaimento com `daysBetween(hoje, data da sessão)`,
um número inteiro de dias civis. Consequências: um treino às 23h30 e uma consulta
às 00h30 eram tratados como 24 horas de recuperação, e a carga caía em degrau na
meia-noite (fator `2^(−1/2) ≈ 0,71`) mesmo após uma hora real. Ao longo do mesmo
dia, o índice permanecia constante. A recuperação nunca dependeu de máximos de
outros músculos; a normalização global existe apenas no modo Esforço.

### Horário de início e registros antigos

`WorkoutSession.startedAt` é opcional e guarda o **início** da sessão com precisão
de minuto e o deslocamento UTC local vigente, por exemplo
`2026-11-19T15:30:00-03:00`. A data civil (`date`) permanece o campo canônico e
precisa coincidir com a data de `startedAt`. Não registramos duração nem horário
de conclusão. Nova sessão do dia corrente recebe o horário local atual, editável;
datas passadas ficam sem horário até o usuário informar. Inícios no futuro são
rejeitados no formulário, na correção, nos comandos e na importação (uma
importação que mude a data e leve o início registrado ao futuro é recusada com
orientação); um horário já gravado e não alterado continua editável. Horários
inexistentes no fuso local (início do horário de verão) são rejeitados. Horários
repetidos (fim do horário de verão, ex.: 01:30 em 01/11/2026 em Nova York) não
são resolvidos em silêncio: o formulário pede “Ocorrência do horário” e grava o
deslocamento escolhido; o instante atual (“agora”) usa o deslocamento vigente.

Sessões antigas, sem `startedAt`, continuam válidas e **não recebem horário
fictício** (nem 00:00, 12:00 ou o horário atual). Não houve migração: o campo é
opcional, a leitura não regrava storage e `life-rpg:player-state` é preservado.
Para elas, o instante real pertence ao intervalo `[00:00 da data, 00:00 do dia
seguinte)` local, e o painel mostra "Entre Xh e Yh". O cálculo usa o **limite
conservador**, o menor tempo decorrido possível (`now − fim do dia`, mínimo 0),
o que nunca subestima a carga residual. Corrigir a sessão com data e horário
substitui o intervalo pelo instante informado, sem criar nova sessão.

### Fórmulas

Para cada série válida, `r = 1 + 0,2 × (4 − min(RIR, 4)) / 4` quando RIR de 0–10
foi registrado; sem RIR, `r = 1` e a informação permanece desconhecida: não é
tratada como falha (RIR 0) nem gera peso adicional. Volume: com pelo menos duas
observações anteriores do mesmo exercício nos 28 dias anteriores,
`v = clamp(sqrt(volume atual / mediana anterior), 1, 1,5)`; sem base comparável,
`v = 1`. O fator só aumenta a carga: histórico anterior nunca reduz o peso de
um treino recente. Não comparamos quilos de exercícios diferentes.

Para cada estímulo `i` do grupo `g`, `h_i` é o tempo em horas desde o início
registrado (ou o limite conservador acima). Com meia-vida `T = 48 h`:

`B_g(t) = Σ_i peso_i × r_i × v_i × 2^(−h_i / 48)`

`Recuperação_g = min(99, round(100 × exp(−B_g / 12)))`, ou `null` sem estímulo
nos últimos 14 dias. `peso_i` é 1 para participação direta e 0,5 para secundária.
Estímulos sobrepostos se somam, incorporando frequência e sessões consecutivas.
`B_g` depende apenas dos registros do próprio grupo: nenhum máximo global,
percentil ou comparação com outros músculos. A carga residual `B_g` é contínua
no tempo e estritamente decrescente entre registros; por isso `Recuperação_g`
é não decrescente sem novos treinos (o índice sobe à medida que a carga cai) e
não tem degrau à meia-noite. Novos estímulos aumentam `B_g` e reduzem o índice.
Participações estabilizadoras têm peso 0 e não entram em `B_g`. O percentual é
uma heurística do aplicativo, não uma medida fisiológica validada nem garantia
de prontidão.

O relógio (`useWorkoutClock`) recalcula a cada minuto com a tela visível e ao
voltar ao aplicativo, sem gravar storage. Instantes são comparados em UTC a partir
do deslocamento gravado, logo mudanças de fuso ou horário de verão não distorcem
o tempo decorrido. O gráfico histórico usa o fim de cada dia passado e o instante
atual no último ponto, sem sessões futuras.

### Exemplos comparativos (dados simulados)

Dados fictícios, 9 séries diretas de quadríceps, RIR 0 (`r = 1,2`, `B₀ = 10,8`):

| Tempo desde o início | `B_g` | Recuperação | Faixa    |
| -------------------- | ----- | ----------- | -------- |
| 2 h                  | 10,49 | 42%         | Vermelho |
| 26 h                 | 7,42  | 54%         | Laranja  |
| 50 h                 | 5,25  | 65%         | Laranja  |
| 98 h                 | 2,62  | 80%         | Amarelo  |

Mesmo treino com RIR ausente (`B₀ = 9`): 2 h → 48%; 26 h → 60%. Duas sessões
iguais com RIR 0, em 19/11 às 10h e 20/11 às 10h, consultadas em 20/11 às 12h:
`B = 7,42 + 10,49 = 17,91` → 22%.

### Parâmetros

`defaultRecoveryConfig` em `model.ts`: meia-vida de 2 dias (48 h), escala de 12
participações, janela de 14 dias e peso secundário 0,5. São escolhas de produto
que exigem atualização da ajuda (`MethodHelp.tsx`), deste documento e dos testes.
Não há configuração persistida nova nem gravação na montagem.

Cores (inalteradas): esforço vinho/vermelho (1–24, 25–49, 50–74, 75–100);
recuperação verde (≥90), amarelo (70–89), laranja (50–69), vermelho (<50). Sem
contribuição recente ou grupo não mapeado: cinza/indeterminado.

## Evidência publicada versus parâmetros do aplicativo

**Evidência (fato publicado):**

- [Morán-Navarro et al., 2017](https://pubmed.ncbi.nlm.nih.gov/28965198/)
  (n = 10, homens treinados, supino e agachamento, medidas até 72 h): protocolos
  até a falha retardaram a recuperação neuromuscular por 24–48 h em relação a
  protocolos sem falha com volume equiparado.
- [Pareja-Blanco et al., 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6473797/)
  (n = 17, agachamento, medidas até 48 h): maior perda de velocidade na série
  (mais próxima da falha) gerou mais fadiga e recuperação mais lenta, com
  prejuízos detectáveis em 6 h, 24 h e, em alguns desfechos, 48 h.
- [Pareja-Blanco et al., 2020](https://pubmed.ncbi.nlm.nih.gov/30036284/):
  configuração de séries e esforço até a falha influenciaram a fadiga e seu
  curso temporal.
- [Harrison et al., 2024](https://www.termedia.pl/Acute-effects-of-exercise-induced-muscle-damage-on-sprint-and-r-nchange-of-direction-performance-A-systematic-review-and-metaanalysis,78,51587,1,1.html)
  (revisão sistemática): marcadores de dano e desempenho permaneceram alterados
  por até 72 h após treinamento resistido/pliométrico.
- [Chen et al., 2019](https://pubmed.ncbi.nlm.nih.gov/30663816/) e
  [Knowles et al., 2022](https://pubmed.ncbi.nlm.nih.gov/36136596/): região
  muscular, exposição prévia e sono modificam fadiga e recuperação.

**Heurística do aplicativo (não validada):** a forma exponencial, a meia-vida de
48 h, a escala 12, o peso 0,5, o bônus de 20% por RIR e o fator de volume foram
escolhidos para serem coerentes com a ordem de grandeza acima (efeitos relevantes
em 24–48 h, residuais até ~72 h, maiores com volume e proximidade da falha).
Nenhum estudo valida esses números, a soma linear de estímulos ou a conversão em
percentual. Os estudos usam amostras pequenas, majoritariamente homens treinados,
e poucos exercícios; recuperação varia entre pessoas, músculos e exercícios.
Não localizamos evidência específica que quantifique essa variabilidade individual
na recuperação aguda de forma aplicável ao modelo (pendência de pesquisa).
Não inferimos sono, dor, alimentação, novidade do exercício nem experiência.

Aviso visível: “Estimativa baseada no histórico registrado; não substitui
percepção de fadiga e recuperação”.

## Validação e limites visuais

`participation.test.ts`: papéis, estabilizadores sem estímulo, adutores no
agachamento, unilaterais, cadeiras adutora/abdutora, grupos sem relação,
rastreio fiel ao histórico, edição/exclusão, ausência de dupla contagem e
sessões antigas. `model.test.ts`: ponderação, limites temporais, dados ausentes, RIR, volume
comparável, sobreposição, recuperação com o tempo, vários grupos, reclassificação
histórica, IDs e atualização após edição/exclusão. `recoveryTiming.test.ts`:
2 h × 26 h, continuidade na meia-noite, monotonicidade horária, fusos, acúmulo,
RIR ausente, exclusão e independência de outros grupos. `sessionTiming.test.ts` e
`sessionTimingFlow.test.tsx`: validação HH:mm, criação, correção de data/hora,
registros antigos, horário futuro e preservação do storage. `MuscleMap.test.tsx`: seleção,
teclado, alternância de modo, dados vazios, atualização e ausência de gravações.
A suíte `AdvancedWorkouts.test.tsx` preserva o fluxo de edição/exclusão real.
`scripts/audit-muscle-map.mjs` (`node scripts/audit-muscle-map.mjs`, com
`PLAYWRIGHT_MODULE` quando o Playwright está fora do projeto) cobre, além da
paginação do rastreio com 18 agachamentos isolados (5 → 10 → 15 → 18, “Mostrar
mais 3”, “Mostrar menos”, foco, recolher, troca de músculo e de período,
estabilizadores independentes e storage intacto), navegador isolado, responsividade, foco,
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
