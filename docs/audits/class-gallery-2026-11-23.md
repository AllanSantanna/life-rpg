# Galeria de classes e novo Perfil: 23/11/2026

Branch: `feat/class-gallery`, a partir de `46dc9b9` (`main` = `origin/main`, sem
alterações locais). As 24 cartas foram localizadas no backup externo
`life-rpg-assets-backup/assets/personagens/life-rpg-personagens-recortados/cartas/`
e copiadas com SHA-256 idêntico; o backup não foi alterado.

## O que mudou

- **Perfil:** o cartão superior usa `PlayerPortrait` ampliado (136–184 px,
  moldura dupla grafite/carmesim), selecionado pela classe atual e pelo nível.
  O avatar SVG antigo (`CharacterAvatar`) e seu CSS exclusivo foram removidos.
  `character.avatar` continua nos registros, na validação e nas migrações.
- **Explorar classes:** `ActionButton` na ficha do Perfil, abaixo da classe e do
  nível. Abre `/perfil/classes` (“Classes do Life RPG”); cada classe tem
  `/perfil/classes/<classe>`. Voltar, histórico, recarga e links diretos usam a
  navegação por URL existente, inclusive sob `/life-rpg/`.
- **Galeria:** seis classes com a carta do estágio atual, nome, pilar,
  indicação da classe atual e acesso aos detalhes. Aventureiro aparece só como
  representação visual de “Sem classe definida”.
- **Detalhes:** descrição, pilar, nível atual, regras de classificação e quatro
  evoluções (atual destacada, anteriores “Alcançado”, futuras “Bloqueado” com a
  arte visível). A carta selecionada mostra nome, estágio, requisito e situação.

As regras exibidas são montadas a partir de `classCatalog` e `CLASS_RULES`:
pilar líder do Radar de 30 dias, desempate (classe atual entre os líderes; senão
Guerreiro, Sábio, Estrategista, Guardião), prioridade de Mestre e seus critérios
(60/100 por pilar, diferença máxima de 20, 14 dias ativos em intervalo de 21 dias
ou mais, 6 dias e 3 blocos semanais por pilar). Nenhum critério foi inventado.

| Estágio         | Níveis |
| --------------- | ------ |
| I · Inicial     | 1–4    |
| II · Experiente | 5–9    |
| III · Avançado  | 10–19  |
| IV · Elite      | 20+    |

A tabela de estágios passou a ser exportada por `portraits.ts` (`stageLevels`) e
é a mesma usada pelo retrato, com a mesma lógica de `portraitStage`.

## Recursos

| Conjunto              | Arquivos | Bytes     | KiB      |
| --------------------- | -------- | --------- | -------- |
| Cartas (novas)        | 24       | 652.816   | 637,52   |
| Retratos (já na main) | 24       | 487.952   | 476,52   |
| Total de artes        | 48       | 1.140.768 | 1.114,03 |

Precache da PWA: 63 entradas / 2.161,90 KiB no build local (antes 39 /
1.509,17 KiB) e 60 entradas / 2.162,42 KiB no Pages (antes 36 / 1.509,48 KiB).
O acréscimo corresponde às 24 cartas. Cada arte é emitida uma única vez; o build
não contém cópias duplicadas, e o pacote de entrada (manifesto, README) não foi
incluído. Cartas fora da área visível usam `loading="lazy"`; todas declaram as
dimensões intrínsecas.

## Capturas

Recortes focados, com fixtures sintéticos em perfis descartáveis (o Guerreiro
Elite vem de 300 treinos sintéticos, que chegam ao nível 23 pelas regras atuais):

- [Perfil desktop, Guerreiro Elite](assets/class-gallery/perfil-desktop-elite.jpg)
- [Perfil celular 390 px, Guerreiro Inicial](assets/class-gallery/perfil-mobile-390.jpg)
- [Perfil celular 320 px, sem classe](assets/class-gallery/perfil-mobile-320-inicial.jpg)
- [Galeria das seis classes, desktop](assets/class-gallery/galeria-desktop.jpg)
- [Galeria a 320 px](assets/class-gallery/galeria-mobile-320.jpg)
- [Detalhes do Guerreiro, estágio Inicial](assets/class-gallery/guerreiro-desktop.jpg)
- [Detalhes do Estrategista](assets/class-gallery/estrategista-desktop.jpg)
- [Evoluções do Mestre no nível 23 (Elite)](assets/class-gallery/mestre-elite-desktop.jpg)
- [Evoluções do Mestre no celular (carrossel local)](assets/class-gallery/mestre-mobile-390.jpg)
- [Detalhes do Guerreiro a 320 px](assets/class-gallery/guerreiro-mobile-320-inicial.jpg)

Comparação com as [capturas dos retratos](player-portraits-2026-11-22.md): a
Visão geral mantém o mesmo cartão e retrato; no Perfil, o boneco SVG foi
substituído pelo retrato ampliado. A auditoria visual verifica, nas cinco
larguras, que não há elemento `[data-avatar]` no Perfil e que existe exatamente
um retrato ampliado.

## Verificações

| Verificação                                                  | Resultado                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `VITEST_MAX_WORKERS=2 npm run check`                         | Aprovado: padrões, TypeScript, lint, 8 testes de padrões, 24 da API, 715 web (antes 690) e build |
| `npm run format:check`                                       | Aprovado                                                                                         |
| `npm run standards:check`                                    | Aprovado                                                                                         |
| `npm run build:pages` + `node scripts/check-pages-build.mjs` | Aprovados; 64 arquivos na base `/life-rpg/`                                                      |
| `npm run audit:visual`                                       | 414 capturas (antes 364); zero erros de página e zero falhas de layout, sem rolagem horizontal   |
| `npm run audit:persistence`                                  | IndexedDB 28, storage/PWA 21 (zero bloqueios) e backup 13 cenários; zero falhas                  |
| `npm run audit:pages`                                        | 9 cenários (antes 8); zero falhas, erros de página ou requisições fora da base                   |
| `node scripts/audit-muscle-map.mjs`                          | 55 capturas; zero falhas                                                                         |

Novos testes (`ClassGallery.test.tsx` e `pagesDeployment.test.ts`): seis classes,
navegação entre classes, quatro cartas por classe, limites 4/5, 9/10 e 19/20,
destaque do estágio atual, estágios futuros bloqueados, mudança automática da
classe exibida, Aventureiro como alternativa visual, ausência de escolha manual,
dados persistidos idênticos após navegar e selecionar cartas, rota direta,
histórico e rotas sob `/life-rpg/`.

Auditorias ampliadas:

- `audit:pages` identifica, pelo SHA-256, os 48 WebP do build (24 retratos e 24
  cartas). Decodifica todos offline e abre o detalhe de uma classe sem rede pelo
  fallback do service worker. Também cobre link direto, voltar e recarga da
  galeria sob `/life-rpg/`.
- `audit:visual` inclui galeria e três detalhes nas cinco larguras e uma
  seleção de carta futura que não altera o snapshot persistido.

Testes alterados (sem enfraquecer asserções): o teste de nome do Perfil passou a
exigir o retrato, a ausência de `[data-avatar]` e o avatar legado salvo. O teste
do `PlayerHeader` deixou de injetar o retrato pelo slot removido e verifica que
o cabeçalho deriva o retrato da classe e do nível recebidos.

## Limites e preservação

Não foram alterados XP, níveis, classificação, Radar, pilares, Quests,
IndexedDB, backup, API, migrações ou a configuração do Pages. A seleção de carta
é estado local do componente.

O WebGL não está disponível no ambiente de auditoria, então Estatísticas usou o
fallback 2D existente. Não houve teste manual em Safari/iOS. As cartas são
recortes de uma montagem de resolução limitada, o que já é registrado no pacote
de entrada; por isso a largura máxima de exibição é 220 px (cerca de 1,2×).
Continuam os avisos conhecidos de chunks maiores que 500 kB.

Pendência anterior, fora do escopo: `waitForCommit` (`audit-storage-helpers.mjs`)
e `audit-brand.mjs` ainda usam `waitForFunction` com predicado assíncrono,
conforme registrado em [player-portraits-2026-11-22.md](player-portraits-2026-11-22.md).
