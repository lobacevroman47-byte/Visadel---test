// Vercel Serverless — admin обновляет бронь через service_key (P0-1).
//
// Закрывает дыру: update_hotel_bookings / update_flight_bookings
// USING(true) — любой с anon-key мог менять чужие брони (status, цену
// комиссии, confirmation_url).
//
// Этот endpoint:
//   - requireAdminUser
//   - whitelist полей (status, deleted_at, confirmation_url,
//     partner_commission_pct/amount_rub/status)
//   - service_key UPDATE
//   - admin_audit_log
//
// Auth: Authorization: tma <initData> (админ)
// Body: {
//   id: uuid,
//   table: 'hotel_bookings' | 'flight_bookings',
//   patch: { status?, deleted_at?, confirmation_url?, ... }
// }
// Returns: { ok: true, booking }

import { requireAdminUser, AuthError } from './_lib/telegram-auth.js';
import { setCors } from './_lib/cors.js';
import { rateLimitByIp } from './_lib/rate-limit.js';
import { withSentry, captureException } from './_lib/sentry.js';
import { logAdminAction } from './_lib/audit-log.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

const ALLOWED_TABLES = new Set(['hotel_bookings', 'flight_bookings']);

// Поля которые админ может менять.
const ALLOWED_FIELDS = new Set([
  'status', 'deleted_at', 'confirmation_url',
  'partner_commission_pct', 'partner_commission_amount_rub', 'partner_commission_status',
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

  if (rateLimitByIp(req, { bucket: 'admin-update-booking', max: 60, windowMs: 60_000 })) {
    res.status(429).json({ error: 'rate limit exceeded' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'supabase env not configured' });
    return;
  }

  let admin;
  try {
    admin = requireAdminUser(req);
  } catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  const { id, table, patch } = req.body ?? {};
  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'id required' });
    return;
  }
  if (!ALLOWED_TABLES.has(table)) {
    res.status(400).json({ error: 'table must be hotel_bookings or flight_bookings' });
    return;
  }
  if (!patch || typeof patch !== 'object') {
    res.status(400).json({ error: 'patch required' });
    return;
  }

  // Whitelist полей
  const safePatch = {};
  for (const [k, v] of Object.entries(patch)) {
    if (ALLOWED_FIELDS.has(k)) safePatch[k] = v;
  }
  if (Object.keys(safePatch).length === 0) {
    res.status(400).json({ error: 'no allowed fields in patch' });
    return;
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: dbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(safePatch),
      }
    );
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('[admin-update-booking] update failed:', r.status, text);
      captureException(new Error(`admin-update-booking failed: ${r.status}`), {
        endpoint: 'admin-update-booking',
      });
      res.status(500).json({ error: 'internal error' });
      return;
    }
    const rows = await r.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(404).json({ error: 'booking not found' });
      return;
    }

    await logAdminAction({
      admin_tg_id: admin.telegramId,
      admin_name: admin.user?.username ? `@${admin.user.username}` : (admin.user?.first_name ?? null),
      action: safePatch.deleted_at ? 'booking.soft_delete' : 'booking.update',
      target_type: table,
      target_id: id,
      details: { changed_fields: Object.keys(safePatch), status: safePatch.status },
    });

    res.status(200).json({ ok: true, booking: rows[0] });
  } catch (err) {
    console.error('[admin-update-booking] exception:', err);
    captureException(err, { endpoint: 'admin-update-booking' });
    res.status(500).json({ error: 'internal error' });
  }
}

export default withSentry(handler);
