-- 029_application_type.sql
--
-- Добавляет тип заявки в applications. Раньше там были только визовые
-- заявки (Step1..Step7 flow), а продление виз Шри-Ланки жило в localStorage
-- через изолированный SriLankaExtensionForm — не попадало в админку, не
-- триггерило уведомления, не отображалось в «Мои заявки».
--
-- После этой миграции все заявки (визы + продления) живут в одной таблице
-- applications, отличаются полем application_type. Лейблы и прогресс-бар
-- в UI/админке выбираются динамически по этому полю.
--
-- Безопасно для существующих данных: NOT NULL + DEFAULT 'visa', все
-- текущие ряды получат 'visa' автоматически.

BEGIN;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS application_type text NOT NULL DEFAULT 'visa'
    CHECK (application_type IN ('visa', 'extension'));

COMMENT ON COLUMN public.applications.application_type IS
  'Тип заявки: visa = первичное оформление визы (Step1..Step7), extension = продление визы (Шри-Ланка и в будущем другие страны). Влияет на лейблы в UI (Виза/Продление оформляется) и текст уведомлений.';

-- Индекс — админка фильтрует по типу в списке.
CREATE INDEX IF NOT EXISTS applications_application_type_idx
  ON public.applications (application_type);

COMMIT;
