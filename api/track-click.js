// Vercel Serverless Function — referral click tracking + count.
// POST { referral_code, telegram_id? } → inserts a click row
// GET  ?code=USR_xxx → returns { count: N }
// Uses service key — bypasses RLS so it works regardless of table policies.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ─── GET: return click count for a referral code ─────────────────────────
  if (req.method === 'GET') {
    const code = req.query?.code;
    if (!code) {
      res.status(400).json({ error: 'code required' });
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
      res.status(200).json({ count: 0, error: String(err) });
    }
    return;
  }

  // ─── POST: insert a click row ────────────────────────────────────────────
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { referral_code, telegram_id } = req.body ?? {};
  if (!referral_code) {
    res.status(400).json({ error: 'referral_code required' });
    return;
  }
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
        telegram_id: telegram_id ?? null,
      }),
    });
    if (r.status === 201 || r.status === 204) {
      res.status(200).json({ ok: true });
    } else {
      const body = await r.text().catch(() => '');
      console.warn('[track-click POST] insert returned', r.status, body);
      res.status(200).json({ ok: true, warn: 'insert_failed', status: r.status });
    }
  } catch (err) {
    console.error('[track-click POST] error:', err);
    res.status(500).json({ error: String(err) });
  }
}
