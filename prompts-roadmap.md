# Game Trend Radar: Дорожная карта и каталог промптов оживления

> [!abstract] Интерактивный сборник промптов (кликабельные чекбоксы и сворачиваемые блоки)
> Полный актуализированный каталог промптов для Game Trend Radar по канону *Cursed Bloodline*:
> - **Спринт 6: Полная автоматизация мониторинга (Zero-Maintenance Trend Engine)**: автоматический сбор поисковых подсказок YouTube, N-Gram NLP детекция новых мемов и сбор вирусного фона Reddit.
> - **Спринт 7: Оживление визуала, радара и микро-динамика (Game Feel & Motion)**: сканирующий луч радара, пульсирующие точки обнаружения, плавные счетчики цифр (count-up), бегущая строка трендов (Live Ticker) и тактильные Web Audio звуки.
> - **Спринт 8: Эксплорер каталога 473 игр и боковая панель (Deep Data Exploration)**: выезжающая шторка деталей (Drawer) для игр и архетипов, таб прямого каталога всех игр со ссылками на витрины и быстрый поиск с тегами.
> - **Спринт 9: Матрица арбитража и кросс-платформенные зазоры (Arbitrage Matrix Hub)**: полноценный интерактивный раздел арбитражных возможностей со сравнением Roblox, Яндекс Игр и Poki, процентом схожести и стратегиями клонирования.
> - **Спринт 10: Практические инструменты разработчика и история снимков (Tools & Timeline)**: генератор готовых GDD-промптов для ИИ (Unity / Godot / WebGL), селектор исторических снимков с динамикой роста (▲/▼) и экспорт отчетов.

---

## Спринт 6: Полная автоматизация мониторинга (Zero-Maintenance Trend Engine)

- [x] **Промпт 6.1: YouTube Autocomplete & Invidious Gaming Trends Harvester**

> [!note]- Текст промпта 6.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail) [/test-driven-development](slashCommand;test-driven-development)
> 
> ### 1. Цель
> Реализовать автоматический сбор реальных поисковых запросов пользователей через YouTube Search Autocomplete API и суточных трендов Invidious Gaming без ручного ввода ключевых слов.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `src/collectors/youtube_autocomplete.ts` создан класс `YouTubeAutocompleteHarvester`.
> - Метод `fetchSearchSuggestions(prefixes: string[])` опрашивает `suggestqueries.google.com/complete/search?client=youtube&ds=yt&q={prefix}` по префиксам ('roblox ', 'shorts roblox ', 'роблокс ', 'game dev shorts ', 'simulator roblox ').
> - Парсинг JSONP/JSON ответа, очистка от дублей, нормализация и выделение растущих поисковых суффиксов.
> - Метод `fetchTrendingGamingVideos()` опрашивает `https://{invidious}/api/v1/trending?type=gaming` для извлечения топ-50 игровых видео суток.
> - Отказоустойчивость: таймауты 5000 мс (`AbortController`), ротация публичных зеркал Invidious, структурированный возврат подсказок без падения процесса.
> - Написаны Vitest тесты `tests/YouTubeAutocomplete.test.ts` с моками ответов API.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `src/collectors/youtube_autocomplete.ts`, `tests/YouTubeAutocomplete.test.ts`.
> - **Чего НЕ трогаем**: коллектор Roblox и существующий модуль YouTube Shorts.
> 
> ### 4. Проверка
> - Запусти тесты Vitest: `npx vitest run tests/YouTubeAutocomplete.test.ts` (100% pass).
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов: не делай `git commit` без прямого текстового подтверждения.
> ```

- [ ] **Промпт 6.2: Автоматический N-Gram и трендовый NLP детектор (Unsupervised Trend Extractor)**

> [!note]+ Текст промпта 6.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail) [/test-driven-development](slashCommand;test-driven-development)
> 
> ### 1. Цель
> Реализовать алгоритм автоматического обнаружения новых мемов и игровых тем по чартам Roblox и YouTube без использования ручного фиксированного словаря.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `src/analyzer/trend_extractor.ts` создан класс `UnsupervisedTrendExtractor`.
> - Очистка названий игр от рекламного мусора (эмодзи, теги `[UPDATE]`, `[NEW]`, спецсимволы).
> - Токенизация и построение биграмм (2 слова) и триграмм (3 слова) с подсчетом частотности и суммарного CCU.
> - Детекция аномалий роста (Velocity Spike): сравнение частотности N-граммы с предыдущим снимком рынка из `data/snapshots/`.
> - Если N-грамма встречается в 3+ разных играх и частота выросла в 2.5+ раза — автоматическая регистрация тренда.
> - Автоматическое определение связанного архетипа (`SIMULATION_INCREMENTAL`, `PHYSICS_SANDBOX` и т.д.) через `src/analyzer/classifier.ts`.
> - Написаны тесты `tests/TrendExtractor.test.ts` с симуляцией появления вирусного мема ('Steal An Egg', 'Tungsten Cube').
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `src/analyzer/trend_extractor.ts`, `tests/TrendExtractor.test.ts`.
> - **Чего НЕ трогаем**: существующую классификацию `classifier.ts`.
> 
> ### 4. Проверка
> - Запусти тесты Vitest: `npx vitest run tests/TrendExtractor.test.ts` (100% pass).
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов: не делай `git commit` без прямого текстового подтверждения.
> ```

- [x] **Промпт 6.3: Reddit JSON API & Social Buzz Harvester**

> [!note]- Текст промпта 6.3
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail) [/test-driven-development](slashCommand;test-driven-development)
> 
> ### 1. Цель
> Реализовать сбор вирусных обсуждений, концептов и мемов из игровых сабреддитов через открытый Reddit JSON API без необходимости регистрации платных API-ключей.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `src/collectors/reddit_buzz.ts` создан класс `RedditBuzzHarvester`.
> - Запросы к `https://www.reddit.com/r/{subreddit}/hot.json?limit=50` с уникальным `User-Agent`.
> - Целевые сабреддиты: `r/roblox`, `r/RobloxAvatars`, `r/gamedev`, `r/memes`.
> - Фильтрация постов: отбор с `ups > 100` или `num_comments > 50` за последние 48 часов.
> - Извлечение повторяющихся ключевых сущностей из заголовков и расчет показателя социального резонанса (`Buzz Score`).
> - Написаны тесты `tests/RedditBuzz.test.ts` с моками ответов Reddit API.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `src/collectors/reddit_buzz.ts`, `tests/RedditBuzz.test.ts`.
> - **Чего НЕ трогаем**: сетевые запросы Roblox.
> 
> ### 4. Проверка
> - Запусти тесты Vitest: `npx vitest run tests/RedditBuzz.test.ts` (100% pass).
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов: не делай `git commit` без прямого текстового подтверждения.
> ```

- [ ] **Промпт 6.4: Динамический кэш мемов и фоновый планировщик автообновления**

> [!note]+ Текст промпта 6.4
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail) [/test-driven-development](slashCommand;test-driven-development)
> 
> ### 1. Цель
> Объединить все авто-источники в единый самообновляемый словарь `data/dynamic_memes.json` и связать его с `YouTubeShortsAnalyzer`.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `src/cron/trend_scheduler.ts` создан класс `TrendScheduler`: оркестрация сбора (YouTube Autocomplete + Reddit Buzz + Roblox N-Gram).
> - Сохранение и актуализация `data/dynamic_memes.json` с метаданными (`confidenceScore`, `firstSeen`, `trendStatus`).
> - Интеграция с `YouTubeShortsAnalyzer`: динамическая подгрузка мемов из `data/dynamic_memes.json` с сохранением обратной совместимости с базовыми темами.
> - В `package.json` добавлена команда `"update-trends": "tsx src/cron/trend_scheduler.ts"`.
> - Написаны тесты `tests/TrendScheduler.test.ts` (100% покрытие).
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `src/cron/trend_scheduler.ts`, `data/dynamic_memes.json`, `package.json`, `tests/TrendScheduler.test.ts`.
> - **Чего НЕ трогаем**: существующие тесты YouTubeShorts.
> 
> ### 4. Проверка
> - Запусти общий тестовый прогон `npm test`: все тесты зеленые.
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов: не делай `git commit` без прямого текстового подтверждения.
> ```

---

## Спринт 7: Оживление визуала, радара и микро-динамика (Game Feel & Motion)

- [ ] **Промпт 7.1: Динамический сканирующий луч радара и пульсирующие цели (Radar Animation & Blips)**

> [!note]+ Текст промпта 7.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail) [/better-ui](slashCommand;better-ui)
> 
> ### 1. Цель
> Оживить круговую диаграмму радара в RadarChartComponent: добавить плавно вращающийся сканирующий луч (sweep line beam) и светящиеся пульсирующие точки обнаруженных архетипов и игр (radar blips).
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `web/src/components/RadarChart.ts` поверх SVG-сетки реализован вращающийся конический градиентный луч (`radar-sweep-beam`), синхронизированный с CSS-анимацией или requestAnimationFrame.
> - На осях и полигонах архетипов отрисованы светящиеся маркеры-точки (`radar-blip`) с волновой анимацией эхо-отклика (`ping ripple`) в момент прохождения луча.
> - При наведении курсора на сектор или точку происходит плавное масштабирование с неоновым свечением, а в тултипе отображается название архетипа и Opportunity Score.
> - Производительность: строгие 60 FPS, отсутствие утечек памяти в requestAnimationFrame, очистка таймеров при перерендере диаграммы.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/components/RadarChart.ts`, `web/src/style.css`.
> - **Чего НЕ трогаем**: логику расчета осей скоринга и бэкенд.
> 
> ### 4. Проверка
> - Запусти сборку `npm run web:build` и тесты `npm test`: сборка проходит без ошибок TypeScript.
> - Проверь визуальное вращение луча и реакцию точек при клике и наведении.
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов: не делай `git commit` без прямого текстового подтверждения.
> ```

- [ ] **Промпт 7.2: Плавные счетчики нарастания метрик (Count-up Animation)**

> [!note]+ Текст промпта 7.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail) [/better-ui](slashCommand;better-ui)
> 
> ### 1. Цель
> Реализовать плавную анимацию нарастания чисел (count-up effect) для глобальных метрик (суммарный онлайн CCU, количество игр, топовый скоринг, число арбитражных ниш) при первой загрузке и смене снимков.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `web/src/` создана утилита `animateCounter(element: HTMLElement, start: number, end: number, durationMs: number, formatFn?: (val: number) => string): void` с плавной функцией плавности (ease-out cubic / quart).
> - При вызове `updateGlobalMetrics()` в `web/src/main.ts` числа плавно взлетают от 0 (или предыдущего значения) до целевого за 800-1200 мс с форматированием (например, `9.9M`, `473`, `86/100`).
> - Карточки метрик в момент обновления получают легкий неоновый импульс (`glow-pulse`).
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/main.ts`, `web/src/style.css`, вспомогательный файл утилит в `web/src/utils/animation.ts` (при необходимости).
> - **Чего НЕ трогаем**: разметку метрик в `web/index.html`.
> 
> ### 4. Проверка
> - Запусти `npm run typecheck` и `npm test`: тесты зеленые, типы валидны.
> - Проверь анимацию при обновлении фильтров и переключении снимков.
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [x] **Промпт 7.3: Бегущая строка горячих трендов (Live Ticker Bar)**

> [!note]- Текст промпта 7.3
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail) [/better-ui](slashCommand;better-ui)
> 
> ### 1. Цель
> Добавить под шапку сайта интерактивную бегущую строку (Live Ticker) с ключевыми сигналами рынка: топ-играми по онлайну, арбитражными находками и вирусными мемами YouTube Shorts.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `web/index.html` и `web/src/main.ts` интегрирован компонент тикера (`.live-ticker-bar`), автоматически формирующий поток карточек на основе загруженного снимка `MarketSnapshot`.
> - Элементы ленты содержат иконку платформы, название игры, статус тренда (например, `🔥 Steal An Egg: 1.6M CCU`, `⚡ Арбитраж: Brookhaven RP (0 клонов в РФ)`, `🚀 Shorts: Catch & Run 98 pts`).
> - Бесконечная плавная CSS-прокрутка без рывков, с автоматической паузой при наведении курсора (`animation-play-state: paused`).
> - Клик по элементу бегущей строки автоматически фильтрует список игр или открывает детали игры в Drawer.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/index.html`, `web/src/main.ts`, `web/src/style.css`.
> - **Чего НЕ трогаем**: бэкенд и сборщики данных.
> 
> ### 4. Проверка
> - Запусти сборку `npm run web:build` и `npm test`: сборка чистая.
> - Проверь плавность прокрутки тикера, реакцию на паузу при hover и переход по клику.
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 7.4: Тактильный звуковой отклик (Web Audio API Synthesizer)**

> [!note]+ Текст промпта 7.4
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Создать автономный легковесный сервис процедурного звука `SoundEffectsService` на базе нативного Web Audio API без внешних аудиофайлов: тактильные щелчки, импульсы радара и переключатель звука в шапке.
> 
> ### 2. Критерии приемки (Definition of Done)
> - Создан `web/src/services/sound.ts`, генерирующий чистые синтезированные микро-звуки через осцилляторы (`AudioContext`, `OscillatorNode`, `GainNode`):
>   1. `playClick()` - мягкий высокочастотный щелчок при нажатии на фильтры и кнопки (50 мс, exponential decay).
>   2. `playRadarPing()` - футуристический колокольный отклик радара при выборе сектора (180 мс, синусоида с резонансом).
>   3. `playScanFinish()` - восходящий аккорд завершения сканирования.
> - В шапке сайта добавлен переключатель звука (иконка динамика `Sound On / Mute`) с сохранением состояния в `localStorage` (по умолчанию выключен для соблюдения web-политик автоплея).
> - Нулевой оверхед по трафику: 0 КБ внешних файлов, поддержка безопасного разблокирования `AudioContext` по первому пользовательскому жесту.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/services/sound.ts`, `web/src/main.ts`, `web/index.html`, `web/src/style.css`.
> - **Чего НЕ трогаем**: внешние mp3/wav ассеты (используем только нативный синтез).
> 
> ### 4. Проверка
> - Запусти `npm run web:build` и `npm test`: компиляция успешна.
> - Проверь работу переключателя звука: корректный синтез при включении и абсолютная тишина при Mute.
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

---

## Спринт 8: Эксплорер каталога 473 игр и боковая панель (Deep Data Exploration)

- [ ] **Промпт 8.1: Выезжающая шторка деталей (Game & Archetype Drawer)**

> [!note]+ Текст промпта 8.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail) [/better-ui](slashCommand;better-ui)
> 
> ### 1. Цель
> Разработать интерактивную выдвижную боковую панель (Drawer / Sheet), открывающуюся по клику на любой чип игры, карточку вердикта или точку на радаре.
> 
> ### 2. Критерии приемки (Definition of Done)
> - Создан компонент `web/src/components/DetailDrawer.ts` с анимацией выезда справа (`transform: translateX(0)`), фоновым затемнением (backdrop-blur) и закрытием по клавише Escape, кнопке-крестику или клику вне панели.
> - В режиме просмотра игры отображаются: название, платформа (бэйджик Roblox / Yandex / Poki / Shorts), реальный CCU, like-ratio, прямая кнопка-ссылка на страницу игры, теги и сопоставленный архетип.
> - В режиме просмотра архетипа отображаются: расширенный Core Loop, декомпозиция формулы Opportunity Score, список входящих в архетип игр из снимка с возможностью клика по каждой, стратегия монетизации и риски.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/components/DetailDrawer.ts`, `web/src/main.ts`, `web/src/style.css`.
> - **Чего НЕ трогаем**: структуру `MarketSnapshot`.
> 
> ### 4. Проверка
> - Запусти сборку `npm run web:build` и проверь открытие шторки по клику на чипы игр в карточках вердиктов.
> - Проверь корректное закрытие по Esc и свайпу/клику по backdrop.
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 8.2: Вкладка каталога всех 473 игр (Game Explorer Catalog)**

> [!note]+ Текст промпта 8.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail) [/better-ui](slashCommand;better-ui)
> 
> ### 1. Цель
> Вывести наружу все 473 игры из загруженного снимка в виде интерактивного каталога с возможностью переключения между режимами отображения («Сводка ниш» и «Каталог игр»).
> 
> ### 2. Критерии приемки (Definition of Done)
> - В интерфейс добавлены вкладки переключения: `[Ниши и вердикты]` и `[Каталог игр (N)]`.
> - В режиме каталога отображается адаптивная сетка карточек игр или компактная таблица: платформа с иконкой, заголовок, жанр, архетип, CCU (с форматированием), лайки, теги и кнопка перехода на витрину.
> - Добавлен слайдер фильтрации по минимальному онлайну: `Минимальный CCU: 0 ... 100k+`.
> - Клик по карточке игры открывает детальную информацию в Drawer.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/index.html`, `web/src/main.ts`, `web/src/components/GameCatalog.ts`, `web/src/style.css`.
> - **Чего НЕ трогаем**: сборщики данных и серверные API.
> 
> ### 4. Проверка
> - Запусти `npm run web:build` и `npm test`: сборка без ошибок.
> - Проверь переключение вкладок, фильтрацию по слайдеру онлайна и поиск по названию внутри каталога игр.
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 8.3: Быстрые теги-фильтры и улучшенный поиск (Quick Filter Chips)**

> [!note]+ Текст промпта 8.3
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Улучшить панель поиска: добавить динамические кликабельные теги популярных жанров и механик под строкой поиска и кнопку быстрой очистки поля.
> 
> ### 2. Критерии приемки (Definition of Done)
> - Под строкой поиска генерируется горизонтальный скролл популярных тегов (например: `Симуляторы`, `Хоррор`, `Обби`, `Головоломки`, `Песочница`, `Кликеры`, `Мемы Shorts`).
> - Клик по тегу мгновенно подставляет значение в поиск или активирует соответствующий фильтр.
> - В поле поиска добавлена кнопка очистки (`×`), видимая только при наличии введенного текста, с быстрым сбросом по клику или нажатию клавиши Escape.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/main.ts`, `web/index.html`, `web/src/style.css`.
> - **Чего НЕ трогаем**: бэкенд анализатора.
> 
> ### 4. Проверка
> - Проверь работу кнопки очистки и фильтрацию по клику на каждый тег.
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

---

## Спринт 9: Матрица арбитража и кросс-платформенные зазоры (Arbitrage Matrix Hub)

- [ ] **Промпт 9.1: Интерактивная матрица арбитража (Arbitrage Matrix Hub)**

> [!note]+ Текст промпта 9.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail) [/better-ui](slashCommand;better-ui)
> 
> ### 1. Цель
> Создать выделенный аналитический экран «Матрица Арбитража», наглядно визуализирующий зазоры спроса между Roblox, Яндекс Играми и Poki на основе данных `snapshot.arbitrageOpportunities`.
> 
> ### 2. Критерии приемки (Definition of Done)
> - Добавлен таб / раздел «Матрица Арбитража» (`ArbitrageMatrixComponent`).
> - Для каждой возможности отрисована подробная карточка сравнения рынков:
>   1. Игра-донор: название, платформа (Roblox/Shorts), CCU, рейтинг.
>   2. Ближайший найденный аналог в целевой витрине с полосой сходства (например: `Turbo Weave — 36% схожести`).
>   3. Индикатор окна возможностей: `VERY_HIGH` (зеленая рамка, свободная ниша), `HIGH` (желтая), с расчетом запаса времени до появления первых клонов (2-4 недели).
>   4. Конкретная стратегия адаптации: рекомендованный движок (Vite/Canvas vs Unity WebGL), оптимизация веса билда (< 15 МБ) и модель монетизации (Rewarded Video).
>   5. Предложенный локализованный заголовок для витрины РФ.
> - Кнопка фильтра «Только с онлайном от 100k CCU».
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/components/ArbitrageMatrix.ts`, `web/src/main.ts`, `web/src/style.css`, `web/index.html`.
> - **Чего НЕ трогаем**: математику детекции арбитража в `src/analyzer/arbitrage.ts`.
> 
> ### 4. Проверка
> - Запусти `npm run web:build` и `npm test`: тесты зеленые.
> - Проверь корректность отображения всех арбитражных связок из последнего снимка.
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 9.2: Карточка питча арбитражной ниши и быстрый экспорт**

> [!note]+ Текст промпта 9.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Добавить в карточки арбитража кнопку «Скопировать питч ниши» для отправки издателю или инвестору в структурированном виде (Markdown).
> 
> ### 2. Критерии приемки (Definition of Done)
> - На каждой карточке матрицы арбитража добавлена кнопка «Скопировать питч».
> - По клику в буфер обмена копируется готовый текст: источник тренда, доказательство спроса (CCU в Roblox), текущий статус в Яндекс Играх/Poki, предлагаемая адаптация, стек и оценка окупаемости.
> - Отображается всплывающий тост об успешном копировании в буфер обмена.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/components/ArbitrageMatrix.ts`, `web/src/style.css`.
> - **Чего НЕ трогаем**: серверную часть.
> 
> ### 4. Проверка
> - Проверь клик по кнопке копирования и формат скопированного текста.
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

---

## Спринт 10: Практические инструменты разработчика и история снимков (Tools & Timeline)

- [ ] **Промпт 10.1: Генератор GDD-промпта для ИИ в один клик (AI GDD Prompt Generator)**

> [!note]+ Текст промпта 10.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Реализовать генератор готового технического задания (GDD-промпта) для ИИ-ассистентов (Cursor, Claude, ChatGPT) на основе выбранного архетипа или арбитражной ниши.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В карточки вердиктов и в Drawer добавлена кнопка «Сгенерировать ТЗ для ИИ».
> - При клике открывается модальное окно с выбором целевого движка/стека (Unity WebGL / Godot 4 / Vite+Canvas / Roblox Studio).
> - Автоматически компилируется детализированный промпт: архитектурный каркас, схема Core Loop, спецификация компонентов, модель монетизации, перечень подводных камней и правила оптимизации под целевую витрину.
> - Кнопка копирования в буфер с визуальным откликом.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/components/PromptGeneratorModal.ts`, `web/src/main.ts`, `web/src/style.css`.
> - **Чего НЕ трогаем**: существующую логику вердиктов.
> 
> ### 4. Проверка
> - Проверь генерацию промпта для разных архетипов и движков: текст должен быть содержательным и применимым на практике.
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 10.2: История снимков и индикаторы динамики трендов (Timeline & Trend Velocity)**

> [!note]+ Текст промпта 10.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Подключить историю сохраненных снимков из папки data/snapshots/ с выпадающим списком дат в шапке и расчетом динамики роста онлайна (▲/▼).
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `src/server.ts` добавлен эндпоинт `GET /api/snapshots` (список доступных снимков с датами и количеством игр) и `GET /api/snapshots/:id`.
> - В шапке сайта добавлен селектор сохраненных срезов рынка (с отображением даты: 29 сен, 28 сен, 27 сен и т.д.).
> - При переключении снимка интерфейс мягко обновляет данные с анимацией.
> - В карточках вердиктов вычисляется и отображается динамика по сравнению с предыдущим снимком (например: `CCU: +14.2% ▲` зеленым или `-5.1% ▼` красным).
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `src/server.ts`, `src/storage/snapshot_store.ts`, `web/src/main.ts`, `web/src/style.css`, `tests/Server.test.ts`.
> - **Чего НЕ трогаем**: алгоритмы парсеров внешних API.
> 
> ### 4. Проверка
> - Напиши юнит-тесты на новые эндпоинты в `tests/Server.test.ts`: 100% тестов пройдены.
> - Запусти сервер и проверь переключение дат в веб-интерфейсе.
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 10.3: Экспорт отчета в Markdown и JSON (Report Exporter)**

> [!note]+ Текст промпта 10.3
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Реализовать экспорт текущего аналитического среза в Markdown-документ и JSON-файл прямо из браузера в один клик.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В шапку добавлена выпадающая кнопка «Экспорт отчета» (`[Скачать .md]`, `[Скачать .json]`).
> - Формируемый Markdown-отчет содержит дату, глобальные метрики рынка, топ вердиктов со скорингом и таблицу арбитражных связок в чистом виде (готов для вставки в Obsidian, Notion или GitHub).
> - Скачивание файла инициируется на клиенте через Blob URL без лишних обращений к бэкенду.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/services/exporter.ts`, `web/src/main.ts`, `web/src/style.css`, `web/index.html`.
> - **Чего НЕ трогаем**: серверные маршруты.
> 
> ### 4. Проверка
> - Проверь скачивание Markdown-отчета, открой его и убедись в корректности разметки таблиц и списков.
> - Зафиксируй изменения в `implementation-notes.md`, обнови `/Users/fuheshka/Documents/Obsidian Vault/.agents/MEMORY.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

---

## Спринт 11: Премиальный редизайн интерфейса (Linear & SteamDB Precision Dark)

> [!abstract] Избавление от «нейрослопа» и переход к инструментальному Dark UI
> Перевод сайта из бесконечного одностраничника в модульное рабочее пространство по стандартам **Linear**, **Raycast** и **SteamDB**:
> - Отказ от фиолетового неонового шума в пользу графитовой палитры Void `#08090a` и Carbon `#0f1011`.
> - Волосковые границы `1px solid #23252a` и тактильные внутренние тени клавиш.
> - Плотная таблица каталога 473+ игр со спарклайнами динамики CCU.
> - Сегментированные вкладки с мгновенным переключением и горячими клавишами `1`-`4`.

- [x] **Промпт 11.1: Дизайн-токены Komorebi Slate и типографика Tabular Nums**

> [!note]+ Текст промпта 11.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Полностью обновить CSS дизайн-систему в `web/src/style.css`, удалив все фиолетовые и лавандовые неоновые свечения, и внедрив строгие токены Linear & Raycast Precision Dark.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `:root` файла `web/src/style.css` определены поверхности:
>   - `--surface-void: #08090a` (базовый холст).
>   - `--surface-carbon: #0f1011` (карточки и контейнеры).
>   - `--surface-obsidian: #161718` (приподнятые панели и drawer).
>   - `--surface-recessed: #111214` (поля ввода и поиск).
>   - `--border-hairline: #23252a` (структурные границы 1px).
>   - `--border-focus: #383b3f` (акцентные границы).
> - Цвета типографики: `--text-paper: #ffffff`, `--text-mist: #d0d6e0`, `--text-fog: #8a8f98`, `--text-ash: #62666d`.
> - Семантические акценты: `--accent-lime: #e4f222` (единственный хроматический CTA), `--status-growth: #27a644`, `--status-warning: #f59e0b`, `--status-danger: #eb5757`.
> - Типографика: для числовых колонок онлайна и бейджей подключен `JetBrains Mono` со строгим свойством `font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1;`.
> - Полностью удалены классы с фиолетовыми тенями (`--accent-lavender-glow`, `box-shadow: 0 0 18px ...`).
> - Добавлены тактильные псевдоклассы `:active { transform: scale(0.98); }` для кнопок и табов.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/style.css`.
> - **Чего НЕ трогаем**: логику скриптов TypeScript.
> 
> ### 4. Проверка
> - Открой страницу и убедись, что пропал фиолетовый шум, интерфейс выглядит сдержанно и строго в стиле Linear/Raycast.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 11.2: Модульная навигация по рабочим пространствам (Workspaces & Segmented Tabs)**

> [!note]+ Текст промпта 11.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Разделить монолитный вертикальный скролл страницы на 4 изолированных экрана рабочих пространств с мгновенным переключением через сегментированные табы и горячие клавиши.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `web/src/components/WorkspaceTabs.ts` создан компонент вкладок:
>   - `[ 🛰️ Обзор и Радар ]` (активен по умолчанию)
>   - `[ 📈 Лидеры роста ]`
>   - `[ 🎮 Каталог игр ]`
>   - `[ ⚡ Матрица арбитража ]`
> - В `web/index.html` контент сгруппирован в контейнеры `<section id="view-radar">`, `<section id="view-movers">`, `<section id="view-catalog">`, `<section id="view-arbitrage">`.
> - Переключение вкладок скрывает неактивные экраны (`display: none` / `display: block`), сохраняя состояние скролла каждого экрана.
> - Поддержка клавиатурных шорткатов: нажатие клавиш `1`, `2`, `3`, `4` переключает соответствующие табы; `Esc` закрывает открытый drawer.
> - Сегментированный переключатель оформлен по канону Linear: фон `--surface-carbon`, активная вкладка подсвечена аккуратной рамкой `--border-focus` с легким сдвигом без дерганий верстки.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/components/WorkspaceTabs.ts`, `web/src/main.ts`, `web/index.html`, `web/src/style.css`.
> - **Чего НЕ трогаем**: генерацию данных и аналитику скоринга.
> 
> ### 4. Проверка
> - Проверь переключение табов мышью и клавишами `1`-`4`. Убедись, что на странице больше нет бесконечного скролла.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 11.3: Плавающий Glass Header и компактная полоса KPI**

> [!note]+ Текст промпта 11.3
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Собрать компактную шапку (высота 48px) с полупрозрачным размытием, LED индикатором подключения, селектором дат, кнопкой сканирования в стиле Linear Acid Lime и узкой строкой ключевых KPI.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `web/src/components/HeaderStatusBar.ts` реализован компактный компонент шапки:
>   - Логотип `Game Trend Radar` с версией `v2.0` (шрифт JetBrains Mono 11px).
>   - Живой диод статуса SSE: зеленый пульсирующий LED (`--status-growth`) при активности соединения, серый при оффлайне.
>   - Селектор исторических снимков из `data/snapshots/`.
>   - Высококонтрастная кнопка `⚡ Запустить скан`: фон `--accent-lime (#e4f222)`, текст `--accent-lime-text (#08090a)`, скругление 6px, тактильный отклик.
>   - Кнопка выпадающего меню экспорта отчета (`.md` / `.json`).
> - Под шапкой размещена узкая строка KPI (высота 32-36px):
>   `Всего игр: 473` | `Онлайн: 1.42M (+4.2%)` | `Ниш арбитража: 14` | `Топ дня: Steal An Egg` | `Обновлено: X мин назад`.
> - Старый навязчивый гигантский тикер убран из фиксированной шапки.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/components/HeaderStatusBar.ts`, `web/src/main.ts`, `web/index.html`, `web/src/style.css`.
> - **Чего НЕ трогаем**: алгоритмы расчета метрик.
> 
> ### 4. Проверка
> - Проверь клик по кнопкам, смену снимков и адаптивность шапки при изменении ширины окна.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 11.4: Высокоплотная таблица каталога игр со спарклайнами (SteamDB Data Grid)**

> [!note]+ Текст промпта 11.4
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Переработать каталог 473+ игр в сверхплотную, информативную интерактивную таблицу по эталону SteamDB Charts со спарклайнами трендов и быстрой сортировкой.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `web/src/components/GameTableView.ts` реализована таблица высокой плотности (50+ видимых строк без пустых отступов):
>   - Колонки: `# Ранг`, `Платформа` (компактный бейдж), `Название игры` (с иконкой витрины), `Жанр/Архетип`, `Онлайн CCU` (моноширинный `tabular-nums`), `7d Тренд` (инлайн SVG спарклайн зеленого/красного цвета), `Opportunity Score` (число + микро-индикатор), `Лайки %`, `Действия` (кнопка открытия Drawer).
>   - Клик по заголовкам колонок выполняет мгновенную сортировку (по CCU, по Opportunity, по названию, по лайкам).
>   - Быстрый поиск в шапке таблицы с горячей клавишей `Ctrl+K` / `⌘K` (поле ввода в колодце `--surface-recessed`).
>   - Фильтр-чипсы по платформам: `[Все]`, `[Roblox]`, `[Яндекс Игры]`, `[Poki]`, `[Shorts]`.
>   - Переключатель отображения: `[Таблица (по умолчанию)]` и `[Сетка карточек]`.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/components/GameTableView.ts`, `web/src/main.ts`, `web/src/style.css`.
> - **Чего НЕ трогаем**: формат объектов в `MarketSnapshot`.
> 
> ### 4. Проверка
> - Проверь рендеринг таблицы со спарклайнами, сортировку по всем колонкам и быстрый фильтр по клавише `Ctrl+K`.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [x] **Промпт 11.5: Редизайн радар-секции и вердиктов (Split View Overview & Blueprints)**

> [!note]+ Текст промпта 11.5
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Объединить SVG-радар и карточки вердиктов в компактный двухколоночный сплит-экран, устранив огромные пустые поля и применив тактильные стили карточек Raycast.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `web/src/components/RadarOverviewView.ts` экран обзора скомпонован в 2 колонки:
>   - **Левая колонка (42%):** оптимизированный по размеру SVG-радар (Spider & Polar режимы) с лучом сканирования. При наведении или клике на лепесток архетипа правая колонка мгновенно скроллится к соответствующему вердикту.
>   - **Правая колонка (58%):** карточки вердиктов с тактильной структурой (инсетные тени `--shadow-key`, границы `--border-hairline`, статус-бейджи Green/Yellow/Red).
>   - Каждая карточка содержит: название архетипа, шкалу Opportunity Score, дельту прироста CCU, ключевые хиты ниши, стратегию монетизации и кнопку «Сгенерировать ТЗ для ИИ».
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/components/RadarOverviewView.ts`, `web/src/components/RadarChart.ts`, `web/src/components/VerdictCards.ts`, `web/src/style.css`.
> - **Чего НЕ трогаем**: алгоритм расчета очков Opportunity Scorer.
> 
> ### 4. Проверка
> - Проверь синхронизацию кликов на радаре и подсветки карточек справа.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 11.6: Экран лидеров роста и социальных аномалий (Movers, Shakers & Viral Velocity)**

> [!note]+ Текст промпта 11.6
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Создать вкладку лидеров роста и опережающих социальных индикаторов рынка (в духе DefiLlama Movers & Shakers).
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `web/src/components/MoversView.ts` реализован экран из 3 секций:
>   1. **Топ лидеров роста CCU (24h Gainers):** проекты с максимальным абсолютным и процентным приростом онлайна.
>   2. **Вирусные сигналы YouTube Shorts:** карточки мемов с множителем `viralMultiplier` (>1.5x) до их массового выхода в топы витрин.
>   3. **Взрывные новинки (< 14 дней на платформе):** молодые проекты, быстро набирающие аудиторию.
> - Для каждой карточки отображается спарклайн тренда, теги архетипа и кнопка инспектора.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/components/MoversView.ts`, `web/src/main.ts`, `web/src/style.css`.
> - **Чего НЕ трогаем**: сборщики данных.
> 
> ### 4. Проверка
> - Проверь корректность ранжирования лидеров роста по снимкам рынка.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

---

## Спринт 12: Real-time архитектура на Server-Sent Events (SSE) и потоковый сбор

> [!abstract] Честный стриминг данных от Node.js к браузеру
> Замена имитационных таймеров на нативный потоковый протокол Server-Sent Events (`text/event-stream`):
> - Сервер транслирует реальный ход парсинга по каждой витрине (Roblox, Яндекс, Poki, YouTube).
> - Браузер автоматически получает свежий снимок и обновляет интерфейс без перезагрузки страницы.

- [ ] **Промпт 12.1: Бэкенд-шина событий и эндпоинт SSE в `src/server.ts`**

> [!note]+ Текст промпта 12.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail) [/test-driven-development](slashCommand;test-driven-development)
> 
> ### 1. Цель
> Реализовать нативный SSE эндпоинт `GET /api/events` в `src/server.ts` на стандартном модуле `node:http` (без Express/Socket.io) и шину событий `MarketEventBus`.
> 
> ### 2. Критерии приемки (Definition of Done)
> - Создан класс `MarketEventBus` на базе нативного `node:events.EventEmitter`.
> - В `src/server.ts` добавлен маршрут `GET /api/events`:
>   - Заголовки: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, CORS заголовки.
>   - Регулярный heartbeat-комментарий (`: ping\n\n`) каждые 15 секунд для поддержания соединения через прокси.
>   - Регистрация подключенных клиентов и корректное удаление при `req.on('close')`.
> - Метод `broadcast(event: string, data: any)` рассылает форматированное SSE сообщение (`event: ...\ndata: ...\n\n`) всем активным клиентам.
> - Написаны тесты `tests/SSEStream.test.ts` с проверкой подключения клиента, получения событий и отключения.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `src/server.ts`, `src/events/event_bus.ts`, `tests/SSEStream.test.ts`.
> - **Чего НЕ трогаем**: существующие REST эндпоинты `GET /api/snapshots`.
> 
> ### 4. Проверка
> - Запусти тесты Vitest: `npx vitest run tests/SSEStream.test.ts` (100% pass).
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 12.2: Потоковая оркестрация сбора данных в `src/scanner.ts`**

> [!note]+ Текст промпта 12.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail) [/test-driven-development](slashCommand;test-driven-development)
> 
> ### 1. Цель
> Интегрировать шину событий в `MarketScanner`, чтобы сервер отправлял реальный статус парсинга каждой витрины в процессе сканирования.
> 
> ### 2. Критерии приемки (Definition of Done)
> - `MarketScanner` принимает экземпляр `MarketEventBus` или коллбэк `onProgress`.
> - В процессе сканирования транслируются реальные события:
>   - `scan:started`: время запуска.
>   - `collector:progress`: `{ source: 'roblox', count: 120, pct: 25 }`.
>   - `collector:progress`: `{ source: 'yandex_games', count: 240, pct: 55 }`.
>   - `collector:progress`: `{ source: 'poki', count: 310, pct: 75 }`.
>   - `collector:progress`: `{ source: 'youtube_shorts', count: 473, pct: 90 }`.
>   - `scan:completed`: `{ snapshotId: 'snapshot-YYYY-MM-DD', totalGames: 473 }`.
> - Написаны тесты `tests/ScannerEvents.test.ts` с эмуляцией последовательности событий.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `src/scanner.ts`, `tests/ScannerEvents.test.ts`.
> - **Чего НЕ трогаем**: парсинг конкретных HTML/JSON страниц.
> 
> ### 4. Проверка
> - Запусти тесты Vitest: `npx vitest run tests/ScannerEvents.test.ts` (100% pass).
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 12.3: Клиентский EventSource подписчик и реактивное автообновление дашборда**

> [!note]+ Текст промпта 12.3
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Подключить нативный браузерный `EventSource` к `/api/events`, отображать реальный ход парсинга и обновлять все графики и таблицы без перезагрузки страницы.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `web/src/services/liveEventService.ts` создан сервис управления SSE соединением.
> - Автоматический реконнект с экспоненциальной задержкой при обрыве соединения.
> - При получении `scan:progress` прогресс-бар в шапке плавно заполняется на реальные проценты с отображением текущей витрины («Парсинг Яндекс Игр...»).
> - Полностью удален старый фейковый таймер `setInterval` из `triggerLiveScan()`.
> - При получении `scan:completed` клиент автоматически запрашивает свежий снимок, проигрывает процедурный звуковой сигнал завершения сканирования и обновляет данные в активной вкладке.
> - Пульсирующий зеленый LED диод в шапке визуализирует активность канала.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/services/liveEventService.ts`, `web/src/main.ts`, `web/src/components/HeaderStatusBar.ts`.
> - **Чего НЕ трогаем**: стили таблиц и радара.
> 
> ### 4. Проверка
> - Запусти сервер и клиент, нажми «⚡ Запустить скан» и убедись, что прогресс синхронизирован с реальными логами бэкенда, а данные обновляются на лету.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

---

## Спринт 13: Развертывание на сервере и домен `fuheshka.qd.je` (Production Deployment)

> [!abstract] Развертывание боевого инстанса с авто-SSL и фоновым обновлением
> Настройка production окружения на сервере пользователя с обратным прокси и SSE стримингом:
> - Запуск сервиса под управлением PM2.
> - Конфигурация Nginx/Caddy с поддержкой отключения буферизации для SSE (`proxy_buffering off;`).
> - Автоматический SSL Let's Encrypt для домена `fuheshka.qd.je`.

- [ ] **Промпт 13.1: Серверная конфигурация PM2 и автоматический планировщик сбора**

> [!note]+ Текст промпта 13.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Подготовить production конфигурацию запуска сервера через PM2 и cron-задачу для регулярного фонового сканирования рынка.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В корне создан файл `ecosystem.config.cjs`:
>   - Имя приложения: `game-trend-radar`.
>   - Скрипт: `node --loader tsx src/server.ts` или скомпилированный `dist/server.js`.
>   - Переменные окружения: `PORT=4200`, `NODE_ENV=production`.
>   - Авто-перезапуск при падении, лимит памяти 512MB, ротация логов.
> - В `scripts/deploy.sh` подготовлен скрипт развертывания: `git pull`, `npm install`, `npm run build`, `pm2 restart ecosystem.config.cjs`.
> - Документирована настройка cron для ночного запуска полного сканирования рынка в 03:00 UTC с уведомлением подключенных пользователей по SSE.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `ecosystem.config.cjs`, `scripts/deploy.sh`, `README.md`.
> - **Чего НЕ трогаем**: логику компонентов фронтенда.
> 
> ### 4. Проверка
> - Проверь локальный запуск через `pm2 start ecosystem.config.cjs` (или `node src/server.ts`), убедись в корректности портов и переменных окружения.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 13.2: Обратный прокси Nginx / Caddy с поддержкой SSE для домена `fuheshka.qd.je`**

> [!note]+ Текст промпта 13.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> ### 1. Цель
> Подготовить готовые конфигурационные файлы веб-сервера (Nginx и Caddy) для домена `fuheshka.qd.je` с корректной поддержкой постоянного SSE стриминга без буферизации.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В папке `deploy/` созданы конфигурационные файлы:
>   - `deploy/nginx.conf`: блок `server_name fuheshka.qd.je;`, проксирование статики и API на `http://127.0.0.1:4200`, отключение буферизации `proxy_buffering off; chunked_transfer_encoding off;` для маршрута `/api/events`, заголовки gzip и security headers.
>   - `deploy/Caddyfile`: альтернативный вариант с автоматическим HTTPS через Caddy (`fuheshka.qd.je { reverse_proxy 127.0.0.1:4200 }`).
> - В `README.md` и `README.ru.md` добавлена пошаговая инструкция по привязке DNS A-записи домена `fuheshka.qd.je` к IP сервера и выпуску SSL сертификата через Certbot.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `deploy/nginx.conf`, `deploy/Caddyfile`, `README.md`, `README.ru.md`.
> - **Чего НЕ трогаем**: исходный код приложений.
> 
> ### 4. Проверка
> - Проверь синтаксис конфигов Nginx и Caddy на отсутствие ошибок директив.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```


---

## Спринт 14: Экспорт аналитических данных (CSV и Printable PDF)

> [!abstract] Выгрузка структурированных данных для внешнего анализа и отчетов
> Расширение возможностей экспорта дашборда для продуктовых аналитиков, инди-разработчиков и инвесторов:
> - Экспорт каталога игр и матрицы арбитража в формат CSV с поддержкой UTF-8 BOM для корректного открытия в Excel и Google Таблицах.
> - Генерация чистого печатного PDF/HTML отчета со сводкой ниш, ключевыми метриками и графиками для питчей.

- [ ] **Промпт 14.1: Полноценный экспорт каталога и арбитража в CSV**

> [!note]+ Текст промпта 14.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> Память и контекст:
> Сверься с .agents/MEMORY.md и web/src/services/exporter.ts.
> 
> ### 1. Цель
> Реализовать экспорт отфильтрованных данных каталога игр и матрицы арбитража в CSV с поддержкой кодировки UTF-8 BOM.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `web/src/services/exporter.ts` реализованы функции:
>   - `exportGamesToCsv(games: NormalizedGame[]): string` (колонки: Rank, Title, Platform, Genre, Archetype, CCU/Metric, LikeRatio, URL).
>   - `exportArbitrageToCsv(opportunities: ArbitrageOpportunity[]): string` (колонки: Concept, DonorTitle, DonorCCU, BestMatchTitle, Similarity, LeadTime, Status, Recipe).
> - Строки корректно экранируются кавычками при наличии запятых, точек с запятой или переносов строк. В начало файла добавляется UTF-8 BOM (`\uFEFF`) для корректного открытия в Excel.
> - В шапку `HeaderStatusBar.ts` в выпадающее меню экспорта или рядом с кнопками экспорта добавлены пункты: «Экспорт каталога (CSV)» и «Экспорт арбитража (CSV)».
> - Добавлены unit-тесты в `tests/Exporter.test.ts` (проверка BOM, структуры колонок, экранирования специальных символов).
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/services/exporter.ts`, `web/src/components/HeaderStatusBar.ts`, `tests/Exporter.test.ts`.
> - **Чего НЕ трогаем**: серверные роуты, стили графиков.
> 
> ### 4. Проверка
> - Запусти тесты: `npm test tests/Exporter.test.ts` (все тесты должны быть GREEN).
> - Проверь скачивание CSV в браузере и открой его в текстовом редакторе.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 14.2: Экспорт чистого печатного PDF/HTML отчета со сводкой рынка**

> [!note]+ Текст промпта 14.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> Память и контекст:
> Сверься с .agents/MEMORY.md и web/src/services/exporter.ts.
> 
> ### 1. Цель
> Реализовать генерацию презентабельного печатного отчета (Printable HTML / PDF) с ключевыми KPI, распределением ниш и вердиктами рынка.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `web/src/services/exporter.ts` реализована функция `openPrintableReport(snapshot: MarketSnapshot): void`.
> - Функция формирует чистое изолированное окно/вкладку с оптимизированной для печати разметкой (`@media print`):
>   - Шапка отчета с датой среза и общим онлайном.
>   - Сводные KPI (Всего игр, Топ Opportunity Score, Арбитражные ниши).
>   - Светофор вердиктов (Green / Yellow / Red Light) с ключевыми рекомендациями.
>   - Таблица топ-10 арбитражных ниш.
>   - Кнопка «Печать / Сохранить в PDF» (`window.print()`).
> - В `HeaderStatusBar.ts` пункт «Печатный отчет (PDF)» запускает генерацию.
> - Написаны тесты формирования печатной разметки в `tests/Exporter.test.ts`.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/services/exporter.ts`, `web/src/components/HeaderStatusBar.ts`, `tests/Exporter.test.ts`.
> - **Чего НЕ трогаем**: логику сбора данных.
> 
> ### 4. Проверка
> - Запусти тесты экспорта и убедись в их успешном прохождении.
> - Нажми «Печатный отчет (PDF)» в UI и проверь предварительный просмотр печати браузера.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

---

## Спринт 15: Реальные спарклайны и аналитика дельт во времени (Time-Series)

> [!abstract] Переход от синтетических графиков к реальной истории сохраненных снимков
> Замена математической синусоиды на реальные исторические данные:
> - Бэкенд-индексация истории игр по накопленным снимкам в `data/snapshots/`.
> - Интерактивные SVG-спарклайны с визиром (crosshair) и отображением даты и онлайна при наведении.

- [ ] **Промпт 15.1: Бэкенд-сервис истории метрик и дельт онлайна**

> [!note]+ Текст промпта 15.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> Память и контекст:
> Сверься с .agents/MEMORY.md, src/storage/snapshot_store.ts и src/server.ts.
> 
> ### 1. Цель
> Создать серверный сервис агрегации исторических точек метрик игр по существующим снимкам и новый эндпоинт `/api/history`.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `src/storage/snapshot_store.ts` реализован метод `getGameHistory(limitDays = 14): Map<string, Array<{ date: string; value: number }>>`.
> - Метод считывает метаданные снимков из `data/snapshots/` и строит временной ряд для каждой уникальной игры (`id` или `platform:id`).
> - В `src/server.ts` добавлен эндпоинт `GET /api/history`:
>   - Возвращает компактный JSON с историческими точками онлайна игр.
>   - Добавлено кэширование в памяти с инвалидацией при создании нового снимка.
> - Написаны тесты в `tests/HistoryService.test.ts`.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `src/storage/snapshot_store.ts`, `src/server.ts`, `tests/HistoryService.test.ts`.
> - **Чего НЕ трогаем**: существующие эндпоинты `/api/snapshot/latest` и `/api/scan`.
> 
> ### 4. Проверка
> - Запусти тесты: `npm test tests/HistoryService.test.ts`.
> - Выполни запрос `curl http://localhost:4200/api/history` и убедись в корректности структуры данных.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 15.2: Интерактивные реальные SVG-спарклайны в каталоге и таблице**

> [!note]+ Текст промпта 15.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> Память и контекст:
> Сверься с .agents/MEMORY.md, web/src/components/GameTableView.ts и web/src/components/MoversView.ts.
> 
> ### 1. Цель
> Подключить реальные исторические данные к спарклайнам в таблице каталога и экране лидеров роста, добавив интерактивный тултип при наведении.
> 
> ### 2. Критерии приемки (Definition of Done)
> - Компонент рендеринга спарклайнов принимает реальный массив точек `{ date, value }`. Если история содержит менее 2 точек, отображается аккуратный плоский индикатор старта.
> - При наведении курсора на спарклайн отображается вертикальная линия-визир (crosshair) и всплывающий бейдж с точной датой и значением CCU.
> - Цвет линии отражает реальный тренд: изумрудный при росте, янтарный при стабильности, приглушенный красный при падении онлайна.
> - Написаны unit-тесты в `tests/Sparkline.test.ts`.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/components/GameTableView.ts`, `web/src/components/MoversView.ts`, `web/src/main.ts`, `tests/Sparkline.test.ts`.
> - **Чего НЕ трогаем**: радарные чарты на вкладке «Обзор».
> 
> ### 4. Проверка
> - Запусти тесты спарклайна и компонентов таблицы: `npm test tests/Sparkline.test.ts tests/MoversView.test.ts`.
> - Открой страницу каталога в браузере и наведи курсор на спарклайн в таблице.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

---

## Спринт 16: Инструменты продуктовой аналитики (Сравнение игр и Избранное)

> [!abstract] Рабочие инструменты для глубокого сопоставления проектов и отслеживания гипотез
> Функции для системной работы аналитика и геймдизайнера:
> - Избранное (Watchlist) с сохранением в браузере и быстрым переключением вида.
> - Режим сравнения игр (Game Comparison Matrix) бок о бок до 4 проектов.

- [ ] **Промпт 16.1: Избранное и закладки (Watchlist) с сохранением в браузере**

> [!note]+ Текст промпта 16.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> Память и контекст:
> Сверься с .agents/MEMORY.md, web/src/components/GameCatalog.ts и web/src/components/SearchPanel.ts.
> 
> ### 1. Цель
> Реализовать механизм добавления игр в избранное (Watchlist) с сохранением в `localStorage` и быстрым фильтром «Только избранное ⭐».
> 
> ### 2. Критерии приемки (Definition of Done)
> - Создан сервис `web/src/services/watchlistService.ts`:
>   - Методы: `toggleWatchlist(gameId: string)`, `isBookmarked(gameId: string): boolean`, `getWatchlist(): string[]`.
>   - Реактивное оповещение подписчиков об изменении списка избранного.
> - В карточках каталога и строках таблицы добавлена тактильная кнопка-звезда ⭐ с hover-эффектом и звуковым кликом.
> - В панели фильтров `SearchPanel.ts` добавлен фильтр «⭐ В закладках (N)».
> - Написаны тесты сервиса и фильтрации в `tests/Watchlist.test.ts`.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/services/watchlistService.ts`, `web/src/components/GameCatalog.ts`, `web/src/components/GameTableView.ts`, `web/src/components/SearchPanel.ts`, `tests/Watchlist.test.ts`.
> - **Чего НЕ трогаем**: матрицу арбитража и серверную часть.
> 
> ### 4. Проверка
> - Запусти тесты: `npm test tests/Watchlist.test.ts`.
> - Добавь игры в избранное в браузере, перезагрузи страницу и проверь сохранение состояния.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 16.2: Режим сравнения игр (Game Comparison Matrix)**

> [!note]+ Текст промпта 16.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> Память и контекст:
> Сверься с .agents/MEMORY.md, web/src/components/DetailDrawer.ts и web/src/components/GameTableView.ts.
> 
> ### 1. Цель
> Реализовать режим сравнения 2-4 выбранных игр с плавающей панелью действий и сравнительной модальной матрицей параметров.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В таблице каталога добавлен столбец чекбоксов выбора для сравнения (максимум 4 игры).
> - При выборе 2+ игр внизу экрана появляется плавающая плашка (Floating Bar) с мини-аватарками выбранных игр, кнопкой «Сравнить (N)» и «Очистить».
> - При нажатии «Сравнить» открывается сравнительная шторка/модальное окно:
>   - Колонки для каждой игры: платформа, текущий CCU, темп роста, рейтинг, архетип, теги.
>   - Подсветка лидера по каждому параметру зеленым бейджем.
> - Написаны unit-тесты логики выбора и сравнения в `tests/GameComparison.test.ts`.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/components/GameTableView.ts`, `web/src/components/GameComparisonModal.ts`, `web/src/main.ts`, `tests/GameComparison.test.ts`.
> - **Чего НЕ трогаем**: генератор промптов GDD.
> 
> ### 4. Проверка
> - Запусти тесты: `npm test tests/GameComparison.test.ts`.
> - Выбери 3 игры в каталоге, нажми «Сравнить» и убедись в корректности отображения таблицы.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

---

## Спринт 17: Локализация RU/EN, авторские стандарты и визуальная полировка

> [!abstract] Соответствие глобальным стандартам проектов и доведение UX/UI до идеала
> Интернационализация, авторские блоки и кинематографичные микро-анимации:
> - Внедрение словаря `i18n.ts` и переключателя языков RU / EN по скиллу `app-i18n-localization`.
> - Окно «О программе» с подтвержденным авторством Даниила К. (Fuheshka).
> - Каскадные stagger-анимации появления карточек и тактильный пружинящий отклик интерфейса.

- [ ] **Промпт 17.1: Двуязычная локализация RU / EN и переключатель языка**

> [!note]+ Текст промпта 17.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> Память и контекст:
> Сверься с .agents/MEMORY.md и правилом app-i18n-localization.
> 
> ### 1. Цель
> Реализовать чистую двуязычность интерфейса (русский и английский языки) с автоматическим определением языка системы и ручным переключателем.
> 
> ### 2. Критерии приемки (Definition of Done)
> - Создан модуль `web/src/i18n.ts`:
>   - Типизированный словарь переводов (навигация, вкладки, тултипы, статусы светофора, архетипы, фильтры).
>   - Автоопределение языка через `navigator.language` с приоритетом сохранения в `localStorage`.
>   - Метод `t(key: TranslationKey): string`.
> - В шапку `HeaderStatusBar.ts` добавлен компактный переключатель `RU | EN`.
> - Все текстовые блоки UI переводятся динамически без полной перезагрузки страницы.
> - Написаны тесты переводов и словаря в `tests/I18n.test.ts`.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/i18n.ts`, `web/src/components/HeaderStatusBar.ts`, `web/src/main.ts`, все UI-компоненты при замене строк на `t(...)`, `tests/I18n.test.ts`.
> - **Чего НЕ трогаем**: структуру снимков бэкенда (`MarketSnapshot`).
> 
> ### 4. Проверка
> - Запусти тесты локализации: `npm test tests/I18n.test.ts`.
> - Переключи язык в UI на EN и обратно на RU, проверив обновление шапки, табов, фильтров и карточек.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 17.2: Модальное окно «О программе» и обязательные авторские реквизиты**

> [!note]+ Текст промпта 17.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> Память и контекст:
> Сверься с .agents/MEMORY.md и правилом Mandatory Authorship & Credits.
> 
> ### 1. Цель
> Добавить в интерфейс стильное модальное окно «О программе» (About / Credits) с полной информацией о проекте, версией и ссылками на автора.
> 
> ### 2. Критерии приемки (Definition of Done)
> - Создан компонент `web/src/components/AboutModal.ts`:
>   - Название: Game Trend Radar, версия по SemVer, описание назначения.
>   - Авторский блок:
>     - RU: «Автор: Даниил К. (Fuheshka)» со ссылкой на `https://github.com/Fuheshka`.
>     - EN: «Created by Daniil K. (Fuheshka)».
>     - Ссылки на Telegram ([@fuheshka](https://t.me/fuheshka)), Email ([me@kuviko.ru](mailto:me@kuviko.ru)), поддержку проекта и репозиторий.
>   - Кнопка проверки обновлений репозитория через GitHub API по скиллу `app-update-checker`.
> - В шапку `HeaderStatusBar.ts` добавлена кнопка вызова окна «О программе» (иконка информации или логотип).
> - Написаны тесты в `tests/AboutModal.test.ts`.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/components/AboutModal.ts`, `web/src/components/HeaderStatusBar.ts`, `tests/AboutModal.test.ts`.
> - **Чего НЕ трогаем**: логику аналитических экранов.
> 
> ### 4. Проверка
> - Запусти тесты: `npm test tests/AboutModal.test.ts`.
> - Открой модальное окно в браузере и проверь кликабельность ссылок и поддержку темы.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 17.3: Микро-анимации Stagger, тактильный отклик и FLIP-сортировка**

> [!note]+ Текст промпта 17.3
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> Память и контекст:
> Сверься с .agents/MEMORY.md, скиллами better-ui, uitripled и motion-design.
> 
> ### 1. Цель
> Добавить интерфейсу тактильности и кинематографичности за счет каскадного появления элементов (stagger) и пружинящего отклика кнопок.
> 
> ### 2. Критерии приемки (Definition of Done)
> - Для карточек вердиктов и сетки каталога внедрена CSS/JS stagger-анимация:
>   - Смещение `translateY(8px) -> translateY(0)` и `opacity: 0 -> 1` с шагом задержки 30-35 мс на элемент.
>   - Кривая плавности `cubic-bezier(0.16, 1, 0.3, 1)` длительностью 240 мс.
> - Для интерактивных кнопок (`.btn-inspect`, `.btn-action`, фильтр-чипсы) добавлен пружинящий микро-отклик:
>   `:active { transform: scale(0.97); }` с мгновенным возвратом.
> - Учтено системное медиа-выражение `@media (prefers-reduced-motion: reduce)` (отключение анимаций при требовании системы).
> - Написаны тесты стилей и анимационных классов в `tests/Animations.test.ts`.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `web/src/style.css`, анимационные утилиты, `tests/Animations.test.ts`.
> - **Чего НЕ трогаем**: логику расчетов метрик.
> 
> ### 4. Проверка
> - Запусти тесты анимаций.
> - Проверь плавность переключения фильтров и кликов кнопок в браузере при 60 FPS.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

---

## Спринт 18: Новые источники данных (CrazyGames и Steam Spy)

> [!abstract] Расширение охвата веб-витрин и подключение ПК-инди сегмента
> Подключение дополнительных платформ для всестороннего анализа игровых трендов:
> - Коллектор CrazyGames для отслеживания мировых хитов браузерного гейминга.
> - Коллектор Steam Spy Top 100 за 2 недели для сопоставления мобильных и ПК-трендов.

- [ ] **Промпт 18.1: Коллектор веб-портала CrazyGames**

> [!note]+ Текст промпта 18.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> Память и контекст:
> Сверься с .agents/MEMORY.md и src/collectors/poki.ts.
> 
> ### 1. Цель
> Реализовать надежный коллектор топ-игр международного портала CrazyGames и интегрировать его в общий пайплайн нормализации данных.
> 
> ### 2. Критерии приемки (Definition of Done)
> - Создан коллектор `src/collectors/crazygames.ts`, реализующий интерфейс сбора популярных игр.
> - Корректно извлекаются название игры, жанр, теги, рейтинг и относительная позиция в чарте.
> - Добавлена изоляция сетевых сбоев (таймаут 6000 мс через `AbortController`, безопасный fallback).
> - Коллектор подключен в `src/scanner.ts` с маппингом на платформу `CRAZYGAMES`.
> - Написаны тесты парсера и обработки ошибок в `tests/CrazyGamesCollector.test.ts`.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `src/collectors/crazygames.ts`, `src/scanner.ts`, `src/types/index.ts`, `tests/CrazyGamesCollector.test.ts`.
> - **Чего НЕ трогаем**: другие коллекторы.
> 
> ### 4. Проверка
> - Запусти тесты: `npm test tests/CrazyGamesCollector.test.ts`.
> - Убедись, что запуск сканера включает игры CrazyGames в результирующий снимок.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 18.2: Коллектор инди-трендов Steam Spy (Top 100 за 2 недели)**

> [!note]+ Текст промпта 18.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> Память и контекст:
> Сверься с .agents/MEMORY.md и src/collectors/roblox.ts.
> 
> ### 1. Цель
> Подключить открытый API Steam Spy для анализа трендов ПК-игр за последние 2 недели и обогащения арбитражной матрицы.
> 
> ### 2. Критерии приемки (Definition of Done)
> - Создан коллектор `src/collectors/steam_spy.ts`, опрашивающий эндпоинт `https://steamspy.com/api.php?request=top100in2weeks`.
> - Извлекаются: `appid`, `name`, `ccu` (пиковый онлайн), `positive`/`negative` отзывы, рассчитывается `likeRatio`.
> - Фильтрация инди-сегмента и сопоставление с архетипами классификатора.
> - Написаны unit-тесты парсинга и устойчивости к сбоям сети в `tests/SteamSpyCollector.test.ts`.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `src/collectors/steam_spy.ts`, `src/scanner.ts`, `tests/SteamSpyCollector.test.ts`.
> - **Чего НЕ трогаем**: UI компоненты.
> 
> ### 4. Проверка
> - Запусти тесты: `npm test tests/SteamSpyCollector.test.ts`.
> - Проверь интеграцию с общим снимком рынка.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

---

## Спринт 19: Углубление аналитики сторов и оптимизация хранилища

> [!abstract] Переход на SQLite и повышение достоверности метрик сторов
> Оптимизация инфраструктуры и алгоритмов аналитики:
> - Углубленный трекинг Яндекс Игр (ранг в категории и количество отзывов вместо фиксированного рейтинга).
> - Индексация снимков через нативный `node:sqlite` и ускорение автотестов.

- [ ] **Промпт 19.1: Углубленные метрики популярности Яндекс Игр**

> [!note]+ Текст промпта 19.1
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> Память и контекст:
> Сверься с .agents/MEMORY.md и src/collectors/yandex_games.ts.
> 
> ### 1. Цель
> Заменить константный рейтинг 70-75% в парсере Яндекс Игр на объективные метрики позиции в категории и количества отзывов игроков.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `src/collectors/yandex_games.ts` реализован сбор точного ранга игры в категории (позиция в выдаче).
> - Парсинг количества оценок/отзывов из микроразметки `reviewCount` / `ratingCount`.
> - Расчет динамического скора вовлеченности на базе ранга и отзывов.
> - Написаны тесты в `tests/YandexGamesCollector.test.ts`.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `src/collectors/yandex_games.ts`, `tests/YandexGamesCollector.test.ts`.
> - **Чего НЕ трогаем**: арбитражный словарь.
> 
> ### 4. Проверка
> - Запусти тесты: `npm test tests/YandexGamesCollector.test.ts`.
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```

- [ ] **Промпт 19.2: Индексация снимков через `node:sqlite` и изоляция тестов моками**

> [!note]+ Текст промпта 19.2
> ```text
> [/goal](slashCommand;goal) [/using-superpowers](slashCommand;using-superpowers) [/vibe-coding](slashCommand;vibe-coding) [/ponytail](slashCommand;ponytail)
> 
> Память и контекст:
> Сверься с .agents/MEMORY.md, src/storage/snapshot_store.ts и tests/Server.test.ts.
> 
> ### 1. Цель
> Внедрить легкий индекс метаданных снимков через нативный модуль `node:sqlite` и изолировать тяжелые сетевые тесты сервера моками.
> 
> ### 2. Критерии приемки (Definition of Done)
> - В `src/storage/` создан индекс `snapshots.db` на нативном `node:sqlite` (Node.js 22+).
> - Метод `listSnapshots()` и поиск исторических данных берут метаданные из SQLite за 1-2 мс вместо сканирования директории с десятками JSON-файлов.
> - В `tests/Server.test.ts` реальный сетевой скан изолирован моком, время прогона всего тестового набора сокращено с 25 сек до < 2 сек.
> - Написаны тесты в `tests/SqliteStorage.test.ts`.
> 
> ### 3. Границы (Scope Boundaries)
> - **Что трогаем**: `src/storage/`, `tests/Server.test.ts`, `tests/SqliteStorage.test.ts`.
> - **Чего НЕ трогаем**: фронтенд код.
> 
> ### 4. Проверка
> - Запусти полный тестовый набор: `npm test` (все тесты проходят, время выполнения существенно сократилось).
> - Зафиксируй изменения в `implementation-notes.md`.
> - Категорический запрет автокоммитов без прямого подтверждения.
> ```
