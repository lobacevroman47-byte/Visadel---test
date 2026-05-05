// Vercel Serverless Function — returns total clicks count for a given referral code.
// Uses service key — bypasses RLS so it works regardless of table policies.
// GET /api/referral-clicks-count?code=USR_abc123

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

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
    console.error('[referral-clicks-count] error:', err);
    res.status(200).json({ count: 0, error: String(err) });
  }
}
