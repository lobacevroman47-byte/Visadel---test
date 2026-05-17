// Vercel Serverless — INSERT в reviews через service_key (закрывает P0-1 RLS).
//
// Раньше фронт делал supabase.from('reviews').insert({...}) с anon-key —
// работало только потому что миграция 033 поставила открытую policy
// `reviews_anon_insert WITH CHECK (true)`. Это значит атакующий с anon-key
// мог писать ОТЗЫВЫ ОТ ИМЕНИ ЛЮБОГО ЮЗЕРА с любым text/rating.
//
// Этот endpoint:
//   - проверяет initData (telegram_id из подписи, нельзя подделать)
//   - валидирует через Zod (rating 1-5, text 1-2000, country, application_id)
//   - INSERT через service_key с FORCED user_telegram_id из подписи
//   - status всегда 'pending' (модерация)
//
// После полной миграции и применения супабейс-миграции 038, политика
// `reviews_anon_insert` будет закрыта → только service_key сможет писать.
//
// Auth: Authorization: tma <initData>
// Body: { application_id, country, rating: 1-5, text }
// Returns: { ok: true, id }

import { requireTelegramUser, AuthError } from './_lib/telegram-auth.js';
import { setCors } from './_lib/cors.js';
import { rateLimitByIp } from './_lib/rate-limit.js';
import { withSentry, captureException } from './_lib/sentry.js';
import { validate, saveReviewSchema } from './_lib/validators.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  // Rate-limit: отзывы пишут редко (1 на заявку), 5/мин по IP — анти-spam.
  if (rateLimitByIp(req, { bucket: 'save-review', max: 5, windowMs: 60_000 })) {
    res.status(429).json({ error: 'rate limit exceeded' });
    return;
  }

  // Auth: telegram_id ОБЯЗАТЕЛЬНО из подписи — не из body
  let verifiedTgId;
  try {
    verifiedTgId = requireTelegramUser(req).telegramId;
  } catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'supabase env not configured' });
    return;
  }

  // Zod валидация
  const parsed = validate(req.body ?? {}, saveReviewSchema);
  if (!parsed.ok) {
    res.status(400).json({ error: 'invalid input', details: parsed.errors });
    return;
  }
  const { application_id, booking_id, booking_type, country, rating, text } = parsed.data;

  try {
    // Отзыв либо на заявку, либо на бронь. saveReviewSchema через .refine
    // гарантирует что заполнен ровно один источник.
    const reviewRow = {
      user_telegram_id: verifiedTgId, // ← FORCED, не из body
      country,
      rating,
      text,
      status: 'pending',
    };
    if (application_id) {
      reviewRow.application_id = application_id;
    } else {
      reviewRow.booking_id = booking_id;
      reviewRow.booking_type = booking_type;
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/reviews`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(reviewRow),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('[save-review] insert failed:', r.status, errText);
      captureException(new Error(`save-review insert failed: ${r.status}`), {
        endpoint: 'save-review',
        supabase_status: r.status,
      });
      // Не выдаём supabase error клиенту (information disclosure)
      res.status(500).json({ error: 'internal error' });
      return;
    }
    const rows = await r.json().catch(() => []);
    const id = Array.isArray(rows) && rows.length > 0 ? rows[0].id : null;

    res.status(200).json({ ok: true, id });
  } catch (err) {
    console.error('[save-review] exception:', err);
    captureException(err, { endpoint: 'save-review' });
    res.status(500).json({ error: 'internal error' });
  }
}

export default withSentry(handler);
