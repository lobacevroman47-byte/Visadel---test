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

CREATE UNIQUE INDEX IF NOT EXISTS idx_bonus_logs_dedupe
  ON public.bonus_logs (telegram_id, type, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
