import { MarketVerdict, GameArchetype } from '../../types.js';

export type ChartMode = 'spider' | 'polar';

export interface RadarChartOptions {
  container: HTMLElement;
  verdicts: MarketVerdict[];
  activeArchetype: GameArchetype | null;
  onSelectArchetype: (archetype: GameArchetype | null) => void;
  onHoverArchetype?: (archetype: GameArchetype | null) => void;
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

/**
 * Контекст отрисовки: состояние и обработчики компонента, передаваемые в функции отрисовки диаграмм
 */
export interface RadarRenderContext {
  container: HTMLElement;
  verdicts: MarketVerdict[];
  blips: RadarBlipItem[];
  getActiveArchetype: () => GameArchetype | null;
  onSelectArchetype: (archetype: GameArchetype | null) => void;
  onHoverArchetype?: (archetype: GameArchetype | null) => void;
  showTooltip: (
    e: MouseEvent,
    v: MarketVerdict,
    extra?: { axisLabel?: string; axisValue?: number }
  ) => void;
  moveTooltip: (e: MouseEvent) => void;
  hideTooltip: () => void;
  startSweepAnimation: (beamEl: SVGElement, cx: number, cy: number) => void;
}
