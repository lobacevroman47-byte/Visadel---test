# VISADEL — Security audit & hardening roadmap

> Аудит: 2026-05-17. Аудитор: Claude (Sonnet 4.7).
> Scope: production deploy (visadel.agency, @Visadel_agency_bot) + dev (visadel-test.vercel.app, @Visadel_test_bot).
> Stack: Vite + React, Vercel Pro, Supabase, Telegram Mini App.

## Executive summary

Текущий security score: **4.5/10** (до начальной итерации) → **6.5/10** (PR #1 headers + audit) → **7.5/10** (PR #2 CORS + rate-limit + admin-gate) → **8.0/10** (PR #3 Sentry + error sanitization).

Самые опасные дыры (P0) — открытые RLS policies (`USING(true)`) на `applications`, `hotel_bookings`, `flight_bookings`, `users`. Через anon-key любой может читать и менять чужие данные. Этот PR не закрывает их (требует API-refactor), но фиксирует план в `supabase/035_rls_audit_plan.sql`.

Хорошие новости: критичные auth-механизмы реализованы корректно — `verifyInitData` использует timing-safe HMAC, service_key только на сервере, cron endpoints защищены через `x-vercel-cron` + `x-service-key`, soft-delete pattern, admin double-check (`requireAdminUser`).

---

## Issues by severity

### P0 — Critical (active exploit possible)

#### P0-1. Open RLS на пользовательских таблицах
- **Affected:** `applications`, `hotel_bookings`, `flight_bookings`, `reviews`, `tasks`, `users`.
- **Root cause:** миграции 011 и 033 ставят `USING(true) WITH CHECK(true)` для всех ролей.
- **Exploit:**
  ```http
  GET /rest/v1/applications?select=* HTTP/1.1
  apikey: <ANON_KEY из bundle>
  ```
  → возвращает ВСЕ заявки всех клиентов с паспортными данными.
- **Status:** план в `supabase/035_rls_audit_plan.sql`. Требует STAGE 2 (API refactor) перед применением.
- **ETA:** 1–2 спринта.

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

#### P1-3. Bonus race condition
- **Affected:** `grantBonus` flow.
- **Vector:** double-spend через параллельные `grant-bonus` calls. Миграция 020 (partner atomic balance) использует SQL transaction — для partner ОК. Но `bonus_logs` insert + `users.bonus_balance` update — два отдельных запроса.
- **Fix:** обернуть в Postgres function `grant_user_bonus(tg_id, amount, reason)` с FOR UPDATE lock + idempotency key. Частично уже есть для partner-payouts, нужно вынести в общий паттерн.

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

#### P1-5. PII в localStorage
- **Affected:** `visa_drafts`, `hotel_booking_draft`, `flight_booking_draft`.
- **Vector:** Stored XSS → exfiltration паспортов. Сейчас XSS-вектора нет (нет userland innerHTML), но layered defense.
- **Fix:** мигрировать черновики в TG `cloudStorage` API (зашифрован TG-инфраструктурой). Для web-юзеров — оставить localStorage с warning или server-side draft через `/api/drafts`.

#### P1-6. Stack traces в response (FIXED)
- **Affected:** 7 endpoints возвращали `err.message` / `String(err)` в 500 response.
- **Vector:** information disclosure (Supabase column names, env hints, stack frames).
- **Fix applied:** все 500-responses теперь возвращают `{ error: 'internal error' }`. Полный stack уходит в Sentry через `captureException` + Vercel logs через `console.error`. Endpoints обновлены: grant-bonus, post-review, upsert-user, admin-grant-bonus, admin-delete-user, notify-status, web-user-upsert.

### P2 — Medium

- **P2-1.** Нет Zod/joi схем на API inputs — type-coercion риски, missing fields = silent bugs.
- **P2-2.** `audit_logs` есть (миграции 005/006), но не пишет ВСЕ admin-actions. Не покрыты: `admin-delete-user`, manual bonus grants.
- **P2-3.** `npm audit` не автоматизирован в CI.
- **P2-4.** Sentry интегрирован ✅ (frontend через `@sentry/react`, backend через `@sentry/node` + `withSentry` wrapper). Включается через env vars `VITE_SENTRY_DSN` / `SENTRY_DSN` — пока не заданы, no-op. Setup: см. `docs/SENTRY_SETUP.md`. PII scrubbing встроен (passport, password, Authorization, Bearer, initData).
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
