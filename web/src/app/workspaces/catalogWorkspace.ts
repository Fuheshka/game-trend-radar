/**
 * Вкладка «Каталог»: панель `.catalog-toolbar` из index.html и таблица/сетка `GameTableView`.
 * Таблица монтируется при первом открытии вкладки; до этого панель только запоминает значения в DOM.
 */
import { GameTableViewComponent, TableSortColumn, TableSortDirection } from '../../components/GameTableView.js';
import { soundService } from '../../services/sound.js';
import { pickOption } from '../../utils/dom.js';
import type { AppState } from '../state.js';
import { PLATFORM_FILTERS } from '../verdictFilters.js';
import type { Workspace, WorkspaceDrawer } from './workspace.js';

/** Значения селекта сортировки каталога → колонка и направление таблицы. */
export const CATALOG_SORTS: Record<string, [TableSortColumn, TableSortDirection]> = {
  ccu_desc: ['ccu', 'desc'],
  ccu_asc: ['ccu', 'asc'],
  likes_desc: ['likes', 'desc'],
  title_asc: ['title', 'asc'],
};

export interface CatalogWorkspaceDeps {
  state: AppState;
  drawer: Pick<WorkspaceDrawer, 'openGameFromList'>;
}

export class CatalogWorkspace implements Workspace {
  private gameTableView?: GameTableViewComponent;

  constructor(private readonly deps: CatalogWorkspaceDeps) {}

  /** Обработчики панели каталога: Min CCU, поиск, витрины, сортировка, вид. */
  bindToolbar(): void {
    // Catalog Min CCU Slider & Presets
    const ccuSlider = document.getElementById('catalog-ccu-slider') as HTMLInputElement;
    const ccuPresets = document.querySelectorAll<HTMLButtonElement>('.ccu-preset-btn');

    const updateSliderUI = (val: number) => {
      updateCcuSliderBadge(val);
      ccuPresets.forEach(btn => {
        const presetVal = parseInt(btn.getAttribute('data-ccu') || '0', 10);
        btn.classList.toggle('active', presetVal === val);
      });
      if (this.gameTableView) {
        this.gameTableView.setMinCcu(val);
        this.updateCountUI();
      }
    };

    ccuSlider?.addEventListener('input', e => {
      const val = parseInt((e.target as HTMLInputElement).value, 10) || 0;
      updateSliderUI(val);
    });

    ccuPresets.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.getAttribute('data-ccu') || '0', 10);
        if (ccuSlider) ccuSlider.value = val.toString();
        soundService.playClick();
        updateSliderUI(val);
      });
    });

    // Catalog Search Input & quick clear button
    const catalogSearchInput = document.getElementById('catalog-search-input') as HTMLInputElement;
    const catalogClearBtn = document.getElementById('catalog-search-clear-btn');

    const updateCatalogClearVisibility = () => {
      if (catalogClearBtn) {
        catalogClearBtn.classList.toggle('visible', !!catalogSearchInput?.value.trim());
      }
    };

    catalogSearchInput?.addEventListener('input', e => {
      const query = (e.target as HTMLInputElement).value;
      updateCatalogClearVisibility();
      if (this.gameTableView) {
        this.gameTableView.setSearchQuery(query);
        this.updateCountUI();
      }
    });

    catalogClearBtn?.addEventListener('click', () => {
      if (catalogSearchInput) {
        catalogSearchInput.value = '';
        catalogSearchInput.focus();
      }
      updateCatalogClearVisibility();
      soundService.playClick();
      if (this.gameTableView) {
        this.gameTableView.setSearchQuery('');
        this.updateCountUI();
      }
    });

    // Catalog Platform Filter Pills
    const catalogPlatformPills = document.querySelectorAll<HTMLButtonElement>('[data-catalog-platform]');
    catalogPlatformPills.forEach(pill => {
      pill.addEventListener('click', () => {
        catalogPlatformPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const platform = pickOption(pill.getAttribute('data-catalog-platform'), PLATFORM_FILTERS) ?? 'all';
        soundService.playClick();
        if (this.gameTableView) {
          this.gameTableView.setPlatform(platform);
          this.updateCountUI();
        }
      });
    });

    // Catalog Sort Select
    const catalogSortSelect = document.getElementById('catalog-sort-select') as HTMLSelectElement;
    catalogSortSelect?.addEventListener('change', e => {
      const sort = CATALOG_SORTS[(e.target as HTMLSelectElement).value];
      soundService.playClick();
      if (this.gameTableView && sort) {
        this.gameTableView.setSort(sort[0], sort[1]);
      }
    });

    // Catalog View Mode Toggles (Grid / Table)
    const btnViewGrid = document.getElementById('btn-view-grid');
    const btnViewTable = document.getElementById('btn-view-table');

    btnViewGrid?.addEventListener('click', () => {
      btnViewGrid.classList.add('active');
      btnViewTable?.classList.remove('active');
      soundService.playClick();
      this.gameTableView?.setViewMode('grid');
    });

    btnViewTable?.addEventListener('click', () => {
      btnViewTable.classList.add('active');
      btnViewGrid?.classList.remove('active');
      soundService.playClick();
      this.gameTableView?.setViewMode('table');
    });
  }

  show(): void {
    this.mount();
    this.updateCountUI();
  }

  /** Game Table View Component setup (SteamDB Charts high density view) */
  private mount(): void {
    const catalogContainer = document.getElementById('catalog-container');
    if (this.gameTableView || !catalogContainer) return;
    const { state } = this.deps;
    this.gameTableView = new GameTableViewComponent({
      container: catalogContainer,
      games: state.snapshot.games || [],
      verdicts: state.snapshot.verdicts || [],
      initialViewMode: 'table',
      onSelectGame: game => {
        this.deps.drawer.openGameFromList(game);
      },
      // TODO: мёртвый путь — чипсы `.catalog-tag-chip` сейчас нигде не рендерятся (§31); перенесено как есть
      onTagClick: tag => {
        soundService.playClick();
        const catalogSearchInput = document.getElementById('catalog-search-input') as HTMLInputElement;
        if (catalogSearchInput) {
          // Через событие input: тот же путь, что ручной ввод (фильтр, счётчик, кнопка ×)
          catalogSearchInput.value = tag;
          catalogSearchInput.dispatchEvent(new Event('input'));
        }
      },
      onFilterChange: () => {
        this.updateCountUI();
      },
      // Клик по заголовку таблицы: селект показывает совпадающий пресет или пустое значение
      onSortChange: (column, direction) => {
        const select = document.getElementById('catalog-sort-select') as HTMLSelectElement | null;
        if (!select) return;
        const preset = Object.keys(CATALOG_SORTS).find(
          k => CATALOG_SORTS[k][0] === column && CATALOG_SORTS[k][1] === direction
        );
        select.value = preset ?? '';
      },
    });
    this.updateCountUI();
  }

  update(): void {
    const { snapshot } = this.deps.state;
    this.gameTableView?.updateData(snapshot.games || [], snapshot.verdicts || []);
    this.updateCountUI();
  }

  /** Бейдж вкладки и «Отображается N из M» — считаются по снимку, даже пока таблица не смонтирована. */
  updateCountUI(): void {
    const { snapshot } = this.deps.state;
    const countText = document.getElementById('catalog-count-text');
    const tabBadge = document.getElementById('tab-games-count');
    const total = snapshot.games?.length || snapshot.totalGamesScanned || 0;
    const filtered = this.gameTableView ? this.gameTableView.getFilteredCount() : total;

    if (tabBadge) {
      tabBadge.textContent = total.toString();
    }
    if (countText) {
      countText.textContent = `Отображается ${filtered} из ${total}`;
    }
  }

  /** ⌘K на вкладке каталога: фокус в поиск каталога. false — поля нет. */
  focusSearch(): boolean {
    const tableSearchInput = document.getElementById('catalog-search-input') as HTMLInputElement;
    if (!tableSearchInput) return false;
    tableSearchInput.focus();
    tableSearchInput.select();
    return true;
  }

  /** Esc: очистить поле поиска каталога и кнопку ×. */
  clearSearchInput(): void {
    const catalogSearchInput = document.getElementById('catalog-search-input') as HTMLInputElement;
    const catalogClearBtn = document.getElementById('catalog-search-clear-btn');
    if (catalogSearchInput) catalogSearchInput.value = '';
    if (catalogClearBtn) catalogClearBtn.classList.remove('visible');
  }

  /** Esc: сбросить фильтр поиска таблицы. */
  resetSearchFilter(): void {
    if (this.gameTableView) {
      this.gameTableView.setSearchQuery('');
      this.updateCountUI();
    }
  }
}

function updateCcuSliderBadge(val: number): void {
  const badge = document.getElementById('catalog-ccu-val-text');
  if (badge) {
    if (val === 0) {
      badge.textContent = '0';
    } else if (val >= 100000) {
      badge.textContent = '100k+';
    } else if (val >= 1000) {
      badge.textContent = `${Math.round(val / 1000)}k`;
    } else {
      badge.textContent = val.toLocaleString();
    }
  }
}
