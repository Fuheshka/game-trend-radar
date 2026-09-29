import { MarketVerdict, GameArchetype } from '../types.js';

export type ChartMode = 'spider' | 'polar';

export interface RadarChartOptions {
  container: HTMLElement;
  verdicts: MarketVerdict[];
  activeArchetype: GameArchetype | null;
  onSelectArchetype: (archetype: GameArchetype | null) => void;
}

export interface RadarBlipItem {
  id: string;
  x: number;
  y: number;
  angle: number; // 0 to 360 degrees clockwise from 12 o'clock
  baseRadius: number;
  color: string;
  groupEl: SVGGElement;
  dotEl: SVGCircleElement;
  rippleEl: SVGCircleElement;
  lastPingTime: number;
  verdict: MarketVerdict;
  axisLabel?: string;
  axisValue?: number;
}

export class RadarChartComponent {
  private container: HTMLElement;
  private verdicts: MarketVerdict[] = [];
  private activeArchetype: GameArchetype | null = null;
  private mode: ChartMode = 'spider';
  private onSelectArchetype: (archetype: GameArchetype | null) => void;
  private tooltipEl: HTMLElement | null = null;
  private animFrameId: number | null = null;
  private blips: RadarBlipItem[] = [];

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

    if (this.mode === 'spider') {
      this.renderSpiderChart();
    } else {
      this.renderPolarDonut();
    }
  }

  /**
   * Создание SVG Defs с градиентами и фильтрами свечения
   */
  private createDefs(): SVGDefsElement {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <linearGradient id="radar-beam-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#00f2fe" stop-opacity="0.38" />
        <stop offset="35%" stop-color="#10b981" stop-opacity="0.2" />
        <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
      </linearGradient>
      <filter id="radar-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    `;
    return defs;
  }

  /**
   * Создание конического градиентного сканирующего луча
   */
  private createSweepBeam(cx: number, cy: number, beamRadius: number): SVGGElement {
    const beamGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    beamGroup.setAttribute('class', 'radar-sweep-beam');
    beamGroup.setAttribute('id', 'radar-sweep-beam');
    beamGroup.style.pointerEvents = 'none';

    // Вращающийся шлейф луча (хвост сектора 42 градуса против часовой стрелки от 12 часов)
    const trailAngleRad = (42 * Math.PI) / 180;
    const tx = cx - beamRadius * Math.sin(trailAngleRad);
    const ty = cy - beamRadius * Math.cos(trailAngleRad);

    const trailPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = `M ${cx} ${cy} L ${cx} ${cy - beamRadius} A ${beamRadius} ${beamRadius} 0 0 0 ${tx.toFixed(1)} ${ty.toFixed(1)} Z`;
    trailPath.setAttribute('d', d);
    trailPath.setAttribute('class', 'radar-sweep-trail');
    trailPath.setAttribute('fill', 'url(#radar-beam-gradient)');
    beamGroup.appendChild(trailPath);

    // Дополнительный внутренний высокоинтенсивный фосфорный слой (18 градусов)
    const innerAngleRad = (18 * Math.PI) / 180;
    const ix = cx - beamRadius * Math.sin(innerAngleRad);
    const iy = cy - beamRadius * Math.cos(innerAngleRad);
    const innerTrail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    innerTrail.setAttribute('d', `M ${cx} ${cy} L ${cx} ${cy - beamRadius} A ${beamRadius} ${beamRadius} 0 0 0 ${ix.toFixed(1)} ${iy.toFixed(1)} Z`);
    innerTrail.setAttribute('fill', '#00f2fe');
    innerTrail.setAttribute('opacity', '0.15');
    beamGroup.appendChild(innerTrail);

    // Ведущий сканирующий луч (линия 12 часов)
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(cx));
    line.setAttribute('y1', String(cy));
    line.setAttribute('x2', String(cx));
    line.setAttribute('y2', String(cy - beamRadius));
    line.setAttribute('class', 'radar-sweep-line');
    line.setAttribute('filter', 'url(#radar-glow-filter)');
    beamGroup.appendChild(line);

    // Центральное ядро радара
    const hubRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hubRing.setAttribute('cx', String(cx));
    hubRing.setAttribute('cy', String(cy));
    hubRing.setAttribute('r', '8');
    hubRing.setAttribute('class', 'radar-center-ring');
    beamGroup.appendChild(hubRing);

    const hubDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hubDot.setAttribute('cx', String(cx));
    hubDot.setAttribute('cy', String(cy));
    hubDot.setAttribute('r', '4');
    hubDot.setAttribute('class', 'radar-center-hub');
    beamGroup.appendChild(hubDot);

    return beamGroup;
  }

  /**
   * Запуск высокопроизводительного requestAnimationFrame цикла сканирования (60+ FPS)
   */
  private startSweepAnimation(beamEl: SVGElement, cx: number, cy: number): void {
    const DURATION_MS = 4800; // 4.8 сек на полный оборот (реалистичная скорость локатора)
    let lastTimestamp = performance.now();
    let currentAngle = 0;

    const tick = (now: number) => {
      const dt = now - lastTimestamp;
      lastTimestamp = now;

      // Защита от резкого скачка при возвращении из фоновой вкладки браузера
      if (dt > 0 && dt < 1000) {
        const prevAngle = currentAngle;
        currentAngle = (currentAngle + (dt / DURATION_MS) * 360) % 360;

        beamEl.setAttribute('transform', `rotate(${currentAngle.toFixed(2)} ${cx} ${cy})`);
        this.updateBlips(prevAngle, currentAngle, now);
      } else {
        lastTimestamp = now;
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  /**
   * Проверка пересечения угла между предыдущим и текущим кадром
   */
  private isAngleCrossed(target: number, prev: number, curr: number): boolean {
    if (prev <= curr) {
      return target >= prev && target < curr;
    } else {
      // Переход через 360 градусов
      return target >= prev || target < curr;
    }
  }

  /**
   * Обновление световых маркеров и волновой анимации эхо-отклика (ping ripple)
   */
  private updateBlips(prevAngle: number, currentAngle: number, now: number): void {
    const PING_DURATION = 1400; // ms

    for (let i = 0; i < this.blips.length; i++) {
      const blip = this.blips[i];

      // Проверка прохождения сканирующего луча через маркер
      if (this.isAngleCrossed(blip.angle, prevAngle, currentAngle)) {
        blip.lastPingTime = now;
      }

      const age = now - blip.lastPingTime;
      if (age >= 0 && age < PING_DURATION) {
        const p = age / PING_DURATION;
        // Кубическое сглаживание для естественной гидродинамической/радарной волны
        const easeOut = 1 - Math.pow(1 - p, 3);
        const r = blip.baseRadius + easeOut * 22;
        const opacity = (1 - easeOut) * 0.95;
        const strokeWidth = 2.2 * (1 - easeOut);

        blip.rippleEl.setAttribute('r', r.toFixed(1));
        blip.rippleEl.setAttribute('opacity', opacity.toFixed(2));
        blip.rippleEl.setAttribute('stroke-width', strokeWidth.toFixed(1));

        // Импульсная вспышка ядра точки в момент касания лучом
        if (p < 0.22) {
          const flashScale = 1 + (1 - p / 0.22) * 0.55;
          blip.dotEl.setAttribute('r', (blip.baseRadius * flashScale).toFixed(1));
        } else {
          blip.dotEl.setAttribute('r', String(blip.baseRadius));
        }
      } else if (blip.rippleEl.getAttribute('opacity') !== '0') {
        // Оптимизация: обнуляем прозрачность один раз и не трогаем DOM в остальных кадрах
        blip.rippleEl.setAttribute('opacity', '0');
        blip.dotEl.setAttribute('r', String(blip.baseRadius));
      }
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

    // Градиенты и фильтры
    svg.appendChild(this.createDefs());

    // Внешние концентрические кольца прицела радара
    const outerScope = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outerScope.setAttribute('cx', String(cx));
    outerScope.setAttribute('cy', String(cy));
    outerScope.setAttribute('r', String(radius));
    outerScope.setAttribute('class', 'radar-scope-ring');
    svg.appendChild(outerScope);

    const boundaryScope = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    boundaryScope.setAttribute('cx', String(cx));
    boundaryScope.setAttribute('cy', String(cy));
    boundaryScope.setAttribute('r', String(radius + 12));
    boundaryScope.setAttribute('class', 'radar-scope-dashed');
    svg.appendChild(boundaryScope);

    // Концентрические паутинные сетки (20%, 40%, 60%, 80%, 100%)
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

    // Оси и подписи
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

      // Расположение меток за пределами радиуса
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

    // Добавляем сканирующий луч поверх сетки
    const beam = this.createSweepBeam(cx, cy, radius + 12);
    svg.appendChild(beam);

    // Группа маркеров обнаружения (blips)
    const blipsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    blipsGroup.setAttribute('class', 'radar-blips-layer');

    // Отрисовка полигонов архетипов и создание интерактивных точек
    this.verdicts.forEach(v => {
      const color = this.getStatusColor(v.status);
      const isSelected = this.activeArchetype === v.archetype;
      const isDimmed = this.activeArchetype !== null && !isSelected;

      // Нормализация значений осей 0-1
      const values = [
        Math.min(1, Math.max(0.1, v.opportunityScore.overallScore / 100)),
        Math.min(1, Math.max(0.1, v.opportunityScore.demandScore / 100)),
        Math.min(1, Math.max(0.1, v.opportunityScore.velocityScore / 100)),
        Math.min(1, Math.max(0.1, v.opportunityScore.monetizationScore / 100)),
        Math.min(1, Math.max(0.1, (5.0 - v.opportunityScore.saturationIndex) / 4.0)),
      ];

      const points: string[] = [];
      const vertexCoords: Array<{ x: number; y: number; axisIndex: number; value: number }> = [];

      values.forEach((val, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + radius * val * Math.cos(angle);
        const y = cy + radius * val * Math.sin(angle);
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        vertexCoords.push({ x, y, axisIndex: i, value: val });
      });

      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', points.join(' '));
      poly.setAttribute('class', 'radar-polygon');
      poly.setAttribute('fill', color);
      poly.setAttribute('stroke', color);
      poly.style.opacity = isDimmed ? '0.18' : isSelected ? '1' : '0.82';
      if (isSelected) {
        poly.setAttribute('stroke-width', '4');
        poly.style.filter = `drop-shadow(0 0 14px ${color})`;
      }

      // События наведения и клика на полигон
      poly.addEventListener('mouseenter', (e: MouseEvent) => {
        poly.style.opacity = '1';
        poly.style.filter = `drop-shadow(0 0 16px ${color})`;
        this.showTooltip(e, v);
      });

      poly.addEventListener('mousemove', (e: MouseEvent) => {
        this.moveTooltip(e);
      });

      poly.addEventListener('mouseleave', () => {
        poly.style.opacity = isDimmed ? '0.18' : isSelected ? '1' : '0.82';
        poly.style.filter = isSelected ? `drop-shadow(0 0 14px ${color})` : 'none';
        this.hideTooltip();
      });

      poly.addEventListener('click', () => {
        const next = this.activeArchetype === v.archetype ? null : v.archetype;
        this.onSelectArchetype(next);
      });

      svg.appendChild(poly);

      // Создание светящихся маркеров (radar-blip) на осях полигона
      vertexCoords.forEach((coord, idx) => {
        const baseRadius = isSelected ? 5.5 : 4.5;
        // Угол маркера от 12 часов по часовой стрелке (0-360 deg)
        const ptAngle = (Math.atan2(coord.y - cy, coord.x - cx) * (180 / Math.PI) + 90 + 360) % 360;

        const blipGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        blipGroup.setAttribute('class', 'radar-blip');
        blipGroup.setAttribute('data-archetype', v.archetype);
        blipGroup.style.cursor = 'pointer';
        if (isDimmed) blipGroup.style.opacity = '0.35';

        // Волновое эхо-кольцо (ping ripple)
        const ripple = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ripple.setAttribute('cx', coord.x.toFixed(1));
        ripple.setAttribute('cy', coord.y.toFixed(1));
        ripple.setAttribute('r', String(baseRadius));
        ripple.setAttribute('fill', 'none');
        ripple.setAttribute('stroke', color);
        ripple.setAttribute('stroke-width', '2');
        ripple.setAttribute('opacity', '0');
        ripple.setAttribute('class', 'radar-blip-ripple');

        // Центральная светящаяся точка
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', coord.x.toFixed(1));
        dot.setAttribute('cy', coord.y.toFixed(1));
        dot.setAttribute('r', String(baseRadius));
        dot.setAttribute('fill', color);
        dot.setAttribute('class', 'radar-blip-dot');
        if (isSelected) {
          dot.style.filter = `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 2px #ffffff)`;
        }

        // Увеличенная зона взаимодействия для комфортного наведения
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hitArea.setAttribute('cx', coord.x.toFixed(1));
        hitArea.setAttribute('cy', coord.y.toFixed(1));
        hitArea.setAttribute('r', '14');
        hitArea.setAttribute('fill', 'transparent');
        hitArea.setAttribute('class', 'radar-blip-hitarea');

        blipGroup.appendChild(ripple);
        blipGroup.appendChild(dot);
        blipGroup.appendChild(hitArea);

        const axisInfo = this.AXES[coord.axisIndex];
        const axisScore = Math.round(coord.value * 100);

        blipGroup.addEventListener('mouseenter', (e: MouseEvent) => {
          dot.style.transform = 'scale(1.45)';
          dot.style.filter = `drop-shadow(0 0 12px ${color}) drop-shadow(0 0 3px #ffffff)`;
          poly.style.opacity = '1';
          poly.style.filter = `drop-shadow(0 0 16px ${color})`;
          this.showTooltip(e, v, { axisLabel: axisInfo.label, axisValue: axisScore });
        });

        blipGroup.addEventListener('mousemove', (e: MouseEvent) => {
          this.moveTooltip(e);
        });

        blipGroup.addEventListener('mouseleave', () => {
          dot.style.transform = 'none';
          dot.style.filter = isSelected ? `drop-shadow(0 0 8px ${color})` : 'none';
          poly.style.opacity = isDimmed ? '0.18' : isSelected ? '1' : '0.82';
          poly.style.filter = isSelected ? `drop-shadow(0 0 14px ${color})` : 'none';
          this.hideTooltip();
        });

        blipGroup.addEventListener('click', () => {
          const next = this.activeArchetype === v.archetype ? null : v.archetype;
          this.onSelectArchetype(next);
        });

        blipsGroup.appendChild(blipGroup);

        this.blips.push({
          id: `${v.archetype}-axis-${idx}`,
          x: coord.x,
          y: coord.y,
          angle: ptAngle,
          baseRadius,
          color,
          groupEl: blipGroup,
          dotEl: dot,
          rippleEl: ripple,
          lastPingTime: 0,
          verdict: v,
          axisLabel: axisInfo.label,
          axisValue: axisScore,
        });
      });
    });

    svg.appendChild(blipsGroup);
    this.container.appendChild(svg);

    // Запуск цикла анимации сканирования
    this.startSweepAnimation(beam, cx, cy);
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

    // Градиенты и фильтры
    svg.appendChild(this.createDefs());

    // Внешние кольца прицела
    const outerScope = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outerScope.setAttribute('cx', String(cx));
    outerScope.setAttribute('cy', String(cy));
    outerScope.setAttribute('r', String(outerR));
    outerScope.setAttribute('class', 'radar-scope-ring');
    svg.appendChild(outerScope);

    const boundaryScope = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    boundaryScope.setAttribute('cx', String(cx));
    boundaryScope.setAttribute('cy', String(cy));
    boundaryScope.setAttribute('r', String(outerR + 10));
    boundaryScope.setAttribute('class', 'radar-scope-dashed');
    svg.appendChild(boundaryScope);

    // Сканирующий луч
    const beam = this.createSweepBeam(cx, cy, outerR + 10);
    svg.appendChild(beam);

    const totalCCU = this.verdicts.reduce((sum, v) => sum + (v.totalAudienceCCU || 1000), 0);
    let currentAngle = -Math.PI / 2;

    const blipsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    blipsGroup.setAttribute('class', 'radar-blips-layer');

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
      path.setAttribute('class', 'radar-polar-sector');
      path.style.opacity = isDimmed ? '0.22' : isSelected ? '1' : '0.85';

      if (isSelected) {
        path.style.transform = 'scale(1.04)';
        path.style.transformOrigin = `${cx}px ${cy}px`;
        path.style.filter = `drop-shadow(0 0 16px ${color})`;
      }

      path.addEventListener('mouseenter', (e: MouseEvent) => {
        path.style.opacity = '1';
        path.style.transform = 'scale(1.03)';
        path.style.transformOrigin = `${cx}px ${cy}px`;
        path.style.filter = `drop-shadow(0 0 16px ${color})`;
        this.showTooltip(e, v);
      });

      path.addEventListener('mousemove', (e: MouseEvent) => {
        this.moveTooltip(e);
      });

      path.addEventListener('mouseleave', () => {
        path.style.opacity = isDimmed ? '0.22' : isSelected ? '1' : '0.85';
        path.style.transform = isSelected ? 'scale(1.04)' : 'none';
        path.style.filter = isSelected ? `drop-shadow(0 0 16px ${color})` : 'none';
        this.hideTooltip();
      });

      path.addEventListener('click', () => {
        const next = this.activeArchetype === v.archetype ? null : v.archetype;
        this.onSelectArchetype(next);
      });

      svg.appendChild(path);

      // Маркер в центре сектора
      const midAngle = (currentAngle + endAngle) / 2;
      const midR = (outerR + innerR) / 2;
      const bx = cx + midR * Math.cos(midAngle);
      const by = cy + midR * Math.sin(midAngle);
      const baseRadius = isSelected ? 5.5 : 4.5;
      const ptAngle = (Math.atan2(by - cy, bx - cx) * (180 / Math.PI) + 90 + 360) % 360;

      const blipGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      blipGroup.setAttribute('class', 'radar-blip');
      blipGroup.style.cursor = 'pointer';
      if (isDimmed) blipGroup.style.opacity = '0.35';

      const ripple = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ripple.setAttribute('cx', bx.toFixed(1));
      ripple.setAttribute('cy', by.toFixed(1));
      ripple.setAttribute('r', String(baseRadius));
      ripple.setAttribute('fill', 'none');
      ripple.setAttribute('stroke', color);
      ripple.setAttribute('stroke-width', '2');
      ripple.setAttribute('opacity', '0');
      ripple.setAttribute('class', 'radar-blip-ripple');

      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', bx.toFixed(1));
      dot.setAttribute('cy', by.toFixed(1));
      dot.setAttribute('r', String(baseRadius));
      dot.setAttribute('fill', color);
      dot.setAttribute('class', 'radar-blip-dot');
      if (isSelected) {
        dot.style.filter = `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 2px #ffffff)`;
      }

      const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      hitArea.setAttribute('cx', bx.toFixed(1));
      hitArea.setAttribute('cy', by.toFixed(1));
      hitArea.setAttribute('r', '14');
      hitArea.setAttribute('fill', 'transparent');
      hitArea.setAttribute('class', 'radar-blip-hitarea');

      blipGroup.appendChild(ripple);
      blipGroup.appendChild(dot);
      blipGroup.appendChild(hitArea);

      blipGroup.addEventListener('mouseenter', (e: MouseEvent) => {
        dot.style.transform = 'scale(1.45)';
        dot.style.filter = `drop-shadow(0 0 12px ${color}) drop-shadow(0 0 3px #ffffff)`;
        path.style.opacity = '1';
        path.style.transform = 'scale(1.03)';
        path.style.transformOrigin = `${cx}px ${cy}px`;
        path.style.filter = `drop-shadow(0 0 16px ${color})`;
        this.showTooltip(e, v);
      });

      blipGroup.addEventListener('mousemove', (e: MouseEvent) => {
        this.moveTooltip(e);
      });

      blipGroup.addEventListener('mouseleave', () => {
        dot.style.transform = 'none';
        dot.style.filter = isSelected ? `drop-shadow(0 0 8px ${color})` : 'none';
        path.style.opacity = isDimmed ? '0.22' : isSelected ? '1' : '0.85';
        path.style.transform = isSelected ? 'scale(1.04)' : 'none';
        path.style.filter = isSelected ? `drop-shadow(0 0 16px ${color})` : 'none';
        this.hideTooltip();
      });

      blipGroup.addEventListener('click', () => {
        const next = this.activeArchetype === v.archetype ? null : v.archetype;
        this.onSelectArchetype(next);
      });

      blipsGroup.appendChild(blipGroup);

      this.blips.push({
        id: `${v.archetype}-polar-blip`,
        x: bx,
        y: by,
        angle: ptAngle,
        baseRadius,
        color,
        groupEl: blipGroup,
        dotEl: dot,
        rippleEl: ripple,
        lastPingTime: 0,
        verdict: v,
      });

      currentAngle = endAngle;
    });

    svg.appendChild(blipsGroup);

    // Центральный информационный блок
    const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    textGroup.setAttribute('text-anchor', 'middle');
    textGroup.style.pointerEvents = 'none';

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

    // Запуск цикла анимации луча
    this.startSweepAnimation(beam, cx, cy);
  }

  private showTooltip(
    e: MouseEvent,
    v: MarketVerdict,
    extra?: { axisLabel?: string; axisValue?: number }
  ): void {
    if (!this.tooltipEl) return;

    const statusLabel =
      v.status === 'GREEN_LIGHT'
        ? '🟢 Green Light'
        : v.status === 'YELLOW_LIGHT'
        ? '🟡 Yellow Light'
        : '🔴 Red Light';

    let extraRow = '';
    if (extra && extra.axisLabel !== undefined && extra.axisValue !== undefined) {
      extraRow = `
        <div class="tooltip-row" style="color: var(--accent-cyan); font-weight: 600;">
          <span>${extra.axisLabel}:</span>
          <span>${extra.axisValue}/100</span>
        </div>
      `;
    }

    this.tooltipEl.innerHTML = `
      <div class="tooltip-title">${v.titleRu}</div>
      ${extraRow}
      <div class="tooltip-row">
        <span>Статус:</span>
        <span>${statusLabel}</span>
      </div>
      <div class="tooltip-row">
        <span>Opportunity Score:</span>
        <span style="font-weight: 700; color: #fff;">${v.opportunityScore.overallScore}/100</span>
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
