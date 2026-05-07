// Audit log helper: каждое значимое админское действие сохраняется
// строкой в admin_audit_log. Использовать как:
//
//   await auditLog('application.status_change', {
//     target_type: 'application',
//     target_id: app.id,
//     details: { from: 'pending_confirmation', to: 'in_progress' },
//   });
//
// Если БД не настроена / таблица отсутствует — фейлим тихо (best-effort).

import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface AuditPayload {
  target_type?: string;
  target_id?: string | number | null;
  details?: Record<string, unknown>;
}

function getAdminTg(): { id: number; name: string } {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number; first_name?: string; username?: string } } } } }).Telegram?.WebApp;
    const u = tg?.initDataUnsafe?.user;
    return {
      id: u?.id ?? 0,
      name: u?.username ? `@${u.username}` : (u?.first_name ?? 'unknown'),
    };
  } catch { return { id: 0, name: 'unknown' }; }
}

export async function auditLog(action: string, payload: AuditPayload = {}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const admin = getAdminTg();
  if (!admin.id) return;
  try {
    await supabase.from('admin_audit_log').insert({
      admin_tg_id: admin.id,
      admin_name: admin.name,
      action,
      target_type: payload.target_type ?? null,
      target_id: payload.target_id !== undefined && payload.target_id !== null ? String(payload.target_id) : null,
      details: payload.details ?? {},
    });
  } catch (e) {
    console.warn('[audit] failed:', e);
  }
}

export interface AuditLogRow {
  id: string;
  admin_tg_id: number;
  admin_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export async function getAuditLog(limit = 200): Promise<AuditLogRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.warn('[audit] read failed:', error); return []; }
  return (data as AuditLogRow[]) ?? [];
}
