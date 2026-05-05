// Vercel Serverless — cancel pending reminders for a draft (when application submitted)
// POST { draft_key }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const { draft_key } = req.body ?? {};
  if (!draft_key) {
    res.status(400).json({ error: 'draft_key required' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(200).json({ ok: true, skipped: true });
    return;
  }

  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/reminders?draft_key=eq.${encodeURIComponent(draft_key)}&sent=eq.false`,
      {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ sent: true }),
      }
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('cancel-reminders error:', err);
    res.status(500).json({ error: String(err) });
  }
}
