import { areas, type EffortActivity } from '../../modules/evolution/scoring';

/** Histórico sintético fixo de 180 dias. Nunca representa registros do usuário.
 * O dia zero fica reservado às missões atuais; cobre dois períodos de 90 dias.
 */
export const effortHistory: EffortActivity[] = Array.from(
  { length: 179 },
  (_, i) => i + 1,
).flatMap((daysAgo) =>
  areas.flatMap((area, index) => {
    const cadence = { Finanças: 3, Treinos: 2, Descanso: 1, Conhecimento: 2 }[
      area
    ];
    if ((daysAgo + index) % cadence !== 0 || (daysAgo + index) % 11 === 0)
      return [];
    return [
      {
        id: `demo:${area}:${daysAgo}`,
        area,
        daysAgo,
        effort: daysAgo > 30 && daysAgo % 3 === 0 ? 0.5 : 0.8,
      },
    ];
  }),
);
