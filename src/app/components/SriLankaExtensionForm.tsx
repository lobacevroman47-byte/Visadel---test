import { useState } from 'react';
import { ChevronLeft, Upload, CheckCircle2, CreditCard } from 'lucide-react';
import type { VisaOption } from '../App';

interface SriLankaExtensionFormProps {
  visa: VisaOption;
  onBack: () => void;
  onComplete: () => void;
}

interface ExtensionFormData {
  homeAddress: string;
  arrivalDate: string;
  sriLankaAddress: string;
  phoneRussia: string;
  phoneSriLanka: string;
  passportPhoto: File | null;
  facePhoto: File | null;
}

export default function SriLankaExtensionForm({ visa, onBack, onComplete }: SriLankaExtensionFormProps) {
  const [currentStep, setCurrentStep] = useState<'form' | 'payment'>('form');
  const [formData, setFormData] = useState<ExtensionFormData>({
    homeAddress: '',
    arrivalDate: '',
    sriLankaAddress: '',
    phoneRussia: '',
    phoneSriLanka: '',
    passportPhoto: null,
    facePhoto: null,
  });
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.homeAddress.trim()) {
      newErrors.homeAddress = 'Укажите домашний адрес';
    }
    if (!formData.arrivalDate) {
      newErrors.arrivalDate = 'Укажите дату прилёта';
    }
    if (!formData.sriLankaAddress.trim()) {
      newErrors.sriLankaAddress = 'Укажите адрес проживания на Шри-Ланке';
    }
    if (!formData.phoneRussia.trim()) {
      newErrors.phoneRussia = 'Укажите телефон в РФ';
    }
    if (!formData.phoneSriLanka.trim()) {
      newErrors.phoneSriLanka = 'Укажите телефон на Шри-Ланке';
    }
    if (!formData.passportPhoto) {
      newErrors.passportPhoto = 'Загрузите фото паспорта';
    }
    if (!formData.facePhoto) {
      newErrors.facePhoto = 'Загрузите ваше фото';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGoToPayment = () => {
    if (!validateForm()) {
      alert('Пожалуйста, заполните все обязательные поля');
      return;
    }
    setCurrentStep('payment');
    window.scrollTo(0, 0);
  };

  const handlePaymentComplete = () => {
    if (!paymentScreenshot) {
      alert('Пожалуйста, загрузите скриншот оплаты');
      return;
    }

    // Save application
    const applications = JSON.parse(localStorage.getItem('applications') || '[]');
    const newApplication = {
      id: Date.now().toString(),
      visa,
      totalPrice: visa.price,
      formData,
      status: 'pending_confirmation',
      createdAt: new Date().toISOString(),
      isExtension: true,
      paymentScreenshot: paymentScreenshot.name,
    };
    applications.push(newApplication);
    localStorage.setItem('applications', JSON.stringify(applications));

    alert('Спасибо! Ваша заявка на продление визы отправлена. Мы свяжемся с вами в ближайшее время.');
    onComplete();
  };

  const handleFileUpload = (field: 'passportPhoto' | 'facePhoto', file: File | null) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Размер файла не должен превышать 5MB');
        return;
      }
      setFormData(prev => ({ ...prev, [field]: file }));
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (currentStep === 'payment') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0D47A1] to-[#4F2FE6] text-white p-6 sticky top-0 z-10 shadow-lg">
          <div className="max-w-2xl mx-auto">
            <button onClick={() => setCurrentStep('form')} className="mb-4 flex items-center gap-2 hover:opacity-80 transition">
              <ChevronLeft className="w-5 h-5" />
              Назад
            </button>
            <h1 className="text-2xl mb-1">Оплата продления визы</h1>
            <p className="text-[#E3F2FD] text-sm">{visa.type}</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="mb-6">
              <h2 className="text-2xl mb-2 text-[#212121]">Оплата</h2>
              <p className="text-sm text-[#616161]">
                Переведите средства и загрузите скриншот
              </p>
            </div>

            {/* Payment Details */}
            <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-gray-100">
              <div className="flex items-start gap-3">
                <CreditCard className="w-6 h-6 text-[#3B5BFF] flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-[#212121] mb-2">Реквизиты для оплаты</h3>
                  <div className="space-y-1 text-sm text-[#212121]">
                    <p><span className="text-[#616161]">Номер карты:</span> 5536 9140 3834 6908</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-[#616161] mt-3">
                После оплаты обязательно загрузите скриншот перевода
              </p>
            </div>

            {/* Price Breakdown */}
            <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-gray-100">
              <h3 className="text-[#212121] mb-3">Детали оплаты</h3>
              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#616161]">{visa.type}</span>
                  <span className="text-[#212121]">{visa.price}₽</span>
                </div>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="text-[#212121]">Итого к оплате:</span>
                <span className="text-2xl text-[#3B5BFF]">{visa.price}₽</span>
              </div>
            </div>

            {/* Upload Screenshot */}
            <div className="mb-6">
              <label className="block mb-2 text-[#212121]">
                Скриншот оплаты
                <span className="text-red-500 ml-1">*</span>
              </label>
              {!paymentScreenshot ? (
                <label className="block border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-[#3B5BFF] hover:bg-[#E3F2FD] transition">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <p className="text-sm text-gray-600">Нажмите для загрузки скриншота</p>
                    <p className="text-xs text-gray-400">JPG, PNG (макс. 5MB)</p>
                  </div>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          alert('Размер файла не должен превышать 5MB');
                          return;
                        }
                        setPaymentScreenshot(file);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="border-2 border-[#10B981] bg-green-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-[#10B981]" />
                      <div>
                        <p className="text-sm text-gray-800">{paymentScreenshot.name}</p>
                        <p className="text-xs text-gray-500">
                          {(paymentScreenshot.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPaymentScreenshot(null)}
                      className="text-sm text-[#3B5BFF] hover:text-[#4F2FE6]"
                    >
                      Изменить
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={handlePaymentComplete}
              className="w-full bg-[#10B981] text-white py-4 rounded-[16px] hover:bg-[#00E676] hover:shadow-lg transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              Оплатил
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0D47A1] to-[#4F2FE6] text-white p-6 sticky top-0 z-10 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <button onClick={onBack} className="mb-4 flex items-center gap-2 hover:opacity-80 transition">
            <ChevronLeft className="w-5 h-5" />
            Назад
          </button>
          <h1 className="text-2xl mb-1">Продление визы</h1>
          <p className="text-[#E3F2FD] text-sm">{visa.type}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
          {/* Home Address */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Домашний адрес (прописка / последнее место проживания)
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.homeAddress || ''}
              onChange={(e) => setFormData({ ...formData, homeAddress: e.target.value })}
              className={`form-input ${errors.homeAddress ? 'border-red-500' : ''}`}
              placeholder="Россия, г. Москва, ул. Примерная, д. 1, кв. 1"
            />
            {errors.homeAddress && (
              <p className="text-red-500 text-xs mt-1">{errors.homeAddress}</p>
            )}
          </div>

          {/* Arrival Date */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Дата прилёта на Шри-Ланку
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="date"
              value={formData.arrivalDate || ''}
              onChange={(e) => setFormData({ ...formData, arrivalDate: e.target.value })}
              className={`form-input ${errors.arrivalDate ? 'border-red-500' : ''}`}
            />
            {errors.arrivalDate && (
              <p className="text-red-500 text-xs mt-1">{errors.arrivalDate}</p>
            )}
          </div>

          {/* Sri Lanka Address */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Адрес проживания на Шри-Ланке
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.sriLankaAddress || ''}
              onChange={(e) => setFormData({ ...formData, sriLankaAddress: e.target.value })}
              className={`form-input ${errors.sriLankaAddress ? 'border-red-500' : ''}`}
              placeholder="Отель или адрес проживания"
            />
            {errors.sriLankaAddress && (
              <p className="text-red-500 text-xs mt-1">{errors.sriLankaAddress}</p>
            )}
          </div>

          {/* Phone Russia */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Мобильный номер телефона в РФ
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="tel"
              value={formData.phoneRussia || ''}
              onChange={(e) => setFormData({ ...formData, phoneRussia: e.target.value })}
              className={`form-input ${errors.phoneRussia ? 'border-red-500' : ''}`}
              placeholder="+7 (999) 123-45-67"
            />
            {errors.phoneRussia && (
              <p className="text-red-500 text-xs mt-1">{errors.phoneRussia}</p>
            )}
          </div>

          {/* Phone Sri Lanka */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Мобильный номер телефона на Шри-Ланке
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="tel"
              value={formData.phoneSriLanka || ''}
              onChange={(e) => setFormData({ ...formData, phoneSriLanka: e.target.value })}
              className={`form-input ${errors.phoneSriLanka ? 'border-red-500' : ''}`}
              placeholder="+94 XX XXX XXXX"
            />
            {errors.phoneSriLanka && (
              <p className="text-red-500 text-xs mt-1">{errors.phoneSriLanka}</p>
            )}
          </div>

          {/* Passport Photo */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Фото загранпаспорта (без бликов, пальцев)
              <span className="text-red-500 ml-1">*</span>
            </label>
            {!formData.passportPhoto ? (
              <label className={`block border-2 border-dashed rounded-xl p-6 cursor-pointer hover:border-[#3B5BFF] hover:bg-[#E3F2FD] transition ${
                errors.passportPhoto ? 'border-red-500' : 'border-gray-300'
              }`}>
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <p className="text-sm text-gray-600">Нажмите для загрузки фото паспорта</p>
                  <p className="text-xs text-gray-400">JPG, PNG (макс. 5MB)</p>
                </div>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload('passportPhoto', e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="border-2 border-[#10B981] bg-green-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#10B981]" />
                    <div>
                      <p className="text-sm text-gray-800">{formData.passportPhoto.name}</p>
                      <p className="text-xs text-gray-500">
                        {(formData.passportPhoto.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleFileUpload('passportPhoto', null)}
                    className="text-sm text-[#3B5BFF] hover:text-[#4F2FE6]"
                  >
                    Изменить
                  </button>
                </div>
              </div>
            )}
            {errors.passportPhoto && (
              <p className="text-red-500 text-xs mt-1">{errors.passportPhoto}</p>
            )}
          </div>

          {/* Face Photo */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Фото Ваше на светлом фоне (как на паспорт)
              <span className="text-red-500 ml-1">*</span>
            </label>
            {!formData.facePhoto ? (
              <label className={`block border-2 border-dashed rounded-xl p-6 cursor-pointer hover:border-[#3B5BFF] hover:bg-[#E3F2FD] transition ${
                errors.facePhoto ? 'border-red-500' : 'border-gray-300'
              }`}>
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <p className="text-sm text-gray-600">Нажмите для загрузки вашего фото</p>
                  <p className="text-xs text-gray-400">JPG, PNG (макс. 5MB)</p>
                </div>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload('facePhoto', e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="border-2 border-[#10B981] bg-green-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#10B981]" />
                    <div>
                      <p className="text-sm text-gray-800">{formData.facePhoto.name}</p>
                      <p className="text-xs text-gray-500">
                        {(formData.facePhoto.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleFileUpload('facePhoto', null)}
                    className="text-sm text-[#3B5BFF] hover:text-[#4F2FE6]"
                  >
                    Изменить
                  </button>
                </div>
              </div>
            )}
            {errors.facePhoto && (
              <p className="text-red-500 text-xs mt-1">{errors.facePhoto}</p>
            )}
          </div>

          {/* Payment Info */}
          <div className="bg-[#E3F2FD] rounded-xl p-4 border border-[#D1E3F5]">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[#212121]">Стоимость продления:</span>
              <span className="text-2xl text-[#3B5BFF]">{visa.price}₽</span>
            </div>
            <p className="text-sm text-[#616161]">
              После проверки заявки вы перейдёте к оплате
            </p>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleGoToPayment}
            className="w-full bg-[#3B5BFF] text-white py-4 rounded-[16px] hover:bg-[#4F2FE6] transition"
          >
            Перейти к оплате
          </button>
        </div>
      </div>
    </div>
  );
}