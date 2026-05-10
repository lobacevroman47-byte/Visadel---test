import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Users, Globe, TrendingUp, Wallet, Coins, Loader2,
  Info, ChevronDown,
} from 'lucide-react';
import { useAdminApplications, useAdminUsers } from '../hooks/useAdminData';
import { getFinanceStats, type FinanceStats } from '../../lib/db';
import { Card } from '../../components/ui/brand';

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  onClick?: () => void;
}> = ({ icon, label, value, color, onClick }) => (
  <Card
    variant="flat"
    padding="lg"
    radius="xl"
    className={`transition-all ${onClick ? 'cursor-pointer hover:shadow-lg hover:border-[#3B5BFF]' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-[#0F2A36]/65 mb-1">{label}</p>
        <p className="text-2xl text-[#0F2A36]">{value}</p>
      </div>
      <div className="p-3 rounded-lg" style={{ backgroundColor: color + '20' }}>
        <div style={{ color }}>{icon}</div>
      </div>
    </div>
  </Card>
);

interface DashboardProps {
  onNavigate?: (section: string, filter?: any) => void;
}

type Period = '1d' | '7d' | '30d' | '90d' | '1y' | 'all';
const PERIODS: { id: Period; label: string; days: number }[] = [
  { id: '1d',  label: 'Сегодня',     days: 1 },
  { id: '7d',  label: '7 дней',      days: 7 },
  { id: '30d', label: '30 дней',     days: 30 },
  { id: '90d', label: '3 месяца',    days: 90 },
  { id: '1y',  label: '1 год',       days: 365 },
  { id: 'all', label: 'Всё время',   days: 0 },
];

const fmtRub = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;

// ─── Finance Section ──────────────────────────────────────────────────────────
const FinanceSection: React.FC = () => {
  const [period, setPeriod] = useState<Period>('30d');
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRevenueFormula, setShowRevenueFormula] = useState(false);
  const [showProfitFormula, setShowProfitFormula] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const days = PERIODS.find(p => p.id === period)?.days ?? 30;
    getFinanceStats(days)
      .then(s => { if (alive) setStats(s); })
      .catch(e => console.warn('Finance stats error:', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [period]);

  const margin = useMemo(() => {
    if (!stats || stats.revenue <= 0) return 0;
    return Math.round((stats.profit / stats.revenue) * 100);
  }, [stats]);

  const chartData = stats?.series ?? [];
  const maxRev = Math.max(1, ...chartData.map(d => d.revenue));

  return (
    <Card variant="flat" padding="lg" radius="xl" className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100">
            <Wallet size={20} className="text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-[#0F2A36]">Финансы</h3>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[#0F2A36]/45" />}
        </div>
        <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                period === p.id ? 'bg-white text-[#3B5BFF] shadow-sm' : 'text-[#0F2A36]/60 hover:text-[#0F2A36]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hero metrics — Revenue / Profit / Bonuses owed */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Revenue */}
        <div className="vd-grad p-5 rounded-2xl text-white vd-shadow-cta">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs uppercase tracking-wider opacity-80">Выручка</p>
            <button
              type="button"
              onClick={() => setShowRevenueFormula(v => !v)}
              className="p-1 -m-1 rounded hover:bg-white/10 transition flex items-center gap-1 text-xs opacity-80 hover:opacity-100"
              aria-label="Показать формулу выручки"
            >
              <Info size={14} />
              <ChevronDown size={12} className={`transition-transform ${showRevenueFormula ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <p className="text-3xl font-bold leading-tight">{fmtRub(stats?.revenue ?? 0)}</p>
          <p className="text-xs opacity-75 mt-1">
            {stats?.paidApplicationsCount ?? 0} визы · {stats?.bookingsCount ?? 0} брони · после скидок бонусами
          </p>
          {showRevenueFormula && (
            <div className="mt-3 pt-3 border-t border-white/20 text-xs space-y-2 leading-relaxed">
              <p className="font-semibold opacity-90">Как считается выручка</p>

              <div className="space-y-1">
                <p className="opacity-90">Визы <span className="float-right font-mono">{fmtRub(stats?.visaRevenue ?? 0)}</span></p>
                <p className="opacity-70 text-[11px]">Цена визы минус списанные клиентом бонусы (учитываются только оплаченные заявки — статусы «В работе» и «Готово»).</p>
              </div>

              <div className="space-y-1 pt-1 border-t border-white/15">
                <p className="opacity-90">Брони (отель + авиабилет) <span className="float-right font-mono">{fmtRub(stats?.bookingsRevenue ?? 0)}</span></p>
                <p className="opacity-70 text-[11px]">Сумма цен по подтверждённым броням отелей и авиабилетов (статус «Готово»). Бонусами оплата броней пока не предусмотрена.</p>
              </div>

              <p className="font-semibold opacity-100 pt-2 border-t border-white/20">
                Итого выручка <span className="float-right font-mono">{fmtRub(stats?.revenue ?? 0)}</span>
              </p>
              <p className="opacity-70 text-[11px]">Списанные бонусы — это уже потерянная нами скидка, поэтому они вычитаются из выручки сразу.</p>
            </div>
          )}
        </div>

        {/* Profit */}
        <div className={`p-5 rounded-xl text-white bg-gradient-to-br ${(stats?.profit ?? 0) >= 0 ? 'from-emerald-500 to-emerald-700' : 'from-red-500 to-red-700'}`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs uppercase tracking-wider opacity-80">Прибыль</p>
            <button
              type="button"
              onClick={() => setShowProfitFormula(v => !v)}
              className="p-1 -m-1 rounded hover:bg-white/10 transition flex items-center gap-1 text-xs opacity-80 hover:opacity-100"
              aria-label="Показать формулу прибыли"
            >
              <Info size={14} />
              <ChevronDown size={12} className={`transition-transform ${showProfitFormula ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <p className="text-3xl font-bold leading-tight">{fmtRub(stats?.profit ?? 0)}</p>
          <p className="text-xs opacity-75 mt-1">маржа {margin}%</p>
          {showProfitFormula && (
            <div className="mt-3 pt-3 border-t border-white/20 text-xs space-y-1 leading-relaxed font-mono">
              <p className="font-sans font-semibold opacity-90 mb-2">Как считается прибыль</p>
              <p className="opacity-90">Выручка (визы + брони) <span className="float-right">{fmtRub(stats?.revenue ?? 0)}</span></p>
              <p className="opacity-80">− Себестоимость <span className="float-right">−{fmtRub(stats?.costOfGoods ?? 0)}</span></p>
              <p className="opacity-80">− Налог (УСН) <span className="float-right">−{fmtRub(stats?.taxes ?? 0)}</span></p>
              <p className="opacity-80">− Выплачено партнёрам <span className="float-right">−{fmtRub(stats?.commissionsPaid ?? 0)}</span></p>
              <p className="font-semibold opacity-100 pt-1 border-t border-white/20">= Прибыль <span className="float-right">{fmtRub(stats?.profit ?? 0)}</span></p>
              <div className="font-sans opacity-75 pt-2 leading-snug space-y-1.5">
                <p><span className="opacity-100 font-semibold">Себестоимость</span> состоит из:</p>
                <p>• По визам: ($сбор + $комиссия посольства) × курс USD заявки + себестоимость доп. услуг (например, билет 780₽).</p>
                <p>• По броням: себестоимость одного отеля и одного билета берётся из «Доп. услуги».</p>
                <p>• Налог (УСН) — % от полной цены каждой позиции (визы + брони).</p>
                <p><span className="opacity-100 font-semibold">Выплачено партнёрам</span> — реальные переводы на карту за период (логи partner_paid). Pending в hold и approved-к-выплате не вычитаются — это обязательства, а не cash-out, они в карточке «Долг компании».</p>
                <p>Обычные бонусы (welcome / referral / админские начисления) НЕ вычитаются из прибыли — они увеличивают баланс юзера, реальный расход возникает когда юзер их применит (это уже в выручке через price − bonuses_used).</p>
              </div>
            </div>
          )}
        </div>

        {/* Долг компании — обычные бонусы + партнёрские (к выплате + в hold) */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-700 p-5 rounded-xl text-white">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs uppercase tracking-wider opacity-80">Долг компании</p>
            <Coins size={16} className="opacity-70" />
          </div>
          <p className="text-3xl font-bold leading-tight">
            {fmtRub((stats?.bonusesOutstanding ?? 0) + (stats?.partnerOwedToPay ?? 0) + (stats?.partnerHoldOutstanding ?? 0))}
          </p>
          <div className="text-xs opacity-90 mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="opacity-80">Юзерам в бонусах</span>
              <span className="font-mono">{fmtRub(stats?.bonusesOutstanding ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-80">Партнёрам к выплате</span>
              <span className="font-mono">{fmtRub(stats?.partnerOwedToPay ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-80">Партнёрам в hold (30д)</span>
              <span className="font-mono">{fmtRub(stats?.partnerHoldOutstanding ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cost breakdown — что реально вычитается из прибыли */}
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2 mt-2">Расходы (вычитаются из прибыли)</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="bg-red-50 border border-red-100 p-3 rounded-lg">
          <p className="text-xs text-red-600">Себестоимость виз</p>
          <p className="text-lg font-semibold text-red-800">−{fmtRub(stats?.costOfGoods ?? 0)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 p-3 rounded-lg">
          <p className="text-xs text-red-600">Налог</p>
          <p className="text-lg font-semibold text-red-800">−{fmtRub(stats?.taxes ?? 0)}</p>
        </div>
        <div
          className="bg-red-50 border border-red-100 p-3 rounded-lg cursor-help"
          title="Реальные выплаты партнёрам на карту за период (логи partner_paid). Это и есть cash-out из кассы. Деньги в hold и к выплате — в карточке «Долг компании», они НЕ вычитаются из прибыли."
        >
          <p className="text-xs text-red-600">Выплачено партнёрам <span className="text-red-400">ⓘ</span></p>
          <p className="text-lg font-semibold text-red-800">−{fmtRub(stats?.commissionsPaid ?? 0)}</p>
        </div>
      </div>

      {/* Bonus journal — информационно: как двигались балансы юзеров */}
      <p className="text-xs uppercase tracking-wider text-[#0F2A36]/60 mb-2">
        Журнал бонусов
        <span
          className="text-[#0F2A36]/45 normal-case tracking-normal cursor-help ml-1"
          title="Эти суммы НЕ вычитаются из прибыли отдельно: выданные бонусы — это долг компании, реальный расход возникает только когда юзер применяет их при оплате визы (это уже учтено в выручке через price − bonuses_used)."
        >
          (информация — не влияет на прибыль ⓘ)
        </span>
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-[#0F2A36]/60">Welcome (новичкам)</p>
          <p className="text-lg font-semibold text-[#0F2A36]/80">+{fmtRub(stats?.welcomeBonusesPaid ?? 0)}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-[#0F2A36]/60">Реф-бонусы (обычным)</p>
          <p className="text-lg font-semibold text-[#0F2A36]/80">+{fmtRub(stats?.referralBonusesIssued ?? 0)}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-[#0F2A36]/60">Прочие (daily/admin/…)</p>
          <p className="text-lg font-semibold text-[#0F2A36]/80">+{fmtRub(stats?.otherBonusesPaid ?? 0)}</p>
        </div>
        <div
          className="bg-gray-50 p-3 rounded-lg cursor-help"
          title="Эти бонусы клиенты применили как скидку при оплате визы. Они УЖЕ снижают прибыль через выручку (revenue = price − bonuses_used) — отдельно из прибыли не вычитаются."
        >
          <p className="text-xs text-[#0F2A36]/60">Списано клиентами <span className="text-[#0F2A36]/45">(уже в выручке) ⓘ</span></p>
          <p className="text-lg font-semibold text-[#0F2A36]/80">−{fmtRub(stats?.bonusesUsed ?? 0)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-[#0F2A36]/65">Выручка / Прибыль по дням</p>
          <div className="flex items-center gap-3 text-xs text-[#0F2A36]/60">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#3B5BFF] rounded-sm" /> Выручка</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-sm" /> Прибыль</span>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-sm text-[#0F2A36]/45">Нет данных</div>
        ) : (
          <div className="h-24 flex items-end gap-0.5">
            {chartData.map((d, i) => {
              const revH = Math.max(2, (d.revenue / maxRev) * 100);
              const profH = Math.max(0, (Math.max(0, d.profit) / maxRev) * 100);
              const dateLabel = new Date(d.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
              return (
                <div
                  key={i}
                  className="flex-1 relative flex items-end"
                  title={`${dateLabel}: выручка ${fmtRub(d.revenue)} · прибыль ${fmtRub(d.profit)}`}
                >
                  <div className="absolute bottom-0 left-0 right-0 bg-[#3B5BFF]/40 rounded-t" style={{ height: `${revH}%` }} />
                  <div className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t" style={{ height: `${profH}%` }} />
                </div>
              );
            })}
          </div>
        )}
        {chartData.length > 0 && (
          <div className="flex justify-between text-[10px] text-[#0F2A36]/45 mt-1">
            <span>{new Date(chartData[0].date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span>
            <span>{new Date(chartData[chartData.length - 1].date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span>
          </div>
        )}
      </div>
    </Card>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { applications } = useAdminApplications();
  const { users } = useAdminUsers();

  const totalApplications = applications.length;
  const inProgressApplications = applications.filter(a => a.status === 'in_progress').length;
  const totalUsers = users.filter(u => u.status === 'regular').length;
  const partnersCount = users.filter(u => u.status === 'partner').length;
  // (Removed: "Последние 10 заявок" — admin manages real apps in the dedicated Заявки section.)

  const newUsers24h = users.filter(u => {
    const t = new Date(u.registeredAt).getTime();
    return Date.now() - t < 24 * 3600_000;
  });

  return (
    <div className="p-8">
      <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36] mb-8">Dashboard</h1>

      {/* Top stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={<FileText size={24} />}    label="Всего заявок"   value={totalApplications}        color="#3B5BFF" onClick={() => onNavigate?.('applications', { filter: 'all' })} />
        <StatCard icon={<TrendingUp size={24} />}  label="В работе"       value={inProgressApplications}   color="#FF9800" onClick={() => onNavigate?.('applications', { filter: 'in_progress' })} />
        <StatCard icon={<Users size={24} />}       label="Пользователи"   value={totalUsers}               color="#10B981" onClick={() => onNavigate?.('users', { filter: 'regular' })} />
        <StatCard icon={<Globe size={24} />}       label="Партнёры"       value={partnersCount}            color="#9C27B0" onClick={() => onNavigate?.('users', { filter: 'partners' })} />
      </div>

      {/* Finance */}
      <FinanceSection />

      {/* New Users 24h */}
      <Card variant="flat" padding="lg" radius="xl" className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-[#EAF1FF]"><Users size={20} className="text-[#3B5BFF]" /></div>
          <h3 className="text-base font-bold text-[#0F2A36]">Новые пользователи за 24 часа · {newUsers24h.length}</h3>
        </div>
        {newUsers24h.length === 0 ? (
          <p className="text-sm text-[#0F2A36]/45">Никто новый не зарегистрировался</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {newUsers24h.map(user => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-3 h-3 rounded-full ${user.status === 'partner' ? 'bg-purple-500' : 'bg-emerald-500'}`} title={user.status === 'partner' ? 'Партнёр' : 'Обычный'} />
                  <div className="flex-1">
                    <p className="text-sm text-[#0F2A36]">{user.name}</p>
                    <p className="text-xs text-[#0F2A36]/60">{user.email || '—'}</p>
                  </div>
                </div>
                <p className="text-xs text-[#0F2A36]/60">
                  {new Date(user.registeredAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

    </div>
  );
};
