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
