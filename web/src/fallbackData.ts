import { MarketSnapshot } from './types.js';

export const FALLBACK_SNAPSHOT: MarketSnapshot = {
  id: 'snapshot-2026-09-13-cached',
  timestamp: new Date().toISOString(),
  totalGamesScanned: 320,
  platformCounts: {
    roblox: 214,
    yandex_games: 75,
    poki: 100,
    youtube_trends: 12,
  },
  robloxTotalCCU: 9946321,
  games: [
    {
      id: 'roblox_10563114921',
      platform: 'roblox',
      title: 'Steal An Egg',
      genre: 'Simulation',
      archetype: 'SIMULATION_INCREMENTAL',
      metricValue: 2824620,
      metricType: 'ccu',
      likeRatio: 0.93,
      url: 'https://www.roblox.com/games/107778070777162',
      tags: ['top-playing-now', 'Simulation', 'viral', 'egg', 'steal'],
      sortSource: 'top-playing-now',
      timestamp: '2026-09-13T13:13:24.456Z',
    },
    {
      id: 'roblox_994732206',
      platform: 'roblox',
      title: 'Blox Fruits',
      genre: 'RPG',
      archetype: 'OTHER_CASUAL',
      metricValue: 546396,
      metricType: 'ccu',
      likeRatio: 0.92,
      tags: ['top-playing-now', 'Action', 'RPG'],
      sortSource: 'top-playing-now',
      timestamp: '2026-09-13T13:13:24.456Z',
    },
    {
      id: 'roblox_melon_1',
      platform: 'roblox',
      title: 'Ragdoll Chaos Playground',
      genre: 'Physics',
      archetype: 'PHYSICS_SANDBOX',
      metricValue: 185400,
      metricType: 'ccu',
      likeRatio: 0.89,
      tags: ['ragdoll', 'sandbox', 'melon'],
      timestamp: '2026-09-13T13:13:24.456Z',
    },
    {
      id: 'yandex_words_1',
      platform: 'yandex_games',
      title: 'Филворды: Поиск Слов',
      genre: 'Словесные',
      archetype: 'WORD_PUZZLE',
      metricValue: 94,
      metricType: 'rating',
      tags: ['пазлы', 'слова', 'хит'],
      timestamp: '2026-09-13T13:13:24.456Z',
    },
    {
      id: 'poki_subway',
      platform: 'poki',
      title: 'Subway Surfers',
      genre: 'Runner',
      archetype: 'OTHER_CASUAL',
      metricValue: 1,
      metricType: 'rank',
      tags: ['runner', 'legend', 'arcade'],
      timestamp: '2026-09-13T13:13:24.456Z',
    },
  ],
  verdicts: [
    {
      archetype: 'SIMULATION_INCREMENTAL',
      titleRu: '+1 Симулятор и Эволюция',
      status: 'GREEN_LIGHT',
      opportunityScore: {
        overallScore: 96,
        demandScore: 98,
        velocityScore: 100,
        monetizationScore: 92,
        saturationIndex: 2.7,
        productionEffort: 1.5,
        viralMultiplier: 1.8,
      },
      totalAudienceCCU: 3686313,
      marketSharePercent: 37,
      sampleTitles: [
        'Steal An Egg',
        '+1 Speed Keyboard Escape',
        'Steal a Brainrot',
        'Pet Simulator 99',
        '+1 Superhero Evolution',
        'Bee Swarm Simulator',
      ],
      actionRecommendation:
        'Брать в разработку в первую очередь. Сверхвысокий виральный потенциал в Shorts и Roblox, простейший кор-код и идеальная конверсия в просмотры Rewarded Video.',
      coreLoopBlueprint:
        'Сбор ресурса (+1 каждую секунду / за тап) -> Преодоление весового барьера -> Победа над боссом или открытие новой двери -> Rebirth (престиж x2) -> Питомцы/бустеры.',
      monetizationStrategy:
        'Rewarded: открытие редкого яйца, бустер x3 на 5 минут, автокликер. Interstitial: при рестарте или новом перерождении раз в 90-120 сек.',
      avoidPitfalls:
        'Не затягивать старт игры. Первое ощущение прогресса и x2 рост должны наступать уже на 15-й секунде.',
      hasArbitrageOpportunity: true,
    },
    {
      archetype: 'PHYSICS_SANDBOX',
      titleRu: 'Рэгдолл-сендбокс и Физика',
      status: 'GREEN_LIGHT',
      opportunityScore: {
        overallScore: 84,
        demandScore: 78,
        velocityScore: 95,
        monetizationScore: 88,
        saturationIndex: 1.8,
        productionEffort: 2.4,
        viralMultiplier: 1.5,
      },
      totalAudienceCCU: 1845000,
      marketSharePercent: 19,
      sampleTitles: [
        'Ragdoll Hit',
        'Melon Playground Web',
        'Ragdoll Chaos Dismount',
        'Break Bones Simulator',
      ],
      actionRecommendation:
        'Приоритет №1 для Яндекс Игр и веба. Melon Sandbox и Ragdoll игры стабильно удерживают топ-1 по вовлечению. Огромный простор для UGC и виральных Shorts.',
      coreLoopBlueprint:
        'Спавн манекена на арену -> Выбор оружия / взрывчатки / механизмов -> Запуск физической реакции -> Получение монет за переломы и урон -> Разблокировка новых предметов в мастерской.',
      monetizationStrategy:
        'Rewarded: доступ к ядерной бомбе, лазерной пушке или секретному скину. Interstitial: при очистке арены / респавне.',
      avoidPitfalls:
        'Не делать деревянную физику. Манекен обязан быть эластичным (10+ сегментов на HingeJoint2D/3D), а разрушения сочными (частицы, экранотряс).',
      hasArbitrageOpportunity: true,
    },
    {
      archetype: 'MERGE_IDLE',
      titleRu: 'Мёрдж и Айдл-Тайкун',
      status: 'YELLOW_LIGHT',
      opportunityScore: {
        overallScore: 68,
        demandScore: 65,
        velocityScore: 60,
        monetizationScore: 94,
        saturationIndex: 3.4,
        productionEffort: 2.2,
        viralMultiplier: 1.1,
      },
      totalAudienceCCU: 1120000,
      marketSharePercent: 11,
      sampleTitles: [
        'Merge Weapons 3D',
        'Idle Merge Tycoon',
        'Fruit Drop Suika',
        'Merge Dragons Web',
      ],
      actionRecommendation:
        'Подходит для долгосрочной пассивной монетизации, но требует уникального сеттинга (Sci-Fi, мемные персонажи), чтобы выделиться на фоне сотен клонов.',
      coreLoopBlueprint:
        'Генерация базовых юнитов -> Соединение пар в уровень выше -> Пассивный доход монет/сек -> Покупка слотов и авто-мёрджа -> Экспедиции и сброс с множителем.',
      monetizationStrategy:
        'Rewarded: удвоение офлайн-дохода (x2 за рекламу), мгновенный сундук с юнитами 5 уровня, ускорение конвейера x3 на 10 минут.',
      avoidPitfalls:
        'Не делать пустую сетку без анимаций слияния. Момент «мёрджа» должен давать мощный аудиовизуальный отклик (звук колокольчика, вспышка, вылетающие цифры дохода).',
      hasArbitrageOpportunity: false,
    },
    {
      archetype: 'WORD_PUZZLE',
      titleRu: 'Словесные Пазлы и Филворды',
      status: 'YELLOW_LIGHT',
      opportunityScore: {
        overallScore: 65,
        demandScore: 70,
        velocityScore: 50,
        monetizationScore: 90,
        saturationIndex: 3.8,
        productionEffort: 1.6,
        viralMultiplier: 1.0,
      },
      totalAudienceCCU: 890000,
      marketSharePercent: 9,
      sampleTitles: [
        'Филворды: Поиск Слов',
        'Линия Слов',
        'Кроссворды Дня',
        'Слово за Слово',
      ],
      actionRecommendation:
        'Идеально для аудитории 35+ на Яндекс Играх с рекордным удержанием D30 (15-20%). Конкуренция плотная, но качественный UX и гладкий свайп выводят проект в топ.',
      coreLoopBlueprint:
        'Сетка букв -> Свайп пальцем по ортогонали -> Подсветка слова пастельным цветом -> Заполнение прогресс-бара главы -> Колесо фортуны / Банка эрудита.',
      monetizationStrategy:
        'Rewarded: докупка подсказок (Лампочка, Лупа), удвоение монет за уровень. Interstitial: строго каждые 2-3 пройденных уровня, баннер внизу экрана.',
      avoidPitfalls:
        'Не допускать некорректных слов и тупиковых генераций сетки. Обязательна предпроверка PolyominoSolver и чистая база нарицательных существительных.',
      hasArbitrageOpportunity: false,
    },
    {
      archetype: 'SURVIVAL_HORROR',
      titleRu: 'Кооп-хоррор и Побег',
      status: 'YELLOW_LIGHT',
      opportunityScore: {
        overallScore: 62,
        demandScore: 75,
        velocityScore: 80,
        monetizationScore: 70,
        saturationIndex: 3.5,
        productionEffort: 3.8,
        viralMultiplier: 1.6,
      },
      totalAudienceCCU: 1350000,
      marketSharePercent: 14,
      sampleTitles: [
        '99 Nights in the Forest',
        'DOORS Floor 2',
        'FNAF: Security Breach 2D',
        'Granny Remake Web',
      ],
      actionRecommendation:
        'Высокий виральный интерес у стримеров и блогеров, но высокая трудоемкость сборки 3D/2D окружения и скриптованных скримеров. Брать только с готовым атмосферным пайплайном.',
      coreLoopBlueprint:
        'Исследование темной локации с фонариком -> Поиск ключей/кодов -> Звуковой сигнал приближения монстра -> Прятки в шкафу -> Открытие следующей двери.',
      monetizationStrategy:
        'Rewarded: возрождение с сохранением лута (второй шанс), батарейки для фонарика, компас направления к выходу.',
      avoidPitfalls:
        'Не делать монстра непредсказуемо телепортирующимся. Игрок должен слышать шаги и понимать правила выживания, иначе наступает быстрая фрустрация.',
      hasArbitrageOpportunity: true,
    },
    {
      archetype: 'OBBY_PARKOUR',
      titleRu: 'Обби и Башня Паркура',
      status: 'RED_LIGHT',
      opportunityScore: {
        overallScore: 35,
        demandScore: 50,
        velocityScore: 30,
        monetizationScore: 40,
        saturationIndex: 4.8,
        productionEffort: 1.8,
        viralMultiplier: 1.0,
      },
      totalAudienceCCU: 680000,
      marketSharePercent: 7,
      sampleTitles: [
        'Mega Easy Obby 850 Stages',
        'Tower of Hell',
        'Escape Barry Prison',
        'Rainbow Parkour',
      ],
      actionRecommendation:
        'Красный океан. Рынок перенасыщен десятками тысяч однотипных карт с разноцветными блоками. Органический трафик на нуле без закупки дорогого промо.',
      coreLoopBlueprint:
        'Бег и прыжки по летающим платформам -> Чекпоинт -> Лазерная ловушка -> Финишная платформа -> Донатный танец.',
      monetizationStrategy:
        'Продажа геймпасов на пружины прыжка, пропуск уровня за Rewarded видео, троллинг других игроков.',
      avoidPitfalls:
        'Не начинать разработку классического паркура без кардинальной инновации (например, +1 к прыжку каждые 2 секунды или рэгдолл-кооператив).',
      hasArbitrageOpportunity: false,
    },
    {
      archetype: 'ACTION_SHOOTER',
      titleRu: 'Сетевой Шутер и Арена',
      status: 'RED_LIGHT',
      opportunityScore: {
        overallScore: 28,
        demandScore: 60,
        velocityScore: 35,
        monetizationScore: 55,
        saturationIndex: 4.9,
        productionEffort: 4.6,
        viralMultiplier: 1.0,
      },
      totalAudienceCCU: 320000,
      marketSharePercent: 3,
      sampleTitles: [
        'Standoff 2 Web Clone',
        'Pixel Gun 3D Arena',
        'Battleground Strike',
        'Sniper Champion 3D',
      ],
      actionRecommendation:
        'Критически избегать небольшим инди-командам. Колоссальные затраты на сетевую синхронизацию, античит, оптимизацию 60 FPS на слабых устройствах и баланс оружия.',
      coreLoopBlueprint:
        'Лобби -> Подбор матча -> Перестрелка 5v5 -> Начисление очков -> Открытие оружейных кейсов.',
      monetizationStrategy:
        'Боевой пропуск (Battle Pass), скины на ножи и автоматы, кейсы за премиум-валюту.',
      avoidPitfalls:
        'Не пытаться делать честный мультиплеер на веб-сокетах без сильного бэкенда. Любой лаг в 100мс вызовет шквал отрицательных отзывов с оценкой 1.0.',
      hasArbitrageOpportunity: false,
    },
  ],
  arbitrageOpportunities: [
    {
      robloxGame: {
        id: 'roblox_10563114921',
        platform: 'roblox',
        title: 'Steal An Egg',
        genre: 'Simulation',
        archetype: 'SIMULATION_INCREMENTAL',
        metricValue: 2824620,
        metricType: 'ccu',
        tags: ['egg', 'steal', 'viral'],
        timestamp: '2026-09-13T13:13:24.456Z',
      },
      robloxCCU: 2824620,
      archetype: 'SIMULATION_INCREMENTAL',
      similarityWithNearestAnalog: 0.12,
      nearestAnalog: null,
      hasDirectAnalog: false,
      nicheKeywords: ['укради яйцо', 'steal egg', 'эволюция яиц', 'побег'],
      nicheDescription:
        'Вирусный хит Roblox с 2.8M CCU полностью отсутствует в каталоге Яндекс Игр в виде качественного клона.',
      adaptationStrategy:
        'Собрать легковесный веб-клон на Vite/Canvas или Unity WebGL < 15 МБ, адаптировать под сенсорное управление смартфонов, монетизировать через Rewarded Video за инкубацию редких драконьих яиц.',
      suggestedRuTitle: 'Укради Яйцо: Мега Эволюция',
      badge: 'ARBITRAGE OPPORTUNITY',
      organicPotential: 'CRITICAL_FIRST_MOVER',
    },
    {
      robloxGame: {
        id: 'roblox_melon_1',
        platform: 'roblox',
        title: 'Ragdoll Chaos Playground',
        genre: 'Physics',
        archetype: 'PHYSICS_SANDBOX',
        metricValue: 185400,
        metricType: 'ccu',
        tags: ['ragdoll', 'sandbox'],
        timestamp: '2026-09-13T13:13:24.456Z',
      },
      robloxCCU: 185400,
      archetype: 'PHYSICS_SANDBOX',
      similarityWithNearestAnalog: 0.28,
      nearestAnalog: null,
      hasDirectAnalog: false,
      nicheKeywords: ['манекен', 'рэгдолл', 'физика', 'разрушение'],
      nicheDescription:
        'Высокий органический поисковый спрос в Яндекс Играх по ключам «манекен» и «песочница ломать кости».',
      adaptationStrategy:
        'Физика 2D Box2D, интерактивный спавнер предметов (мины, лазеры, молоты), система очков урона.',
      suggestedRuTitle: 'Манекен Рэгдолл: Арена Разрушений',
      badge: 'ARBITRAGE OPPORTUNITY',
      organicPotential: 'VERY_HIGH',
    },
  ],
};
