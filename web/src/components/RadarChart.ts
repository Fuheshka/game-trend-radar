import { MarketVerdict, GameArchetype } from '../types.js';

export type ChartMode = 'spider' | 'polar';

export interface RadarChartOptions {
  container: HTMLElement;
  verdicts: MarketVerdict[];
  activeArchetype: GameArchetype | null;
  onSelectArchetype: (archetype: GameArchetype | null) => void;
}

export class RadarChartComponent {
  private container: HTMLElement;
  private verdicts: MarketVerdict[] = [];
  private activeArchetype: GameArchetype | null = null;
  private mode: ChartMode = 'spider';
  private onSelectArchetype: (archetype: GameArchetype | null) => void;
  private tooltipEl: HTMLElement | null = null;

  private readonly AXES = [
    { key: 'score', label: 'Скоринг' },
    { key: 'demand', label: 'Спрос' },
    { key: 'velocity', label: 'Динамика' },
    { key: 'monetization', label: 'Монетизация' },
    { key: 'niche', label: 'Свобода ниши' },
  ];

  constructor(options: RadarChartOptions) {
    this.container = options.container;
    this.verdicts = options.verdicts;
    this.activeArchetype = options.activeArchetype;
    this.onSelectArchetype = options.onSelectArchetype;

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

  private createTooltip(): void {
    let existing = document.getElementById('radar-tooltip');
    if (!existing) {
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.id = 'radar-tooltip';
      this.tooltipEl.className = 'chart-tooltip';
      document.body.appendChild(this.tooltipEl);
    } else {
      this.tooltipEl = existing;
    }
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'GREEN_LIGHT':
        return '#10b981';
      case 'YELLOW_LIGHT':
        return '#f59e0b';
      case 'RED_LIGHT':
        return '#ef4444';
      default:
        return '#89dceb';
    }
  }

  public render(): void {
    this.container.innerHTML = '';

    if (!this.verdicts || this.verdicts.length === 0) {
      this.container.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 2rem;">
          Нет данных для построения диаграммы
        </div>
      `;
      return;
    }

    if (this.mode === 'spider') {
      this.renderSpiderChart();
    } else {
      this.renderPolarDonut();
    }
  }

  /**
   * Многоосевая радиальная паутина (Spider Radar)
   */
  private renderSpiderChart(): void {
    const size = 440;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 150;
    const totalAxes = this.AXES.length;
    const angleStep = (Math.PI * 2) / totalAxes;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('class', 'radar-svg');

    // Concentric web levels (20%, 40%, 60%, 80%, 100%)
    const levels = [0.2, 0.4, 0.6, 0.8, 1.0];
    levels.forEach(lvl => {
      const points: string[] = [];
      for (let i = 0; i < totalAxes; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + radius * lvl * Math.cos(angle);
        const y = cy + radius * lvl * Math.sin(angle);
        points.push(`${x},${y}`);
      }
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', points.join(' '));
      polygon.setAttribute('class', 'radar-grid-web');
      svg.appendChild(polygon);
    });

    // Axis lines and labels
    this.AXES.forEach((axis, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x2 = cx + radius * Math.cos(angle);
      const y2 = cy + radius * Math.sin(angle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(cx));
      line.setAttribute('y1', String(cy));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('class', 'radar-axis-line');
      svg.appendChild(line);

      // Label positioning slightly beyond radius
      const labelRadius = radius + 22;
      const lx = cx + labelRadius * Math.cos(angle);
      const ly = cy + labelRadius * Math.sin(angle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(lx));
      text.setAttribute('y', String(ly));
      text.setAttribute('class', 'radar-axis-label');
      text.textContent = axis.label;
      svg.appendChild(text);
    });

    // Draw verdict polygons
    this.verdicts.forEach(v => {
      const color = this.getStatusColor(v.status);
      const isSelected = this.activeArchetype === v.archetype;
      const isDimmed = this.activeArchetype !== null && !isSelected;

      // Calculate values for each axis normalized to 0-1
      const values = [
        Math.min(1, Math.max(0.1, v.opportunityScore.overallScore / 100)),
        Math.min(1, Math.max(0.1, v.opportunityScore.demandScore / 100)),
        Math.min(1, Math.max(0.1, v.opportunityScore.velocityScore / 100)),
        Math.min(1, Math.max(0.1, v.opportunityScore.monetizationScore / 100)),
        // Inverse saturation: lower saturation = higher score
        Math.min(1, Math.max(0.1, (5.0 - v.opportunityScore.saturationIndex) / 4.0)),
      ];

      const points: string[] = [];
      values.forEach((val, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + radius * val * Math.cos(angle);
        const y = cy + radius * val * Math.sin(angle);
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      });

      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', points.join(' '));
      poly.setAttribute('class', 'radar-polygon');
      poly.setAttribute('fill', color);
      poly.setAttribute('stroke', color);
      poly.style.opacity = isDimmed ? '0.2' : isSelected ? '1' : '0.85';
      if (isSelected) {
        poly.setAttribute('stroke-width', '4');
        poly.style.filter = `drop-shadow(0 0 12px ${color})`;
      }

      // Hover and Click events
      poly.addEventListener('mouseenter', (e: MouseEvent) => {
        poly.style.opacity = '1';
        this.showTooltip(e, v);
      });

      poly.addEventListener('mousemove', (e: MouseEvent) => {
        this.moveTooltip(e);
      });

      poly.addEventListener('mouseleave', () => {
        poly.style.opacity = isDimmed ? '0.2' : isSelected ? '1' : '0.85';
        this.hideTooltip();
      });

      poly.addEventListener('click', () => {
        const next = this.activeArchetype === v.archetype ? null : v.archetype;
        this.onSelectArchetype(next);
      });

      svg.appendChild(poly);
    });

    this.container.appendChild(svg);
  }

  /**
   * Секторное распределение онлайна и долей рынка (Polar CCU Donut)
   */
  private renderPolarDonut(): void {
    const size = 440;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = 150;
    const innerR = 90;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('class', 'radar-svg');

    const totalCCU = this.verdicts.reduce((sum, v) => sum + (v.totalAudienceCCU || 1000), 0);
    let currentAngle = -Math.PI / 2;

    this.verdicts.forEach(v => {
      const ccu = v.totalAudienceCCU || 1000;
      const sliceAngle = (ccu / totalCCU) * Math.PI * 2;
      const endAngle = currentAngle + sliceAngle;
      const color = this.getStatusColor(v.status);
      const isSelected = this.activeArchetype === v.archetype;
      const isDimmed = this.activeArchetype !== null && !isSelected;

      const x1 = cx + outerR * Math.cos(currentAngle);
      const y1 = cy + outerR * Math.sin(currentAngle);
      const x2 = cx + outerR * Math.cos(endAngle);
      const y2 = cy + outerR * Math.sin(endAngle);

      const x3 = cx + innerR * Math.cos(endAngle);
      const y3 = cy + innerR * Math.sin(endAngle);
      const x4 = cx + innerR * Math.cos(currentAngle);
      const y4 = cy + innerR * Math.sin(currentAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const pathData = [
        `M ${x1} ${y1}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
        'Z',
      ].join(' ');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('fill', color);
      path.setAttribute('stroke', '#101117');
      path.setAttribute('stroke-width', '2');
      path.style.cursor = 'pointer';
      path.style.transition = 'all 0.2s ease';
      path.style.opacity = isDimmed ? '0.25' : isSelected ? '1' : '0.85';

      if (isSelected) {
        path.style.transform = 'scale(1.04)';
        path.style.transformOrigin = `${cx}px ${cy}px`;
        path.style.filter = `drop-shadow(0 0 14px ${color})`;
      }

      path.addEventListener('mouseenter', (e: MouseEvent) => {
        path.style.opacity = '1';
        this.showTooltip(e, v);
      });

      path.addEventListener('mousemove', (e: MouseEvent) => {
        this.moveTooltip(e);
      });

      path.addEventListener('mouseleave', () => {
        path.style.opacity = isDimmed ? '0.25' : isSelected ? '1' : '0.85';
        this.hideTooltip();
      });

      path.addEventListener('click', () => {
        const next = this.activeArchetype === v.archetype ? null : v.archetype;
        this.onSelectArchetype(next);
      });

      svg.appendChild(path);
      currentAngle = endAngle;
    });

    // Center Donut text
    const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    textGroup.setAttribute('text-anchor', 'middle');

    const totalText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    totalText.setAttribute('x', String(cx));
    totalText.setAttribute('y', String(cy - 6));
    totalText.setAttribute('fill', '#ffffff');
    totalText.setAttribute('font-family', 'JetBrains Mono');
    totalText.setAttribute('font-size', '16');
    totalText.setAttribute('font-weight', '700');
    totalText.textContent = this.formatNumber(totalCCU);

    const subText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    subText.setAttribute('x', String(cx));
    subText.setAttribute('y', String(cy + 16));
    subText.setAttribute('fill', '#94a3b8');
    subText.setAttribute('font-family', 'Inter');
    subText.setAttribute('font-size', '11');
    subText.textContent = 'Общий онлайн CCU';

    textGroup.appendChild(totalText);
    textGroup.appendChild(subText);
    svg.appendChild(textGroup);

    this.container.appendChild(svg);
  }

  private showTooltip(e: MouseEvent, v: MarketVerdict): void {
    if (!this.tooltipEl) return;

    const statusLabel =
      v.status === 'GREEN_LIGHT'
        ? '🟢 Green Light'
        : v.status === 'YELLOW_LIGHT'
        ? '🟡 Yellow Light'
        : '🔴 Red Light';

    this.tooltipEl.innerHTML = `
      <div class="tooltip-title">${v.titleRu}</div>
      <div class="tooltip-row">
        <span>Статус:</span>
        <span>${statusLabel}</span>
      </div>
      <div class="tooltip-row">
        <span>Opportunity Score:</span>
        <span>${v.opportunityScore.overallScore}/100</span>
      </div>
      <div class="tooltip-row">
        <span>Аудитория CCU:</span>
        <span>${v.totalAudienceCCU.toLocaleString()} (${v.marketSharePercent}%)</span>
      </div>
      <div class="tooltip-row">
        <span>Виральный множитель:</span>
        <span>x${(v.opportunityScore.viralMultiplier || 1.0).toFixed(1)}</span>
      </div>
      <div style="margin-top: 6px; font-size: 0.72rem; color: #89dceb;">Кликните для фильтрации карточек</div>
    `;

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

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
  }
}
