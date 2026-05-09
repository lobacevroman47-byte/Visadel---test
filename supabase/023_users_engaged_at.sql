-- 023_users_engaged_at.sql
--
-- Добавляет users.engaged_at — отметка что пользователь не просто открыл
-- мини-апп через реф-ссылку, но сделал хотя бы одно действие (перешёл на
-- другой экран, открыл профиль, начал оформление визы и т.д.).
--
-- Ставится клиентом один раз через UPDATE при первой навигации с Home
-- (см. App.tsx). NULL означает что юзер открыл и сразу закрыл.
--
-- Используется для метрик в реф-программе:
--   • «Кликов» — все клики по ссылке (referral_clicks)
--   • «Регистраций» — users где engaged_at IS NOT NULL (юзер «остался»)
--   • «Оформили заказ» — уникальные source_id оплаченных заказов

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS engaged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_engaged_at
  ON public.users(engaged_at) WHERE engaged_at IS NOT NULL;

COMMENT ON COLUMN public.users.engaged_at IS
  'Время первого действия пользователя в мини-аппе (NULL = открыл и сразу закрыл). Ставится клиентом при первой навигации с Home.';
