/**
 * Что изменилось между двумя срезами рынка: архетипы и арбитражные ниши (без DOM).
 */
import { ArbitrageOpportunity, GameArchetype, MarketSnapshot } from '../types.js';

export interface ArchetypeDeltaRow {
  archetype: GameArchetype;
  titleRu: string;
  /** null — архетипа не было в соответствующем срезе. */
  scoreBefore: number | null;
  scoreAfter: number | null;
  ccuBefore: number | null;
  ccuAfter: number | null;
}

/** «Было → стало» по архетипам: opportunityScore и аудитория (CCU). Порядок — по изменению score, рост сверху. */
export function computeArchetypeDelta(current: MarketSnapshot, base: MarketSnapshot): ArchetypeDeltaRow[] {
  const rows = new Map<GameArchetype, ArchetypeDeltaRow>();
  const row = (archetype: GameArchetype, titleRu: string): ArchetypeDeltaRow => {
    let r = rows.get(archetype);
    if (!r) {
      r = { archetype, titleRu, scoreBefore: null, scoreAfter: null, ccuBefore: null, ccuAfter: null };
      rows.set(archetype, r);
    }
    return r;
  };
  for (const v of base.verdicts ?? []) {
    const r = row(v.archetype, v.titleRu);
    r.scoreBefore = v.opportunityScore.overallScore;
    r.ccuBefore = v.totalAudienceCCU;
  }
  for (const v of current.verdicts ?? []) {
    const r = row(v.archetype, v.titleRu);
    r.titleRu = v.titleRu;
    r.scoreAfter = v.opportunityScore.overallScore;
    r.ccuAfter = v.totalAudienceCCU;
  }
  const change = (r: ArchetypeDeltaRow) => (r.scoreAfter ?? 0) - (r.scoreBefore ?? 0);
  return [...rows.values()].sort((a, b) => change(b) - change(a) || (b.scoreAfter ?? 0) - (a.scoreAfter ?? 0));
}

export interface NicheDiff {
  added: ArbitrageOpportunity[];
  removed: ArbitrageOpportunity[];
}

/** Арбитражные ниши, появившиеся и исчезнувшие относительно базы (ключ — игра Roblox, как в алертах). */
export function diffArbitrageNiches(current: MarketSnapshot, base: MarketSnapshot): NicheDiff {
  const cur = current.arbitrageOpportunities ?? [];
  const prev = base.arbitrageOpportunities ?? [];
  const curIds = new Set(cur.map(o => o.robloxGame.id));
  const prevIds = new Set(prev.map(o => o.robloxGame.id));
  return {
    added: cur.filter(o => !prevIds.has(o.robloxGame.id)),
    removed: prev.filter(o => !curIds.has(o.robloxGame.id)),
  };
}
