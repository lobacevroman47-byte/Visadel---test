import { useState } from 'react';
import type { FormData } from '../../ApplicationForm';
import FormField from '../FormField';

interface KenyaFormProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
}

export default function KenyaForm({ formData, updateFormData, onNext }: KenyaFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.profession) newErrors.profession = 'Обязательное поле';
    if (!formData.arrivalDate) newErrors.arrivalDate = 'Обязательное поле';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField label="Профессия" required error={errors.profession}>
        <input
          type="text"
          value={formData.profession || ''}
          onChange={(e) => updateFormData({ profession: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Менеджер"
        />
      </FormField>

      <div className="space-y-4">
        <h3>Контакт на экстренный случай</h3>
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

      <FormField label="Дата прилёта" required error={errors.arrivalDate}>
        <input
          type="date"
          value={formData.arrivalDate || ''}
          onChange={(e) => updateFormData({ arrivalDate: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </FormField>

      <FormField label="Дата вылета" required>
        <input
          type="date"
          value={formData.departureDate || ''}
          onChange={(e) => updateFormData({ departureDate: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </FormField>

      <FormField label="Порт въезда" required>
        <select
          value={formData.entryPort || ''}
          onChange={(e) => updateFormData({ entryPort: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Выберите</option>
          <option value="nairobi">Найроби (NBO)</option>
          <option value="mombasa">Момбаса (MBA)</option>
          <option value="other">Другой</option>
        </select>
      </FormField>

      <FormField label="Авиакомпания и номер рейса" required>
        <input
          type="text"
          value={formData.arrivalFlight || ''}
          onChange={(e) => updateFormData({ arrivalFlight: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Emirates EK722"
        />
      </FormField>

      <FormField label="Страна прилёта" required>
        <input
          type="text"
          value={formData.arrivalCountry || ''}
          onChange={(e) => updateFormData({ arrivalCountry: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Россия"
        />
      </FormField>

      <FormField label="Порт выезда" required>
        <select
          value={formData.exitPort || ''}
          onChange={(e) => updateFormData({ exitPort: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Выберите</option>
          <option value="nairobi">Найроби (NBO)</option>
          <option value="mombasa">Момбаса (MBA)</option>
          <option value="other">Другой</option>
        </select>
      </FormField>

      <FormField label="Авиакомпания и номер рейса при выезде" required>
        <input
          type="text"
          value={formData.departureFlight || ''}
          onChange={(e) => updateFormData({ departureFlight: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Emirates EK723"
        />
      </FormField>

      <FormField label="Страна вылета" required>
        <input
          type="text"
          value={formData.departureCountry || ''}
          onChange={(e) => updateFormData({ departureCountry: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Россия"
        />
      </FormField>

      <FormField label="Планируемый адрес проживания" required>
        <textarea
          value={formData.kenyaAddress || ''}
          onChange={(e) => updateFormData({ kenyaAddress: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          placeholder="Найроби, название отеля или адрес"
        />
      </FormField>

      <FormField label="Страна рождения" required>
        <input
          type="text"
          value={formData.birthCountry || ''}
          onChange={(e) => updateFormData({ birthCountry: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Россия"
        />
      </FormField>

      <FormField label="Судимости за последние 5 лет?" required>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="criminalRecord"
              value="yes"
              checked={formData.criminalRecord === 'yes'}
              onChange={(e) => updateFormData({ criminalRecord: e.target.value })}
              className="w-4 h-4"
            />
            <span>Да</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="criminalRecord"
              value="no"
              checked={formData.criminalRecord === 'no'}
              onChange={(e) => updateFormData({ criminalRecord: e.target.value })}
              className="w-4 h-4"
            />
            <span>Нет</span>
          </label>
        </div>
      </FormField>

      <FormField label="Отказы во въезде в Кению?" required>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="entryRefusal"
              value="yes"
              checked={formData.entryRefusal === 'yes'}
              onChange={(e) => updateFormData({ entryRefusal: e.target.value })}
              className="w-4 h-4"
            />
            <span>Да</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="entryRefusal"
              value="no"
              checked={formData.entryRefusal === 'no'}
              onChange={(e) => updateFormData({ entryRefusal: e.target.value })}
              className="w-4 h-4"
            />
            <span>Нет</span>
          </label>
        </div>
      </FormField>

      <FormField label="Были ранее в Кении?" required>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="visitedBefore"
              value="yes"
              checked={formData.visitedBefore === 'yes'}
              onChange={(e) => updateFormData({ visitedBefore: e.target.value })}
              className="w-4 h-4"
            />
            <span>Да</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="visitedBefore"
              value="no"
              checked={formData.visitedBefore === 'no'}
              onChange={(e) => updateFormData({ visitedBefore: e.target.value })}
              className="w-4 h-4"
            />
            <span>Нет</span>
          </label>
        </div>
      </FormField>

      <FormField 
        label="Валюта более $5000?" 
        required
        helper="Если да — укажите сумму"
      >
        <div className="flex gap-4 mb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="largeCurrency"
              value="yes"
              checked={formData.largeCurrency === 'yes'}
              onChange={(e) => updateFormData({ largeCurrency: e.target.value })}
              className="w-4 h-4"
            />
            <span>Да</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="largeCurrency"
              value="no"
              checked={formData.largeCurrency === 'no'}
              onChange={(e) => updateFormData({ largeCurrency: e.target.value })}
              className="w-4 h-4"
            />
            <span>Нет</span>
          </label>
        </div>
        {formData.largeCurrency === 'yes' && (
          <input
            type="text"
            value={formData.currencyAmount || ''}
            onChange={(e) => updateFormData({ currencyAmount: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="$7000"
          />
        )}
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
