// Vercel Serverless — schedule draft / payment abandonment reminders
//
// Auth: требует Authorization: tma <initData>. telegram_id берётся из подписи,
// не из тела — иначе любой мог бы спамить чужой Telegram-чат рекламой через
// напоминания.
//
// POST { draft_key, country, visa_type, type: 'draft'|'payment' }
// (telegram_id больше не принимается из тела — verified из initData)

import { requireTelegramUser, AuthError } from './_lib/telegram-auth.js';
import { setCors } from './_lib/cors.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Reminder intervals in minutes — 1h / 6h / 24h.
// По требованию: «если черновик более 1 часа не оплачен — уведомление,
// потом через 6 часов уведомление и на следующий день через 24 часа».
// Использует cron /api/process-reminders который тикает каждые 5 минут.
const INTERVALS = [60, 360, 1440]; // 1h, 6h, 24h

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).end(); return; }

  // Verified Telegram user — никаких telegram_id из body
  let telegram_id;
  try {
    telegram_id = requireTelegramUser(req).telegramId;
  } catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  const { draft_key, country, visa_type, type } = req.body ?? {};
  if (!draft_key) {
    res.status(400).json({ error: 'draft_key required' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    // No DB configured — silently skip (dev mode)
    res.status(200).json({ ok: true, skipped: true });
    return;
  }

  try {
    // 1. Cancel any existing unsent reminders for this draft_key
    await fetch(`${SUPABASE_URL}/rest/v1/reminders?draft_key=eq.${encodeURIComponent(draft_key)}&sent=eq.false`, {
      method: 'DELETE',
      headers: headers(),
    });

    // 2. Insert new reminders
    const now = new Date();
    const rows = INTERVALS.map(mins => ({
      telegram_id,
      draft_key,
      country: country ?? '',
      visa_type: visa_type ?? '',
      type: type ?? 'draft',
      scheduled_at: new Date(now.getTime() + mins * 60 * 1000).toISOString(),
      sent: false,
    }));

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/reminders`, {
      method: 'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(rows),
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      throw new Error(`Insert failed: ${err}`);
    }

    res.status(200).json({ ok: true, scheduled: rows.length });
  } catch (err) {
    console.error('schedule-reminders error:', err);
    res.status(500).json({ error: String(err) });
  }
}
