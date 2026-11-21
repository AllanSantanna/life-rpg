# Fluxo obrigatório de desenvolvimento

Ponto de entrada: [AGENTS.md](../../AGENTS.md). Índices:
[design system](../design-system/README.md) e [arquitetura](../architecture/README.md).

## Fluxo de Git obrigatório

Siga o [guia de Git](git-workflow.md) em toda tarefa: verifique status, branch,
sincronização e trabalho preexistente; desenvolva em uma branch específica fora
da `main`; organize commits por responsabilidade com Conventional Commits.
Preserve alterações anteriores e revise arquivos não rastreados e staging.
Push, abertura de PR, merge/rebase e exclusão de branches exigem autorização
explícita para a operação; implementar não autoriza publicar ou integrar.
Não execute comandos Git destrutivos nem force push. O relatório final deve
informar branch, commits com hashes, estado do Git e pendências.

## Antes e durante a implementação

1. Leia as regras e o README do domínio. Inspecione o código vigente, incluindo
   os overrides de CSS e o estado do Git; não reverta trabalho já existente.
2. Localize componente e fluxo equivalentes. Defina o menor escopo necessário.
3. Reutilize componentes, tokens e comandos. Preserve dados e os limites entre módulos.
4. Para um novo padrão, registre uso e motivo no documento correspondente. Não
   crie um padrão apenas para justificar uma exceção visual isolada.
5. Não altere XP, Radar, níveis, classes ou Quests sem solicitação explícita.
6. Teste a regra ou regressão relevante e revise o layout responsivo e acessível.
7. Use o [checklist de funcionalidade](feature-checklist.md) e relate o resultado
   das verificações, incluindo o que não pôde ser executado, e o estado final do Git.

## Verificações disponíveis

| Comando                   | Garantia automática                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run standards:check` | Estrutura da documentação, links locais dos guias oficiais e tokens `--color-*` referenciados em arquivos CSS do web |
| `npm run typecheck`       | TypeScript estrito de todos os workspaces                                                                            |
| `npm run lint`            | ESLint, hooks, React Refresh e proteções visuais de JSX                                                              |
| `npm test`                | Testes das validações e suítes dos workspaces                                                                        |
| `npm run build`           | Compilação das aplicações e geração da PWA                                                                           |
| `npm run check`           | Todos os passos acima, interrompendo no primeiro erro                                                                |
| `npm run format:check`    | Formatação Prettier do repositório; não reescreve arquivos                                                           |
| `npm run audit:visual`    | Auditoria responsiva em Chromium, medidas de geometria e capturas para revisão                                       |

Priorize `npm run check`, `npm run format:check` e `npm run standards:check`.
Para alterações visuais relevantes, execute também `npm run audit:visual`.
Não declare testes aprovados sem executá-los; se um comando falhar ou não puder
ser executado, registre a limitação e os passos que não chegaram a rodar.
Não enfraqueça testes nem desative validações para obter aprovação. Falhas
preexistentes devem ser identificadas com evidência, sem mudanças fora do escopo.

O [CI](../../.github/workflows/quality.yml) executa `npm ci`, `npm run check` e `npm run format:check` em
push e pull request. A configuração de proteção da branch depende do repositório
remoto; este projeto não altera essas permissões automaticamente. Um job separado
executa `npm run audit:visual`, com ferramentas temporárias de navegador e
artefatos para revisão. A [execução e os limites](../design-system/responsive.md)
desse comando são diferentes dos testes jsdom.

## Proteções visuais aplicadas pelo ESLint

A regra local `design-system/no-visual-drift`, definida em
[design-system.mjs](../../scripts/eslint/design-system.mjs), impede no código TSX:

- Novos `<select>` nativos; reutilize `CustomSelect`.
- `input type="date"` / `type="month"` literais; reutilize `CustomDatePicker`.
- `input type="time"` literal; reutilize `CustomTimePicker`.
- Literais hex e funções RGB/HSL/OKLCH etc. dentro de `style`.
- Utilitários Tailwind de cores arbitrárias, como `bg-[#123456]`.
- Botões nativos sem `type` explícito; `ActionButton` mantém seu default seguro.

Valores dinâmicos de geometria de gráficos/popovers e `var(--token)` são aceitos.
Não há bloqueio indiscriminado de `style` nem obrigação de converter todos os
elementos existentes em componentes novos.

O seletor compacto de tipo de série tem uma única dispensa local justificada
em `SessionPanel`. Exceções futuras exigem motivo no código, documentação e
revisão; não desative a regra para todo um módulo.

## O que continua dependendo de revisão

Não há comparação automática de screenshots, auditoria completa de contraste,
detecção de todo valor CSS arbitrário ou análise de todas as expressões dinâmicas.
As verificações não entendem se duas ações deveriam ter a mesma largura nem
garantem que um agente leu os documentos. Classes, cores nomeadas, valores em
variáveis JS e mudanças de CSS precisam de revisão semântica.

Os tokens e `ActionButton` reduzem divergências diretamente; TypeScript impede
`className`/`style` na API desse botão. Medidas de gráficos, percentuais,
geometria de popovers e diferenças legítimas entre controles não devem ser
barradas por uma proibição global de números.

Validar visualmente celular/desktop, texto longo, vazio, erro, foco e desabilitado
quando houver alteração de UI. Sem navegador disponível, relate essa limitação;
testes jsdom não comprovam alinhamento ou igualdade de tamanho renderizado.
Uma exceção legítima deve ser explícita, pequena e revisável.
