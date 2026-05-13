-- ============================================================================
-- 033: Восстановление anon INSERT/SELECT/UPDATE политик для applications
--      и reviews (которые были удалены в миграции 004, но не пересозданы).
--
-- ПРОБЛЕМА:
-- Миграция 004 (rls_telegram_id.sql) сделала DROP всех легаси политик
-- (включая applications_insert, applications_select, applications_update,
-- reviews_insert/select/update, tasks_insert/select/update) и создала
-- только новые `self_select` политики через current_tg_id().
-- Никаких INSERT/UPDATE политик для anon после этого нет.
--
-- Это блокирует ВСЕХ юзеров (TG и веб) при saveApplication через anon-key:
--   PostgreSQL error 42501: new row violates row-level security policy
--
-- ПРАВИЛЬНОЕ ДОЛГОСРОЧНОЕ РЕШЕНИЕ (P0 из аудита):
-- Перевести фронт-INSERT на API endpoints с service_key (как hotel_bookings
-- работает через `anon_insert_hotel_bookings` policy + planned API rewrite).
-- Это закрывает RLS-дыру окончательно.
--
-- ТЕКУЩЕЕ РЕШЕНИЕ (этот файл):
-- Возвращаем открытую `anon_insert` политику чтобы фронт мог сохранять
-- заявки. Это та же модель что для hotel_bookings/flight_bookings (миграции
-- 007/008 — `anon_insert_hotel_bookings`/`anon_insert_flight_bookings`).
-- ============================================================================

-- ─── applications ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "applications_anon_insert" ON public.applications;
CREATE POLICY "applications_anon_insert" ON public.applications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "applications_anon_update" ON public.applications;
CREATE POLICY "applications_anon_update" ON public.applications
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- SELECT: оставляем `self_select` из миграции 004 (фильтр по current_tg_id).
-- Если нужен broader SELECT (например для админки) — она через service_key.
-- Для веб-юзеров SELECT работает через `getUserApplications` который сейчас
-- идёт через anon-key — нужна отдельная политика. Откроем SELECT тоже:
DROP POLICY IF EXISTS "applications_anon_select" ON public.applications;
CREATE POLICY "applications_anon_select" ON public.applications
  FOR SELECT TO anon, authenticated USING (true);

-- ─── reviews ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reviews_anon_insert" ON public.reviews;
CREATE POLICY "reviews_anon_insert" ON public.reviews
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "reviews_anon_select" ON public.reviews;
CREATE POLICY "reviews_anon_select" ON public.reviews
  FOR SELECT TO anon, authenticated USING (true);

-- ─── tasks ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks_anon_insert" ON public.tasks;
CREATE POLICY "tasks_anon_insert" ON public.tasks
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "tasks_anon_select" ON public.tasks;
CREATE POLICY "tasks_anon_select" ON public.tasks
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "tasks_anon_update" ON public.tasks;
CREATE POLICY "tasks_anon_update" ON public.tasks
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ─── users (для web-user-upsert через API + frontend) ─────────────────────
-- users.SELECT/UPDATE/INSERT через API endpoints (service_key) уже работает.
-- Но фронт иногда читает users напрямую (через anon-key) для bonus balance.
-- Добавим SELECT для anon — UPDATE/INSERT остаются service_key only.
DROP POLICY IF EXISTS "users_anon_select" ON public.users;
CREATE POLICY "users_anon_select" ON public.users
  FOR SELECT TO anon, authenticated USING (true);
