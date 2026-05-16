// Простой in-memory token bucket для Vercel serverless.
//
// ⚠️ Ограничения:
// - Vercel переиспользует контейнер только между WARM invocations. Cold-start
//   ресетит state. Атакующий с распределённой ботнетью пробьёт лимит легко.
// - Между разными регионами Vercel state не делится.
//
// Это НЕ замена Redis/Upstash, а первый эшелон. Для P0-эндпоинтов
// (`grant-bonus`, `save-application`) — нужен Upstash. Для track-click /
// post-review — этого уровня хватает.
//
// API:
//   import { rateLimit } from './_lib/rate-limit.js';
//   const limited = rateLimit({ key, max: 10, windowMs: 60_000 });
//   if (limited) { res.status(429).json({ error: 'rate limit' }); return; }

// Map<string, { count: number, resetAt: number }>
const buckets = new Map();

// Очистка раз в минуту чтобы Map не рос бесконечно.
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [k, v] of buckets.entries()) {
    if (v.resetAt < now) buckets.delete(k);
  }
}

// Возвращает true если запрос ПРЕВЫСИЛ лимит (надо вернуть 429).
// Возвращает false если в пределах лимита (continue).
function rateLimit({ key, max, windowMs }) {
  cleanup();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (bucket.count >= max) {
    return true;
  }

  bucket.count += 1;
  return false;
}

// Достаёт IP клиента из request. Vercel пишет в x-forwarded-for / x-real-ip.
// Берём первый из x-forwarded-for (cdn → origin цепочка).
function getClientIp(req) {
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff) {
    return xff.split(',')[0].trim();
  }
  const real = req.headers?.['x-real-ip'];
  if (typeof real === 'string' && real) return real;
  return req.socket?.remoteAddress ?? 'unknown';
}

// Хелпер-комбо: проверяет лимит по IP. Возвращает true если заблокирован.
function rateLimitByIp(req, { bucket, max, windowMs }) {
  const ip = getClientIp(req);
  return rateLimit({ key: `${bucket}:${ip}`, max, windowMs });
}

export { rateLimit, rateLimitByIp, getClientIp };
