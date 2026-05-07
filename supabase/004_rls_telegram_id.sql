-- ============================================================================
-- RLS rewrite — закрытие открытых политик anon на чувствительные таблицы.
--
-- ⚠️ ПЕРЕД ЗАПУСКОМ:
--   1) Все API endpoints должны быть с initData verification
--      (api/_lib/telegram-auth.js + apiFetch на фронте) — это уже сделано.
--   2) Бэкенд должен ходить за чувствительными таблицами через service key
--      (а не anon ключ). Тоже сделано — все API через SUPABASE_SERVICE_KEY.
--   3) Фронт продолжит использовать anon для PUBLIC-каталогов:
--      visa_products, additional_services, app_settings (read-only).
--      Все мутации (insert/update/delete) к чувствительным — через API.
--
-- Если что-то поломается — откатить можно, восстановив open-policies из
-- старого schema.sql.
-- ============================================================================

-- ── Helper: достаём telegram_id из JWT-claim app.tg_id ──────────────────────
-- API после verifyInitData() будет дёргать Supabase service-key с
-- request.jwt.claim.tg_id; в anon-контексте функция вернёт NULL.
CREATE OR REPLACE FUNCTION public.current_tg_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.tg_id', true), '')::bigint
$$;

-- ── Включаем RLS на всех чувствительных таблицах ────────────────────────────
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_dedup  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_clicks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_bookings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users         ENABLE ROW LEVEL SECURITY;

-- Включаем RLS на public-каталогах тоже, но даём только SELECT для anon.
ALTER TABLE public.visa_products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visa_form_fields          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visa_photo_requirements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.additional_services       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings              ENABLE ROW LEVEL SECURITY;

-- ── Снимаем legacy открытые политики ───────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'users','applications','tasks','reviews','bonus_logs',
        'notification_dedup','referral_clicks','reminders',
        'hotel_bookings','flight_bookings','status_log','admin_users',
        'visa_products','visa_form_fields','visa_photo_requirements',
        'additional_services','app_settings'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END$$;

-- ── Public read для каталогов (visa_products, additional_services, settings,
--    конструктор анкет) — ничего секретного, всем нужно для отображения.
CREATE POLICY "public_read" ON public.visa_products             FOR SELECT TO anon USING (true);
CREATE POLICY "public_read" ON public.visa_form_fields          FOR SELECT TO anon USING (true);
CREATE POLICY "public_read" ON public.visa_photo_requirements   FOR SELECT TO anon USING (true);
CREATE POLICY "public_read" ON public.additional_services       FOR SELECT TO anon USING (true);
CREATE POLICY "public_read" ON public.app_settings              FOR SELECT TO anon USING (true);

-- ── Чувствительные таблицы: anon ничего не может, всё через service key ────
-- Для anon политик не создаём — RLS включён, нет политик ⇒ доступ запрещён.
-- service_role bypassит RLS автоматически.
--
-- ВАЖНО: этим закрывается прямой доступ с фронта через anon-key к users,
-- applications, hotel_bookings и т.д. Все вызовы supabase.from('users')...
-- из клиентского кода должны быть переведены на API endpoints. До тех пор
-- пока фронт использует anon-key — он будет получать пустые ответы / RLS
-- ошибки.
--
-- ПОЭТАПНЫЙ ВЫКАТ:
-- 1) Сначала задеплоить эту миграцию на STAGING, проверить какие места
--    падают, перевести их на API endpoints.
-- 2) Только после этого — на PRODUCTION.

-- Минимальные политики для случаев когда хочется сохранить self-service
-- (юзер читает свои заявки напрямую с фронта, без раунд-трипа через API).
-- Эти политики работают только если фронт прокидывает JWT с claim tg_id.
CREATE POLICY "self_select" ON public.users
  FOR SELECT TO authenticated USING (telegram_id = public.current_tg_id());

CREATE POLICY "self_select" ON public.applications
  FOR SELECT TO authenticated USING (user_telegram_id = public.current_tg_id());

CREATE POLICY "self_select" ON public.hotel_bookings
  FOR SELECT TO authenticated USING (telegram_id = public.current_tg_id());

CREATE POLICY "self_select" ON public.flight_bookings
  FOR SELECT TO authenticated USING (telegram_id = public.current_tg_id());

CREATE POLICY "self_select" ON public.bonus_logs
  FOR SELECT TO authenticated USING (telegram_id = public.current_tg_id());

CREATE POLICY "self_select" ON public.tasks
  FOR SELECT TO authenticated USING (user_telegram_id = public.current_tg_id());

CREATE POLICY "self_select" ON public.reviews
  FOR SELECT TO authenticated USING (user_telegram_id = public.current_tg_id());
