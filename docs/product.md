# Life RPG — visão do produto

Life RPG transforma a organização pessoal em uma jornada de evolução. A proposta é reunir hábitos e objetivos em uma experiência dark, minimalista, moderna e inspirada em RPG, sem exigir conhecimento de jogos.

## Domínios

| Módulo       | Responsabilidade futura                                |
| ------------ | ------------------------------------------------------ |
| auth         | Identidade, sessões e autorização                      |
| profile      | Perfil do jogador e preferências                       |
| missions     | Missões, tarefas, periodicidade e conclusão            |
| gamification | Experiência (XP), níveis, atributos e conquistas       |
| finances     | Receitas, despesas, categorias e objetivos financeiros |
| workouts     | Planejamento e registros de treinos                    |
| rest         | Registros de sono e descanso                           |

Missions organiza as ações do jogador; gamification determina sua progressão. Finanças, treinos e descanso poderão originar missões, sem duplicar regras de XP nos demais módulos.

## MVP futuro proposto

Este recorte orienta planejamento; não representa funcionalidades entregues nesta estrutura inicial.

- Autenticação e perfil básico.
- Criação, listagem e conclusão manual de missões.
- XP e níveis derivados da conclusão de missões, com proteção contra recompensa duplicada.
- Representação inicial de atributos e conquistas, com regras simples a definir.
- Registros manuais básicos de finanças, treinos e descanso.
- Interface responsiva e instalável como PWA.

Os critérios de aceite, regras de recompensa, atributos e tratamento de dados pessoais serão detalhados antes da implementação.

## Após o MVP

Recorrência e lembretes; metas e relatórios; progressão mais elaborada; integrações de investimentos, cotações e saúde; sincronização offline de registros; notificações. Nenhuma operação financeira automática está prevista nesta base.

## Base inicial

Somente estrutura modular, ferramentas de desenvolvimento, identidade visual, configuração inicial de PWA, PostgreSQL local e testes de infraestrutura. Na base inicial, a tela era um marcador de preparação. Não há autenticação, usuários, modelos de negócio, migrações ou integrações externas.

## Identidade visual

| Token Tailwind | Cor       | Uso                       |
| -------------- | --------- | ------------------------- |
| background     | `#090909` | Fundo principal           |
| surface        | `#171717` | Superfícies               |
| primary        | `#DC2626` | Destaques e ações futuras |
| primary-dark   | `#7F1D1D` | Detalhes e bordas         |
| foreground     | `#F5F5F5` | Texto principal           |

Tokens centralizados em `apps/web/src/shared/styles/index.css`. Tipografia de sistema, sem requisições a fontes externas. O símbolo geométrico dos ícones é provisório. Usar texto claro sobre fundos escuros; vermelho escuro funciona como decoração, sem depender dele para informação ou texto pequeno. Considerar teclado, foco visível e movimento reduzido nas futuras telas.

## Integrações externas futuras

Uma camada de adaptadores no backend poderá atender investimentos, cotações e dados de saúde. Os módulos consumirão contratos internos, sem conhecer SDKs de provedores. A arquitetura e os limites estão em [architecture.md](architecture.md). A consulta pública BTC/BRL no frontend é a integração atual, sem SDK, chave ou sincronização.
Contas locais, transferências, avaliações e gráficos estão descritos no
[módulo financeiro](../apps/web/src/modules/finances/README.md).

## Sprint 1 — Dashboard do Jogador

Interface responsiva com identidade dark/vermelho, avatar em iniciais, nível e XP; atributos Força, Disciplina, Conhecimento e Riqueza; cartões de Finanças, Treinos, Descanso e Conhecimento; missões diárias e medalhas de conquistas. Navegação local entre Início, Missões, Estatísticas e Perfil.

Dados de demonstração centralizados em mocks tipados. Concluir ou desmarcar missões atualiza uma projeção visual de XP e níveis, sem recompensar repetidamente a mesma conclusão. O estado é preservado no localStorage após navegar e recarregar. Não há autenticação ou acesso ao banco. O armazenamento v2 contém os registros reais dos quatro pilares e migra o legado anterior.

A regra de demonstração considera 2.000 XP por nível; não define a progressão definitiva do produto. Atributos e conquistas permanecem demonstrativos. Indicadores, radar e gráfico semanal refletem os registros e missões datados. Regras dos novos registros em [quatro pilares](four-pillars.md).

## Evolução real e armazenamento v3

A origem do jogador é nível 1/0 XP com limiar preservado de 2.000 XP. As projeções
usam registros reais e confirmações datadas em `missionEvents`. Atributos e
conquistas são derivados, sem desbloqueios artificiais. V1/v2 migram para v3 uma
única vez, preservando perfil, preferências e todos os pilares, retirando apenas
origem de XP, histórico e recompensas demonstrativos.
O contrato atual está em [Persistência](../apps/web/src/shared/storage/README.md).
As descrições históricas de mocks/Sprint 1 acima não são mais a origem dos cálculos.
