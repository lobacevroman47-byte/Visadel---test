import { useState, useEffect, useCallback } from 'react';
import { Gift, Flame, Save, Check, User, Mail, Phone, RefreshCw, History } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { getMaxBonusUsage } from '../../lib/bonus-config';
import { Button } from '../ui/brand';

interface ProfileTabProps {
  onBonusChange?: (newBalance: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Дата в локальной таймзоне (Москва) — раньше использовали toISOString()
// (UTC), и юзер открывший check-in в 02:00 МСК видел вчерашнюю дату → streak
// мог +1 после ~21 часа вместо 24, или ломаться на полночи.
// Берём дату по local-tz через Intl, формат YYYY-MM-DD.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayStr() { return localDateStr(new Date()); }
function yesterdayStr() { return localDateStr(new Date(Date.now() - 86_400_000)); }
function monthKey() { const n = new Date(); return `${n.getFullYear()}-${n.getMonth() + 1}`; }

const WEEK_MILESTONES = [7, 14, 21, 28];

// Separate meta key so App.tsx upsert never overwrites it
const META_KEY = 'vd_bonus_meta';

interface BonusMeta {
  weeklyBonusesClaimed: number;
  monthlyBonusesClaimed: string[];
}

function loadMeta(telegramId: number): BonusMeta {
  try {
    const raw = localStorage.getItem(`${META_KEY}_${telegramId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { weeklyBonusesClaimed: 0, monthlyBonusesClaimed: [] };
}
function saveMeta(telegramId: number, m: BonusMeta) {
  localStorage.setItem(`${META_KEY}_${telegramId}`, JSON.stringify(m));
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function getSupabaseUser(telegramId: number) {
  if (!isSupabaseConfigured() || !telegramId) return null;
  const { data } = await supabase.from('users')
    .select('bonus_balance,bonus_streak,last_bonus_date,phone,email,first_name,last_name,username,is_influencer')
    .eq('telegram_id', telegramId).single();
  return data as any;
}

async function logBonus(telegramId: number, type: string, amount: number, description: string) {
  if (!isSupabaseConfigured() || !telegramId) return;
  await supabase.from('bonus_logs').insert({ telegram_id: telegramId, type, amount, description });
}

async function updateUserBonus(telegramId: number, patch: {
  bonus_balance?: number; bonus_streak?: number; last_bonus_date?: string;
}) {
  if (!isSupabaseConfigured() || !telegramId) return;
  await supabase.from('users').update(patch).eq('telegram_id', telegramId);
}

// ── Streak strip ──────────────────────────────────────────────────────────────

function StreakStrip({ streak }: { streak: number }) {
  const done = streak % 7 === 0 && streak > 0 ? 7 : streak % 7;
  return (
    <div className="flex gap-1.5 justify-center mt-3">
      {[1, 2, 3, 4, 5, 6, 7].map(d => (
        <div key={d} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
          d < done  ? 'bg-white text-[#3B5BFF] shadow' :
          d === done ? 'bg-yellow-400 text-white shadow-lg scale-110' :
          'bg-white/20 text-white/50'
        }`}>
          {d < done ? '✓' : d === done && done > 0 ? '●' : d}
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileTab({ onBonusChange }: ProfileTabProps = {}) {
  const [loading, setLoading] = useState(true);

  // Core fields (synced with Supabase)
  const [telegramId, setTelegramId]   = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [streak, setStreak]           = useState(0);
  const [lastCheckIn, setLastCheckIn] = useState('');
  const [isPartner, setIsPartner]     = useState(false);

  // Meta (local per user, separate key)
  const [meta, setMetaState] = useState<BonusMeta>({ weeklyBonusesClaimed: 0, monthlyBonusesClaimed: [] });

  // Profile fields
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tgHandle, setTgHandle] = useState('');

  const [toast, setToast]               = useState('');
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [claimingWeekly, setClaimingWeekly] = useState(false);
  const [claimingMonthly, setClaimingMonthly] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved]   = useState(false);
  const [bonusHistory, setBonusHistory]   = useState<{ id: string; type: string; amount: number; description: string; created_at: string }[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── Load from Supabase (source of truth) ─────────────────────────────────
  const loadFromSupabase = useCallback(async (tgId: number) => {
    const [user, histRes] = await Promise.all([
      getSupabaseUser(tgId),
      isSupabaseConfigured()
        ? supabase.from('bonus_logs')
            .select('id,type,amount,description,created_at')
            .eq('telegram_id', tgId)
            // Партнёрские операции (partner_pending/approved/paid/cancelled) живут
            // в отдельном кошельке partner_balance и показываются в Партнёрском
            // кабинете. В профильную «Историю начислений» (про bonus_balance) их
            // мешать не нужно — это другая природа (заработок, не скидка).
            .not('type', 'like', 'partner_%')
            .order('created_at', { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] }),
    ]);
    if (user) {
      setBonusBalance(user.bonus_balance ?? 0);
      setStreak(user.bonus_streak ?? 0);
      setLastCheckIn(user.last_bonus_date ?? '');
      setPhone(user.phone ?? '');
      setEmail(user.email ?? '');
      setName([user.first_name, user.last_name].filter(Boolean).join(' '));
      setIsPartner(user.is_influencer ?? false);
      // Sync to localStorage so other components stay in sync
      const existing = (() => { try { return JSON.parse(localStorage.getItem('userData') ?? '{}'); } catch { return {}; } })();
      localStorage.setItem('userData', JSON.stringify({
        ...existing,
        bonusBalance: user.bonus_balance ?? 0,
        consecutiveDays: user.bonus_streak ?? 0,
        lastCheckIn: user.last_bonus_date ?? '',
      }));
    }
    setBonusHistory((histRes as any).data ?? []);
  }, []);

  useEffect(() => {
    // Get telegramId
    const ud = (() => { try { return JSON.parse(localStorage.getItem('userData') ?? '{}'); } catch { return {}; } })();
    const tgId: number = ud.telegramId ?? 0;
    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;

    setTelegramId(tgId);
    setTgHandle(ud.telegramHandle || ud.username || tgUser?.username || tgUser?.first_name || '');
    setName(ud.name || [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || '');
    setMetaState(loadMeta(tgId));

    if (tgId) {
      loadFromSupabase(tgId).finally(() => setLoading(false));
    } else {
      // Fallback to localStorage
      setBonusBalance(ud.bonusBalance ?? 0);
      setStreak(ud.consecutiveDays ?? 0);
      setLastCheckIn(ud.lastCheckIn ?? '');
      setLoading(false);
    }
  }, [loadFromSupabase]);

  // ── Daily check-in ────────────────────────────────────────────────────────
  const canCheckIn = lastCheckIn !== todayStr();

  const handleCheckIn = async () => {
    if (!canCheckIn || claimingDaily) return;
    setClaimingDaily(true);
    try {
      const wasYesterday = lastCheckIn === yesterdayStr();
      const newStreak    = wasYesterday ? streak + 1 : 1;
      const newBalance   = bonusBalance + 1;
      const today        = todayStr();

      setStreak(newStreak);
      setLastCheckIn(today);
      setBonusBalance(newBalance);
      onBonusChange?.(newBalance);

      // Reset weekly claims if streak broke
      if (!wasYesterday && meta.weeklyBonusesClaimed > 0) {
        const newMeta = { ...meta, weeklyBonusesClaimed: 0 };
        setMetaState(newMeta);
        saveMeta(telegramId, newMeta);
      }

      await updateUserBonus(telegramId, { bonus_balance: newBalance, bonus_streak: newStreak, last_bonus_date: today });
      await logBonus(telegramId, 'daily', 1, `Ежедневный вход — день ${newStreak}`);

      showToast('+1₽ — бонус получен! 🎉');
    } catch (e) { console.error(e); showToast('Ошибка, попробуй ещё раз'); }
    finally { setClaimingDaily(false); }
  };

  // ── Weekly bonus ──────────────────────────────────────────────────────────
  const weeklyUnlocked  = WEEK_MILESTONES.filter(m => streak >= m).length;
  const weeklyAvailable = weeklyUnlocked - meta.weeklyBonusesClaimed;

  const handleWeeklyBonus = async () => {
    if (weeklyAvailable <= 0 || claimingWeekly) return;
    setClaimingWeekly(true);
    try {
      const newBalance = bonusBalance + 5;
      const newMeta    = { ...meta, weeklyBonusesClaimed: meta.weeklyBonusesClaimed + 1 };
      setBonusBalance(newBalance);
      onBonusChange?.(newBalance);
      setMetaState(newMeta);
      saveMeta(telegramId, newMeta);
      await updateUserBonus(telegramId, { bonus_balance: newBalance });
      await logBonus(telegramId, 'weekly', 5, `Еженедельный бонус — неделя ${meta.weeklyBonusesClaimed + 1}`);
      showToast('+5₽ — еженедельный бонус! 🏆');
    } catch (e) { console.error(e); }
    finally { setClaimingWeekly(false); }
  };

  // ── Monthly bonus ─────────────────────────────────────────────────────────
  const currentMonth     = monthKey();
  const monthlyAvailable = streak >= 30 && !meta.monthlyBonusesClaimed.includes(currentMonth);

  const handleMonthlyBonus = async () => {
    if (!monthlyAvailable || claimingMonthly) return;
    setClaimingMonthly(true);
    try {
      const newBalance = bonusBalance + 30;
      const newMeta    = { ...meta, monthlyBonusesClaimed: [...meta.monthlyBonusesClaimed, currentMonth] };
      setBonusBalance(newBalance);
      onBonusChange?.(newBalance);
      setMetaState(newMeta);
      saveMeta(telegramId, newMeta);
      await updateUserBonus(telegramId, { bonus_balance: newBalance });
      await logBonus(telegramId, 'monthly', 30, `Месячный бонус — ${currentMonth}`);
      showToast('+30₽ — месячный бонус! 🌟');
    } catch (e) { console.error(e); }
    finally { setClaimingMonthly(false); }
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const existing = (() => { try { return JSON.parse(localStorage.getItem('userData') ?? '{}'); } catch { return {}; } })();
      localStorage.setItem('userData', JSON.stringify({ ...existing, name, phone, email, telegramHandle: tgHandle }));
      if (telegramId && isSupabaseConfigured()) {
        await supabase.from('users').update({ phone: phone || null, email: email || null }).eq('telegram_id', telegramId);
      }
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (e) { console.error(e); }
    finally { setSavingProfile(false); }
  };

  const progressInWeek = streak % 7 === 0 && streak > 0 ? 7 : streak % 7;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg animate-in slide-in-from-top-2 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* ── Daily check-in ────────────────────────────────────────────── */}
      <div className="vd-grad rounded-2xl p-5 text-white shadow-lg vd-shadow-cta">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Ежедневный вход</h3>
            <p className="text-white/80 text-xs mt-0.5">Заходи каждый день — копи бонусы</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <Flame className="w-5 h-5 text-orange-300" />
              <span className="text-2xl font-bold">{streak}</span>
            </div>
            <p className="text-white/80 text-xs">дней подряд</p>
          </div>
        </div>

        <StreakStrip streak={streak} />

        <div className="mt-3 mb-3">
          <div className="flex justify-between text-xs text-white/80 mb-1">
            <span>Прогресс недели</span>
            <span>{progressInWeek}/7</span>
          </div>
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${(progressInWeek / 7) * 100}%` }} />
          </div>
        </div>

        <button onClick={handleCheckIn} disabled={!canCheckIn || claimingDaily}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            canCheckIn ? 'bg-white text-[#3B5BFF] hover:bg-[#EAF1FF] active:scale-95 shadow'
                       : 'bg-white/20 text-white/60 cursor-not-allowed'
          }`}>
          {claimingDaily && <RefreshCw className="w-4 h-4 animate-spin" />}
          {canCheckIn ? '🎁 Получить +1₽' : '✓ Бонус получен на сегодня'}
        </button>

        {/* Награды за серию — мелкие пилл-кнопки прямо в карточке вместо
            отдельного блока. Каждая = майлстоун (7д/14д/21д/28д/30д).
            Стили под dark vd-grad фон:
              - locked    : полупрозрачный, замок, не кликабелен
              - available : белая капсула + brand-text + glow, click→claim
              - claimed   : полупрозрачный с галкой, муто
            +30₽ месячный отличается жёлтым акцентом когда доступен. */}
        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {WEEK_MILESTONES.map((days, i) => {
            const claimed   = i < meta.weeklyBonusesClaimed;
            const available = streak >= days && !claimed && i === meta.weeklyBonusesClaimed;
            return (
              <button
                key={days}
                onClick={available ? handleWeeklyBonus : undefined}
                disabled={!available || claimingWeekly}
                className={`rounded-lg py-2 px-1 flex flex-col items-center justify-center gap-0.5 transition ${
                  available ? 'bg-white text-[#3B5BFF] shadow-md active:scale-95 ring-2 ring-white/40 animate-pulse'
                  : claimed ? 'bg-white/15 text-white/50'
                  :           'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
                title={available ? `Забрать +5 ₽` : claimed ? 'Получен' : `Ещё ${days - streak} дн.`}
              >
                <span className="text-[10px] leading-none">
                  {claimed ? '✓' : available ? '🏆' : '🔒'}
                </span>
                <span className="text-[12px] font-bold tabular-nums leading-none">
                  {days}д
                </span>
                <span className="text-[9px] leading-none opacity-80">+5₽</span>
              </button>
            );
          })}
          {/* Месячный — 5-я ячейка справа, желтый акцент */}
          {(() => {
            const claimed = meta.monthlyBonusesClaimed.includes(currentMonth);
            return (
              <button
                onClick={monthlyAvailable ? handleMonthlyBonus : undefined}
                disabled={!monthlyAvailable || claimingMonthly}
                className={`rounded-lg py-2 px-1 flex flex-col items-center justify-center gap-0.5 transition ${
                  monthlyAvailable ? 'bg-yellow-300 text-yellow-900 shadow-md active:scale-95 ring-2 ring-yellow-200/50 animate-pulse'
                  : claimed ? 'bg-white/15 text-white/50'
                  :           'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
                title={monthlyAvailable ? `Забрать +30 ₽` : claimed ? 'Получен' : `Ещё ${30 - streak} дн.`}
              >
                <span className="text-[10px] leading-none">
                  {claimed ? '✓' : monthlyAvailable ? '🌟' : '🔒'}
                </span>
                <span className="text-[12px] font-bold tabular-nums leading-none">
                  30д
                </span>
                <span className="text-[9px] leading-none opacity-80">+30₽</span>
              </button>
            );
          })()}
        </div>
      </div>

      {/* ── My bonuses ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-5 h-5 text-purple-500" />
          <h3 className="text-sm font-semibold text-gray-700">Мои бонусы</h3>
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Доступно</p>
          <p className="text-4xl font-bold text-purple-600">{bonusBalance}₽</p>
          <p className="text-[11px] text-gray-500 mt-1">
            {(() => {
              const cap = getMaxBonusUsage(0, isPartner);
              if (cap == null) return 'Можно оплатить до 100% заказа';
              return `Можно списать до ${cap}₽ при оплате`;
            })()}
          </p>
        </div>
        <div className="space-y-2 text-sm">
          {(isPartner
            ? [
                ['🌟', 'До 20% с каждого заказа (визы, отели, билеты, страховки)'],
                ['💳', '100% оплата заказа бонусами'],
                ['👫', 'Реферальные начисления — за каждую оплаченную услугу'],
              ]
            : [
                ['💳', 'При заказе можно оплатить до 500₽ бонусами'],
                ['👫', '+500₽ за друга с оплаченной визой'],
                ['⭐', '+200₽ за оставленный отзыв'],
                ['🌟', 'Партнёрам — до 20% с каждого заказа'],
              ]
          ).map(([icon, text]) => (
            <div key={text} className="flex items-start gap-2">
              <span>{icon}</span>
              <p className="text-gray-600">{text}</p>
            </div>
          ))}
        </div>
        {/* Admin-кнопка перенесена в Home header справа от профиля
            (см. components/Home.tsx). Здесь больше не нужна. */}
      </div>

      {/* ── Bonus history ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-5 h-5 text-[#3B5BFF]" />
          <h3 className="text-sm font-semibold text-gray-700">История начислений</h3>
        </div>
        {bonusHistory.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Бонусов пока нет</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {bonusHistory.map(entry => {
              const cfg: Record<string, { icon: string; color: string }> = {
                daily:    { icon: '📅', color: 'text-[#3B5BFF]' },
                weekly:   { icon: '🏆', color: 'text-green-600' },
                monthly:  { icon: '🌟', color: 'text-yellow-600' },
                referral: { icon: '👫', color: 'text-purple-600' },
                visa:     { icon: '🎉', color: 'text-emerald-600' },
                review:   { icon: '⭐', color: 'text-pink-600' },
                payment:  { icon: '💳', color: 'text-indigo-600' },
              };
              const { icon, color } = cfg[entry.type] ?? { icon: '🎁', color: 'text-gray-600' };
              return (
                <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50">
                  <span className="text-base shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 truncate">{entry.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(entry.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${color}`}>+{entry.amount}₽</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Personal data ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-[#3B5BFF]" />
          <h3 className="text-sm font-semibold text-gray-700">Личные данные</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Имя</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#5C7BFF]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Telegram</label>
            <div className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 flex items-center gap-2">
              <span className="text-gray-400">@</span>
              <span>{tgHandle || '—'}</span>
              <span className="ml-auto text-xs text-gray-300">авто</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
              <Phone className="w-3 h-3" /> Телефон
            </label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+7 (999) 123-45-67"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#5C7BFF]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
              <Mail className="w-3 h-3" /> Email
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="example@mail.com"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#5C7BFF]" />
          </div>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handleSaveProfile}
            disabled={savingProfile}
            loading={savingProfile}
            leftIcon={!savingProfile ? (profileSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />) : undefined}
          >
            {profileSaved ? 'Сохранено!' : savingProfile ? 'Сохраняем...' : 'Сохранить данные'}
          </Button>
        </div>
      </div>

    </div>
  );
}
