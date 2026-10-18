import type { PromptContext } from './types.js';
import { getEngineMeta } from './engineMeta.js';
import { getArchetypeBlueprint } from './archetypeBlueprints.js';
import { getStoreMeta, formatAiInstructions } from './platformMeta.js';

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
