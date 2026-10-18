// Разовое восстановление истории по играм из git-истории web/public/data/latest_snapshot.json.
// Запуск: npx tsx scripts/backfill_game_history.ts  (старый data/game_history.json уходит в .bak-<время>)
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { GameHistory, recordSnapshot } from '../src/analyzer/game_history.js';
import { MarketSnapshot } from '../src/types/index.js';

const FILE = 'web/public/data/latest_snapshot.json';
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 });

const snapshots: MarketSnapshot[] = [];
for (const hash of git('log', '--format=%H', '--', FILE).split('\n').filter(Boolean)) {
  try {
    snapshots.push(JSON.parse(git('show', `${hash}:${FILE}`)) as MarketSnapshot);
  } catch {
    // коммит без файла или с битым JSON — пропускаем
  }
}
snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

let history: GameHistory | null = null;
for (const s of snapshots) history = recordSnapshot(history, s);

const out = path.resolve('data/game_history.json');
// Файл в .gitignore и копится только на этой машине: без бэкапа повторный запуск стёр бы накопленное
if (fs.existsSync(out)) fs.renameSync(out, `${out}.bak-${Date.now()}`);
fs.writeFileSync(`${out}.tmp`, JSON.stringify(history), 'utf-8');
fs.renameSync(`${out}.tmp`, out);
const days = new Set(snapshots.map(s => s.timestamp.slice(0, 10)));
console.log(`✅ ${out}: ${snapshots.length} снимков за ${days.size} дней, игр: ${Object.keys(history?.games ?? {}).length}, с ${history?.since}`);
