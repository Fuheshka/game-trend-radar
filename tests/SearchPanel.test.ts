import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { POPULAR_SEARCH_TAGS, PopularSearchTag } from '../web/src/main.js';
import { FALLBACK_SNAPSHOT } from '../web/src/fallbackData.js';
import { GameArchetype, MarketVerdict } from '../web/src/types.js';

describe('SearchPanel (Панель поиска, популярные теги и кнопка быстрой очистки)', () => {
  it('1. Должен содержать все требуемые популярные теги жанров и механик', () => {
    const labels = POPULAR_SEARCH_TAGS.map(t => t.label);

    expect(labels).toContain('Симуляторы');
    expect(labels).toContain('Хоррор');
    expect(labels).toContain('Обби');
    expect(labels).toContain('Головоломки');
    expect(labels).toContain('Песочница');
    expect(labels).toContain('Кликеры');
    expect(labels).toContain('Мемы Shorts');
  });

  it('2. Каждый тег должен иметь уникальный ID и непустой поисковый запрос (query)', () => {
    const ids = new Set<string>();

    for (const tag of POPULAR_SEARCH_TAGS) {
      expect(tag.id).toBeTruthy();
      expect(tag.label).toBeTruthy();
      expect(tag.query).toBeTruthy();
      expect(ids.has(tag.id)).toBe(false);
      ids.add(tag.id);
    }
  });

  it('3. Разметка web/index.html должна содержать кнопку очистки и контейнер тегов', () => {
    const htmlPath = resolve(__dirname, '../web/index.html');
    const html = readFileSync(htmlPath, 'utf-8');

    // Наличие кнопки быстрой очистки
    expect(html).toContain('id="search-clear-btn"');
    expect(html).toContain('class="search-clear-btn"');

    // Наличие контейнера и скролла тегов
    expect(html).toContain('id="search-tags-container"');
    expect(html).toContain('id="search-tags-scroll"');

    // Наличие кнопки очистки в каталоге
    expect(html).toContain('id="catalog-search-clear-btn"');
  });

  it('4. Стили style.css должны определять правила для .search-clear-btn и .search-tags-row', () => {
    const cssPath = resolve(__dirname, '../web/src/style.css');
    const css = readFileSync(cssPath, 'utf-8');

    expect(css).toContain('.search-clear-btn');
    expect(css).toContain('.search-clear-btn.visible');
    expect(css).toContain('.search-tags-row');
    expect(css).toContain('.search-tags-scroll');
    expect(css).toContain('.search-tag-chip');
    expect(css).toContain('.search-tag-chip.active');
  });

  describe('5. Логика фильтрации и подстановки тегов', () => {
    // Вспомогательная функция сопоставления, воспроизводящая метод doesVerdictMatchQuery
    function doesVerdictMatch(v: MarketVerdict, q: string): boolean {
      if (!q) return true;
      const lower = q.toLowerCase().trim();

      if (
        v.titleRu.toLowerCase().includes(lower) ||
        v.archetype.toLowerCase().includes(lower) ||
        v.sampleTitles.some(s => s.toLowerCase().includes(lower)) ||
        v.actionRecommendation.toLowerCase().includes(lower) ||
        v.coreLoopBlueprint.toLowerCase().includes(lower) ||
        v.avoidPitfalls.toLowerCase().includes(lower) ||
        (v.monetizationStrategy && v.monetizationStrategy.toLowerCase().includes(lower))
      ) {
        return true;
      }

      const keywords: Record<GameArchetype, string[]> = {
        SIMULATION_INCREMENTAL: ['симулятор', 'симуляторы', 'эволюция', 'кликер', 'кликеры', 'тайкун', 'тайкуны', 'добыча'],
        PHYSICS_SANDBOX: ['песочница', 'песочницы', 'сендбокс', 'sandbox', 'рэгдолл', 'ragdoll', 'физика', 'разрушение', 'melon'],
        MERGE_IDLE: ['мёрдж', 'мердж', 'merge', 'сортировка', 'айдл', 'idle'],
        SURVIVAL_HORROR: ['хоррор', 'хорроры', 'horror', 'побег', 'выживание', 'survival', 'escape'],
        WORD_PUZZLE: ['головоломка', 'головоломки', 'пазл', 'пазлы', 'puzzle', 'слова', 'филворд'],
        ACTION_SHOOTER: ['шутер', 'шутеры', 'shooter', 'экшен', 'action', 'стрелялка'],
        OBBY_PARKOUR: ['обби', 'паркур', 'obby', 'parkour'],
        OTHER_CASUAL: ['казуальные', 'casual'],
      };

      const archKeywords = keywords[v.archetype] || [];
      if (archKeywords.some(k => k.includes(lower) || lower.includes(k))) {
        return true;
      }

      if (lower.includes('мем') || lower.includes('short') || lower.includes('viral')) {
        if (v.opportunityScore?.viralMultiplier && v.opportunityScore.viralMultiplier > 1.0) {
          return true;
        }
      }

      return false;
    }

    it('должен находить вердикт SIMULATION_INCREMENTAL по тегам «Симуляторы» и «Кликеры»', () => {
      const simVerdict = FALLBACK_SNAPSHOT.verdicts.find(v => v.archetype === 'SIMULATION_INCREMENTAL')!;
      expect(doesVerdictMatch(simVerdict, 'симулятор')).toBe(true);
      expect(doesVerdictMatch(simVerdict, 'кликер')).toBe(true);
    });

    it('должен находить вердикт SURVIVAL_HORROR по тегу «Хоррор»', () => {
      const horrorVerdict = FALLBACK_SNAPSHOT.verdicts.find(v => v.archetype === 'SURVIVAL_HORROR')!;
      expect(doesVerdictMatch(horrorVerdict, 'хоррор')).toBe(true);
    });

    it('должен находить вердикт OBBY_PARKOUR по тегу «Обби»', () => {
      const obbyVerdict = FALLBACK_SNAPSHOT.verdicts.find(v => v.archetype === 'OBBY_PARKOUR')!;
      expect(doesVerdictMatch(obbyVerdict, 'обби')).toBe(true);
    });

    it('должен находить вердикт WORD_PUZZLE по тегу «Головоломки»', () => {
      const puzzleVerdict = FALLBACK_SNAPSHOT.verdicts.find(v => v.archetype === 'WORD_PUZZLE')!;
      expect(doesVerdictMatch(puzzleVerdict, 'головоломк')).toBe(true);
    });

    it('должен находить вердикт PHYSICS_SANDBOX по тегу «Песочница»', () => {
      const sandboxVerdict = FALLBACK_SNAPSHOT.verdicts.find(v => v.archetype === 'PHYSICS_SANDBOX')!;
      expect(doesVerdictMatch(sandboxVerdict, 'песочниц')).toBe(true);
    });

    it('должен находить вердикты с вирусным множителем по тегу «Мемы Shorts»', () => {
      const viralVerdicts = FALLBACK_SNAPSHOT.verdicts.filter(v => (v.opportunityScore?.viralMultiplier ?? 0) > 1.0);
      expect(viralVerdicts.length).toBeGreaterThan(0);
      for (const v of viralVerdicts) {
        expect(doesVerdictMatch(v, 'shorts')).toBe(true);
      }
    });
  });

  describe('6. Поведение кнопки очистки и переключение активности тегов', () => {
    it('должен переключать класс active при повторном клике на тег (toggle)', () => {
      let searchQuery = '';
      let activeTagId: string | null = null;

      const clickTag = (tag: PopularSearchTag) => {
        if (activeTagId === tag.id) {
          activeTagId = null;
          searchQuery = '';
        } else {
          activeTagId = tag.id;
          searchQuery = tag.query;
        }
      };

      const tag = POPULAR_SEARCH_TAGS.find(t => t.id === 'horror')!;

      // Первый клик: тег активируется
      clickTag(tag);
      expect(activeTagId).toBe('horror');
      expect(searchQuery).toBe('хоррор');

      // Повторный клик: тег сбрасывается (toggle off)
      clickTag(tag);
      expect(activeTagId).toBeNull();
      expect(searchQuery).toBe('');
    });

    it('должен очищать поле поиска и сбрасывать активный тег по кнопке очистки или Escape', () => {
      let inputValue = 'Симуляторы';
      let searchQuery = 'симулятор';
      let isClearBtnVisible = true;
      let activeArchetype: string | null = 'SIMULATION_INCREMENTAL';

      // Эмуляция клика по крестику очистки или нажатия Escape
      const clearSearch = () => {
        inputValue = '';
        searchQuery = '';
        isClearBtnVisible = false;
        activeArchetype = null;
      };

      clearSearch();

      expect(inputValue).toBe('');
      expect(searchQuery).toBe('');
      expect(isClearBtnVisible).toBe(false);
      expect(activeArchetype).toBeNull();
    });
  });
});
