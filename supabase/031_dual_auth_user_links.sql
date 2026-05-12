-- ============================================================================
-- 031: Dual-auth user links — связь applications/bookings/reviews/bonus_logs
--      с Supabase Auth (auth.users.id) для веб-юзеров без telegram_id.
--
-- КОНТЕКСТ:
-- Миграция 030 (users_dual_auth) добавила `users.auth_id UUID` и сделала
-- `users.telegram_id` nullable. Веб-юзеры регистрируются через email/пароль
-- (LoginScreen) → создают запись в users с auth_id, без telegram_id.
--
-- Но дочерние таблицы (applications, hotel_bookings, flight_bookings,
-- reviews, bonus_logs) до сих пор требовали telegram_id NOT NULL → веб-юзеры
-- не могли создавать заявки/брони/отзывы.
--
-- Эта миграция:
-- 1) делает telegram_id nullable на всех дочерних таблицах
-- 2) добавляет user_auth_id (UUID → auth.users(id) ON DELETE SET NULL)
-- 3) CHECK constraint: хотя бы один из двух identifier обязателен
-- 4) индексы на user_auth_id для быстрого SELECT
--
-- АДДИТИВНО, БЕЗОПАСНО:
-- - Существующие TG-юзеры продолжают работать как раньше (их строки имеют
--   telegram_id, auth_id = NULL — CHECK проходит)
-- - Веб-юзеры начинают работать (auth_id заполнен, telegram_id = NULL)
-- - FK ON DELETE SET NULL — при удалении auth.user строка не каскадится,
--   а auth_id зануляется (НО CHECK сломается если и telegram_id NULL — это
--   осознанное поведение: пользователь становится «осиротевшим» только если
--   оба identifier потеряны, что не должно происходить)
-- ============================================================================

-- ─── 1. applications ────────────────────────────────────────────────────────
ALTER TABLE public.applications
  ALTER COLUMN user_telegram_id DROP NOT NULL;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS user_auth_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.applications.user_auth_id IS
  'Auth user ID (для веб-юзеров через email/OAuth). NULL для TG-only заявок.';

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_telegram_or_auth_check;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_telegram_or_auth_check
    CHECK (user_telegram_id IS NOT NULL OR user_auth_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS applications_user_auth_id_idx
  ON public.applications (user_auth_id)
  WHERE user_auth_id IS NOT NULL;

-- ─── 2. hotel_bookings ──────────────────────────────────────────────────────
-- telegram_id уже nullable (миграция 007 не ставила NOT NULL)
ALTER TABLE public.hotel_bookings
  ADD COLUMN IF NOT EXISTS auth_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.hotel_bookings.auth_id IS
  'Auth user ID для веб-юзеров. NULL для TG-only броней.';

ALTER TABLE public.hotel_bookings
  DROP CONSTRAINT IF EXISTS hotel_bookings_telegram_or_auth_check;
ALTER TABLE public.hotel_bookings
  ADD CONSTRAINT hotel_bookings_telegram_or_auth_check
    CHECK (telegram_id IS NOT NULL OR auth_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS hotel_bookings_auth_id_idx
  ON public.hotel_bookings (auth_id)
  WHERE auth_id IS NOT NULL;

-- ─── 3. flight_bookings ─────────────────────────────────────────────────────
ALTER TABLE public.flight_bookings
  ADD COLUMN IF NOT EXISTS auth_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.flight_bookings.auth_id IS
  'Auth user ID для веб-юзеров. NULL для TG-only броней.';

ALTER TABLE public.flight_bookings
  DROP CONSTRAINT IF EXISTS flight_bookings_telegram_or_auth_check;
ALTER TABLE public.flight_bookings
  ADD CONSTRAINT flight_bookings_telegram_or_auth_check
    CHECK (telegram_id IS NOT NULL OR auth_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS flight_bookings_auth_id_idx
  ON public.flight_bookings (auth_id)
  WHERE auth_id IS NOT NULL;

-- ─── 4. reviews ─────────────────────────────────────────────────────────────
-- Сложнее: reviews.user_telegram_id REFERENCES users(telegram_id) с ON DELETE
-- CASCADE. Сделаем nullable и снимем NOT NULL. FK оставим — он по-прежнему
-- проверяет если значение не NULL.
ALTER TABLE public.reviews
  ALTER COLUMN user_telegram_id DROP NOT NULL;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS user_auth_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.reviews.user_auth_id IS
  'Auth user ID для веб-юзеров оставляющих отзывы. NULL для TG-юзеров.';

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_telegram_or_auth_check;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_telegram_or_auth_check
    CHECK (user_telegram_id IS NOT NULL OR user_auth_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS reviews_user_auth_id_idx
  ON public.reviews (user_auth_id)
  WHERE user_auth_id IS NOT NULL;

-- ─── 5. bonus_logs ──────────────────────────────────────────────────────────
ALTER TABLE public.bonus_logs
  ALTER COLUMN telegram_id DROP NOT NULL;

ALTER TABLE public.bonus_logs
  ADD COLUMN IF NOT EXISTS auth_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bonus_logs.auth_id IS
  'Auth user ID для бонусных логов веб-юзеров. NULL для TG-only.';

ALTER TABLE public.bonus_logs
  DROP CONSTRAINT IF EXISTS bonus_logs_telegram_or_auth_check;
ALTER TABLE public.bonus_logs
  ADD CONSTRAINT bonus_logs_telegram_or_auth_check
    CHECK (telegram_id IS NOT NULL OR auth_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS bonus_logs_auth_id_idx
  ON public.bonus_logs (auth_id)
  WHERE auth_id IS NOT NULL;

-- ─── 6. tasks ───────────────────────────────────────────────────────────────
-- Tasks — внутренние задачи (напр. админ создал task для юзера). FK на users.
-- Веб-юзерам tasks пока не нужны, но делаем nullable на всякий случай.
ALTER TABLE public.tasks
  ALTER COLUMN user_telegram_id DROP NOT NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS user_auth_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_telegram_or_auth_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_telegram_or_auth_check
    CHECK (user_telegram_id IS NOT NULL OR user_auth_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS tasks_user_auth_id_idx
  ON public.tasks (user_auth_id)
  WHERE user_auth_id IS NOT NULL;

-- ─── ГОТОВО ─────────────────────────────────────────────────────────────────
-- Backend (saveApplication/saveHotelBooking/saveFlightBooking/getUserApplications)
-- должны быть обновлены чтобы передавать user_auth_id для веб-юзеров и/или
-- искать по обоим ID при чтении. См. PR feat/dual-auth-day1.
