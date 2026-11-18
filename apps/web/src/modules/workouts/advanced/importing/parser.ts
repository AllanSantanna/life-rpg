import type { Exercise, WorkoutSet } from '../types';
import { createExerciseMatcher } from './matcher';
import { normalizeExerciseName } from './normalize';
import { importSetErrors } from './validation';
import type { ImportExercise, ParsedWorkout } from './types';
import type { ParseOptions } from './types';
import { extractWorkoutMetadata } from './metadata';
import { interpretNumbers } from './inputOrder';

const decimal = '[+-]?\\d+(?:[.,]\\d+)?';
const kind = '(?:aquecimento|aq\\.?|warm[ -]?up|v[aá]lidas?|working)';
// A comma between sets is distinct from a decimal comma (the number consumes it).
const setPattern = new RegExp(
  `(?:(${kind})\\s*[:=-]?\\s*)?(?=${decimal}|[x×]\\s*${decimal})(${decimal})?\\s*(kg\\s*)?[x×]\\s*(${decimal})?\\s*(kg)?(?:\\s*(?:reps?|repeti[cç][oõ]es))?(?:\\s*[-—]?\\s*rir\\s*[:=]?\\s*(${decimal}))?(?:\\s*(${kind}))?`,
  'giu',
);
const numeric = (value: string | undefined) =>
  value === undefined ? null : Number(value.replace(',', '.'));
const cleanName = (value: string) =>
  value
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
    .replace(/[:\s-]+$/, '')
    .trim();
const residue = (value: string) => value.replace(/[\s,;|:()\-—]+/g, '');

export function parseWorkoutText(
  text: string,
  catalog: readonly Exercise[],
  preferred: string[] = [],
  options: ParseOptions = {},
): ParsedWorkout {
  const matchExercise = createExerciseMatcher(catalog, preferred, options);
  const exercises: ImportExercise[] = [];
  const extracted = extractWorkoutMetadata(text, options.titles);
  const warnings: string[] = [...extracted.warnings];
  let current: ImportExercise | undefined;
  function exercise(name: string) {
    const match = matchExercise(name);
    current = match.exerciseId
      ? exercises.find((e) => e.exerciseId === match.exerciseId)
      : undefined;
    if (!current) {
      current = {
        id: `exercise-${exercises.length}`,
        sourceName: name,
        ...match,
        sets: [],
        conflict: '',
      };
      exercises.push(current);
    }
  }
  for (const [lineIndex, raw] of extracted.lines.entries()) {
    const line = raw
      .trim()
      .replace(/^s[eé]rie\s+\d+\s*[:.)-]\s*/i, '')
      .replace(
        /([x×]\s*[+-]?\d+(?:[.,]\d+)?(?:\s*rir\s*[+-]?\d+)?),\s*(?=[+-]?\d+(?:[.,]\d+)?\s*(?:kg\s*)?[x×])/gi,
        '$1;',
      );
    if (!line) continue;
    const matches = [...line.matchAll(setPattern)];
    if (!matches.length) {
      if (/\d/.test(line) && !/[a-záéíóúãõç]{3}/i.test(line)) {
        warnings.push(
          `Linha ${lineIndex + 1} não reconhecida: “${line}”. Use carga × repetições.`,
        );
      } else if (/^(?:rir|\d|aquecimento|v[aá]lida)/i.test(line)) {
        warnings.push(`Linha ${lineIndex + 1} não reconhecida: “${line}”.`);
      } else exercise(cleanName(line));
      continue;
    }
    const prefix = cleanName(line.slice(0, matches[0]!.index));
    if (prefix) exercise(prefix);
    if (!current) {
      warnings.push(
        `Linha ${lineIndex + 1}: séries sem exercício. Informe o nome antes das séries.`,
      );
      continue;
    }
    let end = matches[0]!.index!;
    for (const match of matches) {
      const gap = line.slice(end, match.index);
      if (residue(gap))
        warnings.push(
          `Linha ${lineIndex + 1}: trecho não reconhecido “${gap.trim()}”.`,
        );
      const marker = normalizeExerciseName(
        `${match[1] ?? ''} ${match[7] ?? ''}`,
      );
      const set: WorkoutSet = {
        id: `${current.id}-set-${current.sets.length}`,
        kind: /aquecimento|\baq\b|warm/.test(marker) ? 'warmup' : 'working',
        ...interpretNumbers(
          numeric(match[2]),
          numeric(match[4]),
          !!match[3],
          !!match[5],
          options.inputOrder ?? 'weight-reps',
        ),
        rir: numeric(match[6]),
        completed: false,
      };
      current.sets.push(set);
      end = match.index! + match[0].length;
    }
    const tail = line.slice(end);
    if (residue(tail))
      warnings.push(
        `Linha ${lineIndex + 1}: trecho não reconhecido “${tail.trim()}”.`,
      );
  }
  for (const row of exercises) {
    if (!row.sets.length)
      warnings.push(
        `“${row.sourceName}”: nenhuma série reconhecida. Adicione séries ou remova o exercício.`,
      );
    for (const [index, set] of row.sets.entries()) {
      if (importSetErrors(set).length)
        warnings.push(
          `“${row.sourceName}”, série ${index + 1}: confira os campos incompletos ou inválidos.`,
        );
    }
  }
  return {
    exercises,
    warnings,
    ...(text.trim()
      ? { metadata: extracted.metadata, originalText: text }
      : {}),
  };
}
