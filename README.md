# Life RPG

Aplicação de evolução pessoal com identidade de RPG: registre atividades de
Finanças, Treinos, Descanso e Conhecimento, acompanhe missões, ganhe XP e visualize
sua dedicação recente no Radar de Evolução.

O frontend funciona de forma independente, com salvamento automático no
`localStorage`. Não requer conta, backend ou banco de dados para usar os recursos
atuais. O projeto também contém uma base de API para evoluções futuras.

## Funcionalidades

- **Dashboard:** personagem, classe, nível, XP, indicadores dos quatro pilares,
  missões e medalhas, com layout dark/vermelho e navegação responsiva.
- **Finanças:** receitas e despesas com edição/exclusão, histórico mensal e saldo;
  carteira manual com categorias, aplicações, aportes e retiradas. Sem cotações
  ou rentabilidade automática; investimentos não duplicam despesas de consumo.
- **Treinos:** um registro Sim/Não por dia, calendário, frequência e consistência.
- **Descanso:** registro diário de horas, valores decimais, meta pessoal e médias.
- **Conhecimento:** biblioteca, leituras por data, progresso e livros concluídos.
- **Progressão:** XP e níveis recalculados a partir das fontes de dados, limites de
  recompensa por área/dia e prevenção de duplicação com missões associadas.
- **Estatísticas:** radar dinâmico de 7/30/90 dias, comparação com o período anterior
  e gráfico semanal de XP das ações datadas.
- **Persistência:** formato versionado, validação e migração automática de v1 para
  v2, preservando o progresso anterior no mesmo navegador e endereço.
- **Navegação:** URLs próprias, acesso direto, recarga e Voltar/Avançar.
- **Acessibilidade/PWA:** foco de teclado, formulários rotulados, respeito a
  movimento reduzido, manifesto e cache de arquivos estáticos no build.

O perfil inicial, os atributos, as conquistas e o histórico legado são
**demonstrativos**, identificados na interface. Os novos registros reais começam
vazios. Não há renovação diária automática das missões legadas nem sincronização
entre dispositivos. Limpar os dados do navegador remove o progresso local.

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
modelos de negócio no banco, integrações financeiras ou dispositivos de saúde.

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
| Missões      | `/missoes`      |
| Estatísticas | `/estatisticas` |
| Perfil       | `/perfil`       |
| Pilares      | `/pilares`      |
| Finanças     | `/financas`     |
| Treinos      | `/treinos`      |
| Descanso     | `/descanso`     |
| Conhecimento | `/conhecimento` |

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
cliente HTTP; nunca use prefixo `VITE_` para segredos.

`db:down` preserva o volume. Alterar credenciais no `.env` não altera usuários de
um volume PostgreSQL já existente. Não há migrações ou tabelas de negócio nesta etapa.

## Testes e qualidade

```bash
npm run typecheck
npm run lint
npm test
npm run build

# Executa os quatro passos acima:
npm run check

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
      missions/             Missões e filtros
      profile/              Resumo do personagem
    shared/                 Componentes, hooks, storage e estilos
  api/                      Infraestrutura Express e módulos futuros
packages/contracts/         Espaço para contratos públicos futuros
docs/                       Produto, arquitetura e regras implementadas
```

## Documentação técnica

- [Visão do produto](docs/product.md)
- [Arquitetura e integrações futuras](docs/architecture.md)
- [Quatro pilares: regras, migração e verificação manual](docs/four-pillars.md)
- [Persistência local](apps/web/src/shared/storage/README.md)
- [Radar de Evolução](apps/web/src/modules/evolution/README.md)

A identidade visual fica em `apps/web/src/shared/styles/index.css`: preto
`#090909`, grafite `#171717` e vermelho `#DC2626`, com verde, roxo e dourado nos
pilares. A documentação e os READMEs dos módulos permanecem no projeto.

## Arquivos locais e credenciais

O `.gitignore` exclui `.env`, credenciais locais, chaves, dependências instaladas,
builds, cobertura e arquivos temporários. Somente o template `.env.example` é
versionado. Os dados reais registrados no aplicativo ficam no navegador e não
são incluídos no código-fonte. Este projeto não configura GitHub Pages ou deploy.
