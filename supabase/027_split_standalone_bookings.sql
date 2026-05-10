-- 027_split_standalone_bookings.sql
--
-- Архитектурное разделение: ДО этой миграции «Бронь отеля» / «Бронь
-- авиабилета» в Конструктор → Доп. услуги и Конструктор → Брони
-- использовали ОДНУ shared-сущность (`additional_services.id =
-- 'hotel-booking' / 'flight-booking'`). Это означало, что изменение
-- цены или полей в одном месте автоматически меняло их в другом.
--
-- Бизнес-логика РАЗНАЯ:
--   * Доп. услуги — это аддон ВНУТРИ визовой анкеты (Step2AdditionalDocs)
--   * Брони — это самостоятельный booking-flow в главном меню Mini App
--     (HotelBookingForm / FlightBookingForm)
--
-- Теперь обе системы — независимые сущности:
--   * `hotel-booking` / `flight-booking` — visa-addon (как было)
--   * `standalone-hotel-booking` / `standalone-flight-booking` — новые
--     записи для самостоятельных Броней
--
-- Соответственно в `app_settings`:
--   * hotel_extra_fields / hotel_core_overrides → visa-addon (как было)
--   * standalone_hotel_extra_fields / standalone_hotel_core_overrides → новые
--   * аналогично для flight

-- ── 1. Standalone booking entries в additional_services ──────────────────────
INSERT INTO public.additional_services (id, name, icon, description, price, cost_rub, partner_commission_pct, enabled, sort_order, countries)
VALUES
  ('standalone-hotel-booking',  'Бронь отеля',
   '🏨', 'Самостоятельная бронь отеля для путешествия',
   1000, 0, 15, true, 100, '{}'),
  ('standalone-flight-booking', 'Бронь авиабилета',
   '✈️', 'Самостоятельная бронь авиабилета',
   2000, 0, 10, true, 101, '{}')
ON CONFLICT (id) DO NOTHING;

-- ── 2. Independent settings keys для standalone bookings ─────────────────────
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS standalone_hotel_booking_price  INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS standalone_flight_booking_price INTEGER NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS standalone_hotel_extra_fields   JSONB   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS standalone_flight_extra_fields  JSONB   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS standalone_hotel_core_overrides JSONB   NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS standalone_flight_core_overrides JSONB  NOT NULL DEFAULT '{}'::jsonb;

-- ── 3. Seed standalone settings из текущих visa-addon settings (one-time) ────
-- Если админ уже настраивал visa-addon поля (hotel_extra_fields, и т.п.) —
-- скопируем их как стартовые значения для standalone, чтобы UX не сломался
-- при первом заходе. Дальше системы независимы.
UPDATE public.app_settings
SET
  standalone_hotel_extra_fields    = COALESCE(hotel_extra_fields, '[]'::jsonb),
  standalone_flight_extra_fields   = COALESCE(flight_extra_fields, '[]'::jsonb),
  standalone_hotel_core_overrides  = COALESCE(hotel_core_overrides, '{}'::jsonb),
  standalone_flight_core_overrides = COALESCE(flight_core_overrides, '{}'::jsonb),
  standalone_hotel_booking_price   = COALESCE(hotel_booking_price, 1000),
  standalone_flight_booking_price  = COALESCE(flight_booking_price, 2000)
WHERE id = 1;

COMMENT ON COLUMN public.app_settings.standalone_hotel_extra_fields IS
  'Доп. поля анкеты для САМОСТОЯТЕЛЬНОЙ Брони отеля (Брони в главном меню). Не путать с hotel_extra_fields — те для visa-аддона.';
COMMENT ON COLUMN public.app_settings.standalone_flight_extra_fields IS
  'Доп. поля анкеты для САМОСТОЯТЕЛЬНОЙ Брони авиабилета. Не путать с flight_extra_fields — те для visa-аддона.';
