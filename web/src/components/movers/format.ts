/**
 * Очищает название игры от пустого мусора и спецсимволов
 */
export function cleanDisplayTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\[\s*\]/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\p{Extended_Pictographic}[^\]]*\]/gu, '')
    .replace(/\p{Extended_Pictographic}|\uFE0F|\uFE0E/gu, '')
    .replace(/\s+/g, ' ')
    .trim() || title;
}

/**
 * Форматирует число CCU / онлайна
 */
export function formatCCU(val: number): string {
  if (val >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(2)}M`;
  }
  if (val >= 1_000) {
    return `${(val / 1_000).toFixed(1)}k`;
  }
  return val.toLocaleString('ru-RU');
}
