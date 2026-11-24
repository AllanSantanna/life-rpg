# Assets de conquistas

Etapa de preparação: os arquivos existem, mas **nenhuma tela os utiliza ainda**.
O sistema de conquistas, XP, níveis, classes, Quests, Radar e a persistência não
foram alterados.

## Localização

`apps/web/public/assets/achievements/`

| Pasta       | Conteúdo                                                        |
| ----------- | --------------------------------------------------------------- |
| `frames/`   | Molduras por raridade (`frame-<raridade>`)                      |
| `badges/`   | Medalhas genéricas por raridade (`badge-<raridade>`)            |
| `icons/`    | Ícones dos pilares, de Quests e especiais (`icon-<chave>`)      |
| `ui/`       | Indicadores de estado: bloqueada, aberta, progresso, concluída… |
| `specific/` | Medalhas prontas por pilar (`achievement-<pilar>-<nn>`)         |
| `effects/`  | Efeitos de desbloqueio, brilho, partículas, nível e louros      |
| `labels/`   | Etiquetas de raridade com texto em português na própria arte    |
| `decor/`    | Estandarte, louros e gema vermelha                              |
| `previews/` | Prancha original, pré-visualização local e relatório técnico    |

Cada asset tem `.webp` (uso na interface) e `.png` (sem perdas, para edição),
com o mesmo nome. O [manifesto](../../apps/web/public/assets/achievements/manifest.json)
registra id, nome, categoria, raridade, pilar, dimensões, bytes, SHA-256, estado
(`ready`, `review`, `regenerate`), observações e a área de origem na prancha.

Raridades: `common`, `uncommon`, `rare`, `epic`, `legendary`. Paleta de
referência da prancha (não são tokens do tema): `#8B6A4A`, `#2E7D32`, `#2563EB`,
`#7C3AED`, `#D4AF37`. As medalhas específicas usam a cor do pilar, não a da
raridade: Treinos vermelho, Conhecimento dourado, Finanças verde e Descanso roxo.

## Limites de qualidade

- A origem é uma prancha artística de 1536 × 1024 px, não um spritesheet. Os
  assets mantêm a resolução nativa (cerca de 70 a 160 px), sem ampliação:
  use-os até aproximadamente metade da largura em px CSS em telas 2x (por
  exemplo, até ~72 px CSS para uma medalha de 145 px). Tamanhos maiores exigem
  geração individual com fundo transparente.
- Assets `review` têm halo leve do brilho original, visível só sobre fundos
  claros, ou alfa reconstruído (efeitos luminosos). Sobre os fundos escuros do
  Life RPG, reproduzem a prancha.
- O castelo com lua vermelha não foi extraído: é cenário pintado sobre o painel.

## Regenerar e validar

```bash
npm run audit:achievement-assets   # validação, sem navegador
node scripts/achievement-assets/extract.mjs [prancha.png]
node scripts/achievement-assets/build-manifest.mjs
```

A extração usa o Chromium instalado pelo Playwright apenas para codificar WebP
(`CHROMIUM_EXECUTABLE` substitui a detecção automática). O inventário, as áreas
de busca e a revisão visual ficam em
[assets.config.mjs](../../scripts/achievement-assets/assets.config.mjs); a
validação nunca promove um estado. Abra
`previews/achievements-contact-sheet.html` diretamente no navegador para
comparar cada asset com a prancha sobre preto, cinza e quadriculado.

A pasta inteira está em `globIgnores` do Workbox ([vite.config.ts](../../apps/web/vite.config.ts)):
nada entra no precache da PWA enquanto não houver uso. Na integração, inclua
apenas os WebP efetivamente usados, de preferência importados pelo módulo.
