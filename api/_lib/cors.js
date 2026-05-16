// CORS whitelist для API endpoints.
//
// Сейчас все endpoints отдают `Access-Control-Allow-Origin: *` — это
// небезопасно: любая третья сторона может вызвать наш API из браузера
// жертвы (если у жертвы валидная Telegram-сессия, см. CSRF-вектор через
// `Authorization: tma <initData>` в open tab).
//
// Этот хелпер — точечная замена. Используется так:
//
//   import { setCors } from './_lib/cors.js';
//   export default async (req, res) => {
//     if (setCors(req, res)) return; // OPTIONS preflight завершён
//     ...
//   };
//
// Если Origin не из whitelist — CORS-headers не ставим вообще, браузер
// заблокирует запрос на своей стороне. Прокси/server-to-server без Origin
// header пропускаем (Telegram Bot API, cron, и т.д.).

const ALLOWED_ORIGINS = new Set([
  'https://visadel.agency',
  'https://www.visadel.agency',
  'https://visadel-test.vercel.app',
  // Telegram Mini App hosts — обычно запросы идут с visadel.agency,
  // но на всякий случай добавим официальные TG-домены:
  'https://web.telegram.org',
  'https://k.telegram.org',
  'https://a.telegram.org',
]);

// Дополнительные правила для preview-деплоев на Vercel.
// `*.vercel.app` — динамические URL, проверяем по pattern.
const ALLOWED_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i,
  /^https:\/\/[a-z0-9-]+\.telegram\.org$/i,
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_PATTERNS.some(rx => rx.test(origin));
}

// Возвращает true если запрос — OPTIONS preflight и был обработан
// (вызывающий должен сразу выйти из handler).
function setCors(req, res) {
  const origin = req.headers?.origin;

  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data, X-Service-Key');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  // Без Origin (server-to-server) — не ставим CORS-headers, но и не блокируем
  // потому что браузер их не отправляет.

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export { setCors, isAllowedOrigin };
