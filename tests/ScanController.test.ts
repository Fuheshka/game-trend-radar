import { describe, it, expect, vi } from 'vitest';
import { ScanController, ScanLiveEvents } from '../web/src/app/scanController.js';
import { createAppState } from '../web/src/app/state.js';
import { ScanRequestResult } from '../web/src/services/snapshotApi.js';

type Handler = (data: any) => unknown;

/** Шина SSE в памяти: emit вызывает подписчиков, как LiveEventService. */
function fakeLiveEvents() {
  const handlers: Record<string, Handler[]> = {};
  const statusHandlers: Array<(s: any) => void> = [];
  const live = {
    on: (event: string, handler: Handler) => {
      (handlers[event] ??= []).push(handler);
      return () => {};
    },
    onStatusChange: (cb: (s: any) => void) => {
      statusHandlers.push(cb);
      return () => {};
    },
  } as unknown as ScanLiveEvents;
  return {
    live,
    emit: async (event: string, data: unknown = {}) => {
      for (const h of handlers[event] ?? []) await h(data);
    },
    status: (s: string) => statusHandlers.forEach(cb => cb(s)),
  };
}

function setup(result: ScanRequestResult | Error = { kind: 'accepted' }) {
  const state = createAppState();
  const header = { setSseStatus: vi.fn(), setScanAvailable: vi.fn(), setScanning: vi.fn(), setScanProgress: vi.fn() };
  const snapshots = { fetchSnapshots: vi.fn(async () => {}), selectSnapshot: vi.fn(async () => {}), fetchLatestSnapshot: vi.fn(async () => {}) };
  const ui = { setOverlay: vi.fn(), setScanButtonDisabled: vi.fn() };
  const bus = fakeLiveEvents();
  const deps = {
    showToast: vi.fn(),
    setServerStatus: vi.fn(),
    onScanFinished: vi.fn(),
    promptToken: vi.fn(() => 'secret'),
    storeScanToken: vi.fn(),
    requestScan: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
  const controller = new ScanController({ state, header, snapshots, ui, liveEvents: bus.live, ...deps });
  controller.subscribe();
  return { controller, state, header, snapshots, ui, bus, ...deps };
}

describe('ScanController: запуск скана', () => {
  it('принятый скан держит блокировку и оверлей до событий SSE', async () => {
    const t = setup({ kind: 'accepted' });
    await t.controller.triggerLiveScan();
    expect(t.state.isScanning).toBe(true);
    expect(t.state.localScanRequested).toBe(true);
    expect(t.ui.setOverlay).toHaveBeenLastCalledWith(true);
    expect(t.ui.setScanButtonDisabled).toHaveBeenLastCalledWith(true);
    expect(t.showToast).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: 'disabled' } as ScanRequestResult, 'Ручной скан отключён на сервере. Данные обновляются автосканом.'],
    [{ kind: 'cooldown', retryAfterSec: 42 } as ScanRequestResult, 'Скан недавно выполнялся. Повторите через 42 с.'],
    [{ kind: 'error' } as ScanRequestResult, 'Сервер вернул ошибку при сканировании.'],
    [new Error('offline'), 'Сервер недоступен для запуска сканирования.'],
  ])('отказ %o снимает блокировки и объясняет причину', async (result, toast) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = setup(result);
    await t.controller.triggerLiveScan();
    expect(t.showToast).toHaveBeenCalledWith(toast);
    expect(t.state.isScanning).toBe(false);
    expect(t.state.localScanRequested).toBe(false);
    expect(t.ui.setOverlay).toHaveBeenLastCalledWith(false);
    expect(t.ui.setScanButtonDisabled).toHaveBeenLastCalledWith(false);
    expect(t.header.setScanProgress).toHaveBeenLastCalledWith(null);
    warn.mockRestore();
  });

  it('401: спрашивает токен и сохраняет его', async () => {
    const t = setup({ kind: 'unauthorized' });
    await t.controller.triggerLiveScan();
    expect(t.storeScanToken).toHaveBeenCalledWith('secret');
    expect(t.showToast).toHaveBeenCalledWith('Токен сохранён — нажмите «Запустить скан» ещё раз.');
    expect(t.state.isScanning).toBe(false);
  });

  it('повторный клик во время скана ничего не отправляет', async () => {
    const t = setup();
    t.state.isScanning = true;
    await t.controller.triggerLiveScan();
    expect(t.requestScan).not.toHaveBeenCalled();
  });
});

describe('ScanController: события SSE', () => {
  it('фоновый scan:started блокирует кнопку, но оверлей — только у инициатора', async () => {
    const t = setup();
    await t.bus.emit('scan:started');
    expect(t.state.isScanning).toBe(true);
    expect(t.ui.setScanButtonDisabled).toHaveBeenCalledWith(true);
    expect(t.ui.setOverlay).not.toHaveBeenCalled();
  });

  it('scan:completed снимает блокировку и выбирает новый снимок', async () => {
    const t = setup();
    await t.controller.triggerLiveScan();
    await t.bus.emit('scan:completed', { snapshotId: 'snap-new' });
    expect(t.onScanFinished).toHaveBeenCalledTimes(1);
    expect(t.state.isScanning).toBe(false);
    expect(t.state.localScanRequested).toBe(false);
    expect(t.snapshots.fetchSnapshots).toHaveBeenCalledTimes(1);
    expect(t.snapshots.selectSnapshot).toHaveBeenCalledWith('snap-new', false);
    expect(t.snapshots.fetchLatestSnapshot).not.toHaveBeenCalled();

    await t.bus.emit('scan:completed', {});
    expect(t.snapshots.fetchLatestSnapshot).toHaveBeenCalledTimes(1);
  });

  it('snapshot:updated игнорируется во время скана и не перевыбирает уже показанный снимок', async () => {
    const t = setup();
    t.state.isScanning = true;
    await t.bus.emit('snapshot:updated', { snapshotId: 'a' });
    expect(t.snapshots.fetchSnapshots).not.toHaveBeenCalled();

    t.state.isScanning = false;
    t.state.currentSnapshotId = 'a';
    await t.bus.emit('snapshot:updated', { snapshotId: 'a' });
    expect(t.snapshots.fetchSnapshots).toHaveBeenCalledTimes(1);
    expect(t.snapshots.selectSnapshot).not.toHaveBeenCalled();

    await t.bus.emit('snapshot:updated', { snapshotId: 'b' });
    expect(t.snapshots.selectSnapshot).toHaveBeenCalledWith('b', false);
  });

  it('статус SSE: подключение возвращает кнопку скана, реконнект красит статус в оффлайн', () => {
    const t = setup();
    t.bus.status('connected');
    expect(t.header.setScanAvailable).toHaveBeenCalledWith(true);
    expect(t.setServerStatus).toHaveBeenLastCalledWith(true, 'HTTP :4200 (SSE Live)');
    t.bus.status('reconnecting');
    expect(t.setServerStatus).toHaveBeenLastCalledWith(false, 'Реконнект к SSE...');
    expect(t.header.setSseStatus).toHaveBeenLastCalledWith('reconnecting');
  });
});
