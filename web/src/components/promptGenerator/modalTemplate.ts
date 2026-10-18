import { escapeHtml } from '../../utils/dom.js';
import type { PromptContext } from './types.js';

export function buildModalHtml(
  context: PromptContext,
  title: string,
  promptText: string,
  wordCount: number,
  charCount: number
): string {
  return `
      <div class="prompt-modal-header">
        <div class="prompt-modal-title-group">
          <div class="prompt-modal-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>Генератор ТЗ для ИИ</span>
          </div>
          <h3 class="prompt-modal-title">ТЗ для ИИ: ${escapeHtml(title)}</h3>
          <span class="prompt-modal-subtitle">${context.archetype} • Подготовка для Cursor, Claude и ChatGPT</span>
        </div>
        <button type="button" class="prompt-modal-close" id="prompt-modal-close-btn" aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="prompt-modal-controls">
        <!-- Target Engine Tabs -->
        <div class="prompt-control-section">
          <label class="prompt-control-label">Целевой движок / стек:</label>
          <div class="prompt-engine-selector" role="radiogroup">
            <button type="button" class="prompt-engine-btn ${context.targetEngine === 'unity_webgl' ? 'active' : ''}" data-engine="unity_webgl">
              <span class="engine-icon">⚡</span>
              <span class="engine-text">Unity WebGL</span>
            </button>
            <button type="button" class="prompt-engine-btn ${context.targetEngine === 'godot_4' ? 'active' : ''}" data-engine="godot_4">
              <span class="engine-icon">🤖</span>
              <span class="engine-text">Godot 4</span>
            </button>
            <button type="button" class="prompt-engine-btn ${context.targetEngine === 'vite_canvas' ? 'active' : ''}" data-engine="vite_canvas">
              <span class="engine-icon">🚀</span>
              <span class="engine-text">Vite + Canvas</span>
            </button>
            <button type="button" class="prompt-engine-btn ${context.targetEngine === 'roblox_studio' ? 'active' : ''}" data-engine="roblox_studio">
              <span class="engine-icon">🧱</span>
              <span class="engine-text">Roblox Studio</span>
            </button>
          </div>
        </div>

        <!-- Assistant and Store Selectors -->
        <div class="prompt-control-row">
          <div class="prompt-control-col">
            <label class="prompt-control-label">ИИ-ассистент:</label>
            <div class="prompt-pills-selector">
              <button type="button" class="prompt-pill-btn ${context.aiAssistant === 'cursor' ? 'active' : ''}" data-assistant="cursor">Cursor</button>
              <button type="button" class="prompt-pill-btn ${context.aiAssistant === 'claude' ? 'active' : ''}" data-assistant="claude">Claude</button>
              <button type="button" class="prompt-pill-btn ${context.aiAssistant === 'chatgpt' ? 'active' : ''}" data-assistant="chatgpt">ChatGPT</button>
            </div>
          </div>

          <div class="prompt-control-col">
            <label class="prompt-control-label">Целевая витрина:</label>
            <div class="prompt-pills-selector">
              <button type="button" class="prompt-pill-btn ${context.targetStore === 'yandex_games' ? 'active' : ''}" data-store="yandex_games">Яндекс Игры</button>
              <button type="button" class="prompt-pill-btn ${context.targetStore === 'poki' ? 'active' : ''}" data-store="poki">Poki</button>
              <button type="button" class="prompt-pill-btn ${context.targetStore === 'roblox' ? 'active' : ''}" data-store="roblox">Roblox</button>
              <button type="button" class="prompt-pill-btn ${context.targetStore === 'general_web' ? 'active' : ''}" data-store="general_web">Web 2D/3D</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Content Preview with Action Bar -->
      <div class="prompt-modal-body">
        <div class="prompt-preview-toolbar">
          <div class="prompt-meta-stats">
            <span class="stat-pill">${wordCount} слов</span>
            <span class="stat-pill">${charCount.toLocaleString()} символов</span>
            <span class="stat-pill accent">Готово к копированию</span>
          </div>
          <div class="prompt-toolbar-actions">
            <button type="button" class="prompt-action-btn secondary" id="prompt-btn-download">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Скачать .md</span>
            </button>
            <button type="button" class="prompt-action-btn primary" id="prompt-btn-copy">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Скопировать ТЗ</span>
            </button>
          </div>
        </div>

        <div class="prompt-preview-container">
          <pre><code class="prompt-code-output" id="prompt-code-output">${escapeHtml(promptText)}</code></pre>
        </div>
      </div>
    `;
}
