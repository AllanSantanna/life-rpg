# Convenções de implementação

Referências de organização: [App](../../apps/web/src/app/App.tsx),
[RecordUI](../../apps/web/src/modules/records/RecordUI.tsx),
[commands](../../apps/web/src/modules/records/commands.ts) e
[CustomSelect](../../apps/web/src/shared/components/CustomSelect.tsx).

- Componentes e páginas: PascalCase, arquivos `.tsx`, exports nomeados.
- Hooks: `use` + nome em camelCase, arquivos `.ts` quando não houver JSX.
- Funções/variáveis: camelCase; tipos/interfaces: PascalCase;
  constantes de contrato como `PLAYER_STORAGE_VERSION`: SCREAMING_SNAKE_CASE.
- Componentes React funcionais e props tipadas. `import type` para tipos;
  sem `any`, `@ts-ignore` ou casts para contornar validação de dados externos.
- Tipos de domínio ficam no módulo (`types.ts` quando já houver esse padrão).
  Comandos usam uniões discriminadas por `type`; funções puras retornam estado
  novo e validam antes de aplicar alterações.
- Preserve `strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`.
  A ausência de campo não equivale necessariamente a `undefined` ou estado vazio.
- Estado temporário de formulário/filtro fica local quando não precisa persistir.
  Estado do jogador permanece em `PlayerState`; projeções não viram acumuladores.
- `shared` recebe implementações sem regras de domínio realmente reutilizáveis.
  `Field`/`RecordForm` continuam em `records`; não mova caminhos públicos sem necessidade.
- Utilitários de domínio ficam junto do domínio (`monetary.ts`, `calculations.ts`,
  `rotation.ts`); datas civis compartilhadas estão em `shared/dates`.
  Não crie uma pasta global de serviços vazios.
- Não misture funções utilitárias exportadas e componentes no mesmo `.tsx`;
  o ESLint de React Refresh verifica esse limite. Tipos podem acompanhar componentes.
- UI é em pt-BR. Mantenha identificadores e comandos no idioma já usado pelo código.
- Datas civis usam ISO e helpers existentes; não converta para UTC indiscriminadamente.
  Finanças usa unidades inteiras e utilitários monetários, não floats improvisados.
- Use os testes próximos da mudança. Cubra comportamento, dados e regressões
  relevantes; evite testes que apenas repitam JSX ou classes CSS.
- Não adicione dependência sem necessidade concreta. Reutilize React, SVG,
  Tailwind, Vitest e os controles existentes antes de introduzir outra biblioteca.

CSS compartilhado permanece em `shared/styles/index.css`; a importação de treino
também possui [importing.css](../../apps/web/src/modules/workouts/advanced/importing/importing.css)
para regras locais. Prefira classes com contexto claro, sem seletores globais
como `button { width: ... }` para resolver um único controle.

Há exceções históricas e arquivos extensos; documentá-los não autoriza uma
reorganização geral. Preserve alterações locais que já existiam antes da tarefa
e não formate arquivos alheios apenas para reduzir diferenças de estilo.
