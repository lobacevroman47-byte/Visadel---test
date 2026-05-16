// Telegram Mini App initData verification.
//
// Mini App клиенты в Telegram получают initData (подписанная HMAC-SHA256
// строка от Telegram). Мы её проверяем серверно по схеме из
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// и доверяем полученному telegram_id вместо клиентского.
//
// Использование:
//   const { telegramId, user } = requireTelegramUser(req);
//   // дальше пишем от имени telegramId, никогда не из body

// package.json type:module → этот файл ESM. import обязателен.
import crypto from 'node:crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MAX_AUTH_AGE_SEC = 24 * 60 * 60; // 24 часа

class AuthError extends Error {
  constructor(msg, status = 401) {
    super(msg);
    this.status = status;
  }
}

function parseAuthHeader(req) {
  // Forwards-compatibility: Telegram официально рекомендует
  // "Authorization: tma <initData>", но мы также принимаем
  // X-Telegram-Init-Data на случай прокси, режущего Authorization.
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('tma ')) {
    return auth.slice(4).trim();
  }
  const x = req.headers?.['x-telegram-init-data'];
  if (typeof x === 'string' && x) return x;
  return null;
}

// Проверяет initData как описано в Telegram docs:
//   1. Распарсить как URLSearchParams
//   2. Извлечь и удалить hash
//   3. Отсортировать оставшиеся поля по ключу, склеить как key=value через \n
//   4. secret = HMAC_SHA256(bot_token, key="WebAppData")
//   5. computed = HMAC_SHA256(dataCheckString, key=secret).hex
//   6. computed === hash
function verifyInitData(initData) {
  if (!BOT_TOKEN) {
    throw new AuthError('Сервер не сконфигурирован: TELEGRAM_BOT_TOKEN не задан', 500);
  }
  if (!initData || typeof initData !== 'string') {
    throw new AuthError('Отсутствует initData');
  }

  const parsed = new URLSearchParams(initData);
  const hash = parsed.get('hash');
  if (!hash) throw new AuthError('initData без hash');
  parsed.delete('hash');

  const dataCheckString = [...parsed.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  // timing-safe compare
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new AuthError('Подпись initData некорректна');
  }

  // initData не должна быть протухшей
  const authDate = parseInt(parsed.get('auth_date') || '0', 10);
  if (!authDate) throw new AuthError('initData без auth_date');
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (ageSec > MAX_AUTH_AGE_SEC) {
    throw new AuthError('initData протухла, переоткрой мини-апп');
  }

  // user — обязательное поле для Mini App
  const userJson = parsed.get('user');
  if (!userJson) throw new AuthError('initData без user');
  let user;
  try { user = JSON.parse(userJson); }
  catch { throw new AuthError('initData.user — невалидный JSON'); }
  if (!user || typeof user.id !== 'number') {
    throw new AuthError('initData.user.id отсутствует');
  }

  return {
    telegramId: user.id,
    user, // { id, first_name, last_name?, username?, language_code?, photo_url? }
    authDate,
  };
}

// Список админских telegram_id из env (та же переменная что у клиентского
// VITE_ADMIN_TELEGRAM_IDS, но на сервере без префикса VITE_).
const ADMIN_IDS = new Set(
  (process.env.ADMIN_TELEGRAM_IDS ?? process.env.VITE_ADMIN_TELEGRAM_IDS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

function isAdminId(telegramId) {
  return ADMIN_IDS.has(String(telegramId));
}

// Хелпер для эндпоинтов: достаёт initData из заголовка, верифицирует, возвращает user.
// Кидает AuthError с status — handler должен поймать и вернуть статус.
function requireTelegramUser(req) {
  const initData = parseAuthHeader(req);
  if (!initData) throw new AuthError('Нужен Authorization: tma <initData>');
  return verifyInitData(initData);
}

// Как requireTelegramUser, но дополнительно проверяет, что пользователь
// в списке админов. Используется на admin-only эндпоинтах.
function requireAdminUser(req) {
  const verified = requireTelegramUser(req);
  if (!isAdminId(verified.telegramId)) {
    throw new AuthError('Доступ только для администраторов', 403);
  }
  return verified;
}

// Обёртка для handler — упрощает: ловит AuthError, отвечает 401,
// иначе зовёт inner с дополненным req.tgUser.
function withTelegramAuth(handler) {
  return async (req, res) => {
    try {
      const verified = requireTelegramUser(req);
      req.tgUser = verified;
      return handler(req, res);
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.status || 401).json({ error: err.message });
        return;
      }
      console.error('telegram-auth unexpected error:', err);
      res.status(500).json({ error: 'auth check failed' });
    }
  };
}

// ─── Cron secret auth ──────────────────────────────────────────────────────
// Vercel при вызове cron автоматически шлёт заголовок:
//   Authorization: Bearer <CRON_SECRET>
// где CRON_SECRET берётся из env vars проекта. Это защищает cron endpoints
// от того что любой может дёрнуть их руками (DoS-by-cost / spam / API abuse).
//
// Документация: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
//
// На локальной разработке (без CRON_SECRET в env) — пропускаем без проверки
// чтобы можно было дёргать cron руками в dev. На проде CRON_SECRET ДОЛЖЕН
// быть задан — иначе endpoint остаётся открытым (warning в логах).
function requireCronAuth(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // На проде это надо настроить. Лога warning достаточно — не падаем.
    console.warn('[cron-auth] CRON_SECRET env var not set — cron endpoint is OPEN. Set it in Vercel env vars.');
    return;
  }
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') {
    throw new AuthError('Cron Authorization header missing', 401);
  }
  const expectedHeader = `Bearer ${expected}`;
  // timing-safe compare
  const a = Buffer.from(header);
  const b = Buffer.from(expectedHeader);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new AuthError('Cron Authorization invalid', 401);
  }
}

export { verifyInitData, requireTelegramUser, requireAdminUser, withTelegramAuth, isAdminId, requireCronAuth, AuthError };
