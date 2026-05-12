-- ============================================================================
-- 032: Storage RLS для веб-юзеров — разрешить путь auth_<uuid>/...
--
-- КОНТЕКСТ:
-- Миграция 003 разрешает Storage path только если первый сегмент это:
--   - 'shared' (литерал)
--   - число (telegram_id)
-- Веб-юзеры не имеют telegram_id, нужен альтернативный префикс.
--
-- Новая схема:
--   - 'shared' — общие файлы (без авторизации)
--   - <telegram_id> — для TG-юзеров (как раньше)
--   - 'auth_<auth_id>' — для веб-юзеров (новое; префикс 'auth_' для ясности
--     при разборе в админке + чтобы не пересекался с числами/shared)
--
-- ВНИМАНИЕ:
-- - Backend (Storage upload path) должен формировать правильный префикс
--   в зависимости от типа юзера. См. src/app/lib/db.ts (uploadFile).
-- - SELECT остаётся публичным (через getPublicUrl) — это как было в 003.
-- ============================================================================

-- Дропаем INSERT-политику из 003 и пересоздаём с расширенной регулярной.
DROP POLICY IF EXISTS "visadel_files_insert" ON storage.objects;

CREATE POLICY "visadel_files_insert" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (
    bucket_id = 'visadel-files'
    AND (
      split_part(name, '/', 1) = 'shared'
      OR split_part(name, '/', 1) ~ '^[0-9]+$'                            -- telegram_id
      OR split_part(name, '/', 1) ~ '^auth_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'  -- auth_<uuid>
    )
  );

-- SELECT не трогаем — он публичный (через getPublicUrl).
-- UPDATE/DELETE остаются service_role only.
