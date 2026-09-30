import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { animateCounter, easeOutQuart } from '../web/src/utils/animation.js';

describe('animateCounter & easeOutQuart', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('easeOutQuart', () => {
    it('должен возвращать 0 при t=0 и 1 при t=1', () => {
      expect(easeOutQuart(0)).toBe(0);
      expect(easeOutQuart(1)).toBe(1);
    });

    it('должен быть строго монотонно возрастающим', () => {
      const v1 = easeOutQuart(0.25);
      const v2 = easeOutQuart(0.5);
      const v3 = easeOutQuart(0.75);
      expect(v1).toBeGreaterThan(0);
      expect(v2).toBeGreaterThan(v1);
      expect(v3).toBeGreaterThan(v2);
      expect(v3).toBeLessThan(1);
    });
  });

  describe('animateCounter', () => {
    it('должен сразу выставлять целевое значение, если start === end', () => {
      const el = { textContent: '' } as unknown as HTMLElement;
      animateCounter(el, 50, 50, 1000);
      expect(el.textContent).toBe('50');
    });

    it('должен сразу выставлять значение при durationMs <= 0', () => {
      const el = { textContent: '' } as unknown as HTMLElement;
      animateCounter(el, 10, 100, 0);
      expect(el.textContent).toBe('100');
    });

    it('должен применять пользовательскую функцию formatFn', () => {
      const el = { textContent: '' } as unknown as HTMLElement;
      const formatFn = (n: number) => `${Math.round(n)}/100`;
      animateCounter(el, 85, 85, 1000, formatFn);
      expect(el.textContent).toBe('85/100');
    });

    it('должен плавно интерполировать значение во времени при наличии RAF', () => {
      let rafCallback: ((time: number) => void) | null = null;
      let nextId = 1;
      const originalRaf = globalThis.requestAnimationFrame;
      const originalCaf = globalThis.cancelAnimationFrame;

      globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
        rafCallback = cb as (time: number) => void;
        return nextId++;
      });
      globalThis.cancelAnimationFrame = vi.fn();

      try {
        const el = { textContent: '' } as unknown as HTMLElement;
        const now = 1000;
        vi.spyOn(performance, 'now').mockReturnValue(now);

        animateCounter(el, 0, 1000, 1000, val => Math.round(val).toString());

        // First frame
        expect(globalThis.requestAnimationFrame).toHaveBeenCalled();
        expect(el.textContent).toBe('0');

        // Advance halfway: 500ms
        vi.spyOn(performance, 'now').mockReturnValue(now + 500);
        if (rafCallback) {
          (rafCallback as (time: number) => void)(now + 500);
        }
        // At 50%, easeOutQuart(0.5) = 1 - (0.5)^4 = 0.9375 -> 938
        expect(el.textContent).toBe('938');

        // Finish animation at 1000ms
        vi.spyOn(performance, 'now').mockReturnValue(now + 1000);
        if (rafCallback) {
          (rafCallback as (time: number) => void)(now + 1000);
        }
        expect(el.textContent).toBe('1000');
      } finally {
        globalThis.requestAnimationFrame = originalRaf;
        globalThis.cancelAnimationFrame = originalCaf;
      }
    });

    it('должен отменять предыдущую анимацию при повторном вызове на том же элементе', () => {
      let nextId = 1;
      const cancelMock = vi.fn();
      const originalRaf = globalThis.requestAnimationFrame;
      const originalCaf = globalThis.cancelAnimationFrame;

      globalThis.requestAnimationFrame = vi.fn(() => nextId++);
      globalThis.cancelAnimationFrame = cancelMock;

      try {
        const el = { textContent: '' } as unknown as HTMLElement;
        animateCounter(el, 0, 100, 1000);
        const firstId = nextId - 1;

        // Call again on the same element
        animateCounter(el, 50, 200, 1000);
        expect(cancelMock).toHaveBeenCalledWith(firstId);
      } finally {
        globalThis.requestAnimationFrame = originalRaf;
        globalThis.cancelAnimationFrame = originalCaf;
      }
    });
  });
});
