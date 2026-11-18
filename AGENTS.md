# Regras obrigatórias — Life RPG

Leia este arquivo antes de modificar o projeto. Ele vale para todo o repositório.
O índice oficial é [docs/README.md](docs/README.md).

1. Consulte a documentação pertinente à tarefa antes de implementar:
   [design system](docs/design-system/README.md),
   [arquitetura](docs/architecture/README.md) e
   [regras de desenvolvimento](docs/ai/development-rules.md).
2. Analise componentes e estilos existentes antes de criar novos. Reutilize
   componentes e tokens; siga os padrões visuais documentados.
3. Para ações primárias de tamanho padrão, use `ActionButton`. Para outros
   controles, consulte o [catálogo](docs/design-system/components.md).
   Não crie uma versão personalizada quando houver um componente adequado.
4. Consulte os tokens antes de definir espaçamentos. Não adicione cores literais
   quando houver token. Não crie dropdowns nativos sem justificativa documentada.
5. Não crie estilos diferentes para a mesma função nem altere regras globais
   para corrigir um problema isolado. Evite refatorações fora do escopo.
6. Preserve a arquitetura atual, os limites entre módulos e o TypeScript estrito.
   Evite dependências novas quando as ferramentas existentes forem suficientes.
7. Preserve dados, validação, migrações e mecanismos de persistência.
   Não limpe storage nem redefina o jogador para corrigir um problema de interface.
8. Não modifique XP, Radar, níveis, classes ou Quests sem solicitação explícita.
9. Mantenha responsividade, navegação por teclado, rótulos e foco visível.
10. Execute as verificações pertinentes e relate falhas e limitações:
    `npm run standards:check`, `npm run typecheck`, `npm run lint`, `npm test`
    e `npm run build`; `npm run check` reúne esses passos.
11. Atualize a documentação quando alterar um padrão oficial. Não desative
    validações para acomodar uma inconsistência; justifique exceções locais.
12. Antes de finalizar, use os checklists de
    [implementação](docs/ai/feature-checklist.md) e
    [revisão](docs/ai/review-checklist.md).

**Prioridade:** em caso de conflito entre uma implementação nova e os padrões
documentados, preserve o padrão existente, salvo quando a tarefa solicitar
explicitamente sua alteração. Uma instrução explícita do usuário prevalece
sobre estas convenções. Divergências entre código e documentação devem ser
apontadas e resolvidas no menor escopo possível.
