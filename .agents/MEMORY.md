# Memory: Game Trend Radar

> Локальная память проекта и статус компонентов для автономной работы агента.

---

## 1. Обзор проекта
- **Название:** Game Trend Radar
- **Путь:** `/Users/fuheshka/Documents/GitHub/game-trend-radar`
- **Стек:** TypeScript (Node.js 20+), tsx, модульные коллекторы данных, скоринговый калькулятор, CLI интерфейс.
- **Целевые платформы:** Roblox (Explore API), Яндекс Игры (Каталог), Poki (Чарт), YouTube Shorts (Тренды).

---

## 2. Структура директорий
- `src/types/` — строгая типизация нормализованных и сырых данных.
- `src/collectors/` — сборщики данных для каждой платформы (Roblox, Яндекс Игры, Poki, YouTube Shorts).
- `src/analyzer/` — скоринг Opportunity Score, классификатор архетипов, генератор вердиктов, детектор арбитражных ниш (Roblox ➔ Яндекс Игры).
- `src/storage/` — управление снимками рынка (JSON snapshots) и Markdown отчетами.
- `src/cli.ts` — точка входа командной строки (scan, report, recommend).
- `data/snapshots/` и `data/reports/` — локальные снимки и отчеты.
- База знаний и промпты: `Obsidian Vault/10 Projects/11 Active/Game Trend Radar — Анализ Рынка и Трендов Игр/`.

---

## 3. Статус компонентов
- [x] Инициализация Git-репозитория и чистый init-коммит (`94459ce`).
- [x] Полный пакет документации в Obsidian Vault (00-03, 08 Каталог Промптов).
- [x] Базовая реализация ядра (Types, Collectors, Scorer, Classifier, Verdict, Storage, CLI) зафиксирована коммитом `16602ba`.
- [x] Проведено первое боевое сканирование рынка (324 игры, CCU ~8.95M).
- [x] Расширен модуль `YouTubeShortsAnalyzer`: живое сканирование срезов (#shorts, #roblox, #gamedev) через Invidious/YouTube Data API v3, детекция вирусных сущностей (Skibidi, Digital Circus, Brainrot, Steal An Egg), расчет Viral Multiplier и интеграция со Scorer.
- [x] Подключен тестовый фреймворк Vitest, реализован набор из 9 изолированных тестов с моками API (`tests/YouTubeShorts.test.ts`, 100% PASS).
- [x] Разработана концепция полной автоматизации трендов без ручного ввода: `04 Автоматические Источники Трендов и Мониторинг.md`, в Каталог Промптов добавлен Спринт 6 (YouTube Autocomplete, Unsupervised N-Gram Extractor, Reddit Buzz, Dynamic Memes Cache).
- [x] Реализован детектор арбитражных ниш геймдева (Arbitrage Detector, Шаг 4.2): двуязычное кросс-платформенное сопоставление каталогов Roblox и Яндекс Игр по семантике названий и архетипам (`CONCEPT_DICTIONARY`), выявление хитов с CCU > 100k без прямых аналогов в топ-100 Яндекс Игр, генерация бейджей «ARBITRAGE OPPORTUNITY» в CLI и отчете Markdown (`src/analyzer/arbitrage.ts`, `tests/Arbitrage.test.ts`, 20/20 тестов Vitest PASS).
- [x] Разделение вертикального скролла на 4 изолированных экрана рабочих пространств (`WorkspaceTabs.ts`, переключение табов мышью и клавишами `1`-`4`, закрытие drawer по `Esc`, сохранение позиций скролла, Linear/Raycast дизайн-система, `tests/WorkspaceTabs.test.ts`, 189/189 тестов PASS, Vite build OK).
- [x] Реализована вкладка лидеров роста и опережающих социальных индикаторов рынка (`MoversView.ts`, таб 2 `#view-movers` / хоткей `2`): 3 секции (24h CCU Gainers по абсолютному и процентному приросту, YouTube Shorts Viral Signals с `viralMultiplier >= 1.5x`, взрывные новинки `< 14 дней`), спарклайны трендов, теги архетипов и кнопка инспектора для каждой карточки, `tests/MoversView.test.ts`, 238/238 тестов PASS, Vite build OK).
- [x] Реализован нативный SSE эндпоинт `GET /api/events` в `src/server.ts` на стандартном модуле `node:http` и шина событий `MarketEventBus` (`src/events/event_bus.ts` на базе `node:events.EventEmitter`): регулярный heartbeat-комментарий (`: ping\n\n`) каждые 15 сек, регистрация/отписка клиентов по `req.on('close')`, метод `broadcast(event, data)`, трансляция стадий сканирования рынка (`scan:started`, `scan:completed`, `snapshot:updated`), тесты `tests/SSEStream.test.ts` (10/10 PASS).
- [x] Интеграция шины событий в `MarketScanner` (`src/scanner.ts`, `tests/ScannerEvents.test.ts`): класс `MarketScanner` на базе `EventEmitter` с поддержкой `MarketEventBus` и коллбэка `onProgress`, последовательная трансляция реального прогресса сбора по витринам (`scan:started`, `collector:progress` для roblox 25%, yandex_games 55%, poki 75%, youtube_shorts 90%, `scan:completed` с `snapshotId` и `totalGames`), внедрение зависимостей для мгновенного мокирования, сохранение функции `runMarketScan` для обратной совместимости, 8/8 тестов Vitest PASS, 256/256 тестов проекта PASS.
- [x] Клиентский сервис реального времени `LiveEventService` (`web/src/services/liveEventService.ts`) и интеграция SSE в дашборд 2.0: нативный браузерный `EventSource` без внешних зависимостей, автореконнект с экспоненциальным бэкоффом (1s -> 2s -> 4s -> max 30s), волосковый прогресс-бар в шапке (`HeaderStatusBar.ts`, `style.css`), пульсирующий зеленый/янтарный LED активности канала. Полное удаление старого фейкового таймера `setInterval` из `triggerLiveScan()`, реактивное обновление всех 4 вкладок при `scan:completed` без перезагрузки страницы, процедурный Web Audio аккорд `soundService.playScanFinish()`. 11/11 тестов `tests/LiveEventService.test.ts`, 16/16 тестов `tests/HeaderStatusBar.test.ts`, 268/268 тестов Vitest PASS, Vite production build 100% OK.
- [x] Production конфигурация PM2 и регулярное фоновое сканирование (Cron & SSE): создан `ecosystem.config.cjs` (имя `game-trend-radar`, автоопределение `dist/server.js` с fallback на `src/server.ts` через `--import tsx`, `PORT=4200`, `NODE_ENV=production`, лимит памяти 512MB, ротация логов в `logs/`), подготовлен скрипт развертывания `scripts/deploy.sh` (`git pull`, `npm install`, `npm run build`, `npm run web:build`, `pm2 restart ecosystem.config.cjs`), скрипт регулярного сбора `scripts/nightly_scan.sh` (`POST /api/scan` с авто-оповещением подключенных клиентов по SSE), документация в `README.md` (настройка cron на 03:00 UTC, reverse proxy Nginx с отключением буферизации `proxy_buffering off;`).
- [x] Готовые конфигурационные файлы веб-серверов (Nginx & Caddy) для домена `fuheshka.qd.je`: созданы `deploy/nginx.conf` (блок `server_name fuheshka.qd.je;`, проксирование на `127.0.0.1:4200`, отключение буферизации `proxy_buffering off; chunked_transfer_encoding off; gzip off;` для `/api/events`, сжатие Gzip, строгие security headers, поддержка Certbot ACME HTTP-01 challenge) и `deploy/Caddyfile` (автоматический HTTPS через Let's Encrypt / ZeroSSL, немедленный сброс чанков `flush_interval -1` для SSE, HTTP/3, security headers). Пошаговые инструкции по привязке DNS A-записи и выпуску SSL через Certbot добавлены в `README.md` и `README.ru.md`. Написан тестовый сьют `tests/DeployConfigs.test.ts` (11/11 тестов Vitest PASS, общий сьют 279/279 PASS).
- [x] Аудит безопасности и CI (2026-10-18): общий `web/src/utils/dom.ts` (`escapeHtml`/`safeUrl`/`safeHref`) вместо 8 копий, экранирование данных витрин в `ArbitrageMatrix`/`MoversView`, блок `javascript:`-ссылок; в production без `SCAN_TOKEN` ручной `POST /api/scan` → 403; лимит SSE (`SSE_MAX_CLIENTS`, 503); `execFile` вместо `exec`; typecheck `web/` (`tsconfig.web.json`), `ci.yml` на PR, `DEPLOY_KNOWN_HOSTS`; типизированное чтение JSON внешних API (`src/utils/json.ts`). 301/301 тестов PASS.
- [x] Данные сканов вне git (2026-10-18): `latest_snapshot.json` и `data/reports/*.md` не коммитятся; Pages при сборке и каждые 6 ч скачивает снимок с `radar.fuheshka.qd.je/api/snapshots/latest` (`vars.SNAPSHOT_URL`), `deploy.sh` сохраняет серверные отчёты при переходе.
- [x] Структура фронтенда после разбиения: `web/src/app/` (search, metrics), `web/src/services/snapshotApi.ts`, общие `web/src/utils/{dom,format,labels}.ts`; крупные компоненты разрезаны на `components/{gameTable,promptGenerator,movers,radarChart,detailDrawer}/`. Мёртвый `GameCatalog` удалён (каталог = `GameTableView`). `tests/MarkupContract.test.ts` сверяет значения `index.html` с обработчиками.

---

## 4. Бэклог следующей сессии (составлен 2026-10-18 после PR #3)

> Порядок — по приоритету. Перед стартом: `git pull`, `npm ci`, `npm run typecheck && npm test && npm run web:build` должны быть зелёными. Изменения и найденные баги записывать в `implementation-notes.md` (раздел `## N.` в формате Проблема → Причина → Решение), статус — сюда.

### A. Дизайн / UX (замечено на скриншотах прода 390px и 1440px)
- [x] **Двойная панель управления каталогом.** (2026-10-19) Оставлена `.catalog-toolbar` из `index.html`; `gameTable/toolbar.ts` удалён, селект сортировки синхронизирован с кликом по заголовку, вид по умолчанию «Таблица». См. `implementation-notes.md` §31.
- [x] **Мобильная шапка.** (2026-10-19) ≤720px: название видно, KPI переносятся строками, вкладки сеткой 2×2, хоткей-бейджи скрыты (баг специфичности). §31.
- [x] **Пустое состояние без сервера (GitHub Pages).** (2026-10-19) Если `/api/snapshots` недоступен, кнопка скана скрыта, вместо неё ссылка «Скан доступен на radar.fuheshka.qd.je»; e2e-сценарий. См. `implementation-notes.md` §32.
- [ ] **Pages: статус SSE и селектор срезов.** На статике метка «Статика» перетирается «Реконнект...» (EventSource бесконечно ретраит `/api/events`), селектор срезов остаётся «Загрузка срезов...». Не подключать SSE в режиме «нет API», в селекторе показать дату статического снимка.

### B. Работоспособность / производительность
- [x] **11 231 DOM-узел и ~4.2 с до готовности.** (2026-10-19) Каталог/лидеры/арбитраж монтируются при первом открытии вкладки, новинки — 24 карточки + «Показать все»: старт 11 067 → 1 365 узлов. Первая страница каталога 100 → 50 строк: после открытия вкладки 5 528 → 3 483 узла, рендер 163 → 102 мс. Время до готовности на проде (до PR) — 1.6 с; после деплоя перемерить. §32.
- [x] **Хрупкие коллекторы.** (2026-10-19) Контрактные тесты на снимках витрин (`tests/fixtures/collectors/`, `CollectorContracts.test.ts`); `sourceStatus[x].warning`, если count < 50% от последнего здорового скана или ниже минимума (Яндекс 50, Poki 30, Roblox 50); видно в шапке и в `/healthz` (`sources`). §32.
- [x] **Нет e2e в CI.** (2026-10-19) `e2e/smoke.spec.ts` (5 сценариев, вкл. мобильные 390px и бюджет DOM), `npm run e2e`, job `e2e` в `ci.yml`.
- [ ] `main.ts` всё ещё ~1540 строк: `initElements` (~200) и `setupComponents` (~300) — разнести по контроллерам вкладок.

### C. Фичи (идеи, требуют решения владельца)
- [ ] Алерты о новых арбитражных нишах / резких ростах (Telegram-бот или e-mail) по событию `snapshot:updated`.
- [ ] Страница игры с историей CCU по дням (`data/game_history.json` уже копится на сервере).
- [ ] Сравнение двух произвольных снимков (сейчас только «текущий vs предыдущий»).
- [ ] Новые витрины: CrazyGames, VK Play.

### Состояние прода на 2026-10-18 21:09 UTC
- `https://radar.fuheshka.qd.je/healthz` — ok, автоскан каждые 30 мин, все 4 источника `ok` (Roblox 279, Яндекс 153, Poki 100, YouTube 5).
- Владельцу: проверить `SCAN_TOKEN` в `/home/radar/game-trend-radar/.env`; опционально секрет `DEPLOY_KNOWN_HOSTS`.
