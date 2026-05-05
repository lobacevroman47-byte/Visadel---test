// Vercel Serverless Function — records a referral link click into Supabase
// POST body: { referral_code, telegram_id? }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

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
      console.warn('[track-click] insert returned', r.status, body);
      res.status(200).json({ ok: true, warn: 'insert_failed' });
    }
  } catch (err) {
    console.error('[track-click] error:', err);
    res.status(500).json({ error: String(err) });
  }
}
