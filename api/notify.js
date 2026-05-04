// Vercel Serverless Function — sends Telegram message when visa is ready
// Required env vars (no VITE_ prefix):
//   TELEGRAM_BOT_TOKEN  — bot token from @BotFather
//   TELEGRAM_APP_URL    — your Vercel app URL, e.g. https://visadel.vercel.app

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { telegram_id, country, visa_type } = req.body ?? {};
  if (!telegram_id) { res.status(400).json({ error: 'telegram_id required' }); return; }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.TELEGRAM_APP_URL ?? process.env.TELEGRAM_MINI_APP_URL;

  if (!token) { res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' }); return; }
  if (!appUrl) { res.status(500).json({ error: 'TELEGRAM_APP_URL not configured' }); return; }

  const text =
    `🎉 Ваша виза готова!\n\n` +
    `🌍 Страна: ${country ?? ''}\n` +
    `📄 Тип: ${visa_type ?? ''}\n\n` +
    `Чтобы скачать визу — откройте приложение и оставьте отзыв 🙏\n` +
    `После отзыва виза сразу станет доступна для скачивания.`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegram_id,
        text,
        reply_markup: {
          inline_keyboard: [[
            {
              text: '📥 Открыть в приложении',
              web_app: { url: appUrl }
            }
          ]]
        }
      })
    });
    const data = await tgRes.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
