/**
 * Безопасное чтение ответов внешних API: JSON витрин приходит без гарантий формы,
 * поэтому вместо `as any` поля читаются через эти хелперы с дефолтами.
 */

export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Массив верхнего уровня либо поле `items` (Invidious отдаёт оба варианта, YouTube API — `items`). */
export function itemsOf(data: unknown): unknown[] {
  return Array.isArray(data) ? data : asArray(asRecord(data).items);
}

export function str(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

export function num(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}
