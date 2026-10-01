/**
 * Сервис экспорта аналитического среза рынка в Markdown и JSON.
 * Работает полностью на стороне клиента через Blob URL без обращений к бэкенду.
 * 
 * Автор: Даниил К. (Fuheshka)
 */

import { MarketSnapshot, MarketVerdict, ArbitrageOpportunity } from '../types.js';

/**
 * Генерирует имя файла экспорта на основе даты снимка.
 */
export function generateExportFilename(snapshot: MarketSnapshot, ext: 'md' | 'json'): string {
  let dateStr = '';
  if (snapshot.timestamp) {
    dateStr = snapshot.timestamp.split('T')[0];
  }
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    dateStr = new Date().toISOString().split('T')[0];
  }

  const prefix = ext === 'md' ? 'game-trend-radar-report' : 'game-trend-radar-snapshot';
  return `${prefix}-${dateStr}.${ext}`;
}

/**
 * Инициирует скачивание текстового контента через Blob URL.
 */
export function downloadBlob(
  content: string,
  filename: string,
  mimeType: string = 'text/plain;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Экспортирует снимок рынка в валидный форматированный JSON.
 */
export function exportSnapshotToJson(snapshot: MarketSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

/**
 * Формирует чистый Markdown-отчет со всеми ключевыми срезами аналитики.
 * Формат оптимизирован для импорта в Obsidian, Notion или GitHub.
 */
export function exportSnapshotToMarkdown(snapshot: MarketSnapshot): string {
  let dateStr = '';
  if (snapshot.timestamp) {
    dateStr = snapshot.timestamp.split('T')[0];
  }
  if (!dateStr) {
    dateStr = new Date().toISOString().split('T')[0];
  }

  const totalGames = snapshot.totalGamesScanned ?? 0;
  const robloxCcu = (snapshot.robloxTotalCCU ?? 0).toLocaleString();
  const counts = snapshot.platformCounts || {
    roblox: 0,
    yandex_games: 0,
    poki: 0,
    youtube_trends: 0,
  };

  const verdicts = snapshot.verdicts || [];
  const arbitrage = snapshot.arbitrageOpportunities || [];

  const greenLights = verdicts.filter(v => v.status === 'GREEN_LIGHT');
  const yellowLights = verdicts.filter(v => v.status === 'YELLOW_LIGHT');
  const redLights = verdicts.filter(v => v.status === 'RED_LIGHT');

  let md = `# Отчет радара игровых трендов: ${dateStr}\n\n`;

  // 1. Сводка сканирования
  md += `> [!info] Сводка сканирования рынка\n`;
  md += `> - **Всего игр проанализировано:** ${totalGames}\n`;
  md += `> - **Roblox активный онлайн (CCU в выборке):** ${robloxCcu} игроков\n`;
  md += `> - **Охват платформ:** Roblox (${counts.roblox || 0}), Яндекс Игры (${counts.yandex_games || 0}), Poki (${counts.poki || 0}), YouTube Shorts (${counts.youtube_trends || 0})\n`;
  md += `> - **Дата среза:** ${dateStr}\n\n`;
  md += `---\n\n`;

  // 2. Таблица арбитражных связок
  md += `## Таблица арбитражных связок (Roblox -> Яндекс Игры)\n\n`;
  if (arbitrage.length === 0) {
    md += `> Прямых арбитражных связок в текущем аналитическом срезе не зафиксировано.\n\n`;
  } else {
    md += `> [!tip] Арбитражный потенциал первого хода\n`;
    md += `> Хиты из Roblox с подтвержденным спросом без прямых качественных аналогов на веб-витринах.\n\n`;
    md += `| Донор (Roblox) | Спрос (CCU) | Архетип | Ближайший аналог | Сходство | Потенциал | Рекомендуемое название (RU) |\n`;
    md += `|---|---|---|---|---|---|---|\n`;

    for (const opp of arbitrage) {
      const donorTitle = opp.robloxGame?.title || 'Без названия';
      const ccuStr = (opp.robloxCCU || 0).toLocaleString();
      const archetypeRu = getArchetypeTitleRu(opp.archetype, verdicts);
      const analogTitle = opp.nearestAnalog?.title ? `«${opp.nearestAnalog.title}»` : 'Отсутствует';
      const simPercent = Math.round((opp.similarityWithNearestAnalog || 0) * 100);
      const potential = opp.organicPotential || 'HIGH';
      const suggestedRu = opp.suggestedRuTitle ? `**${opp.suggestedRuTitle}**` : '-';

      md += `| ${donorTitle} | ${ccuStr} | ${archetypeRu} | ${analogTitle} | ${simPercent}% | ${potential} | ${suggestedRu} |\n`;
    }
    md += `\n`;

    // Подробные карточки арбитражных возможностей
    md += `### Детальные рекомендации по арбитражу\n\n`;
    for (const opp of arbitrage) {
      const donorTitle = opp.robloxGame?.title || 'Без названия';
      const ccuStr = (opp.robloxCCU || 0).toLocaleString();
      const simPercent = Math.round((opp.similarityWithNearestAnalog || 0) * 100);
      const analogDesc = opp.nearestAnalog?.title
        ? `«${opp.nearestAnalog.title}» (схожесть ${simPercent}%)`
        : 'отсутствует';

      md += `#### 🚀 [${opp.badge || 'ARBITRAGE'}] ${donorTitle}\n`;
      md += `- **Roblox активный онлайн:** **${ccuStr} CCU** (подтвержденный спрос)\n`;
      md += `- **Ближайший аналог в Яндекс Играх:** ${analogDesc}\n`;
      md += `- **Потенциал первого хода:** \`${opp.organicPotential || 'HIGH'}\`\n`;
      if (opp.suggestedRuTitle) {
        md += `- **Рекомендуемое название для каталога:** **${opp.suggestedRuTitle}**\n`;
      }
      if (opp.adaptationStrategy) {
        md += `- **Рецепт адаптации под веб:** ${opp.adaptationStrategy}\n`;
      }
      if (opp.robloxGame?.url) {
        md += `- **Ссылка на оригинал:** [Перейти к игре](${opp.robloxGame.url})\n`;
      }
      md += `\n`;
    }
  }
  md += `---\n\n`;

  // 3. Топ вердиктов со скорингом
  md += `## Топ вердиктов и скоринг ниш\n\n`;

  if (greenLights.length > 0) {
    md += `### 1. Зеленая зона: Высокий потенциал для разработки\n\n`;
    for (const v of greenLights) {
      const badge = v.hasArbitrageOpportunity ? ' [ARBITRAGE OPPORTUNITY]' : '';
      const score = v.opportunityScore?.overallScore ?? 0;
      const ccu = (v.totalAudienceCCU ?? 0).toLocaleString();
      const share = v.marketSharePercent ?? 0;
      const hits = (v.sampleTitles || []).slice(0, 4).join(', ') || '-';

      md += `### 🟢 ${v.titleRu}${badge} (Opportunity Score: ${score}/100)\n\n`;
      md += `- **Доля аудитории:** ~${share}% (онлайн: ${ccu})\n`;
      md += `- **Хиты сегмента:** ${hits}\n`;
      md += `- **Действие:** ${v.actionRecommendation || '-'}\n`;
      md += `- **Кор-луп:** \`${v.coreLoopBlueprint || '-'}\`\n`;
      md += `- **Монетизация:** ${v.monetizationStrategy || '-'}\n`;
      md += `- **Подводный камень:** ${v.avoidPitfalls || '-'}\n\n`;
    }
  }

  if (yellowLights.length > 0) {
    md += `### 2. Желтая зона: Требуется сильное уникальное преимущество\n\n`;
    for (const v of yellowLights) {
      const badge = v.hasArbitrageOpportunity ? ' [ARBITRAGE OPPORTUNITY]' : '';
      const score = v.opportunityScore?.overallScore ?? 0;
      const hits = (v.sampleTitles || []).slice(0, 3).join(', ') || '-';

      md += `### 🟡 ${v.titleRu}${badge} (Score: ${score}/100)\n\n`;
      md += `- **Хиты:** ${hits}\n`;
      md += `- **Вердикт:** ${v.actionRecommendation || '-'}\n`;
      md += `- **Ловушка:** ${v.avoidPitfalls || '-'}\n\n`;
    }
  }

  if (redLights.length > 0) {
    md += `### 3. Красная зона: Высокая насыщенность (Красный океан)\n\n`;
    for (const v of redLights) {
      const score = v.opportunityScore?.overallScore ?? 0;
      md += `### 🔴 ${v.titleRu} (Score: ${score}/100)\n\n`;
      md += `- **Причина отказа:** ${v.actionRecommendation || '-'}\n`;
      md += `- **Риск:** ${v.avoidPitfalls || '-'}\n\n`;
    }
  }

  md += `---\n\n`;

  // 4. Сводная матрица скоринга по жанрам
  md += `## Сводная матрица скоринга по жанрам\n\n`;
  md += `| Жанр / Архетип | Статус | Score | Спрос | Динамика | Viral Boost | Арбитраж | Насыщенность | Сложность |\n`;
  md += `|---|---|---|---|---|---|---|---|---|\n`;

  for (const v of verdicts) {
    const statusText =
      v.status === 'GREEN_LIGHT'
        ? '🟢 Зеленый'
        : v.status === 'YELLOW_LIGHT'
          ? '🟡 Желтый'
          : '🔴 Красный';
    const score = v.opportunityScore?.overallScore ?? 0;
    const demand = v.opportunityScore?.demandScore ?? 0;
    const velocity = v.opportunityScore?.velocityScore ?? 0;
    const viral = v.opportunityScore?.viralMultiplier
      ? `${v.opportunityScore.viralMultiplier}x`
      : '1.0x';
    const arbitrage = v.hasArbitrageOpportunity ? '🚀 ARBITRAGE' : '-';
    const saturation = v.opportunityScore?.saturationIndex ?? 1;
    const effort = v.opportunityScore?.productionEffort ?? 1;

    md += `| ${v.titleRu} | ${statusText} | **${score}** | ${demand} | ${velocity} | ${viral} | ${arbitrage} | ${saturation} | ${effort} |\n`;
  }
  md += `\n`;

  // Футер с копирайтом
  md += `---\n`;
  md += `*Отчет подготовлен системой Game Trend Radar · Автор: Даниил К. (Fuheshka)*\n`;

  return md;
}

/**
 * Вспомогательная функция для получения человекочитаемого названия архетипа на русском.
 */
function getArchetypeTitleRu(archetype: string, verdicts: MarketVerdict[]): string {
  const match = verdicts.find(v => v.archetype === archetype);
  if (match) return match.titleRu;

  const names: Record<string, string> = {
    SIMULATION_INCREMENTAL: 'Симуляторы роста',
    PHYSICS_SANDBOX: 'Физика и разрушения',
    SURVIVAL_HORROR: 'Хоррор-выживание',
    TYCOON_MANAGEMENT: 'Тайкуны и менеджмент',
    OBBY_PLATFORMER: 'Обби и платформеры',
    ACTION_ROGUELIKE: 'Экшен-рогалики',
    TOWER_DEFENSE: 'Защита башен',
    PVP_ARENA_BRAWLER: 'PvP-арены и битвы',
    PUZZLE_LOGIC: 'Головоломки и логика',
    MEME_TREND: 'Мем-тренды',
  };
  return names[archetype] || archetype;
}
