// Unit-тесты для Zod-схем.
// Цель — зафиксировать что:
//   - Невалидные input'ы → ok:false (regression-protect от ослабления схем)
//   - Валидные input'ы проходят
//   - Type coercion НЕ работает (string '100' ≠ number 100)
//   - Sanitization HTML в именах работает
//
// Запуск: npm test

import { describe, it, expect } from 'vitest';
import {
  validate,
  grantBonusSchema,
  notifyStatusSchema,
  webUserUpsertSchema,
  postReviewSchema,
  adminGrantBonusSchema,
} from './validators.js';

describe('grantBonusSchema', () => {
  it('пропускает валидный input', () => {
    const r = validate({ type: 'payment', amount: 100 }, grantBonusSchema);
    expect(r.ok).toBe(true);
    expect(r.data.type).toBe('payment');
    expect(r.data.amount).toBe(100);
  });

  it('отвергает string amount (type coercion защита)', () => {
    const r = validate({ type: 'payment', amount: '100' }, grantBonusSchema);
    expect(r.ok).toBe(false);
    expect(r.errors[0].path).toContain('amount');
  });

  it('отвергает unknown type', () => {
    const r = validate({ type: 'hack', amount: 100 }, grantBonusSchema);
    expect(r.ok).toBe(false);
  });

  it('отвергает amount > 1M', () => {
    const r = validate({ type: 'payment', amount: 2_000_000 }, grantBonusSchema);
    expect(r.ok).toBe(false);
  });

  it('допускает negative amount (списания)', () => {
    const r = validate({ type: 'payment', amount: -500 }, grantBonusSchema);
    expect(r.ok).toBe(true);
  });

  it('отвергает float amount', () => {
    const r = validate({ type: 'payment', amount: 100.5 }, grantBonusSchema);
    expect(r.ok).toBe(false);
  });
});

describe('adminGrantBonusSchema', () => {
  it('пропускает валидный input', () => {
    const r = validate(
      { target_telegram_id: 123456, amount: 500, add: true },
      adminGrantBonusSchema
    );
    expect(r.ok).toBe(true);
    expect(r.data.add).toBe(true);
  });

  it('default add=true если не передан', () => {
    const r = validate(
      { target_telegram_id: 123456, amount: 500 },
      adminGrantBonusSchema
    );
    expect(r.ok).toBe(true);
    expect(r.data.add).toBe(true);
  });

  it('отвергает negative amount (нельзя обнулить чужой баланс через -1M)', () => {
    const r = validate(
      { target_telegram_id: 123456, amount: -1_000_000, add: true },
      adminGrantBonusSchema
    );
    expect(r.ok).toBe(false);
  });

  it('отвергает amount=0', () => {
    const r = validate(
      { target_telegram_id: 123456, amount: 0, add: true },
      adminGrantBonusSchema
    );
    expect(r.ok).toBe(false);
  });

  it('требует target_telegram_id', () => {
    const r = validate({ amount: 500 }, adminGrantBonusSchema);
    expect(r.ok).toBe(false);
    expect(r.errors[0].path).toContain('target_telegram_id');
  });

  it('отвергает negative telegram_id', () => {
    const r = validate(
      { target_telegram_id: -1, amount: 500 },
      adminGrantBonusSchema
    );
    expect(r.ok).toBe(false);
  });
});

describe('webUserUpsertSchema', () => {
  it('пропускает валидное имя', () => {
    const r = validate({ first_name: 'Иван' }, webUserUpsertSchema);
    expect(r.ok).toBe(true);
  });

  it('блокирует HTML-инъекции в имени', () => {
    const r = validate(
      { first_name: '<script>alert(1)</script>' },
      webUserUpsertSchema
    );
    expect(r.ok).toBe(false);
  });

  it('блокирует невалидный phone', () => {
    const r = validate(
      { first_name: 'Иван', phone: 'not-a-phone' },
      webUserUpsertSchema
    );
    expect(r.ok).toBe(false);
  });

  it('пропускает валидный phone', () => {
    const r = validate(
      { first_name: 'Иван', phone: '+7 (999) 123-45-67' },
      webUserUpsertSchema
    );
    expect(r.ok).toBe(true);
  });

  it('блокирует fake referral_code (не подходит regex)', () => {
    const r = validate(
      { first_name: 'Иван', referred_by: 'a' }, // < 2 chars
      webUserUpsertSchema
    );
    expect(r.ok).toBe(false);
  });

  it('блокирует слишком длинное имя', () => {
    const r = validate(
      { first_name: 'A'.repeat(100) },
      webUserUpsertSchema
    );
    expect(r.ok).toBe(false);
  });
});

describe('postReviewSchema', () => {
  it('пропускает валидный отзыв', () => {
    const r = validate(
      { rating: 5, text: 'Отлично!', country: 'Таиланд' },
      postReviewSchema
    );
    expect(r.ok).toBe(true);
  });

  it('отвергает пустой text', () => {
    const r = validate(
      { rating: 5, text: '' },
      postReviewSchema
    );
    expect(r.ok).toBe(false);
  });

  it('отвергает rating=0 и rating=6', () => {
    expect(validate({ rating: 0, text: 'ok' }, postReviewSchema).ok).toBe(false);
    expect(validate({ rating: 6, text: 'ok' }, postReviewSchema).ok).toBe(false);
  });

  it('отвергает text > 2000 chars (anti-spam)', () => {
    const r = validate(
      { rating: 5, text: 'a'.repeat(2001) },
      postReviewSchema
    );
    expect(r.ok).toBe(false);
  });
});

describe('notifyStatusSchema', () => {
  it('пропускает валидный status', () => {
    const r = validate(
      { status: 'in_progress', application_id: 'abc-123' },
      notifyStatusSchema
    );
    expect(r.ok).toBe(true);
  });

  it('отвергает unknown status', () => {
    const r = validate(
      { status: 'hacked' },
      notifyStatusSchema
    );
    expect(r.ok).toBe(false);
  });

  it('passthrough неизвестных полей (admin/cron extras)', () => {
    const r = validate(
      { status: 'in_progress', custom_field: 'x', amount: 500 },
      notifyStatusSchema
    );
    expect(r.ok).toBe(true);
    expect(r.data.custom_field).toBe('x');
  });
});

describe('validate() helper', () => {
  it('лимит 10 errors (не выгружает всю схему)', () => {
    // Объект с 20 невалидными полями
    const bad = {};
    for (let i = 0; i < 20; i++) bad[`field${i}`] = null;
    const r = validate(bad, grantBonusSchema);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeLessThanOrEqual(10);
  });

  it('errors имеют path и message без полного z.flatten()', () => {
    const r = validate({ amount: 'wrong' }, grantBonusSchema);
    expect(r.ok).toBe(false);
    for (const e of r.errors) {
      expect(typeof e.path).toBe('string');
      expect(typeof e.message).toBe('string');
    }
  });
});
