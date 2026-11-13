# Persistência local automática

Chave: `life-rpg:player-state`. Envelope JSON: `{ version: 2, data: PlayerState }`.
`localStateStorage.ts` concentra leitura, serialização, gravação e tratamento de
exceções. O contrato `StateStorage<T>` não depende de React nem dos dados demo.
A montagem desse adaptador e sua política de inicialização ficam em
`app/usePlayerState.ts`; a estrutura e validação de domínio em `app/playerState.ts`.
Uma API futura poderá substituir o adaptador com hidratação assíncrona nesse
hook, mantendo os componentes e as funções de cálculo.

## Fonte de verdade

- Perfil completo, incluindo nome e classe.
- `progressOrigin`: nível, XP e limiar iniciais da projeção existente.
- Conclusão de cada missão por ID, incluindo pendentes.
- IDs das conquistas desbloqueadas (nenhuma regra nova de desbloqueio).
- Histórico de atividades usado pelo radar, inclusive o histórico fictício inicial.
- `records`: movimentações, carteira/operações, treino, sono/meta e biblioteca/leituras.
- Filtros existentes: período do radar detalhado e filtro da lista de missões.

Não gravamos o XP atual, nível atual, radar, métricas de dedicação ou atividades
recriadas a partir das missões. O XP atual continua sendo
`projectProgress(progressOrigin, recompensasAtuais - recompensasIniciais + recompensasRegistros)`.
Missões usam IDs canônicos e nunca acumulam eventos de recompensa a cada clique.
O radar usa `projectEffortActivities(activityHistory, missions, records, today)`.
Os catálogos de missões, conquistas e regras ficam no código. Ao modificar esse
contrato ou o significado desses catálogos, aumentar a versão e adicionar uma
migração explícita. Não existe migração implícita entre versões desconhecidas.

## Inicialização e falhas

A leitura validada ocorre no inicializador do estado, antes da primeira renderização.
Sem chave, usa o demo. Dados malformados, campos inválidos ou versões desconhecidas
não são usados. O fallback não é salvo na montagem, inclusive com React StrictMode.
Uma alteração relevante grava o estado inteiro em um único `setItem`, sem debounce;
nenhuma parte do progresso é salva separadamente.

Conteúdo inválido da versão atual pode ser substituído depois de uma ação do
jogador. Versões desconhecidas permanecem intactas, inclusive após interações.
Falha de leitura impede a gravação para não sobrescrever dados que não puderam
ser lidos. Exceções de acesso e falta de espaço são capturadas. O estado React
continua operando; o rodapé informa que as mudanças ficam na sessão. A próxima
alteração tenta salvar novamente. Nenhuma operação apaga a chave ou usa `clear`.

A validação exige tipos corretos, XP finito e normalizado, limiar de XP existente,
IDs conhecidos e únicos de missões/conquistas, histórico de atividades sem IDs
duplicados e preferências válidas. O validador não concede XP nem desbloqueios.

## Limites existentes

O histórico demonstrativo permanece ancorado em 13/11/2026, e os registros reais usam datas civis locais. O radar usa o dia atual. Missões legadas não são renovadas automaticamente.
Os dados pertencem ao mesmo navegador/perfil e origem (protocolo, host e porta).
Limpar os dados do site remove o progresso. Em navegação privada, a retenção segue
as regras do navegador. Não há sincronização ou resolução de alterações simultâneas
entre abas. Não há backup manual nem dependências novas.

## Verificação manual

1. Execute `nvm use` e `npm run dev:web`; abra o endereço indicado pelo Vite.
2. Conclua uma missão e anote XP, nível e dedicação da categoria.
3. Recarregue: a missão e os valores devem ser mantidos.
4. Desmarque a missão e recarregue: os valores recalculados também permanecem.
5. Mude os filtros em Missões e Estatísticas; recarregue e retorne a essas telas.
6. Em DevTools → Application → Local Storage, confira a chave acima e `version: 2`.
7. Feche e reabra o navegador no mesmo endereço para verificar a continuidade.

## Migração v1 → v2

A validação anterior é preservada em `isLegacyPlayerState`. Uma leitura v1 válida acrescenta `records` vazio sem alterar os campos anteriores. O adaptador retorna `migrated: true`; o hook persiste v2 após hidratar o estado validado. Falha na gravação mantém o payload v1 intacto. Versões desconhecidas continuam bloqueadas para gravação. Detalhes em `docs/four-pillars.md`.
