// Vercel Cron — processes due reminders and sends Telegram push notifications
// Runs every 5 minutes via vercel.json crons config
// GET /api/process-reminders

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL      = process.env.TELEGRAM_APP_URL ?? process.env.TELEGRAM_MINI_APP_URL;

// 3 шаблона на 1ч → 6ч → 24ч. Категория определяется по префиксу
// draft_key: extension_ / hotel_ / flight_ / иначе виза.
const MESSAGES = {
  draft: [
    { emoji: '📝', title: 'Незавершённая заявка на визу', body: 'Вы начали оформлять визу, но не завершили. Продолжите — это займёт пару минут!' },
    { emoji: '⏰', title: 'Не забудьте про визу', body: 'Ваша заявка ждёт! Завершите оформление, чтобы мы взяли визу в работу.' },
    { emoji: '🌍', title: 'Последнее напоминание о визе', body: 'Без визы поездка невозможна. Завершите заявку — мы оформим быстро.' },
  ],
  payment: [
    { emoji: '💳', title: 'Осталось оплатить визу', body: 'Ваша заявка заполнена — осталось загрузить скриншот оплаты.' },
    { emoji: '💰', title: 'Заявка на визу ждёт оплаты', body: 'Переведите оплату и загрузите скриншот, чтобы мы взяли визу в работу.' },
    { emoji: '⚡', title: 'Заявка скоро удалится', body: 'Оплата ещё не поступила. Завершите оплату — заявка сохранена.' },
  ],
  extension_draft: [
    { emoji: '📝', title: 'Незавершённая заявка на продление', body: 'Вы начали оформлять продление визы, но не завершили. Продолжите за пару минут!' },
    { emoji: '⏰', title: 'Не забудьте про продление', body: 'Заявка на продление визы ждёт. Завершите оформление, чтобы мы взяли её в работу.' },
    { emoji: '🌍', title: 'Последнее напоминание о продлении', body: 'Без продления виза может истечь. Завершите заявку — мы оформим быстро.' },
  ],
  extension_payment: [
    { emoji: '💳', title: 'Осталось оплатить продление', body: 'Заявка на продление заполнена — осталось загрузить скриншот оплаты.' },
    { emoji: '💰', title: 'Продление ждёт оплаты', body: 'Переведите оплату и загрузите скриншот, чтобы мы взяли продление в работу.' },
    { emoji: '⚡', title: 'Продление скоро удалится', body: 'Оплата ещё не поступила. Завершите оплату — заявка сохранена.' },
  ],
  hotel: [
    { emoji: '🏨', title: 'Незавершённая бронь отеля', body: 'Вы начали оформлять бронь отеля, но не завершили. Продолжите за пару минут!' },
    { emoji: '⏰', title: 'Не забудьте про бронь отеля', body: 'Заявка на бронь отеля ждёт. Завершите оформление, чтобы мы взяли её в работу.' },
    { emoji: '🛎️', title: 'Последнее напоминание о броне', body: 'Без подтверждения отеля виза может быть отклонена. Завершите оформление сейчас.' },
  ],
  flight: [
    { emoji: '✈️', title: 'Незавершённая бронь авиабилета', body: 'Вы начали оформлять бронь билета, но не завершили. Продолжите за пару минут!' },
    { emoji: '⏰', title: 'Не забудьте про авиабилет', body: 'Заявка на бронь билета ждёт. Завершите оформление, чтобы мы взяли её в работу.' },
    { emoji: '🛫', title: 'Последнее напоминание', body: 'Завершите бронь авиабилета — без неё виза может быть отклонена.' },
  ],
};

// Определяем категорию по префиксу draft_key. SriLankaExtensionForm пишет
// draft_extension_*, HotelBookingForm — hotel_booking_draft, аналогично flight.
function pickCategory(draftKey, type) {
  if (typeof draftKey === 'string') {
    if (draftKey.startsWith('draft_extension_') || draftKey.includes('extension')) {
      return type === 'payment' ? 'extension_payment' : 'extension_draft';
    }
    if (draftKey.startsWith('hotel_booking') || draftKey === 'hotel_booking_draft') return 'hotel';
    if (draftKey.startsWith('flight_booking') || draftKey === 'flight_booking_draft') return 'flight';
  }
  return type === 'payment' ? 'payment' : 'draft';
}

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function sendTelegramMessage(telegram_id, text, buttonText, tabKey) {
  // tabKey — applications (визы/продления/брони все в Мои заявки таб).
  const reply_markup = APP_URL ? {
    inline_keyboard: [[
      { text: buttonText, web_app: { url: `${APP_URL}?tab=${tabKey || 'applications'}` } }
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
        // Стале-проверка: если юзер уже подал заявку/бронь по этому черновику —
        // не шлём напоминание. Скипаем и помечаем sent=true. Проверяем все
        // 3 таблицы по типу draft_key (applications / hotel_bookings / flight_bookings).
        const category = pickCategory(reminder.draft_key, reminder.type);
        let stale = false;

        if ((category === 'hotel' || category === 'flight') && reminder.telegram_id) {
          // Бронь: смотрим в hotel_bookings / flight_bookings — если есть
          // запись юзера с любым активным статусом, draft уже завершён.
          const table = category === 'hotel' ? 'hotel_bookings' : 'flight_bookings';
          const filters = [
            `telegram_id=eq.${reminder.telegram_id}`,
            `status=in.(pending_confirmation,in_progress,confirmed,completed)`,
            'select=id',
            'limit=1',
          ];
          const checkRes = await fetch(
            `${SUPABASE_URL}/rest/v1/${table}?${filters.join('&')}`,
            { headers: headers() }
          );
          const rows = await checkRes.json().catch(() => []);
          if (Array.isArray(rows) && rows.length > 0) stale = true;
        } else if (reminder.telegram_id && reminder.country) {
          // Виза / продление: смотрим в applications по стране+типу.
          // Активные пост-оплатные статусы — заявка уже принята/в работе/готова.
          const filters = [
            `user_telegram_id=eq.${reminder.telegram_id}`,
            `country=eq.${encodeURIComponent(reminder.country)}`,
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
          if (Array.isArray(apps) && apps.length > 0) stale = true;
        }

        if (stale) {
          console.log(`[process-reminders] skip stale reminder ${reminder.id} — entry already submitted (${category})`);
          await markSent(reminder.id);
          skipped++;
          continue;
        }

        // Pick message variant based on position in sequence (index of this reminder among same draft_key)
        const fetchSeqRes = await fetch(
          `${SUPABASE_URL}/rest/v1/reminders?draft_key=eq.${encodeURIComponent(reminder.draft_key)}&order=scheduled_at.asc&select=id`,
          { headers: headers() }
        );
        const seq = await fetchSeqRes.json();
        const idx = Array.isArray(seq) ? seq.findIndex(r => r.id === reminder.id) : 0;
        // Категория = тип контента + стадия (draft/payment). Visa → MESSAGES.draft/payment,
        // продление → extension_draft/extension_payment, отель/билет — свои наборы.
        const category = pickCategory(reminder.draft_key, reminder.type);
        const msgList = MESSAGES[category] ?? MESSAGES.draft;
        const msg = msgList[Math.min(idx, msgList.length - 1)];

        const countryLine = reminder.country ? `\n🌍 <b>${reminder.country}</b>` : '';
        const text = `${msg.emoji} <b>${msg.title}</b>${countryLine}\n\n${msg.body}`;
        // Кнопка в зависимости от стадии (заполнение / оплата).
        const isPaymentStage = reminder.type === 'payment';
        const btnText = isPaymentStage
          ? (category === 'hotel' ? '💳 Оплатить бронь' : category === 'flight' ? '💳 Оплатить билет' : category.startsWith('extension') ? '💳 Оплатить продление' : '💳 Оплатить заявку')
          : (category === 'hotel' ? '🏨 Продолжить бронь' : category === 'flight' ? '✈️ Продолжить бронь' : category.startsWith('extension') ? '📝 Продолжить продление' : '📝 Продолжить заявку');

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
