import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  compileGddPrompt,
  PromptContext,
  TargetEngine,
  TargetStore,
  AiAssistant,
} from '../web/src/components/PromptGeneratorModal.js';
import { MarketVerdict, GameArchetype, ArbitrageOpportunity, NormalizedGame } from '../web/src/types.js';

describe('PromptGenerator: compileGddPrompt (Компилятор ТЗ для ИИ)', () => {
  const sampleVerdict: MarketVerdict = {
    archetype: 'SIMULATION_INCREMENTAL',
    titleRu: 'Симуляторы и +1 в секунду',
    status: 'GREEN_LIGHT',
    opportunityScore: {
      overallScore: 88,
      demandScore: 9,
      velocityScore: 8,
      monetizationScore: 9,
      saturationIndex: 2.1,
      productionEffort: 2.5,
      viralMultiplier: 1.4,
    },
    totalAudienceCCU: 450000,
    marketSharePercent: 32.5,
    sampleTitles: ['+1 Speed Every Second', 'Arm Wrestle Simulator', 'Mining Clicker'],
    actionRecommendation: 'Запустить MVP за 14 дней с упором на вирусный множитель клика и престиж.',
    coreLoopBlueprint: 'Тап/Клик -> Накопление очков -> Покупка питомца/бустера -> Удвоение прироста -> Реберф',
    monetizationStrategy: 'Rewarded x2 доход на 3 мин, Interstitial между локациями каждые 120 сек.',
    avoidPitfalls: 'Избегать долгого ожидания в первые 30 секунд; не делать сложную 3D физику.',
    hasArbitrageOpportunity: true,
  };

  const sampleArbitrage: ArbitrageOpportunity = {
    robloxGame: {
      id: 'roblox_123',
      platform: 'roblox',
      title: 'Steal An Egg Simulator',
      genre: 'Simulation',
      archetype: 'SIMULATION_INCREMENTAL',
      metricValue: 120000,
      metricType: 'ccu',
      likeRatio: 0.94,
      tags: ['Simulator', 'Egg', 'Meme'],
      timestamp: new Date().toISOString(),
    },
    robloxCCU: 120000,
    archetype: 'SIMULATION_INCREMENTAL',
    similarityWithNearestAnalog: 0.15,
    nearestAnalog: null,
    hasDirectAnalog: false,
    nicheKeywords: ['egg', 'steal', 'simulator'],
    nicheDescription: 'Вирусный тренд с похищением яиц и прокачкой инкубаторов',
    adaptationStrategy: 'Перенос в легкий WebGL кликер с поддержкой мобилок и Yandex SDK',
    suggestedRuTitle: 'Укради яйцо: Симулятор вора',
    badge: 'ARBITRAGE OPPORTUNITY',
    organicPotential: 'CRITICAL_FIRST_MOVER',
  };

  it('должен содержать все 6 обязательных разделов в сгенерированном ТЗ', () => {
    const prompt = compileGddPrompt({
      targetEngine: 'unity_webgl',
      archetype: 'SIMULATION_INCREMENTAL',
      verdict: sampleVerdict,
    });

    expect(prompt).toContain('## 1. Роль и системная инструкция');
    expect(prompt).toContain('## 2. Архитектурный каркас и структура файлов');
    expect(prompt).toContain('## 3. Схема Core Loop и стейт-машина состояний');
    expect(prompt).toContain('## 4. Спецификация компонентов и контракты данных');
    expect(prompt).toContain('## 5. Модель монетизации и баланс таймингов');
    expect(prompt).toContain('## 6. Подводные камни и обязательная оптимизация витрины');
    expect(prompt).toContain('## 7. Пошаговый план реализации для ИИ-ассистента');
  });

  describe('Адаптация под все 4 целевых движка', () => {
    it('Unity WebGL: должен содержать URP, C#, .jslib, AudioListener и WebGL лимиты памяти', () => {
      const prompt = compileGddPrompt({
        targetEngine: 'unity_webgl',
        archetype: 'SIMULATION_INCREMENTAL',
        verdict: sampleVerdict,
      });

      expect(prompt).toContain('Unity WebGL');
      expect(prompt).toContain('Assets/_Project');
      expect(prompt).toContain('.jslib');
      expect(prompt).toContain('AudioListener');
      expect(prompt).toContain('256');
    });

    it('Godot 4: должен содержать GDScript, res://, JavaScriptBridge и Compatibility renderer', () => {
      const prompt = compileGddPrompt({
        targetEngine: 'godot_4',
        archetype: 'SIMULATION_INCREMENTAL',
        verdict: sampleVerdict,
      });

      expect(prompt).toContain('Godot 4');
      expect(prompt).toContain('res://');
      expect(prompt).toContain('GDScript');
      expect(prompt).toContain('JavaScriptBridge');
      expect(prompt).toContain('Compatibility');
    });

    it('Vite + Canvas: должен содержать TypeScript, requestAnimationFrame, zero-bundle и pointerdown', () => {
      const prompt = compileGddPrompt({
        targetEngine: 'vite_canvas',
        archetype: 'SIMULATION_INCREMENTAL',
        verdict: sampleVerdict,
      });

      expect(prompt).toContain('Vite');
      expect(prompt).toContain('Canvas');
      expect(prompt).toContain('requestAnimationFrame');
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('visibilitychange');
    });

    it('Roblox Studio: должен содержать Luau, DataStoreService, RemoteEvent и ReplicatedStorage', () => {
      const prompt = compileGddPrompt({
        targetEngine: 'roblox_studio',
        archetype: 'SIMULATION_INCREMENTAL',
        verdict: sampleVerdict,
      });

      expect(prompt).toContain('Roblox');
      expect(prompt).toContain('Luau');
      expect(prompt).toContain('DataStoreService');
      expect(prompt).toContain('RemoteEvent');
      expect(prompt).toContain('ReplicatedStorage');
    });
  });

  describe('Адаптация под все 8 архетипов', () => {
    const archetypes: GameArchetype[] = [
      'SIMULATION_INCREMENTAL',
      'PHYSICS_SANDBOX',
      'MERGE_IDLE',
      'SURVIVAL_HORROR',
      'WORD_PUZZLE',
      'ACTION_SHOOTER',
      'OBBY_PARKOUR',
      'OTHER_CASUAL',
    ];

    archetypes.forEach(arch => {
      it(`должен генерировать специфичные механики для архетипа ${arch}`, () => {
        const prompt = compileGddPrompt({
          targetEngine: 'vite_canvas',
          archetype: arch,
          verdict: { ...sampleVerdict, archetype: arch },
        });

        expect(prompt.length).toBeGreaterThan(1000);
        expect(prompt).toContain(arch);
        expect(prompt).toContain('Core Loop');
      });
    });
  });

  describe('Интеграция арбитражной ниши (ArbitrageOpportunity)', () => {
    it('должен включать исходную игру Roblox, CCU и стратегию переноса', () => {
      const prompt = compileGddPrompt({
        targetEngine: 'unity_webgl',
        archetype: 'SIMULATION_INCREMENTAL',
        verdict: sampleVerdict,
        arbitrage: sampleArbitrage,
      });

      expect(prompt).toContain('Steal An Egg Simulator');
      expect(prompt).toContain('120');
      expect(prompt).toContain('Укради яйцо: Симулятор вора');
      expect(prompt).toContain('Перенос в легкий WebGL кликер');
    });
  });

  describe('Настройка целевого ИИ-ассистента', () => {
    it('Cursor: должен формировать формат с правилами .cursorrules и четкими типами', () => {
      const prompt = compileGddPrompt({
        targetEngine: 'vite_canvas',
        archetype: 'SIMULATION_INCREMENTAL',
        aiAssistant: 'cursor',
      });

      expect(prompt).toContain('Cursor');
    });

    it('Claude: должен форматировать с акцентом на архитектурный контекст и проверку контрактов', () => {
      const prompt = compileGddPrompt({
        targetEngine: 'godot_4',
        archetype: 'SIMULATION_INCREMENTAL',
        aiAssistant: 'claude',
      });

      expect(prompt).toContain('Claude');
    });

    it('ChatGPT: должен форматировать с пошаговой генерацией кода без заполнителей', () => {
      const prompt = compileGddPrompt({
        targetEngine: 'unity_webgl',
        archetype: 'SIMULATION_INCREMENTAL',
        aiAssistant: 'chatgpt',
      });

      expect(prompt).toContain('ChatGPT');
    });
  });

  describe('Требования к оформлению диаграмм Mermaid', () => {
    it('все Mermaid диаграммы должны иметь читаемые контрастные стили и белый текст', () => {
      const prompt = compileGddPrompt({
        targetEngine: 'unity_webgl',
        archetype: 'SIMULATION_INCREMENTAL',
        verdict: sampleVerdict,
      });

      expect(prompt).toContain('```mermaid');
      expect(prompt).toContain('#ffffff');
    });
  });

  describe('PromptGeneratorModalComponent (Интерактивное модальное окно)', () => {
    it('должен корректно инициализироваться и переключать стек движков', async () => {
      const { PromptGeneratorModalComponent } = await import(
        '../web/src/components/PromptGeneratorModal.js'
      );
      const modal = new PromptGeneratorModalComponent();

      modal.open(sampleVerdict);
      expect(modal.getContext().archetype).toBe('SIMULATION_INCREMENTAL');
      expect(modal.getCompiledPrompt()).toContain('Симуляторы');

      modal.setEngine('godot_4');
      expect(modal.getContext().targetEngine).toBe('godot_4');
      expect(modal.getCompiledPrompt()).toContain('Godot 4');

      modal.setEngine('roblox_studio');
      expect(modal.getContext().targetEngine).toBe('roblox_studio');
      expect(modal.getContext().targetStore).toBe('roblox');
      expect(modal.getCompiledPrompt()).toContain('Roblox');

      modal.setAiAssistant('claude');
      expect(modal.getContext().aiAssistant).toBe('claude');
      expect(modal.getCompiledPrompt()).toContain('Claude');

      let closed = false;
      const modalWithClose = new PromptGeneratorModalComponent({
        onClose: () => {
          closed = true;
        },
      });
      modalWithClose.close();
      expect(closed).toBe(true);
    });
  });
});
