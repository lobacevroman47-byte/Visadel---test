-- 025_booking_status_log.sql
--
-- История изменений статусов броней — зеркало status_log для виз. Ведётся
-- админкой (admin/Bookings.tsx) при каждом updateStatus. Показывается в
-- модалке брони как timeline «09.05.26 22:08 · Ожидает подтверждения → В работе
-- · Администратор @pirat».
--
-- Полиморфная связь: entity_type ('hotel_booking' | 'flight_booking') + entity_id.
-- Не используем applications.status_log по семантике — там FK на applications.id,
-- а у нас другие таблицы.

CREATE TABLE IF NOT EXISTS public.booking_status_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type        TEXT NOT NULL CHECK (entity_type IN ('hotel_booking', 'flight_booking')),
  entity_id          UUID NOT NULL,
  from_status        TEXT,
  to_status          TEXT NOT NULL,
  changed_by_id      BIGINT,           -- telegram_id админа
  changed_by_name    TEXT,             -- snapshot имени админа на момент изменения
  changed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_status_log_entity
  ON public.booking_status_log(entity_type, entity_id, changed_at DESC);

GRANT SELECT, INSERT ON public.booking_status_log TO anon, authenticated;

ALTER TABLE public.booking_status_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_full_booking_status_log ON public.booking_status_log;
CREATE POLICY anon_full_booking_status_log ON public.booking_status_log
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.booking_status_log IS
  'История изменений статусов hotel_bookings и flight_bookings (для админ-таймлайна).';
