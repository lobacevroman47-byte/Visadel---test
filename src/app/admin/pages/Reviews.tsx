import React, { useState, useEffect, useCallback } from 'react';
import { Star, Trash2, RefreshCw, MessageSquare } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface Review {
  id: string;
  country: string;
  rating: number;
  text: string;
  author_name?: string;
  avatar?: string;
  source?: string;
  status: string;
  created_at: string;
  channel_message_id?: number;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
}

export const Reviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      if (isSupabaseConfigured()) {
        await supabase.from('reviews').delete().eq('id', id);
        setReviews(prev => prev.filter(r => r.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete review:', e);
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const approved = reviews.filter(r => r.status === 'approved');
  const avgRating = approved.length
    ? (approved.reduce((s, r) => s + r.rating, 0) / approved.length).toFixed(1)
    : null;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Отзывы</h1>
          <p className="text-sm text-gray-500 mt-1">Отзывы из канала @visadel_recall</p>
        </div>
        <button
          onClick={loadReviews}
          className="flex items-center gap-2 px-4 py-2 bg-[#2196F3] text-white rounded-xl hover:bg-[#1E88E5] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Stats */}
      {avgRating && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Средняя оценка</p>
              <p className="text-xl font-bold text-gray-900">{avgRating}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Всего отзывов</p>
              <p className="text-xl font-bold text-gray-900">{reviews.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Отзывов пока нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <div key={review.id} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none mt-0.5 shrink-0">{review.avatar ?? '🧑'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{review.author_name ?? 'Клиент'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRow rating={review.rating} />
                        {review.country && (
                          <span className="text-xs text-gray-400">• {review.country}</span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          review.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {review.status === 'approved' ? 'Опубликован' : review.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-xs text-gray-400">
                        {new Date(review.created_at).toLocaleDateString('ru-RU')}
                      </p>
                      {confirmDelete === review.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(review.id)}
                            disabled={deleting === review.id}
                            className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            {deleting === review.id ? '...' : 'Удалить'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(review.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить отзыв"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mt-2">"{review.text}"</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
