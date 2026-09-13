import { GameArchetype, MarketVerdict, OpportunityScore, VerdictStatus } from '../types/index.js';
import { getArchetypeDisplayNameRu } from './classifier.js';

export class VerdictEngine {
  generateVerdict(
    archetype: GameArchetype,
    score: OpportunityScore,
    totalAudienceCCU: number,
    marketSharePercent: number,
    sampleTitles: string[]
  ): MarketVerdict {
    let status: VerdictStatus = 'RED_LIGHT';
    if (score.overallScore >= 75) status = 'GREEN_LIGHT';
    else if (score.overallScore >= 50) status = 'YELLOW_LIGHT';

    const titleRu = getArchetypeDisplayNameRu(archetype);

    let actionRecommendation = '';
    let coreLoopBlueprint = '';
    let monetizationStrategy = '';
    let avoidPitfalls = '';

    switch (archetype) {
      case 'SIMULATION_INCREMENTAL':
        actionRecommendation = 'Брать в разработку в первую очередь. Сверхвысокий виральный потенциал в Shorts и Roblox, простейший кор-код и идеальная конверсия в просмотры Rewarded Video.';
        coreLoopBlueprint = 'Сбор ресурса (+1 каждую секунду / за тап) -> Преодоление весового барьера -> Победа над боссом или открытие новой двери -> Rebirth (престиж x2) -> Питомцы/бустеры.';
        monetizationStrategy = 'Rewarded: открытие редкого яйца, бустер x3 на 5 минут, автокликер. Interstitial: при рестарте или новом перерождении раз в 90-120 сек.';
        avoidPitfalls = 'Не затягивать старт игры. Первое ощущение прогресса и x2 рост должны наступать уже на 15-й секунде.';
        break;

      case 'PHYSICS_SANDBOX':
        actionRecommendation = 'Приоритет №1 для Яндекс Игр и веба. Melon Sandbox и Ragdoll игры стабильно удерживают топ-1 по вовлечению. Огромный простор для UGC и контента в Shorts.';
        coreLoopBlueprint = 'Спавн манекена на арену -> Выбор оружия / взрывчатки / механизмов -> Запуск физической реакции -> Получение монет за переломы и урон -> Разблокировка новых предметов в мастерской.';
        monetizationStrategy = 'Rewarded: доступ к ядерной бомбе, лазерной пушке или секретному скину. Interstitial: при очистке арены / респавне.';
        avoidPitfalls = 'Не делать деревянную физику. Манекен обязан быть эластичным (10+ сегментов на HingeJoint2D/3D), а разрушения сочными (частицы, экранотряс).';
        break;

      case 'MERGE_IDLE':
        actionRecommendation = 'Отличный выбор для стабильного долгосрочного дохода. Широкая аудитория (от детей до взрослых), высокая глубина сессий (Time Spent).';
        coreLoopBlueprint = 'Покупка предметов ур. 1 -> Мёрдж пар (1+1=2) -> Авто-добыча ресурсов -> Продажа -> Расширение сетки и покупка помощников.';
        monetizationStrategy = 'Rewarded: мгновенный парашют с предметом максимального уровня, удвоение накоплений за время отсутствия (Idle bonus x2). Sticky Banner не перекрывает сетку.';
        avoidPitfalls = 'Не перегружать интерфейс сложными меню. Должно быть видно всю арену или торговый зал на одном экране без лишних вкладок.';
        break;

      case 'WORD_PUZZLE':
        actionRecommendation = 'Надежная ниша для Яндекс Игр. Взрослая аудитория 35+, играют годами, ценят классические чистые кроссворды и филворды.';
        coreLoopBlueprint = 'Поиск слов на буквенной сетке -> Соединение линий -> Заполнение списка отгадок -> Открытие новой темы/города на карте уровней.';
        monetizationStrategy = 'Rewarded: подсветка первой буквы, перемешивание поля, открытие слова целиком. Interstitial между уровнями раз в 2-3 минуты.';
        avoidPitfalls = 'Не использовать мусорные словари. Каждое слово обязано быть общеупотребительным нарицательным существительным в именительном падеже.';
        break;

      case 'SURVIVAL_HORROR':
        actionRecommendation = 'Делать только в соло-формате без синхронного мультиплеера. Огромный хайп в Roblox (99 Nights), но разработка сетевого кода для инди слишком рискованна.';
        coreLoopBlueprint = 'Поиск ресурсов в темной локации -> Сбор ключей и батареек для фонарика -> Прятки в шкафах от монстра -> Побег к выходу.';
        monetizationStrategy = 'Rewarded: возрождение на контрольной точке, детектор приближения монстра, запасной фонарик.';
        avoidPitfalls = 'Категорически избегать сетевого мультиплеера на старте. Делайте плотный атмосферный синглплеер.';
        break;

      case 'ACTION_SHOOTER':
        actionRecommendation = 'Не рекомендуется для соло-разработчика (Красный океан). Высокая конкуренция со студиями, дорогая графика, жесткие требования к пингу и балансу оружия.';
        coreLoopBlueprint = 'Матч на арене -> Стрельба -> Фраги -> Покупка скинов.';
        monetizationStrategy = 'Сундуки со скинами, боевой пропуск.';
        avoidPitfalls = 'Откажитесь от попыток сделать «свой CS:GO в браузере». Трафик без рекламного бюджета стремится к нулю.';
        break;

      case 'OBBY_PARKOUR':
        actionRecommendation = 'Перенасыщенный рынок в Roblox. В топе сотни бесплатных обби. Делать только при наличии мощного вирусного сеттинга (например, связка со свежим мемом).';
        coreLoopBlueprint = 'Прыжки по блокам -> Прохождение чекпоинтов -> Достижение вершины.';
        monetizationStrategy = 'Пропуск сложного этапа за Rewarded / монеты.';
        avoidPitfalls = 'Не делайте стандартные разноцветные платформы. Нужен сюжет («Побег из зубов гигантского босса» и т.п.).';
        break;

      default:
        actionRecommendation = 'Тестировать механику короткими прототипами (1-2 дня) перед масштабированием.';
        coreLoopBlueprint = 'Простая гиперказуальная петля действия.';
        monetizationStrategy = 'Классическая баннерная и межстраничная сетка.';
        avoidPitfalls = 'Не полировать игру до подтверждения первых метрик удержания.';
        break;
    }

    return {
      archetype,
      titleRu,
      status,
      opportunityScore: score,
      totalAudienceCCU,
      marketSharePercent,
      sampleTitles,
      actionRecommendation,
      coreLoopBlueprint,
      monetizationStrategy,
      avoidPitfalls,
    };
  }
}
