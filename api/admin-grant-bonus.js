// Vercel Serverless — admin grants/revokes bonus for a target user.
//
// Раньше админка дёргала supabase.from('users').update({ bonus_balance })
// напрямую с anon-key. Миграция 004_rls_telegram_id.sql блокирует UPDATE
// на users для anon → запросы молча проваливались, баланс не менялся,
// в bonus_logs ничего не писалось.
//
// Этот endpoint принимает Telegram initData админа, проверяет роль через
// ADMIN_TELEGRAM_IDS env / admin_users table, и через service_key
// обновляет users.bonus_balance + пишет в bonus_logs.
//
// Auth: Authorization: tma <initData>  (от админа из мини-аппа)
// Body: { target_telegram_id, amount, add: boolean, description? }
//   add=true   → +amount (но не больше чем int_max)
//   add=false  → −amount (но не меньше 0, не уходит в минус)

import { requireTelegramUser, AuthError, isAdminId } from './_lib/telegram-auth.js';
import { setCors } from './_lib/cors.js';
import { rateLimitByIp } from './_lib/rate-limit.js';
import { withSentry, captureException } from './_lib/sentry.js';
import { validate, adminGrantBonusSchema } from './_lib/validators.js';
import { logAdminAction } from './_lib/audit-log.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

function dbHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Проверка через admin_users-таблицу (на случай если админ не в env, а только в БД)
async function isAdminInDb(telegramId) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_users?telegram_id=eq.${telegramId}&select=telegram_id&limit=1`,
      { headers: dbHeaders() }
    );
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).end(); return; }

  // Rate-limit: admin endpoint, anti-runaway если admin токен скомпрометирован.
  if (rateLimitByIp(req, { bucket: 'admin-grant-bonus', max: 30, windowMs: 60_000 })) {
    res.status(429).json({ error: 'rate limit exceeded' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'supabase env not configured' });
    return;
  }

  // ── 1. Auth: верифицируем initData админа ──
  let verifiedTgId;
  let verifiedAdmin = null;
  try {
    const verified = requireTelegramUser(req);
    verifiedTgId = verified.telegramId;
    verifiedAdmin = verified.user; // для audit log: { id, username, first_name }
  } catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  // ── 2. Проверка что caller — админ ──
  const isEnvAdmin = isAdminId(verifiedTgId);
  const isDbAdmin = !isEnvAdmin ? await isAdminInDb(verifiedTgId) : false;
  if (!isEnvAdmin && !isDbAdmin) {
    console.warn(`[admin-grant-bonus] forbidden: ${verifiedTgId} is not admin`);
    res.status(403).json({ error: 'admin only' });
    return;
  }

  // ── 3. Парсим body через Zod ──
  // Защита: amount строго positive integer, target_telegram_id обязателен.
  // Раньше Number(body.add) или add='maybe' могли проскочить и логика
  // вычитала вместо добавления.
  const parsed = validate(req.body ?? {}, adminGrantBonusSchema);
  if (!parsed.ok) {
    res.status(400).json({ error: 'invalid input', details: parsed.errors });
    return;
  }
  const { target_telegram_id, amount, add, description: customDescription } = parsed.data;

  console.log('[admin-grant-bonus] called:', { admin: verifiedTgId, target_telegram_id, amount, add });

  try {
    // ── 4. Считаем текущий balance ──
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${target_telegram_id}&select=bonus_balance`,
      { headers: dbHeaders() }
    );
    const rows = await getRes.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(404).json({ error: 'target user not found' });
      return;
    }
    const current = Number(rows[0].bonus_balance) || 0;
    const newBalance = add ? current + amount : Math.max(0, current - amount);

    // ── 5. UPDATE users.bonus_balance ──
    const updRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${target_telegram_id}`,
      {
        method: 'PATCH',
        headers: dbHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ bonus_balance: newBalance, updated_at: new Date().toISOString() }),
      }
    );
    if (!updRes.ok) {
      const text = await updRes.text().catch(() => '');
      console.error('[admin-grant-bonus] update failed:', updRes.status, text);
      res.status(500).json({ error: `update failed: ${updRes.status}` });
      return;
    }

    // ── 6. INSERT в bonus_logs (audit trail) ──
    const signed = add ? amount : -amount;
    const description = customDescription ?? (add
      ? `Админ начислил +${amount}₽ через панель`
      : `Админ снял −${amount}₽ через панель`);
    const logRes = await fetch(`${SUPABASE_URL}/rest/v1/bonus_logs`, {
      method: 'POST',
      headers: dbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        telegram_id: target_telegram_id,
        type: add ? 'admin_grant' : 'admin_revoke',
        amount: signed,
        description,
      }),
    });
    if (!logRes.ok) {
      // Лог не записался — не критично для баланса, но предупреждаем
      const text = await logRes.text().catch(() => '');
      console.warn('[admin-grant-bonus] bonus_logs insert non-fatal:', logRes.status, text);
    }

    // ── 7. Server-side audit log (admin_audit_log) ──
    // Дублирует frontend auditLog() — гарантирует запись даже если фронт
    // вызвал API напрямую без UI. Best-effort, не блокирует ответ.
    await logAdminAction({
      admin_tg_id: verifiedTgId,
      admin_name: verifiedAdmin?.username ? `@${verifiedAdmin.username}` : (verifiedAdmin?.first_name ?? null),
      action: add ? 'bonus.grant' : 'bonus.revoke',
      target_type: 'user',
      target_id: target_telegram_id,
      details: {
        amount,
        previous_balance: current,
        new_balance: newBalance,
        description: customDescription ?? null,
      },
    });

    res.status(200).json({ ok: true, newBalance, previousBalance: current });
  } catch (err) {
    console.error('[admin-grant-bonus] exception:', err);
    captureException(err, { endpoint: 'admin-grant-bonus' });
    res.status(500).json({ error: 'internal error' });
  }
}

export default withSentry(handler);
