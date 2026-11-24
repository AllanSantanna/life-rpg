# Sistema de conquistas no Perfil: 24/11/2026

Branch: `feat/profile-achievements`, a partir de `chore/achievement-assets`
(`52fbd42`, que já continha os 55 assets preparados). Sem push, PR ou merge.

## Capturas

Dados sintéticos (370 dias de treino, leituras, sono e finanças), injetados pela
chave legada e importados pelo próprio app; nenhum dado real foi usado. A
notificação foi gerada por um registro real ("Treinou hoje? Sim") numa conta vazia.

| Tela                      | Arquivo                                                                          |
| ------------------------- | -------------------------------------------------------------------------------- |
| Início, desktop 1440      | [inicio-desktop-1440.jpg](assets/achievements/inicio-desktop-1440.jpg)           |
| Início, celular 390       | [inicio-mobile-390.jpg](assets/achievements/inicio-mobile-390.jpg)               |
| Perfil, desktop 1440      | [perfil-desktop-1440.jpg](assets/achievements/perfil-desktop-1440.jpg)           |
| Perfil, celular 390       | [perfil-mobile-390.jpg](assets/achievements/perfil-mobile-390.jpg)               |
| Notificação, desktop 1440 | [notificacao-desktop-1440.jpg](assets/achievements/notificacao-desktop-1440.jpg) |
| Notificação, celular 390  | [notificacao-mobile-390.jpg](assets/achievements/notificacao-mobile-390.jpg)     |

## Verificações manuais em Chromium

Largura do documento igual à viewport (sem rolagem horizontal) e nenhuma imagem
quebrada no Início e no Perfil em 320, 390, 768, 1024 e 1440 px. A notificação
fica acima do menu inferior no celular, sem alterá-lo.

`npm run audit:visual`, `audit:persistence` e `audit:pages` não foram executados
neste ambiente: o pacote `playwright` não está instalado e a instalação de pacotes
foi bloqueada. `node scripts/check-pages-build.mjs` foi executado após
`npm run build:pages` (178 arquivos, base `/life-rpg/`, 44 WebP no precache).
