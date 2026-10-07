#!/usr/bin/env bash
set -euo pipefail

# Scheduled night market scan runner for cron
# NOTE: при SCAN_INTERVAL_MIN>0 сервер сканирует сам — cron не нужен.
# Triggers POST /api/scan on the running PM2 server, which broadcasts real-time SSE progress
# to all connected dashboard clients and saves a new daily snapshot.

PORT="${PORT:-4200}"
HOST="${HOST:-127.0.0.1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/logs/cron-scan.log"

mkdir -p "$PROJECT_ROOT/logs"

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] 🚀 Triggering scheduled market scan via http://${HOST}:${PORT}/api/scan..." >> "$LOG_FILE"

# SCAN_TOKEN обязателен, если сервер запущен с ним. ?wait=1 — дождаться результата.
AUTH_ARGS=()
if [ -n "${SCAN_TOKEN:-}" ]; then
  AUTH_ARGS=(-H "Authorization: Bearer ${SCAN_TOKEN}")
fi

RESPONSE=$(curl -s --max-time 180 -w "\n%{http_code}" -X POST ${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"} "http://${HOST}:${PORT}/api/scan?wait=1" || printf '\n000')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 202 ]; then
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] ✅ Market scan completed successfully (HTTP $HTTP_CODE)." >> "$LOG_FILE"
else
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] ❌ Market scan failed with HTTP code $HTTP_CODE: $BODY" >> "$LOG_FILE"
  exit 1
fi
