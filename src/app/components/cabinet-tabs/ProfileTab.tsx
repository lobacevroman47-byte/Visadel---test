import { Copy, Check, Coins, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ProfileTab() {
  const [copied, setCopied] = useState(false);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [loginStreak, setLoginStreak] = useState(0);

  const referralLink = 'https://t.me/visaexpress_bot?start=ref_12345';

  useEffect(() => {
    // Load bonus balance and login streak from localStorage
    const savedBalance = localStorage.getItem('bonusBalance');
    const savedStreak = localStorage.getItem('loginStreak');
    const lastLogin = localStorage.getItem('lastLogin');
    
    if (savedBalance) setBonusBalance(parseInt(savedBalance));
    
    // Check login streak
    const today = new Date().toDateString();
    if (lastLogin === today) {
      // Already logged in today
      if (savedStreak) setLoginStreak(parseInt(savedStreak));
    } else {
      // New day login
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastLogin === yesterday.toDateString()) {
        // Continue streak
        const newStreak = savedStreak ? parseInt(savedStreak) + 1 : 1;
        setLoginStreak(newStreak);
        localStorage.setItem('loginStreak', newStreak.toString());
        
        // Award daily bonus
        let dailyBonus = 1;
        if (newStreak >= 30) dailyBonus = 10;
        else if (newStreak >= 7) dailyBonus = 3;
        
        const newBalance = (savedBalance ? parseInt(savedBalance) : 0) + dailyBonus;
        setBonusBalance(newBalance);
        localStorage.setItem('bonusBalance', newBalance.toString());
      } else {
        // Streak broken, start over
        setLoginStreak(1);
        localStorage.setItem('loginStreak', '1');
        
        // Award 1 ruble for login
        const newBalance = (savedBalance ? parseInt(savedBalance) : 0) + 1;
        setBonusBalance(newBalance);
        localStorage.setItem('bonusBalance', newBalance.toString());
      }
      
      localStorage.setItem('lastLogin', today);
    }
  }, []);

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">👤</span>
          </div>
          <div>
            <h2 className="text-xl">Пользователь</h2>
            <p className="text-sm opacity-90">ID: 12345</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-white/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4" />
              <span className="text-sm opacity-90">Бонусов</span>
            </div>
            <p className="text-2xl">{bonusBalance}₽</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-sm opacity-90">Дней подряд</span>
            </div>
            <p className="text-2xl">{loginStreak}</p>
          </div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-gray-900 mb-3">Реферальная ссылка</h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={referralLink}
            readOnly
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          />
          <button
            onClick={handleCopyReferral}
            className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Приглашайте друзей и получайте 300₽ за каждую оплаченную визу
        </p>
      </div>

      {/* Bonus System */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-gray-900 mb-4">Бонусная система</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <span className="text-sm text-gray-700">Ежедневный вход</span>
            <span className="text-green-600">+1₽</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <span className="text-sm text-gray-700">7 дней подряд</span>
            <span className="text-green-600">+3₽</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <span className="text-sm text-gray-700">30 дней подряд</span>
            <span className="text-green-600">+10₽</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
            <span className="text-sm text-gray-700">Отзыв на страну</span>
            <span className="text-purple-600">+200₽</span>
          </div>
        </div>
      </div>

      {/* Bonus Usage */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <h3 className="text-yellow-900 mb-2">Использование бонусов</h3>
        <p className="text-sm text-yellow-800">
          • Обычные пользователи: до 1000₽ за заказ<br />
          • Инфлюенсеры: без ограничений
        </p>
      </div>
    </div>
  );
}
