import { useState, useEffect, useCallback } from 'react';
import { Star, RefreshCw, MessageSquare } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface Review {
  id: string;
  country: string;
  rating: number;
  text: string;
  author_name?: string;
  avatar?: string;
  source?: string;
  created_at: string;
  status: string;
}

const STARS = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`w-4 h-4 ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
}

export default function ReviewsTab() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data } = await supabase
          .from('reviews')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(50);
        setReviews((data as Review[]) ?? []);
      }
    } catch (e) {
      console.error('Failed to load reviews:', e);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    loadReviews();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadReviews, 30_000);
    return () => clearInterval(interval);
  }, [loadReviews]);

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="space-y-4 p-4">

      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            <h3 className="text-lg font-semibold">Отзывы клиентов</h3>
          </div>
          <button onClick={loadReviews} className="p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-yellow-100 text-xs mb-3">Отзывы из канала @visadel_recall • обновляются автоматически</p>
        {avgRating && (
          <div className="bg-white/20 rounded-xl px-4 py-2 flex items-center gap-3">
            <span className="text-3xl font-bold">{avgRating}</span>
            <div>
              <StarRow rating={Math.round(Number(avgRating))} />
              <p className="text-yellow-100 text-xs mt-0.5">{reviews.length} {reviews.length === 1 ? 'отзыв' : reviews.length < 5 ? 'отзыва' : 'отзывов'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs text-gray-400 text-center">
          Обновлено: {lastUpdated.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {/* Reviews list */}
      {loading && reviews.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
          <p className="text-gray-400 text-sm">Загружаем отзывы...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-400 text-sm">Отзывов пока нет</p>
          <p className="text-gray-300 text-xs mt-1">Они появятся здесь после публикации в канале</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <div key={review.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none mt-0.5">{review.avatar ?? '🧑'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-gray-800 text-sm truncate">
                      {review.author_name ?? 'Клиент'}
                    </p>
                    <p className="text-xs text-gray-400 shrink-0">
                      {new Date(review.created_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  {review.country && (
                    <p className="text-xs text-gray-400 mb-1">{review.country}</p>
                  )}
                  <StarRow rating={review.rating} />
                  <p className="text-sm text-gray-700 leading-relaxed mt-2">"{review.text}"</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
