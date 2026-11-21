# Confirmações históricas de missões

A lista de missões fixas foi removida da interface e da navegação. Não há novos
controles de conclusão, filtros ou concessão de prêmios por missões. `/missoes`
redireciona para `/quests`, e o dashboard mostra apenas objetivos do usuário.

`catalog.ts` mantém `legacyMissionCatalog` exclusivamente para validar IDs e
interpretar `missionEvents` já registrados por usuários. `realMissionHistory`
projeta essas confirmações para preservar o XP legítimo, o Radar e conquistas,
com os mesmos limites de área/data compartilhados com registros e quests.
Não há criação automática de atividades, duplicação de créditos nem alteração de
registros dos pilares. O catálogo não é exibido nem oferecido como modelo.

O envelope atual é a v8 (ver [persistência](../../shared/storage/README.md));
a remoção das missões não exigiu apagar/migrar eventos históricos ou
preferências legadas. A migração v1/v2 continua retirando apenas demonstração,
sem perder confirmações comprovadas. Testes de migração, recarga, navegação e
progressão validam essa compatibilidade.
