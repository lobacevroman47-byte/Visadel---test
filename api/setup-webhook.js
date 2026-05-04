// Visit /api/setup-webhook once to register Telegram webhook
export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.TELEGRAM_APP_URL ?? process.env.TELEGRAM_MINI_APP_URL;

  if (!token || !appUrl) {
    res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN or app URL not configured' });
    return;
  }

  const webhookUrl = `${appUrl}/api/webhook`;
  const tgRes = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&allowed_updates=["channel_post"]`
  );
  const data = await tgRes.json();
  res.status(200).json({ webhookUrl, telegram: data });
}
