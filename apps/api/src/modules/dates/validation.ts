import { fail } from '../../domain.js';

export function body(value: unknown, keys: string[], required = keys): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(400, 'VALIDATION_ERROR', 'Cần object JSON');
  const b = value as Record<string, any>;
  if (Object.keys(b).some(k => !keys.includes(k)) || required.some(k => !(k in b)))
    fail(400, 'VALIDATION_ERROR', 'Thiếu trường hoặc có trường không hỗ trợ');
  return b;
}
export function text(value: unknown, max = 200, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || /[\u0000-\u001f\u007f]/.test(value))
    fail(400, 'VALIDATION_ERROR', 'Chuỗi không hợp lệ hoặc chứa ký tự điều khiển');
  return (value as string).trim();
}
export function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') fail(400, 'VALIDATION_ERROR', 'Cần giá trị boolean');
  return value as boolean;
}
export function dateTime(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    fail(400, 'VALIDATION_ERROR', 'Thời điểm ISO phải có timezone');
  const s = value as string;
  const ms = Date.parse(s);
  // Date.parse normalizes impossible calendar days; reject those explicitly.
  const [year, month, day] = s.slice(0, 10).split('-').map(Number);
  if (!Number.isFinite(ms) || Number(s.slice(11, 13)) > 23 || Number(s.slice(14, 16)) > 59 || Number(s.slice(17, 19)) > 59 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate())
    fail(400, 'VALIDATION_ERROR', 'Ngày không tồn tại');
  return new Date(ms).toISOString();
}
export function timezone(value: unknown): string {
  const s = text(value, 80);
  try { new Intl.DateTimeFormat('en', { timeZone: s }).format(0); }
  catch { fail(400, 'VALIDATION_ERROR', 'Timezone không hợp lệ'); }
  return s;
}
export function coordinate(latitude: unknown, longitude: unknown) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    fail(400, 'VALIDATION_ERROR', 'Tọa độ không hợp lệ');
  return { latitude: latitude as number, longitude: longitude as number };
}
export function version(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) fail(400, 'VALIDATION_ERROR', 'version phải là số nguyên dương');
  return value as number;
}
