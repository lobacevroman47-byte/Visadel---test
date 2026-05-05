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
  cost: number;
  bonusesUsed: number;
  status: 'draft' | 'pending_payment' | 'pending_confirmation' | 'in_progress' | 'completed';
  date: string;
  urgent: boolean;
  formData: Record<string, unknown>;
  paymentProofUrl?: string;
  visaFileUrl?: string;
  telegramId: number;
}

export interface AdminUser {
  id: string;
  telegramId: number;
  name: string;
  username: string;
  phone: string;
  email: string;
  bonusBalance: number;
  status: 'regular' | 'partner';
  registeredAt: string;
  applicationsCount: number;
}

const FLAG_MAP: Record<string, string> = {
  'Индия': '🇮🇳', 'Вьетнам': '🇻🇳', 'Шри-Ланка': '🇱🇰',
  'Южная Корея': '🇰🇷', 'Израиль': '🇮🇱', 'Пакистан': '🇵🇰',
  'Камбоджа': '🇰🇭', 'Кения': '🇰🇪',
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
  return {
    id: row.id as string,
    telegramId: row.user_telegram_id as number,
    clientName: basic.fullName ?? basic.lastName ?? `ID ${row.user_telegram_id}`,
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    telegram: contact.telegram ?? '',
    country: row.country as string,
    countryFlag: FLAG_MAP[row.country as string] ?? '🌍',
    visaType: row.visa_type as string,
    cost: row.price as number,
    bonusesUsed: (row.bonuses_used as number) ?? 0,
    status: STATUS_MAP[row.status as string] ?? 'draft',
    date: row.created_at as string,
    urgent: row.urgent as boolean,
    formData: fd,
    paymentProofUrl: row.payment_proof_url as string | undefined,
    visaFileUrl: row.visa_file_url as string | undefined,
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
          cost: (a.totalPrice as number) ?? 0,
          bonusesUsed: (a.bonusesUsed as number) ?? 0,
          status: 'pending_confirmation',
          date: (a.createdAt as string) ?? new Date().toISOString(),
          urgent: Boolean(a.urgent),
          formData: (a.formData as Record<string, unknown>) ?? {},
        }));
        setApplications([...lsMapped, ...mockApplications.map(m => ({ ...m, telegramId: 0, formData: {} }))]);
      }
    } catch (err) {
      console.error('Fetch applications error:', err);
      setApplications(mockApplications.map(m => ({ ...m, telegramId: 0, formData: {} })));
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

    // Log status change to audit trail (skip if status didn't actually change)
    if (prevStatus && prevStatus !== status) {
      try {
        await supabase.from('status_log').insert({
          application_id: id,
          from_status: prevStatus,
          to_status: status,
          changed_by_id: changedBy?.id ?? null,
          changed_by_name: changedBy?.name ?? null,
        });
      } catch (e) { console.warn('status log insert failed', e); }
    }
  }

  // Notification is sent by the caller (Applications.tsx handleSave) to avoid double-send
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

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data: usersData, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        const { data: appsData } = await supabase.from('applications').select('user_telegram_id');
        const appCounts: Record<number, number> = {};
        (appsData ?? []).forEach((a: Record<string, unknown>) => {
          const tid = a.user_telegram_id as number;
          appCounts[tid] = (appCounts[tid] ?? 0) + 1;
        });
        setUsers((usersData as Record<string, unknown>[]).map(u => rowToUser(u, appCounts[u.telegram_id as number] ?? 0)));
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
}

export async function updateUserStatus(telegramId: number, isInfluencer: boolean) {
  if (!isSupabaseConfigured()) return;
  await supabase.from('users').update({ is_influencer: isInfluencer }).eq('telegram_id', telegramId);
}
