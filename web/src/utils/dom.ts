/**
 * DOM safety helpers: every value interpolated into innerHTML goes through these.
 */

/** Экранирует строку для подстановки в текст или значение атрибута HTML. */
export function escapeHtml(str: string | null | undefined): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Пропускает только абсолютные http(s)-ссылки: URL приходят из внешних витрин,
 * и `javascript:` / `data:` в href исполнился бы в контексте дашборда.
 * Возвращает '#' для всего остального. Результат всё равно нужно экранировать.
 */
export function safeUrl(url: string | null | undefined): string {
  if (!url) return '#';
  try {
    const parsed = new URL(String(url).trim());
    return SAFE_URL_PROTOCOLS.has(parsed.protocol) ? parsed.href : '#';
  } catch {
    return '#';
  }
}

/** escapeHtml(safeUrl(url)) — готовое значение для href. */
export function safeHref(url: string | null | undefined): string {
  return escapeHtml(safeUrl(url));
}
