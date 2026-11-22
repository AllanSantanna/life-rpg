# Fluxo obrigatório de desenvolvimento e Git

Este guia detalha as regras de [AGENTS.md](../../AGENTS.md) para todas as IAs.
Consulte também as [regras de desenvolvimento](development-rules.md), os
checklists de [implementação](feature-checklist.md) e [revisão](review-checklist.md).
`main` é a versão estável: funcionalidades, correções, documentação e manutenção
devem ser desenvolvidas em branches específicas.

## Iniciar uma tarefa

Leia as regras, a documentação do domínio e o código relacionado antes de editar.
Inspecione o estado do repositório, incluindo arquivos não rastreados:

```bash
git status --short --branch
git status --porcelain=v1 --untracked-files=all
git branch --show-current
git branch -vv
git remote -v
```

Registre a branch inicial e as alterações preexistentes. Não conclua que a árvore
está limpa apenas porque o diff não mostra arquivos novos: confira o status.

Para verificar o remoto sem publicar nem integrar código:

```bash
git ls-remote --symref origin HEAD refs/heads/main
git fetch origin
git rev-list --left-right --count main...origin/main
```

`fetch` atualiza referências remotas, sem aplicar mudanças à árvore de trabalho.
Compare o hash remoto com as referências locais; `0 0` no último comando indica
que `main` e `origin/main` coincidem após o fetch. A ausência de `origin/HEAD`
local não comprova qual é a branch principal; consulte o HEAD remoto.
Se o remoto não puder ser consultado, registre a limitação e não declare a
sincronização confirmada.

Com a árvore limpa, confirme que a referência usada está atualizada e crie a
branch a partir da `main` ou de `origin/main`. Se a `main` local estiver apenas
atrasada, é possível partir de `origin/main` sem integrar nada à `main` local.
Se houver commits locais exclusivos ou divergência, investigue e relate antes
de escolher a base; não descarte commits nem faça merge/rebase automaticamente.
Atualizar a `main` com merge, mesmo fast-forward, exige autorização explícita.

## Alterações locais pendentes

- Inspecione `git diff` e `git diff --cached` e identifique a origem das mudanças.
  Preserve arquivos modificados, staged e não rastreados; não os inclua na tarefa
  por conveniência.
- Criar uma branch no HEAD atual mantém mudanças locais, mas só use essa opção
  se a base e o escopo forem adequados. Isso não separa as mudanças anteriores.
- Se for necessário partir de outra base com trabalho pendente, prefira uma
  árvore isolada via `git worktree add -b docs/nome-da-tarefa ../life-rpg-tarefa origin/main`,
  usando um caminho novo e permitido no ambiente. Preserve a árvore original.
- Não use stash, commits de trabalho alheio ou descarte automático para limpar
  o estado. Se não houver separação segura, relate a situação e obtenha orientação.
- Se mudanças da tarefa e anteriores se sobrepuserem no mesmo trecho, não tente
  separá-las apagando trabalho. Relate o conflito de escopo antes de preparar o commit.

## Criar branches

Use nomes descritivos e uma finalidade por branch:

| Prefixo     | Finalidade     | Exemplo                         |
| ----------- | -------------- | ------------------------------- |
| `feat/`     | Funcionalidade | `feat/workout-voice-import`     |
| `fix/`      | Correção       | `fix/workout-import-matching`   |
| `refactor/` | Refatoração    | `refactor/finance-components`   |
| `docs/`     | Documentação   | `docs/update-development-rules` |
| `chore/`    | Manutenção     | `chore/update-tooling`          |

Confira antes se o nome já existe localmente ou em `origin`, com
`git branch --list` e `git branch -r`. Não reutilize uma branch de outra tarefa
sem verificar a finalidade e seu conteúdo.

Exemplo, com árvore limpa e `origin/main` verificada:

```bash
git switch -c docs/update-development-rules origin/main
git branch --show-current
git status --short --branch
```

Implemente somente o escopo solicitado, respeitando o
[design system](../design-system/README.md), a
[arquitetura](../architecture/README.md), os dados e a persistência existentes.

## Validar e revisar

Antes de considerar a implementação concluída, execute as verificações
disponíveis e pertinentes:

```bash
npm run check
npm run format:check
npm run standards:check
```

`check` reúne padrões, TypeScript, lint, testes e build; `standards:check` pode
também ser executado isoladamente para retorno rápido sobre documentação e tokens.
Para alterações visuais relevantes, execute ainda `npm run audit:visual`, conforme
as [instruções e limites](../design-system/responsive.md).
Não declare aprovação sem execução. Registre comandos, falhas, limitações do
ambiente e verificações não aplicáveis com motivo. Se `check` parar em um erro,
não considere os passos seguintes executados. Não enfraqueça testes ou validações
para obter aprovação nem formate arquivos alheios à tarefa.

Revise também o conteúdo e os arquivos novos:

```bash
git diff --check
git diff --stat
git diff
git status --short --untracked-files=all
```

Use os dois checklists. Confira se existem mudanças fora de escopo, dados
apagados, arquivos relevantes não rastreados ou documentação desatualizada.
Os testes locais não comprovam que o CI remoto passou.

## Staging seletivo e commits

Agrupe mudanças relacionadas à mesma responsabilidade, incluindo seus testes e
documentação. Não misture funcionalidades independentes. Use caminhos explícitos
e `git add -p` quando um arquivo contiver mudanças de responsabilidades diferentes:

```bash
git add docs/ai/git-workflow.md
git add -p AGENTS.md
git diff --cached --check
git diff --cached --stat
git diff --cached
```

No modo interativo, `y` inclui o trecho, `n` o preserva fora do staging, `s`
divide um trecho quando possível e `q` encerra. Arquivos novos podem ser adicionados
por caminho; leia seu conteúdo antes de incluí-los. Evite staging indiscriminado
com `git add .` ou `git add -A`. Se já havia conteúdo staged alheio à tarefa,
isole o trabalho em outra árvore ou obtenha orientação antes de fazer um commit;
o commit padrão inclui todo o índice.

Utilize Conventional Commits no formato `tipo(escopo): descrição`, com escopo
opcional e descrição objetiva. Exemplos:

```text
feat(workouts): add workout import improvements
fix(ui): correct mobile button spacing
docs(agents): document git workflow
refactor(finances): reuse shared components
test(workouts): cover exercise matching
```

A mensagem de commit não leva `Co-Authored-By` do Claude nem outro crédito
automático de ferramenta de IA. O autor é o responsável pela alteração, com o
nome e o e-mail do `git config`; não altere `user.name`/`user.email` nem use
`--author` para atribuir commits a outra pessoa. Antes de publicar, confirme:

```bash
git log --format='%an <%ae>%n%(trailers:key=Co-authored-by)' origin/main..HEAD
```

Não crie commits vazios ou artificiais. Depois de conferir todo o staging, faça o
commit local correspondente à tarefa, sem incluir mudanças preexistentes alheias.
Exemplo para esta atualização das regras:

```bash
git commit -m "docs(agents): establish mandatory git workflow"
git log -1 --format='%h %s'
git show --stat HEAD
git status --short --branch
```

## Preparar um Pull Request

Prepare localmente título e descrição para revisão: problema, comportamento
resultante, escopo, verificações realmente executadas e limitações. Compare a
branch com a base atualizada usando `git diff origin/main...HEAD` e
`git log --oneline origin/main..HEAD`. Confirme que não há commits de outras tarefas.
Não abra o PR nem publique a branch sem autorização explícita para cada operação.
Autorização para implementar ou criar commits locais não autoriza push ou PR.

No relatório final, informe branch e base, arquivos alterados, verificações,
commits com hashes, estado do Git, trabalho preexistente preservado e pendências.
Apresente o resultado local e aguarde autorização para publicação ou integração.

## Integrar à main somente com autorização

Publicar, abrir PR, integrar e excluir branch são operações distintas; não deduza
autorização para uma a partir de outra. Não faça merge ou rebase, em qualquer
branch, sem autorização explícita. Force push permanece proibido.

Após a autorização correspondente, confira novamente remoto, branch, status,
diff, commits e verificações. Para publicar, use push normal da branch da tarefa;
se for rejeitado, investigue sem forçar. Abra o PR com base `main` somente quando
autorizado. Integre apenas alterações verificadas, com revisão e CI conferidos,
pelo fluxo aprovado no repositório. Não implemente correções diretamente na `main`.
Se a integração exigir resolver conflitos, faça isso na branch da tarefa dentro
do escopo autorizado, revise e repita as verificações afetadas.

Uma atualização local da `main` já integrada no remoto pode usar
`git merge --ff-only origin/main` somente com autorização, árvore limpa e sem
divergência. Se o fast-forward falhar, relate e preserve os commits existentes.
Não apague branches sem autorização específica.

## Evitar operações destrutivas

Não reescreva o histórico da `main` nem execute comandos destrutivos, como
`git reset --hard`, `git clean -fd`/`-fdx`, `git checkout -- .`, `git restore .`
para descartar trabalho ou exclusão forçada de branches. Não use
`git push --force`, `git push -f`, `git push --force-with-lease` nem outras opções
que forcem a atualização do remoto. Não reescreva commits publicados.

Não automatize limpeza de storage, reset do jogador, descarte de arquivos ou
alteração de permissões remotas para contornar um problema. As instruções são
regras de trabalho; proteção técnica da branch depende da configuração no GitHub
e não é estabelecida por este documento. O CI existente valida código, mas não
garante leitura das regras ou autorização humana para operações Git.
