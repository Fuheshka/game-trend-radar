import { NormalizedGame, PlatformType } from '../../types.js';

export function formatMetricVal(game: NormalizedGame): string {
  if (game.metricType === 'ccu') {
    return `${formatNumber(game.metricValue)} CCU`;
  }
  if (game.metricType === 'viral_score') {
    return `${formatNumber(game.metricValue)} pts`;
  }
  if (game.metricType === 'rating') {
    return `${game.metricValue}/100`;
  }
  if (game.metricType === 'rank') {
    return `#${game.metricValue}`;
  }
  return formatNumber(game.metricValue);
}

export function formatLikes(game: NormalizedGame): string {
  if (typeof game.likeRatio === 'number') {
    const pct = game.likeRatio > 1 ? Math.round(game.likeRatio) : Math.round(game.likeRatio * 100);
    return `${pct}%`;
  }
  return '';
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.round(n).toLocaleString();
}

export function getPlatformMeta(platform: PlatformType): { label: string; badgeClass: string; iconSvg: string } {
  switch (platform) {
    case 'roblox':
      return {
        label: 'Roblox',
        badgeClass: 'badge-roblox',
        iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5.33 2.5L2.5 18.67l16.17 2.83 2.83-16.17L5.33 2.5zm8.5 10.33l-3.66-.64.64-3.67 3.67.64-.65 3.67z"/></svg>`,
      };
    case 'yandex_games':
      return {
        label: 'Яндекс Игры',
        badgeClass: 'badge-yandex',
        iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 12c0-5.25 4.25-9.5 9.5-9.5s9.5 4.25 9.5 9.5-4.25 9.5-9.5 9.5-9.5-4.25-9.5-9.5zm9.5-5.5c-3.04 0-5.5 2.46-5.5 5.5s2.46 5.5 5.5 5.5 5.5-2.46 5.5-5.5-2.46-5.5-5.5-5.5z"/></svg>`,
      };
    case 'poki':
      return {
        label: 'Poki',
        badgeClass: 'badge-poki',
        iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>`,
      };
    case 'youtube_trends':
      return {
        label: 'Shorts',
        badgeClass: 'badge-shorts',
        iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="10 8 16 12 10 16 10 8"/></svg>`,
      };
    default:
      return {
        label: platform,
        badgeClass: 'badge-neutral',
        iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/></svg>`,
      };
  }
}

export function generatePlatformSearchUrl(platform: PlatformType, title: string): string {
  const encoded = encodeURIComponent(title);
  switch (platform) {
    case 'roblox':
      return `https://www.roblox.com/discover/?Keyword=${encoded}`;
    case 'yandex_games':
      return `https://yandex.ru/games/search?query=${encoded}`;
    case 'poki':
      return `https://poki.com/en/g/${encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`;
    case 'youtube_trends':
      return `https://www.youtube.com/results?search_query=${encoded}+game`;
    default:
      return `https://www.google.com/search?q=${encoded}+game`;
  }
}
