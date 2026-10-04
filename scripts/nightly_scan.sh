#!/usr/bin/env bash
set -euo pipefail

# Scheduled night market scan runner for cron
# Triggers POST /api/scan on the running PM2 server, which broadcasts real-time SSE progress
# to all connected dashboard clients and saves a new daily snapshot.

PORT="${PORT:-4200}"
HOST="${HOST:-127.0.0.1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/logs/cron-scan.log"

mkdir -p "$PROJECT_ROOT/logs"

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] 🚀 Triggering scheduled market scan via http://${HOST}:${PORT}/api/scan..." >> "$LOG_FILE"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://${HOST}:${PORT}/api/scan" || echo -e "\n000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] ✅ Market scan completed successfully (HTTP 200)." >> "$LOG_FILE"
else
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] ❌ Market scan failed with HTTP code $HTTP_CODE: $BODY" >> "$LOG_FILE"
  exit 1
fi
