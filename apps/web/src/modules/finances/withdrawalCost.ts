import type { LifeRecords } from '../records/types';
import { investmentValue } from './ledger';
import { formatCurrency } from './monetary';
import { position, positionMode } from './position';
import type { InvestmentEntry } from './types';

/**
 * Custo de aquisição de um resgate, calculado internamente (o formulário não
 * pede mais esse valor). Vale só para ativos controlados por valor monetário
 * (Renda fixa, Caixinhas bancárias e Outros); BTC, USD, ações e FIIs mantêm o
 * custo pelo preço médio/quantidade em `position.ts`.
 *
 * O valor resgatado nunca muda: é o que sai do saldo registrado e, com
 * “Enviar valor para a Carteira”, o que entra na Carteira. O custo é gravado
 * à parte em `costBasisCents` no momento do salvamento, para que os registros
 * anteriores, sem o campo, continuem calculados como antes.
 *
 * Metodologia existente (principal primeiro): o custo baixado é o próprio
 * valor resgatado enquanto houver custo restante. Antes, um resgate maior que
 * o custo (com rendimento) exigia informar o custo manualmente; agora:
 * - Saldo conhecido (caixinha com saldo informado ou avaliação manual válida):
 *   resgate até o saldo é aceito; acima do custo restante, baixa-se todo o
 *   custo e o excedente é rendimento. Resgate maior que o saldo é recusado.
 * - Saldo desconhecido: o saldo registrado é o próprio custo; resgate maior
 *   é recusado.
 * - Custo parcialmente desconhecido: mantém a regra anterior, sem inventar.
 * - Custo informado explicitamente (registros e backups antigos) é preservado;
 *   na edição, o custo gravado é mantido se valor e data não mudarem.
 */
export function resolveWithdrawalCost(
  records: LifeRecords,
  entry: InvestmentEntry,
): InvestmentEntry {
  const investment = records.investments.find(
    (item) => item.id === entry.investmentId,
  );
  if (!investment || entry.kind !== 'withdrawal') return entry;
  if (entry.costBasisCents !== undefined) return entry;
  const mode = positionMode(investment.category);
  const previous = records.investmentEntries.find(
    (item) => item.id === entry.id,
  );
  // Edição sem mudar valor nem data: mantém o custo antigo gravado. Vale
  // também para vendas antigas de ações/FIIs sem quantidade.
  if (
    (mode === false || (mode === 'shares' && entry.quantity === undefined)) &&
    previous?.costBasisCents !== undefined &&
    previous.kind === 'withdrawal' &&
    previous.investmentId === entry.investmentId &&
    previous.amountCents === entry.amountCents &&
    previous.date === entry.date
  )
    return { ...entry, costBasisCents: previous.costBasisCents };
  if (mode !== false) return entry;
  const others = records.investmentEntries.filter(
    (item) => item.id !== entry.id,
  );
  const base: LifeRecords = { ...records, investmentEntries: others };
  let holding: ReturnType<typeof position>;
  try {
    holding = position(
      others.filter(
        (item) =>
          item.investmentId === entry.investmentId && item.date <= entry.date,
      ),
      false,
    );
  } catch {
    // Histórico já inconsistente: a validação do comando informa o motivo.
    return entry;
  }
  if (!holding.costKnown) return entry;
  const figures = investmentValue(base, entry.investmentId, entry.date);
  const balanceKnown =
    investment.category === 'Caixinhas bancárias'
      ? figures.boxBalanceValid
      : figures.known;
  const balance = balanceKnown ? figures.current : holding.cost;
  if (entry.amountCents > balance)
    throw new Error(
      `${investment.name}: o resgate de ${formatCurrency(entry.amountCents)} é maior que o saldo registrado de ${formatCurrency(balance)} em ${entry.date.split('-').reverse().join('/')}.${
        balanceKnown
          ? ''
          : ' Se houve rendimento, atualize o saldo ou a avaliação antes de resgatar.'
      }`,
    );
  // Principal primeiro (regra existente): até o custo restante, o custo
  // baixado é o próprio valor. Acima dele, o excedente é rendimento e todo o
  // custo restante é baixado; isso só é aceito com saldo conhecido.
  if (entry.amountCents <= holding.cost) return entry;
  return { ...entry, costBasisCents: holding.cost };
}
