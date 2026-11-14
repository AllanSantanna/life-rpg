# Arquitetura

## Organização

Monorepo npm workspaces, com `apps/web`, `apps/api` e `packages/contracts`. TypeScript estrito, com base compartilhada em `tsconfig.base.json`; compilação e resolução de módulos específicas por aplicação. ESLint e Prettier ficam na raiz. Dependências são fixadas pelo `package-lock.json`.

O backend é um monólito modular Express. Os módulos reservados são auth, profile, missions, gamification, finances, workouts e rest. Não há dependência de banco na inicialização. `GET /health` verifica somente se o processo HTTP está respondendo; não é um teste de disponibilidade do PostgreSQL.

O frontend usa React, Vite e Tailwind CSS. Cada domínio terá páginas e componentes locais quando necessário. `shared` recebe somente elementos realmente reutilizados. A composição da aplicação pertence a `app`.

## Evolução dos módulos

Adicionar rotas/controladores, serviços de aplicação, validações e repositórios conforme surgirem casos de uso. Controladores tratam HTTP; serviços coordenam regras; repositórios isolam persistência. Evitar acesso direto a tabelas de outro módulo. A comunicação entre domínios usará serviços públicos e, se necessário no futuro, eventos internos.

Gamification é o único responsável por XP, níveis, atributos e conquistas. Goals coordena objetivos personalizados; Missions no frontend mantém somente compatibilidade de confirmações históricas. Profile guarda apresentação e preferências, sem duplicar estado de progressão.

`packages/contracts` está preparado para contratos públicos de requisição/resposta, sem exportar entidades Prisma ou segredos. Ainda não é consumido pelas aplicações, pois não há contratos de negócio. Quando houver consumo em execução, compilar contracts antes dos consumidores e declarar a dependência no workspace.

## Banco de dados

PostgreSQL local via Docker Compose, porta vinculada apenas a localhost e volume persistente. Prisma 7 está preparado para evolução do schema; não há modelos, generator, cliente inicializado, tabelas de usuários ou migrações. Antes da primeira funcionalidade persistida, adicionar modelos, generator e adaptador PostgreSQL, gerar o cliente e criar uma migração revisável. Não executar `db push` ou criar tabelas artificiais nesta fase.

A URL do banco está configurada em `apps/api/prisma.config.ts`, separada do schema conforme o padrão do Prisma 7.

Variáveis locais ficam no `.env` da raiz. O Vite lê esse diretório e só expõe variáveis com prefixo `VITE_`; nunca usar esse prefixo para segredos. Scripts da API carregam o mesmo arquivo com dotenv-cli. Se a porta ou as credenciais do PostgreSQL forem alteradas, atualizar também DATABASE_URL. Alterar credenciais no `.env` não modifica usuários de um volume já inicializado.

## PWA

O build gera manifesto, ícones PNG e service worker com precache dos arquivos estáticos. Sem cache de API ou dados pessoais e sem escrita offline. A API deve ter origem separada ou prefixo `/api`, que está excluído do fallback de navegação. O service worker está desabilitado no servidor de desenvolvimento; validar via build e preview. Atualizações aguardam a próxima ativação do service worker; uma interface para avisos de atualização será feita com as telas futuras. HTTPS é necessário em produção; localhost permite testes locais. A oferta de instalação varia conforme navegador e plataforma.

## Camada de integrações externas — futura

Quando houver necessidade, criar `apps/api/src/integrations/` com adaptadores por provedor e contratos internos para investimentos, cotações e saúde. A cotação pública BTC/BRL já usa um cliente HTTP isolado no frontend, sem SDK ou chave.
A integração está descrita no [módulo financeiro](../apps/web/src/modules/finances/README.md).

- Finances poderá consultar posições e cotações por interfaces internas; workouts/rest poderão consumir dados de saúde autorizados.
- Serviços de domínio recebem interfaces; adaptadores traduzem autenticação, formatos e falhas dos provedores.
- Chaves e tokens permanecem no backend. Prever consentimento, escopos mínimos e revogação para dados de saúde.
- Definir limites de requisição, timeouts, retentativas limitadas, cache por fonte e tratamento de dados desatualizados antes da implementação.
- Sincronizações futuras precisam de idempotência, rastreabilidade e testes com adaptadores simulados.

Essa descrição é uma direção arquitetural, não uma implementação ou escolha de fornecedor.

## Testes

Vitest no frontend e backend; Testing Library com jsdom para componentes; Supertest para HTTP. Configuração de testes separada da compilação de produção da API. Testes iniciais cobrem inicialização visual, health check, 404, JSON inválido e validação de ambiente. Não exigem banco ou integrações. Os testes de persistência, migração, cálculos e fluxos reais dos quatro pilares usam jsdom/Testing Library; não são testes E2E em navegador.

## Composição do dashboard — Sprint 1

`web/src/app/App.tsx` compõe as páginas e mantém um estado canônico persistido por `usePlayerState`. Os quatro pilares têm módulos independentes; `modules/records` centraliza comandos puros, datas e projeções comuns. `app/mocks/dashboard.ts` centraliza o legado demonstrativo. A History API nativa controla a navegação pela URL; os pilares não chamam o backend; Finanças consulta somente a cotação pública BTC/BRL. A versão 2 do armazenamento migra dados v1, preservando o jogador anterior.

`modules/profile` contém o resumo do jogador, `modules/missions` a lista com filtros e `modules/gamification` atributos, conquistas e projeção visual de XP. O delta de XP vem das missões marcadas em relação ao estado inicial, evitando acumulação por marcar/desmarcar. Nenhuma regra é implementada nos módulos backend.

Os cartões de indicadores usam `shared/components/MetricCard`; ícones SVG, barras e títulos também são reutilizados. Conhecimento inclui biblioteca e registros de leitura. Testes cobrem navegação, filtros, CRUD, recarga, migração, deduplicação de XP, radar e limites de níveis. Consulte [quatro pilares](four-pillars.md) para o contrato e as regras adicionais.

## Evolução real e armazenamento v3

A origem do jogador é nível 1/0 XP com limiar preservado de 2.000 XP. As projeções
usam registros reais e confirmações datadas em `missionEvents`. Atributos e
conquistas são derivados, sem desbloqueios artificiais. V1/v2 migram para v3 uma
única vez, preservando perfil, preferências e todos os pilares, retirando apenas
origem de XP, histórico e recompensas demonstrativos.
O contrato atual está em [Persistência](../apps/web/src/shared/storage/README.md).
As descrições históricas de mocks/Sprint 1 acima não são mais a origem dos cálculos.

## Quests personalizadas

`modules/goals` separa comandos, ciclos, progresso, fontes automáticas, recompensas
e apresentação. `PlayerState.goals` é persistido no envelope v4 com migração
compatível de v3. Quests consultam registros reais sem modificá-los. XP agregado
no App divide limites com missões/registros e tem orçamento próprio limitado;
o Radar não recebe eventos de quest. Contrato e verificação em
[Quests](../apps/web/src/modules/goals/README.md).

## Dashboard com objetivos do usuário

A interface de missões fixas e seu handler de conclusão foram removidos. O único
painel de objetivos no dashboard é **Minhas Quests**, usando `dashboardGoals` para
filtrar pendências e ordenar por prazo/fim de ciclo. Exibe até cinco, com links
para `/quests?quest=<id>`; a página reutiliza `GoalCard` nos detalhes. O endereço
antigo `/missoes` é substituído por `/quests` sem oferecer conclusões legadas.
Sem quests disponíveis, o painel retorna `null` e a grade dá toda a largura às
conquistas; no celular os painéis seguem em uma coluna.

`missionEvents` e os metadados legados são somente históricos: conservam XP,
Radar e conquistas legítimos, sem gerar novas declarações ou prêmios. O contrato
continua v4, sem migração destrutiva ou gravações extras na montagem. Testes de
migração anteriores continuam cobrindo a remoção de demonstração e preservação
dos registros dos quatro pilares, perfil e confirmações reais.

A consulta da página Quests é uma projeção em `modules/goals/questList.ts`:
normalização da busca, interseção de filtros e ordenação estável. `QuestFilters`
usa chips, um campo de busca e `shared/components/CustomSelect` para ordenação. O estado
desses controles permanece local à página, sem mudar o envelope v4. O arquivo de
quests excluídas continua acessível por um atalho separado. Cartões reutilizam
ciclos, recompensas e comandos existentes, sem alterar XP ou o Radar.
Os formulários de Quests usam o mesmo combobox/listbox customizado em todos os
campos de seleção. O portal evita recortes, e valores ocultos mantêm compatibilidade
com `FormData`, sem select nativo, dependências novas ou alteração do armazenamento.

`CustomSelect` também substitui os seletores nativos de Finanças e Conhecimento.
Campos dependentes de outras escolhas mantêm valores controlados; campos simples
usam `defaultValue` e nomes de formulário preservados. A troca é somente visual:
nenhuma versão de storage, regra de XP/Radar ou cálculo financeiro foi modificada.
Testes interagem pelos rótulos e roles públicos dos controles, incluindo contas,
transferências, investimentos, conversão BTC/sats e escolha do livro da leitura.

Os calendários de data/mês usam `shared/components/CustomDatePicker`, com o mesmo
`useAnchoredPopover` dos seletores. Valores e limites permanecem ISO, e o diálogo
possui seleção de mês/ano, digitação manual, teclado e tratamento de foco. A
validação mantém campos obrigatórios e limites dos formulários existentes, sem
alterar storage. As utilidades civis foram movidas sem alteração para
`shared/dates/calendar.ts`, com reexport no caminho anterior de records.
