// Vercel Serverless — статистика партнёра/реферера для PartnerDashboard.
// Возвращает clicks count + registered users по канонической реф-ссылке.
//
// Зачем нужен этот endpoint вместо прямого supabase запроса с фронта:
// миграция 004 включила RLS на referral_clicks и users, но не дала
// SELECT-политики для anon. Direct query с anon-key возвращает 0 даже
// если данные есть. Этот endpoint использует service_key (bypass RLS),
// поэтому реальные цифры приходят.
//
// Auth: требует Authorization: tma <initData> от мини-аппа.
// Партнёр может посмотреть только СВОЮ статистику (telegram_id из initData).
//
// GET /api/partner-stats?codes=VIS_xxx,VANITY  → { clicks: N, registrations: [...] }

import { requireTelegramUser, AuthError } from './_lib/telegram-auth.js';
import { setCors } from './_lib/cors.js';

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

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Auth: только аутентифицированный юзер видит свою статистику
  let verifiedTgId = null;
  try {
    const verified = requireTelegramUser(req);
    verifiedTgId = verified.telegramId;
  } catch (err) {
    const status = err instanceof AuthError ? (err.status || 401) : 500;
    res.status(status).json({ error: err.message || 'auth failed' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(200).json({ clicks: 0, registrations: [] });
    return;
  }

  // codes = comma-separated список (canonical + vanity если есть).
  // Берём из query, фильтруем пустые. Также читаем canonical-код юзера
  // из БД и добавляем — гарантия что партнёр видит свои клики даже если
  // забыл передать code в запросе.
  const codesFromQuery = (req.query?.codes ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const codesSet = new Set(codesFromQuery);

  try {
    // Подгружаем canonical referral_code партнёра из БД — на случай
    // если frontend не передал, и для проверки что vanity действительно его.
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${verifiedTgId}&select=referral_code,vanity_code`,
      { headers: headers() },
    );
    const userRows = await userRes.json().catch(() => []);
    const myCanonical = userRows[0]?.referral_code;
    const myVanity = userRows[0]?.vanity_code;
    if (myCanonical) codesSet.add(myCanonical);
    if (myVanity) codesSet.add(myVanity.toUpperCase());

    const codes = Array.from(codesSet);
    if (codes.length === 0) {
      res.status(200).json({ clicks: 0, registrations: [] });
      return;
    }

    // 1. Clicks count — через Prefer: count=exact + Range head=true.
    // Используем in.(<list>) фильтр — quote each code чтобы не было SQL injection.
    const codesQuoted = codes.map(c => `"${encodeURIComponent(c).replace(/"/g, '%22')}"`).join(',');
    const clicksRes = await fetch(
      `${SUPABASE_URL}/rest/v1/referral_clicks?referral_code=in.(${codesQuoted})&select=id`,
      {
        headers: headers({
          Prefer: 'count=exact',
          'Range-Unit': 'items',
          'Range': '0-0',
        }),
      },
    );
    const contentRange = clicksRes.headers.get('content-range') ?? '';
    const m = /\/(\d+)$/.exec(contentRange);
    const clicks = m ? parseInt(m[1], 10) : 0;

    // 2. Registered users — users.referred_by соответствует канонической
    // ссылке партнёра (resolveReferralCode на signup делает canonicalization).
    // Vanity не используется в users.referred_by — только canonical.
    let registrations = [];
    if (myCanonical) {
      const regRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?referred_by=eq.${encodeURIComponent(myCanonical)}&select=first_name,created_at,engaged_at&order=created_at.desc&limit=100`,
        { headers: headers() },
      );
      registrations = await regRes.json().catch(() => []);
      if (!Array.isArray(registrations)) registrations = [];
    }

    res.status(200).json({ clicks, registrations });
  } catch (err) {
    console.error('[partner-stats] error:', err?.message ?? err);
    res.status(500).json({ error: String(err) });
  }
}
