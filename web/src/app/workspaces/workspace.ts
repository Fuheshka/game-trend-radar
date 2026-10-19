import { NormalizedGame, GameArchetype } from '../../types.js';

/**
 * Контроллер вкладки. Тяжёлые вкладки создают компонент лениво — в `show()` при первом открытии;
 * `update()` перерисовывает уже смонтированный компонент по `state.snapshot` и не монтирует новый.
 */
export interface Workspace {
  show(): void;
  update(): void;
}

/** Открыть drawer игры / архетипа — общие колбэки вкладок. */
export interface WorkspaceDrawer {
  openGameFromList(game: NormalizedGame): void;
  openArchetypeFromMovers(archetype: GameArchetype): void;
}
