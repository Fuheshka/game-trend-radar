import { getStatusColor } from './constants.js';
import { formatCompactNumber } from '../../utils/format.js';
import { createDefs, createSweepBeam } from './sweep.js';
import { RadarRenderContext } from './types.js';

/**
 * Секторное распределение онлайна и долей рынка (Polar CCU Donut)
 */
export function renderPolarDonut(ctx: RadarRenderContext): void {
  const size = 440;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 150;
  const innerR = 90;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'radar-svg');

  // Градиенты и фильтры
  svg.appendChild(createDefs(outerR + 10));

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
  const beam = createSweepBeam(cx, cy, outerR + 10);
  svg.appendChild(beam);

  const totalCCU = ctx.verdicts.reduce((sum, v) => sum + (v.totalAudienceCCU || 1000), 0);
  let currentAngle = -Math.PI / 2;

  const blipsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  blipsGroup.setAttribute('class', 'radar-blips-layer');

  ctx.verdicts.forEach(v => {
    const ccu = v.totalAudienceCCU || 1000;
    const sliceAngle = (ccu / totalCCU) * Math.PI * 2;
    const endAngle = currentAngle + sliceAngle;
    const color = getStatusColor(v.status);
    const isSelected = ctx.getActiveArchetype() === v.archetype;
    const isDimmed = ctx.getActiveArchetype() !== null && !isSelected;

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
      ctx.showTooltip(e, v);
      ctx.onHoverArchetype?.(v.archetype);
    });

    path.addEventListener('mousemove', (e: MouseEvent) => {
      ctx.moveTooltip(e);
    });

    path.addEventListener('mouseleave', () => {
      path.style.opacity = isDimmed ? '0.22' : isSelected ? '1' : '0.85';
      path.style.transform = isSelected ? 'scale(1.04)' : 'none';
      path.style.filter = isSelected ? `drop-shadow(0 0 16px ${color})` : 'none';
      ctx.hideTooltip();
      ctx.onHoverArchetype?.(null);
    });

    path.addEventListener('click', () => {
      const next = ctx.getActiveArchetype() === v.archetype ? null : v.archetype;
      ctx.onSelectArchetype(next);
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
      ctx.showTooltip(e, v);
      ctx.onHoverArchetype?.(v.archetype);
    });

    blipGroup.addEventListener('mousemove', (e: MouseEvent) => {
      ctx.moveTooltip(e);
    });

    blipGroup.addEventListener('mouseleave', () => {
      dot.style.transform = 'none';
      dot.style.filter = isSelected ? `drop-shadow(0 0 8px ${color})` : 'none';
      path.style.opacity = isDimmed ? '0.22' : isSelected ? '1' : '0.85';
      path.style.transform = isSelected ? 'scale(1.04)' : 'none';
      path.style.filter = isSelected ? `drop-shadow(0 0 16px ${color})` : 'none';
      ctx.hideTooltip();
      ctx.onHoverArchetype?.(null);
    });

    blipGroup.addEventListener('click', () => {
      const next = ctx.getActiveArchetype() === v.archetype ? null : v.archetype;
      ctx.onSelectArchetype(next);
    });

    blipsGroup.appendChild(blipGroup);

    ctx.blips.push({
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
  totalText.textContent = formatCompactNumber(totalCCU);

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

  ctx.container.appendChild(svg);

  // Запуск цикла анимации луча
  ctx.startSweepAnimation(beam, cx, cy);
}
