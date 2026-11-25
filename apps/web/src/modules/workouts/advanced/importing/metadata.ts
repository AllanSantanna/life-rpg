import { isDate } from '../../../records/dates';
import { normalizeExerciseName } from './normalize';
import type { WorkoutMetadata } from './types';

export function brazilianDate(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const date = `${match[3]}-${match[2]!.padStart(2, '0')}-${match[1]!.padStart(2, '0')}`;
  return isDate(date) ? date : null;
}
const headerDate = '\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?';
const headerTime = '\\d{1,2}:\\d{2}(?::\\d{2})?';
// Só o início da linha: [data, hora] ou [hora, data] (cópia de mensagens) e
// "data, hora - " (exportação do Android; hífen opcional, como antes). Texto
// comum com dois-pontos não casa: o cabeçalho exige data e horário no início.
const bracketHeader = new RegExp(
  `^\\[\\s*(?:(${headerDate}),?\\s+${headerTime}|${headerTime},?\\s+(${headerDate}))\\s*\\]\\s*`,
);
const exportHeader = new RegExp(
  `^(${headerDate}),?\\s+${headerTime}\\s+(?:-\\s+)?`,
);
/**
 * Separa o cabeçalho externo de uma mensagem do WhatsApp (data, horário e
 * remetente) do conteúdo, que segue intacto. Usado só na interpretação: o
 * texto original da importação não é alterado.
 */
export function whatsappMessage(
  raw: string,
): { date: string; content: string } | null {
  const line = raw.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim();
  const header = bracketHeader.exec(line) ?? exportHeader.exec(line);
  if (!header) return null;
  const rest = line.slice(header[0].length);
  // Remetente: até o primeiro ": " (nomes não contêm dois-pontos).
  const sender = /^([^:]{1,80}?):(?:\s+|$)/u.exec(rest);
  return {
    date: (header[1] ?? header[2])!,
    content: (sender ? rest.slice(sender[0].length) : rest).trim(),
  };
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
    const whatsapp = whatsappMessage(raw);
    const line = (whatsapp?.content ?? raw)
      .replace(/[\u200e\u200f]/g, '')
      .trim();
    if (whatsapp) date(whatsapp.date, index);
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
