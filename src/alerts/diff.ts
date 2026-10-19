import type { ArbitrageOpportunity, MarketSnapshot, Riser, SourceStatus } from '../types/index.js';

/** Рост в алерт: ×3 за 7 дней (Roblox CCU и оценки Яндекса), у Roblox ещё и онлайн ≥ 5 000; Poki (подъём в ранге) не алертим — 2→1 уже +50%. */
export const RISER_ALERT_MIN_PCT = 200;
export const RISER_ALERT_MIN_CCU = 5_000;
/** Событие повторяется, только если его не было видно дольше этого окна (ниша у порога CCU мигает между сканами). */
export const ALERT_QUIET_MS = 7 * 24 * 3600_000;

export type SourceHealth = 'ok' | 'warning' | 'down';

export interface AlertState {
  /** Ключ события (`niche:<id>`, `riser:<id>`) → когда оно последний раз было в снимке. */
  seen: Record<string, string>;
  /** Последнее известное здоровье источника. */
  sources: Record<string, SourceHealth>;
}

export interface SourceChange {
  source: string;
  health: SourceHealth;
  status: SourceStatus;
}

export interface SnapshotAlerts {
  niches: ArbitrageOpportunity[];
  risers: Riser[];
  /** Источник впервые ушёл в warning/сбой (или сменил одно на другое). */
  degraded: SourceChange[];
  recovered: SourceChange[];
}

export function sourceHealth(status: SourceStatus): SourceHealth {
  if (!status.ok) return 'down';
  return status.warning ? 'warning' : 'ok';
}

export function isAlertableRiser(r: Riser): boolean {
  if (r.signal === 'ccu') return r.growthPct >= RISER_ALERT_MIN_PCT && r.to >= RISER_ALERT_MIN_CCU;
  if (r.signal === 'votes') return r.growthPct >= RISER_ALERT_MIN_PCT;
  return false;
}

export function hasAlerts(a: SnapshotAlerts): boolean {
  return a.niches.length + a.risers.length + a.degraded.length + a.recovered.length > 0;
}

/**
 * События нового снимка относительно состояния прошлых сканов. Без состояния (первый запуск)
 * событий нет — текущий снимок становится базой, иначе первое сообщение было бы обо всём рынке.
 */
export function diffSnapshot(
  snapshot: MarketSnapshot,
  state: AlertState | null,
  now: Date = new Date()
): { alerts: SnapshotAlerts; nextState: AlertState } {
  const nowIso = now.toISOString();
  const seen: Record<string, string> = {};
  for (const [key, at] of Object.entries(state?.seen ?? {})) {
    if (now.getTime() - Date.parse(at) <= ALERT_QUIET_MS) seen[key] = at;
  }
  const alerts: SnapshotAlerts = { niches: [], risers: [], degraded: [], recovered: [] };

  const track = <T>(key: string, item: T, out: T[]): void => {
    if (state && !(key in seen)) out.push(item);
    seen[key] = nowIso;
  };
  for (const o of snapshot.arbitrageOpportunities ?? []) track(`niche:${o.robloxGame.id}`, o, alerts.niches);
  for (const r of snapshot.risers ?? []) if (isAlertableRiser(r)) track(`riser:${r.id}`, r, alerts.risers);

  const sources: Record<string, SourceHealth> = { ...(state?.sources ?? {}) };
  for (const [source, status] of Object.entries(snapshot.sourceStatus ?? {})) {
    const health = sourceHealth(status);
    const prev = state?.sources[source];
    if (prev !== undefined && prev !== health) {
      (health === 'ok' ? alerts.recovered : alerts.degraded).push({ source, health, status });
    }
    sources[source] = health;
  }

  return { alerts, nextState: { seen, sources } };
}
