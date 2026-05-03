import { useState, useEffect } from 'react';
import { Star, MessageSquare, Gift, Send } from 'lucide-react';

interface Review {
  id: string;
  country: string;
  rating: number;
  text: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  bonusReceived: boolean;
}

const SAMPLE_REVIEWS = [
  {
    id: 'r1',
    author: 'Анна С.',
    country: 'Индия',
    rating: 5,
    text: 'Отличный сервис! Виза пришла за 2 дня, все очень быстро и удобно. Рекомендую!',
    date: '2024-11-20',
    avatar: '👩',
  },
  {
    id: 'r2',
    author: 'Михаил К.',
    country: 'Вьетнам',
    rating: 5,
    text: 'Оформил визу во Вьетнам срочно за 1 день. Все прошло отлично, никаких проблем. Спасибо большое!',
    date: '2024-11-18',
    avatar: '👨',
  },
  {
    id: 'r3',
    author: 'Елена П.',
    country: 'Шри-Ланка',
    rating: 4,
    text: 'Хороший сервис, но немного дольше ожидала. В целом все отлично, буду пользоваться еще.',
    date: '2024-11-15',
    avatar: '👩‍💼',
  },
];

export default function ReviewsTab() {
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);

  useEffect(() => {
    const savedReviews = localStorage.getItem('myReviews');
    if (savedReviews) {
      setMyReviews(JSON.parse(savedReviews));
    }

    // Get completed applications that can be reviewed
    const applications = JSON.parse(localStorage.getItem('applications') || '[]');
    const completedApps = applications.filter((app: any) => app.status === 'ready');
    const reviewedCountries = myReviews.map(r => r.country);
    const available = completedApps
      .map((app: any) => app.visa.country)
      .filter((country: string) => !reviewedCountries.includes(country));
    setAvailableCountries([...new Set(available)]);
  }, [myReviews.length]);

  const handleSubmitReview = () => {
    if (!selectedCountry) {
      alert('Выберите страну');
      return;
    }
    if (rating === 0) {
      alert('Поставьте оценку');
      return;
    }
    if (!reviewText.trim()) {
      alert('Напишите отзыв');
      return;
    }

    const newReview: Review = {
      id: Date.now().toString(),
      country: selectedCountry,
      rating,
      text: reviewText,
      createdAt: new Date().toISOString(),
      status: 'pending',
      bonusReceived: false,
    };

    const updatedReviews = [...myReviews, newReview];
    setMyReviews(updatedReviews);
    localStorage.setItem('myReviews', JSON.stringify(updatedReviews));

    // Reset form
    setShowReviewForm(false);
    setSelectedCountry('');
    setRating(0);
    setReviewText('');

    alert('Спасибо за отзыв! После модерации вы получите скидку 100₽ на следующий заказ.');
  };

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Star className="w-8 h-8" />
          <h3 className="text-xl">Система отзывов</h3>
        </div>
        <p className="text-yellow-100 text-sm mb-4">
          Оставляйте отзывы о полученных визах и получайте бонусы
        </p>
        <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            <p className="text-sm">Скидка 100₽ за отзыв на следующий заказ</p>
          </div>
        </div>
      </div>

      {/* Write Review Button */}
      {availableCountries.length > 0 && !showReviewForm && (
        <button
          onClick={() => setShowReviewForm(true)}
          className="w-full bg-[#1976D2] text-white py-4 rounded-[16px] hover:bg-[#0D47A1] transition flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-5 h-5" />
          Оставить отзыв
        </button>
      )}

      {/* Review Form */}
      {showReviewForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl text-gray-800 mb-4">Новый отзыв</h3>

          <div className="space-y-4">
            <div>
              <label className="block mb-2 text-gray-700">Выберите страну</label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="form-input"
              >
                <option value="">-- Выберите страну --</option>
                {availableCountries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 text-gray-700">Оценка</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="text-3xl transition hover:scale-110"
                  >
                    {star <= rating ? '⭐' : '☆'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block mb-2 text-gray-700">Ваш отзыв</label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="form-input min-h-32"
                placeholder="Расскажите о вашем опыте оформления визы..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReviewForm(false);
                  setSelectedCountry('');
                  setRating(0);
                  setReviewText('');
                }}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmitReview}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Reviews */}
      {myReviews.length > 0 && (
        <div>
          <h3 className="text-lg text-gray-800 mb-3">Мои отзывы</h3>
          <div className="space-y-3">
            {myReviews.map(review => (
              <div key={review.id} className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-gray-800">{review.country}</h4>
                    <div className="flex gap-1 my-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <span key={star} className="text-sm">
                          {star <= review.rating ? '⭐' : '☆'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    {review.status === 'pending' && (
                      <span className="bg-yellow-100 text-yellow-700 text-xs px-3 py-1 rounded-full">
                        На модерации
                      </span>
                    )}
                    {review.status === 'approved' && (
                      <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full">
                        Одобрен
                      </span>
                    )}
                    {review.status === 'rejected' && (
                      <span className="bg-red-100 text-red-700 text-xs px-3 py-1 rounded-full">
                        Отклонен
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-gray-700 text-sm mb-2">{review.text}</p>
                <p className="text-xs text-gray-500">
                  {new Date(review.createdAt).toLocaleDateString('ru-RU')}
                </p>
                {review.status === 'approved' && review.bonusReceived && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded p-2 flex items-center gap-2">
                    <Gift className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-green-700">Скидка 100₽ применена</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample Reviews */}
      <div>
        <h3 className="text-lg text-gray-800 mb-3">Отзывы клиентов</h3>
        <div className="space-y-3">
          {SAMPLE_REVIEWS.map(review => (
            <div key={review.id} className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-start gap-3 mb-2">
                <span className="text-2xl">{review.avatar}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-gray-800">{review.author}</h4>
                    <span className="text-xs text-gray-500">{review.country}</span>
                  </div>
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span key={star} className="text-sm">
                        {star <= review.rating ? '⭐' : '☆'}
                      </span>
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm mb-1">{review.text}</p>
                  <p className="text-xs text-gray-500">{review.date}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}