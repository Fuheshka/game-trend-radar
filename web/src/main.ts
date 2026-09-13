import { MarketSnapshot, MarketVerdict, GameArchetype, PlatformType } from './types.js';
import { FALLBACK_SNAPSHOT } from './fallbackData.js';
import { RadarChartComponent, ChartMode } from './components/RadarChart.js';
import { VerdictCardsComponent } from './components/VerdictCards.js';

class App {
  private snapshot: MarketSnapshot = FALLBACK_SNAPSHOT;
  private activePlatform: 'all' | PlatformType = 'all';
  private activeStatus: 'all' | 'GREEN_LIGHT' | 'YELLOW_LIGHT' | 'RED_LIGHT' | 'arbitrage' = 'all';
  private activeArchetype: GameArchetype | null = null;
  private searchQuery: string = '';
  private sortBy: 'score_desc' | 'score_asc' | 'ccu_desc' | 'velocity_desc' | 'title_asc' = 'score_desc';
  private isScanning: boolean = false;

  private radarChart!: RadarChartComponent;
  private verdictCards!: VerdictCardsComponent;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.initElements();
    this.initShortcuts();

    // Initial render with fallback data while fetching live snapshot
    this.setupComponents();
    this.updateGlobalMetrics();
    this.renderLegend();

    // Fetch live data from backend
    await this.fetchLatestSnapshot();
  }

  private initElements(): void {
    // Mode toggles for Radar Chart
    const toggleSpider = document.getElementById('toggle-spider');
    const togglePolar = document.getElementById('toggle-polar');

    toggleSpider?.addEventListener('click', () => {
      toggleSpider.classList.add('active');
      togglePolar?.classList.remove('active');
      this.radarChart.setMode('spider');
    });

    togglePolar?.addEventListener('click', () => {
      togglePolar.classList.add('active');
      toggleSpider?.classList.remove('active');
      this.radarChart.setMode('polar');
    });

    // Scan button
    const btnScan = document.getElementById('btn-live-scan');
    btnScan?.addEventListener('click', () => this.triggerLiveScan());

    // Search input
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', e => {
      this.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
      this.applyFiltersAndSort();
    });

    // Sort select
    const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;
    sortSelect?.addEventListener('change', e => {
      this.sortBy = (e.target as HTMLSelectElement).value as any;
      this.applyFiltersAndSort();
    });

    // Platform filter pills
    const platformPills = document.querySelectorAll<HTMLButtonElement>('[data-platform]');
    platformPills.forEach(pill => {
      pill.addEventListener('click', () => {
        platformPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activePlatform = pill.getAttribute('data-platform') as any;
        this.applyFiltersAndSort();
      });
    });

    // Status filter pills
    const statusPills = document.querySelectorAll<HTMLButtonElement>('[data-status]');
    statusPills.forEach(pill => {
      pill.addEventListener('click', () => {
        statusPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeStatus = pill.getAttribute('data-status') as any;
        this.applyFiltersAndSort();
      });
    });
  }

  private initShortcuts(): void {
    window.addEventListener('keydown', e => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        searchInput?.focus();
      }

      // Escape to reset filters
      if (e.key === 'Escape') {
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        this.activeArchetype = null;
        this.radarChart.updateData(this.getFilteredVerdicts(), null);
        this.applyFiltersAndSort();
        this.renderLegend();
      }
    });
  }

  private setupComponents(): void {
    const radarContainer = document.getElementById('radar-chart-container');
    const verdictsContainer = document.getElementById('verdicts-container');

    if (radarContainer) {
      this.radarChart = new RadarChartComponent({
        container: radarContainer,
        verdicts: this.snapshot.verdicts,
        activeArchetype: this.activeArchetype,
        onSelectArchetype: archetype => {
          this.activeArchetype = archetype;
          this.radarChart.updateData(this.getFilteredVerdicts(), this.activeArchetype);
          this.applyFiltersAndSort();
          this.renderLegend();
        },
      });
    }

    if (verdictsContainer) {
      this.verdictCards = new VerdictCardsComponent({
        container: verdictsContainer,
        verdicts: this.getFilteredVerdicts(),
        onSelectTag: tag => {
          const searchInput = document.getElementById('search-input') as HTMLInputElement;
          if (searchInput) {
            searchInput.value = tag;
            this.searchQuery = tag.toLowerCase();
            this.applyFiltersAndSort();
          }
        },
      });
    }
  }

  private async fetchLatestSnapshot(): Promise<void> {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('server-status-text');

    try {
      const res = await fetch('/api/snapshots/latest');
      if (res.ok) {
        const data: MarketSnapshot = await res.json();
        this.snapshot = data;
        statusDot?.classList.remove('offline');
        if (statusText) statusText.textContent = 'HTTP :4200 (Online)';
      } else {
        await this.tryStaticSnapshotFallback(statusDot, statusText);
      }
    } catch {
      await this.tryStaticSnapshotFallback(statusDot, statusText);
    }

    this.updateGlobalMetrics();
    this.renderLegend();
    this.radarChart?.updateData(this.snapshot.verdicts, this.activeArchetype);
    this.applyFiltersAndSort();
  }

  private async tryStaticSnapshotFallback(
    statusDot: HTMLElement | null,
    statusText: HTMLElement | null
  ): Promise<void> {
    try {
      const staticRes = await fetch('./data/latest_snapshot.json');
      if (staticRes.ok) {
        const staticData: MarketSnapshot = await staticRes.json();
        this.snapshot = staticData;
        statusDot?.classList.remove('offline');
        if (statusText) statusText.textContent = 'GitHub Pages (Статика)';
        return;
      }
    } catch {
      // Ignore static fetch errors and fallback to hardcoded snapshot
    }

    statusDot?.classList.add('offline');
    if (statusText) statusText.textContent = 'Демонстрационный режим';
  }

  private async triggerLiveScan(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    const overlay = document.getElementById('scan-overlay');
    const phaseText = document.getElementById('scan-phase-text');
    const progressInner = document.getElementById('scan-progress-inner');
    const btnScan = document.getElementById('btn-live-scan') as HTMLButtonElement;

    if (btnScan) btnScan.disabled = true;
    overlay?.classList.add('active');

    const phases = [
      { text: '📡 Опрос Roblox Explore API (CCU, лайки и ранги)...', pct: 20 },
      { text: '🎮 Парсинг каталога и промо-блоков Яндекс Игр...', pct: 45 },
      { text: '🌍 Сбор чартов Poki Web Top-100...', pct: 65 },
      { text: '🔥 Детекция вирусных мемов в YouTube Shorts...', pct: 85 },
      { text: '⚙️ Расчет Opportunity Score и арбитражных ниш...', pct: 95 },
    ];

    let currentPhase = 0;
    const interval = setInterval(() => {
      if (currentPhase < phases.length) {
        if (phaseText) phaseText.textContent = phases[currentPhase].text;
        if (progressInner) progressInner.style.width = `${phases[currentPhase].pct}%`;
        currentPhase++;
      }
    }, 1200);

    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      clearInterval(interval);

      if (res.ok) {
        const newSnapshot: MarketSnapshot = await res.json();
        this.snapshot = newSnapshot;
        if (progressInner) progressInner.style.width = '100%';
        if (phaseText) phaseText.textContent = '✅ Сканирование успешно завершено!';
        this.showToast('Сканирование завершено! Снимок обновлен.');
      } else {
        if (phaseText) phaseText.textContent = '⚠️ Сервер вернул ошибку, обновляем данные из кэша.';
        this.showToast('Ошибка внешних API, использован локальный кэш.');
      }
    } catch {
      clearInterval(interval);
      if (progressInner) progressInner.style.width = '100%';
      if (phaseText) phaseText.textContent = 'ℹ️ Сервер недоступен, режим эмуляции завершен.';
      this.showToast('Сервер оффлайн — отображены кэшированные данные.');
    } finally {
      setTimeout(() => {
        overlay?.classList.remove('active');
        if (progressInner) progressInner.style.width = '0%';
        if (btnScan) btnScan.disabled = false;
        this.isScanning = false;

        this.updateGlobalMetrics();
        this.renderLegend();
        this.radarChart?.updateData(this.snapshot.verdicts, this.activeArchetype);
        this.applyFiltersAndSort();
      }, 700);
    }
  }

  private updateGlobalMetrics(): void {
    const totalGamesEl = document.getElementById('metric-total-games');
    const totalCcuEl = document.getElementById('metric-total-ccu');
    const topScoreEl = document.getElementById('metric-top-score');
    const topGenreEl = document.getElementById('metric-top-genre');
    const arbitrageCountEl = document.getElementById('metric-arbitrage-count');
    const platformsHintEl = document.getElementById('metric-platforms-hint');

    const counts = this.snapshot.platformCounts;
    const totalGames = this.snapshot.totalGamesScanned || 0;
    const totalCCU = this.snapshot.robloxTotalCCU || 0;

    if (totalGamesEl) totalGamesEl.textContent = totalGames.toLocaleString();
    if (totalCcuEl) totalCcuEl.textContent = this.formatNumber(totalCCU);

    if (platformsHintEl) {
      platformsHintEl.textContent = `Roblox: ${counts.roblox || 0} · Yandex: ${counts.yandex_games || 0} · Poki: ${counts.poki || 0}`;
    }

    const sortedVerdicts = [...(this.snapshot.verdicts || [])].sort(
      (a, b) => b.opportunityScore.overallScore - a.opportunityScore.overallScore
    );

    if (sortedVerdicts.length > 0) {
      const top = sortedVerdicts[0];
      if (topScoreEl) topScoreEl.textContent = `${top.opportunityScore.overallScore}/100`;
      if (topGenreEl) topGenreEl.textContent = top.titleRu;
    }

    const arbitrageCount =
      this.snapshot.arbitrageOpportunities?.length ??
      this.snapshot.verdicts.filter(v => v.hasArbitrageOpportunity).length;

    if (arbitrageCountEl) arbitrageCountEl.textContent = String(arbitrageCount);
  }

  private renderLegend(): void {
    const legendContainer = document.getElementById('radar-legend-container');
    if (!legendContainer) return;

    legendContainer.innerHTML = '';

    this.snapshot.verdicts.forEach(v => {
      const item = document.createElement('div');
      item.className = 'legend-item' + (this.activeArchetype === v.archetype ? ' active' : '');

      const color =
        v.status === 'GREEN_LIGHT'
          ? '#10b981'
          : v.status === 'YELLOW_LIGHT'
          ? '#f59e0b'
          : '#ef4444';

      item.innerHTML = `
        <div class="legend-left">
          <span class="legend-marker" style="background: ${color}; box-shadow: 0 0 8px ${color};"></span>
          <span class="legend-name">${v.titleRu}</span>
        </div>
        <span class="legend-score" style="color: ${color};">${v.opportunityScore.overallScore} pts</span>
      `;

      item.addEventListener('click', () => {
        this.activeArchetype = this.activeArchetype === v.archetype ? null : v.archetype;
        this.radarChart.updateData(this.getFilteredVerdicts(), this.activeArchetype);
        this.applyFiltersAndSort();
        this.renderLegend();
      });

      legendContainer.appendChild(item);
    });
  }

  private getFilteredVerdicts(): MarketVerdict[] {
    return (this.snapshot.verdicts || []).filter(v => {
      // 1. Archetype selection filter
      if (this.activeArchetype && v.archetype !== this.activeArchetype) {
        return false;
      }

      // 2. Status filter
      if (this.activeStatus !== 'all') {
        if (this.activeStatus === 'arbitrage') {
          if (!v.hasArbitrageOpportunity) return false;
        } else if (v.status !== this.activeStatus) {
          return false;
        }
      }

      // 3. Platform filter: check if verdict has games matching platform
      if (this.activePlatform !== 'all') {
        const platformGames = (this.snapshot.games || []).filter(
          g => g.platform === this.activePlatform && g.archetype === v.archetype
        );
        // Also allow if verdict sampleTitles has matches or if platform counts match
        if (platformGames.length === 0 && this.activePlatform !== 'roblox') {
          // Allow fallback pass if it matches archetype
          const hasSamples = v.sampleTitles.some(t => t.length > 0);
          if (!hasSamples) return false;
        }
      }

      // 4. Search query
      if (this.searchQuery) {
        const q = this.searchQuery;
        const inTitle = v.titleRu.toLowerCase().includes(q);
        const inArchetype = v.archetype.toLowerCase().includes(q);
        const inSamples = v.sampleTitles.some(s => s.toLowerCase().includes(q));
        const inRec = v.actionRecommendation.toLowerCase().includes(q);
        const inLoop = v.coreLoopBlueprint.toLowerCase().includes(q);
        const inAvoid = v.avoidPitfalls.toLowerCase().includes(q);

        if (!inTitle && !inArchetype && !inSamples && !inRec && !inLoop && !inAvoid) {
          return false;
        }
      }

      return true;
    });
  }

  private applyFiltersAndSort(): void {
    const filtered = this.getFilteredVerdicts();

    // Sort filtered verdicts
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'score_desc':
          return b.opportunityScore.overallScore - a.opportunityScore.overallScore;
        case 'score_asc':
          return a.opportunityScore.overallScore - b.opportunityScore.overallScore;
        case 'ccu_desc':
          return b.totalAudienceCCU - a.totalAudienceCCU;
        case 'velocity_desc':
          return b.opportunityScore.velocityScore - a.opportunityScore.velocityScore;
        case 'title_asc':
          return a.titleRu.localeCompare(b.titleRu, 'ru');
        default:
          return 0;
      }
    });

    const countText = document.getElementById('verdicts-count-text');
    if (countText) {
      countText.textContent = `Отображается ${filtered.length} из ${this.snapshot.verdicts?.length || 0}`;
    }

    this.verdictCards?.updateData(filtered);
  }

  private showToast(message: string): void {
    const toast = document.getElementById('toast-notification');
    const toastText = document.getElementById('toast-text');
    if (!toast || !toastText) return;

    toastText.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return n.toLocaleString();
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
