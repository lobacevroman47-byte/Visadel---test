// Vercel Serverless Function — posts review to @visadel_recall channel
//
// Auth: Authorization: tma <initData>. Без проверки любой мог бы постить
// поддельные отзывы в публичный канал от имени бота.
// Username для подписи берётся из проверенного initData, не из body.
//
// Required env var: TELEGRAM_BOT_TOKEN
// The bot must be admin in @visadel_recall channel

import { requireTelegramUser, AuthError } from './_lib/telegram-auth.js';
import { setCors } from './_lib/cors.js';
import { rateLimitByIp } from './_lib/rate-limit.js';

const CHANNEL = '@visadel_recall';
const STARS = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Rate-limit: 5/мин на IP. Отзывы пишут раз в жизни, 5/мин убивает спам
  // в публичный канал без помех для нормальных юзеров.
  if (rateLimitByIp(req, { bucket: 'post-review', max: 5, windowMs: 60_000 })) {
    res.status(429).json({ error: 'rate limit exceeded' });
    return;
  }

  let verified;
  try { verified = requireTelegramUser(req); }
  catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  const { rating, text, country } = req.body ?? {};
  // Username из проверенного user, не из body
  const username = verified.user.username
    ? `@${verified.user.username}`
    : verified.user.first_name || '';
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
