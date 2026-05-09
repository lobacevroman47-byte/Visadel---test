// Админка → Заявки на партнёрство.
//
// Показывает все заявки из partner_applications, sorted by created_at desc.
// Фильтр по статусу (все / pending / approved / rejected).
//
// Approve flow:
//   1. UPDATE partner_applications SET status='approved', reviewed_at, reviewed_by_admin_id
//   2. UPDATE users SET is_influencer=true (юзер сразу попадает в Партнёрский кабинет)
//   3. Notify юзера через notify-status (опц.)
//
// Reject flow:
//   1. UPDATE partner_applications SET status='rejected', reviewed_at, reject_reason

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Crown, Loader2, Search, RefreshCw, Check, X, Clock, ExternalLink,
  CheckCircle2, XCircle, AlertCircle, Mail, Phone, AtSign, Tags, Users,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface ApplicationRow {
  id: string;
  telegram_id: number | null;
  full_name: string;
  telegram_username: string;
  email: string;
  phone: string | null;
  platform_url: string;
  audience_theme: string | null;
  subscribers_count: number | null;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  reviewed_by_admin_id: number | null;
  reject_reason: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  pending:  { label: 'На рассмотрении', cls: 'bg-amber-100 text-amber-700',     Icon: Clock },
  approved: { label: 'Одобрено',         cls: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle2 },
  rejected: { label: 'Отклонено',        cls: 'bg-rose-100 text-rose-700',       Icon: XCircle },
};

export function PartnerApplications() {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selected, setSelected] = useState<ApplicationRow | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('partner_applications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setApplications((data ?? []) as ApplicationRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    let list = applications;
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => {
        const blob = [a.full_name, a.telegram_username, a.email, a.phone, a.platform_url, a.audience_theme, String(a.telegram_id ?? '')]
          .filter(Boolean).join(' ').toLowerCase();
        return blob.includes(q);
      });
    }
    return list;
  }, [applications, search, statusFilter]);

  const counts = useMemo(() => ({
    pending:  applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  }), [applications]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36] flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" /> Заявки на партнёрство
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            На рассмотрении: <b className="text-amber-700">{counts.pending}</b>
            {' · '}Одобрено: <b className="text-emerald-700">{counts.approved}</b>
            {' · '}Отклонено: <b className="text-rose-700">{counts.rejected}</b>
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition flex items-center gap-1.5 text-sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw size={14} />}
          Обновить
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск: имя, @username, email, площадка"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3B5BFF]"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {([
            ['all', `Все (${applications.length})`],
            ['pending', `На рассмотрении (${counts.pending})`],
            ['approved', `Одобрено (${counts.approved})`],
            ['rejected', `Отклонено (${counts.rejected})`],
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

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {loading ? 'Загружаем…' : 'Нет заявок в этом фильтре.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(a => {
              const cfg = STATUS_CONFIG[a.status];
              return (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-blue-50/30 active:bg-blue-50/60 transition text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#0F2A36] truncate">{a.full_name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      @{a.telegram_username} · {a.email}
                      {a.subscribers_count ? ` · ${a.subscribers_count.toLocaleString('ru-RU')} подписч.` : ''}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate font-mono">{a.platform_url}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-gray-400">
                      {new Date(a.created_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <ApplicationDetailModal
          app={selected}
          onClose={() => setSelected(null)}
          onDone={() => { setSelected(null); void refresh(); }}
        />
      )}
    </div>
  );
}

// ── Detail modal ────────────────────────────────────────────────────────────

const ApplicationDetailModal: React.FC<{
  app: ApplicationRow;
  onClose: () => void;
  onDone: () => void;
}> = ({ app, onClose, onDone }) => {
  const [processing, setProcessing] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!confirm(`Одобрить заявку ${app.full_name}? Юзер сразу получит статус «Партнёр» и доступ к Партнёрскому кабинету.`)) return;
    setProcessing(true);
    setError(null);
    try {
      // 1. UPDATE заявки
      const { error: e1 } = await supabase
        .from('partner_applications')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reject_reason: null,
        })
        .eq('id', app.id);
      if (e1) throw new Error(`update application: ${e1.message}`);

      // 2. UPDATE users.is_influencer=true (если есть telegram_id)
      if (app.telegram_id) {
        const { error: e2 } = await supabase
          .from('users')
          .update({ is_influencer: true })
          .eq('telegram_id', app.telegram_id);
        if (e2) console.warn('users update is_influencer failed:', e2);
      } else {
        console.warn('[approve] application has no telegram_id — нельзя выдать is_influencer автоматически');
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('Укажи причину отказа — она будет показана юзеру в его заявке');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const { error: e1 } = await supabase
        .from('partner_applications')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reject_reason: rejectReason.trim(),
        })
        .eq('id', app.id);
      if (e1) throw new Error(e1.message);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  };

  const cfg = STATUS_CONFIG[app.status];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-bold text-[#0F2A36] truncate">{app.full_name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(app.created_at).toLocaleString('ru-RU')}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition shrink-0" aria-label="Закрыть">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Details */}
        <div className="p-5 space-y-2.5">
          <Detail icon={<AtSign className="w-3.5 h-3.5 text-gray-400" />} label="Telegram" value={
            <a href={`https://t.me/${app.telegram_username}`} target="_blank" rel="noopener noreferrer" className="text-[#3B5BFF] hover:underline flex items-center gap-1">
              @{app.telegram_username} <ExternalLink className="w-3 h-3" />
            </a>
          } />
          <Detail icon={<Mail className="w-3.5 h-3.5 text-gray-400" />} label="Email" value={app.email} />
          {app.phone && <Detail icon={<Phone className="w-3.5 h-3.5 text-gray-400" />} label="Телефон" value={app.phone} />}
          <Detail icon={<ExternalLink className="w-3.5 h-3.5 text-gray-400" />} label="Площадка" value={
            <a href={app.platform_url} target="_blank" rel="noopener noreferrer" className="text-[#3B5BFF] hover:underline break-all">
              {app.platform_url}
            </a>
          } />
          {app.audience_theme && <Detail icon={<Tags className="w-3.5 h-3.5 text-gray-400" />} label="Тематика" value={app.audience_theme} />}
          {app.subscribers_count !== null && (
            <Detail icon={<Users className="w-3.5 h-3.5 text-gray-400" />} label="Подписчики" value={app.subscribers_count.toLocaleString('ru-RU')} />
          )}
          {app.telegram_id && (
            <Detail label="Telegram ID" value={<span className="font-mono">{app.telegram_id}</span>} />
          )}

          {app.comment && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 mt-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Комментарий юзера</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{app.comment}</p>
            </div>
          )}

          {app.status === 'rejected' && app.reject_reason && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mt-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Причина отказа</p>
              <p className="text-sm text-rose-700">{app.reject_reason}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {app.status === 'pending' && (
          <div className="px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700 flex items-start gap-2 mb-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}

            {rejectMode ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Причина отказа (увидит юзер)</label>
                  <textarea
                    rows={3}
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Например: «маленькая аудитория, попробуй позже»"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#3B5BFF] resize-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => { setRejectMode(false); setError(null); }}
                    disabled={processing}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                  >
                    Назад
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={processing || !rejectReason.trim()}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Подтвердить отказ
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2 flex-wrap">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Закрыть
                </button>
                <button
                  onClick={() => setRejectMode(true)}
                  disabled={processing}
                  className="px-4 py-2.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50"
                >
                  <X className="w-4 h-4" /> Отклонить
                </button>
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="px-4 py-2.5 vd-grad text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50"
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Одобрить
                </button>
              </div>
            )}
          </div>
        )}

        {app.status !== 'pending' && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
            {app.reviewed_at && (
              <p className="text-[11px] text-gray-400 mr-auto">
                Решено: {new Date(app.reviewed_at).toLocaleString('ru-RU')}
              </p>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function Detail({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="flex items-center gap-1.5 min-w-[100px] text-xs text-gray-500 shrink-0">
        {icon} {label}
      </div>
      <div className="text-sm text-[#0F2A36] text-right break-all min-w-0 flex-1">{value}</div>
    </div>
  );
}
