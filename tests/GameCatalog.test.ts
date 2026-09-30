import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameCatalogComponent } from '../web/src/components/GameCatalog.js';
import { NormalizedGame } from '../web/src/types.js';

describe('GameCatalogComponent (Интерактивный каталог игр и фильтрация)', () => {
  let mockContainer: any;
  let listeners: Record<string, (e: any) => void>;
  let sampleGames: NormalizedGame[];

  beforeEach(() => {
    listeners = {};
    mockContainer = {
      innerHTML: '',
      addEventListener: vi.fn((event: string, handler: (e: any) => void) => {
        listeners[event] = handler;
      }),
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
        timestamp: '2026-09-30T10:00:00Z',
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
        timestamp: '2026-09-30T10:00:00Z',
      },
      {
        id: 'roblox_obby',
        platform: 'roblox',
        title: 'Mega Easy Obby',
        genre: 'Parkour',
        archetype: 'OBBY_PARKOUR',
        metricValue: 15000,
        metricType: 'ccu',
        likeRatio: 0.85,
        url: 'https://roblox.com/games/obby',
        tags: ['obby', 'parkour'],
        timestamp: '2026-09-30T10:00:00Z',
      },
      {
        id: 'yandex_shadow',
        platform: 'yandex_games',
        title: 'Shadow Fight 2',
        genre: 'Action',
        archetype: 'ACTION_SHOOTER',
        metricValue: 85,
        metricType: 'rating',
        url: 'https://yandex.ru/games/shadow',
        tags: ['action', 'martial-arts'],
        timestamp: '2026-09-30T10:00:00Z',
      },
      {
        id: 'poki_subway',
        platform: 'poki',
        title: 'Subway Surfers',
        genre: 'Runner',
        archetype: 'OTHER_CASUAL',
        metricValue: 1,
        metricType: 'rank',
        url: 'https://poki.com/subway',
        tags: ['runner', 'arcade'],
        timestamp: '2026-09-30T10:00:00Z',
      },
    ];
  });

  it('1. Должен инициализировать каталог и рендерить карточки по умолчанию', () => {
    const onSelect = vi.fn();
    const catalog = new GameCatalogComponent({
      container: mockContainer as any,
      games: sampleGames,
      onSelectGame: onSelect,
    });

    expect(catalog.getTotalGamesCount()).toBe(5);
    expect(catalog.getFilteredCount()).toBe(5);
    expect(mockContainer.innerHTML).toContain('catalog-cards-grid');
    expect(mockContainer.innerHTML).toContain('Steal An Egg');
    expect(mockContainer.innerHTML).toContain('Shadow Fight 2');
  });

  it('2. Должен корректно фильтровать по минимальному CCU', () => {
    const onSelect = vi.fn();
    const catalog = new GameCatalogComponent({
      container: mockContainer as any,
      games: sampleGames,
      onSelectGame: onSelect,
    });

    // Мин CCU 20 000: должны остаться только Steal An Egg (1.6M) и Brookhaven (260k)
    catalog.setMinCcu(20000);
    expect(catalog.getFilteredCount()).toBe(2);
    expect(mockContainer.innerHTML).toContain('Steal An Egg');
    expect(mockContainer.innerHTML).toContain('Brookhaven RP');
    expect(mockContainer.innerHTML).not.toContain('Mega Easy Obby');
    expect(mockContainer.innerHTML).not.toContain('Shadow Fight 2');

    // Мин CCU 1 000 000: только Steal An Egg
    catalog.setMinCcu(1000000);
    expect(catalog.getFilteredCount()).toBe(1);
    expect(mockContainer.innerHTML).toContain('Steal An Egg');

    // Сброс фильтра в 0: все 5 игр снова доступны
    catalog.setMinCcu(0);
    expect(catalog.getFilteredCount()).toBe(5);
  });

  it('3. Должен фильтровать по платформам (Roblox, Yandex Games, Poki)', () => {
    const onSelect = vi.fn();
    const catalog = new GameCatalogComponent({
      container: mockContainer as any,
      games: sampleGames,
      onSelectGame: onSelect,
    });

    catalog.setPlatform('roblox');
    expect(catalog.getFilteredCount()).toBe(3);
    expect(mockContainer.innerHTML).toContain('Steal An Egg');
    expect(mockContainer.innerHTML).not.toContain('Shadow Fight 2');

    catalog.setPlatform('yandex_games');
    expect(catalog.getFilteredCount()).toBe(1);
    expect(mockContainer.innerHTML).toContain('Shadow Fight 2');

    catalog.setPlatform('poki');
    expect(catalog.getFilteredCount()).toBe(1);
    expect(mockContainer.innerHTML).toContain('Subway Surfers');

    catalog.setPlatform('all');
    expect(catalog.getFilteredCount()).toBe(5);
  });

  it('4. Должен искать по названию, жанру и тегам', () => {
    const onSelect = vi.fn();
    const catalog = new GameCatalogComponent({
      container: mockContainer as any,
      games: sampleGames,
      onSelectGame: onSelect,
    });

    // Поиск по слову 'egg'
    catalog.setSearchQuery('egg');
    expect(catalog.getFilteredCount()).toBe(1);
    expect(mockContainer.innerHTML).toContain('Steal An Egg');

    // Поиск по тегу 'runner'
    catalog.setSearchQuery('runner');
    expect(catalog.getFilteredCount()).toBe(1);
    expect(mockContainer.innerHTML).toContain('Subway Surfers');

    // Поиск несуществующего
    catalog.setSearchQuery('non_existent_game_xyz');
    expect(catalog.getFilteredCount()).toBe(0);
    expect(mockContainer.innerHTML).toContain('catalog-empty-state');
  });

  it('5. Должен переключать режимы отображения (Grid vs Table)', () => {
    const onSelect = vi.fn();
    const catalog = new GameCatalogComponent({
      container: mockContainer as any,
      games: sampleGames,
      onSelectGame: onSelect,
    });

    expect(mockContainer.innerHTML).toContain('catalog-cards-grid');
    expect(mockContainer.innerHTML).not.toContain('catalog-table');

    catalog.setViewMode('table');
    expect(mockContainer.innerHTML).toContain('catalog-table');
    expect(mockContainer.innerHTML).toContain('catalog-table-row');
    expect(mockContainer.innerHTML).not.toContain('catalog-cards-grid');

    catalog.setViewMode('grid');
    expect(mockContainer.innerHTML).toContain('catalog-cards-grid');
  });

  it('6. Должен корректно сортировать игры по CCU и названию', () => {
    const onSelect = vi.fn();
    const catalog = new GameCatalogComponent({
      container: mockContainer as any,
      games: sampleGames,
      onSelectGame: onSelect,
    });

    // Сортировка по возрастанию CCU
    catalog.setSort('ccu_asc');
    catalog.setViewMode('table');
    const tableHtml = mockContainer.innerHTML;
    // Subway Surfers (metricValue 1) или Shadow Fight (85) должны идти раньше Steal An Egg (1.6M)
    const subwayIdx = tableHtml.indexOf('Subway Surfers');
    const eggIdx = tableHtml.indexOf('Steal An Egg');
    expect(subwayIdx).toBeLessThan(eggIdx);
  });

  it('7. Должен вызывать onSelectGame при клике на карточку', () => {
    const onSelect = vi.fn();
    new GameCatalogComponent({
      container: mockContainer as any,
      games: sampleGames,
      onSelectGame: onSelect,
    });

    expect(listeners['click']).toBeDefined();

    // Симулируем клик по карточке
    const fakeCard = {
      getAttribute: (attr: string) => (attr === 'data-game-id' ? 'roblox_egg' : null),
      closest: (sel: string) => {
        if (sel.includes('catalog-game-card')) return fakeCard;
        return null;
      },
    };

    listeners['click']({
      target: fakeCard,
      stopPropagation: vi.fn(),
    });

    expect(onSelect).toHaveBeenCalledWith(sampleGames[0]);
  });

  it('8. Должен игнорировать открытие карточки при клике на ссылку витрины', () => {
    const onSelect = vi.fn();
    new GameCatalogComponent({
      container: mockContainer as any,
      games: sampleGames,
      onSelectGame: onSelect,
    });

    const stopPropagation = vi.fn();
    const fakeLink = {
      closest: (sel: string) => (sel.includes('catalog-ext-link') ? fakeLink : null),
    };

    listeners['click']({
      target: fakeLink,
      stopPropagation,
    });

    expect(stopPropagation).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
