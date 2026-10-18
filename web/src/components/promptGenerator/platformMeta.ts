import type { AiAssistant, TargetStore } from './types.js';

export function getStoreMeta(store: TargetStore): { name: string; interstitialSec: number; rules: string } {
  switch (store) {
    case 'yandex_games':
      return {
        name: 'Яндекс Игры (Yandex Games SDK v2)',
        interstitialSec: 90,
        rules: `- **Глушение звука**: ОБЯЗАТЕЛЬНО вызывать \`AudioListener.pause = true\` (Unity), \`AudioServer.set_bus_mute(0, true)\` (Godot) или \`audioCtx.suspend()\` (Web Audio) при показе рекламы и сворачивании вкладки браузера (\`document.visibilityState === 'hidden'\`). Это жесткое требование модерации Яндекса!
- **Safe Area**: учитывать верхнюю сервисную полосу Яндекса и нижнюю системную панель браузера на смартфонах.
- **Сохранение в облако**: использовать \`ysdk.getPlayer().setData()\` для бесшовной синхронизации между мобильным телефоном и десктопом.`,
      };

    case 'poki':
      return {
        name: 'Poki Web Portal (PokiSDK)',
        interstitialSec: 120,
        rules: `- **Жизненный цикл**: строгие вызовы \`PokiSDK.gameLoadingStart()\`, \`PokiSDK.gameLoadingFinished()\`, \`PokiSDK.gameplayStart()\` и \`PokiSDK.gameplayStop()\`.
- **Commercial Break**: показ рекламы строго в моменты пауз между раундами.`,
      };

    case 'roblox':
      return {
        name: 'Roblox Discovery',
        interstitialSec: 0,
        rules: `- **Монетизация через Robux**: Developer Products (расходники: бусты, валюта) и GamePasses (постоянные привилегии: VIP, x2 скорость).
- **Соблюдение правил Roblox ToS**: запрет внешних ссылок и сторонней рекламы; только нативные механики Roblox.`,
      };

    case 'crazygames':
    case 'general_web':
    default:
      return {
        name: 'Веб-порталы / General WebGL',
        interstitialSec: 100,
        rules: `- **Кроссбраузерность**: поддержка Safari iOS, Chrome Android и десктопных браузеров.
- **Авто-пауза**: остановка игрового таймера при потере фокуса окна (\`window.onblur\`).`,
      };
  }
}

export function formatAiInstructions(assistant: AiAssistant): string {
  switch (assistant) {
    case 'cursor':
      return `### Инструкция для Cursor AI (.cursorrules формат)
- Работай в режиме строгого соблюдения типов (TypeScript / C# strict mode).
- Генерируй код модульно, разделяя логику, отображение и SDK мосты.
- Не используй устаревшие API или неподдерживаемые в WebGL библиотеки.
- После написания каждого модуля сразу предлагай юнит-тест или проверочный скрипт.`;

    case 'claude':
      return `### Инструкция для Claude 3.7 / Anthropic
- Начни с подробного анализа архитектуры и контрактов данных перед генерацией файлов.
- Обеспечь нулевые утечки памяти: отписывайся от событий при уничтожении объектов.
- Избегай заглушек (stubs) и плейсхолдеров вроде \`// implement logic here\`; пиши полноценную рабочую логику.
- Держи все компоненты слабосвязанными через событийную шину.`;

    case 'chatgpt':
    default:
      return `### Инструкция для ChatGPT / OpenAI Codex
- Предоставляй готовый к запуску код по шагам: сначала конфигурация, затем контроллеры, затем UI.
- Соблюдай принцип YAGNI: минимальный работающий код без избыточных абстракций.
- Предусматривай обработку ошибок во всех асинхронных вызовах (SDK, сеть, сохранения).`;
  }
}
