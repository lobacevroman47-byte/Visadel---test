// Vercel Serverless Function — notifies all admins about a new application.
// POST { event, application_id, country, visa_type, price, urgent, customer_name, customer_telegram }
//
// event: 'new_application' (default) | 'new_review'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

// Founders come from env (VITE_ADMIN_TELEGRAM_IDS or ADMIN_TELEGRAM_IDS).
// They are NOT stored in admin_users table — must merge them in manually.
function getFounderIds() {
  const raw = process.env.VITE_ADMIN_TELEGRAM_IDS ?? process.env.ADMIN_TELEGRAM_IDS ?? '';
  return raw.split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => Number.isFinite(n));
}

// All staff (founders + admins + moderators), deduplicated.
async function getAllStaffIds() {
  const founders = getFounderIds();
  let dbAdmins = [];
  if (SUPABASE_URL && SERVICE_KEY) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?select=telegram_id`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      const data = await r.json();
      if (Array.isArray(data)) {
        dbAdmins = data.map(u => Number(u.telegram_id)).filter(n => Number.isFinite(n));
      }
    } catch (err) {
      console.warn('[notify-admin] failed to fetch admin_users', err);
    }
  }
  return Array.from(new Set([...founders, ...dbAdmins]));
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

  const recipients = await getAllStaffIds();
  if (recipients.length === 0) {
    console.warn('[notify-admin] no staff to notify (no founders in env, no admin_users rows)');
    res.status(200).json({ ok: true, sent: 0, warn: 'no_staff' });
    return;
  }

  const results = await Promise.all(
    recipients.map(id => sendTg(token, id, text, reply_markup))
  );
  const sent = results.filter(r => r.ok).length;
  console.log(`[notify-admin] event=${event} sent=${sent}/${recipients.length} (founders + admin_users)`);
  res.status(200).json({ ok: true, sent, total: recipients.length });
}
