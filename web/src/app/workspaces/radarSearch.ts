/**
 * Поиск вкладки «Радар»: поле `#search-input` с кнопкой × и чипсы популярных запросов.
 * Запрос живёт в `state.filters.searchQuery`; после изменения зовётся `onChange` (перерисовка радара).
 */
import { soundService } from '../../services/sound.js';
import { escapeHtml } from '../../utils/dom.js';
import { POPULAR_SEARCH_TAGS, PopularSearchTag, isTagActive, countGamesForTag } from '../search.js';
import type { AppState } from '../state.js';

export interface RadarSearchDeps {
  state: AppState;
  /** Запрос изменился: перерисовать радар и карточки. */
  onChange: () => void;
}

export class RadarSearch {
  constructor(private readonly deps: RadarSearchDeps) {}

  /** Search input & quick clear button */
  bind(): void {
    const { state } = this.deps;
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    const searchClearBtn = document.getElementById('search-clear-btn');

    const updateSearchClearVisibility = () => {
      if (searchClearBtn) {
        searchClearBtn.classList.toggle('visible', !!searchInput?.value.trim());
      }
    };

    searchInput?.addEventListener('input', e => {
      state.filters.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
      updateSearchClearVisibility();
      this.updateActiveSearchTagUI();
      this.deps.onChange();
    });

    searchClearBtn?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      state.filters.searchQuery = '';
      updateSearchClearVisibility();
      this.updateActiveSearchTagUI();
      soundService.playClick();
      this.deps.onChange();
    });
  }

  renderSearchTags(): void {
    const { state } = this.deps;
    const scrollContainer = document.getElementById('search-tags-scroll');
    if (!scrollContainer) return;

    scrollContainer.innerHTML = '';

    for (const tag of POPULAR_SEARCH_TAGS) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'search-tag-chip';
      chip.setAttribute('data-tag-id', tag.id);
      chip.setAttribute('data-query', tag.query);
      chip.setAttribute('data-label', tag.label);

      const isActive = isTagActive(tag, state.filters.searchQuery);
      if (isActive) {
        chip.classList.add('active');
      }

      const matchCount = countGamesForTag(tag, state.snapshot);
      const countBadge = matchCount > 0 ? `<span class="search-tag-count">${matchCount}</span>` : '';

      chip.innerHTML = `
        <span class="search-tag-text">${escapeHtml(tag.label)}</span>
        ${countBadge}
      `;

      chip.addEventListener('click', () => {
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        const searchClearBtn = document.getElementById('search-clear-btn');
        soundService.playClick();

        if (isTagActive(tag, state.filters.searchQuery)) {
          // Toggle off if currently active
          if (searchInput) searchInput.value = '';
          state.filters.searchQuery = '';
          if (searchClearBtn) searchClearBtn.classList.remove('visible');
        } else {
          // Apply tag filter
          if (searchInput) searchInput.value = tag.label;
          state.filters.searchQuery = tag.query.toLowerCase();
          if (searchClearBtn) searchClearBtn.classList.add('visible');
        }

        this.updateActiveSearchTagUI();
        this.deps.onChange();
      });

      scrollContainer.appendChild(chip);
    }
  }

  updateActiveSearchTagUI(): void {
    const chips = document.querySelectorAll<HTMLButtonElement>('.search-tag-chip');
    chips.forEach(chip => {
      const q = chip.getAttribute('data-query') || '';
      const label = chip.getAttribute('data-label') || '';
      const tag: PopularSearchTag = { id: chip.getAttribute('data-tag-id') || '', label, query: q };
      chip.classList.toggle('active', isTagActive(tag, this.deps.state.filters.searchQuery));
    });
  }

  /** Тег из карточки вердикта: подставляет текст в поиск. false — поля поиска нет. */
  setQueryFromCardTag(tag: string): boolean {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (!searchInput) return false;
    searchInput.value = tag;
    this.deps.state.filters.searchQuery = tag.toLowerCase();
    return true;
  }

  /** Запрос из сигнала тикера или drawer'а: поле, кнопка × и состояние. */
  setQuery(query: string): void {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    const searchClearBtn = document.getElementById('search-clear-btn');
    if (searchInput) {
      searchInput.value = query;
      this.deps.state.filters.searchQuery = query.toLowerCase();
    }
    if (searchClearBtn) {
      searchClearBtn.classList.toggle('visible', !!query.trim());
    }
  }

  /** Esc: очистить поле и кнопку × (запрос в state сбрасывает вызывающий). */
  clearInput(): void {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    const searchClearBtn = document.getElementById('search-clear-btn');
    if (searchInput) searchInput.value = '';
    if (searchClearBtn) searchClearBtn.classList.remove('visible');
  }

  /** ⌘K вне каталога. */
  focus(): void {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput?.focus();
    searchInput?.select();
  }
}
