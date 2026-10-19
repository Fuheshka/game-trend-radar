import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildHistoryChartHtml,
  buildHistoryPlaceholderHtml,
  pickHistorySeries,
} from '../web/src/components/detailDrawer/historyChart.js';
import { buildGameBodyHtml } from '../web/src/components/detailDrawer/gameView.js';
import { fetchGameHistory } from '../web/src/services/snapshotApi.js';
import { getPlatformMeta } from '../web/src/utils/labels.js';
import type { GameHistoryResponse, NormalizedGame } from '../web/src/types.js';

const history = (metricType: string, points: GameHistoryResponse['points']): GameHistoryResponse => ({
  id: 'roblox_1',
  platform: 'roblox',
  title: 'Steal An Egg',
  metricType,
  firstSeen: points[0]?.date ?? '2026-10-01',
  lastSeen: points[points.length - 1]?.date ?? '2026-10-01',
  points,
});

const ccu = history('ccu', [
  { date: '2026-10-01', value: 12_000 },
  { date: '2026-10-02', value: 9_500 },
  { date: '2026-10-03', value: 31_200 },
]);

describe('график истории игры в drawer', () => {
  it('CCU: SVG-линия, подписи макс/мин, даты крайних точек и текущее значение', () => {
    const html = buildHistoryChartHtml(ccu);
    expect(html).toContain('<svg class="drawer-history-svg"');
    expect(html).toMatch(/<path d=" M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+"/);
    expect(html).toContain('data-role="best">31.2k<');
    expect(html).toContain('data-role="worst">9.5k<');
    expect(html).toContain('1 окт');
    expect(html).toContain('3 окт');
    expect(html).toContain('Онлайн (CCU): <strong>31.2k</strong>');
    expect(html).toContain('3 дн.');
    expect(html).toContain('#27a644'); // рост — зелёная линия
  });

  it('позиция: лучшая (#1) — сверху, подъём в выдаче рисуется вверх и зелёным', () => {
    const rank = history('rank', [
      { date: '2026-10-01', value: 40 },
      { date: '2026-10-02', value: 12 },
      { date: '2026-10-03', value: 3 },
    ]);
    const html = buildHistoryChartHtml(rank);
    expect(html).toContain('data-role="best">#3<');
    expect(html).toContain('data-role="worst">#40<');
    expect(html).toContain('#27a644');
    // Последняя точка (лучшая позиция) — у верхнего края (y = pad)
    expect(html).toContain('cy="4"');
  });

  it('Яндекс: рисуем число оценок, а не рейтинг; без оценок — рейтинг', () => {
    const withVotes = history('rating', [
      { date: '2026-10-01', value: 4.6, votes: 1200 },
      { date: '2026-10-02', value: 4.6, votes: 1100 },
    ]);
    expect(pickHistorySeries(withVotes).values).toEqual([1200, 1100]);
    const html = buildHistoryChartHtml(withVotes);
    expect(html).toContain('Число оценок: <strong>1.1k</strong>');
    expect(html).toContain('#ef4444'); // падение — красная

    // Реальный Яндекс: оценки пишутся не с первого дня — график по точкам, где они есть
    const partial = history('rating', [
      { date: '2026-10-13', value: 75 },
      { date: '2026-10-17', value: 75 },
      { date: '2026-10-18', value: 96, votes: 8061 },
      { date: '2026-10-19', value: 96, votes: 8400 },
    ]);
    const partialHtml = buildHistoryChartHtml(partial);
    expect(partialHtml).toContain('Число оценок: <strong>8.4k</strong>');
    expect(partialHtml).toContain('2 дн.');
    expect(partialHtml).toContain('18 окт');
    expect(partialHtml).not.toContain('13 окт');

    // Одна точка с оценками: заглушку 75 до неё не рисуем скачком «75 → 99»
    const oneVote = history('rating', [
      { date: '2026-10-13', value: 75 },
      { date: '2026-10-19', value: 99, votes: 10 },
    ]);
    expect(buildHistoryChartHtml(oneVote)).toContain('Пока одна точка. Число оценок: 10 на 19 окт');

    const noVotes = history('rating', [
      { date: '2026-10-01', value: 4.5 },
      { date: '2026-10-02', value: 80 },
    ]);
    expect(buildHistoryChartHtml(noVotes)).toContain('data-role="best">80<');
    expect(buildHistoryChartHtml(noVotes)).toContain('data-role="worst">4.5<');
  });

  it('одна точка — текст вместо графика; ноль точек и плейсхолдеры', () => {
    const one = buildHistoryChartHtml(history('ccu', [{ date: '2026-10-19', value: 500 }]));
    expect(one).not.toContain('<svg class="drawer-history-svg"');
    expect(one).toContain('Пока одна точка. Онлайн (CCU): 500 на 19 окт');
    expect(buildHistoryChartHtml(history('ccu', []))).toContain('ещё не накоплена');
    expect(buildHistoryPlaceholderHtml('no-api')).toContain('href="https://radar.fuheshka.qd.je"');
    expect(buildHistoryPlaceholderHtml('loading')).toContain('Загружаем');
  });

  it('экранирует название метрики и даты из ответа API', () => {
    const evil = history('ccu', [
      { date: '<img src=x>', value: 1 },
      { date: '2026-10-02', value: 2 },
    ]);
    expect(buildHistoryChartHtml(evil)).not.toContain('<img');
  });
});

describe('drawer игры: слот истории', () => {
  const game: NormalizedGame = {
    id: 'roblox_1',
    platform: 'roblox',
    title: 'Steal An Egg',
    genre: 'Simulation',
    archetype: 'SIMULATION_INCREMENTAL',
    metricValue: 350000,
    metricType: 'ccu',
    tags: [],
    timestamp: '2026-10-19T00:00:00.000Z',
  };

  it('есть у игр витрин, нет у синтетических YouTube-трендов', () => {
    expect(buildGameBodyHtml(game, null, getPlatformMeta('roblox'))).toContain('id="drawer-history" hidden');
    const yt = { ...game, platform: 'youtube_trends' as const, metricType: 'viral_score' as const };
    expect(buildGameBodyHtml(yt, null, getPlatformMeta('youtube_trends'))).not.toContain('drawer-history');
  });
});

describe('fetchGameHistory', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('кодирует id, отдаёт JSON на 200 и null на 404 или сетевую ошибку', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(ccu), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchGameHistory('poki_a b')).toEqual(ccu);
    expect(fetchMock).toHaveBeenCalledWith('/api/games/poki_a%20b/history');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    expect(await fetchGameHistory('roblox_1')).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await fetchGameHistory('roblox_1')).toBeNull();
  });
});
