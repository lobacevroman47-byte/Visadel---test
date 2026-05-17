// Vercel Serverless — INSERT в flight_bookings через service_key (P0-1).
// Аналогично save-hotel-booking, см. там обоснование.

import { setCors } from './_lib/cors.js';
import { rateLimitByIp } from './_lib/rate-limit.js';
import { withSentry, captureException } from './_lib/sentry.js';
import { validate, saveFlightBookingSchema } from './_lib/validators.js';
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

async function getReferrerCode({ telegramId, authId }) {
  try {
    const filter = telegramId
      ? `telegram_id=eq.${telegramId}`
      : `auth_id=eq.${encodeURIComponent(authId)}`;
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/users?${filter}&select=referred_by&limit=1`,
      { headers: dbHeaders() }
    );
    const rows = await r.json().catch(() => []);
    return rows?.[0]?.referred_by ?? null;
  } catch {
    return null;
  }
}

async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  if (rateLimitByIp(req, { bucket: 'save-flight-booking', max: 10, windowMs: 60_000 })) {
    res.status(429).json({ error: 'rate limit exceeded' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'supabase env not configured' });
    return;
  }

  let auth;
  try {
    auth = await requireUserAuth(req);
  } catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  const parsed = validate(req.body ?? {}, saveFlightBookingSchema);
  if (!parsed.ok) {
    res.status(400).json({ error: 'invalid input', details: parsed.errors });
    return;
  }
  const d = parsed.data;

  try {
    const referrerCode = await getReferrerCode(auth);

    const row = {
      telegram_id: auth.telegramId,
      auth_id: auth.authId,
      username: auth.user?.username ?? d.username ?? null,
      first_name: d.first_name.trim(),
      last_name: d.last_name.trim(),
      from_city: d.from_city.trim(),
      to_city: d.to_city.trim(),
      booking_date: d.booking_date,
      email: d.email.trim(),
      phone: d.phone.trim(),
      telegram_login: d.telegram_login.trim(),
      passport_url: d.passport_url ?? null,
      payment_screenshot_url: d.payment_screenshot_url ?? null,
      price: d.price,
      extra_fields: d.extra_fields ?? null,
      referrer_code: referrerCode,
      status: 'pending_confirmation',
    };

    const r = await fetch(`${SUPABASE_URL}/rest/v1/flight_bookings`, {
      method: 'POST',
      headers: dbHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('[save-flight-booking] insert failed:', r.status, text);
      captureException(new Error(`save-flight-booking insert failed: ${r.status}`), {
        endpoint: 'save-flight-booking',
        supabase_status: r.status,
      });
      res.status(500).json({ error: 'internal error' });
      return;
    }
    const rows = await r.json().catch(() => []);
    const id = Array.isArray(rows) && rows.length > 0 ? rows[0].id : null;

    res.status(200).json({ ok: true, id });
  } catch (err) {
    console.error('[save-flight-booking] exception:', err);
    captureException(err, { endpoint: 'save-flight-booking' });
    res.status(500).json({ error: 'internal error' });
  }
}

export default withSentry(handler);
