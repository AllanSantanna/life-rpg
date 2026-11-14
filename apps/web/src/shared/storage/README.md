# Persistência local e evolução real

Chave `life-rpg:player-state`, envelope `{ version: 4, data: PlayerState }`.
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

## Correção de progressão v1/v2 e formato atual v4

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

A migração acontece em memória e retorna `migrated: true`. Após hidratação válida,
o hook salva v4 em um `setItem`; em StrictMode essa gravação não se duplica. Na
próxima carga v4 é validada diretamente: nenhuma recompensa ou migração é repetida.
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
Como não muda o esquema, essa retirada não exige nova migração nem regrava v4 na montagem.

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
2. Em DevTools → Application → Local Storage, confira a versão 4. Recarregue:
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

O envelope atual é v4. Dados v3 válidos recebem apenas `goals: {items: [], updates: []}`,
sem alterar perfil, registros, missões, preferências ou origem da progressão real.
Versões v1/v2 aplicam a correção de demonstração descrita acima e recebem quests
vazias. Na carga seguinte v4 é validado diretamente, sem repetir migração ou XP.
O limite/orçamento de XP de quests é calculado a partir das conclusões, não salvo
como crédito acumulado. Exclusão/edição/desfazer recalculam a projeção. O contrato
completo está em [Quests](../../modules/goals/README.md).
