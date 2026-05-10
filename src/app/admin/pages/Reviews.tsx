import React, { useState, useEffect, useCallback } from 'react';
import {
  Star, Trash2, RefreshCw, MessageSquare,
  AlertTriangle, Plus, Check, Clock, Eye,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiFetch';
import { Button, Modal } from '../../components/ui/brand';

// ── Types ────────────────────────────────────────────────────────────────────

interface Review {
  id: string;
  country: string;
  rating: number;
  text: string;
  author_name?: string;
  avatar?: string;
  status: string;
  source?: string;
  created_at: string;
}

interface ReviewForm {
  authorName: string;
  avatar: string;
  country: string;
  rating: number;
  text: string;
  // YYYY-MM-DD — дата которую увидят юзеры. Админ может выставить любую,
  // чтобы каталог отзывов выглядел "живым" с историей за месяцы/годы.
  date: string;
  // Источник отзыва: 'channel' = пришло из @visadel_agency Telegram-канала
  // (отображается с лейблом "@visadel_agency"), 'miniapp' = оставлено через
  // мини-апп. На публичной странице отзывов это видно как маленький бейдж.
  source: 'channel' | 'miniapp';
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM: ReviewForm = {
  authorName: '', avatar: '🧑', country: '',
  rating: 5, text: '',
  date: todayISO(),
  source: 'channel',
};
const AVATARS = ['👨', '👩', '🧑'];

// ── Star picker ──────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button" onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110 active:scale-95">
          <Star className={`w-7 h-7 transition-colors ${s <= (hover || value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
        </button>
      ))}
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`w-3 h-3 ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
      ))}
    </div>
  );
}

// ── Avatar picker ────────────────────────────────────────────────────────────

function AvatarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {AVATARS.map(a => (
        <button key={a} type="button" onClick={() => onChange(a)}
          className={`w-11 h-11 text-2xl rounded-xl border-2 transition-all ${
            value === a ? 'border-[#3B5BFF] bg-blue-50 scale-105' : 'border-gray-100 hover:border-gray-300 bg-gray-50'
          }`}>
          {a}
        </button>
      ))}
    </div>
  );
}

// ── Review form modal (add / edit) ────────────────────────────────────────────

function ReviewModal({ initial, title, onSave, onClose }: {
  initial?: ReviewForm;
  title: string;
  onSave: (f: ReviewForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ReviewForm>(initial ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ReviewForm>(key: K, val: ReviewForm[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.text.trim() || !form.rating) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const canSave = form.text.trim().length > 0 && form.rating > 0;

  return (
    <Modal
      open
      onClose={onClose}
      icon="⭐"
      label="Отзыв"
      title={title}
      size="sm"
      footer={(
        <div className="flex gap-3">
          <Button variant="secondary" size="md" fullWidth onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handleSave}
            disabled={!canSave || saving}
            loading={saving}
          >
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </Button>
        </div>
      )}
    >
        <div className="px-6 py-5 space-y-5">
          {/* Rating */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Оценка</label>
            <StarPicker value={form.rating} onChange={v => set('rating', v)} />
          </div>

          {/* Avatar */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Аватар</label>
            <AvatarPicker value={form.avatar} onChange={v => set('avatar', v)} />
          </div>

          {/* Author + Country */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Имя</label>
              <input value={form.authorName} onChange={e => set('authorName', e.target.value)}
                placeholder="Иван Петров"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/30 focus:border-[#3B5BFF]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Страна</label>
              <input value={form.country} onChange={e => set('country', e.target.value)}
                placeholder="Индия"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/30 focus:border-[#3B5BFF]" />
            </div>
          </div>

          {/* Text */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Текст отзыва</label>
            <textarea value={form.text} onChange={e => set('text', e.target.value)}
              rows={4} placeholder="Отличный сервис, всё сделали быстро и без проблем!"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/30 focus:border-[#3B5BFF] resize-none" />
          </div>

          {/* Date + Source — задают как отзыв будет выглядеть на публичной странице */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Дата отзыва</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              max={todayISO()}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/30 focus:border-[#3B5BFF]" />
            <p className="text-[11px] text-gray-400 mt-1">Можно поставить любую дату из прошлого — отзыв будет выглядеть как реально оставленный тогда.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Откуда отзыв</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => set('source', 'channel')}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all border-2 ${
                  form.source === 'channel'
                    ? 'border-[#3B5BFF] bg-blue-50 text-[#3B5BFF]'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}>
                <div className="flex items-center justify-center gap-1.5">
                  <span>📣</span>
                  <span>@visadel_agency</span>
                </div>
              </button>
              <button type="button" onClick={() => set('source', 'miniapp')}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all border-2 ${
                  form.source === 'miniapp'
                    ? 'border-[#3B5BFF] bg-blue-50 text-[#3B5BFF]'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}>
                <div className="flex items-center justify-center gap-1.5">
                  <span>💬</span>
                  <span>Из приложения</span>
                </div>
              </button>
            </div>
          </div>
        </div>

    </Modal>
  );
}

// ── Confirm delete modal ─────────────────────────────────────────────────────

function ConfirmModal({ review, onConfirm, onCancel, loading }: {
  review: Review; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <Modal open onClose={onCancel} size="sm">
      <div className="p-6">
        <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-rose-500" />
        </div>
        <h3 className="text-lg font-semibold text-[#0F2A36] text-center mb-1">Удалить отзыв?</h3>
        <p className="text-sm text-[#0F2A36]/60 text-center mb-1">{review.author_name ?? 'Клиент'} · {review.country}</p>
        <p className="text-sm text-[#0F2A36]/70 text-center bg-gray-50 rounded-xl px-3 py-2 mb-5 line-clamp-2">"{review.text}"</p>
        <div className="flex gap-3">
          <Button variant="secondary" size="md" fullWidth onClick={onCancel} disabled={loading}>
            Отмена
          </Button>
          <Button
            variant="danger"
            size="md"
            fullWidth
            onClick={onConfirm}
            disabled={loading}
            loading={loading}
            leftIcon={!loading ? <Trash2 className="w-4 h-4" /> : undefined}
          >
            {loading ? 'Удаляем...' : 'Удалить'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">
      <Eye className="w-3 h-3" /> Опубликован
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
      <Clock className="w-3 h-3" /> На модерации
    </span>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

type Filter = 'all' | 'pending' | 'approved';

export const Reviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [deleting, setDeleting] = useState(false);
  const [confirmReview, setConfirmReview] = useState<Review | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editReview, setEditReview] = useState<Review | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('reviews').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setReviews((data as Review[]) ?? []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  // Realtime: подписка на reviews — когда юзер сабмитит новый отзыв,
  // он мгновенно появляется в админке без F5. Раньше админ его не видел
  // если уже был на странице Отзывы и не перезагрузил.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const channel = supabase
      .channel('admin-reviews')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'reviews' },
        (payload: any) => {
          setReviews(prev => {
            if (prev.find(r => r.id === payload.new.id)) return prev;
            return [payload.new as Review, ...prev];
          });
        },
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'reviews' },
        (payload: any) => {
          setReviews(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r));
        },
      )
      .on(
        'postgres_changes' as any,
        { event: 'DELETE', schema: 'public', table: 'reviews' },
        (payload: any) => {
          setReviews(prev => prev.filter(r => r.id !== payload.old.id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Approve ────────────────────────────────────────────────────────────────
  const handleApprove = async (id: string) => {
    setApproving(id);
    try {
      const res = await apiFetch('/api/update-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'approved' }),
      });
      if (!res.ok) throw new Error('approve failed');
      setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
      showToast('Отзыв опубликован ✓', 'success');
    } catch { showToast('Ошибка при одобрении', 'error'); }
    finally { setApproving(null); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmReview) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('reviews').delete().eq('id', confirmReview.id);
      if (error) throw error;
      setReviews(prev => prev.filter(r => r.id !== confirmReview.id));
      showToast('Отзыв удалён', 'success');
    } catch { showToast('Ошибка при удалении', 'error'); }
    finally { setDeleting(false); setConfirmReview(null); }
  };

  // Полная ISO-таймстемпа из выбранной даты (12:00 UTC чтобы избежать
  // shift через таймзоны и разные локальные tz).
  const dateToIso = (d: string) => `${d}T12:00:00.000Z`;

  // ── Add ────────────────────────────────────────────────────────────────────
  const handleAdd = async (f: ReviewForm) => {
    try {
      const row = {
        rating: f.rating,
        country: f.country || 'Не указана',
        text: f.text.trim(),
        author_name: f.authorName.trim() || 'Клиент',
        avatar: f.avatar,
        status: 'approved',
        source: f.source, // 'channel' | 'miniapp'
        created_at: dateToIso(f.date),
      };
      const { data, error } = await supabase.from('reviews').insert(row).select().single();
      if (error) throw error;
      setReviews(prev => [data as Review, ...prev]);
      setAddOpen(false);
      showToast('Отзыв добавлен', 'success');
    } catch { showToast('Ошибка при добавлении', 'error'); }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const handleEdit = async (f: ReviewForm) => {
    if (!editReview) return;
    try {
      const patch = {
        id: editReview.id,
        rating: f.rating,
        country: f.country || 'Не указана',
        text: f.text.trim(),
        author_name: f.authorName.trim() || 'Клиент',
        avatar: f.avatar,
        source: f.source,
        created_at: dateToIso(f.date),
      };
      const res = await apiFetch('/api/update-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('edit failed');
      setReviews(prev => prev.map(r => r.id === editReview.id ? { ...r, ...patch } : r));
      setEditReview(null);
      showToast('Отзыв обновлён', 'success');
    } catch { showToast('Ошибка при обновлении', 'error'); }
  };

  const approved = reviews.filter(r => r.status === 'approved');
  const pending  = reviews.filter(r => r.status !== 'approved');
  const avgRating = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0;
  const ratingDist = [5, 4, 3, 2, 1].map(star => ({
    star, count: approved.filter(r => r.rating === star).length,
  }));

  const filtered = filter === 'pending' ? pending : filter === 'approved' ? approved : reviews;

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-[#F5F7FA]">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-in slide-in-from-top-2 ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>{toast.msg}</div>
      )}

      {confirmReview && (
        <ConfirmModal review={confirmReview} onConfirm={handleDelete}
          onCancel={() => setConfirmReview(null)} loading={deleting} />
      )}

      {addOpen && (
        <ReviewModal title="Добавить отзыв" onSave={handleAdd} onClose={() => setAddOpen(false)} />
      )}

      {editReview && (
        <ReviewModal
          title="Редактировать отзыв"
          initial={{
            authorName: editReview.author_name ?? '',
            avatar: editReview.avatar ?? '🧑',
            country: editReview.country ?? '',
            rating: editReview.rating,
            text: editReview.text,
            date: editReview.created_at ? editReview.created_at.slice(0, 10) : todayISO(),
            source: editReview.source === 'miniapp' ? 'miniapp' : 'channel',
          }}
          onSave={handleEdit}
          onClose={() => setEditReview(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">Отзывы</h1>
          <p className="text-sm text-[#0F2A36]/45 mt-0.5">@visadel_recall · новые попадают на модерацию</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={loadReviews}
            disabled={loading}
            leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Обновить
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setAddOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Добавить
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={<Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
          label="Средняя оценка" value={avgRating ? avgRating.toFixed(1) : '—'}
          sub={approved.length ? `из ${approved.length} опубликованных` : undefined} color="bg-yellow-50" />
        <StatCard icon={<MessageSquare className="w-5 h-5 text-blue-500" />}
          label="Всего отзывов" value={reviews.length}
          sub={`${approved.length} опубликовано`} color="bg-blue-50" />
        <StatCard icon={<Clock className="w-5 h-5 text-amber-500" />}
          label="На модерации" value={pending.length}
          sub={pending.length ? 'Ожидают проверки' : 'Всё проверено'} color="bg-amber-50" />
      </div>

      {/* Rating distribution */}
      {approved.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">Распределение оценок</p>
          <div className="space-y-2">
            {ratingDist.map(({ star, count }) => {
              const pct = approved.length ? (count / approved.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-4 text-right font-medium">{star}</span>
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 mb-4 shadow-sm w-fit">
        {([['all', 'Все', reviews.length], ['pending', 'На модерации', pending.length], ['approved', 'Опубликованные', approved.length]] as const).map(
          ([key, label, cnt]) => (
            <button key={key} onClick={() => setFilter(key as Filter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === key ? 'bg-[#3B5BFF] text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                filter === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{cnt}</span>
            </button>
          )
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
          <p className="text-sm text-gray-400">Загружаем отзывы...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">
            {filter === 'pending' ? 'Нет отзывов на модерации' : filter === 'approved' ? 'Нет опубликованных отзывов' : 'Отзывов пока нет'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(review => (
            <div key={review.id}
              className={`bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md transition-all ${
                review.status !== 'approved' ? 'border-amber-100 bg-amber-50/30' : 'border-gray-100'
              }`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5 shrink-0">{review.avatar ?? '🧑'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm">{review.author_name ?? 'Клиент'}</p>
                        <StatusBadge status={review.status} />
                        {review.source === 'channel' && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-[#3B5BFF] font-medium flex items-center gap-1">
                            📣 @visadel_agency
                          </span>
                        )}
                        {review.source === 'miniapp' && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium flex items-center gap-1">
                            💬 Из приложения
                          </span>
                        )}
                        {review.source === 'manual' && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-500 font-medium">Вручную</span>
                        )}
                        {review.country && <span className="text-xs text-gray-400">{review.country}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StarRow rating={review.rating} />
                        <span className="text-xs text-gray-400">
                          {new Date(review.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {review.status !== 'approved' && (
                        <button onClick={() => handleApprove(review.id)} disabled={approving === review.id}
                          title="Опубликовать"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50">
                          {approving === review.id
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <Check className="w-3.5 h-3.5" />}
                          Одобрить
                        </button>
                      )}
                      <button onClick={() => setEditReview(review)}
                        title="Редактировать"
                        className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-[#3B5BFF] hover:bg-blue-50 rounded-xl transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                        </svg>
                      </button>
                      <button onClick={() => setConfirmReview(review)}
                        title="Удалить"
                        className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mt-2 bg-white/70 rounded-xl px-3 py-2 border border-gray-100">
                    "{review.text}"
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
