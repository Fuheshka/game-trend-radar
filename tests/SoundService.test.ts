import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SoundEffectsService, SOUND_STORAGE_KEY } from '../web/src/services/sound.js';

describe('SoundEffectsService (Автономный процедурный звук через Web Audio API)', () => {
  let mockStorage: Record<string, string>;
  let mockAudioContext: any;
  let createdOscillators: any[];
  let createdGains: any[];
  let createdFilters: any[];

  beforeEach(() => {
    mockStorage = {};

    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    });

    createdOscillators = [];
    createdGains = [];
    createdFilters = [];

    // Mock Web Audio API
    mockAudioContext = {
      state: 'running',
      currentTime: 10.0,
      resume: vi.fn().mockResolvedValue(undefined),
      destination: {},
      createOscillator: vi.fn(() => {
        const osc = {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        createdOscillators.push(osc);
        return osc;
      }),
      createGain: vi.fn(() => {
        const gain = {
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
        createdGains.push(gain);
        return gain;
      }),
      createBiquadFilter: vi.fn(() => {
        const filter = {
          type: 'lowpass',
          frequency: {
            setValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
        createdFilters.push(filter);
        return filter;
      }),
    };

    class MockAudioContextClass {
      constructor() {
        return mockAudioContext;
      }
    }

    vi.stubGlobal('AudioContext', MockAudioContextClass);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('1. Инициализация и состояние Mute (Web Autoplay Compliance)', () => {
    it('должен по умолчанию выключать звук (isMuted = true), если localStorage пуст', () => {
      const service = new SoundEffectsService();
      expect(service.isMuted()).toBe(true);
    });

    it('должен считывать сохраненное состояние из localStorage, если оно равно false', () => {
      mockStorage[SOUND_STORAGE_KEY] = 'false';
      const service = new SoundEffectsService();
      expect(service.isMuted()).toBe(false);
    });

    it('должен переключать состояние через toggleMute() и сохранять в localStorage', () => {
      const service = new SoundEffectsService();
      expect(service.isMuted()).toBe(true);

      const unmuted = service.toggleMute();
      expect(unmuted).toBe(false);
      expect(service.isMuted()).toBe(false);
      expect(mockStorage[SOUND_STORAGE_KEY]).toBe('false');

      const mutedAgain = service.toggleMute();
      expect(mutedAgain).toBe(true);
      expect(service.isMuted()).toBe(true);
      expect(mockStorage[SOUND_STORAGE_KEY]).toBe('true');
    });

    it('должен корректно обновлять состояние через setMuted()', () => {
      const service = new SoundEffectsService();
      service.setMuted(false);
      expect(service.isMuted()).toBe(false);
      expect(mockStorage[SOUND_STORAGE_KEY]).toBe('false');

      service.setMuted(true);
      expect(service.isMuted()).toBe(true);
      expect(mockStorage[SOUND_STORAGE_KEY]).toBe('true');
    });
  });

  describe('2. Абсолютная тишина при Muted', () => {
    it('не должен создавать узлы и осцилляторы при playClick(), если звук выключен', () => {
      const service = new SoundEffectsService();
      service.setMuted(true);

      service.playClick();
      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
      expect(mockAudioContext.createGain).not.toHaveBeenCalled();
      expect(createdOscillators.length).toBe(0);
    });

    it('не должен создавать узлы при playRadarPing(), если звук выключен', () => {
      const service = new SoundEffectsService();
      service.setMuted(true);

      service.playRadarPing();
      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
      expect(createdOscillators.length).toBe(0);
    });

    it('не должен создавать узлы при playScanFinish(), если звук выключен', () => {
      const service = new SoundEffectsService();
      service.setMuted(true);

      service.playScanFinish();
      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
      expect(createdOscillators.length).toBe(0);
    });
  });

  describe('3. Синтез процедурных звуков при активном звуке', () => {
    it('playClick(): должен создавать мягкий тактильный щелчок с Lowpass-фильтром (30 мс)', () => {
      const service = new SoundEffectsService();
      service.setMuted(false);

      service.playClick();

      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);
      expect(mockAudioContext.createGain).toHaveBeenCalledTimes(1);
      expect(mockAudioContext.createBiquadFilter).toHaveBeenCalledTimes(1);

      const osc = createdOscillators[0];
      const gain = createdGains[0];
      const filter = createdFilters[0];

      expect(osc.type).toBe('triangle');
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(680, 10.0);
      expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(320, 10.03);

      expect(filter.frequency.setValueAtTime).toHaveBeenCalledWith(1200, 10.0);
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.045, 10.0);
      expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 10.03);

      expect(osc.start).toHaveBeenCalledWith(10.0);
      expect(osc.stop).toHaveBeenCalledWith(10.03);
    });

    it('playRadarPing(): должен создавать теплый сонарный импульс с мягкой атакой и гармоникой', () => {
      const service = new SoundEffectsService();
      service.setMuted(false);

      service.playRadarPing();

      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);
      expect(mockAudioContext.createGain).toHaveBeenCalledTimes(2);
      expect(mockAudioContext.createBiquadFilter).toHaveBeenCalledTimes(1);

      const [osc1, osc2] = createdOscillators;
      expect(osc1.frequency.setValueAtTime).toHaveBeenCalledWith(440, 10.0);
      expect(osc1.stop).toHaveBeenCalledWith(10.15);

      expect(osc2.frequency.setValueAtTime).toHaveBeenCalledWith(880, 10.0);
      expect(osc2.stop).toHaveBeenCalledWith(10.09);
    });

    it('playScanFinish(): должен генерировать мягкий мажорный аккорд из 3 нот через фильтр', () => {
      const service = new SoundEffectsService();
      service.setMuted(false);

      service.playScanFinish();

      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(3);
      expect(mockAudioContext.createGain).toHaveBeenCalledTimes(3);
      expect(mockAudioContext.createBiquadFilter).toHaveBeenCalledTimes(1);

      const expectedFreqs = [349.23, 440.0, 523.25];
      createdOscillators.forEach((osc, idx) => {
        const expectedStartTime = 10.0 + idx * 0.045;
        expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(expectedFreqs[idx], expectedStartTime);
        expect(osc.start).toHaveBeenCalledWith(expectedStartTime);
        expect(osc.stop).toHaveBeenCalledWith(expectedStartTime + 0.24);
      });
    });
  });

  describe('4. Безопасность и возобновление AudioContext', () => {
    it('должен вызывать resume(), если AudioContext был suspended', () => {
      mockAudioContext.state = 'suspended';
      const service = new SoundEffectsService();
      service.setMuted(false);

      service.playClick();
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('не должен падать при возникновении исключений в закрытом аудиоконтексте', () => {
      mockAudioContext.createOscillator.mockImplementation(() => {
        throw new Error('AudioContext is closed');
      });

      const service = new SoundEffectsService();
      service.setMuted(false);

      expect(() => service.playClick()).not.toThrow();
      expect(() => service.playRadarPing()).not.toThrow();
      expect(() => service.playScanFinish()).not.toThrow();
    });
  });
});
