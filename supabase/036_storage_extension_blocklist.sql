-- ============================================================================
-- 036: Storage hardening — extension blocklist + path traversal защита
--
-- Bucket `visadel-files` сейчас принимает любой контент с правильным
-- `<owner>/` префиксом. Атакующий с anon-key может загрузить `.html`/`.svg`
-- с XSS payload или `.exe`. Хотя bucket отдаётся с *.supabase.co (cross-origin
-- для visadel.agency), прямые ссылки на malicious .html всё равно работают.
--
-- Эта миграция:
--   1. Ужесточает INSERT policy на storage.objects (запрет dangerous ext)
--   2. Запрещает path-traversal в имени файла
--   3. Документирует TODO для server-side прокси (Sprint 4)
--
-- ⚠️ Запустить в Supabase SQL editor. Идемпотентна (DROP IF EXISTS).
--
-- ============================================================================

-- Пересоздаём INSERT policy с дополнительными чеками.
DROP POLICY IF EXISTS "visadel_files_insert" ON storage.objects;
CREATE POLICY "visadel_files_insert" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (
    bucket_id = 'visadel-files'
    -- Path-prefix: либо telegram_id (digits), либо auth_<uuid>, либо shared.
    AND (
      split_part(name, '/', 1) = 'shared'
      OR split_part(name, '/', 1) ~ '^[0-9]+$'
      OR split_part(name, '/', 1) ~ '^auth_[a-f0-9-]+$'
    )
    -- Запрет path-traversal: никаких '..' и обратных слешей.
    AND name NOT LIKE '%..%'
    AND name NOT LIKE '%\\%'
    AND name NOT LIKE '%%2e%2e%' -- URL-encoded ..
    -- Запрет dangerous расширений. Список покрывает основные XSS/RCE векторы.
    -- Используем ILIKE для case-insensitive (.HTML тоже блок).
    AND lower(name) NOT LIKE '%.html'
    AND lower(name) NOT LIKE '%.htm'
    AND lower(name) NOT LIKE '%.xhtml'
    AND lower(name) NOT LIKE '%.svg'
    AND lower(name) NOT LIKE '%.js'
    AND lower(name) NOT LIKE '%.mjs'
    AND lower(name) NOT LIKE '%.exe'
    AND lower(name) NOT LIKE '%.bat'
    AND lower(name) NOT LIKE '%.sh'
    AND lower(name) NOT LIKE '%.ps1'
    AND lower(name) NOT LIKE '%.scr'
    AND lower(name) NOT LIKE '%.com'
    AND lower(name) NOT LIKE '%.msi'
    AND lower(name) NOT LIKE '%.dll'
    AND lower(name) NOT LIKE '%.app'
    AND lower(name) NOT LIKE '%.deb'
    AND lower(name) NOT LIKE '%.rpm'
    AND lower(name) NOT LIKE '%.dmg'
    AND lower(name) NOT LIKE '%.apk'
    AND lower(name) NOT LIKE '%.jar'
    AND lower(name) NOT LIKE '%.php'
    AND lower(name) NOT LIKE '%.py'
    AND lower(name) NOT LIKE '%.rb'
    AND lower(name) NOT LIKE '%.pl'
  );

-- ============================================================================
-- TODO (Sprint 4 — требует server-side прокси):
--
-- 1) Создать `/api/upload-file` endpoint:
--    - принимает multipart/form-data
--    - валидирует magic bytes через `file-type` npm package
--    - проверяет MIME из whitelist (image/jpeg, image/png, application/pdf)
--    - sanitization имени файла
--    - per-tg_id квота через rate-limit
--    - возвращает signed URL для дальнейшего fetch
--
-- 2) В Supabase Dashboard → Storage → visadel-files settings:
--    - File size limit: 10MB (сейчас unlimited)
--    - Allowed MIME types: image/jpeg, image/png, application/pdf
--    - Public access: оставить (фронт читает через getPublicUrl)
--    - Content-Disposition: добавить header `attachment` через transform
--      (если SDK позволяет) — браузер скачивает вместо рендера
--
-- 3) Фронт мигрировать на новый endpoint (`/api/upload-file` вместо
--    `supabase.storage.upload()`). После этого можно полностью закрыть
--    INSERT policy для anon — только service_key.
--
-- ============================================================================

-- Проверка: после применения попробовать загрузить .html через JS:
--   supabase.storage.from('visadel-files').upload('123/test/x.html', new Blob(['<script>alert(1)</script>'], {type:'text/html'}))
-- Должен вернуть: { error: { statusCode: 403, message: 'new row violates row-level security policy' } }
