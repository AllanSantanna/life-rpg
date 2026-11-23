# Anatomia incorporada do MuscleMap

Fonte: [Jsplice/MuscleMap](https://github.com/Jsplice/MuscleMap), snapshot
`170cfac`, obtido em 20/11/2026 pelo arquivo público do GitHub. Copyright
2026 Jsplice / MuscleMap contributors. Licença MIT integral em [LICENSE](LICENSE).
O aviso também acompanha o build em `public/licenses/musclemap.txt`.

Arquivos originais:

- `packages/assets/src/male-front.ts` e `male-back.ts`: coordenadas de contorno e
  superfícies, traçadas originalmente no Inkscape pelo projeto de origem.
- `packages/assets/bodies/male-front.webp` e `male-back.webp`: bases em tons de
  cinza, geradas com ferramentas de imagem OpenAI e editadas pelo mantenedor.
- [Procedência declarada pelo autor](UPSTREAM_PROVENANCE.md), preservada aqui.

Adaptações locais: extração apenas de contornos, grupos, IDs e coordenadas para
`front.ts` / `back.ts`; tipos locais imutáveis, sem importações de pacotes.
Os IDs duplicados de duas superfícies do trapézio traseiro ganharam sufixo `_2`.
Duas regiões distais de quadríceps sem ID receberam
`QUADRICEPS_DISTAL_LEFT` / `RIGHT`. Todas as 58 superfícies foram preservadas.
As coordenadas e as duas bases WebP não foram redesenhadas. Sem assets femininos,
layout, dados de demonstração, escalas ou algoritmo de treinamento da biblioteca.

## Escolha de integração

`@musclemap/assets` contém os dados necessários. `@musclemap/core` acrescentaria
escalas, enums e agrupamentos que não correspondem ao domínio atual. O renderer
`@musclemap/react` traria interação e apresentação próprias. Incorporamos somente
os dados estáticos necessários, aproximadamente 250 KB antes da compressão,
sem novas dependências npm, rede em runtime ou sincronização automática de versões.
Atualizações exigem repetir a revisão da licença e do mapeamento, conferindo cada
ID e sua vista. A origem usa `side: CENTER` para todas as superfícies incorporadas:
não se deve espelhá-las uma segunda vez.

## Limite visual

As superfícies são contornos orgânicos amplos sobre bases detalhadas. Não contêm
a microestrutura de fibras vermelhas da referência aprovada. Sombras, textura de
luminância, tons vermelhos e seleção são renderizados pelo Life RPG. Não usamos
recorte do mockup, cenário de terceiros nem alegamos equivalência anatômica clínica.
