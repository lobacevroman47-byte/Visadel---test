// Админка → Партнёры. Единая страница работы с партнёрской программой.
//
// Содержит две вкладки:
//   • Все партнёры — расширенная таблица со всеми реквизитами + кнопка
//     «Выплатить» прямо в строке (если есть баланс и указан налоговый статус)
//   • История выплат — все partner_payouts отсортированные по дате
//
// Заменила собой Payouts.tsx (который был отдельной страницей) — функционал
// был фактически дублирующий, обе работали с одним и тем же набором данных.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Crown, Loader2, Search, FileDown, RefreshCw, Copy, Check, AlertCircle,
  X, Wallet, Send, Link as LinkIcon, Sparkles, ExternalLink, Clock,
  CreditCard, Phone, Building2, Hash, FileText, History,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiFetch';
import { useDialog } from '../../components/shared/BrandDialog';
import { Button, Modal } from '../../components/ui/brand';

// Имя бота — из env (VITE_TG_BOT_USERNAME). Fallback для dev — Visadel_test_bot.
// Меняется в Vercel → Settings → Environment Variables.
const BOT_USERNAME = (import.meta.env.VITE_TG_BOT_USERNAME as string | undefined) || 'Visadel_test_bot';

interface BonusLogEntry {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface PartnerFullRow {
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  partner_balance: number;
  vanity_code: string | null;
  referral_code: string | null;
  // From partner_settings (LEFT JOIN)
  full_name: string | null;
  organization_name: string | null;
  inn: string | null;
  kpp: string | null;
  card_number: string | null;
  card_number_last4: string | null;
  card_bank: string | null;
  phone_for_sbp: string | null;
  bank_account: string | null;
  bank_bic: string | null;
  entity_type: string | null;
  agreement_accepted_at: string | null;
  // Aggregates
  pending_hold: number;
  total_paid: number;
  total_approved_lifetime: number;
}

interface PayoutHistoryRow {
  id: string;
  telegram_id: number;
  amount_rub: number;
  status: string;
  card_last4: string | null;
  note: string | null;
  processed_at: string | null;
  created_at: string;
  partner_name?: string;
}

const STATUS_COLORS: Record<string, string> = {
  self_employed: 'bg-blue-100 text-blue-700',
  ip:            'bg-purple-100 text-purple-700',
  legal:         'bg-indigo-100 text-indigo-700',
};
const STATUS_LABELS: Record<string, string> = {
  self_employed: 'Самозанятый',
  ip:            'ИП',
  legal:         'Юрлицо',
};
const PAYOUT_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'В ожидании', cls: 'bg-amber-100 text-amber-700' },
  processed: { label: 'Выплачено',  cls: 'bg-emerald-100 text-emerald-700' },
  failed:    { label: 'Ошибка',     cls: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Отменено',   cls: 'bg-gray-100 text-gray-700' },
};

// ── Component ───────────────────────────────────────────────────────────────

export function Partners() {
  const dialog = useDialog();
  const [partners, setPartners] = useState<PartnerFullRow[]>([]);
  const [history, setHistory] = useState<PayoutHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'self_employed' | 'ip' | 'legal' | 'none' | 'with_balance'>('all');
  const [tab, setTab] = useState<'list' | 'history'>('list');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [payoutTarget, setPayoutTarget] = useState<PartnerFullRow | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<PartnerFullRow | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('telegram_id, first_name, last_name, username, partner_balance, vanity_code, referral_code')
        .eq('is_influencer', true)
        .order('partner_balance', { ascending: false });
      const usersList = (usersData ?? []) as Array<{
        telegram_id: number; first_name: string; last_name: string | null;
        username: string | null; partner_balance: number;
        vanity_code: string | null; referral_code: string | null;
      }>;

      const tgIds = usersList.map(u => u.telegram_id);
      const { data: settingsData } = tgIds.length > 0
        ? await supabase.from('partner_settings').select('*').in('telegram_id', tgIds)
        : { data: [] };
      const settingsMap = new Map<number, Record<string, unknown>>();
      for (const s of (settingsData ?? []) as Array<Record<string, unknown> & { telegram_id: number }>) {
        settingsMap.set(s.telegram_id, s);
      }

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

      const enriched: PartnerFullRow[] = usersList.map(u => {
        const s = settingsMap.get(u.telegram_id) ?? {};
        const a = aggMap.get(u.telegram_id) ?? { pending: 0, approved: 0, paid: 0 };
        return {
          ...u,
          full_name:               (s.full_name as string | null) ?? null,
          organization_name:       (s.organization_name as string | null) ?? null,
          inn:                     (s.inn as string | null) ?? null,
          kpp:                     (s.kpp as string | null) ?? null,
          card_number:             (s.card_number as string | null) ?? null,
          card_number_last4:       (s.card_number_last4 as string | null) ?? null,
          card_bank:               (s.card_bank as string | null) ?? null,
          phone_for_sbp:           (s.phone_for_sbp as string | null) ?? null,
          bank_account:            (s.bank_account as string | null) ?? null,
          bank_bic:                (s.bank_bic as string | null) ?? null,
          entity_type:             (s.entity_type as string | null) ?? null,
          agreement_accepted_at:   (s.agreement_accepted_at as string | null) ?? null,
          // HOLD = pending - approved (clip 0): pending запись остаётся в БД
          // после approval, и без вычета HOLD визуально удваивает деньги.
          pending_hold:            Math.max(0, a.pending - a.approved),
          total_paid:              Math.abs(a.paid),
          // Lifetime earnings = approved (paid это снятие с balance, оно
          // не earnings; раньше суммировали approved + |paid| что давало
          // double-count для уже выплаченных денег).
          total_approved_lifetime: a.approved,
        };
      });
      setPartners(enriched);

      // История выплат
      const { data: payoutsData } = await supabase
        .from('partner_payouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      const partnerNameById = new Map<number, string>();
      for (const u of usersList) {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || `@${u.username ?? u.telegram_id}`;
        partnerNameById.set(u.telegram_id, name);
      }
      setHistory(((payoutsData ?? []) as PayoutHistoryRow[]).map(p => ({
        ...p,
        partner_name: partnerNameById.get(p.telegram_id) ?? `tg ${p.telegram_id}`,
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    let list = partners;
    if (statusFilter === 'none') {
      list = list.filter(p => !p.entity_type);
    } else if (statusFilter === 'with_balance') {
      list = list.filter(p => p.partner_balance > 0);
    } else if (statusFilter !== 'all') {
      list = list.filter(p => p.entity_type === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => {
        const blob = [
          p.first_name, p.last_name, p.username, p.full_name, p.organization_name,
          p.inn, p.kpp, p.card_number, p.phone_for_sbp, p.bank_account,
          String(p.telegram_id), p.referral_code, p.vanity_code,
        ].filter(Boolean).join(' ').toLowerCase();
        return blob.includes(q);
      });
    }
    return list;
  }, [partners, search, statusFilter]);

  const stats = useMemo(() => {
    const totalAvailable = partners.reduce((s, p) => s + p.partner_balance, 0);
    const totalHold      = partners.reduce((s, p) => s + p.pending_hold, 0);
    const totalLifetime  = partners.reduce((s, p) => s + p.total_approved_lifetime, 0);
    const noStatus       = partners.filter(p => !p.entity_type).length;
    const readyToPay     = partners.filter(p => p.partner_balance > 0 && p.entity_type).length;
    return { totalAvailable, totalHold, totalLifetime, noStatus, readyToPay };
  }, [partners]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      await dialog.info('Скопируйте вручную', text);
    }
  };

  const handleExportRequisitesCsv = () => {
    const rows: string[][] = [
      ['Telegram ID', 'username', 'Имя в TG', 'Реф-код', 'Vanity', 'Статус',
       'ФИО / Название', 'ИНН', 'КПП', 'Карта', 'Last4', 'Банк',
       'СБП телефон', 'Расчётный счёт', 'БИК',
       'Баланс ₽', 'Hold ₽', 'Заработано всего ₽', 'Согласие принято'],
    ];
    for (const p of filtered) {
      const tgName = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
      rows.push([
        String(p.telegram_id), p.username ?? '', tgName,
        p.referral_code ?? '', p.vanity_code ?? '',
        p.entity_type ? STATUS_LABELS[p.entity_type] ?? p.entity_type : 'Не указан',
        p.organization_name || p.full_name || '',
        p.inn ?? '', p.kpp ?? '',
        p.card_number ?? '', p.card_number_last4 ?? '', p.card_bank ?? '',
        p.phone_for_sbp ?? '', p.bank_account ?? '', p.bank_bic ?? '',
        String(p.partner_balance), String(p.pending_hold), String(p.total_approved_lifetime),
        p.agreement_accepted_at ? new Date(p.agreement_accepted_at).toLocaleString('ru-RU') : '',
      ]);
    }
    downloadCsv(rows, `partners_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportHistoryCsv = () => {
    const rows: string[][] = [
      ['Дата', 'Партнёр', 'telegram_id', 'Сумма ₽', 'Карта', 'Статус'],
    ];
    for (const p of history) {
      rows.push([
        new Date(p.created_at).toLocaleString('ru-RU'),
        p.partner_name ?? '',
        String(p.telegram_id),
        String(p.amount_rub),
        p.card_last4 ?? '',
        PAYOUT_STATUS_BADGE[p.status]?.label ?? p.status,
      ]);
    }
    downloadCsv(rows, `partner_payouts_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const downloadCsv = (rows: string[][], filename: string) => {
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36] flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" /> Партнёры
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Всего: <b>{partners.length}</b>
            {' · '}К выплате: <span className="text-emerald-600 font-bold tabular-nums">{stats.totalAvailable.toLocaleString('ru-RU')}₽</span>
            {' · '}В hold: <span className="text-amber-600 font-bold tabular-nums">{stats.totalHold.toLocaleString('ru-RU')}₽</span>
            {' · '}Заработано всего: <span className="text-[#3B5BFF] font-bold tabular-nums">{stats.totalLifetime.toLocaleString('ru-RU')}₽</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button
            onClick={() => void refresh()}
            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition flex items-center gap-1.5 text-sm"
          >
            <RefreshCw size={14} /> Обновить
          </button>
          <button
            onClick={tab === 'list' ? handleExportRequisitesCsv : handleExportHistoryCsv}
            disabled={tab === 'list' ? filtered.length === 0 : history.length === 0}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition flex items-center gap-1.5 text-sm disabled:opacity-50"
            title={tab === 'list' ? 'Экспорт реквизитов отфильтрованных партнёров' : 'Экспорт истории выплат'}
          >
            <FileDown size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl p-1 mb-4 w-fit">
        <button
          onClick={() => setTab('list')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'list' ? 'bg-[#0F2A36] text-white' : 'text-gray-600 hover:text-[#0F2A36]'
          }`}
        >
          Все партнёры ({partners.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'history' ? 'bg-[#0F2A36] text-white' : 'text-gray-600 hover:text-[#0F2A36]'
          }`}
        >
          История выплат ({history.length})
        </button>
      </div>

      {/* Tab content */}
      {tab === 'list' ? (
        <>
          {/* Filters (только в табе «Все партнёры») */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск: имя, ID, ИНН, телефон, карта, р/с"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3B5BFF]"
              />
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
              {([
                ['all', 'Все'],
                ['with_balance', `К выплате (${stats.readyToPay})`],
                ['self_employed', 'Самозанятый'],
                ['ip', 'ИП'],
                ['legal', 'Юрлицо'],
                ['none', `Без статуса (${stats.noStatus})`],
              ] as const).map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    statusFilter === f ? 'bg-white text-[#0F2A36] shadow-sm' : 'text-gray-600 hover:text-[#0F2A36]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {stats.noStatus > 0 && statusFilter !== 'none' && (
            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                <b>{stats.noStatus}</b> партнёров без налогового статуса — выплаты для них заблокированы.{' '}
                <button onClick={() => setStatusFilter('none')} className="underline font-medium">Показать только их →</button>
              </span>
            </div>
          )}

          {/* Partners table */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                {loading ? 'Загружаем…' : 'Нет партнёров в этом фильтре.'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider">
                  <tr>
                    <Th>Партнёр</Th>
                    <Th>Статус</Th>
                    <Th>ИНН / КПП</Th>
                    <Th>Куда платить</Th>
                    <Th>Банк</Th>
                    <Th align="right">Баланс ₽</Th>
                    <Th align="right">Hold ₽</Th>
                    <Th align="right">Заработано ₽</Th>
                    <Th align="right">Действие</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(p => {
                    const tgName = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
                      || `@${p.username ?? p.telegram_id}`;
                    const fioOrOrg = p.entity_type === 'legal' ? p.organization_name : p.full_name;
                    const hasStatus = !!p.entity_type;
                    const ready = p.partner_balance > 0;
                    const blocked = ready && !hasStatus;
                    const canPayOut = ready && hasStatus;

                    let payTo: { label: string; value: string } | null = null;
                    if (p.entity_type === 'self_employed') {
                      if (p.card_number) payTo = { label: 'Карта', value: p.card_number };
                      else if (p.phone_for_sbp) payTo = { label: 'СБП', value: p.phone_for_sbp };
                      else if (p.card_number_last4) payTo = { label: 'Карта', value: `•• ${p.card_number_last4}` };
                    } else if (p.entity_type === 'ip' || p.entity_type === 'legal') {
                      if (p.bank_account) payTo = { label: 'Р/с', value: p.bank_account };
                    }

                    return (
                      <tr
                        key={p.telegram_id}
                        onClick={() => setSelectedPartner(p)}
                        className="hover:bg-blue-50/30 transition cursor-pointer"
                      >
                        <td className="px-3 py-3 align-top">
                          <p className="font-semibold text-[#0F2A36]">{fioOrOrg || tgName}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
                            ID {p.telegram_id}{p.username ? ` · @${p.username}` : ''}
                          </p>
                          {p.vanity_code && (
                            <p className="text-[11px] text-[#3B5BFF] mt-0.5 font-mono">/{p.vanity_code}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          {p.entity_type ? (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.entity_type] ?? 'bg-gray-100'}`}>
                              {STATUS_LABELS[p.entity_type] ?? p.entity_type}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-100 text-rose-700">
                              Не указан
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-gray-700 font-mono">
                          {p.inn || <span className="text-gray-300">—</span>}
                          {p.kpp && <div className="text-gray-500 mt-0.5">КПП {p.kpp}</div>}
                        </td>
                        <td className="px-3 py-3 align-top">
                          {payTo ? (
                            <div className="flex items-start gap-1.5">
                              <div className="min-w-0">
                                <div className="text-[10px] text-gray-500 uppercase">{payTo.label}</div>
                                <div className="text-xs text-gray-900 font-mono truncate max-w-[200px]" title={payTo.value}>
                                  {payTo.value}
                                </div>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(payTo!.value, `pay-${p.telegram_id}`); }}
                                className="text-gray-400 hover:text-[#3B5BFF] active:scale-90 transition shrink-0 mt-1"
                                title="Скопировать"
                              >
                                {copiedId === `pay-${p.telegram_id}`
                                  ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">не заполнено</span>
                          )}
                          {(p.entity_type === 'ip' || p.entity_type === 'legal') && p.bank_bic && (
                            <div className="text-[11px] text-gray-500 mt-1 font-mono">БИК {p.bank_bic}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-gray-700">
                          {p.card_bank || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-3 align-top text-right">
                          <span className={`text-sm font-bold tabular-nums ${
                            blocked ? 'text-rose-500' : ready ? 'text-emerald-600' : 'text-gray-400'
                          }`}>
                            {p.partner_balance.toLocaleString('ru-RU')}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-right text-sm tabular-nums text-amber-600">
                          {p.pending_hold > 0 ? p.pending_hold.toLocaleString('ru-RU') : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-3 align-top text-right text-sm tabular-nums text-[#3B5BFF]">
                          {p.total_approved_lifetime > 0 ? p.total_approved_lifetime.toLocaleString('ru-RU') : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-3 align-top text-right">
                          {canPayOut ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setPayoutTarget(p); }}
                              className="px-3 py-1.5 vd-grad text-white text-xs font-semibold rounded-lg flex items-center gap-1 active:scale-95 transition ml-auto"
                            >
                              <Wallet className="w-3.5 h-3.5" /> Выплатить
                            </button>
                          ) : blocked ? (
                            <span className="text-[11px] text-rose-600" title="Партнёр не указал налоговый статус">
                              ⛔ заблокировано
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* History tab */
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
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
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="text-sm font-bold tabular-nums text-[#0F2A36]">
                      {h.amount_rub.toLocaleString('ru-RU')}₽
                    </p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${PAYOUT_STATUS_BADGE[h.status]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                      {PAYOUT_STATUS_BADGE[h.status]?.label ?? h.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Partner detail modal — клик по строке таблицы */}
      {selectedPartner && (
        <PartnerDetailModal
          partner={selectedPartner}
          onClose={() => setSelectedPartner(null)}
          onPayout={() => { setPayoutTarget(selectedPartner); setSelectedPartner(null); }}
          onDone={() => { setSelectedPartner(null); void refresh(); }}
        />
      )}

      {/* Payout modal */}
      {payoutTarget && (
        <PayoutModal
          partner={payoutTarget}
          onClose={() => setPayoutTarget(null)}
          onDone={() => { setPayoutTarget(null); void refresh(); }}
        />
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-3 py-2 font-semibold ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

// ── Payout modal ────────────────────────────────────────────────────────────

const PayoutModal: React.FC<{
  partner: PartnerFullRow;
  onClose: () => void;
  onDone: () => void;
}> = ({ partner, onClose, onDone }) => {
  const [amount, setAmount] = useState(String(partner.partner_balance));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partnerName = (partner.entity_type === 'legal' ? partner.organization_name : partner.full_name)
    || [partner.first_name, partner.last_name].filter(Boolean).join(' ').trim()
    || `@${partner.username ?? partner.telegram_id}`;
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
      // 1. Insert partner_payouts row → возвращаем ID, чтобы использовать его
      //    как dedupe_key в bonus_logs (защита от двойного списания при ретрае).
      const { data: payoutRow, error: payoutErr } = await supabase
        .from('partner_payouts')
        .insert({
          telegram_id: partner.telegram_id,
          amount_rub: numericAmount,
          status: 'processed',
          card_last4: partner.card_number_last4 ?? null,
          note: null,
          processed_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (payoutErr) throw new Error(`partner_payouts: ${payoutErr.message}`);
      const payoutId = (payoutRow as { id: string }).id;

      // 2. Audit log с dedupe_key=partner_paid_<payoutId>. Идёт ПЕРЕД балансом —
      //    если ретрай, unique constraint вернёт 0 строк → знаем что уже списали.
      const last4 = partner.card_number_last4;
      const { data: logInserted, error: logErr } = await supabase
        .from('bonus_logs')
        .upsert(
          {
            telegram_id: partner.telegram_id,
            type: 'partner_paid',
            amount: -numericAmount,
            description: `−${numericAmount}₽ выплата${last4 ? ` на карту •• ${last4}` : ''}`,
            dedupe_key: `partner_paid_${payoutId}`,
          },
          { onConflict: 'telegram_id,type,dedupe_key', ignoreDuplicates: true },
        )
        .select('id');
      if (logErr) console.warn('bonus_logs insert failed (non-fatal):', logErr);
      const wasNewLog = Array.isArray(logInserted) && logInserted.length > 0;

      // 3. Атомарный декремент через RPC (миграция 020). Запускаем только если
      //    лог реально вставился — если был дубль, баланс уже списан ранее.
      if (wasNewLog) {
        const { error: rpcErr } = await supabase.rpc('inc_partner_balance', {
          p_telegram_id: partner.telegram_id,
          p_delta: -numericAmount,
        });
        if (rpcErr) throw new Error(`inc_partner_balance: ${rpcErr.message}`);
      }

      // 4. Push-уведомление партнёру: «X₽ переведено» (best-effort)
      apiFetch('/api/notify-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: partner.telegram_id,
          status: 'partner_payout_processed',
          amount: numericAmount,
          card_last4: partner.card_number_last4 ?? null,
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
    <Modal
      open
      onClose={onClose}
      icon="💸"
      label="Выплата партнёру"
      title={partnerName}
      subtitle={`ID ${partner.telegram_id}${partner.username ? ` · @${partner.username}` : ''}`}
      size="sm"
      footer={(
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="md" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={!isValid || saving}
            loading={saving}
            leftIcon={!saving ? <Check className="w-4 h-4" /> : undefined}
          >
            Подтвердить выплату
          </Button>
        </div>
      )}
    >
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

        {/* Partner settings — отображаем поля по entity_type */}
        <div className="px-5 py-3 border-b border-gray-100 bg-blue-50/30 space-y-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Реквизиты партнёра</p>
            {partner.entity_type && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[partner.entity_type] ?? 'bg-gray-100'}`}>
                {STATUS_LABELS[partner.entity_type] ?? partner.entity_type}
              </span>
            )}
          </div>
          {partner.entity_type === 'legal' && partner.organization_name && (
            <p className="text-sm text-gray-700">Организация: {partner.organization_name}</p>
          )}
          {partner.entity_type !== 'legal' && partner.full_name && (
            <p className="text-sm text-gray-700">ФИО: {partner.full_name}</p>
          )}
          {partner.inn && <p className="text-sm text-gray-700 font-mono">ИНН: {partner.inn}</p>}
          {partner.entity_type === 'legal' && partner.kpp && (
            <p className="text-sm text-gray-700 font-mono">КПП: {partner.kpp}</p>
          )}
          {partner.entity_type === 'self_employed' && (
            <>
              {partner.card_number && (
                <p className="text-sm text-gray-700 font-mono">
                  Карта: {partner.card_number.replace(/(\d{4})(?=\d)/g, '$1 ')}
                  {partner.card_bank ? ` · ${partner.card_bank}` : ''}
                </p>
              )}
              {!partner.card_number && partner.card_number_last4 && (
                <p className="text-sm text-gray-700">
                  Карта: •• {partner.card_number_last4}{partner.card_bank ? ` · ${partner.card_bank}` : ''}
                </p>
              )}
              {partner.phone_for_sbp && (
                <p className="text-sm text-gray-700">СБП: {partner.phone_for_sbp}</p>
              )}
            </>
          )}
          {(partner.entity_type === 'ip' || partner.entity_type === 'legal') && (
            <>
              {partner.bank_account && <p className="text-sm text-gray-700 font-mono">Р/с: {partner.bank_account}</p>}
              {partner.bank_bic && <p className="text-sm text-gray-700 font-mono">БИК: {partner.bank_bic}</p>}
              {partner.card_bank && <p className="text-sm text-gray-700">Банк: {partner.card_bank}</p>}
            </>
          )}
        </div>

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

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 leading-relaxed">
            <strong>⚠️ Это просто учёт в системе.</strong>{' '}
            Перевод денег партнёру делаешь сам по реквизитам выше.
            После нажатия «Подтвердить» баланс партнёра уменьшится на {numericAmount.toLocaleString('ru-RU')}₽.
          </div>
        </div>

    </Modal>
  );
};

// ── Partner detail modal — расширенный профиль партнёра ─────────────────────

const PartnerDetailModal: React.FC<{
  partner: PartnerFullRow;
  onClose: () => void;
  onPayout: () => void;
  onDone: () => void;
}> = ({ partner, onClose, onPayout, onDone }) => {
  const dialog = useDialog();
  const [recentLogs, setRecentLogs] = useState<BonusLogEntry[] | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [earlyConfirm, setEarlyConfirm] = useState<{ amount: number; daysLeft: number; pendingIds: { id: string; amount: number; dedupe_key: string | null; created_at: string }[] } | null>(null);
  const [earlyProcessing, setEarlyProcessing] = useState(false);

  // Подгружаем последние 10 partner_* событий для контекста «за что начисляли/выплачивали»
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('bonus_logs')
        .select('id, type, amount, description, created_at')
        .eq('telegram_id', partner.telegram_id)
        .like('type', 'partner_%')
        .order('created_at', { ascending: false })
        .limit(10);
      if (!cancelled) setRecentLogs((data ?? []) as BonusLogEntry[]);
    })();
    return () => { cancelled = true; };
  }, [partner.telegram_id]);

  // Готовим контекст для досрочной выплаты: находим pending без approved.
  const handleStartEarly = async () => {
    setEarlyProcessing(true);
    try {
      const HOLD_DAYS = 30;
      const [pendingRes, approvedRes] = await Promise.all([
        supabase.from('bonus_logs')
          .select('id, amount, dedupe_key, created_at')
          .eq('telegram_id', partner.telegram_id)
          .eq('type', 'partner_pending'),
        supabase.from('bonus_logs')
          .select('dedupe_key')
          .eq('telegram_id', partner.telegram_id)
          .eq('type', 'partner_approved'),
      ]);
      const pending = (pendingRes.data ?? []) as Array<{ id: string; amount: number; dedupe_key: string | null; created_at: string }>;
      const approvedKeys = new Set(
        ((approvedRes.data ?? []) as Array<{ dedupe_key: string | null }>)
          .map(l => (l.dedupe_key ?? '').replace(/^partner_[a-z]+:/, ''))
      );
      const toApprove = pending.filter(p => {
        const canonical = (p.dedupe_key ?? '').replace(/^partner_[a-z]+:/, '');
        return canonical && !approvedKeys.has(canonical);
      });
      if (toApprove.length === 0) {
        await dialog.info('Нет pending записей без approval', 'Возможно cron уже всё обработал — используй обычную «Выплатить».');
        return;
      }
      const totalAmount = toApprove.reduce((s, l) => s + l.amount, 0);
      const oldest = toApprove.reduce((o, p) =>
        o === null || new Date(p.created_at) < new Date(o.created_at) ? p : o
      , null as typeof pending[number] | null)!;
      const daysOld = Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const daysLeft = Math.max(0, HOLD_DAYS - daysOld);
      setEarlyConfirm({ amount: totalAmount, daysLeft, pendingIds: toApprove });
    } finally {
      setEarlyProcessing(false);
    }
  };

  const handleConfirmEarly = async () => {
    if (!earlyConfirm) return;
    setEarlyProcessing(true);
    try {
      // 1. Approve каждый pending — создаём partner_approved + bumps balance
      for (const p of earlyConfirm.pendingIds) {
        const canonical = (p.dedupe_key ?? '').replace(/^partner_[a-z]+:/, '');
        const { data: insRows, error: insErr } = await supabase
          .from('bonus_logs')
          .upsert({
            telegram_id: partner.telegram_id,
            type: 'partner_approved',
            amount: p.amount,
            description: `Approved (досрочно): +${p.amount}₽ партнёру`,
            dedupe_key: canonical,
          }, { onConflict: 'telegram_id,type,dedupe_key', ignoreDuplicates: true })
          .select('id');
        if (insErr) throw new Error(`approve insert: ${insErr.message}`);
        const wasNew = Array.isArray(insRows) && insRows.length > 0;
        if (wasNew) {
          const { error: rpcErr } = await supabase.rpc('inc_partner_balance', {
            p_telegram_id: partner.telegram_id,
            p_delta: p.amount,
          });
          if (rpcErr) throw new Error(`balance inc: ${rpcErr.message}`);
        }
      }

      // 2. Создаём payout row
      const { data: payoutRow, error: payoutErr } = await supabase
        .from('partner_payouts')
        .insert({
          telegram_id: partner.telegram_id,
          amount_rub: earlyConfirm.amount,
          status: 'processed',
          card_last4: partner.card_number_last4 ?? null,
          note: `Досрочная выплата (до конца hold ${earlyConfirm.daysLeft}д)`,
          processed_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (payoutErr) throw new Error(`partner_payouts: ${payoutErr.message}`);
      const payoutId = (payoutRow as { id: string }).id;

      // 3. Записываем partner_paid log
      const last4 = partner.card_number_last4;
      const { data: paidIns } = await supabase.from('bonus_logs').upsert({
        telegram_id: partner.telegram_id,
        type: 'partner_paid',
        amount: -earlyConfirm.amount,
        description: `−${earlyConfirm.amount}₽ выплата досрочно${last4 ? ` на карту •• ${last4}` : ''}`,
        dedupe_key: `partner_paid_${payoutId}`,
      }, { onConflict: 'telegram_id,type,dedupe_key', ignoreDuplicates: true })
        .select('id');
      const wasNewPaid = Array.isArray(paidIns) && paidIns.length > 0;

      // 4. Декрементим balance
      if (wasNewPaid) {
        const { error: rpcErr } = await supabase.rpc('inc_partner_balance', {
          p_telegram_id: partner.telegram_id,
          p_delta: -earlyConfirm.amount,
        });
        if (rpcErr) throw new Error(`balance dec: ${rpcErr.message}`);
      }

      // 5. Push-уведомление партнёру
      apiFetch('/api/notify-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: partner.telegram_id,
          status: 'partner_payout_processed',
          amount: earlyConfirm.amount,
          card_last4: partner.card_number_last4 ?? null,
          application_id: `partner_notify_payout_${partner.telegram_id}_${Date.now()}`,
        }),
      }).catch(e => console.warn('partner notify (early payout):', e));

      setEarlyConfirm(null);
      onDone();
    } catch (e) {
      await dialog.error('Ошибка досрочной выплаты', e instanceof Error ? e.message : String(e));
    } finally {
      setEarlyProcessing(false);
    }
  };

  const partnerName = (partner.entity_type === 'legal' ? partner.organization_name : partner.full_name)
    || [partner.first_name, partner.last_name].filter(Boolean).join(' ').trim()
    || `@${partner.username ?? partner.telegram_id}`;

  const referralCode = partner.referral_code ?? '';
  const vanityCode = partner.vanity_code ?? '';
  const referralLink = referralCode ? `https://t.me/${BOT_USERNAME}/app?startapp=${referralCode}` : '';
  const vanityLink   = vanityCode   ? `https://t.me/${BOT_USERNAME}/app?startapp=${vanityCode.toUpperCase()}` : '';

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch { await dialog.info('Скопируйте вручную', text); }
  };

  const allRequisitesText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Партнёр: ${partnerName}`);
    lines.push(`TG ID: ${partner.telegram_id}${partner.username ? ` (@${partner.username})` : ''}`);
    if (partner.entity_type) {
      lines.push(`Статус: ${STATUS_LABELS[partner.entity_type] ?? partner.entity_type}`);
    }
    if (partner.inn) lines.push(`ИНН: ${partner.inn}`);
    if (partner.kpp) lines.push(`КПП: ${partner.kpp}`);
    if (partner.card_number) lines.push(`Карта: ${partner.card_number}`);
    if (partner.phone_for_sbp) lines.push(`СБП: ${partner.phone_for_sbp}`);
    if (partner.bank_account) lines.push(`Расчётный счёт: ${partner.bank_account}`);
    if (partner.bank_bic) lines.push(`БИК: ${partner.bank_bic}`);
    if (partner.card_bank) lines.push(`Банк: ${partner.card_bank}`);
    lines.push('');
    lines.push(`К выплате: ${partner.partner_balance.toLocaleString('ru-RU')}₽`);
    return lines.join('\n');
  }, [partner, partnerName]);

  const ready = partner.partner_balance > 0;
  const hasStatus = !!partner.entity_type;
  const hasHold = partner.pending_hold > 0;
  const canPayOut = ready && hasStatus;
  const canPayEarly = hasHold && hasStatus;
  const blocked = (ready || hasHold) && !hasStatus;

  return (
    <Modal open onClose={onClose} size="lg">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 bg-white z-10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-bold text-[#0F2A36] truncate">{partnerName}</p>
              {partner.entity_type ? (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[partner.entity_type] ?? 'bg-gray-100'}`}>
                  {STATUS_LABELS[partner.entity_type] ?? partner.entity_type}
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-100 text-rose-700">
                  Не указан
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
              ID {partner.telegram_id}
              {partner.username && (
                <> · <a href={`https://t.me/${partner.username}`} target="_blank" rel="noopener noreferrer" className="text-[#3B5BFF] hover:underline">@{partner.username}</a></>
              )}
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-gray-50 border-b border-gray-100">
          <StatCard label="К выплате" value={`${partner.partner_balance.toLocaleString('ru-RU')}₽`} cls="text-emerald-600" />
          <StatCard label="В hold" value={`${partner.pending_hold.toLocaleString('ru-RU')}₽`} cls="text-amber-600" />
          <StatCard label="Выплачено" value={`${partner.total_paid.toLocaleString('ru-RU')}₽`} cls="text-[#3B5BFF]" />
          <StatCard label="Заработано всего" value={`${partner.total_approved_lifetime.toLocaleString('ru-RU')}₽`} cls="text-[#0F2A36]" />
        </div>

        {/* Контакты и ссылки */}
        <Section title="Контакты и ссылки">
          {partner.username && (
            <DetailLine
              label="Telegram"
              icon={<Send className="w-3.5 h-3.5" />}
              value={
                <a
                  href={`https://t.me/${partner.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#3B5BFF] hover:underline flex items-center gap-1"
                >
                  @{partner.username} <ExternalLink className="w-3 h-3" />
                </a>
              }
            />
          )}
          <DetailLine
            label="Telegram ID"
            icon={<Hash className="w-3.5 h-3.5" />}
            value={<span className="font-mono">{partner.telegram_id}</span>}
            copyValue={String(partner.telegram_id)}
            copyKey="tgid"
            copiedKey={copiedKey}
            onCopy={copy}
          />
          {referralLink && (
            <DetailLine
              label="Реф-ссылка"
              icon={<LinkIcon className="w-3.5 h-3.5" />}
              value={
                <span className="font-mono text-xs break-all">
                  {referralLink.replace('https://', '')}
                </span>
              }
              copyValue={referralLink}
              copyKey="ref"
              copiedKey={copiedKey}
              onCopy={copy}
            />
          )}
          {vanityLink && (
            <DetailLine
              label="Vanity-ссылка"
              icon={<Sparkles className="w-3.5 h-3.5" />}
              value={
                <span className="font-mono text-xs break-all text-[#3B5BFF]">
                  {vanityLink.replace('https://', '')}
                </span>
              }
              copyValue={vanityLink}
              copyKey="vanity"
              copiedKey={copiedKey}
              onCopy={copy}
            />
          )}
        </Section>

        {/* Реквизиты */}
        <Section title="Реквизиты для выплат">
          {!partner.entity_type && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Партнёр не указал налоговый статус. Выплата невозможна — попроси заполнить реквизиты в Партнёрском кабинете.</span>
            </div>
          )}
          {partner.entity_type === 'legal' && partner.organization_name && (
            <DetailLine label="Организация" icon={<Building2 className="w-3.5 h-3.5" />} value={partner.organization_name} />
          )}
          {partner.entity_type !== 'legal' && partner.full_name && (
            <DetailLine label="ФИО" icon={<FileText className="w-3.5 h-3.5" />} value={partner.full_name}
              copyValue={partner.full_name} copyKey="fio" copiedKey={copiedKey} onCopy={copy} />
          )}
          {partner.inn && (
            <DetailLine label="ИНН" icon={<Hash className="w-3.5 h-3.5" />}
              value={<span className="font-mono">{partner.inn}</span>}
              copyValue={partner.inn} copyKey="inn" copiedKey={copiedKey} onCopy={copy} />
          )}
          {partner.kpp && (
            <DetailLine label="КПП" icon={<Hash className="w-3.5 h-3.5" />}
              value={<span className="font-mono">{partner.kpp}</span>}
              copyValue={partner.kpp} copyKey="kpp" copiedKey={copiedKey} onCopy={copy} />
          )}
          {partner.entity_type === 'self_employed' && (
            <>
              {partner.card_number && (
                <DetailLine label="Карта" icon={<CreditCard className="w-3.5 h-3.5" />}
                  value={<span className="font-mono">{partner.card_number.replace(/(\d{4})(?=\d)/g, '$1 ')}</span>}
                  copyValue={partner.card_number} copyKey="card" copiedKey={copiedKey} onCopy={copy} />
              )}
              {!partner.card_number && partner.card_number_last4 && (
                <DetailLine label="Карта (last4)" icon={<CreditCard className="w-3.5 h-3.5" />}
                  value={<span className="font-mono">•• {partner.card_number_last4}</span>} />
              )}
              {partner.phone_for_sbp && (
                <DetailLine label="СБП" icon={<Phone className="w-3.5 h-3.5" />}
                  value={<span className="font-mono">{partner.phone_for_sbp}</span>}
                  copyValue={partner.phone_for_sbp} copyKey="sbp" copiedKey={copiedKey} onCopy={copy} />
              )}
            </>
          )}
          {(partner.entity_type === 'ip' || partner.entity_type === 'legal') && (
            <>
              {partner.bank_account && (
                <DetailLine label="Расчётный счёт" icon={<Hash className="w-3.5 h-3.5" />}
                  value={<span className="font-mono">{partner.bank_account}</span>}
                  copyValue={partner.bank_account} copyKey="acc" copiedKey={copiedKey} onCopy={copy} />
              )}
              {partner.bank_bic && (
                <DetailLine label="БИК" icon={<Hash className="w-3.5 h-3.5" />}
                  value={<span className="font-mono">{partner.bank_bic}</span>}
                  copyValue={partner.bank_bic} copyKey="bic" copiedKey={copiedKey} onCopy={copy} />
              )}
            </>
          )}
          {partner.card_bank && (
            <DetailLine label="Банк" value={partner.card_bank} />
          )}

          {/* Кнопка copy всех реквизитов одной строкой */}
          <button
            onClick={() => copy(allRequisitesText, 'all')}
            className="w-full mt-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition"
          >
            {copiedKey === 'all' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            Скопировать все реквизиты для бухгалтера
          </button>
        </Section>

        {/* Последние начисления */}
        <Section title="Последние начисления">
          {recentLogs === null ? (
            <p className="text-xs text-gray-400 py-2">Загружаем…</p>
          ) : recentLogs.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Начислений пока нет</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentLogs.map(l => {
                const cls = l.type === 'partner_pending'   ? 'text-amber-600'
                          : l.type === 'partner_approved'  ? 'text-emerald-600'
                          : l.type === 'partner_paid'      ? 'text-[#3B5BFF]'
                          : l.type === 'partner_cancelled' ? 'text-rose-600'
                          : 'text-gray-600';
                const Icon = l.type === 'partner_paid' ? Wallet
                           : l.type === 'partner_pending' ? Clock
                           : l.type === 'partner_cancelled' ? X
                           : Check;
                return (
                  <div key={l.id} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${cls}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-700 truncate">{l.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(l.created_at).toLocaleString('ru-RU')}
                      </p>
                    </div>
                    <span className={`text-xs font-bold tabular-nums shrink-0 ${cls}`}>
                      {l.amount > 0 ? '+' : ''}{l.amount.toLocaleString('ru-RU')}₽
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Footer with actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white flex-wrap">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Закрыть
          </button>
          {canPayOut && (
            <button
              onClick={onPayout}
              className="px-4 py-2.5 vd-grad text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition"
            >
              <Wallet className="w-4 h-4" /> Выплатить {partner.partner_balance.toLocaleString('ru-RU')}₽
            </button>
          )}
          {canPayEarly && (
            <button
              onClick={handleStartEarly}
              disabled={earlyProcessing}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition disabled:opacity-60"
            >
              {earlyProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
              Выплатить досрочно {partner.pending_hold.toLocaleString('ru-RU')}₽
            </button>
          )}
          {blocked && (
            <button
              disabled
              className="px-4 py-2.5 bg-gray-200 text-gray-500 rounded-lg text-sm font-semibold flex items-center gap-1.5 cursor-not-allowed"
              title="Партнёр не указал налоговый статус"
            >
              ⛔ Выплата заблокирована
            </button>
          )}
        </div>

      {/* Confirm досрочной выплаты — отдельная nested модалка */}
      {earlyConfirm && (
        <Modal open onClose={() => !earlyProcessing && setEarlyConfirm(null)} size="sm">
          <div className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-[#0F2A36]">Досрочная выплата</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  До конца hold-периода ещё{' '}
                  <b className="text-amber-700">
                    {earlyConfirm.daysLeft === 0
                      ? 'меньше суток'
                      : `${earlyConfirm.daysLeft} ${pluralize(earlyConfirm.daysLeft, ['день', 'дня', 'дней'])}`
                    }
                  </b>
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-900 leading-relaxed">
              <p className="mb-2">
                Будет проведена досрочная выплата{' '}
                <b className="text-base">{earlyConfirm.amount.toLocaleString('ru-RU')}₽</b>{' '}
                из hold-периода.
              </p>
              <p className="text-xs">
                ⚠️ Hold-период защищает от refund клиента. Если в течение оставшихся{' '}
                {earlyConfirm.daysLeft} дней клиент отменит заказ, эту выплату нельзя будет автоматически вернуть.
              </p>
            </div>

            <p className="text-sm text-gray-700 mb-4">Точно вывести досрочно?</p>

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="md" onClick={() => setEarlyConfirm(null)} disabled={earlyProcessing}>
                Отмена
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleConfirmEarly}
                disabled={earlyProcessing}
                className="!bg-amber-500 hover:!bg-amber-600 !text-white shadow-none"
                loading={earlyProcessing}
                leftIcon={!earlyProcessing ? <Check className="w-4 h-4" /> : undefined}
              >
                Да, вывести досрочно
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
};

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

// ── Subcomponents для PartnerDetailModal ────────────────────────────────────

function StatCard({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-gray-100">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-base font-bold tabular-nums mt-0.5 ${cls}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-gray-100 last:border-b-0">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <History className="w-3 h-3" /> {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetailLine({
  label, icon, value, copyValue, copyKey, copiedKey, onCopy,
}: {
  label: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
  copyValue?: string;
  copyKey?: string;
  copiedKey?: string | null;
  onCopy?: (text: string, key: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="flex items-center gap-1.5 min-w-[100px] text-xs text-gray-500 shrink-0">
        {icon} {label}
      </div>
      <div className="flex items-start gap-1.5 min-w-0 flex-1 justify-end">
        <div className="text-sm text-[#0F2A36] text-right break-all">{value}</div>
        {copyValue && copyKey && onCopy && (
          <button
            onClick={() => onCopy(copyValue, copyKey)}
            className="text-gray-400 hover:text-[#3B5BFF] active:scale-90 transition shrink-0"
            title="Скопировать"
          >
            {copiedKey === copyKey
              ? <Check className="w-3.5 h-3.5 text-emerald-600" />
              : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
