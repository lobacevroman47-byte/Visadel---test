// Vercel Serverless — admin обновляет заявку через service_key (P0-1).
//
// Закрывает дыру: applications_anon_update USING(true) — любой с anon-key
// мог менять/портить ЛЮБУЮ заявку (status, deleted_at, и т.д.).
//
// Этот endpoint:
//   - requireAdminUser (telegram_id ∈ ADMIN_TELEGRAM_IDS)
//   - whitelist полей которые админ может менять (status, visa_file_url,
//     usd_rate_rub, tax_pct, deleted_at) — ничего сверх этого
//   - service_key UPDATE
//   - опционально пишет в status_log (audit trail смены статуса)
//   - пишет в admin_audit_log
//
// Auth: Authorization: tma <initData> (админ из мини-аппа)
// Body: {
//   id: uuid,
//   patch: { status?, visa_file_url?, usd_rate_rub?, tax_pct?, deleted_at? },
//   status_log?: { from_status, to_status }   // optional audit
// }
// Returns: { ok: true, application }

import { requireAdminUser, AuthError } from './_lib/telegram-auth.js';
import { setCors } from './_lib/cors.js';
import { rateLimitByIp } from './_lib/rate-limit.js';
import { withSentry, captureException } from './_lib/sentry.js';
import { logAdminAction } from './_lib/audit-log.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

// Поля которые админ имеет право менять. Всё остальное в patch игнорируется.
const ALLOWED_FIELDS = new Set([
  'status', 'visa_file_url', 'usd_rate_rub', 'tax_pct', 'deleted_at',
]);

const VALID_STATUSES = new Set([
  'draft', 'submitted', 'pending_confirmation', 'pending_payment',
  'in_progress', 'ready', 'completed', 'cancelled',
]);

function dbHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  if (rateLimitByIp(req, { bucket: 'admin-update-application', max: 60, windowMs: 60_000 })) {
    res.status(429).json({ error: 'rate limit exceeded' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'supabase env not configured' });
    return;
  }

  // Auth: только админ
  let admin;
  try {
    admin = requireAdminUser(req);
  } catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  const { id, patch, status_log } = req.body ?? {};
  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'id required' });
    return;
  }
  if (!patch || typeof patch !== 'object') {
    res.status(400).json({ error: 'patch required' });
    return;
  }

  // Whitelist: только разрешённые поля
  const safePatch = {};
  for (const [k, v] of Object.entries(patch)) {
    if (ALLOWED_FIELDS.has(k)) safePatch[k] = v;
  }
  if (Object.keys(safePatch).length === 0) {
    res.status(400).json({ error: 'no allowed fields in patch' });
    return;
  }
  // Валидация status
  if (safePatch.status !== undefined && !VALID_STATUSES.has(safePatch.status)) {
    res.status(400).json({ error: 'invalid status' });
    return;
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/applications?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: dbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(safePatch),
      }
    );
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('[admin-update-application] update failed:', r.status, text);
      captureException(new Error(`admin-update-application failed: ${r.status}`), {
        endpoint: 'admin-update-application',
      });
      res.status(500).json({ error: 'internal error' });
      return;
    }
    const rows = await r.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(404).json({ error: 'application not found' });
      return;
    }

    // status_log — audit trail смены статуса (best-effort)
    if (status_log && status_log.from_status && status_log.to_status
        && status_log.from_status !== status_log.to_status) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/status_log`, {
          method: 'POST',
          headers: dbHeaders({ Prefer: 'return=minimal' }),
          body: JSON.stringify({
            application_id: id,
            from_status: status_log.from_status,
            to_status: status_log.to_status,
            changed_by_id: admin.telegramId,
            changed_by_name: admin.user?.username ? `@${admin.user.username}` : (admin.user?.first_name ?? null),
          }),
        });
      } catch (e) {
        console.warn('[admin-update-application] status_log insert non-fatal:', e);
      }
    }

    // admin_audit_log
    await logAdminAction({
      admin_tg_id: admin.telegramId,
      admin_name: admin.user?.username ? `@${admin.user.username}` : (admin.user?.first_name ?? null),
      action: safePatch.deleted_at ? 'application.soft_delete' : 'application.update',
      target_type: 'application',
      target_id: id,
      details: { changed_fields: Object.keys(safePatch), status: safePatch.status },
    });

    res.status(200).json({ ok: true, application: rows[0] });
  } catch (err) {
    console.error('[admin-update-application] exception:', err);
    captureException(err, { endpoint: 'admin-update-application' });
    res.status(500).json({ error: 'internal error' });
  }
}

export default withSentry(handler);
