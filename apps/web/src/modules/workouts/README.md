# Treinos simples e musculação opcional

A página mantém o registro diário **Treinou hoje? Sim/Não**, o calendário e as
estatísticas de frequência. A chave **Modo Avançado — Acompanhamento detalhado de
musculação** começa desativada e salva a preferência automaticamente. Desativá-la
oculta as ferramentas e conserva todos os dados.

## Organização

`advanced/` separa modelos (`types.ts`), catálogo próprio (`catalog.ts`), validação,
comandos puros, cálculos e componentes. A importação usa Fuse.js no navegador;
não há banco, autenticação, recomendações automáticas de carga ou cronômetro.

As sete abas usam navegação por teclado, seletores/calendários existentes e
formulários responsivos. O registro diário permanece disponível fora das abas.

- **Minhas fichas:** nome, descrição, exercícios ordenáveis, séries e repetições
  planejadas, observações; criação, edição, duplicação e exclusão confirmada.
  O catálogo inicial contém 17 exercícios. O cadastro aceita exercícios próprios,
  grupos principais/secundários e equipamento opcional. Nomes são comparados sem
  acentos, diferenças de maiúsculas ou espaços repetidos para evitar duplicatas.
- **Registrar treino:** ficha reutilizável ou treino livre, data, exercícios,
  séries de aquecimento/válidas, carga em kg, repetições, RIR opcional e conclusão.
  Campos e observações da sessão são salvos a cada alteração. Uma sessão em
  andamento reaparece ao abrir as ferramentas novamente.
- **Histórico:** consulta, correção e exclusão confirmada de sessões. Cada sessão
  contém uma cópia do nome da ficha, exercícios, grupos musculares e planejamento.
  Editar/excluir fichas ou editar o catálogo não reescreve as sessões existentes.
- **Evolução de cargas:** maior carga, mais repetições **com a mesma carga**, volume
  válido ou RIR médio por sessão. Os filtros Semanal, Mensal e Anual correspondem
  aos últimos 7, 30 e 365 dias, incluindo hoje. Só há pontos de sessões registradas;
  não existem preenchimento de lacunas ou histórico inventado. Valores são
  consultáveis por toque, mouse, Tab e setas. Os pontos seguem a ordem das sessões,
  sem usar o espaçamento horizontal como duração entre treinos.
- **Recordes pessoais:** maior carga, mais repetições por carga, maior volume de
  uma série e melhor sessão por exercício. Não mistura exercícios diferentes.
- **Volume de treinamento:** volume por exercício, sessão, últimos 7 e últimos
  30 dias. Oferece consulta com aquecimento incluído.
- **Mapa muscular:** anatomia frontal/traseira segmentada incorporada do MuscleMap
  (MIT), com seleção por região, Esforço relativo e Recuperação estimada.
  [Métodos, evidências, mapeamento, créditos e limites](advanced/muscle-map/README.md).
  Somente leitura de sessões reais, sem alterar os registros ou o XP/Radar.

## Importação Rápida de Treinos

No Modo Avançado, **Importar treino → Colar texto → Interpretar treino →
Conferir/editar → Confirmar importação** registra uma sessão inteira. O destino
pode ser uma nova sessão livre, qualquer ficha (A–E ou personalizada) ou uma
sessão existente, inclusive concluída. O título escrito no texto não decide o
destino automaticamente.

Aceita blocos por exercício e linhas compactas, como `Supno reto: 60x10,65x8`,
`Elevação lateral: 12,5kg x 12` e `Crucifixo máquina: 35x12 rir 2`. Cargas
decimais, espaços, maiúsculas, acentos, `x`/`×`, RIR zero e marcadores
`aquecimento`/`válida` são reconhecidos. Sem marcador, o tipo é válida; RIR
ausente continua `null`. Carga e repetições ausentes nunca são preenchidas.

`advanced/importing/` separa normalização (reutiliza a do catálogo), busca Fuse.js,
interpretador, validação, prévia, integração com sessões e confirmação atômica.
A busca inclui catálogo completo, exercícios personalizados, sinônimos e
snapshots do destino, prioriza os exercícios da ficha/sessão nas alternativas e
exige escolha quando há ambiguidade. IDs do catálogo e dos slots existentes são
preservados. Blocos reconhecidos como o mesmo exercício têm suas séries reunidas.

A prévia permite trocar exercícios e editar/adicionar/remover séries, carga,
repetições, RIR e tipo. Avisos identificam cabeçalhos e trechos não interpretados.
Alterar texto, destino ou data exige nova interpretação; cancelar descarta o
rascunho. Nenhum comando de persistência é emitido antes da confirmação.

Exercícios com séries preenchidas no destino exigem decisão individual:
**manter**, **substituir as séries daquele exercício** ou **acrescentar somente
as novas**. Acrescentar compara tipo, carga, repetições e RIR, considerando a
quantidade de séries iguais (três séries iguais continuam sendo três).
Substituição preserva os IDs dos slots reutilizados; séries retiradas são
removidas somente após essa escolha explícita. Exercícios adicionais pertencem
somente à sessão; a ficha permanente e outras sessões não mudam.

Um comando confirma a sessão inteira pelo armazenamento já existente. Repetir
esse comando não duplica a importação; uma trava também impede cliques repetidos.
Se a sessão mudou após interpretar, a confirmação falha e pede nova conferência.
A importação não alterou o contrato v1, o envelope nem as chaves do armazenamento.

Séries importadas são marcadas como realizadas, mas novas sessões ficam **em
andamento** para revisão/conclusão pelo fluxo habitual. Corrigir uma sessão já
concluída recalcula suas estatísticas avançadas. Importar nunca marca o registro
diário, avança rotação, concede XP, altera Radar, classe, nível ou recompensas.

Os testes de `importing/` cobrem interpretação, precisão, aproximações,
sinônimos, ambiguidades, edição da prévia, fichas, conflitos, repetição de
comandos/cliques, snapshots, recarga, compatibilidade e independência do RPG.

## Cálculos e limites

`Volume = soma(carga em kg × repetições)` das séries concluídas consideradas.
Os indicadores e recordes usam séries **válidas** de sessões **concluídas**.
Séries pendentes, sessões em andamento e datas futuras não entram nos históricos.
O editor mostra também o volume parcial da sessão em andamento.

Carga aceita zero (sem carga externa) e valores decimais até 2.000 kg. Repetições
são inteiras de 1 a 1.000; RIR é opcional, inteiro de 0 a 10. RIR vazio permanece
`null`, distinto de zero. A média de RIR usa somente campos preenchidos de séries
válidas concluídas, sem converter ausência em zero.

A última carga/repetições corresponde à última série válida da sessão concluída
mais recente do mesmo exercício até a data da sessão atual, excluindo a própria
sessão em edição. Recordes são projeções do histórico atual e se corrigem após
edições/exclusões. Em empate, a data mais antiga vence; na mesma data, mantém a
primeira ocorrência armazenada. **Melhor sessão** significa maior volume válido
registrado naquele exercício, não uma estimativa de força máxima.

Volume e mapa não medem hipertrofia ou qualidade do treino. O índice de
recuperação do mapa é uma heurística orientativa, não medição fisiológica.

## RPG e registro diário

As fontes de XP, Radar, atributos, quests e classe continuam consultando somente
os registros simples e as fontes históricas existentes. Ativar a chave, criar
fichas, preencher séries/RIR ou conquistar recordes não gera esforço ou XP.

Ao concluir, a opção **Marcar o dia como treinado ao concluir** usa o mesmo
`upsert` por data do registro diário. A operação grava sessão e registro diário
juntos. Repetir a conclusão, usar várias sessões no mesmo dia ou já ter marcado
Sim não cria outro dia nem outro crédito de XP.

Corrigir a data, excluir ou reabrir uma sessão não apaga nem desloca o registro
Sim/Não existente. Sua correção continua no formulário diário. É possível concluir
novamente marcando explicitamente a nova data. Uma sessão que perde todas as
séries concluídas volta a ficar em andamento e sai dos indicadores avançados.

## Persistência e compatibilidade

O campo opcional `records.advancedWorkouts` tem contrato próprio `version: 1`,
com `enabled`, `exercises`, `plans` e `sessions`. Usa o envelope atual v8 no
IndexedDB canônico; `life-rpg:player-state` permanece como original legado,
conforme a [persistência oficial](../../shared/storage/README.md). Resultados
como recordes, volumes e gráficos são derivados das sessões, sem cópias acumuladas.

Registros antigos sem esse campo continuam válidos; a ausência equivale ao modo
inicial desativado, sem gravar na montagem ou exigir migração destrutiva. O campo
só é criado após uma ação. Quatro pilares, perfil, quests e progressão permanecem
intactos. A validação também protege IDs, referências a exercícios e snapshots.
Falhas de armazenamento mantêm a sessão em memória e exibem o aviso existente.

**IDs de catálogo são contrato salvo.** Fichas, sessões e a revisão de papéis do
mapa referenciam `starterExercises` e `library:*` pelo ID. Não renomeie nem
remova um ID sem migração versionada: os validadores rejeitariam o estado salvo.
Desde a proteção de persistência, isso não apaga dados (o app entra em modo
protegido e preserva o conteúdo), mas impediria o uso normal até a correção.

## Verificação

Os testes de cálculo/comandos e integração cobrem preferência e recarga; fichas e
exercícios personalizados; snapshots; séries com cargas distintas; aquecimento;
RIR nulo/zero; volumes; pontos reais; recordes após correções/exclusões; mapa;
sessões em andamento; confirmação de exclusões; integração diária sem XP extra;
preservação de Radar/classes/quests e compatibilidade do armazenamento.

Verificação visual manual recomendada em 375 px e desktop: ativar a chave, criar
uma ficha, iniciar sessão, registrar aquecimento e séries válidas com cargas
diferentes, concluir com marcação diária, navegar pelas abas e reabrir a página.
Desativar/reativar deve restaurar o conteúdo; Tab e setas percorrem as abas, os
pontos do gráfico e os seletores; mapa e legenda continuam consultáveis por toque.
