import { GameArchetype, NormalizedGame, OpportunityScore } from '../types/index.js';

export class OpportunityScorer {
  // Baseline archetype profiles (market properties)
  private archetypeBaselines: Record<
    GameArchetype,
    {
      monetizationScore: number;
      saturationIndex: number;
      productionEffort: number;
    }
  > = {
    SIMULATION_INCREMENTAL: {
      monetizationScore: 92, // High rewarded video organic fit (boosts, rebirths, speed x2)
      saturationIndex: 2.2,  // Medium competition, huge turnover
      productionEffort: 1.5, // 1-2 weeks solo dev
    },
    PHYSICS_SANDBOX: {
      monetizationScore: 88, // Rewarded video for superweapons, nukes, secret skins
      saturationIndex: 1.8,  // Low competition for high quality 2D/3D physics
      productionEffort: 2.4, // 3-4 weeks with Box2D / joints
    },
    MERGE_IDLE: {
      monetizationScore: 85, // Rewarded video for highest tier item drop, auto-merge
      saturationIndex: 2.5,  // Moderate competition
      productionEffort: 2.0, // 2-3 weeks
    },
    WORD_PUZZLE: {
      monetizationScore: 78, // Hints, word reveals, interstitial between levels
      saturationIndex: 2.8,  // Moderate competition, loyal older demographic
      productionEffort: 1.8, // 2-3 weeks (procedural dictionary grid)
    },
    SURVIVAL_HORROR: {
      monetizationScore: 65, // Harder to monetize with rewarded ads without breaking atmosphere
      saturationIndex: 2.0,  // High interest, but requires multiplayer or deep AI
      productionEffort: 4.2, // 6-10 weeks
    },
    ACTION_SHOOTER: {
      monetizationScore: 70, // Weapon skins, weapon crates
      saturationIndex: 4.2,  // Saturated by big publishers (Standoff, Free Fire)
      productionEffort: 4.5, // High effort (hit-scan, lag compensation, models)
    },
    OBBY_PARKOUR: {
      monetizationScore: 75, // Skip stage, gravity coils, speed coils
      saturationIndex: 4.8,  // Extremely oversaturated in Roblox
      productionEffort: 1.5, // Easy to build, but almost zero organic discovery
    },
    OTHER_CASUAL: {
      monetizationScore: 60,
      saturationIndex: 3.5,
      productionEffort: 2.5,
    },
  };

  calculateScore(
    archetype: GameArchetype,
    totalCCUInGenre: number,
    gamesCountInGenre: number,
    hasUpAndComingTrend: boolean = false
  ): OpportunityScore {
    const profile = this.archetypeBaselines[archetype] || this.archetypeBaselines.OTHER_CASUAL;

    // 1. Demand Score based on CCU
    let demandScore = 40;
    if (totalCCUInGenre > 1_000_000) demandScore = 98;
    else if (totalCCUInGenre > 400_000) demandScore = 88;
    else if (totalCCUInGenre > 100_000) demandScore = 75;
    else if (totalCCUInGenre > 20_000) demandScore = 60;

    // 2. Growth Velocity
    let velocityScore = 50;
    if (hasUpAndComingTrend) velocityScore += 35;
    if (archetype === 'SIMULATION_INCREMENTAL' || archetype === 'PHYSICS_SANDBOX') {
      velocityScore += 15;
    }
    velocityScore = Math.min(100, velocityScore);

    // 3. Dynamic saturation adjustment
    let saturationIndex = profile.saturationIndex;
    if (gamesCountInGenre > 30) saturationIndex += 0.5;

    // 4. Calculate Overall Score
    // Formula: (Demand * 0.35 + Velocity * 0.25 + Monetization * 0.20) / (Saturation * 0.12 + Effort * 0.08) * normalizer
    const numerator = demandScore * 0.35 + velocityScore * 0.25 + profile.monetizationScore * 0.2;
    const denominator = saturationIndex * 0.12 + profile.productionEffort * 0.08;

    // Normalized to 0 - 100 scale
    let overallScore = Math.round((numerator / denominator) * 0.55);
    overallScore = Math.max(10, Math.min(99, overallScore));

    return {
      overallScore,
      demandScore,
      velocityScore,
      monetizationScore: profile.monetizationScore,
      saturationIndex: Number(saturationIndex.toFixed(1)),
      productionEffort: Number(profile.productionEffort.toFixed(1)),
    };
  }
}
