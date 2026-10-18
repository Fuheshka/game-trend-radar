import { MarketVerdict, GameArchetype } from '../types.js';
import { startSweepAnimation, updateBlips } from './radarChart/sweep.js';
import { renderSpiderChart } from './radarChart/spiderChart.js';
import { renderPolarDonut } from './radarChart/polarDonut.js';
import { buildTooltipHtml } from './radarChart/tooltip.js';
import type {
  ChartMode,
  RadarChartOptions,
  RadarBlipItem,
  RadarRenderContext,
} from './radarChart/types.js';

export type { ChartMode, RadarChartOptions, RadarBlipItem };


export class RadarChartComponent {
  private container: HTMLElement;
  private verdicts: MarketVerdict[] = [];
  private activeArchetype: GameArchetype | null = null;
  private mode: ChartMode = 'spider';
  private onSelectArchetype: (archetype: GameArchetype | null) => void;
  private onHoverArchetype?: (archetype: GameArchetype | null) => void;
  private tooltipEl: HTMLElement | null = null;
  private animFrameId: number | null = null;
  private blips: RadarBlipItem[] = [];

  constructor(options: RadarChartOptions) {
    this.container = options.container;
    this.verdicts = options.verdicts;
    this.activeArchetype = options.activeArchetype;
    this.onSelectArchetype = options.onSelectArchetype;
    this.onHoverArchetype = options.onHoverArchetype;

    this.createTooltip();
    this.render();
  }

  public setMode(mode: ChartMode): void {
    this.mode = mode;
    this.render();
  }

  public updateData(verdicts: MarketVerdict[], activeArchetype: GameArchetype | null): void {
    this.verdicts = verdicts;
    this.activeArchetype = activeArchetype;
    this.render();
  }

  public destroy(): void {
    this.cleanup();
    if (this.tooltipEl && this.tooltipEl.parentNode) {
      this.tooltipEl.parentNode.removeChild(this.tooltipEl);
      this.tooltipEl = null;
    }
  }

  private cleanup(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.blips = [];
    this.hideTooltip();
  }

  private createTooltip(): void {
    const existing = document.getElementById('radar-tooltip');
    if (!existing) {
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.id = 'radar-tooltip';
      this.tooltipEl.className = 'chart-tooltip';
      if (document.body) {
        document.body.appendChild(this.tooltipEl);
      }
    } else {
      this.tooltipEl = existing;
    }
  }


  public render(): void {
    this.cleanup();
    this.container.innerHTML = '';

    if (!this.verdicts || this.verdicts.length === 0) {
      this.container.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 2rem;">
          Нет данных для построения диаграммы
        </div>
      `;
      return;
    }

    const ctx: RadarRenderContext = {
      container: this.container,
      verdicts: this.verdicts,
      blips: this.blips,
      getActiveArchetype: () => this.activeArchetype,
      onSelectArchetype: this.onSelectArchetype,
      onHoverArchetype: this.onHoverArchetype,
      showTooltip: (e, v, extra) => this.showTooltip(e, v, extra),
      moveTooltip: e => this.moveTooltip(e),
      hideTooltip: () => this.hideTooltip(),
      startSweepAnimation: (beamEl, cx, cy) => this.startSweepAnimation(beamEl, cx, cy),
    };

    if (this.mode === 'spider') {
      renderSpiderChart(ctx);
    } else {
      renderPolarDonut(ctx);
    }
  }

  /**
   * Запуск высокопроизводительного requestAnimationFrame цикла сканирования (60+ FPS)
   */
  private startSweepAnimation(beamEl: SVGElement, cx: number, cy: number): void {
    startSweepAnimation(
      beamEl,
      cx,
      cy,
      (prevAngle, currentAngle, now) => updateBlips(this.blips, prevAngle, currentAngle, now),
      id => {
        this.animFrameId = id;
      }
    );
  }

  private showTooltip(
    e: MouseEvent,
    v: MarketVerdict,
    extra?: { axisLabel?: string; axisValue?: number }
  ): void {
    if (!this.tooltipEl) return;

    this.tooltipEl.innerHTML = buildTooltipHtml(v, extra);

    this.tooltipEl.classList.add('visible');
    this.moveTooltip(e);
  }

  private moveTooltip(e: MouseEvent): void {
    if (!this.tooltipEl) return;
    this.tooltipEl.style.left = `${e.clientX}px`;
    this.tooltipEl.style.top = `${e.clientY - 12}px`;
  }

  private hideTooltip(): void {
    if (!this.tooltipEl) return;
    this.tooltipEl.classList.remove('visible');
  }
}
