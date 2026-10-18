import { MarketSnapshot, NewEntry, PlatformType, Riser } from '../types/index.js';

/** Точка истории игры за день: [YYYY-MM-DD, метрика, число оценок Яндекса]. */
export type HistoryPointTuple = [string, number, number?];

export interface GameTrack {
  platform: PlatformType;
  title: string;
  url?: string;
  metricType: string;
  firstSeen: string;
  lastSeen: string;
  points: HistoryPointTuple[];
}

export interface GameHistory {
  /** День первой записи: всё, что было в каталоге в этот день, — не новинка, а «старожил». */
  since: string;
  /** Первый день, когда платформа вообще отдала игры: коллектор, упавший в первый скан, не превращает весь свой каталог в «новинки». */
  platformSince?: Partial<Record<PlatformType, string>>;
  games: Record<string, GameTrack>;
}

const MAX_POINTS = 45;
const FORGET_AFTER_DAYS = 30;
const DAY_MS = 86_400_000;

const dayOf = (iso: string): string => iso.slice(0, 10);
const daysBetween = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);

/** Добавляет снимок в историю (одна точка на игру в день, последний скан дня побеждает). Мутирует и возвращает history. */
export function recordSnapshot(history: GameHistory | null, snapshot: MarketSnapshot): GameHistory {
  const day = dayOf(snapshot.timestamp);
  const h: GameHistory = history ?? { since: day, games: {} };
  h.platformSince ??= {};

  for (const g of snapshot.games) {
    if (g.metricType === 'viral_score') continue; // YouTube-тренды синтетические, динамика по ним бессмысленна
    h.platformSince[g.platform] ??= day;
    const point: HistoryPointTuple = g.votes !== undefined ? [day, g.metricValue, g.votes] : [day, g.metricValue];
    const track = h.games[g.id];
    if (!track) {
      h.games[g.id] = {
        platform: g.platform,
        title: g.title,
        url: g.url,
        metricType: g.metricType,
        firstSeen: day,
        lastSeen: day,
        points: [point],
      };
      continue;
    }
    track.title = g.title;
    track.url = g.url ?? track.url;
    if (day < track.lastSeen) continue; // бэкфилл не в хронологическом порядке — не ломаем хвост
    track.lastSeen = day;
    const last = track.points[track.points.length - 1];
    if (last && last[0] === day) track.points[track.points.length - 1] = point;
    else track.points.push(point);
    if (track.points.length > MAX_POINTS) track.points.splice(0, track.points.length - MAX_POINTS);
  }

  for (const [id, track] of Object.entries(h.games)) {
    if (daysBetween(track.lastSeen, day) > FORGET_AFTER_DAYS) delete h.games[id];
  }
  return h;
}

/** Игры, впервые попавшие в выдачу за последние maxAgeDays дней и всё ещё в ней. */
export function findNewEntries(history: GameHistory, today: string, maxAgeDays = 7): NewEntry[] {
  const out: NewEntry[] = [];
  for (const [id, t] of Object.entries(history.games)) {
    const baseline = history.platformSince?.[t.platform] ?? history.since;
    if (t.firstSeen <= baseline || t.lastSeen !== today) continue;
    const age = daysBetween(t.firstSeen, today);
    if (age > maxAgeDays) continue;
    const last = t.points[t.points.length - 1];
    out.push({
      id,
      platform: t.platform,
      title: t.title,
      url: t.url,
      firstSeen: t.firstSeen,
      ageDays: age,
      metricType: t.metricType,
      metricValue: last[1],
      votes: last[2],
    });
  }
  // Свежие сверху, внутри дня — сильные по метрике (у Poki rank: меньше = лучше)
  return out.sort(
    (a, b) =>
      a.ageDays - b.ageDays ||
      (a.metricType === 'rank' ? a.metricValue - b.metricValue : b.metricValue - a.metricValue)
  );
}

/**
 * Рост за окно windowDays: Roblox — CCU, Яндекс — число оценок (прокси аудитории),
 * Poki — подъём в позиции. Абсолютный онлайн не учитывается, поэтому вечные гиганты сюда не попадают.
 */
export function findRisers(
  history: GameHistory,
  today: string,
  windowDays = 7,
  perPlatform = 10
): Riser[] {
  const byPlatform = new Map<PlatformType, Riser[]>();
  for (const [id, t] of Object.entries(history.games)) {
    if (t.lastSeen !== today || t.points.length < 2) continue;
    const window = t.points.filter(p => daysBetween(p[0], today) <= windowDays);
    if (window.length < 2) continue;
    const first = window[0];
    const last = window[window.length - 1];

    let from: number;
    let to: number;
    let growthPct: number;
    if (t.metricType === 'ccu') {
      from = first[1];
      to = last[1];
      if (to < 1000) continue; // ниже — шум
      growthPct = ((to - from) / Math.max(from, 100)) * 100;
    } else if (t.metricType === 'rank') {
      from = first[1];
      to = last[1];
      growthPct = ((from - to) / from) * 100;
    } else if (first[2] !== undefined && last[2] !== undefined) {
      from = first[2];
      to = last[2];
      if (to < 30) continue;
      growthPct = ((to - from) / Math.max(from, 20)) * 100;
    } else {
      continue;
    }
    if (growthPct <= 5) continue;

    const list = byPlatform.get(t.platform) ?? [];
    list.push({
      id,
      platform: t.platform,
      title: t.title,
      url: t.url,
      metricType: t.metricType,
      signal: t.metricType === 'ccu' ? 'ccu' : t.metricType === 'rank' ? 'rank' : 'votes',
      from,
      to,
      growthPct: Math.round(growthPct),
      days: daysBetween(first[0], last[0]),
    });
    byPlatform.set(t.platform, list);
  }
  const out: Riser[] = [];
  for (const list of byPlatform.values()) {
    out.push(...list.sort((a, b) => b.growthPct - a.growthPct).slice(0, perPlatform));
  }
  return out.sort((a, b) => b.growthPct - a.growthPct);
}
