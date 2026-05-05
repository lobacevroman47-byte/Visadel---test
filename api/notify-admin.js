// Vercel Serverless Function — notifies all admins about a new application.
// POST { event, application_id, country, visa_type, price, urgent, customer_name, customer_telegram }
//
// event: 'new_application' (default) | 'new_review'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

async function getAdminIds() {
  if (!SUPABASE_URL || !SERVICE_KEY) return [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?select=telegram_id`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const data = await r.json();
    return Array.isArray(data) ? data.map(u => u.telegram_id).filter(Boolean) : [];
  } catch (err) {
    console.warn('[notify-admin] failed to fetch admin ids', err);
    return [];
  }
}

async function sendTg(token, chat_id, text, reply_markup) {
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', ...(reply_markup ? { reply_markup } : {}) }),
  }).then(r => r.json()).catch(err => ({ ok: false, err }));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.TELEGRAM_APP_URL ?? process.env.TELEGRAM_MINI_APP_URL;
  if (!token) { res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' }); return; }

  const {
    event = 'new_application',
    application_id,
    country, visa_type, price, urgent,
    customer_name, customer_telegram,
    review_country, review_rating, review_text,
  } = req.body ?? {};

  let text;
  if (event === 'new_review') {
    text =
      `⭐ <b>Новый отзыв на модерации</b>\n\n` +
      `🌍 Страна: ${review_country ?? '—'}\n` +
      `Оценка: ${'⭐'.repeat(review_rating ?? 5)}\n\n` +
      `<i>${(review_text ?? '').slice(0, 200)}</i>`;
  } else {
    text =
      `📋 <b>Новая заявка${urgent ? ' (СРОЧНАЯ 🔥)' : ''}</b>\n\n` +
      `🌍 ${country ?? '—'} · ${visa_type ?? ''}\n` +
      `💰 ${price ? `${price.toLocaleString('ru-RU')} ₽` : '—'}\n` +
      (customer_name ? `👤 ${customer_name}\n` : '') +
      (customer_telegram ? `📱 @${String(customer_telegram).replace('@', '')}\n` : '') +
      `\nЗайди в админку и подтверди оплату.`;
  }

  const reply_markup = appUrl ? {
    inline_keyboard: [[
      { text: '⚙️ Открыть админку', web_app: { url: `${appUrl}?admin=1` } }
    ]],
  } : undefined;

  const admins = await getAdminIds();
  if (admins.length === 0) {
    console.warn('[notify-admin] no admins to notify');
    res.status(200).json({ ok: true, sent: 0, warn: 'no_admins' });
    return;
  }

  const results = await Promise.all(
    admins.map(id => sendTg(token, id, text, reply_markup))
  );
  const sent = results.filter(r => r.ok).length;
  console.log(`[notify-admin] event=${event} sent=${sent}/${admins.length}`);
  res.status(200).json({ ok: true, sent, total: admins.length });
}
