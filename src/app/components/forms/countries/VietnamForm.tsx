import { useState } from 'react';
import type { FormData } from '../../ApplicationForm';
import FormField from '../FormField';

interface VietnamFormProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
}

export default function VietnamForm({ formData, updateFormData, onNext }: VietnamFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.citizenship) newErrors.citizenship = 'Обязательное поле';
    if (!formData.birthCountry) newErrors.birthCountry = 'Обязательное поле';
    if (!formData.stayDates) newErrors.stayDates = 'Обязательное поле';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField label="Гражданство" required error={errors.citizenship}>
        <input
          type="text"
          value={formData.citizenship || ''}
          onChange={(e) => updateFormData({ citizenship: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Россия"
        />
      </FormField>

      <FormField label="Страна рождения" required error={errors.birthCountry}>
        <input
          type="text"
          value={formData.birthCountry || ''}
          onChange={(e) => updateFormData({ birthCountry: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Россия"
        />
      </FormField>

      <FormField label="Второе гражданство" helper="Если нет — оставьте пустым">
        <input
          type="text"
          value={formData.secondCitizenship || ''}
          onChange={(e) => updateFormData({ secondCitizenship: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder=""
        />
      </FormField>

      <FormField 
        label="Нарушения законов Вьетнама" 
        helper="Если были — укажите нарушение / дату / санкцию"
      >
        <textarea
          value={formData.lawViolations || ''}
          onChange={(e) => updateFormData({ lawViolations: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder="Нет"
        />
      </FormField>

      <FormField 
        label="Использовали другие паспорта для въезда во Вьетнам" 
        helper="Если да — укажите номер старого паспорта"
      >
        <input
          type="text"
          value={formData.otherPassports || ''}
          onChange={(e) => updateFormData({ otherPassports: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Нет"
        />
      </FormField>

      <FormField 
        label="Предполагаемые даты пребывания" 
        required 
        helper="Не более 90 дней"
        error={errors.stayDates}
      >
        <div className="grid grid-cols-2 gap-4">
          <input
            type="date"
            value={formData.stayDateFrom || ''}
            onChange={(e) => updateFormData({ stayDateFrom: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Дата въезда"
          />
          <input
            type="date"
            value={formData.stayDateTo || ''}
            onChange={(e) => updateFormData({ stayDateTo: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Дата выезда"
          />
        </div>
      </FormField>

      <FormField label="Адрес регистрации/прописки" required>
        <textarea
          value={formData.registrationAddress || ''}
          onChange={(e) => updateFormData({ registrationAddress: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          placeholder="г. Москва, ул. Ленина, д. 1, кв. 10"
        />
      </FormField>

      <FormField 
        label="Адрес проживания" 
        required
        helper="Если отличается от регистрации"
      >
        <textarea
          value={formData.liveAddress || ''}
          onChange={(e) => updateFormData({ liveAddress: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          placeholder="Тот же или укажите другой адрес"
        />
      </FormField>

      <div className="space-y-4">
        <h3>Контактное лицо (экстренный случай)</h3>
        <FormField label="ФИО" required>
          <input
            type="text"
            value={formData.emergencyContactName || ''}
            onChange={(e) => updateFormData({ emergencyContactName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Иванов Иван Иванович"
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

      <FormField 
        label="Работа/учёба" 
        required
        helper="Если безработный — напишите 'нет'"
      >
        <input
          type="text"
          value={formData.occupation || ''}
          onChange={(e) => updateFormData({ occupation: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="ООО 'Компания', менеджер"
        />
      </FormField>

      <FormField 
        label="Цель визита" 
        required
        helper="При туризме — согласие не работать или открывать бизнес"
      >
        <select
          value={formData.visitPurpose || ''}
          onChange={(e) => updateFormData({ visitPurpose: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Выберите</option>
          <option value="tourism">Туризм (согласен не работать и не открывать бизнес)</option>
          <option value="business">Бизнес</option>
          <option value="other">Другое</option>
        </select>
      </FormField>

      <FormField 
        label="Контакт с агентствами/организациями во Вьетнаме" 
        helper="Если есть — укажите данные"
      >
        <textarea
          value={formData.vietnamContacts || ''}
          onChange={(e) => updateFormData({ vietnamContacts: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder="Нет"
        />
      </FormField>

      <FormField label="Аэропорт прилёта" required>
        <input
          type="text"
          value={formData.arrivalAirport || ''}
          onChange={(e) => updateFormData({ arrivalAirport: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Ханой (HAN)"
        />
      </FormField>

      <FormField label="Аэропорт вылета" required>
        <input
          type="text"
          value={formData.departureAirport || ''}
          onChange={(e) => updateFormData({ departureAirport: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Хошимин (SGN)"
        />
      </FormField>

      <FormField 
        label="Адрес проживания во Вьетнаме" 
        required
        helper="Если неизвестен — укажите город"
      >
        <input
          type="text"
          value={formData.vietnamAddress || ''}
          onChange={(e) => updateFormData({ vietnamAddress: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Ханой или адрес отеля"
        />
      </FormField>

      <FormField 
        label="Если были во Вьетнаме за последний год" 
        helper="Укажите даты и цель"
      >
        <textarea
          value={formData.vietnamPreviousVisits || ''}
          onChange={(e) => updateFormData({ vietnamPreviousVisits: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          placeholder="Нет"
        />
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
