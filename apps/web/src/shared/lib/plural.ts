/**
 * Quantidade com o substantivo concordando em número: `1 treino`, `0 treinos`,
 * `2 treinos`. Em português, apenas 1 (e -1) usa o singular. O valor pode vir
 * já formatado (ex.: `number(1500)`), mantendo a regra pelo número real.
 */
export function plural(
  count: number,
  singular: string,
  pluralForm: string,
  formatted: string = String(count),
) {
  return `${formatted} ${Math.abs(count) === 1 ? singular : pluralForm}`;
}
