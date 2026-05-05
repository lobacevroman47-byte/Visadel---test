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
  MAX_BONUS_USAGE_REGULAR: 500,          // ₽ — regular user can apply up to this per order
  MAX_BONUS_USAGE_PARTNER: null as number | null, // null = 100% allowed for partners
};

// Compute partner commission for a given product/order
export function partnerCommission(orderPriceRub: number, productCommissionPct?: number | null): number {
  const pct = productCommissionPct ?? BONUS_CONFIG.PARTNER_COMMISSION_PCT_DEFAULT;
  return Math.round((orderPriceRub * pct) / 100);
}

// ─── Referral achievement levels ───────────────────────────────────────────
// Counts use total invited users (not only paid). Bonus is granted once per level.
export interface ReferralLevel {
  id: 1 | 2 | 3 | 4;
  name: string;
  minRefs: number;
  bonus: number;
  icon: string;
  gradient: string;
}

export const REFERRAL_LEVELS: ReferralLevel[] = [
  { id: 1, name: 'Новичок',    minRefs: 1,  bonus: 0,    icon: '🥉', gradient: 'from-amber-400 to-amber-600' },
  { id: 2, name: 'Активист',   minRefs: 3,  bonus: 500,  icon: '🥈', gradient: 'from-gray-400 to-gray-600' },
  { id: 3, name: 'Амбассадор', minRefs: 10, bonus: 2000, icon: '🥇', gradient: 'from-yellow-400 to-yellow-600' },
  { id: 4, name: 'Легенда',    minRefs: 25, bonus: 5000, icon: '👑', gradient: 'from-purple-500 to-pink-600' },
];

export function getCurrentLevel(refCount: number): ReferralLevel | null {
  return [...REFERRAL_LEVELS].reverse().find(l => refCount >= l.minRefs) ?? null;
}

export function getNextLevel(refCount: number): ReferralLevel | null {
  return REFERRAL_LEVELS.find(l => refCount < l.minRefs) ?? null;
}
