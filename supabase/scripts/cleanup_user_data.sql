-- supabase/scripts/cleanup_user_data.sql
--
-- ⚠️ DESTRUCTIVE — стирает ВСЕ заявки, брони, юзеров, бонус-историю и
--    реферальные клики (тестовые данные).
--
-- Сохраняет:
--   • catalogs (visa_products, visa_form_fields, visa_photo_requirements,
--     additional_services, app_settings)
--   • admin_users (whitelist админов)
--   • users-ряды whitelist-админов (но обнуляет их bonus_balance, streak,
--     referred_by — чтобы у них тоже был «как новый» опыт)
--   • admin_audit_log (журнал действий админов — оставляем для compliance)
--
-- Это НЕ миграция — одноразовая утилита. Гонять через Supabase Dashboard →
-- SQL Editor одной кнопкой Run. Все стейтменты в одной транзакции.
--
-- Storage-файлы (паспорта, payment screenshots, visa PDF) этот скрипт НЕ
-- трогает — Storage чистится отдельно (см. supabase/scripts/cleanup_storage.md).

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Whitelist founder-админов
-- ═══════════════════════════════════════════════════════════════════════════
-- Объединяем 2 источника: founder (ниже) + admin_users (доп. модераторы).

DROP TABLE IF EXISTS _keep_admins;
CREATE TEMP TABLE _keep_admins AS
  SELECT telegram_id FROM public.admin_users
  UNION
  SELECT unnest(ARRAY[
    5697891657  -- founder Visadel (Roman)
  ]::bigint[]) AS telegram_id;

-- Проверка — должно вернуть как минимум 5697891657
SELECT 'whitelist_admins' AS tag, telegram_id FROM _keep_admins
ORDER BY telegram_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Counts BEFORE
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 'BEFORE'                    AS phase,
       (SELECT COUNT(*) FROM public.users)                 AS users,
       (SELECT COUNT(*) FROM public.applications)          AS applications,
       (SELECT COUNT(*) FROM public.bonus_logs)            AS bonus_logs,
       (SELECT COUNT(*) FROM public.hotel_bookings)        AS hotel_bookings,
       (SELECT COUNT(*) FROM public.flight_bookings)       AS flight_bookings,
       (SELECT COUNT(*) FROM public.reviews)               AS reviews,
       (SELECT COUNT(*) FROM public.tasks)                 AS tasks,
       (SELECT COUNT(*) FROM public.status_log)            AS status_log,
       (SELECT COUNT(*) FROM public.booking_status_log)    AS booking_status_log,
       (SELECT COUNT(*) FROM public.reminders)             AS reminders,
       (SELECT COUNT(*) FROM public.notification_dedup)    AS notif_dedup,
       (SELECT COUNT(*) FROM public.referral_clicks)       AS ref_clicks,
       (SELECT COUNT(*) FROM public.partner_applications)  AS partner_apps,
       (SELECT COUNT(*) FROM public.partner_payouts)       AS partner_payouts,
       (SELECT COUNT(*) FROM public.admin_audit_log)       AS admin_audit_log;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Удаление (порядок: дети → родители; FK CASCADE сделает остальное)
-- ═══════════════════════════════════════════════════════════════════════════

-- 3a. Reviews — явный DELETE (FK к applications и users могут не каскадиться).
--     Раньше полагались на cascade, но в проде остались sirote-строки
--     с application_id ссылкой на удалённую заявку.
DELETE FROM public.reviews;

-- 3a-bis. Все визовые заявки (status_log каскадится).
DELETE FROM public.applications;

-- 3b. Брони отелей и авиа (booking_status_log каскадится по FK).
DELETE FROM public.hotel_bookings;
DELETE FROM public.flight_bookings;
-- Защитный сброс на случай если status_log не каскадится (старые миграции
-- могли создать FK без ON DELETE CASCADE).
DELETE FROM public.booking_status_log;
DELETE FROM public.status_log;

-- 3c. Полная история бонусов (тестовые данные — гасим всю, включая
--     partner_pending / partner_approved / partner_paid).
DELETE FROM public.bonus_logs;

-- 3d. Партнёрская инфраструктура.
DELETE FROM public.partner_payouts;       -- история выплат партнёрам
DELETE FROM public.partner_applications;  -- заявки на партнёрство

-- 3e. Напоминалки (cron-задачи на драфты — больше не релевантны).
DELETE FROM public.reminders;

-- 3f. Дедуп-кэш Telegram-уведомлений (rebuild сам).
DELETE FROM public.notification_dedup;

-- 3g. Реферальные клики (чтобы рефералы открыли мини-апп «впервые»).
DELETE FROM public.referral_clicks;

-- 3h. Tasks — оставляем только админские (cascades from users delete).
DELETE FROM public.tasks
  WHERE user_telegram_id NOT IN (SELECT telegram_id FROM _keep_admins);

-- 3i. Users — оставляем только админов из whitelist.
--     Reviews по user FK каскадятся автоматически.
DELETE FROM public.users
  WHERE telegram_id NOT IN (SELECT telegram_id FROM _keep_admins);

-- 3j. Сброс админских ряд users — баланс, streak, referred_by → как новые.
--     referral_code, имя, контакты, created_at оставляем (юзеры существуют,
--     просто без активности). partner_balance тоже обнуляем — иначе у
--     founder-а останется накопленный partner_balance после стирания
--     partner_payouts (получится баланс без подтверждающих логов).
UPDATE public.users
SET bonus_balance    = 0,
    bonus_streak     = 0,
    last_bonus_date  = NULL,
    referred_by      = NULL,
    partner_balance  = 0,
    updated_at       = now()
WHERE telegram_id IN (SELECT telegram_id FROM _keep_admins);

-- 3k. admin_audit_log — оставляем для compliance.
--     (Раскомментируй если хочешь стереть всю историю действий админов.)
-- DELETE FROM public.admin_audit_log;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Counts AFTER — должно остаться 0 во всех data-таблицах,
--    users = кол-ву админов из whitelist (как минимум 1).
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 'AFTER'                     AS phase,
       (SELECT COUNT(*) FROM public.users)                 AS users,
       (SELECT COUNT(*) FROM public.applications)          AS applications,
       (SELECT COUNT(*) FROM public.bonus_logs)            AS bonus_logs,
       (SELECT COUNT(*) FROM public.hotel_bookings)        AS hotel_bookings,
       (SELECT COUNT(*) FROM public.flight_bookings)       AS flight_bookings,
       (SELECT COUNT(*) FROM public.reviews)               AS reviews,
       (SELECT COUNT(*) FROM public.tasks)                 AS tasks,
       (SELECT COUNT(*) FROM public.status_log)            AS status_log,
       (SELECT COUNT(*) FROM public.booking_status_log)    AS booking_status_log,
       (SELECT COUNT(*) FROM public.reminders)             AS reminders,
       (SELECT COUNT(*) FROM public.notification_dedup)    AS notif_dedup,
       (SELECT COUNT(*) FROM public.referral_clicks)       AS ref_clicks,
       (SELECT COUNT(*) FROM public.partner_applications)  AS partner_apps,
       (SELECT COUNT(*) FROM public.partner_payouts)       AS partner_payouts,
       (SELECT COUNT(*) FROM public.admin_audit_log)       AS admin_audit_log;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. COMMIT or ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Если в counts AFTER что-то странное (например users != кол-ву админов) —
-- замени COMMIT ниже на ROLLBACK и нажми Run заново.
COMMIT;
-- ROLLBACK;
