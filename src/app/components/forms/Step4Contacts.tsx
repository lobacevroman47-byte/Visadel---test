import { useState } from 'react';
import type { FormData } from '../ApplicationForm';
import FormField from './FormField';

interface Step4Props {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step4Contacts({ formData, updateFormData, onNext, onPrev }: Step4Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Обязательное поле';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Неверный формат email';
    }

    if (!formData.phone) {
      newErrors.phone = 'Обязательное поле';
    }

    if (!formData.telegram) {
      newErrors.telegram = 'Обязательное поле';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onNext();
  };

  return (
    <div>
      <h2 className="mb-6">Контактные данные</h2>
      
      <div className="space-y-6 mb-8">
        <FormField label="📩 E-mail" required error={errors.email}>
          <input
            type="email"
            value={formData.email || ''}
            onChange={(e) => updateFormData({ email: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="example@mail.com"
          />
        </FormField>

        <FormField label="📲 Номер телефона" required error={errors.phone}>
          <input
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => updateFormData({ phone: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="+7 (999) 123-45-67"
          />
        </FormField>

        <FormField label="💻 Логин в Telegram" required error={errors.telegram}>
          <input
            type="text"
            value={formData.telegram || ''}
            onChange={(e) => updateFormData({ telegram: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="@username"
          />
        </FormField>
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
          onClick={handleSubmit}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}
