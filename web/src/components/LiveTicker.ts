import { MarketSnapshot, PlatformType, GameArchetype, NormalizedGame, ArbitrageOpportunity, MarketVerdict } from '../types.js';

export type SignalIconType = 'flame' | 'zap' | 'trending-up' | 'globe' | 'gamepad' | 'check-circle';

export interface TickerSignal {
  id: string;
  type: 'online' | 'arbitrage' | 'shorts' | 'verdict' | 'web';
  platform: PlatformType;
  icon: SignalIconType;
  emoji?: string;
  title: string;
  statusText: string;
  rawMetricValue: number;
  badgeClass: string;
  searchFilter: string;
  archetype?: GameArchetype;
  details: {
    categoryRu: string;
    metricLabel: string;
    metricValue: string;
    description: string;
    tags?: string[];
    actionRu?: string;
    externalUrl?: string;
  };
}

export interface LiveTickerOptions {
  container: HTMLElement;
  snapshot: MarketSnapshot;
  onSelectSignal: (signal: TickerSignal) => void;
}

export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) {
    const val = (n / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `${val}M`;
  }
  if (n >= 1_000) {
    const val = (n / 1_000).toFixed(1).replace(/\.0$/, '');
    return `${val}k`;
  }
  return Math.round(n).toString();
}

export function extractTickerSignals(snapshot: MarketSnapshot): TickerSignal[] {
  const signals: TickerSignal[] = [];
  const games = snapshot.games || [];
  const opps = snapshot.opportunities || (snapshot as any).arbitrageOpportunities || [];
  const verdicts = snapshot.verdicts || [];

  // 1. Roblox Top Online Games
  const robloxGames = games
    .filter(g => g.platform === 'roblox')
    .sort((a, b) => b.metricValue - a.metricValue)
    .slice(0, 4);

  for (const game of robloxGames) {
    const cleanTitle = game.title.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]/gu, '').trim() || game.title;
    signals.push({
      id: `signal-online-${game.id}`,
      type: 'online',
      platform: 'roblox',
      icon: 'flame',
      emoji: '',
      title: cleanTitle,
      statusText: `${cleanTitle}: ${formatCompactNumber(game.metricValue)} CCU`,
      rawMetricValue: game.metricValue,
      badgeClass: 'badge-roblox',
      searchFilter: cleanTitle,
      archetype: game.archetype,
      details: {
        categoryRu: 'Топ по онлайну Roblox',
        metricLabel: 'Пиковый онлайн (CCU)',
        metricValue: `${game.metricValue.toLocaleString('ru-RU')} игроков прямо сейчас`,
        description: `Игра удерживает флагманские позиции в глобальных чартах Roblox с мощным органическим притоком игроков.`,
        tags: game.tags,
        actionRu: 'Изучить жанровый архетип и механику удержания',
        externalUrl: game.url,
      },
    });
  }

  // 2. Arbitrage Opportunities (Арбитражные находки)
  if (opps.length > 0) {
    for (const opp of opps.slice(0, 4)) {
      const titleRaw = opp.robloxGame?.title || 'Хит без аналогов';
      const cleanTitle = titleRaw.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]/gu, '').trim();
      const titleDisplay = cleanTitle.includes('Brookhaven') ? 'Brookhaven RP' : cleanTitle;

      signals.push({
        id: `signal-arb-${opp.robloxGame?.id || opp.archetype}`,
        type: 'arbitrage',
        platform: 'yandex_games',
        icon: 'zap',
        emoji: '',
        title: `Арбитраж: ${titleDisplay}`,
        statusText: `Арбитраж: ${titleDisplay} (0 клонов в РФ)`,
        rawMetricValue: opp.robloxCCU || 100000,
        badgeClass: 'badge-arbitrage',
        searchFilter: titleDisplay,
        archetype: opp.archetype,
        details: {
          categoryRu: 'Арбитражная возможность (Россия / СНГ)',
          metricLabel: 'Органический потенциал',
          metricValue: `${opp.organicPotential?.replace(/_/g, ' ') || 'HIGH'} · ${formatCompactNumber(opp.robloxCCU || 0)} CCU в Roblox`,
          description: opp.nicheDescription || 'Высокий поисковый спрос в Roblox при отсутствии качественных аналогов в Яндекс Играх.',
          tags: opp.nicheKeywords || ['арбитраж', 'ниша'],
          actionRu: opp.adaptationStrategy || 'Быстрый выпуск адаптированного клона для веба',
          externalUrl: opp.robloxGame?.url,
        },
      });
    }
  } else {
    // Fallback: arbitrage from verdicts
    const arbVerdicts = verdicts.filter(v => v.hasArbitrageOpportunity).slice(0, 2);
    for (const v of arbVerdicts) {
      signals.push({
        id: `signal-arb-${v.archetype}`,
        type: 'arbitrage',
        platform: 'yandex_games',
        icon: 'zap',
        emoji: '',
        title: `Арбитраж: ${v.titleRu}`,
        statusText: `Арбитраж: ${v.titleRu} (0 клонов в РФ)`,
        rawMetricValue: v.opportunityScore.overallScore,
        badgeClass: 'badge-arbitrage',
        searchFilter: v.titleRu,
        archetype: v.archetype,
        details: {
          categoryRu: 'Арбитражная жанровая ниша',
          metricLabel: 'Opportunity Score',
          metricValue: `${v.opportunityScore.overallScore}/100 pts`,
          description: v.actionRecommendation,
          tags: v.sampleTitles,
          actionRu: v.coreLoopBlueprint,
        },
      });
    }
  }

  // 3. YouTube Shorts Memes & Viral Trends
  const ytGames = games.filter(g => g.platform === 'youtube_trends');
  if (ytGames.length > 0) {
    for (const yt of ytGames.slice(0, 3)) {
      let displayTitle = yt.title;
      if (displayTitle.includes('/')) {
        const parts = displayTitle.split('/').map(p => p.trim());
        displayTitle = parts.find(p => p.toLowerCase().includes('run') || p.toLowerCase().includes('catch')) || parts[0];
      }
      signals.push({
        id: `signal-yt-${yt.id}`,
        type: 'shorts',
        platform: 'youtube_trends',
        icon: 'trending-up',
        emoji: '',
        title: `Shorts: ${displayTitle}`,
        statusText: `Shorts: ${displayTitle} ${yt.metricValue} pts`,
        rawMetricValue: yt.metricValue,
        badgeClass: 'badge-shorts',
        searchFilter: displayTitle,
        archetype: yt.archetype,
        details: {
          categoryRu: 'Вирусный тренд YouTube Shorts',
          metricLabel: 'Индекс виральности',
          metricValue: `${yt.metricValue}/100 pts вирусной динамики`,
          description: `Вирусная механика и мем с взрывным ростом охватов среди коротких видеороликов.`,
          tags: yt.tags,
          actionRu: 'Интегрировать узнаваемые визуальные триггеры в первые 3 секунды геймплея',
          externalUrl: yt.url,
        },
      });
    }
  } else {
    // Fallback: viral verdicts
    const viralVerdicts = verdicts
      .filter(v => (v.opportunityScore.viralMultiplier || 1) >= 1.4)
      .slice(0, 2);
    for (const v of viralVerdicts) {
      const sample = v.sampleTitles[0] || v.titleRu;
      signals.push({
        id: `signal-yt-${v.archetype}`,
        type: 'shorts',
        platform: 'youtube_trends',
        icon: 'trending-up',
        emoji: '',
        title: `Shorts: ${sample}`,
        statusText: `Shorts: ${sample} 98 pts`,
        rawMetricValue: 98,
        badgeClass: 'badge-shorts',
        searchFilter: sample,
        archetype: v.archetype,
        details: {
          categoryRu: 'Вирусный тренд YouTube Shorts',
          metricLabel: 'Индекс виральности',
          metricValue: `98/100 pts · Множитель x${(v.opportunityScore.viralMultiplier || 1.5).toFixed(1)}`,
          description: `Механика имеет максимальный охват в Shorts и TikTok.`,
          tags: v.sampleTitles,
          actionRu: 'Использовать яркую физику и клиповый монтаж',
        },
      });
    }
  }

  // 4. Poki Web Hits
  const pokiGames = games.filter(g => g.platform === 'poki').slice(0, 2);
  for (const game of pokiGames) {
    signals.push({
      id: `signal-poki-${game.id}`,
      type: 'web',
      platform: 'poki',
      icon: 'globe',
      emoji: '',
      title: game.title,
      statusText: `${game.title}: Топ-1 Poki Web`,
      rawMetricValue: game.metricValue || 1,
      badgeClass: 'badge-poki',
      searchFilter: game.title,
      archetype: game.archetype,
      details: {
        categoryRu: 'Мировой веб-хит Poki',
        metricLabel: 'Позиция в глобальном чарте',
        metricValue: `Топ-1 в категории ${game.genre || 'Web Arcade'}`,
        description: 'Бенчмарк сессионного удержания в международных веб-порталах.',
        tags: game.tags,
        actionRu: 'Анализировать простоту управления в браузере (Touch & Keyboard)',
        externalUrl: game.url,
      },
    });
  }

  // 5. Yandex Games Top Hits
  const yandexGames = games.filter(g => g.platform === 'yandex_games').slice(0, 2);
  for (const game of yandexGames) {
    signals.push({
      id: `signal-ya-${game.id}`,
      type: 'web',
      platform: 'yandex_games',
      icon: 'gamepad',
      emoji: '',
      title: game.title,
      statusText: `${game.title}: Рейтинг ${game.metricValue}%`,
      rawMetricValue: game.metricValue || 90,
      badgeClass: 'badge-yandex',
      searchFilter: game.title,
      archetype: game.archetype,
      details: {
        categoryRu: 'Лидер каталога Яндекс Игры',
        metricLabel: 'Рейтинг качества',
        metricValue: `${game.metricValue}% положительных отзывов`,
        description: 'Высокая конверсия в рекламу и лояльная русскоязычная аудитория.',
        tags: game.tags,
        actionRu: 'Использовать готовую механику с локализованным сеттингом',
        externalUrl: game.url,
      },
    });
  }

  // 6. Top Green Light Verdicts
  const topGreenVerdicts = verdicts.filter(v => v.status === 'GREEN_LIGHT').slice(0, 2);
  for (const v of topGreenVerdicts) {
    signals.push({
      id: `signal-verdict-${v.archetype}`,
      type: 'verdict',
      platform: 'roblox',
      icon: 'check-circle',
      emoji: '',
      title: v.titleRu,
      statusText: `${v.titleRu}: ${v.opportunityScore.overallScore} pts (Green Light)`,
      rawMetricValue: v.opportunityScore.overallScore,
      badgeClass: 'badge-green',
      searchFilter: v.titleRu,
      archetype: v.archetype,
      details: {
        categoryRu: 'Рекомендованный архетип разработки',
        metricLabel: 'Opportunity Score',
        metricValue: `${v.opportunityScore.overallScore}/100 pts`,
        description: v.actionRecommendation,
        tags: v.sampleTitles,
        actionRu: v.coreLoopBlueprint,
      },
    });
  }

  return signals;
}

export class LiveTickerComponent {
  private container: HTMLElement;
  private snapshot: MarketSnapshot;
  private onSelectSignal: (signal: TickerSignal) => void;
  private signals: TickerSignal[] = [];

  constructor(options: LiveTickerOptions) {
    this.container = options.container;
    this.snapshot = options.snapshot;
    this.onSelectSignal = options.onSelectSignal;

    this.render();
  }

  public updateData(snapshot: MarketSnapshot): void {
    this.snapshot = snapshot;
    this.render();
  }

  public render(): void {
    this.signals = extractTickerSignals(this.snapshot);

    if (this.signals.length === 0) {
      this.container.innerHTML = `
        <div class="ticker-empty">
          <span>Сбор сигналов рынка...</span>
        </div>
      `;
      return;
    }

    this.container.innerHTML = '';

    // Create 2 identical groups for infinite seamless CSS scroll
    const group1 = this.createTickerGroup(this.signals, false);
    const group2 = this.createTickerGroup(this.signals, true);

    this.container.appendChild(group1);
    this.container.appendChild(group2);
  }

  private createTickerGroup(signals: TickerSignal[], isAriaHidden: boolean): HTMLElement {
    const group = document.createElement('div');
    group.className = 'ticker-group';
    if (isAriaHidden) {
      group.setAttribute('aria-hidden', 'true');
    }

    signals.forEach(sig => {
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = `ticker-item ${sig.badgeClass}`;
      itemBtn.setAttribute('data-signal-id', sig.id);
      itemBtn.setAttribute('title', `Подробнее о сигнале: ${sig.title}`);
      if (isAriaHidden) {
        itemBtn.setAttribute('tabindex', '-1');
      }

      itemBtn.innerHTML = `
        <span class="ticker-item-icon">${this.getSignalSvg(sig.icon)}</span>
        <span class="ticker-item-text">${this.escapeHtml(sig.statusText)}</span>
      `;

      itemBtn.addEventListener('click', e => {
        e.preventDefault();
        this.onSelectSignal(sig);
      });

      group.appendChild(itemBtn);
    });

    return group;
  }

  private getSignalSvg(icon: SignalIconType): string {
    switch (icon) {
      case 'flame':
        // Lucide flame
        return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`;
      case 'zap':
        // Lucide zap
        return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
      case 'trending-up':
        // Lucide trending-up
        return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
      case 'globe':
        // Lucide globe
        return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
      case 'gamepad':
        // Lucide gamepad-2
        return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="2"></rect></svg>`;
      case 'check-circle':
      default:
        // Lucide check-circle
        return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
