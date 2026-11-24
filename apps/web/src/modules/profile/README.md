# Perfil e classes automáticas

O Perfil contém nome editável, retrato por classe e estágio, classe, nível,
XP/barra, Radar com atalho para Estatísticas e o botão **Explorar classes**. Também reúne _Backup de dados_ (exportar e importar
arquivo; ver [backup manual](../../../../../docs/architecture/data-backup.md)) e
as cópias de segurança dos registros. O mesmo `PlayerHeader` aparece no dashboard. A seção
**Conquistas** (`/perfil#conquistas`) fica após o nome, com progresso geral, medalhas em
destaque e a galeria completa; o Início e Estatísticas mostram só o resumo. Ver
[conquistas](../gamification/README.md#conquistas).

As seções do Perfil (ficha, nome, backup e cópias) ficam em `.profile-page`,
uma grade com o mesmo vão de 20 px (`--space-5`) das páginas dos pilares; a
auditoria visual falha se duas seções encostarem.

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

## Retratos da Visão geral e do Perfil

[PlayerPortrait](PlayerPortrait.tsx) consome a classe atual (`ClassId | null`) e o
nível já projetado. Não calcula nem persiste classe, XP, nível ou estágio. O
mapeamento visual em [portraits.ts](portraits.ts) seleciona uma das
[24 cartas de fantasia sombria](assets/cards/README.md), as mesmas da galeria:

| Nível atual | Estágio visual  |
| ----------- | --------------- |
| 1–4         | I · Inicial     |
| 5–9         | II · Experiente |
| 10–19       | III · Avançado  |
| 20+         | IV · Elite      |

Guerreiro, Estrategista, Guardião, Sábio e Mestre seguem seus IDs existentes.
Classe nula usa **somente a arte** de Aventureiro; o domínio e o rótulo visível
continuam “Sem classe definida”. Isso não reintroduz Aventureiro no catálogo.

`PlayerHeader` renderiza o retrato nos dois contextos. `variant="profile"` amplia
o retrato (`size="large"`, 136–184 px de altura, brilho carmesim) e recebe as
ações da ficha; a Visão geral mantém a altura padrão (96–128 px). O avatar SVG
antigo (`CharacterAvatar`) foi removido da interface. `character.avatar`
continua nos registros, na validação e nas migrações, sem migração nova, para
manter a compatibilidade com backups e versões anteriores.

A carta já tem moldura metálica: o contêiner mantém a altura anterior, usa a
proporção da carta (181:270) com `object-fit: contain` e não desenha outra
moldura. As dimensões intrínsecas são declaradas no `img`. A arte pixelada
anterior (retratos e cartas) está em `assets/legacy/`, fora do bundle.
O texto alternativo conserva “Avatar de {nome}”, acompanhado de descrição
acessível da arte/estágio. O retrato visível usa carregamento imediato e
decodificação assíncrona, sem animação ou requisição de imagem externa.

## Galeria de classes

O botão **Explorar classes** (`ActionButton`, abaixo da classe e do nível na ficha
do Perfil) abre `/perfil/classes`, “Classes do Life RPG”. Cada classe tem a rota
`/perfil/classes/<classe>` (`aventureiro`, `guerreiro`, `estrategista`,
`guardiao`, `sabio`, `mestre`). As rotas usam a navegação por URL existente
(`pushState`, voltar do navegador, links diretos e o `404.html` do Pages sob
`/life-rpg/`); a navegação principal mantém Perfil como página atual. Um nome
desconhecido mostra a galeria.

[ClassGallery](ClassGallery.tsx) é somente leitura:

- A galeria mostra as seis classes com a carta do estágio do nível atual, nome,
  pilar, indicação discreta da classe atual e “Ver detalhes”.
- O detalhe mostra descrição, pilar, nível atual, as regras de classificação e as
  quatro cartas. O estágio atual fica destacado, os anteriores aparecem como
  “Alcançado” e os futuros como “Bloqueado”, com a arte visível. Selecionar uma
  carta mostra nome, estágio, requisito de nível e situação.
- A seleção da carta é estado local do componente. Não existe escolha manual de
  classe, desbloqueio, XP por visualização ou gravação de dados.

Os textos das regras vêm de [classCards.ts](classCards.ts), montados com
`classCatalog` e `CLASS_RULES` (período, limites de Mestre e ordem de desempate).
Mudanças nessas constantes atualizam a explicação. Aventureiro é descrito como
representação visual para a ausência de classe, não como classe do sistema.

As [24 cartas](assets/cards/README.md) somam 470,03 KiB e servem ao
retrato e à galeria (antes eram 48 arquivos, 1.114 KiB). Vite importa apenas URLs;
os 24 WebP entram no precache existente da PWA e funcionam offline após a
instalação. Cartas fora da área
visível usam `loading="lazy"`. No celular, as quatro evoluções formam um
carrossel com rolagem local (`scroll-snap`), sem alargar a página; a partir de
640 px, uma grade de quatro colunas. Animações discretas são desligadas com
`prefers-reduced-motion`. As cores de classe reutilizam os tokens dos pilares;
Aventureiro e Mestre têm `--color-class-adventurer` e `--color-class-master`.
Não há nova dependência, migração, alteração do IndexedDB ou do ciclo de
atualização do service worker.
