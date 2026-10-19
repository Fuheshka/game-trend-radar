import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { YandexGamesCollector, parseYandexAppState } from '../src/collectors/yandex_games.js';
import { PokiCollector } from '../src/collectors/poki.js';
import { CrazyGamesCollector, CRAZYGAMES_HOT_URL, parseCrazyGamesNextData } from '../src/collectors/crazygames.js';
import type { NormalizedGame } from '../src/types/index.js';

// Контракт парсеров с реальной вёрсткой витрин. Снимки сняты 2026-10-18 (CrazyGames — 2026-10-19) curl'ом с тем же UA,
// что у коллекторов, и обрезаны (без <style>, <svg>, сторонних <script>, class/style-атрибутов).
// Сеть не трогаем: fetch подменён и отдаёт сохранённый HTML.
// Тест упал после обновления снимка — вёрстка витрины поменялась, чинить парсер (см. implementation-notes §32).
const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'fixtures', 'collectors', name), 'utf-8');

function serveHtml(pages: Record<string, string>): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = String(input);
    const html = pages[url];
    return html === undefined ? new Response('not found', { status: 404 }) : new Response(html, { status: 200 });
  });
}

function expectWellFormed(games: NormalizedGame[], urlPattern: RegExp): void {
  expect(new Set(games.map(g => g.id)).size).toBe(games.length);
  for (const g of games) {
    expect(g.title.trim().length, g.id).toBeGreaterThan(1);
    expect(g.url, g.id).toMatch(urlPattern);
    expect(Number.isFinite(g.metricValue) && g.metricValue > 0, g.id).toBe(true);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('контракт: Яндекс Игры (главная и категория)', () => {
  const root = fixture('yandex_games_root.html');
  const puzzles = fixture('yandex_games_puzzles.html');
  const appUrl = /^https:\/\/yandex\.ru\/games\/app\/[\w-]+$/;

  it('__appState__ на месте и даёт карточки с рейтингом и числом оценок', () => {
    for (const html of [root, puzzles]) {
      const games = parseYandexAppState(html, '2026-10-18T00:00:00.000Z');
      expect(games.length).toBeGreaterThanOrEqual(20);
      expectWellFormed(games, appUrl);
      expect(games.filter(g => (g.votes ?? 0) > 0).length).toBeGreaterThanOrEqual(10);
      expect(games.every(g => g.metricValue <= 100)).toBe(true);
    }
  });

  it('коллектор целиком (state + JSON-LD + ссылки) собирает ≥ 40 уникальных игр с двух страниц', async () => {
    // Остальные категории отвечают 404 — коллектор их пропускает
    serveHtml({ 'https://yandex.ru/games/': root, 'https://yandex.ru/games/category/puzzles': puzzles });
    const games = await new YandexGamesCollector().fetchCatalog();
    expect(games.length).toBeGreaterThanOrEqual(40);
    expectWellFormed(games, appUrl);
  });
});

describe('контракт: Poki (poki.com/en/popular)', () => {
  it('собирает ≥ 90 игр с последовательными рангами', async () => {
    serveHtml({ 'https://poki.com/en/popular': fixture('poki_popular.html') });
    const games = await new PokiCollector().fetchPopular();
    expect(games.length).toBeGreaterThanOrEqual(90);
    expectWellFormed(games, /^https:\/\/poki\.com\/en\/g\/[a-z0-9-]+$/);
    expect(games.map(g => g.metricValue)).toEqual(games.map((_, i) => i + 1));
  });
});

describe('контракт: CrazyGames (crazygames.com/hot)', () => {
  const hot = fixture('crazygames_hot.html');
  const gameUrl = /^https:\/\/www\.crazygames\.com\/game\/[\w-]+$/;

  it('__NEXT_DATA__ даёт ≥ 30 игр с рангами 1..N и числом лайков', () => {
    const games = parseCrazyGamesNextData(hot, '2026-10-19T00:00:00.000Z');
    expect(games.length).toBeGreaterThanOrEqual(30);
    expectWellFormed(games, gameUrl);
    expect(games.map(g => g.metricValue)).toEqual(games.map((_, i) => i + 1));
    expect(games.filter(g => (g.votes ?? 0) > 0).length).toBeGreaterThanOrEqual(25);
    expect(games.every(g => g.platform === 'crazygames' && g.metricType === 'rank')).toBe(true);
  });

  it('коллектор целиком собирает ≥ 30 игр, при 404 — пустой список', async () => {
    serveHtml({ [CRAZYGAMES_HOT_URL]: hot });
    expect((await new CrazyGamesCollector().fetchHot()).length).toBeGreaterThanOrEqual(30);
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    serveHtml({});
    expect(await new CrazyGamesCollector().fetchHot()).toEqual([]);
  });
});
