import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { SnapshotStore } from './storage/snapshot_store.js';
import { runMarketScan, ScanValidationError } from './scanner.js';
import { MarketSnapshot } from './types/index.js';
import { MarketEventBus } from './events/event_bus.js';
import { AutoScanner } from './cron/auto_scan.js';
import { TrendScheduler } from './cron/trend_scheduler.js';

export { MarketEventBus };

const gzipAsync = promisify(zlib.gzip);

export interface RadarServerOptions {
  port?: number;
  host?: string;
  store?: SnapshotStore;
  eventBus?: MarketEventBus;
  staticDir?: string;
  silent?: boolean;
  open?: boolean;
  /** Если задан — POST /api/scan требует `Authorization: Bearer <token>` (env SCAN_TOKEN). */
  scanToken?: string;
  /** Минимальная пауза между ручными сканами, мс (env SCAN_COOLDOWN_MS, по умолчанию 30с). */
  scanCooldownMs?: number;
  /** Интервал автоскана в минутах; 0 = выключен (env SCAN_INTERVAL_MIN). */
  scanIntervalMinutes?: number;
}

export function openBrowser(url: string): void {
  if (process.env.CI || process.env.VITEST || process.env.NODE_ENV === 'test') {
    return;
  }
  const platform = process.platform;
  let cmd = '';
  if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  try {
    exec(cmd, () => {});
  } catch {
    // Silently ignore browser launch errors
  }
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const COMPRESSIBLE = /^(text\/|application\/(javascript|json)|image\/svg)/;
const TRENDS_MAX_AGE_MS = 24 * 3600_000;

const corsOrigin = () => process.env.CORS_ORIGIN || '*';

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': corsOrigin(),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

async function sendJson(
  req: http.IncomingMessage | null,
  res: http.ServerResponse,
  statusCode: number,
  data: unknown,
  extraHeaders: Record<string, string> = {}
) {
  let body: Buffer = Buffer.from(JSON.stringify(data));
  const headers: Record<string, string | number> = {
    ...corsHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Accept-Encoding',
    ...extraHeaders,
  };
  if (body.length > 1024 && /\bgzip\b/.test(String(req?.headers['accept-encoding'] ?? ''))) {
    body = await gzipAsync(body);
    headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(statusCode, headers);
  res.end(body);
}

function tokenMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

interface StaticEntry {
  mtimeMs: number;
  size: number;
  body: Buffer;
  gzip: Buffer | null;
  etag: string;
}

export function createRadarServer(options: RadarServerOptions = {}) {
  const port = options.port ?? (process.env.PORT ? parseInt(process.env.PORT, 10) : 4200);
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';
  const store = options.store ?? new SnapshotStore();
  const eventBus = options.eventBus ?? new MarketEventBus({ eventIds: true });
  eventBus.startHeartbeat();
  const defaultStaticDir = fs.existsSync(path.resolve(process.cwd(), 'web/dist'))
    ? path.resolve(process.cwd(), 'web/dist')
    : path.resolve(process.cwd(), 'web');
  const staticDir = options.staticDir ?? defaultStaticDir;
  const log = options.silent ? () => {} : console.log;

  const scanToken = options.scanToken ?? process.env.SCAN_TOKEN ?? '';
  const scanCooldownMs = options.scanCooldownMs ?? parseInt(process.env.SCAN_COOLDOWN_MS || '30000', 10);
  const scanIntervalMin = options.scanIntervalMinutes ?? parseInt(process.env.SCAN_INTERVAL_MIN || '0', 10);

  const startedAt = Date.now();
  let activeScanPromise: Promise<MarketSnapshot> | null = null;
  let activeScanStartedAt: number | null = null;
  let lastScanFinishedAt = 0;
  let lastScanError: string | null = null;
  const staticCache = new Map<string, StaticEntry>();

  const runScan = (): Promise<MarketSnapshot> => {
    if (activeScanPromise) return activeScanPromise;
    activeScanStartedAt = Date.now();
    activeScanPromise = runMarketScan({ store, silent: options.silent, eventBus })
      .then(snapshot => {
        lastScanError = null;
        return snapshot;
      })
      .catch(err => {
        lastScanError = err instanceof Error ? err.message : String(err);
        // ScanValidationError scanner уже транслировал сам
        if (!(err instanceof ScanValidationError)) {
          eventBus.broadcast('scan:failed', { error: lastScanError });
        }
        throw err;
      })
      .finally(() => {
        activeScanPromise = null;
        activeScanStartedAt = null;
        lastScanFinishedAt = Date.now();
      });
    return activeScanPromise;
  };

  const refreshTrendsIfStale = async () => {
    const memesPath = path.resolve(process.cwd(), 'data', 'dynamic_memes.json');
    try {
      const age = fs.existsSync(memesPath) ? Date.now() - fs.statSync(memesPath).mtimeMs : Infinity;
      if (age > TRENDS_MAX_AGE_MS) {
        log('[AutoScan] словарь трендов устарел — обновляем...');
        await new TrendScheduler({ silent: options.silent }).run();
      }
    } catch (err) {
      log(`[AutoScan] не удалось обновить словарь трендов: ${err instanceof Error ? err.message : err}`);
    }
  };

  const autoScanner =
    scanIntervalMin > 0
      ? new AutoScanner({
          intervalMs: scanIntervalMin * 60_000,
          log,
          getLastSnapshotTime: () => {
            const latest = store.getLatestSnapshot();
            const t = latest ? Date.parse(latest.timestamp) : NaN;
            return Number.isFinite(t) ? t : null;
          },
          run: async () => {
            await refreshTrendsIfStale();
            await runScan();
          },
        })
      : null;

  async function loadStatic(filePath: string): Promise<StaticEntry> {
    const stat = await fs.promises.stat(filePath);
    const cached = staticCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached;
    const body = await fs.promises.readFile(filePath);
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    const gzip = body.length > 1024 && COMPRESSIBLE.test(type) ? await gzipAsync(body) : null;
    const entry: StaticEntry = {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      body,
      gzip,
      etag: `"${createHash('sha1').update(body).digest('hex').slice(0, 16)}"`,
    };
    staticCache.set(filePath, entry);
    return entry;
  }

  const server = http.createServer(async (req, res) => {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let pathname: string;
    try {
      pathname = decodeURIComponent(reqUrl.pathname);
    } catch {
      await sendJson(req, res, 400, { error: 'Bad Request' });
      return;
    }

    // API Routes
    if (pathname === '/healthz' || pathname.startsWith('/api/')) {
      try {
        if (pathname === '/healthz' && req.method === 'GET') {
          const latest = store.getLatestSnapshot();
          const ageMin = latest ? Math.round((Date.now() - Date.parse(latest.timestamp)) / 60_000) : null;
          const staleLimit = scanIntervalMin > 0 ? scanIntervalMin * 3 : 36 * 60;
          await sendJson(req, res, 200, {
            status: latest === null ? 'empty' : ageMin! > staleLimit ? 'stale' : 'ok',
            uptimeSec: Math.round((Date.now() - startedAt) / 1000),
            lastSnapshot: latest ? { id: latest.id, timestamp: latest.timestamp, ageMinutes: ageMin } : null,
            scanning: activeScanPromise !== null,
            lastScanError,
            sseClients: eventBus.getClientCount(),
            autoScan: autoScanner
              ? {
                  intervalMinutes: scanIntervalMin,
                  nextRunAt: autoScanner.nextRunAt ? new Date(autoScanner.nextRunAt).toISOString() : null,
                  consecutiveFailures: autoScanner.consecutiveFailures,
                }
              : null,
          });
          return;
        }

        if (pathname === '/api/history' && req.method === 'GET') {
          const hours = Math.min(Math.max(parseInt(reqUrl.searchParams.get('hours') || '24', 10) || 24, 1), 24 * 14);
          await sendJson(req, res, 200, store.getHistory(hours));
          return;
        }

        if (pathname === '/api/snapshots' && req.method === 'GET') {
          const snapshots = store.listSnapshots();
          await sendJson(req, res, 200, snapshots);
          return;
        }

        if (pathname === '/api/snapshots/latest' && req.method === 'GET') {
          const snapshot = store.getLatestSnapshot();
          if (!snapshot) {
            await sendJson(req, res, 404, { error: 'No snapshots available. Trigger a scan via POST /api/scan.' });
            return;
          }
          await sendJson(req, res, 200, snapshot, { 'Cache-Control': 'no-cache' });
          return;
        }

        if (pathname.startsWith('/api/snapshots/') && req.method === 'GET') {
          const id = pathname.slice('/api/snapshots/'.length);
          if (!id) {
            const snapshots = store.listSnapshots();
            await sendJson(req, res, 200, snapshots);
            return;
          }
          const snapshot = store.getSnapshotById(id);
          if (!snapshot) {
            await sendJson(req, res, 404, { error: `Snapshot with id '${id}' not found` });
            return;
          }
          await sendJson(req, res, 200, snapshot);
          return;
        }

        if (pathname === '/api/verdicts' && req.method === 'GET') {
          const snapshot = store.getLatestSnapshot();
          await sendJson(req, res, 200, snapshot ? snapshot.verdicts : []);
          return;
        }

        if (pathname === '/api/events' && req.method === 'GET') {
          res.writeHead(200, {
            ...corsHeaders(),
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          });
          res.write('retry: 3000\n\n');
          if (typeof (res as any).flushHeaders === 'function') {
            (res as any).flushHeaders();
          }

          const lastIdHeader = req.headers['last-event-id'];
          const lastEventId = lastIdHeader ? parseInt(String(lastIdHeader), 10) : undefined;
          const unregister = eventBus.registerClient(res, lastEventId);

          req.on('close', () => {
            unregister();
          });
          return;
        }

        if (pathname === '/api/scan' && req.method === 'POST') {
          if (scanToken) {
            const auth = String(req.headers['authorization'] || '');
            const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
            if (!provided || !tokenMatches(provided, scanToken)) {
              await sendJson(req, res, 401, { error: 'Unauthorized: valid Bearer token required for POST /api/scan' }, {
                'WWW-Authenticate': 'Bearer',
              });
              return;
            }
          }

          const wait = reqUrl.searchParams.get('wait') === '1';
          const alreadyRunning = activeScanPromise !== null;

          if (!alreadyRunning) {
            const sinceLast = Date.now() - lastScanFinishedAt;
            if (lastScanFinishedAt > 0 && sinceLast < scanCooldownMs) {
              const retryAfter = Math.ceil((scanCooldownMs - sinceLast) / 1000);
              await sendJson(req, res, 429, { error: 'Scan cooldown', retryAfterSec: retryAfter }, {
                'Retry-After': String(retryAfter),
              });
              return;
            }
            log('📡 Получен запрос POST /api/scan — запуск сканирования рынка...');
          } else {
            log('ℹ️ Сканирование уже выполняется, присоединяемся к текущему процессу...');
          }

          const scanPromise = runScan();

          if (!wait) {
            scanPromise.catch(() => {}); // ошибка уходит в SSE (scan:failed) и /healthz
            await sendJson(req, res, 202, {
              status: alreadyRunning ? 'running' : 'started',
              startedAt: new Date(activeScanStartedAt ?? Date.now()).toISOString(),
            });
            return;
          }

          try {
            const snapshot = await scanPromise;
            await sendJson(req, res, 200, snapshot);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await sendJson(req, res, 502, { error: 'Scan failed', message });
          }
          return;
        }

        // Unknown API route
        await sendJson(req, res, 404, { error: `Endpoint ${req.method} ${pathname} not found` });
        return;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await sendJson(req, res, 500, { error: 'Internal Server Error', message });
        return;
      }
    }

    // Static Files Handling from web/
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      await sendJson(req, res, 405, { error: 'Method Not Allowed' });
      return;
    }

    const normalizedPath = path.normalize(pathname);
    const targetPath = path.resolve(staticDir, '.' + normalizedPath);

    // Security check against directory traversal
    if (targetPath !== staticDir && !targetPath.startsWith(staticDir + path.sep)) {
      await sendJson(req, res, 403, { error: 'Access Denied' });
      return;
    }

    const hasExtension = Boolean(path.extname(pathname));
    const acceptHeader = req.headers.accept || '';
    const isHtmlRequest = acceptHeader.includes('text/html');

    try {
      let finalPath = targetPath;
      let stat = fs.existsSync(finalPath) ? fs.statSync(finalPath) : null;

      // If directory requested, look for index.html
      if (stat?.isDirectory()) {
        const indexPath = path.join(finalPath, 'index.html');
        if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
          finalPath = indexPath;
          stat = fs.statSync(finalPath);
        } else {
          stat = null;
        }
      }

      // SPA fallback only for extensionless routes when client requests HTML
      if ((!stat || !stat.isFile()) && (!hasExtension || isHtmlRequest)) {
        const spaIndexPath = path.join(staticDir, 'index.html');
        if (fs.existsSync(spaIndexPath) && fs.statSync(spaIndexPath).isFile()) {
          finalPath = spaIndexPath;
          stat = fs.statSync(finalPath);
        }
      }

      // If still not found (e.g. web/ empty or missing)
      if (!stat || !stat.isFile()) {
        if (pathname === '/' || pathname === '/index.html') {
          const fallbackHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Game Trend Radar Server</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 2rem; }
    .card { max-width: 640px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155; }
    h1 { margin-top: 0; color: #38bdf8; font-size: 1.5rem; }
    a { color: #38bdf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #0f172a; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📡 Game Trend Radar API Server (порт ${port})</h1>
    <p>Локальный сервер аналитического радара запущен и готов к работе.</p>
    <h3>Доступные эндпоинты:</h3>
    <ul>
      <li><a href="/api/snapshots/latest">GET /api/snapshots/latest</a> — последний снимок рынка</li>
      <li><a href="/api/verdicts">GET /api/verdicts</a> — список вердиктов со статусами и скорингом</li>
      <li><a href="/api/events">GET /api/events</a> — нативный SSE поток событий реального времени</li>
      <li><code>POST /api/scan</code> — инициировать живое сканирование рынка</li>
    </ul>
    <p style="color: #94a3b8; font-size: 0.9rem;">Директория клиентского бандла: <code>web/</code></p>
  </div>
</body>
</html>`;
          res.writeHead(200, {
            ...corsHeaders(),
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': Buffer.byteLength(fallbackHtml),
          });
          if (req.method === 'HEAD') {
            res.end();
            return;
          }
          res.end(fallbackHtml);
          return;
        }

        res.writeHead(404, { ...corsHeaders(), 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(finalPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const entry = await loadStatic(finalPath);

      const isHashedAsset = /[\\/]assets[\\/]/.test(finalPath) && /-[A-Za-z0-9_-]{8}\.\w+$/.test(finalPath);
      const headers: Record<string, string | number> = {
        ...corsHeaders(),
        'Content-Type': contentType,
        ETag: entry.etag,
        'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
        Vary: 'Accept-Encoding',
      };

      if (req.headers['if-none-match'] === entry.etag) {
        res.writeHead(304, headers);
        res.end();
        return;
      }

      const useGzip = entry.gzip !== null && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
      const payload = useGzip ? entry.gzip! : entry.body;
      if (useGzip) headers['Content-Encoding'] = 'gzip';
      headers['Content-Length'] = payload.length;

      res.writeHead(200, headers);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await sendJson(req, res, 500, { error: 'Failed to read static file', message });
    }
  });

  const isDirectRun =
    Boolean(process.argv[1] &&
    (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js')));

  const shouldOpen =
    options.open ??
    (!options.silent &&
      !process.env.CI &&
      !process.env.VITEST &&
      (process.argv.includes('--open') || (isDirectRun && !process.argv.includes('--no-open'))));

  return {
    server,
    port,
    eventBus,
    autoScanner,
    start: (): Promise<number> => {
      return new Promise((resolve, reject) => {
        server.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE' && isDirectRun) {
            const dashboardUrl = `http://localhost:${port}/`;
            console.log(`\n  \x1b[33mℹ️ Сервер уже запущен на порту ${port}\x1b[0m`);
            console.log(`  \x1b[1;32m➜\x1b[0m  \x1b[1mДашборд:\x1b[0m   \x1b[1;36m\x1b[4m${dashboardUrl}\x1b[0m \x1b[90m(кликните для перехода)\x1b[0m\n`);
            if (shouldOpen) {
              console.log(`  \x1b[32m🌐 Открываем дашборд в браузере:\x1b[0m \x1b[4m${dashboardUrl}\x1b[0m\n`);
              openBrowser(dashboardUrl);
            }
            resolve(port);
            return;
          }
          reject(err);
        });

        server.listen(port, host, () => {
          const addr = server.address();
          const actualPort = typeof addr === 'object' && addr ? addr.port : port;
          const dashboardUrl = `http://localhost:${actualPort}/`;
          const apiUrl = `http://localhost:${actualPort}/api/snapshots/latest`;
          const isDist = fs.existsSync(path.resolve(process.cwd(), 'web/dist/index.html'));
          const bundleLabel = isDist ? 'web/dist (Vite Production)' : 'web/ (Static Source)';

          if (!options.silent) {
            console.log('\n  \x1b[1;36m🚀 GAME TREND RADAR | Web Analytics Dashboard\x1b[0m \x1b[90mv1.0.0\x1b[0m\n');
            console.log(`  \x1b[1;32m➜\x1b[0m  \x1b[1mДашборд (Local):\x1b[0m   \x1b[1;36m\x1b[4m${dashboardUrl}\x1b[0m \x1b[90m(кликните для перехода)\x1b[0m`);
            console.log(`  \x1b[1;34m➜\x1b[0m  \x1b[1mСнимок рынка API:\x1b[0m  \x1b[34m\x1b[4m${apiUrl}\x1b[0m`);
            console.log(`  \x1b[1;35m➜\x1b[0m  \x1b[1mСтатический UI:\x1b[0m    \x1b[90m${bundleLabel}\x1b[0m`);
            console.log(`\n  \x1b[90m• Остановка сервера: нажмите Ctrl+C\x1b[0m\n`);

            if (shouldOpen) {
              console.log(`  \x1b[32m🌐 Открываем дашборд в браузере:\x1b[0m \x1b[4m${dashboardUrl}\x1b[0m\n`);
              openBrowser(dashboardUrl);
            }
          }

          autoScanner?.start();
          if (autoScanner && !options.silent) {
            console.log(`  \x1b[90m• Автоскан каждые ${scanIntervalMin} мин\x1b[0m\n`);
          }
          resolve(actualPort);
        });
      });
    },
    stop: (): Promise<void> => {
      autoScanner?.stop();
      eventBus.closeAllClients();
      return new Promise((resolve, reject) => {
        server.close(err => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isDirectRun) {
  const radarServer = createRadarServer();
  radarServer.start().catch(err => {
    console.error('Ошибка запуска сервера:', err);
    process.exit(1);
  });
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.once(sig, () => {
      radarServer.stop().finally(() => process.exit(0));
      setTimeout(() => process.exit(0), 3000).unref();
    });
  }
}
