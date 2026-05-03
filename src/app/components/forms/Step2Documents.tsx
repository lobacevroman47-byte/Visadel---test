import { Upload } from 'lucide-react';
import type { Country } from '../../App';
import type { FormData } from '../ApplicationForm';
import FormField from './FormField';

interface Step2Props {
  country: Country;
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step2Documents({ country, formData, updateFormData, onNext, onPrev }: Step2Props) {
  const handleFileChange = (field: string, file: File | null) => {
    updateFormData({ [field]: file });
  };

  return (
    <div>
      <h2 className="mb-6">Дополнительные документы</h2>
      
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-900">
            📌 Эти документы не обязательны, но они помогут при прохождении границы и ускорят процесс оформления визы.
          </p>
        </div>

        <FormField 
          label="🏨 Бронь отеля" 
          helper="Показывает где вы остановитесь, облегчает прохождение границы"
        >
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
            <label className="flex flex-col items-center cursor-pointer">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">
                {formData.hotelBooking ? 'Файл выбран' : 'Нажмите для загрузки или перетащите файл'}
              </span>
              <span className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (макс. 5MB)</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => handleFileChange('hotelBooking', e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>
          {formData.hotelBooking && (
            <p className="text-sm text-green-600 mt-2">✓ Файл загружен</p>
          )}
        </FormField>

        <FormField 
          label="✈️ Обратный билет" 
          helper="Показывает ваше намерение покинуть страну вовремя"
        >
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
            <label className="flex flex-col items-center cursor-pointer">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">
                {formData.returnTicket ? 'Файл выбран' : 'Нажмите для загрузки или перетащите файл'}
              </span>
              <span className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (макс. 5MB)</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => handleFileChange('returnTicket', e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>
          {formData.returnTicket && (
            <p className="text-sm text-green-600 mt-2">✓ Файл загружен</p>
          )}
        </FormField>
      </div>

      <div className="flex gap-3 mt-8">
        <button
          type="button"
          onClick={onPrev}
          className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Назад
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}
