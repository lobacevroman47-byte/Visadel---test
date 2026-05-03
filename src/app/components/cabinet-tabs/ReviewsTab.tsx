import { useState } from 'react';
import { Star, Send, Gift } from 'lucide-react';

interface Review {
  id: string;
  country: string;
  rating: number;
  text: string;
  date: string;
  status: 'approved' | 'pending' | 'rejected';
}

const mockReviews: Review[] = [
  {
    id: '1',
    country: 'Индия',
    rating: 5,
    text: 'Отличный сервис! Виза пришла за 3 дня, все документы оформили быстро.',
    date: '2025-11-15',
    status: 'approved'
  }
];

const availableCountries = ['Индия', 'Вьетнам', 'Южная Корея', 'Израиль', 'Камбоджа', 'Кения', 'Пакистан', 'Шри-Ланка'];

export default function ReviewsTab() {
  const [reviews, setReviews] = useState<Review[]>(mockReviews);
  const [showForm, setShowForm] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  // Check which countries the user has received visas for
  const receivedVisas = ['Индия']; // This would come from actual user data

  // Check which countries user already reviewed
  const reviewedCountries = reviews.map(r => r.country);
  
  // Available countries for review
  const canReview = receivedVisas.filter(country => !reviewedCountries.includes(country));

  const handleSubmitReview = () => {
    if (!selectedCountry || rating === 0 || !reviewText.trim()) {
      alert('Пожалуйста, заполните все поля');
      return;
    }

    const newReview: Review = {
      id: Date.now().toString(),
      country: selectedCountry,
      rating,
      text: reviewText,
      date: new Date().toISOString(),
      status: 'pending'
    };

    setReviews([newReview, ...reviews]);
    
    // Add discount coupon
    alert('Спасибо за отзыв! Вы получили скидку 100₽ на следующий заказ.');
    
    // Reset form
    setShowForm(false);
    setSelectedCountry('');
    setRating(0);
    setReviewText('');
  };

  const renderStars = (count: number, interactive: boolean = false, onRate?: (rating: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && onRate && onRate(star)}
            disabled={!interactive}
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
          >
            <Star
              className={`w-5 h-5 ${
                star <= count
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-600 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-3">
          <Gift className="w-8 h-8 flex-shrink-0" />
          <div>
            <h2 className="text-xl mb-2">Получите скидку за отзыв!</h2>
            <p className="text-sm opacity-90">
              Оставьте отзыв на полученную визу и получите 100₽ скидку на следующий заказ
            </p>
          </div>
        </div>
      </div>

      {/* Can Review Notice */}
      {canReview.length > 0 && !showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-blue-900 mb-2">Вы можете оставить отзыв</h3>
          <p className="text-sm text-blue-800 mb-3">
            У вас есть {canReview.length} {canReview.length === 1 ? 'страна' : 'стран'}, на которую можно оставить отзыв
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Написать отзыв
          </button>
        </div>
      )}

      {/* Review Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg text-gray-900 mb-4">Новый отзыв</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2 text-gray-700">Выберите страну</label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Выберите страну</option>
                {canReview.map((country) => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">Оценка</label>
              {renderStars(rating, true, setRating)}
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">Ваш отзыв</label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Расскажите о вашем опыте оформления визы..."
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmitReview}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white py-3 rounded-xl hover:bg-blue-600 transition-colors"
              >
                <Send className="w-4 h-4" />
                Отправить
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setSelectedCountry('');
                  setRating(0);
                  setReviewText('');
                }}
                className="px-6 bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-gray-900 mb-4">Мои отзывы</h3>
        
        {reviews.length === 0 ? (
          <div className="text-center py-8">
            <Star className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">Вы еще не оставляли отзывов</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-gray-900 mb-1">{review.country}</h4>
                    {renderStars(review.rating)}
                  </div>
                  <div className="text-right">
                    {review.status === 'approved' && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                        Опубликован
                      </span>
                    )}
                    {review.status === 'pending' && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                        На модерации
                      </span>
                    )}
                    {review.status === 'rejected' && (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                        Отклонен
                      </span>
                    )}
                  </div>
                </div>
                
                <p className="text-gray-700 mb-2">{review.text}</p>
                <p className="text-sm text-gray-500">
                  {new Date(review.date).toLocaleDateString('ru-RU')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rules */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h3 className="text-gray-900 mb-3">Правила отзывов</h3>
        <ul className="text-sm text-gray-700 space-y-2">
          <li>• Отзыв можно оставить только на страну, визу которой вы получили</li>
          <li>• На каждую страну можно оставить только один отзыв</li>
          <li>• После модерации и публикации вы получите скидку 100₽</li>
          <li>• Отзыв должен быть информативным и объективным</li>
          <li>• Запрещены оскорбления и нецензурная лексика</li>
        </ul>
      </div>
    </div>
  );
}
