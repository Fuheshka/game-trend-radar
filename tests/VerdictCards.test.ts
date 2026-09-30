import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VerdictCardsComponent } from '../web/src/components/VerdictCards.js';
import { MarketVerdict } from '../web/src/types.js';

describe('VerdictCardsComponent (Динамика CCU и карточки вердиктов)', () => {
  let mockContainer: any;

  beforeEach(() => {
    (global as any).document = {
      createElement: (tag: string) => {
        const el: any = {
          tagName: tag.toUpperCase(),
          className: '',
          innerHTML: '',
          setAttribute: vi.fn(),
          getAttribute: vi.fn(),
        };
        return el;
      },
    };
  });

  const baseVerdict: MarketVerdict = {
    archetype: 'SIMULATION_INCREMENTAL',
    titleRu: 'Симуляторы роста',
    status: 'GREEN_LIGHT',
    opportunityScore: {
      overallScore: 85,
      demandScore: 90,
      velocityScore: 80,
      monetizationScore: 85,
      saturationIndex: 2.0,
      productionEffort: 2.0,
      viralMultiplier: 1.2,
    },
    totalAudienceCCU: 1142000,
    marketSharePercent: 25,
    sampleTitles: ['Steal An Egg', 'Grow Stronger'],
    actionRecommendation: 'Делать клон с адаптацией под веб',
    coreLoopBlueprint: 'Сбор -> Апгрейд -> Ребилд',
    monetizationStrategy: 'Rewarded video',
    avoidPitfalls: 'Слишком сложный старт',
  };

  beforeEach(() => {
    mockContainer = {
      innerHTML: '',
      appendChild: vi.fn((el: any) => {
        // Simple DOM element simulation for testing
        mockContainer.children = mockContainer.children || [];
        mockContainer.children.push(el);
      }),
      addEventListener: vi.fn(),
    };
  });

  it('должен рассчитывать положительную динамику CCU (+14.2% ▲) и применять класс trend-up', () => {
    // Предыдущий онлайн был 1,000,000, текущий 1,142,000 -> +14.2%
    const currentVerdicts: MarketVerdict[] = [
      {
        ...baseVerdict,
        totalAudienceCCU: 1142000,
      },
    ];

    const previousVerdicts: MarketVerdict[] = [
      {
        ...baseVerdict,
        totalAudienceCCU: 1000000,
      },
    ];

    const component = new VerdictCardsComponent({
      container: mockContainer,
      verdicts: currentVerdicts,
      previousVerdicts,
    });

    const renderedCard = (component as any).createCard(currentVerdicts[0]);
    const html = renderedCard.innerHTML;

    expect(html).toContain('ccu-trend-badge trend-up');
    expect(html).toContain('+14.2% ▲');
    expect(html).toContain('CCU: 1,142,000');
  });

  it('должен рассчитывать отрицательную динамику CCU (-5.1% ▼) и применять класс trend-down', () => {
    // Предыдущий онлайн был 1,000,000, текущий 949,000 -> -5.1%
    const currentVerdicts: MarketVerdict[] = [
      {
        ...baseVerdict,
        totalAudienceCCU: 949000,
      },
    ];

    const previousVerdicts: MarketVerdict[] = [
      {
        ...baseVerdict,
        totalAudienceCCU: 1000000,
      },
    ];

    const component = new VerdictCardsComponent({
      container: mockContainer,
      verdicts: currentVerdicts,
      previousVerdicts,
    });

    const renderedCard = (component as any).createCard(currentVerdicts[0]);
    const html = renderedCard.innerHTML;

    expect(html).toContain('ccu-trend-badge trend-down');
    expect(html).toContain('-5.1% ▼');
  });

  it('должен рассчитывать нейтральную динамику (0.0% ━) при неизменном онлайне', () => {
    const currentVerdicts: MarketVerdict[] = [
      {
        ...baseVerdict,
        totalAudienceCCU: 500000,
      },
    ];

    const previousVerdicts: MarketVerdict[] = [
      {
        ...baseVerdict,
        totalAudienceCCU: 500000,
      },
    ];

    const component = new VerdictCardsComponent({
      container: mockContainer,
      verdicts: currentVerdicts,
      previousVerdicts,
    });

    const renderedCard = (component as any).createCard(currentVerdicts[0]);
    const html = renderedCard.innerHTML;

    expect(html).toContain('ccu-trend-badge trend-neutral');
    expect(html).toContain('0.0% ━');
  });

  it('не должен отображать динамику при отсутствии предыдущего снимка', () => {
    const currentVerdicts: MarketVerdict[] = [baseVerdict];

    const component = new VerdictCardsComponent({
      container: mockContainer,
      verdicts: currentVerdicts,
      previousVerdicts: [],
    });

    const renderedCard = (component as any).createCard(currentVerdicts[0]);
    const html = renderedCard.innerHTML;

    expect(html).not.toContain('ccu-trend-badge');
  });

  it('должен обновлять динамику при вызове updateData с новыми previousVerdicts', () => {
    const currentVerdicts: MarketVerdict[] = [
      {
        ...baseVerdict,
        totalAudienceCCU: 1200000,
      },
    ];

    const component = new VerdictCardsComponent({
      container: mockContainer,
      verdicts: currentVerdicts,
    });

    // Обновляем с передачей previousVerdicts (1,000,000 -> +20.0%)
    component.updateData(currentVerdicts, [
      {
        ...baseVerdict,
        totalAudienceCCU: 1000000,
      },
    ]);

    const renderedCard = (component as any).createCard(currentVerdicts[0]);
    const html = renderedCard.innerHTML;

    expect(html).toContain('ccu-trend-badge trend-up');
    expect(html).toContain('+20.0% ▲');
  });
});
