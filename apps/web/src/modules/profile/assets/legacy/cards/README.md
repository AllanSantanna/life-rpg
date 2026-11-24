# Cartas originais das classes

> **Legado (24/11/2026):** substituída pelas [cartas de fantasia sombria](../../cards/README.md); preservada até a aprovação definitiva. Fora dos globs do Vite: não entra no bundle.

24 cartas WebP fornecidas pelo usuário, copiadas de
`life-rpg-assets-backup/assets/personagens/life-rpg-personagens-recortados/cartas/`
(fora do repositório) sem recorte, redimensionamento ou recompressão. O backup
original foi preservado. Cada carta já contém o rótulo do estágio e a faixa de
níveis impressos na arte.

São **652.816 bytes (637,52 KiB)** no total; entre 24.368 e
31.518 bytes por carta. Vite emite cada arquivo uma única vez, com hash
e base de publicação; o service worker inclui as 24 cartas no precache existente,
o que mantém a galeria disponível offline. Fora da área visível, as cartas usam
`loading="lazy"`; as dimensões intrínsecas são declaradas no `img`.

Os nomes repetem os dos [retratos](../portraits/README.md), mas as artes são
distintas: a auditoria do Pages identifica cada arquivo pelo conteúdo.

| Arquivo                                  | Dimensões | Bytes | SHA-256                                                            |
| ---------------------------------------- | --------- | ----- | ------------------------------------------------------------------ |
| `aventureiro/aventureiro-nivel-1.webp`   | 180 × 249 | 26776 | `54d7727bb29e4e62650b70cc7cd0d5cc0a57aa5085ae62aae3820c3912d8ee49` |
| `aventureiro/aventureiro-nivel-2.webp`   | 178 × 249 | 25420 | `df41ece948bfde1cc41b4cbdec6a6333132c85de4a9fa13f3e35c3d84f77b1a1` |
| `aventureiro/aventureiro-nivel-3.webp`   | 180 × 249 | 26296 | `d8868fffe8640fd0544f5211479a573a606e924cf7e7737fcb740539ed358174` |
| `aventureiro/aventureiro-nivel-4.webp`   | 175 × 249 | 26228 | `f8715ce085e355693c0dfe29ce0c78894f72c59faa90f47accb2b27e261019ad` |
| `estrategista/estrategista-nivel-1.webp` | 180 × 238 | 24960 | `ff9cc383c33c265de68076a1f9b83d64fab30b6c8c287e1f64736fb5814f3329` |
| `estrategista/estrategista-nivel-2.webp` | 178 × 238 | 24368 | `c37b407824d39ea7adb555f70c7c383607344a855a8b5c1c2b820fca34d4f880` |
| `estrategista/estrategista-nivel-3.webp` | 180 × 238 | 24664 | `1e0aa2e717f8ba988715c1b67aa581efcc7e707a6b5d3abf70b099bd4f5b26ac` |
| `estrategista/estrategista-nivel-4.webp` | 175 × 238 | 26140 | `b5f91bb0777d561e9d583258d6d1a6df270a688346893e833b469269a494e0c8` |
| `guardiao/guardiao-nivel-1.webp`         | 183 × 238 | 25544 | `e2124e6a65e200d52eed6e10cfcef7785f83a7f8fc390dba471aae1797e02c57` |
| `guardiao/guardiao-nivel-2.webp`         | 181 × 238 | 25810 | `c3fa4e14d8d9b813c830c956059cb1c97a925ac9cb9289c1913de053be802e15` |
| `guardiao/guardiao-nivel-3.webp`         | 181 × 238 | 25998 | `7581f1f0dcac20a1f6260cf990df44400c9a3c2abc37db1ad0b1fa1a48fd0f61` |
| `guardiao/guardiao-nivel-4.webp`         | 193 × 238 | 29878 | `77c21c4bbc175f2a8c2d6045d42487523288325b2bac9d7c0f752ae8fda816eb` |
| `guerreiro/guerreiro-nivel-1.webp`       | 183 × 249 | 26248 | `5117534b5e0a6f6e34b054d60b14015637b77e30a58a08951e6064c2bf25cf87` |
| `guerreiro/guerreiro-nivel-2.webp`       | 181 × 249 | 26058 | `87ff47f8233871eefc98b85e7222ae74475d9e2a63e53729e64f47bf56581adf` |
| `guerreiro/guerreiro-nivel-3.webp`       | 181 × 249 | 26490 | `ecba4b4e16b73e3dacfe35606ba15ef8678f58e62a0554c8a97d8429001e4c1c` |
| `guerreiro/guerreiro-nivel-4.webp`       | 193 × 249 | 31062 | `20bc66907ddb8a00ac264eea4a9facf301c2bfe54cba3fa9b4056ea90186f75e` |
| `mestre/mestre-nivel-1.webp`             | 183 × 252 | 27460 | `86468d512f1b6286f1df7f771665ac7d4cb30a7c3d961341d4305ffa0ff25338` |
| `mestre/mestre-nivel-2.webp`             | 181 × 252 | 28616 | `7f82150f6efc6e6fd0971283ffd6a7b9f244ba53823c869149003f3b84b150b8` |
| `mestre/mestre-nivel-3.webp`             | 181 × 252 | 29196 | `0f2f2d0dcf8c420005b24b6ce4c552e10cc487bf258ebd0872b4c6eaada9ebcb` |
| `mestre/mestre-nivel-4.webp`             | 193 × 252 | 31518 | `00c5c61218207ad7e042f7c8d4702661df0b58f24e1832588fac201a49d1161c` |
| `sabio/sabio-nivel-1.webp`               | 180 × 252 | 27658 | `21f95fd12102e78dcb341a73eb724b2a4554ee23d5ed9ce832fe49a7ef8e9eeb` |
| `sabio/sabio-nivel-2.webp`               | 178 × 252 | 28378 | `831e0aedb4f4f0993733ed5ceed6eddc99f3203b30ee5d82029f496ef0be56f7` |
| `sabio/sabio-nivel-3.webp`               | 180 × 252 | 28700 | `09157ba32a83a86a3dbb2aaffbf8fe11b92501f08dce3b0dbaefab39fac208b8` |
| `sabio/sabio-nivel-4.webp`               | 175 × 252 | 29350 | `7c9b7096a3019d2d8c5de9ca73e93ee2ea69eff7215378a397a997d4c2b2ee58` |
