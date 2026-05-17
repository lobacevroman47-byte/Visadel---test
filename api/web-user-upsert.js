// Vercel Serverless Function — upsert web user (email/OAuth registration).
//
// Юзер регистрируется/логинится через Supabase Auth (на стороне фронта,
// например supabase.auth.signUp с email+пароль или signInWithOAuth). После
// этого фронт получает JWT-сессию и вызывает этот endpoint чтобы создать
// или обновить запись в public.users со связью auth_id.
//
// Auth: Authorization: Bearer <supabase-auth-jwt>
//   Бэкенд проверяет JWT через supabase.auth.getUser(jwt) и получает auth.uid().
//   telegram_id в этом flow остаётся NULL — это веб-юзер.
//
// Body (POST):
//   {
//     first_name: string,         // обязательное
//     last_name?: string,
//     phone?: string,
//     referred_by?: string,       // если пришёл по реф-ссылке
//     signup_source?: 'email' | 'google' | 'vk' | 'yandex' | ...
//   }
//
// Returns: { user: AppUser } — текущая запись после upsert.

import { setCors } from './_lib/cors.js';
import { withSentry, captureException } from './_lib/sentry.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY     = process.env.VITE_SUPABASE_ANON_KEY;

function dbHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Генерация реф-кода — копия helper из lib/db.ts (с auth_id вместо telegram_id).
// Для веб-юзеров: VIS + первые 8 символов uuid в base36, чтобы код был коротким.
function generateReferralCodeFromAuthId(authId) {
  const hex = authId.replace(/-/g, '').slice(0, 12); // 12 hex chars
  const num = parseInt(hex, 16);
  return `VIS${num.toString(36).toUpperCase()}`;
}

// Верификация Supabase Auth JWT — получаем auth.uid() и email юзера.
async function verifySupabaseJwt(jwt) {
  if (!jwt || !SUPABASE_URL || !ANON_KEY) {
    throw new Error('jwt or supabase env missing');
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase auth verify failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return {
    authId: data.id,
    email: data.email ?? null,
    emailConfirmed: !!data.email_confirmed_at,
  };
}

async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    res.status(500).json({ error: 'supabase env not configured' });
    return;
  }

  // 1. Verify JWT — получаем auth_id и email.
  const authHeader = req.headers.authorization ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) {
    res.status(401).json({ error: 'missing Authorization: Bearer <jwt>' });
    return;
  }
  let verified;
  try {
    verified = await verifySupabaseJwt(jwt);
  } catch (e) {
    console.warn('[web-user-upsert] jwt verify failed:', e);
    res.status(401).json({ error: 'invalid jwt' });
    return;
  }

  const { authId, email } = verified;
  if (!authId) {
    res.status(401).json({ error: 'no auth.uid in jwt' });
    return;
  }

  // 2. Парсим body — pubик клиента (имя, реф-код и т.п.).
  const body = req.body ?? {};
  const first_name = String(body.first_name ?? '').trim() || (email ? email.split('@')[0] : 'Гость');
  const last_name = body.last_name ? String(body.last_name).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  const referred_by = body.referred_by ? String(body.referred_by).trim() : null;
  const signup_source = body.signup_source && typeof body.signup_source === 'string'
    ? body.signup_source : 'email';

  // 3. Ищем существующую запись по auth_id.
  const findRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${encodeURIComponent(authId)}&select=*`,
    { headers: dbHeaders() }
  );
  const existing = await findRes.json().catch(() => []);

  if (Array.isArray(existing) && existing.length > 0) {
    // ── UPDATE: освежаем имя/email/phone, не трогаем balance/ref_code/etc ──
    const patch = {
      first_name,
      last_name,
      phone,
      email,
      updated_at: new Date().toISOString(),
    };
    // Авто-восстановление: если веб-юзер был soft-deleted админом (миграция 034)
    // и сейчас снова логинится через email — сбрасываем deleted_at = NULL.
    // Старые заявки/брони остаются deleted (нужно явно UPDATE через SQL).
    if (existing[0].deleted_at) {
      patch.deleted_at = null;
      console.log(`[web-user-upsert] auto-recovering soft-deleted web user ${authId} (was deleted at ${existing[0].deleted_at})`);
    }
    const updRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${encodeURIComponent(authId)}`,
      {
        method: 'PATCH',
        headers: { ...dbHeaders(), Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      }
    );
    const updated = await updRes.json().catch(() => []);
    if (!updRes.ok || !Array.isArray(updated) || updated.length === 0) {
      console.error('[web-user-upsert] update failed:', updRes.status, updated);
      res.status(500).json({ error: 'update failed' });
      return;
    }
    res.status(200).json({ user: updated[0] });
    return;
  }

  // ── INSERT: новый веб-юзер ──
  const referral_code = generateReferralCodeFromAuthId(authId);
  const row = {
    auth_id: authId,
    telegram_id: null,
    first_name,
    last_name,
    phone,
    email,
    referral_code,
    referred_by,
    signup_source,
    bonus_balance: 0,
    is_influencer: false,
    bonus_streak: 0,
  };
  const insRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users`,
    {
      method: 'POST',
      headers: { ...dbHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(row),
    }
  );
  const inserted = await insRes.json().catch(() => []);
  if (!insRes.ok || !Array.isArray(inserted) || inserted.length === 0) {
    console.error('[web-user-upsert] insert failed:', insRes.status, inserted);
    captureException(new Error(`web-user-upsert insert failed: ${insRes.status}`), {
      endpoint: 'web-user-upsert',
      supabase_status: insRes.status,
    });
    // Не возвращаем details клиенту (information disclosure про Supabase).
    res.status(500).json({ error: 'insert failed' });
    return;
  }
  res.status(200).json({ user: inserted[0] });
}

export default withSentry(handler);
