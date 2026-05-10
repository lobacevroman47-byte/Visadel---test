// Vercel Serverless — grant a bonus to a user (service key, bypasses RLS)
// Also handles referral bonus automatically when type === 'payment'
//
// Auth: требует Authorization: tma <initData> от мини-аппа Telegram.
// telegram_id берётся из проверенной подписи, а НЕ из тела запроса —
// пресекает forge-атаки вида "начисли мне за чужого юзера".
// Запросы из админки/cron, которым нужно начислить от имени любого
// пользователя, должны слать заголовок X-Service-Key === SUPABASE_SERVICE_KEY
// и явно указывать telegram_id в body.
//
// POST body:
//   {} (telegram_id берётся из initData)            — пользовательский кейс
//   { telegram_id, type, amount, description, application_id }  — admin/cron (с X-Service-Key)

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

async function dbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers() });
  return r.json();
}

async function dbPatch(path, body) {
  // Используем return=representation чтобы видеть сколько строк апдейтнули.
  // Раньше был return=minimal — успешный 200 без тела, и нельзя было понять
  // что WHERE filter не нашёл ни одной строки (silent no-op).
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`dbPatch ${path} failed: ${r.status} ${errText}`);
  }
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function dbInsert(table, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`dbInsert ${table} failed: ${r.status} ${errText}`);
  }
  return r;
}

// Атомарный insert через unique constraint (telegram_id, type, dedupe_key).
// Возвращает {alreadyGranted: bool}: при конфликте Postgres вернёт пустой массив,
// что мы трактуем как "уже было начисление".
//
// Раньше был баг: если PostgREST возвращал 4xx/5xx (например auth fail или
// нарушение constraint), r.json() парсил error-объект (не массив), и мы
// ошибочно считали alreadyGranted=true. INSERT фактически не происходил,
// баланс не обновлялся, в bonus_logs ни строки. Теперь явно проверяем r.ok
// и кидаем error, чтобы caller увидел.
async function tryInsertBonusLog(telegram_id, type, amount, description, dedupe_key) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/bonus_logs?on_conflict=telegram_id,type,dedupe_key`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation,resolution=ignore-duplicates' }),
    body: JSON.stringify({ telegram_id, type, amount, description, dedupe_key }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`bonus_logs insert failed: ${r.status} ${errText}`);
  }
  const inserted = await r.json().catch(() => []);
  // С resolution=ignore-duplicates: при success inserted=[{...row...}], при
  // duplicate inserted=[]. Только пустой массив = реальный duplicate.
  const alreadyGranted = Array.isArray(inserted) && inserted.length === 0;
  return { alreadyGranted };
}

// Partner-specific types работают с users.partner_balance, не bonus_balance:
//   partner_pending   — log only, не трогает баланс (в hold-периоде 30 дней)
//   partner_approved  — log + increment partner_balance (после hold-а)
//   partner_paid      — log + decrement partner_balance (амт обычно отрицательная)
//   partner_cancelled — log + decrement partner_balance (если ранее approved → amt
//                       отрицательная, иначе amt=0 и баланс не меняется)
function isPartnerType(type) {
  return typeof type === 'string' && type.startsWith('partner_');
}
function affectsPartnerBalance(type) {
  return type === 'partner_approved' || type === 'partner_paid' || type === 'partner_cancelled';
}
function affectsBonusBalance(type) {
  // Все НЕ partner_* типы трогают bonus_balance.
  // partner_pending — log only, баланс не трогает (hold-период).
  return !isPartnerType(type);
}

// Атомарный inc/dec partner_balance через RPC (миграция 020).
// Защита от race condition: cron approval и admin payout могли пересечься
// при read→modify→write и затереть друг друга.
async function incPartnerBalance(telegram_id, delta) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/inc_partner_balance`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ p_telegram_id: telegram_id, p_delta: delta }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`inc_partner_balance failed: ${r.status} ${errText}`);
  }
  return r.json().catch(() => null);
}

async function grantBonus(telegram_id, type, amount, description, dedupe_key) {
  // 1) Атомарный лог. Если уже был такой dedupe_key — вернёт alreadyGranted=true
  if (dedupe_key) {
    const { alreadyGranted } = await tryInsertBonusLog(telegram_id, type, amount, description, dedupe_key);
    if (alreadyGranted) return { skipped: true };
  } else {
    await dbInsert('bonus_logs', { telegram_id, type, amount, description });
  }

  // 2) Партнёрский баланс — отдельная ветка через атомарную RPC.
  //    partner_pending — только лог, баланс не трогает (hold-период).
  if (isPartnerType(type)) {
    if (!affectsPartnerBalance(type)) return { skipped: false };
    if (amount === 0) return { skipped: false }; // нечего двигать
    const newPartnerBalance = await incPartnerBalance(telegram_id, amount);
    return { newPartnerBalance };
  }

  // 3) Обычный (bonus) баланс. PostgREST не даёт SET balance = balance + N без RPC,
  //    поэтому read → compute → write. Дедуп логов в (1) защищает от
  //    двойного начисления; параллельные запросы могут разойтись на величину
  //    (в будущем — RPC inc_balance).
  //
  //    Если строки в users нет (founder заходил через ?admin=true и пропустил
  //    upsertUser, или RLS заблокировал INSERT с фронта) — PATCH молча
  //    апдейтит 0 строк, баланс остаётся 0, но bonus_logs уже записан.
  //    Поэтому fallback'ом делаем UPSERT через on_conflict=telegram_id.
  if (!affectsBonusBalance(type)) return { skipped: false };
  const [user] = await dbGet(`users?telegram_id=eq.${telegram_id}&select=bonus_balance`);
  const newBalance = ((user?.bonus_balance) ?? 0) + amount;

  if (user) {
    const updated = await dbPatch(`users?telegram_id=eq.${telegram_id}`, { bonus_balance: newBalance });
    // Защита от silent no-op: если WHERE не нашёл ни одной строки (например
    // строка удалена прямо во время операции), создаём её.
    if (updated.length === 0) {
      console.warn(`[grant-bonus] PATCH matched 0 rows for ${telegram_id} — fallback to upsert`);
      const referral_code = `USR_${telegram_id}`;
      await fetch(`${SUPABASE_URL}/rest/v1/users?on_conflict=telegram_id`, {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({
          telegram_id,
          bonus_balance: newBalance,
          referral_code,
          first_name: 'User',
        }),
      });
    }
  } else {
    // Юзера нет — создаём минимальную строку. on_conflict=telegram_id +
    // resolution=merge-duplicates делает upsert (на случай race condition,
    // если параллельный запрос успел вставить). Минимально нужны
    // telegram_id и referral_code (UNIQUE NOT NULL по схеме).
    const referral_code = `USR_${telegram_id}`;
    await fetch(`${SUPABASE_URL}/rest/v1/users?on_conflict=telegram_id`, {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        telegram_id,
        bonus_balance: newBalance,
        referral_code,
        first_name: 'User',
      }),
    });
  }

  return { newBalance };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data, X-Service-Key');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  // ── Auth: либо проверенная Telegram подпись, либо service key (cron/админка)
  const serviceKeyHeader = req.headers['x-service-key'];
  const isServiceCall = SERVICE_KEY && serviceKeyHeader === SERVICE_KEY;

  let verifiedTgId = null;
  if (!isServiceCall) {
    try {
      const verified = requireTelegramUser(req);
      verifiedTgId = verified.telegramId;
    } catch (err) {
      const status = err instanceof AuthError ? (err.status || 401) : 500;
      res.status(status).json({ error: err.message || 'auth failed' });
      return;
    }
  }

  const body = req.body ?? {};
  const { type, amount, description, application_id } = body;
  // Доверяем telegram_id из initData; service-каллу разрешаем переопределить
  const telegram_id = isServiceCall ? body.telegram_id : verifiedTgId;
  if (!telegram_id || !type || !amount) {
    res.status(400).json({ error: 'telegram_id, type, amount required' });
    return;
  }

  console.log('[grant-bonus] called:', { telegram_id, type, amount, application_id, isServiceCall });

  try {
    // ── Grant the main bonus (атомарно через unique constraint) ─────────────
    const dedupeKey = application_id ? `${type}:${application_id}` : null;
    const result = await grantBonus(telegram_id, type, amount, description, dedupeKey);
    if (result.skipped) {
      res.json({ ok: true, skipped: true });
      return;
    }
    const newBalance = result.newBalance;

    // ── Referral bonus when a payment is confirmed ──────────────────────────
    // Givе referrer бонус С КАЖДОЙ ОПЛАЧЕННОЙ ЗАЯВКИ (раньше дедуп был
    // ref_for_<friendId> — только за первую визу). Теперь dedupe_key
    // включает application_id → каждая новая виза реферала = новый бонус.
    // Сумму читаем из app_settings.referrer_regular_bonus, чтобы админка
    // могла менять без деплоя.
    if (type === 'payment' && application_id) {
      try {
        const [userRow] = await dbGet(`users?telegram_id=eq.${telegram_id}&select=referred_by`);
        const referredBy = userRow?.referred_by;

        if (referredBy) {
          const [referrerRow] = await dbGet(
            `users?referral_code=eq.${encodeURIComponent(referredBy)}&select=telegram_id,bonus_balance`
          );
          if (referrerRow) {
            const [settings] = await dbGet('app_settings?id=eq.1&select=referrer_regular_bonus');
            const refAmount = Number.isFinite(settings?.referrer_regular_bonus)
              ? settings.referrer_regular_bonus
              : 500;
            await grantBonus(
              referrerRow.telegram_id,
              'referral',
              refAmount,
              `+${refAmount}₽ за визу друга (заявка ${application_id})`,
              `ref_for_${telegram_id}_${application_id}`,
            );
          }
        }
      } catch (refErr) {
        console.error('Referral bonus error (non-fatal):', refErr);
      }
    }

    console.log('[grant-bonus] success:', { telegram_id, type, amount, newBalance });
    res.json({ ok: true, newBalance });
  } catch (err) {
    console.error('[grant-bonus] error:', err?.message ?? err);
    res.status(500).json({ error: String(err) });
  }
}
