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
  await openDashboard(page, {
    staticSnapshot: {
      ...FALLBACK_SNAPSHOT,
      id: 'snapshot-pages',
      sourceStatus: {
        roblox: { ok: true, count: 279 },
        poki: { ok: true, count: 35, baseline: 100, warning: 'собрано 35 игр против 100 в последнем полном скане (−65%)' },
      },
    },
  });
  await expect(page.locator('#btn-live-scan')).toBeHidden();
  const hint = page.locator('#scan-unavailable-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText('Скан доступен на radar.fuheshka.qd.je');
  await expect(hint).toHaveAttribute('href', 'https://radar.fuheshka.qd.je');

  const warning = page.locator('#kpi-source-warning');
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('Poki 35/100');
  await expect(page.locator('#kpi-source-warning-text')).toHaveAttribute('title', /−65%/);
});

test('с API кнопка скана на месте, без проблем с источниками предупреждения нет', async ({ page }) => {
  await openDashboard(page, { snapshotList: [] });
  await expect(page.locator('#btn-live-scan')).toBeVisible();
  await expect(page.locator('#scan-unavailable-hint')).toBeHidden();
  await expect(page.locator('#kpi-source-warning')).toBeHidden();
});
