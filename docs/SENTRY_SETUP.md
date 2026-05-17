# Sentry setup

Sentry интегрирован в frontend и backend. Если env vars не заданы — Sentry **молча отключён** (no-op). Так что merge этого PR ничего не сломает.

Чтобы включить — следуй инструкции ниже.

## 1. Создать проект на sentry.io

1. Зарегистрируйся на [sentry.io](https://sentry.io) (бесплатный план — 5 000 errors/мес + 1 проект, для start хватит)
2. Create Project → Platform: **React**
3. Name: `visadel-frontend` (можно `visadel-frontend-test` для test-окружения)
4. Скопируй DSN из формата `https://xxxx@oXXXXXX.ingest.sentry.io/XXXXXX`

Опционально — второй проект для backend:
- Platform: **Node.js**
- Name: `visadel-backend`
- Скопируй второй DSN

(Можно использовать ОДИН проект и для frontend и для backend — Sentry различит их по тегу `runtime`.)

## 2. Vercel env vars

### Test (visadel-test.vercel.app, dev branch)

```
VITE_SENTRY_DSN  = https://xxxx@oXXX.ingest.sentry.io/FRONTEND_PROJECT
VITE_SENTRY_ENV  = test
SENTRY_DSN       = https://yyyy@oXXX.ingest.sentry.io/BACKEND_PROJECT
SENTRY_ENV       = test
```

### Production (visadel.agency, main branch)

```
VITE_SENTRY_DSN  = ... (тот же frontend DSN)
VITE_SENTRY_ENV  = production
SENTRY_DSN       = ... (тот же backend DSN)
SENTRY_ENV       = production
```

> ⚠️ Не путай: `VITE_SENTRY_DSN` (frontend, попадает в bundle, без секрета — это OK для public DSN) и `SENTRY_DSN` (backend, server-only).

## 3. Redeploy

После добавления env vars — Vercel автоматически передеплоит test, или вручную redeploy production через Vercel UI. После деплоя проверь:

1. Открой mini-app в Telegram
2. В Sentry dashboard → Issues — должен появиться **первый event** (например `[Sentry] Performance Monitoring is enabled`)
3. Если нет — проверь DevTools console на `Sentry` или `dsn`-ошибки

## 4. Тест на ошибку

Чтобы проверить что capture работает — в DevTools console:

```js
throw new Error('Test Sentry integration')
```

Через ~5 секунд событие должно появиться в Sentry → Issues с тегом `environment: test`.

## Что Sentry собирает

### Frontend
- **Errors** — все unhandled через `ErrorBoundary` + `window.error` + `unhandledrejection` (см. `src/app/lib/errorReporter.ts`)
- **Performance traces** — 10% sample
- **Replay** — только при ошибке (100% on error, 0% on idle session). Privacy: ВСЕ тексты замаскированы, медиа заблокированы.
- **User context** — `telegram_id` и `username` (см. `src/app/App.tsx` после `getTelegramUser`)

### Backend (Vercel API)
- **Errors** — через `withSentry()` wrapper + ручной `captureException()` в catch-блоках
- **Performance traces** — 5% sample (serverless дорогой)
- **Request context** — URL, method, header keys (значения REDACTED для Authorization/X-Service-Key)

## PII фильтрация

Оба клиента (`src/app/lib/sentry.ts` и `api/_lib/sentry.js`) имеют собственный `beforeSend` который scrub'ит:

**По ключу (regex):**
```
password, passport, paspor, token, secret, authorization, apikey, api_key,
service_key, init_data, initdata
```

**По значению (regex):**
```
tma <anything>     — Telegram initData
Bearer <anything>  — JWT / service key
```

То есть если случайно в логе окажется `{ password: 'qwerty', authorization: 'Bearer xxx' }` — оба значения станут `[REDACTED]` ДО отправки в Sentry.

## Откат

Если хочешь полностью отключить Sentry — удали env vars `VITE_SENTRY_DSN` и `SENTRY_DSN` из Vercel, redeploy. Код остаётся работоспособным (no-op).

## Стоимость

Бесплатный план Sentry:
- 5 000 errors/мес
- 10k performance transactions/мес
- 50 session replays/мес
- 1 пользователь

Для проекта твоего масштаба — должно хватить с запасом первые 6-12 мес. Когда упрёшься — Team plan $26/мес (50k errors).

## Что НЕ покрыто (limitations)

- **Cron endpoints** (`process-reminders`, `update-usd-rate`) не обёрнуты в Sentry — они логируют в Vercel logs напрямую
- **Diag endpoint** не обёрнут — диагностика, не критично
- **Storage RLS errors** Supabase не достигают серверного кода — мониторятся через Supabase Dashboard → Logs
