import {
  GameArchetype,
  MarketVerdict,
  ArbitrageOpportunity,
  NormalizedGame,
} from '../types.js';
import type { TargetEngine, TargetStore, AiAssistant, PromptContext } from './promptGenerator/types.js';
import { compileGddPrompt } from './promptGenerator/compileGddPrompt.js';
import { buildModalHtml } from './promptGenerator/modalTemplate.js';

export type { TargetEngine, TargetStore, AiAssistant, PromptContext } from './promptGenerator/types.js';
export { compileGddPrompt } from './promptGenerator/compileGddPrompt.js';

export interface PromptGeneratorModalOptions {
  onClose?: () => void;
  showToast?: (message: string) => void;
}

export class PromptGeneratorModalComponent {
  private modalEl!: HTMLElement;
  private backdropEl!: HTMLElement;
  private currentContext: PromptContext;
  private options: PromptGeneratorModalOptions;
  private boundOnKeyDown: (e: KeyboardEvent) => void;

  constructor(options: PromptGeneratorModalOptions = {}) {
    this.options = options;
    this.currentContext = {
      targetEngine: 'vite_canvas',
      archetype: 'SIMULATION_INCREMENTAL',
      targetStore: 'yandex_games',
      aiAssistant: 'cursor',
    };

    this.boundOnKeyDown = this.handleKeyDown.bind(this);
    this.createDom();
    this.attachEvents();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    // Backdrop
    this.backdropEl = document.createElement('div');
    this.backdropEl.className = 'prompt-modal-backdrop';
    this.backdropEl.id = 'prompt-modal-backdrop';

    // Dialog
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'prompt-modal-dialog';
    this.modalEl.id = 'prompt-modal-dialog';
    this.modalEl.setAttribute('role', 'dialog');
    this.modalEl.setAttribute('aria-modal', 'true');
    this.modalEl.setAttribute('aria-label', 'Генератор ТЗ для ИИ');

    this.backdropEl.appendChild(this.modalEl);
    document.body.appendChild(this.backdropEl);
  }

  private attachEvents(): void {
    if (typeof document === 'undefined' || !this.backdropEl) return;

    // Backdrop click outside closes dialog
    this.backdropEl.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.backdropEl) {
        this.close();
      }
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.close();
    }
  }

  public open(
    verdict?: MarketVerdict,
    games?: NormalizedGame[],
    arbitrage?: ArbitrageOpportunity,
    initialEngine?: TargetEngine
  ): void {
    const archetype: GameArchetype =
      verdict?.archetype || arbitrage?.archetype || 'SIMULATION_INCREMENTAL';

    let defaultEngine: TargetEngine = initialEngine || 'vite_canvas';
    if (!initialEngine) {
      if (archetype === 'PHYSICS_SANDBOX' || archetype === 'ACTION_SHOOTER') {
        defaultEngine = 'unity_webgl';
      } else if (archetype === 'SURVIVAL_HORROR' || archetype === 'OBBY_PARKOUR') {
        defaultEngine = 'godot_4';
      } else if (arbitrage) {
        defaultEngine = 'vite_canvas';
      }
    }

    this.currentContext = {
      targetEngine: defaultEngine,
      archetype,
      targetStore: defaultEngine === 'roblox_studio' ? 'roblox' : 'yandex_games',
      aiAssistant: this.currentContext.aiAssistant || 'cursor',
      verdict,
      games,
      arbitrage,
    };

    this.render();
    if (typeof document !== 'undefined') {
      this.backdropEl?.classList.add('active');
      document.addEventListener('keydown', this.boundOnKeyDown);
    }
  }

  public close(): void {
    if (typeof document !== 'undefined') {
      this.backdropEl?.classList.remove('active');
      document.removeEventListener('keydown', this.boundOnKeyDown);
    }
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  public setEngine(engine: TargetEngine): void {
    this.currentContext.targetEngine = engine;
    if (engine === 'roblox_studio') {
      this.currentContext.targetStore = 'roblox';
    } else if (this.currentContext.targetStore === 'roblox') {
      this.currentContext.targetStore = 'yandex_games';
    }
    this.render();
  }

  public setAiAssistant(assistant: AiAssistant): void {
    this.currentContext.aiAssistant = assistant;
    this.render();
  }

  public setStore(store: TargetStore): void {
    this.currentContext.targetStore = store;
    this.render();
  }

  public getCompiledPrompt(): string {
    return compileGddPrompt(this.currentContext);
  }

  public getContext(): Readonly<PromptContext> {
    return { ...this.currentContext };
  }

  private render(): void {
    if (typeof document === 'undefined' || !this.modalEl) return;
    const promptText = this.getCompiledPrompt();
    const title =
      this.currentContext.arbitrage?.suggestedRuTitle ||
      this.currentContext.verdict?.titleRu ||
      this.currentContext.archetype;

    const charCount = promptText.length;
    const wordCount = promptText.split(/\s+/).filter(Boolean).length;

    this.modalEl.innerHTML = buildModalHtml(this.currentContext, title, promptText, wordCount, charCount);

    this.wireModalInteractions();
  }

  private wireModalInteractions(): void {
    // Close button
    const closeBtn = this.modalEl.querySelector('#prompt-modal-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    // Engine buttons
    const engineBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('.prompt-engine-btn');
    engineBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const eng = btn.getAttribute('data-engine') as TargetEngine;
        if (eng) this.setEngine(eng);
      });
    });

    // Assistant buttons
    const assistantBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('[data-assistant]');
    assistantBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const ast = btn.getAttribute('data-assistant') as AiAssistant;
        if (ast) this.setAiAssistant(ast);
      });
    });

    // Store buttons
    const storeBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('[data-store]');
    storeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const str = btn.getAttribute('data-store') as TargetStore;
        if (str) this.setStore(str);
      });
    });

    // Copy button
    const copyBtn = this.modalEl.querySelector('#prompt-btn-copy') as HTMLButtonElement;
    copyBtn?.addEventListener('click', () => this.copyPrompt(copyBtn));

    // Download button
    const downloadBtn = this.modalEl.querySelector('#prompt-btn-download') as HTMLButtonElement;
    downloadBtn?.addEventListener('click', () => this.downloadMarkdown());
  }

  public async copyPrompt(btn?: HTMLButtonElement): Promise<void> {
    const text = this.getCompiledPrompt();
    let copied = false;

    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        copied = true;
      } catch {
        copied = false;
      }
      document.body.removeChild(textarea);
    }

    if (btn) {
      btn.classList.add('copied');
      const span = btn.querySelector('span');
      const originalText = span ? span.textContent : 'Скопировать ТЗ';
      if (span) span.textContent = 'Скопировано!';

      setTimeout(() => {
        btn.classList.remove('copied');
        if (span) span.textContent = originalText;
      }, 2000);
    }

    if (this.options.showToast) {
      this.options.showToast('Готовое ТЗ для ИИ скопировано в буфер обмена!');
    }
  }

  public downloadMarkdown(): void {
    const text = this.getCompiledPrompt();
    const slug = (
      this.currentContext.arbitrage?.suggestedRuTitle ||
      this.currentContext.verdict?.archetype ||
      'game-spec'
    )
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '_');

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GDD_Spec_${slug}_${this.currentContext.targetEngine}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (this.options.showToast) {
      this.options.showToast('Файл ТЗ скачан в формате Markdown (.md)');
    }
  }

}
