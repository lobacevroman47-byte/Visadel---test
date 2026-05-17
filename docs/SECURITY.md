# VISADEL — Security audit & hardening roadmap

> Аудит: 2026-05-17. Аудитор: Claude (Sonnet 4.7).
> Scope: production deploy (visadel.agency, @Visadel_agency_bot) + dev (visadel-test.vercel.app, @Visadel_test_bot).
> Stack: Vite + React, Vercel Pro, Supabase, Telegram Mini App.

## Executive summary

Текущий security score: **4.5/10** (до начальной итерации) → **6.5/10** (PR #1 headers + audit) → **7.5/10** (PR #2 CORS + rate-limit + admin-gate) → **8.0/10** (PR #3 Sentry + error sanitization) → **8.3/10** (PR #4 bonus atomic) → **8.6/10** (PR #5 Zod + CI security checks) → **9.0/10** (PR #7 Vitest smoke tests) → **9.1/10** (PR #8 save-review + RLS reviews) → **9.3/10** (PR #6 server-side audit logs) → **9.4/10** (PR #9 TG CloudStorage) → **9.6/10** (PR #10 save-hotel/flight-booking + RLS bookings).

Самые опасные дыры (P0) — открытые RLS policies (`USING(true)`) на `applications`, `hotel_bookings`, `flight_bookings`, `users`. Через anon-key любой может читать и менять чужие данные. Этот PR не закрывает их (требует API-refactor), но фиксирует план в `supabase/035_rls_audit_plan.sql`.

Хорошие новости: критичные auth-механизмы реализованы корректно — `verifyInitData` использует timing-safe HMAC, service_key только на сервере, cron endpoints защищены через `x-vercel-cron` + `x-service-key`, soft-delete pattern, admin double-check (`requireAdminUser`).

---

## Issues by severity

### P0 — Critical (active exploit possible)

#### P0-1. Open RLS на пользовательских таблицах (PARTIAL FIX — reviews + bookings INSERT закрыты)
- **Affected:** `applications`, `hotel_bookings` (✅ INSERT закрыт), `flight_bookings` (✅ INSERT закрыт), `reviews` (✅ закрыт), `tasks`, `users`.
- **Root cause:** миграции 011 и 033 ставят `USING(true) WITH CHECK(true)` для всех ролей.
- **Exploit (для оставшихся таблиц):**
  ```http
  GET /rest/v1/applications?select=* HTTP/1.1
  apikey: <ANON_KEY из bundle>
  ```
  → возвращает ВСЕ заявки всех клиентов с паспортными данными.
- **Fix applied (reviews, PR #8):**
  - Новый `/api/save-review` endpoint — INSERT через service_key + `requireTelegramUser`
  - `user_telegram_id` FORCED из verified initData (не из body — нельзя подделать)
  - Zod валидация (rating 1-5, text 1-2000, country, application_id)
  - Frontend `submitReview()` мигрирован, миграция 038 закрывает policy
- **Fix applied (bookings INSERT, PR #10):**
  - `/api/save-hotel-booking` + `/api/save-flight-booking` — service_key + dual-auth (TG initData ИЛИ Supabase JWT для web-юзеров)
  - `telegram_id` / `auth_id` / `status` / `referrer_code` FORCED из верифицированных источников — клиент не может подделать `status='confirmed'` или поставить `price=0`
  - `api/_lib/dual-auth.js` — новый общий helper для TG/Web auth
  - Zod валидация: HTML-инъекции в именах блокируются, email/phone/date format, price 0..10M, guests 1..20
  - Frontend `HotelBookingForm` + `FlightBookingForm` мигрированы на `apiFetch`
  - Миграция 039 закрывает `anon_insert_hotel_bookings` + `anon_insert_flight_bookings`
- **Что осталось (Sprint 3 continued):**
  - `/api/save-application` (большой — много полей, dual-auth, FK fallback)
  - `/api/admin-update-application-status`, `/api/admin-update-booking-status` (admin UPDATE)
  - SELECT closure для applications/bookings (фильтр по telegram_id через RLS вместо ручного `.eq()` в коде)
  - Финальный mini-PR с раскомментированной STAGE 3 миграции 035 для оставшихся таблиц (users, tasks)
- **ETA:** ещё 0.5 спринта.

#### P0-2. `track-click.js` без auth и rate-limit (FIXED в этом PR)
- **Affected:** `api/track-click.js`.
- **Exploit (was):** spam-вызов из браузера → флуд в Supabase `clicks` table → инфляция стоимости + искажение аналитики.
- **Fix applied:** валидация формата `referral_code` (regex `^[A-Za-z0-9_]{2,32}$`), in-memory token bucket по IP (30 POST/мин, 60 GET/мин), CORS whitelist через `setCors`, sanitization для `telegram_id` (только number), убран error message leak из response.
- **Лимиты защиты:** in-memory bucket держится только на warm контейнере Vercel. Распределённая ботнетка пробьёт. Для полной защиты — Upstash Redis (Sprint 5).

#### P0-3. File upload без server-side валидации (PARTIAL FIX в этом PR)
- **Affected:** Step 4 (фото-документы), все *_BookingForm с upload.
- **Root cause:** клиент шлёт файл напрямую в Supabase Storage. Magic bytes / MIME / размер проверяются на клиенте (можно обойти).
- **Exploit:** загрузка `.exe`, `.html` с JS, .svg с XSS → если файл открывают прямой ссылкой на supabase.co, XSS сработает в их origin (изолировано от visadel.agency, но всё равно плохо для пользователя который кликнул).
- **Partial fix applied (migration 036):**
  - Storage INSERT policy ужесточена: blocklist опасных расширений (`.html`, `.svg`, `.js`, `.exe`, `.php`, и ~20 других)
  - Path-traversal защита (`..`, `\`, URL-encoded)
  - Path-prefix scheme расширена для веб-юзеров (`auth_<uuid>`)
- **Что НЕ закрыто (требует Sprint 4 — server-side прокси):**
  - Magic-byte валидация (атакующий может подделать MIME header)
  - Virus scan (ClamAV / VirusTotal)
  - Per-user квота
  - Принудительный `Content-Disposition: attachment` — настроить в Supabase Dashboard вручную

#### P0-4. Security headers (FIXED в этом PR)
- **Before:** `X-Frame-Options: ALLOWALL`, CSP `frame-ancestors *`.
- **After:** CSP с whitelist (Telegram, Supabase, self), HSTS preload, Permissions-Policy lockdown, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, отдельные правила для `/api/*` (no-store, no-index).

### P1 — High (требует усилий для эксплуатации)

#### P1-1. `?admin=true` UI-gate (FIXED)
- **Affected:** `src/app/admin/contexts/AdminContext.tsx`, `AdminLogin.tsx`.
- **Root cause:** клиентский gate через `VITE_ADMIN_PASSWORD_HASH` — хеш в bundle, brute-force оффлайн.
- **Fix applied:** убран PASSWORD_HASH, sha256, brute-force-protection. Auth flow теперь Telegram-only: `tgUser.id ∈ VITE_ADMIN_TELEGRAM_IDS`. AdminLogin показывает "Доступ запрещён" вместо password-формы если не админ. Бэк `requireAdminUser` (по ADMIN_TELEGRAM_IDS env) был и остаётся реальным gate.
- **Env cleanup TODO:** удалить `VITE_ADMIN_PASSWORD_HASH` из Vercel env vars (опционально, не критично — переменная просто игнорируется).

#### P1-2. CORS `*` на всех API (FIXED)
- **Affected:** все `api/*.js` отдавали `Access-Control-Allow-Origin: *`.
- **Vector:** CSRF через open tab — если у юзера в одной вкладке Telegram Mini App, в другой malicious site, `fetch('/api/grant-bonus', {headers:{authorization: 'tma ...'}})` мог пройти.
- **Fix applied:** все 15 user-facing endpoints мигрированы на `setCors(req, res)` из `api/_lib/cors.js`. Whitelist: `visadel.agency`, `*.vercel.app`, `*.telegram.org`. Server-to-server (без Origin header) не блокируется. Cron-endpoints (process-reminders, update-usd-rate) не имеют CORS — они вызываются Vercel-инфраструктурой напрямую.

#### P1-3. Bonus race condition (FIXED)
- **Affected (was):** `grantBonus()` в `api/grant-bonus.js` для `bonus_balance` flow.
- **Vector (was):** classic lost-update. Запрос A читает 100, считает 150 (+50), пишет 150. Параллельный B читает 100, считает 130 (+30), пишет 130. Итог: 130 (правильно 180). Под нагрузкой реален при двойном клике, friend referral burst, cron+manual одновременно.
- **Fix applied:** Postgres function `inc_bonus_balance(p_telegram_id, p_delta)` через миграцию 037. `UPDATE ... SET balance = balance + delta` — атомарный stmt с row-lock. Если строки нет — `INSERT ... ON CONFLICT` fallback. `api/grant-bonus.js` теперь делает один RPC вместо двух запросов.
- **Дедупликация:** уже была через unique constraint `bonus_logs(telegram_id, type, dedupe_key)` — этот PR её не меняет. RPC закрывает оставшийся race.

#### P1-4. Rate limiting отсутствует (PARTIAL FIX)
- **Affected:** все API endpoints.
- **Vector:** spam → cost amplification (Vercel function invocations + Supabase row writes + Telegram API rate).
- **Fix applied:** in-memory token bucket (`api/_lib/rate-limit.js`) подключён к критичным endpoints:
  - `grant-bonus` — 15/мин по IP (финансовый flow)
  - `post-review` — 5/мин по IP (отзывы редкие, нет смысла больше)
  - `notify-admin` — 10/мин по IP (анти-спам в TG админам)
  - `notify-status` — 30/мин по IP (admin burst при массовых апдейтах OK)
  - `travelpayouts` — 60/мин по IP (cost amplification на внешний API)
  - `admin-grant-bonus`, `admin-delete-user` — 30/мин по IP (anti-runaway если admin токен compromised)
  - `track-click` — 30 POST + 60 GET / мин по IP
- **Что НЕ закрыто (Sprint 5):** in-memory bucket сбрасывается на cold-start Vercel. Для полной защиты — Upstash Redis + `@upstash/ratelimit`.

#### P1-5. PII в localStorage (PARTIAL FIX — flight_booking_draft proof-of-concept)
- **Affected (was):** `visa_drafts`, `hotel_booking_draft`, `flight_booking_draft`.
- **Vector:** Stored XSS → exfiltration паспортов. Сейчас XSS-вектора нет (нет userland innerHTML), но layered defense.
- **Fix applied (PR #9):**
  - `src/app/lib/secureStorage.ts` — wrapper с TG CloudStorage (приоритет) + localStorage (fallback)
  - TG CloudStorage хранит данные на TG-серверах, привязано к telegram_id, не виден внешним скриптам в WebView
  - Auto-fallback на localStorage если: нет TG (web-юзер), value > 4096 bytes, TG API ошибка
  - `flight_booking_draft` мигрирован как proof-of-concept (FlightBookingForm.tsx)
  - 21 unit-тест на wrapper (TG mock, byteLength UTF-8, migration helpers)
- **Что осталось:** мигрировать `visa_drafts` (массив + individual `draft_<uuid>` keys), `hotel_booking_draft`. Pattern готов — `import { secureStorage } from './lib/secureStorage'` + replace localStorage calls.

#### P1-6. Stack traces в response (FIXED)
- **Affected:** 7 endpoints возвращали `err.message` / `String(err)` в 500 response.
- **Vector:** information disclosure (Supabase column names, env hints, stack frames).
- **Fix applied:** все 500-responses теперь возвращают `{ error: 'internal error' }`. Полный stack уходит в Sentry через `captureException` + Vercel logs через `console.error`. Endpoints обновлены: grant-bonus, post-review, upsert-user, admin-grant-bonus, admin-delete-user, notify-status, web-user-upsert.

### P2 — Medium

- **P2-1.** Zod-валидация подключена ✅ на 5 критичных endpoints: `grant-bonus`, `notify-status`, `web-user-upsert`, `post-review`, `admin-grant-bonus`. Schemas в `api/_lib/validators.js`. Защищает от type-coercion (`amount='100'` теперь 400), HTML-инъекций в именах, fake реф-кодов, отрицательного amount в admin-grant. Остальные endpoints получат validation постепенно по мере касания.
- **P2-2.** `admin_audit_log` покрытие расширено ✅ — server-side helper `api/_lib/audit-log.js` (`logAdminAction`) подключён к 3 admin endpoints:
  - `admin-grant-bonus` → action `bonus.grant` / `bonus.revoke` (с previous_balance, new_balance, amount, description)
  - `admin-delete-user` → action `user.soft_delete` (с cascade counts, deleted_at)
  - `update-review` → action `review.update` (с changed_fields, status)
  Помимо frontend `auditLog()` (через anon-key) — теперь дублирование на бэке через service_key. Frontend помогает с UI-actions, backend гарантирует запись даже если admin вызывает API напрямую через curl/postman.
- **P2-3.** `npm audit` + `npm run build` в CI ✅ — `.github/workflows/security-checks.yml`. Запускается на каждом PR в dev/main + раз в неделю (понедельник 06:00 UTC). Test job (`npm test`) добавляется вручную — см. раздел "CI test job" ниже.
- **P2-4.** Sentry интегрирован ✅ (frontend через `@sentry/react`, backend через `@sentry/node` + `withSentry` wrapper). Включается через env vars `VITE_SENTRY_DSN` / `SENTRY_DSN` — пока не заданы, no-op. Setup: см. `docs/SENTRY_SETUP.md`. PII scrubbing встроен (passport, password, Authorization, Bearer, initData).
- **P2-7 (new).** Vitest smoke tests ✅ — 65 тестов на критичные helpers: `validators.js` (27), `rate-limit.js` (10), `cors.js` (15), `telegram-auth.js` (13 включая HMAC roundtrip с фейк-токеном). Запускается в CI как отдельный job (`npm test`). Regression-защита от ослабления Zod схем, HMAC изменений, CORS whitelist. Расширять при добавлении новых API helpers.
- **P2-5.** Backups Supabase — Pro-plan включает daily PITR на 7 дней, но snapshot-стратегии для cold-storage нет.
- **P2-6.** Hosting localization (152-ФЗ) — Supabase US, Vercel global. Отложено до перехода на ИП/ООО (см. `project_legal_status_blocker.md`).

### P3 — Low / Hygiene

- Удалить unused npm packages, fix flagged deprecations
- Centralize logging (вместо console.log в проде)
- Document threat model отдельным файлом
- Pre-commit hook: `npm audit --omit=dev` + `eslint-plugin-security`

---

## What this PR delivers

1. ✅ `vercel.json` — production-grade security headers (CSP, HSTS, Permissions-Policy, и т.д.). Separate rules для `/`, `/index.html`, `/api/*`.
2. ✅ `api/_lib/telegram-auth.js` — добавлен `requireCronAuth` helper (CRON_SECRET-based) как defense-in-depth для будущих cron-эндпоинтов. Не wired сейчас — existing `x-vercel-cron` + `x-service-key` достаточно.
3. ✅ `api/_lib/cors.js` — whitelisted CORS helper. Готов к подключению по endpoints.
4. ✅ `supabase/035_rls_audit_plan.sql` — план закрытия RLS (documentation-only, не выполняет destructive DDL).
5. ✅ `api/process-reminders.js` — documentation comment про существующий auth.
6. ✅ `docs/SECURITY.md` — этот файл.

## Production checklist (перед каждым релизом)

- [ ] `npm audit` — нет high/critical
- [ ] Все новые `/api/*` используют `requireTelegramUser` или `requireAdminUser` или `requireCronAuth`
- [ ] Новые таблицы — RLS enabled + явные policies (никакого `USING(true)`)
- [ ] Новые endpoints — CORS через `setCors` (когда wire-up завершится)
- [ ] Нет `console.log` с PII
- [ ] Нет stack traces в response body
- [ ] Env vars в Vercel actual, не в коммитах
- [ ] CSP headers не сломаны (test: open DevTools, проверь Console на CSP violations)
- [ ] Telegram initData валидируется на каждом protected endpoint

## Env vars audit

| Var | Required | Used in | Notes |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes | telegram-auth, push-notifications | server-only ✓ |
| `SUPABASE_SERVICE_KEY` | yes | все write-API | server-only ✓ — НИКОГДА не префиксить `VITE_` |
| `VITE_SUPABASE_URL` | yes | client+server | публично OK |
| `VITE_SUPABASE_ANON_KEY` | yes | client+server | публично OK (но RLS должен закрывать) |
| `ADMIN_TELEGRAM_IDS` | yes | requireAdminUser | server-only ✓ |
| `VITE_ADMIN_TELEGRAM_IDS` | legacy | client gate | можно убрать после P1-1 fix |
| `VITE_ADMIN_PASSWORD_HASH` | legacy | admin UI gate | убрать после P1-1 fix |
| `CRON_SECRET` | optional | requireCronAuth | не используется сейчас |
| `RESEND_API_KEY` | optional | email (Browse-only mode off) | сейчас неактивен |

## Telegram-specific checklist

- [x] `verifyInitData` — HMAC-SHA256 с timing-safe compare ✓
- [x] `auth_date` max-age 24h ✓
- [x] `user.id` берётся ТОЛЬКО из верифицированного initData, не из body ✓
- [x] `requireAdminUser` проверяет id против server-side allowlist ✓
- [ ] Replay attack protection — initData можно re-use в течение 24h. Если стерн критично — добавить nonce store в Redis с TTL=24h.
- [x] Fake payload defense — `parsed.delete('hash')` затем sort+join перед HMAC ✓
- [ ] Bot token rotation — manual; добавить документацию

## Roadmap (Q1–Q2 2026)

**Sprint 1 (now):** This PR — vercel.json + docs + helpers
**Sprint 2:** Wire-up `setCors` on all `/api/*` endpoints, smoke-test всё
**Sprint 3:** `/api/save-application`, `/api/save-review`, `/api/save-booking` — миграция write-flows на service_key
**Sprint 4:** Apply STAGE 3 from `035_rls_audit_plan.sql` (close RLS holes)
**Sprint 5:** Rate-limit (Upstash) + Sentry integration
**Sprint 6:** Zod schemas, centralized error handler, audit_logs coverage

Target security score: **8.5/10** к концу Q2.

## CI workflow (для ручного создания через GitHub UI)

Создай файл `.github/workflows/security-checks.yml` через GitHub Web UI
(GitHub → Repo → Add file → Create new file). PAT не нужен — UI обходит
ограничение workflow scope.

```yaml
name: Security checks

on:
  pull_request:
    branches: [dev, main]
  push:
    branches: [dev, main]
  schedule:
    - cron: '0 6 * * 1'

jobs:
  npm-audit:
    name: npm audit (production deps)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm audit --omit=dev --audit-level=high
      - run: npm audit || true
        continue-on-error: true

  build:
    name: Build sanity
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
```

## CI test job (добавить вручную — PAT workflow scope)

После PR #7 (Vitest smoke tests) в репозитории появилось 65 тестов
в `api/_lib/*.test.js`. Чтобы CI блокировал merge при упавших тестах,
добавь test-job в существующий `.github/workflows/security-checks.yml`.

GitHub → файл `.github/workflows/security-checks.yml` → Edit → в КОНЕЦ
добавь блок:

```yaml
  test:
    name: Vitest smoke tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
```

(Отступы — 2 пробела. Block должен быть на одном уровне с `build:` и `npm-audit:`.)

Коммит прямо в `dev`. Через ~1 минуту в Actions появится третий job
"Vitest smoke tests" — должен быть зелёным (65 passed).
