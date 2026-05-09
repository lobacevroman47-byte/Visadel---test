-- 019_partner_vanity_code.sql
--
-- Vanity-код партнёра — кастомный короткий ID который партнёр настраивает
-- сам в кабинете. Альтернатива системному referral_code (VIS<base36_id>).
--
-- Пример:
--   referral_code = "VIS2ARRX2"  → ссылка t.me/.../app?startapp=VIS2ARRX2
--   vanity_code   = "ANYA"       → ссылка t.me/.../app?startapp=ANYA
--
-- Логика:
-- • Может быть NULL (тогда партнёр использует system referral_code)
-- • UNIQUE (нельзя двум партнёрам один код)
-- • Только латиница A-Z + цифры + _- (валидация на frontend)
-- • Хранится UPPERCASE для case-insensitive lookup
--
-- При входе по реф-ссылке: сначала ищем по referral_code (быстрый путь),
-- если не нашли — по vanity_code. В users.referred_by записываем КАНОНИЧЕСКИЙ
-- referral_code партнёра — vanity это alias.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS vanity_code TEXT;

-- UNIQUE constraint (отдельной строкой чтобы не упасть если уже создан)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_vanity_code_unique'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_vanity_code_unique UNIQUE (vanity_code);
  END IF;
END $$;

-- Index для быстрого lookup при deeplink (case-sensitive — храним UPPERCASE)
CREATE INDEX IF NOT EXISTS idx_users_vanity_code
  ON public.users(vanity_code) WHERE vanity_code IS NOT NULL;

COMMENT ON COLUMN public.users.vanity_code IS
  'Кастомный реф-код партнёра, alias для referral_code. UNIQUE, NULL разрешён, UPPERCASE.';
