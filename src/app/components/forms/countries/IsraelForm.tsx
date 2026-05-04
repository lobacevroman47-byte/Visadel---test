import { useState } from 'react';
import type { FormData } from '../../ApplicationForm';
import FormField from '../FormField';

interface IsraelFormProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
}

export default function IsraelForm({ formData, updateFormData, onNext }: IsraelFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.citizenship) newErrors.citizenship = 'Обязательное поле';
    if (!formData.arrivalDate) newErrors.arrivalDate = 'Обязательное поле';

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

      <FormField label="Дата прилёта" required error={errors.arrivalDate}>
        <input
          type="date"
          value={formData.arrivalDate || ''}
          onChange={(e) => updateFormData({ arrivalDate: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </FormField>

      <FormField label="Аэропорт прилёта" required>
        <input
          type="text"
          value={formData.arrivalAirport || ''}
          onChange={(e) => updateFormData({ arrivalAirport: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Тель-Авив (TLV)"
        />
      </FormField>

      <FormField label="Загранпаспорт биометрический?" required>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="biometricPassport"
              value="yes"
              checked={formData.biometricPassport === 'yes'}
              onChange={(e) => updateFormData({ biometricPassport: e.target.value })}
              className="w-4 h-4"
            />
            <span>Да</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="biometricPassport"
              value="no"
              checked={formData.biometricPassport === 'no'}
              onChange={(e) => updateFormData({ biometricPassport: e.target.value })}
              className="w-4 h-4"
            />
            <span>Нет</span>
          </label>
        </div>
      </FormField>

      <FormField label="Второе гражданство?" required>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="secondCitizenship"
              value="yes"
              checked={formData.secondCitizenship === 'yes'}
              onChange={(e) => updateFormData({ secondCitizenship: e.target.value })}
              className="w-4 h-4"
            />
            <span>Да</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="secondCitizenship"
              value="no"
              checked={formData.secondCitizenship === 'no'}
              onChange={(e) => updateFormData({ secondCitizenship: e.target.value })}
              className="w-4 h-4"
            />
            <span>Нет</span>
          </label>
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

      <FormField label="Домашний адрес" required>
        <textarea
          value={formData.homeAddress || ''}
          onChange={(e) => updateFormData({ homeAddress: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          placeholder="г. Москва, ул. Ленина, д. 1, кв. 10"
        />
      </FormField>

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
