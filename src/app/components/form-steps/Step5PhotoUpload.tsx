import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Upload, X, CheckCircle2 } from 'lucide-react';
import { useDialog } from '../shared/BrandDialog';
import { Button } from '../ui/brand';

interface Step5Props {
  country: string;
  data: {
    facePhoto: File | null;
    passportPhoto: File | null;
    additionalPhotos: Record<string, File | null>;
  };
  additionalDocs: {
    hotelBooking: boolean;
    returnTicket: boolean;
  };
  onChange: (data: any) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step5PhotoUpload({ country, data, additionalDocs, onChange, onNext, onPrev }: Step5Props) {
  const dialog = useDialog();
  const [formData, setFormData] = useState(data);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    onChange(formData);
  }, [formData]);

  const handleFileChange = async (field: string, file: File | null, isAdditional: boolean = false) => {
    if (file && file.size > 5 * 1024 * 1024) {
      await dialog.warning('Размер файла не должен превышать 5MB');
      return;
    }

    if (isAdditional) {
      setFormData(prev => ({
        ...prev,
        additionalPhotos: {
          ...prev.additionalPhotos,
          [field]: file,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: file,
      }));
    }

    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateAndNext = async () => {
    const newErrors: Record<string, string> = {};

    if (!formData.facePhoto) {
      newErrors.facePhoto = 'Требуется фото лица';
    }
    if (!formData.passportPhoto) {
      newErrors.passportPhoto = 'Требуется фото загранпаспорта';
    }

    // Check country-specific required photos
    if (country === 'Камбоджа' && !additionalDocs.hotelBooking && !formData.additionalPhotos.hotelFile) {
      newErrors.hotelFile = 'Требуется файл бронирования отеля';
    }
    if (country === 'Кения') {
      if (!additionalDocs.hotelBooking && !formData.additionalPhotos.hotelFile) {
        newErrors.hotelFile = 'Требуется файл бронирования отеля';
      }
      if (!additionalDocs.returnTicket && !formData.additionalPhotos.ticketFile) {
        newErrors.ticketFile = 'Требуется файл билета';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      await dialog.warning('Загрузите все обязательные файлы');
      return;
    }

    onNext();
  };

  const getAdditionalPhotosForCountry = () => {
    const photos: Array<{ id: string; label: string; hint: string; required: boolean }> = [];

    switch (country) {
      case 'Индия':
        photos.push(
          { id: 'previousVisa', label: 'Фото предыдущей визы в Индию', hint: 'если была', required: false },
          { id: 'indiaStamps', label: 'Фото штампов, поставленных погранслужбой Индии', hint: 'если есть', required: false }
        );
        break;
      case 'Южная Корея':
        photos.push(
          { id: 'secondPassport', label: 'Фото второго паспорта', hint: 'если у вас двойное гражданство', required: false }
        );
        break;
      case 'Камбоджа':
        if (!additionalDocs.hotelBooking) {
          photos.push(
            { id: 'hotelFile', label: 'Файл бронирования отеля', hint: 'Обязательное поле', required: true }
          );
        }
        break;
      case 'Кения':
        if (!additionalDocs.hotelBooking) {
          photos.push(
            { id: 'hotelFile', label: 'Файл бронирования отеля', hint: 'если вы останавливаетесь у друзей и семьи, письмо-приглашение от хозяина', required: true }
          );
        }
        if (!additionalDocs.returnTicket) {
          photos.push(
            { id: 'ticketFile', label: 'Файл билета на самолет или круиз в Кению', hint: 'Обязательное поле', required: true }
          );
        }
        break;
    }

    return photos;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl mb-2 text-gray-800">Загрузка фото</h2>
        <p className="text-gray-600 text-sm">
          Максимальный размер файла: 5MB. Форматы: JPG, PNG, PDF
        </p>
      </div>

      <div className="space-y-6 mb-6">
        {/* Face Photo */}
        <FileUploadField
          label="Фото лица"
          required
          hint="🔸Светлый фон 🔸Можно на телефон 🔸Должно быть ~80% лица 🔸Без очков"
          file={formData.facePhoto}
          onChange={(file) => handleFileChange('facePhoto', file)}
          error={errors.facePhoto}
        />

        {/* Passport Photo */}
        <FileUploadField
          label="Фото загранпаспорта"
          required
          hint="❗❗Вся информация должна быть хорошо читаема, без бликов, пальцев и иных предметов ❗❗ Срок действия паспорта должен быть НЕ МЕНЕЕ 6 МЕСЯЦЕВ"
          file={formData.passportPhoto}
          onChange={(file) => handleFileChange('passportPhoto', file)}
          error={errors.passportPhoto}
        />

        {/* Country-specific photos */}
        {getAdditionalPhotosForCountry().map(photo => (
          <FileUploadField
            key={photo.id}
            label={photo.label}
            required={photo.required}
            hint={photo.hint}
            file={formData.additionalPhotos[photo.id] || null}
            onChange={(file) => handleFileChange(photo.id, file, true)}
            error={errors[photo.id]}
          />
        ))}
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          className="!py-4"
          onClick={onPrev}
          leftIcon={<ChevronLeft className="w-5 h-5" />}
        >
          Назад
        </Button>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="!py-4 !rounded-2xl"
          onClick={validateAndNext}
          rightIcon={<ChevronRight className="w-5 h-5" />}
        >
          Далее
        </Button>
      </div>
    </div>
  );
}

function FileUploadField({
  label,
  required,
  hint,
  file,
  onChange,
  error,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onChange(selectedFile);
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div>
      <label className="block mb-2 text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {hint && <p className="text-sm text-gray-500 mb-2">{hint}</p>}
      
      {!file ? (
        <label className={`block border-2 border-dashed rounded-xl p-6 cursor-pointer transition ${
          error ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
        }`}>
          <div className="flex flex-col items-center gap-2">
            <Upload className={`w-8 h-8 ${error ? 'text-red-500' : 'text-gray-400'}`} />
            <p className={`text-sm ${error ? 'text-red-600' : 'text-gray-600'}`}>
              Нажмите для загрузки файла
            </p>
            <p className="text-xs text-gray-400">JPG, PNG, PDF (макс. 5MB)</p>
          </div>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      ) : (
        <div className="border-2 border-green-500 bg-green-50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-sm text-gray-800">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="p-2 hover:bg-red-100 rounded-full transition"
            >
              <X className="w-5 h-5 text-red-500" />
            </button>
          </div>
        </div>
      )}
      
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}