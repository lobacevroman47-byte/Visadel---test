-- 021_partner_settings_full_payout.sql
--
-- Расширение partner_settings под полные реквизиты для выплаты.
-- Раньше хранили только card_number_last4 (4 цифры) — этого мало:
--   • для самозанятых нужен полный номер карты или телефон СБП
--   • для ИП нужен расчётный счёт + БИК
--   • для юрлица — название + ИНН + КПП + р/с + БИК
--
-- Также убираем 'individual' из CHECK: партнёр-физлицо без статуса делает
-- основателя налоговым агентом (НДФЛ 13% + соцвзносы по 226 НК РФ),
-- что для самозанятого founder'а технически и юридически проблемно.
-- Допускаем только: 'self_employed' | 'ip' | 'legal'.

-- ═══ 1. Новые колонки ═══════════════════════════════════════════════════════
ALTER TABLE public.partner_settings
  ADD COLUMN IF NOT EXISTS card_number       TEXT,  -- полный номер карты (16-19 цифр)
  ADD COLUMN IF NOT EXISTS phone_for_sbp     TEXT,  -- телефон для СБП (+7XXXXXXXXXX)
  ADD COLUMN IF NOT EXISTS bank_account      TEXT,  -- расчётный счёт (20 цифр) — для ИП/юрлица
  ADD COLUMN IF NOT EXISTS bank_bic          TEXT,  -- БИК банка (9 цифр) — для ИП/юрлица
  ADD COLUMN IF NOT EXISTS organization_name TEXT,  -- название организации — для юрлица
  ADD COLUMN IF NOT EXISTS kpp               TEXT;  -- КПП (9 цифр) — для юрлица

-- ═══ 2. Обновить CHECK по entity_type ═══════════════════════════════════════
-- Drop+add потому что ALTER CONSTRAINT в Postgres не поддерживает прямую модификацию
ALTER TABLE public.partner_settings
  DROP CONSTRAINT IF EXISTS partner_settings_entity_type_check;

ALTER TABLE public.partner_settings
  ADD CONSTRAINT partner_settings_entity_type_check
  CHECK (entity_type IS NULL OR entity_type IN ('self_employed', 'ip', 'legal'));

-- ═══ 3. Migrate existing 'individual' → NULL ════════════════════════════════
-- Старых записей пока нет в проде, но на всякий случай — чтобы CHECK не упал
UPDATE public.partner_settings
   SET entity_type = NULL
 WHERE entity_type = 'individual';

COMMENT ON COLUMN public.partner_settings.card_number       IS 'Полный номер карты (для перевода card-to-card). Маскируем в UI кроме last4.';
COMMENT ON COLUMN public.partner_settings.phone_for_sbp     IS 'Телефон для СБП (+7XXXXXXXXXX). Альтернатива карте.';
COMMENT ON COLUMN public.partner_settings.bank_account      IS 'Расчётный счёт (20 цифр). Для ИП/юрлица.';
COMMENT ON COLUMN public.partner_settings.bank_bic          IS 'БИК банка (9 цифр). Для ИП/юрлица.';
COMMENT ON COLUMN public.partner_settings.organization_name IS 'Название организации. Для юрлица.';
COMMENT ON COLUMN public.partner_settings.kpp               IS 'КПП (9 цифр). Для юрлица.';
