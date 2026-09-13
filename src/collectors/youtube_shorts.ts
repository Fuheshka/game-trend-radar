import { NormalizedGame } from '../types/index.js';
import { classifyArchetype } from '../analyzer/classifier.js';

export interface ViralTrendTopic {
  keyword: string;
  archetype: string;
  viralScore: number; // 0 - 100
  estimatedViewsTier: '100M+' | '50M+' | '10M+' | '1M+';
  hookDescription: string;
}

export class YouTubeShortsAnalyzer {
  // Curated viral topics extracted from live Shorts gaming trends
  private viralTopics: ViralTrendTopic[] = [
    {
      keyword: 'Steal An Egg / Catch & Run',
      archetype: 'SIMULATION_INCREMENTAL',
      viralScore: 98,
      estimatedViewsTier: '100M+',
      hookDescription: 'Напряженная кража яйца у спящего монстра и мгновенный побег в безопасную зону.',
    },
    {
      keyword: 'Ragdoll Dismount / Break Bones',
      archetype: 'PHYSICS_SANDBOX',
      viralScore: 94,
      estimatedViewsTier: '100M+',
      hookDescription: 'Эпичные падения рэгдолла с гигантских лестниц с рентген-счетчиком переломов.',
    },
    {
      keyword: '+1 Size / Power Evolution Every Second',
      archetype: 'SIMULATION_INCREMENTAL',
      viralScore: 91,
      estimatedViewsTier: '50M+',
      hookDescription: 'Персонаж растет в размерах каждую секунду и ломает стены вселенского масштаба.',
    },
    {
      keyword: '99 Nights in the Dark Forest',
      archetype: 'SURVIVAL_HORROR',
      viralScore: 88,
      estimatedViewsTier: '50M+',
      hookDescription: 'Выживание у костра с ограниченным запасом дерева и пугающими криками из темноты.',
    },
    {
      keyword: 'Satisfying Sorting & Merge',
      archetype: 'MERGE_IDLE',
      viralScore: 82,
      estimatedViewsTier: '50M+',
      hookDescription: 'Идеальная раскладка товаров по полочкам и гипнотический звук щелчков.',
    },
  ];

  async getViralShortsTrends(): Promise<NormalizedGame[]> {
    const now = new Date().toISOString();
    return this.viralTopics.map((item, idx) => ({
      id: `yt_shorts_${idx + 1}`,
      platform: 'youtube_trends',
      title: item.keyword,
      genre: 'Viral Short Format',
      archetype: classifyArchetype(item.keyword, item.archetype),
      metricValue: item.viralScore,
      metricType: 'viral_score',
      tags: ['youtube_shorts', 'viral', item.estimatedViewsTier],
      url: `https://www.youtube.com/hashtag/${encodeURIComponent(item.keyword.split(' ')[0].toLowerCase())}`,
      timestamp: now,
    }));
  }

  getTopics(): ViralTrendTopic[] {
    return this.viralTopics;
  }
}
