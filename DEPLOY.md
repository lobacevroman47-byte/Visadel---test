# VISADEL — Deploy & Manual Steps

Что нужно делать руками после `git pull` / при переезде на новый бот / Supabase / Vercel.

---

## Phase 0 — Security hotfix (выполнить НЕМЕДЛЕННО на текущем проде)

После того как этот PR/коммит попал в main, выполни в таком порядке:

### 1. Ротировать карту оплаты

Карта `5536 9140 3834 6908` светилась в `supabase/010_app_settings_payments.sql` и
во всём git history. Считай её скомпрометированной.

- [ ] Зайти в банк → перевыпустить карту с новым номером
- [ ] (опционально, если планируешь публичный репо) почистить git history:
      `git filter-repo --replace-text` или BFG Repo Cleaner — заменить
      номер карты на `<REDACTED>` во всех коммитах. **Внимание:** force-push
      перепишет историю, всем кто склонировал репо нужно будет переклонироваться.

### 2. Обновить номер карты в БД через админку

Карта больше **не задаётся через миграцию**. Её надо вписать вручную:

- [ ] Открыть админку → Settings → «Реквизиты для оплаты»
- [ ] Ввести новый номер карты в поле «Номер карты»
- [ ] Нажать «Сохранить»

Если поле в БД пустое (`payment_card_number = ''`), в форме оплаты
покажется пусто — поэтому **не забудь сделать этот шаг сразу после ротации**.

### 3. Накатить миграцию 006 (tamper protection)

В Supabase Dashboard → SQL Editor → New query → вставить содержимое
файла `supabase/006_lock_audit_logs_tamper.sql` → Run.

Что делает: оставляет INSERT/SELECT открытыми (фронт продолжает работать),
но блокирует UPDATE/DELETE на `bonus_logs` / `status_log` / `admin_audit_log`.
Никто больше не сможет переписать или удалить лог задним числом.

Проверить что всё ок:

```sql
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('bonus_logs','status_log','admin_audit_log')
ORDER BY tablename, cmd;
```

Должно показать по 2 политики на каждую таблицу: `anon_insert` (INSERT)
и `anon_select` (SELECT). Если есть `anon_write` (FOR ALL) — миграция не
применилась, повторить.

### 4. Добавить SERVICE_KEY env для process-reminders cron

Раньше `/api/process-reminders` был открыт миру (любой URL = массовая
рассылка напоминаний). Теперь требует либо `x-vercel-cron` header (Vercel
шлёт автоматически на cron-запросы), либо `x-service-key`.

- [ ] Vercel → Project → Settings → Environment Variables
- [ ] Убедиться что `SUPABASE_SERVICE_KEY` уже есть (он же используется
      для `update-usd-rate.js`). Если нет — взять из Supabase Dashboard →
      Project Settings → API → service_role key
- [ ] Передеплоить: `vercel --prod` или push в main

### 5. Проверить что ничего не сломалось

После всех шагов проверь руками:

- [ ] Открыть мини-апп → Profile → виден ли balance
- [ ] Сменить статус заявки в админке → пришёл ли push, появилась ли
      запись в Журнале изменений (admin_audit_log)
- [ ] Оплатить тестовую заявку → начислился ли реферальный бонус (bonus_logs)
- [ ] Курьерное напоминание (если есть незавершённые драфты) — `/api/process-reminders`
      без X-Service-Key должен вернуть 401

---

## Полная переустановка (новый Supabase / новый бот / новый домен)

Если переезжаешь с нуля на свежий Supabase project и/или новый бот.

### A. Создать Supabase проект

1. supabase.com → New project → выбрать регион
2. Скопировать `Project URL`, `anon key`, `service_role key`

### B. Накатить миграции

В **строгом порядке** через Supabase SQL Editor (или `supabase db push`):

```
001_initial_schema.sql
002_bonus_logs_unique.sql
003_storage_rls.sql
004_rls_telegram_id.sql
005_audit_log_and_usd_rate.sql
006_lock_audit_logs_tamper.sql
007_hotel_bookings.sql
008_flight_bookings.sql
009_bookings_add_payment.sql
010_app_settings_payments.sql
011_bookings_select_policies.sql
012_bookings_confirmation_url.sql
013_additional_services_countries.sql
014_booking_core_overrides.sql
015_additional_services_partner_commission.sql
016_enable_realtime.sql
```

Все миграции теперь занумерованы — раскатываются одной командой
`supabase db push` либо последовательным копированием в SQL Editor.

### C. Realtime publication (накатывается миграцией 016)

Sprint 5 добавил подписки на изменения в админке. Раньше публикация
включалась руками в Dashboard — теперь это делает миграция
`016_enable_realtime.sql`. Идемпотентна: безопасно гонять повторно.

Покрытые таблицы:
- ✅ `additional_services`
- ✅ `app_settings`
- ✅ `visa_products`
- ✅ `applications` (для админ Dashboard real-time)
- ✅ `flight_bookings` (real-time для броней авиа)
- ✅ `hotel_bookings` (real-time для броней отелей)

Если миграция отработала, проверить можно так:

```sql
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
```

Должны увидеть все 6 таблиц.

### D. Создать Storage bucket

Dashboard → Storage → New bucket: `visadel-files`
- Public: **No** (политики из 003 раздадут доступ)

### E. Создать Telegram бота

@BotFather:
1. `/newbot` → имя, username → получишь `BOT_TOKEN`
2. `/mybots` → выбрать → Bot Settings → Menu Button → задать URL мини-аппа (Vercel deployment URL)
3. Bot Settings → Configure Mini App → задать URL
4. (опционально) `/setdomain` для inline mode

### F. Создать Vercel проект

1. New Project → Import GitHub repo
2. Environment Variables (см. `.env.example`):
   ```
   VITE_SUPABASE_URL          = https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY     = <anon-key>
   SUPABASE_SERVICE_KEY       = <service-role-key>
   TELEGRAM_BOT_TOKEN         = <bot-token>
   TELEGRAM_APP_URL           = https://<vercel-deployment>.vercel.app
   VITE_ADMIN_TELEGRAM_IDS    = <твой_telegram_id>,<партнёр_telegram_id>
   VITE_ADMIN_PASSWORD_HASH   = <bcrypt hash>
   ```
3. Deploy
4. Vercel автоматически подхватит `vercel.json` cron-jobs (USD rate, reminders)

### G. Перенос данных (опционально)

Если хочешь сохранить юзеров, заявки, отзывы из старого Supabase:

```bash
# Дамп со старого
pg_dump --data-only --table=public.users --table=public.applications \
        --table=public.bonus_logs --table=public.reviews \
        "postgresql://postgres:<old-pwd>@<old-host>:5432/postgres" > data.sql

# Восстановление в новый
psql "postgresql://postgres:<new-pwd>@<new-host>:5432/postgres" < data.sql
```

Storage-файлы (паспорта, payment proofs) перенести через `supabase storage cp`
или скриптом, читающим список файлов и перезаливающим.

### H. Проверочный чеклист

- [ ] Открыть Mini App из бота → загружается, не падает
- [ ] Зайти в админку (`?admin=true`) → виден Dashboard
- [ ] Создать тестовую заявку → дошла до админки
- [ ] Сменить статус → push в Telegram пришёл
- [ ] Курс USD обновился (`/api/update-usd-rate` с `x-service-key`)

---

## Env vars cheatsheet

```bash
# Supabase
VITE_SUPABASE_URL              # клиентский URL
VITE_SUPABASE_ANON_KEY         # клиентский anon key
SUPABASE_SERVICE_KEY           # серверный (только для api/*)

# Telegram
TELEGRAM_BOT_TOKEN             # для api/notify-* и process-reminders
TELEGRAM_APP_URL               # https://your-app.vercel.app

# Admin
VITE_ADMIN_TELEGRAM_IDS        # CSV: 281354774,12345678
VITE_ADMIN_PASSWORD_HASH       # bcrypt hash для логина по паролю

# Travelpayouts (опционально)
TRAVELPAYOUTS_TOKEN            # для api/travelpayouts.js
TRAVELPAYOUTS_MARKER           # marker для партнёрки
```
