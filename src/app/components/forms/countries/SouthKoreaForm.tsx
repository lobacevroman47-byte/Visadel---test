import { useState } from 'react';
import type { FormData } from '../../ApplicationForm';
import FormField from '../FormField';

interface SouthKoreaFormProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
}

export default function SouthKoreaForm({ formData, updateFormData, onNext }: SouthKoreaFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.visitPurpose) newErrors.visitPurpose = 'Обязательное поле';
    if (!formData.visitedKoreaBefore) newErrors.visitedKoreaBefore = 'Обязательное поле';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField label="Цель поездки" required error={errors.visitPurpose}>
        <select
          value={formData.visitPurpose || ''}
          onChange={(e) => updateFormData({ visitPurpose: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Выберите</option>
          <option value="tourism">Туризм</option>
          <option value="business">Бизнес</option>
          <option value="visiting">Посещение знакомых</option>
          <option value="transit">Транзит</option>
        </select>
      </FormField>

      <FormField label="Были ранее в Корее?" required error={errors.visitedKoreaBefore}>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="visitedKoreaBefore"
              value="yes"
              checked={formData.visitedKoreaBefore === 'yes'}
              onChange={(e) => updateFormData({ visitedKoreaBefore: e.target.value })}
              className="w-4 h-4"
            />
            <span>Да</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="visitedKoreaBefore"
              value="no"
              checked={formData.visitedKoreaBefore === 'no'}
              onChange={(e) => updateFormData({ visitedKoreaBefore: e.target.value })}
              className="w-4 h-4"
            />
            <span>Нет</span>
          </label>
        </div>
      </FormField>

      <FormField label="Двойное гражданство?" required>
        <div className="flex gap-4 mb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="dualCitizenship"
              value="yes"
              checked={formData.dualCitizenship === 'yes'}
              onChange={(e) => updateFormData({ dualCitizenship: e.target.value })}
              className="w-4 h-4"
            />
            <span>Да</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="dualCitizenship"
              value="no"
              checked={formData.dualCitizenship === 'no'}
              onChange={(e) => updateFormData({ dualCitizenship: e.target.value })}
              className="w-4 h-4"
            />
            <span>Нет</span>
          </label>
        </div>
        {formData.dualCitizenship === 'yes' && (
          <p className="text-sm text-gray-600">Потребуется фото второго паспорта на шаге 5</p>
        )}
      </FormField>

      <FormField label="Судимости?" required>
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

      <FormField label="Опасные заболевания?" required>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="diseases"
              value="yes"
              checked={formData.diseases === 'yes'}
              onChange={(e) => updateFormData({ diseases: e.target.value })}
              className="w-4 h-4"
            />
            <span>Да</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="diseases"
              value="no"
              checked={formData.diseases === 'no'}
              onChange={(e) => updateFormData({ diseases: e.target.value })}
              className="w-4 h-4"
            />
            <span>Нет</span>
          </label>
        </div>
      </FormField>

      <FormField 
        label="Знакомые в Корее?" 
        required
        helper="Если есть — укажите ФИО и телефон"
      >
        <textarea
          value={formData.koreaContacts || ''}
          onChange={(e) => updateFormData({ koreaContacts: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          placeholder="Нет"
        />
      </FormField>

      <FormField 
        label="Сопровождающие лица" 
        required
        helper="Если есть — укажите ФИО, дату рождения, степень родства"
      >
        <textarea
          value={formData.companions || ''}
          onChange={(e) => updateFormData({ companions: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          placeholder="Нет"
        />
      </FormField>

      <div className="space-y-4">
        <h3>Работа</h3>
        <FormField 
          label="Название компании" 
          required
          helper="Если безработный — напишите 'нет'"
        >
          <input
            type="text"
            value={formData.companyName || ''}
            onChange={(e) => updateFormData({ companyName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="ООО 'Компания' или 'нет'"
          />
        </FormField>
        {formData.companyName && formData.companyName !== 'нет' && (
          <>
            <FormField label="Должность">
              <input
                type="text"
                value={formData.position || ''}
                onChange={(e) => updateFormData({ position: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Менеджер"
              />
            </FormField>
            <FormField label="Телефон компании">
              <input
                type="tel"
                value={formData.companyPhone || ''}
                onChange={(e) => updateFormData({ companyPhone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+7 (495) 123-45-67"
              />
            </FormField>
            <FormField label="Зарплата (примерно)">
              <input
                type="text"
                value={formData.salary || ''}
                onChange={(e) => updateFormData({ salary: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="50000 ₽"
              />
            </FormField>
          </>
        )}
      </div>

      <FormField label="Количество стран, посещённых за всё время" required>
        <input
          type="number"
          value={formData.countriesVisited || ''}
          onChange={(e) => updateFormData({ countriesVisited: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="10"
        />
      </FormField>

      <FormField label="Даты поездки в Корею" required>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="date"
            value={formData.tripDateFrom || ''}
            onChange={(e) => updateFormData({ tripDateFrom: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="date"
            value={formData.tripDateTo || ''}
            onChange={(e) => updateFormData({ tripDateTo: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </FormField>

      <div className="space-y-4">
        <h3>Адрес проживания в Корее</h3>
        <FormField label="Индекс" required>
          <input
            type="text"
            value={formData.koreaPostalCode || ''}
            onChange={(e) => updateFormData({ koreaPostalCode: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="04524"
          />
        </FormField>
        <FormField label="Телефон" required>
          <input
            type="tel"
            value={formData.koreaPhone || ''}
            onChange={(e) => updateFormData({ koreaPhone: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="+82 2 1234 5678"
          />
        </FormField>
        <FormField label="Название отеля" required>
          <input
            type="text"
            value={formData.hotelName || ''}
            onChange={(e) => updateFormData({ hotelName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Hotel Lotte"
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
