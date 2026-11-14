import { describe, expect, it } from 'vitest';
import {
  dateForMonth,
  maskPickerText,
  parsePickerText,
  pickerBounds,
  pickerCursor,
  pickerDisplay,
  pickerError,
  shiftMonth,
} from './picker';
describe('Datas civis dos calendários', () => {
  it('formata e interpreta data e mês sem conversão de fuso', () => {
    expect(parsePickerText('29/02/2024', 'date')).toBe('2024-02-29');
    expect(parsePickerText('29/02/2025', 'date')).toBeNull();
    expect(parsePickerText('2026-11-13', 'date')).toBe('2026-11-13');
    expect(parsePickerText('11/2026', 'month')).toBe('2026-11');
    expect(parsePickerText('13/2026', 'month')).toBeNull();
    expect(pickerDisplay('2026-11-13', 'date')).toBe('13/11/2026');
    expect(maskPickerText('13112026', 'date')).toBe('13/11/2026');
    expect(maskPickerText('112026', 'month')).toBe('11/2026');
  });
  it('preserva o dia possível em viradas de mês e limita os extremos de anos', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(dateForMonth('2024-01-31', '2024-02')).toBe('2024-02-29');
    expect(dateForMonth('2025-01-31', '2025-02')).toBe('2025-02-28');
    expect(shiftMonth('0001-01', -12)).toBe('0001-01');
    expect(shiftMonth('9999-12', 12)).toBe('9999-12');
  });
  it('mantém limites, valores opcionais e cursores de navegação independentes da data salva', () => {
    const bounds = pickerBounds('date', '2026-01-01', '2026-02-10');
    expect(pickerCursor('2026-03-20', 'date', bounds)).toBe('2026-02-10');
    expect(
      pickerError('2026-03-20', 'date', true, '2026-01-01', '2026-02-10'),
    ).toContain('até 10/02/2026');
    expect(pickerError('', 'date', false)).toBe('');
    expect(pickerError('', 'date', true)).toBe('Escolha uma data.');
    expect(pickerBounds('month', '2024-02', '2024-02')).toEqual({
      lower: '2024-02-01',
      upper: '2024-02-29',
    });
  });
});
