// Unit-тесты для Telegram initData verification.
//
// Покрываем:
//   - Валидный HMAC + свежий auth_date → ok
//   - Невалидный HMAC → throw
//   - Старая auth_date (>24h) → throw
//   - Отсутствие user / hash → throw
//   - Auth header parsing (tma <data>, X-Telegram-Init-Data)
//   - parseAuthHeader case-insensitive
//
// Используем реальный BOT_TOKEN из env (mock) — генерируем правильный HMAC
// чтобы тесты не были fragile к изменениям crypto-логики.

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// Setup mock env ДО import telegram-auth.js — иначе модуль закэширует.
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token-1234567890';
process.env.ADMIN_TELEGRAM_IDS = '111,222,333';

const { verifyInitData, requireTelegramUser, isAdminId, AuthError } =
  await import('./telegram-auth.js');

// Helper: build a properly-signed initData string.
function buildInitData({ user, authDate, botToken = process.env.TELEGRAM_BOT_TOKEN, badHash = false }) {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('user', JSON.stringify(user));

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  params.set('hash', badHash ? '0'.repeat(64) : computed);
  return params.toString();
}

const VALID_USER = { id: 12345, first_name: 'Test', username: 'testuser' };
const FRESH_AUTH_DATE = Math.floor(Date.now() / 1000);
const STALE_AUTH_DATE = Math.floor(Date.now() / 1000) - (25 * 60 * 60); // 25h ago

describe('verifyInitData', () => {
  it('принимает валидный initData', () => {
    const initData = buildInitData({ user: VALID_USER, authDate: FRESH_AUTH_DATE });
    const result = verifyInitData(initData);
    expect(result.telegramId).toBe(12345);
    expect(result.user.username).toBe('testuser');
  });

  it('отвергает подделанный hash', () => {
    const initData = buildInitData({ user: VALID_USER, authDate: FRESH_AUTH_DATE, badHash: true });
    expect(() => verifyInitData(initData)).toThrow(AuthError);
  });

  it('отвергает старую auth_date (>24h)', () => {
    const initData = buildInitData({ user: VALID_USER, authDate: STALE_AUTH_DATE });
    expect(() => verifyInitData(initData)).toThrow(/протухла/);
  });

  it('отвергает пустую строку', () => {
    expect(() => verifyInitData('')).toThrow(/Отсутствует/);
  });

  it('отвергает initData без hash', () => {
    const params = new URLSearchParams({ user: JSON.stringify(VALID_USER), auth_date: String(FRESH_AUTH_DATE) });
    expect(() => verifyInitData(params.toString())).toThrow(/hash/);
  });

  it('отвергает initData с подделанным user (hash не сойдётся)', () => {
    const initData = buildInitData({ user: VALID_USER, authDate: FRESH_AUTH_DATE });
    // Подменяем user-поле уже после подписи
    const tampered = initData.replace(
      encodeURIComponent(JSON.stringify(VALID_USER)),
      encodeURIComponent(JSON.stringify({ id: 99999, first_name: 'Attacker' }))
    );
    expect(() => verifyInitData(tampered)).toThrow(AuthError);
  });

  it('отвергает не-string', () => {
    expect(() => verifyInitData(null)).toThrow();
    expect(() => verifyInitData(undefined)).toThrow();
    expect(() => verifyInitData(123)).toThrow();
  });
});

describe('requireTelegramUser', () => {
  it('принимает Authorization: tma <initData>', () => {
    const initData = buildInitData({ user: VALID_USER, authDate: FRESH_AUTH_DATE });
    const req = { headers: { authorization: `tma ${initData}` } };
    expect(requireTelegramUser(req).telegramId).toBe(12345);
  });

  it('принимает case-insensitive Authorization', () => {
    const initData = buildInitData({ user: VALID_USER, authDate: FRESH_AUTH_DATE });
    const req = { headers: { authorization: `TMA ${initData}` } };
    expect(requireTelegramUser(req).telegramId).toBe(12345);
  });

  it('принимает X-Telegram-Init-Data fallback', () => {
    const initData = buildInitData({ user: VALID_USER, authDate: FRESH_AUTH_DATE });
    const req = { headers: { 'x-telegram-init-data': initData } };
    expect(requireTelegramUser(req).telegramId).toBe(12345);
  });

  it('отвергает запрос без headers', () => {
    expect(() => requireTelegramUser({ headers: {} })).toThrow(/Нужен Authorization/);
  });

  it('отвергает Authorization без "tma" префикса', () => {
    const initData = buildInitData({ user: VALID_USER, authDate: FRESH_AUTH_DATE });
    const req = { headers: { authorization: `Bearer ${initData}` } };
    expect(() => requireTelegramUser(req)).toThrow();
  });
});

describe('isAdminId', () => {
  it('распознаёт admin ID из env', () => {
    expect(isAdminId(111)).toBe(true);
    expect(isAdminId(222)).toBe(true);
    expect(isAdminId(333)).toBe(true);
    expect(isAdminId('111')).toBe(true); // string variant
  });

  it('отвергает non-admin ID', () => {
    expect(isAdminId(444)).toBe(false);
    expect(isAdminId(12345)).toBe(false);
  });
});
