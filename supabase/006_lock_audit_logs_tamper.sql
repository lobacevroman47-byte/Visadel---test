-- 006: Tamper protection для лог-таблиц.
--
-- КОНТЕКСТ:
-- В миграции 005 политики на bonus_logs / status_log / admin_audit_log
-- были `FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)`.
-- Это значило что любой клиент с anon-key мог:
--   1) INSERT — нужно (фронт пишет логи через anon-key) ✓
--   2) SELECT — нужно (BonusLogs / AuditLog админ-страницы читают через anon) ✓
--   3) UPDATE — НЕ нужно. Никто не должен переписывать логи задним числом.
--   4) DELETE — НЕ нужно. Никто не должен удалять логи.
--
-- Эта миграция оставляет (1) и (2) открытыми (иначе сломаются фронтовые
-- запросы), но блокирует (3) и (4) — теперь логи tamper-proof.
--
-- ПОЛНАЯ ИЗОЛЯЦИЯ (Phase 1): когда auditLog() / writeStatusLog() / logBonus()
-- будут перенесены в /api/* со service-key, можно будет SELECT/INSERT тоже
-- закрыть для anon. Сейчас это сломает:
--   - src/app/lib/db.ts:140 (welcome bonus insert)
--   - src/app/components/profile-tabs/ProfileTab.tsx:49 (logBonus helper)
--   - src/app/admin/hooks/useAdminData.ts:207 (status_log insert)
--   - src/app/admin/lib/audit.ts:36 (admin_audit_log insert)

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['bonus_logs','status_log','admin_audit_log'])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    -- Дропаем permissive FOR ALL политику из миграции 005
    EXECUTE format('DROP POLICY IF EXISTS "anon_write" ON public.%I;', t);

    -- Разрешаем INSERT (фронт пишет логи через anon-key)
    EXECUTE format(
      'CREATE POLICY "anon_insert" ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true);',
      t
    );

    -- Разрешаем SELECT (админка читает через anon-key)
    EXECUTE format(
      'CREATE POLICY "anon_select" ON public.%I FOR SELECT TO anon, authenticated USING (true);',
      t
    );

    -- НЕ создаём политики для UPDATE и DELETE.
    -- При включённом RLS отсутствие политики = DENY для anon/authenticated.
    -- service_role (наш api/*) обходит RLS и может всё.
  END LOOP;
END$$;

-- Проверка: показать какие политики действуют сейчас
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE tablename IN ('bonus_logs','status_log','admin_audit_log')
-- ORDER BY tablename, cmd;
