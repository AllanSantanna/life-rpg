# Perfil e classes automáticas

O Perfil contém nome editável, avatar atual, classe, nível, XP/barra e Radar com
atalho para Estatísticas. Também reúne _Backup de dados_ (exportar e importar
arquivo; ver [backup manual](../../../../../docs/architecture/data-backup.md)) e
as cópias de segurança dos registros. O mesmo `PlayerHeader` aparece no dashboard. Conquistas
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

## Retratos da Visão geral

[PlayerPortrait](PlayerPortrait.tsx) consome a classe atual (`ClassId | null`) e o
nível já projetado. Não calcula nem persiste classe, XP, nível ou estágio. O
mapeamento visual em [portraits.ts](portraits.ts) seleciona um dos
[24 WebP originais](assets/portraits/README.md):

| Nível atual | Estágio visual |
| ----------- | -------------- |
| 1–4         | 1 · Inicial    |
| 5–9         | 2 · Experiente |
| 10–19       | 3 · Avançado   |
| 20+         | 4 · Elite      |

Guerreiro, Estrategista, Guardião, Sábio e Mestre seguem seus IDs existentes.
Classe nula usa **somente a arte** de Aventureiro; o domínio e o rótulo visível
continuam “Sem classe definida”. Isso não reintroduz Aventureiro no catálogo.
`character.avatar` é preservado e continua sendo usado na tela Perfil.

`PlayerHeader.portrait` é um slot opcional: apenas a Visão geral injeta o novo
retrato. A tela Perfil preserva o `CharacterAvatar` anterior. Nome, classe,
nível, XP e Radar mantêm os mesmos dados e controles. As mudanças de props
atualizam o retrato no mesmo render, sem estado duplicado ou efeitos de gravação.

O contêiner reserva proporção 1:1 (96–128 px), com `object-fit: contain` e
`image-rendering: pixelated`; as dimensões intrínsecas são declaradas no `img`.
O texto alternativo conserva “Avatar de {nome}”, acompanhado de descrição
acessível da arte/estágio. O retrato visível usa carregamento imediato e
decodificação assíncrona, sem animação ou requisição de imagem externa.

Vite importa URLs dos arquivos WebP, não seus bytes para o JavaScript. Os 24
arquivos somam 476,52 KiB e entram no precache existente da PWA; a troca de classe
ou estágio funciona offline após a instalação desse cache. O prefixo
`/life-rpg/` é aplicado automaticamente pelo build Pages. Não há nova dependência,
migração ou alteração do ciclo de atualização do service worker.
