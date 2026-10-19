/**
 * HTTP-клиент дашборда к API сервера радара (и к статическому снимку GitHub Pages).
 * Только сеть: состояние и DOM остаются в App.
 */
import { GameHistoryResponse, MarketSnapshot, SnapshotSummary } from '../types.js';

const SCAN_TOKEN_KEY = 'radar_scan_token';

/** Список срезов с сервера; null — сервер недоступен или ответил ошибкой. */
export async function fetchSnapshotList(): Promise<SnapshotSummary[] | null> {
  try {
    const res = await fetch('/api/snapshots');
    return res.ok ? ((await res.json()) as SnapshotSummary[]) : null;
  } catch {
    return null;
  }
}

/** Снимок по id через кэш; при сетевой ошибке бросает, при HTTP-ошибке возвращает undefined. */
export async function fetchSnapshotById(
  id: string,
  cache: Map<string, MarketSnapshot>
): Promise<MarketSnapshot | undefined> {
  const cached = cache.get(id);
  if (cached) return cached;
  const res = await fetch(`/api/snapshots/${id}`);
  if (!res.ok) return undefined;
  const data = (await res.json()) as MarketSnapshot;
  cache.set(id, data);
  return data;
}

/** Последний снимок с сервера; null — нет ответа (тогда пробуем статику). */
export async function fetchLatestSnapshot(): Promise<MarketSnapshot | null> {
  try {
    const res = await fetch('/api/snapshots/latest');
    return res.ok ? ((await res.json()) as MarketSnapshot) : null;
  } catch {
    return null;
  }
}

/** Статический снимок, собранный в бандл GitHub Pages. */
export async function fetchStaticSnapshot(): Promise<MarketSnapshot | null> {
  try {
    const res = await fetch('./data/latest_snapshot.json');
    return res.ok ? ((await res.json()) as MarketSnapshot) : null;
  } catch {
    return null;
  }
}

/** История игры по дням; null — истории нет (404) или запрос не удался. */
export async function fetchGameHistory(id: string): Promise<GameHistoryResponse | null> {
  try {
    const res = await fetch(`/api/games/${encodeURIComponent(id)}/history`);
    return res.ok ? ((await res.json()) as GameHistoryResponse) : null;
  } catch {
    return null;
  }
}

export function getStoredScanToken(): string {
  try {
    return localStorage.getItem(SCAN_TOKEN_KEY) || '';
  } catch {
    return ''; // localStorage недоступен (приватный режим)
  }
}

export function storeScanToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(SCAN_TOKEN_KEY, token);
    else localStorage.removeItem(SCAN_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export type ScanRequestResult =
  | { kind: 'accepted' }
  | { kind: 'unauthorized' }
  /** Сервер в production без SCAN_TOKEN: ручной скан отключён (403). */
  | { kind: 'disabled' }
  | { kind: 'cooldown'; retryAfterSec: number }
  | { kind: 'error' };

/** POST /api/scan с сохранённым токеном. Ход скана дальше приходит по SSE. Сетевая ошибка бросается. */
export async function requestScan(): Promise<ScanRequestResult> {
  const headers: Record<string, string> = {};
  const token = getStoredScanToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('/api/scan', { method: 'POST', headers });
  if (res.status === 401) return { kind: 'unauthorized' };
  if (res.status === 403) return { kind: 'disabled' };
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { retryAfterSec?: number };
    return { kind: 'cooldown', retryAfterSec: body.retryAfterSec ?? 30 };
  }
  return res.ok ? { kind: 'accepted' } : { kind: 'error' };
}
