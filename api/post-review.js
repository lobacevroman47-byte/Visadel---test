// Vercel Serverless Function — posts review to @visadel_recall channel
// Required env var: TELEGRAM_BOT_TOKEN
// The bot must be admin in @visadel_recall channel

const CHANNEL = '@visadel_recall';
const STARS = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { rating, text, country, username } = req.body ?? {};
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' }); return; }

  const stars = STARS[Math.min(Math.max(rating ?? 5, 1), 5)];
  const authorLine = username ? `— @${username.replace('@', '')}` : '— Пользователь';

  const message =
    `${stars} *Новый отзыв*\n\n` +
    `🌍 Страна: *${(country ?? '').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')}*\n\n` +
    `_"${(text ?? '').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')}"_\n\n` +
    `${authorLine.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')}`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHANNEL,
        text: message,
        parse_mode: 'MarkdownV2',
      })
    });
    const data = await tgRes.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
