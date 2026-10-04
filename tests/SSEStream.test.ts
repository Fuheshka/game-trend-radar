import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as http from 'node:http';
import { createRadarServer } from '../src/server.js';
import { MarketEventBus } from '../src/events/event_bus.js';
import { SnapshotStore } from '../src/storage/snapshot_store.js';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

describe('MarketEventBus (Шина событий)', () => {
  it('должен наследоваться от EventEmitter и поддерживать стандартные события', () => {
    const bus = new MarketEventBus();
    let received = false;
    bus.on('custom-test', (payload) => {
      if (payload === 'ok') received = true;
    });
    bus.emit('custom-test', 'ok');
    expect(received).toBe(true);
  });

  it('должен регистрировать и удалять клиентские соединения', () => {
    const bus = new MarketEventBus();
    const mockRes1 = { write: () => true } as unknown as http.ServerResponse;
    const mockRes2 = { write: () => true } as unknown as http.ServerResponse;

    const unregister1 = bus.registerClient(mockRes1);
    bus.registerClient(mockRes2);
    expect(bus.getClientCount()).toBe(2);

    unregister1();
    expect(bus.getClientCount()).toBe(1);

    bus.removeClient(mockRes2);
    expect(bus.getClientCount()).toBe(0);
  });

  it('должен форматировать и рассылать SSE сообщения через broadcast()', () => {
    const bus = new MarketEventBus();
    const chunks1: string[] = [];
    const chunks2: string[] = [];

    const mockRes1 = {
      write: (data: string) => {
        chunks1.push(data);
        return true;
      },
    } as unknown as http.ServerResponse;

    const mockRes2 = {
      write: (data: string) => {
        chunks2.push(data);
        return true;
      },
    } as unknown as http.ServerResponse;

    bus.registerClient(mockRes1);
    bus.registerClient(mockRes2);

    bus.broadcast('scan:progress', { source: 'roblox', count: 100, pct: 25 });

    const expected = `event: scan:progress\ndata: {"source":"roblox","count":100,"pct":25}\n\n`;
    expect(chunks1).toEqual([expected]);
    expect(chunks2).toEqual([expected]);
  });

  it('должен корректно отправлять строковые данные без повторной сериализации', () => {
    const bus = new MarketEventBus();
    const chunks: string[] = [];
    const mockRes = {
      write: (data: string) => {
        chunks.push(data);
        return true;
      },
    } as unknown as http.ServerResponse;

    bus.registerClient(mockRes);
    bus.broadcast('ping-test', 'raw-payload');

    expect(chunks).toEqual(['event: ping-test\ndata: raw-payload\n\n']);
  });

  it('должен отправлять heartbeat-комментарий (: ping\\n\\n)', () => {
    const bus = new MarketEventBus();
    const chunks: string[] = [];
    const mockRes = {
      write: (data: string) => {
        chunks.push(data);
        return true;
      },
    } as unknown as http.ServerResponse;

    bus.registerClient(mockRes);
    bus.sendHeartbeat();

    expect(chunks).toEqual([': ping\n\n']);
  });

  it('должен автоматически удалять клиента при ошибке записи', () => {
    const bus = new MarketEventBus();
    const faultyRes = {
      write: () => {
        throw new Error('Socket closed');
      },
    } as unknown as http.ServerResponse;

    bus.registerClient(faultyRes);
    expect(bus.getClientCount()).toBe(1);

    bus.broadcast('test', { ok: true });
    expect(bus.getClientCount()).toBe(0);
  });
});

describe('Native SSE Endpoint GET /api/events в createRadarServer', () => {
  let tempDir: string;
  let serverInstance: ReturnType<typeof createRadarServer>;
  let baseUrl: string;
  let eventBus: MarketEventBus;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-sse-test-'));
    const store = new SnapshotStore(tempDir);
    eventBus = new MarketEventBus({ heartbeatIntervalMs: 50 });

    serverInstance = createRadarServer({
      port: 0,
      host: '127.0.0.1',
      store,
      eventBus,
      silent: true,
    });

    const port = await serverInstance.start();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  beforeEach(async () => {
    // Ждем освобождения всех клиентских сокетов от предыдущих тестов
    const start = Date.now();
    while (eventBus.getClientCount() > 0 && Date.now() - start < 500) {
      await new Promise((r) => setTimeout(r, 15));
    }
  });

  afterAll(async () => {
    await serverInstance.stop();
    eventBus.closeAllClients();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('должен возвращать статус 200 и правильные SSE и CORS заголовки', async () => {
    await new Promise<void>((resolve, reject) => {
      const req = http.get(`${baseUrl}/api/events`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('text/event-stream');
        expect(res.headers['cache-control']).toBe('no-cache');
        expect(res.headers['connection']).toBe('keep-alive');
        expect(res.headers['access-control-allow-origin']).toBe('*');

        res.on('close', resolve);
        req.destroy();
      });
      req.on('error', (err) => {
        if ((err as any).code !== 'ECONNRESET') reject(err);
      });
    });
  });

  it('должен регистрировать подключенного клиента и получать broadcast события', async () => {
    expect(eventBus.getClientCount()).toBe(0);

    const receivedChunks: string[] = [];
    let closeStream: () => void;

    const streamPromise = new Promise<void>((resolve, reject) => {
      const req = http.get(`${baseUrl}/api/events`, (res) => {
        res.on('data', (chunk: Buffer) => {
          receivedChunks.push(chunk.toString('utf-8'));
          if (receivedChunks.some((c) => c.includes('scan:started'))) {
            resolve();
          }
        });
      });
      req.on('error', (err) => {
        if ((err as any).code !== 'ECONNRESET') {
          reject(err);
        }
      });
      closeStream = () => req.destroy();
    });

    // Ожидаем пока клиент зарегистрируется в шине
    const startWait = Date.now();
    while (eventBus.getClientCount() === 0 && Date.now() - startWait < 500) {
      await new Promise((r) => setTimeout(r, 15));
    }
    expect(eventBus.getClientCount()).toBe(1);

    // Рассылаем событие
    eventBus.broadcast('scan:started', { timestamp: '2026-10-04T12:00:00.000Z' });

    await streamPromise;

    const combined = receivedChunks.join('');
    expect(combined).toContain('event: scan:started\n');
    expect(combined).toContain('data: {"timestamp":"2026-10-04T12:00:00.000Z"}\n\n');

    closeStream!();

    // Даем сокету закрыться и сработать req.on('close')
    const closeWait = Date.now();
    while (eventBus.getClientCount() > 0 && Date.now() - closeWait < 500) {
      await new Promise((r) => setTimeout(r, 15));
    }
    expect(eventBus.getClientCount()).toBe(0);
  });

  it('должен поддерживать трансляцию heartbeat-комментариев (: ping\\n\\n)', async () => {
    const receivedChunks: string[] = [];
    let closeStream: () => void;

    const pingPromise = new Promise<void>((resolve, reject) => {
      const req = http.get(`${baseUrl}/api/events`, (res) => {
        res.on('data', (chunk: Buffer) => {
          receivedChunks.push(chunk.toString('utf-8'));
          if (receivedChunks.some((c) => c.includes(': ping\n\n'))) {
            resolve();
          }
        });
      });
      req.on('error', (err) => {
        if ((err as any).code !== 'ECONNRESET') reject(err);
      });
      closeStream = () => req.destroy();
    });

    await pingPromise;

    const combined = receivedChunks.join('');
    expect(combined).toContain(': ping\n\n');

    closeStream!();
    const closeWait = Date.now();
    while (eventBus.getClientCount() > 0 && Date.now() - closeWait < 500) {
      await new Promise((r) => setTimeout(r, 15));
    }
    expect(eventBus.getClientCount()).toBe(0);
  });

  it('должен доставлять broadcast нескольким независимым клиентам одновременно', async () => {
    expect(eventBus.getClientCount()).toBe(0);

    const received1: string[] = [];
    const received2: string[] = [];
    let req1: http.ClientRequest;
    let req2: http.ClientRequest;

    const p1 = new Promise<void>((resolve) => {
      req1 = http.get(`${baseUrl}/api/events`, (res) => {
        res.on('data', (chunk) => {
          received1.push(chunk.toString());
          if (received1.some((c) => c.includes('broadcast-multi'))) resolve();
        });
      });
    });

    const p2 = new Promise<void>((resolve) => {
      req2 = http.get(`${baseUrl}/api/events`, (res) => {
        res.on('data', (chunk) => {
          received2.push(chunk.toString());
          if (received2.some((c) => c.includes('broadcast-multi'))) resolve();
        });
      });
    });

    const regWait = Date.now();
    while (eventBus.getClientCount() < 2 && Date.now() - regWait < 500) {
      await new Promise((r) => setTimeout(r, 15));
    }
    expect(eventBus.getClientCount()).toBe(2);

    eventBus.broadcast('broadcast-multi', { id: 42 });

    await Promise.all([p1, p2]);

    expect(received1.join('')).toContain('event: broadcast-multi\ndata: {"id":42}\n\n');
    expect(received2.join('')).toContain('event: broadcast-multi\ndata: {"id":42}\n\n');

    req1!.destroy();
    req2!.destroy();

    const closeWait = Date.now();
    while (eventBus.getClientCount() > 0 && Date.now() - closeWait < 500) {
      await new Promise((r) => setTimeout(r, 15));
    }
    expect(eventBus.getClientCount()).toBe(0);
  });
});
