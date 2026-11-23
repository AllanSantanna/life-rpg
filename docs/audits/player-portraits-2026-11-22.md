# Retratos de personagens — 22/11/2026

Branch: `feat/player-portraits`, a partir de `f454d22` (`origin/main`).
A `main` estava sincronizada; não havia alterações em arquivos rastreados. O
pacote de entrada em `assets/personagens/` já estava extraído e não rastreado.
Foram examinados os 24 retratos e exemplos das cartas completas. Não havia ZIP
para extrair; foi utilizado o diretório indicado no pedido.

## Implementação

`PlayerPortrait` recebe a classe atual e o nível já projetado. O mapeamento em
`portraits.ts` usa os IDs existentes de Guerreiro, Estrategista, Guardião, Sábio
e Mestre. Classe nula seleciona a arte de Aventureiro, mantendo o rótulo “Sem
classe definida”; Aventureiro não volta ao catálogo de domínio.

| Níveis | Estágio visual |
| ------ | -------------- |
| 1–4    | 1 · Inicial    |
| 5–9    | 2 · Experiente |
| 10–19  | 3 · Avançado   |
| 20+    | 4 · Elite      |

O componente é injetado no slot `PlayerHeader.portrait` somente na Visão geral.
A tela Perfil conserva o avatar anterior. Nome, classe, nível, XP e Radar usam
os mesmos dados, posições e controles. O retrato muda com as props, sem efeitos
de gravação, novo estado persistido ou cálculos de recompensa.

A moldura usa tokens de fundo, carmesim e grafite, com efeitos discretos.
A área quadrada de 96–128 px permanece estável durante o carregamento/troca; o
`img` declara as dimensões intrínsecas e usa `object-fit: contain` e
`image-rendering: pixelated`. As artes não são cortadas nem redesenhadas.
O carregamento é imediato, com prioridade alta para o retrato visível e
decodificação assíncrona. Há nome e descrição acessíveis de personagem/estágio.

## Arquivos e peso

Os 24 WebP foram **movidos**, sem alteração de bytes, para
`apps/web/src/modules/profile/assets/portraits/`, separados nas seis pastas
originais. Os [nomes, dimensões e SHA-256](../../apps/web/src/modules/profile/assets/portraits/README.md)
registram a integridade de cada arquivo. As cartas (652.816 bytes) e os metadados
do pacote permanecem no diretório de entrada, fora do build e dos commits.
Não foram mantidas cópias adicionais dos retratos nesse diretório.

- 24 retratos: **487.952 bytes (476,52 KiB)** no total.
- Por retrato: 18.400–24.204 bytes; 175–193 px de largura e 168–173 px de altura.
- Novos arquivos de código: `PlayerPortrait.tsx`, `portraits.ts`,
  `playerPortrait.css` e `PlayerPortrait.test.tsx`, no módulo Perfil.
- Integração: `App.tsx`, slot opcional de `PlayerHeader`, testes de Perfil,
  contrato do módulo e catálogo do design system.
- Auditorias: cenário dos 24 retratos em `audit-pages.mjs`, observação de ativação
  do worker em `audit-storage-pwa.mjs` e helper `untilWaiting` compartilhado em
  `audit-storage-helpers.mjs`.

Vite emite cada retrato uma vez com hash e o prefixo de publicação. Não há
imagens externas nem dependências novas. O precache existente inclui os 24 WebP:
39 entradas / 1.509,17 KiB no build local e 36 entradas / 1.509,48 KiB no Pages.
Esses totais incluem o restante do app precacheado; o renderer 3D continua sob
demanda. As cartas e os arquivos de documentação não entram nesse cache.

## Capturas

Foram capturadas as cinco larguras oficiais: 320, 390, 768, 1024 e 1440 px,
com dados vazios e com um Guerreiro Elite derivado de 300 registros sintéticos.
Esse exemplo chega ao nível 23 pelas regras existentes, sem alterar fórmulas
ou dados reais. As capturas completas estão em `/tmp/life-rpg-portraits/`.

- [Visão geral, cartão desktop Elite](assets/player-portraits/desktop-elite.png).
- [Visão geral, celular Inicial](assets/player-portraits/mobile-initial.png).
- [Visão geral, celular Elite a 320 px](assets/player-portraits/mobile-elite-320.png).

## Verificações

| Verificação                                                     | Resultado                                                                                                                                                                               |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITEST_MAX_WORKERS=2 npm run check`                            | Aprovado: padrões, TypeScript, lint, 8 testes de padrões, 24 da API, 690 web e build                                                                                                    |
| Suítes específicas de `PlayerPortrait`, Perfil e App            | 48 testes aprovados, incluindo as 24 combinações, limites 4/5, 9/10, 19/20 e trocas automáticas de classe                                                                               |
| `npm run format:check`                                          | Falha somente no `manifest.json` preexistente do pacote de entrada, não rastreado; preservado                                                                                           |
| Prettier dos arquivos versionáveis (exceto o pacote de entrada) | Aprovado                                                                                                                                                                                |
| `npm run build:pages` + `node scripts/check-pages-build.mjs`    | Aprovados; 40 arquivos verificados na base `/life-rpg/`                                                                                                                                 |
| `npm run audit:visual`                                          | 364 capturas; zero erros de página e zero falhas de layout (sem rolagem horizontal) nas cinco larguras                                                                                  |
| `npm run audit:persistence`                                     | IndexedDB 28 cenários, storage/PWA 21 cenários (zero bloqueios), backup 13 cenários; zero falhas                                                                                        |
| `npm run audit:pages`                                           | 8 cenários, duas execuções consecutivas; zero falhas, erros de página ou requisições fora da base. Os 24 retratos foram decodificados offline e comparados byte a byte com os originais |
| `node scripts/audit-muscle-map.mjs`                             | 55 capturas; zero erros e zero falhas                                                                                                                                                   |

As execuções usam Playwright fora do projeto e perfis descartáveis. As auditorias
finais foram isoladas em um Vite na porta 5174. A primeira execução visual foi
interrompida por `ERR_ABORTED` ao navegar para Descanso, sem falha de geometria;
foi repetida integralmente na instância dedicada.

Na auditoria de PWA, a página que observava a ativação podia receber o controlador
anterior e falsear a verificação de nova versão. O teste agora registra um
observador no **worker que está aguardando**, antes de fechar as abas antigas,
e aguarda a ativação desse worker com prazo de 10 s. As exigências de manter a
versão anterior enquanto existem clientes antigos e de preservar todos os dados
continuam presentes. O service worker de produção não foi alterado.

Na retomada, `audit:pages` falhou de forma determinística no cenário “nova versão
aguarda as abas antigas”. A causa estava no teste: `page.waitForFunction` com
predicado `async` recebe uma Promise, que é sempre verdadeira, e resolve
imediatamente (comportamento confirmado no Playwright 1.65.1, inclusive com
valor `false`). A asserção seguinte encontrava o novo worker ainda em
`installing`. As três esperas por worker em espera (duas em `audit-pages.mjs`,
uma em `audit-storage-pwa.mjs`) passaram a usar `untilWaiting`, que consulta o
registro em intervalos de 100 ms com prazo de 10 s. Nenhuma asserção foi removida
ou afrouxada.

Pendência fora do escopo: o mesmo padrão existe em `waitForCommit`
(`audit-storage-helpers.mjs`, preexistente na `main`) e em `audit-brand.mjs`.
Nesses pontos a espera também não aguarda de fato. Recomenda-se uma branch
`fix/` própria para corrigi-los.

Dois testes de avatar na Visão geral foram atualizados para verificar a nova
imagem e, adicionalmente, a preservação de `character.avatar` salvo. Os demais
controles e testes do Perfil permanecem com o avatar anterior.

## Limites e preservação

Nenhum arquivo de lógica de XP, nível, Radar, classes, migração, schema ou
persistência foi alterado. `character.avatar` permanece nos registros e é
verificado pelos testes de migração/edição; apenas o avatar da Visão geral passa
a usar a apresentação por classe/estágio.

O `format:check` global apontou somente o `manifest.json` original do pacote de
entrada, um arquivo preexistente não rastreado. Ele foi preservado; não houve
exclusão ou relaxamento de validação. Os arquivos alterados foram conferidos
separadamente com Prettier. O CI recebe somente os arquivos preparados para o PR.

WebGL indisponível no ambiente de auditoria: Estatísticas usou a alternativa 2D
existente. Não houve teste manual em Safari/iOS ou launcher real. Permanecem os
avisos conhecidos de chunks maiores que 500 kB, sem alterar limites do build.

Os checklists de implementação e revisão foram aplicados: escopo limitado à
Visão geral, reuso do cartão, tokens, acessibilidade, responsividade, preservação
dos originais e dos dados, documentação, diff e staging seletivo. Não se criaram
novos formulários/ações e não se alteraram regras de domínio. Push da branch e
abertura do PR foram autorizados; a `main` deve permanecer sem merge até nova
autorização explícita para esta tarefa.
