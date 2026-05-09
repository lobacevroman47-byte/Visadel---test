-- 020_partner_atomic_balance.sql
--
-- Атомарный инкремент/декремент users.partner_balance через RPC.
-- Защищает от race condition между:
--   • cron processPartnerHolds (ночью одобряет partner_pending)
--   • admin Payouts (днём списывает баланс при выплате)
-- Раньше оба делали read→modify→write, что при пересечении могло
-- перезаписать одну транзакцию другой.
--
-- Использование:
--   SELECT public.inc_partner_balance(123456789, 500);   -- +500₽
--   SELECT public.inc_partner_balance(123456789, -800);  -- -800₽ (выплата)
--
-- Возвращает новый баланс после операции (NULL если строки нет).

CREATE OR REPLACE FUNCTION public.inc_partner_balance(
  p_telegram_id BIGINT,
  p_delta INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE public.users
     SET partner_balance = COALESCE(partner_balance, 0) + p_delta
   WHERE telegram_id = p_telegram_id
   RETURNING partner_balance INTO v_new_balance;
  RETURN v_new_balance;
END;
$$;

-- GRANT для всех ролей. anon доступ — потому что admin Payouts работает
-- через anon-key (admin-гейт сейчас на ?admin=true URL-флаге, не на JWT).
-- Когда добавим Telegram-auth для админки — сожмём до service_role.
GRANT EXECUTE ON FUNCTION public.inc_partner_balance(BIGINT, INTEGER)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.inc_partner_balance IS
  'Атомарный inc/dec partner_balance. Используется cron (approval) и админкой (payout).';
