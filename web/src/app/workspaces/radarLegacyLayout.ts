/**
 * Запасная раскладка вкладки «Радар» — если в разметке нет `#radar-overview-container`:
 * отдельные `RadarChart` и `VerdictCards` с делегированием кликов по карточкам.
 * В текущем index.html контейнер есть, так что путь не используется; перенесён из main.ts как есть.
 */
import { MarketVerdict, GameArchetype } from '../../types.js';
import { RadarChartComponent } from '../../components/RadarChart.js';
import { VerdictCardsComponent } from '../../components/VerdictCards.js';
import type { AppState } from '../state.js';
import type { DrawerController } from '../drawerController.js';

export interface RadarLegacyLayoutDeps {
  state: AppState;
  drawer: Pick<DrawerController, 'openArchetypeDetail' | 'openGameDetail' | 'openPromptModalForArchetype'>;
  getFilteredVerdicts: () => MarketVerdict[];
  onSelectArchetype: (archetype: GameArchetype | null) => void;
  onSelectTag: (tag: string) => void;
}

export function mountRadarLegacyLayout(deps: RadarLegacyLayoutDeps): {
  radarChart?: RadarChartComponent;
  verdictCards?: VerdictCardsComponent;
} {
  const { state, drawer } = deps;
  const radarContainer = document.getElementById('radar-chart-container');
  const verdictsContainer = document.getElementById('verdicts-container');
  let radarChart: RadarChartComponent | undefined;
  let verdictCards: VerdictCardsComponent | undefined;

  if (radarContainer) {
    radarChart = new RadarChartComponent({
      container: radarContainer,
      verdicts: state.snapshot.verdicts,
      activeArchetype: state.filters.archetype,
      onSelectArchetype: archetype => deps.onSelectArchetype(archetype),
    });

    // Delegated click on radar chart blips/points
    radarContainer.addEventListener('click', e => {
      const target = e.target as SVGElement;
      const blip = target.closest('.radar-blip-group, .polar-blip-group') as SVGElement;
      if (blip) {
        if (state.filters.archetype) {
          drawer.openArchetypeDetail(state.filters.archetype);
        }
      }
    });
  }

  if (verdictsContainer) {
    verdictCards = new VerdictCardsComponent({
      container: verdictsContainer,
      verdicts: deps.getFilteredVerdicts(),
      previousVerdicts: state.previousSnapshot?.verdicts,
      onSelectTag: tag => deps.onSelectTag(tag),
    });

    // Event delegation for clicks on chips, tags, and verdict cards
    verdictsContainer.addEventListener('click', e => {
      const target = e.target as HTMLElement;

      // 0. Click on "Сгенерировать ТЗ для ИИ" button inside card
      const promptBtn = target.closest('.btn-generate-ai-spec') as HTMLElement;
      if (promptBtn) {
        e.stopPropagation();
        const arch = promptBtn.getAttribute('data-archetype') as GameArchetype;
        if (arch) {
          drawer.openPromptModalForArchetype(arch);
        }
        return;
      }

      // 1. Click on game sample chip
      const chip = target.closest('.game-sample-chip') as HTMLElement;
      if (chip) {
        e.stopPropagation();
        const card = chip.closest('.verdict-card') as HTMLElement;
        const arch = card?.getAttribute('data-archetype') as GameArchetype | undefined;
        const title = chip.getAttribute('title') || chip.textContent?.trim() || '';
        drawer.openGameDetail(title, arch);
        return;
      }

      // 2. Click on archetype tag inside card
      const tagChip = target.closest('.card-archetype-tag') as HTMLElement;
      if (tagChip) {
        e.stopPropagation();
        const card = tagChip.closest('.verdict-card') as HTMLElement;
        const arch = card?.getAttribute('data-archetype') as GameArchetype;
        if (arch) {
          drawer.openArchetypeDetail(arch);
        }
        return;
      }

      // 3. Click on verdict card itself
      const card = target.closest('.verdict-card') as HTMLElement;
      if (card) {
        const arch = card.getAttribute('data-archetype') as GameArchetype;
        if (arch) {
          drawer.openArchetypeDetail(arch);
        }
      }
    });
  }

  return { radarChart, verdictCards };
}
