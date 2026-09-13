import { MarketSnapshot, MarketVerdict } from '../types/index.js';
import { ArbitrageAnalyzer } from '../analyzer/arbitrage.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class SnapshotStore {
  private baseDir: string;
  private snapshotsDir: string;
  private reportsDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.cwd();
    this.snapshotsDir = path.join(this.baseDir, 'data', 'snapshots');
    this.reportsDir = path.join(this.baseDir, 'data', 'reports');

    fs.mkdirSync(this.snapshotsDir, { recursive: true });
    fs.mkdirSync(this.reportsDir, { recursive: true });
  }

  saveSnapshot(snapshot: MarketSnapshot): string {
    const dateStr = snapshot.timestamp.split('T')[0];
    const filePath = path.join(this.snapshotsDir, `snapshot-${dateStr}.json`);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    return filePath;
  }

  getLatestSnapshot(): MarketSnapshot | null {
    if (!fs.existsSync(this.snapshotsDir)) return null;
    const files = fs
      .readdirSync(this.snapshotsDir)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) return null;
    const raw = fs.readFileSync(path.join(this.snapshotsDir, files[0]), 'utf-8');
    return JSON.parse(raw) as MarketSnapshot;
  }

  generateMarkdownReport(snapshot: MarketSnapshot): string {
    const dateStr = snapshot.timestamp.split('T')[0];
    const greenLights = snapshot.verdicts.filter(v => v.status === 'GREEN_LIGHT');
    const yellowLights = snapshot.verdicts.filter(v => v.status === 'YELLOW_LIGHT');
    const redLights = snapshot.verdicts.filter(v => v.status === 'RED_LIGHT');

    let md = `# Отчет радара игровых трендов: ${dateStr}\n\n`;
    md += `> [!info] Сводка сканирования\n`;
    md += `> - **Всего игр проанализировано:** ${snapshot.totalGamesScanned}\n`;
    md += `> - **Roblox активный онлайн (CCU в выборке):** ${snapshot.robloxTotalCCU.toLocaleString()} игроков\n`;
    md += `> - **Платформы:** Roblox (${snapshot.platformCounts.roblox || 0}), Яндекс Игры (${snapshot.platformCounts.yandex_games || 0}), Poki (${snapshot.platformCounts.poki || 0}), YouTube Shorts (${snapshot.platformCounts.youtube_trends || 0})\n\n`;
    md += `---\n\n`;

    // Секция арбитражных ниш (Roblox -> Яндекс Игры)
    if (snapshot.arbitrageOpportunities && snapshot.arbitrageOpportunities.length > 0) {
      const arbitrageAnalyzer = new ArbitrageAnalyzer();
      md += arbitrageAnalyzer.generateMarkdownSection(snapshot.arbitrageOpportunities);
      md += `---\n\n`;
    }

    md += `## 1. Топ рекомендаций для разработчика: Что делать прямо сейчас\n\n`;
    for (const v of greenLights) {
      const badgeArbitrage = v.hasArbitrageOpportunity ? ' [ARBITRAGE OPPORTUNITY]' : '';
      md += `### 🟢 ${v.titleRu}${badgeArbitrage} (Opportunity Score: ${v.opportunityScore.overallScore}/100)\n\n`;
      md += `- **Доля аудитории:** ~${v.marketSharePercent}% (онлайн: ${v.totalAudienceCCU.toLocaleString()})\n`;
      md += `- **Хиты сегмента:** ${v.sampleTitles.slice(0, 4).join(', ')}\n`;
      md += `- **Действие:** ${v.actionRecommendation}\n`;
      md += `- **Кор-луп:** \`${v.coreLoopBlueprint}\`\n`;
      md += `- **Монетизация:** ${v.monetizationStrategy}\n`;
      md += `- **Подводный камень:** ${v.avoidPitfalls}\n\n`;
    }

    md += `---\n\n`;
    md += `## 2. Нишевые форматы: Требуется сильный USP\n\n`;
    for (const v of yellowLights) {
      const badgeArbitrage = v.hasArbitrageOpportunity ? ' [ARBITRAGE OPPORTUNITY]' : '';
      md += `### 🟡 ${v.titleRu}${badgeArbitrage} (Score: ${v.opportunityScore.overallScore}/100)\n\n`;
      md += `- **Хиты:** ${v.sampleTitles.slice(0, 3).join(', ')}\n`;
      md += `- **Вердикт:** ${v.actionRecommendation}\n`;
      md += `- **Ловушка:** ${v.avoidPitfalls}\n\n`;
    }

    md += `---\n\n`;
    md += `## 3. Красная зона: Чего делать НЕ СТОИТ (Красный океан)\n\n`;
    for (const v of redLights) {
      md += `### 🔴 ${v.titleRu} (Score: ${v.opportunityScore.overallScore}/100)\n\n`;
      md += `- **Причина отказа:** ${v.actionRecommendation}\n`;
      md += `- **Риск:** ${v.avoidPitfalls}\n\n`;
    }

    md += `---\n\n`;
    md += `## 4. Сводная матрица скоринга по жанрам\n\n`;
    md += `| Жанр / Архетип | Статус | Score | Спрос | Динамика | Shorts Boost | Арбитраж | Насыщенность | Сложность |\n`;
    md += `|---|---|---|---|---|---|---|---|---|\n`;

    for (const v of snapshot.verdicts) {
      const statusIcon = v.status === 'GREEN_LIGHT' ? '🟢 Зеленый' : v.status === 'YELLOW_LIGHT' ? '🟡 Желтый' : '🔴 Красный';
      const multiplierStr = v.opportunityScore.viralMultiplier ? `${v.opportunityScore.viralMultiplier}x` : '1.0x';
      const arbitrageBadge = v.hasArbitrageOpportunity ? '🚀 [ARBITRAGE OPPORTUNITY]' : '—';
      md += `| ${v.titleRu} | ${statusIcon} | **${v.opportunityScore.overallScore}** | ${v.opportunityScore.demandScore} | ${v.opportunityScore.velocityScore} | ${multiplierStr} | ${arbitrageBadge} | ${v.opportunityScore.saturationIndex} | ${v.opportunityScore.productionEffort} |\n`;
    }

    const reportPath = path.join(this.reportsDir, `market_report_${dateStr}.md`);
    fs.writeFileSync(reportPath, md, 'utf-8');
    return reportPath;
  }
}
