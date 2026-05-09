-- 024_bookings_updated_at.sql
--
-- Production-таблицы hotel_bookings и flight_bookings созданы без колонки
-- updated_at, хотя 001_initial_schema.sql её определяет. На update срабатывает
-- триггер обновления updated_at, не находит поле и падает с ошибкой:
--   record "new" has no field "updated_at"
--
-- Из-за этого админ не мог менять статус брони — UPDATE падал тихо.
--
-- Добавляем колонки идемпотентно (IF NOT EXISTS) — на инстансах где уже есть,
-- ничего не сломается.

ALTER TABLE public.hotel_bookings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.flight_bookings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.hotel_bookings.updated_at  IS 'Авто-обновляется триггером при UPDATE.';
COMMENT ON COLUMN public.flight_bookings.updated_at IS 'Авто-обновляется триггером при UPDATE.';
