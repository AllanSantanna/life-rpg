# Personagens de fantasia sombria: 24/11/2026

Branch: `feat/dark-fantasy-characters`, derivada de `feat/profile-achievements`
(`b6f47df`, com as conquistas preservadas). Sem push, PR ou merge.

## O que mudou

- As 24 cartas (6 classes × 4 estágios) foram extraídas da prancha sem textos
  ([`characters-sheet.png`](../../apps/web/src/modules/profile/assets/previews/characters-sheet.png),
  1448 × 1086, segunda versão), na mesma ordem da prancha rotulada aprovada. A
  quarta linha da prancha (alternativas de Sábio e Mestre) não foi escolhida. Ficam em
  [`assets/cards`](../../apps/web/src/modules/profile/assets/cards/README.md) e servem ao
  retrato (Início e Perfil) e à galeria de classes.
- A arte pixelada (retratos e cartas) foi movida para `assets/legacy/`, fora do
  bundle, até a aprovação definitiva.
- Classe, XP, nível, estágio e as regras de classificação não foram alterados:
  só `portraits.ts`/`classCards.ts` (seleção da imagem) e o CSS de enquadramento.

## Estados

20 `ready` e 4 `review` (halo tênue do brilho fora da moldura, só sobre fundos
claros: Guerreiro, Estrategista, Guardião e Mestre IV; na arte, o Guerreiro IV tem
moldura dourada). A segunda prancha corrigiu as mãos de Estrategista I e III e
Sábio I e II, antes marcadas como `regenerate`.

## Capturas

Dados sintéticos (Guerreiro, nível 34, estágio IV), importados pelo próprio app.

| Tela                       | Arquivo                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início, desktop e celular  | [desktop](assets/characters/inicio-desktop-1440.jpg) · [390 px](assets/characters/inicio-mobile-390.jpg)                                                                                                                                                                                                                                                                                |
| Perfil, desktop e celular  | [desktop](assets/characters/perfil-desktop-1440.jpg) · [390 px](assets/characters/perfil-mobile-390.jpg)                                                                                                                                                                                                                                                                                |
| Galeria das seis classes   | [desktop](assets/characters/galeria-desktop-1440.jpg) · [390 px](assets/characters/galeria-mobile-390.jpg)                                                                                                                                                                                                                                                                              |
| Quatro estágios por classe | [Aventureiro](assets/characters/aventureiro-estagios-desktop.jpg) · [Guerreiro](assets/characters/guerreiro-estagios-desktop.jpg) · [Estrategista](assets/characters/estrategista-estagios-desktop.jpg) · [Guardião](assets/characters/guardiao-estagios-desktop.jpg) · [Sábio](assets/characters/sabio-estagios-desktop.jpg) · [Mestre](assets/characters/mestre-estagios-desktop.jpg) |

## Verificações manuais em Chromium

Sem rolagem horizontal e sem imagens quebradas no Início, no Perfil e na galeria em
320, 390, 768, 1024 e 1440 px. As alturas do Início e do Perfil no desktop ficaram
idênticas às anteriores à troca (1482 e 4354 px).

`npm run audit:visual`, `audit:persistence` e `audit:pages` não foram executados: o
pacote `playwright` não está instalado e a instalação de pacotes foi bloqueada. O
`audit-pages` foi atualizado para verificar as 24 cartas (antes, 48 artes) e teve
a sintaxe validada; `node scripts/check-pages-build.mjs` passou após
`npm run build:pages`, com as 24 cartas no build e nenhuma arte legada.
