export interface AutoScannerOptions {
  intervalMs: number;
  /** Выполняет скан; reject = неудача (включается backoff). */
  run: () => Promise<unknown>;
  /** Время последнего успешного снимка (мс) — чтобы не сканировать сразу после рестарта. */
  getLastSnapshotTime: () => number | null;
  log?: (msg: string) => void;
  initialDelayMs?: number;
}

const MIN_DELAY_MS = 5_000;
const BASE_BACKOFF_MS = 60_000;

/**
 * Периодический автоскан с backoff при сбоях. Таймер unref'нут,
 * чтобы не удерживать процесс; повторные запуски не накладываются.
 */
export class AutoScanner {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private failures = 0;
  private stopped = true;
  private _nextRunAt: number | null = null;

  constructor(private readonly opts: AutoScannerOptions) {}

  get nextRunAt(): number | null {
    return this._nextRunAt;
  }

  get consecutiveFailures(): number {
    return this.failures;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    const last = this.opts.getLastSnapshotTime();
    const untilDue = last === null ? 0 : last + this.opts.intervalMs - Date.now();
    this.schedule(this.opts.initialDelayMs ?? Math.max(MIN_DELAY_MS, untilDue));
  }

  stop(): void {
    this.stopped = true;
    this._nextRunAt = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    const jitter = delayMs > 60_000 ? delayMs * (Math.random() * 0.1) : 0;
    const delay = Math.round(delayMs + jitter);
    this._nextRunAt = Date.now() + delay;
    this.timer = setTimeout(() => void this.tick(), delay);
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    if (this.running) {
      this.schedule(MIN_DELAY_MS);
      return;
    }
    this.running = true;
    try {
      await this.opts.run();
      this.failures = 0;
      this.schedule(this.opts.intervalMs);
    } catch (err) {
      this.failures++;
      const backoff = Math.min(this.opts.intervalMs, BASE_BACKOFF_MS * 2 ** (this.failures - 1));
      this.opts.log?.(
        `[AutoScan] сбой #${this.failures}: ${err instanceof Error ? err.message : String(err)}; повтор через ${Math.round(backoff / 1000)}с`
      );
      this.schedule(backoff);
    } finally {
      this.running = false;
    }
  }
}
