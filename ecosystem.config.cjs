const fs = require('node:fs');
const path = require('node:path');

// Prefer compiled production bundle if available; fallback to TypeScript via tsx
const distServer = path.resolve(__dirname, 'dist', 'server.js');
const useCompiled = fs.existsSync(distServer);

module.exports = {
  apps: [
    {
      name: 'game-trend-radar',
      script: useCompiled ? 'dist/server.js' : 'src/server.ts',
      ...(useCompiled
        ? {}
        : {
            interpreter: 'node',
            node_args: '--import tsx',
          }),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        PORT: 4200,
        NODE_ENV: 'production',
      },
      // Log formatting and rotation
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      min_uptime: '5s',
      max_restarts: 10,
    },
  ],
};
