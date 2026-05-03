import { AlertCircle, CheckCircle } from 'lucide-react';
import type { Country, VisaOption } from '../../App';
import type { FormData } from '../ApplicationForm';

interface Step6Props {
  country: Country;
  visa: VisaOption;
  isUrgent: boolean;
  formData: FormData;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step6Review({ country, visa, isUrgent, formData, onNext, onPrev }: Step6Props) {
  const getCountryName = () => {
    const names: Record<Country, string> = {
      'india': 'Индия',
      'vietnam': 'Вьетнам',
      'south-korea': 'Южная Корея',
      'israel': 'Израиль',
      'cambodia': 'Камбоджа',
      'kenya': 'Кения',
      'pakistan': 'Пакистан',
      'sri-lanka': 'Шри-Ланка',
    };
    return names[country] || country;
  };

  const renderField = (label: string, value: any) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;
    
    return (
      <div className="py-2 border-b border-gray-100 last:border-0">
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className="text-gray-900">
          {Array.isArray(value) ? value.join(', ') : 
           typeof value === 'object' ? value.name || 'Загружен' : 
           value}
        </p>
      </div>
    );
  };

  return (
    <div>
      <h2 className="mb-6">Проверка данных</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-yellow-50 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-900">
            <p className="mb-1">⚠️ Пожалуйста, внимательно проверьте все данные</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Убедитесь, что все данные введены корректно</li>
              <li>Фото должно быть свежим и соответствовать требованиям</li>
              <li>Срок действия загранпаспорта должен быть не менее 6 месяцев</li>
            </ul>
          </div>
        </div>

        {/* Виза */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="mb-3">Информация о визе</h3>
          {renderField('Страна', getCountryName())}
          {renderField('Тип визы', visa.name)}
          {renderField('Стоимость', `${visa.price}₽`)}
          {isUrgent && renderField('Срочное оформление', '+1000₽')}
          {renderField('Итого', `${visa.price + (isUrgent ? 1000 : 0)}₽`)}
        </div>

        {/* Основные данные */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="mb-3">Основные данные</h3>
          {renderField('Гражданство', formData.citizenship)}
          {renderField('Дата прилёта', formData.arrivalDate)}
          {renderField('Аэропорт прилёта', formData.arrivalAirport)}
          {renderField('Город рождения', formData.birthCity)}
          {renderField('Страна рождения', formData.birthCountry)}
          {renderField('Семейное положение', formData.maritalStatus)}
        </div>

        {/* Контактные данные */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="mb-3">Контактные данные</h3>
          {renderField('Email', formData.email)}
          {renderField('Телефон', formData.phone)}
          {renderField('Telegram', formData.telegram)}
        </div>

        {/* Загруженные документы */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="mb-3">Загруженные документы</h3>
          <div className="space-y-2">
            {formData.photoFace && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>Фото лица загружено</span>
              </div>
            )}
            {formData.photoPassport && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>Фото паспорта загружено</span>
              </div>
            )}
            {formData.photoVisa && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>Фото визы загружено</span>
              </div>
            )}
            {formData.hotelBooking && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>Бронь отеля загружена</span>
              </div>
            )}
            {formData.returnTicket && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>Обратный билет загружен</span>
              </div>
            )}
          </div>
        </div>

        {/* Как узнали */}
        {formData.howKnow && formData.howKnow.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="mb-3">Как узнали о нас</h3>
            {renderField('Источники', formData.howKnow)}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPrev}
          className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Назад
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Подтвердить
        </button>
      </div>
    </div>
  );
}
