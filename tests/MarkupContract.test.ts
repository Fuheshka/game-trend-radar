import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CATALOG_SORTS, PLATFORM_FILTERS, STATUS_FILTERS, VERDICT_SORTS } from '../web/src/main.js';
import { pickOption } from '../web/src/utils/dom.js';

// Значения из разметки приходят в код строками: расхождение раньше молча ломало сортировку каталога
const html = fs.readFileSync(path.resolve(__dirname, '../web/index.html'), 'utf-8');

function selectOptions(id: string): string[] {
  const block = html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>([\\s\\S]*?)</select>`));
  expect(block, `select #${id}`).not.toBeNull();
  return [...block![1].matchAll(/value="([^"]+)"/g)].map(m => m[1]);
}

function attrValues(attr: string): string[] {
  return [...html.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))].map(m => m[1]);
}

describe('контракт разметки index.html и обработчиков main.ts', () => {
  it('каждая опция сортировки каталога маппится на колонку таблицы', () => {
    const values = selectOptions('catalog-sort-select');
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) expect(CATALOG_SORTS[v], v).toBeDefined();
  });

  it('опции сортировки вердиктов, фильтры витрин и статусов известны коду', () => {
    for (const v of selectOptions('sort-select')) expect(VERDICT_SORTS).toContain(v);
    for (const v of attrValues('data-platform')) expect(PLATFORM_FILTERS).toContain(v);
    for (const v of attrValues('data-catalog-platform')) expect(PLATFORM_FILTERS).toContain(v);
    for (const v of attrValues('data-status')) expect(STATUS_FILTERS).toContain(v);
  });

  it('pickOption пропускает только допустимые значения', () => {
    expect(pickOption('roblox', PLATFORM_FILTERS)).toBe('roblox');
    expect(pickOption('steam', PLATFORM_FILTERS)).toBeNull();
    expect(pickOption(null, PLATFORM_FILTERS)).toBeNull();
  });
});
