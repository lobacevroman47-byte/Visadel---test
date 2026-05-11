-- 030_users_dual_auth.sql
--
-- Dual-auth support: юзер может быть Telegram-юзером (зашёл через mini-app)
-- ИЛИ email/OAuth-юзером (зашёл через сайт visadel-test.vercel.app в браузере).
--
-- Раньше users.telegram_id был NOT NULL и UNIQUE — единственная точка входа.
-- Теперь:
--   • telegram_id          — стал NULLABLE (юзеры с сайта не имеют TG)
--   • auth_id              — UUID связь с auth.users (Supabase Auth) для веб-юзеров
--   • signup_source        — откуда юзер пришёл (telegram | email | google | ...)
--   • CHECK telegram_or_auth — хотя бы один из них должен быть заполнен
--
-- Связка email→telegram-юзеры пока НЕ делается автоматически. Если человек
-- зарегистрировался в боте, а потом в браузере через email — это будут две
-- отдельные записи в users. Связка добавляется позже в профиле «привязать
-- Telegram».
--
-- ⚠️ Только для test-окружения. На prod (когда будет отдельный Supabase)
-- миграция применяется аналогично.

BEGIN;

-- ─── 1. Сделать telegram_id nullable ────────────────────────────────────────
-- Старая схема: telegram_id BIGINT UNIQUE NOT NULL.
-- Снимаем NOT NULL; UNIQUE-ограничение оставляем (но Postgres разрешает
-- множественные NULL в UNIQUE-индексе, поэтому веб-юзеры с telegram_id=NULL
-- между собой не конфликтуют).
ALTER TABLE public.users
  ALTER COLUMN telegram_id DROP NOT NULL;

-- ─── 2. Колонка auth_id (связь с Supabase Auth) ─────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.users.auth_id IS
  'Supabase Auth user ID. Связь с auth.users (для веб-юзеров через email/OAuth). NULL для чистых telegram-юзеров.';

-- ─── 3. Колонка signup_source ───────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signup_source TEXT
    DEFAULT 'telegram' NOT NULL
    CHECK (signup_source IN ('telegram', 'email', 'google', 'vk', 'yandex', 'apple', 'phone'));

COMMENT ON COLUMN public.users.signup_source IS
  'Откуда юзер впервые зарегистрировался. Для аналитики и UX (показывать ему опции связки).';

-- ─── 4. CHECK: хотя бы один identifier должен быть ──────────────────────────
-- Юзер не может быть «бесхозным» — либо TG, либо Auth.
ALTER TABLE public.users
  ADD CONSTRAINT users_telegram_or_auth_check
    CHECK (telegram_id IS NOT NULL OR auth_id IS NOT NULL);

-- ─── 5. Индекс для быстрого lookup по auth_id ───────────────────────────────
CREATE INDEX IF NOT EXISTS users_auth_id_idx
  ON public.users (auth_id)
  WHERE auth_id IS NOT NULL;

-- ─── 6. Триггер: автоматически проставлять signup_source ────────────────────
-- При INSERT — если telegram_id есть и auth_id NULL → source='telegram'.
-- Если auth_id есть и telegram_id NULL → source='email' (default; можно
-- перезаписать в коде явно при OAuth).
CREATE OR REPLACE FUNCTION public.users_set_signup_source()
RETURNS trigger AS $$
BEGIN
  -- Только при INSERT, и только если source явно не задан клиентом
  IF TG_OP = 'INSERT' AND (NEW.signup_source IS NULL OR NEW.signup_source = 'telegram') THEN
    IF NEW.telegram_id IS NOT NULL AND NEW.auth_id IS NULL THEN
      NEW.signup_source := 'telegram';
    ELSIF NEW.auth_id IS NOT NULL AND NEW.telegram_id IS NULL THEN
      -- По умолчанию 'email'; код может явно поставить 'google' и т.д.
      IF NEW.signup_source IS NULL THEN
        NEW.signup_source := 'email';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_signup_source_trigger ON public.users;
CREATE TRIGGER users_set_signup_source_trigger
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.users_set_signup_source();

COMMIT;

-- ─── ROLLBACK INSTRUCTIONS (если что-то сломалось) ──────────────────────────
-- BEGIN;
--   DROP TRIGGER IF EXISTS users_set_signup_source_trigger ON public.users;
--   DROP FUNCTION IF EXISTS public.users_set_signup_source();
--   DROP INDEX IF EXISTS public.users_auth_id_idx;
--   ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_telegram_or_auth_check;
--   ALTER TABLE public.users DROP COLUMN IF EXISTS signup_source;
--   ALTER TABLE public.users DROP COLUMN IF EXISTS auth_id;
--   ALTER TABLE public.users ALTER COLUMN telegram_id SET NOT NULL;
-- COMMIT;
