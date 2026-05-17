// Server-side audit logger для admin_audit_log table.
//
// Зачем: на фронте уже есть src/app/admin/lib/audit.ts, но он логирует
// только UI-actions через anon-key. Если admin делает действие через API
// напрямую (или фронт обходит auditLog() по забывчивости) — лог не пишется.
// Этот helper гарантирует серверный лог при каждом INSERT/UPDATE/DELETE
// из admin-* endpoints через service_key.
//
// Использование в API handler:
//   import { logAdminAction } from './_lib/audit-log.js';
//
//   await logAdminAction({
//     admin_tg_id: verifiedTgId,
//     admin_name: req.tgUser?.user?.username ?? 'admin',
//     action: 'bonus.grant',
//     target_type: 'user',
//     target_id: String(target_telegram_id),
//     details: { amount: 500, add: true, description: '...' },
//   });
//
// Best-effort: при ошибке логирует warning, но не валит handler — admin
// action всё равно завершается успешно.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

export async function logAdminAction({
  admin_tg_id,
  admin_name = null,
  action,
  target_type = null,
  target_id = null,
  details = {},
}) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn('[audit-log] supabase env not configured — skip');
    return;
  }
  if (!admin_tg_id || !action) {
    console.warn('[audit-log] admin_tg_id and action required');
    return;
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_audit_log`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        admin_tg_id,
        admin_name,
        action,
        target_type,
        target_id: target_id != null ? String(target_id) : null,
        details: details ?? {},
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.warn(`[audit-log] insert failed: ${r.status} ${text}`);
    }
  } catch (err) {
    console.warn('[audit-log] exception:', err?.message ?? err);
  }
}
