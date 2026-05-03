import { useState } from 'react';
import type { FormData } from '../../ApplicationForm';
import FormField from '../FormField';

interface SriLankaFormProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
}

export default function SriLankaForm({ formData, updateFormData, onNext }: SriLankaFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isExtension, setIsExtension] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.citizenship) newErrors.citizenship = 'Обязательное поле';
    if (!formData.birthCountry) newErrors.birthCountry = 'Обязательное поле';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <p className="text-sm text-blue-900">Выберите тип заявки:</p>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="applicationType"
              value="new"
              checked={!isExtension}
              onChange={() => setIsExtension(false)}
              className="w-4 h-4"
            />
            <span>Новая виза (ETA)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="applicationType"
              value="extension"
              checked={isExtension}
              onChange={() => setIsExtension(true)}
              className="w-4 h-4"
            />
            <span>Продление пребывания</span>
          </label>
        </div>
      </div>

      <FormField label="Гражданство" required error={errors.citizenship}>
        <input
          type="text"
          value={formData.citizenship || ''}
          onChange={(e) => updateFormData({ citizenship: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Россия"
        />
      </FormField>

      <FormField 
        label="Страна рождения" 
        required 
        helper="Если СССР — пишите Россия"
        error={errors.birthCountry}
      >
        <input
          type="text"
          value={formData.birthCountry || ''}
          onChange={(e) => updateFormData({ birthCountry: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Россия"
        />
      </FormField>

      {!isExtension ? (
        <>
          <FormField label="Страна пребывания последние 14 дней" required>
            <input
              type="text"
              value={formData.lastCountry || ''}
              onChange={(e) => updateFormData({ lastCountry: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Россия"
            />
          </FormField>

          <FormField label="Предполагаемая дата прибытия" required>
            <input
              type="date"
              value={formData.arrivalDate || ''}
              onChange={(e) => updateFormData({ arrivalDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </FormField>

          <FormField 
            label="Аэропорт вылета" 
            helper="Если неизвестно — оставьте пустым"
          >
            <input
              type="text"
              value={formData.departureAirport || ''}
              onChange={(e) => updateFormData({ departureAirport: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Москва (SVO)"
            />
          </FormField>

          <FormField 
            label="Авиакомпания/судно" 
            helper="Если неизвестно — оставьте пустым"
          >
            <input
              type="text"
              value={formData.airline || ''}
              onChange={(e) => updateFormData({ airline: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Aeroflot"
            />
          </FormField>

          <FormField label="Адрес проживания" required>
            <textarea
              value={formData.liveAddress || ''}
              onChange={(e) => updateFormData({ liveAddress: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="г. Москва, ул. Ленина, д. 1, кв. 10"
            />
          </FormField>

          <FormField 
            label="Адрес проживания на Шри-Ланке" 
            helper="Если пока не знаете — оставьте пустым"
          >
            <textarea
              value={formData.sriLankaAddress || ''}
              onChange={(e) => updateFormData({ sriLankaAddress: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="Коломбо, название отеля или адрес"
            />
          </FormField>

          <FormField label="Действующая резидентская виза?" required>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="residentVisa"
                  value="yes"
                  checked={formData.residentVisa === 'yes'}
                  onChange={(e) => updateFormData({ residentVisa: e.target.value })}
                  className="w-4 h-4"
                />
                <span>Да</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="residentVisa"
                  value="no"
                  checked={formData.residentVisa === 'no'}
                  onChange={(e) => updateFormData({ residentVisa: e.target.value })}
                  className="w-4 h-4"
                />
                <span>Нет</span>
              </label>
            </div>
          </FormField>

          <FormField label="Находитесь ли уже на Шри-Ланке по действующему разрешению или продлению?" required>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="alreadyInSriLanka"
                  value="yes"
                  checked={formData.alreadyInSriLanka === 'yes'}
                  onChange={(e) => updateFormData({ alreadyInSriLanka: e.target.value })}
                  className="w-4 h-4"
                />
                <span>Да</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="alreadyInSriLanka"
                  value="no"
                  checked={formData.alreadyInSriLanka === 'no'}
                  onChange={(e) => updateFormData({ alreadyInSriLanka: e.target.value })}
                  className="w-4 h-4"
                />
                <span>Нет</span>
              </label>
            </div>
          </FormField>

          <FormField label="Многократная виза?" required>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="multipleVisa"
                  value="yes"
                  checked={formData.multipleVisa === 'yes'}
                  onChange={(e) => updateFormData({ multipleVisa: e.target.value })}
                  className="w-4 h-4"
                />
                <span>Да</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="multipleVisa"
                  value="no"
                  checked={formData.multipleVisa === 'no'}
                  onChange={(e) => updateFormData({ multipleVisa: e.target.value })}
                  className="w-4 h-4"
                />
                <span>Нет</span>
              </label>
            </div>
          </FormField>
        </>
      ) : (
        <>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-yellow-900 mb-2">Продление пребывания</h3>
            <p className="text-sm text-yellow-800">Для продления необходимы дополнительные документы</p>
          </div>

          <FormField label="Домашний адрес (прописка/последнее место проживания)" required>
            <textarea
              value={formData.homeAddress || ''}
              onChange={(e) => updateFormData({ homeAddress: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="г. Москва, ул. Ленина, д. 1, кв. 10"
            />
          </FormField>

          <FormField label="Дата прилёта на Шри-Ланку" required>
            <input
              type="date"
              value={formData.arrivalDateSL || ''}
              onChange={(e) => updateFormData({ arrivalDateSL: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </FormField>

          <FormField label="Адрес проживания на Шри-Ланке" required>
            <textarea
              value={formData.sriLankaAddress || ''}
              onChange={(e) => updateFormData({ sriLankaAddress: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="Коломбо, адрес"
            />
          </FormField>

          <FormField label="Мобильный номер телефона РФ" required>
            <input
              type="tel"
              value={formData.phoneRussia || ''}
              onChange={(e) => updateFormData({ phoneRussia: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+7 (999) 123-45-67"
            />
          </FormField>

          <FormField label="Мобильный номер телефона Шри-Ланка" required>
            <input
              type="tel"
              value={formData.phoneSriLanka || ''}
              onChange={(e) => updateFormData({ phoneSriLanka: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+94 71 234 5678"
            />
          </FormField>
        </>
      )}

      <button
        type="submit"
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Продолжить
      </button>
    </form>
  );
}
