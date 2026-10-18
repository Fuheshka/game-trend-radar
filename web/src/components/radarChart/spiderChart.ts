import { RADAR_AXES, getStatusColor } from './constants.js';
import { createDefs, createSweepBeam } from './sweep.js';
import { RadarRenderContext } from './types.js';

/**
 * Многоосевая радиальная паутина (Spider Radar)
 */
export function renderSpiderChart(ctx: RadarRenderContext): void {
  const size = 440;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 150;
  const totalAxes = RADAR_AXES.length;
  const angleStep = (Math.PI * 2) / totalAxes;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'radar-svg');

  // Градиенты и фильтры
  svg.appendChild(createDefs());

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
  RADAR_AXES.forEach((axis, i) => {
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
  const beam = createSweepBeam(cx, cy, radius + 12);
  svg.appendChild(beam);

  // Группа маркеров обнаружения (blips)
  const blipsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  blipsGroup.setAttribute('class', 'radar-blips-layer');

  // Отрисовка полигонов архетипов и создание интерактивных точек
  ctx.verdicts.forEach(v => {
    const color = getStatusColor(v.status);
    const isSelected = ctx.getActiveArchetype() === v.archetype;
    const isDimmed = ctx.getActiveArchetype() !== null && !isSelected;

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
      ctx.showTooltip(e, v);
      ctx.onHoverArchetype?.(v.archetype);
    });

    poly.addEventListener('mousemove', (e: MouseEvent) => {
      ctx.moveTooltip(e);
    });

    poly.addEventListener('mouseleave', () => {
      poly.style.opacity = isDimmed ? '0.18' : isSelected ? '1' : '0.82';
      poly.style.filter = isSelected ? `drop-shadow(0 0 14px ${color})` : 'none';
      ctx.hideTooltip();
      ctx.onHoverArchetype?.(null);
    });

    poly.addEventListener('click', () => {
      const next = ctx.getActiveArchetype() === v.archetype ? null : v.archetype;
      ctx.onSelectArchetype(next);
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

      const axisInfo = RADAR_AXES[coord.axisIndex];
      const axisScore = Math.round(coord.value * 100);

      blipGroup.addEventListener('mouseenter', (e: MouseEvent) => {
        dot.style.transform = 'scale(1.45)';
        dot.style.filter = `drop-shadow(0 0 12px ${color}) drop-shadow(0 0 3px #ffffff)`;
        poly.style.opacity = '1';
        poly.style.filter = `drop-shadow(0 0 16px ${color})`;
        ctx.showTooltip(e, v, { axisLabel: axisInfo.label, axisValue: axisScore });
        ctx.onHoverArchetype?.(v.archetype);
      });

      blipGroup.addEventListener('mousemove', (e: MouseEvent) => {
        ctx.moveTooltip(e);
      });

      blipGroup.addEventListener('mouseleave', () => {
        dot.style.transform = 'none';
        dot.style.filter = isSelected ? `drop-shadow(0 0 8px ${color})` : 'none';
        poly.style.opacity = isDimmed ? '0.18' : isSelected ? '1' : '0.82';
        poly.style.filter = isSelected ? `drop-shadow(0 0 14px ${color})` : 'none';
        ctx.hideTooltip();
        ctx.onHoverArchetype?.(null);
      });

      blipGroup.addEventListener('click', () => {
        const next = ctx.getActiveArchetype() === v.archetype ? null : v.archetype;
        ctx.onSelectArchetype(next);
      });

      blipsGroup.appendChild(blipGroup);

      ctx.blips.push({
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
  ctx.container.appendChild(svg);

  // Запуск цикла анимации сканирования
  ctx.startSweepAnimation(beam, cx, cy);
}
