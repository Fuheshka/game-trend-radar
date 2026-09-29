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

- [ ] **Промпт 6.3: Reddit JSON API & Social Buzz Harvester**

> [!note]+ Текст промпта 6.3
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

- [ ] **Промпт 7.3: Бегущая строка горячих трендов (Live Ticker Bar)**

> [!note]+ Текст промпта 7.3
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
