/**
 * Мелкие DOM-помощники шапки, общие для контроллеров: тост, статус сервера, кнопка звука.
 */

export function showToast(message: string): void {
  const toast = document.getElementById('toast-notification');
  const toastText = document.getElementById('toast-text');
  if (!toast || !toastText) return;

  toastText.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

/** Точка статуса и подпись сервера в шапке; online=false красит точку в «оффлайн». */
export function setServerStatus(online: boolean, text: string): void {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('server-status-text');
  statusDot?.classList.toggle('offline', !online);
  if (statusText) statusText.textContent = text;
}

export type ServerStatusSetter = typeof setServerStatus;

export function updateSoundUI(muted: boolean): void {
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const soundToggleLabel = document.getElementById('sound-toggle-label');
  btnSoundToggle?.classList.toggle('active', !muted);
  if (soundToggleLabel) {
    soundToggleLabel.textContent = muted ? 'Mute' : 'Sound On';
  }
}
