import { User, Mail, Phone, MessageCircle, Edit } from 'lucide-react';

export default function ProfileTab() {
  // В реальном приложении эти данные будут браться из базы данных
  const userData = {
    name: 'Иван Иванов',
    email: 'ivan@example.com',
    phone: '+7 (999) 123-45-67',
    telegram: '@ivan_ivanov',
    registeredDate: '15 октября 2024',
    totalApplications: 3,
    completedApplications: 2,
    bonusBalance: 500,
  };

  return (
    <div className="space-y-6">
      {/* Профиль пользователя */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-blue-600" />
            </div>
            <div>
              <h2 className="mb-1">{userData.name}</h2>
              <p className="text-gray-600 text-sm">На платформе с {userData.registeredDate}</p>
            </div>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Edit className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 py-3 border-t border-gray-100">
            <Mail className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-gray-900">{userData.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-3 border-t border-gray-100">
            <Phone className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-600">Телефон</p>
              <p className="text-gray-900">{userData.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-3 border-t border-gray-100">
            <MessageCircle className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-600">Telegram</p>
              <p className="text-gray-900">{userData.telegram}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-600 text-sm mb-2">Всего заявок</p>
          <p className="text-blue-600 text-2xl">{userData.totalApplications}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-600 text-sm mb-2">Завершённых</p>
          <p className="text-green-600 text-2xl">{userData.completedApplications}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-600 text-sm mb-2">Бонусов</p>
          <p className="text-orange-600 text-2xl">{userData.bonusBalance}₽</p>
        </div>
      </div>
    </div>
  );
}
