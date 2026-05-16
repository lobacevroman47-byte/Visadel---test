// Vercel Serverless Function — referral click tracking + count.
// POST { referral_code, telegram_id? } → inserts a click row
// GET  ?code=USR_xxx → returns { count: N }
// Uses service key — bypasses RLS so it works regardless of table policies.
//
// ⚠️ SECURITY:
// - Валидация формата referral_code (предотвращает мусор в БД)
// - Rate-limit по IP (anti-spam: 30 POST/мин, 60 GET/мин на IP)
// - CORS whitelist (visadel.agency / *.vercel.app / telegram.org)
// - referral_code length cap + alphanumeric+underscore only

import { setCors } from './_lib/cors.js';
import { rateLimitByIp } from './_lib/rate-limit.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

// Формат реф-кода: VIS_xxxx, USR_xxxx или vanity (ANYA). Допускаем буквы,
// цифры, подчёркивание. Максимум 32 символа. Минимум 2.
const REF_CODE_RE = /^[A-Za-z0-9_]{2,32}$/;

function isValidRefCode(code) {
  return typeof code === 'string' && REF_CODE_RE.test(code);
}

export default async function handler(req, res) {
  if (setCors(req, res)) return; // OPTIONS обработан

  // ─── GET: return click count for a referral code ─────────────────────────
  if (req.method === 'GET') {
    // Rate-limit GET: 60/мин на IP. GET достаётся часто (UI обновляет count),
    // но не критично если иногда блокируется.
    if (rateLimitByIp(req, { bucket: 'track-click-get', max: 60, windowMs: 60_000 })) {
      res.status(429).json({ error: 'rate limit exceeded' });
      return;
    }

    const code = req.query?.code;
    if (!isValidRefCode(code)) {
      res.status(400).json({ error: 'invalid code' });
      return;
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      res.status(200).json({ count: 0 });
      return;
    }
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/referral_clicks?referral_code=eq.${encodeURIComponent(code)}&select=id`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            'Prefer': 'count=exact',
            'Range-Unit': 'items',
            'Range': '0-0',
          },
        }
      );
      const contentRange = r.headers.get('content-range') ?? '';
      const match = /\/(\d+)$/.exec(contentRange);
      const count = match ? parseInt(match[1], 10) : 0;
      res.status(200).json({ count });
    } catch (err) {
      console.error('[track-click GET] error:', err);
      res.status(200).json({ count: 0 });
    }
    return;
  }

  // ─── POST: insert a click row ────────────────────────────────────────────
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Rate-limit POST: 30/мин на IP. Реальная ситуация — 1-2 POST за сессию,
  // 30/мин — щедрый лимит, который убивает только bot-флуд.
  if (rateLimitByIp(req, { bucket: 'track-click-post', max: 30, windowMs: 60_000 })) {
    res.status(429).json({ error: 'rate limit exceeded' });
    return;
  }

  const { referral_code, telegram_id } = req.body ?? {};
  if (!isValidRefCode(referral_code)) {
    res.status(400).json({ error: 'invalid referral_code' });
    return;
  }
  // telegram_id опционален, но если есть — должен быть числом (не строкой/объектом).
  const tgId = telegram_id == null ? null
    : (typeof telegram_id === 'number' && Number.isFinite(telegram_id) ? telegram_id : null);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(200).json({ ok: true, skipped: 'no_db' });
    return;
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/referral_clicks`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        referral_code,
        telegram_id: tgId,
      }),
    });
    if (r.status === 201 || r.status === 204) {
      res.status(200).json({ ok: true });
    } else {
      const body = await r.text().catch(() => '');
      console.warn('[track-click POST] insert returned', r.status, body);
      // Не раскрываем детали клиенту (information disclosure).
      res.status(200).json({ ok: true, warn: 'insert_failed' });
    }
  } catch (err) {
    console.error('[track-click POST] error:', err);
    res.status(500).json({ error: 'internal error' });
  }
}
