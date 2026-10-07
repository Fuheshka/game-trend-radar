import { EventEmitter } from 'node:events';
import type * as http from 'node:http';

export interface MarketEventBusOptions {
  heartbeatIntervalMs?: number;
  /** Нумеровать события (`id:`) и хранить буфер для replay по Last-Event-ID. */
  eventIds?: boolean;
  replayBufferSize?: number;
}

export class MarketEventBus extends EventEmitter {
  private clients: Set<http.ServerResponse> = new Set();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs: number;
  private readonly eventIds: boolean;
  private readonly replayBufferSize: number;
  private nextEventId = 1;
  private replayBuffer: Array<{ id: number; message: string }> = [];

  constructor(options: MarketEventBusOptions = {}) {
    super();
    this.eventIds = options.eventIds ?? false;
    this.replayBufferSize = options.replayBufferSize ?? 50;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15000;
  }

  /**
   * Регистрирует активное SSE соединение клиента.
   * Возвращает функцию отписки для удобной очистки.
   */
  public registerClient(res: http.ServerResponse, lastEventId?: number): () => void {
    if (this.eventIds && lastEventId !== undefined && Number.isFinite(lastEventId)) {
      for (const entry of this.replayBuffer) {
        if (entry.id > lastEventId) {
          try {
            res.write(entry.message);
          } catch {
            break;
          }
        }
      }
    }
    this.clients.add(res);
    return () => this.removeClient(res);
  }

  /**
   * Удаляет клиента из пула активных подписчиков.
   */
  public removeClient(res: http.ServerResponse): void {
    this.clients.delete(res);
  }

  /**
   * Возвращает текущее количество активных подключений.
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Рассылает форматированное SSE сообщение всем активным клиентам.
   * Формат SSE: `event: <name>\ndata: <json/string>\n\n`
   */
  public broadcast(event: string, data: unknown): void {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    let message = `event: ${event}\ndata: ${payload}\n\n`;
    if (this.eventIds) {
      const id = this.nextEventId++;
      message = `id: ${id}\n${message}`;
      this.replayBuffer.push({ id, message });
      if (this.replayBuffer.length > this.replayBufferSize) this.replayBuffer.shift();
    }

    for (const client of this.clients) {
      try {
        client.write(message);
      } catch {
        this.clients.delete(client);
      }
    }

    this.emit(event, data);
    this.emit('broadcast', { event, data });
  }

  /**
   * Отправляет heartbeat комментарий (: ping\n\n) для предотвращения разрыва
   * соединения со стороны reverse-proxy (Nginx / Cloudflare / Caddy).
   */
  public sendHeartbeat(): void {
    const pingMessage = ': ping\n\n';
    for (const client of this.clients) {
      try {
        client.write(pingMessage);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Запускает фоновый таймер периодической отправки ping.
   */
  public startHeartbeat(intervalMs?: number): void {
    if (this.heartbeatTimer) return;
    const interval = intervalMs ?? this.heartbeatIntervalMs;
    if (interval > 0) {
      this.heartbeatTimer = setInterval(() => {
        this.sendHeartbeat();
      }, interval);
      if (this.heartbeatTimer.unref) {
        this.heartbeatTimer.unref();
      }
    }
  }

  /**
   * Останавливает фоновый таймер heartbeat.
   */
  public stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Завершает все активные клиентские соединения и останавливает таймер.
   */
  public closeAllClients(): void {
    this.stopHeartbeat();
    for (const client of this.clients) {
      try {
        client.end();
      } catch {
        // Игнорируем ошибки завершения уже закрытых сокетов
      }
    }
    this.clients.clear();
  }
}
