# Perfil e classes automáticas

O Perfil contém nome editável, avatar atual, classe, nível, XP/barra e Radar com
atalho para Estatísticas. O mesmo `PlayerHeader` aparece no dashboard. Conquistas
continuam disponíveis no dashboard e em Estatísticas.

`projectCharacter` usa os mesmos registros reais, confirmações históricas e
`scorePeriod` do Radar. A classificação usa sempre os últimos **30 dias**, incluindo
hoje e os 29 anteriores, sem depender de `preferences.radarPeriod`. Histórico
demonstrativo, datas futuras, posições financeiras iniciais e eventos de quests
não acrescentam esforço. Valores financeiros não aumentam a dedicação.

## Regras

- A classe é atribuída desde o primeiro registro, pelo pilar com maior pontuação
  no Radar de 30 dias: Treinos → Guerreiro; Conhecimento → Sábio;
  Finanças → Estrategista; Descanso → Guardião.
- Sem pontuação nos quatro pilares, o perfil mostra **Sem classe definida**.
  Aventureiro foi removido do catálogo.
- Edições, exclusões e expiração de registros atualizam a classe imediatamente,
  sem pontuação mínima, dias mínimos, confirmação ou intervalo entre trocas.
- Em empate, preserva a classe atual se ela estiver entre os líderes. Caso
  contrário, usa a ordem estável do catálogo: Guerreiro, Sábio, Estrategista,
  Guardião.
- **Mestre:** mínimo de 60/100 em cada pilar, diferença máxima de 20 pontos,
  pelo menos 14 dias ativos distribuídos em 21 dias ou mais, com cada pilar ativo
  em pelo menos 6 dias e 3 blocos semanais. Equilíbrio com pouca atividade não basta.
- Blocos semanais são contados para trás a partir de hoje: 0–6, 7–13, 14–20,
  21–27 e 28–29 dias.

## Estado e persistência

`character` guarda somente `avatar` e `classification` (`current`, `changedOn`,
`pending`). `current` é nulo sem pontuação; `changedOn` registra a última troca
e `pending` fica nulo após a reconciliação. Não há histórico de classes,
desbloqueios ou equipamento cosmético.

O envelope (v7 nesta mudança, v8 atualmente) é importado no IndexedDB canônico,
preservando a chave legada `life-rpg:player-state`; veja a
[persistência oficial](../../shared/storage/README.md). A migração de v5/v6 copia apenas
avatar e classificação do personagem, convertendo Aventureiro para classe nula
e removendo molduras, fundos, títulos, coleções, marcos de desbloqueio e histórico.
A hidratação atribui imediatamente a classe a partir dos registros existentes. Todos os demais campos são preservados.
V4 recebe o estado inicial do personagem; v3 recebe também o estado de quests
vazio que ainda não existia nessa versão. A migração anterior de v1/v2 permanece.

`usePlayerState` recalcula a classe na hidratação, em qualquer alteração do estado,
e na mudança de data com a página aberta. Reconciliar a classe não altera registros,
quests, conquistas, XP ou nível e não concede recompensas. Não há mudanças nas
fórmulas do Radar ou da progressão. A migração só substitui o envelope após uma
gravação bem-sucedida; falhas conservam o original e permitem continuar na sessão.
