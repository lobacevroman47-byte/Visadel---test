-- ============================================================================
-- 042: Закрытие RLS UPDATE-дыр на applications + bookings (P0-1 finishing)
--
-- ПРОБЛЕМА:
-- Открытые UPDATE policies позволяли любому с anon-key менять ЛЮБУЮ строку:
--   applications_anon_update  (033)  USING(true) WITH CHECK(true)
--   update_hotel_bookings     (011)  USING(true) WITH CHECK(true)
--   update_flight_bookings    (011)  USING(true) WITH CHECK(true)
-- Атакующий мог: сменить чужой заявке status='cancelled', обнулить
-- bonuses_used, подделать confirmation_url брони, и т.д.
--
-- РЕШЕНИЕ:
-- PR создал admin-only endpoints с service_key + requireAdminUser:
--   /api/admin-update-application — status/visa_file_url/usd_rate/tax_pct/deleted_at
--   /api/admin-update-booking     — status/deleted_at/confirmation_url/commission
-- Вся админка мигрирована (useAdminData, Applications.tsx, Bookings.tsx).
-- Теперь anon UPDATE можно закрыть.
--
-- ⚠️ ПРИМЕНЯТЬ ТОЛЬКО ПОСЛЕ:
--   1. PR смержен в dev → Vercel передеплоил
--   2. Smoke-test админки: смена статуса заявки/брони, удаление,
--      загрузка confirmation_url, изменение usd_rate/tax — всё работает
--
-- Если применить РАНЬШЕ deploy — админка получит 42501 на любой UPDATE.
--
-- ============================================================================

-- applications: закрываем anon UPDATE (INSERT уже закрыт миграцией 040)
DROP POLICY IF EXISTS "applications_anon_update" ON public.applications;

-- bookings: закрываем anon UPDATE (INSERT закрыт миграцией 039)
DROP POLICY IF EXISTS "update_hotel_bookings" ON hotel_bookings;
DROP POLICY IF EXISTS "update_flight_bookings" ON flight_bookings;

-- SELECT policies НЕ трогаем — фронт читает заявки/брони через anon-key
-- с фильтром в коде. Закрытие SELECT (RLS-фильтр по telegram_id) —
-- отдельный PR (Sprint 4).

-- ============================================================================
-- Smoke-test после применения
-- ============================================================================
--
-- 1. UPDATE через anon-key — должен fail:
--    curl -X PATCH '<supabase>/rest/v1/applications?id=eq.<uuid>' \
--      -H "apikey: <ANON_KEY>" -d '{"status":"cancelled"}'
--    → 42501 RLS deny ✓
--    То же для hotel_bookings / flight_bookings.
--
-- 2. Админка: смена статуса заявки → /api/admin-update-application 200 ✓
-- 3. Админка: смена статуса брони → /api/admin-update-booking 200 ✓
--
-- ============================================================================
-- ROLLBACK
-- ============================================================================
--   CREATE POLICY "applications_anon_update" ON public.applications
--     FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY "update_hotel_bookings" ON hotel_bookings
--     FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY "update_flight_bookings" ON flight_bookings
--     FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
