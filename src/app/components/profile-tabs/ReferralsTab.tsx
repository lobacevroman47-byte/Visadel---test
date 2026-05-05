import { useEffect, useMemo, useRef, useState } from 'react';
import { Users, Award, Share2, Loader2, Download, QrCode, Send, Calculator, Sparkles, Lock, Check, Link2 } from 'lucide-react';
import { FaTelegramPlane, FaWhatsapp, FaVk, FaInstagram } from 'react-icons/fa';
import { QRCodeCanvas } from 'qrcode.react';
import { useTelegram } from '../../App';
import { getReferralStats, type ReferralStats } from '../../lib/db';
import {
  BONUS_CONFIG,
  REFERRAL_LEVELS,
  getCurrentLevel,
  getNextLevel,
} from '../../lib/bonus-config';

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
  const [showQR, setShowQR] = useState(false);
  const [calcFriends, setCalcFriends] = useState(5);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!referralCode || !myTelegramId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const s = await getReferralStats(referralCode, myTelegramId);
        if (cancelled) return;
        setStats(s);

        // Auto-grant level bonuses (idempotent via grant-bonus API + unique application_id)
        for (const level of REFERRAL_LEVELS) {
          if (level.bonus > 0 && s.totalReferrals >= level.minRefs) {
            try {
              await fetch('/api/grant-bonus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  telegram_id: myTelegramId,
                  type: 'level',
                  amount: level.bonus,
                  description: `+${level.bonus}₽ за достижение уровня «${level.name}»`,
                  application_id: `level_${level.id}_${myTelegramId}`,
                }),
              });
            } catch (e) { console.warn('level bonus grant failed', e); }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [referralCode, myTelegramId]);

  const link = `https://t.me/${BOT_USERNAME}?start=${referralCode}`;
  const shareText = `Оформляй визу легко с Visadel Agency!\n🎁 По моей ссылке ты получишь 200₽ на первую визу: ${link}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('Не удалось скопировать. Скопируйте вручную:\n' + link);
    }
  };

  // Multi-channel sharing — opens corresponding social network share dialog
  const shareTo = (channel: 'telegram' | 'whatsapp' | 'vk' | 'instagram' | 'max' | 'copy') => {
    const tg = (window as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void; openLink?: (u: string) => void } } }).Telegram?.WebApp;
    const open = (url: string) => {
      if (channel === 'telegram' && tg?.openTelegramLink) tg.openTelegramLink(url);
      else if (tg?.openLink) tg.openLink(url);
      else window.open(url, '_blank');
    };
    switch (channel) {
      case 'telegram':
        open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`);
        break;
      case 'whatsapp':
        open(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
        break;
      case 'vk':
        open(`https://vk.com/share.php?url=${encodeURIComponent(link)}&title=${encodeURIComponent('Visadel Agency')}&description=${encodeURIComponent(shareText)}`);
        break;
      case 'instagram':
        navigator.clipboard.writeText(shareText).catch(() => {});
        alert('Текст скопирован! Откройте Instagram и вставьте в сториз или сообщение.');
        break;
      case 'max':
        // MAX (мессенджер от VK) — нет универсального share URL, копируем текст
        navigator.clipboard.writeText(shareText).catch(() => {});
        open('https://max.ru/');
        break;
      case 'copy':
        copyLink();
        break;
    }
  };

  const downloadQR = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visadel-referral-${referralCode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  // Levels — derived from total referrals (всех приглашённых)
  const refCount = stats.totalReferrals;
  const currentLevel = getCurrentLevel(refCount);
  const nextLevel = getNextLevel(refCount);
  const progressPct = useMemo(() => {
    if (!nextLevel) return 100;
    const prevMin = currentLevel?.minRefs ?? 0;
    const span = nextLevel.minRefs - prevMin;
    const done = refCount - prevMin;
    return Math.min(100, Math.max(0, Math.round((done / span) * 100)));
  }, [refCount, currentLevel, nextLevel]);

  // Calculator
  const calcEarning = useMemo(() => {
    if (isPartner) {
      // partner: ~15% of avg visa price 4000₽ = 600 per friend
      return calcFriends * 600;
    }
    return calcFriends * BONUS_CONFIG.REFERRER_REGULAR;
  }, [calcFriends, isPartner]);

  if (!referralCode) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Загружаем профиль…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── 1. Hero motivational header ─────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-2xl shrink-0">
            {stats.totalEarnings > 0 ? '💰' : '🎁'}
          </div>
          <div className="flex-1 min-w-0">
            {stats.totalEarnings > 0 ? (
              <>
                <p className="text-sm text-white/80">Вы заработали</p>
                <p className="text-3xl font-bold">{stats.totalEarnings.toLocaleString('ru-RU')}₽</p>
                <p className="text-sm text-white/80 mt-1">
                  Пригласите ещё друзей — заработаете больше!
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold leading-tight">Пригласите первого друга</p>
                <p className="text-2xl font-bold mt-1">и получите 500₽</p>
                <p className="text-xs text-white/80 mt-1">Друг получит +200₽ при регистрации</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Multi-channel share buttons ──────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Share2 className="w-4 h-4 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-700">Поделиться ссылкой</h4>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ShareBtn label="Telegram" icon={<FaTelegramPlane className="w-6 h-6" />} color="bg-[#229ED9]" onClick={() => shareTo('telegram')} />
          <ShareBtn label="WhatsApp" icon={<FaWhatsapp className="w-6 h-6" />} color="bg-[#25D366]" onClick={() => shareTo('whatsapp')} />
          <ShareBtn label="VK" icon={<FaVk className="w-6 h-6" />} color="bg-[#0077FF]" onClick={() => shareTo('vk')} />
          <ShareBtn label="Instagram" icon={<FaInstagram className="w-6 h-6" />} color="bg-gradient-to-br from-[#FEDA75] via-[#FA7E1E] to-[#D62976]" onClick={() => shareTo('instagram')} />
          <ShareBtn label="MAX" icon={<MaxIcon className="w-6 h-6" />} color="bg-gradient-to-br from-[#0077FF] to-[#0048AA]" onClick={() => shareTo('max')} />
          <ShareBtn label={copied ? 'Скопировано' : 'Копировать'} icon={copied ? <Check className="w-6 h-6" /> : <Link2 className="w-6 h-6" />} color="bg-gray-700" onClick={() => shareTo('copy')} />
        </div>

        {/* QR toggle */}
        <button
          onClick={() => setShowQR(s => !s)}
          className="w-full mt-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl flex items-center justify-center gap-2 text-sm text-gray-700 transition"
        >
          <QrCode className="w-4 h-4" /> {showQR ? 'Скрыть' : 'Показать'} QR-код
        </button>

        {showQR && (
          <div className="mt-3 bg-white border-2 border-gray-100 rounded-xl p-4 flex flex-col items-center gap-3">
            <QRCodeCanvas
              ref={qrCanvasRef}
              value={link}
              size={220}
              level="H"
              marginSize={2}
            />
            <button
              onClick={downloadQR}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-xl flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4" /> Сохранить картинку
            </button>
            <p className="text-xs text-gray-400 text-center">
              Покажите QR другу или сохраните для сториз
            </p>
          </div>
        )}
      </div>

      {/* ── 3. What friend will get ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
        <h4 className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Что вы оба получите
        </h4>
        <div className="space-y-1.5 text-sm">
          <p className="text-emerald-900">🎁 <strong>Друг</strong> получит +{BONUS_CONFIG.NEW_USER_WELCOME}₽ сразу при регистрации</p>
          {isPartner ? (
            <p className="text-emerald-900">💰 <strong>Вы</strong> — до 20% с каждого его заказа</p>
          ) : (
            <p className="text-emerald-900">💰 <strong>Вы</strong> — +{BONUS_CONFIG.REFERRER_REGULAR}₽ когда друг оплатит первую визу</p>
          )}
        </div>
      </div>

      {/* ── 4. Stats grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Приглашено" value={stats.totalReferrals} color="text-blue-600" loading={loading} />
        <StatCard label="Оплатили" value={stats.paidReferrals} color="text-green-600" loading={loading} />
        <StatCard label="Заработано" value={`${stats.totalEarnings}₽`} color="text-purple-600" loading={loading} />
      </div>

      {/* ── 5. Achievements / levels ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-700">Уровни</h4>
        </div>

        {currentLevel && (
          <div className={`bg-gradient-to-br ${currentLevel.gradient} rounded-xl p-4 text-white mb-3`}>
            <div className="flex items-center gap-3">
              <div className="text-4xl">{currentLevel.icon}</div>
              <div className="flex-1">
                <p className="text-xs text-white/80">Текущий уровень</p>
                <p className="text-xl font-bold">{currentLevel.name}</p>
                <p className="text-xs text-white/80">{refCount} рефералов</p>
              </div>
            </div>
          </div>
        )}

        {nextLevel && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>До уровня «{nextLevel.name}»</span>
              <span>{refCount} / {nextLevel.minRefs}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${nextLevel.gradient} transition-all`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {nextLevel.bonus > 0 && (
              <p className="text-xs text-gray-500 mt-1.5">
                Награда за уровень: <span className="text-emerald-600 font-semibold">+{nextLevel.bonus}₽</span>
              </p>
            )}
          </div>
        )}

        {/* Level list */}
        <div className="space-y-1.5">
          {REFERRAL_LEVELS.map((level) => {
            const reached = refCount >= level.minRefs;
            return (
              <div
                key={level.id}
                className={`flex items-center gap-3 p-2 rounded-lg ${reached ? 'bg-emerald-50' : 'bg-gray-50'}`}
              >
                <div className="text-xl">{reached ? level.icon : '🔒'}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${reached ? 'text-gray-800' : 'text-gray-400'}`}>
                    {level.name}
                  </p>
                  <p className="text-xs text-gray-400">{level.minRefs}+ рефералов</p>
                </div>
                {level.bonus > 0 && (
                  <span className={`text-xs px-2 py-1 rounded-full ${reached ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                    {reached ? <Check className="w-3 h-3 inline" /> : <Lock className="w-3 h-3 inline" />} +{level.bonus}₽
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 6. Earnings calculator ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-700">Калькулятор заработка</h4>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4">
          <div className="text-center mb-3">
            <p className="text-xs text-gray-500">Если пригласите</p>
            <p className="text-3xl font-bold text-purple-600">{calcFriends} {pluralFriends(calcFriends)}</p>
            <p className="text-xs text-gray-500 mt-1">вы заработаете</p>
            <p className="text-3xl font-bold text-emerald-600">{calcEarning.toLocaleString('ru-RU')}₽</p>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={calcFriends}
            onChange={e => setCalcFriends(Number(e.target.value))}
            className="w-full h-2 bg-gradient-to-r from-purple-200 to-pink-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1</span><span>10</span><span>20</span>
          </div>
        </div>
      </div>

      {/* ── 7. Referrals list ───────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Загружаем…
        </div>
      ) : stats.referrals.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" /> Ваши рефералы ({stats.referrals.length})
          </h4>
          <div className="space-y-2">
            {stats.referrals.map((ref) => (
              <div key={ref.telegram_id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 truncate">{ref.name}</p>
                  {ref.username && <p className="text-xs text-blue-500">@{ref.username}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(ref.joined_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div className="text-right ml-2">
                  {ref.has_paid ? (
                    <>
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">✓ Оплачено</span>
                      {ref.earned_bonus > 0 && <p className="text-xs text-green-600 mt-0.5">+{ref.earned_bonus}₽</p>}
                    </>
                  ) : (
                    <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">В ожидании</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── 8. Become a partner CTA — only for regular users ──────────── */}
      {!isPartner && (
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-5 text-white shadow-lg">
          <h4 className="text-lg font-bold mb-2 flex items-center gap-2">
            <span>🌟</span> Стать партнёром
          </h4>
          <p className="text-sm text-white/90 mb-3">
            Если вы блогер или агент:
          </p>
          <ul className="text-sm text-white/90 space-y-1 mb-4">
            <li>• До 20% с каждого заказа</li>
            <li>• 100% оплата бонусами</li>
            <li>• Подробная статистика</li>
            <li>• Проценты по услугам в кабинете</li>
          </ul>
          <button
            onClick={onOpenPartnerApplication}
            className="w-full bg-white text-purple-600 py-3 rounded-xl font-medium hover:bg-purple-50 transition flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Подать заявку
          </button>
        </div>
      )}
    </div>
  );
}

function ShareBtn({ label, icon, color, onClick }: { label: string; icon: React.ReactNode; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 py-3 px-1 ${color} text-white rounded-xl hover:opacity-90 active:scale-95 transition shadow-sm`}
    >
      {icon}
      <span className="text-[11px] font-medium leading-tight text-center">{label}</span>
    </button>
  );
}

// MAX мессенджер — простая SVG-иконка (стилизованная буква M)
function MaxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3 4h3.5l5.5 9 5.5-9H21v16h-3.5V10.5l-4.5 7.5h-2L6.5 10.5V20H3V4z" />
    </svg>
  );
}

function StatCard({ label, value, color, loading }: { label: string; value: string | number; color: string; loading: boolean }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 text-center">
      <p className={`text-xl font-bold ${color}`}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : value}
      </p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function pluralFriends(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'друзей';
  if (mod10 === 1) return 'друга';
  if (mod10 >= 2 && mod10 <= 4) return 'друзей';
  return 'друзей';
}
