import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Mail, Phone, MessageCircle } from 'lucide-react';
import { useTelegram } from '../../App';
import { useDialog } from '../shared/BrandDialog';
import { Button } from '../ui/brand';

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
  const { appUser } = useTelegram();
  const dialog = useDialog();
  const [formData, setFormData] = useState(data);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-prefill from Telegram account on first open (only fills empty fields)
  useEffect(() => {
    if (!appUser) return;
    setFormData(prev => {
      const next = { ...prev };
      if (!prev.telegram && appUser.username) next.telegram = appUser.username;
      if (!prev.phone && appUser.phone) next.phone = appUser.phone;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.telegram_id]);

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

  const validateAndNext = async () => {
    const newErrors: Record<string, string> = {};

    // Email: должна быть локальная часть + @ + домен с точкой (foo@bar.com).
    // Раньше .includes('@') пропускал «a@» — админ не мог связаться с клиентом.
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!formData.email || !EMAIL_RE.test(formData.email.trim())) {
      newErrors.email = 'Укажите корректный email (например ivan@mail.ru)';
    }
    // Телефон: минимум 10 цифр (с любыми разделителями: пробел, тире, +, скобки).
    // Раньше пропускал «1» — мусор в БД.
    const phoneDigits = (formData.phone ?? '').replace(/\D/g, '');
    if (!formData.phone || phoneDigits.length < 10) {
      newErrors.phone = 'Укажите корректный номер (минимум 10 цифр)';
    }
    if (!formData.telegram) {
      newErrors.telegram = 'Укажите логин в Telegram';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      await dialog.warning('Заполните все поля корректно');
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