import { useState } from 'react';
import type { FormData } from '../../ApplicationForm';
import FormField from '../FormField';

interface PakistanFormProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
}

export default function PakistanForm({ formData, updateFormData, onNext }: PakistanFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.stayDays) newErrors.stayDays = 'Обязательное поле';
    if (!formData.entryPort) newErrors.entryPort = 'Обязательное поле';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField label="Сколько дней планируете находиться" required error={errors.stayDays}>
        <input
          type="number"
          value={formData.stayDays || ''}
          onChange={(e) => updateFormData({ stayDays: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="30"
          min="1"
          max="90"
        />
      </FormField>

      <FormField label="Планируемый порт въезда" required error={errors.entryPort}>
        <select
          value={formData.entryPort || ''}
          onChange={(e) => updateFormData({ entryPort: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Выберите</option>
          <option value="karachi">Карачи (KHI)</option>
          <option value="islamabad">Исламабад (ISB)</option>
          <option value="lahore">Лахор (LHE)</option>
          <option value="other">Другой</option>
        </select>
      </FormField>

      <FormField label="Планируемый порт выезда" required>
        <select
          value={formData.exitPort || ''}
          onChange={(e) => updateFormData({ exitPort: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Выберите</option>
          <option value="karachi">Карачи (KHI)</option>
          <option value="islamabad">Исламабад (ISB)</option>
          <option value="lahore">Лахор (LHE)</option>
          <option value="other">Другой</option>
        </select>
      </FormField>

      <FormField label="Дата пребывания" required>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="date"
            value={formData.stayDateFrom || ''}
            onChange={(e) => updateFormData({ stayDateFrom: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="date"
            value={formData.stayDateTo || ''}
            onChange={(e) => updateFormData({ stayDateTo: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </FormField>

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

      <div className="space-y-4">
        <h3>Данные отца</h3>
        <FormField label="Имя отца" required>
          <input
            type="text"
            value={formData.fatherName || ''}
            onChange={(e) => updateFormData({ fatherName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Иван Петрович"
          />
        </FormField>
      </div>

      <div className="space-y-4">
        <h3>Данные матери</h3>
        <FormField label="Имя матери" required>
          <input
            type="text"
            value={formData.motherName || ''}
            onChange={(e) => updateFormData({ motherName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Мария Ивановна"
          />
        </FormField>
      </div>

      <div className="space-y-4">
        <h3>Информация о месте работы</h3>
        <FormField label="Название компании" required>
          <input
            type="text"
            value={formData.companyName || ''}
            onChange={(e) => updateFormData({ companyName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="ООО 'Компания'"
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
        <FormField label="Адрес компании" required>
          <input
            type="text"
            value={formData.companyAddress || ''}
            onChange={(e) => updateFormData({ companyAddress: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="г. Москва, ул. Ленина, д. 1"
          />
        </FormField>
      </div>

      <FormField label="Планируемый адрес проживания" required>
        <textarea
          value={formData.pakistanAddress || ''}
          onChange={(e) => updateFormData({ pakistanAddress: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          placeholder="Карачи, название отеля или адрес"
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
