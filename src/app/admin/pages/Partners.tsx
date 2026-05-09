// Админка → Партнёры. Расширенная таблица всех партнёров (is_influencer=true)
// со всеми реквизитами в одном вью — для bulk-просмотра и быстрого поиска.
//
// Отличается от Payouts (которая фокусируется на «кому платить сейчас»):
// здесь показаны все партнёры независимо от баланса, со всеми колонками
// реквизитов. Можно отсортировать по любой колонке, скопировать строку
// одним кликом, экспортировать всё в CSV.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Crown, Loader2, Search, FileDown, RefreshCw, Copy, Check, AlertCircle,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

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

// ── Component ───────────────────────────────────────────────────────────────

export function Partners() {
  const [partners, setPartners] = useState<PartnerFullRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'self_employed' | 'ip' | 'legal' | 'none'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
          pending_hold:            a.pending,
          total_paid:              Math.abs(a.paid),
          total_approved_lifetime: a.approved + Math.abs(a.paid),
        };
      });

      setPartners(enriched);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    let list = partners;
    if (statusFilter === 'none') {
      list = list.filter(p => !p.entity_type);
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

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // fallback
      alert('Скопируйте: ' + text);
    }
  };

  // Сводка по фильтру
  const stats = useMemo(() => {
    const totalAvailable = filtered.reduce((s, p) => s + p.partner_balance, 0);
    const totalHold      = filtered.reduce((s, p) => s + p.pending_hold, 0);
    const totalLifetime  = filtered.reduce((s, p) => s + p.total_approved_lifetime, 0);
    const noStatus       = filtered.filter(p => !p.entity_type).length;
    return { totalAvailable, totalHold, totalLifetime, noStatus };
  }, [filtered]);

  const handleExportCsv = () => {
    const rows: string[][] = [
      ['Telegram ID', 'username', 'Имя в TG', 'Реф-код', 'Vanity', 'Статус',
       'ФИО / Название', 'ИНН', 'КПП', 'Карта', 'Last4', 'Банк',
       'СБП телефон', 'Расчётный счёт', 'БИК',
       'Баланс ₽', 'Hold ₽', 'Заработано всего ₽', 'Согласие принято'],
    ];
    for (const p of filtered) {
      const tgName = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
      rows.push([
        String(p.telegram_id),
        p.username ?? '',
        tgName,
        p.referral_code ?? '',
        p.vanity_code ?? '',
        p.entity_type ? STATUS_LABELS[p.entity_type] ?? p.entity_type : 'Не указан',
        p.organization_name || p.full_name || '',
        p.inn ?? '',
        p.kpp ?? '',
        p.card_number ?? '',
        p.card_number_last4 ?? '',
        p.card_bank ?? '',
        p.phone_for_sbp ?? '',
        p.bank_account ?? '',
        p.bank_bic ?? '',
        String(p.partner_balance),
        String(p.pending_hold),
        String(p.total_approved_lifetime),
        p.agreement_accepted_at ? new Date(p.agreement_accepted_at).toLocaleString('ru-RU') : '',
      ]);
    }
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `partners_${new Date().toISOString().slice(0, 10)}.csv`;
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
            {' · '}В фильтре: <b>{filtered.length}</b>
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
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            <FileDown size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Filters */}
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
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['all', 'self_employed', 'ip', 'legal', 'none'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                statusFilter === f ? 'bg-white text-[#0F2A36] shadow-sm' : 'text-gray-600 hover:text-[#0F2A36]'
              }`}
            >
              {f === 'all' ? 'Все' : f === 'none' ? 'Без статуса' : STATUS_LABELS[f]}
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

      {/* Table */}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => {
                const tgName = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
                  || `@${p.username ?? p.telegram_id}`;
                const fioOrOrg = p.entity_type === 'legal' ? p.organization_name : p.full_name;
                const blocked = !p.entity_type && p.partner_balance > 0;

                // Что показать в колонке «Куда платить»
                let payTo: { label: string; value: string } | null = null;
                if (p.entity_type === 'self_employed') {
                  if (p.card_number) payTo = { label: 'Карта', value: p.card_number };
                  else if (p.phone_for_sbp) payTo = { label: 'СБП', value: p.phone_for_sbp };
                  else if (p.card_number_last4) payTo = { label: 'Карта', value: `•• ${p.card_number_last4}` };
                } else if (p.entity_type === 'ip' || p.entity_type === 'legal') {
                  if (p.bank_account) payTo = { label: 'Р/с', value: p.bank_account };
                }

                return (
                  <tr key={p.telegram_id} className="hover:bg-blue-50/30 transition">
                    {/* Партнёр */}
                    <td className="px-3 py-3 align-top">
                      <p className="font-semibold text-[#0F2A36]">{fioOrOrg || tgName}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
                        ID {p.telegram_id}{p.username ? ` · @${p.username}` : ''}
                      </p>
                      {p.vanity_code && (
                        <p className="text-[11px] text-[#3B5BFF] mt-0.5 font-mono">/{p.vanity_code}</p>
                      )}
                    </td>

                    {/* Статус */}
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

                    {/* ИНН/КПП */}
                    <td className="px-3 py-3 align-top text-xs text-gray-700 font-mono">
                      {p.inn || <span className="text-gray-300">—</span>}
                      {p.kpp && <div className="text-gray-500 mt-0.5">КПП {p.kpp}</div>}
                    </td>

                    {/* Куда платить + кнопка copy */}
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
                            onClick={() => copyToClipboard(payTo!.value, `pay-${p.telegram_id}`)}
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
                      {p.entity_type === 'ip' || p.entity_type === 'legal' ? (
                        p.bank_bic && (
                          <div className="text-[11px] text-gray-500 mt-1 font-mono">БИК {p.bank_bic}</div>
                        )
                      ) : null}
                    </td>

                    {/* Банк */}
                    <td className="px-3 py-3 align-top text-xs text-gray-700">
                      {p.card_bank || <span className="text-gray-300">—</span>}
                    </td>

                    {/* Balance */}
                    <td className="px-3 py-3 align-top text-right">
                      <span className={`text-sm font-bold tabular-nums ${
                        blocked ? 'text-rose-500' : p.partner_balance > 0 ? 'text-emerald-600' : 'text-gray-400'
                      }`}>
                        {p.partner_balance.toLocaleString('ru-RU')}
                      </span>
                    </td>

                    {/* Hold */}
                    <td className="px-3 py-3 align-top text-right text-sm tabular-nums text-amber-600">
                      {p.pending_hold > 0 ? p.pending_hold.toLocaleString('ru-RU') : <span className="text-gray-300">—</span>}
                    </td>

                    {/* Lifetime */}
                    <td className="px-3 py-3 align-top text-right text-sm tabular-nums text-[#3B5BFF]">
                      {p.total_approved_lifetime > 0 ? p.total_approved_lifetime.toLocaleString('ru-RU') : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
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
