-- Защита от двойного начисления бонуса при двойном клике / гонке параллельных
-- Vercel-инстансов. До этого constraint двойной POST мог пройти проверку
-- alreadyGranted() оба раза → бонус начислялся 2x.
--
-- dedupe_key = type + ':' + application_id (или произвольный токен).
-- Если у строки нет dedupe_key (старые logs до миграции), уникальность не
-- enforced — поэтому колонка nullable.

ALTER TABLE public.bonus_logs
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- Удаляем дубли которые уже могли накопиться, оставляя самую раннюю
-- запись по каждому (telegram_id, type, dedupe_key).
DELETE FROM public.bonus_logs a
USING public.bonus_logs b
WHERE a.id <> b.id
  AND a.telegram_id = b.telegram_id
  AND a.type = b.type
  AND a.dedupe_key = b.dedupe_key
  AND a.dedupe_key IS NOT NULL
  AND a.created_at > b.created_at;

-- ВАЖНО: индекс БЕЗ WHERE clause. Partial unique index не работает с
-- PostgREST'овским ?on_conflict=...&Prefer:resolution=ignore-duplicates
-- — Postgres выдаёт 42P10 "no unique or exclusion constraint matching
-- the ON CONFLICT specification". А полный unique index с nullable
-- колонкой работает идентично, потому что Postgres по умолчанию считает
-- NULL'ы различными в unique index (NULLS DISTINCT — поведение по
-- умолчанию). То есть (123, 'review', NULL) и (123, 'review', NULL) не
-- конфликтуют, что нам и нужно для legacy-строк без dedupe_key.
DROP INDEX IF EXISTS idx_bonus_logs_dedupe;
CREATE UNIQUE INDEX idx_bonus_logs_dedupe
  ON public.bonus_logs (telegram_id, type, dedupe_key);

-- Сбросить schema cache PostgREST, иначе он не увидит новый индекс
-- до перезапуска.
NOTIFY pgrst, 'reload schema';
