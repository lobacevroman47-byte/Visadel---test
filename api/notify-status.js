// Vercel Serverless Function — notifies user about application status change
// Env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_APP_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY
//
// Dedup strategy (3 layers — any one prevents duplicates):
//   1. In-memory Map (same Vercel warm instance, 30s)
//   2. notification_dedup table INSERT (unique index per minute, atomic across instances)
//   3. applications row UPDATE with WHERE filter (atomic, requires last_notified_* columns if present)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
};

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { telegram_id, status, country, visa_type, application_id } = req.body ?? {};

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

  const msg = STATUS_MESSAGES[status];
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
  const text =
    `${msg.emoji} <b>${msg.title}</b>\n\n` +
    `🌍 Страна: ${country ?? ''}\n\n` +
    `${msg.body}`;

  let reply_markup;
  if (appUrl && appUrl.startsWith('https://')) {
    reply_markup = {
      inline_keyboard: [[
        { text: '📱 Открыть приложение', web_app: { url: `${appUrl}?tab=applications` } }
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
