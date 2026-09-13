import { defineConfig } from 'vite';
import * as fs from 'node:fs';
import * as path from 'node:path';

export default defineConfig({
  root: 'web',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4200',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    {
      name: 'copy-latest-snapshot',
      buildStart() {
        const snapshotsDir = path.resolve(process.cwd(), 'data/snapshots');
        const publicDataDir = path.resolve(process.cwd(), 'web/public/data');
        if (fs.existsSync(snapshotsDir)) {
          const files = fs
            .readdirSync(snapshotsDir)
            .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
            .sort()
            .reverse();
          if (files.length > 0) {
            fs.mkdirSync(publicDataDir, { recursive: true });
            fs.copyFileSync(
              path.join(snapshotsDir, files[0]),
              path.join(publicDataDir, 'latest_snapshot.json')
            );
          }
        }
      },
    },
  ],
});

