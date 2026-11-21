# Validação complementar de persistência e PWA — 21/11/2026

Origem: `fix/audit-technical-compliance`, base `6b0d981`, revisão inicial
`cabfc00` (16 commits, 101 arquivos). Este documento registra novos testes e
limites, sem substituir ou copiar o relatório externo dos 32 achados.

## Decisão de integração

**Integração e publicação bloqueadas por risco reproduzido de perda silenciosa
de dados.** A autorização do usuário é condicional à segurança das gravações.
Nenhum merge, push, rebase, exclusão de branch ou reset foi feito nesta tarefa.

### A-02/C-01: janela anterior à primeira gravação v8

1. Uma fixture válida v7 contém registros dos quatro pilares, investimento,
   quest e sessão com Trapézio e horário de início.
2. O build atual lê todos esses dados sem alterar o texto bruto na abertura.
3. Antes da primeira ação, o envelope ainda é v7.
4. O build histórico `43ddebbe12a15321de20f8187820548543a57d26`, anterior ao
   suporte a Trapézio, não aceita o snapshot. Ao registrar um treino, grava o
   estado inicial e elimina os registros da fixture.
5. Com o envelope já em v8, o build v7 `6b0d981` recusa a gravação. A migração
   após uma ação no build atual também preserva os outros domínios e a recarga.

Portanto, a versão 8 protege somente os dados já marcados como v8. Uma versão
antiga ainda pode destruir um v7 inválido para ela; o app novo não consegue
alterar o código que já está aberto numa aba antiga.

### C-01: comparação condicional não é atômica

Duas abas reais do build atual partiram da mesma fixture v8. O teste pausou A
após seu `getItem` no escritor condicional, usando uma barreira HTTP síncrona
somente no ambiente de teste. B gravou um sono. Ao liberar A, seu `setItem`
sobrescreveu o sono de B sem aviso de conflito. Não se alterou o valor retornado
por `getItem`: a barreira apenas tornou determinística uma intercalação possível.

O teste normal de duas abas passou: quando a alteração de B já está visível na
leitura de A, os dois registros são preservados. Isso não comprova segurança
no intervalo entre leitura e escrita. Os testes jsdom anteriores simulavam a
mudança antes da leitura do escritor, sem cobrir essa janela.

### Proposta para avaliação antes de publicar

- Serializar **todas** as gravações do jogador (incluindo migração, recuperação
  e restauração) com Web Locks por origem/chave, fazendo comparação e escrita
  dentro da mesma exclusão mútua. Adaptar o contrato do escritor para assíncrono,
  cancelar gravações obsoletas e manter conflito explícito se o snapshot mudou.
  Sem essa capacidade no navegador, usar sessão protegida, sem voltar a uma
  gravação descoordenada.
- Projetar uma transição v7 → v8 que valide o payload original, guarde e verifique
  uma cópia exata do bruto, confira novamente o conteúdo e só então marque v8,
  sem normalizar nem substituir registros. Falha de cópia ou gravação deve
  preservar o original e bloquear a transição.
- Tratar separadamente as abas legadas, que não participam de Web Locks. O
  processo de atualização precisa garantir que todos os clientes antigos foram
  fechados antes da transição ou oferecer recuperação a partir de cópias
  verificadas. Apenas subir a versão ou acrescentar outro `getItem` não corrige
  a corrida. Não introduzir uma migração automática de dados como atalho.
- Reexecutar os testes históricos, concorrentes, de quota, StrictMode e PWA
  após a implementação. Esta proposta não foi implementada nem validada; não
  constitui autorização para publicar com os dois riscos existentes.

Essa mudança afeta o contrato síncrono da persistência e a coordenação com código
legado; não é uma correção visual isolada. A publicação fica interrompida para
avaliação, conforme a condição expressa do pedido.

## Ensaios no navegador

`scripts/audit-storage-pwa.mjs` serve builds de produção em uma porta loopback
temporária e usa apenas contextos descartáveis de Chromium. As fixtures são
montadas pelos módulos do Vite em `127.0.0.1:5173`. O script nunca se conecta ao
perfil real, não lê dados pessoais e bloqueia chamadas externas das páginas.
Os builds históricos usam seu código fonte original com a ferramenta de build
instalada no workspace atual; não representam uma restauração completa de suas
dependências históricas.

- Migração v7 → v8: sem gravação na abertura; primeira ação e recarga preservam
  perfil, preferências, quests e dados dos quatro pilares, incluindo sessões.
- Downgrade v8: build anterior não substitui os dados.
- Conteúdo inválido: aviso de proteção, ausência de indicação de salvamento
  normal, ações de sessão sem sobrescrita e download idêntico ao bruto, incluindo
  espaços, quebras de linha e Unicode.
  O feedback genérico agora diz “Alteração aplicada”, pois aplicar o comando
  não confirma a gravação local; o aviso e o rodapé informam a persistência real.
- Recuperação em 320, 390, 768, 1024 e 1440 px: confirmação explícita, foco em
  Cancelar, Escape e cancelamento preservam o original; confirmação guarda cópia
  verificada. A resolução agora devolve o foco ao conteúdo principal, pois o
  gatilho desaparece com o aviso.
- Falha de quota simulada apenas no contexto: valor original preservado e
  rodapé indica alterações válidas somente na sessão.
- PWA: service worker real do build anterior, atualização para o atual, duas
  abas, fechamento/reabertura e interrupção do download; matrizes com v7 e v8.
  O teste compara o módulo de entrada carregado antes/depois, reabre a aplicação,
  grava uma ação e recarrega offline, verificando dados e execução sem erros.

A estratégia `registerType: 'prompt'` não oferece interface de atualização.
O worker novo fica aguardando enquanto existe um cliente antigo. Recarregar a
mesma aba mantém o build antigo; fechar todos os clientes permite ativar o novo.
Uma instalação interrompida mantém o worker anterior funcional, e uma nova
tentativa completa a atualização. Não se usa `skipWaiting` forçado. Esses
resultados não abrangem remoção de caches pelo sistema operacional, todos os
navegadores ou todas as condições de hospedagem.
Os ensaios instalam e ativam o service worker em Chromium headless; não verificam
o diálogo de instalação do sistema operacional nem uma janela standalone instalada.

## Reproduzir

Preparar builds temporários, sem checkout nem alteração da `main`:

```bash
mkdir -p /tmp/life-rpg-final/previous /tmp/life-rpg-final/pre-trapezius
git archive 6b0d981 | tar -x -C /tmp/life-rpg-final/previous
git archive 43ddebbe | tar -x -C /tmp/life-rpg-final/pre-trapezius
ln -sT /home/allan/life-rpg/node_modules /tmp/life-rpg-final/previous/node_modules
ln -sT /home/allan/life-rpg/node_modules /tmp/life-rpg-final/pre-trapezius/node_modules
```

Em cada `apps/web` temporário, executar o binário Vite do workspace com `build`;
no repositório atual, executar `npm run build`. Com Vite rodando na porta padrão:

```bash
PLAYWRIGHT_MODULE=/tmp/life-rpg-muscle-tools/node_modules/playwright/index.mjs \
  node scripts/audit-storage-pwa.mjs
```

`PWA_PREVIOUS_DIST`, `PWA_LEGACY_DIST` e `AUDIT_OUTPUT` permitem caminhos
alternativos. Os caminhos padrão estão no script. A saída inclui capturas e
`results.json`, sem publicar conteúdo bruto das fixtures nos logs. O comando
retorna código 1 quando existe cenário falho, erro de página **ou bloqueio de
segurança**, mesmo que os demais cenários passem. Não desligar esse bloqueio
para obter aprovação.

## Riscos residuais revisados

- **B-03, cores:** as substituições da branch preservam tokens de pilares e de
  foco. Tons restantes de seletores/calendários, gradientes e superfícies são
  contextuais, como já explicado no [guia de cores](../design-system/colors.md).
  Não houve substituição global nem mudança da paleta para diminuir contagens.
- **B-12, dependências:** `npm audit` em 21/11/2026: 4 moderadas, 0 altas,
  0 críticas (`glob`, `minimatch`, `workbox-build`, `vite-plugin-pwa`). A consulta
  ao registro npm encontrou `vite-plugin-pwa` 2.0.0, `workbox-build` 7.4.1
  ainda com `glob ^11.0.1` e `glob` 14.0.6. A versão do glob corrigida sai da
  faixa do Workbox. `fixAvailable: true` no audit não comprova correção compatível
  dessa cadeia; não se aplicaram major, downgrade ou override forçado. O risco
  permanece na geração do service worker, não no bundle do navegador.
- **B-13, bundles:** base `6b0d981`: index 756,69 kB e LandscapeScene 555,69 kB;
  branch inicial: index aproximadamente 772 kB e LandscapeScene 555,69 kB.
  Ambos já ultrapassavam 500 kB. O aviso foi mantido e está documentado na
  [arquitetura](../architecture/README.md#tamanho-do-bundle). Não se atribui todo
  o peso da PWA à paisagem 3D: esse chunk é excluído do precache e obtido sob demanda.

O relatório externo dos 32 achados ainda não foi disponibilizado nesta sessão;
o nome informado pelo usuário é `colado(1).md`. Não é possível confirmar a
conclusão individual dos 32 itens sem esse documento. Os dois bloqueios acima
impedem declarar C-01/A-02 encerrados, independentemente dessa pendência.

## Preservação

Dados reais, `.env`, credenciais, endereço e portas de desenvolvimento foram
preservados. Todas as substituições de fixtures, simulações de quota, instalação
de worker e operações de recuperação aconteceram em contextos descartáveis.
Nenhuma migração destrutiva foi executada no navegador real.

## Verificações e limites de execução

- `npm run check`: aprovado no código final; 8 testes de padrões, 24 da API e
  602 do web, além de TypeScript, lint e build. Foram 634 testes no total.
- `npm run format:check` e `npm run standards:check`: aprovados.
- `npm run audit:visual`: aprovado na última revisão, com 364 capturas, zero
  erros de página e zero falhas de layout em 320, 390, 768, 1024 e 1440 px.
- `StorageProtection.test.tsx`: 9 testes aprovados, incluindo feedback que não
  promete gravação e retorno de foco depois da recuperação.
- `node scripts/audit-muscle-map.mjs`: 55 capturas, zero erros/falhas. Executado
  antes da última mudança textual de feedback, que não alterou o mapa.
- Matriz adicional de persistência/PWA: 19 cenários, 17 aprovados, 2 bloqueados,
  zero erros de página. Os dois bloqueios são os riscos documentados acima;
  o comando termina em código 1 e não está aprovado para publicação.
- Oito cenários de PWA passaram (v7/v8 × aberta, fechada/reaberta, duas abas,
  atualização interrompida). O navegador não disponibilizou WebGL para a
  auditoria de Estatísticas; o caminho 2D foi exercitado.
- A última repetição da matriz PWA/persistência, após trocar “Alteração salva”
  por “Alteração aplicada”, não foi executada: a solicitação de permissão foi
  recusada. A validação anterior inclui a correção de foco; a mudança textual
  final foi coberta pela suíte de integração. Não se declara a matriz aprovada
  no último build.
- Execuções iniciais falharam por `EPERM` nas portas dos testes HTTP, timeouts
  em testes web durante concorrência com auditorias e navegação abortada durante
  uma recarga do Vite. O `check` final foi executado fora do sandbox, sem
  auditorias concorrentes; nenhum timeout ou critério de teste foi relaxado.

Os checklists de implementação e revisão foram conferidos. A conclusão de
segurança, a revisão dos 32 achados externos e a publicação continuam pendentes.
Validações pós-merge e CI remoto desta branch não se aplicam ainda: nenhum
merge ou push foi realizado porque as condições de integração não foram atendidas.
