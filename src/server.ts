import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { SnapshotStore } from './storage/snapshot_store.js';
import { runMarketScan } from './scanner.js';
import { MarketSnapshot } from './types/index.js';

export interface RadarServerOptions {
  port?: number;
  host?: string;
  store?: SnapshotStore;
  staticDir?: string;
  silent?: boolean;
  open?: boolean;
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

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function createRadarServer(options: RadarServerOptions = {}) {
  const port = options.port ?? (process.env.PORT ? parseInt(process.env.PORT, 10) : 4200);
  const host = options.host ?? '0.0.0.0';
  const store = options.store ?? new SnapshotStore();
  const defaultStaticDir = fs.existsSync(path.resolve(process.cwd(), 'web/dist'))
    ? path.resolve(process.cwd(), 'web/dist')
    : path.resolve(process.cwd(), 'web');
  const staticDir = options.staticDir ?? defaultStaticDir;
  const log = options.silent ? () => {} : console.log;

  let activeScanPromise: Promise<MarketSnapshot> | null = null;

  const server = http.createServer(async (req, res) => {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(reqUrl.pathname);

    // API Routes
    if (pathname.startsWith('/api/')) {
      try {
        if (pathname === '/api/snapshots/latest' && req.method === 'GET') {
          const snapshot = store.getLatestSnapshot();
          if (!snapshot) {
            sendJson(res, 404, { error: 'No snapshots available. Trigger a scan via POST /api/scan.' });
            return;
          }
          sendJson(res, 200, snapshot);
          return;
        }

        if (pathname === '/api/verdicts' && req.method === 'GET') {
          const snapshot = store.getLatestSnapshot();
          if (!snapshot) {
            sendJson(res, 200, []);
            return;
          }
          sendJson(res, 200, snapshot.verdicts);
          return;
        }

        if (pathname === '/api/scan' && req.method === 'POST') {
          log('📡 Получен запрос POST /api/scan — запуск сканирования рынка...');
          if (!activeScanPromise) {
            activeScanPromise = runMarketScan({ store, silent: options.silent })
              .finally(() => {
                activeScanPromise = null;
              });
          } else {
            log('ℹ️ Сканирование уже выполняется, ожидаем завершения текущего процесса...');
          }

          const snapshot = await activeScanPromise;
          sendJson(res, 200, snapshot);
          return;
        }

        // Unknown API route
        sendJson(res, 404, { error: `Endpoint ${req.method} ${pathname} not found` });
        return;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        sendJson(res, 500, { error: 'Internal Server Error', message });
        return;
      }
    }

    // Static Files Handling from web/
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    const normalizedPath = path.normalize(pathname);
    const targetPath = path.resolve(staticDir, '.' + normalizedPath);

    // Security check against directory traversal
    if (!targetPath.startsWith(staticDir)) {
      sendJson(res, 403, { error: 'Access Denied' });
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
      <li><code>POST /api/scan</code> — инициировать живое сканирование рынка</li>
    </ul>
    <p style="color: #94a3b8; font-size: 0.9rem;">Директория клиентского бандла: <code>web/</code></p>
  </div>
</body>
</html>`;
          res.writeHead(200, {
            ...CORS_HEADERS,
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

        res.writeHead(404, { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(finalPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const fileBuffer = fs.readFileSync(finalPath);

      res.writeHead(200, {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length,
      });

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      res.end(fileBuffer);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: 'Failed to read static file', message });
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

          resolve(actualPort);
        });
      });
    },
    stop: (): Promise<void> => {
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
}
