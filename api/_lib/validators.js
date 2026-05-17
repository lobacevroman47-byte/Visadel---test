// Zod-схемы для валидации входных данных API endpoints.
//
// Зачем: раньше эндпоинты делали destructure body без проверки типов:
//   const { telegram_id, amount } = req.body;
//   if (!telegram_id || !amount) ...
// Это пропускает type coercion (amount='100' пройдёт как truthy, потом
// crash в Postgres), отрицательные числа, NaN, объекты вместо примитивов,
// инъекции в строковые поля.
//
// Zod даёт:
//   - strict type checking
//   - default values
//   - whitelist полей (всё лишнее игнорируется)
//   - чёткие 400 errors с описанием что не так (но в проде без полного
//     leak — см. validate() helper)
//
// Использование:
//   import { grantBonusSchema, validate } from './_lib/validators.js';
//
//   const parsed = validate(req.body, grantBonusSchema);
//   if (!parsed.ok) {
//     res.status(400).json({ error: 'invalid input', details: parsed.errors });
//     return;
//   }
//   const { type, amount, ... } = parsed.data;

import { z } from 'zod';

// ─── Reusable primitives ────────────────────────────────────────────────────

// telegram_id: положительное целое до 10^15 (Telegram IDs до 10 цифр сейчас).
const telegramIdSchema = z.number().int().positive().max(1e15);

// referral_code: alphanum + underscore, 2-32 символа.
const referralCodeSchema = z.string().regex(/^[A-Za-z0-9_]{2,32}$/);

// amount: целое, может быть отрицательным (списания), -1M..+1M.
const amountSchema = z.number().int().min(-1_000_000).max(1_000_000);

// UUID для application_id (если есть).
const uuidSchema = z.string().uuid();

// Telegram username — без @, до 32 символов.
const usernameSchema = z.string().max(32).optional();

// Имена — до 64 символов, без HTML-инъекций.
const nameSchema = z.string().max(64).regex(/^[^<>]+$/, { message: 'no HTML chars' });

// ─── grant-bonus ────────────────────────────────────────────────────────────

// Все поля опциональны — service call указывает telegram_id явно,
// user call берёт из initData (в handler'е).
export const grantBonusSchema = z.object({
  telegram_id: telegramIdSchema.optional(),
  type: z.enum([
    'welcome', 'payment', 'referral', 'task', 'task_reward', 'feedback',
    'admin_grant', 'admin_revoke', 'review',
    'partner_pending', 'partner_approved', 'partner_paid', 'partner_cancelled',
  ]),
  amount: amountSchema,
  description: z.string().max(500).optional(),
  application_id: z.string().max(64).optional(),
});

// ─── notify-status ──────────────────────────────────────────────────────────

export const notifyStatusSchema = z.object({
  telegram_id: telegramIdSchema.optional(),
  status: z.enum([
    'submitted', 'in_progress', 'confirmed', 'cancelled',
    'partner_new_referral', 'reminder', 'review_approved', 'review_rejected',
    'admin_action', 'application_paid',
  ]),
  application_id: z.string().max(64).optional(),
  country: z.string().max(64).optional(),
  visa_type: z.string().max(64).optional(),
  referee_name: z.string().max(128).optional(),
  // Прочие поля админка / cron могут добавлять — допускаем passthrough,
  // но не trustّ им.
}).passthrough();

// ─── web-user-upsert ────────────────────────────────────────────────────────

export const webUserUpsertSchema = z.object({
  first_name: nameSchema,
  last_name: nameSchema.optional(),
  phone: z.string().max(32).regex(/^[+\d\s()-]+$/, { message: 'invalid phone' }).optional(),
  referred_by: referralCodeSchema.optional(),
  signup_source: z.enum(['email', 'google', 'vk', 'yandex', 'apple', 'unknown']).optional(),
});

// ─── post-review ────────────────────────────────────────────────────────────

export const postReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(2000),
  country: z.string().max(64).optional(),
});

// ─── save-review (INSERT в reviews через service_key — закрывает RLS-дыру) ──

export const saveReviewSchema = z.object({
  application_id: z.string().min(1).max(64),
  country: z.string().min(1).max(64),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(2000),
});

// ─── admin-grant-bonus ──────────────────────────────────────────────────────

export const adminGrantBonusSchema = z.object({
  target_telegram_id: telegramIdSchema,
  amount: z.number().int().positive().max(1_000_000),
  add: z.boolean().default(true),
  description: z.string().max(500).optional(),
});

// ─── Validator helper ───────────────────────────────────────────────────────

// validate(input, schema) → { ok: true, data } | { ok: false, errors }
//
// errors — массив { path, message } БЕЗ полного z.flatten() (который может
// раскрыть схему). Достаточно для отладки на фронте, без disclosure.
export function validate(input, schema) {
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const errors = result.error.issues.slice(0, 10).map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
  return { ok: false, errors };
}
