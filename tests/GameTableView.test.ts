import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameTableView, TableSortColumn } from '../web/src/components/GameTableView.js';
import { NormalizedGame, MarketVerdict } from '../web/src/types.js';

describe('GameTableView (SteamDB-style high density table & interactive catalog)', () => {
  let mockContainer: any;
  let listeners: Record<string, (e: any) => void>;
  let sampleGames: NormalizedGame[];
  let sampleVerdicts: MarketVerdict[];

  beforeEach(() => {
    listeners = {};
    mockContainer = {
      innerHTML: '',
      addEventListener: vi.fn((event: string, handler: (e: any) => void) => {
        listeners[event] = handler;
      }),
      querySelector: vi.fn((selector: string) => {
        if (selector.includes('search-input')) {
          return { focus: vi.fn(), select: vi.fn(), value: '' };
        }
        return null;
      }),
      querySelectorAll: vi.fn(() => []),
    };

    sampleGames = [
      {
        id: 'roblox_egg',
        platform: 'roblox',
        title: 'Steal An Egg',
        genre: 'Simulation',
        archetype: 'SIMULATION_INCREMENTAL',
        metricValue: 1600000,
        metricType: 'ccu',
        likeRatio: 0.94,
        url: 'https://roblox.com/games/egg',
        tags: ['top-trending', 'simulation'],
        timestamp: '2026-10-03T10:00:00Z',
      },
      {
        id: 'roblox_brookhaven',
        platform: 'roblox',
        title: 'Brookhaven RP',
        genre: 'Roleplay',
        archetype: 'OTHER_CASUAL',
        metricValue: 260000,
        metricType: 'ccu',
        likeRatio: 0.88,
        url: 'https://roblox.com/games/brookhaven',
        tags: ['roleplay', 'popular'],
        timestamp: '2026-10-03T10:00:00Z',
      },
      {
        id: 'yandex_shadow',
        platform: 'yandex_games',
        title: 'Shadow Fight 2',
        genre: 'Action',
        archetype: 'ACTION_SHOOTER',
        metricValue: 45000,
        metricType: 'ccu',
        likeRatio: 0.82,
        url: 'https://yandex.ru/games/shadow',
        tags: ['action', 'martial-arts'],
        timestamp: '2026-10-03T10:00:00Z',
      },
      {
        id: 'poki_subway',
        platform: 'poki',
        title: 'Subway Surfers',
        genre: 'Runner',
        archetype: 'OTHER_CASUAL',
        metricValue: 85000,
        metricType: 'ccu',
        likeRatio: 0.91,
        url: 'https://poki.com/subway',
        tags: ['runner', 'arcade'],
        timestamp: '2026-10-03T10:00:00Z',
      },
      {
        id: 'youtube_toilet',
        platform: 'youtube_trends',
        title: 'Skibidi Toilet War',
        genre: 'Action',
        archetype: 'ACTION_SHOOTER',
        metricValue: 120000,
        metricType: 'viral_score',
        likeRatio: 0.76,
        url: 'https://youtube.com/shorts/toilet',
        tags: ['meme', 'viral'],
        timestamp: '2026-10-03T10:00:00Z',
      },
    ];

    sampleVerdicts = [
      {
        archetype: 'SIMULATION_INCREMENTAL',
        titleRu: 'Симуляторы и +1',
        status: 'GREEN_LIGHT',
        opportunityScore: {
          overallScore: 88,
          demandScore: 9,
          velocityScore: 9,
          monetizationScore: 8,
          saturationIndex: 2.1,
          productionEffort: 1.8,
        },
        totalAudienceCCU: 1800000,
        marketSharePercent: 42,
        sampleTitles: ['Steal An Egg'],
        actionRecommendation: 'Быстрый клон',
        coreLoopBlueprint: 'Сбор ресурсов -> прокачка',
        monetizationStrategy: 'IAP + VIP',
        avoidPitfalls: 'Слишком долгий старт',
      },
      {
        archetype: 'ACTION_SHOOTER',
        titleRu: 'Экшен и шутеры',
        status: 'YELLOW_LIGHT',
        opportunityScore: {
          overallScore: 65,
          demandScore: 7,
          velocityScore: 6,
          monetizationScore: 7,
          saturationIndex: 3.5,
          productionEffort: 3.2,
        },
        totalAudienceCCU: 450000,
        marketSharePercent: 12,
        sampleTitles: ['Shadow Fight 2'],
        actionRecommendation: 'Точечные механики',
        coreLoopBlueprint: 'Бой -> лут -> улучшение',
        monetizationStrategy: 'Боевой пропуск',
        avoidPitfalls: 'Высокая стоимость контента',
      },
      {
        archetype: 'OTHER_CASUAL',
        titleRu: 'Казуальные игры',
        status: 'GREEN_LIGHT',
        opportunityScore: {
          overallScore: 74,
          demandScore: 8,
          velocityScore: 7,
          monetizationScore: 6,
          saturationIndex: 2.8,
          productionEffort: 1.5,
        },
        totalAudienceCCU: 600000,
        marketSharePercent: 20,
        sampleTitles: ['Brookhaven RP', 'Subway Surfers'],
        actionRecommendation: 'Мини-игры',
        coreLoopBlueprint: 'Простой геймплей',
        monetizationStrategy: 'Реклама + косметика',
        avoidPitfalls: 'Быстрое выгорание',
      },
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Должен инициализироваться с режимом "table" по умолчанию и рендерить 9 колонок', () => {
    const onSelect = vi.fn();
    const tableView = new GameTableView({
      container: mockContainer as any,
      games: sampleGames,
      verdicts: sampleVerdicts,
      onSelectGame: onSelect,
    });

    expect(tableView.getViewMode()).toBe('table');
    expect(mockContainer.innerHTML).toContain('steamdb-table-container');
    expect(mockContainer.innerHTML).toContain('steamdb-table');

    // Проверяем наличие всех 9 колонок в шапке
    expect(mockContainer.innerHTML).toContain('th-rank');
    expect(mockContainer.innerHTML).toContain('th-platform');
    expect(mockContainer.innerHTML).toContain('th-title');
    expect(mockContainer.innerHTML).toContain('th-genre');
    expect(mockContainer.innerHTML).toContain('th-ccu');
    expect(mockContainer.innerHTML).toContain('th-trend');
    expect(mockContainer.innerHTML).toContain('th-opportunity');
    expect(mockContainer.innerHTML).toContain('th-likes');
    expect(mockContainer.innerHTML).toContain('th-actions');
  });

  it('2. Должен генерировать инлайн SVG спарклайн зеленого и красного цвета для 7d тренда', () => {
    const tableView = new GameTableView({
      container: mockContainer as any,
      games: sampleGames,
      verdicts: sampleVerdicts,
      onSelectGame: vi.fn(),
    });

    // Наличие SVG спарклайна
    expect(mockContainer.innerHTML).toContain('sparkline-svg');
    expect(mockContainer.innerHTML).toContain('<svg');
    expect(mockContainer.innerHTML).toContain('<path');

    // Наличие классов или стилей тренда
    const hasTrend =
      mockContainer.innerHTML.includes('sparkline-growth') ||
      mockContainer.innerHTML.includes('sparkline-drop') ||
      mockContainer.innerHTML.includes('sparkline-pos') ||
      mockContainer.innerHTML.includes('sparkline-neg');
    expect(hasTrend).toBe(true);
  });

  it('3. Должен рендерить моноширинный tabular-nums CCU и Opportunity Score с микро-индикатором', () => {
    new GameTableView({
      container: mockContainer as any,
      games: sampleGames,
      verdicts: sampleVerdicts,
      onSelectGame: vi.fn(),
    });

    // Моноширинный tabular-nums для онлайна
    expect(mockContainer.innerHTML).toContain('tabular-nums');
    expect(mockContainer.innerHTML).toContain('1.6M');

    // Opportunity Score и микро-индикатор
    expect(mockContainer.innerHTML).toContain('opp-score');
    expect(mockContainer.innerHTML).toContain('88'); // Opportunity score для SIMULATION_INCREMENTAL
    expect(mockContainer.innerHTML).toContain('opp-meter');
  });

  it('4. Должен мгновенно сортировать по колонкам (CCU, Opportunity, Title, Likes, Rank)', () => {
    const tableView = new GameTableView({
      container: mockContainer as any,
      games: sampleGames,
      verdicts: sampleVerdicts,
      onSelectGame: vi.fn(),
    });

    // Сортировка по CCU по возрастанию
    tableView.setSort('ccu', 'asc');
    let games = tableView.getFilteredGames();
    expect(games[0].title).toBe('Shadow Fight 2'); // 45k
    expect(games[games.length - 1].title).toBe('Steal An Egg'); // 1.6M

    // Сортировка по CCU по убыванию
    tableView.setSort('ccu', 'desc');
    games = tableView.getFilteredGames();
    expect(games[0].title).toBe('Steal An Egg'); // 1.6M

    // Сортировка по названию (алфавитная)
    tableView.setSort('title', 'asc');
    games = tableView.getFilteredGames();
    expect(games[0].title).toBe('Brookhaven RP');

    // Сортировка по Opportunity Score
    tableView.setSort('opportunity', 'desc');
    games = tableView.getFilteredGames();
    expect(games[0].archetype).toBe('SIMULATION_INCREMENTAL'); // Score 88

    // Сортировка по лайкам
    tableView.setSort('likes', 'desc');
    games = tableView.getFilteredGames();
    expect(games[0].title).toBe('Steal An Egg'); // 94%
  });

  it('5. Должен фильтровать по чипсам платформ ([Все], [Roblox], [Яндекс Игры], [Poki], [Shorts])', () => {
    const tableView = new GameTableView({
      container: mockContainer as any,
      games: sampleGames,
      verdicts: sampleVerdicts,
      onSelectGame: vi.fn(),
    });

    // Фильтр Roblox
    tableView.setPlatform('roblox');
    expect(tableView.getFilteredCount()).toBe(2);
    expect(mockContainer.innerHTML).toContain('Steal An Egg');
    expect(mockContainer.innerHTML).toContain('Brookhaven RP');
    expect(mockContainer.innerHTML).not.toContain('Shadow Fight 2');

    // Фильтр Яндекс Игры
    tableView.setPlatform('yandex_games');
    expect(tableView.getFilteredCount()).toBe(1);
    expect(mockContainer.innerHTML).toContain('Shadow Fight 2');

    // Фильтр Poki
    tableView.setPlatform('poki');
    expect(tableView.getFilteredCount()).toBe(1);
    expect(mockContainer.innerHTML).toContain('Subway Surfers');

    // Фильтр Shorts
    tableView.setPlatform('youtube_trends');
    expect(tableView.getFilteredCount()).toBe(1);
    expect(mockContainer.innerHTML).toContain('Skibidi Toilet War');

    // Все
    tableView.setPlatform('all');
    expect(tableView.getFilteredCount()).toBe(5);
  });

  it('6. Должен выполнять быстрый поиск в шапке (по названию, жанру, тегам)', () => {
    const tableView = new GameTableView({
      container: mockContainer as any,
      games: sampleGames,
      verdicts: sampleVerdicts,
      onSelectGame: vi.fn(),
    });

    tableView.setSearchQuery('egg');
    expect(tableView.getFilteredCount()).toBe(1);
    expect(mockContainer.innerHTML).toContain('Steal An Egg');

    tableView.setSearchQuery('martial-arts');
    expect(tableView.getFilteredCount()).toBe(1);
    expect(mockContainer.innerHTML).toContain('Shadow Fight 2');

    tableView.setSearchQuery('');
    expect(tableView.getFilteredCount()).toBe(5);
  });

  it('7. Должен переключать режимы отображения: Таблица (по умолчанию) и Сетка карточек', () => {
    const tableView = new GameTableView({
      container: mockContainer as any,
      games: sampleGames,
      verdicts: sampleVerdicts,
      onSelectGame: vi.fn(),
    });

    expect(tableView.getViewMode()).toBe('table');
    expect(mockContainer.innerHTML).toContain('steamdb-data-table');
    expect(mockContainer.innerHTML).not.toContain('catalog-cards-grid');

    tableView.setViewMode('grid');
    expect(tableView.getViewMode()).toBe('grid');
    expect(mockContainer.innerHTML).toContain('catalog-cards-grid');
    expect(mockContainer.innerHTML).not.toContain('steamdb-data-table');

    tableView.setViewMode('table');
    expect(tableView.getViewMode()).toBe('table');
    expect(mockContainer.innerHTML).toContain('steamdb-data-table');
  });

  it('8. Должен вызывать onSelectGame при клике на строку или кнопку инспектора', () => {
    const onSelect = vi.fn();
    const tableView = new GameTableView({
      container: mockContainer as any,
      games: sampleGames,
      verdicts: sampleVerdicts,
      onSelectGame: onSelect,
    });

    expect(listeners['click']).toBeDefined();

    // Симулируем клик по строке таблицы
    const fakeRow = {
      getAttribute: (attr: string) => (attr === 'data-game-id' ? 'roblox_egg' : null),
      closest: (sel: string) => {
        if (sel.includes('steamdb-table-row') || sel.includes('catalog-game-card')) return fakeRow;
        return null;
      },
    };

    listeners['click']({
      target: fakeRow,
      stopPropagation: vi.fn(),
    });

    expect(onSelect).toHaveBeenCalledWith(sampleGames[0]);
  });

  it('9. Должен игнорировать клик на внешнюю ссылку витрины', () => {
    const onSelect = vi.fn();
    new GameTableView({
      container: mockContainer as any,
      games: sampleGames,
      verdicts: sampleVerdicts,
      onSelectGame: onSelect,
    });

    const stopPropagation = vi.fn();
    const fakeLink = {
      closest: (sel: string) => (sel.includes('table-store-link') || sel.includes('catalog-ext-link') ? fakeLink : null),
    };

    listeners['click']({
      target: fakeLink,
      stopPropagation,
    });

    expect(stopPropagation).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('10. Должен поддерживать рендеринг 50+ видимых строк высокой плотности', () => {
    // Генерируем 60 игр
    const largeGameList: NormalizedGame[] = [];
    for (let i = 1; i <= 60; i++) {
      largeGameList.push({
        id: `game_${i}`,
        platform: i % 2 === 0 ? 'roblox' : 'yandex_games',
        title: `Game Number ${i}`,
        genre: 'Action',
        archetype: 'ACTION_SHOOTER',
        metricValue: i * 1000,
        metricType: 'ccu',
        likeRatio: 0.85,
        url: `https://example.com/games/${i}`,
        tags: ['action'],
        timestamp: '2026-10-03T10:00:00Z',
      });
    }

    const tableView = new GameTableView({
      container: mockContainer as any,
      games: largeGameList,
      verdicts: sampleVerdicts,
      onSelectGame: vi.fn(),
    });

    expect(tableView.getFilteredCount()).toBe(60);
    // Проверяем, что в HTML отрисовано не менее 50 строк
    const matches = (mockContainer.innerHTML.match(/steamdb-table-row/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(50);
  });
});
