import { useState } from 'react';
import { ChevronLeft, Send, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface PartnerApplicationFormProps {
  onBack: () => void;
  onSubmit: () => void;
}

export default function PartnerApplicationForm({ onBack, onSubmit }: PartnerApplicationFormProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    telegram: '',
    email: '',
    phone: '',
    platformUrl: '',
    audienceTheme: '',
    subscribersCount: '',
    comment: '',
    agreeToTerms: false,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // Check if application already exists
  const existingApplication = JSON.parse(localStorage.getItem('partnerApplication') || 'null');

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Укажите ФИО';
    }
    if (!formData.telegram.trim()) {
      newErrors.telegram = 'Укажите Telegram username';
    }
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Укажите корректный email';
    }
    if (!formData.platformUrl.trim()) {
      newErrors.platformUrl = 'Укажите ссылку на площадку';
    }
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'Необходимо согласие с условиями';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      alert('Пожалуйста, заполните все обязательные поля');
      return;
    }

    const application = {
      ...formData,
      status: 'pending', // pending, approved, rejected
      submittedAt: new Date().toISOString(),
    };

    localStorage.setItem('partnerApplication', JSON.stringify(application));
    alert('Заявка отправлена! Мы рассмотрим её в ближайшее время.');
    onSubmit();
  };

  if (existingApplication) {
    const statusConfig = {
      pending: {
        icon: Clock,
        color: 'text-yellow-600',
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        title: 'На рассмотрении',
        message: 'Ваша заявка находится на рассмотрении. Мы свяжемся с вами в ближайшее время.',
      },
      approved: {
        icon: CheckCircle2,
        color: 'text-green-600',
        bg: 'bg-green-50',
        border: 'border-green-200',
        title: 'Одобрено',
        message: 'Поздравляем! Ваша заявка одобрена. Теперь вы партнёр Visadel Agency!',
      },
      rejected: {
        icon: XCircle,
        color: 'text-red-600',
        bg: 'bg-red-50',
        border: 'border-red-200',
        title: 'Отклонено',
        message: 'К сожалению, ваша заявка отклонена. Вы можете подать новую заявку позже.',
      },
    };

    const config = statusConfig[existingApplication.status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        <div className="bg-gradient-to-r from-[#0D47A1] to-[#4F2FE6] text-white p-6 sticky top-0 z-10 shadow-lg">
          <div className="max-w-2xl mx-auto">
            <button onClick={onBack} className="mb-4 flex items-center gap-2 hover:opacity-80 transition">
              <ChevronLeft className="w-5 h-5" />
              Назад
            </button>
            <h1 className="text-2xl mb-1">Заявка на партнёрство</h1>
            <p className="text-[#E3F2FD] text-sm">Статус вашей заявки</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4">
          <div className={`${config.bg} border ${config.border} rounded-2xl p-6`}>
            <div className="flex items-start gap-4">
              <Icon className={`w-12 h-12 ${config.color}`} />
              <div>
                <h2 className={`text-2xl mb-2 ${config.color}`}>{config.title}</h2>
                <p className="text-gray-700 mb-4">{config.message}</p>
                
                <div className="bg-white rounded-xl p-4 mb-4">
                  <h3 className="text-gray-800 mb-2">Детали заявки:</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p><strong>ФИО:</strong> {existingApplication.fullName}</p>
                    <p><strong>Email:</strong> {existingApplication.email}</p>
                    <p><strong>Telegram:</strong> @{existingApplication.telegram}</p>
                    <p><strong>Площадка:</strong> {existingApplication.platformUrl}</p>
                    {existingApplication.subscribersCount && (
                      <p><strong>Подписчики:</strong> {existingApplication.subscribersCount}</p>
                    )}
                    <p><strong>Дата подачи:</strong> {new Date(existingApplication.submittedAt).toLocaleDateString('ru-RU')}</p>
                  </div>
                </div>

                {existingApplication.status === 'rejected' && (
                  <button
                    onClick={() => {
                      localStorage.removeItem('partnerApplication');
                      window.location.reload();
                    }}
                    className="bg-[#3B5BFF] text-white px-6 py-3 rounded-[16px] hover:bg-[#4F2FE6] transition"
                  >
                    Подать новую заявку
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      <div className="bg-gradient-to-r from-[#0D47A1] to-[#4F2FE6] text-white p-6 sticky top-0 z-10 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <button onClick={onBack} className="mb-4 flex items-center gap-2 hover:opacity-80 transition">
            <ChevronLeft className="w-5 h-5" />
            Назад
          </button>
          <h1 className="text-2xl mb-1">Заявка на партнёрство</h1>
          <p className="text-[#E3F2FD] text-sm">Заполните форму для получения статуса партнёра</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">
          {/* Full Name */}
          <div>
            <label className="block mb-2 text-[#212121]">
              ФИО
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className={`w-full px-4 py-3 border rounded-[16px] focus:outline-none ${
                errors.fullName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Иванов Иван Иванович"
            />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
          </div>

          {/* Telegram */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Telegram @username
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.telegram}
              onChange={(e) => setFormData({ ...formData, telegram: e.target.value.replace('@', '') })}
              className={`w-full px-4 py-3 border rounded-[16px] focus:outline-none ${
                errors.telegram ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="username"
            />
            {errors.telegram && <p className="text-red-500 text-xs mt-1">{errors.telegram}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Email
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full px-4 py-3 border rounded-[16px] focus:outline-none ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="example@mail.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Номер телефона
              <span className="text-gray-400 text-sm ml-1">(желательно)</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-[16px] focus:outline-none"
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          {/* Platform URL */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Ссылка на основную площадку
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="url"
              value={formData.platformUrl}
              onChange={(e) => setFormData({ ...formData, platformUrl: e.target.value })}
              className={`w-full px-4 py-3 border rounded-[16px] focus:outline-none ${
                errors.platformUrl ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="https://instagram.com/username"
            />
            {errors.platformUrl && <p className="text-red-500 text-xs mt-1">{errors.platformUrl}</p>}
          </div>

          {/* Audience Theme */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Тематика аудитории
            </label>
            <input
              type="text"
              value={formData.audienceTheme}
              onChange={(e) => setFormData({ ...formData, audienceTheme: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-[16px] focus:outline-none"
              placeholder="Путешествия, лайфстайл, образование..."
            />
          </div>

          {/* Subscribers Count */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Примерное количество подписчиков
            </label>
            <input
              type="number"
              value={formData.subscribersCount}
              onChange={(e) => setFormData({ ...formData, subscribersCount: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-[16px] focus:outline-none"
              placeholder="10000"
            />
          </div>

          {/* Comment */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Комментарий
              <span className="text-gray-400 text-sm ml-1">(опционально)</span>
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-[16px] focus:outline-none min-h-[100px]"
              placeholder="Расскажите о себе и почему хотите стать партнёром..."
            />
          </div>

          {/* Agree to Terms */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                className="mt-1 w-5 h-5 text-[#3B5BFF] rounded focus:ring-[#3B5BFF]"
              />
              <span className={`text-sm ${errors.agreeToTerms ? 'text-red-500' : 'text-gray-700'}`}>
                Я согласен с условиями партнёрской программы и обязуюсь соблюдать правила сотрудничества
                <span className="text-red-500 ml-1">*</span>
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            className="w-full vd-grad text-white py-4 rounded-2xl active:scale-[0.98] transition font-bold flex items-center justify-center gap-2 vd-shadow-cta"
          >
            <Send className="w-5 h-5" />
            Отправить заявку
          </button>
        </div>
      </div>
    </div>
  );
}
