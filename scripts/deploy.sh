#!/usr/bin/env bash
set -euo pipefail

# Деплой на сервер: pull -> npm ci -> build -> pm2 reload -> healthcheck.
# Если после перезапуска /healthz не отвечает — автоматический откат на предыдущий коммит.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

BRANCH="${DEPLOY_BRANCH:-main}"
PORT="${PORT:-4200}"
HEALTH_URL="http://127.0.0.1:${PORT}/healthz"

mkdir -p logs data

build_and_restart() {
  npm ci
  npm run build
  npm run web:build
  if command -v pm2 >/dev/null 2>&1; then
    pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs
    pm2 save >/dev/null 2>&1 || true
  else
    echo "pm2 не найден: npm install -g pm2" >&2
    return 1
  fi
}

healthy() {
  for _ in $(seq 1 20); do
    if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

# Тело в функции: git merge может подменить этот файл, bash должен дочитать его целиком до запуска.
main() {
  PREV_COMMIT="$(git rev-parse HEAD)"
  echo "📥 Обновление ветки ${BRANCH} (сейчас ${PREV_COMMIT:0:7})"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git merge --ff-only "origin/${BRANCH}"
  NEW_COMMIT="$(git rev-parse HEAD)"

  build_and_restart

  if healthy; then
    echo "✅ Деплой ${NEW_COMMIT:0:7} успешен: $(curl -fsS "$HEALTH_URL")"
    return 0
  fi

  echo "❌ Healthcheck не прошёл — откат на ${PREV_COMMIT:0:7}" >&2
  git reset --hard "$PREV_COMMIT"
  build_and_restart || true
  if healthy; then
    echo "↩️ Откат выполнен, сервис жив" >&2
  else
    echo "🔥 Сервис не поднялся даже после отката: pm2 logs game-trend-radar" >&2
  fi
  return 1
}

main "$@"
exit $?
