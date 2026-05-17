// Sentry integration для frontend.
//
// Если `VITE_SENTRY_DSN` не задан в env — Sentry не инициализируется,
// все Sentry-вызовы становятся no-op (безопасно для dev/local).
//
// На проде DSN берётся из Vercel env vars (отдельный для visadel.agency
// и visadel-test.vercel.app — чтобы test-ошибки не мешали prod-метрикам).
//
// Setup в новом Sentry-проекте:
//   1. sentry.io → Create Project → Platform: React
//   2. Скопировать DSN
//   3. Vercel → visadel-test project → Settings → Env Vars:
//        VITE_SENTRY_DSN = https://xxxx@oXXX.ingest.sentry.io/XXX
//        VITE_SENTRY_ENV = test (или production — для prod-проекта)
//   4. Redeploy
//
// Что Sentry собирает:
//   - JS errors (через ErrorBoundary + global handlers, см. errorReporter.ts)
//   - Performance traces (10% samples)
//   - Replay sessions (только при ошибках, 100% on error, 0% on idle)
//   - PII включена частично (см. beforeSend — режем токены/паспорта)

import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = (import.meta.env.VITE_SENTRY_ENV as string) ?? import.meta.env.MODE ?? 'production';
const RELEASE = (import.meta.env.VITE_VERSION as string) ?? 'unknown';

let initialized = false;

// PII-фильтр: режем sensitive поля из event перед отправкой в Sentry.
// Sentry умеет сам, но мы не доверяем — добавляем свой слой.
const SENSITIVE_KEY_RE = /password|passport|paspor|token|secret|authorization|apikey|api_key|service_key|init_data|initdata/i;
const SENSITIVE_VALUE_RE = /tma\s+\S+|Bearer\s+\S+/i;

function scrubObject(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[max-depth]';
  if (obj == null) return obj;
  if (typeof obj === 'string') {
    return SENSITIVE_VALUE_RE.test(obj) ? '[REDACTED]' : obj;
  }
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => scrubObject(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = scrubObject(v, depth + 1);
    }
  }
  return out;
}

export function initSentry(): void {
  if (initialized) return;
  if (!DSN) {
    // dev/local — Sentry молча отключён
    return;
  }
  initialized = true;

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    release: RELEASE,
    // 10% performance samples — баланс между видимостью и квотой.
    tracesSampleRate: 0.1,
    // Replay только если есть ошибка — экономит квоту и privacy-friendly.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Privacy: маскируем ВСЁ по умолчанию. Sentry увидит только структуру,
        // не контент. Для отладки админ может временно снять mask на dev.
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Финальный scrub PII перед отправкой
    beforeSend(event) {
      try {
        if (event.request) event.request = scrubObject(event.request) as typeof event.request;
        if (event.extra) event.extra = scrubObject(event.extra) as typeof event.extra;
        if (event.contexts) event.contexts = scrubObject(event.contexts) as typeof event.contexts;
      } catch { /* noop */ }
      return event;
    },
  });
}

// Тонкая обёртка чтобы errorReporter.ts мог вызывать без import Sentry напрямую.
export function sentryCaptureException(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    Sentry.captureException(err, context ? { extra: scrubObject(context) as Record<string, unknown> } : undefined);
  } catch { /* noop */ }
}

export function sentrySetUser(user: { id?: string | number; username?: string } | null): void {
  if (!initialized) return;
  try {
    if (!user) { Sentry.setUser(null); return; }
    Sentry.setUser({
      id: user.id != null ? String(user.id) : undefined,
      username: user.username,
    });
  } catch { /* noop */ }
}
