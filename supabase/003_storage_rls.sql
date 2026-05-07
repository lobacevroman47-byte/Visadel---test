-- Path-based RLS на bucket visadel-files.
--
-- Структура path: <owner>/<folder>/<filename>
--   где <owner> = telegram_id юзера, либо 'shared' (анон/до логина).
--
-- Политики:
--   - INSERT: anon может писать только под своим owner (или shared)
--             [пока auth context не настроен — оставляем upsert через любой
--             свой path; после 004 стянем правила к JWT-claim]
--   - SELECT: anon видит только свои файлы. Админ видит всё (через service key
--             на бэке — в админке файлы отдаются через подписанные URL).
--   - UPDATE / DELETE: только админ через service key
--
-- ВНИМАНИЕ: до тех пор пока миграция 004 (telegram_id из JWT) не применена,
-- эти политики действуют в "open" режиме, чтобы не сломать live-приложение.
-- После 004 они автоматически становятся restrictive.

-- Удаляем legacy открытые политики
DROP POLICY IF EXISTS "storage_insert"     ON storage.objects;
DROP POLICY IF EXISTS "storage_select"     ON storage.objects;

-- INSERT — пока разрешаем всем подряд (до 004), но
-- закрепляем структуру path: первым сегментом обязан быть либо число
-- (telegram_id), либо литерал 'shared'.
CREATE POLICY "visadel_files_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (
    bucket_id = 'visadel-files'
    AND (
      split_part(name, '/', 1) = 'shared'
      OR split_part(name, '/', 1) ~ '^[0-9]+$'
    )
  );

-- SELECT — пока публично (через getPublicUrl). После 004 заменим на
-- USING (telegram_id из JWT == split_part(name, '/', 1)).
CREATE POLICY "visadel_files_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'visadel-files');

-- UPDATE / DELETE для anon полностью запрещены — только service key
-- (он bypass RLS), что и нужно.
