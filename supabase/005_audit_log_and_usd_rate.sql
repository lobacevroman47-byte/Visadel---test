-- 1) Audit log — кто из админов что менял когда
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_tg_id     BIGINT NOT NULL,
  admin_name      TEXT,
  action          TEXT NOT NULL,           -- e.g. 'application.status_change', 'service.update', 'service.delete'
  target_type     TEXT,                    -- 'application' | 'visa_product' | 'additional_service' | ...
  target_id       TEXT,                    -- внешний ID цели
  details         JSONB DEFAULT '{}'::JSONB NOT NULL,  -- произвольные поля: from→to, diffs, причина и т.д.
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_admin     ON public.admin_audit_log(admin_tg_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_target    ON public.admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON public.admin_audit_log(created_at DESC);

GRANT SELECT, INSERT ON public.admin_audit_log TO anon, authenticated;

-- 2) USD rate snapshot для cron'а (api/update-usd-rate.js)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS usd_rate_rub          NUMERIC,
  ADD COLUMN IF NOT EXISTS usd_rate_updated_at   TIMESTAMPTZ;
