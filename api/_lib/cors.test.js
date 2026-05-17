// Unit-тесты для CORS whitelist.
//
// Покрываем:
//   - whitelisted origin → CORS headers выставлены
//   - non-whitelisted origin → НЕ выставлены (браузер заблокирует)
//   - no Origin (server-to-server) → пропускаем без headers
//   - *.vercel.app pattern работает
//   - *.telegram.org pattern работает
//   - OPTIONS preflight возвращает true (early-exit)

import { describe, it, expect } from 'vitest';
import { setCors, isAllowedOrigin } from './cors.js';

// Минимальный mock res object — собирает все setHeader вызовы.
function mockRes() {
  const headers = {};
  let status = null;
  let ended = false;
  return {
    setHeader: (k, v) => { headers[k] = v; },
    status: (s) => { status = s; return { end: () => { ended = true; } }; },
    getHeaders: () => headers,
    getStatus: () => status,
    isEnded: () => ended,
  };
}

describe('isAllowedOrigin', () => {
  it('пропускает visadel.agency', () => {
    expect(isAllowedOrigin('https://visadel.agency')).toBe(true);
  });

  it('пропускает www.visadel.agency', () => {
    expect(isAllowedOrigin('https://www.visadel.agency')).toBe(true);
  });

  it('пропускает *.vercel.app preview', () => {
    expect(isAllowedOrigin('https://visadel-test.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://feature-abc-123.vercel.app')).toBe(true);
  });

  it('пропускает *.telegram.org', () => {
    expect(isAllowedOrigin('https://web.telegram.org')).toBe(true);
    expect(isAllowedOrigin('https://k.telegram.org')).toBe(true);
    expect(isAllowedOrigin('https://random-subdomain.telegram.org')).toBe(true);
  });

  it('блокирует evil.com', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
  });

  it('блокирует http (не https) visadel.agency', () => {
    expect(isAllowedOrigin('http://visadel.agency')).toBe(false);
  });

  it('блокирует homograph attack (visadel.agency.evil.com)', () => {
    expect(isAllowedOrigin('https://visadel.agency.evil.com')).toBe(false);
  });

  it('блокирует null / undefined / пустую строку', () => {
    expect(isAllowedOrigin(null)).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
    expect(isAllowedOrigin('')).toBe(false);
  });
});

describe('setCors', () => {
  it('выставляет CORS headers для whitelisted origin', () => {
    const res = mockRes();
    const result = setCors(
      { method: 'POST', headers: { origin: 'https://visadel.agency' } },
      res
    );
    expect(result).toBe(false); // не OPTIONS
    expect(res.getHeaders()['Access-Control-Allow-Origin']).toBe('https://visadel.agency');
    expect(res.getHeaders()['Vary']).toBe('Origin');
  });

  it('НЕ выставляет CORS headers для evil origin', () => {
    const res = mockRes();
    setCors(
      { method: 'POST', headers: { origin: 'https://evil.com' } },
      res
    );
    expect(res.getHeaders()['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('обрабатывает OPTIONS preflight и возвращает true', () => {
    const res = mockRes();
    const result = setCors(
      { method: 'OPTIONS', headers: { origin: 'https://visadel.agency' } },
      res
    );
    expect(result).toBe(true); // handler должен сразу вернуть
    expect(res.getStatus()).toBe(204);
    expect(res.isEnded()).toBe(true);
  });

  it('пропускает server-to-server (без Origin header)', () => {
    const res = mockRes();
    const result = setCors({ method: 'POST', headers: {} }, res);
    expect(result).toBe(false);
    // CORS headers не выставлены — браузер бы заблокировал, но server-to-server
    // не обрабатывает их и работает дальше.
    expect(res.getHeaders()['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('включает Authorization и X-Telegram-Init-Data в Allow-Headers', () => {
    const res = mockRes();
    setCors(
      { method: 'POST', headers: { origin: 'https://visadel.agency' } },
      res
    );
    const allowHeaders = res.getHeaders()['Access-Control-Allow-Headers'];
    expect(allowHeaders).toContain('Authorization');
    expect(allowHeaders).toContain('X-Telegram-Init-Data');
    expect(allowHeaders).toContain('X-Service-Key');
  });
});
