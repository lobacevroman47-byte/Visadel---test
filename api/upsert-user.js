// Vercel Serverless — создание/обновление юзера через service_key.
//
// Зачем: миграция 004_rls_telegram_id.sql включила RLS на public.users
// и оставила только SELECT-политику для authenticated. INSERT и UPDATE
// для anon заблокированы. Из-за этого:
//   • Новые юзеры по реф-ссылке НЕ создаются (insert blocked) → нет
//     записи с referred_by → партнёр не видит регистраций.
//   • Update name/photo для существующих юзеров silently fail.
//
// Этот endpoint обходит RLS через service_key.
//
// Auth: требует Authorization: tma <initData>. telegram_id берём из
// проверенной подписи (нельзя подделать).
//
// POST body (всё опционально):
//   { first_name, last_name, username, photo_url, referred_by }
// Возвращает: { user: <full row>, isNew: boolean, welcomeBonusGranted: boolean }

import { requireTelegramUser, AuthError } from './_lib/telegram-auth.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Тот же формат что generateReferralCode на фронте: USR_<id_base36>.
function generateReferralCode(telegramId) {
  return `USR_${telegramId.toString(36).toUpperCase()}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let verifiedTgId = null;
  let verifiedTgUser = null;
  try {
    const verified = requireTelegramUser(req);
    verifiedTgId = verified.telegramId;
    verifiedTgUser = verified.user;
  } catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'supabase not configured' });
    return;
  }

  const body = req.body ?? {};
  // Имя/фото из initData (приоритет) — это canonical Telegram-данные,
  // не позволяем юзеру переписать их подложенными значениями.
  const first_name = verifiedTgUser?.first_name ?? body.first_name ?? '';
  const last_name  = verifiedTgUser?.last_name  ?? body.last_name  ?? null;
  const username   = verifiedTgUser?.username   ?? body.username   ?? null;
  const photo_url  = verifiedTgUser?.photo_url  ?? body.photo_url  ?? null;

  // Резолвим реф-код на сервере (не на фронте через anon-key, который RLS
  // блокирует). Принимаем либо canonical (USR_XXX) либо vanity (PIRAT).
  // Frontend может прислать любой — резолвим в canonical через service_key.
  const referredByInput = (body.referred_by ?? '').toString().trim();
  let referred_by = null;
  if (referredByInput) {
    try {
      // Сначала пробуем как canonical (быстрее — exact match).
      const codeRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(referredByInput)}&select=referral_code&limit=1`,
        { headers: headers() },
      );
      const codeRows = await codeRes.json().catch(() => []);
      if (Array.isArray(codeRows) && codeRows[0]?.referral_code) {
        referred_by = codeRows[0].referral_code;
      } else {
        // Не canonical — пробуем vanity (UPPERCASE для case-insensitive).
        const vanityRes = await fetch(
          `${SUPABASE_URL}/rest/v1/users?vanity_code=eq.${encodeURIComponent(referredByInput.toUpperCase())}&select=referral_code&limit=1`,
          { headers: headers() },
        );
        const vanityRows = await vanityRes.json().catch(() => []);
        if (Array.isArray(vanityRows) && vanityRows[0]?.referral_code) {
          referred_by = vanityRows[0].referral_code;
        }
      }
      if (!referred_by) {
        console.warn(`[upsert-user] referral_code "${referredByInput}" not found (neither canonical nor vanity)`);
      }
    } catch (e) {
      console.warn('[upsert-user] referral resolve failed:', e);
    }
  }
  // Self-referral guard: нельзя приписать самого себя как своего реферера
  // (приходит при тестировании founder с собственной ссылкой).
  // Без этого пара (telegram_id=X, referred_by=USR_X) ломает воронку
  // (юзер сам себе реферер).
  if (referred_by) {
    const selfCode = `USR_${verifiedTgId.toString(36).toUpperCase()}`;
    if (referred_by === selfCode) {
      console.warn(`[upsert-user] self-referral blocked for ${verifiedTgId}`);
      referred_by = null;
    }
  }

  try {
    // Проверяем существует ли юзер
    const existRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${verifiedTgId}&select=*`,
      { headers: headers() },
    );
    const existRows = await existRes.json().catch(() => []);
    const existing = Array.isArray(existRows) && existRows.length > 0 ? existRows[0] : null;

    if (existing) {
      // UPDATE name/photo. Реферер пристёгивается ТОЛЬКО если ещё NULL —
      // раз привязали навсегда, но если предыдущей привязки не было
      // (юзер открыл апп без ссылки → потом открыл по ссылке) — ставим.
      // Это критично для случая: друг уже зарегистрирован в боте, потом
      // партнёр кидает ему ссылку — без этого upsert просто игнорил referredBy.
      const updateBody = { first_name, last_name, username, photo_url };
      let referrerJustAttached = false;
      if (referred_by && !existing.referred_by) {
        updateBody.referred_by = referred_by;
        referrerJustAttached = true;
      }
      const updRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${verifiedTgId}`,
        {
          method: 'PATCH',
          headers: headers({ Prefer: 'return=representation' }),
          body: JSON.stringify(updateBody),
        },
      );
      const updRows = await updRes.json().catch(() => []);
      const user = (Array.isArray(updRows) && updRows.length > 0) ? updRows[0] : existing;

      // Welcome бонус существующему юзеру если он ВПЕРВЫЕ привязался к рефереру.
      // (Эквивалент логики «приветственный бонус по реф-ссылке» при первой
      // встрече ссылки.)
      let welcomeBonusGranted = false;
      if (referrerJustAttached) {
        try {
          const settingsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/app_settings?id=eq.1&select=new_user_welcome_bonus`,
            { headers: headers() },
          );
          const settings = (await settingsRes.json().catch(() => []))?.[0];
          const welcomeBonus = Number.isFinite(settings?.new_user_welcome_bonus) ? settings.new_user_welcome_bonus : 0;
          if (welcomeBonus > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/bonus_logs`, {
              method: 'POST',
              headers: headers({ Prefer: 'return=minimal' }),
              body: JSON.stringify({
                telegram_id: verifiedTgId,
                type: 'welcome',
                amount: welcomeBonus,
                description: `+${welcomeBonus}₽ приветственный бонус (привязка к рефереру)`,
              }),
            });
            // Также инкрементим bonus_balance юзера
            const newBalance = (user.bonus_balance ?? 0) + welcomeBonus;
            await fetch(
              `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${verifiedTgId}`,
              {
                method: 'PATCH',
                headers: headers({ Prefer: 'return=minimal' }),
                body: JSON.stringify({ bonus_balance: newBalance }),
              },
            );
            user.bonus_balance = newBalance;
            welcomeBonusGranted = true;
          }
        } catch (e) { console.warn('[upsert-user] welcome on attach failed:', e); }
      }

      res.status(200).json({ user, isNew: false, referrerJustAttached, welcomeBonusGranted });
      return;
    }

    // NEW USER — INSERT с referred_by + welcome bonus
    // Welcome бонус только если юзер пришёл по реф-ссылке.
    let welcomeBonus = 0;
    if (referred_by) {
      const settingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/app_settings?id=eq.1&select=new_user_welcome_bonus`,
        { headers: headers() },
      );
      const settings = (await settingsRes.json().catch(() => []))?.[0];
      welcomeBonus = Number.isFinite(settings?.new_user_welcome_bonus) ? settings.new_user_welcome_bonus : 0;
    }

    const referral_code = generateReferralCode(verifiedTgId);
    const newUser = {
      telegram_id: verifiedTgId,
      first_name, last_name, username, photo_url,
      bonus_balance: welcomeBonus,
      is_influencer: false,
      referral_code,
      referred_by,
      bonus_streak: 0,
    };
    const insRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users`,
      {
        method: 'POST',
        headers: headers({ Prefer: 'return=representation' }),
        body: JSON.stringify(newUser),
      },
    );
    if (!insRes.ok) {
      const errText = await insRes.text().catch(() => '');
      throw new Error(`users insert failed: ${insRes.status} ${errText}`);
    }
    const insRows = await insRes.json().catch(() => []);
    const user = (Array.isArray(insRows) && insRows.length > 0) ? insRows[0] : newUser;

    // Welcome bonus log (best-effort)
    let welcomeBonusGranted = false;
    if (welcomeBonus > 0) {
      try {
        await fetch(
          `${SUPABASE_URL}/rest/v1/bonus_logs`,
          {
            method: 'POST',
            headers: headers({ Prefer: 'return=minimal' }),
            body: JSON.stringify({
              telegram_id: verifiedTgId,
              type: 'welcome',
              amount: welcomeBonus,
              description: `+${welcomeBonus}₽ приветственный бонус по реферальной ссылке`,
            }),
          },
        );
        welcomeBonusGranted = true;
      } catch (e) { console.warn('[upsert-user] welcome log failed:', e); }
    }

    res.status(200).json({ user, isNew: true, welcomeBonusGranted });
  } catch (err) {
    console.error('[upsert-user] error:', err?.message ?? err);
    res.status(500).json({ error: String(err) });
  }
}
