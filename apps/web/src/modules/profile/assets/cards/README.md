# Cartas de personagens: fantasia sombria

24 cartas WebP (6 classes × 4 estágios) extraídas da prancha aprovada
[`previews/characters-sheet.png`](../previews/characters-sheet.png)
(1448 × 1086, sem textos) por
[`scripts/character-assets/extract-cards.mjs`](../../../../../../../scripts/character-assets/extract-cards.mjs).
Usadas as três primeiras linhas; a quarta (versões alternativas de Sábio e Mestre)
não foi escolhida. Cada arquivo contém só o personagem dentro da moldura original,
com fundo externo transparente; nomes, estágios e níveis são exibidos pelos
componentes React. Nenhuma imagem foi ampliada ou repintada.

A mesma carta serve ao retrato do Início/Perfil (`PlayerPortrait`) e à galeria
de classes. A arte pixelada anterior está preservada em
[`../legacy/`](../legacy/cards/README.md), fora dos globs do Vite (não entra no
bundle). Comparação lado a lado:
[`previews/characters-preview.html`](../previews/characters-preview.html).

São **481314 bytes (470,03 KiB)** no total. Vite emite cada arquivo com hash e base
de publicação; o service worker as inclui no precache existente.

Estados: `ready` (pronta) e `review` (halo tênue do brilho original fora da
moldura, visível só sobre fundos claros). Na arte, o Guerreiro IV tem moldura
dourada. Esta prancha corrigiu as mãos de Estrategista I e III e Sábio I e II.

| Arquivo                                  | Dimensões | Bytes | Estado | SHA-256                                                            |
| ---------------------------------------- | --------- | ----- | ------ | ------------------------------------------------------------------ |
| `aventureiro/aventureiro-nivel-1.webp`   | 191 × 267 | 18574 | ready  | `5d6b61921d93ee5c406e88f4781eaaf7ede9a965fdf59f5d82a8686c6947267f` |
| `aventureiro/aventureiro-nivel-2.webp`   | 183 × 267 | 18460 | ready  | `cc9b4b116a14973d33fc70f2fb66431c42cacd32a96208a44a0954f53c233233` |
| `aventureiro/aventureiro-nivel-3.webp`   | 179 × 267 | 18848 | ready  | `021135f68ca6e6c8b0b23ae076f7d969670ded36e8a801ee6b3b0604191b17ae` |
| `aventureiro/aventureiro-nivel-4.webp`   | 175 × 267 | 20110 | ready  | `cd99334e1fe1b98f592716fd380ccf723b92effff3b885daee6020d5fab95bee` |
| `guerreiro/guerreiro-nivel-1.webp`       | 180 × 267 | 18014 | ready  | `97fae1e0cc56d136856ac34743a881e06c1ab4b21bd2112abf8b80f9c76d3f2e` |
| `guerreiro/guerreiro-nivel-2.webp`       | 179 × 267 | 18890 | ready  | `e268f61c444b1f5cf163ee2db87320dab07c9e3a40e501409e26fe0af1439636` |
| `guerreiro/guerreiro-nivel-3.webp`       | 180 × 267 | 19672 | ready  | `b9d14ffd7845a715d6efd719d5420e04c214876aece3787cfebe34d89c5bfd11` |
| `guerreiro/guerreiro-nivel-4.webp`       | 184 × 267 | 22424 | review | `07b8d6b6fd2062035e8d7f055dfe342402b4493b2c3e4fb951fdc49a1a2ff6f9` |
| `estrategista/estrategista-nivel-1.webp` | 191 × 267 | 19168 | ready  | `b896d82ce7387175440f03fac73960b257d6d51551145198ef6f1d1bfd3653be` |
| `estrategista/estrategista-nivel-2.webp` | 181 × 267 | 19456 | ready  | `dc159408d7335cfcefd55ebca047971cf20dd69e3064ad7db13698408c768072` |
| `estrategista/estrategista-nivel-3.webp` | 178 × 267 | 20012 | ready  | `659b9f1e2cd1ea189fe9207a0214dd9756b8fd825ed0435b629d6e0175239d65` |
| `estrategista/estrategista-nivel-4.webp` | 175 × 267 | 21270 | review | `e64b2509edd060421ae9a07edeb5c45b6bddeb5dc7c4391f10b5e98d422dcfca` |
| `guardiao/guardiao-nivel-1.webp`         | 178 × 267 | 19270 | ready  | `7f7a8486559f88eef7e6d7f37141b8b2cb0a01e253e813de567d3d24acfb1cd9` |
| `guardiao/guardiao-nivel-2.webp`         | 177 × 267 | 20202 | ready  | `698fad1f4f3f6b2ac16bd37e244d4b9b5d553a20b302366be0b80a4ad3a1686d` |
| `guardiao/guardiao-nivel-3.webp`         | 180 × 267 | 20796 | ready  | `38a19a92c4a9942515cb4b7f73d11b2ad7123bdb4f058b1559e82245a7cdf1bf` |
| `guardiao/guardiao-nivel-4.webp`         | 184 × 267 | 22722 | review | `140355c26893272c11c2a6cdb0ad8db874df04fe4b914ef5ae1fbe39b3f56f44` |
| `sabio/sabio-nivel-1.webp`               | 193 × 264 | 19282 | ready  | `54144b7df97e9c6b702328b4dcc7e17f7827b6794981ed88b6909da0e9754524` |
| `sabio/sabio-nivel-2.webp`               | 183 × 264 | 19538 | ready  | `7575d341c7c0e1ceb609df1b4a69044086b8978116873f5953761894c48ec61a` |
| `sabio/sabio-nivel-3.webp`               | 178 × 264 | 21050 | ready  | `1c36bebf3c74013bdbc41f3f866befee5b17fb3f3b1fc716230132acc57bad65` |
| `sabio/sabio-nivel-4.webp`               | 177 × 264 | 21342 | ready  | `f926193f8be782fce9bbb847b5ccfcc937ef4d9260da003ca44b34a4f0aeb525` |
| `mestre/mestre-nivel-1.webp`             | 177 × 264 | 19058 | ready  | `7dbc20b2381390c1ed7ae73dc4d488f826675602b0f79a1263315a9f8d12f68a` |
| `mestre/mestre-nivel-2.webp`             | 177 × 264 | 19966 | ready  | `a984675340c999c27e776e3b10ec96221cb158534c7ac6552b5883d0d2f40547` |
| `mestre/mestre-nivel-3.webp`             | 178 × 264 | 20556 | ready  | `eb0704f9fd2b4f6de6fc5c9afe414d1fd355b3850878b53b9a8147bbcfec132f` |
| `mestre/mestre-nivel-4.webp`             | 180 × 264 | 22634 | review | `f217fc8fb8366757406a05f829ff54410fa72e8af5e27a28f909f00da08f7a72` |
