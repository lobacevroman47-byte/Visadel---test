// Vercel Serverless — admin soft-deletes a target user.
//
// Помечает users.deleted_at = now() + каскадно
//   applications.deleted_at, hotel_bookings.deleted_at, flight_bookings.deleted_at.
// Удалённые юзеры не видны в админке (фильтр WHERE deleted_at IS NULL).
//
// Восстановление руками через Supabase SQL Editor — см. supabase/034.
//
// Auth: Authorization: tma <initData>  (от админа из мини-аппа)
// Body: { target_telegram_id?: number, target_auth_id?: uuid }
// Возвращает: { ok: true, deleted: { users, applications, hotel_bookings, flight_bookings } }

import { requireTelegramUser, AuthError, isAdminId } from './_lib/telegram-auth.js';
import { setCors } from './_lib/cors.js';
import { rateLimitByIp } from './_lib/rate-limit.js';

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

/** Один UPDATE deleted_at в указанной таблице по фильтру (`telegram_id` или
 *  `user_telegram_id` — зависит от таблицы). Возвращает количество затронутых
 *  строк (через Prefer: count=exact). */
async function softDelete(table, columnName, columnValue, deletedAt) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${columnName}=eq.${columnValue}&deleted_at=is.null`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: dbHeaders({ Prefer: 'count=exact, return=minimal' }),
    body: JSON.stringify({ deleted_at: deletedAt }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${table} update failed: ${res.status} ${text}`);
  }
  // PostgREST возвращает количество затронутых строк в Content-Range header
  // (формат: "0-N/total"). Если нет — возвращаем 0.
  const range = res.headers.get('content-range') ?? '';
  const m = range.match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).end(); return; }

  // Rate-limit: admin endpoint, anti-runaway если admin токен скомпрометирован.
  if (rateLimitByIp(req, { bucket: 'admin-delete-user', max: 30, windowMs: 60_000 })) {
    res.status(429).json({ error: 'rate limit exceeded' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'supabase env not configured' });
    return;
  }

  // ── 1. Auth: верифицируем initData админа ──
  let verifiedTgId;
  try {
    verifiedTgId = requireTelegramUser(req).telegramId;
  } catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  // ── 2. Проверка что caller — админ ──
  const isEnvAdmin = isAdminId(verifiedTgId);
  const isDbAdmin = !isEnvAdmin ? await isAdminInDb(verifiedTgId) : false;
  if (!isEnvAdmin && !isDbAdmin) {
    console.warn(`[admin-delete-user] forbidden: ${verifiedTgId} is not admin`);
    res.status(403).json({ error: 'admin only' });
    return;
  }

  // ── 3. Парсим body ──
  const body = req.body ?? {};
  const target_telegram_id = body.target_telegram_id ? Number(body.target_telegram_id) : null;
  const target_auth_id = typeof body.target_auth_id === 'string' && body.target_auth_id ? body.target_auth_id : null;

  if (!target_telegram_id && !target_auth_id) {
    res.status(400).json({ error: 'target_telegram_id or target_auth_id required' });
    return;
  }

  // Защита: админ не может удалить сам себя (вдруг кнопка случайно нажата)
  if (target_telegram_id && target_telegram_id === verifiedTgId) {
    res.status(400).json({ error: 'cannot delete yourself' });
    return;
  }

  console.log('[admin-delete-user] called:', { admin: verifiedTgId, target_telegram_id, target_auth_id });

  const deletedAt = new Date().toISOString();
  const counts = { users: 0, applications: 0, hotel_bookings: 0, flight_bookings: 0 };

  try {
    // ── 4. Soft-delete users ──
    if (target_telegram_id) {
      counts.users += await softDelete('users', 'telegram_id', target_telegram_id, deletedAt);
    }
    if (target_auth_id) {
      counts.users += await softDelete('users', 'auth_id', target_auth_id, deletedAt);
    }

    // ── 5. Cascade: applications, hotel_bookings, flight_bookings ──
    // Помечаем все заявки/брони этого юзера как deleted (юзер уже не увидит
    // их в «Мои заявки», админ — в списках). Восстановление — см. миграцию 034.
    if (target_telegram_id) {
      counts.applications    += await softDelete('applications',    'user_telegram_id', target_telegram_id, deletedAt);
      counts.hotel_bookings  += await softDelete('hotel_bookings',  'telegram_id',      target_telegram_id, deletedAt);
      counts.flight_bookings += await softDelete('flight_bookings', 'telegram_id',      target_telegram_id, deletedAt);
    }
    if (target_auth_id) {
      counts.applications    += await softDelete('applications',    'user_auth_id', target_auth_id, deletedAt);
      counts.hotel_bookings  += await softDelete('hotel_bookings',  'auth_id',      target_auth_id, deletedAt);
      counts.flight_bookings += await softDelete('flight_bookings', 'auth_id',      target_auth_id, deletedAt);
    }

    if (counts.users === 0) {
      res.status(404).json({ error: 'target user not found (or already deleted)' });
      return;
    }

    res.status(200).json({ ok: true, deleted: counts });
  } catch (err) {
    console.error('[admin-delete-user] exception:', err);
    res.status(500).json({ error: String(err.message ?? err) });
  }
}
