import { money } from '../finances/calculations';
export function formatGoalValue(value: number | null, unit: string) {
  return value === null
    ? 'Dados pendentes'
    : unit === 'reais'
      ? money(Math.round(value / 10))
      : `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unit}`;
}

export function cadenceLabel(cadence: string, days: number) {
  return (
    (
      {
        once: 'Única',
        daily: 'Diária',
        weekly: 'Semanal',
        monthly: 'Mensal',
      } as Record<string, string>
    )[cadence] ?? `A cada ${days} dias`
  );
}
