/**
 * Сравнение двух срезов: какой снимок брать базой (без DOM). Что изменилось — utils/snapshotDiff.ts.
 *
 * База по умолчанию — предыдущий срез истории; явный выбор («Сравнить с») хранится в URL
 * как `?compare=<id снимка>`, чтобы сравнением можно было поделиться ссылкой.
 */
import { SnapshotSummary } from '../types.js';

export const COMPARE_PARAM = 'compare';

/** `?compare=` из строки запроса; пустое значение — нет выбора. */
export function readCompareParam(search: string): string | null {
  return new URLSearchParams(search).get(COMPARE_PARAM) || null;
}

/** URL с выставленным (или убранным при null) `?compare=`; остальные параметры и hash не трогаются. */
export function withCompareParam(href: string, compareId: string | null): string {
  const url = new URL(href);
  if (compareId) url.searchParams.set(COMPARE_PARAM, compareId);
  else url.searchParams.delete(COMPARE_PARAM);
  return url.toString();
}

/**
 * id снимка-базы для текущего среза. Явный выбор работает, если такой срез есть в истории
 * и это не сам текущий; иначе — предыдущий срез (следующий в списке по убыванию даты) или null.
 */
export function resolveBaseSnapshotId(
  list: SnapshotSummary[],
  currentId: string,
  compareId: string | null
): string | null {
  if (compareId && compareId !== currentId && list.some(s => s.id === compareId)) return compareId;
  const idx = list.findIndex(s => s.id === currentId);
  return idx >= 0 && idx + 1 < list.length ? list[idx + 1].id : null;
}
