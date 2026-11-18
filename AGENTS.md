# Regras obrigatórias — Life RPG

Leia este arquivo antes de modificar o projeto. Ele vale para todo o repositório.
O índice oficial é [docs/README.md](docs/README.md).

1. Consulte a documentação pertinente à tarefa antes de implementar:
   [design system](docs/design-system/README.md),
   [arquitetura](docs/architecture/README.md) e
   [regras de desenvolvimento](docs/ai/development-rules.md).
2. Analise componentes e estilos existentes antes de criar novos. Reutilize
   componentes e tokens de cores, espaçamentos e tipografia; siga os padrões
   visuais documentados e preserve a identidade escura/vermelha do Life RPG.
3. Para ações primárias de tamanho padrão, use `ActionButton`. Para outros
   controles, consulte o [catálogo](docs/design-system/components.md).
   Não crie uma versão personalizada quando houver um componente adequado.
4. Consulte os tokens antes de definir espaçamentos. Não adicione cores literais
   quando houver token. Não crie dropdowns nativos sem justificativa documentada.
5. Não crie estilos diferentes para a mesma função nem altere regras globais
   para corrigir um problema isolado. Evite refatorações fora do escopo.
6. Preserve a arquitetura atual, os limites entre módulos e o TypeScript estrito.
   Evite dependências novas quando as ferramentas existentes forem suficientes.
   Não altere a estrutura do projeto sem justificativa técnica.
7. Preserve dados, validação, migrações e mecanismos de persistência.
   Não limpe storage nem redefina o jogador para corrigir um problema de interface.
   Não apague dados dos usuários e preserve compatibilidade com registros existentes.
8. Não modifique XP, Radar, níveis, classes ou Quests sem solicitação explícita.
9. Mantenha responsividade, navegação por teclado, rótulos e foco visível.
10. Execute as verificações pertinentes e relate falhas e limitações:
    `npm run standards:check`, `npm run typecheck`, `npm run lint`, `npm test`
    e `npm run build`; `npm run check` reúne esses passos.
    Priorize `npm run check`, `npm run format:check` e `npm run standards:check`.
    Para alterações visuais relevantes, execute também `npm run audit:visual`.
    Não declare testes aprovados sem executá-los nem enfraqueça testes para obter
    aprovação. Registre qualquer verificação não executada e seu motivo.
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

## Fluxo obrigatório de desenvolvimento e Git

Estas regras valem para todas as IAs que trabalharem neste repositório. Consulte
o [guia de Git](docs/ai/git-workflow.md) para comandos, situações com trabalho
local pendente e preparação da integração.

### Proteção da branch principal

- `main` representa a versão estável do Life RPG. Nunca implemente funcionalidades
  ou correções diretamente nela; use uma branch específica por funcionalidade
  ou conjunto de alterações relacionadas, inclusive documentação e manutenção.
- Não modifique o histórico da `main`. Não execute comandos Git destrutivos nem
  force push, incluindo `git push --force` e `git push --force-with-lease`.
- Preserve a `main` até que as alterações tenham sido verificadas e a integração
  tenha autorização explícita.

### Preparação e branches

- Antes de desenvolver, leia `AGENTS.md` e a documentação pertinente; execute
  `git status`, identifique a branch ativa e confira alterações locais e arquivos
  não rastreados. Preserve todo trabalho preexistente.
- Parta da versão atualizada da `main` somente quando isso puder ser feito sem
  sobrescrever trabalho local. Se houver divergência ou atualização que exija
  merge/rebase, relate e obtenha autorização antes dessa operação.
- Cada branch deve ter finalidade clara e nome descritivo:
  `feat/nome-da-funcionalidade`, `fix/nome-da-correcao`,
  `refactor/nome-da-refatoracao`, `docs/nome-da-documentacao` ou
  `chore/nome-da-manutencao`. Exemplo: `docs/update-development-rules`.

### Commits organizados

- Utilize Conventional Commits, como `feat(workouts): add workout import improvements`,
  `fix(ui): correct mobile button spacing` e `docs(agents): document git workflow`.
- Separe commits por funcionalidade ou responsabilidade; não misture mudanças
  independentes em commits gigantes. Inclua os testes e a documentação correspondentes.
- Faça staging seletivo por arquivo e por trecho quando houver responsabilidades
  diferentes no mesmo arquivo. Revise o conteúdo staged antes de cada commit.
- Não crie commits vazios ou artificiais nem inclua automaticamente alterações
  preexistentes que não pertençam à tarefa.

### Publicação, integração e encerramento

- Não execute `git push`, abra Pull Requests, faça merge/rebase ou exclua branches
  sem autorização explícita para a operação. Force push permanece proibido.
- Autorização para implementar uma funcionalidade não autoriza publicar ou
  integrar código. Prepare o resultado local, apresente-o e aguarde autorização
  para publicar ou integrar à `main`.
- Antes de finalizar, revise o diff, os arquivos não rastreados e os checklists.
  Informe no relatório final a branch, as verificações e limitações, os commits
  criados (com hashes), o estado final do Git e eventuais pendências.
