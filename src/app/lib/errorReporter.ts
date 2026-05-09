// Простейший error reporter — собирает unhandled-ошибки и шлёт админам в Telegram
// через /api/notify-admin (в prod). В dev только console.error.
//
// Когда подключим настоящий Sentry — заменим имплементацию здесь, не меняя
// caller'ов. Все вызовы reportError(...) останутся.

import { apiFetch } from './apiFetch';

const isProd = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'production';
const seen = new Set<string>();
let installed = false;
const RELOAD_GUARD_KEY = 'vd_chunk_reload_guard';

// Распознаём ошибки загрузки динамического чанка (lazy() chunks).
// Стейл-кеш после деплоя — самая частая причина «ошибки при первом клике».
function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message || '';
  const name = err.name || '';
  return (
    name === 'ChunkLoadError' ||
    /loading chunk/i.test(msg) ||
    /failed to fetch dynamically imported/i.test(msg) ||
    /importing a module script failed/i.test(msg) ||
    /load failed/i.test(msg)
  );
}

function reloadOnChunkError(err: unknown): boolean {
  if (!isChunkLoadError(err)) return false;
  const guarded = (() => { try { return sessionStorage.getItem(RELOAD_GUARD_KEY); } catch { return null; } })();
  if (guarded) return false; // уже один раз перезагружали — не зацикливаемся
  try { sessionStorage.setItem(RELOAD_GUARD_KEY, '1'); } catch { /* noop */ }
  console.warn('[error-reporter] chunk load error → window.location.reload()');
  setTimeout(() => window.location.reload(), 50);
  return true;
}

interface Context {
  source?: string;
  url?: string;
  userAgent?: string;
  [key: string]: unknown;
}

export function reportError(err: unknown, context: Context = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? (err.stack ?? '') : '';
  // Дедупликация по message+stack — не спамим если ошибка повторяется в цикле
  const fp = `${message}\n${stack.slice(0, 200)}`;
  if (seen.has(fp)) return;
  seen.add(fp);
  if (seen.size > 50) seen.clear();

  console.error('[error-report]', message, context, stack);

  if (!isProd) return;

  // Best-effort POST. Не ждём ответа.
  try {
    apiFetch('/api/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'error',
        details: {
          message: message.slice(0, 500),
          stack: stack.slice(0, 1500),
          source: context.source ?? 'client',
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          ...context,
        },
      }),
    }).catch(() => { /* swallow — нельзя зациклиться на ошибке отправки ошибки */ });
  } catch { /* swallow */ }
}

export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  window.addEventListener('error', (e) => {
    const err = e.error ?? new Error(e.message);
    if (reloadOnChunkError(err)) return;
    reportError(err, { source: 'window.error' });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const err = e.reason ?? new Error('Unhandled rejection');
    if (reloadOnChunkError(err)) return;
    reportError(err, { source: 'unhandledrejection' });
  });
}
