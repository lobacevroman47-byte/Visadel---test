import { Mail, Phone, Send } from 'lucide-react';
import { ApplicationData } from '../ApplicationForm';

interface Step4Props {
  data: ApplicationData;
  onChange: (data: ApplicationData) => void;
  onNext: () => void;
}

export default function Step4Contact({ data, onChange, onNext }: Step4Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!data.email || !data.phone || !data.telegramLogin) {
      alert('Пожалуйста, заполните все контактные данные');
      return;
    }
    
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl mb-4 text-gray-900">Контактные данные</h2>
        <p className="text-sm text-gray-500 mb-6">
          Мы свяжемся с вами для уточнения деталей и отправки готовой визы
        </p>
      </div>

      <div>
        <label className="block text-sm mb-2 text-gray-700">
          <Mail className="w-4 h-4 inline mr-1" />
          E-mail <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={data.email}
          onChange={(e) => onChange({ ...data, email: e.target.value })}
          placeholder="example@mail.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm mb-2 text-gray-700">
          <Phone className="w-4 h-4 inline mr-1" />
          Номер телефона <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={data.phone}
          onChange={(e) => onChange({ ...data, phone: e.target.value })}
          placeholder="+7 (999) 123-45-67"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm mb-2 text-gray-700">
          <Send className="w-4 h-4 inline mr-1" />
          Логин в Telegram <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.telegramLogin}
          onChange={(e) => onChange({ ...data, telegramLogin: e.target.value })}
          placeholder="@username"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Начните с символа @
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-sm text-green-900">
          🔒 Ваши данные в безопасности и не будут переданы третьим лицам
        </p>
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
