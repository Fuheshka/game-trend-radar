#!/usr/bin/env bash
set -euo pipefail

echo "========================================="
echo "🚀 Game Trend Radar | Production Deployment"
echo "========================================="

# Determine project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "📂 Project root: $PROJECT_ROOT"

# Ensure logs directory exists
mkdir -p "$PROJECT_ROOT/logs"

# 1. Pull latest code from repository
echo "📥 [1/4] Pulling latest changes from git..."
git pull

# 2. Install dependencies
echo "📦 [2/4] Installing dependencies..."
npm install

# 3. Build backend and frontend assets
echo "🔨 [3/4] Building production bundles..."
npm run build
npm run web:build

# 4. Restart or start PM2 process
echo "🔄 [4/4] Restarting server via PM2..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs || pm2 start ecosystem.config.cjs
  echo "📊 PM2 process status:"
  pm2 status game-trend-radar
else
  echo "⚠️ PM2 not found in PATH. Server not reloaded automatically."
  echo "👉 Install PM2 globally: npm install -g pm2"
  echo "👉 Or start manually: npx pm2 start ecosystem.config.cjs"
fi

echo "========================================="
echo "✅ Deployment completed successfully!"
echo "========================================="
