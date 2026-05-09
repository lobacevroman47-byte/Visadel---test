-- 026_soft_delete.sql
--
-- Soft-delete для основных пользовательских таблиц. Раньше delete-иконки
-- в админке делали `DELETE FROM ...`, что сразу теряло данные. Теперь:
--   * новая колонка deleted_at TIMESTAMPTZ NULL
--   * запросы делают UPDATE deleted_at = now() вместо DELETE
--   * списки фильтруют WHERE deleted_at IS NULL
--
-- Восстановление руками: в Supabase SQL Editor:
--   UPDATE applications     SET deleted_at = NULL WHERE id = '<uuid>';
--   UPDATE hotel_bookings   SET deleted_at = NULL WHERE id = '<uuid>';
--   UPDATE flight_bookings  SET deleted_at = NULL WHERE id = '<uuid>';
--   UPDATE additional_services SET deleted_at = NULL WHERE id = '<id>';
--
-- Все колонки nullable + дефолт NULL — миграция безопасна для существующих
-- данных, ничего не помечается удалённым автоматически.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE public.hotel_bookings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE public.flight_bookings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE public.additional_services
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Индексы — фильтрация WHERE deleted_at IS NULL встречается в каждом
-- listing-запросе в админке и кабинете, partial-index ускоряет это.
CREATE INDEX IF NOT EXISTS idx_applications_active
  ON public.applications(created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hotel_bookings_active
  ON public.hotel_bookings(created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_flight_bookings_active
  ON public.flight_bookings(created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.applications.deleted_at IS
  'Soft-delete: NULL = активна, NOT NULL = удалена через админку. Восстановить через UPDATE deleted_at = NULL.';
COMMENT ON COLUMN public.hotel_bookings.deleted_at IS
  'Soft-delete: NULL = активна, NOT NULL = удалена через админку.';
COMMENT ON COLUMN public.flight_bookings.deleted_at IS
  'Soft-delete: NULL = активна, NOT NULL = удалена через админку.';
COMMENT ON COLUMN public.additional_services.deleted_at IS
  'Soft-delete: NULL = активна, NOT NULL = удалена через админку.';
