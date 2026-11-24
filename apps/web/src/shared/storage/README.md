# Persistência local e evolução real

Fonte de verdade: IndexedDB `life-rpg:records` (schema 1), com as stores `state`
e `copies`. O payload canônico usa `{ version: 8, data: PlayerState }`, acompanhado
de uma revisão. `transactionalStateStorage.ts` implementa importação, cópias e
comparação da revisão dentro de transações `readwrite`; o hook
`app/usePlayerState.ts` confirma o salvamento somente após o commit.

A chave legada `life-rpg:player-state` e suas cópias permanecem intactas: a versão
nova nunca as regrava nem apaga. `localStateStorage.ts` continua como adaptador
síncrono para classificação dos formatos históricos e preferências descartáveis.
Detalhes, garantias e limites: [persistência transacional](../../../../../docs/architecture/transactional-persistence.md).

Exportação e importação manual entre dispositivos: [backup manual](../../../../../docs/architecture/data-backup.md).
Importar usa o mesmo caminho transacional de restaurar uma cópia.

## Fontes de verdade

- Perfil pessoal e preferências de navegação/filtros.
- `records`: todos os dados reais dos quatro pilares, inclusive contas,
  investimentos, cotações, caixinhas, livros, leituras, treinos e sono.
- `missionEvents`: confirmações explícitas do usuário, com ID da missão, data
  civil, estado concluído/desfeito e `source: 'user'`. Uma entrada por missão/data.

XP, nível, atributos, conquistas, Radar e gráficos de XP são projeções recalculadas.
As chaves `life-rpg:achievement-presentation` e `life-rpg:achievements-view` guardam
apenas estado visual das conquistas (apresentação já exibida e "Ocultar galeria"),
fora do `PlayerState` e do backup, como `life-rpg:statistics-view`.
Não existem depósitos cumulativos de recompensa. `progressOrigin` é normalizado
para nível 1/0 XP e limiar de 2.000 XP; os campos legados `activityHistory` e
`unlockedAchievementIds` ficam vazios. `missionCompletion` conserva apenas o
formato de catálogo, com todos pendentes; conclusões reais ficam em `missionEvents`.
O aplicativo não lê valores de progresso ou atributos dos arquivos de mocks.

## Correção de progressão v1/v2

A leitura valida a estrutura antiga antes de migrar. V2 preserva integralmente
`records`; v1 não possuía registros dos pilares e recebe a estrutura vazia, como
na migração anterior. Perfil e preferências são copiados sem redefinição.

Remove-se a origem de XP/nível fictícia, o histórico sintético e os desbloqueios
artificiais. Registros reais não são apagados, somados novamente ou reescritos.
O XP legítimo é recalculado a partir desses registros e das missões verificáveis.

No catálogo antigo `water` já vinha concluída automaticamente. Essa marcação não
comprova ação do usuário e é descartada. Missões que vinham pendentes e foram
salvas como concluídas comprovam uma marcação explícita e são preservadas. O
formato antigo não registrava a hora/data do clique: essas conclusões conservam
13/11/2026, a data fixa à qual o aplicativo antigo já as associava. Não se presume
que tenham ocorrido na data da atualização. Não são criados novos eventos: missões fixas foram removidas da interface. Histórico opaco sem origem verificável não é usado no Radar.

A migração acontece em memória após validar a estrutura histórica. A ativação
preserva o texto bruto original em `copies` e grava o payload validado no IndexedDB
na mesma transação. Isso inclui v7 → v8 **antes da primeira ação**, sem regravar
o `localStorage` e sem transformar valores financeiros antigos. Duas importações
simultâneas conferem a existência do canônico dentro da transação; só uma o cria.
A reconciliação da classe continua usando as regras vigentes do módulo.

Falha de leitura, validação, cópia ou commit nunca ativa um jogador vazio sobre os
registros existentes. Conteúdo inválido/futuro fica protegido, com original
preservado; a indisponibilidade do IndexedDB bloqueia a abertura normal, com
nova tentativa explícita. Não há fallback de gravação no `localStorage`.

## Progressão e missões

Novo jogador: nível 1, 0 XP, sem conquistas desbloqueadas, sem atividade no Radar.
A fórmula continua `nível = 1 + floor(XP_total/2000)` e `XP_da_barra = XP_total%2000`.
Teto por área/data: Finanças 80, Treinos 150, Descanso 120 e Conhecimento 100.
Registros e missões confirmadas na mesma área/data compartilham esse teto.
As duas missões de Descanso também compartilham os 120 XP diários.

A interface não oferece mais missões fixas. Os eventos existentes ficam somente
como histórico e não são excluídos, para preservar XP, conquistas e esforço real.
Não há handler para concluir/desfazer novas missões. O catálogo legado serve
somente à validação e interpretação desses dados. Quests personalizadas e registros
continuam usando os limites existentes, sem multiplicar a recompensa de uma área/data.
A retirada das missões fixas não modifica os dados históricos.

Atributos usam dedicação real de 7 dias; conquistas são derivadas de atividades,
constância, livros concluídos e metas. Elas não dão XP extra. Veja
[quatro pilares](../../../../../docs/four-pillars.md) e `gamification/realProgress.ts`.

## Falhas, cópias e concorrência

- Sem chave e sem canônico, o app mostra o estado inicial sem gravar um jogador
  na montagem; a primeira ação válida cria o canônico em transação.
- JSON/dados inválidos ou versão desconhecida não são convertidos em jogador.
  O bruto é guardado sem ativação e continua protegido se uma versão antiga
  escrever depois um fallback vazio. Baixar, começar do zero e restaurar são
  ações explícitas; substituir/restaurar guarda antes o canônico anterior na
  mesma transação. As cópias também aparecem no Perfil, com origem identificada.
- Falhas de acesso/migração bloqueiam a abertura normal. Falha de gravação mantém
  o último commit e a proposta na sessão, com aviso verdadeiro e sem indicar
  sucesso. Não se usa `localStorage.clear()` ou limpeza de cópias.
- Cada proposta carrega a revisão lida. Ler a revisão, compará-la e escrever o
  estado ocorre na **mesma transação IndexedDB**, entre conexões e abas. Uma
  revisão desatualizada vira conflito, sem mesclar Finanças ou ressuscitar
  exclusões. A proposta rejeitada é guardada como cópia recuperável no mesmo
  commit que confirma o conflito; também pode ser baixada na aba.
- Notificações `BroadcastChannel`, foco e eventos `storage` só atualizam telas.
  Não concedem exclusão mútua. Uma leitura atrasada não substitui um comando ou
  commit mais recente. A ausência de Web Locks não altera a segurança, porque
  a coordenação é feita pelas transações do IndexedDB.
- Código antigo ainda pode alterar a chave legada. O app atual continua lendo o
  canônico independente, guarda brutos divergentes para recuperação e mostra
  aviso. Não mescla operações financeiras automaticamente. Falha ao guardar uma
  alteração antiga mantém os brutos observados na memória e oferece exportação
  explícita antes de fechar a aba, sem anunciar que foram preservados em disco.

Preferências visuais de Estatísticas continuam na chave `life-rpg:statistics-view`
(versão 1), com `overwriteInvalid` porque são descartáveis. Nenhuma regra de XP,
Radar, Quests ou cálculo financeiro foi alterada por esta mudança de persistência.

Os dados pertencem ao navegador e à origem (protocolo, host, porta). Limpeza de
armazenamento pelo usuário/sistema, perda do dispositivo e gravações de código
antigo ocorridas antes da primeira importação confirmada ficam fora do controle
da versão nova. Não há backend nem sincronização entre dispositivos. Veja os
[limites completos](../../../../../docs/architecture/transactional-persistence.md#limites-reais).

## Verificação manual

1. Abra no mesmo endereço usado anteriormente. O progresso deve refletir apenas
   seus registros e missões confirmadas, mantendo o perfil e os quatro pilares.
2. Em DevTools → Application → IndexedDB → `life-rpg:records` → `state`, confira o envelope versão 8 e a revisão. A chave legada deve permanecer igual. Recarregue:
   XP/nível devem permanecer iguais, sem novo crédito ou migração.
3. Em uma origem/navegador sem dados, confira nível 1/0 XP, Radar zero e conquistas
   bloqueadas. Registre um treino: 150 XP. Sua quest automática de treino não duplica esse prêmio.
4. Desfaça o treino: o XP correspondente desaparece. Edite sono/meta,
   despesas ou leituras e confira o recálculo, sem acumuladores.
5. Use os filtros de quests e o período do Radar e recarregue. Preferências legadas
   e confirmações históricas de missões permanecem salvas, sem controles ativos.

Os novos campos financeiros das versões anteriores continuam opcionais e
compatíveis; suas operações e valores são preservados pela migração v3.
Veja [Finanças](../../modules/finances/README.md) para as regras monetárias.

## Quests personalizadas e migração v3 → v4

O formato de quests foi introduzido em v4. Dados v3 válidos recebem `goals: {items: [], updates: []}`,
sem alterar perfil, registros, missões, preferências ou origem da progressão real.
Versões v1/v2 aplicam a correção de demonstração descrita acima e recebem quests
vazias. O envelope salvo usa a versão atual, sem repetir migração ou XP na próxima carga.
O limite/orçamento de XP de quests é calculado a partir das conclusões, não salvo
como crédito acumulado. Exclusão/edição/desfazer recalculam a projeção. O contrato
completo está em [Quests](../../modules/goals/README.md).

## Perfil simplificado e migração v5 → v6

`character` contém somente `avatar` e `classification`. V5 preserva esses dois
campos e remove os antigos equipamentos, coleções, desbloqueios e histórico do
personagem. Todos os outros campos, incluindo perfil pessoal, registros dos
quatro pilares, quests, missões e preferências, são copiados sem alteração.
V4 recebe apenas o estado inicial do personagem; não há redefinição de progresso.

A classificação de 30 dias é reconciliada na hidratação, nas alterações dos
registros e na mudança de dia. Classe e avatar não alteram a projeção de XP/nível. Veja as
[regras de classes](../../modules/profile/README.md).

## Classes imediatas e migração v5/v6 → v7

A classe Aventureiro é convertida para `current: null`. A hidratação calcula a
classe pelo pilar de maior pontuação nos últimos 30 dias, desde o primeiro registro.
Sem pontuação, o perfil fica sem classe definida. Trocas não exigem confirmação
nem intervalo; `pending` é limpo na reconciliação. Avatar, registros, quests,
preferências e progressão são preservados. Uma falha de gravação conserva o
envelope original.

## Musculação opcional

`records.advancedWorkouts` é opcional, com contrato interno `version: 1`.
Guarda a preferência, exercícios personalizados, fichas e snapshots de sessões
com séries, cargas, repetições, RIR e observações. A ausência do campo representa
modo desativado sem dados; dados anteriores continuam válidos no envelope (v7 na época, v8 hoje),
sem migração ou gravação na montagem. Desativar o modo preserva o conteúdo.
Recordes, volumes e evolução são projeções; não existe crédito de XP avançado.
A conclusão pode atualizar atomicamente o registro diário existente por data.
Veja [Treinos](../../modules/workouts/README.md).
