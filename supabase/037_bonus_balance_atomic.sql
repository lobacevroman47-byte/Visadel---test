-- ============================================================================
-- 037: Атомарный inc/dec для users.bonus_balance
--
-- Зеркалит миграцию 020 (inc_partner_balance), но для bonus_balance.
-- Закрывает P1-3 race condition.
--
-- ПРОБЛЕМА (до этой миграции):
-- В api/grant-bonus.js grantBonus() делал:
--   1) read user.bonus_balance  (SELECT)
--   2) compute newBalance = old + amount  (в Node.js memory)
--   3) write user.bonus_balance = newBalance  (PATCH/UPDATE)
-- Это classic lost update / read-modify-write race.
--
-- Сценарий потери:
--   Запрос A: read 100, compute 150 (+50), write 150
--   Запрос B (одновременно): read 100, compute 130 (+30), write 130
--   Финал: 130 (правильно 180, потеряли 50₽).
--
-- Под нагрузкой реален при:
--   - сдвоенных POST из формы (двойной клик / retry)
--   - параллельных referral-бонусах (друг + друг друга оплатили одновременно)
--   - cron'ах + ручных триггерах одновременно
--
-- Дедуп `bonus_logs(telegram_id, type, dedupe_key)` помогает только когда
-- dedupe_key есть и одинаков. При разных dedupe_key (разные application_id)
-- — оба INSERT успешны, но `users.bonus_balance` всё равно гонится.
--
-- РЕШЕНИЕ:
-- Atomic UPDATE ... SET balance = balance + delta — Postgres гарантирует
-- сериализацию таких stmt. Одна строка, одна операция, без race.
--
-- + Fallback: если юзера нет — UPSERT через ON CONFLICT, чтобы не
-- терять начисления реферралам которые ещё не дошли до upsertUser.
--
-- ============================================================================

-- Идемпотентно — можно перезапускать
CREATE OR REPLACE FUNCTION public.inc_bonus_balance(
  p_telegram_id BIGINT,
  p_delta INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Попытка 1: UPDATE существующей строки. Атомарно благодаря row-lock.
  UPDATE public.users
     SET bonus_balance = COALESCE(bonus_balance, 0) + p_delta
   WHERE telegram_id = p_telegram_id
   RETURNING bonus_balance INTO v_new_balance;

  IF FOUND THEN
    RETURN v_new_balance;
  END IF;

  -- Попытка 2: строки нет — создаём с минимально необходимыми полями.
  -- ON CONFLICT защищает от race condition (параллельный grant_bonus или
  -- upsert_user может вставить строку между нашим UPDATE и INSERT).
  -- При conflict — повторно UPDATE (теперь строка уже есть).
  INSERT INTO public.users (telegram_id, bonus_balance, referral_code, first_name)
  VALUES (
    p_telegram_id,
    GREATEST(p_delta, 0),  -- не уходим в минус если первое начисление отрицательное
    'USR_' || p_telegram_id::text,
    'User'
  )
  ON CONFLICT (telegram_id) DO UPDATE
    SET bonus_balance = COALESCE(public.users.bonus_balance, 0) + p_delta
  RETURNING bonus_balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- GRANT EXECUTE — service_role для бэкенд-API. anon оставляем для
-- обратной совместимости с другими местами которые могут вызывать
-- через anon-key (пока фронт мигрирует — не ломать).
GRANT EXECUTE ON FUNCTION public.inc_bonus_balance(BIGINT, INTEGER)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.inc_bonus_balance IS
  'Атомарный inc/dec bonus_balance. Используется api/grant-bonus.js. Закрывает P1-3 race condition (см. docs/SECURITY.md).';

-- ============================================================================
-- Smoke test
-- ============================================================================
-- В Supabase SQL editor:
--   SELECT public.inc_bonus_balance(1, 100);   -- create если нет, +100
--   SELECT public.inc_bonus_balance(1, 50);    -- +50, balance = 150
--   SELECT public.inc_bonus_balance(1, -20);   -- -20, balance = 130
--   SELECT bonus_balance FROM public.users WHERE telegram_id = 1;
--   -- → 130
--
-- Очистить тест:
--   DELETE FROM public.users WHERE telegram_id = 1;
--
-- ============================================================================
-- Concurrent test (psql 2 sessions):
--
--   Session 1: BEGIN; SELECT public.inc_bonus_balance(2, 100);
--   Session 2: BEGIN; SELECT public.inc_bonus_balance(2, 100); -- блокируется
--   Session 1: COMMIT;
--   Session 2: -- разблокируется, тоже +100 → итого 200
--   Session 2: COMMIT;
--   SELECT bonus_balance FROM users WHERE telegram_id = 2; -- 200 ✓
