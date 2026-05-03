import { useState, useEffect } from 'react';
import { Users, TrendingUp, Award, Copy, Check } from 'lucide-react';

interface Referral {
  id: string;
  name: string;
  status: 'registered' | 'paid' | 'received';
  date: string;
  reward: number;
}

const mockReferrals: Referral[] = [
  {
    id: '1',
    name: 'Пользователь #4521',
    status: 'received',
    date: '2025-11-20',
    reward: 300
  },
  {
    id: '2',
    name: 'Пользователь #4532',
    status: 'paid',
    date: '2025-11-22',
    reward: 300
  },
  {
    id: '3',
    name: 'Пользователь #4544',
    status: 'registered',
    date: '2025-11-25',
    reward: 0
  }
];

const topInfluencers = [
  { rank: 1, name: 'TravelBlogger', earnings: 125000, visas: 250, prize: '50,000₽' },
  { rank: 2, name: 'VisaExpert', earnings: 98000, visas: 196, prize: '30,000₽' },
  { rank: 3, name: 'GlobalTraveler', earnings: 87000, visas: 174, prize: '20,000₽' }
];

export default function ReferralsTab() {
  const [isInfluencer, setIsInfluencer] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>(mockReferrals);
  const [copied, setCopied] = useState(false);

  const referralLink = 'https://t.me/visaexpress_bot?start=ref_12345';
  
  const totalEarned = referrals.filter(r => r.status === 'received').reduce((sum, r) => sum + r.reward, 0);
  const totalReferrals = referrals.length;
  const paidReferrals = referrals.filter(r => r.status === 'paid' || r.status === 'received').length;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBecomeInfluencer = () => {
    alert('Для получения статуса инфлюенсера свяжитесь с администратором в разделе поддержки');
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-6 text-white">
        <h2 className="text-xl mb-4">Реферальная статистика</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/20 rounded-xl p-3">
            <p className="text-sm opacity-90 mb-1">Рефералов</p>
            <p className="text-2xl">{totalReferrals}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3">
            <p className="text-sm opacity-90 mb-1">Оплатили</p>
            <p className="text-2xl">{paidReferrals}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3">
            <p className="text-sm opacity-90 mb-1">Заработано</p>
            <p className="text-2xl">{totalEarned}₽</p>
          </div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-gray-900 mb-3">Ваша реферальная ссылка</h3>
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={referralLink}
            readOnly
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          />
          <button
            onClick={handleCopy}
            className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-sm text-gray-600">
          Делитесь ссылкой в социальных сетях и мессенджерах
        </p>
      </div>

      {/* Rewards Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-gray-900 mb-4">Как это работает?</h3>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-gray-900 mb-1">Обычные пользователи</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• +300₽ за друга с оплаченной визой</li>
                <li>• +100₽ после получения своей визы</li>
                <li>• Можно оплатить до 1000₽ бонусами</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-gray-900 mb-1">Инфлюенсеры</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• +500₽ за каждую оформленную визу</li>
                <li>• Полная оплата бонусами без ограничений</li>
                <li>• Детальная статистика переходов и заявок</li>
                <li>• Участие в конкурсе с призами</li>
              </ul>
            </div>
          </div>
        </div>

        {!isInfluencer && (
          <button
            onClick={handleBecomeInfluencer}
            className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Стать инфлюенсером
          </button>
        )}
      </div>

      {/* Referrals List */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-gray-900 mb-4">Мои рефералы</h3>
        
        {referrals.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">Пока нет рефералов</p>
          </div>
        ) : (
          <div className="space-y-3">
            {referrals.map((referral) => (
              <div key={referral.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-gray-900 mb-1">{referral.name}</p>
                  <p className="text-sm text-gray-500">{new Date(referral.date).toLocaleDateString('ru-RU')}</p>
                </div>
                <div className="text-right">
                  {referral.status === 'received' && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                      +{referral.reward}₽
                    </span>
                  )}
                  {referral.status === 'paid' && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      В обработке
                    </span>
                  )}
                  {referral.status === 'registered' && (
                    <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm">
                      Ожидает оплаты
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Influencers */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-yellow-600" />
          <h3 className="text-gray-900">Топ инфлюенсеров</h3>
        </div>
        
        <div className="space-y-3">
          {topInfluencers.map((influencer) => (
            <div
              key={influencer.rank}
              className={`flex items-center gap-4 p-4 rounded-xl ${
                influencer.rank === 1
                  ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300'
                  : influencer.rank === 2
                  ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-2 border-gray-300'
                  : 'bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  influencer.rank === 1
                    ? 'bg-yellow-500 text-white'
                    : influencer.rank === 2
                    ? 'bg-gray-400 text-white'
                    : 'bg-orange-600 text-white'
                }`}
              >
                <span className="text-lg">#{influencer.rank}</span>
              </div>
              
              <div className="flex-1">
                <p className="text-gray-900 mb-1">{influencer.name}</p>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>{influencer.visas} виз</span>
                  <span>•</span>
                  <span>{influencer.earnings.toLocaleString('ru-RU')}₽</span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">Приз</p>
                <p className={`${
                  influencer.rank === 1
                    ? 'text-yellow-700'
                    : influencer.rank === 2
                    ? 'text-gray-700'
                    : 'text-orange-700'
                }`}>
                  {influencer.prize}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-900">
            🏆 Конкурс обновляется каждый месяц. Станьте лидером и получите денежный приз!
          </p>
        </div>
      </div>
    </div>
  );
}
