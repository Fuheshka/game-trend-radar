import { MarketSnapshot, MarketVerdict, SnapshotSummary } from '../types/index.js';
import { ArbitrageAnalyzer } from '../analyzer/arbitrage.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface HistoryPoint {
  t: string;
  totalGames: number;
  robloxCCU: number;
  platformCounts: MarketSnapshot['platformCounts'];
  verdicts: Array<{ archetype: string; score: number; ccu: number }>;
}

const HISTORY_RETENTION_DAYS = 14;

export class SnapshotStore {
  private historyDir: string;
  private summaryCache = new Map<string, { mtimeMs: number; size: number; summary: SnapshotSummary }>();
  private baseDir: string;
  private snapshotsDir: string;
  private reportsDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.cwd();
    this.snapshotsDir = path.join(this.baseDir, 'data', 'snapshots');
    this.reportsDir = path.join(this.baseDir, 'data', 'reports');
    this.historyDir = path.join(this.baseDir, 'data', 'history');

    fs.mkdirSync(this.snapshotsDir, { recursive: true });
    fs.mkdirSync(this.reportsDir, { recursive: true });
  }

  saveSnapshot(snapshot: MarketSnapshot): string {
    const dateStr = snapshot.timestamp.split('T')[0];
    const filePath = path.join(this.snapshotsDir, `snapshot-${dateStr}.json`);
    // Атомарная запись: падение посреди записи не оставит битый JSON вместо хорошего снимка.
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
    try {
      this.appendHistory(snapshot);
    } catch {
      // История — вспомогательная; её сбой не должен ронять сохранение снимка
    }
    return filePath;
  }

  /** Лёгкая внутридневная точка (≈1 КБ) для графиков динамики; снимки по дням остаются как были. */
  appendHistory(snapshot: MarketSnapshot): void {
    fs.mkdirSync(this.historyDir, { recursive: true });
    const point: HistoryPoint = {
      t: snapshot.timestamp,
      totalGames: snapshot.totalGamesScanned,
      robloxCCU: snapshot.robloxTotalCCU,
      platformCounts: snapshot.platformCounts,
      verdicts: snapshot.verdicts.map(v => ({
        archetype: v.archetype,
        score: v.opportunityScore.overallScore,
        ccu: v.totalAudienceCCU,
      })),
    };
    const day = snapshot.timestamp.split('T')[0];
    fs.appendFileSync(path.join(this.historyDir, `${day}.jsonl`), JSON.stringify(point) + '\n', 'utf-8');

    const files = fs.readdirSync(this.historyDir).filter(f => f.endsWith('.jsonl')).sort();
    for (const old of files.slice(0, Math.max(0, files.length - HISTORY_RETENTION_DAYS))) {
      fs.rmSync(path.join(this.historyDir, old), { force: true });
    }
  }

  getHistory(hours = 24): HistoryPoint[] {
    if (!fs.existsSync(this.historyDir)) return [];
    const since = Date.now() - hours * 3600_000;
    const sinceDay = new Date(since).toISOString().split('T')[0];
    const points: HistoryPoint[] = [];
    for (const file of fs.readdirSync(this.historyDir).filter(f => f.endsWith('.jsonl')).sort()) {
      if (file.slice(0, 10) < sinceDay) continue;
      for (const line of fs.readFileSync(path.join(this.historyDir, file), 'utf-8').split('\n')) {
        if (!line) continue;
        try {
          const point = JSON.parse(line) as HistoryPoint;
          if (Date.parse(point.t) >= since) points.push(point);
        } catch {
          // пропускаем битую строку
        }
      }
    }
    return points;
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

  listSnapshots(): SnapshotSummary[] {
    if (!fs.existsSync(this.snapshotsDir)) return [];
    const files = fs
      .readdirSync(this.snapshotsDir)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();

    const summaries: SnapshotSummary[] = [];
    for (const file of files) {
      try {
        const full = path.join(this.snapshotsDir, file);
        const st = fs.statSync(full);
        const cached = this.summaryCache.get(file);
        if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
          summaries.push(cached.summary);
          continue;
        }
        const raw = fs.readFileSync(full, 'utf-8');
        const parsed = JSON.parse(raw) as MarketSnapshot;
        const dateMatch = file.match(/snapshot-(\d{4}-\d{2}-\d{2})\.json/);
        const date = dateMatch ? dateMatch[1] : (parsed.timestamp ? parsed.timestamp.split('T')[0] : file);
        const summary: SnapshotSummary = {
          id: parsed.id || file.replace(/\.json$/, ''),
          timestamp: parsed.timestamp || '',
          date,
          totalGamesScanned: parsed.totalGamesScanned ?? (parsed.games?.length || 0),
          robloxTotalCCU: parsed.robloxTotalCCU,
          filename: file,
        };
        this.summaryCache.set(file, { mtimeMs: st.mtimeMs, size: st.size, summary });
        summaries.push(summary);
      } catch {
        // Skip corrupted or unreadable files
      }
    }
    return summaries;
  }

  getSnapshotById(idOrDate: string): MarketSnapshot | null {
    if (!idOrDate || !fs.existsSync(this.snapshotsDir)) return null;

    if (idOrDate === 'latest') {
      return this.getLatestSnapshot();
    }

    // Direct filename checks
    const possibleFiles = [
      idOrDate.endsWith('.json') ? idOrDate : `${idOrDate}.json`,
      `snapshot-${idOrDate}.json`,
      idOrDate,
    ];

    for (const candidate of possibleFiles) {
      const p = path.join(this.snapshotsDir, candidate);
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        try {
          return JSON.parse(fs.readFileSync(p, 'utf-8')) as MarketSnapshot;
        } catch {
          return null;
        }
      }
    }

    // Search by snapshot.id or timestamp date prefix
    const files = fs
      .readdirSync(this.snapshotsDir)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(this.snapshotsDir, file), 'utf-8');
        const parsed = JSON.parse(raw) as MarketSnapshot;
        if (parsed.id === idOrDate) {
          return parsed;
        }
        if (parsed.timestamp && parsed.timestamp.startsWith(idOrDate)) {
          return parsed;
        }
      } catch {
        // Continue to next file
      }
    }

    return null;
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
