import { RadarBlipItem } from './types.js';

/**
 * Создание SVG Defs с градиентами, фильтрами свечения и маской радара
 */
export function createDefs(clipRadius: number = 162): SVGDefsElement {
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
    <clipPath id="radar-scope-clip">
      <circle cx="220" cy="220" r="${clipRadius}" />
    </clipPath>
  `;
  return defs;
}

/**
 * Создание конического градиентного сканирующего луча
 */
export function createSweepBeam(cx: number, cy: number, beamRadius: number): SVGGElement {
  const beamGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  beamGroup.setAttribute('class', 'radar-sweep-beam');
  beamGroup.setAttribute('id', 'radar-sweep-beam');
  beamGroup.setAttribute('clip-path', 'url(#radar-scope-clip)');
  beamGroup.style.pointerEvents = 'none';

  const rotator = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  rotator.setAttribute('class', 'radar-sweep-rotator');
  rotator.setAttribute('id', 'radar-sweep-rotator');
  rotator.style.pointerEvents = 'none';

  // Вращающийся шлейф луча (хвост сектора 42 градуса против часовой стрелки от 12 часов)
  const trailAngleRad = (42 * Math.PI) / 180;
  const tx = cx - beamRadius * Math.sin(trailAngleRad);
  const ty = cy - beamRadius * Math.cos(trailAngleRad);

  const trailPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const d = `M ${cx} ${cy} L ${cx} ${cy - beamRadius} A ${beamRadius} ${beamRadius} 0 0 0 ${tx.toFixed(1)} ${ty.toFixed(1)} Z`;
  trailPath.setAttribute('d', d);
  trailPath.setAttribute('class', 'radar-sweep-trail');
  trailPath.setAttribute('fill', 'url(#radar-beam-gradient)');
  rotator.appendChild(trailPath);

  // Дополнительный внутренний высокоинтенсивный фосфорный слой (18 градусов)
  const innerAngleRad = (18 * Math.PI) / 180;
  const ix = cx - beamRadius * Math.sin(innerAngleRad);
  const iy = cy - beamRadius * Math.cos(innerAngleRad);
  const innerTrail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  innerTrail.setAttribute('d', `M ${cx} ${cy} L ${cx} ${cy - beamRadius} A ${beamRadius} ${beamRadius} 0 0 0 ${ix.toFixed(1)} ${iy.toFixed(1)} Z`);
  innerTrail.setAttribute('fill', '#00f2fe');
  innerTrail.setAttribute('opacity', '0.15');
  rotator.appendChild(innerTrail);

  // Ведущий сканирующий луч (линия 12 часов)
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', String(cx));
  line.setAttribute('y1', String(cy));
  line.setAttribute('x2', String(cx));
  line.setAttribute('y2', String(cy - beamRadius));
  line.setAttribute('class', 'radar-sweep-line');
  line.setAttribute('filter', 'url(#radar-glow-filter)');
  rotator.appendChild(line);

  beamGroup.appendChild(rotator);

  // Центральное ядро радара (неподвижное в центре cx, cy)
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
export function startSweepAnimation(
  beamEl: SVGElement,
  cx: number,
  cy: number,
  onFrame: (prevAngle: number, currentAngle: number, now: number) => void,
  setFrameId: (id: number) => void
): void {
  const DURATION_MS = 4800; // 4.8 сек на полный оборот (реалистичная скорость локатора)
  let lastTimestamp = performance.now();
  let currentAngle = 0;

  const rotatorEl = (beamEl.querySelector('.radar-sweep-rotator') as SVGElement) || beamEl;

  const tick = (now: number) => {
    const dt = now - lastTimestamp;
    lastTimestamp = now;

    // Защита от резкого скачка при возвращении из фоновой вкладки браузера
    if (dt > 0 && dt < 1000) {
      const prevAngle = currentAngle;
      currentAngle = (currentAngle + (dt / DURATION_MS) * 360) % 360;

      rotatorEl.setAttribute('transform', `rotate(${currentAngle.toFixed(2)} ${cx} ${cy})`);
      onFrame(prevAngle, currentAngle, now);
    } else {
      lastTimestamp = now;
    }

    setFrameId(requestAnimationFrame(tick));
  };

  setFrameId(requestAnimationFrame(tick));
}

/**
 * Проверка пересечения угла между предыдущим и текущим кадром
 */
function isAngleCrossed(target: number, prev: number, curr: number): boolean {
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
export function updateBlips(
  blips: RadarBlipItem[],
  prevAngle: number,
  currentAngle: number,
  now: number
): void {
  const PING_DURATION = 1400; // ms

  for (let i = 0; i < blips.length; i++) {
    const blip = blips[i];

    // Проверка прохождения сканирующего луча через маркер
    if (isAngleCrossed(blip.angle, prevAngle, currentAngle)) {
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
