import { describe, it, expect } from 'vitest';
import { escapeHtml, safeUrl, safeHref } from '../web/src/utils/dom.js';

describe('DOM safety helpers', () => {
  it('escapeHtml экранирует все спецсимволы HTML и терпит null/undefined', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#039;y&#039;&gt;&amp;&lt;/a&gt;'
    );
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('safeUrl пропускает только http(s)', () => {
    expect(safeUrl('https://www.roblox.com/games/1')).toBe('https://www.roblox.com/games/1');
    expect(safeUrl('http://poki.com/en/g/x')).toBe('http://poki.com/en/g/x');
    expect(safeUrl('javascript:alert(1)')).toBe('#');
    expect(safeUrl('  JavaScript:alert(1)')).toBe('#');
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
    expect(safeUrl('vbscript:msgbox(1)')).toBe('#');
    expect(safeUrl('/relative/path')).toBe('#');
    expect(safeUrl('')).toBe('#');
    expect(safeUrl(undefined)).toBe('#');
  });

  it('safeHref не даёт выйти из атрибута через кавычку', () => {
    expect(safeHref('https://e.com/?q="><script>')).not.toContain('"');
    expect(safeHref('https://e.com/?q="><script>')).not.toContain('<');
  });
});
