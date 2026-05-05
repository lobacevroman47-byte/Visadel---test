import { supabase, isSupabaseConfigured } from './supabase';
import type { TelegramUser } from './telegram';
import { BONUS_CONFIG, partnerCommission } from './bonus-config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppUser {
  id?: string;
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  phone?: string;
  email?: string;
  bonus_balance: number;
  is_influencer: boolean;
  referral_code: string;
  referred_by?: string;
  last_bonus_date?: string;
  bonus_streak: number;
}

export interface Application {
  id?: string;
  user_telegram_id: number;
  country: string;
  visa_type: string;
  visa_id: string;
  price: number;
  urgent: boolean;
  status: 'draft' | 'pending_payment' | 'pending_confirmation' | 'in_progress' | 'ready';
  form_data: Record<string, unknown>;
  payment_proof_url?: string;
  visa_file_url?: string;
  bonuses_used: number;
  // Snapshot of USD→RUB rate for this specific application — used to compute
  // cost-of-goods in finance reports. Editable by admin per application.
  usd_rate_rub?: number;
  // Tax percent applied to this application's price (УСН/самозанятый, default 4%).
  // Editable by admin per application; finance reports subtract this from profit.
  tax_pct?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id?: string;
  user_telegram_id: number;
  task_type: string;
  title: string;
  reward: number;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  proof_url?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateReferralCode(telegramId: number): string {
  return `VIS${telegramId.toString(36).toUpperCase()}`;
}

const LS_KEY = 'vd_user';
const LS_APPS = 'vd_applications';
const LS_TASKS = 'vd_tasks';

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ─── User ─────────────────────────────────────────────────────────────────────

export async function upsertUser(tgUser: TelegramUser, referredBy?: string): Promise<AppUser> {
  const referralCode = generateReferralCode(tgUser.id);

  if (isSupabaseConfigured()) {
    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', tgUser.id)
      .single();

    if (existing) {
      // Update name/photo if changed
      const { data: updated } = await supabase
        .from('users')
        .update({
          first_name: tgUser.first_name,
          last_name: tgUser.last_name ?? null,
          username: tgUser.username ?? null,
          photo_url: tgUser.photo_url ?? null,
        })
        .eq('telegram_id', tgUser.id)
        .select()
        .single();
      const user = (updated ?? existing) as AppUser;
      lsSet(LS_KEY, user);
      return user;
    }

    // Create new user
    // Welcome bonus: read from app_settings (fallback BONUS_CONFIG.NEW_USER_WELCOME)
    const settings = await getAppSettings();
    const welcomeBonus = referredBy ? settings.new_user_welcome_bonus : 0;
    const { data: created, error } = await supabase
      .from('users')
      .insert({
        telegram_id: tgUser.id,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name ?? null,
        username: tgUser.username ?? null,
        photo_url: tgUser.photo_url ?? null,
        bonus_balance: welcomeBonus,
        is_influencer: false,
        referral_code: referralCode,
        referred_by: referredBy ?? null,
        bonus_streak: 0,
      })
      .select()
      .single();

    if (error) throw error;

    // Log welcome bonus
    if (welcomeBonus > 0) {
      try {
        await supabase.from('bonus_logs').insert({
          telegram_id: tgUser.id,
          type: 'welcome',
          amount: welcomeBonus,
          description: `+${welcomeBonus}₽ приветственный бонус по реферальной ссылке`,
        });
      } catch (e) { console.warn('welcome bonus log failed', e); }
    }

    const user = created as AppUser;
    lsSet(LS_KEY, user);
    return user;
  }

  // localStorage fallback
  const cached = lsGet<AppUser | null>(LS_KEY, null);
  if (cached && cached.telegram_id === tgUser.id) return cached;

  const user: AppUser = {
    telegram_id: tgUser.id,
    first_name: tgUser.first_name,
    last_name: tgUser.last_name,
    username: tgUser.username,
    photo_url: tgUser.photo_url,
    bonus_balance: 0,
    is_influencer: false,
    referral_code: referralCode,
    bonus_streak: 0,
  };
  lsSet(LS_KEY, user);
  return user;
}

export async function getUser(telegramId: number): Promise<AppUser | null> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    if (data) lsSet(LS_KEY, data);
    return (data as AppUser) ?? null;
  }
  return lsGet<AppUser | null>(LS_KEY, null);
}

export async function updateUser(telegramId: number, patch: Partial<AppUser>): Promise<AppUser | null> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('users')
      .update(patch as never)
      .eq('telegram_id', telegramId)
      .select()
      .single();
    if (data) lsSet(LS_KEY, data);
    return (data as AppUser) ?? null;
  }
  const user = lsGet<AppUser | null>(LS_KEY, null);
  if (!user) return null;
  const updated = { ...user, ...patch };
  lsSet(LS_KEY, updated);
  return updated;
}

export async function addBonuses(telegramId: number, amount: number): Promise<number> {
  if (isSupabaseConfigured()) {
    const { data: user } = await supabase
      .from('users')
      .select('bonus_balance')
      .eq('telegram_id', telegramId)
      .single();
    const newBalance = ((user as { bonus_balance: number } | null)?.bonus_balance ?? 0) + amount;
    await supabase
      .from('users')
      .update({ bonus_balance: newBalance })
      .eq('telegram_id', telegramId);
    return newBalance;
  }
  const user = lsGet<AppUser | null>(LS_KEY, null);
  if (!user) return 0;
  user.bonus_balance = (user.bonus_balance ?? 0) + amount;
  lsSet(LS_KEY, user);
  return user.bonus_balance;
}

export async function claimDailyBonus(telegramId: number): Promise<{ claimed: boolean; amount: number; streak: number }> {
  const today = new Date().toISOString().split('T')[0];

  const user = isSupabaseConfigured()
    ? await getUser(telegramId)
    : lsGet<AppUser | null>(LS_KEY, null);

  if (!user) return { claimed: false, amount: 0, streak: 0 };
  if (user.last_bonus_date === today) return { claimed: false, amount: 0, streak: user.bonus_streak };

  const newStreak = user.bonus_streak + 1;
  let amount = 1;
  if (newStreak % 30 === 0) amount = 10;
  else if (newStreak % 7 === 0) amount = 3;

  await updateUser(telegramId, {
    last_bonus_date: today,
    bonus_streak: newStreak,
    bonus_balance: user.bonus_balance + amount,
  });

  return { claimed: true, amount, streak: newStreak };
}

// ─── Applications ─────────────────────────────────────────────────────────────

export async function saveApplication(app: Application): Promise<Application> {
  if (isSupabaseConfigured()) {
    if (app.id) {
      const { data } = await supabase
        .from('applications')
        .update({
          status: app.status,
          form_data: app.form_data,
          payment_proof_url: app.payment_proof_url ?? null,
          bonuses_used: app.bonuses_used,
        })
        .eq('id', app.id)
        .select()
        .single();
      return (data as Application) ?? app;
    }

    const { data, error } = await supabase
      .from('applications')
      .insert({
        user_telegram_id: app.user_telegram_id,
        country: app.country,
        visa_type: app.visa_type,
        visa_id: app.visa_id,
        price: app.price,
        urgent: app.urgent,
        status: app.status,
        form_data: app.form_data,
        payment_proof_url: app.payment_proof_url ?? null,
        bonuses_used: app.bonuses_used,
        usd_rate_rub: app.usd_rate_rub ?? BONUS_CONFIG.USD_RATE_RUB,
        tax_pct: app.tax_pct ?? BONUS_CONFIG.TAX_PCT_DEFAULT,
      })
      .select()
      .single();

    if (error) {
      console.error('saveApplication Supabase error:', JSON.stringify(error));
      // FK violation — user not yet in DB, fall through to localStorage
      if (error.code === '23503') {
        console.warn('FK violation — saving to localStorage instead');
        const apps = lsGet<Application[]>(LS_APPS, []);
        const newApp = { ...app, id: crypto.randomUUID(), created_at: new Date().toISOString() };
        apps.push(newApp);
        lsSet(LS_APPS, apps);
        return newApp;
      }
      throw new Error(`Supabase error ${error.code}: ${error.message}`);
    }
    return data as Application;
  }

  // localStorage fallback
  const apps = lsGet<Application[]>(LS_APPS, []);
  if (app.id) {
    const idx = apps.findIndex(a => a.id === app.id);
    if (idx >= 0) { apps[idx] = app; lsSet(LS_APPS, apps); return app; }
  }
  const newApp = { ...app, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  apps.push(newApp);
  lsSet(LS_APPS, apps);
  return newApp;
}

export async function getUserApplications(telegramId: number): Promise<Application[]> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('applications')
      .select('*')
      .eq('user_telegram_id', telegramId)
      .order('created_at', { ascending: false });
    return (data as Application[]) ?? [];
  }
  const apps = lsGet<Application[]>(LS_APPS, []);
  return apps.filter(a => a.user_telegram_id === telegramId);
}

export async function getApplication(id: string): Promise<Application | null> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .single();
    return (data as Application) ?? null;
  }
  const apps = lsGet<Application[]>(LS_APPS, []);
  return apps.find(a => a.id === id) ?? null;
}

// ─── File Upload ──────────────────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  folder: 'payments' | 'photos' | 'visas'
): Promise<string | null> {
  // Guard: drafts restored from localStorage may have empty objects in place of Files
  if (!file || !(file instanceof File) || !file.name) {
    console.warn('uploadFile: invalid file (likely from restored draft)', file);
    return null;
  }
  if (!isSupabaseConfigured()) {
    return URL.createObjectURL(file);
  }
  const ext = file.name.split('.').pop();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('visadel-files')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) { console.error('Upload error:', error); return null; }

  const { data } = supabase.storage.from('visadel-files').getPublicUrl(path);
  return data.publicUrl;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function getUserTasks(telegramId: number): Promise<Task[]> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_telegram_id', telegramId);
    return (data as Task[]) ?? [];
  }
  const tasks = lsGet<Task[]>(LS_TASKS, []);
  return tasks.filter(t => t.user_telegram_id === telegramId);
}

export async function submitTask(telegramId: number, taskType: string, proofUrl: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.from('tasks').update({ status: 'submitted', proof_url: proofUrl })
      .eq('user_telegram_id', telegramId).eq('task_type', taskType);
    return;
  }
  const tasks = lsGet<Task[]>(LS_TASKS, []);
  const idx = tasks.findIndex(t => t.user_telegram_id === telegramId && t.task_type === taskType);
  if (idx >= 0) { tasks[idx].status = 'submitted'; tasks[idx].proof_url = proofUrl; }
  lsSet(LS_TASKS, tasks);
}

// ─── Admin Users ──────────────────────────────────────────────────────────────

export type AdminRole = 'founder' | 'admin' | 'moderator';

export interface AdminUserRow {
  id?: string;
  telegram_id: number;
  telegram_username?: string;
  name: string;
  role: AdminRole;
  added_by?: number;
  created_at?: string;
}

const FOUNDER_IDS: string[] = (import.meta.env.VITE_ADMIN_TELEGRAM_IDS ?? '')
  .split(',').map((s: string) => s.trim()).filter(Boolean);

export async function getAdminRole(telegramId: number): Promise<AdminRole | null> {
  if (FOUNDER_IDS.includes(String(telegramId))) return 'founder';
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase
    .from('admin_users')
    .select('role')
    .eq('telegram_id', telegramId)
    .single();
  return (data as { role: AdminRole } | null)?.role ?? null;
}

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: true });
  return (data as AdminUserRow[]) ?? [];
}

export async function addAdminUser(row: Omit<AdminUserRow, 'id' | 'created_at'>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('admin_users').upsert(row, { onConflict: 'telegram_id' });
}

export async function removeAdminUser(telegramId: number): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('admin_users').delete().eq('telegram_id', telegramId);
}

export async function updateAdminRole(telegramId: number, role: AdminRole): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('admin_users').update({ role }).eq('telegram_id', telegramId);
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export async function submitReview(params: {
  telegramId: number;
  applicationId: string;
  country: string;
  rating: number;
  text: string;
  username?: string;
}): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.from('reviews').insert({
      user_telegram_id: params.telegramId,
      application_id: params.applicationId,
      country: params.country,
      rating: params.rating,
      text: params.text,
      status: 'pending',
    });
    // Bonus is granted by the caller via /api/grant-bonus (with dedup) — don't add here
  } else {
    const reviews = lsGet<unknown[]>('vd_reviews', []);
    reviews.push({ ...params, id: crypto.randomUUID(), created_at: new Date().toISOString() });
    lsSet('vd_reviews', reviews);
    const user = lsGet<AppUser | null>(LS_KEY, null);
    if (user) { user.bonus_balance = (user.bonus_balance ?? 0) + 200; lsSet(LS_KEY, user); }
  }

  // Post to Telegram channel @visadel_recall
  try {
    await fetch('/api/post-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: params.rating,
        text: params.text,
        country: params.country,
        username: params.username ?? '',
      }),
    });
  } catch (e) {
    console.warn('Failed to post review to channel:', e);
  }

  // Notify admins about new review on moderation
  fetch('/api/notify-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'new_review',
      review_country: params.country,
      review_rating: params.rating,
      review_text: params.text,
    }),
  }).catch(() => { /* no-op */ });
}

// ─── Visa Products Catalog ─────────────────────────────────────────────────

export interface VisaProduct {
  id: string;
  country: string;
  flag: string | null;
  name: string;
  price: number;
  processing_time: string | null;
  description: string | null;
  partner_commission_pct: number;
  // Costs (in USD) — used for profit calculation in finance dashboard
  cost_usd_fee: number;          // консульский сбор / госпошлина
  cost_usd_commission: number;   // комиссия платёжной системы / посредника
  enabled: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export async function getVisaProducts(): Promise<VisaProduct[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('visa_products')
    .select('*')
    .order('country', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) { console.warn('getVisaProducts error', error); return []; }
  return (data as VisaProduct[]) ?? [];
}

export async function upsertVisaProduct(p: Omit<VisaProduct, 'created_at' | 'updated_at'>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('visa_products').upsert(
    { ...p, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
}

export async function deleteVisaProduct(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('visa_products').delete().eq('id', id);
}

export async function toggleVisaProductEnabled(id: string, enabled: boolean): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('visa_products')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id);
}

// Seed catalog from hardcoded countriesData.ts on first install / reset
export async function seedVisaProductsFromCode(force = false, dataset?: { countriesVisaData: { id: string; name: string; flag: string; visaTypes: { id: string; name: string; price: number; processingTime: string; description?: string }[] }[] }): Promise<{ inserted: number; skipped: number; error?: string }> {
  if (!isSupabaseConfigured()) return { inserted: 0, skipped: 0, error: 'Supabase не настроен' };
  const existing = await getVisaProducts();
  if (existing.length > 0 && !force) return { inserted: 0, skipped: existing.length };

  if (!dataset) return { inserted: 0, skipped: 0, error: 'Не передан dataset' };
  const rows: Omit<VisaProduct, 'created_at' | 'updated_at'>[] = [];
  dataset.countriesVisaData.forEach((country, ci) => {
    country.visaTypes.forEach((v, vi) => {
      rows.push({
        id: v.id,
        country: country.name,
        flag: country.flag,
        name: v.name,
        price: v.price,
        processing_time: v.processingTime,
        description: v.description ?? null,
        partner_commission_pct: 15,
        cost_usd_fee: 0,
        cost_usd_commission: 0,
        enabled: true,
        sort_order: ci * 100 + vi,
      });
    });
  });

  if (rows.length === 0) return { inserted: 0, skipped: 0, error: 'Нет данных для импорта' };
  const { error } = await supabase.from('visa_products').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('seed error', error);
    return { inserted: 0, skipped: 0, error: error.message ?? String(error) };
  }
  return { inserted: rows.length, skipped: 0 };
}

export async function getReferralCount(referralCode: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', referralCode);
  return count ?? 0;
}

// ─── Referral stats ────────────────────────────────────────────────────────
export interface ReferralStats {
  clicks: number;             // переходов по ссылке (из referral_clicks)
  registered: number;         // людей зарегистрировалось через ссылку
  paidReferrals: number;      // из них ОПЛАТИЛИ хотя бы одну заявку — официальный счётчик
  totalEarnings: number;      // суммарно заработано ₽ (из bonus_logs type='referral')
  referrals: ReferralRow[];   // подробный список зарегистрированных
}

export interface ReferralRow {
  telegram_id: number;
  name: string;
  username: string | null;
  joined_at: string;
  has_paid: boolean;
  earned_bonus: number;       // сколько мне начислено за этого человека
}

export async function getReferralStats(referralCode: string, myTelegramId: number): Promise<ReferralStats> {
  const empty: ReferralStats = { clicks: 0, registered: 0, paidReferrals: 0, totalEarnings: 0, referrals: [] };
  if (!isSupabaseConfigured() || !referralCode) return empty;

  // Run independent queries in parallel
  const [usersRes, clicksCount, logsRes] = await Promise.all([
    // 1. Users who registered with my code
    supabase
      .from('users')
      .select('telegram_id, first_name, last_name, username, created_at')
      .eq('referred_by', referralCode)
      .order('created_at', { ascending: false }),
    // 2. Clicks count — via server-side API (bypasses RLS)
    fetch(`/api/track-click?code=${encodeURIComponent(referralCode)}`)
      .then(r => r.ok ? r.json() : { count: 0 })
      .then((d: { count?: number }) => d.count ?? 0)
      .catch(() => 0),
    // 3. My referral earnings from bonus_logs
    supabase
      .from('bonus_logs')
      .select('amount, description')
      .eq('telegram_id', myTelegramId)
      .eq('type', 'referral'),
  ]);

  const invited = (usersRes.data ?? []) as Array<{
    telegram_id: number; first_name: string; last_name: string | null;
    username: string | null; created_at: string;
  }>;
  const logs = (logsRes.data ?? []) as Array<{ amount: number; description?: string }>;
  const totalEarnings = logs.reduce((s, l) => s + (l.amount ?? 0), 0);

  if (invited.length === 0) {
    return { ...empty, clicks: clicksCount as number };
  }

  // 4. Which invited users have paid applications (status in_progress or ready)
  const ids = invited.map(u => u.telegram_id);
  const { data: paidApps } = await supabase
    .from('applications')
    .select('user_telegram_id')
    .in('user_telegram_id', ids)
    .in('status', ['in_progress', 'ready']);
  const paidSet = new Set((paidApps ?? []).map((a: { user_telegram_id: number }) => a.user_telegram_id));

  const referrals: ReferralRow[] = invited.map(u => {
    const logForUser = logs.find(l => l.description?.includes(String(u.telegram_id)));
    return {
      telegram_id: u.telegram_id,
      name: `${u.first_name}${u.last_name ? ' ' + u.last_name : ''}`,
      username: u.username,
      joined_at: u.created_at,
      has_paid: paidSet.has(u.telegram_id),
      earned_bonus: logForUser?.amount ?? 0,
    };
  });

  return {
    clicks: clicksCount as number,
    registered: invited.length,
    paidReferrals: paidSet.size,
    totalEarnings,
    referrals,
  };
}

// Pays referral bonus to the referrer once the admin confirms the referee's first payment.
// — Regular referrer: flat BONUS_CONFIG.REFERRER_REGULAR (500₽)
// — Partner referrer: percentage of order price, taken from visa_products.partner_commission_pct
//   (or BONUS_CONFIG.PARTNER_COMMISSION_PCT_DEFAULT if product has no override)
// Uses grant-bonus API with dedup by application_id, so calling multiple times for the same
// referee is safe — bonus is granted exactly once.
export async function payReferralBonus(refereeTelegramId: number, applicationId?: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  // Find the referrer code
  const { data: user } = await supabase
    .from('users')
    .select('referred_by')
    .eq('telegram_id', refereeTelegramId)
    .single();
  const referredBy = (user as { referred_by?: string } | null)?.referred_by;
  if (!referredBy) return;

  // Resolve referrer with partner flag
  const { data: referrer } = await supabase
    .from('users')
    .select('telegram_id, is_influencer')
    .eq('referral_code', referredBy)
    .single();
  if (!referrer) return;
  const r = referrer as { telegram_id: number; is_influencer: boolean };
  const referrerId = r.telegram_id;
  const isPartner = r.is_influencer === true;

  // Default: flat regular bonus from app_settings (fallback to BONUS_CONFIG)
  const settings = await getAppSettings();
  let amount = settings.referrer_regular_bonus;
  let description = `+${amount}₽ за реферала ${refereeTelegramId} (оплачена первая виза)`;

  // Partner override: percentage of the actual order price
  if (isPartner && applicationId) {
    const { data: app } = await supabase
      .from('applications')
      .select('price, visa_id')
      .eq('id', applicationId)
      .single();
    if (app) {
      const a = app as { price: number; visa_id: string };
      const { data: product } = await supabase
        .from('visa_products')
        .select('partner_commission_pct')
        .eq('id', a.visa_id)
        .single();
      const pct = (product as { partner_commission_pct: number } | null)?.partner_commission_pct
        ?? settings.partner_commission_pct_default;
      amount = partnerCommission(a.price, pct);
      description = `+${amount}₽ партнёру (${pct}% от ${a.price}₽, реферал ${refereeTelegramId})`;
    }
  }

  // Idempotent grant via API (dedup key = unique referee id, fires once per referee)
  try {
    await fetch('/api/grant-bonus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: referrerId,
        type: 'referral',
        amount,
        description,
        application_id: `referral_${refereeTelegramId}`,
      }),
    });
  } catch (e) { console.warn('payReferralBonus error', e); }
}

// ─── Visa Form Fields (per-country anketa) ───────────────────────────────────

export type FormFieldType =
  | 'text' | 'email' | 'tel' | 'date' | 'file'
  | 'select' | 'textarea' | 'radio'
  | 'citizenship' | 'countries-multi' | 'south-asia-visits';

export interface VisaFormField {
  id: string;
  country: string;
  visa_id: string | null;          // NULL = applies to all visas of country
  field_key: string;               // 'citizenship', 'birthCity'
  label: string;
  field_type: FormFieldType;
  required: boolean;
  placeholder: string | null;
  comment: string | null;          // hint shown under the input
  options: string[] | null;        // for select/radio
  warning: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface VisaPhotoRequirement {
  id: string;
  country: string;
  visa_id: string | null;
  field_key: string;
  label: string;
  required: boolean;
  requirements: string | null;
  formats: string | null;
  max_size: string | null;
  hide_if_service_selected: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// Returns fields applicable to (country, visaId): visa-specific take priority,
// otherwise country-level (visa_id IS NULL).
export async function getFormFields(country: string, visaId?: string): Promise<VisaFormField[]> {
  if (!isSupabaseConfigured()) return [];
  if (visaId) {
    const { data } = await supabase
      .from('visa_form_fields')
      .select('*')
      .eq('visa_id', visaId)
      .order('sort_order', { ascending: true });
    const list = (data as VisaFormField[]) ?? [];
    if (list.length > 0) return list;
  }
  const { data } = await supabase
    .from('visa_form_fields')
    .select('*')
    .eq('country', country)
    .is('visa_id', null)
    .order('sort_order', { ascending: true });
  return (data as VisaFormField[]) ?? [];
}

export async function getAllFormFields(): Promise<VisaFormField[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase
    .from('visa_form_fields')
    .select('*')
    .order('country', { ascending: true })
    .order('sort_order', { ascending: true });
  return (data as VisaFormField[]) ?? [];
}

export async function upsertFormField(f: Omit<VisaFormField, 'created_at' | 'updated_at'>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('visa_form_fields').upsert(
    { ...f, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
}

export async function deleteFormField(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('visa_form_fields').delete().eq('id', id);
}

export async function getPhotoRequirements(country: string, visaId?: string): Promise<VisaPhotoRequirement[]> {
  if (!isSupabaseConfigured()) return [];
  if (visaId) {
    const { data } = await supabase
      .from('visa_photo_requirements')
      .select('*')
      .eq('visa_id', visaId)
      .order('sort_order', { ascending: true });
    const list = (data as VisaPhotoRequirement[]) ?? [];
    if (list.length > 0) return list;
  }
  const { data } = await supabase
    .from('visa_photo_requirements')
    .select('*')
    .eq('country', country)
    .is('visa_id', null)
    .order('sort_order', { ascending: true });
  return (data as VisaPhotoRequirement[]) ?? [];
}

export async function getAllPhotoRequirements(): Promise<VisaPhotoRequirement[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase
    .from('visa_photo_requirements')
    .select('*')
    .order('country', { ascending: true })
    .order('sort_order', { ascending: true });
  return (data as VisaPhotoRequirement[]) ?? [];
}

export async function upsertPhotoRequirement(p: Omit<VisaPhotoRequirement, 'created_at' | 'updated_at'>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('visa_photo_requirements').upsert(
    { ...p, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
}

export async function deletePhotoRequirement(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('visa_photo_requirements').delete().eq('id', id);
}

// One-shot: import all hardcoded fields and photo requirements from countriesData.
// Skips if any rows already exist (unless force=true).
export async function seedFormFieldsFromCode(
  dataset: {
    countriesVisaData: Array<{
      id: string; name: string;
      visaTypes: Array<{
        id: string;
        formFields?: Array<{
          id: string; key: string; label: string;
          type: string; required: boolean;
          placeholder?: string; comment?: string;
          options?: string[]; warning?: string;
        }>;
      }>;
    }>;
  },
  photoRequirementsByCountryId: Record<string, Array<{
    id: string; key: string; label: string; required: boolean;
    requirements?: string; formats?: string; maxSize?: string;
    hideIfServiceSelected?: string;
  }>>,
  force = false
): Promise<{ insertedFields: number; insertedPhotos: number; skipped: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { insertedFields: 0, insertedPhotos: 0, skipped: false, error: 'Supabase не настроен' };

  const existing = await getAllFormFields();
  if (existing.length > 0 && !force) {
    return { insertedFields: 0, insertedPhotos: 0, skipped: true };
  }

  const fieldRows: Omit<VisaFormField, 'created_at' | 'updated_at'>[] = [];
  const photoRows: Omit<VisaPhotoRequirement, 'created_at' | 'updated_at'>[] = [];

  let countryIdx = 0;
  for (const country of dataset.countriesVisaData) {
    // Group visas by formFields reference equality
    const sets: Array<{ ref: NonNullable<typeof country.visaTypes[number]['formFields']>; visaIds: string[] }> = [];
    for (const v of country.visaTypes) {
      const fields = v.formFields ?? [];
      const found = sets.find(s => s.ref === fields);
      if (found) found.visaIds.push(v.id);
      else sets.push({ ref: fields, visaIds: [v.id] });
    }

    // First set → country-level; rest → per-visa
    sets.forEach((set, setIdx) => {
      const isCountryLevel = setIdx === 0;
      const targetVisaIds = isCountryLevel ? [null] : set.visaIds;
      for (const visaId of targetVisaIds) {
        set.ref.forEach((f, i) => {
          fieldRows.push({
            id: `${visaId ?? country.name}__${f.id}`,
            country: country.name,
            visa_id: visaId,
            field_key: f.key,
            label: f.label,
            field_type: (f.type as FormFieldType),
            required: f.required,
            placeholder: f.placeholder ?? null,
            comment: f.comment ?? null,
            options: f.options ?? null,
            warning: f.warning ?? null,
            sort_order: countryIdx * 1000 + setIdx * 100 + i,
          });
        });
      }
    });

    const photos = photoRequirementsByCountryId[country.id] ?? [];
    photos.forEach((p, i) => {
      photoRows.push({
        id: `${country.name}__${p.id}`,
        country: country.name,
        visa_id: null,
        field_key: p.key,
        label: p.label,
        required: p.required,
        requirements: p.requirements ?? null,
        formats: p.formats ?? null,
        max_size: p.maxSize ?? null,
        hide_if_service_selected: p.hideIfServiceSelected ?? null,
        sort_order: i,
      });
    });

    countryIdx++;
  }

  if (fieldRows.length > 0) {
    const { error } = await supabase.from('visa_form_fields').upsert(fieldRows, { onConflict: 'id' });
    if (error) return { insertedFields: 0, insertedPhotos: 0, skipped: false, error: error.message };
  }
  if (photoRows.length > 0) {
    const { error } = await supabase.from('visa_photo_requirements').upsert(photoRows, { onConflict: 'id' });
    if (error) return { insertedFields: fieldRows.length, insertedPhotos: 0, skipped: false, error: error.message };
  }

  return { insertedFields: fieldRows.length, insertedPhotos: photoRows.length, skipped: false };
}

// ─── App Settings (single-row config) ────────────────────────────────────────

export interface AppSettings {
  id: number;
  new_user_welcome_bonus: number;
  referrer_regular_bonus: number;
  partner_commission_pct_default: number;
  max_bonus_usage_regular: number;
  max_bonus_usage_partner: number | null;
  bonus_expiration_days: number;
  updated_at?: string;
}

const SETTINGS_DEFAULTS: AppSettings = {
  id: 1,
  new_user_welcome_bonus: BONUS_CONFIG.NEW_USER_WELCOME,
  referrer_regular_bonus: BONUS_CONFIG.REFERRER_REGULAR,
  partner_commission_pct_default: BONUS_CONFIG.PARTNER_COMMISSION_PCT_DEFAULT,
  max_bonus_usage_regular: BONUS_CONFIG.MAX_BONUS_USAGE_REGULAR,
  max_bonus_usage_partner: BONUS_CONFIG.MAX_BONUS_USAGE_PARTNER,
  bonus_expiration_days: 365,
};

export async function getAppSettings(): Promise<AppSettings> {
  if (!isSupabaseConfigured()) return SETTINGS_DEFAULTS;
  const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
  return (data as AppSettings) ?? SETTINGS_DEFAULTS;
}

export async function saveAppSettings(s: Omit<AppSettings, 'id' | 'updated_at'>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('app_settings').upsert(
    { id: 1, ...s, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
}

// ─── Additional Services Catalog ──────────────────────────────────────────────

export interface AdditionalService {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  price: number;
  enabled: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export async function getAdditionalServices(): Promise<AdditionalService[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase
    .from('additional_services')
    .select('*')
    .order('sort_order', { ascending: true });
  return (data as AdditionalService[]) ?? [];
}

export async function upsertAdditionalService(s: Omit<AdditionalService, 'created_at' | 'updated_at'>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('additional_services').upsert(
    { ...s, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
}

export async function deleteAdditionalService(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('additional_services').delete().eq('id', id);
}

// ─── Finance / Analytics ──────────────────────────────────────────────────────

export interface FinanceStats {
  revenue: number;          // Выручка = Σ (price − bonuses_used) по оплаченным заявкам
  costOfGoods: number;      // Себестоимость = Σ (cost_usd_fee + cost_usd_commission) × app.usd_rate_rub
  taxes: number;            // Налог = Σ (price × app.tax_pct / 100)
  commissionsPaid: number;  // Партнёрам = Σ bonus_logs WHERE type='referral' (реальное профит-шеринг)
  // ── Информационно (НЕ вычитается из прибыли — это ещё не cash-out, а лишь обязательство):
  welcomeBonusesPaid: number; // Новичкам по реф. ссылке — Σ bonus_logs WHERE type='welcome'
  otherBonusesPaid: number;   // Прочее (daily/weekly/review/level/admin_*) — Σ bonus_logs остальных типов
  bonusesIssued: number;    // Σ всех начислений за период
  bonusesUsed: number;      // Σ bonuses_used (уже учтено в выручке)
  bonusesOutstanding: number; // Текущий долг компании: Σ users.bonus_balance
  profit: number;           // Прибыль = revenue − costOfGoods − taxes − commissionsPaid
  paidApplicationsCount: number;
  series: { date: string; revenue: number; profit: number }[];
}

// Period in days; 0 means "all time"
export async function getFinanceStats(periodDays: number): Promise<FinanceStats> {
  const empty: FinanceStats = {
    revenue: 0, costOfGoods: 0, taxes: 0,
    commissionsPaid: 0, welcomeBonusesPaid: 0, otherBonusesPaid: 0,
    bonusesIssued: 0, bonusesUsed: 0, bonusesOutstanding: 0,
    profit: 0, paidApplicationsCount: 0, series: [],
  };
  if (!isSupabaseConfigured()) return empty;

  const sinceISO = periodDays > 0
    ? new Date(Date.now() - periodDays * 86400_000).toISOString()
    : null;

  // Apps query — only paid statuses count toward revenue
  let appsQ = supabase
    .from('applications')
    .select('price, bonuses_used, visa_id, status, created_at, updated_at, usd_rate_rub, tax_pct')
    .in('status', ['in_progress', 'ready']);
  if (sinceISO) appsQ = appsQ.gte('updated_at', sinceISO);

  // Bonus logs — paid out commissions and total issued
  let bonusQ = supabase.from('bonus_logs').select('type, amount, created_at');
  if (sinceISO) bonusQ = bonusQ.gte('created_at', sinceISO);

  // Outstanding balance — sum of all current bonus_balance values (snapshot, not period-bound)
  const balanceQ = supabase.from('users').select('bonus_balance');

  // Product cost lookup
  const productsQ = supabase.from('visa_products').select('id, cost_usd_fee, cost_usd_commission');

  const [appsRes, bonusRes, balanceRes, productsRes] = await Promise.all([appsQ, bonusQ, balanceQ, productsQ]);

  const apps = (appsRes.data ?? []) as Array<{ price: number; bonuses_used: number; visa_id: string; status: string; created_at: string; updated_at: string; usd_rate_rub: number | null; tax_pct: number | null }>;
  const bonusLogs = (bonusRes.data ?? []) as Array<{ type: string; amount: number; created_at: string }>;
  const balances = (balanceRes.data ?? []) as Array<{ bonus_balance: number }>;
  const products = (productsRes.data ?? []) as Array<{ id: string; cost_usd_fee: number; cost_usd_commission: number }>;

  // USD cost (in dollars) per visa; converted to RUB per-app using each app's own usd_rate_rub
  const usdCostByVisa = new Map<string, number>();
  for (const p of products) {
    usdCostByVisa.set(p.id, (p.cost_usd_fee ?? 0) + (p.cost_usd_commission ?? 0));
  }

  // Compute per-app cost in RUB using that app's snapshotted USD rate
  const costForApp = (a: { visa_id: string; usd_rate_rub: number | null }) => {
    const usd = usdCostByVisa.get(a.visa_id) ?? 0;
    const rate = a.usd_rate_rub ?? BONUS_CONFIG.USD_RATE_RUB;
    return usd * rate;
  };

  // Per-app tax (% of full sticker price, not net of bonuses — matches УСН/самозанятый base)
  const taxForApp = (a: { price: number; tax_pct: number | null }) => {
    const pct = a.tax_pct ?? BONUS_CONFIG.TAX_PCT_DEFAULT;
    return ((a.price ?? 0) * pct) / 100;
  };

  let revenue = 0;
  let bonusesUsed = 0;
  let costOfGoods = 0;
  let taxes = 0;
  for (const a of apps) {
    revenue += (a.price ?? 0) - (a.bonuses_used ?? 0);
    bonusesUsed += a.bonuses_used ?? 0;
    costOfGoods += costForApp(a);
    taxes += taxForApp(a);
  }

  const commissionsPaid = bonusLogs
    .filter(b => b.type === 'referral')
    .reduce((s, b) => s + (b.amount ?? 0), 0);
  const welcomeBonusesPaid = bonusLogs
    .filter(b => b.type === 'welcome')
    .reduce((s, b) => s + (b.amount ?? 0), 0);
  const otherBonusesPaid = bonusLogs
    .filter(b => !['referral', 'welcome'].includes(b.type))
    .reduce((s, b) => s + (b.amount ?? 0), 0);
  const bonusesIssued = commissionsPaid + welcomeBonusesPaid + otherBonusesPaid;
  const bonusesOutstanding = balances.reduce((s, b) => s + (b.bonus_balance ?? 0), 0);

  // Profit subtracts only direct cash-equivalent outflows: cost-of-goods, tax,
  // and partner commissions (real profit-sharing). Welcome / daily / admin
  // bonuses are user-balance liabilities that turn into cost only when the
  // user redeems them on a visa — which already shows up via bonuses_used in
  // the revenue line, so adding them here would double-count.
  const profit = revenue - costOfGoods - taxes - commissionsPaid;

  // Build daily series — buckets only for displayed period (cap at 90 days for chart density)
  const seriesDays = periodDays > 0 ? Math.min(periodDays, 90) : 30;
  const series: { date: string; revenue: number; profit: number }[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = seriesDays - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    let dayRev = 0, dayCost = 0, dayTax = 0;
    for (const a of apps) {
      if (a.updated_at?.slice(0, 10) === key) {
        dayRev += (a.price ?? 0) - (a.bonuses_used ?? 0);
        dayCost += costForApp(a);
        dayTax += taxForApp(a);
      }
    }
    const dayCommissions = bonusLogs
      .filter(b => b.type === 'referral' && b.created_at?.slice(0, 10) === key)
      .reduce((s, b) => s + (b.amount ?? 0), 0);
    series.push({ date: key, revenue: dayRev, profit: dayRev - dayCost - dayTax - dayCommissions });
  }

  return {
    revenue,
    costOfGoods,
    taxes,
    commissionsPaid,
    welcomeBonusesPaid,
    otherBonusesPaid,
    bonusesIssued,
    bonusesUsed,
    bonusesOutstanding,
    profit,
    paidApplicationsCount: apps.length,
    series,
  };
}

export async function getReviewedAppIds(telegramId: number): Promise<Set<string>> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('reviews')
      .select('application_id')
      .eq('user_telegram_id', telegramId);
    return new Set((data ?? []).map((r: { application_id: string }) => r.application_id));
  }
  const reviews = lsGet<{ applicationId: string }[]>('vd_reviews', []);
  return new Set(reviews.map(r => r.applicationId));
}
