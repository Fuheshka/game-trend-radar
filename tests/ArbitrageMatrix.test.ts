import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArbitrageMatrixComponent } from '../web/src/components/ArbitrageMatrix.js';
import { ArbitrageOpportunity } from '../web/src/types.js';

describe('ArbitrageMatrixComponent (Аналитический экран «Матрица Арбитража»)', () => {
  let mockContainer: any;
  let listeners: Record<string, (e: any) => void>;
  let sampleOpportunities: ArbitrageOpportunity[];

  beforeEach(() => {
    listeners = {};
    mockContainer = {
      innerHTML: '',
      addEventListener: vi.fn((event: string, handler: (e: any) => void) => {
        listeners[event] = handler;
      }),
      querySelectorAll: vi.fn(() => []),
      querySelector: vi.fn(() => null),
    };

    sampleOpportunities = [
      {
        robloxGame: {
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
        robloxCCU: 1600000,
        archetype: 'SIMULATION_INCREMENTAL',
        similarityWithNearestAnalog: 0.36,
        nearestAnalog: {
          id: 'yandex_turbo_weave',
          title: 'Turbo Weave',
          similarity: 0.36,
          archetype: 'SIMULATION_INCREMENTAL',
        },
        hasDirectAnalog: false,
        nicheKeywords: ['egg', 'steal_item'],
        nicheDescription: 'Хит Roblox Steal An Egg с онлайном 1.6M CCU отсутствует на Яндекс Играх',
        adaptationStrategy: 'Создать веб-адаптацию на легком движке (Vite/Canvas или Unity WebGL < 15 МБ), оптимизированную под мобильный трафик Яндекс Игр и Rewarded Video.',
        suggestedRuTitle: 'Укради Яйцо: Побег от Монстра',
        badge: 'ARBITRAGE OPPORTUNITY',
        organicPotential: 'CRITICAL_FIRST_MOVER',
      },
      {
        robloxGame: {
          id: 'roblox_pet',
          platform: 'roblox',
          title: 'Ride A Pet',
          genre: 'Simulation',
          archetype: 'OTHER_CASUAL',
          metricValue: 207000,
          metricType: 'ccu',
          likeRatio: 0.96,
          url: 'https://roblox.com/games/pet',
          tags: ['pet', 'simulation'],
          timestamp: '2026-09-30T10:00:00Z',
        },
        robloxCCU: 207000,
        archetype: 'OTHER_CASUAL',
        similarityWithNearestAnalog: 0.22,
        nearestAnalog: {
          id: 'yandex_shadow',
          title: 'Shadow Fight 2',
          similarity: 0.22,
          archetype: 'OTHER_CASUAL',
        },
        hasDirectAnalog: false,
        nicheKeywords: ['pet'],
        nicheDescription: 'Хит Roblox Ride A Pet с онлайном 207k CCU',
        adaptationStrategy: 'Создать веб-адаптацию на легком движке (Vite/Canvas или Unity WebGL < 15 МБ), оптимизированную под мобильный трафик Яндекс Игр и Rewarded Video.',
        suggestedRuTitle: 'Ride A Pet (Веб-версия)',
        badge: 'ARBITRAGE OPPORTUNITY',
        organicPotential: 'VERY_HIGH',
      },
      {
        robloxGame: {
          id: 'roblox_small',
          platform: 'roblox',
          title: 'Niche Runner 3D',
          genre: 'Runner',
          archetype: 'OBBY_PARKOUR',
          metricValue: 45000,
          metricType: 'ccu',
          likeRatio: 0.88,
          url: 'https://roblox.com/games/runner',
          tags: ['runner', 'parkour'],
          timestamp: '2026-09-30T10:00:00Z',
        },
        robloxCCU: 45000,
        archetype: 'OBBY_PARKOUR',
        similarityWithNearestAnalog: 0.15,
        nearestAnalog: null,
        hasDirectAnalog: false,
        nicheKeywords: ['parkour'],
        nicheDescription: 'Небольшой хит с онлайном 45k CCU',
        adaptationStrategy: 'Веб-раннер на Canvas с быстрым стартом.',
        suggestedRuTitle: 'Мега Паркур 3D',
        badge: 'ARBITRAGE OPPORTUNITY',
        organicPotential: 'HIGH',
      },
    ];
  });

  it('1. Должен инициализироваться и рендерить карточки арбитража', () => {
    const component = new ArbitrageMatrixComponent({
      container: mockContainer as any,
      opportunities: sampleOpportunities,
    });

    expect(component.getTotalCount()).toBe(3);
    expect(component.getFilteredCount()).toBe(3);
    expect(mockContainer.innerHTML).toContain('Steal An Egg');
    expect(mockContainer.innerHTML).toContain('Ride A Pet');
    expect(mockContainer.innerHTML).toContain('Niche Runner 3D');
  });

  it('2. Должен отображать игру-донор с платформой, онлайном и рейтингом', () => {
    new ArbitrageMatrixComponent({
      container: mockContainer as any,
      opportunities: sampleOpportunities,
    });

    expect(mockContainer.innerHTML).toContain('Steal An Egg');
    expect(mockContainer.innerHTML).toContain('1 600 000 CCU');
    expect(mockContainer.innerHTML).toContain('94%');
    expect(mockContainer.innerHTML).toContain('Roblox');
  });

  it('3. Должен отображать ближайший аналог со шкалой сходства', () => {
    new ArbitrageMatrixComponent({
      container: mockContainer as any,
      opportunities: sampleOpportunities,
    });

    // Для Steal An Egg ближайший аналог Turbo Weave с 36% схожести
    expect(mockContainer.innerHTML).toContain('Turbo Weave');
    expect(mockContainer.innerHTML).toContain('36%');
    expect(mockContainer.innerHTML).toContain('схожест');

    // Для Niche Runner 3D аналог отсутствует
    expect(mockContainer.innerHTML).toContain('Аналог отсутствует');
  });

  it('4. Должен отображать окно возможностей и запас времени до появления клонов', () => {
    new ArbitrageMatrixComponent({
      container: mockContainer as any,
      opportunities: sampleOpportunities,
    });

    // VERY_HIGH / CRITICAL_FIRST_MOVER / HIGH
    expect(mockContainer.innerHTML).toContain('potential-critical');
    expect(mockContainer.innerHTML).toContain('potential-very-high');
    expect(mockContainer.innerHTML).toContain('potential-high');
    expect(mockContainer.innerHTML).toContain('недел');
  });

  it('5. Должен отображать рецепт адаптации (движок, вес билда < 15 МБ, монетизация) и заголовок для РФ', () => {
    new ArbitrageMatrixComponent({
      container: mockContainer as any,
      opportunities: sampleOpportunities,
    });

    expect(mockContainer.innerHTML).toContain('< 15 МБ');
    expect(mockContainer.innerHTML).toContain('Rewarded Video');
    expect(mockContainer.innerHTML).toContain('Укради Яйцо: Побег от Монстра');
    expect(mockContainer.innerHTML).toContain('Название для РФ');
  });

  it('6. Должен корректно фильтровать по кнопке «Только с онлайном от 100k CCU»', () => {
    const component = new ArbitrageMatrixComponent({
      container: mockContainer as any,
      opportunities: sampleOpportunities,
    });

    expect(component.getFilteredCount()).toBe(3);
    expect(component.isMin100kOnly()).toBe(false);

    // Включаем фильтр 100k+
    component.setMin100kOnly(true);
    expect(component.isMin100kOnly()).toBe(true);
    expect(component.getFilteredCount()).toBe(2);
    expect(mockContainer.innerHTML).toContain('Steal An Egg');
    expect(mockContainer.innerHTML).toContain('Ride A Pet');
    expect(mockContainer.innerHTML).not.toContain('Niche Runner 3D');

    // Выключаем обратно
    component.setMin100kOnly(false);
    expect(component.getFilteredCount()).toBe(3);
    expect(mockContainer.innerHTML).toContain('Niche Runner 3D');
  });

  it('7. Должен поддерживать обновление данных через updateData', () => {
    const component = new ArbitrageMatrixComponent({
      container: mockContainer as any,
      opportunities: [],
    });

    expect(component.getTotalCount()).toBe(0);
    expect(mockContainer.innerHTML).toContain('нет активных арбитражных ниш');

    component.updateData(sampleOpportunities);
    expect(component.getTotalCount()).toBe(3);
    expect(mockContainer.innerHTML).toContain('Steal An Egg');
  });

  it('8. Должен корректно отрисовывать все арбитражные связки из реального снимка рынка (latest_snapshot.json)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const snapshotPath = path.resolve(__dirname, '../web/public/data/latest_snapshot.json');
    const snapshotRaw = fs.readFileSync(snapshotPath, 'utf-8');
    const snapshot = JSON.parse(snapshotRaw);

    const component = new ArbitrageMatrixComponent({
      container: mockContainer as any,
      opportunities: snapshot.arbitrageOpportunities,
    });

    expect(component.getTotalCount()).toBe(snapshot.arbitrageOpportunities.length);
    expect(component.getTotalCount()).toBeGreaterThan(0);

    for (const opp of snapshot.arbitrageOpportunities) {
      expect(mockContainer.innerHTML).toContain(opp.robloxGame.title);
      expect(mockContainer.innerHTML).toContain(opp.suggestedRuTitle);
    }
  });

  it('9. Должен очищать названия игр от пустых скобок и эмодзи (cleanDisplayTitle)', async () => {
    const { cleanDisplayTitle } = await import('../web/src/components/ArbitrageMatrix.js');

    expect(cleanDisplayTitle('[🌋] Ride A Pet')).toBe('Ride A Pet');
    expect(cleanDisplayTitle('[ ] Ride A Pet')).toBe('Ride A Pet');
    expect(cleanDisplayTitle('[🏚️] Adopt Me!')).toBe('Adopt Me!');
    expect(cleanDisplayTitle('Brookhaven 🏡RP')).toBe('Brookhaven RP');
    expect(cleanDisplayTitle('99 Nights in the Forest 🔦')).toBe('99 Nights in the Forest');
    expect(cleanDisplayTitle('Steal An Egg')).toBe('Steal An Egg');
  });

  it('10. Должен генерировать структурированный Markdown-питч через formatArbitragePitch', async () => {
    const { formatArbitragePitch } = await import('../web/src/components/ArbitrageMatrix.js');

    const pitch = formatArbitragePitch(sampleOpportunities[0]);

    // Проверяем все обязательные блоки по критериям приемки:
    // 1. Источник тренда
    expect(pitch).toContain('Источник тренда');
    expect(pitch).toContain('Steal An Egg');
    expect(pitch).toContain('Roblox');

    // 2. Доказательство спроса (CCU в Roblox)
    expect(pitch).toContain('Доказательство спроса');
    expect(pitch).toContain('1 600 000 CCU');
    expect(pitch).toContain('94% 👍');

    // 3. Текущий статус в Яндекс Играх / Poki
    expect(pitch).toContain('Текущий статус на целевых витринах');
    expect(pitch).toContain('Turbo Weave');
    expect(pitch).toContain('36%');

    // 4. Предлагаемая адаптация
    expect(pitch).toContain('Предлагаемая адаптация');
    expect(pitch).toContain('Укради Яйцо: Побег от Монстра');
    expect(pitch).toContain(sampleOpportunities[0].adaptationStrategy);

    // 5. Технологический стек
    expect(pitch).toContain('Технологический стек');
    expect(pitch).toContain('< 15 МБ');
    expect(pitch).toContain('Rewarded Video');

    // 6. Оценка окупаемости
    expect(pitch).toContain('Оценка окупаемости');
    expect(pitch).toContain('1–2 месяца');
    expect(pitch).toContain('1–3 недели');
  });

  it('11. Должен рендерить кнопку «Скопировать питч» на каждой карточке арбитража', () => {
    new ArbitrageMatrixComponent({
      container: mockContainer as any,
      opportunities: sampleOpportunities,
    });

    expect(mockContainer.innerHTML).toContain('btn-copy-pitch');
    expect(mockContainer.innerHTML).toContain('data-game-id="roblox_egg"');
    expect(mockContainer.innerHTML).toContain('data-game-id="roblox_pet"');
    expect(mockContainer.innerHTML).toContain('data-game-id="roblox_small"');
    expect(mockContainer.innerHTML).toContain('Скопировать питч');
  });

  it('12. Должен вызывать copyPitch и останавливать всплытие при клике на кнопку питча', async () => {
    const onSelect = vi.fn();
    const onToast = vi.fn();
    const component = new ArbitrageMatrixComponent({
      container: mockContainer as any,
      opportunities: sampleOpportunities,
      onSelectGame: onSelect,
      showToast: onToast,
    });

    const copySpy = vi.spyOn(component, 'copyPitch').mockImplementation(async () => 'pitch markdown');

    const fakeBtn = {
      getAttribute: (attr: string) => (attr === 'data-game-id' ? 'roblox_egg' : null),
      closest: (sel: string) => {
        if (sel.includes('btn-copy-pitch')) return fakeBtn;
        if (sel.includes('arbitrage-card')) return { getAttribute: () => 'roblox_egg' };
        return null;
      },
      classList: { add: vi.fn(), remove: vi.fn() },
      querySelector: vi.fn(() => ({ textContent: 'Скопировать питч' })),
    };

    const stopPropagation = vi.fn();

    expect(listeners['click']).toBeDefined();
    await listeners['click']({
      target: fakeBtn,
      stopPropagation,
    });

    expect(stopPropagation).toHaveBeenCalled();
    expect(copySpy).toHaveBeenCalledWith(sampleOpportunities[0], fakeBtn);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('13. Должен копировать питч в буфер и вызывать тост через copyPitch', async () => {
    const onToast = vi.fn();
    const component = new ArbitrageMatrixComponent({
      container: mockContainer as any,
      opportunities: sampleOpportunities,
      showToast: onToast,
    });

    // Мокаем navigator.clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const fakeBtnEl = {
      classList: { add: vi.fn(), remove: vi.fn() },
      querySelector: vi.fn(() => ({ textContent: 'Скопировать питч' })),
    } as any;

    const result = await component.copyPitch(sampleOpportunities[0], fakeBtnEl);

    expect(result).toContain('Steal An Egg');
    expect(writeTextMock).toHaveBeenCalledWith(result);
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('скопирован'));
    expect(fakeBtnEl.classList.add).toHaveBeenCalledWith('copied');
  });
});

