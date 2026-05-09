import { useState, useEffect, useCallback } from 'react';
import { Star, RefreshCw, MessageSquare, Plus, Check } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Modal, Button as BrandButton } from '../ui/brand';

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

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`w-4 h-4 ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
}

// ── Star picker ───────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1 justify-center">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform active:scale-90">
          <Star className={`w-9 h-9 transition-colors ${s <= (hover || value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
        </button>
      ))}
    </div>
  );
}

// ── Submit form ───────────────────────────────────────────────────────────────

function SubmitReviewForm({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [rating, setRating]     = useState(5);
  const [text, setText]         = useState('');
  const [country, setCountry]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState(false);

  // Get user info from Telegram WebApp
  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  const firstName = tgUser?.first_name ?? '';
  const lastName  = tgUser?.last_name  ?? '';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ') || 'Клиент';

  // Gender avatar from name ending
  function getAvatar(name: string) {
    const first = name.trim().split(/\s+/)[0].toLowerCase();
    return /[аяь]$/i.test(first) ? '👩' : '👨';
  }

  const handleSubmit = async () => {
    if (!text.trim() || !rating) return;
    setSaving(true);
    try {
      if (isSupabaseConfigured()) {
        await supabase.from('reviews').insert({
          rating,
          country: country.trim() || 'Не указана',
          text: text.trim(),
          author_name: fullName,
          avatar: getAvatar(firstName || fullName),
          status: 'pending',
          source: 'miniapp',
        });
      }
      setDone(true);
      setTimeout(() => { onClose(); onSent(); }, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} icon="⭐" label="Отзыв" title="Оставить отзыв" size="md">
        {done ? (
          <div className="flex flex-col items-center py-12 gap-3 px-5">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="font-semibold text-[#0F2A36] text-center">Спасибо за отзыв!</p>
            <p className="text-sm text-[#0F2A36]/60 text-center">Он появится после проверки администратором</p>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {/* Rating */}
            <div>
              <p className="text-xs text-[#0F2A36]/60 font-medium text-center mb-2">Ваша оценка</p>
              <StarPicker value={rating} onChange={setRating} />
            </div>

            {/* Country */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Страна визы</label>
              <input
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder="Например: Индия, Вьетнам..."
                className="w-full rounded-xl border border-[#E1E5EC] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/20 focus:border-[#3B5BFF]"
              />
            </div>

            {/* Text */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Ваш отзыв</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={4}
                placeholder="Расскажите о своём опыте работы с нами..."
                className="w-full rounded-xl border border-[#E1E5EC] px-4 py-2.5 text-sm placeholder-[#0F2A36]/40 focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/20 focus:border-[#3B5BFF] resize-none"
              />
            </div>

            {/* Author */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-4 py-2.5">
              <span className="text-lg">{getAvatar(firstName || fullName)}</span>
              <div>
                <p className="text-sm font-medium text-[#0F2A36]">{fullName}</p>
                <p className="text-xs text-[#0F2A36]/60">Отзыв будет опубликован от вашего имени</p>
              </div>
            </div>

            <BrandButton
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleSubmit}
              disabled={!text.trim() || saving}
              loading={saving}
            >
              {saving ? 'Отправляем...' : 'Отправить отзыв'}
            </BrandButton>

            <p className="text-xs text-[#0F2A36]/45 text-center pb-1">
              Отзыв появится в приложении после проверки администратором
            </p>
          </div>
        )}
    </Modal>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function ReviewsTab() {
  const [reviews, setReviews]         = useState<Review[]>([]);
  const [loading, setLoading]         = useState(true);
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
    const interval = setInterval(loadReviews, 30_000);
    return () => clearInterval(interval);
  }, [loadReviews]);

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="space-y-4 p-4 pb-24">

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
        <p className="text-yellow-100 text-xs mb-3">Реальные отзывы наших клиентов</p>
        {avgRating && (
          <div className="bg-white/20 rounded-xl px-4 py-2 flex items-center gap-3">
            <span className="text-3xl font-bold">{avgRating}</span>
            <div>
              <StarRow rating={Math.round(Number(avgRating))} />
              <p className="text-yellow-100 text-xs mt-0.5">
                {reviews.length} {reviews.length === 1 ? 'отзыв' : reviews.length < 5 ? 'отзыва' : 'отзывов'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Leave review button */}
      <button
        onClick={() => {
          const tg = (window as any).Telegram?.WebApp;
          if (tg?.openTelegramLink) {
            tg.openTelegramLink('https://t.me/visadel_recall');
          } else {
            window.open('https://t.me/visadel_recall', '_blank');
          }
        }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-yellow-300 text-yellow-600 bg-yellow-50 text-sm font-semibold hover:bg-yellow-100 active:scale-95 transition-all"
      >
        <Plus className="w-4 h-4" />
        Оставить отзыв
      </button>

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
          <p className="text-gray-300 text-xs mt-1">Будьте первым — нажмите кнопку выше</p>
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
                      {new Date(review.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  {/* Source-бейдж + страна — на той же строке, мелким шрифтом */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                    {review.source === 'channel' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 text-[#3B5BFF] font-medium flex items-center gap-1">
                        📣 @visadel_agency
                      </span>
                    )}
                    {review.source === 'miniapp' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-medium flex items-center gap-1">
                        💬 Из приложения
                      </span>
                    )}
                    {review.country && review.country !== 'Не указана' && (
                      <span className="text-[11px] text-gray-400">{review.country}</span>
                    )}
                  </div>
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
