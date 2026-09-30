import {
  GameArchetype,
  MarketVerdict,
  ArbitrageOpportunity,
  NormalizedGame,
} from '../types.js';

export type TargetEngine = 'unity_webgl' | 'godot_4' | 'vite_canvas' | 'roblox_studio';
export type TargetStore = 'yandex_games' | 'poki' | 'roblox' | 'crazygames' | 'general_web';
export type AiAssistant = 'cursor' | 'claude' | 'chatgpt';

export interface PromptContext {
  targetEngine: TargetEngine;
  archetype: GameArchetype;
  targetStore?: TargetStore;
  aiAssistant?: AiAssistant;
  verdict?: MarketVerdict;
  arbitrage?: ArbitrageOpportunity;
  games?: NormalizedGame[];
  customTitle?: string;
}

interface EngineMeta {
  title: string;
  badge: string;
  folderTree: string;
  contracts: string;
  optimization: string;
}

interface ArchetypeBlueprint {
  titleRu: string;
  coreLoop: string;
  stateMachineMermaid: string;
  mechanicDetails: string;
  rewardedPlacements: string;
  interstitialTrigger: string;
  phase1: string;
  phase2: string;
  phase3: string;
  phase4: string;
}

function getEngineMeta(engine: TargetEngine): EngineMeta {
  switch (engine) {
    case 'unity_webgl':
      return {
        title: 'Unity WebGL (C# / URP / WebGL 2.0)',
        badge: 'Unity 2022.3+ LTS / URP',
        folderTree: `Assets/
├── _Project/
│   ├── Scripts/
│   │   ├── Core/
│   │   │   ├── GameManager.cs
│   │   │   ├── GameStateMachine.cs
│   │   │   └── Bootstrapper.cs
│   │   ├── Gameplay/
│   │   │   ├── PlayerController.cs
│   │   │   ├── GameMechanicManager.cs
│   │   │   └── UpgradeSystem.cs
│   │   ├── Economy/
│   │   │   ├── CurrencyManager.cs
│   │   │   └── ShopConfig.cs
│   │   ├── UI/
│   │   │   ├── HUDView.cs
│   │   │   ├── ShopModalView.cs
│   │   │   └── GameOverView.cs
│   │   └── SDK/
│   │       ├── YandexGamesBridge.cs
│   │       └── Plugins/WebGL/YandexSDK.jslib
│   ├── Prefabs/
│   ├── ScriptableObjects/
│   └── Scenes/
│       ├── Boot.unity
│       └── MainGameplay.unity`,
        contracts: `// Contracts & Interfaces
public interface IEconomyService {
    double GetCurrency(string id);
    bool Spend(string id, double amount);
    void Add(string id, double amount, string source);
}

public interface IPlatformSDK {
    void ShowRewardedAd(System.Action onSuccess, System.Action onError);
    void ShowInterstitial(System.Action onClosed);
    void SavePlayerData(string jsonData);
    void LoadPlayerData(System.Action<string> onLoaded);
}`,
        optimization: `- **Изоляция проекта**: вести разработку строго в папке Assets/_Project для чистой структуры.
- **Лимит памяти WebGL**: установить WebGL Memory Size строго в 256–384 МБ в ProjectSettings.
- **Zero-GC в цикле**: запретить аллокации в \`Update()\` (LINQ, \`new\`, строковые конкатенации). Использовать Object Pooling для всех спавнящихся объектов.
- **Мост .jslib**: интеграция с витриной через \`[DllImport("__Internal")]\` и \`Application.focusChanged\` для глушения \`AudioListener.pause = !hasFocus\` (жесткое требование модерации Яндекс Игр).
- **Сжатие билда**: Brotli с Decompression Fallback.`,
      };

    case 'godot_4':
      return {
        title: 'Godot 4 (GDScript 2.0 / Web Compatibility)',
        badge: 'Godot 4.3+ Compatibility',
        folderTree: `res://
├── scenes/
│   ├── boot.tscn
│   ├── main_game.tscn
│   ├── ui/
│   │   ├── hud.tscn
│   │   └── shop_modal.tscn
├── scripts/
│   ├── autoload/
│   │   ├── game_manager.gd
│   │   ├── state_machine.gd
│   │   ├── sound_manager.gd
│   │   └── platform_sdk.gd
│   ├── core/
│   │   ├── player_controller.gd
│   │   ├── upgrade_system.gd
│   │   └── currency_manager.gd
│   └── ui/
│       └── hud_controller.gd
├── resources/
│   ├── balance_config.tres
│   └── game_state.tres
└── assets/
    ├── sprites/
    └── audio/`,
        contracts: `## GDScript 2.0 Typed Contracts
class_name IGameService
extends RefCounted

signal currency_changed(type: String, new_amount: float)
signal state_transitioned(old_state: int, new_state: int)

func spend_currency(amount: float) -> bool:
    return false

func add_currency(amount: float, source: String = "gameplay") -> void:
    pass`,
        optimization: `- **Web Export**: использовать рендерер Compatibility (OpenGL ES 3.0 / WebGL 2.0) для мгновенного запуска на мобильных браузерах.
- **Single-Threaded**: отключить Threads в настройках экспорта, если сервер не отдает COOP/COEP заголовки.
- **JavaScriptBridge**: вызовы витрины через \`JavaScriptBridge.get_interface("window")\` и \`JavaScriptBridge.eval()\`.
- **Глушение звука**: глушить главный аудио-бус \`AudioServer.set_bus_mute(0, true)\` при потере фокуса окна (уведомления \`NOTIFICATION_APPLICATION_FOCUS_OUT\`).`,
      };

    case 'vite_canvas':
      return {
        title: 'Vite + Canvas 2D / PixiJS (Zero-Engine Web)',
        badge: 'TypeScript / Canvas 2D / <2MB',
        folderTree: `src/
├── core/
│   ├── GameLoop.ts          # 60fps requestAnimationFrame loop
│   ├── StateMachine.ts      # Game state transitions
│   └── EventBus.ts          # Decoupled pub/sub event bus
├── entities/
│   ├── Player.ts            # Player entity and movement
│   ├── GameEntity.ts        # Base poolable object
│   └── ObjectPool.ts        # Zero-allocation entity pool
├── systems/
│   ├── RenderSystem.ts      # Canvas 2D / Pixi rendering
│   ├── PhysicsSystem.ts     # Lightweight collision & movement
│   └── EconomySystem.ts     # Sinks, faucets & balance
├── sdk/
│   ├── PlatformSdkBridge.ts # Yandex SDK / Poki SDK wrapper
│   └── SoundService.ts      # Web Audio API + suspend on blur
├── ui/
│   ├── HudOverlay.ts        # DOM / Canvas HUD
│   └── ShopModal.ts         # Upgrade modal dialog
├── config/
│   ├── GameConfig.ts        # Balance constants
│   └── types.ts             # Strict TypeScript definitions
└── main.ts                  # Entrypoint & bootstrap`,
        contracts: `export interface IGameState {
  score: number;
  softCurrency: number;
  multiplier: number;
  prestigeLevel: number;
  unlockedUpgrades: Record<string, number>;
}

export interface IPlatformSdk {
  init(): Promise<boolean>;
  showRewarded(): Promise<boolean>;
  showInterstitial(): Promise<boolean>;
  saveData(data: IGameState): Promise<void>;
  loadData(): Promise<IGameState | null>;
}`,
        optimization: `- **Zero-Bundle Footprint**: общий вес продакшн бандла < 1.5–2 МБ (мгновенная загрузка < 1 секунды даже на 3G).
- **Pointer Events**: единый стек ввода через \`pointerdown\`, \`pointermove\`, \`pointerup\` с \`touch-action: none\` для предотвращения скролла мобильного браузера.
- **Web Audio Context**: вызов \`audioCtx.suspend()\` по событию visibilitychange (\`document.visibilityState === 'hidden'\`) и возобновление при возврате.
- **DPI Scaling**: корректная поддержка Retina дисплеев через \`window.devicePixelRatio\` без замыливания спрайтов.`,
      };

    case 'roblox_studio':
      return {
        title: 'Roblox Studio (Luau / Client-Server)',
        badge: 'Luau Strict / DataStoreService',
        folderTree: `ReplicatedStorage/
├── Shared/
│   ├── Configs/
│   │   ├── GameBalance.luau
│   │   └── ShopItems.luau
│   ├── RemoteDefinitions.luau
│   └── Utility/
│       └── Signal.luau
ServerScriptService/
├── ServerCore/
│   ├── GameController.server.luau
│   ├── DataStoreManager.server.luau
│   └── EconomyManager.server.luau
StarterPlayer/StarterPlayerScripts/
├── ClientCore/
│   ├── ClientController.client.luau
│   ├── UIController.client.luau
│   ├── InputHandler.client.luau
│   └── SoundEffects.client.luau
StarterGui/
├── ScreenGui/
│   ├── HUDFrame/
│   └── UpgradeShop/`,
        contracts: `--!strict
export type PlayerProfile = {
    Currency: number,
    Multiplier: number,
    PrestigeCount: number,
    Inventory: { [string]: number },
    LastSaveTimestamp: number,
}

export type RemoteActions = {
    RequestUpgrade: RemoteFunction,
    ClaimReward: RemoteEvent,
    PrestigeReset: RemoteEvent,
}`,
        optimization: `- **DataStore Resilience**: обращение к \`DataStoreService\` строго в блоках \`pcall\` с экспоненциальным backoff при лимитах.
- **Серверная безопасность**: сервер никогда не доверяет клиенту количество валюты; валидация всех покупок и действий исключительно на сервере.
- **game:BindToClose()**: обязательное сохранение профилей всех игроков при перезапуске сервера или миграции.
- **Стриминг**: включить \`StreamingEnabled\` для быстрой загрузки локации на мобильных устройствах.`,
      };
  }
}

function getArchetypeBlueprint(archetype: GameArchetype): ArchetypeBlueprint {
  switch (archetype) {
    case 'SIMULATION_INCREMENTAL':
      return {
        titleRu: 'Симуляторы и +1 в секунду',
        coreLoop: 'Тап / Активное действие -> Мгновенный прирост очков -> Покупка множителя -> Автодобыча -> Престиж (Rebirth)',
        stateMachineMermaid: `graph LR
    classDef state fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    BOOT["Инициализация"]:::state --> IDLE["Ожидание / Тап"]:::state
    IDLE --> REWARD["Начисление валюты"]:::state
    REWARD --> SHOP["Магазин апгрейдов"]:::state
    SHOP --> REBIRTH["Престиж x2-x5"]:::state
    REBIRTH --> IDLE
    SHOP --> AD_BOOST["Rewarded x2"]:::state
    AD_BOOST --> IDLE`,
        mechanicDetails: `- Базовый клик (+1 к прогрессу).
- Пассивная автодобыча (+X/сек с шагом таймера 100мс).
- Формула стоимости улучшений: $Cost = Base \\times 1.15^{level}$.
- Престиж: сброс базовой валюты в обмен на несгораемые кристаллы с постоянным множителем +50% ко всему доходу.`,
        rewardedPlacements: `- Временный буст: x2 прирост валюты на 3–5 минут.
- Мгновенный сундук с 10 минутами автодохода.
- Бесплатный питомец/помощник с редким множителем.`,
        interstitialTrigger: 'Показ при совершении Престижа (Rebirth) или открытии новой игровой зоны (кулдаун 90-120 сек)',
        phase1: 'Кликабельный объект с тактильной анимацией отдачи (squash), счетчик очков и базовый апгрейд +1 за клик.',
        phase2: 'Система пассивного дохода в секунду, магазин улучшений и сохранение прогресса.',
        phase3: 'Интеграция монетизации: Rewarded x2 бустер и кулдаун межстраничной рекламы при престиже.',
        phase4: 'Сочность (Juice): всплывающие цифры урона/очков, экранотряс при критах, SFX и частицы салюта при престиже.',
      };

    case 'PHYSICS_SANDBOX':
      return {
        titleRu: 'Сендбокс и физика',
        coreLoop: 'Спавн рэгдолла/объекта -> Эксперимент с оружием/силами -> Разрушение и отклик -> Сбор монет -> Новые инструменты',
        stateMachineMermaid: `graph LR
    classDef state fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    SPAWN["Спавн предметов"]:::state --> INTERACT["Физическое взаимодействие"]:::state
    INTERACT --> IMPACT["Разрушение / Импакт"]:::state
    IMPACT --> REWARD["Награда за урон"]:::state
    REWARD --> UNLOCK["Разблокировка оружия"]:::state
    UNLOCK --> SPAWN`,
        mechanicDetails: `- 2D/3D физические тела с динамическими связями (joints, hinge, rope).
- Система рэгдолла с отдельными конечностями и хитбоксами.
- Регистрация силы удара и накопление урона.
- Меню быстрого спавна инструментов (бомбы, лазеры, гравипушка).`,
        rewardedPlacements: `- Разблокировка секретного супер-оружия (ядерный взрыв, черная дыра) на 1 раунд.
- Удвоение монет за разрушения.
- Режим Бога / Неуязвимость на 60 секунд.`,
        interstitialTrigger: 'Очистка сцены (Clear All) или смена карты (кулдаун 120 сек)',
        phase1: 'Физическая комната, манекен (рэгдолл) и базовое перетаскивание объектов курсором/пальцем.',
        phase2: 'Арсенал из 3 видов оружия (колющее, взрывное, кинетическое) с расчетом урона.',
        phase3: 'Магазин разблокировок за заработанные монеты и Rewarded супер-оружие.',
        phase4: 'Партиклы искр, пятна краски/крови, звуки ударов и адаптивное управление под тачскрины.',
      };

    case 'MERGE_IDLE':
      return {
        titleRu: 'Мёрдж и сортировка',
        coreLoop: 'Покупка элемента -> Слияние одинаковых уровней (1+1=2) -> Повышение ценности -> Пассивная прибыль -> Открытие слотов',
        stateMachineMermaid: `graph LR
    classDef state fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    BUY["Покупка спавна"]:::state --> MERGE["Drag & Drop слияние"]:::state
    MERGE --> LEVEL_UP["Новый уровень предмета"]:::state
    LEVEL_UP --> GENERATE["Генерация монет"]:::state
    GENERATE --> BUY`,
        mechanicDetails: `- Сетка ячеек (4x4 или 5x5).
- Drag-and-Drop механика с магнитом к ближайшей свободной ячейке.
- Синхронное слияние одинаковых рангов с анимацией вспышки.
- Автогенератор монет предметами высших рангов.`,
        rewardedPlacements: `- Авто-мёрдж всех одинаковых предметов на доске на 60 секунд.
- Подарочная коробка с предметом высокого уровня.
- Удвоение накопленного оффлайн-дохода при возвращении.`,
        interstitialTrigger: 'Открытие нового уровня предмета или заполнение всех слотов сетки',
        phase1: 'Игровая сетка с ячейками и drag-and-drop перемещением и слиянием двух одинаковых кубиков.',
        phase2: 'Генератор предметов по таймеру, расчет дохода от предметов на доске и магазин покупки уровней.',
        phase3: 'Оффлайн доход при запуске с предложением удвоить за Rewarded видео.',
        phase4: 'Сочные анимации слияния (squash/stretch), звуки колокольчиков при повышении уровня и тактильный виброотклик.',
      };

    case 'SURVIVAL_HORROR':
      return {
        titleRu: 'Хорроры и побег',
        coreLoop: 'Исследование темной локации -> Сбор ключей/инструментов -> Прятки от монстра -> Открытие двери -> Спасение',
        stateMachineMermaid: `graph LR
    classDef state fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    EXPLORE["Исследование"]:::state --> DETECT["Замечен монстром"]:::state
    DETECT --> CHASE["Погоня / Прятки"]:::state
    CHASE --> ESCAPE["Отрыв от преследования"]:::state
    ESCAPE --> SOLVE["Решение пазла"]:::state
    SOLVE --> WIN["Побег"]:::state`,
        mechanicDetails: `- Фонарик с ограниченным зарядом батареи.
- ИИ монстра на стейт-машине: Patrol (патруль) -> Suspicious (подозрение на звук) -> Chase (погоня).
- Шкала стамины персонажа при беге.
- Инвентарь на 3 ключевых предмета (ключ, лом, батарейка).`,
        rewardedPlacements: `- Второе дыхание (Revive) на месте гибели с отпугиванием монстра на 15 секунд.
- Подсветка местоположения нужного ключа (детектор).
- Полная батарея фонарика + супер-яркий луч.`,
        interstitialTrigger: 'Экран поражения (GameOver) или переход в следующую комнату',
        phase1: 'Управление от 1-го/3-го лица с динамическим светом фонарика и темным коридором.',
        phase2: 'Монстр с поиском пути (NavMesh/Grid) и радиусом видимости/слуха.',
        phase3: 'Инвентарь, запертая дверь с замком и логика Game Over.',
        phase4: 'Атмосферный эмбиент, скримеры при поимке, экранотряс и кнопка возрождения за рекламу.',
      };

    case 'WORD_PUZZLE':
      return {
        titleRu: 'Словесные игры и пазлы',
        coreLoop: 'Просмотр сетки букв -> Соединение слова пальцем -> Проверка по словарю -> Начисление звезд -> Новый уровень',
        stateMachineMermaid: `graph LR
    classDef state fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    VIEW["Сетка букв"]:::state --> DRAG["Соединение линии"]:::state
    DRAG --> CHECK["Проверка слова"]:::state
    CHECK --> SUCCESS["Слово угадано"]:::state
    SUCCESS --> NEXT_LVL["Следующий уровень"]:::state`,
        mechanicDetails: `- Матрица букв с drag-выделением пути (линия соединения).
- Локальный словарь валидных слов (Set/Trie для мгновенного поиска O(1)).
- Система очков и бонусов за редкие слова.
- Механика подсказок (открытие 1 случайной буквы).`,
        rewardedPlacements: `- Бесплатная подсказка (открытие первой буквы в неотгаданном слове).
- Перемешивание букв без сброса очков.
- Дополнительное время или удвоение монет за уровень.`,
        interstitialTrigger: 'Завершение каждого 3-го уровня',
        phase1: 'Отображение буквенного круга/сетки с отрисовкой соединительной линии при таче.',
        phase2: 'Проверка слова по словарю, заполнение кроссвордной сетки на экране.',
        phase3: 'Магазин подсказок за монеты и кнопка бесплатной подсказки за Rewarded рекламу.',
        phase4: 'Звуки перелистывания, конфетти при победе и адаптивная раскладка под узкие экраны смартфонов.',
      };

    case 'ACTION_SHOOTER':
      return {
        titleRu: 'Шутеры и экшен',
        coreLoop: 'Выбор оружия -> Вход на арену -> Отстрел волн врагов -> Сбор лута -> Улучшение характеристик оружия',
        stateMachineMermaid: `graph LR
    classDef state fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    ARENA["Арена"]:::state --> COMBAT["Стрельба по врагам"]:::state
    COMBAT --> LOOT["Сбор выпавших трофеев"]:::state
    LOOT --> WAVE_CLEAR["Волна пройдена"]:::state
    WAVE_CLEAR --> UPGRADE["Апгрейд урона/скорости"]:::state
    UPGRADE --> ARENA`,
        mechanicDetails: `- Авто-прицеливание или виртуальный джойстик стрельбы на 360 градусов.
- Пул снарядов (Object Pool) для исключения просадок FPS при плотном огне.
- Разнообразные типы врагов (быстрые рукопашники, медленные танки, дальний бой).
- Баланс волн с постепенным ростом HP и скорости врагов.`,
        rewardedPlacements: `- Мгновенное воскрешение с временным щитом неуязвимости на 5 сек.
- Разблокировка ультимативной пушки (миниган/базука) на текущую волну.
- Утроение собранных монет за раунд.`,
        interstitialTrigger: 'Завершение волны каждые 2–3 минуты',
        phase1: 'Перемещение персонажа, спавн снарядов и попадание по статичным мишеням с уроном.',
        phase2: 'Система спавна волн врагов с преследованием игрока и получением урона.',
        phase3: 'Интерфейс HP, перезарядка, магазин прокачки скорострельности и урона.',
        phase4: 'Вспышки выстрелов (muzzle flash), экранотряс при ранениях, гильзы и звуки стрельбы.',
      };

    case 'OBBY_PARKOUR':
      return {
        titleRu: 'Обби и паркур',
        coreLoop: 'Прыжки по платформам -> Преодоление движущихся препятствий -> Активация чекпоинта -> Финишная черта',
        stateMachineMermaid: `graph LR
    classDef state fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    START["Старт этапа"]:::state --> JUMP["Прыжки по блокам"]:::state
    JUMP --> HAZARD["Ловушки / Лава"]:::state
    HAZARD --> CHECKPOINT["Чекпоинт"]:::state
    CHECKPOINT --> FINISH["Финиш и победа"]:::state`,
        mechanicDetails: `- Кинематический контроллер прыжка с буфером ввода (Jump Buffering) и Coyote Time (0.1с после края).
- Смертоносные зоны (Lava/Killzone) с мгновенным респавном на последнем чекпоинте.
- Движущиеся и исчезающие платформы по синусоидальной траектории.
- Таймер прохождения этапа и таблица лидеров.`,
        rewardedPlacements: `- Пропуск сложного уровня (Skip Stage).
- Временная гравитация x0.5 (высокие прыжки) на 1 попытку.
- Чекпоинт в любой точке трассы.`,
        interstitialTrigger: 'Смерть игрока более 3 раз на одном этапе или успешное прохождение каждые 5 уровней',
        phase1: 'Контроллер платформера с прыжком, физикой падения и 3 статичными платформами.',
        phase2: 'Чекпоинты, зоны лавы со смертью и респавном на точке сохранения.',
        phase3: 'Механика движущихся платформ и кнопка «Пропустить этап» за Rewarded видео.',
        phase4: 'Следы за персонажем (trails), звуки шагов и прыжка, анимация флага чекпоинта.',
      };

    case 'OTHER_CASUAL':
    default:
      return {
        titleRu: 'Казуальные аркады',
        coreLoop: 'Простое действие одной кнопкой -> Набор комбо -> Побитие рекорда -> Монетизация удвоения',
        stateMachineMermaid: `graph LR
    classDef state fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    PLAY["Быстрый старт"]:::state --> COMBO["Набор очков / Комбо"]:::state
    COMBO --> FAIL["Ошибочное действие"]:::state
    FAIL --> RESULT["Экран рекорда"]:::state
    RESULT --> PLAY`,
        mechanicDetails: `- One-Touch управление (тап в нужный момент времени).
- Механика комбо-множителя за безошибочные действия подряд.
- Простая таблица лидеров с лучшим счетом в LocalStorage.
- Быстрый перезапуск раунда за 1 секунду.`,
        rewardedPlacements: `- Второе дыхание (продолжить игру с сохранением комбо).
- Стартовый множитель x2 на следующую попытку.
- Разблокировка новых стилей/скинов персонажа.`,
        interstitialTrigger: 'Каждый 3-й проигрыш (с проверкой тайминга 90 сек)',
        phase1: 'Основная механика тайминга тапа с мгновенной оценкой (Perfect / Good / Miss).',
        phase2: 'Система комбо-счета, ускорение темпа игры и экран Game Over.',
        phase3: 'Сохранение лучшего рекорда и кнопка продолжить за рекламу.',
        phase4: 'Сочная динамика цвета фона от набранного комбо, вспышки и звуковые аккорды.',
      };
  }
}

function getStoreMeta(store: TargetStore): { name: string; interstitialSec: number; rules: string } {
  switch (store) {
    case 'yandex_games':
      return {
        name: 'Яндекс Игры (Yandex Games SDK v2)',
        interstitialSec: 90,
        rules: `- **Глушение звука**: ОБЯЗАТЕЛЬНО вызывать \`AudioListener.pause = true\` (Unity), \`AudioServer.set_bus_mute(0, true)\` (Godot) или \`audioCtx.suspend()\` (Web Audio) при показе рекламы и сворачивании вкладки браузера (\`document.visibilityState === 'hidden'\`). Это жесткое требование модерации Яндекса!
- **Safe Area**: учитывать верхнюю сервисную полосу Яндекса и нижнюю системную панель браузера на смартфонах.
- **Сохранение в облако**: использовать \`ysdk.getPlayer().setData()\` для бесшовной синхронизации между мобильным телефоном и десктопом.`,
      };

    case 'poki':
      return {
        name: 'Poki Web Portal (PokiSDK)',
        interstitialSec: 120,
        rules: `- **Жизненный цикл**: строгие вызовы \`PokiSDK.gameLoadingStart()\`, \`PokiSDK.gameLoadingFinished()\`, \`PokiSDK.gameplayStart()\` и \`PokiSDK.gameplayStop()\`.
- **Commercial Break**: показ рекламы строго в моменты пауз между раундами.`,
      };

    case 'roblox':
      return {
        name: 'Roblox Discovery',
        interstitialSec: 0,
        rules: `- **Монетизация через Robux**: Developer Products (расходники: бусты, валюта) и GamePasses (постоянные привилегии: VIP, x2 скорость).
- **Соблюдение правил Roblox ToS**: запрет внешних ссылок и сторонней рекламы; только нативные механики Roblox.`,
      };

    case 'crazygames':
    case 'general_web':
    default:
      return {
        name: 'Веб-порталы / General WebGL',
        interstitialSec: 100,
        rules: `- **Кроссбраузерность**: поддержка Safari iOS, Chrome Android и десктопных браузеров.
- **Авто-пауза**: остановка игрового таймера при потере фокуса окна (\`window.onblur\`).`,
      };
  }
}

function formatAiInstructions(assistant: AiAssistant): string {
  switch (assistant) {
    case 'cursor':
      return `### Инструкция для Cursor AI (.cursorrules формат)
- Работай в режиме строгого соблюдения типов (TypeScript / C# strict mode).
- Генерируй код модульно, разделяя логику, отображение и SDK мосты.
- Не используй устаревшие API или неподдерживаемые в WebGL библиотеки.
- После написания каждого модуля сразу предлагай юнит-тест или проверочный скрипт.`;

    case 'claude':
      return `### Инструкция для Claude 3.7 / Anthropic
- Начни с подробного анализа архитектуры и контрактов данных перед генерацией файлов.
- Обеспечь нулевые утечки памяти: отписывайся от событий при уничтожении объектов.
- Избегай заглушек (stubs) и плейсхолдеров вроде \`// implement logic here\`; пиши полноценную рабочую логику.
- Держи все компоненты слабосвязанными через событийную шину.`;

    case 'chatgpt':
    default:
      return `### Инструкция для ChatGPT / OpenAI Codex
- Предоставляй готовый к запуску код по шагам: сначала конфигурация, затем контроллеры, затем UI.
- Соблюдай принцип YAGNI: минимальный работающий код без избыточных абстракций.
- Предусматривай обработку ошибок во всех асинхронных вызовах (SDK, сеть, сохранения).`;
  }
}

export function compileGddPrompt(context: PromptContext): string {
  const engineMeta = getEngineMeta(context.targetEngine);
  const archetypeBlueprint = getArchetypeBlueprint(context.archetype);
  const store = context.targetStore || (context.targetEngine === 'roblox_studio' ? 'roblox' : 'yandex_games');
  const storeMeta = getStoreMeta(store);
  const assistant = context.aiAssistant || 'cursor';

  const title =
    context.customTitle ||
    context.arbitrage?.suggestedRuTitle ||
    context.verdict?.titleRu ||
    archetypeBlueprint.titleRu;

  const arbitrageBlock = context.arbitrage
    ? `
### Контекст арбитражной ниши (Roblox -> Web)
- **Оригинальная игра-донор (Roblox):** «${context.arbitrage.robloxGame.title}»
- **Текущий онлайн донора (CCU):** ${context.arbitrage.robloxCCU.toLocaleString()} игроков
- **Степень новизны для веб-витрин:** ${context.arbitrage.organicPotential} (Окно возможностей первого игрока)
- **Стратегия адаптации:** ${context.arbitrage.adaptationStrategy}
- **Рекомендованное название:** «${context.arbitrage.suggestedRuTitle}»
`
    : '';

  const verdictBlock = context.verdict
    ? `
### Аналитические метрики рынка
- **Статус вердикта:** ${context.verdict.status}
- **Opportunity Score:** ${context.verdict.opportunityScore.overallScore}/100 (Спрос: ${context.verdict.opportunityScore.demandScore}/10, Динамика: ${context.verdict.opportunityScore.velocityScore}/10, Монетизация: ${context.verdict.opportunityScore.monetizationScore}/10)
- **Суммарный онлайн в нише:** ${context.verdict.totalAudienceCCU.toLocaleString()} CCU (Доля рынка: ${context.verdict.marketSharePercent.toFixed(1)}%)
- **Вирусный множитель Shorts:** x${(context.verdict.opportunityScore.viralMultiplier || 1.0).toFixed(1)}
- **Игры-образцы в чартах:** ${context.verdict.sampleTitles.join(', ')}
`
    : '';

  return `# Техническое задание (GDD) для разработки игры: «${title}»

**Сгенерировано:** Game Trend Radar • AI GDD Compiler
**Целевой движок/стек:** ${engineMeta.title}
**Целевая витрина:** ${storeMeta.name}
**Архетип ниши:** ${context.archetype} (${archetypeBlueprint.titleRu})
**Формат ИИ-ассистента:** ${assistant.toUpperCase()}

${verdictBlock}${arbitrageBlock}

## 1. Роль и системная инструкция
Ты — ведущий Game Developer и Software Architect с 10-летним стажем в разработке коммерческих игр на **${engineMeta.title}** для витрины **${storeMeta.name}**.

Твоя цель — реализовать чистый, высокопроизводительный, коммерчески успешный MVP проект на основе этого ТЗ. Соблюдай принцип YAGNI (не плоди лишний код), разделяй ответственность классов и пиши отказоустойчивый код.

${formatAiInstructions(assistant)}

## 2. Архитектурный каркас и структура файлов
Организуй проект строго по следующей иерархии модулей:

\`\`\`text
${engineMeta.folderTree}
\`\`\`

## 3. Схема Core Loop и стейт-машина состояний
**Основная геймплейная петля:**
${archetypeBlueprint.coreLoop}

**Стейт-машина игры (State Machine Flow):**
\`\`\`mermaid
${archetypeBlueprint.stateMachineMermaid}
\`\`\`

## 4. Спецификация компонентов и контракты данных
### Механики архетипа:
${archetypeBlueprint.mechanicDetails}

### Базовые контракты интерфейсов и сервисов:
\`\`\`typescript
${engineMeta.contracts}
\`\`\`

## 5. Модель монетизации и баланс таймингов
### Rewarded Video (Добровольная реклама с наградой):
${archetypeBlueprint.rewardedPlacements}

### Interstitial (Межстраничная полноэкранная реклама):
- **Частота показа:** не чаще одного раза в ${storeMeta.interstitialSec} секунд.
- **Точки интеграции:** ${archetypeBlueprint.interstitialTrigger}.
- **Защита первой сессии (FTUE):** строго запрещен показ рекламы в первые 60 секунд после первого входа игрока.

## 6. Подводные камни и обязательная оптимизация витрины
### Требования витрины ${storeMeta.name}:
${storeMeta.rules}

### Оптимизация движка ${engineMeta.title}:
${engineMeta.optimization}

## 7. Пошаговый план реализации для ИИ-ассистента
Выполняй разработку строго поэтапно, завершая и тестируя каждый шаг перед переходом к следующему:

1. **Фаза 1 (Ядро механики - Core Loop):** ${archetypeBlueprint.phase1}
2. **Фаза 2 (Мета-геймплей и баланс):** ${archetypeBlueprint.phase2}
3. **Фаза 3 (Интеграция SDK и рекламы):** ${archetypeBlueprint.phase3}
4. **Фаза 4 (Game Feel, звук и полировка):** ${archetypeBlueprint.phase4}

---
*Приступай к реализации Фазы 1. Покажи структуру первого базового скрипта ядра.*`;
}

export interface PromptGeneratorModalOptions {
  onClose?: () => void;
  showToast?: (message: string) => void;
}

export class PromptGeneratorModalComponent {
  private modalEl: HTMLElement;
  private backdropEl: HTMLElement;
  private currentContext: PromptContext;
  private options: PromptGeneratorModalOptions;
  private boundOnKeyDown: (e: KeyboardEvent) => void;

  constructor(options: PromptGeneratorModalOptions = {}) {
    this.options = options;
    this.currentContext = {
      targetEngine: 'vite_canvas',
      archetype: 'SIMULATION_INCREMENTAL',
      targetStore: 'yandex_games',
      aiAssistant: 'cursor',
    };

    this.boundOnKeyDown = this.handleKeyDown.bind(this);
    this.createDom();
    this.attachEvents();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    // Backdrop
    this.backdropEl = document.createElement('div');
    this.backdropEl.className = 'prompt-modal-backdrop';
    this.backdropEl.id = 'prompt-modal-backdrop';

    // Dialog
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'prompt-modal-dialog';
    this.modalEl.id = 'prompt-modal-dialog';
    this.modalEl.setAttribute('role', 'dialog');
    this.modalEl.setAttribute('aria-modal', 'true');
    this.modalEl.setAttribute('aria-label', 'Генератор ТЗ для ИИ');

    this.backdropEl.appendChild(this.modalEl);
    document.body.appendChild(this.backdropEl);
  }

  private attachEvents(): void {
    if (typeof document === 'undefined' || !this.backdropEl) return;

    // Backdrop click outside closes dialog
    this.backdropEl.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.backdropEl) {
        this.close();
      }
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.close();
    }
  }

  public open(
    verdict?: MarketVerdict,
    games?: NormalizedGame[],
    arbitrage?: ArbitrageOpportunity,
    initialEngine?: TargetEngine
  ): void {
    const archetype: GameArchetype =
      verdict?.archetype || arbitrage?.archetype || 'SIMULATION_INCREMENTAL';

    let defaultEngine: TargetEngine = initialEngine || 'vite_canvas';
    if (!initialEngine) {
      if (archetype === 'PHYSICS_SANDBOX' || archetype === 'ACTION_SHOOTER') {
        defaultEngine = 'unity_webgl';
      } else if (archetype === 'SURVIVAL_HORROR' || archetype === 'OBBY_PARKOUR') {
        defaultEngine = 'godot_4';
      } else if (arbitrage) {
        defaultEngine = 'vite_canvas';
      }
    }

    this.currentContext = {
      targetEngine: defaultEngine,
      archetype,
      targetStore: defaultEngine === 'roblox_studio' ? 'roblox' : 'yandex_games',
      aiAssistant: this.currentContext.aiAssistant || 'cursor',
      verdict,
      games,
      arbitrage,
    };

    this.render();
    if (typeof document !== 'undefined') {
      this.backdropEl?.classList.add('active');
      document.addEventListener('keydown', this.boundOnKeyDown);
    }
  }

  public close(): void {
    if (typeof document !== 'undefined') {
      this.backdropEl?.classList.remove('active');
      document.removeEventListener('keydown', this.boundOnKeyDown);
    }
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  public setEngine(engine: TargetEngine): void {
    this.currentContext.targetEngine = engine;
    if (engine === 'roblox_studio') {
      this.currentContext.targetStore = 'roblox';
    } else if (this.currentContext.targetStore === 'roblox') {
      this.currentContext.targetStore = 'yandex_games';
    }
    this.render();
  }

  public setAiAssistant(assistant: AiAssistant): void {
    this.currentContext.aiAssistant = assistant;
    this.render();
  }

  public setStore(store: TargetStore): void {
    this.currentContext.targetStore = store;
    this.render();
  }

  public getCompiledPrompt(): string {
    return compileGddPrompt(this.currentContext);
  }

  public getContext(): Readonly<PromptContext> {
    return { ...this.currentContext };
  }

  private render(): void {
    if (typeof document === 'undefined' || !this.modalEl) return;
    const promptText = this.getCompiledPrompt();
    const title =
      this.currentContext.arbitrage?.suggestedRuTitle ||
      this.currentContext.verdict?.titleRu ||
      this.currentContext.archetype;

    const charCount = promptText.length;
    const wordCount = promptText.split(/\s+/).filter(Boolean).length;

    this.modalEl.innerHTML = `
      <div class="prompt-modal-header">
        <div class="prompt-modal-title-group">
          <div class="prompt-modal-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>Генератор ТЗ для ИИ</span>
          </div>
          <h3 class="prompt-modal-title">ТЗ для ИИ: ${this.escapeHtml(title)}</h3>
          <span class="prompt-modal-subtitle">${this.currentContext.archetype} • Подготовка для Cursor, Claude и ChatGPT</span>
        </div>
        <button type="button" class="prompt-modal-close" id="prompt-modal-close-btn" aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="prompt-modal-controls">
        <!-- Target Engine Tabs -->
        <div class="prompt-control-section">
          <label class="prompt-control-label">Целевой движок / стек:</label>
          <div class="prompt-engine-selector" role="radiogroup">
            <button type="button" class="prompt-engine-btn ${this.currentContext.targetEngine === 'unity_webgl' ? 'active' : ''}" data-engine="unity_webgl">
              <span class="engine-icon">⚡</span>
              <span class="engine-text">Unity WebGL</span>
            </button>
            <button type="button" class="prompt-engine-btn ${this.currentContext.targetEngine === 'godot_4' ? 'active' : ''}" data-engine="godot_4">
              <span class="engine-icon">🤖</span>
              <span class="engine-text">Godot 4</span>
            </button>
            <button type="button" class="prompt-engine-btn ${this.currentContext.targetEngine === 'vite_canvas' ? 'active' : ''}" data-engine="vite_canvas">
              <span class="engine-icon">🚀</span>
              <span class="engine-text">Vite + Canvas</span>
            </button>
            <button type="button" class="prompt-engine-btn ${this.currentContext.targetEngine === 'roblox_studio' ? 'active' : ''}" data-engine="roblox_studio">
              <span class="engine-icon">🧱</span>
              <span class="engine-text">Roblox Studio</span>
            </button>
          </div>
        </div>

        <!-- Assistant and Store Selectors -->
        <div class="prompt-control-row">
          <div class="prompt-control-col">
            <label class="prompt-control-label">ИИ-ассистент:</label>
            <div class="prompt-pills-selector">
              <button type="button" class="prompt-pill-btn ${this.currentContext.aiAssistant === 'cursor' ? 'active' : ''}" data-assistant="cursor">Cursor</button>
              <button type="button" class="prompt-pill-btn ${this.currentContext.aiAssistant === 'claude' ? 'active' : ''}" data-assistant="claude">Claude</button>
              <button type="button" class="prompt-pill-btn ${this.currentContext.aiAssistant === 'chatgpt' ? 'active' : ''}" data-assistant="chatgpt">ChatGPT</button>
            </div>
          </div>

          <div class="prompt-control-col">
            <label class="prompt-control-label">Целевая витрина:</label>
            <div class="prompt-pills-selector">
              <button type="button" class="prompt-pill-btn ${this.currentContext.targetStore === 'yandex_games' ? 'active' : ''}" data-store="yandex_games">Яндекс Игры</button>
              <button type="button" class="prompt-pill-btn ${this.currentContext.targetStore === 'poki' ? 'active' : ''}" data-store="poki">Poki</button>
              <button type="button" class="prompt-pill-btn ${this.currentContext.targetStore === 'roblox' ? 'active' : ''}" data-store="roblox">Roblox</button>
              <button type="button" class="prompt-pill-btn ${this.currentContext.targetStore === 'general_web' ? 'active' : ''}" data-store="general_web">Web 2D/3D</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Content Preview with Action Bar -->
      <div class="prompt-modal-body">
        <div class="prompt-preview-toolbar">
          <div class="prompt-meta-stats">
            <span class="stat-pill">${wordCount} слов</span>
            <span class="stat-pill">${charCount.toLocaleString()} символов</span>
            <span class="stat-pill accent">Готово к копированию</span>
          </div>
          <div class="prompt-toolbar-actions">
            <button type="button" class="prompt-action-btn secondary" id="prompt-btn-download">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Скачать .md</span>
            </button>
            <button type="button" class="prompt-action-btn primary" id="prompt-btn-copy">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Скопировать ТЗ</span>
            </button>
          </div>
        </div>

        <div class="prompt-preview-container">
          <pre><code class="prompt-code-output" id="prompt-code-output">${this.escapeHtml(promptText)}</code></pre>
        </div>
      </div>
    `;

    this.wireModalInteractions();
  }

  private wireModalInteractions(): void {
    // Close button
    const closeBtn = this.modalEl.querySelector('#prompt-modal-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    // Engine buttons
    const engineBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('.prompt-engine-btn');
    engineBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const eng = btn.getAttribute('data-engine') as TargetEngine;
        if (eng) this.setEngine(eng);
      });
    });

    // Assistant buttons
    const assistantBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('[data-assistant]');
    assistantBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const ast = btn.getAttribute('data-assistant') as AiAssistant;
        if (ast) this.setAiAssistant(ast);
      });
    });

    // Store buttons
    const storeBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('[data-store]');
    storeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const str = btn.getAttribute('data-store') as TargetStore;
        if (str) this.setStore(str);
      });
    });

    // Copy button
    const copyBtn = this.modalEl.querySelector('#prompt-btn-copy') as HTMLButtonElement;
    copyBtn?.addEventListener('click', () => this.copyPrompt(copyBtn));

    // Download button
    const downloadBtn = this.modalEl.querySelector('#prompt-btn-download') as HTMLButtonElement;
    downloadBtn?.addEventListener('click', () => this.downloadMarkdown());
  }

  public async copyPrompt(btn?: HTMLButtonElement): Promise<void> {
    const text = this.getCompiledPrompt();
    let copied = false;

    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        copied = true;
      } catch {
        copied = false;
      }
      document.body.removeChild(textarea);
    }

    if (btn) {
      btn.classList.add('copied');
      const span = btn.querySelector('span');
      const originalText = span ? span.textContent : 'Скопировать ТЗ';
      if (span) span.textContent = 'Скопировано!';

      setTimeout(() => {
        btn.classList.remove('copied');
        if (span) span.textContent = originalText;
      }, 2000);
    }

    if (this.options.showToast) {
      this.options.showToast('Готовое ТЗ для ИИ скопировано в буфер обмена!');
    }
  }

  public downloadMarkdown(): void {
    const text = this.getCompiledPrompt();
    const slug = (
      this.currentContext.arbitrage?.suggestedRuTitle ||
      this.currentContext.verdict?.archetype ||
      'game-spec'
    )
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '_');

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GDD_Spec_${slug}_${this.currentContext.targetEngine}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (this.options.showToast) {
      this.options.showToast('Файл ТЗ скачан в формате Markdown (.md)');
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
