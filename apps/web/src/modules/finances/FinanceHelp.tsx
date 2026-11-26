import type { ReactNode } from 'react';
import { ContextHelp } from '../../shared/components/ContextHelp';

/**
 * Textos das ajudas contextuais de Finanças, num só lugar. Explicam conceitos
 * conforme os cálculos reais (`ledger.ts`, `position.ts`, `budget.ts`,
 * `recurrence.ts`); informações necessárias para operar continuam visíveis
 * na interface.
 */
const topics = {
  cash: {
    title: 'Saldo disponível',
    body: (
      <>
        <p>
          Dinheiro disponível na Carteira, considerando as movimentações que
          afetam o saldo: receitas, despesas e aportes ou retiradas vinculados à
          Carteira.
        </p>
        <p>
          Acumula todo o histórico e não depende do mês selecionado no Período.
          Recorrências só entram depois de confirmadas.
        </p>
      </>
    ),
  },
  income: {
    title: 'Receitas do mês',
    body: (
      <p>
        Entradas registradas no mês selecionado em Período. Retiradas de
        investimentos enviadas à Carteira não contam como receita.
      </p>
    ),
  },
  expense: {
    title: 'Despesas do mês',
    body: (
      <p>
        Gastos registrados no mês selecionado. Aportes em investimentos são
        transferências internas e não contam como despesa de consumo.
      </p>
    ),
  },
  result: {
    title: 'Resultado mensal',
    body: (
      <p>
        Diferença entre as receitas e as despesas do mês selecionado. Não é o
        saldo disponível, que acumula todo o histórico.
      </p>
    ),
  },
  chart: {
    title: 'Evolução financeira',
    body: (
      <>
        <p>
          <strong>Saldo disponível</strong> mostra a Carteira: receitas,
          despesas, aportes e retiradas reais. Posições iniciais e oscilações
          dos investimentos não o alteram.
        </p>
        <p>
          <strong>Patrimônio total</strong> soma o saldo disponível e o valor
          dos investimentos. A mudança inclui entradas e saídas de dinheiro e
          não representa rentabilidade.
        </p>
        <p>
          Semanal, Mensal e Anual usam os últimos 7, 30 e 365 dias, com
          intervalo próprio, independente do Período. Toque, passe o mouse ou
          use as setas para ver cada ponto.
        </p>
      </>
    ),
  },
  upcoming: {
    title: 'Próximas movimentações',
    body: (
      <ul>
        <li>
          Uma recorrência é uma receita ou despesa prevista: não altera saldo,
          orçamento nem XP.
        </li>
        <li>
          Confirmar registra a movimentação real (data e valor podem ser
          ajustados); confirmar de novo não duplica.
        </li>
        <li>Dispensar ignora aquela ocorrência, sem criar movimentação.</li>
        <li>
          Pausar suspende as novas ocorrências até reativar; pendências
          anteriores à pausa continuam disponíveis.
        </li>
        <li>
          Encerrar interrompe a regra; as movimentações já confirmadas ficam no
          histórico.
        </li>
        <li>
          A lista mostra as vencidas e as dos próximos 30 dias. No dia 29, 30 ou
          31, meses mais curtos usam o último dia.
        </li>
      </ul>
    ),
  },
  budget: {
    title: 'Orçamento mensal',
    body: (
      <>
        <p>
          Um limite define quanto você pretende gastar por mês em uma categoria
          de despesa. Ele vale do mês em que foi definido em diante, até ser
          alterado ou removido; meses anteriores mantêm o limite que tinham.
        </p>
        <p>
          O valor utilizado soma as despesas registradas no mês com a mesma
          categoria. Receitas, recorrências ainda não confirmadas e aportes em
          investimentos não entram.
        </p>
        <p>
          O percentual é o valor utilizado dividido pelo limite. A partir de 80%
          o estado é de atenção; a partir de 100%, limite atingido. Nenhuma
          despesa é bloqueada.
        </p>
      </>
    ),
  },
  history: {
    title: 'Histórico de movimentações',
    body: (
      <ul>
        <li>Mostra as receitas e despesas do mês selecionado em Período.</li>
        <li>
          Repetir abre uma nova movimentação com os mesmos dados e a data de
          hoje; nada é salvo até você confirmar.
        </li>
        <li>Editar altera o registro; Excluir pede confirmação.</li>
        <li>
          A pesquisa procura na descrição e na categoria, sem diferenciar
          acentos, e se soma aos filtros de tipo e categoria.
        </li>
        <li>
          Internas lista aportes e retiradas que movimentaram a Carteira. Eles
          não são receitas nem despesas e são gerenciados na aba Investimentos.
        </li>
      </ul>
    ),
  },
  categories: {
    title: 'Categorias recentes',
    body: (
      <p>
        Atalhos para as até cinco categorias usadas mais recentemente neste tipo
        de movimentação. Você também pode escolher outra categoria existente ou
        digitar uma nova.
      </p>
    ),
  },
  repeat: {
    title: 'Repetir periodicamente',
    body: (
      <p>
        Registra esta movimentação e cria uma recorrência semanal, mensal ou
        anual a partir da data informada. As próximas ocorrências ficam em
        Próximas movimentações e só alteram o saldo quando confirmadas.
      </p>
    ),
  },
  recurrenceForm: {
    title: 'Recorrência',
    body: (
      <>
        <p>
          Cadastrar a regra não altera o saldo. A primeira ocorrência pode ser
          futura.
        </p>
        <p>
          Alterações valem para as ocorrências ainda não confirmadas; as
          movimentações já confirmadas não mudam. No dia 29, 30 ou 31, meses
          mais curtos usam o último dia.
        </p>
      </>
    ),
  },
  investmentsValue: {
    title: 'Valor dos investimentos',
    body: (
      <p>
        Soma do valor de cada investimento: cotação mais recente (Bitcoin,
        dólar, ações e FIIs com ticker), saldo informado das caixinhas ou última
        avaliação manual válida. Sem essas informações, usa o custo de aquisição
        como referência.
      </p>
    ),
  },
  wealth: {
    title: 'Patrimônio financeiro total',
    body: (
      <p>
        Saldo disponível mais o valor dos investimentos. Aportes vinculados à
        Carteira já saíram do saldo, então nada é contado duas vezes; aportes
        com dinheiro externo aumentam o patrimônio.
      </p>
    ),
  },
  cost: {
    title: 'Custo de aquisição atual',
    body: (
      <p>
        Quanto custaram as posições que você ainda mantém: posições iniciais e
        aportes, menos o custo da parte vendida ou resgatada. Fica parcialmente
        desconhecido quando alguma posição não tem custo informado.
      </p>
    ),
  },
  contributed: {
    title: 'Total aportado conhecido',
    body: (
      <p>
        Soma das compras e aportes registrados no histórico, sem as posições
        iniciais. Considera apenas os valores informados.
      </p>
    ),
  },
  withdrawn: {
    title: 'Resgates e retiradas',
    body: (
      <p>
        Soma dos valores recebidos em vendas, resgates e retiradas registrados,
        enviados ou não para a Carteira.
      </p>
    ),
  },
  investmentCharts: {
    title: 'Gráficos de investimentos',
    body: (
      <>
        <p>
          <strong>Evolução</strong>: patrimônio total ao longo do tempo (a visão
          de saldo disponível segue no mesmo gráfico).
        </p>
        <p>
          <strong>Distribuição dos investimentos</strong>: mostra como o valor
          dos seus investimentos está dividido entre as categorias. Cada fatia
          representa a participação daquela categoria no total investido, pelo
          mesmo valor usado em Valor dos investimentos (o saldo da Carteira não
          entra). Toque, passe o mouse ou use a legenda para ver valor e
          percentual.
        </p>
        <p>
          <strong>Custo × valor</strong>: custo (cinza) e valor registrado
          (verde) por categoria. A diferença compara valores registrados com o
          custo e não é rentabilidade.
        </p>
      </>
    ),
  },
  assets: {
    title: 'Meus investimentos',
    body: (
      <ul>
        <li>
          Novo investimento cadastra um ativo que você já possui ou compra.
        </li>
        <li>
          A ação principal do cartão aporta ou compra; Mais ações reúne retirada
          ou venda, atualização de saldo ou cotação, edição e exclusão.
        </li>
        <li>Ver detalhes mostra custos, cotação e operações recentes.</li>
        <li>Todas as operações ficam em Histórico de investimentos.</li>
      </ul>
    ),
  },
  investmentHistory: {
    title: 'Histórico de investimentos',
    body: (
      <p>
        Registra posições iniciais, compras, aportes, vendas, resgates e
        retiradas de todos os investimentos. Filtre por investimento, categoria,
        tipo de operação e período, e edite ou exclua uma operação; posição,
        saldos e patrimônio são recalculados.
      </p>
    ),
  },
  valuations: {
    title: 'Avaliações manuais',
    body: (
      <p>
        Atualize o valor de um investimento sem cotação automática, como renda
        fixa ou caixinhas. É o valor informado por você na data, não uma cotação
        automática ou em tempo real. Não altera o saldo disponível nem gera
        receitas ou despesas; novas operações exigem nova avaliação.
      </p>
    ),
  },
  settings: {
    title: 'Configurações financeiras',
    body: (
      <p>
        Reúne ações administrativas de Finanças. Hoje, permite redefinir todos
        os dados financeiros, com confirmação, preservando os demais pilares e o
        perfil.
      </p>
    ),
  },
  walletContribution: {
    title: 'Utilizar saldo da Carteira',
    body: (
      <>
        <p>
          Ligado: o aporte usa dinheiro do saldo disponível. Não conta como
          despesa nem consome orçamento. Sem saldo suficiente, nada é salvo.
        </p>
        <p>
          Desligado: dinheiro de fora do Life RPG. O saldo disponível não muda e
          o patrimônio aumenta.
        </p>
      </>
    ),
  },
  walletWithdrawal: {
    title: 'Enviar valor para a Carteira',
    body: (
      <>
        <p>
          Ligado: a retirada devolve o valor recebido ao saldo disponível, sem
          contar como receita.
        </p>
        <p>
          Desligado: o valor sai do Life RPG (por exemplo, para outra conta); o
          saldo disponível não muda.
        </p>
      </>
    ),
  },
  operation: {
    title: 'Aportes e retiradas',
    body: (
      <>
        <p>
          Posição inicial (“Investimento que já possuo”) não desconta da
          Carteira e não gera XP de compra; informe o custo original quando
          conhecido.
        </p>
        <p>
          No resgate, informe só o valor: ele sai exatamente do saldo
          registrado. O custo de aquisição da parcela é calculado
          automaticamente (primeiro o valor aplicado, depois o rendimento); em
          BTC, dólar, ações e FIIs com quantidade, pelo preço médio.
        </p>
      </>
    ),
  },
  newInvestment: {
    title: 'Cadastro de investimento',
    body: (
      <>
        <p>
          Com quantidade e preço, o valor aplicado é o produto dos dois. Para
          Bitcoin, informe o valor em reais e a quantidade em BTC ou sats; o
          preço opcional é ignorado.
        </p>
        <p>
          “Investimento que já possuo” registra uma posição existente, sem
          desconto da Carteira; informe o custo original quando conhecido.
        </p>
      </>
    ),
  },
} satisfies Record<string, { title: string; body: ReactNode }>;

export type FinanceHelpTopic = keyof typeof topics;

export function FinanceHelp({ topic }: { topic: FinanceHelpTopic }) {
  const { title, body } = topics[topic];
  return <ContextHelp title={title}>{body}</ContextHelp>;
}

/** Linha discreta “Ajuda” para formulários, sem um “?” em cada campo. */
export function FormHelp({ topic }: { topic: FinanceHelpTopic }) {
  return (
    <div className="finance-form-help">
      <span aria-hidden="true">Dúvidas sobre este formulário</span>
      <FinanceHelp topic={topic} />
    </div>
  );
}
