// Vercel Serverless Function — notifies user about application status change
// Env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_APP_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY
//
// Auth:
//   - Service key (cron / process-reminders) — может уведомить любого
//   - Admin (ADMIN_TELEGRAM_IDS) — может уведомить любого
//   - Обычный user — может уведомить ТОЛЬКО себя (telegram_id из подписи).
// Без auth (анонимно) — отказ. Иначе любой мог бы спамить чужой Telegram.

import { requireTelegramUser, isAdminId, AuthError } from './_lib/telegram-auth.js';
//
// Dedup strategy (3 layers — any one prevents duplicates):
//   1. In-memory Map (same Vercel warm instance, 30s)
//   2. notification_dedup table INSERT (unique index per minute, atomic across instances)
//   3. applications row UPDATE with WHERE filter (atomic, requires last_notified_* columns if present)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

const STATUS_MESSAGES = {
  pending_confirmation: {
    emoji: '📋',
    title: 'Заявка получена!',
    body: 'Мы получили вашу заявку и проверяем оплату. Скоро возьмём в работу.',
  },
  in_progress: {
    emoji: '⚙️',
    title: 'Заявка в работе!',
    body: 'Ваша виза уже оформляется. Мы сообщим, как только будет готова.',
  },
  ready: {
    emoji: '🎉',
    title: 'Ваша виза готова!',
    body: 'Откройте приложение, оставьте отзыв и скачайте визу.',
  },
  completed: {
    emoji: '🎉',
    title: 'Ваша виза готова!',
    body: 'Откройте приложение, оставьте отзыв и скачайте визу.',
  },
  pending_payment: {
    emoji: '💳',
    title: 'Ожидаем оплату',
    body: 'Пожалуйста, оплатите заявку и загрузите скриншот перевода.',
  },
  // Booking-специфичные статусы. Раздельно для отеля и авиа — title
  // меняется в зависимости от типа («Бронь отеля готова!» vs «Бронь
  // авиабилета готова!»), чтобы клиент сразу понял о чём речь без
  // строки «Страна:» в теле (для авиа есть Москва→Бангкок, для отеля
  // страна уже в title).
  booking_in_progress_hotel: {
    emoji: '⚙️',
    title: 'Бронь отеля в работе',
    body: 'Мы взяли вашу бронь отеля в работу. Скоро пришлём подтверждение.',
  },
  booking_in_progress_flight: {
    emoji: '⚙️',
    title: 'Бронь авиабилета в работе',
    body: 'Мы взяли вашу бронь авиабилета в работу. Скоро пришлём подтверждение.',
  },
  booking_confirmed_hotel: {
    emoji: '🎉',
    title: 'Бронь отеля готова!',
    body: 'Откройте приложение → Мои брони, чтобы скачать подтверждение.',
  },
  booking_confirmed_flight: {
    emoji: '🎉',
    title: 'Бронь авиабилета готова!',
    body: 'Откройте приложение → Мои брони, чтобы скачать подтверждение.',
  },
  booking_cancelled_hotel: {
    emoji: '⚠️',
    title: 'Бронь отеля отменена',
    body: 'Если это ошибка — свяжитесь с нами в Telegram.',
  },
  booking_cancelled_flight: {
    emoji: '⚠️',
    title: 'Бронь авиабилета отменена',
    body: 'Если это ошибка — свяжитесь с нами в Telegram.',
  },
  // Старые универсальные ключи — для backwards-compatibility (если где-то
  // ещё шлются). Можно удалить позже.
  booking_in_progress: { emoji: '⚙️', title: 'Бронь в работе',  body: 'Мы взяли вашу бронь в работу. Скоро пришлём подтверждение.' },
  booking_confirmed:   { emoji: '🎉', title: 'Бронь готова!',    body: 'Откройте приложение → Мои брони, чтобы скачать подтверждение.' },
  booking_cancelled:   { emoji: '⚠️', title: 'Бронь отменена', body: 'Если это ошибка — свяжитесь с нами в Telegram.' },
};

// Партнёрские события — динамические сообщения (используют body.amount).
// Открывают partner_dashboard в Mini App вместо обычного applications.
const PARTNER_STATUSES = new Set([
  'partner_referral_paid',
  'partner_hold_approved',
  'partner_payout_processed',
  'partner_application_approved',
  'partner_application_rejected',
]);

function buildPartnerMessage(status, { amount, country, source, card_last4, reject_reason }) {
  const amt = `${(amount ?? 0).toLocaleString('ru-RU')}₽`;
  const sourceLabel = source === 'hotel' ? 'бронь отеля'
                    : source === 'flight' ? 'бронь авиабилета'
                    : 'визу';
  switch (status) {
    case 'partner_referral_paid': {
      // Дата когда сумма станет доступна (через 30 дней hold-периода).
      const approvedAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const approvedDate = approvedAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      return {
        emoji: '💰',
        title: `Партнёрская комиссия +${amt}`,
        body: `Ваш реферал оплатил ${sourceLabel}${country ? ` (${country})` : ''}.\n\n`
            + `<b>${amt}</b> станет доступно к выплате ${approvedDate} — после 30-дневного hold-периода.\n\n`
            + `<i>Hold защищает от refund клиента: если клиент отменит заказ в течение 30 дней, комиссия аннулируется.</i>`,
      };
    }
    case 'partner_hold_approved':
      return {
        emoji: '✅',
        title: `+${amt} доступно к выплате`,
        body: `Hold-период закончился. ${amt} теперь в вашем партнёрском балансе.\n\n`
            + `Ближайшая выплата на карту — в течение 2 недель.`,
      };
    case 'partner_payout_processed':
      return {
        emoji: '💸',
        title: `Выплата ${amt} отправлена`,
        body: `Деньги переведены на вашу карту${card_last4 ? ` •• ${card_last4}` : ''}.\n\n`
            + `Спасибо за партнёрство 🤝`,
      };
    case 'partner_application_approved':
      return {
        emoji: '🎉',
        title: 'Заявка на партнёрство одобрена',
        body: `Поздравляем! Теперь вы партнёр Visadel Agency.\n\n`
            + `Открой Профиль → <b>Партнёрский кабинет</b> чтобы получить свою реф-ссылку, vanity-код, и заполнить реквизиты для выплат.\n\n`
            + `<i>До 20% с каждого заказа реферала. Hold 30 дней.</i>`,
      };
    case 'partner_application_rejected':
      return {
        emoji: '😔',
        title: 'Заявка на партнёрство отклонена',
        body: `К сожалению, мы не смогли одобрить заявку.\n\n`
            + (reject_reason ? `<b>Причина:</b> ${reject_reason}\n\n` : '')
            + `Через 7 дней можно подать новую заявку.`,
      };
    default:
      return null;
  }
}

// ─── Layer 1: in-memory dedup ─────────────────────────────────────────────────
const recentSends = new Map();
function isDuplicateInMemory(application_id, status) {
  const key = `${application_id || 'no_id'}:${status}`;
  const last = recentSends.get(key);
  if (last && Date.now() - last < 60_000) return true;
  recentSends.set(key, Date.now());
  if (recentSends.size > 200) {
    const cutoff = Date.now() - 120_000;
    for (const [k, ts] of recentSends) { if (ts < cutoff) recentSends.delete(k); }
  }
  return false;
}

function dbHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

// ─── Layer 2: insert into notification_dedup table ───────────────────────────
// Returns 'new' | 'duplicate' | 'unavailable' (table missing or DB error)
async function insertDedupRow(application_id, status) {
  if (!application_id || !SUPABASE_URL || !SERVICE_KEY) return 'unavailable';
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/notification_dedup`, {
      method: 'POST',
      headers: { ...dbHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ application_id, status }),
    });
    if (res.status === 201 || res.status === 204) return 'new';
    if (res.status === 409) return 'duplicate';
    const body = await res.text().catch(() => '');
    console.warn('[notify-status] dedup table insert unexpected status:', res.status, body);
    return 'unavailable';
  } catch (err) {
    console.warn('[notify-status] dedup table insert error:', err);
    return 'unavailable';
  }
}

async function deleteDedupRow(application_id, status) {
  if (!application_id || !SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/notification_dedup?application_id=eq.${encodeURIComponent(application_id)}&status=eq.${encodeURIComponent(status)}`,
      { method: 'DELETE', headers: dbHeaders() }
    );
  } catch (err) {
    console.warn('[notify-status] dedup row delete error:', err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data, X-Service-Key');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Auth flow:
  //   1) X-Service-Key matches → service call, target_telegram_id = body.telegram_id
  //   2) verified initData → если админ, target = body.telegram_id;
  //                          если обычный юзер, target принудительно = его собственный ID
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const isServiceCall = SERVICE_KEY && req.headers['x-service-key'] === SERVICE_KEY;
  let verifiedTgId = null;
  let isAdminCaller = false;
  if (!isServiceCall) {
    try {
      const verified = requireTelegramUser(req);
      verifiedTgId = verified.telegramId;
      isAdminCaller = isAdminId(verifiedTgId);
    } catch (err) {
      const status = err instanceof AuthError ? (err.status || 401) : 500;
      res.status(status).json({ error: err.message || 'auth failed' });
      return;
    }
  }

  const body = req.body ?? {};
  const { status, country, visa_type, application_id, amount, source, card_last4, reject_reason } = body;
  // user — только себе; admin / service — кому угодно
  const telegram_id = (isServiceCall || isAdminCaller) ? body.telegram_id : verifiedTgId;

  console.log('[notify-status] called:', { telegram_id, status, country, application_id });

  if (!telegram_id || !status) {
    res.status(400).json({ error: 'telegram_id and status required' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.TELEGRAM_APP_URL ?? process.env.TELEGRAM_MINI_APP_URL;

  if (!token) {
    console.error('[notify-status] TELEGRAM_BOT_TOKEN not set');
    res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
    return;
  }

  const isPartnerEvent = PARTNER_STATUSES.has(status);
  const msg = isPartnerEvent
    ? buildPartnerMessage(status, { amount, country, source, card_last4, reject_reason })
    : STATUS_MESSAGES[status];
  if (!msg) {
    console.error('[notify-status] unknown status:', status);
    res.status(400).json({ error: `Unknown status: "${status}"` });
    return;
  }

  // ── Layer 1: in-memory dedup (same Vercel instance) ───────────────────────
  if (isDuplicateInMemory(application_id, status)) {
    console.log('[notify-status] in-memory dedup skip:', application_id, status);
    res.status(200).json({ ok: true, skipped: 'in_memory' });
    return;
  }

  // ── Layer 2: DB atomic dedup via notification_dedup unique constraint ─────
  const dbDedup = await insertDedupRow(application_id, status);
  if (dbDedup === 'duplicate') {
    console.log('[notify-status] DB dedup skip:', application_id, status);
    res.status(200).json({ ok: true, skipped: 'db_duplicate' });
    return;
  }
  // 'new' or 'unavailable' → proceed to send

  // ── Build message ─────────────────────────────────────────────────────────
  // «🌍 Страна:» строку добавляем ТОЛЬКО для визовых событий — для брони
  // авиабилета это нерелевантно (есть Москва→Бангкок, единой страны нет),
  // для брони отеля страна уже в title (например «Бронь отеля готова!»).
  // Партнёрские события свою историю строят сами.
  const isBookingEvent = typeof status === 'string' && status.startsWith('booking_');
  const text = (isPartnerEvent || isBookingEvent)
    ? `${msg.emoji} <b>${msg.title}</b>\n\n${msg.body}`
    : `${msg.emoji} <b>${msg.title}</b>\n\n🌍 Страна: ${country ?? ''}\n\n${msg.body}`;

  // Партнёрские события открывают partner_dashboard, обычные — applications.
  let reply_markup;
  if (appUrl && appUrl.startsWith('https://')) {
    const dashboardUrl = isPartnerEvent
      ? `${appUrl}?tab=partner_dashboard`
      : `${appUrl}?tab=applications`;
    const buttonText = isPartnerEvent ? '👑 Партнёрский кабинет' : '📱 Открыть приложение';
    reply_markup = {
      inline_keyboard: [[
        { text: buttonText, web_app: { url: dashboardUrl } }
      ]]
    };
  }

  // ── Send Telegram ─────────────────────────────────────────────────────────
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegram_id,
        text,
        parse_mode: 'HTML',
        ...(reply_markup ? { reply_markup } : {}),
      }),
    });

    const data = await tgRes.json();
    console.log('[notify-status] Telegram response:', JSON.stringify(data));

    if (!data.ok) {
      const errMsg = `Telegram error ${data.error_code}: ${data.description}`;
      console.error('[notify-status]', errMsg);
      // Release dedup slot so admin can retry
      if (dbDedup === 'new') await deleteDedupRow(application_id, status);
      res.status(400).json({ error: errMsg });
      return;
    }

    res.status(200).json({ ok: true, sent: true, message_id: data.result?.message_id });
  } catch (err) {
    console.error('[notify-status] fetch error:', err);
    if (dbDedup === 'new') await deleteDedupRow(application_id, status);
    res.status(500).json({ error: String(err) });
  }
}
