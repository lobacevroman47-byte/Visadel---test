import React, { useState, useEffect, useCallback } from 'react';
import { Star, Trash2, RefreshCw, MessageSquare, TrendingUp, AlertTriangle, Plus, X, Sparkles } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface Review {
  id: string;
  country: string;
  rating: number;
  text: string;
  author_name?: string;
  avatar?: string;
  status: string;
  created_at: string;
  channel_message_id?: number;
}

// ── Helpers (same logic as webhook) ─────────────────────────────────────────

function getAvatar(name: string): string {
  if (!name) return '🧑';
  const first = name.trim().split(/\s+/)[0].toLowerCase();
  return /[аяь]$/i.test(first) ? '👩' : '👨';
}

function parseChannelText(raw: string): Partial<AddForm> | null {
  try {
    const starMatch = raw.match(/⭐/g);
    const rating = starMatch ? Math.min(starMatch.length, 5) : 0;
    const countryMatch = raw.match(/Страна:\s*[*_\\]*([\p{L}\s\-]+)[*_\\]*/u);
    const country = countryMatch ? countryMatch[1].trim() : '';
    const textMatch = raw.match(/"([^"]+)"/);
    const text = textMatch ? textMatch[1].trim() : '';
    const authorMatch = raw.match(/—\s*(.+)$/m);
    let authorName = '';
    if (authorMatch) {
      const raw2 = authorMatch[1].trim().replace(/^@/, '');
      if (!/^[a-zA-Z0-9_]+$/.test(raw2)) authorName = raw2;
    }
    if (!text && !rating) return null;
    return { rating: rating || 5, country, text, authorName };
  } catch {
    return null;
  }
}

// ── Star picker ──────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <Star className={`w-7 h-7 transition-colors ${
            s <= (hover || value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
          }`} />
        </button>
      ))}
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

interface AddForm {
  rawText: string;
  authorName: string;
  country: string;
  rating: number;
  text: string;
}

const EMPTY_FORM: AddForm = { rawText: '', authorName: '', country: '', rating: 5, text: '' };

// ── Add modal ────────────────────────────────────────────────────────────────

function AddModal({ onSave, onClose }: {
  onSave: (f: Omit<AddForm, 'rawText'>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'paste' | 'manual'>('paste');

  const set = (key: keyof AddForm, val: string | number) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleParse = () => {
    const parsed = parseChannelText(form.rawText);
    if (!parsed) return;
    setForm(f => ({
      ...f,
      rating: parsed.rating ?? f.rating,
      country: parsed.country ?? f.country,
      text: parsed.text ?? f.text,
      authorName: parsed.authorName ?? f.authorName,
    }));
    setTab('manual');
  };

  const handleSave = async () => {
    if (!form.text.trim() || !form.rating) return;
    setSaving(true);
    await onSave({ authorName: form.authorName, country: form.country, rating: form.rating, text: form.text });
    setSaving(false);
  };

  const canSave = form.text.trim().length > 0 && form.rating > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Добавить отзыв</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          <button
            onClick={() => setTab('paste')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'paste' ? 'bg-[#2196F3] text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Вставить из канала
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'manual' ? 'bg-[#2196F3] text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Заполнить вручную
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {tab === 'paste' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                  Текст поста из канала
                </label>
                <textarea
                  value={form.rawText}
                  onChange={e => set('rawText', e.target.value)}
                  rows={6}
                  placeholder={"⭐⭐⭐⭐⭐\n\nСтрана: Индия\n\n\"Отличный сервис, всё быстро!\"\n\n— Иван Петров"}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] resize-none font-mono"
                />
              </div>
              <button
                onClick={handleParse}
                disabled={!form.rawText.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600 transition-colors disabled:opacity-40"
              >
                <Sparkles className="w-4 h-4" />
                Распознать автоматически
              </button>
            </>
          ) : (
            <>
              {/* Rating */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Оценка</label>
                <StarPicker value={form.rating} onChange={v => set('rating', v)} />
              </div>

              {/* Author + Country */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Имя</label>
                  <input
                    value={form.authorName}
                    onChange={e => set('authorName', e.target.value)}
                    placeholder="Иван Петров"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Страна</label>
                  <input
                    value={form.country}
                    onChange={e => set('country', e.target.value)}
                    placeholder="Индия"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3]"
                  />
                </div>
              </div>

              {/* Text */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Текст отзыва</label>
                <textarea
                  value={form.text}
                  onChange={e => set('text', e.target.value)}
                  rows={4}
                  placeholder="Отличный сервис, всё сделали быстро и без проблем!"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={tab === 'paste' ? handleParse : handleSave}
            disabled={tab === 'paste' ? !form.rawText.trim() : (!canSave || saving)}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2 ${
              tab === 'paste' ? 'bg-violet-500 hover:bg-violet-600' : 'bg-[#2196F3] hover:bg-[#1E88E5]'
            }`}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            {tab === 'paste' ? 'Распознать' : saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm delete modal ─────────────────────────────────────────────────────

function ConfirmModal({ review, onConfirm, onCancel, loading }: {
  review: Review; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-1">Удалить отзыв?</h3>
        <p className="text-sm text-gray-500 text-center mb-1">{review.author_name ?? 'Клиент'} · {review.country}</p>
        <p className="text-sm text-gray-700 text-center bg-gray-50 rounded-xl px-3 py-2 mb-5 line-clamp-2">"{review.text}"</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
            Отмена
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {loading ? 'Удаляем...' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`w-3 h-3 ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
      ))}
    </div>
  );
}

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

// ── Main page ────────────────────────────────────────────────────────────────

export const Reviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmReview, setConfirmReview] = useState<Review | null>(null);
  const [showAdd, setShowAdd] = useState(false);
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
          .from('reviews')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setReviews((data as Review[]) ?? []);
      }
    } catch (e) {
      console.error('Failed to load reviews:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const handleDelete = async () => {
    if (!confirmReview) return;
    setDeleting(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('reviews').delete().eq('id', confirmReview.id);
        if (error) throw error;
      }
      setReviews(prev => prev.filter(r => r.id !== confirmReview.id));
      showToast('Отзыв удалён', 'success');
    } catch (e) {
      console.error('Delete error:', e);
      showToast('Ошибка при удалении', 'error');
    } finally {
      setDeleting(false);
      setConfirmReview(null);
    }
  };

  const handleAdd = async (f: Omit<AddForm, 'rawText'>) => {
    try {
      const avatar = getAvatar(f.authorName);
      const row = {
        rating: f.rating,
        country: f.country || 'Не указана',
        text: f.text.trim(),
        author_name: f.authorName.trim() || 'Клиент',
        avatar,
        status: 'approved',
        source: 'manual',
      };
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('reviews').insert(row).select().single();
        if (error) throw error;
        setReviews(prev => [data as Review, ...prev]);
      }
      setShowAdd(false);
      showToast('Отзыв добавлен', 'success');
    } catch (e) {
      console.error('Add error:', e);
      showToast('Ошибка при добавлении', 'error');
    }
  };

  const approved = reviews.filter(r => r.status === 'approved');
  const avgRating = approved.length
    ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0;
  const ratingDist = [5, 4, 3, 2, 1].map(star => ({
    star, count: approved.filter(r => r.rating === star).length,
  }));

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-[#F5F7FA]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-in slide-in-from-top-2 ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.msg}
        </div>
      )}

      {confirmReview && (
        <ConfirmModal review={confirmReview} onConfirm={handleDelete}
          onCancel={() => setConfirmReview(null)} loading={deleting} />
      )}

      {showAdd && <AddModal onSave={handleAdd} onClose={() => setShowAdd(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Отзывы</h1>
          <p className="text-sm text-gray-400 mt-0.5">@visadel_recall · синхронизируются автоматически</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadReviews} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2196F3] text-white rounded-xl text-sm font-semibold hover:bg-[#1E88E5] active:scale-95 transition-all shadow-sm">
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={<Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
          label="Средняя оценка" value={avgRating ? avgRating.toFixed(1) : '—'}
          sub={approved.length ? `из ${approved.length} отзывов` : undefined} color="bg-yellow-50" />
        <StatCard icon={<MessageSquare className="w-5 h-5 text-blue-500" />}
          label="Всего отзывов" value={reviews.length}
          sub={`${approved.length} опубликовано`} color="bg-blue-50" />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          label="5-звёздочных"
          value={`${approved.length ? Math.round((ratingDist[0].count / approved.length) * 100) : 0}%`}
          sub={`${ratingDist[0].count} отзывов`} color="bg-emerald-50" />
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

      {/* Reviews list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
          <p className="text-sm text-gray-400">Загружаем отзывы...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">Отзывов пока нет</p>
          <p className="text-sm text-gray-400 mt-1">Добавьте вручную или опубликуйте в канале</p>
          <button onClick={() => setShowAdd(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#2196F3] text-white rounded-xl text-sm font-semibold hover:bg-[#1E88E5] transition-colors">
            <Plus className="w-4 h-4" /> Добавить отзыв
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <div key={review.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5 shrink-0">{review.avatar ?? '🧑'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm">{review.author_name ?? 'Клиент'}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          review.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {review.status === 'approved' ? 'Опубликован' : 'Ожидает'}
                        </span>
                        {(review as any).source === 'manual' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-500 font-medium">
                            Вручную
                          </span>
                        )}
                        {review.country && <span className="text-xs text-gray-400">{review.country}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StarRow rating={review.rating} />
                        <span className="text-xs text-gray-400">
                          {new Date(review.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setConfirmReview(review)}
                      className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Удалить отзыв">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mt-2 bg-gray-50 rounded-xl px-3 py-2">
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
