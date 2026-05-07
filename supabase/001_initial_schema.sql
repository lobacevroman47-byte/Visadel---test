-- ============================================================================
-- VISADEL — единая инициализационная схема
--
-- Идемпотентна: можно гонять сколько угодно раз. Заменяет старый schema.sql
-- и добивает таблицы, которых не было (additional_services, bonus_logs,
-- notification_dedup, referral_clicks, reminders, visa_products,
-- visa_form_fields, visa_photo_requirements, app_settings, hotel_bookings,
-- flight_bookings, status_log, admin_users, drafts).
--
-- Порядок применения:
--   1. Этот файл (создаёт всё с нуля либо ничего не делает если уже есть)
--   2. 002_bonus_logs_unique.sql
--   3. 003_storage_rls.sql
--   4. 004_rls_telegram_id.sql (закрывает доступ — применять ПОСЛЕ
--      развёртывания фронта/бэка с initData verification)
-- ============================================================================

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id     BIGINT UNIQUE NOT NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT,
  username        TEXT,
  photo_url       TEXT,
  phone           TEXT,
  email           TEXT,
  bonus_balance   INTEGER DEFAULT 0 NOT NULL,
  is_influencer   BOOLEAN DEFAULT false NOT NULL,
  referral_code   TEXT UNIQUE NOT NULL,
  referred_by     TEXT,
  last_bonus_date DATE,
  bonus_streak    INTEGER DEFAULT 0 NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ── Applications (visa) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.applications (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_telegram_id    BIGINT NOT NULL,
  country             TEXT NOT NULL,
  visa_type           TEXT NOT NULL,
  visa_id             TEXT NOT NULL,
  price               INTEGER NOT NULL,
  urgent              BOOLEAN DEFAULT false NOT NULL,
  status              TEXT DEFAULT 'draft' NOT NULL
                        CHECK (status IN ('draft','pending_payment','pending_confirmation','in_progress','ready')),
  form_data           JSONB DEFAULT '{}'::JSONB NOT NULL,
  payment_proof_url   TEXT,
  visa_file_url       TEXT,
  bonuses_used        INTEGER DEFAULT 0 NOT NULL,
  usd_rate_rub        NUMERIC,
  tax_pct             NUMERIC,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ── Tasks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_telegram_id  BIGINT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  task_type         TEXT NOT NULL,
  title             TEXT NOT NULL,
  reward            INTEGER NOT NULL,
  status            TEXT DEFAULT 'pending' NOT NULL
                      CHECK (status IN ('pending','submitted','approved','rejected')),
  proof_url         TEXT,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ── Reviews ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_telegram_id  BIGINT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  application_id    UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  country           TEXT NOT NULL,
  rating            INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text              TEXT NOT NULL,
  status            TEXT DEFAULT 'pending' NOT NULL
                      CHECK (status IN ('pending','approved','rejected')),
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ── Bonus logs (история начислений) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bonus_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id     BIGINT NOT NULL,
  type            TEXT NOT NULL,        -- welcome | referral | daily | review | admin_* | payment
  amount          INTEGER NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bonus_logs_telegram_id ON public.bonus_logs(telegram_id);
CREATE INDEX IF NOT EXISTS idx_bonus_logs_type ON public.bonus_logs(type);

-- ── Notification dedup (избежать повторных Telegram пушей) ───────────────────
CREATE TABLE IF NOT EXISTS public.notification_dedup (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id     BIGINT NOT NULL,
  application_id  UUID,
  status          TEXT NOT NULL,
  minute_bucket   TEXT NOT NULL,        -- ISO YYYY-MM-DDTHH:MM — anti-spam window
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (telegram_id, application_id, status, minute_bucket)
);

-- ── Referral clicks (отслеживание) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code   TEXT NOT NULL,
  click_id        TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_code ON public.referral_clicks(referral_code);

-- ── Reminders (отложенные напоминания о черновике/оплате) ────────────────────
CREATE TABLE IF NOT EXISTS public.reminders (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id     BIGINT NOT NULL,
  draft_key       TEXT NOT NULL,
  country         TEXT,
  visa_type       TEXT,
  type            TEXT DEFAULT 'draft' NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  sent            BOOLEAN DEFAULT false NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON public.reminders(scheduled_at) WHERE sent = false;
CREATE INDEX IF NOT EXISTS idx_reminders_draft ON public.reminders(draft_key);

-- ── Visa Products (каталог виз) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visa_products (
  id                      TEXT PRIMARY KEY,
  country                 TEXT NOT NULL,
  flag                    TEXT,
  name                    TEXT NOT NULL,
  price                   INTEGER NOT NULL,
  processing_time         TEXT,
  description             TEXT,
  partner_commission_pct  NUMERIC NOT NULL DEFAULT 15,
  cost_usd_fee            NUMERIC NOT NULL DEFAULT 0,
  cost_usd_commission     NUMERIC NOT NULL DEFAULT 0,
  enabled                 BOOLEAN NOT NULL DEFAULT true,
  sort_order              INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ── Visa form fields (конструктор анкет) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visa_form_fields (
  id            TEXT PRIMARY KEY,
  country       TEXT NOT NULL,
  visa_id       TEXT,                   -- null = поле для всех виз страны
  field_key     TEXT NOT NULL,
  label         TEXT NOT NULL,
  field_type    TEXT NOT NULL,
  required      BOOLEAN NOT NULL DEFAULT false,
  placeholder   TEXT,
  comment       TEXT,
  options       JSONB,
  warning       TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visa_form_fields_country ON public.visa_form_fields(country);

-- ── Visa photo requirements ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visa_photo_requirements (
  id            TEXT PRIMARY KEY,
  country       TEXT NOT NULL,
  visa_id       TEXT,
  field_key     TEXT NOT NULL,
  label         TEXT NOT NULL,
  required      BOOLEAN NOT NULL DEFAULT false,
  formats       TEXT,
  max_size      TEXT,
  requirements  TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visa_photo_country ON public.visa_photo_requirements(country);

-- ── Additional Services (доп. услуги + брони как ID) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.additional_services (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  icon                     TEXT,
  description              TEXT,
  price                    INTEGER NOT NULL DEFAULT 0,
  cost_rub                 NUMERIC NOT NULL DEFAULT 0,
  partner_commission_pct   NUMERIC NOT NULL DEFAULT 15,
  enabled                  BOOLEAN NOT NULL DEFAULT true,
  sort_order               INTEGER NOT NULL DEFAULT 0,
  countries                TEXT[] NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at               TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ── App Settings (одна строка глобальной конфигурации) ───────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  id                              INTEGER PRIMARY KEY DEFAULT 1,
  new_user_welcome_bonus          INTEGER NOT NULL DEFAULT 100,
  referrer_regular_bonus          INTEGER NOT NULL DEFAULT 500,
  partner_commission_pct_default  NUMERIC NOT NULL DEFAULT 15,
  max_bonus_usage_regular         INTEGER NOT NULL DEFAULT 1000,
  max_bonus_usage_partner         INTEGER,
  bonus_expiration_days           INTEGER NOT NULL DEFAULT 365,
  payment_card_number             TEXT,
  payment_card_holder             TEXT,
  hotel_booking_price             INTEGER NOT NULL DEFAULT 1000,
  flight_booking_price            INTEGER NOT NULL DEFAULT 2000,
  hotel_extra_fields              JSONB DEFAULT '[]'::JSONB,
  flight_extra_fields             JSONB DEFAULT '[]'::JSONB,
  hotel_core_overrides            JSONB DEFAULT '{}'::JSONB,
  flight_core_overrides           JSONB DEFAULT '{}'::JSONB,
  updated_at                      TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Hotel Bookings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hotel_bookings (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id            BIGINT,
  username               TEXT,
  first_name             TEXT NOT NULL,
  last_name              TEXT NOT NULL,
  country                TEXT NOT NULL,
  city                   TEXT NOT NULL,
  check_in               DATE NOT NULL,
  check_out              DATE NOT NULL,
  guests                 INTEGER NOT NULL DEFAULT 1,
  children_ages          TEXT[] NOT NULL DEFAULT '{}',
  email                  TEXT NOT NULL,
  phone                  TEXT NOT NULL,
  telegram_login         TEXT NOT NULL,
  passport_url           TEXT,
  payment_screenshot_url TEXT,
  confirmation_url       TEXT,
  price                  INTEGER,
  status                 TEXT NOT NULL DEFAULT 'new'
                           CHECK (status IN ('new','pending_payment','in_progress','confirmed','cancelled')),
  extra_fields           JSONB,
  created_at             TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at             TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_tg ON public.hotel_bookings(telegram_id);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_status ON public.hotel_bookings(status);

-- ── Flight Bookings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flight_bookings (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id            BIGINT,
  username               TEXT,
  first_name             TEXT NOT NULL,
  last_name              TEXT NOT NULL,
  from_city              TEXT NOT NULL,
  to_city                TEXT NOT NULL,
  booking_date           DATE NOT NULL,
  email                  TEXT NOT NULL,
  phone                  TEXT NOT NULL,
  telegram_login         TEXT NOT NULL,
  passport_url           TEXT,
  payment_screenshot_url TEXT,
  confirmation_url       TEXT,
  price                  INTEGER,
  status                 TEXT NOT NULL DEFAULT 'new'
                           CHECK (status IN ('new','pending_payment','in_progress','confirmed','cancelled')),
  extra_fields           JSONB,
  created_at             TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at             TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_flight_bookings_tg ON public.flight_bookings(telegram_id);
CREATE INDEX IF NOT EXISTS idx_flight_bookings_status ON public.flight_bookings(status);

-- ── Status log (история смены статусов виз) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.status_log (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id    UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  from_status       TEXT,
  to_status         TEXT NOT NULL,
  admin_id          BIGINT,
  admin_name        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_status_log_app ON public.status_log(application_id);

-- ── Admin users (доп. админы поверх .env whitelist) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
  telegram_id   BIGINT PRIMARY KEY,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner','admin','moderator')),
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_applications_user ON public.applications(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_visa_id ON public.applications(visa_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.tasks(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);

-- ── Auto-update updated_at trigger ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','applications','tasks','visa_products','visa_form_fields',
    'visa_photo_requirements','additional_services','hotel_bookings',
    'flight_bookings','app_settings'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I_updated_at ON public.%I; ' ||
      'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      t, t, t, t
    );
  END LOOP;
END$$;

-- ── Storage bucket ───────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('visadel-files', 'visadel-files', false)
ON CONFLICT (id) DO NOTHING;

-- ── ВНИМАНИЕ: RLS политики НЕ создаются здесь.
-- Открытые политики (USING true) лежат в legacy-режиме до 004_rls_telegram_id.sql.
-- Не запускай 004 пока фронт не задеплоен с initData verification.
