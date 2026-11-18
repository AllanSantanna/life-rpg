import { isDate } from '../../../records/dates';
import { normalizeExerciseName } from './normalize';
import type { WorkoutMetadata } from './types';

export function brazilianDate(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const date = `${match[3]}-${match[2]!.padStart(2, '0')}-${match[1]!.padStart(2, '0')}`;
  return isDate(date) ? date : null;
}
export function extractWorkoutMetadata(text: string, titles: string[] = []) {
  const metadata: WorkoutMetadata = {
    title: null,
    division: null,
    dates: [],
    partialDates: [],
  };
  const warnings: string[] = [];
  let firstContent = true;
  function date(value: string, line: number) {
    const iso = brazilianDate(value);
    if (iso) metadata.dates.push(iso);
    else if (/^\d{1,2}\/\d{1,2}$/.test(value))
      metadata.partialDates.push(value);
    else
      warnings.push(
        `Linha ${line + 1}: data inválida “${value}”. Use DD/MM/AAAA.`,
      );
  }
  const lines = text.split(/\r?\n/).map((raw, index) => {
    // Bracketed messages and Android's "date, time - sender: message" export.
    const whatsapp =
      /^\[?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?),?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*(?:-\s*)?[^:]+:\s*(.*)$/u.exec(
        raw.trim(),
      );
    const line = (whatsapp?.[2] ?? raw).replace(/[\u200e\u200f]/g, '').trim();
    if (whatsapp) date(whatsapp[1]!, index);
    if (!/[\p{L}\p{N}]/u.test(line)) return '';
    const dateHeader = /^data\s*[:–—-]?\s*(.+)$/i.exec(line);
    if (dateHeader) {
      date(dateHeader[1]!, index);
      return '';
    }
    const division = /^divis[aã]o\s*[:–—-]?\s*(.+)$/i.exec(line);
    if (division) {
      metadata.division = division[1]!.trim();
      return '';
    }
    const header = /^(?:treino|ficha|sess[aã]o)(?:\s*[:–—-]\s*|\s+)(.+)$/i.exec(
      line,
    );
    if (header) {
      metadata.title = header[1]!.trim();
      metadata.division ??=
        /^([a-z])(?:\s*[-:–—]|$)/i.exec(header[1]!)?.[1]?.toUpperCase() ?? null;
      warnings.push(
        `Linha ${index + 1}: cabeçalho “${line}”; confira o destino selecionado.`,
      );
      firstContent = false;
      return '';
    }
    const normalized = normalizeExerciseName(line);
    if (
      firstContent &&
      [
        'peito',
        'costas',
        'ombros',
        'pernas',
        'bracos',
        ...titles.map(normalizeExerciseName),
      ].includes(normalized)
    ) {
      metadata.title = line;
      firstContent = false;
      return '';
    }
    firstContent = false;
    return line;
  });
  metadata.dates = [...new Set(metadata.dates)];
  metadata.partialDates = [...new Set(metadata.partialDates)];
  return { metadata, warnings, lines };
}
