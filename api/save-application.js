// Vercel Serverless — INSERT/UPDATE applications через service_key (P0-1 final).
//
// Это последний крупный refactor для закрытия RLS-дыры на applications.
// Раньше фронт делал supabase.from('applications').insert(...).update(...) с
// anon-key — open RLS policy позволяла:
//   1. Создать заявку от имени любого user_telegram_id с подделанным price
//   2. Обновить чужую заявку (status='cancelled', form_data='...')
//   3. Выгрузить ВСЕ заявки всех клиентов с паспортами через
//      GET /rest/v1/applications?select=*
//
// Этот endpoint:
//   - dual-auth (TG initData ИЛИ Supabase JWT для web-юзеров)
//   - user_telegram_id / user_auth_id FORCED из verified источника
//   - INSERT: status оставляется как из body (юзер сам выбирает draft/submitted)
//   - UPDATE: whitelist полей (status, form_data, payment_proof_url, bonuses_used);
//             ownership check — записи только своего telegram_id/auth_id
//   - Retry без application_type если миграция 029 не накатана (PGRST204/42703)
//   - FK violation → возвращаем 409 (раньше был localStorage fallback —
//     теперь фронт сам решает что делать при 409)
//
// Auth:
//   Authorization: tma <initData>  (TG mini-app)
//   ИЛИ
//   Authorization: Bearer <jwt>    (web-юзер)
//
// Returns: { ok: true, application: {...} }

import { setCors } from './_lib/cors.js';
import { rateLimitByIp } from './_lib/rate-limit.js';
import { withSentry, captureException } from './_lib/sentry.js';
import { validate, saveApplicationSchema } from './_lib/validators.js';
import { requireUserAuth } from './_lib/dual-auth.js';
import { AuthError } from './_lib/telegram-auth.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

function dbHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// INSERT с retry без application_type если миграция 029 не накатана.
async function doInsert(payload) {
  const fullPayload = {
    ...payload,
    application_type: payload.application_type ?? 'visa',
  };
  let r = await fetch(`${SUPABASE_URL}/rest/v1/applications`, {
    method: 'POST',
    headers: dbHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(fullPayload),
  });

  // Retry без application_type
  if (!r.ok && (r.status === 400 || r.status === 404)) {
    const errText = await r.text().catch(() => '');
    if (/application_type|PGRST204|42703/i.test(errText)) {
      console.warn('[save-application] application_type column missing, retrying without it');
      const { application_type, ...rest } = fullPayload; // eslint-disable-line no-unused-vars
      r = await fetch(`${SUPABASE_URL}/rest/v1/applications`, {
        method: 'POST',
        headers: dbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(rest),
      });
    }
  }

  return r;
}

// UPDATE по id + ownership check. Whitelist полей.
async function doUpdate(id, ownership, patch) {
  // Whitelist полей — даже если в body пришло больше, обновляем только это.
  const allowed = {};
  if (patch.status !== undefined) allowed.status = patch.status;
  if (patch.form_data !== undefined) allowed.form_data = patch.form_data;
  if (patch.payment_proof_url !== undefined) allowed.payment_proof_url = patch.payment_proof_url;
  if (patch.bonuses_used !== undefined) allowed.bonuses_used = patch.bonuses_used;

  // Ownership: AND (user_telegram_id=? OR user_auth_id=?). Без этого
  // атакующий с своим initData мог бы обновить чужую заявку по id.
  const ownerFilter = ownership.telegramId
    ? `user_telegram_id=eq.${ownership.telegramId}`
    : `user_auth_id=eq.${encodeURIComponent(ownership.authId)}`;

  const url = `${SUPABASE_URL}/rest/v1/applications?id=eq.${encodeURIComponent(id)}&${ownerFilter}&deleted_at=is.null`;

  const r = await fetch(url, {
    method: 'PATCH',
    headers: dbHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(allowed),
  });
  return r;
}

async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  // Rate-limit: 20/мин по IP. Юзер может пересохранять draft несколько раз —
  // плюс автосейв; 20 — щедрый запас.
  if (rateLimitByIp(req, { bucket: 'save-application', max: 20, windowMs: 60_000 })) {
    res.status(429).json({ error: 'rate limit exceeded' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'supabase env not configured' });
    return;
  }

  // Auth: TG initData ИЛИ Supabase JWT
  let auth;
  try {
    auth = await requireUserAuth(req);
  } catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  // Zod валидация
  const parsed = validate(req.body ?? {}, saveApplicationSchema);
  if (!parsed.ok) {
    res.status(400).json({ error: 'invalid input', details: parsed.errors });
    return;
  }
  const d = parsed.data;

  try {
    // ── UPDATE existing application ──
    if (d.id) {
      const r = await doUpdate(d.id, auth, d);
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        console.error('[save-application] update failed:', r.status, text);
        captureException(new Error(`save-application update failed: ${r.status}`), {
          endpoint: 'save-application', op: 'update', supabase_status: r.status,
        });
        res.status(500).json({ error: 'internal error' });
        return;
      }
      const rows = await r.json().catch(() => []);
      if (!Array.isArray(rows) || rows.length === 0) {
        // 0 rows updated → либо id не существует, либо чужой
        res.status(404).json({ error: 'application not found or not owned' });
        return;
      }
      res.status(200).json({ ok: true, application: rows[0] });
      return;
    }

    // ── INSERT new application ──
    // INSERT-only поля обязательны
    if (!d.country) {
      res.status(400).json({ error: 'country required for new application' });
      return;
    }
    if (d.price == null) {
      res.status(400).json({ error: 'price required for new application' });
      return;
    }

    const insertPayload = {
      // user_telegram_id / user_auth_id FORCED из verified источника
      user_telegram_id: auth.telegramId,
      user_auth_id: auth.authId,
      country: d.country,
      visa_type: d.visa_type ?? null,
      visa_id: d.visa_id ?? null,
      price: d.price,
      urgent: d.urgent ?? false,
      status: d.status,
      form_data: d.form_data,
      payment_proof_url: d.payment_proof_url ?? null,
      bonuses_used: d.bonuses_used ?? 0,
      usd_rate_rub: d.usd_rate_rub ?? null,
      tax_pct: d.tax_pct ?? null,
      application_type: d.application_type ?? 'visa',
    };

    const r = await doInsert(insertPayload);
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('[save-application] insert failed:', r.status, text);

      // FK violation (user not in users table) — 409 Conflict
      if (/23503|foreign key/i.test(text)) {
        captureException(new Error('save-application FK violation (user missing)'), {
          endpoint: 'save-application', op: 'insert', supabase_status: r.status,
        });
        res.status(409).json({ error: 'user not found in users table — call upsert-user first' });
        return;
      }

      captureException(new Error(`save-application insert failed: ${r.status}`), {
        endpoint: 'save-application', op: 'insert', supabase_status: r.status,
      });
      res.status(500).json({ error: 'internal error' });
      return;
    }
    const rows = await r.json().catch(() => []);
    const application = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    res.status(200).json({ ok: true, application });
  } catch (err) {
    console.error('[save-application] exception:', err);
    captureException(err, { endpoint: 'save-application' });
    res.status(500).json({ error: 'internal error' });
  }
}

export default withSentry(handler);
