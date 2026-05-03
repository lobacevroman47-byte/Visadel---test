import { useState } from 'react';
import { Upload, X, Camera, FileText, AlertCircle } from 'lucide-react';
import { ApplicationData } from '../ApplicationForm';

interface Step5Props {
  data: ApplicationData;
  onChange: (data: ApplicationData) => void;
  onNext: () => void;
}

export default function Step5Photos({ data, onChange, onNext }: Step5Props) {
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [passportPreview, setPassportPreview] = useState<string | null>(null);

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Размер файла не должен превышать 5 МБ');
        return;
      }
      onChange({ ...data, photoFace: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setFacePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePassportUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Размер файла не должен превышать 5 МБ');
        return;
      }
      onChange({ ...data, photoPassport: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPassportPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFacePhoto = () => {
    onChange({ ...data, photoFace: null });
    setFacePreview(null);
  };

  const removePassportPhoto = () => {
    onChange({ ...data, photoPassport: null });
    setPassportPreview(null);
  };

  const handlePreviousVisaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Размер файла не должен превышать 5 МБ');
        return;
      }
      onChange({ ...data, photoPreviousVisa: file });
    }
  };

  const removePreviousVisaPhoto = () => {
    onChange({ ...data, photoPreviousVisa: null });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!data.photoFace || !data.photoPassport) {
      alert('Пожалуйста, загрузите обязательные фотографии');
      return;
    }
    
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl mb-4 text-gray-900">Загрузка фотографий</h2>
        <p className="text-sm text-gray-500 mb-6">
          Загрузите качественные фотографии для оформления визы
        </p>
      </div>

      {/* Requirements */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-900 mb-2">
              <strong>Требования к фотографиям:</strong>
            </p>
            <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
              <li>Формат: JPG или PNG</li>
              <li>Максимальный размер: 5 МБ</li>
              <li>Фото должно быть четким и хорошо освещенным</li>
              <li>Фото лица - на светлом фоне, анфас</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Face Photo */}
      <div>
        <label className="block text-sm mb-3 text-gray-700">
          <Camera className="w-4 h-4 inline mr-1" />
          Фото лица
        </label>
        
        {!facePreview ? (
          <label className="block">
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleFaceUpload}
              className="hidden"
            />
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700 mb-1">Нажмите для загрузки</p>
              <p className="text-sm text-gray-500">JPG, PNG (макс. 5MB)</p>
            </div>
          </label>
        ) : (
          <div className="relative">
            <img
              src={facePreview}
              alt="Face preview"
              className="w-full h-64 object-cover rounded-xl"
            />
            <button
              type="button"
              onClick={removeFacePhoto}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Passport Photo */}
      <div>
        <label className="block text-sm mb-3 text-gray-700">
          <FileText className="w-4 h-4 inline mr-1" />
          Фото загранпаспорта (разворот с фото)
        </label>
        
        {!passportPreview ? (
          <label className="block">
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={handlePassportUpload}
              className="hidden"
            />
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700 mb-1">Нажмите для загрузки</p>
              <p className="text-sm text-gray-500">JPG, PNG (макс. 5MB)</p>
            </div>
          </label>
        ) : (
          <div className="relative">
            <img
              src={passportPreview}
              alt="Passport preview"
              className="w-full h-64 object-cover rounded-xl"
            />
            <button
              type="button"
              onClick={removePassportPhoto}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Previous Visa Photo (Optional) */}
      <div>
        <label className="block text-sm mb-3 text-gray-700">
          <FileText className="w-4 h-4 inline mr-1" />
          Фото предыдущей визы и штампов (необязательно)
        </label>
        
        {!data.photoPreviousVisa ? (
          <label className="block">
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={handlePreviousVisaUpload}
              className="hidden"
            />
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-700 mb-1">Нажмите для загрузки</p>
              <p className="text-xs text-gray-500">Если есть предыдущие визы</p>
            </div>
          </label>
        ) : (
          <div className="relative">
            <div className="border-2 border-green-200 bg-green-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-900">{data.photoPreviousVisa.name}</span>
                </div>
                <button
                  type="button"
                  onClick={removePreviousVisaPhoto}
                  className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl hover:opacity-90 transition-opacity"
      >
        Продолжить
      </button>
    </form>
  );
}
