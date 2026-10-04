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


