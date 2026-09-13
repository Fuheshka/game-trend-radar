import {
  ArbitrageAnalogMatch,
  ArbitrageOpportunity,
  GameArchetype,
  NormalizedGame,
} from '../types/index.js';

export interface ArbitrageOptions {
  minRobloxCCU?: number;
  similarityThreshold?: number;
  topYandexLimit?: number;
}

/**
 * Словарь канонических игровых концептов (EN ↔ RU).
 * Позволяет сопоставлять семантику англоязычных хитов Roblox и русскоязычных карточек Яндекс Игр.
 */
export const CONCEPT_DICTIONARY: Record<string, string[]> = {
  steal_item: ['steal', 'stealing', 'thief', 'snatch', 'укради', 'украсть', 'воруй', 'похититель', 'грабитель', 'кража'],
  egg: ['egg', 'eggs', 'яйцо', 'яйца'],
  pet: ['pet', 'pets', 'питомец', 'питомцы', 'животное', 'зверушка'],
  simulator: ['simulator', 'sim', 'симулятор'],
  speed_incremental: ['speed', 'fast', 'faster', '+1', 'скорость', 'быстрый', 'ускорение', 'бег'],
  escape: ['escape', 'breakout', 'runaway', 'побег', 'сбеги', 'убеги', 'выход'],
  toilet_cameraman: ['toilet', 'skibidi', 'cameraman', 'speaker', 'туалет', 'скибиди', 'унитаз', 'камерамен'],
  tower_defense: ['tower', 'defense', 'td', 'башня', 'башни', 'защита', 'оборона'],
  ragdoll: ['ragdoll', 'рэгдолл', 'тряпичная', 'кукла', 'манекен'],
  break_bones: ['break', 'bone', 'bones', 'dismount', 'сломай', 'кости', 'костей', 'переломы', 'падение', 'травмы'],
  melon_sandbox: ['melon', 'sandbox', 'playground', 'мелон', 'песочница', 'плейграунд'],
  destruction: ['destruction', 'destroy', 'damage', 'разрушение', 'ломай', 'урон', 'взрыв'],
  survival_horror: ['horror', 'scary', 'spooky', 'creepy', 'хоррор', 'страшилка', 'ужас', 'страх', 'пугалка'],
  night: ['night', 'nights', 'ночь', 'ночей'],
  forest: ['forest', 'woods', 'лес', 'лесу'],
  doors: ['door', 'doors', 'дверь', 'двери'],
  anomaly: ['anomaly', 'hospital', 'аномалия', 'больница'],
  floor_lava: ['lava', 'floor', 'лава', 'пол'],
  clicker: ['clicker', 'tap', 'tapper', 'кликер', 'тап', 'тапалка'],
  merge: ['merge', 'merging', 'мёрдж', 'мерж', 'соединяй', 'эволюция', 'слияние'],
  sorting: ['sort', 'sorting', 'shelf', 'сортировка', 'полочки', 'разложи'],
  obby_parkour: ['obby', 'parkour', 'jump', 'обби', 'паркур', 'прыг', 'полоса препятствий'],
  blade_combat: ['blade', 'sword', 'saber', 'katana', 'меч', 'клинок', 'сабля', 'катана'],
  tycoon: ['tycoon', 'idle', 'тайкун', 'магнат', 'бизнес', 'фабрика'],
  fnaf: ['fnaf', 'freddy', 'фнаф', 'фредди'],
  brainrot: ['brainrot', 'sigma', 'rizz', 'ohio', 'брейнрот', 'сигма', 'ризз', 'огайо'],
  mining: ['mine', 'mining', 'digger', 'dig', 'шахта', 'копай', 'добыча', 'рудокоп'],
  eat_grow: ['eat', 'grow', 'blob', 'agar', 'snake', 'worm', 'съешь', 'расти', 'пожиратель', 'бактерии', 'червяк'],
  racing_car: ['drive', 'driver', 'car', 'race', 'racing', 'гонки', 'машина', 'автомобиль', 'водитель'],
  hide_seek: ['hide', 'seek', 'prop', 'прятки', 'ищи', 'найди'],
};

export class ArbitrageAnalyzer {
  private minRobloxCCU: number;
  private similarityThreshold: number;
  private topYandexLimit: number;

  constructor(options?: ArbitrageOptions) {
    this.minRobloxCCU = options?.minRobloxCCU ?? 100_000;
    this.similarityThreshold = options?.similarityThreshold ?? 0.40;
    this.topYandexLimit = options?.topYandexLimit ?? 100;
  }

  /**
   * Возвращает стандартный бейдж арбитражной ниши
   */
  getBadge(): 'ARBITRAGE OPPORTUNITY' {
    return 'ARBITRAGE OPPORTUNITY';
  }

  /**
   * Нормализует название: убирает служебные маркеры, скобки, эмодзи и приводит к нижнему регистру
   */
  normalizeTitle(rawTitle: string): string {
    if (!rawTitle) return '';

    return rawTitle
      // Убираем квадратные скобки и их содержимое ([X10], [UPDATE], [ALPHA] и т.д.)
      .replace(/\[[^\]]*\]/g, ' ')
      // Убираем круглые скобки и их содержимое ((UPDATE), (Anomaly) и т.д.)
      .replace(/\([^\)]*\)/g, ' ')
      // Убираем эмодзи и вариационные селекторы (сохраняя цифры 0-9)
      .replace(/\p{Extended_Pictographic}|\uFE0F|\uFE0E/gu, ' ')
      // Убираем символы-разделители подзаголовков и пунктуацию
      .replace(/[|~—–\-:!?,_#@$%\^&*+=`"';\\\/<>«»]/g, ' ')
      // Нормализуем пробелы
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Извлекает канонические концепты из названия и тегов
   */
  extractConcepts(title: string, tags: string[] = []): Set<string> {
    const normalized = this.normalizeTitle(title);
    const combinedTokens = new Set<string>([
      ...normalized.split(' ').filter(t => t.length > 1),
      ...tags.map(t => t.toLowerCase().trim()).filter(Boolean),
    ]);

    const matchedConcepts = new Set<string>();

    for (const [conceptKey, keywords] of Object.entries(CONCEPT_DICTIONARY)) {
      for (const token of combinedTokens) {
        if (keywords.some(k => token === k || (k.length >= 4 && token.includes(k)))) {
          matchedConcepts.add(conceptKey);
          break;
        }
      }
    }

    return matchedConcepts;
  }

  /**
   * Рассчитывает биграммный коэффициент Дайса между двумя строками (0.0 - 1.0)
   */
  calculateDiceSimilarity(str1: string, str2: string): number {
    const s1 = this.normalizeTitle(str1).replace(/\s+/g, '');
    const s2 = this.normalizeTitle(str2).replace(/\s+/g, '');

    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;
    if (s1.length < 2 || s2.length < 2) {
      return s1 === s2 ? 1.0 : 0.0;
    }

    const getBigrams = (str: string) => {
      const bigrams = new Map<string, number>();
      for (let i = 0; i < str.length - 1; i++) {
        const bigram = str.substring(i, i + 2);
        bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
      }
      return bigrams;
    };

    const b1 = getBigrams(s1);
    const b2 = getBigrams(s2);

    let intersection = 0;
    for (const [bigram, count1] of b1.entries()) {
      if (b2.has(bigram)) {
        intersection += Math.min(count1, b2.get(bigram)!);
      }
    }

    return (2.0 * intersection) / ((s1.length - 1) + (s2.length - 1));
  }

  /**
   * Рассчитывает семантическую схожесть между игрой Roblox и игрой Яндекс Игр
   */
  calculateSemanticSimilarity(
    robloxGame: NormalizedGame,
    yandexGame: NormalizedGame
  ): {
    similarity: number;
    sharedConcepts: string[];
    archetypeMatch: boolean;
  } {
    const conceptsA = this.extractConcepts(robloxGame.title, robloxGame.tags);
    const conceptsB = this.extractConcepts(yandexGame.title, yandexGame.tags);

    const sharedConcepts: string[] = [];
    for (const c of conceptsA) {
      if (conceptsB.has(c)) {
        sharedConcepts.push(c);
      }
    }

    // Коэффициент перекрытия понятий
    let conceptScore = 0;
    if (conceptsA.size > 0 && conceptsB.size > 0) {
      const union = new Set([...conceptsA, ...conceptsB]);
      conceptScore = sharedConcepts.length / union.size;
    } else if (sharedConcepts.length > 0) {
      conceptScore = 0.5;
    }

    // Если есть точное совпадение по 2+ концептам (например, "steal_item" + "egg")
    if (sharedConcepts.length >= 2) {
      conceptScore = Math.max(conceptScore, 0.90);
    } else if (sharedConcepts.length === 1 && conceptsA.size === 1 && conceptsB.size === 1) {
      conceptScore = Math.max(conceptScore, 0.75);
    }

    // Текстовая схожесть (для англоязычных или транслитерированных названий в каталоге ЯИ)
    const textScore = this.calculateDiceSimilarity(robloxGame.title, yandexGame.title);

    // Совпадение архетипа
    const archetypeMatch = robloxGame.archetype === yandexGame.archetype;
    const isBothCasual = robloxGame.archetype === 'OTHER_CASUAL' || yandexGame.archetype === 'OTHER_CASUAL';

    // Взвешенная оценка
    let combined = 0;
    if (conceptScore > 0) {
      combined = conceptScore * 0.7 + textScore * 0.2 + (archetypeMatch ? 0.1 : 0);
    } else {
      combined = textScore * 0.8 + (archetypeMatch ? 0.2 : 0);
    }

    // Если архетипы принципиально разные (например, шутер и словесный кроссворд), штрафуем
    if (!archetypeMatch && !isBothCasual) {
      combined *= 0.5;
    }

    const similarity = Math.min(1.0, Math.max(0.0, Number(combined.toFixed(3))));

    return {
      similarity,
      sharedConcepts,
      archetypeMatch,
    };
  }

  /**
   * Находит арбитражные ниши: игры Roblox с CCU > 100k, у которых нет прямых аналогов в топ-100 Яндекс Игр
   */
  findOpportunities(
    robloxGames: NormalizedGame[],
    yandexGames: NormalizedGame[]
  ): ArbitrageOpportunity[] {
    // 1. Фильтрация кандидатов из Roblox по порогу онлайна
    const candidateHits = robloxGames.filter(
      g => g.platform === 'roblox' && g.metricType === 'ccu' && g.metricValue >= this.minRobloxCCU
    );

    // 2. Отбор топ-N игр каталога Яндекс Игр
    const topYandex = yandexGames
      .filter(g => g.platform === 'yandex_games')
      .slice(0, this.topYandexLimit);

    const opportunities: ArbitrageOpportunity[] = [];

    for (const robloxGame of candidateHits) {
      let nearestAnalog: ArbitrageAnalogMatch | null = null;
      let maxSimilarity = 0;

      for (const yandexGame of topYandex) {
        const simResult = this.calculateSemanticSimilarity(robloxGame, yandexGame);
        if (simResult.similarity > maxSimilarity) {
          maxSimilarity = simResult.similarity;
          nearestAnalog = {
            id: yandexGame.id,
            title: yandexGame.title,
            similarity: simResult.similarity,
            archetype: yandexGame.archetype,
          };
        }
      }

      const hasDirectAnalog = maxSimilarity >= this.similarityThreshold;

      // Если прямого аналога нет (сходство ниже порога) — фиксируем арбитражную нишу
      if (!hasDirectAnalog) {
        const concepts = Array.from(this.extractConcepts(robloxGame.title, robloxGame.tags));
        const suggestedRuTitle = this.generateSuggestedRuTitle(robloxGame.title, robloxGame.archetype, concepts);
        const adaptationStrategy = this.generateAdaptationStrategy(robloxGame.archetype, robloxGame.title, concepts);
        const organicPotential =
          robloxGame.metricValue >= 500_000
            ? 'CRITICAL_FIRST_MOVER'
            : robloxGame.metricValue >= 200_000
              ? 'VERY_HIGH'
              : 'HIGH';

        const nicheDescription = `Хит Roblox «${robloxGame.title}» с онлайном ${robloxGame.metricValue.toLocaleString()} CCU отсутствует в топ-100 Яндекс Игр (максимальная схожесть каталога: ${(maxSimilarity * 100).toFixed(0)}%).`;

        opportunities.push({
          robloxGame,
          robloxCCU: robloxGame.metricValue,
          archetype: robloxGame.archetype,
          similarityWithNearestAnalog: maxSimilarity,
          nearestAnalog: nearestAnalog && maxSimilarity > 0.05 ? nearestAnalog : null,
          hasDirectAnalog: false,
          nicheKeywords: concepts,
          nicheDescription,
          adaptationStrategy,
          suggestedRuTitle,
          badge: 'ARBITRAGE OPPORTUNITY',
          organicPotential,
        });
      }
    }

    // Сортировка по CCU в Roblox по убыванию
    return opportunities.sort((a, b) => b.robloxCCU - a.robloxCCU);
  }

  /**
   * Генерирует адаптационную стратегию для Яндекс Игр
   */
  private generateAdaptationStrategy(archetype: GameArchetype, title: string, concepts: string[]): string {
    if (concepts.includes('steal_item') && concepts.includes('egg')) {
      return 'Сделать веб-раннер с видом от третьего лица: воровство яиц у босса, стелс-прятки в кустах, прокачка скорости и Rewarded-удвоение добычи.';
    }

    if (concepts.includes('speed_incremental') || concepts.includes('escape')) {
      return 'Реализовать +1 симулятор с постоянным приростом скорости: каждые 10 секунд игрок преодолевает весовой рубеж и перерождается (Rebirth). Монетизация: автоклик и VIP-скорость за Rewarded Video.';
    }

    if (archetype === 'PHYSICS_SANDBOX' || concepts.includes('ragdoll') || concepts.includes('break_bones')) {
      return 'Веб-песочница с сочной физикой переломов: спуск с рампы, трамплины, физические повреждения манекена. Rewarded за ядерные ускорители и скины.';
    }

    if (archetype === 'SURVIVAL_HORROR' || concepts.includes('survival_horror') || concepts.includes('doors')) {
      return 'Атмосферный синглплеерный хоррор без сложного сетевого кода: 100 комнат или выживание 99 ночей. Высокий виральный CTR превью в каталоге.';
    }

    if (archetype === 'SIMULATION_INCREMENTAL') {
      return 'Инкрементальный кликер-симулятор с питомцами и множителями перерождений. Внедрить Yandex Cloud Save для сохранения прогресса.';
    }

    return `Создать веб-адаптацию на легком движке (Vite/Canvas или Unity WebGL < 15 МБ), оптимизированную под мобильный трафик Яндекс Игр и Rewarded Video.`;
  }

  /**
   * Предлагает привлекательное русскоязычное название для витрины Яндекс Игр
   */
  private generateSuggestedRuTitle(title: string, archetype: GameArchetype, concepts: string[]): string {
    if (concepts.includes('steal_item') && concepts.includes('egg')) {
      return 'Укради Яйцо: Побег от Монстра';
    }
    if (concepts.includes('speed_incremental')) {
      return '+1 к Скорости: Мега Побег';
    }
    if (concepts.includes('break_bones') || concepts.includes('ragdoll')) {
      return 'Сломай Манекен: Безумные Падения';
    }
    if (concepts.includes('doors')) {
      return '100 Дверей: Побег из Отеля Монстров';
    }
    if (concepts.includes('forest') && concepts.includes('night')) {
      return '99 Ночей в Темном Лесу: Выживание';
    }
    if (concepts.includes('pet') && concepts.includes('simulator')) {
      return 'Симулятор Питомцев: Эволюция';
    }

    const clean = this.normalizeTitle(title)
      .split(' ')
      .slice(0, 3)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    return `${clean} (Веб-версия)`;
  }

  /**
   * Формирует Markdown-секцию для отчета радара
   */
  generateMarkdownSection(opportunities: ArbitrageOpportunity[]): string {
    if (opportunities.length === 0) {
      return `## 🎯 Арбитражные ниши: Хит в Roblox ➔ Отсутствует на Яндекс Играх\n\n> Прямых арбитражных разрывов с онлайном > 100k CCU в текущей выборке не зафиксировано.\n\n`;
    }

    let md = `## 🎯 Арбитражные ниши: Хит в Roblox ➔ Отсутствует на Яндекс Играх\n\n`;
    md += `> [!tip] Возможности быстрого органического захвата (ARBITRAGE OPPORTUNITY)\n`;
    md += `> Обнаружены игровые концепты с подтвержденным гигантским спросом в Roblox (CCU > 100k), у которых **нет прямых качественных аналогов в топ-100 Яндекс Игр**.\n`;
    md += `> Выпуск легковесной веб-версии позволяет мгновенно забрать поисковый органический трафик без жесткой конкуренции.\n\n`;

    for (const opp of opportunities) {
      const ccuFormatted = opp.robloxCCU.toLocaleString();
      const simPercent = (opp.similarityWithNearestAnalog * 100).toFixed(0);
      const analogText = opp.nearestAnalog
        ? `«${opp.nearestAnalog.title}» (схожесть всего ${simPercent}%)`
        : 'отсутствует';

      md += `### 🚀 [${opp.badge}] ${opp.robloxGame.title}\n\n`;
      md += `- **Roblox активный онлайн:** **${ccuFormatted} CCU** (подтвержденный спрос)\n`;
      md += `- **Ближайший аналог в Яндекс Играх:** ${analogText}\n`;
      md += `- **Потенциал первого хода:** \`${opp.organicPotential}\`\n`;
      md += `- **Рекомендуемое русское название:** **${opp.suggestedRuTitle}**\n`;
      md += `- **Рецепт адаптации под Яндекс Игры:** ${opp.adaptationStrategy}\n`;
      md += `- **Ссылка на оригинал Roblox:** [Перейти к игре](${opp.robloxGame.url || '#'})\n\n`;
    }

    return md;
  }
}
