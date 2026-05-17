// Vercel Serverless Function — notifies all admins about new submissions.
//
// Auth: Authorization: tma <initData>. customer_telegram игнорируем из body —
// берём из проверенной подписи. Иначе любой мог бы спамить админов от чужого
// имени.
//
// POST { event, ... } or POST { type: 'hotel_booking' | 'flight_booking', customer_name, details }

import { requireTelegramUser, AuthError } from './_lib/telegram-auth.js';
import { setCors } from './_lib/cors.js';
import { rateLimitByIp } from './_lib/rate-limit.js';
import { withSentry, captureException } from './_lib/sentry.js';

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

async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Rate-limit: 10/мин на IP. Защита от спама админам Telegram-уведомлениями
  // (TG API rate-limit + админ задолбается). Нормальный юзер шлёт 1-2/час.
  if (rateLimitByIp(req, { bucket: 'notify-admin', max: 10, windowMs: 60_000 })) {
    res.status(429).json({ error: 'rate limit exceeded' });
    return;
  }

  // Verified Telegram user — customer_telegram возьмём из подписи
  let verified;
  try { verified = requireTelegramUser(req); }
  catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.TELEGRAM_APP_URL ?? process.env.TELEGRAM_MINI_APP_URL;
  if (!token) { res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' }); return; }

  const body = req.body ?? {};
  const {
    event,
    type, // alt routing key used by booking forms
    application_id,
    country, visa_type, price, urgent,
    customer_name,
    review_country, review_rating, review_text,
    details,
  } = body;
  // customer_telegram заменяем на проверенный — никаких подделок
  const customer_telegram = verified.user.username
    ? `@${verified.user.username}`
    : (verified.user.first_name || String(verified.telegramId));

  // Normalise: forms send `type: 'hotel_booking' | 'flight_booking'` instead of `event: 'new_application'`
  const resolvedEvent = type ?? event ?? 'new_application';
  const fmtRub = (n) => (typeof n === 'number' ? n.toLocaleString('ru-RU') + ' ₽' : '—');

  let text;
  if (resolvedEvent === 'new_review') {
    text =
      `⭐ <b>Новый отзыв на модерации</b>\n\n` +
      `🌍 Страна: ${review_country ?? '—'}\n` +
      `Оценка: ${'⭐'.repeat(review_rating ?? 5)}\n\n` +
      `<i>${(review_text ?? '').slice(0, 200)}</i>`;
  } else if (resolvedEvent === 'hotel_booking') {
    const d = details ?? {};
    const nameLine = customer_name ? `<b>${customer_name}</b>` : '<i>Имя не указано</i>';
    const childrenLine = Array.isArray(d.children_ages) && d.children_ages.length > 0
      ? ` + ${d.children_ages.length} реб. (${d.children_ages.join(', ')} лет)`
      : '';
    text =
      `🏨 <b>Новая бронь отеля</b>\n` +
      `${nameLine}\n\n` +
      `📍 ${d.country ?? '—'}, ${d.city ?? '—'}\n` +
      `📅 ${d.check_in ?? '—'} → ${d.check_out ?? '—'}\n` +
      `👥 ${d.guests ?? '—'} гост.${childrenLine}\n` +
      `💰 ${fmtRub(d.price)}\n` +
      (d.telegram_login ? `📱 ${String(d.telegram_login).startsWith('@') ? d.telegram_login : '@' + d.telegram_login}\n` : '') +
      (d.phone ? `☎️ ${d.phone}\n` : '') +
      `\nЗайди в админку → раздел Брони → подтверди оплату.`;
  } else if (resolvedEvent === 'partner_application') {
    const tgUser = body.telegram_username
      ? `@${String(body.telegram_username).replace('@', '')}`
      : customer_telegram;
    text =
      `🎯 <b>Новая заявка на партнёрство</b>\n` +
      `<b>${body.full_name ?? '—'}</b>\n\n` +
      `📱 ${tgUser}\n` +
      `📧 ${body.email ?? '—'}\n` +
      (body.phone ? `☎️ ${body.phone}\n` : '') +
      `\n🔗 <a href="${body.platform_url ?? '#'}">${body.platform_url ?? '—'}</a>\n` +
      (body.audience_theme ? `📊 Тема: ${body.audience_theme}\n` : '') +
      (body.subscribers_count ? `👥 Подписчики: ${Number(body.subscribers_count).toLocaleString('ru-RU')}\n` : '') +
      (body.comment ? `\n💬 ${String(body.comment).slice(0, 300)}\n` : '') +
      `\nЗайди в админку → Заявки на партнёрство → одобри или отклони.`;
  } else if (resolvedEvent === 'flight_booking') {
    const d = details ?? {};
    const nameLine = customer_name ? `<b>${customer_name}</b>` : '<i>Имя не указано</i>';
    text =
      `✈️ <b>Новая бронь авиабилета</b>\n` +
      `${nameLine}\n\n` +
      `📍 ${d.from_city ?? '—'} → ${d.to_city ?? '—'}\n` +
      `📅 ${d.booking_date ?? '—'}\n` +
      `💰 ${fmtRub(d.price)}\n` +
      (d.telegram_login ? `📱 ${String(d.telegram_login).startsWith('@') ? d.telegram_login : '@' + d.telegram_login}\n` : '') +
      (d.phone ? `☎️ ${d.phone}\n` : '') +
      `\nЗайди в админку → раздел Брони → подтверди оплату.`;
  } else {
    // Customer name (Имя + Фамилия) is the most useful piece — make it the title.
    const nameLine = customer_name ? `<b>${customer_name}</b>` : '<i>Имя не указано</i>';
    text =
      `📋 <b>Новая заявка${urgent ? ' · СРОЧНАЯ 🔥' : ''}</b>\n` +
      `${nameLine}\n\n` +
      `🌍 ${country ?? '—'} · ${visa_type ?? ''}\n` +
      `💰 ${price ? `${price.toLocaleString('ru-RU')} ₽` : '—'}\n` +
      (customer_telegram ? `📱 @${String(customer_telegram).replace('@', '')}\n` : '') +
      `\nЗайди в админку и подтверди оплату.`;
  }

  const reply_markup = appUrl ? {
    inline_keyboard: [[
      { text: '⚙️ Открыть админку', web_app: { url: `${appUrl}?admin=true` } }
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
  console.log(`[notify-admin] event=${resolvedEvent} sent=${sent}/${recipients.length} (founders + admin_users)`);
  res.status(200).json({ ok: true, sent, total: recipients.length });
}

export default withSentry(handler);
