-- ============================================================================
-- 034: Soft-delete для users.
--
-- КОНТЕКСТ:
-- Миграция 026 добавила deleted_at для applications, hotel_bookings,
-- flight_bookings, additional_services. Но users остался без soft-delete —
-- админка не могла удалить юзера (только обнулить бонусы / снять статус).
--
-- Эта миграция:
-- 1) добавляет users.deleted_at TIMESTAMPTZ NULL
-- 2) добавляет partial-index для быстрого фильтра активных юзеров
--
-- ПОВЕДЕНИЕ:
-- - SELECT в админке и кабинете фильтруют WHERE deleted_at IS NULL
-- - API endpoint admin-delete-user.js делает UPDATE deleted_at = now()
--   + каскадно UPDATE applications/hotel_bookings/flight_bookings.deleted_at
-- - Удалённые юзеры не видны в админке, их заявки не показываются в списках
--
-- ВОССТАНОВЛЕНИЕ (через Supabase SQL Editor):
--   -- Восстановить юзера:
--   UPDATE public.users SET deleted_at = NULL WHERE telegram_id = <id>;
--   -- Восстановить его заявки и брони:
--   UPDATE public.applications SET deleted_at = NULL
--     WHERE user_telegram_id = <id>;
--   UPDATE public.hotel_bookings SET deleted_at = NULL WHERE telegram_id = <id>;
--   UPDATE public.flight_bookings SET deleted_at = NULL WHERE telegram_id = <id>;
--
-- Аддитивная миграция — для существующих юзеров deleted_at = NULL, никто
-- не помечается удалённым автоматически.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_users_active
  ON public.users (created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.users.deleted_at IS
  'Soft-delete: NULL = активен, NOT NULL = удалён админом. Восстановить через '
  'UPDATE users SET deleted_at=NULL WHERE telegram_id=...; одновременно '
  'нужно восстановить applications/hotel_bookings/flight_bookings того же юзера.';
