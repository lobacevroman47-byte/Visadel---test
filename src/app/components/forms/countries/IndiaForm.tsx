import { useState } from 'react';
import type { FormData } from '../../ApplicationForm';
import FormField from '../FormField';

interface IndiaFormProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
}

export default function IndiaForm({ formData, updateFormData, onNext }: IndiaFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    // Валидация обязательных полей
    if (!formData.citizenship) newErrors.citizenship = 'Обязательное поле';
    if (!formData.arrivalAirport) newErrors.arrivalAirport = 'Обязательное поле';
    if (!formData.arrivalDate) newErrors.arrivalDate = 'Обязательное поле';
    if (!formData.birthCity) newErrors.birthCity = 'Обязательное поле';
    if (!formData.passportSeries) newErrors.passportSeries = 'Обязательное поле';
    if (!formData.lived2Years) newErrors.lived2Years = 'Обязательное поле';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Гражданство */}
      <FormField label="Гражданство" required error={errors.citizenship}>
        <input
          type="text"
          value={formData.citizenship || ''}
          onChange={(e) => updateFormData({ citizenship: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Например: Россия"
        />
      </FormField>

      {/* Аэропорт прилёта */}
      <FormField 
        label="Аэропорт прилёта" 
        required 
        helper="Если не знаете точно, укажите примерный"
        error={errors.arrivalAirport}
      >
        <input
          type="text"
          value={formData.arrivalAirport || ''}
          onChange={(e) => updateFormData({ arrivalAirport: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Например: Дели (DEL)"
        />
      </FormField>

      {/* Дата прилёта */}
      <FormField 
        label="Дата прилёта" 
        required 
        helper="Можно указать примерную дату"
        error={errors.arrivalDate}
      >
        <input
          type="date"
          value={formData.arrivalDate || ''}
          onChange={(e) => updateFormData({ arrivalDate: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </FormField>

      {/* Предыдущие Фамилия и Имя */}
      <FormField 
        label="Предыдущие Фамилия и Имя" 
        helper="Если не менялись — оставьте пустым"
      >
        <input
          type="text"
          value={formData.previousName || ''}
          onChange={(e) => updateFormData({ previousName: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Иванова Мария"
        />
      </FormField>

      {/* Город рождения */}
      <FormField label="Город рождения" required error={errors.birthCity}>
        <input
          type="text"
          value={formData.birthCity || ''}
          onChange={(e) => updateFormData({ birthCity: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Москва"
        />
      </FormField>

      {/* Предыдущее гражданство */}
      <FormField 
        label="Предыдущее гражданство" 
        helper="Если не менялось — оставьте пустым"
      >
        <input
          type="text"
          value={formData.previousCitizenship || ''}
          onChange={(e) => updateFormData({ previousCitizenship: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Например: СССР"
        />
      </FormField>

      {/* Серия и номер внутреннего паспорта */}
      <FormField label="Серия и номер внутреннего паспорта РФ" required error={errors.passportSeries}>
        <input
          type="text"
          value={formData.passportSeries || ''}
          onChange={(e) => updateFormData({ passportSeries: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="1234 567890"
        />
      </FormField>

      {/* Прожили не менее 2-х лет */}
      <FormField 
        label="Прожили не менее 2-х лет в стране, из которой оформляете визу?" 
        required
        error={errors.lived2Years}
      >
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="lived2Years"
              value="yes"
              checked={formData.lived2Years === 'yes'}
              onChange={(e) => updateFormData({ lived2Years: e.target.value })}
              className="w-4 h-4"
            />
            <span>Да</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="lived2Years"
              value="no"
              checked={formData.lived2Years === 'no'}
              onChange={(e) => updateFormData({ lived2Years: e.target.value })}
              className="w-4 h-4"
            />
            <span>Нет</span>
          </label>
        </div>
      </FormField>

      {/* Адрес регистрации */}
      <div className="space-y-4">
        <h3>Адрес регистрации</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Индекс" required>
            <input
              type="text"
              value={formData.regPostalCode || ''}
              onChange={(e) => updateFormData({ regPostalCode: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="123456"
            />
          </FormField>
          <FormField label="Область" required>
            <input
              type="text"
              value={formData.regRegion || ''}
              onChange={(e) => updateFormData({ regRegion: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Московская обл."
            />
          </FormField>
          <FormField label="Город" required>
            <input
              type="text"
              value={formData.regCity || ''}
              onChange={(e) => updateFormData({ regCity: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Москва"
            />
          </FormField>
          <FormField label="Улица" required>
            <input
              type="text"
              value={formData.regStreet || ''}
              onChange={(e) => updateFormData({ regStreet: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Тверская ул."
            />
          </FormField>
          <FormField label="Дом" required>
            <input
              type="text"
              value={formData.regHouse || ''}
              onChange={(e) => updateFormData({ regHouse: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="д. 1, кв. 10"
            />
          </FormField>
        </div>
      </div>

      {/* Адрес проживания */}
      <FormField 
        label="Адрес проживания" 
        required
        helper="Если совпадает с регистрацией, напишите 'тот же'"
      >
        <input
          type="text"
          value={formData.liveAddress || ''}
          onChange={(e) => updateFormData({ liveAddress: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="тот же"
        />
      </FormField>

      {/* Данные отца */}
      <div className="space-y-4">
        <h3>Данные отца</h3>
        <div className="grid grid-cols-1 gap-4">
          <FormField label="Имя отца" required>
            <input
              type="text"
              value={formData.fatherName || ''}
              onChange={(e) => updateFormData({ fatherName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Иван Петрович"
            />
          </FormField>
          <FormField label="Гражданство отца" required>
            <input
              type="text"
              value={formData.fatherCitizenship || ''}
              onChange={(e) => updateFormData({ fatherCitizenship: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Россия"
            />
          </FormField>
          <FormField label="Город рождения отца" required>
            <input
              type="text"
              value={formData.fatherBirthCity || ''}
              onChange={(e) => updateFormData({ fatherBirthCity: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Москва"
            />
          </FormField>
        </div>
      </div>

      {/* Данные матери */}
      <div className="space-y-4">
        <h3>Данные матери</h3>
        <div className="grid grid-cols-1 gap-4">
          <FormField label="Имя матери" required>
            <input
              type="text"
              value={formData.motherName || ''}
              onChange={(e) => updateFormData({ motherName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Мария Ивановна"
            />
          </FormField>
          <FormField label="Гражданство матери" required>
            <input
              type="text"
              value={formData.motherCitizenship || ''}
              onChange={(e) => updateFormData({ motherCitizenship: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Россия"
            />
          </FormField>
          <FormField label="Город рождения матери" required>
            <input
              type="text"
              value={formData.motherBirthCity || ''}
              onChange={(e) => updateFormData({ motherBirthCity: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Москва"
            />
          </FormField>
        </div>
      </div>

      {/* Семейное положение */}
      <FormField label="Семейное положение" required>
        <select
          value={formData.maritalStatus || ''}
          onChange={(e) => updateFormData({ maritalStatus: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Выберите</option>
          <option value="single">Холост/Не замужем</option>
          <option value="married">Женат/Замужем</option>
          <option value="divorced">Разведён/Разведена</option>
          <option value="widowed">Вдовец/Вдова</option>
        </select>
      </FormField>

      {/* Информация о супруге (если в браке) */}
      {formData.maritalStatus === 'married' && (
        <div className="space-y-4">
          <h3>Информация о супруге</h3>
          <FormField label="ФИО супруга/супруги">
            <input
              type="text"
              value={formData.spouseName || ''}
              onChange={(e) => updateFormData({ spouseName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Иванов Иван Иванович"
            />
          </FormField>
          <FormField label="Дата рождения супруга/супруги">
            <input
              type="date"
              value={formData.spouseBirthDate || ''}
              onChange={(e) => updateFormData({ spouseBirthDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </FormField>
          <FormField label="Гражданство супруга/супруги">
            <input
              type="text"
              value={formData.spouseCitizenship || ''}
              onChange={(e) => updateFormData({ spouseCitizenship: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Россия"
            />
          </FormField>
        </div>
      )}

      {/* Место работы */}
      <div className="space-y-4">
        <h3>Место работы</h3>
        <FormField 
          label="Наименование компании" 
          required
          helper="Если безработный — напишите 'нет работы'"
        >
          <input
            type="text"
            value={formData.companyName || ''}
            onChange={(e) => updateFormData({ companyName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="ООО 'Компания'"
          />
        </FormField>
        <FormField label="Адрес компании" required>
          <input
            type="text"
            value={formData.companyAddress || ''}
            onChange={(e) => updateFormData({ companyAddress: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="г. Москва, ул. Ленина, д. 1"
          />
        </FormField>
        <FormField label="Должность" required>
          <input
            type="text"
            value={formData.position || ''}
            onChange={(e) => updateFormData({ position: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Менеджер"
          />
        </FormField>
        <FormField label="Телефон компании" required>
          <input
            type="tel"
            value={formData.companyPhone || ''}
            onChange={(e) => updateFormData({ companyPhone: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="+7 (495) 123-45-67"
          />
        </FormField>
        <FormField label="Email компании" required>
          <input
            type="email"
            value={formData.companyEmail || ''}
            onChange={(e) => updateFormData({ companyEmail: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="info@company.ru"
          />
        </FormField>
      </div>

      {/* Служба в армии/полиции */}
      <FormField 
        label="Служили в армии/полиции?" 
        required
        helper="Если не служили — напишите 'нет'"
      >
        <textarea
          value={formData.militaryService || ''}
          onChange={(e) => updateFormData({ militaryService: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder="Название организации, номер в/ч, должность, звание, местонахождение (или 'нет')"
        />
      </FormField>

      {/* Города/места планируемого посещения */}
      <FormField label="Города/места планируемого посещения в Индии" required>
        <textarea
          value={formData.planedCities || ''}
          onChange={(e) => updateFormData({ planedCities: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          placeholder="Дели, Гоа, Мумбаи"
        />
      </FormField>

      {/* Посещенные страны за 10 лет */}
      <FormField label="Страны, которые посещали за последние 10 лет" required>
        <textarea
          value={formData.visitedCountries || ''}
          onChange={(e) => updateFormData({ visitedCountries: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder="Таиланд, ОАЭ, Турция..."
        />
      </FormField>

      {/* Посещали ранее Индию */}
      <FormField label="Посещали ранее Индию?" required>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="visitedIndia"
              value="yes"
              checked={formData.visitedIndia === 'yes'}
              onChange={(e) => updateFormData({ visitedIndia: e.target.value })}
              className="w-4 h-4"
            />
            <span>Да</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="visitedIndia"
              value="no"
              checked={formData.visitedIndia === 'no'}
              onChange={(e) => updateFormData({ visitedIndia: e.target.value })}
              className="w-4 h-4"
            />
            <span>Нет</span>
          </label>
        </div>
      </FormField>

      {formData.visitedIndia === 'yes' && (
        <FormField label="Когда посещали Индию?">
          <input
            type="text"
            value={formData.indiaVisitDates || ''}
            onChange={(e) => updateFormData({ indiaVisitDates: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Например: Январь 2023"
          />
        </FormField>
      )}

      {/* Название отеля */}
      <div className="space-y-4">
        <h3>Информация о проживании в Индии</h3>
        <FormField label="Название отеля" required>
          <input
            type="text"
            value={formData.hotelName || ''}
            onChange={(e) => updateFormData({ hotelName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Hotel Taj Mahal"
          />
        </FormField>
        <FormField label="Адрес отеля" required>
          <input
            type="text"
            value={formData.hotelAddress || ''}
            onChange={(e) => updateFormData({ hotelAddress: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="New Delhi, Connaught Place"
          />
        </FormField>
        <FormField label="Телефон отеля" required>
          <input
            type="tel"
            value={formData.hotelPhone || ''}
            onChange={(e) => updateFormData({ hotelPhone: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="+91 11 1234 5678"
          />
        </FormField>
      </div>

      {/* Контактное лицо в Индии */}
      <div className="space-y-4">
        <h3>Контактное лицо в Индии</h3>
        <FormField label="ФИО" required>
          <input
            type="text"
            value={formData.contactIndiaName || ''}
            onChange={(e) => updateFormData({ contactIndiaName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Raj Kumar"
          />
        </FormField>
        <FormField label="Полный адрес" required>
          <input
            type="text"
            value={formData.contactIndiaAddress || ''}
            onChange={(e) => updateFormData({ contactIndiaAddress: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Mumbai, Maharashtra"
          />
        </FormField>
        <FormField label="Телефон" required>
          <input
            type="tel"
            value={formData.contactIndiaPhone || ''}
            onChange={(e) => updateFormData({ contactIndiaPhone: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="+91 98765 43210"
          />
        </FormField>
      </div>

      {/* Контактное лицо в стране гражданства (экстренный случай) */}
      <div className="space-y-4">
        <h3>Контактное лицо в стране гражданства (экстренный случай)</h3>
        <FormField label="ФИО" required>
          <input
            type="text"
            value={formData.emergencyContactName || ''}
            onChange={(e) => updateFormData({ emergencyContactName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Иванов Иван Иванович"
          />
        </FormField>
        <FormField label="Полный адрес" required>
          <input
            type="text"
            value={formData.emergencyContactAddress || ''}
            onChange={(e) => updateFormData({ emergencyContactAddress: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="г. Москва, ул. Ленина, д. 1, кв. 10"
          />
        </FormField>
        <FormField label="Телефон" required>
          <input
            type="tel"
            value={formData.emergencyContactPhone || ''}
            onChange={(e) => updateFormData({ emergencyContactPhone: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="+7 (999) 123-45-67"
          />
        </FormField>
      </div>

      <FormField label="Как вы о нас узнали?">
        <select
          value={formData.howHeard?.[0] || ''}
          onChange={(e) => updateFormData({ howHeard: e.target.value ? [e.target.value] : [] })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="">Выберите вариант</option>
          <option value="telegram">Telegram</option>
          <option value="instagram">Instagram</option>
          <option value="youtube">YouTube</option>
          <option value="tiktok">TikTok</option>
          <option value="vk">VK</option>
          <option value="rutube">RuTube</option>
          <option value="friends">Посоветовали друзья</option>
          <option value="repeat">Оформлял(-а) визу ранее</option>
        </select>
      </FormField>


      <button
        type="submit"
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Продолжить
      </button>
    </form>
  );
}
