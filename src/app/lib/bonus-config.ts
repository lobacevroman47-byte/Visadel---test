// Single source of truth for bonus amounts.
// Change values here — they propagate everywhere across the app.

export const BONUS_CONFIG = {
  // ── Reviews ────────────────────────────────────────────────────────────────
  REVIEW: 200,                           // ₽ for leaving a review

  // ── Referrals: regular user ────────────────────────────────────────────────
  REFERRER_REGULAR: 500,                 // ₽ to regular referrer when friend pays
  NEW_USER_WELCOME: 200,                 // ₽ to newcomer who came via referral link, on first paid order

  // ── Referrals: partner ─────────────────────────────────────────────────────
  // Partners earn a percentage of the order total instead of a fixed amount.
  // Default percent applies if a product doesn't define its own commission.
  PARTNER_COMMISSION_PCT_DEFAULT: 15,    // %  (per-product overrides come later)
  PARTNER_COMMISSION_MAX_PCT: 20,        // marketing cap shown in UI ("до 20%")

  // ── Bonus usage limits at checkout ─────────────────────────────────────────
  // Flat per-order limit. До удаления уровней (commit XXX) лимит рос с уровнем
  // (500/600/800/1000₽). После удаления — единый flat-лимит для всех обычных
  // юзеров. Партнёрам по-прежнему 100%.
  MAX_BONUS_USAGE_REGULAR: 500,          // ₽ — flat limit per order for regular users
  MAX_BONUS_USAGE_PARTNER: null as number | null, // null = 100% allowed for partners

  // ── Finance ────────────────────────────────────────────────────────────────
  USD_RATE_RUB: 100,                     // курс по умолчанию для НОВЫХ заявок (можно поменять для каждой заявки в админке)
  TAX_PCT_DEFAULT: 4,                    // налог % по умолчанию для НОВЫХ заявок (УСН для самозанятых)
};

// Maximum bonus usage per order. Flat для обычных юзеров, без cap для партнёров.
// Раньше зависело от уровня (Старт/Активный/Эксперт/VIP — 500/600/800/1000₽);
// убрано чтобы не плодить gamification вокруг реф-программы.
export function getMaxBonusUsage(_paidRefCount: number, isPartner: boolean): number | null {
  if (isPartner) return null;
  return BONUS_CONFIG.MAX_BONUS_USAGE_REGULAR;
}

// Compute partner commission for a given product/order
export function partnerCommission(orderPriceRub: number, productCommissionPct?: number | null): number {
  const pct = productCommissionPct ?? BONUS_CONFIG.PARTNER_COMMISSION_PCT_DEFAULT;
  return Math.round((orderPriceRub * pct) / 100);
}
