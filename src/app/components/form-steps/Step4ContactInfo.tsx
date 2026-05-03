import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Mail, Phone, MessageCircle } from 'lucide-react';

interface Step4Props {
  data: {
    email: string;
    phone: string;
    telegram: string;
  };
  onChange: (data: any) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step4ContactInfo({ data, onChange, onNext, onPrev }: Step4Props) {
  const [formData, setFormData] = useState(data);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    onChange(formData);
  }, [formData]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateAndNext = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email || !formData.email.includes('@')) {
      newErrors.email = 'Укажите корректный email';
    }
    if (!formData.phone) {
      newErrors.phone = 'Укажите номер телефона';
    }
    if (!formData.telegram) {
      newErrors.telegram = 'Укажите логин в Telegram';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      alert('Пожалуйста, заполните все поля корректно');
      return;
    }

    onNext();
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl mb-2 text-gray-800">Контактные данные</h2>
        <p className="text-gray-600 text-sm">
          Укажите ваши контактные данные для связи
        </p>
      </div>

      <div className="space-y-5 mb-6">
        <div>
          <label className="block mb-2 text-gray-700 flex items-center gap-2">
            <Mail className="w-5 h-5 text-gray-500" />
            E-mail
            <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={formData.email || ''}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="example@email.com"
            className={`form-input ${errors.email ? 'border-red-500' : ''}`}
          />
          {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
        </div>

        <div>
          <label className="block mb-2 text-gray-700 flex items-center gap-2">
            <Phone className="w-5 h-5 text-gray-500" />
            Номер телефона
            <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="+7 (999) 123-45-67"
            className={`form-input ${errors.phone ? 'border-red-500' : ''}`}
          />
          {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
        </div>

        <div>
          <label className="block mb-2 text-gray-700 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-gray-500" />
            Логин в Telegram
            <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">@</span>
            <input
              type="text"
              value={formData.telegram || ''}
              onChange={(e) => updateField('telegram', e.target.value)}
              placeholder="username"
              className={`form-input flex-1 ${errors.telegram ? 'border-red-500' : ''}`}
            />
          </div>
          {errors.telegram && <p className="text-sm text-red-500 mt-1">{errors.telegram}</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onPrev}
          className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-xl hover:bg-gray-200 transition flex items-center justify-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" />
          Назад
        </button>
        <button
          onClick={validateAndNext}
          className="flex-1 bg-[#2196F3] text-white py-4 rounded-[16px] hover:bg-[#1E88E5] transition flex items-center justify-center gap-2"
        >
          Далее
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}