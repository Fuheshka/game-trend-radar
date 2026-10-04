# Game Trend Radar 📡🎮

> Кросс-платформенная система сбора, скоринга и аналитики игрового рынка для инди-разработчиков и студий (Roblox, Яндекс Игры, YouTube Shorts, Poki).

---

## 🎯 Зачем это нужно

Разработка игры требует недель и месяцев работы. Game Trend Radar помогает избежать главной ошибки — делать игру, которая никому не нужна или рынок которой перегрет гигантскими студиями («красный океан»).

Система в реальном времени собирает метрики витрин, классифицирует геймплейные архетипы и рассчитывает **Opportunity Score** (Индекс рыночной привлекательности), выдавая четкий вердикт:
- 🟢 **Green Light:** высокий спрос, растущий тренд, минимальная конкуренция, быстрая сборка.
- 🟡 **Yellow Light:** крепкая ниша, но требуется уникальный крючок (USP).
- 🔴 **Red Light:** перенасыщенный рынок или неподъемная трудоемкость для соло-разработчика.

---

## ⚡ Быстрый старт

### Требования
- Node.js 20+ (или Bun)
- npm

### Установка
```bash
npm install
```

### Запуск команд
```bash
# Быстрое сканирование всех витрин (Roblox, Яндекс Игры, Poki)
npm run scan

# Запуск единого веб-интерфейса (автоматически открывает дашборд в браузере)
npm run ui

# Вывод аналитического отчета по жанрам и лидерам онлайна
npm run report

# Топ рекомендаций: что выгодно делать прямо сейчас
npm run recommend
```

### Веб-дашборд и GitHub Pages
- **Локальный запуск:** `npm run ui` (стартует HTTP-сервер на `:4200` и открывает страницу).
- **GitHub Pages:** автоматический деплой настроен через `.github/workflows/deploy-pages.yml`. Статический билд: `npm run pages:build`.

---

## 🌐 Настройка веб-сервера и продакшн (Nginx и Caddy)

Готовые конфигурационные файлы для домена `fuheshka.qd.je` находятся в папке `deploy/`:
- [`deploy/nginx.conf`](deploy/nginx.conf): конфигурация Nginx с отключением буферизации для SSE (`/api/events`), сжатием Gzip и защитными заголовками безопасности.
- [`deploy/Caddyfile`](deploy/Caddyfile): альтернатива на Caddy с автоматическим получением HTTPS-сертификатов и немедленным сбросом чанков (`flush_interval -1`).

### 1. Настройка DNS (A-запись)
Перед выпуском SSL-сертификата привязываем домен к публичному IP сервера:
1. В панели управления DNS (Cloudflare, Reg.ru, Beget и др.) создаем запись:
   - **Тип:** `A`
   - **Имя / Хост:** `fuheshka` (для зоны `qd.je`)
   - **Значение (IP):** `<IP_СЕРВЕРА>`
   - **TTL:** `300` сек (или Auto)
   - **Проксирование:** DNS only (для Cloudflare отключаем оранжевое облако на время верификации Certbot).
2. Проверяем обновление DNS-записи в терминале:
   ```bash
   dig +short fuheshka.qd.je
   # или
   nslookup fuheshka.qd.je
   ```

### 2. Вариант A: Nginx и получение SSL через Certbot
1. **Копируем конфигурационный файл:**
   ```bash
   sudo cp deploy/nginx.conf /etc/nginx/sites-available/fuheshka.qd.je
   sudo ln -s /etc/nginx/sites-available/fuheshka.qd.je /etc/nginx/sites-enabled/
   ```
2. **Выпускаем сертификат через Certbot:**
   - Устанавливаем Certbot (для Ubuntu/Debian):
     ```bash
     sudo apt update && sudo apt install -y certbot python3-certbot-nginx
     ```
   - Запускаем выпуск сертификата:
     ```bash
     sudo certbot --nginx -d fuheshka.qd.je
     ```
   - Проверяем автоматическое продление:
     ```bash
     sudo certbot renew --dry-run
     ```
3. **Проверяем синтаксис и перезагружаем Nginx:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### 3. Вариант B: Caddy (автоматический HTTPS)
Caddy самостоятельно запрашивает, продлевает и валидирует сертификаты Let's Encrypt и ZeroSSL без необходимости ставить Certbot:
1. **Копируем конфигурацию:**
   ```bash
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
   ```
2. **Проверяем синтаксис и перезагружаем Caddy:**
   ```bash
   caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

### 4. Проверка работы потокового SSE стриминга
Проверяем, что события приходят без задержек и буферизации:
```bash
curl -N -H "Accept: text/event-stream" https://fuheshka.qd.je/api/events
```
В терминал должны сразу поступать сервисные heartbeat-сигналы (`: ping`) каждые 15 секунд без накопления буфера.

---

## 📚 База знаний и документация

Вся документация, архитектура и дорожная карта разработки хранятся в базе знаний Obsidian Vault:
`10 Projects/11 Active/Game Trend Radar — Анализ Рынка и Трендов Игр/`:
- **00 Паспорт и видение**
- **01 Источники данных и спецификация API**
- **02 Модель скоринга и принятия решений**
- **03 Каталог игровых архетипов и виральность**
- **08 Каталог промптов и кодогенерации** (интерактивные слэш-команды `[/goal](slashCommand;goal)`, `[/ponytail](slashCommand;ponytail)`)
- **implementation-notes.md** (в корне репозитория)

---

## 🛠 Технологический стек
- **Runtime:** Node.js 20+ / TypeScript (ES2022, NodeNext)
- **Исполнение:** `tsx`
- **Протоколы:** Нативный `fetch`, HTTP/2, REST API, Server-Sent Events (SSE)
- **Архитектура:** Модульные адаптеры коллекторов, чистые типизированные контракты, YAGNI.

---

## Автор и поддержка

Сделано с душой и любовью ❤️

**Даниил К. (Fuheshka)**

- 💬 **Telegram:** [@fuheshka](https://t.me/fuheshka)
- ✉️ **Email:** [me@kuviko.ru](mailto:me@kuviko.ru)
- ☕ **Поддержать чашкой кофе (СБП / T-Pay):** [pay.cloudtips.ru/p/7adeaa28](https://pay.cloudtips.ru/p/7adeaa28)
- 💎 **TON:** `UQC-DsraaDQRjUjG9oPRkt5nGlMgxKY-pjMC6xeeYGfxiu9a`

