import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ALERT_QUIET_MS,
  attachSnapshotAlerts,
  AlertState,
  DASHBOARD_URL,
  diffSnapshot,
  formatAlertMessage,
  readTelegramConfig,
  sendTelegramMessage,
  SnapshotAlerter,
  SnapshotAlerts,
} from '../src/alerts/index.js';
import { MarketEventBus } from '../src/events/event_bus.js';
import { MarketScanner } from '../src/scanner.js';
import { SnapshotStore } from '../src/storage/snapshot_store.js';
import type { ArbitrageOpportunity, MarketSnapshot, NormalizedGame, PlatformType, Riser, SourceStatus } from '../src/types/index.js';

// --- Фикстуры снимков: форма как у прода (snapshot-2026-10-19), данные урезаны до нужного ---

function niche(id: string, title: string, ccu: number): ArbitrageOpportunity {
  return {
    robloxGame: {
      id,
      platform: 'roblox',
      title,
      genre: 'Simulation',
      archetype: 'SIMULATION_INCREMENTAL',
      metricValue: ccu,
      metricType: 'ccu',
      url: `https://www.roblox.com/games/${id.replace('roblox_', '')}`,
      tags: [],
      timestamp: '2026-10-19T08:00:00.000Z',
    },
    robloxCCU: ccu,
    archetype: 'SIMULATION_INCREMENTAL',
    similarityWithNearestAnalog: 0.1,
    nearestAnalog: null,
    hasDirectAnalog: false,
    nicheKeywords: [],
    nicheDescription: '',
    adaptationStrategy: '',
    suggestedRuTitle: '',
    badge: 'ARBITRAGE OPPORTUNITY',
    organicPotential: ccu > 500_000 ? 'CRITICAL_FIRST_MOVER' : 'HIGH',
  };
}

function riser(id: string, title: string, signal: Riser['signal'], growthPct: number, from: number, to: number): Riser {
  const platform: PlatformType = signal === 'ccu' ? 'roblox' : signal === 'votes' ? 'yandex_games' : 'poki';
  return { id, platform, title, url: `https://example.com/${id}`, metricType: signal, signal, from, to, growthPct, days: 7 };
}

const OK: SourceStatus = { ok: true, count: 100 };

function snapshot(parts: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    id: 'snapshot-2026-10-19',
    timestamp: '2026-10-19T08:00:00.000Z',
    totalGamesScanned: 0,
    platformCounts: { roblox: 0, yandex_games: 0, poki: 0, youtube_trends: 0 },
    robloxTotalCCU: 0,
    games: [],
    verdicts: [],
    arbitrageOpportunities: [],
    risers: [],
    sourceStatus: { roblox: OK, yandex_games: OK, poki: OK, youtube_shorts: { ok: true, count: 5 } },
    ...parts,
  };
}

const EGG = niche('roblox_10563114921', 'Steal An Egg', 1_139_194);
const MM2 = niche('roblox_66654135', 'Murder Mystery 2', 289_604);
const BROOK = niche('roblox_1686885941', 'Brookhaven 🏡RP', 218_821);

const BEFORE = snapshot({ arbitrageOpportunities: [EGG, MM2] });
const AFTER = snapshot({
  timestamp: '2026-10-19T08:30:00.000Z',
  arbitrageOpportunities: [EGG, MM2, BROOK],
  risers: [
    riser('roblox_cat', 'Cat Battles 🐾', 'ccu', 1010, 1785, 19817),
    riser('roblox_nfl', '[🔥NIKE + 2X] NFL Universe Football', 'ccu', 226, 3047, 9941),
    riser('roblox_facecard', 'Facecard: Makeup Showdown', 'ccu', 167, 6421, 17156), // ниже порога %
    riser('roblox_small', 'Oregon Trail', 'ccu', 246, 442, 1528), // мало онлайна
    riser('yandex_puzzle', 'Пазл <Котики> & Co', 'votes', 250, 40, 140),
    riser('poki_rainbow', 'Rainbow Obby', 'rank', 63, 87, 32), // Poki не алертим
  ],
  sourceStatus: {
    roblox: OK,
    yandex_games: { ok: false, count: 0, error: 'HTTP 503' },
    poki: { ok: true, count: 35, warning: 'собрано 35 игр против 100 в последнем полном скане (−65%)', baseline: 100 },
    youtube_shorts: { ok: true, count: 5 },
  },
});

const T0 = new Date('2026-10-19T08:00:00.000Z');
const T1 = new Date('2026-10-19T08:30:00.000Z');

describe('diffSnapshot: события между сканами', () => {
  it('первый запуск — только база, без событий', () => {
    const { alerts, nextState } = diffSnapshot(AFTER, null, T1);
    expect(alerts).toEqual({ niches: [], risers: [], degraded: [], recovered: [] });
    expect(Object.keys(nextState.seen).sort()).toEqual(
      ['niche:roblox_10563114921', 'niche:roblox_1686885941', 'niche:roblox_66654135', 'riser:roblox_cat', 'riser:roblox_nfl', 'riser:yandex_puzzle'].sort()
    );
    expect(nextState.sources).toEqual({ roblox: 'ok', yandex_games: 'down', poki: 'warning', youtube_shorts: 'ok' });
  });

  it('новая ниша, росты выше порога, деградация источников', () => {
    const base = diffSnapshot(BEFORE, null, T0).nextState;
    const { alerts } = diffSnapshot(AFTER, base, T1);
    expect(alerts.niches.map(n => n.robloxGame.title)).toEqual(['Brookhaven 🏡RP']);
    expect(alerts.risers.map(r => r.id)).toEqual(['roblox_cat', 'roblox_nfl', 'yandex_puzzle']);
    expect(alerts.degraded.map(c => `${c.source}:${c.health}`)).toEqual(['yandex_games:down', 'poki:warning']);
    expect(alerts.recovered).toEqual([]);
  });

  it('восстановление источника и смена вида проблемы; держащийся warning молчит', () => {
    const state: AlertState = { seen: {}, sources: { roblox: 'warning', yandex_games: 'warning', poki: 'warning' } };
    const next = snapshot({
      sourceStatus: { roblox: OK, yandex_games: { ok: false, count: 0, error: 'timeout' }, poki: { ok: true, count: 20, warning: 'мало' } },
    });
    const { alerts } = diffSnapshot(next, state, T1);
    expect(alerts.recovered.map(c => c.source)).toEqual(['roblox']);
    expect(alerts.degraded.map(c => `${c.source}:${c.health}`)).toEqual(['yandex_games:down']);
  });

  it('пустой дифф при повторе того же снимка', () => {
    const first = diffSnapshot(AFTER, diffSnapshot(BEFORE, null, T0).nextState, T1).nextState;
    const { alerts } = diffSnapshot(AFTER, first, new Date('2026-10-19T09:00:00.000Z'));
    expect(alerts).toEqual({ niches: [], risers: [], degraded: [], recovered: [] });
  });

  it('анти-спам: ниша, пропавшая на скан, не повторяется; пропавшая дольше 7 дней — повторяется', () => {
    let state = diffSnapshot(AFTER, diffSnapshot(BEFORE, null, T0).nextState, T1).nextState;
    // Brookhaven упал ниже порога на один скан и вернулся
    state = diffSnapshot(BEFORE, state, new Date('2026-10-19T09:00:00.000Z')).nextState;
    expect(diffSnapshot(AFTER, state, new Date('2026-10-19T09:30:00.000Z')).alerts.niches).toEqual([]);
    // Неделю его не было — ключ забыт, снова новость
    const later = new Date(T1.getTime() + ALERT_QUIET_MS + 60_000);
    state = diffSnapshot(BEFORE, state, later).nextState;
    expect(state.seen['niche:roblox_1686885941']).toBeUndefined();
    expect(diffSnapshot(AFTER, state, later).alerts.niches.map(n => n.robloxGame.id)).toEqual(['roblox_1686885941']);
  });
});

describe('formatAlertMessage', () => {
  const alerts = diffSnapshot(AFTER, diffSnapshot(BEFORE, null, T0).nextState, T1).alerts;

  it('коротко, по-русски, ссылки на игры и дашборд, HTML экранирован', () => {
    const text = formatAlertMessage(alerts);
    expect(text).toContain('🎯 <b>Новые арбитражные ниши (1)</b>');
    expect(text).toContain('<a href="https://www.roblox.com/games/1686885941">Brookhaven 🏡RP</a> — 218.8K онлайн');
    expect(text).toContain('<a href="https://example.com/roblox_cat">Cat Battles 🐾</a> (Roblox) — +1010% за 7 дн.: 1.8K → 19.8K онлайн');
    expect(text).toContain('Пазл &lt;Котики&gt; &amp; Co</a> (Яндекс) — +250% за 7 дн.: 40 → 140 оценок');
    expect(text).toContain('• Яндекс Игры: сбой — HTTP 503');
    expect(text).toContain('• Poki: неполный сбор — собрано 35 игр против 100');
    expect(text).not.toContain('Источники восстановились');
    expect(text.endsWith(`<a href="${DASHBOARD_URL}">Открыть дашборд</a>`)).toBe(true);
    expect(text).not.toMatch(/<(?!\/?(b|a)\b)/); // никаких тегов, кроме <b> и <a>
  });

  it('ссылка без http(s) не попадает в href', () => {
    const bad: SnapshotAlerts = { niches: [], risers: [{ ...AFTER.risers![0], url: 'javascript:alert(1)' }], degraded: [], recovered: [] };
    expect(formatAlertMessage(bad)).not.toContain('javascript:');
  });

  it('укладывается в 4096 символов, длинные списки обрезаются хвостом, теги целы', () => {
    const many: SnapshotAlerts = {
      niches: Array.from({ length: 300 }, (_, i) => niche(`roblox_${i}`, `Очень длинное название игры номер ${i} `.repeat(3), 150_000 + i)),
      risers: Array.from({ length: 100 }, (_, i) => riser(`r${i}`, `Растущая игра ${i}`, 'ccu', 500, 2000, 12000)),
      degraded: [{ source: 'poki', health: 'down', status: { ok: false, count: 0, error: 'x'.repeat(5000) } }],
      recovered: [{ source: 'roblox', health: 'ok', status: { ok: true, count: 280 } }],
    };
    const text = formatAlertMessage(many);
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(text).toMatch(/…и ещё \d+/);
    expect((text.match(/<a /g) ?? []).length).toBe((text.match(/<\/a>/g) ?? []).length);
    expect((text.match(/<b>/g) ?? []).length).toBe((text.match(/<\/b>/g) ?? []).length);
    expect(text).toContain(`<a href="${DASHBOARD_URL}">Открыть дашборд</a>`);
  });
});

describe('Telegram: конфиг и отправка (fetch подменён)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('без токена или chat id — выключено', () => {
    expect(readTelegramConfig({})).toBeNull();
    expect(readTelegramConfig({ TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_CHAT_ID: ' ' })).toBeNull();
    expect(readTelegramConfig({ TELEGRAM_BOT_TOKEN: ' 123:abc ', TELEGRAM_CHAT_ID: '-100' })).toEqual({ token: '123:abc', chatId: '-100' });
  });

  it('sendMessage с parse_mode HTML и без превью', async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await sendTelegramMessage({ token: '123:abc', chatId: '-100' }, '<b>hi</b>');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bot123:abc/sendMessage');
    expect(JSON.parse(String(init.body))).toEqual({
      chat_id: '-100',
      text: '<b>hi</b>',
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  it('ошибки API и сети — понятным текстом и без токена', async () => {
    const config = { token: '123:SECRET', chatId: '-100' };
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":false,"description":"Bad Request: chat not found"}', { status: 400 })));
    await expect(sendTelegramMessage(config, 'x')).rejects.toThrow('Telegram ответил 400: Bad Request: chat not found');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const err = await sendTelegramMessage(config, 'x').catch((e: Error) => e);
    expect(err.message).toBe('Telegram недоступен: fetch failed');
    expect(err.message).not.toContain('SECRET');
  });
});

describe('SnapshotAlerter', () => {
  const dir = path.join(process.cwd(), 'data', 'test-alerts');
  const statePath = path.join(dir, 'alerts_state.json');
  let logs: string[];
  const log = (m: string) => logs.push(m);

  beforeEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    logs = [];
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('без токена выключен: не шлёт, не пишет состояние, не подписывается', async () => {
    const send = vi.fn(async () => {});
    const alerter = new SnapshotAlerter({ config: readTelegramConfig({}), send, statePath, log });
    expect(alerter.enabled).toBe(false);
    expect(await alerter.handleSnapshot(AFTER)).toBe('disabled');
    const bus = new MarketEventBus();
    attachSnapshotAlerts(bus, new SnapshotStore(dir), alerter);
    expect(bus.listenerCount('snapshot:updated')).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(fs.existsSync(statePath)).toBe(false);
  });

  it('база → сообщение → пустой дифф ничего не шлёт', async () => {
    const send = vi.fn(async (_html: string) => {});
    const alerter = new SnapshotAlerter({ config: { token: 't', chatId: 'c' }, send, statePath, log });
    expect(await alerter.handleSnapshot(BEFORE)).toBe('baseline');
    expect(await alerter.handleSnapshot(AFTER)).toBe('sent');
    expect(await alerter.handleSnapshot(AFTER)).toBe('empty');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toContain('Brookhaven');
    expect(JSON.parse(fs.readFileSync(statePath, 'utf-8')).sources.poki).toBe('warning');
  });

  it('ошибка отправки: лог, состояние не сдвигается, события уходят со следующим сканом', async () => {
    const send = vi.fn(async (_html: string) => {}).mockRejectedValueOnce(new Error('Telegram недоступен: fetch failed'));
    const alerter = new SnapshotAlerter({ config: { token: 't', chatId: 'c' }, send, statePath, log });
    await alerter.handleSnapshot(BEFORE);
    const before = fs.readFileSync(statePath, 'utf-8');
    expect(await alerter.handleSnapshot(AFTER)).toBe('failed');
    expect(fs.readFileSync(statePath, 'utf-8')).toBe(before);
    expect(logs).toContain('[Alerts] не отправлено: Telegram недоступен: fetch failed');
    expect(await alerter.handleSnapshot(AFTER)).toBe('sent');
    expect(send.mock.calls[1][0]).toContain('Brookhaven');
  });

  it('битый файл состояния — новая база, без исключения', async () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(statePath, '{oops');
    const alerter = new SnapshotAlerter({ config: { token: 't', chatId: 'c' }, send: vi.fn(), statePath, log });
    expect(await alerter.handleSnapshot(AFTER)).toBe('baseline');
  });
});

describe('Скан + snapshot:updated: сеть Telegram упала, скан и снимок целы', () => {
  const dir = path.join(process.cwd(), 'data', 'test-alerts-scan');
  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const games = (n: number, platform: PlatformType): NormalizedGame[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `${platform}-${i}`,
      platform,
      title: `Game ${platform} ${i}`,
      genre: 'Simulation',
      archetype: 'SIMULATION_INCREMENTAL' as const,
      metricValue: 1000 + i,
      metricType: platform === 'roblox' ? ('ccu' as const) : ('rating' as const),
      tags: [],
      timestamp: '2026-10-19T08:30:00.000Z',
    }));

  it('fetch отклоняется — scan() резолвится, снимок сохранён, ошибка в логе', async () => {
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    const statePath = path.join(dir, 'data', 'alerts_state.json');
    // Прошлый скан: Poki был здоров — теперь он упадёт, это событие
    fs.writeFileSync(statePath, JSON.stringify({ seen: {}, sources: { roblox: 'ok', yandex_games: 'ok', poki: 'ok' } }));
    const fetchMock = vi.fn(async () => { throw new TypeError('fetch failed'); });
    vi.stubGlobal('fetch', fetchMock);

    const logs: string[] = [];
    const store = new SnapshotStore(dir);
    const bus = new MarketEventBus();
    const alerter = new SnapshotAlerter({ config: { token: '1:x', chatId: '-1' }, statePath, log: m => logs.push(m) });
    attachSnapshotAlerts(bus, store, alerter);

    const snap = await new MarketScanner({
      store,
      silent: true,
      eventBus: bus,
      timestamp: '2026-10-19T08:30:00.000Z',
      robloxCollector: { fetchAllKeySorts: async () => games(60, 'roblox') },
      yandexCollector: { fetchCatalog: async () => games(60, 'yandex_games') },
      pokiCollector: { fetchPopular: async () => { throw new Error('Poki 500'); } },
      crazyGamesCollector: { fetchHot: async () => games(36, 'crazygames') },
      youtubeAnalyzer: {
        getViralShortsTrends: async () => [],
        scanTrendingSlices: async () => [],
        detectViralMemes: () => [],
        calculateViralMultiplier: () => 1,
      },
    }).scan();
    await alerter.idle();

    expect(snap.sourceStatus?.poki.ok).toBe(false);
    expect(store.getLatestSnapshot()?.id).toBe(snap.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logs).toContain('[Alerts] не отправлено: Telegram недоступен: fetch failed');
    expect(JSON.parse(fs.readFileSync(statePath, 'utf-8')).sources.poki).toBe('ok');
  });
});
