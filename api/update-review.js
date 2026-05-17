// POST /api/update-review  { id, ...fields }
//
// Auth: admin-only. Без проверки любой мог бы апрувить/реджектить отзывы
// или выставлять любой статус.
//
// Также пишет в admin_audit_log — все изменения отзывов отслеживаются.

import { requireAdminUser, AuthError } from './_lib/telegram-auth.js';
import { setCors } from './_lib/cors.js';
import { logAdminAction } from './_lib/audit-log.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  let verifiedAdmin = null;
  let verifiedTgId = null;
  try {
    const verified = requireAdminUser(req);
    verifiedTgId = verified.telegramId;
    verifiedAdmin = verified.user;
  } catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  const { id, ...fields } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'not configured' });

  const resp = await fetch(`${supabaseUrl}/rest/v1/reviews?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(fields),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error('[update-review] PATCH failed:', resp.status, text);
    return res.status(500).json({ error: 'internal error' });
  }

  // Audit log: фиксируем что именно поменяли. Сам text не выгружаем
  // (privacy + объём), только список изменённых ключей и status если был.
  await logAdminAction({
    admin_tg_id: verifiedTgId,
    admin_name: verifiedAdmin?.username ? `@${verifiedAdmin.username}` : (verifiedAdmin?.first_name ?? null),
    action: 'review.update',
    target_type: 'review',
    target_id: id,
    details: {
      changed_fields: Object.keys(fields),
      status: typeof fields.status === 'string' ? fields.status : undefined,
    },
  });

  return res.status(200).json({ ok: true });
}
