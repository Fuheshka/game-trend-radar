import { test, expect, type Page } from '@playwright/test';
import { FALLBACK_SNAPSHOT } from '../web/src/fallbackData';

// JS-исключения страницы валят тест; сетевые 404/502 от отсутствующего API — нет.
let pageErrors: string[] = [];

// API абортится — это режим GitHub Pages. staticSnapshot — снимок, «собранный в бандл Pages»; без него — демо.
async function openDashboard(
  page: Page,
  opts: { staticSnapshot?: object; snapshotList?: object[] } = {}
): Promise<void> {
  pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  // Всегда встроенный демо-снимок: иначе локальный/серверный снимок может прийти посреди теста и перерисовать таблицу
  await page.route('**/api/**', route => route.abort());
  if (opts.snapshotList) {
    await page.route('**/api/snapshots', route => route.fulfill({ json: opts.snapshotList }));
  }
  await page.route('**/data/latest_snapshot.json', route =>
    opts.staticSnapshot ? route.fulfill({ json: opts.staticSnapshot }) : route.fulfill({ status: 404 })
  );
  await page.goto('/');
  await expect(page.locator('#kpi-total-games')).not.toHaveText('0');
}

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

test('вкладки переключаются хоткеями и кликом', async ({ page }) => {
  await openDashboard(page);
  for (const [key, panel] of [
    ['2', '#view-movers'],
    ['3', '#view-catalog'],
    ['4', '#view-arbitrage'],
    ['1', '#view-radar'],
  ]) {
    await page.keyboard.press(key);
    await expect(page.locator(panel)).toBeVisible();
  }
  await page.locator('#tab-btn-catalog').click();
  await expect(page.locator('.steamdb-table-row').first()).toBeVisible();
});

test('неактивные вкладки не рендерятся до первого открытия', async ({ page }) => {
  await openDashboard(page);
  const nodes = await page.evaluate(() => document.querySelectorAll('*').length);
  expect(nodes).toBeLessThan(3000);
  await expect(page.locator('.steamdb-table-row')).toHaveCount(0);
  await expect(page.locator('#tab-games-count')).not.toHaveText('0');
});

test('каталог: одна панель, поиск и сортировка', async ({ page }) => {
  await openDashboard(page);
  await page.keyboard.press('3');
  const catalog = page.locator('#view-catalog');
  await expect(catalog.locator('input[type="search"]')).toHaveCount(1);

  await page.locator('#catalog-sort-select').selectOption('title_asc');
  const titles = await page.locator('.table-game-title').allTextContents();
  expect(titles.length).toBeGreaterThan(1);
  const sorted = [...titles].sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base' }));
  expect(titles).toEqual(sorted);

  // Клик по заголовку CCU синхронизирует селект
  await page.locator('th[data-sort-col="ccu"]').click();
  await expect(page.locator('#catalog-sort-select')).toHaveValue('ccu_desc');

  const count = page.locator('#catalog-count-text');
  const before = await count.textContent();
  await page.locator('#catalog-search-input').fill(titles[0].slice(0, 6));
  await expect(count).not.toHaveText(before ?? '');
  await expect(page.locator('.steamdb-table-row').first()).toBeVisible();

  await page.locator('#btn-view-grid').click();
  await expect(page.locator('.catalog-cards-grid')).toBeVisible();
});

test('drawer открывается по строке и закрывается по Esc', async ({ page }) => {
  await openDashboard(page);
  await page.keyboard.press('3');
  await page.locator('.steamdb-table-row').first().click();
  const drawer = page.locator('#game-drawer');
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
});

test('«ТЗ для ИИ» в drawer архетипа с вкладки «Лидеры» — для этого архетипа, а не открытого раньше', async ({ page }) => {
  await openDashboard(page);
  const modalTitle = page.locator('#prompt-modal-dialog .prompt-modal-title');
  const withVerdict = await page
    .locator('#verdicts-container .verdict-card')
    .evaluateAll(cards => cards.map(c => c.getAttribute('data-archetype')));
  const moversTags = async () =>
    page.locator('#view-movers .archetype-tag').evaluateAll(tags => tags.map(t => t.getAttribute('data-archetype')));

  // Сначала архетип A с радара: раньше кнопка ТЗ запоминала его
  const archA = withVerdict[0]!;
  await page.locator(`#verdicts-container .verdict-card[data-archetype="${archA}"]`).click();
  await expect(page.locator('#game-drawer')).toHaveAttribute('aria-hidden', 'false');
  await page.keyboard.press('Escape');

  await page.keyboard.press('2');
  const archB = (await moversTags()).find(a => a && a !== archA && withVerdict.includes(a));
  expect(archB, 'на «Лидерах» есть тег другого архетипа с вердиктом').toBeTruthy();

  // Эталон: генератор для B прямо с карточки радара
  await page.keyboard.press('1');
  await page.locator(`#verdicts-container .btn-generate-ai-spec[data-archetype="${archB}"]`).click();
  const expected = await modalTitle.textContent();
  await page.keyboard.press('Escape');
  await expect(page.locator('#prompt-modal-backdrop')).not.toHaveClass(/active/);

  await page.keyboard.press('2');
  await page.locator(`#view-movers .archetype-tag[data-archetype="${archB}"]`).first().click();
  await expect(page.locator('#game-drawer')).toHaveAttribute('aria-hidden', 'false');
  await page.locator('#drawer-btn-generate-spec').dispatchEvent('click');
  await expect(modalTitle).toHaveText(expected!);
});

test('мобильная шапка 390px: без горизонтального скролла, название и все вкладки видны', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDashboard(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('.brand-name')).toBeVisible();
  for (const id of ['radar', 'movers', 'catalog', 'arbitrage']) {
    await expect(page.locator(`#tab-btn-${id}`)).toBeInViewport({ ratio: 1 });
  }
  await expect(page.locator('#kpi-updated-time')).toBeInViewport({ ratio: 1 });
});

test('GitHub Pages без API: вместо «Запустить скан» — ссылка на сервер, видно предупреждение об источнике', async ({
  page,
}) => {
  const sseRequests: string[] = [];
  page.on('request', req => {
    if (req.url().includes('/api/events')) sseRequests.push(req.url());
  });
  await openDashboard(page, {
    staticSnapshot: {
      ...FALLBACK_SNAPSHOT,
      id: 'snapshot-pages',
      timestamp: '2026-10-18T03:00:00.000Z',
      sourceStatus: {
        roblox: { ok: true, count: 279 },
        poki: { ok: true, count: 35, baseline: 100, warning: 'собрано 35 игр против 100 в последнем полном скане (−65%)' },
      },
    },
  });
  await expect(page.locator('#btn-live-scan')).toBeHidden();
  // На статике один снимок — сравнивать не с чем
  await expect(page.locator('#compare-selector-wrapper')).toBeHidden();
  const hint = page.locator('#scan-unavailable-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText('Скан доступен на radar.fuheshka.qd.je');
  await expect(hint).toHaveAttribute('href', 'https://radar.fuheshka.qd.je');

  const warning = page.locator('#kpi-source-warning');
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('Poki 35/100');
  await expect(page.locator('#kpi-source-warning-text')).toHaveAttribute('title', /−65%/);

  // Селектор — одна опция статического снимка, а не вечное «Загрузка срезов...»
  const select = page.locator('#snapshot-select');
  await expect(select.locator('option')).toHaveCount(1);
  await expect(select.locator('option:checked')).toHaveText('18 окт (320 игр)');

  // SSE не подключается: метка «Статика» не сменяется на «Реконнект...» (раньше — через ~1 с)
  const sseLabel = page.locator('#sse-label');
  await expect(sseLabel).toHaveText('Статика');
  const since = Date.now();
  let changedTo: string | null = null;
  await expect
    .poll(
      async () => {
        const text = await sseLabel.textContent();
        if (changedTo === null && text !== 'Статика') changedTo = text;
        if (changedTo !== null) return `сменилась на «${changedTo}»`;
        return Date.now() - since > 3_500 ? 'держится' : 'ждём';
      },
      { timeout: 8_000, intervals: [250] }
    )
    .toBe('держится');
  expect(sseRequests).toEqual([]);
});

test('демо-режим (ни API, ни статического снимка): в селекторе «Демо-данные»', async ({ page }) => {
  await openDashboard(page);
  const select = page.locator('#snapshot-select');
  await expect(select.locator('option')).toHaveCount(1);
  await expect(select.locator('option:checked')).toHaveText('Демо-данные');
  await expect(page.locator('#sse-label')).toHaveText('Оффлайн');
});

test('с API кнопка скана на месте, без проблем с источниками предупреждения нет', async ({ page }) => {
  await openDashboard(page, { snapshotList: [] });
  await expect(page.locator('#btn-live-scan')).toBeVisible();
  await expect(page.locator('#scan-unavailable-hint')).toBeHidden();
  await expect(page.locator('#kpi-source-warning')).toBeHidden();
});

test('drawer игры: график истории из /api/games/:id/history; на статике — подсказка', async ({ page }) => {
  const historyRequests: string[] = [];
  await openDashboard(page, { snapshotList: [] });
  await page.route('**/api/games/*/history', route => {
    historyRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({
      json: {
        id: 'x',
        platform: 'roblox',
        title: 'x',
        metricType: 'ccu',
        firstSeen: '2026-10-05',
        lastSeen: '2026-10-07',
        points: [
          { date: '2026-10-05', value: 12_000 },
          { date: '2026-10-06', value: 9_500 },
          { date: '2026-10-07', value: 31_200 },
        ],
      },
    });
  });
  await page.keyboard.press('3');
  await page.locator('.steamdb-table-row').first().click();
  const block = page.locator('#drawer-history');
  await expect(block.locator('.drawer-history-svg path')).toBeVisible();
  await expect(block.locator('[data-role="best"]')).toHaveText('31.2k');
  await expect(block.locator('[data-role="worst"]')).toHaveText('9.5k');
  await expect(block.locator('.drawer-history-dates')).toHaveText(/5 окт\s*7 окт/);
  expect(historyRequests).toHaveLength(1);
  expect(historyRequests[0]).toMatch(/^\/api\/games\/[^/]+\/history$/);

  // Мобильный drawer: график не вылезает за ширину (ресайз при закрытом drawer — без анимации выезда)
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.steamdb-table-row').first().click();
  await expect(page.locator('#game-drawer')).toHaveAttribute('aria-hidden', 'false');
  await expect(block.locator('.drawer-history-svg')).toBeInViewport({ ratio: 1 });
  const box = await block.locator('.drawer-history-chart').boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});

test('drawer игры без API: вместо графика — ссылка на сервер, запросов истории нет', async ({ page }) => {
  const historyRequests: string[] = [];
  page.on('request', req => {
    if (req.url().includes('/history')) historyRequests.push(req.url());
  });
  await openDashboard(page);
  await page.keyboard.press('3');
  await page.locator('.steamdb-table-row').first().click();
  const block = page.locator('#drawer-history');
  await expect(block).toBeVisible();
  await expect(block.locator('a')).toHaveAttribute('href', 'https://radar.fuheshka.qd.je');
  await expect(block.locator('svg.drawer-history-svg')).toHaveCount(0);
  expect(historyRequests).toEqual([]);
});

// Три среза истории: 18 окт (текущий), 17 окт (предыдущий), 15 окт. Отличаются CCU, score архетипа и нишами.
const [NICHE_A, NICHE_B] = FALLBACK_SNAPSHOT.arbitrageOpportunities ?? [];
const HISTORY: Record<string, typeof FALLBACK_SNAPSHOT> = {
  'snapshot-2026-10-18': historySnap('2026-10-18', 1_200_000, 80, [NICHE_A, NICHE_B]),
  'snapshot-2026-10-17': historySnap('2026-10-17', 1_000_000, 70, [NICHE_A, NICHE_B]),
  'snapshot-2026-10-15': historySnap('2026-10-15', 1_500_000, 50, [NICHE_A]),
};

function historySnap(date: string, ccu: number, topScore: number, niches: typeof NICHE_A[]): typeof FALLBACK_SNAPSHOT {
  const [first, ...rest] = FALLBACK_SNAPSHOT.verdicts;
  return {
    ...FALLBACK_SNAPSHOT,
    id: `snapshot-${date}`,
    timestamp: `${date}T03:00:00.000Z`,
    robloxTotalCCU: ccu,
    risers: undefined,
    verdicts: [{ ...first, opportunityScore: { ...first.opportunityScore, overallScore: topScore } }, ...rest],
    arbitrageOpportunities: niches,
  };
}

async function openWithHistory(page: Page, query = ''): Promise<void> {
  pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.route('**/api/**', route => route.abort());
  await page.route('**/api/snapshots', route =>
    route.fulfill({
      json: Object.values(HISTORY).map(s => ({
        id: s.id,
        timestamp: s.timestamp,
        date: s.timestamp.slice(0, 10),
        totalGamesScanned: s.totalGamesScanned,
        filename: `${s.id}.json`,
      })),
    })
  );
  await page.route('**/api/snapshots/snapshot-*', route => {
    const id = new URL(route.request().url()).pathname.split('/').pop()!;
    return HISTORY[id] ? route.fulfill({ json: HISTORY[id] }) : route.fulfill({ status: 404 });
  });
  await page.goto(`/${query}`);
  await expect(page.locator('#snapshot-select option:checked')).toHaveText(/18 окт/);
}

test('сравнение срезов: смена базы меняет KPI, лидеров, дельту архетипов, ниши и URL', async ({ page }) => {
  await openWithHistory(page);
  const compare = page.locator('#compare-select');
  await expect(page.locator('#compare-selector-wrapper')).toBeVisible();
  await expect(compare.locator('option:checked')).toHaveText('Предыдущий');
  // Текущего среза среди баз нет
  await expect(compare.locator('option')).toHaveText(['Предыдущий', /^17 окт/, /^15 окт/]);
  const ccu = page.locator('#kpi-total-ccu');
  await expect(ccu).toHaveText('1.20M (+20.0%)');

  await page.keyboard.press('2');
  const delta = page.locator('#archetype-delta');
  await expect(delta.locator('[data-role="archetype-delta-range"]')).toContainText('17 окт → 18 окт');
  await expect(delta.locator('tbody tr').first()).toContainText('70 → 80');

  await compare.selectOption('snapshot-2026-10-15');
  await expect(ccu).toHaveText('1.20M (-20.0%)');
  await expect(ccu).toHaveAttribute('title', 'Изменение относительно среза 15 окт');
  await expect(page).toHaveURL(/\?compare=snapshot-2026-10-15$/);
  await expect(delta.locator('[data-role="archetype-delta-range"]')).toContainText('15 окт → 18 окт');
  await expect(delta.locator('tbody tr').first()).toContainText('50 → 80');
  await expect(page.locator('.movers-section-gainers .section-title')).toHaveText('Топ лидеров роста CCU (vs 15 окт)');

  await page.keyboard.press('4');
  await expect(page.locator('[data-role="niches-added"]')).toHaveText('Новых ниш: 1');
  await expect(page.locator('[data-role="niches-removed"]')).toHaveText('Исчезло: 0');

  // «Предыдущий» убирает параметр
  await compare.selectOption('');
  await expect(ccu).toHaveText('1.20M (+20.0%)');
  await expect(page).not.toHaveURL(/compare=/);
  await expect(page.locator('[data-role="niches-added"]')).toHaveText('Новых ниш: 0');
});

test('сравнение по ссылке ?compare=: база выбрана сразу', async ({ page }) => {
  await openWithHistory(page, '?compare=snapshot-2026-10-15');
  await expect(page.locator('#compare-select option:checked')).toHaveText(/^15 окт/);
  await expect(page.locator('#kpi-total-ccu')).toHaveText('1.20M (-20.0%)');
});

test('мобильная шапка 390px со вторым селектором: без горизонтального скролла, оба селектора видны', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWithHistory(page);
  await expect(page.locator('#compare-selector-wrapper')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('#snapshot-selector-wrapper')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#compare-selector-wrapper')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.brand-name')).toBeVisible();
  for (const id of ['radar', 'movers', 'catalog', 'arbitrage']) {
    await expect(page.locator(`#tab-btn-${id}`)).toBeInViewport({ ratio: 1 });
  }
});
