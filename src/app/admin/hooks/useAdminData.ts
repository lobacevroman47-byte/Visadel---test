import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { mockApplications, mockUsers } from '../data/mockData';

export interface AdminApplication {
  id: string;
  clientName: string;
  phone: string;
  email: string;
  telegram: string;
  country: string;
  countryFlag: string;
  visaType: string;
  visaId: string;
  cost: number;
  bonusesUsed: number;
  status: 'draft' | 'pending_payment' | 'pending_confirmation' | 'in_progress' | 'completed';
  date: string;
  urgent: boolean;
  // 'extension' — заявка на продление визы (Шри-Ланка). Влияет на UI-бэдж
  // в админке и текст уведомлений. См. supabase/029_application_type.sql.
  applicationType: 'visa' | 'extension';
  formData: Record<string, unknown>;
  paymentProofUrl?: string;
  visaFileUrl?: string;
  telegramId: number;
  usdRateRub: number | null;
  taxPct: number;
}

export type AdminStaffRole = 'founder' | 'admin' | 'moderator';

export interface AdminUser {
  id: string;
  telegramId: number;
  name: string;
  username: string;
  phone: string;
  email: string;
  bonusBalance: number;
  status: 'regular' | 'partner';
  // Admin-panel role layered on top of status. Takes display priority over status when set.
  adminRole?: AdminStaffRole;
  registeredAt: string;
  applicationsCount: number;
}

const FLAG_MAP: Record<string, string> = {
  'Индия': '🇮🇳', 'Вьетнам': '🇻🇳', 'Шри-Ланка': '🇱🇰',
  'Южная Корея': '🇰🇷', 'Израиль': '🇮🇱', 'Пакистан': '🇵🇰',
  'Камбоджа': '🇰🇭', 'Кения': '🇰🇪', 'Филиппины': '🇵🇭',
};

const STATUS_MAP: Record<string, AdminApplication['status']> = {
  draft: 'draft',
  pending_payment: 'pending_payment',
  pending_confirmation: 'pending_confirmation',
  in_progress: 'in_progress',
  ready: 'completed',
};

function rowToApplication(row: Record<string, unknown>): AdminApplication {
  const fd = (row.form_data as Record<string, unknown>) ?? {};
  const contact = (fd.contactInfo as Record<string, string>) ?? {};
  const basic = (fd.basicData as Record<string, string>) ?? {};
  // Имя живёт в basicData.firstName/lastName (Step1BasicData сохраняет туда).
  // Раньше читали fd.firstName на корне — там их нет, поэтому clientName
  // всегда падал на fallback `ID <telegram>`. Сейчас порядок:
  //   1. basicData.firstName + basicData.lastName (canonical)
  //   2. legacy fullName / lastName на корне basicData
  //   3. fdAny.firstName на корне form_data (на случай старых записей)
  //   4. fallback на telegram_id
  const fdAny = fd as Record<string, string>;
  const fromBasic = [basic.firstName, basic.lastName].filter(Boolean).join(' ').trim();
  const fromRoot = [fdAny.firstName, fdAny.lastName].filter(Boolean).join(' ').trim();
  const clientName = fromBasic || basic.fullName || fromRoot || basic.lastName || `ID ${row.user_telegram_id}`;
  return {
    id: row.id as string,
    telegramId: row.user_telegram_id as number,
    clientName,
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    telegram: contact.telegram ?? '',
    country: row.country as string,
    countryFlag: FLAG_MAP[row.country as string] ?? '🌍',
    visaType: row.visa_type as string,
    visaId: (row.visa_id as string) ?? '',
    cost: row.price as number,
    bonusesUsed: (row.bonuses_used as number) ?? 0,
    status: STATUS_MAP[row.status as string] ?? 'draft',
    date: row.created_at as string,
    urgent: row.urgent as boolean,
    applicationType: (row.application_type as 'visa' | 'extension') ?? 'visa',
    formData: fd,
    paymentProofUrl: row.payment_proof_url as string | undefined,
    visaFileUrl: row.visa_file_url as string | undefined,
    usdRateRub: (row.usd_rate_rub as number | null) ?? null,
    taxPct: (row.tax_pct as number) ?? 4,
  };
}

function rowToUser(row: Record<string, unknown>, appsCount: number): AdminUser {
  return {
    id: row.id as string,
    telegramId: row.telegram_id as number,
    name: `${row.first_name}${row.last_name ? ' ' + row.last_name : ''}`,
    username: (row.username as string) ?? '',
    phone: (row.phone as string) ?? '',
    email: (row.email as string) ?? '',
    bonusBalance: (row.bonus_balance as number) ?? 0,
    status: (row.is_influencer as boolean) ? 'partner' : 'regular',
    registeredAt: row.created_at as string,
    applicationsCount: appsCount,
  };
}

// ─── Applications ─────────────────────────────────────────────────────────────

export function useAdminApplications() {
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('applications')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setApplications((data as Record<string, unknown>[]).map(rowToApplication));
      } else {
        // Fallback to mock + localStorage
        const ls = JSON.parse(localStorage.getItem('applications') || '[]');
        const lsMapped: AdminApplication[] = ls.map((a: Record<string, unknown>) => ({
          id: String(a.id ?? Date.now()),
          telegramId: 0,
          clientName: ((a.formData as Record<string, unknown>)?.contactInfo as Record<string, string>)?.telegram ?? 'Клиент',
          phone: ((a.formData as Record<string, unknown>)?.contactInfo as Record<string, string>)?.phone ?? '',
          email: ((a.formData as Record<string, unknown>)?.contactInfo as Record<string, string>)?.email ?? '',
          telegram: ((a.formData as Record<string, unknown>)?.contactInfo as Record<string, string>)?.telegram ?? '',
          country: (a.visa as Record<string, unknown>)?.country as string ?? '',
          countryFlag: FLAG_MAP[(a.visa as Record<string, unknown>)?.country as string ?? ''] ?? '🌍',
          visaType: (a.visa as Record<string, unknown>)?.type as string ?? '',
          visaId: ((a.visa as Record<string, unknown>)?.id as string) ?? '',
          cost: (a.totalPrice as number) ?? 0,
          bonusesUsed: (a.bonusesUsed as number) ?? 0,
          status: 'pending_confirmation',
          date: (a.createdAt as string) ?? new Date().toISOString(),
          urgent: Boolean(a.urgent),
          applicationType: (a.application_type as 'visa' | 'extension') ?? (a.isExtension ? 'extension' : 'visa'),
          formData: (a.formData as Record<string, unknown>) ?? {},
          usdRateRub: null,
          taxPct: 4,
        }));
        setApplications([...lsMapped, ...mockApplications.map(m => ({ ...m, telegramId: 0, applicationType: 'visa' as const, formData: {}, visaId: '', usdRateRub: null, taxPct: 4 }))]);
      }
    } catch (err) {
      console.error('Fetch applications error:', err);
      setApplications(mockApplications.map(m => ({ ...m, telegramId: 0, applicationType: 'visa' as const, formData: {}, visaId: '', usdRateRub: null, taxPct: 4 })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Supabase Realtime — live updates for admin dashboard
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('admin-apps-realtime')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'applications' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setApplications(prev => [rowToApplication(payload.new), ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setApplications(prev =>
              prev.map(app =>
                app.id === payload.new.id ? rowToApplication(payload.new) : app
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setApplications(prev => prev.filter(app => app.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { applications, loading, refetch: fetch };
}

export async function updateApplicationStatus(
  id: string,
  status: AdminApplication['status'],
  visaFileUrl?: string,
  telegramId?: number,
  country?: string,
  visaType?: string,
  prevStatus?: AdminApplication['status'],
  changedBy?: { id: number; name: string },
) {
  const dbStatus = status === 'completed' ? 'ready' : status;
  if (isSupabaseConfigured()) {
    const patch: Record<string, unknown> = { status: dbStatus };
    if (visaFileUrl) patch.visa_file_url = visaFileUrl;
    await supabase.from('applications').update(patch).eq('id', id);

    // Audit-trail: log only if status actually changed.
    if (prevStatus && prevStatus !== status) {
      const { error: logError } = await supabase.from('status_log').insert({
        application_id: id,
        from_status: prevStatus,
        to_status: status,
        changed_by_id: changedBy?.id ?? null,
        changed_by_name: changedBy?.name ?? null,
      });
      if (logError) {
        console.error('[status_log] insert failed:', logError);
        alert(`⚠️ Запись в истории не создалась:\n${logError.message}\nКод: ${logError.code}\n\nЗапусти: ALTER TABLE status_log DISABLE ROW LEVEL SECURITY;`);
      }
    }
  }

  // Notification is sent by the caller (Applications.tsx handleSave) to avoid double-send
}

// Allows admin to overwrite the USD rate snapshotted on the application.
// Used when the rate at payment time differs from the default — the finance
// dashboard will recalculate cost-of-goods using this per-app rate.
export async function updateApplicationUsdRate(id: string, rate: number) {
  if (!isSupabaseConfigured()) return;
  await supabase.from('applications').update({ usd_rate_rub: rate }).eq('id', id);
}

// Per-application tax % (УСН/самозанятый rate may vary; used in finance reports)
export async function updateApplicationTaxPct(id: string, pct: number) {
  if (!isSupabaseConfigured()) return;
  await supabase.from('applications').update({ tax_pct: pct }).eq('id', id);
}

// ─── Status log (audit trail) ──────────────────────────────────────────────
export interface StatusLogEntry {
  id: string;
  application_id: string;
  from_status: string | null;
  to_status: string;
  changed_by_id: number | null;
  changed_by_name: string | null;
  created_at: string;
}

export async function getStatusLog(applicationId: string): Promise<StatusLogEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase
    .from('status_log')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true });
  return (data as StatusLogEntry[]) ?? [];
}

export async function uploadVisaFile(file: File): Promise<string | null> {
  if (!isSupabaseConfigured()) return URL.createObjectURL(file);
  const ext = file.name.split('.').pop();
  const path = `visas/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('visadel-files').upload(path, file);
  if (error) return null;
  const { data } = supabase.storage.from('visadel-files').getPublicUrl(path);
  return data.publicUrl;
}

// ─── Users ────────────────────────────────────────────────────────────────────

// Founders come from VITE_ADMIN_TELEGRAM_IDS env var, not from any DB table
const FOUNDER_TELEGRAM_IDS = new Set(
  (import.meta.env.VITE_ADMIN_TELEGRAM_IDS ?? '')
    .split(',').map((s: string) => s.trim()).filter(Boolean).map(Number)
);

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const [usersRes, appsRes, adminsRes] = await Promise.all([
          supabase.from('users').select('*').order('created_at', { ascending: false }),
          supabase.from('applications').select('user_telegram_id'),
          supabase.from('admin_users').select('telegram_id, role'),
        ]);
        if (usersRes.error) throw usersRes.error;

        const appCounts: Record<number, number> = {};
        (appsRes.data ?? []).forEach((a: Record<string, unknown>) => {
          const tid = a.user_telegram_id as number;
          appCounts[tid] = (appCounts[tid] ?? 0) + 1;
        });

        const adminRoleMap = new Map<number, AdminStaffRole>();
        (adminsRes.data ?? []).forEach((a: Record<string, unknown>) => {
          adminRoleMap.set(a.telegram_id as number, a.role as AdminStaffRole);
        });

        const mapped = (usersRes.data as Record<string, unknown>[]).map(u => {
          const tid = u.telegram_id as number;
          const base = rowToUser(u, appCounts[tid] ?? 0);
          // Founder env var trumps admin_users; otherwise use admin_users role if present
          const adminRole: AdminStaffRole | undefined = FOUNDER_TELEGRAM_IDS.has(tid)
            ? 'founder'
            : adminRoleMap.get(tid);
          return adminRole ? { ...base, adminRole } : base;
        });
        setUsers(mapped);
      } else {
        setUsers(mockUsers.map(u => ({ ...u, telegramId: 0 })));
      }
    } catch (err) {
      console.error('Fetch users error:', err);
      setUsers(mockUsers.map(u => ({ ...u, telegramId: 0 })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { users, loading, refetch: fetch };
}

export async function updateUserBonuses(telegramId: number, amount: number, add: boolean) {
  if (!isSupabaseConfigured()) return;
  const { data } = await supabase.from('users').select('bonus_balance').eq('telegram_id', telegramId).single();
  const current = (data as { bonus_balance: number } | null)?.bonus_balance ?? 0;
  const newBalance = add ? current + amount : Math.max(0, current - amount);
  await supabase.from('users').update({ bonus_balance: newBalance }).eq('telegram_id', telegramId);

  // Audit trail — log every manual change so the bonus journal & finance dashboard
  // reflect reality. Signed amount: positive = grant, negative = revoke.
  try {
    const signed = add ? amount : -amount;
    await supabase.from('bonus_logs').insert({
      telegram_id: telegramId,
      type: add ? 'admin_grant' : 'admin_revoke',
      amount: signed,
      description: add
        ? `Админ начислил +${amount}₽ через панель`
        : `Админ снял −${amount}₽ через панель`,
    });
  } catch (e) {
    console.warn('admin bonus log insert failed', e);
  }
}

export async function updateUserStatus(telegramId: number, isInfluencer: boolean) {
  if (!isSupabaseConfigured()) return;
  await supabase.from('users').update({ is_influencer: isInfluencer }).eq('telegram_id', telegramId);
}
