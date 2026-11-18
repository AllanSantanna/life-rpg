# Checklist antes de finalizar

Marque como não aplicável com motivo quando o item não corresponder à tarefa.
Referências: [regras](development-rules.md), [fluxo de Git](git-workflow.md)
e [catálogo visual](../design-system/components.md).

- [ ] Consultei `AGENTS.md`, os guias pertinentes e o código equivalente.
- [ ] Verifiquei status, branch ativa, base atualizada e alterações preexistentes antes de editar.
- [ ] Desenvolvi fora da `main`, em branch com prefixo e nome descritivos para a tarefa.
- [ ] Preservei alterações anteriores, inclusive conteúdo staged e arquivos não rastreados.
- [ ] Respeitei o Design System e a identidade escura/vermelha, sem componentes duplicados desnecessários.
- [ ] O botão reutiliza o componente adequado e ações equivalentes têm o mesmo tamanho.
- [ ] Os espaçamentos usam tokens/escala existentes, sem ajustes arbitrários.
- [ ] As cores usam tokens ou as classes contextuais já existentes.
- [ ] Campos, rótulos, seletores e calendários seguem os controles compartilhados.
- [ ] Os cartões têm proporções e hierarquia coerentes com a tela correspondente.
- [ ] O layout funciona no celular e desktop, inclusive com texto longo e zoom.
- [ ] Teclado, foco, rótulos e movimento reduzido foram preservados.
- [ ] Estados de erro, carregamento, vazio e desabilitado são claros quando aplicáveis.
- [ ] A funcionalidade preserva dados existentes, migrações e falhas de gravação.
- [ ] Não modifiquei XP, Radar, níveis, classes ou Quests sem solicitação explícita.
- [ ] Executei testes pertinentes e `npm run check`; registrei falhas/limitações.
- [ ] Executei `npm run format:check` e `npm run standards:check`; registrei falhas/limitações.
- [ ] Executei `npm run audit:visual` para alterações visuais relevantes ou registrei o motivo de não execução.
- [ ] Não declarei testes aprovados sem execução nem enfraqueci testes ou validações.
- [ ] Revisei o diff sem desfazer alterações preexistentes.
- [ ] Revisei arquivos não rastreados relevantes e todo o staging; incluí somente mudanças da tarefa.
- [ ] Os commits locais criados usam Conventional Commits e estão separados por responsabilidade, com testes/documentação correspondentes.
- [ ] Não executei push, abertura de PR, merge/rebase ou exclusão de branches sem autorização explícita, nem comandos destrutivos ou force push.
- [ ] Atualizei a documentação caso o padrão oficial tenha mudado.
- [ ] O relatório final informa branch, arquivos, verificações/limitações, commits com hashes, estado final do Git e pendências.
