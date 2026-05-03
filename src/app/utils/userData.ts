// Thin compatibility layer — delegates to db.ts
// Legacy callers (ProfileTab, ApplicationsTab, etc.) still work via localStorage cache

export function initializeUserData() {
  const raw = localStorage.getItem('vd_user') ?? localStorage.getItem('userData');
  if (!raw) {
    const defaultData = {
      bonusBalance: 0,
      isInfluencer: false,
      name: 'Пользователь',
      phone: '',
      email: '',
    };
    localStorage.setItem('userData', JSON.stringify(defaultData));
    return defaultData;
  }
  try {
    const parsed = JSON.parse(raw);
    // Normalize both storage formats
    return {
      bonusBalance: parsed.bonus_balance ?? parsed.bonusBalance ?? 0,
      isInfluencer: parsed.is_influencer ?? parsed.isInfluencer ?? false,
      name: parsed.first_name
        ? `${parsed.first_name}${parsed.last_name ? ' ' + parsed.last_name : ''}`
        : (parsed.name ?? 'Пользователь'),
      phone: parsed.phone ?? '',
      email: parsed.email ?? '',
      telegramId: parsed.telegram_id ?? null,
      username: parsed.username ?? null,
      photoUrl: parsed.photo_url ?? null,
      referralCode: parsed.referral_code ?? null,
      bonusStreak: parsed.bonus_streak ?? 0,
      lastBonusDate: parsed.last_bonus_date ?? null,
    };
  } catch {
    return { bonusBalance: 0, isInfluencer: false, name: 'Пользователь', phone: '', email: '' };
  }
}

export function getUserData() {
  return initializeUserData();
}

export function updateUserData(data: Partial<Record<string, unknown>>) {
  const raw = localStorage.getItem('vd_user') ?? localStorage.getItem('userData');
  const current = raw ? JSON.parse(raw) : {};
  const updated = { ...current, ...data };
  localStorage.setItem('userData', JSON.stringify(updated));
  localStorage.setItem('vd_user', JSON.stringify(updated));
  return updated;
}

export function addBonuses(amount: number) {
  const current = getUserData();
  return updateUserData({ bonusBalance: (current.bonusBalance ?? 0) + amount });
}

export function deductBonuses(amount: number) {
  const current = getUserData();
  const balance = current.bonusBalance ?? 0;
  if (balance < amount) throw new Error('Insufficient bonus balance');
  return updateUserData({ bonusBalance: balance - amount });
}
