import type { TargetEngine, EngineMeta } from './types.js';

export function getEngineMeta(engine: TargetEngine): EngineMeta {
  switch (engine) {
    case 'unity_webgl':
      return {
        title: 'Unity WebGL (C# / URP / WebGL 2.0)',
        badge: 'Unity 2022.3+ LTS / URP',
        folderTree: `Assets/
├── _Project/
│   ├── Scripts/
│   │   ├── Core/
│   │   │   ├── GameManager.cs
│   │   │   ├── GameStateMachine.cs
│   │   │   └── Bootstrapper.cs
│   │   ├── Gameplay/
│   │   │   ├── PlayerController.cs
│   │   │   ├── GameMechanicManager.cs
│   │   │   └── UpgradeSystem.cs
│   │   ├── Economy/
│   │   │   ├── CurrencyManager.cs
│   │   │   └── ShopConfig.cs
│   │   ├── UI/
│   │   │   ├── HUDView.cs
│   │   │   ├── ShopModalView.cs
│   │   │   └── GameOverView.cs
│   │   └── SDK/
│   │       ├── YandexGamesBridge.cs
│   │       └── Plugins/WebGL/YandexSDK.jslib
│   ├── Prefabs/
│   ├── ScriptableObjects/
│   └── Scenes/
│       ├── Boot.unity
│       └── MainGameplay.unity`,
        contracts: `// Contracts & Interfaces
public interface IEconomyService {
    double GetCurrency(string id);
    bool Spend(string id, double amount);
    void Add(string id, double amount, string source);
}

public interface IPlatformSDK {
    void ShowRewardedAd(System.Action onSuccess, System.Action onError);
    void ShowInterstitial(System.Action onClosed);
    void SavePlayerData(string jsonData);
    void LoadPlayerData(System.Action<string> onLoaded);
}`,
        optimization: `- **Изоляция проекта**: вести разработку строго в папке Assets/_Project для чистой структуры.
- **Лимит памяти WebGL**: установить WebGL Memory Size строго в 256–384 МБ в ProjectSettings.
- **Zero-GC в цикле**: запретить аллокации в \`Update()\` (LINQ, \`new\`, строковые конкатенации). Использовать Object Pooling для всех спавнящихся объектов.
- **Мост .jslib**: интеграция с витриной через \`[DllImport("__Internal")]\` и \`Application.focusChanged\` для глушения \`AudioListener.pause = !hasFocus\` (жесткое требование модерации Яндекс Игр).
- **Сжатие билда**: Brotli с Decompression Fallback.`,
      };

    case 'godot_4':
      return {
        title: 'Godot 4 (GDScript 2.0 / Web Compatibility)',
        badge: 'Godot 4.3+ Compatibility',
        folderTree: `res://
├── scenes/
│   ├── boot.tscn
│   ├── main_game.tscn
│   ├── ui/
│   │   ├── hud.tscn
│   │   └── shop_modal.tscn
├── scripts/
│   ├── autoload/
│   │   ├── game_manager.gd
│   │   ├── state_machine.gd
│   │   ├── sound_manager.gd
│   │   └── platform_sdk.gd
│   ├── core/
│   │   ├── player_controller.gd
│   │   ├── upgrade_system.gd
│   │   └── currency_manager.gd
│   └── ui/
│       └── hud_controller.gd
├── resources/
│   ├── balance_config.tres
│   └── game_state.tres
└── assets/
    ├── sprites/
    └── audio/`,
        contracts: `## GDScript 2.0 Typed Contracts
class_name IGameService
extends RefCounted

signal currency_changed(type: String, new_amount: float)
signal state_transitioned(old_state: int, new_state: int)

func spend_currency(amount: float) -> bool:
    return false

func add_currency(amount: float, source: String = "gameplay") -> void:
    pass`,
        optimization: `- **Web Export**: использовать рендерер Compatibility (OpenGL ES 3.0 / WebGL 2.0) для мгновенного запуска на мобильных браузерах.
- **Single-Threaded**: отключить Threads в настройках экспорта, если сервер не отдает COOP/COEP заголовки.
- **JavaScriptBridge**: вызовы витрины через \`JavaScriptBridge.get_interface("window")\` и \`JavaScriptBridge.eval()\`.
- **Глушение звука**: глушить главный аудио-бус \`AudioServer.set_bus_mute(0, true)\` при потере фокуса окна (уведомления \`NOTIFICATION_APPLICATION_FOCUS_OUT\`).`,
      };

    case 'vite_canvas':
      return {
        title: 'Vite + Canvas 2D / PixiJS (Zero-Engine Web)',
        badge: 'TypeScript / Canvas 2D / <2MB',
        folderTree: `src/
├── core/
│   ├── GameLoop.ts          # 60fps requestAnimationFrame loop
│   ├── StateMachine.ts      # Game state transitions
│   └── EventBus.ts          # Decoupled pub/sub event bus
├── entities/
│   ├── Player.ts            # Player entity and movement
│   ├── GameEntity.ts        # Base poolable object
│   └── ObjectPool.ts        # Zero-allocation entity pool
├── systems/
│   ├── RenderSystem.ts      # Canvas 2D / Pixi rendering
│   ├── PhysicsSystem.ts     # Lightweight collision & movement
│   └── EconomySystem.ts     # Sinks, faucets & balance
├── sdk/
│   ├── PlatformSdkBridge.ts # Yandex SDK / Poki SDK wrapper
│   └── SoundService.ts      # Web Audio API + suspend on blur
├── ui/
│   ├── HudOverlay.ts        # DOM / Canvas HUD
│   └── ShopModal.ts         # Upgrade modal dialog
├── config/
│   ├── GameConfig.ts        # Balance constants
│   └── types.ts             # Strict TypeScript definitions
└── main.ts                  # Entrypoint & bootstrap`,
        contracts: `export interface IGameState {
  score: number;
  softCurrency: number;
  multiplier: number;
  prestigeLevel: number;
  unlockedUpgrades: Record<string, number>;
}

export interface IPlatformSdk {
  init(): Promise<boolean>;
  showRewarded(): Promise<boolean>;
  showInterstitial(): Promise<boolean>;
  saveData(data: IGameState): Promise<void>;
  loadData(): Promise<IGameState | null>;
}`,
        optimization: `- **Zero-Bundle Footprint**: общий вес продакшн бандла < 1.5–2 МБ (мгновенная загрузка < 1 секунды даже на 3G).
- **Pointer Events**: единый стек ввода через \`pointerdown\`, \`pointermove\`, \`pointerup\` с \`touch-action: none\` для предотвращения скролла мобильного браузера.
- **Web Audio Context**: вызов \`audioCtx.suspend()\` по событию visibilitychange (\`document.visibilityState === 'hidden'\`) и возобновление при возврате.
- **DPI Scaling**: корректная поддержка Retina дисплеев через \`window.devicePixelRatio\` без замыливания спрайтов.`,
      };

    case 'roblox_studio':
      return {
        title: 'Roblox Studio (Luau / Client-Server)',
        badge: 'Luau Strict / DataStoreService',
        folderTree: `ReplicatedStorage/
├── Shared/
│   ├── Configs/
│   │   ├── GameBalance.luau
│   │   └── ShopItems.luau
│   ├── RemoteDefinitions.luau
│   └── Utility/
│       └── Signal.luau
ServerScriptService/
├── ServerCore/
│   ├── GameController.server.luau
│   ├── DataStoreManager.server.luau
│   └── EconomyManager.server.luau
StarterPlayer/StarterPlayerScripts/
├── ClientCore/
│   ├── ClientController.client.luau
│   ├── UIController.client.luau
│   ├── InputHandler.client.luau
│   └── SoundEffects.client.luau
StarterGui/
├── ScreenGui/
│   ├── HUDFrame/
│   └── UpgradeShop/`,
        contracts: `--!strict
export type PlayerProfile = {
    Currency: number,
    Multiplier: number,
    PrestigeCount: number,
    Inventory: { [string]: number },
    LastSaveTimestamp: number,
}

export type RemoteActions = {
    RequestUpgrade: RemoteFunction,
    ClaimReward: RemoteEvent,
    PrestigeReset: RemoteEvent,
}`,
        optimization: `- **DataStore Resilience**: обращение к \`DataStoreService\` строго в блоках \`pcall\` с экспоненциальным backoff при лимитах.
- **Серверная безопасность**: сервер никогда не доверяет клиенту количество валюты; валидация всех покупок и действий исключительно на сервере.
- **game:BindToClose()**: обязательное сохранение профилей всех игроков при перезапуске сервера или миграции.
- **Стриминг**: включить \`StreamingEnabled\` для быстрой загрузки локации на мобильных устройствах.`,
      };
  }
}
