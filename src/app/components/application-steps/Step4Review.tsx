import { AlertCircle, User, FileText, Camera, CreditCard } from 'lucide-react';
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
              <span className="text-orange-600">Да (+500₽)</span>
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
          <div className="flex justify-between">
            <span className="text-gray-600">Гражданство:</span>
            <span className="text-gray-900">{data.citizenship}</span>
          </div>
        </div>
      </div>

      {/* Additional Services */}
      {(data.returnTicket || data.insurance) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-gray-900 mb-3 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-500" />
            Дополнительные услуги
          </h3>
          <div className="space-y-2 text-sm">
            {data.returnTicket && (
              <div className="flex justify-between">
                <span className="text-gray-600">Бронирование билета:</span>
                <span className="text-gray-900">Да (+2000₽)</span>
              </div>
            )}
            {data.insurance && (
              <div className="flex justify-between">
                <span className="text-gray-600">Медицинская страховка:</span>
                <span className="text-gray-900">Да (+1500₽)</span>
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Фото лица</p>
            <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
              <Camera className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Фото паспорта</p>
            <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          </div>
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
