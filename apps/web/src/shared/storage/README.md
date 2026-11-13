# Persistência local e evolução real

Chave `life-rpg:player-state`, envelope `{ version: 3, data: PlayerState }`.
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

## Migração v1/v2 → v3

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
que tenham ocorrido na data da atualização. Os novos eventos usam a data civil
real da confirmação. Histórico opaco sem origem verificável não é usado no Radar.

A migração acontece em memória e retorna `migrated: true`. Após hidratação válida,
o hook salva v3 em um `setItem`; em StrictMode essa gravação não se duplica. Na
próxima carga v3 é validada diretamente: nenhuma recompensa ou migração é repetida.
Uma falha de escrita mantém o conteúdo antigo intacto; a sessão usa a projeção real
e o rodapé avisa que não foi possível salvar. Versões desconhecidas e dados de
versões antigas que não possam ser migrados não são sobrescritos.

## Progressão e missões

Novo jogador: nível 1, 0 XP, sem conquistas desbloqueadas, sem atividade no Radar.
A fórmula continua `nível = 1 + floor(XP_total/2000)` e `XP_da_barra = XP_total%2000`.
Teto por área/data: Finanças 80, Treinos 150, Descanso 120 e Conhecimento 100.
Registros e missões confirmadas na mesma área/data compartilham esse teto.
As duas missões de Descanso também compartilham os 120 XP diários.

As missões continuam disponíveis como modelos de ações reais. Nenhuma começa
concluída: confirmar é uma declaração do usuário de que realizou aquela ação,
registrada com data e origem. Desmarcar reverte essa declaração. Missões de hoje
ficam pendentes em um novo dia; conclusões anteriores mantêm seu XP histórico,
sem renovação automática de recompensas. Um registro real e sua missão não
multiplicam XP. Remover o registro com missão ainda confirmada mantém a recompensa
da declaração independente; desfazer ambas remove a recompensa daquele dia.

Atributos usam dedicação real de 7 dias; conquistas são derivadas de atividades,
constância, livros concluídos e metas. Elas não dão XP extra. Veja
[quatro pilares](../../../../../docs/four-pillars.md) e `gamification/realProgress.ts`.

## Falhas e limites

Sem chave, usa-se estado inicial vazio, sem gravá-lo na montagem. Dados malformados
da versão atual podem ser substituídos após uma ação do usuário, como antes;
versões desconhecidas permanecem intactas. Falhas de acesso/leitura ou quota são
capturadas. Não se usa `localStorage.clear()` nem se removem chaves de outros módulos.
O adaptador pode ser substituído futuramente por backend sem mudar as projeções.

Os dados pertencem ao navegador e endereço (protocolo, host, porta) usados.
Limpar os dados do site remove o progresso. Não há sincronização entre dispositivos
ou resolução de alterações simultâneas entre abas.

## Verificação manual

1. Abra no mesmo endereço usado anteriormente. O progresso deve refletir apenas
   seus registros e missões confirmadas, mantendo o perfil e os quatro pilares.
2. Em DevTools → Application → Local Storage, confira a versão 3. Recarregue:
   XP/nível devem permanecer iguais, sem novo crédito ou migração.
3. Em uma origem/navegador sem dados, confira nível 1/0 XP, Radar zero e conquistas
   bloqueadas. Registre um treino: 150 XP. Confirme sua missão: continua 150 XP.
4. Desfaça a missão e o treino: o XP correspondente desaparece. Edite sono/meta,
   despesas ou leituras e confira o recálculo, sem acumuladores.
5. Use os filtros de missões e Radar e recarregue; preferências são preservadas.

Os novos campos financeiros das versões anteriores continuam opcionais e
compatíveis; suas operações e valores são preservados pela migração v3.
Veja [Finanças](../../modules/finances/README.md) para as regras monetárias.
