# Sprint 1 — Безопасность: порядок выкатывания

Все миграции лежат в этой папке. Гонять в Supabase Dashboard → SQL Editor по порядку.

## 1. `001_initial_schema.sql`
Идемпотентная схема всех таблиц (включая те, которые раньше создавались только в админке: `additional_services`, `bonus_logs`, `notification_dedup` и т.д.). Безопасно гонять на любом инстансе — `CREATE TABLE IF NOT EXISTS`.

## 2. `002_bonus_logs_unique.sql`
Уникальный constraint на `(telegram_id, type, dedupe_key)` — пресекает race condition двойного начисления при двойном клике / параллельных Vercel-инстансах.

## 3. `003_storage_rls.sql`
Path-based RLS на bucket `visadel-files`. Файлы пишутся в `<telegram_id>/<folder>/<filename>`. После 004 эти политики автоматически закроют доступ к чужим файлам.

## 4. `004_rls_telegram_id.sql` ⚠️ **ОПАСНО**

**ПЕРЕД ЗАПУСКОМ:**

- [ ] Vercel задеплоил последнюю версию (где все API эндпоинты используют `verifyInitData`)
- [ ] Все клиентские `fetch('/api/...')` заменены на `apiFetch(...)` — эта миграция уже в коде
- [ ] Env-переменные на Vercel:
  - `TELEGRAM_BOT_TOKEN` — для проверки подписи initData
  - `ADMIN_TELEGRAM_IDS` (или `VITE_ADMIN_TELEGRAM_IDS`) — TG ID админов через запятую
  - `SUPABASE_SERVICE_KEY` — для server-side операций после закрытия RLS

После 004 фронт продолжит работать (admin/user формы ходят через API endpoints), но прямые `supabase.from('users')` из клиентского кода (если такие есть в обход API) перестанут читать чужие данные.

**Откат**, если что-то полетело: восстановить из `supabase/schema.sql` старые открытые политики (там `USING (true)` на каждой таблице).

## Env-переменные на Vercel

```bash
# уже есть
VITE_SUPABASE_URL=https://....supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...
TELEGRAM_BOT_TOKEN=8367523249:AA...
TELEGRAM_APP_URL=https://yourapp.vercel.app

# нужно добавить
ADMIN_TELEGRAM_IDS=123456789,987654321  # без VITE_ префикса для server-side
```

## Что изменилось в коде

- `api/_lib/telegram-auth.js` — модуль HMAC-SHA256 верификации initData
- `api/grant-bonus.js` — теперь требует initData либо service-key, telegram_id из подписи
- `api/notify-status.js` — admin может всем, user — только себе
- `api/notify-admin.js` — customer_telegram из verified подписи
- `api/post-review.js` — username из подписи
- `api/schedule-reminders.js` — telegram_id из подписи (не из body)
- `api/cancel-reminders.js` — фильтр `telegram_id=eq.X` чтобы не отменять чужие
- `api/update-review.js` — admin-only

- `src/app/lib/apiFetch.ts` — обёртка над fetch, прикладывает `Authorization: tma <initData>`
- Все клиентские `fetch('/api/...')` заменены на `apiFetch(...)` (~17 мест)
- `src/app/lib/db.ts:uploadFile` — пишет в `<telegram_id>/<folder>/<file>` для path-based RLS
