# Finanças

O armazenamento atual é v4 (quests personalizadas; dados financeiros preservados): a migração de progressão real preserva integralmente
os registros financeiros e o perfil. Referências a v2 abaixo documentam a
introdução das extensões financeiras, que continuam compatíveis em v4.

O módulo separa fluxo mensal, saldos líquidos, custo de aquisição e avaliação dos
investimentos. Valores monetários são centavos inteiros; BTC usa satoshis
(8 casas decimais), com multiplicação e rateio do custo em `BigInt` e
arredondamento ao centavo mais próximo. Na liquidação total, todo custo restante
é removido. Vendas de BTC não são limitadas ao valor originalmente investido.

## Organização e regras

- `types.ts`: contratos de contas, transferências, avaliações e cotações.
- `position.ts`: custo médio móvel e posição restante após vendas de BTC.
- `ledger.ts`: projeções puras de saldo, patrimônio e histórico.
- `calculations.ts`: resultado mensal e custo por categoria.
- `bitcoinQuote.ts`: cliente HTTP substituível e cache de uma hora.
- `useBitcoinQuote.ts`: atualização automática no ciclo de vida do aplicativo.
- `FinancesPage.tsx`, `MovementsPanel.tsx`, `InvestmentsPanel.tsx`,
  `InvestmentCard.tsx`, `CashLedgerPanel.tsx`, `FinancialChart.tsx` e
  `CategoryIcon.tsx`: apresentação e formulários.
- `financeForms.ts`: conversão dos formulários em registros/comandos (extraída
  sem alteração de regras). `investmentActions.ts`: ações por categoria.
  `historyFilters.ts`: filtros somente de leitura dos históricos.
- `../records/commands.ts`: validação e publicação atômica das alterações.

Resultado mensal = receitas − despesas do mês selecionado. Saldo de uma conta =
saldo de abertura + receitas − despesas − aportes + resgates + transferências
recebidas − transferências enviadas. O patrimônio soma os saldos líquidos ao
valor conhecido/estimado dos investimentos, sem adicionar o resultado mensal.
Transferências e avaliações não geram receitas/despesas nem XP.

O saldo inicial é o saldo **no início da data informada**. Somente operações
dessa data em diante alteram esse saldo. Para incluir todo o histórico,
escolha uma data anterior ao primeiro registro. Investimentos adquiridos antes
dessa abertura já existem à parte e não debitam novamente o dinheiro informado.
Saldos negativos são permitidos, pois podem representar contas devedoras;
eles não são truncados para zero.

Operações legadas sem `accountId` pertencem à conta `principal`. Sem a abertura
das contas necessárias, dinheiro disponível e patrimônio ficam pendentes.
Não há inferência de saldo a partir do resultado mensal.

Ativos manuais usam custo como referência enquanto não houver avaliação. Uma
avaliação informa o valor total da posição na data. Ela permanece como última
avaliação conhecida até uma nova operação e perde validade se as operações
avaliadas forem editadas ou excluídas (assinatura `basis`). Cadastre nova
avaliação após essas alterações. Na retirada de ativos manuais, o campo de custo
resgatado permite separar o custo do valor recebido; se omitido, ambos são iguais,
preservando a regra anterior. Em BTC, o custo resgatado é automático.

O gráfico principal mostra **Dinheiro disponível** por padrão, com Mensal
selecionado. Os botões Dinheiro disponível/Patrimônio total alternam o indicador
no mesmo gráfico. Patrimônio total inclui os investimentos; dinheiro disponível
usa somente saldos de contas e movimentações reais. Os botões Semanal/Mensal/Anual usam janelas móveis de
7/30/365 dias, incluindo hoje. `chartModel.ts` reaproveita `financialHistory` e
`financialSummary` sem alterar os cálculos ou o armazenamento.

O resumo mostra o indicador selecionado atual e a mudança entre a primeira e a última
amostra real do período, cujas datas aparecem abaixo do gráfico. A mudança inclui
entradas/saídas e não é rentabilidade. Oscilações de ativos afetam somente a
visão patrimonial, sem alterar o dinheiro disponível. Com menos de dois pontos não há comparação;
a porcentagem não é calculada sobre base zero ou negativa. Não são criados pontos
para o início do período, dias vazios ou datas anteriores à primeira observação.

A curva Bézier passa pelas amostras e limita seus controles aos segmentos, evitando
picos artificiais. Há cor de tendência, gradiente discreto, grade, destaque do
último ponto e animação desabilitada com `prefers-reduced-motion`. Datas iguais
continuam agregadas pela projeção financeira. Um único ponto fica centralizado,
sem linha. Estados vazios distinguem falta de saldo inicial de período sem eventos.

Toque, mouse e foco de teclado abrem um tooltip com data, patrimônio, disponível
e investimentos, sem tabela ou menu adicional. Setas, Home e End percorrem os
pontos; Escape fecha o tooltip. A largura é adaptada por `ResizeObserver`.
Investimentos sem avaliação continuam explicitamente identificados como referência
pelo custo; cotações históricas não são inventadas.

## Integração BTC/BRL

Endpoint público consultado sem credenciais:

```text
https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_last_updated_at=true
```

[Referência do endpoint CoinGecko](https://docs.coingecko.com/demo/reference/simple-price).
A resposta fornece `bitcoin.brl` e `bitcoin.last_updated_at` (segundos Unix).
O cliente valida números, horário e HTTP antes de aceitar a resposta. Guarda a
cotação em centavos, o horário da fonte (`updatedAt`) e o instante da observação
(`observedAt`). O histórico só aplica a cotação a partir da data em que foi
observada; nunca atribui a primeira cotação a compras anteriores.

A consulta começa quando há BTC na carteira, inclusive ao abrir Finanças com
uma posição existente. O monitor fica no `App`, então continua nas outras abas
enquanto o aplicativo estiver aberto. Consulta no máximo uma vez a cada 60
minutos por instância, compartilha requisições simultâneas e usa o cache salvo
em `records.finance.quotes` após recarga. O histórico guarda a última observação
real de cada dia, suficiente para os gráficos diários, evitando acumular
24 amostras por dia e descartar datas antigas. Há timeout de 15 segundos e limitação
de novas tentativas por uma hora inclusive em falhas/429. Não há polling em
segundo plano com o aplicativo fechado.

O acesso anônimo depende da disponibilidade e política do provedor; pode receber
bloqueio, limitação ou exigência de chave. Nesses casos a interface mantém a
última cotação identificada como desatualizada, ou o custo como referência se
não houver cotação. Nenhuma chave privada é enviada ao frontend. O cliente pode
ser substituído por um proxy de backend no futuro. Não há ordens, corretoras ou
negociação. Os testes HTTP usam respostas simuladas; não dependem de cotação ao
vivo nem consomem os limites do provedor.

## Compatibilidade e persistência

Mantida a chave `life-rpg:player-state` e a versão 2. A alteração é uma extensão
compatível: `records.finance` e as referências a contas são opcionais. Registros
v2 anteriores continuam válidos sem regravar ou modificar suas operações; a
extensão começa vazia quando o usuário cadastra os novos dados. A migração de
v1 para v2 permanece. Não existe conversão automática de categorias legadas
para Bitcoin, nem criação de saldos ou quantidades ausentes. `Outros` permanece
no armazenamento e aparece como “Outros investimentos” na seleção.

Os dados são salvos pelo adaptador de `localStorage` já existente. Novas
movimentações, edições e exclusões recalculam as projeções a partir dos registros.
Nenhuma fórmula de XP/nível ou Radar foi alterada. Aportes e retiradas continuam
na atividade financeira diária, com o limite e deduplicação existentes;
cotações, avaliações, aberturas de contas e transferências não geram XP.

## Verificação manual

1. Execute `nvm use` e `npm run dev:web`. Abra `/financas` no mesmo endereço usado
   anteriormente para manter o acesso ao armazenamento do navegador.
2. Abra “Contas, transferências e avaliações manuais” (na visão geral). Cadastre saldo inicial
   de R$ 1.000,00, com data anterior às operações do teste.
3. Cadastre uma caixinha selecionando **Nova compra ou aporte**, com R$ 200,00: disponível R$ 800,00,
   investimento R$ 200,00, patrimônio R$ 1.000,00, despesas inalteradas
   (em uma carteira sem outros registros). Avalie a caixinha em R$ 210,00:
   patrimônio R$ 1.010,00, custo ainda R$ 200,00.
4. Cadastre outra conta com abertura zero e transfira R$ 100,00 entre as contas.
   Confira os saldos por conta e patrimônio total sem alteração.
5. Registre receita R$ 10,00 e despesa R$ 5,00: resultado mensal R$ 5,00,
   sem confundir esse valor com todo o dinheiro disponível.
6. Cadastre Bitcoin selecionando **Nova compra ou aporte**, com R$ 200,00 e `0,002` BTC. Registre uma retirada/venda de
   `0,001` BTC por R$ 150,00. Restam `0,00100000` BTC com custo R$ 100,00;
   o dinheiro disponível aumenta R$ 150,00 sem receita artificial.
7. Edite e exclua operações, alterne Semanal/Mensal/Anual e consulte os pontos
   por mouse, toque ou teclado. Uma retirada maior que os BTC disponíveis deve ser rejeitada.
8. Confira a cotação, horário e estimativa. Simule modo offline e aguarde a próxima
   tentativa para conferir o aviso e a conservação da última cotação conhecida.
9. Recarregue e navegue entre os quatro pilares, Estatísticas e Radar. Confira
   recuperação dos dados e ausência de XP adicional por cotações/transferências.

Testes automatizados em `ledger.test.ts`, `bitcoinQuote.test.ts` e
`FinancesPage.test.tsx`, além das suítes existentes dos quatro pilares, navegação,
XP/Radar, armazenamento e migração. Execute `npm run check` (Node da `.nvmrc`).
Os testes HTTP da API precisam de permissão para abrir uma porta local.

## Arquivos desta entrega

Criados neste módulo: `position.ts`, `ledger.ts`, `bitcoinQuote.ts`,
`useBitcoinQuote.ts`, `CashLedgerPanel.tsx`, `FinancialChart.tsx`,
`CategoryIcon.tsx`, `ledger.test.ts`, `bitcoinQuote.test.ts` e
`FinancesPage.test.tsx`.

Modificados: `types.ts`, `calculations.ts`, `FinancesPage.tsx` e este `README.md`;
`../records/types.ts`, `../records/commands.ts`, `../records/metrics.ts`;
`../../app/App.tsx`; `../../shared/components/Icon.tsx`;
`../../shared/styles/index.css`; `../../shared/storage/README.md`; e o `README.md`
da raiz; `docs/four-pillars.md`, `docs/architecture.md` e `docs/product.md`.
Não foram adicionadas dependências.

Reformulação do gráfico: `FinancialChart.tsx`, `chartModel.ts`,
`FinancialChart.test.tsx`, `chartModel.test.ts`, `FinancesPage.test.tsx` e os estilos
em `shared/styles/index.css`. Testes cobrem períodos, patrimônio, transferências,
variação positiva/negativa/nula, base zero/negativa, curvas, datas iguais, vazio,
ponto único, tooltip, teclado e atualização após exclusões.

## Exclusão de contas e redefinição

Cada conta oferece Editar e Excluir. A exclusão abre um diálogo com foco inicial
em Cancelar e não altera dados até a confirmação. Vínculos legados sem `accountId`
pertencem à conta principal. O diálogo lista as quantidades de receitas/despesas,
investimentos, operações, transferências e avaliações afetadas. Havendo vínculos,
o usuário precisa marcar a confirmação explícita antes de executar a exclusão.

Investimentos são posições únicas, que podem conter aportes e retiradas em contas
diferentes. Excluir uma conta remove integralmente os investimentos que possuem
operações nessa conta, incluindo operações em outras contas e avaliações vinculadas.
O diálogo informa os nomes dos investimentos e avisa sobre operações compartilhadas.
Isso evita deixar vendas órfãs ou uma base de custo inconsistente. Investimentos
sem vínculo e os demais dados das contas restantes são preservados.

Transferências envolvendo a conta são removidas por inteiro: débito e crédito
somem juntos. Os saldos das outras contas são recalculados com o histórico restante,
sem transformar as transferências em receitas ou despesas. Cotações são conservadas
quando ainda há BTC; ao remover a última posição BTC, o histórico de cotações é limpo.

A seção separada “Configurações financeiras” contém “Redefinir dados financeiros”.
O diálogo informa que a ação é irreversível e exige `ZERAR` exato (maiúsculas e sem
espaços). O comando valida a confirmação novamente. A redefinição limpa contas,
aberturas, receitas/despesas, investimentos, BTC, aportes/resgates, transferências,
avaliações e cotações. Não chama `localStorage.clear()` nem muda a chave/versão:
o adaptador existente salva o estado completo preservando os demais pilares e Perfil.

XP e Radar continuam derivados dos registros restantes, com deduplicação diária.
As recompensas dos registros financeiros removidos deixam de participar do cálculo;
as missões e o legado demonstrativo independentes desses registros permanecem.
Respostas de cotação atrasadas não recriam o histórico após a redefinição.

Implementação em `management.ts`, `FinancialConfirmation.tsx`,
`FinancialSettings.tsx`, `CashLedgerPanel.tsx`, `FinancesPage.tsx` e nos comandos de
registros. `App.tsx` usa os registros mais recentes ao aplicar comandos assíncronos.
Testes em `management.test.ts` e `FinancialManagement.test.tsx` cobrem confirmação,
cancelamento, contas vazias, dados legados, posições compartilhadas, transferências,
patrimônio/gráfico, XP/Radar, preservação dos outros pilares, recarga e cotação pendente.

Para verificar: exclua uma conta pelo botão ao lado de Editar e examine os vínculos
antes de confirmar. Em Configurações financeiras, teste cancelar a redefinição,
digitar `zerar` (não deve habilitar o botão) e confirmar com `ZERAR`. Recarregue e
confira que os outros pilares e Perfil permanecem.

## Máscaras monetárias, BTC/sats e Dólar (USD)

Todos os campos monetários (receitas/despesas, aberturas, aportes/resgates,
transferências, preços unitários e avaliações) usam `MoneyInput.tsx`. A máscara
é de centavos: `125050` vira `R$ 1.250,50`; em USD, `10000` vira `US$ 100,00`.
O valor se atualiza durante a digitação, aceita colagem de valores formatados,
seleção/substituição e limpeza completa. Letras e valores acima do limite são
rejeitados. O cursor mantém a quantidade de dígitos à sua direita, e apagar junto
a um separador remove o dígito correspondente. Saldos iniciais admitem negativos.
O teclado móvel é numérico; quantidades de ativos não recebem máscara de reais.

A apresentação é um campo controlado; um campo oculto envia o decimal canônico
para `FormData`. `monetary.ts` centraliza formatação, máscara e conversões decimais
por inteiros/BigInt. O armazenamento continua em centavos, sem símbolos ou
separadores de milhares. A máscara não modifica a interpretação dos dados antigos.

`BitcoinQuantity.tsx` mantém a quantidade em satoshis inteiros. A unidade pode ser
BTC (até oito casas, vírgula ou ponto) ou sats (inteiros com milhares separados).
`100.000 sats = 0,00100000 BTC`. Alternar a unidade só muda a apresentação; compras,
vendas e edições continuam usando a mesma quantidade. Para compatibilidade com v2,
o campo persistido `quantity` mantém o contrato numérico em BTC; as conversões
para satoshis são feitas antes dos cálculos, como nas posições existentes.

A categoria **Dólar (USD)** usa quantidades com duas casas decimais, apresentadas
como `US$`. Compras informam o valor efetivamente pago em reais e debitam a conta;
vendas informam a quantidade vendida e o valor recebido, creditando a conta. O
custo da parcela vendida é proporcional ao custo médio, com rateio em BigInt e
arredondamento ao centavo. Isso não cria receitas ou despesas de consumo.

Ao selecionar **Investimento que já possuo**, o formulário permite uma
**posição já existente**, sem débito de conta, com custo conhecido ou desconhecido
(`costUnknown: true` quando o custo não é informado). A quantidade
é preservada; quando o custo não é informado, custo médio e valorização não são informados enquanto o custo
for desconhecido. O total aportado é apenas o conhecido. Sem cotação e sem custo,
o patrimônio fica pendente: não se inventa preço zero ou uma avaliação histórica.
A aquisição deve ser anterior ao saldo inicial quando o usuário informar uma
abertura que já exclui o dinheiro usado na compra, conforme a regra das contas.

### Fonte USD/BRL e suas limitações

Fonte: Banco Central do Brasil, serviço público PTAX/Olinda, sem chave privada.

- [Documentação oficial dos boletins e campos](https://www.bcb.gov.br/conteudo/dadosabertos/BCBDepin/gnastportal-dados-abertostaxas-de-cambio---todos-os-boletins-diarios.pdf).
- [Metodologia da taxa de referência PTAX](https://www.bcb.gov.br/conteudo/relatorioinflacao/EstudosEspeciais/EE042_A_taxa_de_cambio_de_referencia_Ptax.pdf).

`usdQuote.ts` consulta `CotacaoMoedaPeriodo` com `@moeda='USD'`, filtro
`tipoBoletim eq 'Fechamento'`, ordenação por `dataHoraCotacao desc` e `$top=1`.
A busca cobre os últimos 15 dias para encontrar a última publicação disponível,
incluindo finais de semana/feriados, usando as datas no fuso de São Paulo.
O valor usado é `cotacaoVenda`, guardado em inteiros com **quatro casas decimais**
(`rateUnits`). O horário da fonte é interpretado em Brasília (UTC−3 na janela
atual). A conversão usa centavos de USD × taxa / 10.000 e arredonda só o valor
final em centavos de BRL. Não se reduz a taxa prematuramente a dois decimais.

É referência de fechamento do câmbio comercial, **não dólar turismo nem preço
executável em tempo real**. Não inclui spread, tarifas ou impostos. Pode refletir
o último dia útil. A interface mostra a data/hora da fonte e identifica referência
com mais de 60 minutos como desatualizada, mesmo se foi consultada recentemente.
O formulário também consulta a referência para prévia antes da primeira compra,
sem gravar histórico enquanto é apenas um rascunho. O cliente compartilha cache
e requisições com o monitor do aplicativo.
A consulta automática ocorre a cada 60 minutos com USD na carteira, inclusive fora
da tela de Finanças. Há cache persistido, compartilhamento de requisições,
timeout de 15 segundos e espera de uma hora após erros. Nenhum preço de exemplo é
usado pelo aplicativo. Sem publicação nos 15 dias ou em falha HTTP/CORS/rede, a
última referência é mantida; sem referência, usa-se o custo conhecido identificado
como referência ou marca-se o patrimônio pendente. Os testes de integração usam
respostas simuladas e não certificam a disponibilidade ao vivo do provedor.

`useUsdQuote.ts` funciona independentemente de BTC/BRL. `records.finance.usdQuotes`
é uma extensão **opcional da versão 2**, com a última observação real de cada dia.
Registros v1/v2 anteriores continuam válidos, sem reescrita das quantidades ou
custos existentes. Cotações USD só afetam datas a partir da observação, sem preços
retroativos. Redefinir Finanças também remove USD/cotações; excluir a última
posição USD limpa sua referência. Oscilações cambiais não dão XP nem alteram a
consistência do Radar; os demais pilares e fórmulas de progressão permanecem.

### Arquivos desta melhoria

Criados em `modules/finances`: `monetary.ts`, `MoneyInput.tsx`,
`BitcoinQuantity.tsx`, `InvestmentFields.tsx`, `usdQuote.ts`, `useUsdQuote.ts`,
`currencyInputs.test.tsx`, `usd.test.ts` e `CurrencyFlow.test.tsx`.

Modificados no módulo: `FinancesPage.tsx`, `CashLedgerPanel.tsx`, `types.ts`,
`position.ts`, `ledger.ts`, `calculations.ts`, `management.ts`, `CategoryIcon.tsx`,
`FinancialChart.tsx`, `FinancesPage.test.tsx` e este README. Fora do módulo:
`records/{form,types,commands}.ts`, `app/App.tsx`, `app/Pillars.test.tsx`,
`shared/components/Icon.tsx` e `README.md` da raiz. Sem novas dependências.

### Como verificar no navegador

1. `nvm use` e `npm run dev:web`; abra `/financas` no mesmo endereço dos dados
   anteriores. Confira a recuperação dos registros antigos.
2. Em receitas/despesas, digite `125050`: deve aparecer `R$ 1.250,50`. Cole um
   valor formatado, selecione/substitua dígitos, edite o meio e apague tudo.
   Salve e reabra para conferir a máscara e o valor persistido.
3. Cadastre Bitcoin e escolha sats. Digite `100000`, alterne para BTC e confira
   `0,00100000`. Informe o valor investido e salve. Reabra a operação em sats:
   devem continuar `100.000`. Repita com 1 sat e uma venda parcial.
4. Cadastre Dólar (USD), selecione **Nova compra ou aporte** e informe `10000` na quantidade (US$ 100,00) e o valor
   pago em reais. Consulte a referência PTAX e seu horário. Compare o saldo da
   conta, posição, custo e patrimônio, sem alteração das despesas.
5. Registre uma venda parcial de USD, preenchendo quantidade e reais recebidos;
   confira a redução proporcional do custo. Edite, exclua e recarregue.
6. Para uma posição existente, selecione **Investimento que já possuo**. Sem
   custo conhecido, deixe o custo original vazio:
   não há débito na conta nem lucro/custo médio inventados.
7. Teste offline na próxima consulta: a última referência deve permanecer
   identificada pelo horário/desatualização, sem bloquear as operações manuais.
   A atualização automática de cotações não deve gerar XP adicional.

## Posições iniciais, correção de compras e gráfico de saldos

O cadastro de investimento agora oferece **Investimento que já possuo** e
**Nova compra ou aporte** para todas as categorias. O cadastro inicia na opção
preexistente; o formulário de aportes/retiradas inicia em compra real. A opção
preexistente grava `positionInitial: true`, não solicita conta, não debita saldos
e não gera atividade/XP de compra. A quantidade, custo original e data são
independentes dessa decisão. Sem data original, grava-se a data real do cadastro
com `acquisitionDateUnknown: true`, identificada no histórico como registro, sem
inventar uma data de aquisição. Custos desconhecidos também são opcionais em todas
as categorias; sem cotação/avaliação e sem custo, o patrimônio fica pendente.

Compras e aportes reais continuam debitando a conta conforme a data e a abertura
cadastradas. O saldo inicial de uma conta representa o início de sua data; operações
anteriores à abertura já estão fora do período desse saldo. Não é necessário
retroceder a data de um investimento preexistente para evitar um débito: o tipo de
registro controla explicitamente isso. Vendas e retiradas posteriores continuam
creditando a conta e respeitando a posição/custo disponíveis.

O custo da posição inclui patrimônio inicial e compras posteriores, preservando o
custo médio. Totais separam custo inicial conhecido e novos aportes de dinheiro.
O histórico distingue posições iniciais de aportes/resgates. Posições iniciais não
são despesas nem receitas e não participam de XP/Radar como novas atividades.
Missões, legado demonstrativo e atividades reais independentes permanecem.

Para corrigir uma compra cadastrada incorretamente, use **Corrigir como posição
inicial** no histórico. O diálogo exige **Confirmar conversão**: o comando altera
somente o marcador da operação existente, preservando ID, data, quantidade, custo
e compras/vendas posteriores. Isso reverte o débito indevido na projeção da conta,
sem criar receita nem duplicar ativos. A edição do Tipo de registro também exige
esse diálogo ao converter uma compra; alterações nos campos são explicitamente
informadas antes de salvar. Converter de volta para compra pela edição restaura
o débito real. Exclusões e validações de vendas superiores ao saldo permanecem.

A versão 2 continua, com campos opcionais. Registros antigos sem o marcador
mantêm o comportamento anterior e não são convertidos automaticamente. A exceção
compatível é a posição USD antiga de custo desconhecido: ela já tinha semântica
preexistente, sem débito, e mantém essa interpretação sem reescrever os dados.
A migração v1 e os outros pilares não foram alterados.

O gráfico mantém Semanal/Mensal/Anual e amostras nas datas reais. Cotações nunca
são atribuídas a datas anteriores à observação. A troca entre as duas visões é
imediata; Dinheiro disponível permanece acessível mesmo quando uma avaliação de
investimento necessária para o patrimônio está pendente. Não há um segundo gráfico
nem soma do resultado mensal ao patrimônio.

### Arquivos e validação desta correção

Criados: `initialPosition.ts`, `initialPosition.test.ts` e
`InitialPositionFlow.test.tsx`. Modificados no módulo: `types.ts`, `position.ts`,
`ledger.ts`, `management.ts`, `InvestmentFields.tsx`, `FinancesPage.tsx`,
`chartModel.ts`, `FinancialChart.tsx`, os testes de FinancesPage/FinancialChart/USD
/CurrencyFlow e este README. Também foram atualizados
`records/{types,commands,progression}.ts`, `app/Pillars.test.tsx`,
`shared/styles/index.css` e o `README.md` da raiz. Sem novas dependências.

Testes cobrem o exemplo obrigatório de R$ 200,00 disponíveis, custo BTC R$ 239,54,
valor estimado R$ 238,90 e patrimônio R$ 438,90; compra posterior de R$ 50,00,
conversão confirmada/cancelada, custo médio com vendas posteriores, todas as
categorias, ausência de custo/data, XP/Radar, persistência v2, compatibilidade e
troca de visualização/períodos. Valores de cotação dos testes são simulados; o
aplicativo usa as integrações reais já existentes.

Para verificar no navegador, cadastre saldo inicial de R$ 200,00. Em Bitcoin,
selecione Investimento que já possuo, informe `0,00061258 BTC`, custo `23954`
(a máscara mostra R$ 239,54) e a data original se conhecida. O disponível deve
continuar R$ 200,00; o patrimônio será R$ 200,00 mais a avaliação atual real do BTC,
que pode diferir do valor ilustrativo R$ 238,90. Em Aportes e retiradas, registre
uma compra real de R$ 50,00: o disponível deve passar a R$ 150,00. Para um registro
antigo incorreto, teste cancelar e confirmar Corrigir como posição inicial,
confira a reversão e recarregue a página. Alterne Dinheiro disponível/Patrimônio
total e os três períodos para conferir as projeções independentes.

## Caixinhas bancárias: saldo real e rendimento manual

Caixinhas usam as mesmas posições/aportes/resgates existentes, com campos
opcionais `institution` e `cdiPercentBasisPoints` no investimento. O percentual é
armazenado com duas casas de precisão (100% = 10.000 pontos), entre 0 e 1.000%,
e representa apenas o contrato informado. Não se pede CDI atual e não há consulta
de taxas, juros automáticos, tributação ou rendimento fictício.

No cadastro, selecione **Caixinhas bancárias**, informe nome, custo aplicado e
se é posição preexistente ou aporte real. Instituição e percentual do CDI são
opcionais. Informe também o saldo exibido pelo banco e sua data, se disponíveis.
O saldo inicial é gravado como `initialValuation` atomicamente com o investimento
e a operação, sem transformar diferença de avaliação em dinheiro movimentado.
A data do saldo não pode anteceder a aplicação/registro da caixinha.

O cartão de cada caixinha mostra total aplicado conhecido (posição inicial mais
aportes), retiradas, custo restante, saldo e data da última informação do banco.
**Atualizar saldo** abre um formulário com máscara de reais e data. Salvar cria
uma avaliação, preservando as avaliações anteriores, operações e o saldo bancário.
A edição/exclusão dessas avaliações também está disponível em “Contas,
transferências e avaliações manuais”. Editar/excluir o investimento continua na
carteira, com preservação das regras de integridade dos aportes/resgates.

`Rendimento acumulado = saldo − custo restante`, apenas quando o custo é conhecido
e o usuário confirma que todos os aportes/retiradas estão registrados. Sem essa
conferência, o cartão usa **Diferença saldo/custo** e avisa que a diferença não
comprova rendimento: pode haver movimentações ausentes. Com custo desconhecido,
o rendimento permanece pendente. O saldo é exatamente o informado pelo usuário;
não se presume se o banco apresentou valor bruto ou líquido. O percentual do CDI
não participa dessa conta.

`projectBoxBalance`, em `savingsBox.ts`, projeta a última avaliação real somando
aportes e subtraindo retiradas registrados depois dela. A assinatura `basis`
permite distinguir novas operações na mesma data. O cartão identifica esse valor
como **Saldo após movimentações registradas**, sem acrescentar juros posteriores,
e solicita atualização com o saldo real. Isso conserva a diferença de avaliação
já registrada, inclusive juros remanescentes quando o principal foi resgatado.
Resgates com rendimento podem informar o custo da parcela resgatada separadamente
do valor recebido, pelo campo existente de custo de aquisição resgatado.

Editar/excluir uma operação que já fazia parte da avaliação, inserir operações
retroativas ou acrescentar uma posição inicial não incluída no saldo invalida essa
projeção: o valor informado anteriormente fica preservado e visível, enquanto o
total usa o custo como referência até nova conferência. Uma avaliação nova ancora
novamente o saldo às operações atuais. Para os demais ativos manuais permanece a
regra de exigir nova avaliação depois de movimentos; BTC e USD não foram alterados.

Somente aportes/resgates reais movimentam a conta. Caixinhas preexistentes não
causam débito. Avaliações e rendimentos não viram receita mensal, transferência,
XP ou esforço no Radar. O patrimônio e sua curva usam o saldo da caixinha; a visão
Dinheiro disponível continua independente. Aberturas, transferências e os quatro
pilares permanecem nas projeções existentes.

Os novos campos são extensões opcionais do formato v2. Caixinhas anteriores
continuam válidas sem reescrever suas posições; avaliações sem confirmação não
são rotuladas automaticamente como rendimento. Migração v1, localStorage e
redefinição financeira continuam funcionando. Nenhuma dependência foi adicionada.

### Preparação para CDI futuro

O contrato está separado das avaliações reais, e a projeção manual não recebe
taxas externas. Um futuro serviço poderá consumir séries históricas DI/CDI,
calendário de dias úteis e datas de aplicação/resgate para produzir uma estimativa
separada, com indicação de bruto/líquido e impostos, comparando-a à avaliação real.
Essa estimativa não deve sobrescrever o saldo informado. Nenhum cliente CDI,
série histórica, calendário financeiro ou fórmula de juros foi implementado agora.

### Arquivos e verificação

Criados: `savingsBox.ts`, `SavingsBoxFields.tsx`, `SavingsBoxCard.tsx`,
`savingsBox.test.ts` e `SavingsBox.test.tsx`. Atualizados no módulo: `types.ts`,
`ledger.ts`, `FinancesPage.tsx`, `InvestmentFields.tsx`, `CashLedgerPanel.tsx` e
este README; também `records/{types,commands}.ts`, `shared/styles/index.css` e o
README da raiz.

Os testes cobrem várias instituições, posição inicial, aporte real, resgates,
principal zerado com juros restantes, atualização/edição/exclusão do saldo,
custo preservado, patrimônio/gráficos, conta/XP/Radar inalterados por avaliação,
mesmo dia, invalidação por edição, atomicidade, compatibilidade v2 e recarga.

Para testar no navegador:

1. Execute `nvm use` e `npm run dev:web`; abra `/financas` no endereço habitual.
2. Cadastre uma caixinha que já possui com custo R$ 1.000,00, saldo R$ 1.008,00,
   instituição e contrato 100% do CDI. A conta não deve ser debitada. Sem marcar
   conferência das operações, o cartão deve mostrar diferença R$ 8,00; com a
   conferência, rendimento acumulado R$ 8,00.
3. Clique **Atualizar saldo**, informe R$ 1.015,00 e a data, confira as operações
   e salve. O custo continua R$ 1.000,00 e a diferença passa a R$ 15,00; conta,
   receitas/despesas e XP ficam iguais. O patrimônio aumenta R$ 7,00.
4. Em Aportes e retiradas, selecione a caixinha e registre um aporte real de
   R$ 100,00. A conta cai R$ 100,00; custo/saldo projetado aumentam R$ 100,00,
   sem criar rendimento novo. Depois, registre um resgate e confira os saldos.
5. Cadastre outra caixinha de outro banco, edite a instituição e atualize os
   saldos separadamente. Recarregue para conferir a persistência.
6. Edite uma operação anterior ao saldo informado: o cartão deve pedir nova
   conferência. Atualize novamente com o valor real do banco e confira a curva
   patrimonial, sem efeitos artificiais em Dinheiro disponível.

## Seleção de opções

Todos os campos de seleção usam o `shared/components/CustomSelect`: tipo de
movimentação, contas de origem/destino, categoria, investimento, operação,
posição inicial/compra, ativo avaliado e unidade BTC/sats. Não há `<select>` nativo.
Rótulos, IDs/valores de formulário, padrões e recálculos foram preservados;
listas suportam teclado, clique fora e viewport móvel. A troca não altera saldos,
transferências, carteira, XP nem o envelope v4. Consulte os testes de fluxos e
`app/SelectControls.test.tsx` para seleção, correção e recarga.

## Organização da página e ações nos cartões

A página tem três partes. A **visão geral** (mês, receitas/despesas, dinheiro
disponível, investimentos, patrimônio, custos, gráfico e contas) fica sempre no
topo. Abaixo, as abas **Movimentações** e **Investimentos** (`FinanceTabs`,
teclado com setas/Home/End) mostram uma área por vez. “Configurações financeiras”
permanece ao final. Nenhuma fórmula, comando ou formato de armazenamento mudou.

**Movimentações:** “Nova movimentação” abre o formulário existente (mesmos campos e
validações). Salvar fecha o formulário e recalcula os indicadores; cancelar fecha
sem gravar. “Histórico de movimentações” começa recolhido e filtra por mês (o
mesmo estado de “Mês financeiro”), tipo, conta (registros sem conta pertencem à
principal) e categoria, com carregamento progressivo de 20 em 20.

**Investimentos:** totais por categoria, “Novo investimento” (cadastro existente,
sob demanda), carteira em cartões e “Histórico de investimentos” recolhido, com
filtros de investimento, categoria, tipo de operação (compra/aporte,
venda/retirada, posição inicial) e período. Editar, excluir e “Corrigir como
posição inicial” continuam no histórico.

| Categoria            | Ações do cartão                                 |
| -------------------- | ----------------------------------------------- |
| Caixinhas bancárias  | Aportar, Retirar, Atualizar saldo, Editar       |
| Bitcoin              | Comprar mais, Vender, Atualizar cotação, Editar |
| Dólar (USD)          | Comprar, Vender, Atualizar cotação, Editar      |
| Ações e FIIs         | Comprar mais, Vender, Editar                    |
| Renda fixa           | Aportar, Resgatar, Editar                       |
| Outros investimentos | Aportar, Retirar, Editar                        |

Aportar/Comprar/Retirar/Vender/Resgatar abrem, dentro do próprio cartão, o mesmo
formulário de aportes e retiradas (`InvestmentFields` + `entryFromForm`) com o
investimento fixado (campo oculto `investmentId`) e a operação definida
(`defaultKind` + `lockKind`). Os campos específicos (BTC/sats, USD, quantidade e
preço, custo resgatado, conta) e o comando `saveInvestmentEntry` são os existentes;
por isso aportes debitam e retiradas creditam a conta, sem receita/despesa nem
alteração artificial do patrimônio. “Atualizar saldo” reutiliza a avaliação manual
da caixinha. “Atualizar cotação” chama `fetchBitcoinQuote`/`fetchUsdQuote`, que já
respeitam cache de 60 minutos, requisições compartilhadas, timeout e espera após
falhas: com cache válido informa o horário e quando nova consulta será possível;
em falha mantém a última cotação e avisa que pode estar desatualizada. Só a
cotação é gravada. “Editar” abre o cadastro em modo de edição. “Ver detalhes”
mostra preço médio (BTC/USD), composição do custo, última avaliação, fonte da
cotação, três operações recentes e “Excluir investimento”.

Exclusões de movimentações, operações e investimentos passam a pedir confirmação
(`DeleteConfirmation`). Formulários guardam um bloqueio após o primeiro envio
bem-sucedido, evitando registros duplicados por cliques repetidos.

### Limitações conhecidas

- Ações e FIIs não têm quantidade rastreada na posição: vendas continuam usando
  valor recebido (e custo resgatado opcional), sem quantidade vendida, e não há
  preço médio por unidade. Mudar isso altera regras de posição e exige tarefa própria.
- Rótulos dos campos permanecem os existentes (“Valor da operação (R$)”), mesmo
  quando a operação é venda ou resgate.
- Renda fixa e Outros não possuem cotação; o valor segue a última avaliação manual
  registrada em “Contas, transferências e avaliações manuais”.
