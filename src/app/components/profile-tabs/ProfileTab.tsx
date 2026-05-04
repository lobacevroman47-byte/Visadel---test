import { useState, useEffect } from 'react';
import { Gift, Flame, Shield, Save, Check, User, Mail, Phone, ChevronRight } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface ProfileTabProps {
  onOpenInfluencerDashboard?: () => void;
  onOpenAdmin?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}
function todayStr() { return toDateStr(new Date()); }
function yesterdayStr() { return toDateStr(new Date(Date.now() - 86_400_000)); }
function monthKey() {
  const n = new Date();
  return `${n.getFullYear()}-${n.getMonth() + 1}`;
}

// Weekly bonus is unlocked at streak days 7, 14, 21, 28
const WEEK_MILESTONES = [7, 14, 21, 28];

interface StoredData {
  // identity
  name: string; email: string; phone: string; telegramHandle: string; telegramId: number;
  // bonuses
  bonusBalance: number;
  // streak
  consecutiveDays: number;
  lastCheckIn: string;
  totalCheckIns: number;
  // claimed milestones
  weeklyBonusesClaimed: number;   // how many weekly bonuses claimed in current streak
  monthlyBonusesClaimed: string[]; // array of "YYYY-M" strings
}

const DEFAULT: StoredData = {
  name: '', email: '', phone: '', telegramHandle: '', telegramId: 0,
  bonusBalance: 0, consecutiveDays: 0, lastCheckIn: '',
  totalCheckIns: 0, weeklyBonusesClaimed: 0, monthlyBonusesClaimed: [],
};

function loadData(): StoredData {
  try {
    const raw = localStorage.getItem('userData');
    if (!raw) return DEFAULT;
    const p = JSON.parse(raw);
    return {
      name: p.name ?? '',
      email: p.email ?? '',
      phone: p.phone ?? '',
      telegramHandle: p.telegramHandle ?? p.telegram ?? '',
      telegramId: Number(p.telegramId) || 0,
      bonusBalance: Number(p.bonusBalance) || 0,
      consecutiveDays: Number(p.consecutiveDays) || 0,
      lastCheckIn: p.lastCheckIn ?? '',
      totalCheckIns: Number(p.totalCheckIns) || 0,
      weeklyBonusesClaimed: Number(p.weeklyBonusesClaimed) || 0,
      monthlyBonusesClaimed: Array.isArray(p.monthlyBonusesClaimed) ? p.monthlyBonusesClaimed : [],
    };
  } catch { return DEFAULT; }
}

function saveData(d: StoredData) {
  localStorage.setItem('userData', JSON.stringify(d));
}

async function syncBonus(telegramId: number, newBalance: number) {
  if (!telegramId || !isSupabaseConfigured()) return;
  await supabase.from('users').update({ bonus_balance: newBalance }).eq('telegram_id', telegramId);
}

// ── Streak calendar strip (7 dots showing current week progress) ──────────────

function StreakStrip({ streak }: { streak: number }) {
  const weekPos = ((streak - 1) % 7) + 1; // position within current week (1-7)
  return (
    <div className="flex gap-1.5 justify-center mt-3">
      {[1, 2, 3, 4, 5, 6, 7].map(d => (
        <div key={d} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
          d < weekPos ? 'bg-white text-blue-600 shadow' :
          d === weekPos ? 'bg-yellow-400 text-white shadow-lg scale-110' :
          'bg-white/20 text-white/50'
        }`}>
          {d < weekPos ? '✓' : d === weekPos ? '●' : d}
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ProfileTab({ onOpenInfluencerDashboard, onOpenAdmin }: ProfileTabProps = {}) {
  const [data, setData]           = useState<StoredData>(loadData);
  const [toast, setToast]         = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved]   = useState(false);

  // ── Auto-fill from Telegram on mount ─────────────────────────────────────
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    if (!tg) return;
    setData(prev => {
      const updated = {
        ...prev,
        telegramId: tg.id ?? prev.telegramId,
        name: prev.name || [tg.first_name, tg.last_name].filter(Boolean).join(' '),
        telegramHandle: prev.telegramHandle || tg.username || tg.phone_number || tg.first_name || '',
      };
      saveData(updated);
      return updated;
    });
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const update = (patch: Partial<StoredData>) => {
    setData(prev => { const n = { ...prev, ...patch }; saveData(n); return n; });
  };

  // ── Daily check-in ────────────────────────────────────────────────────────
  const canCheckIn = data.lastCheckIn !== todayStr();

  const handleCheckIn = () => {
    if (!canCheckIn) { showToast('Бонус уже получен сегодня'); return; }

    const wasYesterday = data.lastCheckIn === yesterdayStr();
    const newStreak    = wasYesterday ? data.consecutiveDays + 1 : 1;
    const newBalance   = data.bonusBalance + 1;

    const patch: Partial<StoredData> = {
      consecutiveDays: newStreak,
      lastCheckIn: todayStr(),
      totalCheckIns: data.totalCheckIns + 1,
      bonusBalance: newBalance,
      // Reset weekly claims if streak broke
      weeklyBonusesClaimed: wasYesterday ? data.weeklyBonusesClaimed : 0,
    };

    update(patch);
    syncBonus(data.telegramId, newBalance);
    showToast('+1₽ — бонус получен! 🎉');
  };

  // ── Weekly bonus claim ────────────────────────────────────────────────────
  // How many weekly milestones are UNLOCKED in current streak
  const weeklyUnlocked = WEEK_MILESTONES.filter(m => data.consecutiveDays >= m).length;
  const weeklyAvailable = weeklyUnlocked - data.weeklyBonusesClaimed;

  const handleWeeklyBonus = () => {
    if (weeklyAvailable <= 0) return;
    const newBalance = data.bonusBalance + 5;
    update({ bonusBalance: newBalance, weeklyBonusesClaimed: data.weeklyBonusesClaimed + 1 });
    syncBonus(data.telegramId, newBalance);
    showToast('+5₽ — еженедельный бонус! 🏆');
  };

  // ── Monthly bonus claim ───────────────────────────────────────────────────
  const currentMonth = monthKey();
  const monthlyAvailable =
    data.consecutiveDays >= 30 &&
    !data.monthlyBonusesClaimed.includes(currentMonth);

  const handleMonthlyBonus = () => {
    if (!monthlyAvailable) return;
    const newBalance = data.bonusBalance + 30;
    update({
      bonusBalance: newBalance,
      monthlyBonusesClaimed: [...data.monthlyBonusesClaimed, currentMonth],
    });
    syncBonus(data.telegramId, newBalance);
    showToast('+30₽ — месячный бонус! 🌟');
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      saveData(data);
      if (data.telegramId && isSupabaseConfigured()) {
        await supabase.from('users').update({
          phone: data.phone || null,
          email: data.email || null,
        }).eq('telegram_id', data.telegramId);
      }
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (e) { console.error(e); }
    finally { setSavingProfile(false); }
  };

  // ── Next milestone label ──────────────────────────────────────────────────
  const nextMilestone = WEEK_MILESTONES.find(m => data.consecutiveDays < m) ?? 30;
  const progressToNext = data.consecutiveDays % 7;

  return (
    <div className="space-y-4 pb-6">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg animate-in slide-in-from-top-2 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* ── Daily check-in card ──────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Ежедневный вход</h3>
            <p className="text-blue-100 text-xs mt-0.5">Заходи каждый день — копи бонусы</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <Flame className="w-5 h-5 text-orange-300" />
              <span className="text-2xl font-bold">{data.consecutiveDays}</span>
            </div>
            <p className="text-blue-100 text-xs">дней подряд</p>
          </div>
        </div>

        {/* Week progress strip */}
        <StreakStrip streak={data.consecutiveDays} />

        {/* Milestone progress */}
        <div className="mt-3 mb-3">
          <div className="flex justify-between text-xs text-blue-100 mb-1">
            <span>До следующей недели</span>
            <span>{progressToNext}/7</span>
          </div>
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${(progressToNext / 7) * 100}%` }}
            />
          </div>
        </div>

        {/* Check-in button */}
        <button
          onClick={handleCheckIn}
          disabled={!canCheckIn}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
            canCheckIn
              ? 'bg-white text-blue-600 hover:bg-blue-50 active:scale-95 shadow'
              : 'bg-white/20 text-white/60 cursor-not-allowed'
          }`}
        >
          {canCheckIn ? '🎁 Получить +1₽' : '✓ Бонус получен на сегодня'}
        </button>

        {/* Rules hint */}
        <div className="mt-3 text-xs text-blue-100 space-y-0.5">
          <p>• +1₽ каждый день • +5₽ за каждую неделю • +30₽ за месяц</p>
        </div>
      </div>

      {/* ── Milestones (weekly + monthly) ───────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Бонусы за серию входов</h3>
        <div className="space-y-2">

          {/* 4 weekly milestones */}
          {WEEK_MILESTONES.map((days, i) => {
            const unlocked = data.consecutiveDays >= days;
            const claimed  = i < data.weeklyBonusesClaimed;
            const available = unlocked && !claimed && weeklyAvailable > 0 &&
              (i === data.weeklyBonusesClaimed); // can only claim in order

            return (
              <div key={days} className={`flex items-center justify-between p-3 rounded-xl ${
                claimed ? 'bg-gray-50' : unlocked ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{claimed ? '✅' : unlocked ? '🏆' : '🔒'}</span>
                  <div>
                    <p className={`text-sm font-medium ${claimed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      Неделя {i + 1} — {days} дней подряд
                    </p>
                    <p className="text-xs text-gray-400">+5₽ еженедельный бонус</p>
                  </div>
                </div>
                {available ? (
                  <button
                    onClick={handleWeeklyBonus}
                    className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 active:scale-95 transition-all"
                  >
                    Забрать
                  </button>
                ) : (
                  <span className={`text-xs font-semibold ${claimed ? 'text-gray-400' : unlocked ? 'text-green-600' : 'text-gray-300'}`}>
                    {claimed ? 'Получен' : unlocked ? 'Доступен' : `${days - data.consecutiveDays} дн.`}
                  </span>
                )}
              </div>
            );
          })}

          {/* Monthly bonus */}
          {(() => {
            const claimed = data.monthlyBonusesClaimed.includes(currentMonth);
            const unlocked = data.consecutiveDays >= 30;
            return (
              <div className={`flex items-center justify-between p-3 rounded-xl ${
                claimed ? 'bg-gray-50' : unlocked ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{claimed ? '✅' : unlocked ? '🌟' : '🔒'}</span>
                  <div>
                    <p className={`text-sm font-medium ${claimed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      Месячный — 30 дней подряд
                    </p>
                    <p className="text-xs text-gray-400">+30₽ ежемесячный бонус</p>
                  </div>
                </div>
                {monthlyAvailable ? (
                  <button
                    onClick={handleMonthlyBonus}
                    className="px-3 py-1.5 bg-yellow-500 text-white text-xs font-semibold rounded-lg hover:bg-yellow-600 active:scale-95 transition-all"
                  >
                    Забрать
                  </button>
                ) : (
                  <span className={`text-xs font-semibold ${claimed ? 'text-gray-400' : unlocked ? 'text-yellow-600' : 'text-gray-300'}`}>
                    {claimed ? 'Получен' : unlocked ? 'Доступен' : `${30 - data.consecutiveDays} дн.`}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── My bonuses ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-5 h-5 text-purple-500" />
          <h3 className="text-sm font-semibold text-gray-700">Мои бонусы</h3>
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Доступно</p>
          <p className="text-4xl font-bold text-purple-600">{data.bonusBalance}₽</p>
        </div>
        <div className="space-y-2 text-sm">
          {[
            { icon: '💳', text: 'При заказе можно оплатить до 500₽ бонусами' },
            { icon: '👫', text: '+500₽ за друга с оплаченной визой' },
            { icon: '🎉', text: '+100₽ после получения своей визы' },
            { icon: '⭐', text: '+100₽ за оставленный отзыв' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-start gap-2">
              <span>{icon}</span>
              <p className="text-gray-600">{text}</p>
            </div>
          ))}
        </div>

        {/* Admin button */}
        {onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="w-full mt-4 bg-gradient-to-r from-gray-700 to-gray-900 text-white py-2.5 rounded-xl hover:shadow-lg transition flex items-center justify-center gap-2 text-sm font-medium"
          >
            <Shield className="w-4 h-4" />
            Админ-панель
          </button>
        )}
      </div>

      {/* ── Personal data ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-700">Личные данные</h3>
        </div>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Имя</label>
            <input
              type="text"
              value={data.name}
              onChange={e => setData(d => ({ ...d, name: e.target.value }))}
              placeholder="Иван Иванов"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            />
          </div>

          {/* Telegram (auto, read-only) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Telegram</label>
            <div className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 flex items-center gap-2">
              <span className="text-gray-400">@</span>
              <span>{data.telegramHandle || '—'}</span>
              <span className="ml-auto text-xs text-gray-300">авто</span>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
              <Phone className="w-3 h-3" /> Телефон
            </label>
            <input
              type="tel"
              value={data.phone}
              onChange={e => setData(d => ({ ...d, phone: e.target.value }))}
              placeholder="+7 (999) 123-45-67"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
              <Mail className="w-3 h-3" /> Email
            </label>
            <input
              type="email"
              value={data.email}
              onChange={e => setData(d => ({ ...d, email: e.target.value }))}
              placeholder="example@mail.com"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            />
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {profileSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {profileSaved ? 'Сохранено!' : savingProfile ? 'Сохраняем...' : 'Сохранить данные'}
          </button>
        </div>
      </div>

      {/* Partner cabinet — compact link */}
      {onOpenInfluencerDashboard && (
        <button
          onClick={onOpenInfluencerDashboard}
          className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between text-sm hover:bg-gray-50 active:scale-95 transition-all"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🤝</span>
            <div className="text-left">
              <p className="font-medium text-gray-700">Партнёрский кабинет</p>
              <p className="text-xs text-gray-400">Реферальная программа и статистика</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      )}
    </div>
  );
}
