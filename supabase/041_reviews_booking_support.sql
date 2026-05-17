-- ============================================================================
-- 041: Поддержка отзывов на брони (hotel_bookings / flight_bookings)
--
-- ПРОБЛЕМА:
-- Таблица reviews (миграция 001) была спроектирована только под визовые
-- заявки:
--   application_id UUID NOT NULL REFERENCES applications(id)
-- — UUID-тип + NOT NULL + FK. Отзыв на бронь физически невозможен:
--   1. Фронт передаёт application_id как 'hotel_<uuid>' / 'flight_<uuid>'
--      — не валидный UUID → Postgres: invalid input syntax for type uuid
--   2. Даже валидный UUID брони не пройдёт FK (брони не в applications)
-- В итоге кнопка «Оставить отзыв» на бронях всегда давала ошибку.
--
-- РЕШЕНИЕ:
-- Делаем reviews универсальной — отзыв либо на заявку, либо на бронь:
--   application_id — становится NULLABLE (FK остаётся для заявок)
--   + booking_id   UUID — id брони (без FK: бронь может быть в hotel_bookings
--                          ИЛИ flight_bookings, один FK не покрывает обе)
--   + booking_type TEXT — 'hotel' | 'flight'
--   CHECK: ровно ОДИН источник заполнен (заявка XOR бронь)
--
-- Идемпотентно. Безопасно для существующих строк (все они — заявки,
-- application_id заполнен, booking_id NULL — проходят CHECK).
--
-- ============================================================================

-- 1. application_id → nullable (FK и тип сохраняются)
ALTER TABLE public.reviews
  ALTER COLUMN application_id DROP NOT NULL;

-- 2. Новые колонки для брони
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS booking_id   UUID,
  ADD COLUMN IF NOT EXISTS booking_type TEXT;

-- 3. CHECK booking_type — только валидные значения (или NULL)
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_booking_type_check;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_booking_type_check
  CHECK (booking_type IS NULL OR booking_type IN ('hotel', 'flight'));

-- 4. CHECK «ровно один источник» — отзыв либо на заявку, либо на бронь.
--    application_id XOR (booking_id + booking_type).
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_target_xor_check;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_target_xor_check
  CHECK (
    (application_id IS NOT NULL AND booking_id IS NULL AND booking_type IS NULL)
    OR
    (application_id IS NULL AND booking_id IS NOT NULL AND booking_type IS NOT NULL)
  );

-- 5. Индекс для выборки отзывов по брони (нужен getReviewedAppIds для броней)
CREATE INDEX IF NOT EXISTS idx_reviews_booking
  ON public.reviews(booking_id) WHERE booking_id IS NOT NULL;

-- ============================================================================
-- Smoke-test после применения
-- ============================================================================
--
-- 1. Отзыв на заявку (как раньше) — должен пройти:
--    INSERT INTO reviews (user_telegram_id, application_id, country, rating, text)
--    VALUES (<tg>, '<app-uuid>', 'Таиланд', 5, 'отлично');
--
-- 2. Отзыв на бронь — теперь проходит:
--    INSERT INTO reviews (user_telegram_id, booking_id, booking_type, country, rating, text)
--    VALUES (<tg>, '<booking-uuid>', 'hotel', 'Бронь отеля', 5, 'супер');
--
-- 3. Невалидно — оба источника сразу (должен fail на CHECK):
--    INSERT INTO reviews (user_telegram_id, application_id, booking_id, booking_type, ...)
--    VALUES (<tg>, '<app>', '<booking>', 'hotel', ...);
--    → ошибка reviews_target_xor_check ✓
--
-- ============================================================================
-- ROLLBACK
-- ============================================================================
--   ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_target_xor_check;
--   ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_booking_type_check;
--   ALTER TABLE public.reviews DROP COLUMN IF EXISTS booking_type;
--   ALTER TABLE public.reviews DROP COLUMN IF EXISTS booking_id;
--   -- application_id NOT NULL вернуть нельзя если уже есть booking-отзывы
--   -- (сначала удалить строки с application_id IS NULL).
