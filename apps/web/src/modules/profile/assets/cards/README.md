# Cartas de personagens: fantasia sombria

24 cartas WebP (6 classes × 4 estágios) extraídas da prancha aprovada
[`previews/characters-sheet.png`](../previews/characters-sheet.png)
(1536 × 1024, sem textos) por
[`scripts/character-assets/extract-cards.mjs`](../../../../../../../scripts/character-assets/extract-cards.mjs).
Cada arquivo contém só o personagem dentro da moldura original, com fundo externo
transparente; nomes, estágios e níveis são exibidos pelos componentes React.
Nenhuma imagem foi ampliada ou repintada.

A mesma carta serve ao retrato do Início/Perfil (`PlayerPortrait`) e à galeria
de classes. A arte pixelada anterior está preservada em
[`../legacy/`](../legacy/cards/README.md), fora dos globs do Vite (não entra no
bundle). Comparação lado a lado:
[`previews/characters-preview.html`](../previews/characters-preview.html).

São **507672 bytes (495.77 KiB)** no total. Vite emite cada arquivo com
hash e base de publicação; o service worker as inclui no precache existente.

Estados: `ready` (pronta), `review` (halo tênue do brilho original fora da
moldura, visível só sobre fundos claros) e `regenerate` (anatomia das mãos
incorreta na arte original; integrada até a nova versão ser fornecida).

| Arquivo                                  | Dimensões | Bytes | Estado     | SHA-256                                                            |
| ---------------------------------------- | --------- | ----- | ---------- | ------------------------------------------------------------------ |
| `aventureiro/aventureiro-nivel-1.webp`   | 186 × 264 | 19308 | ready      | `b3741d322fe68d75f44d8543ec276c519d9b4672c3bb4eefcb38c51b1d12bde3` |
| `aventureiro/aventureiro-nivel-2.webp`   | 180 × 264 | 19022 | ready      | `880a9d77932f64ad3ba792680c5a98e6e5b2723f387b0ae63dd16d717ba3d13e` |
| `aventureiro/aventureiro-nivel-3.webp`   | 180 × 264 | 20500 | ready      | `9a6b8935be72a9ffd4fd61d2ad0196dfe2edd09125556828b1ba6fc50d866322` |
| `aventureiro/aventureiro-nivel-4.webp`   | 179 × 265 | 21806 | review     | `31c51ebf178ca192adb9af70e0188148889978bf142dc9c4487ec15b282b47bc` |
| `guerreiro/guerreiro-nivel-1.webp`       | 178 × 266 | 18622 | ready      | `ea23cf41cd5b48667012920d4d9d68e07a4278173780e052a9cb3a5c75794cd6` |
| `guerreiro/guerreiro-nivel-2.webp`       | 180 × 266 | 19984 | ready      | `faf344410bf12f50fa3602abbceac6ca0398107b078b681dfa0b07ec5386ec11` |
| `guerreiro/guerreiro-nivel-3.webp`       | 180 × 266 | 21160 | ready      | `054412bf46ba3bbd1624a52dcefd829cee7fb02c4c1e1ae3ef8d78f11e5a62bd` |
| `guerreiro/guerreiro-nivel-4.webp`       | 182 × 268 | 23834 | ready      | `e10aed169d8a739533229c0b27c77a9ed3dae5fc7cec340cbf3921c134211cf1` |
| `estrategista/estrategista-nivel-1.webp` | 185 × 270 | 19708 | regenerate | `747557e4ec5a5ccee699a51cacee7571e1ba4e185d28809366e7707581424cfa` |
| `estrategista/estrategista-nivel-2.webp` | 179 × 270 | 19578 | ready      | `b6801670f0bc630df1ee525b11319b5c8cad7a882453950b9ec9674d3955197c` |
| `estrategista/estrategista-nivel-3.webp` | 178 × 270 | 20422 | regenerate | `29c41d093e848a58e4fe998f3cada12f7003aa6f9fe8e56d6f0def0c18b2bc35` |
| `estrategista/estrategista-nivel-4.webp` | 179 × 270 | 21700 | ready      | `ce2494ea35c823867b4826ef6ad0a7ffa42f686f71f5c2901538d82cc437a073` |
| `guardiao/guardiao-nivel-1.webp`         | 178 × 270 | 19798 | ready      | `f99282d3f985bd9641dc4e855bd350bce228f26057ea16c982a99cbfabac0021` |
| `guardiao/guardiao-nivel-2.webp`         | 179 × 270 | 19740 | ready      | `8670abd13887fdfadf8996c562033cb60f54a3c0b1ede179ac204bd365741bf0` |
| `guardiao/guardiao-nivel-3.webp`         | 178 × 271 | 20874 | ready      | `51e68bafaf80aa08052df7b7f9069acd9abcc41ee922b6d3e9b8a77886db592d` |
| `guardiao/guardiao-nivel-4.webp`         | 184 × 271 | 23960 | ready      | `cd99785749b0d7410a8515a267feca209a32e4013da03894a298bc315969de91` |
| `sabio/sabio-nivel-1.webp`               | 186 × 277 | 20132 | regenerate | `522a6364fc21933afed53c2119ed65a60885be57bb1755dc9293308130cf5149` |
| `sabio/sabio-nivel-2.webp`               | 180 × 278 | 20692 | regenerate | `4891d10473147f315481cfc68bcc87b8174d3ccefa4771e5077c4ea63335d1f9` |
| `sabio/sabio-nivel-3.webp`               | 183 × 278 | 22818 | review     | `a1ec1fe087b6a4d1c33a261ab4ad437c01a336abf38b4e94e1e0159c52731e5e` |
| `sabio/sabio-nivel-4.webp`               | 190 × 279 | 24552 | review     | `c66c77093636494b14f1c0b3f07122a4dc7b06368a7c4bb4a913651f7383ac52` |
| `mestre/mestre-nivel-1.webp`             | 178 × 279 | 21140 | ready      | `8ae6f136de93acb386a96203551ff29767e90a8e4131b93c284a9458cf501355` |
| `mestre/mestre-nivel-2.webp`             | 179 × 280 | 21370 | ready      | `9adddd276cf38b2e24315bc4d8a5a4a833438236b5e3a0eb5dc15cf41c87d926` |
| `mestre/mestre-nivel-3.webp`             | 181 × 281 | 22056 | ready      | `3621b48f86cd4d1e803891822c01eb50661bf61d9a8d2fe6eb50ad5def7c1bd9` |
| `mestre/mestre-nivel-4.webp`             | 181 × 282 | 24896 | ready      | `3d82f2af78a08d8287a1bef9b779af3560d6ed08041fe0e094564db31c8cdbc0` |
