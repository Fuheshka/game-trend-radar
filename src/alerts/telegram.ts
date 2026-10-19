import { fetchWithTimeout } from '../utils/http.js';
import { asRecord } from '../utils/json.js';

export interface TelegramConfig {
  token: string;
  chatId: string;
}

/** Без TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID алерты выключены. */
export function readTelegramConfig(env: NodeJS.ProcessEnv = process.env): TelegramConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  return token && chatId ? { token, chatId } : null;
}

/** Bot API sendMessage. Ошибка бросается без URL: в нём токен, а сообщение уходит в лог. */
export async function sendTelegramMessage(config: TelegramConfig, html: string, timeoutMs = 10_000): Promise<void> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `https://api.telegram.org/bot${config.token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: html,
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        }),
      },
      timeoutMs
    );
  } catch (err) {
    const reason =
      err instanceof Error ? (err.name === 'AbortError' ? `таймаут ${timeoutMs} мс` : err.message) : String(err);
    throw new Error(`Telegram недоступен: ${reason}`);
  }
  if (!res.ok) {
    const body = asRecord(await res.json().catch(() => null));
    const description = typeof body.description === 'string' ? body.description : res.statusText;
    throw new Error(`Telegram ответил ${res.status}: ${description}`);
  }
}
