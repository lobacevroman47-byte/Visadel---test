import { useState } from 'react';
import type { FormData } from '../../ApplicationForm';
import FormField from '../FormField';

interface CambodiaFormProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
}

export default function CambodiaForm({ formData, updateFormData, onNext }: CambodiaFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.entryDate) newErrors.entryDate = 'Обязательное поле';
    if (!formData.liveAddress) newErrors.liveAddress = 'Обязательное поле';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField label="Ожидаемая дата въезда" required error={errors.entryDate}>
        <input
          type="date"
          value={formData.entryDate || ''}
          onChange={(e) => updateFormData({ entryDate: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </FormField>

      <FormField label="Адрес проживания" required error={errors.liveAddress}>
        <textarea
          value={formData.liveAddress || ''}
          onChange={(e) => updateFormData({ liveAddress: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          placeholder="г. Москва, ул. Ленина, д. 1, кв. 10"
        />
      </FormField>

      <FormField label="Предполагаемый адрес проживания в Камбодже" required>
        <textarea
          value={formData.cambodiaAddress || ''}
          onChange={(e) => updateFormData({ cambodiaAddress: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          placeholder="Пномпень, название отеля или адрес"
        />
      </FormField>

      <FormField label="Порт въезда" required>
        <select
          value={formData.entryPort || ''}
          onChange={(e) => updateFormData({ entryPort: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Выберите</option>
          <option value="phnompenh">Пномпень (PNH)</option>
          <option value="siemreap">Сиемреап (REP)</option>
          <option value="bavet">Бавет (наземный)</option>
          <option value="poipet">Пойпет (наземный)</option>
          <option value="other">Другой</option>
        </select>
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
