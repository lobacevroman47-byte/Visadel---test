// Vercel Cron — processes due reminders and sends Telegram push notifications
// Runs every 5 minutes via vercel.json crons config
// GET /api/process-reminders

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL      = process.env.TELEGRAM_APP_URL ?? process.env.TELEGRAM_MINI_APP_URL;

const MESSAGES = {
  draft: [
    { emoji: '📝', title: 'Незавершённая заявка', body: 'Вы начали оформлять визу, но не завершили. Продолжите — это займёт пару минут!' },
    { emoji: '⏰', title: 'Не забудьте про визу', body: 'Ваша заявка ждёт! Завершите оформление прямо сейчас.' },
    { emoji: '🌍', title: 'Поездка под угрозой?', body: 'Без визы поездка невозможна. Завершите заявку — мы оформим быстро.' },
    { emoji: '💙', title: 'Мы всё ещё ждём вас', body: 'Ваши данные сохранены. Продолжите оформление в пару кликов.' },
    { emoji: '🚀', title: 'Последнее напоминание', body: 'Заявка на визу ждёт завершения. Не откладывайте путешествие!' },
    { emoji: '✈️', title: 'Пора оформить визу!', body: 'Осталось совсем немного до вашей поездки. Завершите заявку сегодня.' },
  ],
  payment: [
    { emoji: '💳', title: 'Осталось только оплатить', body: 'Ваша заявка заполнена — осталось загрузить скриншот оплаты!' },
    { emoji: '💰', title: 'Заявка ждёт оплаты', body: 'Переведите оплату и загрузите скриншот, чтобы мы взяли визу в работу.' },
    { emoji: '⚡', title: 'Не потеряйте заявку', body: 'Заявка заполнена, но оплата ещё не поступила. Завершите за пару минут!' },
    { emoji: '🎯', title: 'Один шаг до визы', body: 'Оплатите заявку и мы сразу возьмём её в работу.' },
    { emoji: '📱', title: 'Ваша заявка почти готова', body: 'Загрузите скриншот оплаты — и мы начнём оформление визы.' },
    { emoji: '🌟', title: 'Напоминаем об оплате', body: 'Завершите оплату, чтобы не потерять своё место в очереди.' },
  ],
};

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function sendTelegramMessage(telegram_id, text, buttonText) {
  const reply_markup = APP_URL ? {
    inline_keyboard: [[
      { text: buttonText, web_app: { url: `${APP_URL}?tab=applications` } }
    ]]
  } : undefined;

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegram_id,
      text,
      parse_mode: 'HTML',
      ...(reply_markup ? { reply_markup } : {}),
    }),
  });
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Allow both GET (cron) and POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).end(); return;
  }

  // Авторизация: либо Vercel cron, либо явный X-Service-Key.
  // Без неё любой URL = массовая рассылка напоминаний всем юзерам.
  const isCron = !!req.headers['x-vercel-cron'];
  const hasServiceKey = SERVICE_KEY && req.headers['x-service-key'] === SERVICE_KEY;
  if (!isCron && !hasServiceKey) {
    res.status(401).json({ error: 'unauthorized — only cron or service key' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY || !BOT_TOKEN) {
    res.status(200).json({ ok: true, skipped: true, reason: 'env not configured' });
    return;
  }

  try {
    // Fetch due, unsent reminders
    const now = new Date().toISOString();
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/reminders?sent=eq.false&scheduled_at=lte.${encodeURIComponent(now)}&select=*`,
      { headers: headers() }
    );
    const reminders = await fetchRes.json();

    if (!Array.isArray(reminders) || reminders.length === 0) {
      res.status(200).json({ ok: true, processed: 0 });
      return;
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // Helper: пометить reminder как обработанный без отправки
    async function markSent(id) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/reminders?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: headers({ Prefer: 'return=minimal' }),
          body: JSON.stringify({ sent: true }),
        }
      );
    }

    for (const reminder of reminders) {
      try {
        // Стале-проверка: если у юзера уже есть заявка по этой стране и типу
        // визы, которая прошла стадию оплаты — не шлём напоминание про оплату/
        // черновик. Иначе ловим "Один шаг до визы" про визу которая уже в
        // работе. Скипаем и помечаем sent=true.
        if (reminder.telegram_id && reminder.country) {
          const filters = [
            `user_telegram_id=eq.${reminder.telegram_id}`,
            `country=eq.${encodeURIComponent(reminder.country)}`,
            // Активные пост-оплатные статусы — заявка уже принята/в работе/готова
            `status=in.(pending_confirmation,in_progress,ready,completed)`,
            'select=id',
            'limit=1',
          ];
          if (reminder.visa_type) {
            filters.splice(2, 0, `visa_type=eq.${encodeURIComponent(reminder.visa_type)}`);
          }
          const checkRes = await fetch(
            `${SUPABASE_URL}/rest/v1/applications?${filters.join('&')}`,
            { headers: headers() }
          );
          const apps = await checkRes.json().catch(() => []);
          if (Array.isArray(apps) && apps.length > 0) {
            console.log(`[process-reminders] skip stale reminder ${reminder.id} — application already past payment for ${reminder.country}`);
            await markSent(reminder.id);
            skipped++;
            continue;
          }
        }

        // Pick message variant based on position in sequence (index of this reminder among same draft_key)
        const fetchSeqRes = await fetch(
          `${SUPABASE_URL}/rest/v1/reminders?draft_key=eq.${encodeURIComponent(reminder.draft_key)}&order=scheduled_at.asc&select=id`,
          { headers: headers() }
        );
        const seq = await fetchSeqRes.json();
        const idx = Array.isArray(seq) ? seq.findIndex(r => r.id === reminder.id) : 0;
        const msgList = MESSAGES[reminder.type] ?? MESSAGES.draft;
        const msg = msgList[Math.min(idx, msgList.length - 1)];

        const countryLine = reminder.country ? `\n🌍 <b>${reminder.country}</b>` : '';
        const text = `${msg.emoji} <b>${msg.title}</b>${countryLine}\n\n${msg.body}`;
        const btnText = reminder.type === 'payment' ? '💳 Оплатить заявку' : '📝 Продолжить заявку';

        await sendTelegramMessage(reminder.telegram_id, text, btnText);

        await markSent(reminder.id);
        sent++;
      } catch (err) {
        console.error(`Failed to process reminder ${reminder.id}:`, err);
        failed++;
      }
    }

    res.status(200).json({ ok: true, processed: reminders.length, sent, failed, skipped });
  } catch (err) {
    console.error('process-reminders error:', err);
    res.status(500).json({ error: String(err) });
  }
}
