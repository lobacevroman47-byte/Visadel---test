// Vercel Serverless Function — notifies user about application status change
// Env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_APP_URL (or TELEGRAM_MINI_APP_URL)

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
  pending_payment: {
    emoji: '💳',
    title: 'Ожидаем оплату',
    body: 'Пожалуйста, оплатите заявку и загрузите скриншот перевода.',
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { telegram_id, status, country, visa_type } = req.body ?? {};
  if (!telegram_id || !status) {
    res.status(400).json({ error: 'telegram_id and status required' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.TELEGRAM_APP_URL ?? process.env.TELEGRAM_MINI_APP_URL;

  if (!token) { res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' }); return; }

  const msg = STATUS_MESSAGES[status];
  if (!msg) { res.status(400).json({ error: 'Unknown status' }); return; }

  const text =
    `${msg.emoji} ${msg.title}\n\n` +
    `🌍 Страна: ${country ?? ''}\n` +
    `📄 Тип: ${visa_type ?? ''}\n\n` +
    `${msg.body}`;

  const reply_markup = appUrl ? {
    inline_keyboard: [[
      { text: '📱 Открыть приложение', web_app: { url: `${appUrl}?tab=applications` } }
    ]]
  } : undefined;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegram_id, text, ...(reply_markup ? { reply_markup } : {}) }),
    });
    const data = await tgRes.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
