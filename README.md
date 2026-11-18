# Life RPG

Aplicação de evolução pessoal com identidade de RPG: registre atividades de
Finanças, Treinos, Descanso e Conhecimento, defina quests, ganhe XP e visualize
sua dedicação recente no Radar de Evolução.

O frontend funciona de forma independente, com salvamento automático no
`localStorage`. Não requer conta, backend ou banco de dados para usar os recursos
atuais. O projeto também contém uma base de API para evoluções futuras.

## Funcionalidades

- **Dashboard:** personagem, classe, nível, XP, indicadores dos quatro pilares,
  quests do usuário e medalhas, com layout dark/vermelho e navegação responsiva.
- **Finanças:** receitas e despesas com edição/exclusão, histórico mensal e saldo;
  contas com saldo inicial, transferências, posições preexistentes sem débito e compras reais de investimentos; correção confirmada de compras antigas e avaliações manuais;
  Bitcoin em BTC/sats e dólar (USD), com cotações de referência, custo médio e vendas parciais. Campos monetários com máscara durante a digitação. Caixinhas por instituição,
  contrato CDI informativo e atualização manual do saldo/rendimento, sem juros automáticos. Gráficos distinguem
  fluxo mensal, dinheiro disponível, investimentos e patrimônio sem duplicação.
- **Treinos:** um registro Sim/Não por dia, calendário, frequência e consistência.
  Modo Avançado opcional com fichas, exercícios personalizados, séries, cargas, RIR,
  histórico, gráficos, recordes, volumes e mapa muscular, sem XP adicional.
- **Descanso:** registro diário de horas, valores decimais, meta pessoal e médias.
- **Conhecimento:** biblioteca, leituras por data, progresso e livros concluídos.
- **Quests personalizadas:** objetivos livres ou modelos editáveis, acompanhamento
  manual/automático, ciclos, pausas, histórico e XP limitado sem duplicação.
  Busca por título/descrição, filtros em chips e ordenação sem alterar os dados.
- **Progressão:** XP e níveis recalculados a partir das fontes de dados, limites de
  recompensa por área/dia e prevenção de duplicação com quests e confirmações históricas.
- **Estatísticas:** radar dinâmico de 7/30/90 dias, comparação com o período anterior
  e gráfico semanal de XP das ações datadas.
- **Perfil:** nome editável, avatar atual, classe automática, nível, XP e Radar. A classe
  considera a dedicação real dos últimos 30 dias, atribuindo imediatamente a classe pelo pilar de maior pontuação.
  Veja as [regras de classes e migração](apps/web/src/modules/profile/README.md).
- **Persistência:** formato v7, com migração automática das versões anteriores,
  preservando registros reais, quests, XP e nível. O perfil antigo perde apenas os campos cosméticos descontinuados.
- **Navegação:** URLs próprias, acesso direto, recarga e Voltar/Avançar.
- **Acessibilidade/PWA:** seletores e calendários customizados dark em todo o aplicativo,
  foco de teclado, formulários rotulados, respeito à preferência por
  movimento reduzido, manifesto e cache de arquivos estáticos no build.

Todo jogador novo começa no **nível 1, com 0 XP**. XP e níveis usam somente
atividades reais, quests elegíveis e confirmações históricas do usuário, sem recompensas demonstrativas.
Atributos, conquistas, Radar e estatísticas são derivados dessas fontes. A migração
conserva perfil, preferências e todos os registros dos pilares. A correção de
progresso fictício permanece restrita aos dados demonstrativos de v1/v2. Não há sincronização entre dispositivos; limpar os dados do
navegador remove o progresso local.

## Tecnologias

| Camada                    | Tecnologias                                              |
| ------------------------- | -------------------------------------------------------- |
| Frontend                  | React 19, TypeScript, Vite, Tailwind CSS 4, SVG nativo   |
| Persistência atual        | `localStorage`, validação e migração tipadas             |
| PWA                       | `vite-plugin-pwa` e Workbox                              |
| API preparada             | Node.js, Express 5, Helmet e CORS                        |
| Banco preparado, opcional | PostgreSQL 17 via Docker Compose e configuração Prisma 7 |
| Testes                    | Vitest, Testing Library, jsdom e Supertest               |
| Qualidade                 | TypeScript estrito, ESLint e Prettier                    |
| Organização               | Monorepo com npm workspaces                              |

A API atual fornece infraestrutura e health check. Não existem autenticação,
modelos de negócio no banco, integrações com corretoras ou dispositivos de saúde.
A cotação pública de Bitcoin é consultada no frontend e pode ficar indisponível;
a carteira continua funcionando com a última cotação conhecida ou referência pelo custo.

## Requisitos

- Node.js **22.12+**; a versão do projeto é **22.23.5**, registrada em `.nvmrc`.
- npm 10+.
- Docker com Compose v2 somente se quiser executar o PostgreSQL opcional.

## Instalação

Após clonar o repositório, na pasta `life-rpg`:

```bash
nvm install
nvm use
npm ci
```

O `package-lock.json` deve ser mantido no versionamento para instalações
reproduzíveis. Não é preciso criar `.env` para usar apenas o frontend.

## Executar o aplicativo

```bash
npm run dev:web
```

Abra **http://localhost:5173**. Os quatro pilares ficam na aba **Pilares** e nos
cartões do dashboard. Registre uma atividade, confira XP/radar e pressione F5 para
verificar a continuidade do progresso.

| Página       | URL             |
| ------------ | --------------- |
| Início       | `/`             |
| Quests       | `/quests`       |
| Estatísticas | `/estatisticas` |
| Perfil       | `/perfil`       |
| Pilares      | `/pilares`      |
| Finanças     | `/financas`     |
| Treinos      | `/treinos`      |
| Descanso     | `/descanso`     |
| Conhecimento | `/conhecimento` |

O painel **Minhas Quests** do dashboard mostra até cinco quests em andamento,
ordenadas por prazo. Cada quest abre seus detalhes em `/quests?quest=<id>`, com os mesmos
controles de progresso da página Quests. Sem quests ativas, as conquistas usam o espaço
disponível. O endereço antigo `/missoes` redireciona para `/quests`; não há novas
conclusões ou recompensas de missões fixas. Links antigos de `/metas` também
continuam funcionando e abrem `/quests`, inclusive os detalhes já compartilhados.
Confirmações legítimas anteriores permanecem preservadas como histórico no envelope v7.

### Backend e ambiente opcionais

```bash
cp .env.example .env
```

Substitua `CHANGE_ME_LOCAL_ONLY` por uma senha local no `POSTGRES_PASSWORD` e na
`DATABASE_URL`. Se a senha contiver caracteres especiais, codifique-os na URL.
O `.env` é privado e ignorado pelo Git. O template `.env.example` contém somente
placeholders. O Compose usa a senha definida no ambiente, sem senha padrão no código.

```bash
# API e frontend juntos:
npm run dev

# Somente a API:
npm run dev:api

# PostgreSQL opcional:
npm run db:up
npm run db:validate
npm run db:down
```

A API atende em **http://localhost:3001/health** e o PostgreSQL em
`localhost:5432`. Os processos de desenvolvimento usam loopback. A API não abre
conexões com o banco na inicialização. `VITE_API_URL` está reservado para o futuro
cliente HTTP; nunca use o prefixo `VITE_` para segredos.

`db:down` preserva o volume. Alterar credenciais no `.env` não altera usuários de
um volume PostgreSQL já existente. Não há migrações ou tabelas de negócio nesta etapa.

## Testes e qualidade

```bash
npm run typecheck
npm run lint
npm test
npm run build

# Executa padrões, TypeScript, lint, testes e build:
npm run check

# Verificação da documentação, links e tokens de cor:
npm run standards:check

# Verificação de formatação:
npm run format:check
```

Os testes não dependem de banco ou serviços externos. Os testes HTTP da API
precisam de permissão para abrir uma porta local. A suíte cobre os quatro pilares,
limites de registros, cálculos, XP/radar, deduplicação, recarga, URLs, armazenamento
e migração do formato anterior.

## Build e prévia local

```bash
npm run build
npm run preview -w @life-rpg/web
```

Abra **http://localhost:4173**. As saídas ficam em `apps/web/dist`, `apps/api/dist`
e `packages/contracts/dist`. A prévia é local; nenhum deploy é configurado.
O manifesto e o service worker são gerados no build. O cache cobre arquivos
estáticos, sem cache de API ou sincronização de dados do jogador.

Em uma futura hospedagem, as rotas da interface devem servir `index.html` sem
redirecionar para `/`, preservando arquivos estáticos e `/api`. Vite dev e preview
já oferecem esse fallback de SPA. A PWA exige HTTPS fora de localhost.

## Organização

```text
apps/
  web/src/
    app/                    Composição, navegação, estado e migração
    modules/
      finances/             Movimentações e carteira
      workouts/             Treinos por dia e calendário
      rest/                 Sono e meta individual
      knowledge/            Biblioteca e leituras
      records/              Comandos, datas e projeções compartilhadas
      evolution/            Radar e pontuação recente
      gamification/         Níveis, atributos e conquistas
      goals/                Objetivos personalizados, progresso e histórico
      missions/             Compatibilidade de confirmações históricas
      profile/              Resumo do personagem
    shared/                 Componentes, hooks, storage e estilos
  api/                      Infraestrutura Express e módulos futuros
packages/contracts/         Espaço para contratos públicos futuros
docs/                       Produto, arquitetura e regras implementadas
```

## Documentação técnica

- [Entrada obrigatória para agentes de programação](AGENTS.md)
- [Índice oficial de desenvolvimento](docs/README.md)
- [Design system e componentes](docs/design-system/README.md)
- [Arquitetura atual e convenções](docs/architecture/README.md)
- [Visão do produto](docs/product.md)
- [Arquitetura e integrações futuras](docs/architecture.md)
- [Quatro pilares: regras, migração e verificação manual](docs/four-pillars.md)
- [Finanças: contas, Bitcoin, gráficos e verificação manual](apps/web/src/modules/finances/README.md)
- [Quests personalizadas: ciclos, acompanhamento e XP](apps/web/src/modules/goals/README.md)
- [Treinos: modo avançado, volumes, recordes e integração diária](apps/web/src/modules/workouts/README.md)
- [Persistência local](apps/web/src/shared/storage/README.md)
- [Radar de Evolução](apps/web/src/modules/evolution/README.md)

A identidade visual e sua fonte CSS estão documentadas no
[design system](docs/design-system/README.md). Os READMEs dos módulos mantêm os
contratos de domínio. O CI executa `npm run check` em push e pull request.

## Arquivos locais e credenciais

O `.gitignore` exclui `.env`, credenciais locais, chaves, dependências instaladas,
builds, cobertura e arquivos temporários. Somente o template `.env.example` é
versionado. Os dados reais registrados no aplicativo ficam no navegador e não
são incluídos no código-fonte. Este projeto não configura GitHub Pages ou deploy.
