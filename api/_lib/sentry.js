// Sentry integration для Vercel serverless functions.
//
// Если `SENTRY_DSN` env var не задан — все вызовы no-op (безопасно для dev).
// На проде DSN из Vercel env vars. Отдельный проект на sentry.io для test
// и prod рекомендуется.
//
// Использование:
//   import { withSentry, captureException } from './_lib/sentry.js';
//
//   export default withSentry(async (req, res) => {
//     ...
//   });
//
// withSentry оборачивает handler и автоматически ловит throw'и,
// шлёт в Sentry + возвращает 500 с safe-сообщением (НЕ stack trace).
//
// captureException можно вызвать вручную внутри catch-блока,
// если хочешь сохранить кастомную логику ответа.

import * as Sentry from '@sentry/node';

const DSN = process.env.SENTRY_DSN;
const ENV = process.env.SENTRY_ENV ?? process.env.VERCEL_ENV ?? 'production';
const RELEASE = process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown';

let initialized = false;

// PII-scrubbers: дубликат frontend-фильтра.
const SENSITIVE_KEY_RE = /password|passport|paspor|token|secret|authorization|apikey|api_key|service_key|init_data|initdata/i;
const SENSITIVE_VALUE_RE = /tma\s+\S+|Bearer\s+\S+/i;

function scrubObject(obj, depth = 0) {
  if (depth > 5) return '[max-depth]';
  if (obj == null) return obj;
  if (typeof obj === 'string') {
    return SENSITIVE_VALUE_RE.test(obj) ? '[REDACTED]' : obj;
  }
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => scrubObject(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = scrubObject(v, depth + 1);
    }
  }
  return out;
}

function initSentry() {
  if (initialized) return;
  if (!DSN) return;
  initialized = true;

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    release: RELEASE,
    // На serverless tracing дорогой (каждый invoke = отдельный transaction).
    // 5% выборка — баланс.
    tracesSampleRate: 0.05,
    beforeSend(event) {
      try {
        if (event.request) event.request = scrubObject(event.request);
        if (event.extra) event.extra = scrubObject(event.extra);
        if (event.contexts) event.contexts = scrubObject(event.contexts);
      } catch { /* noop */ }
      return event;
    },
  });
}

// Lazy init — на первом вызове capture/flush.
function ensureInit() {
  if (!initialized) initSentry();
}

export function captureException(err, context) {
  ensureInit();
  if (!initialized) return;
  try {
    Sentry.captureException(err, context ? { extra: scrubObject(context) } : undefined);
  } catch { /* noop */ }
}

// Vercel serverless заканчивает контейнер после return. Без flush
// Sentry-события не успеют уйти. flush с таймаутом 2s — стандарт.
export async function flushSentry() {
  if (!initialized) return;
  try {
    await Sentry.flush(2000);
  } catch { /* noop */ }
}

// Wrapper: оборачивает handler, ловит throw'и, шлёт в Sentry,
// возвращает 500 без stack trace в response.
export function withSentry(handler) {
  return async (req, res) => {
    ensureInit();
    try {
      const result = await handler(req, res);
      await flushSentry();
      return result;
    } catch (err) {
      console.error('[withSentry] uncaught:', err);
      captureException(err, {
        url: req.url,
        method: req.method,
        // Headers режем чтобы не утечь Authorization / X-Service-Key.
        // Имена остаются для debug, значения — REDACTED.
        headers_keys: Object.keys(req.headers ?? {}),
      });
      await flushSentry();
      if (!res.headersSent) {
        res.status(500).json({ error: 'internal error' });
      }
    }
  };
}
