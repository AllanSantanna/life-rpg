import { decimalToUnits } from '../finances/monetary';
export function formText(data: FormData, name: string) {
  return String(data.get(name) ?? '').trim();
}
export function formNumber(data: FormData, name: string) {
  const value = formText(data, name).replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(value))
    throw new Error('Informe um número válido.');
  return Number(value);
}
export function formCents(data: FormData, name: string) {
  const value = formText(data, name).replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error('Informe um valor com até duas casas decimais.');
  return decimalToUnits(value, 2);
}
export function newId() {
  return crypto.randomUUID();
}
