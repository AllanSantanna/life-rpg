# Persistência local e evolução real

Chave `life-rpg:player-state`, envelope `{ version: 7, data: PlayerState }`.
O adaptador `localStateStorage.ts` isola leitura, validação, serialização e escrita;
`app/usePlayerState.ts` hidrata o estado e salva alterações automaticamente.

## Fontes de verdade

- Perfil pessoal e preferências de navegação/filtros.
- `records`: todos os dados reais dos quatro pilares, inclusive contas,
  investimentos, cotações, caixinhas, livros, leituras, treinos e sono.
- `missionEvents`: confirmações explícitas do usuário, com ID da missão, data
  civil, estado concluído/desfeito e `source: 'user'`. Uma entrada por missão/data.

XP, nível, atributos, conquistas, Radar e gráficos de XP são projeções recalculadas.
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

A migração acontece em memória e retorna `migrated: true` e `fromVersion`. Após
hidratação válida de v1–v6, o hook salva a versão atual em um `setItem`; em
StrictMode essa gravação não se duplica. Na próxima carga a versão atual é validada
diretamente: nenhuma recompensa ou migração é repetida. v7 → v8 não altera dados e
só grava na próxima ação (ver “Versão 8”).
Uma falha de escrita mantém o conteúdo antigo intacto; a sessão usa a projeção real
e o rodapé avisa que não foi possível salvar. Versões desconhecidas e dados de
versões antigas que não possam ser migrados não são sobrescritos.

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

## Falhas e limites

Sem chave, usa-se estado inicial vazio, sem gravá-lo na montagem. Conteúdo
presente que não pode ser lido **nunca é sobrescrito automaticamente**
(`AGENTS.md`, regra 7):

| Leitura        | Situação                                        | Gravação                             |
| -------------- | ----------------------------------------------- | ------------------------------------ |
| `missing`      | Sem registros                                   | Normal                               |
| `loaded`       | Válido (migrado em memória, se antigo)          | Normal, condicional ao conteúdo lido |
| `invalid`      | JSON ou dado inválido da versão atual           | Bloqueada: modo protegido            |
| `incompatible` | Versão desconhecida (futura) ou migração falhou | Bloqueada: modo protegido            |
| `unavailable`  | Acesso negado/indisponível                      | Tentada a cada ação; sessão apenas   |

No **modo protegido**, o app avisa (`StorageNotice`), funciona só nesta sessão e
oferece duas ações explícitas: baixar uma cópia do conteúdo bruto e “começar do
zero guardando uma cópia”. A segunda exige confirmação, grava antes uma cópia em
`life-rpg:player-state:backup:<ISO>`, confere a leitura dela e só então substitui
o registro principal; se a cópia falhar, nada é substituído. Cópias nunca são
removidas automaticamente e aparecem em Perfil (“Cópias de segurança dos
registros”), onde podem ser baixadas ou restauradas; restaurar guarda antes os
registros atuais como nova cópia, então a operação é reversível. Um valor de
uma versão futura compatível que traga campos desconhecidos é aceito pela
validação e regravado com eles, sem descarte.

**Várias abas.** Cada aba conhece o texto bruto que leu ou gravou. Uma gravação
só acontece se o conteúdo armazenado ainda for esse (comparação condicional).
Antes de aplicar um comando, a aba confere o armazenamento: se outra aba gravou e
não há alteração local pendente, o comando é aplicado sobre os dados mais
recentes, e as validações dos comandos rodam de novo (sem mesclagem de valores).
O evento `storage` mantém a tela atualizada. Se a corrida acontecer entre a
aplicação e a gravação, nada é gravado e o aviso “Registros alterados em outra
aba” oferece carregar os registros atuais; a alteração local não salva é
descartada somente por essa ação explícita. O rodapé mostra a situação real
(salvo, sessão apenas, protegido ou conflito).

Falhas de quota são capturadas e preservam o último valor gravado. Não se usa
`localStorage.clear()` nem se removem chaves de outros módulos. Preferências
somente visuais de Estatísticas usam a chave própria `life-rpg:statistics-view`
(versão 1) com o mesmo adaptador e a opção `overwriteInvalid`, porque são
descartáveis; ver o [módulo de Estatísticas](../../modules/statistics/README.md).
O adaptador pode ser substituído futuramente por backend sem mudar as projeções.

Os dados pertencem ao navegador e endereço (protocolo, host, porta) usados.
Limpar os dados do site remove o progresso. Não há sincronização entre
dispositivos.

## Versão 8 e regra de evolução do contrato

A v8 tem o mesmo formato de dados da v7. Depois da v7, o vocabulário validado foi
ampliado sem troca de versão (Treinos Avançados, cotações de mercado, Trapézio,
`startedAt`); uma versão anterior do app tratava esses dados como inválidos.
A migração 7 → 8 apenas valida os dados e os mantém; a gravação com a nova
versão acontece na próxima ação real, sem regravar na abertura. Versões antigas
do app veem a v8 como desconhecida e não gravam por cima. Toda ampliação futura
de enumerações, coleções ou campos validados exige nova versão e migração;
`app/storageContract.test.ts` falha quando o vocabulário muda sem isso.

## Verificação manual

1. Abra no mesmo endereço usado anteriormente. O progresso deve refletir apenas
   seus registros e missões confirmadas, mantendo o perfil e os quatro pilares.
2. Em DevTools → Application → Local Storage, confira a versão 8. Recarregue:
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
modo desativado sem dados; dados anteriores continuam válidos no envelope v7,
sem migração ou gravação na montagem. Desativar o modo preserva o conteúdo.
Recordes, volumes e evolução são projeções; não existe crédito de XP avançado.
A conclusão pode atualizar atomicamente o registro diário existente por data.
Veja [Treinos](../../modules/workouts/README.md).
