import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, Award, Loader2, Copy, Share2, Check, Crown, Star,
  Sparkles, ChevronRight, QrCode, Download, UserPlus, Wallet,
  CheckCircle2,
} from 'lucide-react';
import { FaTelegramPlane, FaWhatsapp, FaVk, FaInstagram, FaTiktok } from 'react-icons/fa';
import { QRCodeCanvas } from 'qrcode.react';
import { useTelegram } from '../../App';
import { getReferralStats, type ReferralStats } from '../../lib/db';
import { apiFetch } from '../../lib/apiFetch';
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
const MINI_APP_SHORT_NAME = 'app';

// Levels отображаются монохромными lucide-иконками, а не emoji в config.
// Premium feel — единая icon system.
const LEVEL_ICON: Record<number, React.ComponentType<{ className?: string }>> = {
  1: Star,
  2: Award,
  3: Sparkles,
  4: Crown,
};

export default function ReferralsTab({ onOpenPartnerApplication }: ReferralTabProps) {
  const { appUser } = useTelegram();
  const referralCode = appUser?.referral_code ?? '';
  const isPartner = appUser?.is_influencer ?? false;
  const myTelegramId = appUser?.telegram_id ?? 0;

  const [stats, setStats] = useState<ReferralStats>({
    clicks: 0, registered: 0, paidReferrals: 0, totalEarnings: 0, referrals: [],
  });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const shareSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!referralCode || !myTelegramId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const s = await getReferralStats(referralCode, myTelegramId);
        if (cancelled) return;
        setStats(s);

        // Cache paid referrals count for Step7Payment (bonus usage limit)
        try {
          const ud = JSON.parse(localStorage.getItem('userData') ?? '{}');
          ud.paidReferralsCount = s.paidReferrals;
          localStorage.setItem('userData', JSON.stringify(ud));
        } catch { /* ignore */ }

        // Auto-grant level bonuses (idempotent — dedupe via application_id)
        for (const level of REFERRAL_LEVELS) {
          if (level.bonus > 0 && s.paidReferrals >= level.minRefs) {
            try {
              await apiFetch('/api/grant-bonus', {
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

  // Direct Link Mini App: opens MiniApp immediately with start_param available.
  const link = `https://t.me/${BOT_USERNAME}/${MINI_APP_SHORT_NAME}?startapp=${referralCode}`;
  // Сильный shareText: цифра в начале, прямой призыв, без длинной обёртки.
  const shareText = `Получи ${BONUS_CONFIG.NEW_USER_WELCOME}₽ на первую визу в Visadel — оформление за 5 минут в Telegram: ${link}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('Не удалось скопировать. Скопируйте вручную:\n' + link);
    }
  };

  // Native share — Web Share API → Telegram fallback.
  const nativeShare = async () => {
    const data = { title: 'Visadel Agency', text: shareText, url: link };
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share === 'function') {
      try { await nav.share(data); return; } catch { /* user cancelled or unsupported */ }
    }
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
    const tg = (window as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(tgShareUrl);
    else window.open(tgShareUrl, '_blank');
  };

  // Per-network share. Открывает соответствующий share-dialog либо копирует
  // shareText в буфер и открывает приложение (Insta/TT не поддерживают URL-share).
  const shareTo = async (channel: 'telegram' | 'whatsapp' | 'vk' | 'instagram' | 'tiktok' | 'max') => {
    const tg = (window as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void; openLink?: (u: string) => void } } }).Telegram?.WebApp;
    const open = (url: string) => {
      if (channel === 'telegram' && tg?.openTelegramLink) tg.openTelegramLink(url);
      else if (tg?.openLink) tg.openLink(url);
      else window.open(url, '_blank');
    };
    const copyAndOpen = async (url: string) => {
      try { await navigator.clipboard.writeText(shareText); } catch { /* ignore */ }
      open(url);
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
        await copyAndOpen('https://www.instagram.com/');
        break;
      case 'tiktok':
        await copyAndOpen('https://www.tiktok.com/');
        break;
      case 'max':
        await copyAndOpen(`https://max.ru/share?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`);
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

  // Levels — derived from PAID referrals only (officially counted).
  const refCount = stats.paidReferrals;
  const currentLevel = getCurrentLevel(refCount);
  const nextLevel = getNextLevel(refCount);
  const progressPct = useMemo(() => {
    if (!nextLevel) return 100;
    const prevMin = currentLevel?.minRefs ?? 0;
    const span = nextLevel.minRefs - prevMin;
    const done = refCount - prevMin;
    return Math.min(100, Math.max(0, Math.round((done / span) * 100)));
  }, [refCount, currentLevel, nextLevel]);

  const scrollToShare = () => {
    shareSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!referralCode) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Загружаем профиль…
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-6">

      {/* ── 1. Hero — earnings front and center, single CTA ────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          Заработано
        </p>
        <p className="text-[34px] font-semibold text-emerald-600 tabular-nums leading-none mt-1">
          {loading ? '—' : `${stats.totalEarnings.toLocaleString('ru-RU')}₽`}
        </p>
        <p className="text-sm text-gray-500 mt-3 leading-relaxed">
          Приглашайте друзей — каждый, кто оплатит первую визу,
          приносит вам <span className="font-semibold text-[#0F2A36]">+{BONUS_CONFIG.REFERRER_REGULAR}₽</span>.
        </p>
        <button
          onClick={scrollToShare}
          className="w-full mt-4 vd-grad text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition vd-shadow-cta"
        >
          <UserPlus className="w-4 h-4" /> Пригласить друга
        </button>
      </div>

      {/* ── 2. Earnings stats — 3 compact cards ────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard
          icon={<Users className="w-3.5 h-3.5 text-gray-400" />}
          label="Перешли"
          value={stats.clicks}
          loading={loading}
        />
        <SummaryCard
          icon={<UserPlus className="w-3.5 h-3.5 text-gray-400" />}
          label="Зарегистр."
          value={stats.registered}
          loading={loading}
        />
        <SummaryCard
          icon={<CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />}
          label="Купили визу"
          value={stats.paidReferrals}
          loading={loading}
        />
      </div>

      {/* ── 3. How it works — 3 шага onboarding ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-3">
          Как это работает
        </p>
        <div className="space-y-2.5">
          <Step n={1} text="Поделитесь своей реферальной ссылкой" />
          <Step n={2} text="Друг регистрируется и оплачивает первую визу" />
          <Step n={3} text={`+${BONUS_CONFIG.REFERRER_REGULAR}₽ моментально на ваш баланс`} />
        </div>
      </div>

      {/* ── 4. Share section — link + per-network buttons + native share ─ */}
      <div ref={shareSectionRef} className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">
          Ваша ссылка
        </p>
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 mb-4">
          <span className="flex-1 text-sm text-gray-700 truncate font-mono">
            t.me/{BOT_USERNAME}/{MINI_APP_SHORT_NAME}?startapp={referralCode}
          </span>
          <button
            onClick={copyLink}
            className="text-gray-500 hover:text-[#3B5BFF] active:scale-90 transition shrink-0"
            title="Скопировать"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Per-network share row — original brand logos в premium soft-tinted чипах */}
        <div className="grid grid-cols-6 gap-2 mb-3">
          <SocialBtn label="Telegram"  color="#229ED9" onClick={() => shareTo('telegram')}><FaTelegramPlane className="w-5 h-5" style={{ color: '#229ED9' }} /></SocialBtn>
          <SocialBtn label="WhatsApp"  color="#25D366" onClick={() => shareTo('whatsapp')}><FaWhatsapp className="w-5 h-5" style={{ color: '#25D366' }} /></SocialBtn>
          <SocialBtn label="VK"        color="#0077FF" onClick={() => shareTo('vk')}><FaVk className="w-5 h-5" style={{ color: '#0077FF' }} /></SocialBtn>
          <SocialBtn label="Instagram" color="#E1306C" onClick={() => shareTo('instagram')}><FaInstagram className="w-5 h-5" style={{ color: '#E1306C' }} /></SocialBtn>
          <SocialBtn label="TikTok"    color="#0F0F0F" onClick={() => shareTo('tiktok')}><FaTiktok className="w-5 h-5" style={{ color: '#0F0F0F' }} /></SocialBtn>
          <SocialBtn label="MAX"       color="#5C7BFF" onClick={() => shareTo('max')}><MaxIcon className="w-6 h-6" /></SocialBtn>
        </div>

        {/* Native share + QR — secondary actions */}
        <div className="grid grid-cols-[1fr,auto] gap-2">
          <button
            onClick={nativeShare}
            className="py-2.5 rounded-xl text-sm font-medium vd-grad text-white active:scale-[0.98] transition flex items-center justify-center gap-1.5 vd-shadow-cta"
          >
            <Share2 className="w-4 h-4" /> Поделиться
          </button>
          <button
            onClick={() => setShowQR(s => !s)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-95 transition flex items-center justify-center text-gray-600"
            title={showQR ? 'Скрыть QR' : 'Показать QR'}
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>

        {showQR && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col items-center gap-3">
            <QRCodeCanvas ref={qrCanvasRef} value={link} size={180} level="H" marginSize={2} />
            <button
              onClick={downloadQR}
              className="text-xs text-[#3B5BFF] hover:underline flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Сохранить картинку
            </button>
          </div>
        )}
      </div>

      {/* ── 5. Levels — compact pills ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Уровень</p>
          <p className="text-sm font-semibold text-[#0F2A36]">
            {currentLevel ? currentLevel.name : 'Старт'}
          </p>
        </div>
        {nextLevel ? (
          <div className="mb-4">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full vd-grad transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 tabular-nums">
              {refCount} / {nextLevel.minRefs} приглашений до уровня «{nextLevel.name}»
            </p>
          </div>
        ) : (
          <p className="text-xs text-emerald-600 font-medium mb-4 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Достигнут максимальный уровень
          </p>
        )}
        <div className="grid grid-cols-4 gap-1.5">
          {REFERRAL_LEVELS.map(level => {
            const Icon = LEVEL_ICON[level.id] ?? Star;
            const reached = refCount >= level.minRefs;
            const isCurrent = currentLevel?.id === level.id;
            return (
              <div
                key={level.id}
                className={`rounded-xl py-2.5 px-1 flex flex-col items-center gap-1 transition ${
                  isCurrent
                    ? 'bg-[#EAF1FF] ring-1 ring-[#3B5BFF]/30'
                    : reached
                      ? 'bg-gray-50'
                      : 'bg-gray-50 opacity-50'
                }`}
                title={`${level.name} · ${level.minRefs}+ приглашений${level.bonus > 0 ? ` · +${level.bonus}₽` : ''}`}
              >
                <Icon className={`w-4 h-4 ${isCurrent ? 'text-[#3B5BFF]' : 'text-gray-400'}`} />
                <p className={`text-[11px] font-medium leading-tight ${isCurrent ? 'text-[#3B5BFF]' : 'text-gray-600'}`}>
                  {level.name}
                </p>
                <p className="text-[10px] text-gray-400 tabular-nums">
                  {level.minRefs}+
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
          Уровни доступны всем участникам. Премиум-партнёры дополнительно
          получают % с каждой брони — см. ниже.
        </p>
      </div>

      {/* ── 6. Premium-Partner banner — only for non-partners ──────────── */}
      {!isPartner && (
        <div className="bg-gradient-to-br from-[#0F2A36] to-[#1F3A48] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-amber-300" />
            <span className="text-[11px] font-medium text-amber-300 uppercase tracking-wider">
              Премиум-партнёр
            </span>
          </div>
          <h3 className="text-[22px] font-semibold leading-tight tabular-nums">
            до {BONUS_CONFIG.PARTNER_COMMISSION_MAX_PCT}% с каждого заказа
          </h3>
          <p className="text-sm text-white/70 mt-1.5 leading-relaxed">
            Распространяется на визы, брони отелей и авиабилеты.
            <span className="text-white/50">
              {' '}Не входят: готовые билеты, экскурсии, каталог отелей,
              eSIM и прочие услуги.
            </span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-white/90">
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Прозрачная статистика по каждому рефу
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Вывод 2 раза в месяц
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Личный менеджер в Telegram
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Готовые посты и баннеры в кабинете
            </li>
          </ul>
          <button
            onClick={onOpenPartnerApplication}
            className="w-full mt-5 bg-white text-[#0F2A36] py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50 active:scale-[0.98] transition"
          >
            Стать премиум-партнёром <ChevronRight className="w-4 h-4" />
          </button>
          <p className="text-[11px] text-white/50 text-center mt-2">
            Заявка 2 минуты · ответ за 24 часа
          </p>
        </div>
      )}

      {/* ── 7. Partner status card — shown if user is already a partner ── */}
      {isPartner && (
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1.5">
            <Crown className="w-4 h-4 text-amber-600" />
            <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">
              Премиум-партнёр
            </span>
          </div>
          <h3 className="text-base font-semibold text-amber-900 leading-tight">
            Вы — премиум-партнёр Visadel
          </h3>
          <p className="text-sm text-amber-800/80 mt-1.5 leading-relaxed">
            Получаете повышенный % с каждого оплаченного заказа ваших рефералов.
            Подробная статистика по доходу будет доступна в партнёрском кабинете.
          </p>
        </div>
      )}

      {/* ── 8. Referrals list — activity-style rows ─────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Загружаем…
        </div>
      ) : stats.referrals.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Ваши рефералы
            </p>
            <p className="text-xs text-gray-400 tabular-nums">{stats.referrals.length}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.referrals.slice(0, 8).map(r => (
              <ReferralRow key={r.telegram_id} r={r} />
            ))}
          </div>
          {stats.referrals.length > 8 && (
            <p className="text-xs text-gray-400 text-center mt-3">
              Показаны последние 8 из {stats.referrals.length}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-[#EAF1FF] text-[#3B5BFF] flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 tabular-nums">
        {n}
      </div>
      <p className="text-sm text-gray-700 leading-snug pt-0.5">{text}</p>
    </div>
  );
}

function SocialBtn({
  label, color, onClick, children,
}: {
  label: string;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  // Refined premium chip: soft brand-color tint background + full-color icon.
  // Inline style для динамического цвета фона (Tailwind не умеет dynamic arbitrary).
  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-2xl flex items-center justify-center transition active:scale-95 hover:brightness-95"
      style={{ backgroundColor: `${color}1A` }}
      title={label}
      aria-label={`Поделиться через ${label}`}
    >
      {children}
    </button>
  );
}

// Иконка мессенджера MAX — кастомный SVG (нет в react-icons/fa).
function MaxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="maxGradA">
          <stop offset="0" stopColor="#4cf" />
          <stop offset=".662" stopColor="#53e" />
          <stop offset="1" stopColor="#93d" />
        </linearGradient>
        <linearGradient id="maxC" x1="117.847" x2="1000" y1="760.536" y2="500" gradientUnits="userSpaceOnUse" href="#maxGradA" />
      </defs>
      <rect width="1000" height="1000" fill="url(#maxC)" ry="249.681" />
      <path fill="#fff" fillRule="evenodd" clipRule="evenodd" d="M508.211 878.328c-75.007 0-109.864-10.95-170.453-54.75-38.325 49.275-159.686 87.783-164.979 21.9 0-49.456-10.95-91.248-23.36-136.873-14.782-56.21-31.572-118.807-31.572-209.508 0-216.626 177.754-379.597 388.357-379.597 210.785 0 375.947 171.001 375.947 381.604.707 207.346-166.595 376.118-373.94 377.224m3.103-571.585c-102.564-5.292-182.499 65.7-200.201 177.024-14.6 92.162 11.315 204.398 33.397 210.238 10.585 2.555 37.23-18.98 53.837-35.587a189.8 189.8 0 0 0 92.71 33.032c106.273 5.112 197.08-75.794 204.215-181.95 4.154-106.382-77.67-196.486-183.958-202.574Z" />
    </svg>
  );
}

function SummaryCard({
  icon, label, value, loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3">
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-[10px] text-gray-500 uppercase tracking-wider leading-tight truncate">
          {label}
        </span>
      </div>
      <p className="text-xl font-semibold tabular-nums text-[#0F2A36]">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : value}
      </p>
    </div>
  );
}

function ReferralRow({ r }: { r: ReferralStats['referrals'][number] }) {
  const name = r.name || 'Друг';
  const dateStr = relativeDate(r.joined_at);
  const status = r.has_paid
    ? { text: 'Оплатил визу', cls: 'text-emerald-600 bg-emerald-50' }
    : { text: 'В ожидании',   cls: 'text-gray-500 bg-gray-50' };
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#0F2A36] truncate">{name}</p>
        <p className="text-xs text-gray-400 mt-0.5">{dateStr}</p>
      </div>
      <div className="flex items-center gap-2 ml-3 shrink-0">
        {r.has_paid && r.earned_bonus > 0 && (
          <span className="text-xs font-medium text-emerald-600 tabular-nums">
            +{r.earned_bonus}₽
          </span>
        )}
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${status.cls}`}>
          {status.text}
        </span>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return 'Сегодня';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';

  if (diffDays < 7) return `${diffDays} ${pluralDays(diffDays)} назад`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${pluralWeeks(weeks)} назад`;
  }

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

function pluralWeeks(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'недель';
  if (mod10 === 1) return 'неделю';
  if (mod10 >= 2 && mod10 <= 4) return 'недели';
  return 'недель';
}
