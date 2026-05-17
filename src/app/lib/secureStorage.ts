// Secure storage wrapper — Telegram CloudStorage (зашифрован TG-инфраструктурой,
// привязан к юзеру, не виден на устройстве) с fallback на localStorage.
//
// Зачем: P1-5 из docs/SECURITY.md. Раньше черновики (visa_drafts,
// hotel/flight_booking_draft) лежали в localStorage в plain JSON.
// При Stored XSS атакующий мог достать паспорта/фио/email через
// `localStorage.getItem('visa_drafts')` и эксфильтровать.
//
// Telegram CloudStorage:
//   - Лимиты: max 1024 keys, max 4096 bytes value (UTF-8), key 1-128 chars
//   - Хранение на Telegram-серверах, привязано к telegram_id
//   - Не виден внешним скриптам через document/window (изолирован TG WebView)
//
// Fallback: если TG не доступен (web-юзер, dev mode без TG) — localStorage.
// Это сохраняет UX, но в этом случае security gain нулевой (см. warning).
//
// API — async-first (TG CloudStorage только async). Все методы Promise.
//
// Использование:
//   import { secureStorage } from './secureStorage';
//
//   await secureStorage.setItem('draft_xyz', JSON.stringify(draft));
//   const raw = await secureStorage.getItem('draft_xyz');
//   await secureStorage.removeItem('draft_xyz');
//
// ⚠️ Большие черновики (> 4KB после JSON.stringify) автоматически идут
// в localStorage (TG не примет). Логируем warning, чтобы видеть таких юзеров.

interface TgCloudStorage {
  setItem: (key: string, value: string, cb: (err?: unknown, ok?: boolean) => void) => void;
  getItem: (key: string, cb: (err?: unknown, value?: string) => void) => void;
  removeItem: (key: string, cb: (err?: unknown, ok?: boolean) => void) => void;
  getKeys: (cb: (err?: unknown, keys?: string[]) => void) => void;
  removeItems: (keys: string[], cb: (err?: unknown, ok?: boolean) => void) => void;
}

interface TgWebApp {
  CloudStorage?: TgCloudStorage;
}

interface TgGlobal {
  WebApp?: TgWebApp;
}

const TG_MAX_VALUE_BYTES = 4096;
const TG_MAX_KEY_LENGTH = 128;

function getCloudStorage(): TgCloudStorage | null {
  try {
    const tg = (window as unknown as { Telegram?: TgGlobal }).Telegram?.WebApp;
    return tg?.CloudStorage ?? null;
  } catch {
    return null;
  }
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function isValidKey(key: string): boolean {
  return typeof key === 'string' && key.length >= 1 && key.length <= TG_MAX_KEY_LENGTH;
}

export const secureStorage = {
  async setItem(key: string, value: string): Promise<{ ok: boolean; backend: 'tg' | 'localStorage' }> {
    if (!isValidKey(key)) {
      throw new Error(`secureStorage: invalid key length (${key?.length ?? 0})`);
    }

    const cs = getCloudStorage();
    const bytes = byteLength(value);

    // TG CloudStorage если: доступен И value помещается
    if (cs && bytes <= TG_MAX_VALUE_BYTES) {
      try {
        return await new Promise((resolve) => {
          cs.setItem(key, value, (err) => {
            if (err) {
              // TG cloudStorage упал — fallback на localStorage
              console.warn('[secureStorage] TG setItem error, fallback to localStorage:', err);
              try {
                localStorage.setItem(key, value);
                resolve({ ok: true, backend: 'localStorage' });
              } catch (lsErr) {
                console.error('[secureStorage] localStorage setItem also failed:', lsErr);
                resolve({ ok: false, backend: 'localStorage' });
              }
            } else {
              resolve({ ok: true, backend: 'tg' });
            }
          });
        });
      } catch (err) {
        console.warn('[secureStorage] TG setItem exception:', err);
      }
    }

    // Fallback: localStorage. Если value > TG limit, логируем — есть юзеры
    // с большими черновиками, которые не получат TG-уровень защиты.
    if (cs && bytes > TG_MAX_VALUE_BYTES) {
      console.warn(`[secureStorage] value too large for TG CloudStorage (${bytes}B > ${TG_MAX_VALUE_BYTES}B), using localStorage`);
    }
    try {
      localStorage.setItem(key, value);
      return { ok: true, backend: 'localStorage' };
    } catch (err) {
      console.error('[secureStorage] localStorage setItem failed:', err);
      return { ok: false, backend: 'localStorage' };
    }
  },

  async getItem(key: string): Promise<string | null> {
    if (!isValidKey(key)) return null;

    const cs = getCloudStorage();

    // Сначала пробуем TG (приоритет — там более новые данные если перешли)
    if (cs) {
      try {
        const tgValue = await new Promise<string | null>((resolve) => {
          cs.getItem(key, (err, value) => {
            if (err) {
              console.warn('[secureStorage] TG getItem error:', err);
              resolve(null);
              return;
            }
            // TG возвращает '' если ключ не существует
            resolve(typeof value === 'string' && value.length > 0 ? value : null);
          });
        });
        if (tgValue !== null) return tgValue;
      } catch (err) {
        console.warn('[secureStorage] TG getItem exception:', err);
      }
    }

    // Fallback на localStorage (legacy data или web-юзер)
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    if (!isValidKey(key)) return;

    const cs = getCloudStorage();

    // Удаляем из обоих чтобы не оставлять остатков (миграция / mixed state)
    if (cs) {
      try {
        await new Promise<void>((resolve) => {
          cs.removeItem(key, () => resolve());
        });
      } catch {
        /* noop */
      }
    }
    try {
      localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  },

  // Helper для миграции legacy data — переносит из localStorage в CloudStorage.
  // Безопасно вызывать многократно (idempotent).
  async migrateFromLocalStorage(key: string): Promise<{ migrated: boolean; reason?: string }> {
    if (!isValidKey(key)) return { migrated: false, reason: 'invalid-key' };
    const cs = getCloudStorage();
    if (!cs) return { migrated: false, reason: 'no-tg' };

    let lsValue: string | null = null;
    try { lsValue = localStorage.getItem(key); } catch { /* noop */ }
    if (!lsValue) return { migrated: false, reason: 'no-local-data' };

    const bytes = byteLength(lsValue);
    if (bytes > TG_MAX_VALUE_BYTES) {
      return { migrated: false, reason: 'value-too-large' };
    }

    try {
      await new Promise<void>((resolve, reject) => {
        cs.setItem(key, lsValue!, (err) => err ? reject(err) : resolve());
      });
      // НЕ удаляем из localStorage сразу — на случай если cloudStorage
      // не доступен на следующей загрузке (offline / TG bug). Удаление —
      // отдельная операция через cleanup script.
      return { migrated: true };
    } catch (err) {
      console.warn('[secureStorage] migration failed:', err);
      return { migrated: false, reason: 'tg-set-failed' };
    }
  },

  // Доступен ли TG CloudStorage (для UI-индикации / диагностики)
  isCloudAvailable(): boolean {
    return getCloudStorage() !== null;
  },
};

// Re-export для тестов
export const __internals = { byteLength, isValidKey, TG_MAX_VALUE_BYTES, TG_MAX_KEY_LENGTH };
