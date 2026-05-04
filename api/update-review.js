// POST /api/update-review  { id, ...fields }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id, ...fields } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'not configured' });

  const resp = await fetch(`${supabaseUrl}/rest/v1/reviews?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(fields),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return res.status(500).json({ error: text });
  }
  return res.status(200).json({ ok: true });
}
