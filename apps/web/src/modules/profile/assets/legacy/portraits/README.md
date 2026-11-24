# Retratos originais de personagens

> **Legado (24/11/2026):** substituída pelas [cartas de fantasia sombria](../../cards/README.md); preservada até a aprovação definitiva. Fora dos globs do Vite: não entra no bundle.

24 arquivos WebP fornecidos pelo usuário em
`assets/personagens/life-rpg-personagens-recortados/retratos/`, movidos para este
módulo sem recorte, redimensionamento ou recompressão. As cartas completas
estão em [assets/cards](../cards/README.md), usadas pela galeria de classes; os
metadados do pacote permanecem fora do repositório.

São **487.952 bytes (476,52 KiB)** no total; entre 18.400 e 24.204 bytes por retrato.
Vite emite cada arquivo uma única vez, com hash e base de publicação; o
service worker inclui os 24 WebP no precache existente. O navegador decodifica
somente o retrato selecionado para a Visão geral e o Perfil.

Os tamanhos abaixo são os intrínsecos dos arquivos recebidos. A renderização
usa `object-fit: contain`, `image-rendering: pixelated` e moldura quadrada estável.
Os SHA-256 permitem verificar que as artes originais foram preservadas.

| Arquivo                                  | Dimensões | Bytes | SHA-256                                                            |
| ---------------------------------------- | --------- | ----- | ------------------------------------------------------------------ |
| `aventureiro/aventureiro-nivel-1.webp`   | 180 × 172 | 19582 | `783047e86c8b8907bbfb17eab2cc2a83dd439ca3f462dfc30dffcfa5dc1c0dcf` |
| `aventureiro/aventureiro-nivel-2.webp`   | 178 × 172 | 18400 | `d7e3eb00acf25cda84b5abfedd690e974323be1cbf89d300dd77c50ef6531b33` |
| `aventureiro/aventureiro-nivel-3.webp`   | 180 × 172 | 19236 | `2367562d3cbab53d20952755379e37380f71da6d8863fec66329d6a456b8560c` |
| `aventureiro/aventureiro-nivel-4.webp`   | 175 × 172 | 19374 | `d1c8c27c19181a2288e6789183b39d5f78e13e519fc749a31db28442166481d1` |
| `estrategista/estrategista-nivel-1.webp` | 180 × 168 | 18690 | `1843e03e540c6bd86997a5868b2472dc46dcf978dcff165f9be857816a91a1c9` |
| `estrategista/estrategista-nivel-2.webp` | 178 × 168 | 18406 | `8a886ca66092b68c4fc92fa5cd4cc3e808f3e4ce0ed3403d5810bafbca9ff6ef` |
| `estrategista/estrategista-nivel-3.webp` | 180 × 168 | 19100 | `38db8e9dba9a8b7519b3f13d1e2fab763edb79ae11243c515d99673b0e1c8bd7` |
| `estrategista/estrategista-nivel-4.webp` | 175 × 168 | 20572 | `1d199c2a469a08c81a3e6c6a355dff2839bbb979c46f1a508bb12b908c2a9fe3` |
| `guardiao/guardiao-nivel-1.webp`         | 183 × 168 | 18850 | `9b58a71062902dfb2c2d36ee8a1e9ccda4b8e74e68ed784eb3fdb818529c70a2` |
| `guardiao/guardiao-nivel-2.webp`         | 181 × 168 | 19618 | `4c590daf9a05eeae4b63e1dacc9f4d4fa21d2842f3ec5fb766fdcfbc519f0d6c` |
| `guardiao/guardiao-nivel-3.webp`         | 181 × 168 | 19832 | `3c8b242e7c4c7d504e59a3b0aedf21797824eedb3bc920a41dc7f0a47873d3a0` |
| `guardiao/guardiao-nivel-4.webp`         | 193 × 168 | 23968 | `2e693a1c66950a12deb7b389a82a9e36633c754f2f8ac38ac0a282a63d3c9acc` |
| `guerreiro/guerreiro-nivel-1.webp`       | 183 × 172 | 19572 | `2870cb686f30abb0b8c7f87842673025fc7f812031a32cad3c86ba8ac4e17993` |
| `guerreiro/guerreiro-nivel-2.webp`       | 181 × 172 | 19078 | `e1c6deed0876ec420e245a16cc59383b0e59afb80a77d00b45403fbb4247fe50` |
| `guerreiro/guerreiro-nivel-3.webp`       | 181 × 172 | 19546 | `a753afb9afe3d08bd4eacab0ca5cb74facfde272a1ef1aa6455cf68d316daa99` |
| `guerreiro/guerreiro-nivel-4.webp`       | 193 × 172 | 23718 | `a81e36b4a032d8d3b6f4fe06d920850bb5bd20becf1d5987e3e259cfffea23de` |
| `mestre/mestre-nivel-1.webp`             | 183 × 173 | 20114 | `28289aa5acba5f45c39f38a62fa452d35300ce180547d27be3580f96573d7feb` |
| `mestre/mestre-nivel-2.webp`             | 181 × 173 | 20796 | `136307df8348fad37e24d58a274a73ea014da7dd7e8d3c7a3657085f07940dec` |
| `mestre/mestre-nivel-3.webp`             | 181 × 173 | 21476 | `e59703d9dcd868cefce8180ae7f3fbd2dd2d49bc3e1dd6bf736aeb9898971266` |
| `mestre/mestre-nivel-4.webp`             | 193 × 173 | 24204 | `a8c491dda2b0408eac82496b24674418d5f1c422b399babce5473e88bcb1256d` |
| `sabio/sabio-nivel-1.webp`               | 180 × 173 | 20426 | `ccc9a1d4b63edaa7209f91b7494aafe2f0803f1fe48c8510b6d9d1a7ddacd821` |
| `sabio/sabio-nivel-2.webp`               | 178 × 173 | 20588 | `fc534225dbc46292f3c51d94f0c17fbe3b66c3d0025f5263cebc75f7c723f104` |
| `sabio/sabio-nivel-3.webp`               | 180 × 173 | 20834 | `eab016abcc63c2621eea35c5acda5a1f5cc8b2ad539c0666fcadf6385b802a02` |
| `sabio/sabio-nivel-4.webp`               | 175 × 173 | 21972 | `d7062dfb68b37416d5f53cbc8a43828bcd58c3256d52156036cb7a12911666cc` |
