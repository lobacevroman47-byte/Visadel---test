// Vercel Serverless Function — notifies user about application status change
// Env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_APP_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY

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

function dbHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Atomic slot claim via PostgreSQL RPC.
// Returns true → this instance owns the send.
// Returns false → another instance already sent (within 60s for same status).
// If status changed → always returns true (new status always sends).
async function claimSlot(application_id, status) {
  if (!application_id || !SUPABASE_URL || !SERVICE_KEY) {
    console.warn('[notify-status] no DB config — skipping atomic dedup');
    return true; // no DB → allow (fall back to in-memory dedup only)
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_notification_slot`, {
      method: 'POST',
      headers: dbHeaders(),
      body: JSON.stringify({ p_application_id: application_id, p_status: status }),
    });
    const claimed = await res.json();
    console.log('[notify-status] claimSlot result:', claimed, 'status:', res.status);
    if (res.status !== 200) {
      console.error('[notify-status] claimSlot error response:', claimed);
      return true; // on error → allow (better to double-send than silently drop)
    }
    return claimed === true;
  } catch (err) {
    console.warn('[notify-status] claimSlot fetch error:', err);
    return true; // on network error → allow
  }
}

// Release slot on Telegram failure so admin can retry immediately
async function releaseSlot(application_id) {
  if (!application_id || !SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/applications?id=eq.${encodeURIComponent(application_id)}`,
      {
        method: 'PATCH',
        headers: { ...dbHeaders(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ last_notified_at: null, last_notified_status: null }),
      }
    );
  } catch (err) {
    console.warn('[notify-status] releaseSlot error:', err);
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

  // ── Atomic dedup via PostgreSQL RPC ───────────────────────────────────────
  // Uses row-level locking inside claim_notification_slot():
  //   - Different status → always sends (status changed = new notification)
  //   - Same status within 60s → only first caller sends, second is blocked
  const owned = await claimSlot(application_id, status);
  if (!owned) {
    console.log('[notify-status] slot not acquired — duplicate suppressed:', application_id, status);
    res.status(200).json({ ok: true, skipped: 'duplicate' });
    return;
  }

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

  // ── Send to Telegram ──────────────────────────────────────────────────────
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
      // Release slot so admin can retry
      await releaseSlot(application_id);
      res.status(400).json({ error: errMsg });
      return;
    }

    res.status(200).json({ ok: true, sent: true, message_id: data.result?.message_id });
  } catch (err) {
    console.error('[notify-status] fetch error:', err);
    await releaseSlot(application_id);
    res.status(500).json({ error: String(err) });
  }
}
