import { AlertCircle, User, FileText, Camera, CreditCard, Mail, Phone } from 'lucide-react';
import { ApplicationData } from '../ApplicationForm';

interface Step6Props {
  data: ApplicationData;
  country: string;
  duration: string;
  isUrgent: boolean;
  onNext: () => void;
}

export default function Step6Review({ data, country, duration, isUrgent, onNext }: Step6Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl mb-4 text-gray-900">Проверка данных</h2>
        <p className="text-sm text-gray-500 mb-6">
          Внимательно проверьте все введенные данные перед отправкой
        </p>
      </div>

      {/* Warning */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-900">
              <strong>Важно!</strong> Пожалуйста, проверьте все данные. Убедитесь, что фотографии 
              четкие и актуальные. После оплаты изменения будут невозможны.
            </p>
          </div>
        </div>
      </div>

      {/* Visa Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-gray-900 mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          Данные визы
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Страна:</span>
            <span className="text-gray-900">{country}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Срок действия:</span>
            <span className="text-gray-900">{duration}</span>
          </div>
          {isUrgent && (
            <div className="flex justify-between">
              <span className="text-gray-600">Срочность:</span>
              <span className="text-orange-600">Да (+1000₽)</span>
            </div>
          )}
        </div>
      </div>

      {/* Personal Data */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-gray-900 mb-3 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-500" />
          Личные данные
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">ФИО:</span>
            <span className="text-gray-900">{data.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Дата рождения:</span>
            <span className="text-gray-900">{data.birthDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Паспорт:</span>
            <span className="text-gray-900">{data.passportNumber}</span>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-gray-900 mb-3 flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-500" />
          Контактная информация
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Email:</span>
            <span className="text-gray-900">{data.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Телефон:</span>
            <span className="text-gray-900">{data.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Telegram:</span>
            <span className="text-gray-900">{data.telegramLogin}</span>
          </div>
        </div>
      </div>

      {/* Additional Services */}
      {(data.returnTicket || data.hotelBooking) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-gray-900 mb-3 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-500" />
            Дополнительные услуги
          </h3>
          <div className="space-y-2 text-sm">
            {data.returnTicket && (
              <div className="flex justify-between">
                <span className="text-gray-600">Обратный билет:</span>
                <span className="text-gray-900">Да</span>
              </div>
            )}
            {data.hotelBooking && (
              <div className="flex justify-between">
                <span className="text-gray-600">Бронирование отеля:</span>
                <span className="text-gray-900">Да</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photos */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-gray-900 mb-3 flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-500" />
          Загруженные фотографии
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Фото лица:</span>
            <span className="text-green-600">✓ Загружено</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Фото паспорта:</span>
            <span className="text-green-600">✓ Загружено</span>
          </div>
          {data.photoPreviousVisa && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Предыдущая виза:</span>
              <span className="text-green-600">✓ Загружено</span>
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl hover:opacity-90 transition-opacity"
      >
        Подтвердить и перейти к оплате
      </button>
    </form>
  );
}
