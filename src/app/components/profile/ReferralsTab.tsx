import { Users, Copy, Share2, CheckCircle } from 'lucide-react';

export default function ReferralsTab() {
  const referralCode = 'IVAN2024';
  const referralLink = `https://t.me/visadel_bot?start=${referralCode}`;
  
  const stats = {
    totalReferrals: 5,
    activeReferrals: 3,
    totalEarned: 900,
  };

  const referrals = [
    { id: 1, name: 'Мария И.', date: '10 ноября 2024', earned: 300, status: 'completed' },
    { id: 2, name: 'Петр С.', date: '15 ноября 2024', earned: 300, status: 'completed' },
    { id: 3, name: 'Анна К.', date: '20 ноября 2024', earned: 300, status: 'completed' },
    { id: 4, name: 'Иван П.', date: '25 ноября 2024', earned: 0, status: 'pending' },
    { id: 5, name: 'Ольга Д.', date: '28 ноября 2024', earned: 0, status: 'pending' },
  ];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} скопирован!`);
  };

  const shareReferralLink = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Visadel Agency',
        text: 'Оформи визу через Visadel Agency и получи скидку!',
        url: referralLink,
      });
    } else {
      copyToClipboard(referralLink, 'Реферальная ссылка');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1">Реферальная программа</h2>
        <p className="text-gray-600 text-sm">Приглашайте друзей и зарабатывайте вместе</p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-600 text-sm mb-2">Всего рефералов</p>
          <p className="text-blue-600 text-2xl">{stats.totalReferrals}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-600 text-sm mb-2">Активных</p>
          <p className="text-green-600 text-2xl">{stats.activeReferrals}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-600 text-sm mb-2">Заработано</p>
          <p className="text-orange-600 text-2xl">{stats.totalEarned}₽</p>
        </div>
      </div>

      {/* Реферальный код */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-6 text-white">
        <h3 className="mb-4">Ваш реферальный код</h3>
        
        <div className="bg-white/10 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Код:</span>
            <button
              onClick={() => copyToClipboard(referralCode, 'Реферальный код')}
              className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span className="text-sm">Копировать</span>
            </button>
          </div>
          <p className="text-2xl tracking-wider">{referralCode}</p>
        </div>

        <div className="bg-white/10 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Ссылка:</span>
            <button
              onClick={() => copyToClipboard(referralLink, 'Реферальная ссылка')}
              className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span className="text-sm">Копировать</span>
            </button>
          </div>
          <p className="text-sm break-all opacity-90">{referralLink}</p>
        </div>

        <button
          onClick={shareReferralLink}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Share2 className="w-5 h-5" />
          <span>Поделиться</span>
        </button>
      </div>

      {/* Как это работает */}
      <div className="bg-blue-50 rounded-xl p-4">
        <h3 className="text-blue-900 mb-3">💰 Условия программы</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>• За каждого приглашённого друга — <strong>300₽</strong> на ваш счёт после его первого заказа</p>
          <p>• Ваш друг получает <strong>скидку 200₽</strong> на первый заказ</p>
          <p>• Для инфлюенсеров специальные условия — до <strong>20%</strong> с каждого заказа</p>
        </div>
      </div>

      {/* Список рефералов */}
      <div>
        <h3 className="mb-4">Мои рефералы</h3>
        {referrals.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">У вас пока нет рефералов</p>
            <p className="text-gray-500 text-sm">Поделитесь ссылкой с друзьями!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {referrals.map((referral) => (
              <div key={referral.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-gray-900">{referral.name}</p>
                      <p className="text-gray-600 text-sm">{referral.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {referral.status === 'completed' ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span>+{referral.earned}₽</span>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">Ожидание заказа</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
