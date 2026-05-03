import { useState, useEffect } from 'react';
import { Users, Copy, TrendingUp, Award, Share2 } from 'lucide-react';

interface Referral {
  id: string;
  name: string;
  joinedAt: string;
  hasPaidVisa: boolean;
  earnedBonus: number;
}

interface InfluencerStats {
  totalReferrals: number;
  paidReferrals: number;
  totalEarnings: number;
  clicks: number;
}

const TOP_INFLUENCERS = [
  { name: 'Алексей М.', referrals: 127, earnings: 88900, avatar: '👨‍💼' },
  { name: 'Мария К.', referrals: 95, earnings: 66500, avatar: '👩‍💼' },
  { name: 'Дмитрий П.', referrals: 73, earnings: 51100, avatar: '👨‍💻' },
];

interface ReferralTabProps {
  onOpenPartnerApplication?: () => void;
}

export default function ReferralsTab({ onOpenPartnerApplication }: ReferralTabProps) {
  const [referralCode] = useState('VISA' + Math.random().toString(36).substr(2, 6).toUpperCase());
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<InfluencerStats>({
    totalReferrals: 0,
    paidReferrals: 0,
    totalEarnings: 0,
    clicks: 0,
  });
  const [isInfluencer, setIsInfluencer] = useState(false);

  useEffect(() => {
    const savedReferrals = localStorage.getItem('referrals');
    if (savedReferrals) {
      const refs = JSON.parse(savedReferrals);
      setReferrals(refs);
      calculateStats(refs);
    }

    const influencerStatus = localStorage.getItem('isInfluencer');
    setIsInfluencer(influencerStatus === 'true');
  }, []);

  const calculateStats = (refs: Referral[]) => {
    const paidRefs = refs.filter(r => r.hasPaidVisa);
    const earnings = paidRefs.reduce((sum, r) => sum + r.earnedBonus, 0);
    setStats({
      totalReferrals: refs.length,
      paidReferrals: paidRefs.length,
      totalEarnings: earnings,
      clicks: Math.floor(Math.random() * 100) + refs.length * 3, // Mock clicks
    });
  };

  const handleCopyLink = () => {
    const link = `https://t.me/visadelagency_bot?start=${referralCode}`;
    navigator.clipboard.writeText(link);
    alert('Реферальная ссылка скопирована!');
  };

  const handleShare = () => {
    const link = `https://t.me/visadelagency_bot?start=${referralCode}`;
    const text = `Оформляй визу легко с Visadel Agency! 
🎁 Получи скидку по моей ссылке: ${link}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Visadel Agency',
        text: text,
      });
    } else {
      navigator.clipboard.writeText(text);
      alert('Текст для приглашения скопирован!');
    }
  };

  const bonusPerReferral = isInfluencer ? 700 : 300;

  const onApplyForPartner = () => {
    // Add logic to handle partner application
    if (onOpenPartnerApplication) {
      onOpenPartnerApplication();
    } else {
      alert('Заявка на статус партнёра отправлена!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Referral Link Card */}
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-8 h-8" />
          <div>
            <h3 className="text-xl">Реферальная программа</h3>
            <p className="text-blue-100 text-sm">
              {isInfluencer ? 'Статус: Партнёр 🌟' : 'Приглашай друзей'}
            </p>
          </div>
        </div>

        <div className="bg-white/20 rounded-lg p-4 mb-4 backdrop-blur-sm">
          <p className="text-sm text-blue-100 mb-2">Ваш реферальный код:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white/30 px-3 py-2 rounded text-lg">{referralCode}</code>
            <button
              onClick={handleCopyLink}
              className="p-2 bg-white/30 hover:bg-white/40 rounded transition"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="w-full bg-white text-blue-600 py-3 rounded-lg hover:bg-blue-50 transition flex items-center justify-center gap-2"
        >
          <Share2 className="w-5 h-5" />
          Поделиться ссылкой
        </button>

        <div className="mt-4 space-y-1 text-sm text-blue-100">
          <p>• +{bonusPerReferral}₽ за каждого друга с оплаченной визой</p>
          {!isInfluencer && <p>• +100₽ после получения своей визы</p>}
          {!isInfluencer && <p>• Можно оплатить до 1000₽ бонусами</p>}
          {isInfluencer && <p>• Полная оплата бонусами для инфлюенсеров</p>}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-600">Всего рефералов</span>
          </div>
          <p className="text-2xl text-gray-800">{stats.totalReferrals}</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-600">Оплатили визу</span>
          </div>
          <p className="text-2xl text-gray-800">{stats.paidReferrals}</p>
        </div>

        {isInfluencer && (
          <>
            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">👁️</span>
                <span className="text-sm text-gray-600">Переходов</span>
              </div>
              <p className="text-2xl text-gray-800">{stats.clicks}</p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5 text-purple-600" />
                <span className="text-sm text-gray-600">Заработано</span>
              </div>
              <p className="text-2xl text-gray-800">{stats.totalEarnings}₽</p>
            </div>
          </>
        )}
      </div>

      {!isInfluencer && stats.totalEarnings > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Заработано на рефералах</p>
              <p className="text-2xl text-green-600">{stats.totalEarnings}₽</p>
            </div>
            <Award className="w-12 h-12 text-green-600" />
          </div>
        </div>
      )}

      {/* Referrals List */}
      {referrals.length > 0 && (
        <div>
          <h3 className="text-lg text-gray-800 mb-3">Ваши рефералы</h3>
          <div className="space-y-3">
            {referrals.map((ref) => (
              <div key={ref.id} className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-800">{ref.name}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(ref.joinedAt).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <div className="text-right">
                    {ref.hasPaidVisa ? (
                      <>
                        <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full">
                          ✓ Оплачено
                        </span>
                        <p className="text-sm text-green-600 mt-1">+{ref.earnedBonus}₽</p>
                      </>
                    ) : (
                      <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                        В ожидании
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Influencers */}
      {isInfluencer && (
        <div>
          <h3 className="text-lg text-gray-800 mb-3 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            Топ партнёров
          </h3>
          <div className="space-y-2">
            {TOP_INFLUENCERS.map((influencer, idx) => (
              <div
                key={idx}
                className={`bg-white rounded-xl shadow-md p-4 ${
                  idx === 0 ? 'border-2 border-yellow-400' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{influencer.avatar}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-800">{influencer.name}</p>
                        {idx === 0 && <span className="text-yellow-500">👑</span>}
                        {idx === 1 && <span className="text-gray-400">🥈</span>}
                        {idx === 2 && <span className="text-orange-600">🥉</span>}
                      </div>
                      <p className="text-sm text-gray-500">{influencer.referrals} рефералов</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg text-green-600">{influencer.earnings}₽</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
            <p className="text-sm text-blue-800">
              🏆 Топ-3 партнёра каждый месяц получают специальные призы!
            </p>
          </div>
        </div>
      )}

      {!isInfluencer && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
          <h4 className="text-gray-800 mb-2">Станьте партнёром! 🌟</h4>
          <p className="text-sm text-gray-600 mb-3">
            Привлекайте аудиторию и зарабатывайте больше:
          </p>
          <ul className="text-sm text-gray-700 space-y-1 mb-3">
            <li>• +700₽ за каждого оплатившего визу</li>
            <li>• Полная оплата визы бонусами</li>
            <li>• Статистика переходов и заявок</li>
            <li>• Участие в топе с призами</li>
          </ul>
          <button 
            onClick={onApplyForPartner}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg hover:shadow-lg transition"
          >
            Подать заявку на статус партнёра
          </button>
        </div>
      )}
    </div>
  );
}