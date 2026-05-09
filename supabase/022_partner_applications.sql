-- 022_partner_applications.sql
--
-- Таблица заявок на партнёрство. Юзер заполняет форму (PartnerApplicationForm)
-- → INSERT в эту таблицу → notify-admin отправляет в Telegram-бот всем admin'ам
-- и founder'ам → admin в админке открывает Заявки → Approve/Reject.
--
-- При approve: status='approved' + UPDATE users SET is_influencer=true (тогда
-- юзер попадёт в Партнёрский кабинет с его hold-периодом и реквизитами).

CREATE TABLE IF NOT EXISTS public.partner_applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id           BIGINT,           -- nullable: иногда forms идут до upsertUser
  full_name             TEXT NOT NULL,
  telegram_username     TEXT NOT NULL,    -- без префикса @
  email                 TEXT NOT NULL,
  phone                 TEXT,
  platform_url          TEXT NOT NULL,
  audience_theme        TEXT,
  subscribers_count     INTEGER,
  comment               TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by_admin_id  BIGINT,
  reject_reason         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_applications_status
  ON public.partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_telegram_id
  ON public.partner_applications(telegram_id);
CREATE INDEX IF NOT EXISTS idx_partner_applications_created_at
  ON public.partner_applications(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.partner_applications TO anon, authenticated;

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

-- Anon-policy: открытый доступ. Безопасность — на уровне UI/админка-гейта
-- (admin actions требуют ?admin=true и whitelisted telegram_id).
DROP POLICY IF EXISTS anon_full_partner_applications ON public.partner_applications;
CREATE POLICY anon_full_partner_applications ON public.partner_applications
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.partner_applications IS
  'Заявки на партнёрство. Создаются юзером через форму, обрабатываются админом.';
