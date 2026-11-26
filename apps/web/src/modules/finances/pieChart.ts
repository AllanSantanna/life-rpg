/**
 * Geometria e percentuais do gráfico de pizza da distribuição. Funções puras,
 * sem dependência de biblioteca de gráficos.
 */

/**
 * Percentuais em décimos (0 a 1000) que somam exatamente 1000 (100,0%), pelo
 * método dos maiores restos: cada parte recebe o piso e as sobras vão para os
 * maiores restos (empate: ordem original). Valores ≤ 0 ficam com 0. Cálculo em
 * inteiros (BigInt), sem erro de ponto flutuante.
 */
export function percentTenths(values: readonly number[]): number[] {
  const positive = values.map((value) =>
    Number.isSafeInteger(value) && value > 0 ? BigInt(value) : 0n,
  );
  const total = positive.reduce((sum, value) => sum + value, 0n);
  if (total === 0n) return values.map(() => 0);
  const parts = positive.map((value, index) => {
    const scaled = value * 1000n;
    return { index, floor: scaled / total, rest: scaled % total };
  });
  let missing = 1000n - parts.reduce((sum, part) => sum + part.floor, 0n);
  for (const part of [...parts].sort((a, b) =>
    a.rest === b.rest ? a.index - b.index : a.rest > b.rest ? -1 : 1,
  )) {
    if (missing === 0n) break;
    if (positive[part.index] === 0n) continue;
    part.floor += 1n;
    missing -= 1n;
  }
  return parts.map((part) => Number(part.floor));
}

/** “35,2%” a partir de décimos de ponto percentual. */
export function formatTenths(tenths: number) {
  return `${(tenths / 10).toLocaleString('pt-BR', {
    minimumFractionDigits: tenths % 10 ? 1 : 0,
    maximumFractionDigits: 1,
  })}%`;
}

export interface PieSlice {
  index: number;
  /** Caminho SVG do setor; ausente quando é o único setor (círculo inteiro). */
  path?: string;
  start: number;
  end: number;
}

/**
 * Setores proporcionais aos valores positivos, a partir do topo, no sentido
 * horário, preenchidos até o centro (pizza, não rosca). Valores ≤ 0 não geram
 * setor. Um único valor positivo ocupa o círculo inteiro.
 */
export function pieSlices(
  values: readonly number[],
  center = 100,
  radius = 96,
): PieSlice[] {
  const total = values.reduce(
    (sum, value) => sum + (Number.isFinite(value) && value > 0 ? value : 0),
    0,
  );
  if (total <= 0) return [];
  const positive = values.filter((value) => value > 0).length;
  const point = (angle: number) => {
    const radians = (angle - 90) * (Math.PI / 180);
    return `${(center + radius * Math.cos(radians)).toFixed(3)} ${(center + radius * Math.sin(radians)).toFixed(3)}`;
  };
  const slices: PieSlice[] = [];
  let angle = 0;
  values.forEach((value, index) => {
    if (!(Number.isFinite(value) && value > 0)) return;
    const sweep = (value / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    slices.push(
      positive === 1
        ? { index, start: 0, end: 360 }
        : {
            index,
            start,
            end,
            path: `M ${center} ${center} L ${point(start)} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${point(end)} Z`,
          },
    );
  });
  return slices;
}
