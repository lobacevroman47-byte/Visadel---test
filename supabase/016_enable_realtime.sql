-- 016_enable_realtime.sql
--
-- Включает Postgres logical replication для таблиц, на которые
-- подписан admin Dashboard и user-side ApplicationsTab.
-- Без этого supabase.channel(...).on('postgres_changes', ...) — silent no-op.
--
-- Идемпотентно: ADD TABLE упадёт с "already member of publication", если
-- таблица уже добавлена руками через Supabase Dashboard. Оборачиваем в
-- DO-блок чтобы повторный запуск не падал.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'additional_services',
    'app_settings',
    'visa_products',
    'applications',
    'flight_bookings',
    'hotel_bookings'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION
      WHEN duplicate_object THEN
        -- таблица уже в публикации — пропускаем
        NULL;
    END;
  END LOOP;
END $$;
