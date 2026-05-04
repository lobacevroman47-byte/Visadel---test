// POST /api/update-review  { id, ...fields }
// When status becomes 'approved', also posts to Telegram channel

const CHANNEL = '@visadel_recall';
const STARS = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];

async function supabaseGet(url, key, id) {
  const res = await fetch(`${url}/rest/v1/reviews?id=eq.${encodeURIComponent(id)}&select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const data = await res.json();
  return data?.[0] ?? null;
}

async function supabasePatch(url, key, id, fields) {
  const res = await fetch(`${url}/rest/v1/reviews?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(fields),
  });
  return res.ok;
}

async function postToTelegram(token, review) {
  const stars = STARS[Math.min(review.rating, 5)] ?? '⭐⭐⭐⭐⭐';
  const name = review.author_name && review.author_name !== 'Клиент'
    ? `— ${review.author_name}` : '';
  const country = review.country && review.country !== 'Не указана'
    ? `\nСтрана: ${review.country}` : '';

  const text = `${stars}${country}\n\n"${review.text}"${name ? `\n\n${name}` : ''}`;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHANNEL, text, parse_mode: '' }),
  });
  return res.ok;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id, ...fields } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'not configured' });

  // Apply patch to Supabase
  const ok = await supabasePatch(supabaseUrl, serviceKey, id, fields);
  if (!ok) return res.status(500).json({ error: 'supabase patch failed' });

  // If approving → post to Telegram channel
  if (fields.status === 'approved') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      const review = await supabaseGet(supabaseUrl, serviceKey, id);
      if (review) await postToTelegram(token, review);
    }
  }

  return res.status(200).json({ ok: true });
}
