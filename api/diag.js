// Диагностический endpoint — НЕ раскрывает секреты, только статусы.
// Открой в браузере: https://<твой-домен>/api/diag
// Покажет что выставлено, что нет, и попробует сделать тестовый
// getMe в Telegram-бот.
//
// Безопасно держать в проде: ничего не пишет, не возвращает токены.

export default async function handler(req, res) {
  const out = {
    timestamp: new Date().toISOString(),
    env: {
      TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN
        ? `set (${process.env.TELEGRAM_BOT_TOKEN.length} chars)` : 'MISSING',
      TELEGRAM_APP_URL: process.env.TELEGRAM_APP_URL || process.env.TELEGRAM_MINI_APP_URL || 'MISSING',
      ADMIN_TELEGRAM_IDS_server: process.env.ADMIN_TELEGRAM_IDS || 'MISSING',
      VITE_ADMIN_TELEGRAM_IDS: process.env.VITE_ADMIN_TELEGRAM_IDS || 'MISSING',
      VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL ? 'set' : 'MISSING',
      SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY
        ? `set (${process.env.SUPABASE_SERVICE_KEY.length} chars)` : 'MISSING',
    },
    bot: { tested: false },
  };

  // Тест: getMe в Telegram bot. Если токен валиден — вернётся username.
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    out.bot.tested = true;
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await r.json();
      if (data.ok) {
        out.bot.ok = true;
        out.bot.username = data.result.username;
        out.bot.id = data.result.id;
      } else {
        out.bot.ok = false;
        out.bot.error = data.description || 'unknown';
      }
    } catch (e) {
      out.bot.ok = false;
      out.bot.error = e instanceof Error ? e.message : String(e);
    }
  }

  // Тест: можно ли отправить DM первому admin'у из env (он должен был
  // нажать /start в боте — иначе Telegram запретит).
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS ?? process.env.VITE_ADMIN_TELEGRAM_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);
  out.adminCount = adminIds.length;

  if (token && adminIds.length > 0) {
    const firstAdmin = adminIds[0];
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: firstAdmin,
          text: `🧪 Тест уведомлений · ${new Date().toLocaleTimeString('ru-RU')}\n\nЭто диагностика — endpoint /api/diag отправил тестовое сообщение. Если ты это видишь, бот работает.`,
        }),
      });
      const data = await r.json();
      out.testSend = {
        target: firstAdmin,
        ok: data.ok,
        error: data.ok ? null : (data.description || 'unknown'),
        hint: !data.ok && /chat not found|bot was blocked|user is deactivated/i.test(data.description ?? '')
          ? '⚠️ Скорее всего этот юзер не нажал /start в боте либо забанил его. Открой бота в Telegram и нажми Start.'
          : null,
      };
    } catch (e) {
      out.testSend = { target: firstAdmin, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
}
