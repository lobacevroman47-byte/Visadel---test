# VISADEL — Security audit & hardening roadmap

> Аудит: 2026-05-17. Аудитор: Claude (Sonnet 4.7).
> Scope: production deploy (visadel.agency, @Visadel_agency_bot) + dev (visadel-test.vercel.app, @Visadel_test_bot).
> Stack: Vite + React, Vercel Pro, Supabase, Telegram Mini App.

## Executive summary

Текущий security score: **4.5/10** (до этого PR), **6.0/10** (после применения этого PR).

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

#### P0-3. File upload без server-side валидации
- **Affected:** Step 4 (фото-документы), все *_BookingForm с upload.
- **Root cause:** клиент шлёт `multipart/form-data` напрямую в Supabase Storage через signed URL. Magic bytes / MIME / размер проверяются на клиенте (можно обойти).
- **Exploit:** загрузка `.exe`, `.html` с JS, .svg с XSS → если Storage отдаётся под `default-src 'self'` на нашем домене — реальная XSS.
- **Fix:** прокси-endpoint `/api/upload-file` с server-side `file-type` detection + MIME whitelist + max size + virus scan (опционально через ClamAV / VirusTotal API). До этого: убедиться что Storage bucket отдаётся под отдельным доменом (Supabase CDN, не visadel.agency) — это уже так.

#### P0-4. Security headers (FIXED в этом PR)
- **Before:** `X-Frame-Options: ALLOWALL`, CSP `frame-ancestors *`.
- **After:** CSP с whitelist (Telegram, Supabase, self), HSTS preload, Permissions-Policy lockdown, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, отдельные правила для `/api/*` (no-store, no-index).

### P1 — High (требует усилий для эксплуатации)

#### P1-1. `?admin=true` UI-gate
- **Affected:** `src/app/admin/contexts/AdminContext.tsx:25-28`.
- **Root cause:** клиентский gate через `VITE_ADMIN_PASSWORD_HASH` — хеш в bundle, видим всем. Можно brute-force оффлайн.
- **Mitigation в коде:** на бэке `requireAdminUser` проверяет telegram_id против ADMIN_TELEGRAM_IDS — то есть РЕАЛЬНАЯ защита есть на API. UI-gate — лишь cosmetic.
- **Fix:** убрать password-hash вообще, gate'ить только по `tgUser.id ∈ ADMIN_IDS` (доступно сразу после initData). Скрывать admin route если не админ.

#### P1-2. CORS `*` на всех API
- **Affected:** все `api/*.js` отдают `Access-Control-Allow-Origin: *`.
- **Vector:** CSRF через open tab — если у юзера в одной вкладке Telegram Mini App, в другой malicious site, `fetch('/api/grant-bonus', {headers:{authorization: 'tma ...'}})` может пройти. Защита: `Authorization` header требует ручной установки → preflight, который из `*` пропускается.
- **Fix:** helper `api/_lib/cors.js` (этот PR) — whitelist для `visadel.agency`, `*.vercel.app`, `*.telegram.org`. Wire-up postponed — нужно прогнать все endpoints через интеграционные тесты.

#### P1-3. Bonus race condition
- **Affected:** `grantBonus` flow.
- **Vector:** double-spend через параллельные `grant-bonus` calls. Миграция 020 (partner atomic balance) использует SQL transaction — для partner ОК. Но `bonus_logs` insert + `users.bonus_balance` update — два отдельных запроса.
- **Fix:** обернуть в Postgres function `grant_user_bonus(tg_id, amount, reason)` с FOR UPDATE lock + idempotency key. Частично уже есть для partner-payouts, нужно вынести в общий паттерн.

#### P1-4. Rate limiting отсутствует
- **Affected:** все API endpoints.
- **Vector:** spam → cost amplification (Vercel function invocations + Supabase row writes + Telegram API rate).
- **Fix:** Upstash Redis + `@upstash/ratelimit`. Per-tg_id и per-IP limits. Critical endpoints: `grant-bonus`, `save-application`, `track-click`, `post-review`, `notify-admin`.

#### P1-5. PII в localStorage
- **Affected:** `visa_drafts`, `hotel_booking_draft`, `flight_booking_draft`.
- **Vector:** Stored XSS → exfiltration паспортов. Сейчас XSS-вектора нет (нет userland innerHTML), но layered defense.
- **Fix:** мигрировать черновики в TG `cloudStorage` API (зашифрован TG-инфраструктурой). Для web-юзеров — оставить localStorage с warning или server-side draft через `/api/drafts`.

#### P1-6. Stack traces в response
- **Affected:** некоторые API handlers возвращают `err.message` в JSON при ошибке.
- **Vector:** information disclosure (Supabase column names, env hints).
- **Fix:** общий error wrapper:
  ```js
  catch (err) {
    console.error('[endpoint]', err);
    const safeMsg = err.publicMessage ?? 'internal error';
    res.status(err.status ?? 500).json({ error: safeMsg });
  }
  ```

### P2 — Medium

- **P2-1.** Нет Zod/joi схем на API inputs — type-coercion риски, missing fields = silent bugs.
- **P2-2.** `audit_logs` есть (миграции 005/006), но не пишет ВСЕ admin-actions. Не покрыты: `admin-delete-user`, manual bonus grants.
- **P2-3.** `npm audit` не автоматизирован в CI.
- **P2-4.** Sentry не подключён — нет visibility на runtime errors в prod.
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
