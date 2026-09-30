/**
 * Animation utilities for Game Trend Radar web UI
 */

const activeAnimations = new WeakMap<HTMLElement, number>();

/**
 * Easing function: Ease-Out Quart
 * Provides a rapid, energetic lift with an ultra-smooth landing.
 */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * Animates a numeric counter smoothly inside a target HTMLElement.
 *
 * @param element - The HTML element whose textContent will be animated
 * @param start - Starting numeric value
 * @param end - Ending (target) numeric value
 * @param durationMs - Duration of the count-up animation in milliseconds (defaults to 1000ms)
 * @param formatFn - Optional formatting function to convert intermediate number to string
 */
export function animateCounter(
  element: HTMLElement,
  start: number,
  end: number,
  durationMs: number = 1000,
  formatFn?: (val: number) => string
): void {
  // Cancel any existing animation on this element to prevent stutter/overlapping frames
  const prevAnimId = activeAnimations.get(element);
  if (prevAnimId !== undefined && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(prevAnimId);
    activeAnimations.delete(element);
  }

  const format = (v: number): string =>
    formatFn ? formatFn(v) : Math.round(v).toLocaleString();

  // If start and end are identical or duration is non-positive, set immediately
  if (start === end || durationMs <= 0) {
    element.textContent = format(end);
    return;
  }

  // Graceful fallback for non-browser / headless environments without requestAnimationFrame
  if (typeof requestAnimationFrame !== 'function') {
    element.textContent = format(end);
    return;
  }

  element.textContent = format(start);

  const startTime = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

  const step = (now: number): void => {
    const elapsed = now - startTime;
    const progress = Math.min(Math.max(elapsed / durationMs, 0), 1);
    const eased = easeOutQuart(progress);
    const currentVal = start + (end - start) * eased;

    element.textContent = format(currentVal);

    if (progress < 1) {
      const animId = requestAnimationFrame(step);
      activeAnimations.set(element, animId);
    } else {
      activeAnimations.delete(element);
      element.textContent = format(end);
    }
  };

  const initialId = requestAnimationFrame(step);
  activeAnimations.set(element, initialId);
}
