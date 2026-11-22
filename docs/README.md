# Documentação oficial de desenvolvimento

Entrada para agentes: [AGENTS.md](../AGENTS.md). Estas regras descrevem a
implementação atual; propostas futuras devem ser identificadas como propostas.

| Tarefa                                          | Consultar                                              |
| ----------------------------------------------- | ------------------------------------------------------ |
| Botões, campos, cartões e telas                 | [Design system](design-system/README.md)               |
| Estado, módulos, persistência e testes          | [Arquitetura atual](architecture/README.md)            |
| Fluxo de implementação e validações automáticas | [Regras para IAs](ai/development-rules.md)             |
| Branches, commits e proteção da main            | [Fluxo obrigatório de Git](ai/git-workflow.md)         |
| Encerrar uma implementação                      | [Checklist de funcionalidade](ai/feature-checklist.md) |
| Revisar uma mudança                             | [Checklist de revisão](ai/review-checklist.md)         |

## Contratos de produto e domínio

- [Auditoria visual e estrutural de 17/11/2026](audits/frontend-standardization-2026-11-17.md).
- [Produto](product.md) e [quatro pilares](four-pillars.md).
- [Finanças](../apps/web/src/modules/finances/README.md).
- [Treinos](../apps/web/src/modules/workouts/README.md) e
  [importação de treinos](workout-text-import.md).
- [Quests](../apps/web/src/modules/goals/README.md).
- [Radar](../apps/web/src/modules/evolution/README.md).
- [Painel de Estatísticas, paisagem 3D e calendário](../apps/web/src/modules/statistics/README.md).
- [Personagem e classes](../apps/web/src/modules/profile/README.md).
- [Persistência e migrações](../apps/web/src/shared/storage/README.md).
- [Persistência transacional e proteção contra versões antigas](architecture/transactional-persistence.md).
- [Backup manual: exportação, importação e transferência entre dispositivos](architecture/data-backup.md).
- [Publicação no GitHub Pages, PWA e dependências de backend](architecture/github-pages.md).
- [Detalhes dos seletores e calendários](../apps/web/src/shared/components/README.md).

[architecture.md](architecture.md) conserva decisões e descrições históricas de
sprints e versões de storage. Para o estado atual, use a pasta `architecture/`
e os contratos dos módulos, sem tratar as etapas antigas como funcionalidades atuais.

## Manutenção

Os valores visuais vêm de
[index.css](../apps/web/src/shared/styles/index.css); os documentos explicam seu uso.
Uma mudança oficial deve atualizar código, documento correspondente e, quando
aplicável, validação. Não copie contratos completos entre documentos: faça links.
`npm run standards:check` verifica a estrutura obrigatória, os links locais deste
índice e dos novos guias e as referências de tokens de cor no CSS.
O [guia de Git](ai/git-workflow.md) é obrigatório e sua referência em `AGENTS.md`
também é validada. Desenvolvimento ocorre fora da `main`; publicação e integração
exigem autorização explícita. A proteção técnica no GitHub depende da configuração
remota e não é criada pela documentação ou pelo verificador.
