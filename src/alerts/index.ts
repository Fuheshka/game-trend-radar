import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MarketEventBus } from '../events/event_bus.js';
import type { SnapshotStore } from '../storage/snapshot_store.js';
import type { MarketSnapshot } from '../types/index.js';
import { AlertState, diffSnapshot, hasAlerts } from './diff.js';
import { formatAlertMessage } from './message.js';
import { readTelegramConfig, sendTelegramMessage, TelegramConfig } from './telegram.js';

export * from './diff.js';
export { formatAlertMessage, DASHBOARD_URL } from './message.js';
export { readTelegramConfig, sendTelegramMessage } from './telegram.js';

export type AlertOutcome = 'disabled' | 'baseline' | 'empty' | 'sent' | 'failed';

export interface SnapshotAlerterOptions {
  /** null — алерты выключены. По умолчанию читается из TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID. */
  config?: TelegramConfig | null;
  /** Замена отправки (тесты, локальная проверка). По умолчанию — Bot API sendMessage. */
  send?: (html: string) => Promise<void>;
  statePath?: string;
  log?: (message: string) => void;
  now?: () => Date;
}

/**
 * Сравнивает сохранённый снимок с состоянием прошлых сканов и шлёт одно сообщение.
 * Состояние — в data/alerts_state.json, а не в прошлом снимке: снимок за день перезаписывается
 * каждые 30 мин, а ниши у порога мигают между сканами — по снимкам одно событие пришло бы много раз.
 */
export class SnapshotAlerter {
  readonly enabled: boolean;
  private readonly send: (html: string) => Promise<void>;
  private readonly statePath: string;
  private readonly log: (message: string) => void;
  private readonly now: () => Date;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: SnapshotAlerterOptions = {}) {
    const config = options.config === undefined ? readTelegramConfig() : options.config;
    this.enabled = config !== null;
    this.send = options.send ?? (html => sendTelegramMessage(config!, html));
    this.statePath = options.statePath ?? path.resolve(process.cwd(), 'data', 'alerts_state.json');
    this.log = options.log ?? console.log;
    this.now = options.now ?? (() => new Date());
  }

  /** Снимки обрабатываются по очереди; промис не отклоняется никогда. */
  handleSnapshot(load: MarketSnapshot | (() => MarketSnapshot | null)): Promise<AlertOutcome> {
    if (!this.enabled) return Promise.resolve('disabled');
    const run = this.queue.then(() => this.process(typeof load === 'function' ? load() : load));
    const safe = run.catch((err: unknown): AlertOutcome => {
      this.log(`[Alerts] ошибка: ${err instanceof Error ? err.message : String(err)}`);
      return 'failed';
    });
    this.queue = safe;
    return safe;
  }

  /** Дождаться обработки всех поставленных снимков. */
  idle(): Promise<void> {
    return this.queue.then(() => undefined);
  }

  private async process(snapshot: MarketSnapshot | null): Promise<AlertOutcome> {
    if (!snapshot) throw new Error('снимок не найден');
    const state = this.loadState();
    const { alerts, nextState } = diffSnapshot(snapshot, state, this.now());
    if (!state) {
      this.saveState(nextState);
      this.log('[Alerts] первый запуск: текущий снимок принят за базу, сообщение не отправлено');
      return 'baseline';
    }
    if (hasAlerts(alerts)) {
      try {
        await this.send(formatAlertMessage(alerts));
      } catch (err) {
        // Состояние не сохраняем: те же события уйдут со следующим сканом
        this.log(`[Alerts] не отправлено: ${err instanceof Error ? err.message : String(err)}`);
        return 'failed';
      }
    }
    this.saveState(nextState);
    if (!hasAlerts(alerts)) return 'empty';
    this.log(
      `[Alerts] отправлено: ниш ${alerts.niches.length}, ростов ${alerts.risers.length}, ` +
        `источников ${alerts.degraded.length + alerts.recovered.length}`
    );
    return 'sent';
  }

  private loadState(): AlertState | null {
    if (!fs.existsSync(this.statePath)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(this.statePath, 'utf-8')) as Partial<AlertState>;
      if (!raw || typeof raw.seen !== 'object' || typeof raw.sources !== 'object' || !raw.seen || !raw.sources) {
        throw new Error('bad shape');
      }
      return { seen: raw.seen, sources: raw.sources };
    } catch {
      this.log('[Alerts] битый alerts_state.json — состояние начато заново');
      return null;
    }
  }

  private saveState(state: AlertState): void {
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    const tmp = `${this.statePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmp, this.statePath);
  }
}

/** Подписка на snapshot:updated: снимок читается из хранилища уже после сохранения, скан не ждёт отправку. */
export function attachSnapshotAlerts(eventBus: MarketEventBus, store: SnapshotStore, alerter: SnapshotAlerter): void {
  if (!alerter.enabled) return;
  eventBus.on('snapshot:updated', (data: unknown) => {
    const id = (data as { snapshotId?: unknown } | null)?.snapshotId;
    void alerter.handleSnapshot(() => (typeof id === 'string' ? store.getSnapshotById(id) : store.getLatestSnapshot()));
  });
}
