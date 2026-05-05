import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Users, Globe, TrendingUp, Wallet, PiggyBank, Coins, Loader2,
  Info, ChevronDown,
} from 'lucide-react';
import { statusLabels } from '../data/mockData';
import { useAdminApplications, useAdminUsers } from '../hooks/useAdminData';
import { getFinanceStats, type FinanceStats } from '../../lib/db';

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  onClick?: () => void;
}> = ({ icon, label, value, color, onClick }) => (
  <div
    className={`bg-white p-6 rounded-xl border border-gray-200 transition-all ${onClick ? 'cursor-pointer hover:shadow-lg hover:border-[#3B5BFF]' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className="text-2xl">{value}</p>
      </div>
      <div className="p-3 rounded-lg" style={{ backgroundColor: color + '20' }}>
        <div style={{ color }}>{icon}</div>
      </div>
    </div>
  </div>
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
    <div className="bg-white p-6 rounded-xl border border-gray-200 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100">
            <Wallet size={20} className="text-emerald-600" />
          </div>
          <h3>Финансы</h3>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
        <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                period === p.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
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
          <p className="text-xs opacity-75 mt-1">{stats?.paidApplicationsCount ?? 0} оплачено · после скидок бонусами</p>
          {showRevenueFormula && (
            <div className="mt-3 pt-3 border-t border-white/20 text-xs space-y-1 leading-relaxed">
              <p className="font-semibold opacity-90">Как считается выручка:</p>
              <p className="font-mono opacity-80">price − bonuses_used</p>
              <p className="opacity-80">Сумма по всем оплаченным заявкам (статусы in_progress + ready) с учётом списанных клиентом бонусов.</p>
              <p className="opacity-80 pt-1">Бонусы списанные клиентом уменьшают выручку — это уже потерянная нами скидка.</p>
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
              <p className="font-sans font-semibold opacity-90 mb-2">Формула прибыли:</p>
              <p className="opacity-90">Выручка <span className="float-right">{fmtRub(stats?.revenue ?? 0)}</span></p>
              <p className="opacity-80">− Себестоимость виз/билетов <span className="float-right">−{fmtRub(stats?.costOfGoods ?? 0)}</span></p>
              <p className="opacity-80">− Налог (УСН) <span className="float-right">−{fmtRub(stats?.taxes ?? 0)}</span></p>
              <p className="opacity-80">− Партнёрам (профит-шеринг) <span className="float-right">−{fmtRub(stats?.commissionsPaid ?? 0)}</span></p>
              <p className="font-semibold opacity-100 pt-1 border-t border-white/20">= Прибыль <span className="float-right">{fmtRub(stats?.profit ?? 0)}</span></p>
              <p className="font-sans opacity-75 pt-2 leading-snug">Себестоимость = ($сбор + $комиссия) × курс USD заявки + себест. аддонов (билет 780₽ и т.д.). Бонусы клиентов уже учтены в выручке.</p>
            </div>
          )}
        </div>

        {/* Bonuses owed */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-700 p-5 rounded-xl text-white">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs uppercase tracking-wider opacity-80">Бонусы у юзеров</p>
            <Coins size={16} className="opacity-70" />
          </div>
          <p className="text-3xl font-bold leading-tight">{fmtRub(stats?.bonusesOutstanding ?? 0)}</p>
          <p className="text-xs opacity-75 mt-1">текущий долг (на балансах юзеров)</p>
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
        <div className="bg-red-50 border border-red-100 p-3 rounded-lg">
          <p className="text-xs text-red-600">Партнёрам (профит-шеринг)</p>
          <p className="text-lg font-semibold text-red-800">−{fmtRub(stats?.commissionsPaid ?? 0)}</p>
        </div>
      </div>

      {/* Bonus journal — информационно: как двигались балансы юзеров */}
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">
        Журнал бонусов
        <span
          className="text-gray-400 normal-case tracking-normal cursor-help ml-1"
          title="Эти суммы НЕ вычитаются из прибыли отдельно: выданные бонусы — это долг компании, реальный расход возникает только когда юзер применяет их при оплате визы (это уже учтено в выручке через price − bonuses_used)."
        >
          (информация — не влияет на прибыль ⓘ)
        </span>
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-gray-500">Welcome (+200₽ за реф.)</p>
          <p className="text-lg font-semibold text-gray-700">+{fmtRub(stats?.welcomeBonusesPaid ?? 0)}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-gray-500">Прочие (daily/admin/…)</p>
          <p className="text-lg font-semibold text-gray-700">+{fmtRub(stats?.otherBonusesPaid ?? 0)}</p>
        </div>
        <div
          className="bg-gray-50 p-3 rounded-lg cursor-help"
          title="Эти бонусы клиенты применили как скидку при оплате визы. Они УЖЕ снижают прибыль через выручку (revenue = price − bonuses_used) — отдельно из прибыли не вычитаются."
        >
          <p className="text-xs text-gray-500">Списано клиентами <span className="text-gray-400">(уже в выручке) ⓘ</span></p>
          <p className="text-lg font-semibold text-gray-700">−{fmtRub(stats?.bonusesUsed ?? 0)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-600">Выручка / Прибыль по дням</p>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-sm" /> Выручка</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-sm" /> Прибыль</span>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-sm text-gray-400">Нет данных</div>
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
                  <div className="absolute bottom-0 left-0 right-0 bg-blue-500/40 rounded-t" style={{ height: `${revH}%` }} />
                  <div className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t" style={{ height: `${profH}%` }} />
                </div>
              );
            })}
          </div>
        )}
        {chartData.length > 0 && (
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>{new Date(chartData[0].date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span>
            <span>{new Date(chartData[chartData.length - 1].date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span>
          </div>
        )}
      </div>
    </div>
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
  const recentApplications = applications.slice(0, 10);

  const newUsers24h = users.filter(u => {
    const t = new Date(u.registeredAt).getTime();
    return Date.now() - t < 24 * 3600_000;
  });

  return (
    <div className="p-8">
      <h1 className="mb-8">Dashboard</h1>

      {/* Top stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={<FileText size={24} />}    label="Всего заявок"   value={totalApplications}        color="#3B5BFF" onClick={() => onNavigate?.('applications', { filter: 'all' })} />
        <StatCard icon={<TrendingUp size={24} />}  label="В работе"       value={inProgressApplications}   color="#FF9800" onClick={() => onNavigate?.('applications', { filter: 'in_progress' })} />
        <StatCard icon={<Users size={24} />}       label="Пользователи"   value={totalUsers}               color="#00C853" onClick={() => onNavigate?.('users', { filter: 'regular' })} />
        <StatCard icon={<Globe size={24} />}       label="Партнёры"       value={partnersCount}            color="#9C27B0" onClick={() => onNavigate?.('users', { filter: 'partners' })} />
      </div>

      {/* Finance */}
      <FinanceSection />

      {/* New Users 24h */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-100"><Users size={20} className="text-blue-600" /></div>
          <h3>Новые пользователи за 24 часа · {newUsers24h.length}</h3>
        </div>
        {newUsers24h.length === 0 ? (
          <p className="text-sm text-gray-400">Никто новый не зарегистрировался</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {newUsers24h.map(user => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-3 h-3 rounded-full ${user.status === 'partner' ? 'bg-purple-500' : 'bg-green-500'}`} title={user.status === 'partner' ? 'Партнёр' : 'Обычный'} />
                  <div className="flex-1">
                    <p className="text-sm">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email || '—'}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(user.registeredAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Applications */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200"><h3>Последние 10 заявок</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F7FA]">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600">ID</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Страна</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Клиент</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Стоимость</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Статус</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentApplications.map((app) => (
                <tr key={app.id} className="hover:bg-[#F5F7FA]">
                  <td className="px-6 py-4 text-sm">{app.id.slice(0, 8)}</td>
                  <td className="px-6 py-4 text-sm"><span className="mr-2">{app.countryFlag}</span>{app.country}</td>
                  <td className="px-6 py-4 text-sm">{app.clientName}</td>
                  <td className="px-6 py-4 text-sm">{app.cost.toLocaleString('ru-RU')} ₽</td>
                  <td className="px-6 py-4 text-sm"><span className="px-2 py-1 bg-[#F5F7FA] rounded text-xs">{statusLabels[app.status]}</span></td>
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(app.date).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
