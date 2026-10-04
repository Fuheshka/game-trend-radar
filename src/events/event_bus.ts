import { EventEmitter } from 'node:events';
import type * as http from 'node:http';

export interface MarketEventBusOptions {
  heartbeatIntervalMs?: number;
}

export class MarketEventBus extends EventEmitter {
  private clients: Set<http.ServerResponse> = new Set();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs: number;

  constructor(options: MarketEventBusOptions = {}) {
    super();
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15000;
  }

  /**
   * Регистрирует активное SSE соединение клиента.
   * Возвращает функцию отписки для удобной очистки.
   */
  public registerClient(res: http.ServerResponse): () => void {
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
    const message = `event: ${event}\ndata: ${payload}\n\n`;

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
