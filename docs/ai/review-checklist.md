# Checklist de revisão

Use a [arquitetura atual](../architecture/README.md), o
[design system](../design-system/README.md) e as
[regras de desenvolvimento](development-rules.md) como referência.

- [ ] O escopo atende ao pedido e não inclui refatoração visual ou dependências sem motivo.
- [ ] A implementação reutiliza componentes e não cria uma cópia para a mesma função.
- [ ] Tokens novos têm origem/finalidade documentada; não existem cores ou medidas isoladas desnecessárias.
- [ ] Ações equivalentes têm dimensões, ícones, alinhamento e estados consistentes.
- [ ] Campos, cartões, navegação e gráficos preservam os padrões do seu contexto.
- [ ] O layout foi inspecionado em celular/desktop ou a limitação visual está explícita.
- [ ] Rótulos, teclado, foco, erros, vazio e carregamento estão corretos.
- [ ] Comandos/projeções continuam nos módulos certos; compartilhados não gravam estado de domínio.
- [ ] Dados, storage, migrações e histórico foram preservados; sem resets ou recompensas novas implícitas.
- [ ] As suítes e o CI passaram; falhas anteriores foram identificadas com evidência.
- [ ] Supressões de lint são pontuais, justificadas e não escondem novas inconsistências.
- [ ] Links e guias foram atualizados junto de qualquer mudança oficial de padrão.

Não aprove apenas pela aparência de um trecho isolado ou pelo sucesso do build.
Compare controles equivalentes e confira se a alteração afeta outras telas por
cascata CSS. Os limites das automações estão nas regras de desenvolvimento.
