-- Делаем applications.usd_rate_rub nullable + убираем дефолт 100.
--
-- Раньше колонка имела NOT NULL DEFAULT 100 (наложено вручную в Supabase
-- Studio, в репо-миграциях этого не было). Из-за этого новые заявки всегда
-- получали курс 100, и админу приходилось вручную менять его на каждой.
--
-- Теперь курс по умолчанию NULL → админ обязан ввести его перед переводом
-- заявки в «В работе». Без курса финансы не считаются (себестоимость в
-- рублях = USD-цена визы × курс), поэтому блокируем смену статуса в UI
-- (см. src/app/admin/pages/Applications.tsx — guard в handleSave).
--
-- Существующие заявки с курсом 100 не трогаются — у них значение уже
-- записано. Финансовые отчёты для заявок с null продолжат считаться
-- по фолбэку BONUS_CONFIG.USD_RATE_RUB = 100 (см. src/app/lib/db.ts:1589).

ALTER TABLE public.applications
  ALTER COLUMN usd_rate_rub DROP NOT NULL,
  ALTER COLUMN usd_rate_rub DROP DEFAULT;
