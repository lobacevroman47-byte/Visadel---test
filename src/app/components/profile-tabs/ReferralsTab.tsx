import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, Award, Loader2, Copy, Share2, Check, Crown, Star,
  Sparkles, ChevronRight, QrCode, Download, UserPlus, Wallet,
  Activity, Clock,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useTelegram } from '../../App';
import { getReferralStats, type ReferralStats } from '../../lib/db';
import { apiFetch } from '../../lib/apiFetch';
import {
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
  const shareText = `Оформляйте визу с Visadel Agency. По моей ссылке вы получите 200₽ на первую визу.`;

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
  // Открывает системный share sheet (iOS/Android) либо нативный Telegram-шаринг.
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

  // Activity Timeline — последние 10 событий, построенные из referrals.
  // Каждый ref → событие "registered". Если has_paid → ещё событие "paid".
  // (без отдельного paid_at используем joined_at — в активном prod-режиме обычно
  // оплата идёт в тот же день что и регистрация, разницей пренебрегаем).
  const timelineEvents = useMemo(() => {
    type Evt = { when: Date; text: string; type: 'register' | 'paid' };
    const events: Evt[] = [];
    for (const r of stats.referrals) {
      const date = new Date(r.joined_at);
      const name = (r.name || 'Друг').split(' ')[0];
      events.push({ when: date, text: `${name} перешёл по вашей ссылке`, type: 'register' });
      if (r.has_paid) {
        events.push({
          when: date,
          text: `${name} оплатил визу${r.earned_bonus > 0 ? ` — +${r.earned_bonus}₽` : ''}`,
          type: 'paid',
        });
      }
    }
    return events.sort((a, b) => b.when.getTime() - a.when.getTime()).slice(0, 10);
  }, [stats.referrals]);

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

      {/* ── 1. Hero — clean premium header ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-[19px] font-semibold text-[#0F2A36] tracking-tight">
          Партнёрская программа
        </h2>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
          Получайте бонусы за визы, брони отелей и авиабилеты приглашённых пользователей.
        </p>
        <div className={`grid ${isPartner ? 'grid-cols-1' : 'grid-cols-2'} gap-2 mt-4`}>
          <button
            onClick={scrollToShare}
            className="vd-grad text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition vd-shadow-cta"
          >
            <UserPlus className="w-4 h-4" /> Пригласить
          </button>
          {!isPartner && (
            <button
              onClick={onOpenPartnerApplication}
              className="bg-[#EAF1FF] text-[#3B5BFF] py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-[#DCE6FF] active:scale-[0.98] transition"
            >
              <Sparkles className="w-4 h-4" /> Стать партнёром
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Share section — clean, monochrome ─────────────────────── */}
      <div ref={shareSectionRef} className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">
          Ваша ссылка
        </p>
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 mb-3">
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
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={copyLink}
            className="py-2.5 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 active:scale-[0.98] transition flex items-center justify-center gap-1.5 text-gray-700"
          >
            {copied
              ? <><Check className="w-4 h-4 text-emerald-600" /> Скопировано</>
              : <><Copy className="w-4 h-4" /> Скопировать</>}
          </button>
          <button
            onClick={nativeShare}
            className="py-2.5 rounded-xl text-sm font-medium vd-grad text-white active:scale-[0.98] transition flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-4 h-4" /> Поделиться
          </button>
        </div>
        <button
          onClick={() => setShowQR(s => !s)}
          className="w-full mt-3 py-2 text-xs text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1.5 transition"
        >
          <QrCode className="w-3.5 h-3.5" /> {showQR ? 'Скрыть QR-код' : 'Показать QR-код'}
        </button>
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

      {/* ── 3. Levels — compact pills ──────────────────────────────────── */}
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
      </div>

      {/* ── 4. Earnings summary — compact stat cards ───────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <SummaryCard
          icon={<Wallet className="w-3.5 h-3.5 text-emerald-600" />}
          label="Заработано"
          value={`${stats.totalEarnings.toLocaleString('ru-RU')}₽`}
          accent
          loading={loading}
        />
        <SummaryCard
          icon={<Users className="w-3.5 h-3.5 text-[#3B5BFF]" />}
          label="Приглашено"
          value={stats.registered}
          loading={loading}
        />
        <SummaryCard
          icon={<Activity className="w-3.5 h-3.5 text-amber-500" />}
          label="Активных заявок"
          value={Math.max(0, stats.registered - stats.paidReferrals)}
          loading={loading}
        />
        <SummaryCard
          icon={<Award className="w-3.5 h-3.5 text-violet-500" />}
          label="Оплатили"
          value={stats.paidReferrals}
          loading={loading}
        />
      </div>

      {/* ── 5. Partner banner — premium dark card, only for non-partners ─ */}
      {!isPartner && (
        <div className="bg-gradient-to-br from-[#0F2A36] to-[#1F3A48] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-amber-300" />
            <span className="text-[11px] font-medium text-amber-300 uppercase tracking-wider">
              Партнёрство
            </span>
          </div>
          <h3 className="text-base font-semibold leading-tight">
            Станьте партнёром Visadel
          </h3>
          <p className="text-sm text-white/70 mt-1.5 leading-relaxed">
            Получайте повышенные бонусы за визы, брони отелей и авиабилеты приглашённых клиентов.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-white/90">
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> До 20% бонусов
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Подробная статистика
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Выплаты бонусами
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Персональная поддержка
            </li>
          </ul>
          <button
            onClick={onOpenPartnerApplication}
            className="w-full mt-5 bg-white text-[#0F2A36] py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50 active:scale-[0.98] transition"
          >
            Стать партнёром <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── 6. Referrals list — activity-style rows ─────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Загружаем…
        </div>
      ) : stats.referrals.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Рефералы
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

      {/* ── 7. Activity timeline ─────────────────────────────────────────── */}
      {timelineEvents.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-3">
            Активность
          </p>
          <Timeline events={timelineEvents} />
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function SummaryCard({
  icon, label, value, accent, loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3.5">
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-[10px] text-gray-500 uppercase tracking-wider leading-tight">
          {label}
        </span>
      </div>
      <p className={`text-xl font-semibold tabular-nums ${accent ? 'text-emerald-600' : 'text-[#0F2A36]'}`}>
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

function Timeline({ events }: { events: Array<{ when: Date; text: string; type: 'register' | 'paid' }> }) {
  // Group events by relative date bucket (Сегодня / Вчера / N дней назад)
  const groups = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) {
      const k = relativeDate(e.when.toISOString());
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries());
  }, [events]);

  return (
    <div className="space-y-3">
      {groups.map(([when, items]) => (
        <div key={when}>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {when}
          </p>
          {items.map((e, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${e.type === 'paid' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              <p className="text-sm text-gray-700 leading-snug">{e.text}</p>
            </div>
          ))}
        </div>
      ))}
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
