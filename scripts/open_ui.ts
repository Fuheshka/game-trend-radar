import * as http from 'node:http';
import { createRadarServer, openBrowser } from '../src/server.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4200;
const URL = `http://localhost:${PORT}/`;

function isServerActive(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}/api/snapshots/latest`, { timeout: 350 }, res => {
      resolve(res.statusCode !== undefined);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const shouldOpen = !process.argv.includes('--no-open') && !process.env.CI && !process.env.VITEST;
  const running = await isServerActive(PORT);

  if (running) {
    console.log('\n  \x1b[1;36m🚀 GAME TREND RADAR | Web Analytics Dashboard\x1b[0m \x1b[90m(сервер уже активен)\x1b[0m\n');
    console.log(`  \x1b[1;32m➜\x1b[0m  \x1b[1mДашборд (Local):\x1b[0m   \x1b[1;36m\x1b[4m${URL}\x1b[0m \x1b[90m(кликните для перехода)\x1b[0m`);
    console.log(`  \x1b[1;34m➜\x1b[0m  \x1b[1mСнимок рынка API:\x1b[0m  \x1b[34m\x1b[4m${URL}api/snapshots/latest\x1b[0m\n`);

    if (shouldOpen) {
      console.log(`  \x1b[32m🌐 Открываем дашборд в браузере:\x1b[0m \x1b[4m${URL}\x1b[0m\n`);
      openBrowser(URL);
    }
    return;
  }

  // Запуск сервера с автоматическим открытием
  const server = createRadarServer({ port: PORT, open: shouldOpen });
  await server.start();
}

main().catch(err => {
  console.error('Ошибка в scripts/open_ui.ts:', err);
  process.exit(1);
});
