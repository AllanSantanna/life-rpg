# gamification

Responsável por experiência (XP), níveis, atributos e conquistas.

Implementado como projeções puras, sem estado salvo: `realProgress.ts` calcula
atributos e delega as conquistas a `achievements/`; `progression.ts` reúne nível
e XP; `AttributesPanel` exibe os atributos. As regras de XP e tetos estão em
[quatro pilares](../../../../../docs/four-pillars.md).

## Conquistas

Não existe aba ou rota própria. O **Início** e **Estatísticas** mostram o resumo
(`AchievementsSummary`); o **Perfil** tem a seção completa (`AchievementsSection`,
âncora `/perfil#conquistas`), aberta pelo botão "Ver conquistas".

| Arquivo                        | Responsabilidade                                                               |
| ------------------------------ | ------------------------------------------------------------------------------ |
| `achievements/catalog.ts`      | 42 definições: pilar, raridade, métrica, objetivo e medalha                    |
| `achievements/metrics.ts`      | Métricas reconstruídas dos registros, com a data em que cada alvo foi atingido |
| `achievements/evaluate.ts`     | Estado, progresso textual, totais, recentes, destaques e "mais próxima"        |
| `achievements/presentation.ts` | Fila da notificação de desbloqueio e estado de apresentação                    |
| `achievements/assetPaths.ts`   | WebP usados (também lidos pelo `vite.config.ts` para o precache)               |

### Fonte de verdade e recálculo

- As conquistas são recalculadas a cada render a partir de `records`,
  `missionEvents` (confirmações do usuário) e `goals`. Criar, editar ou excluir
  um registro muda o resultado imediatamente; uma conquista que deixa de ser
  sustentada volta a ficar bloqueada. Não há bônus de XP, nem alteração em
  níveis, classes, Quests ou Radar.
- Nada é gravado no `PlayerState`, no IndexedDB ou no backup. Os campos legados
  `unlockedAchievementIds` continuam vazios. Exportar/importar backup preserva os
  registros, e as conquistas são recalculadas deles.
- Os ids `first`, `consistent`, `reader` e `balance` do catálogo anterior foram
  mantidos com o mesmo critério. `balance` passou a considerar **qualquer**
  janela de 7 dias do histórico (antes, só os últimos 7 dias), para não perder a
  conquista com o passar do tempo; a regra de pontuação é a de `scorePeriod`.

### Catálogo (42, sem secretas)

| Pilar        | Comum | Incomum | Rara | Épica | Lendária | Total |
| ------------ | ----- | ------- | ---- | ----- | -------- | ----- |
| Treinos      | 3     | 1       | 3    | 1     | 1        | 9     |
| Conhecimento | 1     | 2       | 2    | 2     | 1        | 8     |
| Finanças     | 2     | 2       | 2    | 1     | 1        | 8     |
| Descanso     | 1     | 2       | 2    | 2     | 1        | 8     |
| Especiais    | 2     | 2       | 1    | 2     | 2        | 9     |

Antiexploração: contam **dias distintos**, semanas, livros concluídos e etapas
de organização. Vários registros no mesmo dia valem uma vez. Nenhuma conquista
depende de valores em dinheiro, saldo, peso corporal ou volume de páginas.
Quests com indicador automático de saldo (`cash`, `wealth`, `investments`) não
contam, como nas recompensas de Quests.

### Limitações documentadas

- **Datas:** "Conquistada em" é a data dos registros que sustentam o marco, não o
  instante em que o usuário digitou (registros podem ser retroativos). Quando não
  pode ser determinada (por exemplo, posição inicial com data de aquisição
  desconhecida), a interface diz isso em vez de estimar.
- **Meta de sono:** "na meta" usa a meta atual (`sleepGoalHours`), como o XP; o
  histórico de metas anteriores não é registrado, então mudar a meta recalcula
  essas conquistas.
- **Livros:** contam livros com páginas lidas iguais ao total (critério anterior).
  Um livro cadastrado com poucas páginas conta igual; não há como validar o
  tamanho real.
- **Modo Avançado:** sessões só contam em dias marcados como treinados, como no XP.
- Registros retroativos em massa podem desbloquear marcos; isso vale para todo o
  app e não é detectável a partir do histórico.

### Apresentação e efeitos

- Bloqueadas: dessaturadas, escurecidas, com cadeado e barra de progresso real.
- Desbloqueadas: cor e brilho da raridade (`--color-rarity-*`). Épicas: aura,
  reflexo metálico ocasional e partículas; lendárias: brilho dourado, anel de luz
  e reflexo mais frequente. Os efeitos animam só nos destaques do Perfil e na
  notificação; na galeria, apenas ao passar o mouse ou focar o card.
- Notificação de desbloqueio (`AchievementUnlockNotice`): não modal, não rouba o
  foco, anunciada por `role="status"`, com fila ("Próxima"), "Fechar"/Escape e
  "Ver no Perfil". Só aparece para conquistas novas geradas por uma ação do
  usuário (registro ou quest) nesta sessão. Abrir o app, restaurar ou importar
  backup e sincronizar outra aba nunca animam.
- Estado de apresentação: `life-rpg:achievement-presentation` (v1, ids já
  apresentados), gravado quando o usuário dispensa a notificação. Preferência
  "Ocultar galeria": `life-rpg:achievements-view` (v1), gravada só ao alternar.
  Ambos são descartáveis: valores inválidos são ignorados e substituídos.
- Tudo respeita `prefers-reduced-motion`. Não há áudio.
