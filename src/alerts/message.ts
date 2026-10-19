import type { ArbitrageOpportunity, Riser } from '../types/index.js';
import type { SnapshotAlerts, SourceChange } from './diff.js';

export const DASHBOARD_URL = 'https://radar.fuheshka.qd.je';
/** Лимит sendMessage — 4096 символов после разбора разметки; длина с тегами заведомо не меньше. */
export const TELEGRAM_MAX_LENGTH = 4096;

const SOURCE_LABEL: Record<string, string> = {
  roblox: 'Roblox',
  yandex_games: 'Яндекс Игры',
  poki: 'Poki',
  youtube_shorts: 'YouTube Shorts',
};

const POTENTIAL_LABEL: Record<ArbitrageOpportunity['organicPotential'], string> = {
  CRITICAL_FIRST_MOVER: 'можно зайти первыми',
  VERY_HIGH: 'очень высокий потенциал',
  HIGH: 'высокий потенциал',
};

/** parse_mode HTML: экранировать нужно только & < > (и " в атрибуте), а не 18 символов MarkdownV2. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function link(title: string, url?: string): string {
  const text = escapeHtml(clip(title, 80));
  return url && /^https?:\/\//i.test(url) ? `<a href="${escapeHtml(url)}">${text}</a>` : text;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

function nicheLine(o: ArbitrageOpportunity): string {
  return `• ${link(o.robloxGame.title, o.robloxGame.url)} — ${compact(o.robloxCCU)} онлайн, ${POTENTIAL_LABEL[o.organicPotential] ?? 'потенциал'}`;
}

function riserLine(r: Riser): string {
  const unit = r.signal === 'ccu' ? 'онлайн' : 'оценок';
  const where = r.platform === 'roblox' ? 'Roblox' : 'Яндекс';
  return `• ${link(r.title, r.url)} (${where}) — +${r.growthPct}% за ${r.days} дн.: ${compact(r.from)} → ${compact(r.to)} ${unit}`;
}

function sourceLine(c: SourceChange): string {
  const name = SOURCE_LABEL[c.source] ?? c.source;
  if (c.health === 'ok') return `• ${escapeHtml(name)}: снова ${c.status.count} игр`;
  const detail = c.health === 'down' ? `сбой — ${c.status.error ?? 'нет данных'}` : `неполный сбор — ${c.status.warning}`;
  return `• ${escapeHtml(name)}: ${escapeHtml(clip(detail, 200))}`;
}

/**
 * Одно сообщение на снимок. Длинные списки обрезаются с хвостом «…и ещё N», чтобы уложиться
 * в лимит Telegram, не разрезая теги.
 */
export function formatAlertMessage(alerts: SnapshotAlerts, maxLength = TELEGRAM_MAX_LENGTH): string {
  const header = '📡 <b>Game Trend Radar</b>';
  const footer = `<a href="${DASHBOARD_URL}">Открыть дашборд</a>`;
  const sections: Array<[string, string[]]> = [
    [`🎯 <b>Новые арбитражные ниши (${alerts.niches.length})</b>`, alerts.niches.map(nicheLine)],
    [`📈 <b>Резкий рост за неделю (${alerts.risers.length})</b>`, alerts.risers.map(riserLine)],
    ['⚠️ <b>Проблемы с источниками</b>', alerts.degraded.map(sourceLine)],
    ['✅ <b>Источники восстановились</b>', alerts.recovered.map(sourceLine)],
  ];

  // Под хвосты «…и ещё N» резервируем место заранее: по одному на секцию
  let budget = maxLength - header.length - footer.length - 4 - sections.length * 24;
  const parts: string[] = [header];
  for (const [title, lines] of sections) {
    if (lines.length === 0) continue;
    const block = [title];
    budget -= title.length + 2;
    let shown = 0;
    for (const line of lines) {
      if (line.length + 1 > budget) break;
      block.push(line);
      budget -= line.length + 1;
      shown++;
    }
    if (shown < lines.length) block.push(`…и ещё ${lines.length - shown}`);
    parts.push(block.join('\n'));
  }
  parts.push(footer);
  return parts.join('\n\n');
}
