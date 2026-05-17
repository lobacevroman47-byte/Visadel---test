// Unit-тесты для in-memory token bucket.
//
// Покрываем:
//   - В пределах лимита → false (пропускаем)
//   - Превышение лимита → true (блокируем)
//   - Reset после windowMs (fake timers)
//   - Изоляция между bucket'ами и ключами
//   - getClientIp правильно парсит x-forwarded-for

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimit, rateLimitByIp, getClientIp } from './rate-limit.js';

describe('rateLimit', () => {
  beforeEach(() => {
    // Сброс таймеров между тестами
    vi.useRealTimers();
  });

  it('пропускает запросы в пределах лимита', () => {
    const key = `test-pass-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit({ key, max: 5, windowMs: 60_000 })).toBe(false);
    }
  });

  it('блокирует на 6-м запросе при max=5', () => {
    const key = `test-block-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      rateLimit({ key, max: 5, windowMs: 60_000 });
    }
    expect(rateLimit({ key, max: 5, windowMs: 60_000 })).toBe(true);
  });

  it('изолирует разные ключи', () => {
    const k1 = `iso1-${Math.random()}`;
    const k2 = `iso2-${Math.random()}`;
    for (let i = 0; i < 5; i++) rateLimit({ key: k1, max: 5, windowMs: 60_000 });
    expect(rateLimit({ key: k1, max: 5, windowMs: 60_000 })).toBe(true);
    expect(rateLimit({ key: k2, max: 5, windowMs: 60_000 })).toBe(false);
  });

  it('сбрасывает счётчик после windowMs', () => {
    vi.useFakeTimers();
    const key = `reset-${Math.random()}`;
    for (let i = 0; i < 5; i++) rateLimit({ key, max: 5, windowMs: 1000 });
    expect(rateLimit({ key, max: 5, windowMs: 1000 })).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(rateLimit({ key, max: 5, windowMs: 1000 })).toBe(false);
    vi.useRealTimers();
  });
});

describe('getClientIp', () => {
  it('берёт первый IP из x-forwarded-for', () => {
    const req = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } };
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('fallback на x-real-ip', () => {
    const req = { headers: { 'x-real-ip': '9.9.9.9' } };
    expect(getClientIp(req)).toBe('9.9.9.9');
  });

  it('fallback на socket.remoteAddress', () => {
    const req = { headers: {}, socket: { remoteAddress: '10.10.10.10' } };
    expect(getClientIp(req)).toBe('10.10.10.10');
  });

  it('возвращает "unknown" если нет ничего', () => {
    expect(getClientIp({ headers: {} })).toBe('unknown');
  });

  it('игнорирует пустой x-forwarded-for', () => {
    const req = { headers: { 'x-forwarded-for': '' }, socket: { remoteAddress: '7.7.7.7' } };
    expect(getClientIp(req)).toBe('7.7.7.7');
  });
});

describe('rateLimitByIp', () => {
  it('изолирует разные IP', () => {
    const r1 = { headers: { 'x-forwarded-for': '1.1.1.1' } };
    const r2 = { headers: { 'x-forwarded-for': '2.2.2.2' } };
    const bucket = `byip-${Math.random()}`;

    for (let i = 0; i < 3; i++) rateLimitByIp(r1, { bucket, max: 3, windowMs: 60_000 });
    expect(rateLimitByIp(r1, { bucket, max: 3, windowMs: 60_000 })).toBe(true);
    expect(rateLimitByIp(r2, { bucket, max: 3, windowMs: 60_000 })).toBe(false);
  });

  it('изолирует разные bucket', () => {
    const req = { headers: { 'x-forwarded-for': '3.3.3.3' } };
    const b1 = `b1-${Math.random()}`;
    const b2 = `b2-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimitByIp(req, { bucket: b1, max: 3, windowMs: 60_000 });
    expect(rateLimitByIp(req, { bucket: b1, max: 3, windowMs: 60_000 })).toBe(true);
    expect(rateLimitByIp(req, { bucket: b2, max: 3, windowMs: 60_000 })).toBe(false);
  });
});
