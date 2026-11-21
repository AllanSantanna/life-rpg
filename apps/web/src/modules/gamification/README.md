# gamification

Responsável por experiência (XP), níveis, atributos e conquistas.

Implementado como projeções puras, sem estado salvo: `realProgress.ts` calcula
atributos e conquistas a partir das atividades reais; `progression.ts` reúne
nível e XP; `AttributesPanel` e `AchievementsPanel` exibem o resultado. As
regras de XP e tetos estão em [quatro pilares](../../../../../docs/four-pillars.md).
