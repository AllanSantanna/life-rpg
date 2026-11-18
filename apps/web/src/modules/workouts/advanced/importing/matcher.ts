import Fuse from 'fuse.js';
import { exerciseAliases } from '../library';
import type { Exercise } from '../types';
import { normalizeExerciseName } from './normalize';
import type { MatchContext, MatchSource } from './types';

// Phrase boundaries are explicit here; the existing catalog also supplies its aliases.
const synonyms: Record<string, string[]> = {
  bench: ['bench press', 'supino com barra'],
  incline: ['incline dumbbell press', 'supino inclinado com halteres'],
  pulldown: ['puxada alta', 'lat pulldown', 'puxada aberta'],
  raise: ['lateral raise'],
  curl: ['barbell curl'],
  legpress: ['leg press 45', 'leg press 45 graus'],
  'library:pec-deck': ['pec deck', 'peck deck', 'voador', 'crucifixo máquina'],
  'library:crossover': ['crossover', 'cross over'],
  'library:low-crossover': ['crossover na polia baixa'],
  'library:dumbbell-row': ['remada serrote'],
  'library:rope-pushdown': ['tríceps corda', 'tríceps pulley corda'],
  hipthrust: ['hip thrust'],
};

const abbreviations: Record<string, string> = {
  sup: 'supino',
  maq: 'maquina',
  elev: 'elevacao',
  desenv: 'desenvolvimento',
  cross: 'crossover',
};
const expandedName = (value: string) =>
  normalizeExerciseName(value)
    .split(' ')
    .map((w) => abbreviations[w] ?? w)
    .join(' ');
const informative = (words: string[]) =>
  words.some(
    (w) =>
      w.length >= 3 &&
      ![
        'maquina',
        'polia',
        'barra',
        'halteres',
        'alta',
        'baixa',
        'reto',
        'inclinado',
      ].includes(w),
  );

export function createExerciseMatcher(
  catalog: readonly Exercise[],
  preferred: string[] = [],
  context: MatchContext = {},
) {
  const entries = catalog.flatMap((exercise) =>
    [
      ...new Set(
        [
          exercise.name,
          ...(synonyms[exercise.id] ?? []),
          exerciseAliases[exercise.id] ?? '',
        ]
          .filter(Boolean)
          .map(expandedName),
      ),
    ].map((name) => ({ exercise, name })),
  );
  const fuse = new Fuse(entries, {
    keys: ['name'],
    includeScore: true,
    ignoreLocation: true,
    ignoreFieldNorm: true,
    threshold: 0.4,
  });
  return (input: string) => {
    const query = expandedName(input);
    const result = (
      exerciseId: string | null,
      alternatives: string[],
      source: MatchSource,
    ) => ({ exerciseId, alternatives, source });
    if (!query) return result(null, [], 'manual');
    const exact = entries.filter((entry) => entry.name === query);
    const scores = new Map<string, number>();
    for (const { item, score = 1 } of fuse.search(query)) {
      // Fuse matches prefixes too: penalize omitted equipment/movement qualifiers.
      const adjusted =
        score +
        (0.45 * Math.abs(item.name.length - query.length)) /
          Math.max(item.name.length, query.length);
      scores.set(
        item.exercise.id,
        Math.min(scores.get(item.exercise.id) ?? 1, adjusted),
      );
    }
    for (const entry of exact) scores.set(entry.exercise.id, 0);
    const ranked = [...scores].sort(
      ([a, sa], [b, sb]) =>
        sa -
        (preferred.includes(a) ? 0.025 : 0) -
        (sb - (preferred.includes(b) ? 0.025 : 0)),
    );
    const local = entries.filter((e) => preferred.includes(e.exercise.id));
    const words = query.split(' ');
    const lexical = informative(words)
      ? [
          ...new Set(
            local
              .filter((e) =>
                words.every((word) =>
                  e.name
                    .split(' ')
                    .some(
                      (token) => word.length >= 3 && token.startsWith(word),
                    ),
                ),
              )
              .map((e) => e.exercise.id),
          ),
        ]
      : [];
    const localScores = [...scores]
      .filter(([id]) => preferred.includes(id))
      .sort((a, b) => a[1] - b[1]);
    const [localBest, localSecond] = localScores;
    const fuzzySafe =
      informative(words) &&
      localBest &&
      localBest[1] <= 0.28 &&
      (!localSecond || localSecond[1] - localBest[1] >= 0.1);
    const localId =
      lexical.length === 1
        ? lexical[0]!
        : lexical.length === 0 && fuzzySafe
          ? localBest[0]
          : null;
    const localAmbiguous =
      lexical.length > 1 || (!localId && !!localBest && localBest[1] <= 0.28);
    const validAliases = (context.aliases ?? []).filter(
      (a) =>
        catalog.some((e) => e.id === a.exerciseId) &&
        normalizeExerciseName(a.name) === normalizeExerciseName(input),
    );
    const scoped = validAliases.filter(
      (a) => a.planId === (context.planId ?? null),
    );
    const general = validAliases.filter((a) => a.planId === null);
    const remembered = [
      ...new Set((scoped.length ? scoped : general).map((a) => a.exerciseId)),
    ];
    const alternatives = [
      ...new Set([
        ...lexical,
        ...localScores.map(([id]) => id),
        ...remembered,
        ...ranked.map(([id]) => id),
      ]),
    ].slice(0, 8);
    if (remembered.length > 1) return result(null, alternatives, 'manual');
    const alias = remembered[0];
    if (localId) {
      // A scoped alias that contradicts a safe current plan match requires review.
      if (alias && scoped.length && alias !== localId)
        return result(null, alternatives, 'manual');
      return result(
        localId,
        alternatives,
        alias === localId ? 'alias' : 'plan',
      );
    }
    if (alias && (!localAmbiguous || preferred.includes(alias)))
      return result(alias, alternatives, 'alias');
    if (localAmbiguous) return result(null, alternatives, 'manual');
    const exactIds = [...new Set(exact.map((entry) => entry.exercise.id))];
    const [best, second] = [...scores].sort((a, b) => a[1] - b[1]);
    const confident =
      best && best[1] <= 0.28 && (!second || second[1] - best[1] >= 0.1);
    const exerciseId =
      exactIds.length === 1
        ? exactIds[0]!
        : exactIds.length > 1
          ? null
          : confident
            ? best[0]
            : null;
    return result(exerciseId, alternatives, exerciseId ? 'catalog' : 'manual');
  };
}
