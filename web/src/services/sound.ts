export const SOUND_STORAGE_KEY = 'game_trend_radar_muted';

export interface SoundServiceOptions {
  audioContext?: AudioContext | null;
  storage?: Storage | null;
}

export class SoundEffectsService {
  private ctx: AudioContext | null = null;
  private isMutedState: boolean = true;
  private customStorage: Storage | null = null;
  private unlockListenersAttached: boolean = false;

  constructor(options?: SoundServiceOptions) {
    if (options?.audioContext) {
      this.ctx = options.audioContext;
    }
    if (options?.storage !== undefined) {
      this.customStorage = options.storage;
    }
    this.initMuteState();
    this.attachUnlockListeners();
  }

  private getStorage(): Storage | null {
    if (this.customStorage !== null) return this.customStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return null;
  }

  /**
   * Загрузка сохраненного состояния из localStorage.
   * По умолчанию звук выключен (muted: true) для соблюдения политик автоплея.
   */
  private initMuteState(): void {
    try {
      const storage = this.getStorage();
      if (storage) {
        const saved = storage.getItem(SOUND_STORAGE_KEY);
        this.isMutedState = saved === null ? true : saved === 'true';
      }
    } catch {
      this.isMutedState = true;
    }
  }

  /**
   * Навешивание слушателей первого пользовательского взаимодействия
   * для безопасного пробуждения AudioContext.
   */
  private attachUnlockListeners(): void {
    if (typeof window === 'undefined' || this.unlockListenersAttached) return;
    this.unlockListenersAttached = true;

    const unlockHandler = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    };

    window.addEventListener('click', unlockHandler, { once: true, passive: true });
    window.addEventListener('keydown', unlockHandler, { once: true, passive: true });
    window.addEventListener('touchstart', unlockHandler, { once: true, passive: true });
  }

  /**
   * Ленивая инициализация и пробуждение AudioContext.
   */
  public getContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx =
        (typeof AudioContext !== 'undefined' ? AudioContext : null) ||
        (typeof window !== 'undefined'
          ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          : null);

      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          this.ctx = null;
        }
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public setMuted(muted: boolean): void {
    this.isMutedState = muted;
    try {
      const storage = this.getStorage();
      if (storage) {
        storage.setItem(SOUND_STORAGE_KEY, String(muted));
      }
    } catch {
      // Игнорируем ошибки приватного режима
    }

    if (!muted) {
      this.getContext();
    }
  }

  public toggleMute(): boolean {
    const nextMuted = !this.isMutedState;
    this.setMuted(nextMuted);
    return this.isMutedState;
  }

  /**
   * 1. Мягкий тактильный микро-щелчок (Haptic Tap).
   * Низкий треугольный импульс (680 -> 320 Гц) через Lowpass-фильтр (1200 Гц)
   * с деликатной громкостью (0.045) и затуханием 30 мс.
   * Звучит как физическая клавиша / трекпад без пищащих призвуков.
   */
  public playClick(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.03; // 30 мс

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + duration);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);

      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Защита от сбоев
    }
  }

  /**
   * 2. Теплый сонарный импульс радара (Deep Mellow Sonar).
   * Одиночный мягкий тон 440 Гц (нота A4) с мягкой атакой (6 мс) и обертоном 880 Гц (15% громкости)
   * через Lowpass-фильтр (1600 Гц). Затухание 150 мс.
   * Звучит атмосферно, глубоко и не режет слух.
   */
  public playRadarPing(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.15; // 150 мс

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);

      // Основной теплый тон (440 Гц)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);

      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.linearRampToValueAtTime(0.06, now + 0.006);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc1.connect(filter);
      filter.connect(gain1);
      gain1.connect(ctx.destination);

      // Легкий воздушный флажолет (880 Гц)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now);

      gain2.gain.setValueAtTime(0.0001, now);
      gain2.gain.linearRampToValueAtTime(0.015, now + 0.006);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc2.connect(filter);
      filter.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + duration);
      osc2.start(now);
      osc2.stop(now + 0.09);
    } catch {
      // Защита от сбоев
    }
  }

  /**
   * 3. Мягкий эмбиентный аккорд завершения (Warm Ambient Chord).
   * Гармоническое мажорное трезвучие (F4 349.2 Гц, A4 440.0 Гц, C5 523.2 Гц)
   * с мягкой атакой (10 мс) и затуханием 240 мс через Lowpass-фильтр (2000 Гц).
   * Исключает аркадные синтезаторные призвуки, звучит благородно и ненавязчиво.
   */
  public playScanFinish(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const chord = [349.23, 440.0, 523.25];
      const stepDelay = 0.045; // 45 мс между нотами
      const noteDuration = 0.24; // 240 мс затухание

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, now);

      chord.forEach((freq, idx) => {
        const startTime = now + idx * stepDelay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.035, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDuration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + noteDuration);
      });
    } catch {
      // Защита от сбоев
    }
  }
}

export const soundService = new SoundEffectsService();
