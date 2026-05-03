import { useState, useEffect } from 'react';
import { Calendar, Gift, Flame, TrendingUp, Shield } from 'lucide-react';

interface ProfileTabProps {
  onOpenInfluencerDashboard?: () => void;
  onOpenAdmin?: () => void;
}

export default function ProfileTab({ onOpenInfluencerDashboard, onOpenAdmin }: ProfileTabProps = {}) {
  const [userData, setUserData] = useState({
    name: 'Пользователь',
    email: '',
    phone: '',
    telegram: '',
    bonusBalance: 0,
    consecutiveDays: 0,
    lastCheckIn: '',
    totalCheckIns: 0,
  });
  const [adminClickCount, setAdminClickCount] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('userData');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure numeric fields are numbers, not NaN or undefined
      setUserData({
        name: parsed.name || 'Пользователь',
        email: parsed.email || '',
        phone: parsed.phone || '',
        telegram: parsed.telegram || '',
        bonusBalance: Number(parsed.bonusBalance) || 0,
        consecutiveDays: Number(parsed.consecutiveDays) || 0,
        lastCheckIn: parsed.lastCheckIn || '',
        totalCheckIns: Number(parsed.totalCheckIns) || 0,
      });
    } else {
      // Initialize user data
      const initial = {
        name: 'Пользователь',
        email: '',
        phone: '',
        telegram: '',
        bonusBalance: 0,
        consecutiveDays: 0,
        lastCheckIn: '',
        totalCheckIns: 0,
      };
      localStorage.setItem('userData', JSON.stringify(initial));
      setUserData(initial);
    }
  }, []);

  const handleDailyCheckIn = () => {
    const today = new Date().toDateString();
    
    if (userData.lastCheckIn === today) {
      alert('Вы уже получили бонус за сегодня!');
      return;
    }

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let newConsecutiveDays = userData.consecutiveDays;
    let bonus = 1;

    if (userData.lastCheckIn === yesterday) {
      newConsecutiveDays += 1;
    } else {
      newConsecutiveDays = 1;
    }

    // Special bonuses
    if (newConsecutiveDays === 7) {
      bonus = 4; // 1 + 3 bonus
      alert('Поздравляем! 7 дней подряд - бонус +3₽!');
    } else if (newConsecutiveDays === 30) {
      bonus = 11; // 1 + 10 bonus
      alert('Невероятно! Месяц активности - бонус +10₽!');
    }

    const newUserData = {
      ...userData,
      bonusBalance: userData.bonusBalance + bonus,
      consecutiveDays: newConsecutiveDays,
      lastCheckIn: today,
      totalCheckIns: userData.totalCheckIns + 1,
    };

    setUserData(newUserData);
    localStorage.setItem('userData', JSON.stringify(newUserData));
    
    if (bonus === 1) {
      alert(`+${bonus}₽ добавлен на ваш бонусный счет!`);
    }
  };

  const canCheckInToday = userData.lastCheckIn !== new Date().toDateString();

  return (
    <div className="space-y-6">
      {/* Daily Check-in Card */}
      <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8" />
            <div>
              <h3 className="text-xl">Ежедневный вход</h3>
              <p className="text-blue-100 text-sm">Получай бонусы каждый день</p>
            </div>
          </div>
          <Flame className="w-10 h-10 text-orange-300" />
        </div>

        <div className="bg-white/20 rounded-lg p-4 mb-4 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Дней подряд:</span>
            <span className="text-2xl">{Number(userData.consecutiveDays) || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Всего входов:</span>
            <span className="text-lg">{Number(userData.totalCheckIns) || 0}</span>
          </div>
        </div>

        <button
          onClick={handleDailyCheckIn}
          disabled={!canCheckInToday}
          className={`w-full py-3 rounded-lg transition ${
            canCheckInToday
              ? 'bg-white text-blue-600 hover:bg-blue-50'
              : 'bg-white/30 text-white/70 cursor-not-allowed'
          }`}
        >
          {canCheckInToday ? 'Получить бонус +1₽' : 'Бонус получен'}
        </button>

        <div className="mt-4 text-xs text-blue-100 space-y-1">
          <p>• 1₽ за ежедневный вход</p>
          <p>• +3₽ за 7 дней подряд</p>
          <p>• +10₽ за месяц активности</p>
        </div>
      </div>

      {/* Bonus Info */}
      <div className="bg-white rounded-2xl shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <Gift className="w-6 h-6 text-purple-600" />
          <h3 className="text-xl text-gray-800">Мои бонусы</h3>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Доступно</p>
            <p className="text-4xl text-purple-600">{Number(userData.bonusBalance) || 0}₽</p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <p>Можно оплатить до 1000₽ бонусами при заказе</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <p>+300₽ за друга с оплаченной визой</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <p>+100₽ после получения своей визы</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <p>Скидка 100₽ за отзыв (повторный заказ)</p>
          </div>
        </div>

        {/* Influencer Dashboard Button */}
        {onOpenInfluencerDashboard && (
          <button
            onClick={onOpenInfluencerDashboard}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-lg hover:shadow-lg transition flex items-center justify-center gap-2"
          >
            <TrendingUp className="w-5 h-5" />
            Партнёрский кабинет
          </button>
        )}

        {/* Admin Button */}
        {onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="w-full mt-3 bg-gradient-to-r from-gray-700 to-gray-900 text-white py-3 rounded-lg hover:shadow-lg transition flex items-center justify-center gap-2"
          >
            <Shield className="w-5 h-5" />
            Админ-панель
          </button>
        )}
      </div>

      {/* User Info */}
      <div className="bg-white rounded-2xl shadow-md p-6">
        <h3 className="text-xl text-gray-800 mb-4">Личные данные</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Имя</label>
            <input
              type="text"
              value={userData.name || ''}
              onChange={(e) => {
                const newData = { ...userData, name: e.target.value };
                setUserData(newData);
                localStorage.setItem('userData', JSON.stringify(newData));
              }}
              className="form-input mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Email</label>
            <input
              type="email"
              value={userData.email || ''}
              onChange={(e) => {
                const newData = { ...userData, email: e.target.value };
                setUserData(newData);
                localStorage.setItem('userData', JSON.stringify(newData));
              }}
              className="form-input mt-1"
              placeholder="example@email.com"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Телефон</label>
            <input
              type="tel"
              value={userData.phone || ''}
              onChange={(e) => {
                const newData = { ...userData, phone: e.target.value };
                setUserData(newData);
                localStorage.setItem('userData', JSON.stringify(newData));
              }}
              className="form-input mt-1"
              placeholder="+7 (999) 123-45-67"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Telegram</label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-500">@</span>
              <input
                type="text"
                value={userData.telegram || ''}
                onChange={(e) => {
                  const newData = { ...userData, telegram: e.target.value };
                  setUserData(newData);
                  localStorage.setItem('userData', JSON.stringify(newData));
                }}
                className="form-input flex-1"
                placeholder="username"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}