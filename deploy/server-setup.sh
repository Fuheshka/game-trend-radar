#!/usr/bin/env bash
# Первичная установка Game Trend Radar на сервер, где уже работают VLESS/MTProto/nginx.
# Запускать под root на сервере. Только ДОБАВЛЯЕТ: существующие конфиги не редактируются,
# порт 443 (SNI-маршрутизатор) не трогается. Дашборд будет на https://fuheshka.qd.je:2096
# Идемпотентен: повторный запуск безопасен.
# ВНИМАНИЕ: шаг 4 создаёт сайт на :2096. В боевой конфигурации сайт переведён на
# radar.fuheshka.qd.je через SNI-карту stream на 443 (loopback :2097, сертификат acme.sh/ZeroSSL).
# Повторный запуск целиком вернёт :2096 и перезапишет /etc/nginx/sites-available/radar-dashboard.
set -euo pipefail

APP_USER=radar
APP_DIR=/home/radar/game-trend-radar
REPO=https://github.com/Fuheshka/game-trend-radar.git
TLS_PORT=2096
SITE=/etc/nginx/sites-available/radar-dashboard
LINK=/etc/nginx/sites-enabled/radar-dashboard
CERT=/etc/ssl/fuheshka/fullchain.pem
KEY=/etc/ssl/fuheshka/key.pem

[ "$(id -u)" -eq 0 ] || { echo "Запусти под root"; exit 1; }
[ -f "$CERT" ] && [ -f "$KEY" ] || { echo "Нет сертификата $CERT / $KEY"; exit 1; }
id "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"

echo "== 1/5 Отключаем Caddy (он не нужен и конфликтует с nginx за порты)"
systemctl disable --now caddy >/dev/null 2>&1 || true

echo "== 2/5 Код и сборка (пользователь $APP_USER)"
su - "$APP_USER" -c "
  set -e
  test -d $APP_DIR || git clone -q $REPO $APP_DIR
  cd $APP_DIR && git checkout -q main && git pull -q --ff-only
  if [ ! -f .env ]; then
    cp .env.example .env
    sed -i \"s/^SCAN_TOKEN=.*/SCAN_TOKEN=\$(openssl rand -hex 24)/\" .env
    chmod 600 .env
  fi
  npm ci --no-audit --no-fund >/dev/null
  npm run build >/dev/null
  npm run web:build >/dev/null
"

echo "== 3/5 Запуск через PM2 + автостарт после перезагрузки"
su - "$APP_USER" -c "cd $APP_DIR && pm2 startOrReload ecosystem.config.cjs --update-env && pm2 save >/dev/null"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null 2>&1 || true

for _ in $(seq 1 20); do
  curl -fsS --max-time 3 http://127.0.0.1:4200/healthz >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS http://127.0.0.1:4200/healthz >/dev/null || { echo "Приложение не поднялось: su - $APP_USER -c 'pm2 logs --lines 50'"; exit 1; }
echo "   приложение отвечает на 127.0.0.1:4200"

echo "== 4/5 nginx: новый отдельный сайт на порту $TLS_PORT"
cat > "$SITE" <<NGINX
# Game Trend Radar: HTTPS на отдельном порту, не затрагивает stream-маршрутизатор на 443.
server {
    listen $TLS_PORT ssl http2;
    listen [::]:$TLS_PORT ssl http2;
    server_name fuheshka.qd.je;

    ssl_certificate $CERT;
    ssl_certificate_key $KEY;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # SSE: без буферизации
    location /api/events {
        proxy_pass http://127.0.0.1:4200;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 1h;
    }

    location / {
        proxy_pass http://127.0.0.1:4200;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
NGINX
ln -sf "$SITE" "$LINK"
if nginx -t 2>/dev/null; then
  systemctl reload nginx
  echo "   nginx перезагружен"
else
  rm -f "$LINK"
  echo "nginx -t не прошёл — сайт отключён, старые конфиги не изменялись:"
  nginx -t || true
  exit 1
fi

echo "== 5/5 Проверка"
curl -fsS --max-time 5 --resolve fuheshka.qd.je:$TLS_PORT:127.0.0.1 "https://fuheshka.qd.je:$TLS_PORT/healthz" && echo
echo
echo "Готово: https://fuheshka.qd.je:$TLS_PORT"
echo "Токен скана: grep SCAN_TOKEN $APP_DIR/.env   (не публикуй его)"
echo "Откат сайта:  rm $LINK && systemctl reload nginx && su - $APP_USER -c 'pm2 delete game-trend-radar'"
