/**
 * Форматирование чисел и дат для дашборда.
 */

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** '2026-10-18' или ISO-время → '18 окт'. Нераспознанная строка возвращается как есть. */
export function formatSnapshotDateRu(dateStr: string): string {
  const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${day} ${MONTHS_RU[monthIndex]}`;
    }
  }
  return dateStr;
}

/** 1 234 567 → '1.2M', 12 345 → '12.3k'. */
export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return Math.round(n).toLocaleString();
}
