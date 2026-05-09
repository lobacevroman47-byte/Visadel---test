-- 018_partner_payouts_admin_access.sql
--
-- Открывает anon-доступ на partner_payouts для админ-панели.
-- Логика как у других admin-таблиц: anon может всё, реальная защита —
-- frontend гейт (?admin=true) + ADMIN_TELEGRAM_IDS env. Когда переедем
-- на cookie-based auth для админки — заменим на role-based RLS.

DROP POLICY IF EXISTS "anon_full_partner_payouts" ON public.partner_payouts;
CREATE POLICY "anon_full_partner_payouts" ON public.partner_payouts
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- partner_settings — туда же, доступ для админки
DROP POLICY IF EXISTS "anon_full_partner_settings" ON public.partner_settings;
CREATE POLICY "anon_full_partner_settings" ON public.partner_settings
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
