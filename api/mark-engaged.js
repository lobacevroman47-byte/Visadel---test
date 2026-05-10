// Vercel Serverless — отметить юзера как «engaged» через service_key.
//
// Зачем: миграция 004 включила RLS на public.users и заблокировала UPDATE
// для anon. Direct supabase.from('users').update({engaged_at:...}) с фронта
// silently fail → engaged_at никогда не ставится → партнёр всегда видит
// «Регистраций: 0» даже когда друзья реально открывают мини-апп.
//
// Этот endpoint обходит RLS через service_key. Вызывается из App.tsx
// при первой навигации с home → ставит engaged_at = now() ТОЛЬКО если
// ещё null (idempotent).
//
// Auth: tma <initData>. telegram_id из подписи, нельзя подделать.
//
// POST body: {} — никаких параметров не нужно.

import { requireTelegramUser, AuthError } from './_lib/telegram-auth.js';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let verifiedTgId = null;
  try {
    const verified = requireTelegramUser(req);
    verifiedTgId = verified.telegramId;
  } catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(200).json({ ok: true, skipped: 'no_db' });
    return;
  }

  try {
    // UPDATE engaged_at = now() WHERE telegram_id = X AND engaged_at IS NULL
    // engaged_at IS NULL гарантирует idempotency — повторные вызовы не
    // меняют первоначальную дату «когда юзер впервые engagement сделал».
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${verifiedTgId}&engaged_at=is.null`,
      {
        method: 'PATCH',
        headers: headers({ Prefer: 'return=representation' }),
        body: JSON.stringify({ engaged_at: new Date().toISOString() }),
      },
    );
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('[mark-engaged] PATCH failed:', r.status, errText);
      res.status(500).json({ error: 'update failed' });
      return;
    }
    const rows = await r.json().catch(() => []);
    // rows.length === 0 значит либо уже стоял engaged_at, либо юзера нет
    // (в обоих случаях OK — не считается ошибкой).
    res.status(200).json({ ok: true, updated: Array.isArray(rows) ? rows.length : 0 });
  } catch (err) {
    console.error('[mark-engaged] error:', err?.message ?? err);
    res.status(500).json({ error: String(err) });
  }
}
