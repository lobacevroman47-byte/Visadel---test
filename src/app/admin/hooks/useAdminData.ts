import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiFetch';
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
  /** Telegram-юзеры — реальный telegram_id. Веб-юзеры (через email) — 0. */
  telegramId: number;
  /** Auth user ID (Supabase Auth UUID) для веб-юзеров. null для TG-юзеров. */
  authId: string | null;
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
  const clientName = fromBasic || basic.fullName || fromRoot || basic.lastName || `ID ${row.user_telegram_id ?? row.user_auth_id ?? '—'}`;
  return {
    id: row.id as string,
    telegramId: (row.user_telegram_id as number | null) ?? 0,
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
    // Веб-юзеры (через email) имеют telegram_id = NULL — мапим в 0 для совместимости.
    // Для удаления / других операций используем authId fallback.
    telegramId: (row.telegram_id as number | null) ?? 0,
    authId: (row.auth_id as string | null) ?? null,
    name: `${row.first_name ?? row.email ?? 'Без имени'}${row.last_name ? ' ' + row.last_name : ''}`,
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
    // P0-1: UPDATE через /api/admin-update-application (service_key + admin auth).
    // status_log пишется на сервере (передаём from/to). Раньше — anon-key.
    const patch: Record<string, unknown> = { status: dbStatus };
    if (visaFileUrl) patch.visa_file_url = visaFileUrl;
    const statusChanged = prevStatus && prevStatus !== status;
    const r = await apiFetch('/api/admin-update-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        patch,
        status_log: statusChanged
          ? { from_status: prevStatus, to_status: status }
          : undefined,
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error('[updateApplicationStatus] failed:', r.status, body);
      toast.warning(`Не удалось обновить статус: ${r.status}`);
      throw new Error(`admin-update-application failed: ${r.status}`);
    }
  }

  // changedBy / country / visaType / telegramId — used by callers for the
  // notification; больше не нужны здесь (status_log на сервере).
  void changedBy; void country; void visaType; void telegramId;
  // Notification is sent by the caller (Applications.tsx handleSave) to avoid double-send
}

// Allows admin to overwrite the USD rate snapshotted on the application.
// Used when the rate at payment time differs from the default — the finance
// dashboard will recalculate cost-of-goods using this per-app rate.
export async function updateApplicationUsdRate(id: string, rate: number) {
  if (!isSupabaseConfigured()) return;
  const r = await apiFetch('/api/admin-update-application', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, patch: { usd_rate_rub: rate } }),
  });
  if (!r.ok) throw new Error(`updateApplicationUsdRate failed: ${r.status}`);
}

// Per-application tax % (УСН/самозанятый rate may vary; used in finance reports)
export async function updateApplicationTaxPct(id: string, pct: number) {
  if (!isSupabaseConfigured()) return;
  const r = await apiFetch('/api/admin-update-application', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, patch: { tax_pct: pct } }),
  });
  if (!r.ok) throw new Error(`updateApplicationTaxPct failed: ${r.status}`);
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
          // Фильтр deleted_at IS NULL — soft-deleted юзеры (через
          // api/admin-delete-user.js) не показываются в админке.
          // Восстановление: UPDATE users SET deleted_at=NULL WHERE ...
          supabase.from('users').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
          // Считаем активные заявки (не soft-deleted)
          supabase.from('applications').select('user_telegram_id').is('deleted_at', null),
          supabase.from('admin_users').select('telegram_id, role'),
        ]);
        if (usersRes.error) throw usersRes.error;

        const appCounts: Record<number, number> = {};
        (appsRes.data ?? []).forEach((a: Record<string, unknown>) => {
          // user_telegram_id может быть null для веб-юзеров (миграция 031),
          // их заявки в этот счётчик не идут.
          const tid = a.user_telegram_id as number | null;
          if (tid) appCounts[tid] = (appCounts[tid] ?? 0) + 1;
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
  // Раньше делали `supabase.from('users').update(...)` напрямую через anon-key.
  // Миграция 004_rls_telegram_id.sql блокирует UPDATE на public.users для
  // anon → запрос молча проваливался, баланс не менялся.
  //
  // Теперь идём через /api/admin-grant-bonus — он проверяет initData админа
  // и через service_key делает UPDATE + audit-log в одной транзакции.
  const res = await apiFetch('/api/admin-grant-bonus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_telegram_id: telegramId,
      amount,
      add,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[updateUserBonuses] API failed:', res.status, errText);
    throw new Error(`Не удалось обновить бонусы: ${res.status} ${errText}`);
  }
  const data = await res.json().catch(() => ({} as { newBalance?: number }));
  return data.newBalance ?? 0;
}

export async function updateUserStatus(telegramId: number, isInfluencer: boolean) {
  if (!isSupabaseConfigured()) return;
  await supabase.from('users').update({ is_influencer: isInfluencer }).eq('telegram_id', telegramId);
}

/**
 * Soft-delete юзера + каскадно все его заявки/брони.
 * Записи помечаются deleted_at = now() — данные остаются в БД, восстановление
 * через Supabase SQL Editor: UPDATE users SET deleted_at=NULL WHERE ...
 * См. supabase/034_users_soft_delete.sql.
 */
export async function deleteUserSoftly(params: { telegramId?: number; authId?: string | null }): Promise<{
  users: number;
  applications: number;
  hotel_bookings: number;
  flight_bookings: number;
}> {
  const body: Record<string, unknown> = {};
  if (params.telegramId) body.target_telegram_id = params.telegramId;
  if (params.authId) body.target_auth_id = params.authId;

  const res = await apiFetch('/api/admin-delete-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[deleteUserSoftly] API failed:', res.status, errText);
    throw new Error(`Не удалось удалить пользователя: ${res.status} ${errText}`);
  }
  const data = await res.json().catch(() => ({} as { deleted?: Record<string, number> }));
  return data.deleted ?? { users: 0, applications: 0, hotel_bookings: 0, flight_bookings: 0 };
}
