import { supabase, isSupabaseConfigured } from './supabase';
import type { TelegramUser } from './telegram';

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
    // Welcome bonus: 200₽ if user came via referral link
    const welcomeBonus = referredBy ? 200 : 0;
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
// Uses grant-bonus API which has dedup by application_id, so calling this multiple times
// for the same referee is safe — bonus is granted exactly once.
export async function payReferralBonus(refereeTelegramId: number): Promise<void> {
  if (!isSupabaseConfigured()) return;

  // Find the referrer
  const { data: user } = await supabase
    .from('users')
    .select('referred_by')
    .eq('telegram_id', refereeTelegramId)
    .single();
  const referredBy = (user as { referred_by?: string } | null)?.referred_by;
  if (!referredBy) return;

  const { data: referrer } = await supabase
    .from('users')
    .select('telegram_id')
    .eq('referral_code', referredBy)
    .single();
  if (!referrer) return;

  const referrerId = (referrer as { telegram_id: number }).telegram_id;
  const REFERRER_REGULAR = 500;

  // Idempotent grant via API (dedup key = unique referee id)
  try {
    await fetch('/api/grant-bonus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: referrerId,
        type: 'referral',
        amount: REFERRER_REGULAR,
        description: `+${REFERRER_REGULAR}₽ за реферала ${refereeTelegramId} (оплачена первая виза)`,
        application_id: `referral_${refereeTelegramId}`, // unique per referee = pays only once
      }),
    });
  } catch (e) { console.warn('payReferralBonus error', e); }
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
