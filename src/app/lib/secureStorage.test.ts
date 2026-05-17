// Unit-тесты для secureStorage wrapper.
//
// Покрываем:
//   - Без TG → localStorage backend
//   - С TG, value < 4KB → tg backend
//   - С TG, value > 4KB → localStorage backend + warning
//   - getItem: TG priority, localStorage fallback
//   - removeItem: чистит оба backend
//   - byteLength для UTF-8 (русский = 2 bytes/char)
//   - isValidKey: пустой / длинный → reject
//   - Migration: legacy data → TG

import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory localStorage mock — поскольку Node нет браузерного API
class LocalStorageMock {
  store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

// Mock TG CloudStorage — async через setTimeout(0) для имитации async поведения
class TgCloudStorageMock {
  store = new Map<string, string>();
  forceError = false; // для теста error path

  setItem(key: string, value: string, cb: (err?: unknown, ok?: boolean) => void) {
    setTimeout(() => {
      if (this.forceError) return cb(new Error('TG error'));
      this.store.set(key, value);
      cb(null, true);
    }, 0);
  }
  getItem(key: string, cb: (err?: unknown, value?: string) => void) {
    setTimeout(() => {
      if (this.forceError) return cb(new Error('TG error'));
      cb(null, this.store.get(key) ?? '');
    }, 0);
  }
  removeItem(key: string, cb: (err?: unknown, ok?: boolean) => void) {
    setTimeout(() => {
      this.store.delete(key);
      cb(null, true);
    }, 0);
  }
  getKeys(cb: (err?: unknown, keys?: string[]) => void) {
    setTimeout(() => cb(null, [...this.store.keys()]), 0);
  }
  removeItems(keys: string[], cb: (err?: unknown, ok?: boolean) => void) {
    setTimeout(() => {
      keys.forEach(k => this.store.delete(k));
      cb(null, true);
    }, 0);
  }
}

// Setup global mocks
let lsMock: LocalStorageMock;
let tgMock: TgCloudStorageMock | null;

beforeEach(() => {
  lsMock = new LocalStorageMock();
  tgMock = null;
  // @ts-expect-error — Node global
  global.localStorage = lsMock;
  // @ts-expect-error
  global.window = { Telegram: undefined };
  // @ts-expect-error
  global.TextEncoder = TextEncoder;
});

// Helper для подключения TG mock
function attachTg() {
  tgMock = new TgCloudStorageMock();
  // @ts-expect-error
  global.window.Telegram = { WebApp: { CloudStorage: tgMock } };
}

// Загружаем модуль ДИНАМИЧЕСКИ после setup mocks
async function loadModule() {
  // vi.resetModules не нужен — модуль stateless (только функции)
  return await import('./secureStorage.ts');
}

describe('secureStorage — без TG (web-юзер / dev)', () => {
  it('setItem пишет в localStorage', async () => {
    const { secureStorage } = await loadModule();
    const r = await secureStorage.setItem('key1', 'value1');
    expect(r.ok).toBe(true);
    expect(r.backend).toBe('localStorage');
    expect(lsMock.getItem('key1')).toBe('value1');
  });

  it('getItem читает из localStorage', async () => {
    lsMock.setItem('key1', 'value1');
    const { secureStorage } = await loadModule();
    expect(await secureStorage.getItem('key1')).toBe('value1');
  });

  it('removeItem удаляет из localStorage', async () => {
    lsMock.setItem('key1', 'value1');
    const { secureStorage } = await loadModule();
    await secureStorage.removeItem('key1');
    expect(lsMock.getItem('key1')).toBeNull();
  });

  it('isCloudAvailable → false', async () => {
    const { secureStorage } = await loadModule();
    expect(secureStorage.isCloudAvailable()).toBe(false);
  });
});

describe('secureStorage — с TG CloudStorage', () => {
  it('setItem малый value → TG backend', async () => {
    attachTg();
    const { secureStorage } = await loadModule();
    const r = await secureStorage.setItem('key1', 'small value');
    expect(r.ok).toBe(true);
    expect(r.backend).toBe('tg');
    expect(tgMock!.store.get('key1')).toBe('small value');
    expect(lsMock.getItem('key1')).toBeNull(); // НЕ в localStorage
  });

  it('setItem большой value (>4KB) → localStorage backend (TG не примет)', async () => {
    attachTg();
    const big = 'a'.repeat(5000);
    const { secureStorage } = await loadModule();
    const r = await secureStorage.setItem('key1', big);
    expect(r.ok).toBe(true);
    expect(r.backend).toBe('localStorage');
    expect(tgMock!.store.has('key1')).toBe(false);
    expect(lsMock.getItem('key1')).toBe(big);
  });

  it('getItem: TG priority over localStorage', async () => {
    attachTg();
    tgMock!.store.set('key1', 'tg-value');
    lsMock.setItem('key1', 'ls-value');
    const { secureStorage } = await loadModule();
    expect(await secureStorage.getItem('key1')).toBe('tg-value');
  });

  it('getItem: fallback на localStorage если TG пустой', async () => {
    attachTg();
    lsMock.setItem('key1', 'ls-value');
    const { secureStorage } = await loadModule();
    expect(await secureStorage.getItem('key1')).toBe('ls-value');
  });

  it('removeItem чистит оба backend', async () => {
    attachTg();
    tgMock!.store.set('key1', 'tg-value');
    lsMock.setItem('key1', 'ls-value');
    const { secureStorage } = await loadModule();
    await secureStorage.removeItem('key1');
    expect(tgMock!.store.has('key1')).toBe(false);
    expect(lsMock.getItem('key1')).toBeNull();
  });

  it('setItem fallback на localStorage если TG бросил ошибку', async () => {
    attachTg();
    tgMock!.forceError = true;
    const { secureStorage } = await loadModule();
    const r = await secureStorage.setItem('key1', 'value');
    expect(r.ok).toBe(true);
    expect(r.backend).toBe('localStorage');
    expect(lsMock.getItem('key1')).toBe('value');
  });

  it('isCloudAvailable → true', async () => {
    attachTg();
    const { secureStorage } = await loadModule();
    expect(secureStorage.isCloudAvailable()).toBe(true);
  });
});

describe('secureStorage — миграция legacy data', () => {
  it('переносит из localStorage в TG если возможно', async () => {
    attachTg();
    lsMock.setItem('draft_xyz', '{"foo": "bar"}');
    const { secureStorage } = await loadModule();
    const r = await secureStorage.migrateFromLocalStorage('draft_xyz');
    expect(r.migrated).toBe(true);
    expect(tgMock!.store.get('draft_xyz')).toBe('{"foo": "bar"}');
    // localStorage НЕ удаляется (safety — оставляем как fallback)
    expect(lsMock.getItem('draft_xyz')).toBe('{"foo": "bar"}');
  });

  it('не мигрирует если no-tg', async () => {
    lsMock.setItem('draft_xyz', '{"foo": "bar"}');
    const { secureStorage } = await loadModule();
    const r = await secureStorage.migrateFromLocalStorage('draft_xyz');
    expect(r.migrated).toBe(false);
    expect(r.reason).toBe('no-tg');
  });

  it('не мигрирует если no-local-data', async () => {
    attachTg();
    const { secureStorage } = await loadModule();
    const r = await secureStorage.migrateFromLocalStorage('draft_none');
    expect(r.migrated).toBe(false);
    expect(r.reason).toBe('no-local-data');
  });

  it('не мигрирует если value-too-large', async () => {
    attachTg();
    lsMock.setItem('big', 'a'.repeat(5000));
    const { secureStorage } = await loadModule();
    const r = await secureStorage.migrateFromLocalStorage('big');
    expect(r.migrated).toBe(false);
    expect(r.reason).toBe('value-too-large');
  });
});

describe('secureStorage — валидация ключей', () => {
  it('throws при пустом ключе', async () => {
    const { secureStorage } = await loadModule();
    await expect(secureStorage.setItem('', 'x')).rejects.toThrow(/invalid key/);
  });

  it('throws при ключе > 128 chars', async () => {
    const { secureStorage } = await loadModule();
    await expect(secureStorage.setItem('a'.repeat(200), 'x')).rejects.toThrow(/invalid key/);
  });

  it('getItem с невалидным ключом → null (без throw)', async () => {
    const { secureStorage } = await loadModule();
    expect(await secureStorage.getItem('')).toBeNull();
  });
});

describe('__internals', () => {
  it('byteLength для ASCII = char count', async () => {
    const { __internals } = await loadModule();
    expect(__internals.byteLength('hello')).toBe(5);
  });

  it('byteLength для русского = 2 bytes/char', async () => {
    const { __internals } = await loadModule();
    expect(__internals.byteLength('Привет')).toBe(12); // 6 кириллицей × 2
  });

  it('byteLength для эмодзи = 4 bytes', async () => {
    const { __internals } = await loadModule();
    expect(__internals.byteLength('🚀')).toBe(4);
  });
});
