import { useState, useEffect, useCallback } from 'react';
import { Gift, Flame, Shield, Save, Check, User, Mail, Phone, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface ProfileTabProps {
  onOpenInfluencerDashboard?: () => void;
  onOpenAdmin?: () => void;
  onBonusChange?: (newBalance: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }
function yesterdayStr() { return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); }
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
    .select('bonus_balance,bonus_streak,last_bonus_date,phone,email,first_name,last_name,username')
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
          d < done  ? 'bg-white text-blue-600 shadow' :
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

export default function ProfileTab({ onOpenInfluencerDashboard, onOpenAdmin, onBonusChange }: ProfileTabProps = {}) {
  const [loading, setLoading] = useState(true);

  // Core fields (synced with Supabase)
  const [telegramId, setTelegramId]   = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [streak, setStreak]           = useState(0);
  const [lastCheckIn, setLastCheckIn] = useState('');

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

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── Load from Supabase (source of truth) ─────────────────────────────────
  const loadFromSupabase = useCallback(async (tgId: number) => {
    const user = await getSupabaseUser(tgId);
    if (user) {
      setBonusBalance(user.bonus_balance ?? 0);
      setStreak(user.bonus_streak ?? 0);
      setLastCheckIn(user.last_bonus_date ?? '');
      setPhone(user.phone ?? '');
      setEmail(user.email ?? '');
      setName([user.first_name, user.last_name].filter(Boolean).join(' '));
      // Sync to localStorage so other components stay in sync
      const existing = (() => { try { return JSON.parse(localStorage.getItem('userData') ?? '{}'); } catch { return {}; } })();
      localStorage.setItem('userData', JSON.stringify({
        ...existing,
        bonusBalance: user.bonus_balance ?? 0,
        consecutiveDays: user.bonus_streak ?? 0,
        lastCheckIn: user.last_bonus_date ?? '',
      }));
    }
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
      <div className="bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Ежедневный вход</h3>
            <p className="text-blue-100 text-xs mt-0.5">Заходи каждый день — копи бонусы</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <Flame className="w-5 h-5 text-orange-300" />
              <span className="text-2xl font-bold">{streak}</span>
            </div>
            <p className="text-blue-100 text-xs">дней подряд</p>
          </div>
        </div>

        <StreakStrip streak={streak} />

        <div className="mt-3 mb-3">
          <div className="flex justify-between text-xs text-blue-100 mb-1">
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
            canCheckIn ? 'bg-white text-blue-600 hover:bg-blue-50 active:scale-95 shadow'
                       : 'bg-white/20 text-white/60 cursor-not-allowed'
          }`}>
          {claimingDaily && <RefreshCw className="w-4 h-4 animate-spin" />}
          {canCheckIn ? '🎁 Получить +1₽' : '✓ Бонус получен на сегодня'}
        </button>

        <p className="mt-3 text-xs text-blue-100 text-center">
          +1₽ ежедневно · +5₽ каждую неделю · +30₽ за месяц
        </p>
      </div>

      {/* ── Milestones ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Бонусы за серию входов</h3>
        <div className="space-y-2">
          {WEEK_MILESTONES.map((days, i) => {
            const unlocked  = streak >= days;
            const claimed   = i < meta.weeklyBonusesClaimed;
            const available = unlocked && !claimed && i === meta.weeklyBonusesClaimed;
            return (
              <div key={days} className={`flex items-center justify-between p-3 rounded-xl ${
                claimed ? 'bg-gray-50' : unlocked ? 'bg-green-50 border border-green-100' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{claimed ? '✅' : unlocked ? '🏆' : '🔒'}</span>
                  <div>
                    <p className={`text-sm font-medium ${claimed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      Неделя {i + 1} · {days} дней подряд
                    </p>
                    <p className="text-xs text-gray-400">+5₽ еженедельный бонус</p>
                  </div>
                </div>
                {available ? (
                  <button onClick={handleWeeklyBonus} disabled={claimingWeekly}
                    className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 active:scale-95 transition-all disabled:opacity-50">
                    {claimingWeekly ? '...' : 'Забрать'}
                  </button>
                ) : (
                  <span className={`text-xs font-semibold ${claimed ? 'text-gray-400' : unlocked ? 'text-green-600' : 'text-gray-300'}`}>
                    {claimed ? 'Получен' : unlocked ? 'Доступен' : `ещё ${days - streak} дн.`}
                  </span>
                )}
              </div>
            );
          })}

          {/* Monthly */}
          {(() => {
            const claimed  = meta.monthlyBonusesClaimed.includes(currentMonth);
            const unlocked = streak >= 30;
            return (
              <div className={`flex items-center justify-between p-3 rounded-xl ${
                claimed ? 'bg-gray-50' : unlocked ? 'bg-yellow-50 border border-yellow-100' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{claimed ? '✅' : unlocked ? '🌟' : '🔒'}</span>
                  <div>
                    <p className={`text-sm font-medium ${claimed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      Месяц · 30 дней подряд
                    </p>
                    <p className="text-xs text-gray-400">+30₽ ежемесячный бонус</p>
                  </div>
                </div>
                {monthlyAvailable ? (
                  <button onClick={handleMonthlyBonus} disabled={claimingMonthly}
                    className="px-3 py-1.5 bg-yellow-500 text-white text-xs font-semibold rounded-lg hover:bg-yellow-600 active:scale-95 transition-all disabled:opacity-50">
                    {claimingMonthly ? '...' : 'Забрать'}
                  </button>
                ) : (
                  <span className={`text-xs font-semibold ${claimed ? 'text-gray-400' : unlocked ? 'text-yellow-600' : 'text-gray-300'}`}>
                    {claimed ? 'Получен' : unlocked ? 'Доступен' : `ещё ${30 - streak} дн.`}
                  </span>
                )}
              </div>
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
        </div>
        <div className="space-y-2 text-sm">
          {[
            ['💳', 'При заказе можно оплатить до 500₽ бонусами'],
            ['👫', '+500₽ за друга с оплаченной визой'],
            ['🎉', '+100₽ после получения своей визы'],
            ['⭐', '+100₽ за оставленный отзыв'],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-start gap-2">
              <span>{icon}</span>
              <p className="text-gray-600">{text}</p>
            </div>
          ))}
        </div>
        {onOpenAdmin && (
          <button onClick={onOpenAdmin}
            className="w-full mt-4 bg-gradient-to-r from-gray-700 to-gray-900 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium hover:shadow-lg transition">
            <Shield className="w-4 h-4" /> Админ-панель
          </button>
        )}
      </div>

      {/* ── Personal data ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-700">Личные данные</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Имя</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400" />
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
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
              <Mail className="w-3 h-3" /> Email
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="example@mail.com"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400" />
          </div>
          <button onClick={handleSaveProfile} disabled={savingProfile}
            className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95">
            {profileSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {profileSaved ? 'Сохранено!' : savingProfile ? 'Сохраняем...' : 'Сохранить данные'}
          </button>
        </div>
      </div>

      {/* ── Partner cabinet ───────────────────────────────────────────── */}
      {onOpenInfluencerDashboard && (
        <button onClick={onOpenInfluencerDashboard}
          className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between hover:bg-gray-50 active:scale-95 transition-all">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤝</span>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-700">Партнёрский кабинет</p>
              <p className="text-xs text-gray-400">Реферальная программа и статистика</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      )}
    </div>
  );
}
