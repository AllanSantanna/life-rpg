# Radar de Evolução

O SVG reutilizável continua usando `scorePeriod` e `comparePeriods` com a fórmula
70% esforço + 30% frequência e metas proporcionais a 7/30/90 dias.
A fonte da projeção agora é `projectEffortActivities` em `modules/records`, que
combina registros reais com confirmações históricas comprovadas do usuário.
Histórico demonstrativo é ignorado; novas quests não criam esforço no Radar.
Datas e projeções são puras; a interface usa o dia civil atual do navegador.

O histórico legado permanece associado a 13/11/2026; nunca é convertido em
registros reais. Quando há sobreposição, o esforço diário é limitado sem soma
duplicada. Dashboard e Estatísticas compartilham a mesma projeção. XP acumulado
não expira quando uma atividade sai do período do radar.

As regras completas e as mudanças de versão estão em
[docs/four-pillars.md](../../../../../docs/four-pillars.md).
