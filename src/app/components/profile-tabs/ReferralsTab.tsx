import { useEffect, useState } from 'react';
import { Users, Copy, TrendingUp, Award, Share2, Loader2 } from 'lucide-react';
import { useTelegram } from '../../App';
import { getReferralStats, type ReferralStats } from '../../lib/db';
import { BONUS_CONFIG } from '../../lib/bonus-config';

interface ReferralTabProps {
  onOpenPartnerApplication?: () => void;
}

const BOT_USERNAME = 'Visadel_test_bot';

export default function ReferralsTab({ onOpenPartnerApplication }: ReferralTabProps) {
  const { appUser } = useTelegram();
  const referralCode = appUser?.referral_code ?? '';
  const isPartner = appUser?.is_influencer ?? false;
  const myTelegramId = appUser?.telegram_id ?? 0;

  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0, paidReferrals: 0, totalEarnings: 0, referrals: [],
  });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!referralCode || !myTelegramId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const s = await getReferralStats(referralCode, myTelegramId);
        if (!cancelled) setStats(s);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [referralCode, myTelegramId]);

  const link = `https://t.me/${BOT_USERNAME}?start=${referralCode}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('Не удалось скопировать. Скопируйте вручную: ' + link);
    }
  };

  const handleShare = async () => {
    const text = `Оформляй визу легко с Visadel Agency!\n🎁 По моей ссылке: ${link}`;
    const tg = (window as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ title: 'Visadel Agency', text }); return; } catch {/* user cancelled */}
    }
    await navigator.clipboard.writeText(text).catch(() => {});
    alert('Текст для приглашения скопирован!');
  };

  // Display amount per referral — partners see "%", regular users see fixed sum
  const headlineRefBonus = isPartner
    ? `до ${BONUS_CONFIG.PARTNER_COMMISSION_MAX_PCT}% с каждого заказа`
    : `+${BONUS_CONFIG.REFERRER_REGULAR}₽ за друга с оплаченной визой`;

  if (!referralCode) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Загружаем профиль…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-8 h-8" />
          <div>
            <h3 className="text-xl">Реферальная программа</h3>
            <p className="text-blue-100 text-sm">
              {isPartner ? 'Статус: Партнёр 🌟' : 'Приглашай друзей'}
            </p>
          </div>
        </div>

        <div className="bg-white/20 rounded-lg p-4 mb-4 backdrop-blur-sm">
          <p className="text-sm text-blue-100 mb-2">Ваш реферальный код:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white/30 px-3 py-2 rounded text-base break-all">{referralCode}</code>
            <button
              onClick={handleCopyLink}
              className="p-2 bg-white/30 hover:bg-white/40 rounded transition flex items-center gap-1"
              title="Скопировать ссылку"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
          {copied && <p className="text-xs text-blue-50 mt-2">✓ Ссылка скопирована</p>}
        </div>

        <button
          onClick={handleShare}
          className="w-full bg-white text-blue-600 py-3 rounded-lg hover:bg-blue-50 transition flex items-center justify-center gap-2 font-medium"
        >
          <Share2 className="w-5 h-5" /> Поделиться ссылкой
        </button>

        <div className="mt-4 space-y-1 text-sm text-blue-100">
          <p>• {headlineRefBonus}</p>
          {!isPartner && <p>• +{BONUS_CONFIG.NEW_USER_WELCOME}₽ новичку при первой оплате</p>}
          {!isPartner && <p>• Можно оплатить до {BONUS_CONFIG.MAX_BONUS_USAGE_REFERRAL_USER}₽ бонусами</p>}
          {isPartner && <p>• 100% оплата визы бонусами</p>}
          {isPartner && <p>• Подробные проценты по каждой услуге — в партнёрском кабинете</p>}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Users className="w-5 h-5 text-blue-600" />} label="Всего рефералов" value={stats.totalReferrals} loading={loading} />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-green-600" />} label="Оплатили визу" value={stats.paidReferrals} loading={loading} />
        <StatCard icon={<Award className="w-5 h-5 text-purple-600" />} label="Заработано" value={`${stats.totalEarnings}₽`} loading={loading} fullWidth={!isPartner} />
        {isPartner && (
          <StatCard
            icon={<span className="text-base">📈</span>}
            label="Конверсия"
            value={stats.totalReferrals > 0 ? `${Math.round((stats.paidReferrals / stats.totalReferrals) * 100)}%` : '—'}
            loading={loading}
          />
        )}
      </div>

      {/* Referrals list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Загружаем рефералов…
        </div>
      ) : stats.referrals.length > 0 ? (
        <div>
          <h3 className="text-lg text-gray-800 mb-3">Ваши рефералы</h3>
          <div className="space-y-3">
            {stats.referrals.map((ref) => (
              <div key={ref.telegram_id} className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-800 truncate">{ref.name}</p>
                    {ref.username && <p className="text-xs text-blue-500">@{ref.username}</p>}
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(ref.joined_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    {ref.has_paid ? (
                      <>
                        <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full whitespace-nowrap">✓ Оплачено</span>
                        {ref.earned_bonus > 0 && <p className="text-sm text-green-600 mt-1">+{ref.earned_bonus}₽</p>}
                      </>
                    ) : (
                      <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full whitespace-nowrap">В ожидании</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <p className="text-gray-400 text-sm">Пока никто не пришёл по вашей ссылке</p>
          <p className="text-gray-300 text-xs mt-1">Поделитесь ссылкой — за каждого друга будет бонус</p>
        </div>
      )}

      {/* Become a partner CTA — only for regular users */}
      {!isPartner && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
          <h4 className="text-gray-800 mb-2">Станьте партнёром! 🌟</h4>
          <p className="text-sm text-gray-600 mb-3">
            Если вы блогер или агент — зарабатывайте больше:
          </p>
          <ul className="text-sm text-gray-700 space-y-1 mb-3">
            <li>• До {BONUS_CONFIG.PARTNER_COMMISSION_MAX_PCT}% с каждого заказа (визы, отели, билеты, страховки)</li>
            <li>• 100% оплата бонусами</li>
            <li>• Статистика по каждому реферальному заказу</li>
            <li>• Подробные проценты в партнёрском кабинете</li>
          </ul>
          <button
            onClick={onOpenPartnerApplication}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg hover:shadow-lg transition"
          >
            Подать заявку на статус партнёра
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon, label, value, loading, fullWidth,
}: { icon: React.ReactNode; label: string; value: string | number; loading: boolean; fullWidth?: boolean }) {
  return (
    <div className={`bg-white rounded-xl shadow-md p-4 ${fullWidth ? 'col-span-2' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <p className="text-2xl text-gray-800">
        {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-300" /> : value}
      </p>
    </div>
  );
}
