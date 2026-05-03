import { useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import type { Country } from '../../App';
import type { FormData } from '../ApplicationForm';
import FormField from './FormField';

interface Step5Props {
  country: Country;
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step5Photos({ country, formData, updateFormData, onNext, onPrev }: Step5Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFileChange = (field: string, file: File | null) => {
    updateFormData({ [field]: file });
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.photoFace) {
      newErrors.photoFace = 'Обязательное поле';
    }

    if (!formData.photoPassport) {
      newErrors.photoPassport = 'Обязательное поле';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onNext();
  };

  return (
    <div>
      <h2 className="mb-6">Загрузка фото</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-yellow-50 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-900">
            <p className="mb-1">⚠️ Важные требования к фотографиям:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Фото лица: светлый фон, лицо занимает ~80% кадра, без очков</li>
              <li>Фото паспорта: вся информация читаема, срок действия ≥ 6 месяцев</li>
              <li>Форматы: JPG, PNG, PDF</li>
              <li>Максимальный размер: 5MB на файл</li>
            </ul>
          </div>
        </div>

        <FormField 
          label="Фото лица" 
          required
          error={errors.photoFace}
        >
          <div className={`border-2 border-dashed rounded-lg p-6 hover:border-blue-400 transition-colors ${
            errors.photoFace ? 'border-red-300' : 'border-gray-300'
          }`}>
            <label className="flex flex-col items-center cursor-pointer">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">
                {formData.photoFace ? '✓ Файл выбран' : 'Нажмите для загрузки или перетащите файл'}
              </span>
              <span className="text-xs text-gray-500 mt-1">JPG, PNG, PDF (макс. 5MB)</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => handleFileChange('photoFace', e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>
          {formData.photoFace && (
            <p className="text-sm text-green-600 mt-2">✓ Фото загружено</p>
          )}
        </FormField>

        <FormField 
          label="Фото загранпаспорта" 
          required
          error={errors.photoPassport}
        >
          <div className={`border-2 border-dashed rounded-lg p-6 hover:border-blue-400 transition-colors ${
            errors.photoPassport ? 'border-red-300' : 'border-gray-300'
          }`}>
            <label className="flex flex-col items-center cursor-pointer">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">
                {formData.photoPassport ? '✓ Файл выбран' : 'Нажмите для загрузки или перетащите файл'}
              </span>
              <span className="text-xs text-gray-500 mt-1">JPG, PNG, PDF (макс. 5MB)</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => handleFileChange('photoPassport', e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>
          {formData.photoPassport && (
            <p className="text-sm text-green-600 mt-2">✓ Фото загружено</p>
          )}
        </FormField>

        <FormField 
          label="Фото предыдущей визы и штампов" 
          helper="Если есть предыдущие визы или штампы страны посещения"
        >
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
            <label className="flex flex-col items-center cursor-pointer">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">
                {formData.photoVisa ? '✓ Файл выбран' : 'Нажмите для загрузки или перетащите файл'}
              </span>
              <span className="text-xs text-gray-500 mt-1">JPG, PNG, PDF (макс. 5MB)</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => handleFileChange('photoVisa', e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>
          {formData.photoVisa && (
            <p className="text-sm text-green-600 mt-2">✓ Фото загружено</p>
          )}
        </FormField>

        {formData.dualCitizenship === 'yes' && (
          <FormField 
            label="Фото второго паспорта" 
            required
            helper="Требуется при наличии двойного гражданства"
          >
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
              <label className="flex flex-col items-center cursor-pointer">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  {formData.photoSecondPassport ? '✓ Файл выбран' : 'Нажмите для загрузки или перетащите файл'}
                </span>
                <span className="text-xs text-gray-500 mt-1">JPG, PNG, PDF (макс. 5MB)</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => handleFileChange('photoSecondPassport', e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
            {formData.photoSecondPassport && (
              <p className="text-sm text-green-600 mt-2">✓ Фото загружено</p>
            )}
          </FormField>
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
          onClick={handleSubmit}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}
