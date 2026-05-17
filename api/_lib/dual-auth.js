// Dual-auth helper: TG initData OR Supabase JWT.
//
// Используется на endpoint'ах которые обслуживают и TG-юзеров, и веб-юзеров
// (например /api/save-hotel-booking, /api/save-flight-booking).
//
// Логика:
//   1. Если есть Authorization: tma <initData> → TG-юзер
//   2. Если есть Authorization: Bearer <jwt> → Supabase JWT (веб-юзер)
//   3. Если ни того, ни другого → 401
//
// Возвращает { telegramId, authId } — одно из них null.
// Анти-spoofing: оба ID — из СВЕРЕННЫХ источников (HMAC для TG, getUser для JWT).
// Клиент не может подделать.
//
// Использование в handler:
//   const auth = await requireUserAuth(req);
//   if (!auth) {
//     res.status(401).json({ error: 'auth required' });
//     return;
//   }
//   // auth.telegramId или auth.authId — пишем в БД

import { requireTelegramUser, AuthError } from './telegram-auth.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY     = process.env.VITE_SUPABASE_ANON_KEY;

async function verifySupabaseJwt(jwt) {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error('supabase env not configured');
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
  });
  if (!res.ok) {
    throw new Error(`jwt verify failed: ${res.status}`);
  }
  const data = await res.json();
  if (!data?.id) throw new Error('no auth.uid in jwt');
  return {
    authId: data.id,
    email: data.email ?? null,
    username: data.user_metadata?.username ?? null,
  };
}

/**
 * Возвращает { telegramId?, authId?, user? } или null если auth провален.
 * Throws AuthError если ни TG, ни JWT не валидны (handler ловит и возвращает 401).
 */
export async function requireUserAuth(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const lower = typeof authHeader === 'string' ? authHeader.toLowerCase() : '';

  // 1) TG initData (tma prefix)
  const isTma = lower.startsWith('tma ') || req.headers?.['x-telegram-init-data'];
  if (isTma) {
    try {
      const verified = requireTelegramUser(req);
      return {
        telegramId: verified.telegramId,
        authId: null,
        user: verified.user,
      };
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('TG auth failed', 401);
    }
  }

  // 2) Supabase JWT (Bearer prefix)
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const jwt = authHeader.slice(7).trim();
    if (!jwt) throw new AuthError('Empty Bearer token', 401);
    try {
      const verified = await verifySupabaseJwt(jwt);
      return {
        telegramId: null,
        authId: verified.authId,
        user: { username: verified.username, email: verified.email },
      };
    } catch (err) {
      throw new AuthError(`JWT verify failed: ${err.message ?? 'unknown'}`, 401);
    }
  }

  throw new AuthError('Auth required (tma initData or Bearer JWT)', 401);
}
