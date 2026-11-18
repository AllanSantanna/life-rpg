# Checklist de revisão

Use a [arquitetura atual](../architecture/README.md), o
[design system](../design-system/README.md) e as
[regras de desenvolvimento](development-rules.md) e o
[fluxo de Git](git-workflow.md) como referência.

- [ ] O escopo atende ao pedido e não inclui refatoração visual ou dependências sem motivo.
- [ ] A tarefa foi desenvolvida fora da `main`, em branch com prefixo e nome adequados e base verificada.
- [ ] Alterações preexistentes, conteúdo staged e arquivos não rastreados foram preservados.
- [ ] O Design System e a identidade escura/vermelha foram respeitados.
- [ ] A implementação reutiliza componentes e não cria uma cópia para a mesma função.
- [ ] Tokens novos têm origem/finalidade documentada; não existem cores ou medidas isoladas desnecessárias.
- [ ] Ações equivalentes têm dimensões, ícones, alinhamento e estados consistentes.
- [ ] Campos, cartões, navegação e gráficos preservam os padrões do seu contexto.
- [ ] O layout foi inspecionado em celular/desktop ou a limitação visual está explícita.
- [ ] Rótulos, teclado, foco, erros, vazio e carregamento estão corretos.
- [ ] Comandos/projeções continuam nos módulos certos; compartilhados não gravam estado de domínio.
- [ ] Dados, storage, migrações e histórico foram preservados; sem resets ou recompensas novas implícitas.
- [ ] As verificações pertinentes foram executadas, incluindo `npm run check`, `npm run format:check` e `npm run standards:check`, com resultados e limitações registrados.
- [ ] A auditoria visual foi executada para alterações visuais relevantes ou a limitação foi registrada com motivo.
- [ ] O estado do CI foi conferido quando disponível; execução local não foi apresentada como aprovação do CI remoto.
- [ ] Falhas anteriores foram identificadas com evidência; testes não foram enfraquecidos nem apresentados como aprovados sem execução.
- [ ] Supressões de lint são pontuais, justificadas e não escondem novas inconsistências.
- [ ] Links e guias foram atualizados junto de qualquer mudança oficial de padrão.
- [ ] Diff, staging e arquivos não rastreados relevantes foram revisados; commits incluem somente mudanças da tarefa e usam Conventional Commits por responsabilidade.
- [ ] Não houve push, abertura de PR, merge/rebase ou exclusão de branches sem autorização explícita, nem comandos destrutivos ou force push.
- [ ] O relatório final informa branch, arquivos alterados, verificações/limitações, commits com hashes, estado final do Git e pendências.

Não aprove apenas pela aparência de um trecho isolado ou pelo sucesso do build.
Compare controles equivalentes e confira se a alteração afeta outras telas por
cascata CSS. Os limites das automações estão nas regras de desenvolvimento.
