# Backup manual de dados

Permite transferir os registros do Life RPG entre dispositivos (computador e
celular) por arquivo. **Não é sincronização**: cada navegador mantém o próprio
IndexedDB, e nada é enviado a servidores. A restauração substitui integralmente
o estado do dispositivo de destino. Não altera regras de XP, Radar, níveis,
classes, Quests, Finanças ou Treinos e reutiliza a
[persistência transacional](transactional-persistence.md) sem mudar o schema.

## Como usar

**Exportar.** Perfil → _Backup de dados_ → **Exportar dados**. O app lê o
snapshot confirmado no IndexedDB (nunca o estado em memória), gera
`life-rpg-backup-AAAA-MM-DD.json` com a data civil local e inicia o download.
A mensagem informa o nome e o total de registros. O arquivo contém dados
pessoais e financeiros: guarde-o em local seguro.

**Importar.** No outro dispositivo, Perfil → _Backup de dados_ → **Importar
dados** e selecione o arquivo. O app valida o arquivo, mostra uma prévia
(jogador, data da exportação, versão e contagens por pilar) e pede confirmação
com **Restaurar backup** ou **Cancelar** (Escape também cancela). Nada é gravado
antes da confirmação.

**Transferir.** Exporte no computador, copie o arquivo para o celular (cabo,
e-mail para si mesmo, armazenamento próprio), abra o Life RPG no navegador do
celular e importe. O processo inverso é idêntico. Exportar e importar funcionam
offline quando o aplicativo já está disponível offline.

## O que entra no backup

O payload é o `PlayerState` completo, versão 8, exatamente como está no
canônico `state/current`:

| Área                     | Conteúdo                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Perfil e preferências    | `profile`, `character` (avatar e classe), `preferences` do Radar e de missões                        |
| Finanças e investimentos | Movimentações, investimentos, operações, contas, transferências, avaliações, cotações observadas     |
| Treinos                  | Registros diários, `advancedWorkouts` (exercícios, fichas, sessões, rotação, apelidos de importação) |
| Descanso e Conhecimento  | Sono e meta; livros e leituras                                                                       |
| Quests e histórico       | `goals` (itens e atualizações), `missionEvents` e campos legados normalizados                        |

XP, nível, Radar, atributos e conquistas são **projeções** recalculadas desses
registros; por isso são restaurados sem serem gravados à parte.

**Fora do backup**, por decisão desta etapa:

- Cópias de segurança (`copies`), guarda de conteúdo protegido e chave legada
  `life-rpg:player-state` do `localStorage`: são mecanismos de recuperação do
  próprio dispositivo. Continuam disponíveis em _Cópias de segurança dos registros_.
- `life-rpg:statistics-view` (`localStorage`): preferência visual descartável e
  específica do dispositivo (o que fica visível em Estatísticas). Incluí-la
  exigiria uma segunda gravação fora da transação do IndexedDB.
- `life-rpg:quick-actions` (`localStorage`): indica apenas se a apresentação
  inicial das Ações rápidas já foi vista neste navegador. Descartável, pelo
  mesmo motivo.
- `life-rpg:whats-new` (`localStorage`): guarda apenas o identificador da
  última Novidades da versão apresentada neste navegador. Descartável, pelo
  mesmo motivo; restaurar um backup não reapresenta novidades já vistas.
- Revisão de concorrência e metadados de importação legada do snapshot.
- Nenhum token, credencial, `.env` ou configuração de API existe no estado do
  jogador; o teste de exportação verifica essa ausência.

## Formato do arquivo (versão 1)

```json
{
  "format": "life-rpg-backup",
  "formatVersion": 1,
  "exportedAt": "2026-11-22T13:30:00.000Z",
  "summary": { "movements": 12, "investments": 3, "...": 0 },
  "integrity": { "algorithm": "fnv1a-32", "value": "1a2b3c4d" },
  "payload": { "version": 8, "data": { "profile": {}, "records": {} } }
}
```

- `format` identifica o arquivo; `formatVersion` versiona o **envelope** do
  backup. `payload.version` é a versão do contrato `PlayerState`, independente.
- `exportedAt` é o único metadado transitório: dois backups do mesmo estado
  diferem apenas nele.
- `summary` guarda as contagens por tipo de registro, usadas na prévia e para
  detectar arquivo incompleto.
- `integrity` é FNV-1a de 32 bits sobre `JSON.stringify(payload)`. Detecta
  corrupção e edição acidental; **não é assinatura** nem proteção contra edição
  intencional. Foi escolhido por funcionar fora de contexto seguro, onde
  `crypto.subtle` pode não existir.

Implementação: [backupFile.ts](../../apps/web/src/app/backupFile.ts).

## Validação e compatibilidade

Antes da prévia, em ordem: tamanho (até 25 MB), JSON legível, identificador,
`formatVersion`, campos obrigatórios, soma de verificação, versão do payload,
migração oficial quando antiga, `isPlayerState` completo e conferência do
`summary`. Qualquer falha mostra a causa e não altera dados.

| Situação                                        | Resultado                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `formatVersion` maior que 1                     | Bloqueado: atualizar o aplicativo                                  |
| `payload.version` maior que 8                   | Bloqueado: atualizar o aplicativo                                  |
| `payload.version` de 1 a 7                      | Migrado em memória por `migratePlayerState`, como na abertura      |
| Envelope bruto `{ version, data }`              | Aceito como _cópia do armazenamento_ (arquivos baixados do Perfil) |
| Outro `format`, lista, objeto sem identificação | Recusado como formato desconhecido                                 |
| Soma ou contagens divergentes                   | Recusado como incompleto ou alterado                               |
| Registros inválidos ou IDs duplicados           | Recusado pela validação do domínio                                 |

Uma mudança futura no `PlayerState` exige nova versão do payload e migração
(ver `storageContract.test.ts`); o envelope v1 continua válido. Mudança no
próprio envelope exige `formatVersion` 2 e leitura do v1.

## Garantias da restauração

- **Estratégia única:** restauração completa. Não há mesclagem, inclusive de
  registros financeiros, e por isso não há duplicação de investimentos, treinos
  ou Quests: o resultado é exatamente o conteúdo validado do arquivo.
- **Validação integral antes de gravar.** Erro nunca grava estado vazio.
- **Uma transação.** `importBackup` usa o mesmo `replace` de restaurar cópias:
  lê a revisão, compara, guarda o canônico anterior como cópia
  _Antes de importar um backup_ e grava o novo snapshot na mesma transação
  `readwrite` com durabilidade `strict`. Aborto em qualquer ponto não deixa
  cópia nem substituição parcial.
- **Conflito entre abas.** A revisão é fixada no momento em que o arquivo é
  selecionado. Se outra aba ou conexão gravar antes da confirmação, o resultado
  é conflito e nada muda; o usuário seleciona o arquivo de novo para revisar.
- **Gravação local pendente.** Exportar ou importar fica bloqueado enquanto um
  comando desta aba aguarda commit.
- **Registros protegidos** (inválidos ou de versão futura) podem ser
  substituídos por um backup explicitamente; o original continua nas cópias e a
  chave legada não é tocada. A exportação fica bloqueada nesse estado.

## Recuperação após falha

1. Falha, conflito ou cancelamento: os registros anteriores continuam ativos;
   a mensagem informa o que aconteceu. Repita a seleção do arquivo.
2. Importação concluída com conteúdo indesejado: Perfil → _Cópias de segurança
   dos registros_ → cópia _Antes de importar um backup_ → **Restaurar** (o
   estado atual também vira cópia) ou **Baixar**.
3. "Backup restaurado, mas não foi possível reler": o commit ocorreu;
   recarregue a página.
4. Arquivo recusado como incompleto: exporte de novo no dispositivo de origem.

## Limitações

- Não há sincronização: alterações feitas depois da exportação em um dispositivo
  não aparecem no outro até um novo backup. Importar substitui tudo no destino.
- O arquivo não é criptografado. Quem tiver o arquivo lê os dados.
- Cópias de segurança e preferências visuais de Estatísticas não são transferidas.
- O download depende do navegador; em alguns celulares o arquivo vai para a
  pasta de downloads sem diálogo. A seleção usa o seletor de arquivos do sistema.
- A classe do personagem é reconciliada pela data atual ao abrir; restaurar em
  outro dia pode atualizá-la, como em qualquer abertura do app.
- WebKit (Safari) não foi testado automaticamente neste ambiente; o cenário
  móvel usa Chromium com emulação de Pixel 7.

## Testes

- `app/backupFile.test.ts`: exportação completa, vazia e com milhares de
  registros; arquivos inválidos, corrompidos, futuros e alterados; migrações;
  ciclo exportar → importar → exportar; integridade financeira e de projeções.
- `app/DataBackup.test.tsx`: interface no Perfil, download, prévia, cancelar,
  Escape, restauração com cópia, conflito, falha e registros protegidos.
- `app/usePlayerState.backup.test.tsx`: hook com repositório assíncrono.
- `npm run audit:backup` ([audit-backup.mjs](../../scripts/audit-backup.mjs)):
  IndexedDB nativo em Chromium, abortos forçados, 20 importações simultâneas,
  computador ↔ celular emulado com toque, conflito entre abas reais, offline,
  teclado e 320 px. Requer Vite local e `PLAYWRIGHT_MODULE`, como as demais
  auditorias.
