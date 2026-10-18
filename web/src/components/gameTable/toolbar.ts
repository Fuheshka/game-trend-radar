import { PlatformType } from '../../types.js';
import { escapeHtml } from '../../utils/dom.js';
import type { TableViewMode } from './types.js';

export interface ToolbarState {
  platformFilter: 'all' | PlatformType;
  viewMode: TableViewMode;
  searchQuery: string;
}

export function renderHeaderToolbar(
  filteredCount: number,
  totalCount: number,
  state: ToolbarState
): string {
  const platforms: Array<{ id: 'all' | PlatformType; label: string }> = [
    { id: 'all', label: 'Все' },
    { id: 'roblox', label: 'Roblox' },
    { id: 'yandex_games', label: 'Яндекс Игры' },
    { id: 'poki', label: 'Poki' },
    { id: 'youtube_trends', label: 'Shorts' },
  ];

  const chipsHtml = platforms
    .map(
      p => `
      <button type="button" class="table-platform-chip ${state.platformFilter === p.id ? 'active' : ''}" data-platform="${p.id}">
        <span>${p.label}</span>
      </button>
    `
    )
    .join('');

  return `
    <div class="steamdb-header-toolbar">
      <div class="steamdb-toolbar-row-top">
        <!-- Quick search in recessed well with Ctrl+K badge -->
        <div class="steamdb-search-well">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="search"
            class="steamdb-search-input"
            placeholder="Поиск по ${totalCount}+ играм (название, жанр, теги)..."
            value="${escapeHtml(state.searchQuery)}"
            autocomplete="off"
            spellcheck="false"
          />
          <kbd class="steamdb-kbd-badge" title="Нажмите Ctrl+K или ⌘K для быстрого фокуса">⌘K</kbd>
        </div>

        <!-- View Mode Toggles: Table (Default) & Grid -->
        <div class="steamdb-view-toggles">
          <button
            type="button"
            class="table-view-toggle-btn ${state.viewMode === 'table' ? 'active' : ''}"
            data-mode="table"
            title="Таблица высокой плотности (SteamDB)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            <span>Таблица</span>
          </button>
          <button
            type="button"
            class="table-view-toggle-btn ${state.viewMode === 'grid' ? 'active' : ''}"
            data-mode="grid"
            title="Сетка карточек"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Сетка</span>
          </button>
        </div>
      </div>

      <div class="steamdb-toolbar-row-bottom">
        <!-- Platform Filter Chips -->
        <div class="steamdb-chips-wrap">
          <span class="chips-label">Платформы:</span>
          ${chipsHtml}
        </div>

        <!-- Counter badge -->
        <div class="steamdb-counter-badge" id="steamdb-count-badge">
          ${filteredCount} из ${totalCount}
        </div>
      </div>
    </div>
  `;
}
