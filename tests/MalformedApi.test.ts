import { describe, it, expect, vi } from 'vitest';
import { YouTubeShortsAnalyzer } from '../src/collectors/youtube_shorts.js';
import { itemsOf, num, str } from '../src/utils/json.js';

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

describe('чтение ответов внешних API без гарантий формы', () => {
  it('хелперы json.ts терпят мусор', () => {
    expect(itemsOf(null)).toEqual([]);
    expect(itemsOf({ items: 'oops' })).toEqual([]);
    expect(itemsOf([1, 2])).toEqual([1, 2]);
    expect(str({ a: 1 })).toBe('');
    expect(str(42)).toBe('42');
    expect(num('12')).toBe(12);
    expect(num('abc')).toBe(0);
    expect(num(undefined)).toBe(0);
  });

  it('Invidious: ролик без id пропускается, а не получает случайный id', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse([
        { title: 'no id', viewCount: 100 },
        { videoId: 'abc123', title: { nested: true }, viewCount: '500' },
        'garbage',
      ])
    );
    const analyzer = new YouTubeShortsAnalyzer({
      fetchFn: fetchFn as unknown as typeof fetch,
      invidiousInstances: ['https://mock-invidious.test'],
      apiKey: '',
    });

    const items = await analyzer.fetchTagSlice('#roblox', { limit: 10 });

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('abc123');
    expect(items[0].title).toBe('');
    expect(items[0].viewCount).toBe(500);
  });

  it('YouTube Data API: элементы без videoId отбрасываются, статистика мапится', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { id: { videoId: 'v1' }, snippet: { title: 'Brainrot', channelTitle: 'ch' } },
            { id: { channelId: 'not-a-video' }, snippet: { title: 'channel' } },
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'v1', statistics: { viewCount: '9000' } }] }));
    const analyzer = new YouTubeShortsAnalyzer({ fetchFn: fetchFn as unknown as typeof fetch, apiKey: 'k' });

    const items = await analyzer.fetchTagSlice('#shorts', { limit: 5 });

    expect(items).toEqual([
      expect.objectContaining({ id: 'v1', title: 'Brainrot', viewCount: 9000, channelTitle: 'ch' }),
    ]);
  });
});
