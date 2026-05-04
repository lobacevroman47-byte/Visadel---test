import React, { useState, useEffect, useCallback } from 'react';
import { Star, Trash2, RefreshCw, MessageSquare, TrendingUp, AlertTriangle } from 'lucide-react';
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

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`${cls} ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  review: Review;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ConfirmModal({ review, onConfirm, onCancel, loading }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-1">Удалить отзыв?</h3>
        <p className="text-sm text-gray-500 text-center mb-1">
          {review.author_name ?? 'Клиент'} · {review.country}
        </p>
        <p className="text-sm text-gray-700 text-center bg-gray-50 rounded-xl px-3 py-2 mb-5 line-clamp-2">
          "{review.text}"
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {loading ? 'Удаляем...' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const Reviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmReview, setConfirmReview] = useState<Review | null>(null);
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
        const { error } = await supabase
          .from('reviews')
          .delete()
          .eq('id', confirmReview.id);
        if (error) throw error;
      }
      setReviews(prev => prev.filter(r => r.id !== confirmReview.id));
      showToast('Отзыв удалён', 'success');
    } catch (e) {
      console.error('Delete error:', e);
      showToast('Ошибка при удалении — проверь политики Supabase', 'error');
    } finally {
      setDeleting(false);
      setConfirmReview(null);
    }
  };

  const approved = reviews.filter(r => r.status === 'approved');
  const avgRating = approved.length
    ? approved.reduce((s, r) => s + r.rating, 0) / approved.length
    : 0;

  const ratingDist = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: approved.filter(r => r.rating === star).length,
  }));

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-[#F5F7FA]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all animate-in slide-in-from-top-2 ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Confirm modal */}
      {confirmReview && (
        <ConfirmModal
          review={confirmReview}
          onConfirm={handleDelete}
          onCancel={() => setConfirmReview(null)}
          loading={deleting}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Отзывы</h1>
          <p className="text-sm text-gray-400 mt-0.5">@visadel_recall · синхронизируются автоматически</p>
        </div>
        <button
          onClick={loadReviews}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#2196F3] text-white rounded-xl text-sm font-medium hover:bg-[#1E88E5] active:scale-95 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={<Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
          label="Средняя оценка"
          value={avgRating ? avgRating.toFixed(1) : '—'}
          sub={approved.length ? `из ${approved.length} отзывов` : undefined}
          color="bg-yellow-50"
        />
        <StatCard
          icon={<MessageSquare className="w-5 h-5 text-blue-500" />}
          label="Всего отзывов"
          value={reviews.length}
          sub={`${approved.length} опубликовано`}
          color="bg-blue-50"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          label="5-звёздочных"
          value={`${approved.length ? Math.round((ratingDist[0].count / approved.length) * 100) : 0}%`}
          sub={`${ratingDist[0].count} отзывов`}
          color="bg-emerald-50"
        />
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
                    <div
                      className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
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
          <p className="text-sm text-gray-400 mt-1">Они появятся здесь после публикации в канале</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <div
              key={review.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5 shrink-0">{review.avatar ?? '🧑'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm">{review.author_name ?? 'Клиент'}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          review.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {review.status === 'approved' ? 'Опубликован' : 'Ожидает'}
                        </span>
                        {review.country && (
                          <span className="text-xs text-gray-400">{review.country}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StarRow rating={review.rating} />
                        <span className="text-xs text-gray-400">
                          {new Date(review.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric', month: 'long', year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmReview(review)}
                      className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Удалить отзыв"
                    >
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
