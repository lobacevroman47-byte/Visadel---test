-- ============================================
-- VISADEL AGENCY — Supabase Schema
-- Запустить в: Supabase Dashboard → SQL Editor
-- ============================================

-- Таблица пользователей (идентифицируются по Telegram ID)
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id     BIGINT UNIQUE NOT NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT,
  username        TEXT,
  photo_url       TEXT,
  phone           TEXT,
  email           TEXT,
  bonus_balance   INTEGER DEFAULT 0 NOT NULL,
  is_influencer   BOOLEAN DEFAULT false NOT NULL,
  referral_code   TEXT UNIQUE NOT NULL,
  referred_by     TEXT,
  last_bonus_date DATE,
  bonus_streak    INTEGER DEFAULT 0 NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Таблица заявок на визы
CREATE TABLE IF NOT EXISTS public.applications (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_telegram_id    BIGINT NOT NULL,
  country             TEXT NOT NULL,
  visa_type           TEXT NOT NULL,
  visa_id             TEXT NOT NULL,
  price               INTEGER NOT NULL,
  urgent              BOOLEAN DEFAULT false NOT NULL,
  status              TEXT DEFAULT 'draft' NOT NULL
                        CHECK (status IN ('draft','pending_payment','pending_confirmation','in_progress','ready')),
  form_data           JSONB DEFAULT '{}'::JSONB NOT NULL,
  payment_proof_url   TEXT,
  visa_file_url       TEXT,
  bonuses_used        INTEGER DEFAULT 0 NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Таблица заданий (подписки, лайки, etc.)
CREATE TABLE IF NOT EXISTS public.tasks (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_telegram_id  BIGINT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  task_type         TEXT NOT NULL,
  title             TEXT NOT NULL,
  reward            INTEGER NOT NULL,
  status            TEXT DEFAULT 'pending' NOT NULL
                      CHECK (status IN ('pending','submitted','approved','rejected')),
  proof_url         TEXT,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Таблица отзывов
CREATE TABLE IF NOT EXISTS public.reviews (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_telegram_id  BIGINT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  application_id    UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  country           TEXT NOT NULL,
  rating            INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text              TEXT NOT NULL,
  status            TEXT DEFAULT 'pending' NOT NULL
                      CHECK (status IN ('pending','approved','rejected')),
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Индексы для быстрых запросов
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_applications_user ON public.applications(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.tasks(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);

-- Автообновление updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS (Row Level Security) — каждый видит только свои данные
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Политики для anon (фронтенд работает через anon key)
-- Пользователи: вставка и чтение своей строки
CREATE POLICY "users_insert" ON public.users
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "users_select" ON public.users
  FOR SELECT TO anon USING (true);

CREATE POLICY "users_update" ON public.users
  FOR UPDATE TO anon USING (true);

-- Заявки
CREATE POLICY "applications_insert" ON public.applications
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "applications_select" ON public.applications
  FOR SELECT TO anon USING (true);

CREATE POLICY "applications_update" ON public.applications
  FOR UPDATE TO anon USING (true);

-- Задания
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT TO anon USING (true);

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE TO anon USING (true);

-- Отзывы
CREATE POLICY "reviews_insert" ON public.reviews
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "reviews_select" ON public.reviews
  FOR SELECT TO anon USING (true);

-- Storage bucket для файлов (чеки оплаты, фото, визы)
INSERT INTO storage.buckets (id, name, public)
VALUES ('visadel-files', 'visadel-files', false)
ON CONFLICT (id) DO NOTHING;

-- Политика storage: anon может загружать и читать
CREATE POLICY "storage_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'visadel-files');

CREATE POLICY "storage_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'visadel-files');
