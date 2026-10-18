import type { GameArchetype, MarketVerdict, ArbitrageOpportunity, NormalizedGame } from '../../types.js';

export type TargetEngine = 'unity_webgl' | 'godot_4' | 'vite_canvas' | 'roblox_studio';
export type TargetStore = 'yandex_games' | 'poki' | 'roblox' | 'crazygames' | 'general_web';
export type AiAssistant = 'cursor' | 'claude' | 'chatgpt';

export interface PromptContext {
  targetEngine: TargetEngine;
  archetype: GameArchetype;
  targetStore?: TargetStore;
  aiAssistant?: AiAssistant;
  verdict?: MarketVerdict;
  arbitrage?: ArbitrageOpportunity;
  games?: NormalizedGame[];
  customTitle?: string;
}

export interface EngineMeta {
  title: string;
  badge: string;
  folderTree: string;
  contracts: string;
  optimization: string;
}

export interface ArchetypeBlueprint {
  titleRu: string;
  coreLoop: string;
  stateMachineMermaid: string;
  mechanicDetails: string;
  rewardedPlacements: string;
  interstitialTrigger: string;
  phase1: string;
  phase2: string;
  phase3: string;
  phase4: string;
}
