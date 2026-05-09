-- 017_partner_infrastructure.sql
--
-- Foundation для партнёрской программы VISADEL:
-- • Hold-период 30 дней для партнёрских комиссий (после оплаты клиентом)
-- • Раздельный partner_balance (₽ к выплате) vs bonus_balance (бонусы-скидки)
-- • Атрибуция рефереров на броних отелей и авиабилетов
-- • Per-product партнёрский % (hotel/flight defaults в app_settings)
-- • partner_payouts — журнал выплат на карту
-- • partner_settings — реквизиты партнёра (карта/ИНН/самозанятый etc)
--
-- Идемпотентно: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS.

-- ═══════════════════════════════════════════════════════════════════════════
-- 0. Гарантируем что helper-функции существуют (на случай если 004/001 не
--    были применены к этой БД). CREATE OR REPLACE — идемпотентно.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.current_tg_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.tg_id', true), '')::bigint
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. users — партнёрский баланс (отдельно от bonus_balance)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS partner_balance INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.partner_balance IS
  '₽ к выплате партнёру (is_influencer=true). Растёт после 30-дневного hold-а одобренных комиссий, уменьшается при выплатах.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. app_settings — defaults для % с броней отелей и авиабилетов
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS hotel_partner_pct_default  NUMERIC NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS flight_partner_pct_default NUMERIC NOT NULL DEFAULT 10;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. hotel_bookings — атрибуция реферера + поля для отслеживания комиссии
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.hotel_bookings
  ADD COLUMN IF NOT EXISTS referrer_code                  TEXT,
  ADD COLUMN IF NOT EXISTS partner_commission_pct         NUMERIC,
  ADD COLUMN IF NOT EXISTS partner_commission_status      TEXT
    CHECK (partner_commission_status IS NULL
        OR partner_commission_status IN ('pending', 'approved', 'paid', 'cancelled')),
  ADD COLUMN IF NOT EXISTS partner_commission_amount_rub  INTEGER,
  ADD COLUMN IF NOT EXISTS partner_commission_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partner_commission_paid_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_hotel_bookings_referrer
  ON public.hotel_bookings(referrer_code) WHERE referrer_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_partner_status
  ON public.hotel_bookings(partner_commission_status) WHERE partner_commission_status IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. flight_bookings — то же что hotel_bookings
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.flight_bookings
  ADD COLUMN IF NOT EXISTS referrer_code                  TEXT,
  ADD COLUMN IF NOT EXISTS partner_commission_pct         NUMERIC,
  ADD COLUMN IF NOT EXISTS partner_commission_status      TEXT
    CHECK (partner_commission_status IS NULL
        OR partner_commission_status IN ('pending', 'approved', 'paid', 'cancelled')),
  ADD COLUMN IF NOT EXISTS partner_commission_amount_rub  INTEGER,
  ADD COLUMN IF NOT EXISTS partner_commission_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partner_commission_paid_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_flight_bookings_referrer
  ON public.flight_bookings(referrer_code) WHERE referrer_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_flight_bookings_partner_status
  ON public.flight_bookings(partner_commission_status) WHERE partner_commission_status IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. partner_payouts — журнал выплат партнёрам
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.partner_payouts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id   BIGINT NOT NULL,
  amount_rub    INTEGER NOT NULL CHECK (amount_rub > 0),
  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed', 'cancelled')),
  card_last4    TEXT,
  note          TEXT,
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partner_payouts_telegram
  ON public.partner_payouts(telegram_id);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_status
  ON public.partner_payouts(status);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_created_at
  ON public.partner_payouts(created_at DESC);

-- RLS: anon insert/select запрещены, всё через service-key (admin/cron)
ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_own_payouts" ON public.partner_payouts;
CREATE POLICY "anon_select_own_payouts" ON public.partner_payouts
  FOR SELECT TO anon
  USING (telegram_id = public.current_tg_id());

-- updated_at trigger
DROP TRIGGER IF EXISTS partner_payouts_updated_at ON public.partner_payouts;
CREATE TRIGGER partner_payouts_updated_at
  BEFORE UPDATE ON public.partner_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. partner_settings — реквизиты для выплат (1 строка на партнёра)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.partner_settings (
  telegram_id            BIGINT PRIMARY KEY,
  full_name              TEXT,
  inn                    TEXT,
  card_number_last4      TEXT,
  card_bank              TEXT,
  entity_type            TEXT
    CHECK (entity_type IS NULL OR entity_type IN ('individual', 'self_employed', 'ip')),
  agreement_accepted_at  TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at             TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.partner_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_own_settings" ON public.partner_settings;
CREATE POLICY "anon_select_own_settings" ON public.partner_settings
  FOR SELECT TO anon
  USING (telegram_id = public.current_tg_id());

DROP POLICY IF EXISTS "anon_upsert_own_settings" ON public.partner_settings;
CREATE POLICY "anon_upsert_own_settings" ON public.partner_settings
  FOR INSERT TO anon
  WITH CHECK (telegram_id = public.current_tg_id());

DROP POLICY IF EXISTS "anon_update_own_settings" ON public.partner_settings;
CREATE POLICY "anon_update_own_settings" ON public.partner_settings
  FOR UPDATE TO anon
  USING (telegram_id = public.current_tg_id())
  WITH CHECK (telegram_id = public.current_tg_id());

DROP TRIGGER IF EXISTS partner_settings_updated_at ON public.partner_settings;
CREATE TRIGGER partner_settings_updated_at
  BEFORE UPDATE ON public.partner_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. bonus_logs — расширение типов
-- ═══════════════════════════════════════════════════════════════════════════
-- Добавляем новые типы для партнёрского flow:
--   partner_pending  — комиссия начислена, в hold-периоде (30 дней) после оплаты клиентом
--   partner_approved — hold прошёл, добавлено в users.partner_balance
--   partner_paid     — выплата произведена (списание с partner_balance)
--   partner_cancelled — отмена клиента → откат комиссии
--
-- bonus_logs.type — TEXT без CHECK, миграция не нужна. Просто документируем здесь.
-- Существующие типы: welcome, referral, daily, review, level, admin_*, payment, spent.
