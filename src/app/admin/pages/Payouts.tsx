// Admin Payouts — manual partner payout management.
//
// Workflow:
// 1. Admin sees list of partners with partner_balance > 0 (ready to pay).
// 2. Clicks row → modal with payout form (amount, card, note).
// 3. Confirms → creates partner_payouts row + bonus_logs entry +
//    decrements users.partner_balance.
// 4. Founder затем вручную переводит ₽ с своей карты — кнопка лишь
//    закрывает учёт в системе, не делает фактический перевод.
//
// История выплат — отдельная таблица снизу.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wallet, Loader2, Search, X, Check, FileDown, Clock, AlertCircle, RefreshCw,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiFetch';

// ── Types ───────────────────────────────────────────────────────────────────

interface PartnerRow {
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  partner_balance: number;
  // From partner_settings (LEFT JOIN)
  full_name: string | null;
  card_number_last4: string | null;
  card_bank: string | null;
  inn: string | null;
  // Aggregated counters
  pending_hold: number;       // sum of partner_pending bonus_logs (in 30d hold)
  total_paid: number;         // sum of |partner_paid| amounts
  total_approved_lifetime: number; // sum of partner_approved + partner_paid amounts (all-time earnings)
}

interface PayoutRow {
  id: string;
  telegram_id: number;
  amount_rub: number;
  status: string;
  card_last4: string | null;
  note: string | null;
  processed_at: string | null;
  created_at: string;
  // Joined from users
  partner_name?: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'В ожидании', cls: 'bg-amber-100 text-amber-700' },
  processed: { label: 'Выплачено',  cls: 'bg-emerald-100 text-emerald-700' },
  failed:    { label: 'Ошибка',     cls: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Отменено',   cls: 'bg-gray-100 text-gray-700' },
};

// ── Component ───────────────────────────────────────────────────────────────

export function Payouts() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [history, setHistory] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PartnerRow | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    setLoading(true);
    try {
      // 1. Все партнёры (is_influencer=true) с балансом ИЛИ pending hold
      const { data: usersData } = await supabase
        .from('users')
        .select('telegram_id, first_name, last_name, username, partner_balance')
        .eq('is_influencer', true)
        .order('partner_balance', { ascending: false });
      const usersList = (usersData ?? []) as Array<Pick<PartnerRow, 'telegram_id' | 'first_name' | 'last_name' | 'username' | 'partner_balance'>>;

      // 2. partner_settings (LEFT JOIN — реквизиты)
      const tgIds = usersList.map(u => u.telegram_id);
      const { data: settingsData } = tgIds.length > 0
        ? await supabase.from('partner_settings').select('*').in('telegram_id', tgIds)
        : { data: [] };
      const settingsMap = new Map<number, { full_name: string | null; card_number_last4: string | null; card_bank: string | null; inn: string | null }>();
      for (const s of (settingsData ?? []) as Array<{ telegram_id: number; full_name: string | null; card_number_last4: string | null; card_bank: string | null; inn: string | null }>) {
        settingsMap.set(s.telegram_id, s);
      }

      // 3. Bonus_logs aggregates (pending hold + lifetime)
      const { data: logsData } = tgIds.length > 0
        ? await supabase.from('bonus_logs').select('telegram_id, type, amount').in('telegram_id', tgIds).in('type', ['partner_pending', 'partner_approved', 'partner_paid'])
        : { data: [] };
      const aggMap = new Map<number, { pending: number; approved: number; paid: number }>();
      for (const l of (logsData ?? []) as Array<{ telegram_id: number; type: string; amount: number }>) {
        const a = aggMap.get(l.telegram_id) ?? { pending: 0, approved: 0, paid: 0 };
        if (l.type === 'partner_pending')  a.pending  += l.amount;
        if (l.type === 'partner_approved') a.approved += l.amount;
        if (l.type === 'partner_paid')     a.paid     += l.amount;
        aggMap.set(l.telegram_id, a);
      }

      const enriched: PartnerRow[] = usersList.map(u => {
        const s = settingsMap.get(u.telegram_id);
        const a = aggMap.get(u.telegram_id) ?? { pending: 0, approved: 0, paid: 0 };
        return {
          ...u,
          full_name: s?.full_name ?? null,
          card_number_last4: s?.card_number_last4 ?? null,
          card_bank: s?.card_bank ?? null,
          inn: s?.inn ?? null,
          pending_hold: a.pending,
          // partner_paid amounts are negative — берём абсолютное значение для отображения
          total_paid: Math.abs(a.paid),
          // lifetime earnings = approved + paid (paid отрицательные, поэтому abs + approved)
          total_approved_lifetime: a.approved + Math.abs(a.paid),
        };
      });

      setPartners(enriched);

      // 4. История выплат (последние 50)
      const { data: payoutsData } = await supabase
        .from('partner_payouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      const partnerNameById = new Map<number, string>();
      for (const u of usersList) {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || `@${u.username ?? u.telegram_id}`;
        partnerNameById.set(u.telegram_id, name);
      }
      setHistory(((payoutsData ?? []) as PayoutRow[]).map(p => ({
        ...p,
        partner_name: partnerNameById.get(p.telegram_id) ?? `tg ${p.telegram_id}`,
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    if (!search.trim()) return partners;
    const q = search.toLowerCase();
    return partners.filter(p => {
      const name = `${p.first_name} ${p.last_name ?? ''} ${p.username ?? ''} ${p.full_name ?? ''}`.toLowerCase();
      return name.includes(q) || String(p.telegram_id).includes(q);
    });
  }, [partners, search]);

  const totalAvailable = useMemo(() => partners.reduce((s, p) => s + p.partner_balance, 0), [partners]);
  const totalPending = useMemo(() => partners.reduce((s, p) => s + p.pending_hold, 0), [partners]);

  const handleExportCsv = () => {
    const rows: string[][] = [
      ['Дата', 'Партнёр', 'telegram_id', 'Сумма ₽', 'Карта', 'Статус', 'Заметка'],
    ];
    for (const p of history) {
      rows.push([
        new Date(p.created_at).toLocaleString('ru-RU'),
        p.partner_name ?? '',
        String(p.telegram_id),
        String(p.amount_rub),
        p.card_last4 ?? '',
        STATUS_LABEL[p.status]?.label ?? p.status,
        p.note ?? '',
      ]);
    }
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `partner_payouts_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">Партнёрские выплаты</h1>
          <p className="text-xs text-gray-500 mt-1">
            К выплате: <span className="text-emerald-600 font-bold tabular-nums">{totalAvailable.toLocaleString('ru-RU')}₽</span>
            {' · '}В hold-периоде: <span className="text-amber-600 font-bold tabular-nums">{totalPending.toLocaleString('ru-RU')}₽</span>
            {' · '}Партнёров: {partners.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button
            onClick={() => void refresh()}
            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition flex items-center gap-1.5 text-sm"
            title="Обновить"
          >
            <RefreshCw size={14} /> Обновить
          </button>
          <button
            onClick={handleExportCsv}
            disabled={history.length === 0}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition flex items-center gap-1.5 text-sm disabled:opacity-50"
            title="Экспорт CSV"
          >
            <FileDown size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Поиск по имени, username, telegram_id"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3B5BFF]"
        />
      </div>

      {/* Partners table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Партнёры
          </p>
        </div>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {loading ? 'Загружаем…' : 'Нет партнёров. Чтобы добавить — выдай юзеру статус «Партнёр» в Пользователях.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(p => {
              const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || `@${p.username ?? p.telegram_id}`;
              const ready = p.partner_balance > 0;
              return (
                <button
                  key={p.telegram_id}
                  onClick={() => setSelected(p)}
                  className={`w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-blue-50/30 active:bg-blue-50/60 transition text-left ${ready ? '' : 'opacity-60'}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0F2A36] truncate">{name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 tabular-nums truncate">
                      ID {p.telegram_id}{p.username ? ` · @${p.username}` : ''}
                      {p.card_number_last4 ? ` · карта •• ${p.card_number_last4}` : ''}
                    </p>
                    {p.pending_hold > 0 && (
                      <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        В hold-периоде: {p.pending_hold.toLocaleString('ru-RU')}₽
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold tabular-nums ${ready ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {p.partner_balance.toLocaleString('ru-RU')}₽
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">К выплате</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            История выплат
          </p>
          <p className="text-xs text-gray-400 tabular-nums">{history.length}</p>
        </div>
        {history.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Выплат ещё не было</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map(h => (
              <div key={h.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0F2A36] truncate">{h.partner_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(h.created_at).toLocaleString('ru-RU')}
                    {h.card_last4 ? ` · карта •• ${h.card_last4}` : ''}
                    {h.note ? ` · ${h.note}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <p className="text-sm font-bold tabular-nums text-[#0F2A36]">
                    {h.amount_rub.toLocaleString('ru-RU')}₽
                  </p>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_LABEL[h.status]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[h.status]?.label ?? h.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payout modal */}
      {selected && (
        <PayoutModal
          partner={selected}
          onClose={() => setSelected(null)}
          onDone={() => { setSelected(null); void refresh(); }}
        />
      )}
    </div>
  );
}

// ── Payout modal ────────────────────────────────────────────────────────────

const PayoutModal: React.FC<{
  partner: PartnerRow;
  onClose: () => void;
  onDone: () => void;
}> = ({ partner, onClose, onDone }) => {
  const [amount, setAmount] = useState(String(partner.partner_balance));
  const [cardLast4, setCardLast4] = useState(partner.card_number_last4 ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partnerName = [partner.first_name, partner.last_name].filter(Boolean).join(' ').trim() || `@${partner.username ?? partner.telegram_id}`;
  const numericAmount = parseInt(amount, 10) || 0;
  const isValid = numericAmount > 0 && numericAmount <= partner.partner_balance;

  const handleSubmit = async () => {
    if (!isValid) {
      setError(`Сумма должна быть от 1 до ${partner.partner_balance}₽`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // 1. Insert partner_payouts row (status='processed' immediately — founder
      //    нажал кнопку = подтверждает что вручную сделал перевод)
      const { error: payoutErr } = await supabase.from('partner_payouts').insert({
        telegram_id: partner.telegram_id,
        amount_rub: numericAmount,
        status: 'processed',
        card_last4: cardLast4.trim() || null,
        note: note.trim() || null,
        processed_at: new Date().toISOString(),
      });
      if (payoutErr) throw new Error(`partner_payouts: ${payoutErr.message}`);

      // 2. Decrement partner_balance
      const newBalance = partner.partner_balance - numericAmount;
      const { error: updErr } = await supabase
        .from('users')
        .update({ partner_balance: newBalance })
        .eq('telegram_id', partner.telegram_id);
      if (updErr) throw new Error(`users update: ${updErr.message}`);

      // 3. Audit log: bonus_logs entry type='partner_paid' с отрицательной суммой
      const { error: logErr } = await supabase.from('bonus_logs').insert({
        telegram_id: partner.telegram_id,
        type: 'partner_paid',
        amount: -numericAmount,
        description: `−${numericAmount}₽ выплата на карту${cardLast4 ? ` •• ${cardLast4}` : ''}${note ? ` (${note})` : ''}`,
      });
      if (logErr) console.warn('bonus_logs insert failed (non-fatal):', logErr);

      // 4. Push-уведомление партнёру: «X₽ переведено» (best-effort)
      apiFetch('/api/notify-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: partner.telegram_id,
          status: 'partner_payout_processed',
          amount: numericAmount,
          card_last4: cardLast4.trim() || null,
          application_id: `partner_notify_payout_${partner.telegram_id}_${Date.now()}`,
        }),
      }).catch(e => console.warn('partner notify (payout) error:', e));

      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Выплата партнёру</p>
            <p className="text-base font-bold text-[#0F2A36] truncate mt-0.5">{partnerName}</p>
            <p className="text-xs text-gray-500 mt-0.5">ID {partner.telegram_id}{partner.username ? ` · @${partner.username}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition" aria-label="Закрыть">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Balance summary */}
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">К выплате</p>
            <p className="text-xl font-bold text-emerald-600 tabular-nums mt-0.5">
              {partner.partner_balance.toLocaleString('ru-RU')}₽
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">В hold-периоде</p>
            <p className="text-xl font-bold text-amber-600 tabular-nums mt-0.5">
              {partner.pending_hold.toLocaleString('ru-RU')}₽
            </p>
          </div>
        </div>

        {/* Partner settings (info only) */}
        {(partner.full_name || partner.card_number_last4 || partner.inn) && (
          <div className="px-5 py-3 border-b border-gray-100 bg-blue-50/30">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Реквизиты партнёра</p>
            {partner.full_name && <p className="text-sm text-gray-700">ФИО: {partner.full_name}</p>}
            {partner.card_number_last4 && (
              <p className="text-sm text-gray-700">
                Карта: •• {partner.card_number_last4}{partner.card_bank ? ` · ${partner.card_bank}` : ''}
              </p>
            )}
            {partner.inn && <p className="text-sm text-gray-700">ИНН: {partner.inn}</p>}
          </div>
        )}

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Сумма выплаты, ₽</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={partner.partner_balance}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#3B5BFF] tabular-nums"
              />
              <button
                onClick={() => setAmount(String(partner.partner_balance))}
                className="px-3 py-2.5 text-xs font-semibold text-[#3B5BFF] hover:bg-blue-50 rounded-lg transition whitespace-nowrap"
              >
                Всё
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Последние 4 цифры карты (опц.)</label>
            <input
              type="text"
              maxLength={4}
              placeholder="6411"
              value={cardLast4}
              onChange={e => setCardLast4(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#3B5BFF] tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Заметка (опц.)</label>
            <textarea
              rows={2}
              placeholder="Например: октябрьская выплата, чек №12345"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#3B5BFF] resize-none"
            />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 leading-relaxed">
            <strong>⚠️ Это просто учёт в системе.</strong>{' '}
            Перевод денег партнёру делаешь сам — с своей карты на его карту •• {cardLast4 || partner.card_number_last4 || '????'}.
            После нажатия «Подтвердить» баланс партнёра уменьшится на {numericAmount.toLocaleString('ru-RU')}₽.
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className="px-4 py-2.5 vd-grad text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Подтвердить выплату
          </button>
        </div>
      </div>
    </div>
  );
};
