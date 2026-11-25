# Persistência transacional do jogador

Decisão aprovada pelo usuário em 21/11/2026: IndexedDB como fonte de verdade,
preservando integralmente a chave legada e as cópias existentes. Não altera regras
de Finanças, XP, Radar, Quests ou Treinos. Não adiciona dependência nem backend.

## Causa e escolha

O escritor v7 antigo não reconhece alguns snapshots ampliados e pode gravar um
jogador vazio sobre a mesma chave. Marcar v8 só na primeira ação deixava uma
janela; marcar v8 mais cedo também não interrompe um escritor antigo já em curso.
Web Locks coordena somente código que pede o mesmo lock. Esse limite foi
confirmado em duas abas isoladas: uma escrita sem lock executou durante o lock.

`getItem` seguido de `setItem` também não é uma comparação atômica. A versão
anterior falhou numa intercalação forçada. A solução usa a serialização nativa
das transações `readwrite` com escopo sobre as mesmas stores, em conexões/abas
independentes, conforme a [especificação IndexedDB](https://www.w3.org/TR/IndexedDB-3/#transaction-scheduling).
Notificações não são usadas como transações.

## Fontes de dados

| Local                                                   | Função                                                                                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| IndexedDB `life-rpg:records`, schema 1, `state/current` | Snapshot canônico, envelope v8, revisão e metadados da origem legada                                                                                 |
| Store `copies`                                          | Cópias brutas de importação, conteúdo protegido, alterações legadas, propostas em conflito e estado anterior à recuperação ou à importação de backup |
| `state/protected-source`                                | Guarda de conteúdo inválido/futuro que ainda não foi ativado como jogador                                                                            |
| `life-rpg:player-state` e `:backup:*` no localStorage   | Originais legados, sempre preservados pela versão atual                                                                                              |
| `life-rpg:statistics-view` no localStorage              | Preferências visuais descartáveis; mecanismo anterior preservado                                                                                     |

O banco tem versão própria, diferente da versão 8 do payload e da revisão de
concorrência. O vocabulário do payload continua protegido por `storageContract.test.ts`.

## Importação e abertura

1. Ler o bruto legado e abrir o banco; nenhuma gravação de fallback no legado.
2. Dentro da transação, verificar se outra aba já criou o canônico. Se sim,
   usar esse canônico, nunca reimportar o legado por cima dele.
3. Validar o formato e aplicar somente as migrações oficiais existentes.
4. Gravar e ler de volta uma cópia exata do bruto, incluindo espaços, Unicode e
   campos desconhecidos compatíveis. Criar o canônico validado na mesma transação.
5. Liberar a interface normal apenas depois de `transaction.oncomplete`.

Se qualquer etapa falhar, a transação aborta. Não há ativação parcial, limpeza do
legado, nem jogador vazio salvo no lugar de dados existentes. Um navegador sem
IndexedDB não recebe um escritor alternativo inseguro: mostra erro de abertura
e nova tentativa. Dados inválidos/futuros ficam protegidos e exportáveis, com
cópia preservada sem ativação como jogador; uma escrita legada posterior de
fallback vazio não remove essa guarda. Começar do zero exige confirmação.

Sem dados, cria-se somente o schema do banco; nenhum jogador é gravado na montagem.
A primeira ação válida cria o primeiro snapshot. Transações e a verificação da
existência do canônico tornam a importação idempotente sob StrictMode/duas abas.

## Escrita, conflito e falha

Uma proposta leva a revisão lida. Na mesma transação, o escritor lê a revisão
atual, compara, valida e grava o snapshot completo com a próxima revisão. Não há
mesclagem de saldos, séries ou exclusões. Se outra aba venceu, a proposta vira
cópia recuperável e o resultado é conflito, não sucesso. Reabrir a aba não apaga
essa cópia. A aba também oferece download da alteração e carregamento explícito
dos registros atuais.

Todas as mutações (primeiro jogador, escrita normal, recuperação, restauração e
importação de backup) passam pelo mesmo mecanismo. Restaurar uma cópia ou
importar um [backup manual](data-backup.md) confere a revisão e guarda o
canônico anterior na mesma transação (`before-recovery` ou `before-import`); a
operação é explícita e reversível. Um conflito de importação não guarda o
arquivo como rascunho, pois o original continua com o usuário.

O hook mantém no máximo uma escrita local em andamento e enfileira o estado
resultante dos comandos seguintes. Só confirma a gravação no commit. Leituras
atrasadas de notificações/foco não substituem uma proposta ou commit mais recente.
Quota, aborto, conexão indisponível e falha de coordenação não são anunciados
como sucesso. A proposta continua na sessão; seu aviso orienta a recuperação.

`whenSaved()` (exposto pelo hook e repassado às páginas em `RecordPageProps`)
apenas observa esse ciclo: resolve `saved` quando um commit inclui o estado
atual, `conflict` ou `failed` quando a gravação não acontece. Não grava nem
repete comandos. Confirmações de sucesso na interface (por exemplo, importar ou
finalizar um treino) aguardam esse resultado; sem armazenamento (renderização
isolada em testes), a ausência da função equivale ao comando síncrono.

As transações de escrita solicitam durabilidade `strict`. O teste que aborta
depois de `put` confirma que sucesso de uma request não é tratado como commit.
Fechar a aba durante a transação deixa o snapshot anterior ou um commit completo,
sem estado parcial. Não há retry automático de comandos financeiros.

Enquanto uma gravação aguarda confirmação, o hook registra `beforeunload` para
que o navegador peça confirmação antes de fechar ou recarregar a aba. O aviso
não aparece nos estados `session`, `protected` ou `conflict`, já anunciados na
interface. Uma cópia (`copies.add`) é sempre a última operação síncrona de cada
handler da transação; uma falha que aborte a transação de imediato chega apenas
por `onabort`, sem exceção não tratada na página.

## Versões antigas e PWA

Código legado pode continuar escrevendo no localStorage, mas não conhece o banco
canônico. Essas escritas não alteram o estado usado pelo app atual. Brutos
divergentes são arquivados e anunciados, com download e recuperação no Perfil;
não existe importação/mesclagem financeira automática depois da ativação.

Eventos `storage` preservam os valores observados, inclusive intermediários.
Se o arquivamento falhar, o app mantém os brutos observados na memória, informa
que ainda não foram guardados e oferece exportação antes de fechar a aba.
Reconhecer o aviso só o fecha após conseguir guardar as pendências. As cópias
não são removidas automaticamente; falta de espaço causa falha explícita.

BroadcastChannel e foco são apenas avisos para reler o canônico. A ausência de
Web Locks ou de notificações não remove a comparação da revisão na transação.
Uma aba desatualizada continua sujeita a conflito ao tentar gravar.

O service worker mantém `registerType: 'prompt'`: a versão nova aguarda enquanto
há clientes antigos, sem `skipWaiting` forçado. O banco é da origem e não depende
do cache de assets; funciona offline. Fechar todos os clientes permite ativar o
worker novo. Código antigo que voltar a executar não regrava o IndexedDB novo.

## Limites reais

- Nenhuma versão nova recupera dados que já foram destruídos **antes** de uma
  importação confirmada, nem corrige retroativamente código antigo instalado.
- Enquanto a versão nova não estiver executando, apenas o último bruto legado
  ainda disponível poderá ser observado na próxima abertura. Valores
  intermediários já sobrescritos por código antigo não podem ser reconstruídos.
- Uma aba antiga pode exibir sua própria cópia desatualizada ou anunciar sucesso
  nela. O app atual detecta a divergência; não promete corrigir a interface antiga.
- Negação de acesso/quota pode impedir guardar novas alterações. O estado
  confirmado fica preservado, e a falha é explícita. Alterações declaradas como
  somente de sessão exigem exportação antes de fechar a aba.
- O aviso de `beforeunload` depende do navegador: pode ser omitido sem interação
  prévia na página e não é disparado de forma confiável em sistemas móveis que
  encerram a aba em segundo plano. Ele reduz, mas não elimina, a janela de
  milissegundos entre o comando e o commit.
- Limpeza de dados pelo usuário/sistema, falha física do dispositivo e uso de
  outra origem/navegador não são sincronizados nem recuperados por backend.
- Os testes de PWA verificam instalação/ativação do service worker em Chromium,
  não o diálogo de instalação do sistema operacional ou uma janela standalone.

Esses limites não são usados para ocultar as duas falhas reproduzidas: os testes
originais continuam forçando a ação do escritor antigo e a intercalação de duas
abas. Agora verificam preservação do canônico, cópias recuperáveis e conflito.

## Validação reproduzível

- `usePlayerState.async.test.tsx`: hidratação, fila de comandos, confirmação,
  falha, conflito, leitura atrasada, aviso de fechamento durante gravação e brutos
  legados que falham ao arquivar.
- `scripts/audit-indexed-storage.mjs`: repositório TypeScript real importado pelo
  Vite, IndexedDB nativo em conexões independentes, formatos v1–v8, dados futuros
  e inválidos, aborto de migração/escrita, recuperação, 30 corridas de revisão,
  conflito financeiro, legado surgido após leitura vazia e ausência de Web
  Locks/IndexedDB.
- `scripts/audit-storage-pwa.mjs`: interface real, builds históricos `6b0d981` e
  `43ddebbe`, proteção antes da primeira ação, download exato, cinco larguras,
  corrida pausada após ler a revisão, fechamento de aba e oito cenários de PWA.
- `scripts/audit-backup.mjs`: importação de backup nativa, abortos, corrida de
  20 importações, computador ↔ celular emulado, conflito entre abas e offline
  ([backup manual](data-backup.md#testes)).
- `npm run audit:persistence` reúne as três auditorias. Usa as variáveis e builds
  históricos descritos no [relatório complementar](../audits/persistence-pwa-validation-2026-11-21.md#reproduzir).
- O CI executa os testes nativos e PWA no job `persistence`, além de `check` e
  `visual`, com perfis descartáveis, portas temporárias e artefatos de evidência.

As suítes de componentes usam um adaptador síncrono injetado na fronteira do
armazenamento para manter os testes de domínio determinísticos. Não mockam o
hook ou as regras. Essa cobertura não substitui os ensaios assíncronos/nativos
acima nem é apresentada como evidência de transações IndexedDB.
